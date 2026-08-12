"""PDL 免费公司数据集的本地导入、查询和静态页面服务。

公司发现部分只处理 People Data Labs 发布的 Free Company Dataset，不调用收费的
PDL Person Search API，也不从公司字段猜测联系人、邮箱或电话。用户明确点击单家公司后，
可选的 Hunter Domain Search 会按该公司的已知域名补充公开联系人。

典型用法：

1. 导入用户从 PDL 官网下载的 CSV、PSV、JSON 或 ZIP 文件。
2. 启动只监听本机的 HTTP 服务，同时提供赢单静态原型、只读公司搜索接口，以及使用
   服务端 ``HUNTER_API_KEY`` 的按需联系人查询接口。

数据库和日志默认写入本目录下被 ``.gitignore`` 排除的目录，避免把大文件或
用户本地路径意外提交到 Git。
"""

from __future__ import annotations

import argparse
import contextlib
import dataclasses
import datetime as dt
import ipaddress
import json
import logging
import os
import re
import shutil
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Iterator, Literal, Mapping, Sequence
from urllib.parse import parse_qs, urlencode, urlparse

import duckdb


MODULE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = MODULE_DIR.parents[1]
DEFAULT_DATABASE = MODULE_DIR / "data" / "pdl_companies.duckdb"
DEFAULT_LOG_FILE = MODULE_DIR / "logs" / "pdl-local.log"
SUPPORTED_SUFFIXES = (
    ".csv",
    ".csv.gz",
    ".csv.zip",
    ".psv",
    ".psv.gz",
    ".psv.zip",
    ".json",
    ".json.gz",
    ".json.zip",
    ".jsonl",
    ".jsonl.gz",
    ".jsonl.zip",
    ".ndjson",
    ".ndjson.gz",
    ".ndjson.zip",
)
MAX_RESULT_LIMIT = 500
DEFAULT_SORT_MODE = "recommended"
SORT_MODES = frozenset({DEFAULT_SORT_MODE, "complete", "size_desc"})
HUNTER_API_BASE_URL = "https://api.hunter.io/v2"
HUNTER_CONTACT_LIMIT = 10


class PdlDataError(RuntimeError):
    """表示 PDL 文件、字段或本地数据库不符合预期。"""


class HunterApiError(RuntimeError):
    """表示 Hunter 配置、额度或上游服务出现可安全展示的错误。

    Attributes:
        code: 返回给本地前端的稳定错误码。
        http_status: 本地代理应返回的 HTTP 状态。
        message: 不包含 API Key、上游请求 URL 或 Hunter 原始响应的安全提示。
    """

    def __init__(self, code: str, http_status: HTTPStatus, message: str) -> None:
        """保存已经脱敏的 Hunter 错误。

        Args:
            code: 前端可据此区分未配置、额度耗尽和临时故障。
            http_status: 本地 HTTP 代理返回的状态码。
            message: 用户可读的中文错误消息。

        Raises:
            本函数不主动抛异常。
        """

        super().__init__(message)
        self.code = code
        self.http_status = http_status


def normalize_hunter_domain(value: object) -> str:
    """把 PDL 官网或前端输入转换为 Hunter 接受的普通公网域名。

    Args:
        value: 公司域名或 HTTP(S) 官网地址。

    Returns:
        小写、移除 ``www.`` 且经过 IDNA 规范化的域名。

    Raises:
        ValueError: 输入为空、含账号凭证、是 IP/localhost 或域名结构无效时抛出。

    Hunter 请求固定发往官方 API，不会直接访问该域名；这里仍做严格校验，避免把路径、
    邮箱、任意 URL 或异常长文本带入计费查询。
    """

    raw_value = str(value or "").strip()
    if not raw_value or len(raw_value) > 500:
        raise ValueError("请先补充有效的公司域名。")

    candidate = raw_value if "://" in raw_value else f"https://{raw_value}"
    parsed = urlparse(candidate)
    if parsed.scheme.lower() not in {"http", "https"} or parsed.username or parsed.password:
        raise ValueError("公司域名格式无效。")

    hostname = str(parsed.hostname or "").strip().rstrip(".").lower()
    if hostname.startswith("www."):
        hostname = hostname[4:]
    try:
        hostname = hostname.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise ValueError("公司域名格式无效。") from exc

    if not hostname or len(hostname) > 253 or "." not in hostname or hostname == "localhost":
        raise ValueError("公司域名格式无效。")
    try:
        ipaddress.ip_address(hostname)
    except ValueError:
        pass
    else:
        raise ValueError("公司域名必须是普通公网域名，不能使用 IP 地址。")

    label_pattern = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
    if any(not label_pattern.fullmatch(label) for label in hostname.split(".")):
        raise ValueError("公司域名格式无效。")
    return hostname


def _normalize_hunter_linkedin(value: object) -> str:
    """把 Hunter 联系人的 LinkedIn 字段转换为安全个人主页 URL。

    Args:
        value: Hunter 返回的完整 URL、裸路径、handle 或空值。

    Returns:
        只允许 ``https://www.linkedin.com/in/...`` 的绝对地址；否则返回空字符串。

    Raises:
        本函数不主动抛异常；任何解析失败都返回空字符串。
    """

    raw_value = str(value or "").strip()
    if not raw_value:
        return ""
    if re.fullmatch(r"[A-Za-z0-9._-]{2,100}", raw_value):
        raw_value = f"https://www.linkedin.com/in/{raw_value}"
    elif not re.match(r"^https?://", raw_value, flags=re.IGNORECASE):
        raw_value = f"https://{raw_value.lstrip('/')}"

    try:
        parsed = urlparse(raw_value)
        hostname = str(parsed.hostname or "").lower().removeprefix("www.")
        if parsed.scheme.lower() not in {"http", "https"} or hostname != "linkedin.com":
            return ""
        if not re.match(r"^/in/[A-Za-z0-9%._~-]+/?$", parsed.path):
            return ""
        return f"https://www.linkedin.com{parsed.path.rstrip('/')}"
    except (TypeError, ValueError):
        return ""


def _normalize_hunter_contact(record: Mapping[str, object]) -> dict[str, object] | None:
    """把一条 Hunter 邮箱记录压缩成前端需要的联系人字段。

    Args:
        record: Hunter Domain Search 的单个 ``emails`` 元素。

    Returns:
        通过邮箱结构校验的联系人字典；邮箱无效时返回 ``None``。

    Raises:
        本函数不主动抛异常；第三方缺失字段会使用空值。

    原始 sources 最多可有 20 条 URL，当前产品不需要把整组网页明细发给浏览器；只保留
    来源数量和最近发现日期，既能表达可追溯性，也减少不必要的个人信息扩散。
    """

    email = str(record.get("value") or "").strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email) or len(email) > 320:
        return None

    email_type = str(record.get("type") or "").strip().lower()
    first_name = str(record.get("first_name") or "").strip()[:100]
    last_name = str(record.get("last_name") or "").strip()[:100]
    full_name = " ".join(part for part in (first_name, last_name) if part)
    name = full_name or ("通用邮箱" if email_type == "generic" else "联系人姓名待补充")
    verification = record.get("verification") if isinstance(record.get("verification"), Mapping) else {}
    sources = record.get("sources") if isinstance(record.get("sources"), list) else []
    last_seen_dates = sorted(
        str(source.get("last_seen_on") or "").strip()
        for source in sources
        if isinstance(source, Mapping) and source.get("last_seen_on")
    )

    confidence_value = record.get("confidence")
    try:
        confidence = max(0, min(int(confidence_value or 0), 100))
    except (TypeError, ValueError):
        confidence = 0

    return {
        "name": name,
        "first_name": first_name,
        "last_name": last_name,
        "title": str(record.get("position") or "").strip()[:200],
        "email": email,
        "type": "generic" if email_type == "generic" else "personal",
        "confidence": confidence,
        "department": str(record.get("department") or "").strip().lower()[:80],
        "seniority": str(record.get("seniority") or "").strip().lower()[:80],
        "decision_maker": record.get("decision_maker") if isinstance(record.get("decision_maker"), bool) else None,
        "verification_status": str(verification.get("status") or "").strip().lower()[:80],
        "linkedin": _normalize_hunter_linkedin(record.get("linkedin")),
        "phone": str(record.get("phone_number") or "").strip()[:100],
        "source": "Hunter Domain Search",
        "source_count": len(sources),
        "last_seen_on": last_seen_dates[-1] if last_seen_dates else "",
    }


def _safe_non_negative_int(value: object, fallback: int = 0) -> int:
    """把 Hunter 的计数字段安全转换为非负整数。

    Args:
        value: Hunter 返回的总数或聚合值，可能是数字、字符串或空值。
        fallback: 第三方值无法转换时使用的非负默认值。

    Returns:
        大于等于 0 的整数。

    Raises:
        本函数不主动抛异常；异常第三方字段会回退到 ``fallback``。

    Hunter 的核心联系人数组已经独立校验。这里不应因为一个辅助计数字段格式异常，
    让用户丢失整组原本可用的联系人。
    """

    try:
        return max(0, int(value))
    except (TypeError, ValueError, OverflowError):
        return max(0, int(fallback))


class HunterClient:
    """使用服务端 API Key 调用 Hunter Domain Search 的最小客户端。"""

    def __init__(
        self,
        api_key: str,
        *,
        api_base_url: str = HUNTER_API_BASE_URL,
        timeout_seconds: float = 10.0,
    ) -> None:
        """创建 Hunter 客户端。

        Args:
            api_key: 只应来自服务端 ``HUNTER_API_KEY`` 环境变量。
            api_base_url: 官方 API 根地址；仅测试可注入本地替身。
            timeout_seconds: 单次上游请求超时秒数。

        Raises:
            ValueError: 超时不为正数时抛出。
        """

        if timeout_seconds <= 0:
            raise ValueError("Hunter 超时时间必须大于 0。")
        self.api_key = str(api_key or "").strip()
        self.api_base_url = str(api_base_url or HUNTER_API_BASE_URL).rstrip("/")
        self.timeout_seconds = timeout_seconds

    @classmethod
    def from_env(cls) -> "HunterClient":
        """从当前服务端环境创建客户端。

        Returns:
            使用 ``HUNTER_API_KEY`` 的客户端；未配置时仍返回不可调用的空客户端。

        Raises:
            本函数不主动抛异常。
        """

        return cls(os.environ.get("HUNTER_API_KEY", ""))

    @property
    def configured(self) -> bool:
        """返回服务端是否存在 Hunter Key，绝不返回 Key 本身。"""

        return bool(self.api_key)

    def _raise_for_http_error(self, status_code: int) -> None:
        """把 Hunter HTTP 状态转换为不包含请求 URL 的本地错误。

        Args:
            status_code: Hunter 返回的 HTTP 状态。

        Returns:
            此函数不会正常返回。

        Raises:
            HunterApiError: 始终抛出对应的安全错误。
        """

        if status_code == 400:
            raise HunterApiError("hunter_invalid_query", HTTPStatus.BAD_REQUEST, "Hunter 拒绝了公司域名或查询参数。")
        if status_code == 401:
            raise HunterApiError(
                "hunter_invalid_key",
                HTTPStatus.SERVICE_UNAVAILABLE,
                "Hunter API Key 无效，请重新配置 HUNTER_API_KEY。",
            )
        if status_code == 403:
            raise HunterApiError("hunter_rate_limited", HTTPStatus.TOO_MANY_REQUESTS, "Hunter 请求频率达到限制，请稍后重试。")
        if status_code == 429:
            raise HunterApiError("hunter_quota_exhausted", HTTPStatus.TOO_MANY_REQUESTS, "Hunter 本期查询额度已用完。")
        if status_code == 451:
            raise HunterApiError(
                "hunter_legal_restriction",
                HTTPStatus.UNAVAILABLE_FOR_LEGAL_REASONS,
                "Hunter 因法律或隐私要求不能处理这条联系人查询。",
            )
        raise HunterApiError("hunter_upstream_error", HTTPStatus.BAD_GATEWAY, "Hunter 联系人服务暂时不可用。")

    def domain_search(self, domain: object, *, limit: int = HUNTER_CONTACT_LIMIT) -> dict[str, object]:
        """按一个已知公司域名查询最多 10 条 Hunter 联系人。

        Args:
            domain: PDL 公司域名或官网地址。
            limit: 希望返回的邮箱数；为兼容 Hunter 免费计划强制限制在 1 至 10。

        Returns:
            公司域名、组织名、总命中数和按决策价值排序的联系人数组。

        Raises:
            ValueError: 域名结构无效时抛出。
            HunterApiError: Key 缺失、额度耗尽、网络异常或上游响应无效时抛出。

        该调用可能消耗 Hunter 额度，因此只允许由用户点击后触发，不能在 PDL 公司列表
        搜索时批量或自动执行。
        """

        if not self.configured:
            raise HunterApiError(
                "hunter_not_configured",
                HTTPStatus.SERVICE_UNAVAILABLE,
                "Hunter 尚未配置。请在启动本地服务前设置 HUNTER_API_KEY。",
            )

        normalized_domain = normalize_hunter_domain(domain)
        safe_limit = max(1, min(int(limit), HUNTER_CONTACT_LIMIT))
        query = urlencode(
            {
                "domain": normalized_domain,
                "limit": safe_limit,
                "offset": 0,
                "aggregations": "true",
                "api_key": self.api_key,
            }
        )
        request = urllib.request.Request(
            f"{self.api_base_url}/domain-search?{query}",
            headers={"Accept": "application/json", "User-Agent": "Yingdan-Prototype/0.2"},
            method="GET",
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            # 不记录 ``exc.url`` 或异常正文，因为 URL 中包含 Hunter API Key。
            self._raise_for_http_error(exc.code)
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise HunterApiError(
                "hunter_network_error",
                HTTPStatus.BAD_GATEWAY,
                "无法连接 Hunter 联系人服务，请稍后重试。",
            ) from exc
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise HunterApiError(
                "hunter_invalid_response",
                HTTPStatus.BAD_GATEWAY,
                "Hunter 返回了无法识别的数据。",
            ) from exc

        if not isinstance(payload, Mapping) or not isinstance(payload.get("data"), Mapping):
            raise HunterApiError(
                "hunter_invalid_response",
                HTTPStatus.BAD_GATEWAY,
                "Hunter 返回了无法识别的数据。",
            )

        data = payload["data"]
        meta = payload.get("meta") if isinstance(payload.get("meta"), Mapping) else {}
        records = data.get("emails") if isinstance(data.get("emails"), list) else []
        contacts = [
            contact
            for record in records
            if isinstance(record, Mapping)
            if (contact := _normalize_hunter_contact(record))
        ]
        contacts.sort(
            key=lambda contact: (
                contact["decision_maker"] is not True,
                contact["type"] != "personal",
                -int(contact["confidence"]),
                str(contact["name"]).lower(),
            )
        )
        aggregations = meta.get("aggregations") if isinstance(meta.get("aggregations"), Mapping) else {}
        try:
            response_domain = normalize_hunter_domain(data.get("domain") or normalized_domain)
        except ValueError:
            # 联系人数组可用时，不让 Hunter 的可选 domain 回显字段破坏整次结果。
            response_domain = normalized_domain

        return {
            "provider": "hunter",
            "domain": response_domain,
            "organization": str(data.get("organization") or "").strip()[:200],
            "pattern": str(data.get("pattern") or "").strip()[:100],
            "accept_all": data.get("accept_all") is True,
            "contacts": contacts,
            "total": _safe_non_negative_int(meta.get("results"), len(contacts)),
            "limit": safe_limit,
            "aggregations": {
                "personal": _safe_non_negative_int(aggregations.get("personal")),
                "generic": _safe_non_negative_int(aggregations.get("generic")),
                "decision_makers": _safe_non_negative_int(aggregations.get("decision_makers")),
            },
        }

    def email_count(self, domain: object) -> dict[str, object]:
        """免费查询一个公司域名下可获取的邮箱数量。

        Args:
            domain: PDL 公司域名或官网地址。

        Returns:
            规范域名以及 Hunter 已收录的个人邮箱、通用邮箱和总数。

        Raises:
            ValueError: 域名结构无效时抛出。
            HunterApiError: Key 缺失、网络异常或上游响应无效时抛出。

        Hunter 官方把 Email Count 定义为免费接口。它只用于在用户决定付费获取
        联系人之前展示可获取数量，不能返回姓名、岗位或邮箱明文。
        """

        if not self.configured:
            raise HunterApiError(
                "hunter_not_configured",
                HTTPStatus.SERVICE_UNAVAILABLE,
                "Hunter 尚未配置。请在启动本地服务前设置 HUNTER_API_KEY。",
            )

        normalized_domain = normalize_hunter_domain(domain)
        query = urlencode({"domain": normalized_domain, "api_key": self.api_key})
        request = urllib.request.Request(
            f"{self.api_base_url}/email-count?{query}",
            headers={"Accept": "application/json", "User-Agent": "Yingdan-Prototype/0.2"},
            method="GET",
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            self._raise_for_http_error(exc.code)
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise HunterApiError(
                "hunter_network_error",
                HTTPStatus.BAD_GATEWAY,
                "无法连接 Hunter 联系人数量服务，请稍后重试。",
            ) from exc
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise HunterApiError(
                "hunter_invalid_response",
                HTTPStatus.BAD_GATEWAY,
                "Hunter 返回了无法识别的数据。",
            ) from exc

        if not isinstance(payload, Mapping) or not isinstance(payload.get("data"), Mapping):
            raise HunterApiError(
                "hunter_invalid_response",
                HTTPStatus.BAD_GATEWAY,
                "Hunter 返回了无法识别的数据。",
            )

        data = payload["data"]
        personal = _safe_non_negative_int(data.get("personal_emails"), _safe_non_negative_int(data.get("personal")))
        generic = _safe_non_negative_int(data.get("generic_emails"), _safe_non_negative_int(data.get("generic")))
        total = _safe_non_negative_int(data.get("total"), personal + generic)
        return {
            "provider": "hunter",
            "domain": normalized_domain,
            "personal": personal,
            "generic": generic,
            "total": total,
        }


@dataclasses.dataclass(frozen=True)
class SearchFilters:
    """公司搜索使用的安全、结构化筛选条件。

    Attributes:
        country: PDL 英文规范国家名，例如 ``germany``。
        industries: 与用户产品相关的 PDL 规范行业列表；列表内部使用 OR。
        role: 用户选择的优先客户类型；只用于证据评分和排序。
        sizes: 允许匹配的员工规模区间，例如 ``11-50``。
        founded_from: 最早成立年份，包含边界。
        founded_to: 最晚成立年份，包含边界。
        query: 公司名称、域名或 LinkedIn URL 的模糊搜索词。
        sort: 排序方式，只允许推荐、资料完整度和公司规模三种服务端白名单值。
        limit: 当前请求最多返回多少家公司。
        offset: 分页偏移量。
    """

    country: str = ""
    industries: tuple[str, ...] = ()
    role: str = ""
    sizes: tuple[str, ...] = ()
    founded_from: int | None = None
    founded_to: int | None = None
    query: str = ""
    sort: str = DEFAULT_SORT_MODE
    limit: int = 20
    offset: int = 0


RoleSupport = Literal["high", "medium", "none"]
RoleLevel = Literal["high", "medium", "weak", "unknown"]
NO_ROLE_PREFERENCE = "不限 / 智能推荐"


@dataclasses.dataclass(frozen=True)
class RoleProfile:
    """一种用户可选客户类型对应的可解释匹配规则。

    Attributes:
        support: 当前 PDL 字段对该类型的最高支持程度。
        industries: 可以作为行业证据的 PDL 规范行业完整值。
        strong_terms: 公司名称或域名中能够形成强身份信号的关键词。
        weak_terms: 只能形成弱提示、不能独立支持“可能匹配”的关键词。
        conflict_terms: 与用户目标角色可能冲突、需要降低置信度的关键词。
        industry_terms: 可在 PDL 行业中按片段匹配的规范词，例如 manufacturing。

    规则只描述“哪些公开字段支持这种推测”，不代表公司已经确认该商业角色。
    """

    support: RoleSupport
    industries: tuple[str, ...] = ()
    strong_terms: tuple[str, ...] = ()
    weak_terms: tuple[str, ...] = ()
    conflict_terms: tuple[str, ...] = ()
    industry_terms: tuple[str, ...] = ()


@dataclasses.dataclass(frozen=True)
class RoleMatch:
    """一家公司针对本轮目标客户类型的推测结果。

    Attributes:
        requested_role: 用户本轮选择的优先客户类型。
        support: 当前数据字段对该类型的支持等级。
        score: 内部排序分，范围为 0 至 100。
        level: 用户可见的 high、medium、weak 或 unknown 等级。
        label: 页面显示的保守中文结论。
        evidence: 形成判断的结构化字段证据；可能包含冲突提醒。
        verified: 是否经独立官方来源确认；PDL 推测始终为 False。
    """

    requested_role: str
    support: RoleSupport
    score: int
    level: RoleLevel
    label: str
    evidence: tuple[dict[str, str], ...]
    verified: bool = False

    def to_dict(self) -> dict[str, object]:
        """转换成可以直接写入 API JSON 的字段。

        Returns:
            包含请求角色、支持等级、分数、标签、证据和核验状态的字典。

        Raises:
            本函数不主动抛异常。
        """

        return {
            "requested_role": self.requested_role,
            "role_support": self.support,
            "role_match_score": self.score,
            "role_match_level": self.level,
            "role_match_label": self.label,
            "role_match_evidence": list(self.evidence),
            "role_verified": self.verified,
        }


# 这些规则只使用免费公司库已有的行业、公司名称和域名。支持级别为 none 的类型
# 仍保留在配置中，以便接口明确返回“无法判断”，而不是悄悄套用其它角色规则。
CUSTOMER_ROLE_PROFILES: dict[str, RoleProfile] = {
    "进口商": RoleProfile(
        "high",
        ("import and export", "international trade and development"),
        ("importer", "imports", "import/export", "importadora", "importaciones", "importateur", "进出口"),
    ),
    "批发商": RoleProfile(
        "high",
        ("wholesale",),
        ("wholesale", "wholesaler", "cash and carry", "mayorista", "atacado", "grosshandel", "批发"),
    ),
    "分销商": RoleProfile(
        "high",
        ("wholesale", "import and export"),
        ("distributor", "distribution", "distributora", "distribuidora", "distributeur", "分销"),
        conflict_terms=("manufacturer", "manufacturing", "factory", "制造", "工厂"),
    ),
    "经销商": RoleProfile(
        "high",
        ("wholesale", "retail"),
        ("dealer", "dealership", "authorized dealer", "经销"),
        conflict_terms=("manufacturer", "manufacturing", "factory", "制造", "工厂"),
    ),
    "代理商": RoleProfile(
        "medium",
        ("wholesale", "import and export"),
        ("authorized agent", "sales agent", "representative", "代理"),
        ("agency",),
    ),
    "贸易公司": RoleProfile(
        "high",
        ("import and export", "international trade and development"),
        ("trading", "trading company", "commercial trading", "comercializadora", "贸易"),
    ),
    "品牌商": RoleProfile("none", weak_terms=("brand", "brands", "品牌")),
    "制造商": RoleProfile(
        "high",
        strong_terms=("manufacturer", "manufacturing", "factory", "works", "fabrication", "制造", "工厂"),
        industry_terms=("manufacturing", "production"),
    ),
    "OEM / ODM 采购商": RoleProfile("none", weak_terms=("oem", "odm")),
    "零售商": RoleProfile(
        "high",
        ("retail", "supermarkets"),
        ("retailer", "retail", "store", "supermarket", "hypermarket", "零售", "超市"),
    ),
    "连锁零售商": RoleProfile(
        "medium",
        ("retail", "supermarkets"),
        ("retail chain", "chain stores", "retail group", "supermarket group", "连锁"),
        ("stores", "group"),
    ),
    "电商卖家": RoleProfile(
        "medium",
        ("retail", "internet"),
        ("ecommerce", "e-commerce", "online store", "online shop", "marketplace", "电商"),
    ),
    "工程承包商": RoleProfile(
        "high",
        ("construction", "civil engineering"),
        ("contractor", "contracting", "engineering and construction", "工程承包"),
    ),
    "EPC 承包商": RoleProfile(
        "high",
        ("construction", "civil engineering", "mechanical or industrial engineering"),
        ("epc", "engineering procurement construction", "turnkey contractor"),
    ),
    "系统集成商": RoleProfile(
        "high",
        ("industrial automation", "information technology and services"),
        ("system integrator", "systems integration", "integration services", "系统集成"),
    ),
    "项目开发商": RoleProfile(
        "medium",
        ("renewables & environment", "real estate", "construction"),
        ("project developer", "project development", "development projects", "项目开发"),
    ),
    "采购服务商": RoleProfile(
        "medium",
        ("logistics and supply chain", "outsourcing/offshoring"),
        ("procurement services", "sourcing company", "buying office", "purchasing services", "采购服务"),
    ),
    "最终用户企业": RoleProfile("none"),
    "政府 / 公共机构": RoleProfile(
        "high",
        ("government administration", "public policy", "public safety"),
        ("government", "ministry", "municipality", "city council", "public authority", "政府", "市政"),
    ),
    "设计院 / 顾问公司": RoleProfile(
        "high",
        ("architecture & planning", "civil engineering", "design", "management consulting"),
        ("design institute", "consulting engineers", "engineering consultant", "architects", "设计院", "顾问"),
    ),
}


def _matching_term(value: object, terms: Sequence[str]) -> str:
    """查找文本中第一个满足词边界的角色关键词。

    Args:
        value: PDL 公司名称、域名或其它可能为空的字段值。
        terms: 服务端角色配置中的可信关键词。

    Returns:
        命中的原始关键词；没有命中时返回空字符串。

    Raises:
        本函数不主动抛异常。

    为什么不能直接使用 ``term in text``：例如 ``store`` 不应命中 ``restore``，
    ``agent`` 也不应命中 ``management``。关键词按长度降序检查，优先保留更具体的证据。
    """

    text = str(value or "").strip().lower()
    if not text:
        return ""

    for term in sorted((item for item in terms if item), key=len, reverse=True):
        escaped = re.escape(term.lower())
        if re.search(rf"(?:^|[^a-z0-9]){escaped}(?:$|[^a-z0-9])", text):
            return term
    return ""


def infer_customer_role(
    company: Mapping[str, object],
    requested_role: str,
    *,
    product_industry_match: bool = False,
) -> RoleMatch:
    """使用 PDL 公司字段推测其是否符合用户选择的客户类型。

    Args:
        company: 至少可能包含 ``name``、``website`` 和 ``industry`` 的公司记录。
        requested_role: 前端允许的客户类型，或“不限 / 智能推荐”。
        product_industry_match: PDL 行业是否命中本轮产品行业。它不能单独形成角色
            结论，只能与强身份词组合成第二类证据。

    Returns:
        可解释的客户类型分数、等级、标签和结构化证据。

    Raises:
        ValueError: requested_role 不是空值、默认偏好或20种允许角色时抛出。

    高置信度必须同时具备行业和身份文本证据。行业既可以是角色常见行业，也可以是
    本轮产品行业，但后一种情况必须同时出现强角色身份词。名称与域名视作同一个身份
    家族，即使二者重复命中也只取得分更高的一项，避免用同一个品牌词重复加分。
    """

    role = str(requested_role or "").strip()
    if not role or role == NO_ROLE_PREFERENCE:
        return RoleMatch(role or NO_ROLE_PREFERENCE, "none", 0, "unknown", "客户类型待核验", ())

    profile = CUSTOMER_ROLE_PROFILES.get(role)
    if profile is None:
        raise ValueError(f"不支持的客户类型：{role}")
    if profile.support == "none":
        return RoleMatch(role, "none", 0, "unknown", "客户类型待核验", ())

    name = str(company.get("name") or "").strip()
    website = str(company.get("website") or "").strip()
    industry = str(company.get("industry") or "").strip().lower()
    role_industry_match = industry in profile.industries or any(
        fragment in industry for fragment in profile.industry_terms
    )

    strong_name_term = _matching_term(name, profile.strong_terms)
    strong_domain_term = "" if strong_name_term else _matching_term(website, profile.strong_terms)
    weak_name_term = "" if strong_name_term or strong_domain_term else _matching_term(name, profile.weak_terms)
    weak_domain_term = (
        ""
        if strong_name_term or strong_domain_term or weak_name_term
        else _matching_term(website, profile.weak_terms)
    )
    conflict_name_term = _matching_term(name, profile.conflict_terms)
    conflict_domain_term = "" if conflict_name_term else _matching_term(website, profile.conflict_terms)
    has_identity_evidence = bool(strong_name_term or strong_domain_term)
    product_context_industry_match = bool(product_industry_match and has_identity_evidence)
    industry_match = role_industry_match or product_context_industry_match

    evidence: list[dict[str, str]] = []
    score = 45 if industry_match else 0
    if role_industry_match:
        evidence.append(
            {
                "field": "industry",
                "value": industry,
                "message": f"PDL 行业 {industry} 属于{role}常见行业",
            }
        )
    elif product_context_industry_match:
        evidence.append(
            {
                "field": "industry",
                "value": industry,
                "message": f"PDL 行业 {industry} 与本轮产品行业一致",
            }
        )

    if strong_name_term:
        score += 40
        evidence.append(
            {
                "field": "name",
                "value": strong_name_term,
                "message": f"公司名称包含{role}身份关键词 {strong_name_term}",
            }
        )
    elif strong_domain_term:
        score += 25
        evidence.append(
            {
                "field": "website",
                "value": strong_domain_term,
                "message": f"公司域名包含{role}身份关键词 {strong_domain_term}",
            }
        )
    elif weak_name_term or weak_domain_term:
        weak_field = "name" if weak_name_term else "website"
        weak_term = weak_name_term or weak_domain_term
        score += 10
        evidence.append(
            {
                "field": weak_field,
                "value": weak_term,
                "message": f"{role}弱提示词：{weak_term}",
            }
        )

    conflict_term = conflict_name_term or conflict_domain_term
    if conflict_term:
        score -= 40
        evidence.append(
            {
                "field": "name" if conflict_name_term else "website",
                "value": conflict_term,
                "message": f"同时出现可能冲突的公司身份词：{conflict_term}",
            }
        )

    score = max(0, min(100, score))
    if profile.support == "medium":
        score = min(score, 74)

    if profile.support == "high" and score >= 75 and industry_match and has_identity_evidence:
        level: RoleLevel = "high"
        label = f"高度疑似{role}"
    elif score >= 45 and (industry_match or has_identity_evidence):
        level = "medium"
        label = f"可能是{role}"
    elif score >= 20:
        level = "weak"
        label = f"{role}弱匹配"
    else:
        level = "unknown"
        label = "客户类型待核验"

    return RoleMatch(role, profile.support, score, level, label, tuple(evidence))


def configure_logging(log_file: Path = DEFAULT_LOG_FILE) -> None:
    """配置控制台和滚动文件日志。

    Args:
        log_file: 本机日志文件路径。

    Returns:
        无返回值。

    Raises:
        OSError: 日志目录不可创建或不可写时抛出。

    为什么记录日志：千万级文件导入可能持续较久，保留开始、结束、条数和错误，
    即使终端关闭也能判断任务执行到了哪一步。日志不记录表单信息或原始公司行。
    """

    log_file.parent.mkdir(parents=True, exist_ok=True)
    root_logger = logging.getLogger()
    if root_logger.handlers:
        return

    root_logger.setLevel(logging.INFO)
    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    console = logging.StreamHandler()
    console.setFormatter(formatter)
    rotating_file = RotatingFileHandler(
        log_file,
        maxBytes=5 * 1024 * 1024,
        backupCount=3,
        encoding="utf-8",
    )
    rotating_file.setFormatter(formatter)
    root_logger.addHandler(console)
    root_logger.addHandler(rotating_file)


def _is_supported_data_file(path: Path) -> bool:
    """判断文件名是否属于 PDL 官方提供的数据格式。

    Args:
        path: 待检查文件路径。

    Returns:
        文件后缀受支持时返回 ``True``，否则返回 ``False``。

    Raises:
        本函数不主动抛异常。
    """

    lower_name = path.name.lower()
    return any(lower_name.endswith(suffix) for suffix in SUPPORTED_SUFFIXES)


def _has_gzip_signature(path: Path) -> bool:
    """判断文件内容是否使用 GZIP 压缩，而不依赖可能错误的扩展名。

    Args:
        path: 待检查的本地文件路径。

    Returns:
        文件头是 GZIP 标准魔数 ``1f 8b`` 时返回 ``True``。

    Raises:
        OSError: 文件不存在、无权限或无法读取时抛出。

    PDL 当前下载的 CSV 名为 ``.csv.zip``，但实际内容是 GZIP；只看扩展名会让
    Python 把它当普通 ZIP 并报错，因此必须先检查真实文件签名。
    """

    with path.open("rb") as handle:
        return handle.read(2) == b"\x1f\x8b"


def _data_format(path: Path) -> str:
    """根据文件名返回 ``csv``、``psv`` 或 ``json``。

    Args:
        path: 已确认受支持的数据文件。

    Returns:
        DuckDB 读取器所需的简短格式名。

    Raises:
        PdlDataError: 文件后缀不受支持时抛出。
    """

    lower_name = path.name.lower()
    if lower_name.endswith(".zip"):
        if not _has_gzip_signature(path):
            raise PdlDataError(f"无法把普通 ZIP 直接作为数据文件读取：{path.name}")
        lower_name = lower_name.removesuffix(".zip")

    if lower_name.endswith((".csv", ".csv.gz")):
        return "csv"
    if lower_name.endswith((".psv", ".psv.gz")):
        return "psv"
    if lower_name.endswith((".json", ".json.gz", ".jsonl", ".jsonl.gz", ".ndjson", ".ndjson.gz")):
        return "json"
    raise PdlDataError(f"不支持的数据文件格式：{path.name}")


def _safe_extract_zip(archive: Path, destination: Path) -> list[Path]:
    """安全解压 ZIP，并只保留支持的数据文件。

    Args:
        archive: 用户从 PDL 下载的 ZIP 文件。
        destination: 本次导入专用的临时目录。

    Returns:
        已解压数据文件的绝对路径列表。

    Raises:
        PdlDataError: 压缩包为空、路径越界或不含受支持的数据文件时抛出。
        zipfile.BadZipFile: 文件不是有效 ZIP 时抛出。
        OSError: 文件无法读取或写入时抛出。

    安全说明：不能直接使用 ``extractall``，因为外部 ZIP 中可能存在 ``../`` 路径。
    每个成员都先解析并验证仍位于临时目录内，再执行复制。
    """

    extracted: list[Path] = []
    destination_root = destination.resolve()

    with zipfile.ZipFile(archive) as zip_handle:
        for member in zip_handle.infolist():
            if member.is_dir() or not _is_supported_data_file(Path(member.filename)):
                continue

            output_path = (destination / member.filename).resolve()
            if output_path != destination_root and destination_root not in output_path.parents:
                raise PdlDataError(f"ZIP 中包含不安全路径：{member.filename}")

            output_path.parent.mkdir(parents=True, exist_ok=True)
            with zip_handle.open(member) as source, output_path.open("wb") as target:
                shutil.copyfileobj(source, target)
            extracted.append(output_path)

    if not extracted:
        raise PdlDataError("ZIP 中没有找到 CSV、PSV 或 JSON 数据文件。")
    return sorted(extracted)


@contextlib.contextmanager
def resolve_input_files(input_path: Path) -> Iterator[list[Path]]:
    """把文件、目录或 ZIP 统一解析成同格式的数据文件列表。

    Args:
        input_path: PDL 下载文件、解压目录或单个数据文件路径。

    Yields:
        可以交给 DuckDB 批量读取的绝对路径列表。

    Raises:
        FileNotFoundError: 输入路径不存在时抛出。
        PdlDataError: 找不到数据文件或目录内混有多种格式时抛出。
        OSError: 临时目录无法创建或文件无法读取时抛出。

    ZIP 只在导入期间解压到受 Git 忽略的临时目录，导入完成后自动清理，避免永久
    保存一份重复的大文件。
    """

    resolved = input_path.expanduser().resolve()
    if not resolved.exists():
        raise FileNotFoundError(f"PDL 输入路径不存在：{resolved}")

    if resolved.is_file() and resolved.suffix.lower() == ".zip":
        if zipfile.is_zipfile(resolved):
            staging_root = MODULE_DIR / "data" / "staging"
            staging_root.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryDirectory(prefix="pdl-import-", dir=staging_root) as temporary:
                files = _safe_extract_zip(resolved, Path(temporary))
                _ensure_single_format(files)
                yield files
            return

        # PDL 官方当前把 GZIP 压缩的单个 CSV 命名为 ``.csv.zip``。这种文件可以让
        # DuckDB 流式解压读取，不应复制或展开出另一份 5GB 以上的 CSV。
        if _is_supported_data_file(resolved) and _has_gzip_signature(resolved):
            _ensure_single_format([resolved])
            yield [resolved]
            return

        raise PdlDataError(f"文件扩展名是 .zip，但内容既不是 ZIP 也不是受支持的 GZIP：{resolved}")

    if resolved.is_file():
        if not _is_supported_data_file(resolved):
            raise PdlDataError(f"不支持的数据文件：{resolved.name}")
        yield [resolved]
        return

    files = sorted(path.resolve() for path in resolved.rglob("*") if path.is_file() and _is_supported_data_file(path))
    if not files:
        raise PdlDataError(f"目录中没有找到 CSV、PSV 或 JSON 数据文件：{resolved}")
    _ensure_single_format(files)
    yield files


def _ensure_single_format(files: Sequence[Path]) -> None:
    """确认一批输入文件全部使用相同的结构格式。

    Args:
        files: 待导入的数据文件集合。

    Returns:
        无返回值。

    Raises:
        PdlDataError: 同一批文件同时出现 CSV、PSV 或 JSON 时抛出。

    PDL 的分片文件结构相同，可以一次 union；不同格式通常只是同一数据的不同版本，
    混合导入会造成整库重复，因此明确拒绝。
    """

    formats = {_data_format(path) for path in files}
    if len(formats) != 1:
        raise PdlDataError("输入目录混有 CSV、PSV 和 JSON，请只保留其中一种格式后再导入。")


def _sql_string(value: str) -> str:
    """把本地文件路径安全编码为 DuckDB SQL 字符串。

    Args:
        value: 需要放进 SQL 的普通字符串。

    Returns:
        已包含单引号且内部引号已转义的 SQL 字面量。

    Raises:
        本函数不主动抛异常。

    DuckDB 的表函数在建视图时不能可靠地绑定文件列表参数，因此这里仅对已经解析为
    绝对路径的本地文件做严格字符串转义；用户筛选条件仍全部使用参数绑定。
    """

    return "'" + value.replace("'", "''") + "'"


def _sql_identifier(value: str) -> str:
    """把实际 CSV 列名安全编码为 DuckDB 标识符。

    Args:
        value: CSV、PSV 或 JSON 中的真实字段名。

    Returns:
        已用双引号包围并转义的 SQL 标识符。

    Raises:
        本函数不主动抛异常。
    """

    return '"' + value.replace('"', '""') + '"'


def _regex_pattern(terms: Sequence[str]) -> str:
    """把可信关键词列表转换成 Python 与 DuckDB 都支持的词边界正则。

    Args:
        terms: 来自 ``CUSTOMER_ROLE_PROFILES`` 的服务端关键词。

    Returns:
        RE2 兼容的正则表达式；空列表返回永不命中的 ``a^``。

    Raises:
        本函数不主动抛异常。

    DuckDB 使用 RE2，不支持 lookbehind，因此边界使用显式的非字母数字分组。关键词
    全部先经过 ``re.escape``，即使未来配置中包含斜杠或加号也不会改变正则结构。
    """

    escaped_terms = [re.escape(term.lower()) for term in sorted(set(terms), key=len, reverse=True) if term]
    if not escaped_terms:
        return "a^"
    return rf"(^|[^a-z0-9])({'|'.join(escaped_terms)})($|[^a-z0-9])"


def _role_sql_expressions(profile: RoleProfile | None) -> dict[str, str]:
    """生成全库候选评分使用的可信 SQL 表达式。

    Args:
        profile: 已通过客户类型白名单取得的角色配置；没有偏好时为 ``None``。

    Returns:
        行业、名称、域名、冲突、候选召回和最终角色分数的 SQL 片段。

    Raises:
        本函数不主动抛异常。

    这些片段只插入服务端常量。国家、产品行业、搜索词、分页等请求值仍使用 ``?``
    参数绑定，用户无法通过 role 参数注入 SQL 或正则表达式。
    """

    if profile is None or profile.support == "none":
        return {
            "industry_match": "FALSE",
            "strong_name_match": "FALSE",
            "strong_domain_match": "FALSE",
            "weak_identity_match": "FALSE",
            "conflict_match": "FALSE",
            "candidate_match": "FALSE",
            "score": "0",
        }

    industry_parts: list[str] = []
    if profile.industries:
        industry_literals = ", ".join(_sql_string(value) for value in profile.industries)
        industry_parts.append(f"industry IN ({industry_literals})")
    if profile.industry_terms:
        industry_parts.append(
            "("
            + " OR ".join(
                f"CONTAINS(LOWER(COALESCE(industry, '')), {_sql_string(fragment.lower())})"
                for fragment in profile.industry_terms
            )
            + ")"
        )
    industry_match = f"({' OR '.join(industry_parts)})" if industry_parts else "FALSE"

    if profile.strong_terms:
        strong_pattern = _sql_string(_regex_pattern(profile.strong_terms))
        strong_name_match = f"REGEXP_MATCHES(COALESCE(name, ''), {strong_pattern}, 'i')"
        strong_domain_match = f"REGEXP_MATCHES(COALESCE(website, ''), {strong_pattern}, 'i')"
    else:
        strong_name_match = "FALSE"
        strong_domain_match = "FALSE"
    if profile.weak_terms:
        weak_pattern = _sql_string(_regex_pattern(profile.weak_terms))
        weak_identity_match = (
            f"(REGEXP_MATCHES(COALESCE(name, ''), {weak_pattern}, 'i') OR "
            f"REGEXP_MATCHES(COALESCE(website, ''), {weak_pattern}, 'i'))"
        )
    else:
        weak_identity_match = "FALSE"
    if profile.conflict_terms:
        conflict_pattern = _sql_string(_regex_pattern(profile.conflict_terms))
        conflict_match = (
            f"(REGEXP_MATCHES(COALESCE(name, ''), {conflict_pattern}, 'i') OR "
            f"REGEXP_MATCHES(COALESCE(website, ''), {conflict_pattern}, 'i'))"
        )
    else:
        conflict_match = "FALSE"
    identity_score = (
        f"CASE WHEN {strong_name_match} THEN 40 "
        f"WHEN {strong_domain_match} THEN 25 "
        f"WHEN {weak_identity_match} THEN 10 ELSE 0 END"
    )
    score_cap = 74 if profile.support == "medium" else 100
    # 如果公司行业命中本轮产品行业，并且名称或域名同时出现强角色身份词，这两项也
    # 构成独立的“行业 + 身份文本”证据。产品行业单独命中时仍不会增加角色分数。
    effective_industry_match = (
        f"({industry_match} OR (product_industry_match AND "
        f"({strong_name_match} OR {strong_domain_match})))"
    )
    score = (
        f"GREATEST(0, LEAST({score_cap}, "
        f"(CASE WHEN {effective_industry_match} THEN 45 ELSE 0 END) + "
        f"({identity_score}) - (CASE WHEN {conflict_match} THEN 40 ELSE 0 END)))"
    )
    candidate_identity_parts = [
        f"CONTAINS(LOWER(COALESCE({column}, '')), {_sql_string(term.lower())})"
        for column in ("name", "website")
        for term in profile.strong_terms
    ]
    candidate_identity_match = (
        f"({' OR '.join(candidate_identity_parts)})" if candidate_identity_parts else "FALSE"
    )

    return {
        "industry_match": industry_match,
        "strong_name_match": strong_name_match,
        "strong_domain_match": strong_domain_match,
        "weak_identity_match": weak_identity_match,
        "conflict_match": conflict_match,
        # 召回阶段用更快的 CONTAINS 做宽口径预筛；严格词边界仍由 score 表达式和
        # Python 解释函数执行。这样只对较小的候选集合计算多组正则。
        "candidate_match": f"({industry_match} OR {candidate_identity_match})",
        "score": score,
    }


def _reader_sql(files: Sequence[Path]) -> str:
    """生成只读取指定本地文件的 DuckDB 表函数表达式。

    Args:
        files: 同格式的一个或多个 PDL 数据文件。

    Returns:
        可放在 ``FROM`` 后的 DuckDB SQL 片段。

    Raises:
        PdlDataError: 文件列表为空或格式不受支持时抛出。
    """

    if not files:
        raise PdlDataError("没有可导入的 PDL 数据文件。")

    file_literals = ", ".join(_sql_string(str(path)) for path in files)
    file_argument = _sql_string(str(files[0])) if len(files) == 1 else f"[{file_literals}]"
    data_format = _data_format(files[0])
    gzip_option = ", compression='gzip'" if all(_has_gzip_signature(path) for path in files) else ""

    if data_format == "csv":
        return (
            f"read_csv_auto({file_argument}, header=true, union_by_name=true, "
            f"all_varchar=true{gzip_option})"
        )
    if data_format == "psv":
        return (
            f"read_csv_auto({file_argument}, delim='|', header=true, union_by_name=true, "
            f"all_varchar=true{gzip_option})"
        )
    return f"read_json_auto({file_argument}, union_by_name=true{gzip_option})"


def _source_column(available: dict[str, str], field: str, target_type: str = "VARCHAR") -> str:
    """生成存在字段的安全转换表达式，缺失字段返回类型明确的 NULL。

    Args:
        available: 小写字段名到真实字段名的映射。
        field: PDL 文档中的标准字段名。
        target_type: DuckDB 目标类型。

    Returns:
        可直接放进 SELECT 的 SQL 表达式。

    Raises:
        本函数不主动抛异常。
    """

    actual = available.get(field.lower())
    if actual is None:
        return f"NULL::{target_type}"
    return f"TRY_CAST({_sql_identifier(actual)} AS {target_type})"


def import_dataset(input_path: Path, database_path: Path = DEFAULT_DATABASE) -> dict[str, object]:
    """把 PDL 免费公司数据集原子导入一个新的 DuckDB 文件。

    Args:
        input_path: 用户下载的 ZIP、数据文件或已解压目录。
        database_path: 最终 DuckDB 文件路径。

    Returns:
        包含公司条数、导入时间、输入格式和数据库路径的元数据。

    Raises:
        FileNotFoundError: 输入路径不存在时抛出。
        PdlDataError: 数据格式不支持或缺少 ``name`` 字段时抛出。
        duckdb.Error: DuckDB 无法读取、转换或写入时抛出。
        OSError: 数据库目录不可写或最终文件无法替换时抛出。

    为什么使用临时数据库：如果导入中途断电或源文件损坏，旧数据库仍然完整；只有
    全部建表和校验成功后才用 ``os.replace`` 原子切换到新版本。
    """

    logger = logging.getLogger("pdl.import")
    started = time.monotonic()
    database_path = database_path.expanduser().resolve()
    database_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_database = database_path.with_name(f".{database_path.name}.{os.getpid()}.tmp")

    if temporary_database.exists():
        temporary_database.unlink()

    try:
        with resolve_input_files(input_path) as files:
            reader = _reader_sql(files)
            data_format = _data_format(files[0])
            logger.info("开始导入 PDL 数据，格式=%s，文件数=%d", data_format, len(files))

            connection = duckdb.connect(str(temporary_database))
            try:
                described = connection.execute(f"DESCRIBE SELECT * FROM {reader}").fetchall()
                available = {str(row[0]).lower(): str(row[0]) for row in described}
                if "name" not in available:
                    raise PdlDataError("PDL 文件缺少必需字段 name，可能下载了错误的数据集。")

                columns = {
                    "id": _source_column(available, "id"),
                    "name": _source_column(available, "name"),
                    "website": _source_column(available, "website"),
                    "size": _source_column(available, "size"),
                    "founded": _source_column(available, "founded", "INTEGER"),
                    "industry": _source_column(available, "industry"),
                    "locality": _source_column(available, "locality"),
                    "region": _source_column(available, "region"),
                    "country": _source_column(available, "country"),
                    "linkedin_url": _source_column(available, "linkedin_url"),
                }

                connection.execute(
                    f"""
                    CREATE TABLE companies AS
                    WITH normalized AS (
                        SELECT
                            NULLIF(TRIM({columns['id']}), '') AS source_id,
                            NULLIF(TRIM({columns['name']}), '') AS name,
                            NULLIF(
                                REGEXP_REPLACE(
                                    REGEXP_REPLACE(LOWER(TRIM({columns['website']})), '^https?://', ''),
                                    '^www\\.', ''
                                ),
                                ''
                            ) AS website,
                            NULLIF(TRIM({columns['size']}), '') AS size,
                            {columns['founded']} AS founded,
                            NULLIF(LOWER(TRIM({columns['industry']})), '') AS industry,
                            NULLIF(TRIM({columns['locality']}), '') AS locality,
                            NULLIF(TRIM({columns['region']}), '') AS region,
                            NULLIF(LOWER(TRIM({columns['country']})), '') AS country,
                            NULLIF(TRIM({columns['linkedin_url']}), '') AS linkedin_url
                        FROM {reader}
                        WHERE NULLIF(TRIM({columns['name']}), '') IS NOT NULL
                    ), identified AS (
                        SELECT
                            COALESCE(
                                source_id,
                                MD5(
                                    COALESCE(website, '') || '|' ||
                                    LOWER(name) || '|' ||
                                    COALESCE(country, '') || '|' ||
                                    COALESCE(region, '') || '|' ||
                                    COALESCE(locality, '')
                                )
                            ) AS id,
                            *,
                            COALESCE(
                                'website:' || website,
                                'linkedin:' || LOWER(linkedin_url),
                                'source:' || source_id,
                                'fallback:' || LOWER(name) || '|' || COALESCE(country, '') || '|' ||
                                    COALESCE(region, '') || '|' || COALESCE(locality, '')
                            ) AS identity_key
                        FROM normalized
                    ), deduplicated AS (
                        SELECT *, ROW_NUMBER() OVER (
                            PARTITION BY identity_key
                            ORDER BY
                                CASE WHEN website IS NOT NULL THEN 0 ELSE 1 END,
                                CASE WHEN linkedin_url IS NOT NULL THEN 0 ELSE 1 END,
                                LENGTH(name),
                                name
                        ) AS duplicate_rank
                        FROM identified
                    )
                    SELECT
                        id, name, website, size, founded, industry,
                        locality, region, country, linkedin_url
                    FROM deduplicated
                    WHERE duplicate_rank = 1
                    ORDER BY country, industry, name
                    """
                )
                company_count = int(connection.execute("SELECT COUNT(*) FROM companies").fetchone()[0])
                imported_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
                connection.execute(
                    """
                    CREATE TABLE metadata (
                        key VARCHAR PRIMARY KEY,
                        value VARCHAR NOT NULL
                    )
                    """
                )
                metadata_rows = [
                    ("company_count", str(company_count)),
                    ("imported_at", imported_at),
                    ("source_format", data_format),
                    ("source_file_count", str(len(files))),
                    ("license", "CC0 1.0"),
                    ("provider", "People Data Labs Free Company Dataset"),
                ]
                connection.executemany("INSERT INTO metadata VALUES (?, ?)", metadata_rows)
                connection.execute("CHECKPOINT")
            finally:
                connection.close()

        os.replace(temporary_database, database_path)
        elapsed = round(time.monotonic() - started, 3)
        logger.info("PDL 导入完成，公司数=%d，耗时=%.3f秒", company_count, elapsed)
        return {
            "company_count": company_count,
            "imported_at": imported_at,
            "source_format": data_format,
            "database": str(database_path),
            "elapsed_seconds": elapsed,
        }
    except Exception:
        logger.exception("PDL 导入失败")
        if temporary_database.exists():
            temporary_database.unlink()
        raise


class PdlStore:
    """为每个只读请求创建独立连接的 DuckDB 公司库。"""

    def __init__(self, database_path: Path = DEFAULT_DATABASE) -> None:
        """保存数据库路径，不在初始化时长期占用连接。

        Args:
            database_path: 已导入的 DuckDB 数据库文件。

        Raises:
            本函数不主动抛异常；数据库存在性在每次请求前检查。
        """

        self.database_path = database_path.expanduser().resolve()

    def is_ready(self) -> bool:
        """判断本地数据库是否已经成功导入。

        Returns:
            数据库文件存在且大于零字节时返回 ``True``。

        Raises:
            OSError: 文件系统状态不可读取时可能抛出。
        """

        return self.database_path.is_file() and self.database_path.stat().st_size > 0

    def metadata(self) -> dict[str, object]:
        """读取导入元数据，用于健康检查和页面数据来源提示。

        Returns:
            包含 ``ready``、公司数、导入时间和许可信息的字典。

        Raises:
            PdlDataError: 数据库尚未导入时抛出。
            duckdb.Error: 数据库损坏或缺少 metadata 表时抛出。
        """

        if not self.is_ready():
            raise PdlDataError("PDL 本地数据库尚未导入。")

        connection = duckdb.connect(str(self.database_path), read_only=True)
        try:
            rows = connection.execute("SELECT key, value FROM metadata ORDER BY key").fetchall()
        finally:
            connection.close()

        metadata: dict[str, object] = {str(key): value for key, value in rows}
        metadata["ready"] = True
        if "company_count" in metadata:
            metadata["company_count"] = int(str(metadata["company_count"]))
        return metadata

    def search(self, filters: SearchFilters) -> dict[str, object]:
        """按结构化条件搜索公司，并在完整候选集上计算确定性排序分。

        Args:
            filters: 已解析、已限制长度的搜索条件。

        Returns:
            ``companies`` 为当前页数据，``total`` 为召回候选的完整条数。每家公司
            同时包含未核验的客户类型等级、证据、推荐分及其组成部分。

        Raises:
            PdlDataError: 数据库尚未导入时抛出。
            duckdb.Error: 只读查询失败时抛出。

        所有来自 URL 的值都通过 ``?`` 参数绑定，不拼接进 SQL；角色正则和排序片段
        只由服务端白名单生成。评分和排序均发生在 LIMIT 之前，避免先截断后排序。
        """

        if not self.is_ready():
            raise PdlDataError("PDL 本地数据库尚未导入。")

        role = filters.role.strip()
        if role and role != NO_ROLE_PREFERENCE and role not in CUSTOMER_ROLE_PROFILES:
            raise ValueError(f"不支持的客户类型：{role}")
        profile = CUSTOMER_ROLE_PROFILES.get(role)
        use_ranked_role_search = profile is not None and profile.support != "none"
        sort_mode = filters.sort.strip() or DEFAULT_SORT_MODE
        if sort_mode not in SORT_MODES:
            raise ValueError(f"不支持的排序方式：{sort_mode}")

        where_parts: list[str] = []
        base_parameters: list[object] = []

        if filters.country:
            where_parts.append("country = ?")
            base_parameters.append(filters.country.strip().lower())

        industries = tuple(value.strip().lower() for value in filters.industries if value.strip())
        # 没有可推测角色时沿用原行业硬筛选。支持角色时，行业条件属于后面的 OR 召回，
        # 不能提前写入基础 WHERE，否则会漏掉行业为空但名称证据很强的公司。
        if industries and not use_ranked_role_search:
            placeholders = ", ".join("?" for _ in industries)
            where_parts.append(f"industry IN ({placeholders})")
            base_parameters.extend(industries)

        sizes = tuple(value.strip() for value in filters.sizes if value.strip())
        if sizes:
            placeholders = ", ".join("?" for _ in sizes)
            where_parts.append(f"size IN ({placeholders})")
            base_parameters.extend(sizes)

        if filters.founded_from is not None:
            where_parts.append("founded >= ?")
            base_parameters.append(filters.founded_from)
        if filters.founded_to is not None:
            where_parts.append("founded <= ?")
            base_parameters.append(filters.founded_to)

        if filters.query.strip():
            pattern = f"%{filters.query.strip()}%"
            where_parts.append("(name ILIKE ? OR website ILIKE ? OR linkedin_url ILIKE ?)")
            base_parameters.extend([pattern, pattern, pattern])

        where_sql = " WHERE " + " AND ".join(where_parts) if where_parts else ""
        limit = max(1, min(int(filters.limit), MAX_RESULT_LIMIT))
        offset = max(0, int(filters.offset))

        # 产品行业数组本身有业务优先级：第一个是该产品大类的核心行业，其余属于
        # 相关行业。请求值仍全部使用参数绑定，不能通过行业文本改变 SQL 结构。
        product_tier_parameters: list[object] = []
        if industries:
            related_industries = industries[1:]
            product_tier_sql = "CASE WHEN industry = ? THEN 2"
            product_tier_parameters.append(industries[0])
            if related_industries:
                placeholders = ", ".join("?" for _ in related_industries)
                product_tier_sql += f" WHEN industry IN ({placeholders}) THEN 1"
                product_tier_parameters.extend(related_industries)
            product_tier_sql += " ELSE 0 END"
        else:
            product_tier_sql = "0"

        role_sql = _role_sql_expressions(profile if use_ranked_role_search else None)
        recall_sql = (
            "product_industry_tier > 0 OR role_candidate_match"
            if use_ranked_role_search
            else "TRUE"
        )
        if use_ranked_role_search:
            product_match_score_sql = (
                "CASE WHEN product_industry_tier = 2 THEN 25 "
                "WHEN product_industry_tier = 1 THEN 18 ELSE 0 END"
            )
            role_score_sql = (
                "CASE WHEN role_match_score >= 75 THEN 20 "
                "WHEN role_match_score >= 45 THEN 12 "
                "WHEN role_match_score >= 20 THEN 4 ELSE 0 END"
            )
        else:
            # 未选择客户类型，或当前免费字段无法推测该类型时，把角色权重让给
            # 产品行业相关度，避免输出一个虚假的客户类型结论。
            product_match_score_sql = (
                "CASE WHEN product_industry_tier = 2 THEN 45 "
                "WHEN product_industry_tier = 1 THEN 32 ELSE 0 END"
            )
            role_score_sql = "0"

        # ORDER BY 只能从固定字典取得，绝不直接使用 filters.sort 的原始文本。
        order_by_sql = {
            "recommended": (
                "match_score DESC, actionability_score DESC, "
                "data_completeness_score DESC, HASH(id)"
            ),
            "complete": (
                "data_completeness_score DESC, actionability_score DESC, "
                "match_score DESC, HASH(id)"
            ),
            "size_desc": "company_size_rank DESC, match_score DESC, HASH(id)",
        }[sort_mode]

        sql = f"""
            WITH base AS (
                SELECT
                    id, name, website, size, founded, industry,
                    locality, region, country, linkedin_url,
                    {product_tier_sql} AS product_industry_tier,
                    {role_sql['candidate_match']} AS role_candidate_match
                FROM companies
                {where_sql}
            ), recalled AS MATERIALIZED (
                SELECT *
                FROM base
                WHERE {recall_sql}
            ), evidence AS (
                SELECT *, product_industry_tier > 0 AS product_industry_match
                FROM recalled
            ), signals AS (
                SELECT
                    *,
                    {role_sql['score']} AS role_match_score,
                    (CASE WHEN NULLIF(TRIM(COALESCE(website, '')), '') IS NOT NULL THEN 15 ELSE 0 END
                     + CASE WHEN NULLIF(TRIM(COALESCE(linkedin_url, '')), '') IS NOT NULL THEN 10 ELSE 0 END
                    ) AS actionability_score,
                    (CASE WHEN NULLIF(TRIM(COALESCE(locality, '')), '') IS NOT NULL THEN 3 ELSE 0 END
                     + CASE WHEN NULLIF(TRIM(COALESCE(region, '')), '') IS NOT NULL THEN 3 ELSE 0 END
                     + CASE WHEN NULLIF(TRIM(COALESCE(size, '')), '') IS NOT NULL THEN 4 ELSE 0 END
                     + CASE WHEN founded IS NOT NULL THEN 4 ELSE 0 END
                     + CASE WHEN NULLIF(TRIM(COALESCE(industry, '')), '') IS NOT NULL THEN 6 ELSE 0 END
                    ) AS data_completeness_score,
                    {product_match_score_sql} AS product_match_score,
                    CASE size
                        WHEN '10001+' THEN 8
                        WHEN '5001-10000' THEN 7
                        WHEN '1001-5000' THEN 6
                        WHEN '501-1000' THEN 5
                        WHEN '201-500' THEN 4
                        WHEN '51-200' THEN 3
                        WHEN '11-50' THEN 2
                        WHEN '1-10' THEN 1
                        ELSE 0
                    END AS company_size_rank
                FROM evidence
            ), ranked AS (
                SELECT
                    *,
                    {role_score_sql} AS role_match_component_score,
                    CAST(
                        product_match_score
                        + {role_score_sql}
                        + actionability_score
                        + data_completeness_score
                        AS INTEGER
                    ) AS match_score
                FROM signals
            )
            SELECT *, COUNT(*) OVER () AS filtered_total
            FROM ranked
            ORDER BY {order_by_sql}
            LIMIT ? OFFSET ?
        """
        # SELECT 中的产品行业分层占位符出现在基础 WHERE 之前，参数顺序必须一致。
        query_parameters = [*product_tier_parameters, *base_parameters, limit, offset]

        connection = duckdb.connect(str(self.database_path), read_only=True)
        try:
            cursor = connection.execute(sql, query_parameters)
            column_names = [description[0] for description in cursor.description]
            raw_rows = cursor.fetchall()
        finally:
            connection.close()

        companies: list[dict[str, object]] = []
        total = 0
        for raw_row in raw_rows:
            row = dict(zip(column_names, raw_row, strict=True))
            total = int(row.pop("filtered_total") or 0)
            row.pop("role_candidate_match", None)
            row.pop("product_industry_tier", None)
            row.pop("company_size_rank", None)
            sql_role_score = int(row.pop("role_match_score", 0) or 0)
            product_industry_match = bool(row.get("product_industry_match", False))
            role_match = infer_customer_role(
                row,
                role,
                product_industry_match=product_industry_match,
            )
            row.update(role_match.to_dict())
            row["product_industry_match"] = product_industry_match
            # API 的角色解释字段以同一份 Python 纯函数规则为准；SQL 分数负责全库
            # 排序。若两套规则意外漂移，开发日志会留下公司 ID 方便定位。
            row["match_score"] = int(row.get("match_score") or 0)
            row["product_match_score"] = int(row.get("product_match_score") or 0)
            row["actionability_score"] = int(row.get("actionability_score") or 0)
            row["data_completeness_score"] = int(row.get("data_completeness_score") or 0)
            row["role_match_component_score"] = int(row.get("role_match_component_score") or 0)
            if use_ranked_role_search and sql_role_score != role_match.score:
                logging.getLogger("pdl.search").warning(
                    "角色 SQL 分数与解释分数不一致，公司=%s，sql=%d，解释=%d",
                    row.get("id"),
                    sql_role_score,
                    role_match.score,
                )
            companies.append(row)

        return {
            "companies": companies,
            "total": total,
            "limit": limit,
            "offset": offset,
            "sort": sort_mode,
        }


def _first(values: dict[str, list[str]], key: str, default: str = "") -> str:
    """安全读取 ``parse_qs`` 结果中的第一个值。

    Args:
        values: URL 查询参数字典。
        key: 需要读取的参数名。
        default: 参数缺失时的默认值。

    Returns:
        第一个字符串值或默认值。

    Raises:
        本函数不主动抛异常。
    """

    candidates = values.get(key, [])
    return candidates[0] if candidates else default


def _optional_year(value: str, field_name: str) -> int | None:
    """把可选 URL 年份转换为合理整数。

    Args:
        value: URL 中的年份文本。
        field_name: 错误消息使用的字段名。

    Returns:
        空值返回 ``None``，有效年份返回整数。

    Raises:
        ValueError: 不是整数或不在 1000 至下一自然年之间时抛出。
    """

    if not value:
        return None
    year = int(value)
    maximum = dt.datetime.now().year + 1
    if year < 1000 or year > maximum:
        raise ValueError(f"{field_name} 必须在 1000 到 {maximum} 之间。")
    return year


def parse_search_filters(query: str) -> SearchFilters:
    """把 URL 查询字符串转换为有长度和范围限制的筛选对象。

    Args:
        query: URL ``?`` 后的原始查询字符串。

    Returns:
        可以安全交给 ``PdlStore.search`` 的 ``SearchFilters``。

    Raises:
        ValueError: 数字参数无效或文本过长时抛出。
    """

    values = parse_qs(query, keep_blank_values=False, max_num_fields=100)
    country = _first(values, "country").strip()
    search_query = _first(values, "q").strip()
    role = _first(values, "role").strip()
    sort_mode = _first(values, "sort", DEFAULT_SORT_MODE).strip() or DEFAULT_SORT_MODE
    industries = tuple(value.strip() for value in values.get("industry", []) if value.strip())
    sizes = tuple(value.strip() for value in values.get("size", []) if value.strip())

    if len(country) > 120 or len(search_query) > 200 or len(role) > 120:
        raise ValueError("国家或搜索词过长。")
    if role and role != NO_ROLE_PREFERENCE and role not in CUSTOMER_ROLE_PROFILES:
        raise ValueError(f"不支持的客户类型：{role}")
    if sort_mode not in SORT_MODES:
        raise ValueError(f"不支持的排序方式：{sort_mode}")
    if len(industries) > 20 or any(len(value) > 120 for value in industries):
        raise ValueError("行业筛选项过多或过长。")
    if len(sizes) > 8 or any(len(value) > 30 for value in sizes):
        raise ValueError("公司规模筛选项过多或过长。")

    limit = int(_first(values, "limit", "20"))
    offset = int(_first(values, "offset", "0"))
    return SearchFilters(
        country=country,
        industries=industries,
        role=role,
        sizes=sizes,
        founded_from=_optional_year(_first(values, "founded_from"), "founded_from"),
        founded_to=_optional_year(_first(values, "founded_to"), "founded_to"),
        query=search_query,
        sort=sort_mode,
        limit=max(1, min(limit, MAX_RESULT_LIMIT)),
        offset=max(0, offset),
    )


class PdlRequestHandler(SimpleHTTPRequestHandler):
    """同时提供静态原型、PDL 搜索和 Hunter 联系人补全接口的请求处理器。"""

    store = PdlStore()
    hunter_client = HunterClient.from_env()

    def __init__(self, *args: object, directory: str | None = None, **kwargs: object) -> None:
        """把静态文件根目录固定到项目目录。

        Args:
            *args: ``SimpleHTTPRequestHandler`` 的位置参数。
            directory: 测试或调用方显式指定的静态目录；默认使用项目根目录。
            **kwargs: ``SimpleHTTPRequestHandler`` 的关键字参数。

        Raises:
            与 ``SimpleHTTPRequestHandler`` 初始化一致。
        """

        super().__init__(*args, directory=directory or str(PROJECT_ROOT), **kwargs)

    def _send_json(self, status: HTTPStatus, payload: dict[str, object]) -> None:
        """发送 UTF-8 JSON 响应。

        Args:
            status: HTTP 状态码。
            payload: 可 JSON 序列化的响应对象。

        Returns:
            无返回值。

        Raises:
            OSError: 客户端提前断开时可能抛出。
            TypeError: payload 不可序列化时抛出。
        """

        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status.value)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - 标准库要求使用 HTTP 方法名。
        """处理健康检查、公司搜索、Hunter 联系人查询和静态文件请求。

        Returns:
            无返回值。

        Raises:
            本函数会把预期异常转换成 JSON；底层 socket 异常仍可能由标准库抛出。
        """

        parsed = urlparse(self.path)
        if parsed.path == "/api/pdl/health":
            self._handle_health()
            return
        if parsed.path == "/api/pdl/companies":
            self._handle_company_search(parsed.query)
            return
        if parsed.path == "/api/hunter/status":
            self._handle_hunter_status()
            return
        if parsed.path == "/api/hunter/email-count":
            self._handle_hunter_email_count(parsed.query)
            return
        if parsed.path == "/api/hunter/domain-search":
            self._handle_hunter_domain_search(parsed.query)
            return
        super().do_GET()

    def _handle_health(self) -> None:
        """返回数据库是否已导入及其元数据。

        Returns:
            无返回值，结果直接写入 HTTP 响应。

        Raises:
            本函数捕获数据层异常并返回 503，不向 HTTP 服务循环继续抛出。
        """

        try:
            self._send_json(HTTPStatus.OK, self.store.metadata())
        except PdlDataError as exc:
            self._send_json(
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"ready": False, "code": "dataset_not_imported", "message": str(exc)},
            )
        except duckdb.Error:
            logging.getLogger("pdl.http").exception("PDL 健康检查失败")
            self._send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"ready": False, "code": "database_error", "message": "PDL 本地数据库读取失败。"},
            )

    def _handle_company_search(self, query: str) -> None:
        """解析筛选条件并执行只读公司搜索。

        Args:
            query: URL 中未经解析的查询字符串。

        Returns:
            无返回值，结果直接写入 HTTP 响应。

        Raises:
            预期错误会转换成 400、503 或 500 JSON，不继续向上抛出。
        """

        logger = logging.getLogger("pdl.http")
        started = time.monotonic()
        try:
            filters = parse_search_filters(query)
            payload = self.store.search(filters)
            elapsed_ms = round((time.monotonic() - started) * 1000, 1)
            payload["elapsed_ms"] = elapsed_ms
            logger.info("PDL 搜索完成，返回=%d，总匹配=%d，耗时=%.1fms", len(payload["companies"]), payload["total"], elapsed_ms)
            self._send_json(HTTPStatus.OK, payload)
        except (ValueError, TypeError) as exc:
            self._send_json(HTTPStatus.BAD_REQUEST, {"code": "invalid_query", "message": str(exc)})
        except PdlDataError as exc:
            self._send_json(
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"code": "dataset_not_imported", "message": str(exc)},
            )
        except duckdb.Error:
            logger.exception("PDL 搜索失败")
            self._send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"code": "database_error", "message": "PDL 本地数据库查询失败。"},
            )

    def _handle_hunter_status(self) -> None:
        """返回 Hunter 是否已在服务端配置。

        Returns:
            无返回值，结果直接写入 HTTP 响应。

        Raises:
            本函数不主动抛异常。

        状态接口只返回布尔值，绝不回传 Key、账户邮箱、套餐或剩余额度。
        """

        self._send_json(
            HTTPStatus.OK,
            {"configured": self.hunter_client.configured, "provider": "hunter"},
        )

    def _handle_hunter_domain_search(self, query: str) -> None:
        """按用户点击的单家公司域名调用 Hunter Domain Search。

        Args:
            query: URL 中未经解析的查询字符串，只接受 ``domain`` 和 ``limit``。

        Returns:
            无返回值，精简后的联系人 JSON 直接写入 HTTP 响应。

        Raises:
            所有预期错误都会转换成安全 JSON，不把 API Key 或 Hunter 原始错误继续抛出。
        """

        logger = logging.getLogger("hunter.http")
        started = time.monotonic()
        try:
            values = parse_qs(query, keep_blank_values=False, max_num_fields=10)
            domain = _first(values, "domain").strip()
            limit = int(_first(values, "limit", str(HUNTER_CONTACT_LIMIT)))
            if limit < 1 or limit > HUNTER_CONTACT_LIMIT:
                raise ValueError(f"Hunter 单次联系人数量必须在 1 到 {HUNTER_CONTACT_LIMIT} 之间。")

            payload = self.hunter_client.domain_search(domain, limit=limit)
            elapsed_ms = round((time.monotonic() - started) * 1000, 1)
            payload["elapsed_ms"] = elapsed_ms
            logger.info(
                "Hunter 按需查询完成，返回=%d，总命中=%d，耗时=%.1fms",
                len(payload["contacts"]),
                payload["total"],
                elapsed_ms,
            )
            self._send_json(HTTPStatus.OK, payload)
        except (ValueError, TypeError) as exc:
            self._send_json(HTTPStatus.BAD_REQUEST, {"code": "invalid_hunter_query", "message": str(exc)})
        except HunterApiError as exc:
            # 只记录稳定错误码；异常链和上游 URL 可能包含 API Key，不能写入日志。
            logger.warning("Hunter 按需查询失败，code=%s", exc.code)
            self._send_json(exc.http_status, {"code": exc.code, "message": str(exc)})

    def _handle_hunter_email_count(self, query: str) -> None:
        """免费返回一个公司域名可获取的联系人数量，不返回个人资料。

        Args:
            query: URL 中未经解析的查询字符串，只接受 ``domain``。

        Returns:
            无返回值，数量 JSON 直接写入 HTTP 响应。

        Raises:
            所有预期错误都会转换成安全 JSON；API Key 与上游 URL 不会写入响应。
        """

        logger = logging.getLogger("hunter.count")
        try:
            values = parse_qs(query, keep_blank_values=False, max_num_fields=5)
            domain = _first(values, "domain").strip()
            payload = self.hunter_client.email_count(domain)
            logger.info("联系人数量查询完成，总数=%d", payload["total"])
            self._send_json(HTTPStatus.OK, payload)
        except (ValueError, TypeError) as exc:
            self._send_json(HTTPStatus.BAD_REQUEST, {"code": "invalid_hunter_query", "message": str(exc)})
        except HunterApiError as exc:
            logger.warning("联系人数量查询失败，code=%s", exc.code)
            self._send_json(exc.http_status, {"code": exc.code, "message": str(exc)})

    def log_request(self, code: int | str = "-", size: int | str = "-") -> None:
        """记录不含查询参数的最小访问日志。

        Args:
            code: HTTP 响应状态码。
            size: 响应体字节数；标准库未知时传 ``-``。

        Returns:
            无返回值。

        Raises:
            本函数不主动抛异常。

        为什么去掉查询字符串：``q`` 以后可能包含客户公司名或业务搜索词。日志只需要
        方法、接口路径、状态和大小即可排障，不应长期保存用户筛选内容。
        """

        path = urlparse(self.path).path
        logging.getLogger("pdl.access").info("%s %s %s %s", self.command, path, code, size)

    def log_message(self, message_format: str, *args: object) -> None:
        """把标准库错误日志接入项目日志文件。

        Args:
            message_format: 标准库提供的 printf 风格模板。
            *args: 模板参数。

        Returns:
            无返回值。

        Raises:
            本函数不主动抛异常。
        """

        logging.getLogger("pdl.access").warning(message_format, *args)


def serve(database_path: Path, host: str, port: int) -> None:
    """启动只监听指定地址的线程化本地 HTTP 服务。

    Args:
        database_path: 已导入的 DuckDB 文件。
        host: 默认 ``127.0.0.1``，不会暴露给局域网或公网。
        port: 本地监听端口。

    Returns:
        服务收到 Ctrl+C 后返回。

    Raises:
        OSError: 端口被占用或地址不可绑定时抛出。
    """

    PdlRequestHandler.store = PdlStore(database_path)
    PdlRequestHandler.hunter_client = HunterClient.from_env()
    server = ThreadingHTTPServer((host, port), PdlRequestHandler)
    logger = logging.getLogger("pdl.server")
    logger.info("PDL 本地服务启动：http://%s:%d/index.html#/customer-development", host, port)
    logger.info(
        "Hunter 联系人补全：%s",
        "已启用" if PdlRequestHandler.hunter_client.configured else "未配置 HUNTER_API_KEY",
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("收到 Ctrl+C，正在停止 PDL 本地服务")
    finally:
        server.server_close()


def build_parser() -> argparse.ArgumentParser:
    """创建 ``import`` 和 ``serve`` 两个命令的参数解析器。

    Returns:
        已配置完成的 ``ArgumentParser``。

    Raises:
        本函数不主动抛异常。
    """

    parser = argparse.ArgumentParser(description="PDL 免费公司数据集本地导入与搜索")
    parser.add_argument("--log-file", type=Path, default=DEFAULT_LOG_FILE, help="本地运行日志路径")
    subparsers = parser.add_subparsers(dest="command", required=True)

    import_parser = subparsers.add_parser("import", help="导入 PDL 下载文件")
    import_parser.add_argument("--input", required=True, type=Path, help="ZIP、CSV、PSV、JSON 或解压目录")
    import_parser.add_argument("--database", type=Path, default=DEFAULT_DATABASE, help="DuckDB 输出路径")

    serve_parser = subparsers.add_parser("serve", help="启动本地页面和搜索接口")
    serve_parser.add_argument("--database", type=Path, default=DEFAULT_DATABASE, help="DuckDB 数据库路径")
    serve_parser.add_argument("--host", default="127.0.0.1", help="默认只监听本机")
    serve_parser.add_argument("--port", type=int, default=8788, help="本地端口，默认 8788")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """命令行入口。

    Args:
        argv: 测试时可传入参数列表；生产调用默认读取 ``sys.argv``。

    Returns:
        成功返回进程码 0。

    Raises:
        输入、数据库或端口异常会记录日志并由 Python 以非零状态退出。
    """

    args = build_parser().parse_args(argv)
    configure_logging(args.log_file)
    if args.command == "import":
        result = import_dataset(args.input, args.database)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    serve(args.database, args.host, args.port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
