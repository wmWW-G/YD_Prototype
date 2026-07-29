#!/usr/bin/env python3
"""正式 Dify 链路并发诊断与 Console 日志关联工具。

这个脚本只依赖 Python 标准库，主要解决三个问题：

1. 从正式功能链接解析 ``subId``，再读取线上角色配置，避免把角色类型、
   ``skill_key`` 或 ``model_key`` 写死在脚本中。
2. 对正式后端发起可配置的并发 SSE 请求，并可选执行较小规模的 Dify
   Service API 直连对照。
3. 通过只读 Dify Console API，按终端用户与唯一 marker 关联会话、消息、
   workflow run 和失败节点。

安全约束：

- 真实密钥只从 Skill 根目录 ``.env``、当前进程环境变量或隐藏输入读取。
- 输出中不包含 Token、Cookie、Prompt、模型回答、工作流输入输出或工具结果。
- 所有 POST 都只执行一次，不做自动重试，避免重复请求与重复计费。
"""

from __future__ import annotations

import argparse
import concurrent.futures
import dataclasses
import getpass
import json
import logging
import os
import re
import secrets
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence
from zoneinfo import ZoneInfo


LOGGER = logging.getLogger("yingdan-high-concurrency-test")
SHANGHAI = ZoneInfo("Asia/Shanghai")
USER_AGENT = "YD-Internal-Dify-Diagnostic/2.0"
DEFAULT_API_BASE = "https://api.top-yd.com"
DEFAULT_DIFY_SERVICE_BASE = "https://api.dify.ai/v1"
DEFAULT_DIFY_CONSOLE_BASE = "https://cloud.dify.ai/console/api"
MAX_SAFE_CONCURRENCY = 500
SECRET_NAMES = {
    "YD_ACCOUNT_TOKEN",
    "DIFY_APP_API_KEY",
    "DIFY_CONSOLE_COOKIE",
    "DIFY_CSRF_TOKEN",
    "DIFY_CONSOLE_AUTHORIZATION",
}


class DiagnosticError(RuntimeError):
    """表示可以安全展示给操作者的诊断错误。"""


@dataclasses.dataclass(frozen=True)
class RoleSelection:
    """保存从线上角色配置中解析出的最小调用合同。

    Attributes:
        role_id: 后台角色记录 ID。
        role_type: 正式聊天接口要求的角色 type。
        role_name: 仅用于核对的角色展示名。
        role_model: 角色当前配置的实现类型，例如 ``dify``。
        model_code: 用户选择的模型档位，例如 ``A``。
        model_name: 后台模型配置中的稳定模型名。
        inputs: 发送给正式后端和 Dify 的输入字典；只在内存中使用。
    """

    role_id: str
    role_type: str
    role_name: str | None
    role_model: str | None
    model_code: str
    model_name: str | None
    inputs: dict[str, Any]


@dataclasses.dataclass(frozen=True)
class StreamResult:
    """保存一次 SSE 请求的脱敏观测结果。

    Attributes:
        marker: 唯一诊断 marker，不包含业务内容。
        target: ``production``、``direct`` 或 ``preflight``。
        http_status: HTTP 状态码；连接建立前失败时为 ``None``。
        started_at: 客户端发出请求时的 ISO 时间。
        header_ms: 收到 HTTP 响应头所需毫秒数。
        first_event_ms: 收到首条 SSE ``data:`` 事件所需毫秒数。
        total_ms: 请求结束或超时时的总耗时。
        bytes_read: 客户端读取到的响应字节数。
        sse_events: ``data:`` 事件数量。
        conversation_id: 响应事件中出现的 Dify 会话 ID。
        workflow_run_id: 响应事件中出现的 workflow run ID。
        sse_error: SSE 事件是否明确表示失败。
        error_category: 脱敏后的错误类别，不保留原始错误文本。
    """

    marker: str
    target: str
    http_status: int | None
    started_at: str
    header_ms: float | None
    first_event_ms: float | None
    total_ms: float
    bytes_read: int
    sse_events: int
    conversation_id: str | None
    workflow_run_id: str | None
    sse_error: bool
    error_category: str | None


@dataclasses.dataclass(frozen=True)
class HttpJsonResult:
    """保存一次 JSON HTTP 请求的状态码和解析结果。

    Attributes:
        status: HTTP 状态码。
        data: 解析后的 JSON；无法解析时为 ``None``。
    """

    status: int
    data: Any


class HttpClient:
    """提供无自动重试、可选择禁用代理的 HTTP 客户端。

    Args:
        timeout: 每次请求的最大等待秒数。
        no_proxy: 为 ``True`` 时忽略系统代理，直接连接目标地址。

    Raises:
        ValueError: ``timeout`` 不是正数时抛出。
    """

    def __init__(self, timeout: float, no_proxy: bool) -> None:
        if timeout <= 0:
            raise ValueError("timeout 必须大于 0")
        self.timeout = timeout
        self.opener = (
            urllib.request.build_opener(urllib.request.ProxyHandler({}))
            if no_proxy
            else urllib.request.build_opener()
        )

    def request_json(
        self,
        method: str,
        url: str,
        headers: Mapping[str, str],
        payload: Mapping[str, Any] | None = None,
    ) -> HttpJsonResult:
        """发送一次 JSON 请求，且绝不自动重试。

        Args:
            method: HTTP 方法，例如 ``GET`` 或 ``POST``。
            url: 完整请求地址。
            headers: 请求头；调用方负责提供鉴权头。
            payload: 可选 JSON 请求体。

        Returns:
            包含 HTTP 状态码和解析后 JSON 的 ``HttpJsonResult``。

        Raises:
            DiagnosticError: 网络连接失败或响应无法作为 JSON 使用时抛出。
        """

        body = None
        final_headers = dict(headers)
        if payload is not None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            final_headers.setdefault("Content-Type", "application/json")
        request = urllib.request.Request(
            url=url,
            data=body,
            headers=final_headers,
            method=method.upper(),
        )
        try:
            with self.opener.open(request, timeout=self.timeout) as response:
                raw = response.read()
                data = _decode_json(raw)
                return HttpJsonResult(status=response.status, data=data)
        except urllib.error.HTTPError as exc:
            # HTTPError 仍然包含服务端响应；这里只解析结构，不把原文输出。
            raw = exc.read(1024 * 1024)
            return HttpJsonResult(status=exc.code, data=_decode_json(raw))
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise DiagnosticError(
                f"请求连接失败：{classify_exception(exc)}"
            ) from exc

    def stream_post(
        self,
        url: str,
        headers: Mapping[str, str],
        payload: Mapping[str, Any],
        marker: str,
        target: str,
    ) -> StreamResult:
        """发送一次流式 POST，并只记录脱敏的时序和状态。

        Args:
            url: SSE 接口完整地址。
            headers: 包含鉴权信息的请求头。
            payload: 要发送的 JSON；不会写入输出。
            marker: 本次请求的唯一关联标记。
            target: 观测来源，例如 ``production`` 或 ``direct``。

        Returns:
            一条不包含 prompt 或回答内容的 ``StreamResult``。

        Raises:
            本函数会把网络和 HTTP 异常归类到返回值，不向并发执行器抛出。
        """

        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        final_headers = dict(headers)
        final_headers.setdefault("Content-Type", "application/json")
        final_headers.setdefault("Accept", "text/event-stream")
        request = urllib.request.Request(
            url=url,
            data=encoded,
            headers=final_headers,
            method="POST",
        )
        started_at = datetime.now().astimezone().isoformat()
        started_perf = time.perf_counter()
        header_ms: float | None = None
        first_event_ms: float | None = None
        status: int | None = None
        bytes_read = 0
        sse_events = 0
        conversation_id: str | None = None
        workflow_run_id: str | None = None
        sse_error = False
        error_category: str | None = None

        try:
            with self.opener.open(request, timeout=self.timeout) as response:
                status = response.status
                header_ms = _elapsed_ms(started_perf)

                # urllib 会按换行迭代响应体，适合 SSE；我们仅解析事件元数据，
                # 不把模型回答保存在变量或报告中。
                for raw_line in response:
                    bytes_read += len(raw_line)
                    if not raw_line.startswith(b"data:"):
                        continue
                    if first_event_ms is None:
                        first_event_ms = _elapsed_ms(started_perf)
                    sse_events += 1
                    event_payload = _decode_sse_data(raw_line)
                    if not isinstance(event_payload, dict):
                        continue
                    event_name = str(event_payload.get("event") or "")
                    if event_name in {"error", "workflow_failed"}:
                        sse_error = True
                        error_category = classify_error_payload(event_payload)
                    conversation_id = conversation_id or _first_string(
                        event_payload,
                        ("conversation_id",),
                    )
                    workflow_run_id = workflow_run_id or _first_string(
                        event_payload,
                        ("workflow_run_id", "workflow_run.id"),
                    )
        except urllib.error.HTTPError as exc:
            status = exc.code
            header_ms = _elapsed_ms(started_perf)
            raw = exc.read(64 * 1024)
            bytes_read += len(raw)
            error_category = classify_http_error(exc.code, raw)
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            error_category = classify_exception(exc)
        except Exception as exc:  # pragma: no cover - 最后的安全网
            # 单个请求的意外异常不应中断整批诊断；仅记录异常类型。
            error_category = f"client_{type(exc).__name__.lower()}"

        return StreamResult(
            marker=marker,
            target=target,
            http_status=status,
            started_at=started_at,
            header_ms=header_ms,
            first_event_ms=first_event_ms,
            total_ms=_elapsed_ms(started_perf),
            bytes_read=bytes_read,
            sse_events=sse_events,
            conversation_id=conversation_id,
            workflow_run_id=workflow_run_id,
            sse_error=sse_error,
            error_category=error_category,
        )


def configure_logging(verbose: bool) -> None:
    """配置 stderr 运行日志。

    Args:
        verbose: 为 ``True`` 时输出 DEBUG，否则输出 INFO。

    Returns:
        无返回值。

    Raises:
        不主动抛出异常。
    """

    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )


def _decode_json(raw: bytes) -> Any:
    """尽力把字节解析为 JSON。

    Args:
        raw: HTTP 响应字节。

    Returns:
        解析后的对象；空响应或无效 JSON 返回 ``None``。

    Raises:
        不抛出 JSON 解码异常。
    """

    if not raw:
        return None
    try:
        return json.loads(raw.decode("utf-8", errors="replace"))
    except json.JSONDecodeError:
        return None


def _decode_sse_data(raw_line: bytes) -> Any:
    """解析单行 SSE ``data:`` JSON。

    Args:
        raw_line: 包含 ``data:`` 前缀的原始行。

    Returns:
        解析后的 JSON；``[DONE]`` 或无效 JSON 返回 ``None``。

    Raises:
        不抛出 JSON 解码异常。
    """

    payload = raw_line[5:].strip()
    if not payload or payload == b"[DONE]":
        return None
    return _decode_json(payload)


def _elapsed_ms(started_perf: float) -> float:
    """计算高精度计时器到现在的毫秒数。

    Args:
        started_perf: ``time.perf_counter()`` 的起始值。

    Returns:
        四舍五入到三位小数的毫秒数。

    Raises:
        不主动抛出异常。
    """

    return round((time.perf_counter() - started_perf) * 1000, 3)


def load_env_file(path: Path) -> set[str]:
    """读取简单 ``KEY=VALUE`` 格式的 Skill 本地环境文件。

    Args:
        path: `.env` 文件路径。

    Returns:
        成功装入当前进程、且此前不存在的变量名集合。

    Raises:
        DiagnosticError: 文件无法读取时抛出；不会包含变量值。
    """

    if not path.exists():
        return set()
    loaded: set[str] = set()
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        raise DiagnosticError(f"无法读取 Skill .env：{type(exc).__name__}") from exc

    for line_number, raw_line in enumerate(lines, start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        if "=" not in line:
            LOGGER.warning(".env 第 %s 行缺少等号，已忽略", line_number)
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            LOGGER.warning(".env 第 %s 行变量名无效，已忽略", line_number)
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        if key not in os.environ and value:
            os.environ[key] = value
            loaded.add(key)
    return loaded


def get_secret(name: str, prompt: str, required: bool = True) -> str | None:
    """从环境变量或隐藏输入获取密钥。

    Args:
        name: 环境变量名。
        prompt: 终端隐藏输入的提示文字。
        required: 非交互环境缺失时是否报错。

    Returns:
        密钥字符串；可选且缺失时返回 ``None``。

    Raises:
        DiagnosticError: 必填密钥缺失或隐藏输入为空时抛出。
    """

    value = os.environ.get(name, "").strip()
    if value:
        return value
    # 可选密钥缺失时直接返回 None。否则每次日志查询都会无意义地询问
    # 兼容性覆盖值；正常情况下完整 Cookie 已足够恢复 CSRF 请求头。
    if required and sys.stdin.isatty():
        entered = getpass.getpass(f"{prompt}（输入不会显示）: ").strip()
        if entered:
            return entered
    if required:
        raise DiagnosticError(
            f"缺少 {name}；请填写 Skill 目录 .env 或在终端环境中设置"
        )
    return None


def validate_secret_hygiene(report: Any) -> None:
    """确认将要输出的报告不包含当前已加载密钥。

    Args:
        report: 准备打印或写入文件的 JSON 兼容对象。

    Returns:
        无返回值。

    Raises:
        DiagnosticError: 报告文本中意外出现任一已加载密钥时抛出。
    """

    serialized = json.dumps(report, ensure_ascii=False)
    for name in SECRET_NAMES:
        value = os.environ.get(name)
        if value and len(value) >= 8 and value in serialized:
            raise DiagnosticError(f"安全检查失败：输出中出现 {name}")


def emit_phase(phase: str, payload: Mapping[str, Any]) -> None:
    """向 stdout 输出一行脱敏 JSON 进度。

    Args:
        phase: 阶段名。
        payload: 阶段数据。

    Returns:
        无返回值。

    Raises:
        DiagnosticError: 密钥卫生检查失败时抛出。
    """

    output = {"phase": phase, **payload}
    validate_secret_hygiene(output)
    print(json.dumps(output, ensure_ascii=False, sort_keys=True), flush=True)


def write_report(path: str | None, report: Mapping[str, Any]) -> None:
    """按需写入最终脱敏 JSON 报告。

    Args:
        path: 目标路径；为空时不写文件。
        report: 最终报告对象。

    Returns:
        无返回值。

    Raises:
        DiagnosticError: 安全检查或文件写入失败时抛出。
    """

    if not path:
        return
    validate_secret_hygiene(report)
    target = Path(path).expanduser().resolve()
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        target.write_text(
            json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    except OSError as exc:
        raise DiagnosticError(f"无法写入报告：{type(exc).__name__}") from exc
    LOGGER.info("脱敏报告已写入 %s", target)


def parse_feature_url(url: str) -> str:
    """从正式功能链接中解析 ``subId``。

    Args:
        url: 例如 ``https://top-yd.com/chat?...&subId=47``。

    Returns:
        非空 ``subId`` 字符串。

    Raises:
        DiagnosticError: URL 主机不受支持或缺少 ``subId`` 时抛出。
    """

    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise DiagnosticError("--url 必须是完整的 http/https 地址")
    host = (parsed.hostname or "").lower()
    if host != "top-yd.com" and not host.endswith(".top-yd.com"):
        raise DiagnosticError("为避免误压测，--url 目前仅接受 top-yd.com")
    values = urllib.parse.parse_qs(parsed.query).get("subId", [])
    if not values or not values[0].strip():
        raise DiagnosticError("正式功能链接缺少 subId")
    return values[0].strip()


def walk_dicts(value: Any) -> Iterable[dict[str, Any]]:
    """递归遍历 JSON 中的所有字典。

    Args:
        value: 任意 JSON 兼容对象。

    Returns:
        逐个产生嵌套字典的迭代器。

    Raises:
        不主动抛出异常。
    """

    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_dicts(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_dicts(child)


def _parse_json_object(value: Any) -> dict[str, Any]:
    """把字典或 JSON 字符串转换为字典。

    Args:
        value: 字典、JSON 字符串或其他值。

    Returns:
        字典；无法转换时返回空字典。

    Raises:
        不抛出 JSON 解码异常。
    """

    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def select_role(
    role_payload: Any,
    sub_id: str,
    model_code: str,
) -> RoleSelection:
    """从线上角色菜单响应中选择目标角色和模型配置。

    Args:
        role_payload: ``getRoleMneuList`` 返回的 JSON。
        sub_id: 正式页面 URL 中的 ``subId``。
        model_code: 要选择的模型档位，例如 ``A``。

    Returns:
        解析后的 ``RoleSelection``。

    Raises:
        DiagnosticError: 找不到角色、Dify 配置或对应模型时抛出。
    """

    candidates: list[dict[str, Any]] = []
    for item in walk_dicts(role_payload):
        if str(item.get("id", "")) == sub_id or str(item.get("type", "")) == sub_id:
            candidates.append(item)
    if not candidates:
        raise DiagnosticError(f"线上角色列表中找不到 subId={sub_id}")

    # 菜单节点和角色节点可能共用 id。优先选择带 difyJson / roleModel 的记录，
    # 这样拿到的是可执行角色，而不是只有展示信息的菜单节点。
    candidates.sort(
        key=lambda item: (
            bool(item.get("difyJson")),
            str(item.get("roleModel", "")).lower() == "dify",
            bool(item.get("type")),
        ),
        reverse=True,
    )
    role = candidates[0]
    dify_json = _parse_json_object(role.get("difyJson"))
    models = dify_json.get("models")
    if not isinstance(models, list):
        models = role.get("models")
    if not isinstance(models, list) or not models:
        raise DiagnosticError("目标角色缺少可用的 Dify models 配置")

    wanted = model_code.strip().lower()

    def model_matches(model: Mapping[str, Any]) -> bool:
        """判断模型记录是否匹配指定档位。

        Args:
            model: 单条模型配置。

        Returns:
            任一常见 code 字段匹配时返回 ``True``。

        Raises:
            不主动抛出异常。
        """

        keys = ("code", "modelCode", "model_code", "key", "id")
        return any(str(model.get(key, "")).strip().lower() == wanted for key in keys)

    model_candidates = [item for item in models if isinstance(item, dict)]
    selected_model = next(
        (item for item in model_candidates if model_matches(item)),
        None,
    )
    if selected_model is None:
        # 部分旧配置只有数组顺序而没有显式 A/B code。A 对应第一项；
        # 对其他档位则拒绝猜测，防止测错模型。
        if wanted == "a" and model_candidates:
            selected_model = model_candidates[0]
        else:
            raise DiagnosticError(f"目标角色没有 modelCode={model_code} 的配置")

    inputs = selected_model.get("inputs")
    if not isinstance(inputs, dict):
        inputs = dify_json.get("inputs")
    if not isinstance(inputs, dict):
        inputs = {}

    role_type = role.get("type")
    if role_type in (None, ""):
        raise DiagnosticError("目标角色缺少正式聊天接口要求的 type")
    model_name = (
        selected_model.get("model_name")
        or selected_model.get("modelName")
        or selected_model.get("name")
    )
    role_name = role.get("role") or role.get("name") or role.get("title")
    return RoleSelection(
        role_id=str(role.get("id", "")),
        role_type=str(role_type),
        role_name=str(role_name) if role_name is not None else None,
        role_model=(
            str(role.get("roleModel"))
            if role.get("roleModel") is not None
            else None
        ),
        model_code=model_code,
        model_name=str(model_name) if model_name is not None else None,
        inputs=dict(inputs),
    )


def resolve_live_role(
    client: HttpClient,
    api_base: str,
    account_token: str,
    user: str,
    feature_url: str,
    model_code: str,
) -> tuple[str, RoleSelection]:
    """读取线上角色列表并解析当前正式配置。

    Args:
        client: HTTP 客户端。
        api_base: 赢单正式 API 根地址。
        account_token: 当前账号 JWT。
        user: 终端用户 ID。
        feature_url: 带 ``subId`` 的正式功能链接。
        model_code: 模型档位。

    Returns:
        ``(sub_id, RoleSelection)``。

    Raises:
        DiagnosticError: HTTP 非 200、响应无效或角色配置缺失时抛出。
    """

    sub_id = parse_feature_url(feature_url)
    query = urllib.parse.urlencode({"userId": user})
    url = f"{api_base.rstrip('/')}/index/role/getRoleMneuList?{query}"
    result = client.request_json(
        "GET",
        url,
        {
            "Authorization": f"Bearer {account_token}",
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    if result.status != 200:
        raise DiagnosticError(
            f"读取正式角色配置失败：HTTP {result.status} "
            f"({classify_status(result.status)})"
        )
    return sub_id, select_role(result.data, sub_id, model_code)


def build_marker_prefix(sub_id: str) -> str:
    """生成本轮可用于 Console 精确关联的唯一 marker 前缀。

    Args:
        sub_id: 正式功能的 ``subId``。

    Returns:
        只包含字母、数字和下划线的 marker 前缀。

    Raises:
        不主动抛出异常。
    """

    timestamp = datetime.now(SHANGHAI).strftime("%Y%m%d_%H%M%S")
    nonce = secrets.token_hex(3).upper()
    safe_sub_id = re.sub(r"[^A-Za-z0-9]+", "", sub_id)[:12] or "UNKNOWN"
    return f"YD_DIAG_{safe_sub_id}_{timestamp}_{nonce}_"


def build_synthetic_query(marker: str, target: str) -> str:
    """生成不包含客户数据的诊断问题。

    Args:
        marker: 唯一关联标记。
        target: ``production``、``direct`` 或 ``preflight``。

    Returns:
        供本轮测试使用的固定合成消息。

    Raises:
        不主动抛出异常。
    """

    label = {
        "production": "正式链路",
        "direct": "Dify 直连对照",
        "preflight": "正式链路单请求预检",
    }.get(target, "链路")
    return (
        f"[{marker}] 我是开发人员，正在进行{label}诊断。"
        "不要调用任何工具，不要读取外部资料，只回复“你好”。"
    )


def production_payload(
    marker: str,
    user: str,
    role: RoleSelection,
) -> dict[str, Any]:
    """构造正式后端请求体。

    Args:
        marker: 唯一诊断 marker。
        user: 终端用户 ID。
        role: 当前线上角色和模型配置。

    Returns:
        与正式前端合同一致的请求体。

    Raises:
        不主动抛出异常。
    """

    numeric_user: int | str = int(user) if user.isdigit() else user
    numeric_type: int | str = (
        int(role.role_type) if role.role_type.isdigit() else role.role_type
    )
    return {
        "query": build_synthetic_query(marker, "production"),
        "user": numeric_user,
        "conversation_id": "",
        "type": numeric_type,
        "modelCode": role.model_code,
        "inputs": role.inputs,
        "files": [],
    }


def direct_payload(
    marker: str,
    user: str,
    role: RoleSelection,
) -> dict[str, Any]:
    """构造 Dify Service API 直连请求体。

    Args:
        marker: 唯一诊断 marker。
        user: 终端用户 ID。
        role: 当前线上角色和模型输入。

    Returns:
        Dify ``/chat-messages`` 流式请求体。

    Raises:
        不主动抛出异常。
    """

    return {
        "inputs": role.inputs,
        "query": build_synthetic_query(marker, "direct"),
        "response_mode": "streaming",
        "conversation_id": "",
        "user": str(user),
        "files": [],
    }


def run_concurrent_batch(
    count: int,
    marker_factory: Callable[[int], str],
    worker: Callable[[str], StreamResult],
) -> list[StreamResult]:
    """尽量同时启动指定数量的请求。

    Args:
        count: 并发请求数量。
        marker_factory: 按序号创建唯一 marker 的函数。
        worker: 接收 marker 并完成一次请求的函数。

    Returns:
        按 marker 排序的 ``StreamResult`` 列表。

    Raises:
        DiagnosticError: 并发数越界或 barrier 初始化失败时抛出。
    """

    validate_concurrency(count, "concurrency")
    barrier = threading.Barrier(count)

    def synchronized_worker(index: int) -> StreamResult:
        """等待全部 worker 就绪后再执行一次请求。

        Args:
            index: 该请求在本批中的稳定序号。

        Returns:
            单次请求结果。

        Raises:
            DiagnosticError: barrier 意外损坏时抛出。
        """

        try:
            barrier.wait(timeout=30)
        except threading.BrokenBarrierError as exc:
            raise DiagnosticError("并发启动 barrier 失败") from exc
        return worker(marker_factory(index))

    results: list[StreamResult] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=count) as executor:
        futures = [executor.submit(synchronized_worker, i) for i in range(count)]
        for future in concurrent.futures.as_completed(futures):
            results.append(future.result())
    return sorted(results, key=lambda item: item.marker)


def percentile(values: Sequence[float], percent: float) -> float | None:
    """计算线性插值百分位数。

    Args:
        values: 数值序列。
        percent: 0 到 100 的百分位。

    Returns:
        四舍五入到三位小数的百分位；空序列返回 ``None``。

    Raises:
        ValueError: ``percent`` 超出 0 到 100 时抛出。
    """

    if not 0 <= percent <= 100:
        raise ValueError("percent 必须在 0 到 100 之间")
    if not values:
        return None
    ordered = sorted(float(value) for value in values)
    if len(ordered) == 1:
        return round(ordered[0], 3)
    position = (len(ordered) - 1) * percent / 100
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    fraction = position - lower
    result = ordered[lower] + (ordered[upper] - ordered[lower]) * fraction
    return round(result, 3)


def summarize_stream_results(results: Sequence[StreamResult]) -> dict[str, Any]:
    """汇总一批 SSE 请求的状态与时延。

    Args:
        results: 一批脱敏 ``StreamResult``。

    Returns:
        包含状态分布、时延百分位和逐请求元数据的字典。

    Raises:
        不主动抛出异常。
    """

    statuses = Counter(
        str(item.http_status) if item.http_status is not None else "no_response"
        for item in results
    )
    errors = Counter(
        item.error_category for item in results if item.error_category is not None
    )
    total_values = [item.total_ms for item in results]
    first_event_values = [
        item.first_event_ms
        for item in results
        if item.first_event_ms is not None
    ]
    return {
        "count": len(results),
        "http_status_counts": dict(sorted(statuses.items())),
        "error_category_counts": dict(sorted(errors.items())),
        "first_event_ms": {
            "observed": len(first_event_values),
            "p50": percentile(first_event_values, 50),
            "p95": percentile(first_event_values, 95),
            "max": round(max(first_event_values), 3)
            if first_event_values
            else None,
        },
        "total_ms": {
            "p50": percentile(total_values, 50),
            "p95": percentile(total_values, 95),
            "max": round(max(total_values), 3) if total_values else None,
        },
        "requests": [dataclasses.asdict(item) for item in results],
    }


def validate_concurrency(value: int, label: str) -> None:
    """检查并发数是否在脚本允许范围内。

    Args:
        value: 并发数。
        label: 用于错误信息的参数名。

    Returns:
        无返回值。

    Raises:
        DiagnosticError: 并发数不在 1 到 500 时抛出。
    """

    if value < 1 or value > MAX_SAFE_CONCURRENCY:
        raise DiagnosticError(
            f"{label} 必须在 1 到 {MAX_SAFE_CONCURRENCY} 之间"
        )


def classify_status(status: int) -> str:
    """把 HTTP 状态码归为安全的运维类别。

    Args:
        status: HTTP 状态码。

    Returns:
        不含服务端正文的类别字符串。

    Raises:
        不主动抛出异常。
    """

    if status == 401:
        return "unauthorized"
    if status == 403:
        return "forbidden"
    if status == 402:
        return "quota_or_balance"
    if status == 429:
        return "rate_limited"
    if status == 504:
        return "gateway_timeout"
    if status == 503:
        return "service_unavailable"
    if 500 <= status <= 599:
        return "server_error"
    if 400 <= status <= 499:
        return "client_error"
    if 200 <= status <= 299:
        return "success"
    return "unexpected_status"


def classify_http_error(status: int, raw: bytes) -> str:
    """按状态码和有限响应特征分类 HTTP 错误。

    Args:
        status: HTTP 状态码。
        raw: 最多 64 KiB 的响应体，仅在内存中检查。

    Returns:
        脱敏错误类别。

    Raises:
        不主动抛出异常。
    """

    lowered = raw.lower()
    if status == 504 or b"gateway time-out" in lowered or b"gateway timeout" in lowered:
        return "gateway_timeout"
    return classify_status(status)


def classify_exception(exc: BaseException) -> str:
    """把 Python 网络异常分类为不含敏感正文的类别。

    Args:
        exc: 捕获到的异常。

    Returns:
        脱敏类别字符串。

    Raises:
        不主动抛出异常。
    """

    name = type(exc).__name__.lower()
    reason = getattr(exc, "reason", None)
    reason_name = type(reason).__name__.lower() if reason is not None else ""
    combined = f"{name} {reason_name}"
    if "timeout" in combined:
        return "client_timeout"
    if "ssl" in combined:
        return "tls_error"
    if "gaierror" in combined:
        return "dns_error"
    if "connectionrefused" in combined:
        return "connection_refused"
    if "connectionreset" in combined:
        return "connection_reset"
    return "connection_error"


def classify_error_payload(payload: Mapping[str, Any]) -> str:
    """把 SSE 或 Console 错误对象归为安全类别。

    Args:
        payload: 可能含错误信息的字典。

    Returns:
        脱敏错误类别；不会返回原始文本。

    Raises:
        不主动抛出异常。
    """

    fragments: list[str] = []
    for key in ("code", "status", "error", "message"):
        value = payload.get(key)
        if isinstance(value, (str, int, float)):
            fragments.append(str(value).lower())
    text = " ".join(fragments)
    if "402" in text or "balance" in text or "quota" in text:
        return "quota_or_balance"
    if "429" in text or "rate" in text:
        return "rate_limited"
    if "504" in text or "gateway timeout" in text or "gateway time-out" in text:
        return "gateway_timeout"
    if "503" in text or "service unavailable" in text:
        return "service_unavailable"
    if "timeout" in text:
        return "upstream_timeout"
    if "connect" in text or "network" in text:
        return "connection_error"
    return "workflow_error"


def _first_string(payload: Mapping[str, Any], paths: Sequence[str]) -> str | None:
    """按多个点分路径读取第一个非空字符串。

    Args:
        payload: 要读取的字典。
        paths: 例如 ``("workflow_run_id", "workflow_run.id")``。

    Returns:
        第一个非空值转换成的字符串；找不到时返回 ``None``。

    Raises:
        不主动抛出异常。
    """

    for path in paths:
        current: Any = payload
        for segment in path.split("."):
            if not isinstance(current, dict) or segment not in current:
                current = None
                break
            current = current[segment]
        if current not in (None, ""):
            return str(current)
    return None


def parse_cookie_header(cookie_header: str) -> dict[str, str]:
    """把标准 HTTP Cookie 请求头拆成名称和值。

    Cookie 值可能包含 ``=``，因此每个分段只在第一个等号处分割。这个
    函数只在内存中解析，不记录或输出任何 Cookie 内容。

    Args:
        cookie_header: 从同一条 Dify Console 请求复制的完整 Cookie 值。

    Returns:
        Cookie 名称到原始值的映射；无法识别的分段会被安全忽略。

    Raises:
        不主动抛出异常。
    """

    parsed: dict[str, str] = {}
    for raw_part in cookie_header.split(";"):
        part = raw_part.strip()
        if not part:
            continue
        name, separator, value = part.partition("=")
        name = name.strip()
        value = value.strip()
        if not separator or not name or not value:
            continue
        # 同名 Cookie 理论上不应出现；保留浏览器请求中的第一个值，避免
        # 后续异常分段无意覆盖已经确认的登录态。
        parsed.setdefault(name, value)
    return parsed


def extract_csrf_token_from_console_cookie(cookie_header: str) -> str | None:
    """从完整 Dify Console Cookie 中提取 CSRF token。

    Dify Cloud 在安全域名上可能使用 ``__Host-`` 前缀，自托管版本通常
    使用普通 ``csrf_token``。按明确名称优先匹配，再兼容以
    ``csrf_token`` 结尾的部署定制名称。

    Args:
        cookie_header: 从 Dify Console GET 请求复制的完整 Cookie 值。

    Returns:
        找到的 CSRF token；Cookie 不完整或无法识别时返回 ``None``。

    Raises:
        不主动抛出异常。
    """

    cookies = parse_cookie_header(cookie_header)
    lowered = {name.lower(): value for name, value in cookies.items()}
    for name in (
        "__host-csrf_token",
        "__secure-csrf_token",
        "csrf_token",
    ):
        value = lowered.get(name)
        if value:
            return value

    for name, value in cookies.items():
        if name.lower().endswith("csrf_token") and value:
            return value
    return None


def build_console_headers(
    cookie: str,
    csrf_token: str | None = None,
    authorization: str | None = None,
) -> dict[str, str]:
    """构造只读 Dify Console 请求头。

    Args:
        cookie: 当前 Console 登录请求的完整 Cookie。
        csrf_token: 可选兼容覆盖；缺省时自动从完整 Cookie 中提取。
        authorization: 可选的原样 Authorization 值。

    Returns:
        Console GET 请求头。

    Raises:
        DiagnosticError: Cookie 为空，或 Cookie 中没有可识别的 CSRF token
            且未提供兼容覆盖值时抛出。
    """

    cookie = cookie.strip()
    if not cookie:
        raise DiagnosticError("DIFY_CONSOLE_COOKIE 不能为空")

    effective_csrf_token = (csrf_token or "").strip()
    if not effective_csrf_token:
        effective_csrf_token = (
            extract_csrf_token_from_console_cookie(cookie) or ""
        )
    if not effective_csrf_token:
        raise DiagnosticError(
            "完整 Dify Console Cookie 中未找到 csrf_token；"
            "请重新复制同一条 Console GET 请求的完整 Cookie，"
            "或仅在兼容场景填写 DIFY_CSRF_TOKEN"
        )

    headers = {
        "Accept": "application/json",
        "Cookie": cookie,
        "X-CSRF-Token": effective_csrf_token,
        "User-Agent": USER_AGENT,
    }
    if authorization:
        headers["Authorization"] = authorization
    return headers


def console_get(
    client: HttpClient,
    url: str,
    headers: Mapping[str, str],
) -> Any:
    """执行一次只读 Console GET 并要求 2xx JSON。

    Args:
        client: HTTP 客户端。
        url: 完整 Console API URL。
        headers: Console 鉴权请求头。

    Returns:
        解析后的 JSON。

    Raises:
        DiagnosticError: HTTP 非 2xx 或响应无法解析时抛出。
    """

    result = client.request_json("GET", url, headers)
    if not 200 <= result.status <= 299:
        raise DiagnosticError(
            f"Dify Console GET 失败：HTTP {result.status} "
            f"({classify_status(result.status)})"
        )
    if result.data is None:
        raise DiagnosticError("Dify Console GET 返回了非 JSON 内容")
    return result.data


def extract_items(payload: Any) -> list[dict[str, Any]]:
    """从常见分页响应结构提取字典列表。

    Args:
        payload: Dify Console JSON 响应。

    Returns:
        字典记录列表；无法识别时返回空列表。

    Raises:
        不主动抛出异常。
    """

    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("data", "items", "list", "rows"):
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            nested = extract_items(value)
            if nested:
                return nested
    return []


def payload_has_more(payload: Any, item_count: int, limit: int) -> bool:
    """判断分页响应是否还有下一页。

    Args:
        payload: 当前页 JSON。
        item_count: 当前页记录数。
        limit: 请求的页大小。

    Returns:
        明确 ``has_more`` 时使用其值，否则以满页作为保守判断。

    Raises:
        不主动抛出异常。
    """

    if isinstance(payload, dict):
        for key in ("has_more", "hasMore"):
            if key in payload:
                return bool(payload[key])
        data = payload.get("data")
        if isinstance(data, dict):
            for key in ("has_more", "hasMore"):
                if key in data:
                    return bool(data[key])
    return item_count >= limit


def parse_datetime(value: Any) -> datetime | None:
    """把 epoch 或 ISO 时间转换为 Asia/Shanghai aware datetime。

    Args:
        value: 秒级/毫秒级 epoch、数字字符串或 ISO 字符串。

    Returns:
        上海时区 datetime；无法识别时返回 ``None``。

    Raises:
        不向调用方抛出格式错误。
    """

    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        epoch = float(value)
        if epoch > 10_000_000_000:
            epoch /= 1000
        try:
            return datetime.fromtimestamp(epoch, tz=SHANGHAI)
        except (OverflowError, OSError, ValueError):
            return None
    text = str(value).strip()
    if re.fullmatch(r"\d+(?:\.\d+)?", text):
        return parse_datetime(float(text))
    try:
        normalized = text.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=SHANGHAI)
    return parsed.astimezone(SHANGHAI)


def parse_cli_datetime(value: str | None, fallback: datetime) -> datetime:
    """解析命令行时间，未提供时使用默认值。

    Args:
        value: ISO 时间字符串或 ``None``。
        fallback: 缺省时间。

    Returns:
        上海时区 aware datetime。

    Raises:
        DiagnosticError: 用户提供的时间无法解析时抛出。
    """

    if not value:
        return fallback.astimezone(SHANGHAI)
    parsed = parse_datetime(value)
    if parsed is None:
        raise DiagnosticError(
            f"无法解析时间 {value!r}；请使用 ISO 格式并建议带 +08:00"
        )
    return parsed


def within_window(item: Mapping[str, Any], start: datetime, end: datetime) -> bool:
    """判断记录创建时间是否落在指定窗口。

    Args:
        item: 含 ``created_at`` 的 Dify 记录。
        start: 窗口起点。
        end: 窗口终点。

    Returns:
        创建时间未知时保守返回 ``True``；否则返回是否位于窗口内。

    Raises:
        不主动抛出异常。
    """

    created = parse_datetime(item.get("created_at"))
    if created is None:
        return True
    return start <= created <= end


def fetch_user_conversations(
    client: HttpClient,
    console_base: str,
    app_id: str,
    headers: Mapping[str, str],
    user: str,
    start: datetime,
    end: datetime,
    max_pages: int,
) -> list[dict[str, Any]]:
    """分页读取并按终端用户和时间筛选会话。

    Args:
        client: HTTP 客户端。
        console_base: Console API 根地址。
        app_id: Dify App UUID。
        headers: Console 鉴权头。
        user: ``from_end_user_session_id`` 目标值。
        start: 查询起点。
        end: 查询终点。
        max_pages: 最多读取页数。

    Returns:
        仅属于目标 user 且落在窗口内的会话。

    Raises:
        DiagnosticError: Console 请求失败时抛出。
    """

    conversations: list[dict[str, Any]] = []
    limit = 100
    for page in range(1, max_pages + 1):
        params = {
            "page": page,
            "limit": limit,
            "start": start.strftime("%Y-%m-%d %H:%M"),
            "end": end.strftime("%Y-%m-%d %H:%M"),
            "sort_by": "-created_at",
            "annotation_status": "all",
        }
        url = (
            f"{console_base.rstrip('/')}/apps/{urllib.parse.quote(app_id)}/"
            f"chat-conversations?{urllib.parse.urlencode(params)}"
        )
        payload = console_get(client, url, headers)
        items = extract_items(payload)
        for item in items:
            session_id = item.get("from_end_user_session_id")
            if str(session_id) == str(user) and within_window(item, start, end):
                conversations.append(item)
        if not payload_has_more(payload, len(items), limit):
            break
    return conversations


def conversation_id(item: Mapping[str, Any]) -> str | None:
    """读取会话 ID。

    Args:
        item: Dify 会话记录。

    Returns:
        会话 ID；缺失时返回 ``None``。

    Raises:
        不主动抛出异常。
    """

    return _first_string(item, ("id", "conversation_id"))


def fetch_conversation_messages(
    client: HttpClient,
    console_base: str,
    app_id: str,
    headers: Mapping[str, str],
    conversation: Mapping[str, Any],
) -> tuple[str, list[dict[str, Any]]]:
    """读取一个候选会话的后台消息。

    Args:
        client: HTTP 客户端。
        console_base: Console API 根地址。
        app_id: Dify App UUID。
        headers: Console 鉴权头。
        conversation: 候选会话记录。

    Returns:
        ``(conversation_id, messages)``。

    Raises:
        DiagnosticError: 会话缺少 ID 或 Console 请求失败时抛出。
    """

    conv_id = conversation_id(conversation)
    if not conv_id:
        raise DiagnosticError("Dify 会话记录缺少 id")
    params = urllib.parse.urlencode(
        {"conversation_id": conv_id, "limit": 100}
    )
    url = (
        f"{console_base.rstrip('/')}/apps/{urllib.parse.quote(app_id)}/"
        f"chat-messages?{params}"
    )
    payload = console_get(client, url, headers)
    return conv_id, extract_items(payload)


def contains_marker(value: Any, marker_prefix: str) -> bool:
    """在内存中查找 marker，但不返回匹配文本。

    Args:
        value: 消息 JSON。
        marker_prefix: 本轮唯一 marker 前缀。

    Returns:
        任意字符串字段包含 marker 时返回 ``True``。

    Raises:
        不主动抛出异常。
    """

    if isinstance(value, str):
        return marker_prefix in value
    if isinstance(value, dict):
        return any(contains_marker(child, marker_prefix) for child in value.values())
    if isinstance(value, list):
        return any(contains_marker(child, marker_prefix) for child in value)
    return False


def extract_marker(value: Any, marker_prefix: str) -> str | None:
    """从消息 JSON 提取完整诊断 marker。

    Args:
        value: 消息 JSON。
        marker_prefix: marker 前缀。

    Returns:
        完整 marker；找不到时返回 ``None``。

    Raises:
        不主动抛出异常。
    """

    pattern = re.compile(re.escape(marker_prefix) + r"[A-Za-z0-9_-]*")
    if isinstance(value, str):
        match = pattern.search(value)
        return match.group(0) if match else None
    if isinstance(value, dict):
        for child in value.values():
            match = extract_marker(child, marker_prefix)
            if match:
                return match
    elif isinstance(value, list):
        for child in value:
            match = extract_marker(child, marker_prefix)
            if match:
                return match
    return None


def extract_workflow_run_id(message: Mapping[str, Any]) -> str | None:
    """从 Dify 消息记录提取 workflow run ID。

    Args:
        message: 单条后台消息。

    Returns:
        workflow run ID；无法找到时返回 ``None``。

    Raises:
        不主动抛出异常。
    """

    direct = _first_string(
        message,
        (
            "workflow_run_id",
            "workflow_run.id",
            "metadata.workflow_run_id",
            "metadata.workflow_run.id",
        ),
    )
    if direct:
        return direct
    # 不同 Dify 版本可能把 run 信息放入嵌套结构。这里只查找键名，
    # 不会把嵌套业务内容带入输出。
    for item in walk_dicts(message):
        for key in ("workflow_run_id", "workflowRunId"):
            if item.get(key) not in (None, ""):
                return str(item[key])
    return None


def fetch_workflow_detail(
    client: HttpClient,
    console_base: str,
    app_id: str,
    headers: Mapping[str, str],
    run_id: str,
) -> dict[str, Any]:
    """读取单次 workflow run 详情。

    Args:
        client: HTTP 客户端。
        console_base: Console API 根地址。
        app_id: Dify App UUID。
        headers: Console 鉴权头。
        run_id: workflow run ID。

    Returns:
        workflow run 原始 JSON 字典，仅在内存中使用。

    Raises:
        DiagnosticError: 请求失败或响应不是字典时抛出。
    """

    url = (
        f"{console_base.rstrip('/')}/apps/{urllib.parse.quote(app_id)}/"
        f"workflow-runs/{urllib.parse.quote(run_id)}"
    )
    payload = console_get(client, url, headers)
    if not isinstance(payload, dict):
        raise DiagnosticError("workflow run 详情不是 JSON 对象")
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def fetch_failed_nodes(
    client: HttpClient,
    console_base: str,
    app_id: str,
    headers: Mapping[str, str],
    run_id: str,
) -> list[dict[str, Any]]:
    """读取并脱敏失败节点。

    Args:
        client: HTTP 客户端。
        console_base: Console API 根地址。
        app_id: Dify App UUID。
        headers: Console 鉴权头。
        run_id: workflow run ID。

    Returns:
        仅含节点身份、状态、耗时和错误类别的列表。

    Raises:
        DiagnosticError: Console 请求失败时抛出。
    """

    url = (
        f"{console_base.rstrip('/')}/apps/{urllib.parse.quote(app_id)}/"
        f"workflow-runs/{urllib.parse.quote(run_id)}/node-executions"
    )
    payload = console_get(client, url, headers)
    safe_nodes: list[dict[str, Any]] = []
    for node in extract_items(payload):
        status = str(node.get("status") or "")
        error_value = node.get("error")
        if status.lower() not in {"failed", "error"} and not error_value:
            continue
        safe_nodes.append(
            {
                "id": _first_string(node, ("id",)),
                "node_id": _first_string(node, ("node_id", "nodeId")),
                "title": _first_string(node, ("title", "node_title")),
                "node_type": _first_string(node, ("node_type", "nodeType")),
                "status": status or None,
                "elapsed_time": node.get("elapsed_time"),
                "created_at": _safe_time_value(node.get("created_at")),
                "finished_at": _safe_time_value(node.get("finished_at")),
                "retry_index": node.get("retry_index"),
                "error_category": classify_error_payload(
                    {
                        "error": str(error_value or ""),
                        "status": status,
                    }
                ),
            }
        )
    return safe_nodes


def _safe_time_value(value: Any) -> str | None:
    """把 Dify 时间字段转换为 ISO 字符串。

    Args:
        value: epoch 或 ISO 时间。

    Returns:
        上海时区 ISO 时间；无法解析时返回 ``None``。

    Raises:
        不主动抛出异常。
    """

    parsed = parse_datetime(value)
    return parsed.isoformat() if parsed else None


def safe_run_summary(
    run: Mapping[str, Any],
    marker: str | None = None,
    failed_nodes: Sequence[Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    """从 workflow run 中选取可安全输出的运维字段。

    Args:
        run: workflow run 详情或列表记录。
        marker: 可选诊断 marker。
        failed_nodes: 可选脱敏失败节点。

    Returns:
        不包含 inputs、outputs、prompt、answer 或原始 error 的摘要。

    Raises:
        不主动抛出异常。
    """

    status = str(run.get("status") or "")
    raw_error = run.get("error")
    summary: dict[str, Any] = {
        "id": _first_string(run, ("id", "workflow_run_id")),
        "marker": marker,
        "conversation_id": _first_string(
            run,
            ("conversation_id", "conversation.id"),
        ),
        "status": status or None,
        "triggered_from": run.get("triggered_from"),
        "created_at": _safe_time_value(run.get("created_at")),
        "finished_at": _safe_time_value(run.get("finished_at")),
        "elapsed_time": run.get("elapsed_time"),
        "total_steps": run.get("total_steps"),
        "total_tokens": run.get("total_tokens"),
        "error_category": (
            classify_error_payload(
                {"error": str(raw_error or ""), "status": status}
            )
            if raw_error or status.lower() in {"failed", "error"}
            else None
        ),
    }
    if failed_nodes is not None:
        summary["failed_nodes"] = list(failed_nodes)
    return summary


def run_interval(run: Mapping[str, Any]) -> tuple[datetime, datetime] | None:
    """从 run 摘要推导执行区间。

    Args:
        run: 已脱敏的 run 摘要。

    Returns:
        ``(start, finish)``；数据不足时返回 ``None``。

    Raises:
        不主动抛出异常。
    """

    start = parse_datetime(run.get("created_at"))
    finish = parse_datetime(run.get("finished_at"))
    if start is None:
        return None
    if finish is None:
        elapsed = run.get("elapsed_time")
        try:
            finish = start + timedelta(seconds=float(elapsed))
        except (TypeError, ValueError):
            return None
    if finish < start:
        return None
    return start, finish


def max_observed_concurrency(runs: Sequence[Mapping[str, Any]]) -> int:
    """通过 run 执行区间计算观测到的最大并发。

    Args:
        runs: workflow run 摘要。

    Returns:
        最大重叠区间数；没有可用区间时返回 0。

    Raises:
        不主动抛出异常。
    """

    events: list[tuple[datetime, int]] = []
    for run in runs:
        interval = run_interval(run)
        if interval is None:
            continue
        start, finish = interval
        events.append((start, 1))
        events.append((finish, -1))
    # 同一时刻先处理结束再处理开始，避免把首尾相接误判为并发。
    events.sort(key=lambda item: (item[0], item[1]))
    current = 0
    maximum = 0
    for _, delta in events:
        current += delta
        maximum = max(maximum, current)
    return maximum


def summarize_runs(runs: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """汇总匹配到的 workflow runs。

    Args:
        runs: 脱敏 workflow run 摘要。

    Returns:
        状态计数、耗时、到达跨度和最大并发。

    Raises:
        不主动抛出异常。
    """

    statuses = Counter(str(run.get("status") or "unknown") for run in runs)
    elapsed_values: list[float] = []
    starts: list[datetime] = []
    for run in runs:
        try:
            if run.get("elapsed_time") is not None:
                elapsed_values.append(float(run["elapsed_time"]))
        except (TypeError, ValueError):
            pass
        parsed = parse_datetime(run.get("created_at"))
        if parsed:
            starts.append(parsed)
    arrival_spread_seconds = (
        round((max(starts) - min(starts)).total_seconds(), 3)
        if len(starts) >= 2
        else 0.0
        if starts
        else None
    )
    return {
        "matched_count": len(runs),
        "status_counts": dict(sorted(statuses.items())),
        "elapsed_seconds": {
            "p50": percentile(elapsed_values, 50),
            "p95": percentile(elapsed_values, 95),
            "max": round(max(elapsed_values), 3) if elapsed_values else None,
        },
        "arrival_spread_seconds": arrival_spread_seconds,
        "max_observed_concurrency": max_observed_concurrency(runs),
        "runs": list(runs),
    }


def fetch_marker_runs(
    client: HttpClient,
    console_base: str,
    app_id: str,
    headers: Mapping[str, str],
    user: str,
    marker_prefix: str,
    start: datetime,
    end: datetime,
    max_pages: int,
    workers: int,
) -> dict[str, Any]:
    """按 user 和 marker 精确关联 workflow runs。

    Args:
        client: HTTP 客户端。
        console_base: Console API 根地址。
        app_id: Dify App UUID。
        headers: Console 鉴权头。
        user: 终端用户 ID。
        marker_prefix: 本轮唯一 marker 前缀。
        start: 查询起点。
        end: 查询终点。
        max_pages: 会话最大分页数。
        workers: 并行读取消息和 run 详情的线程数。

    Returns:
        会话数量、匹配消息数量和脱敏 run 汇总。

    Raises:
        DiagnosticError: Console 请求失败时抛出。
    """

    conversations = fetch_user_conversations(
        client,
        console_base,
        app_id,
        headers,
        user,
        start,
        end,
        max_pages,
    )
    LOGGER.info("找到 user=%s 的候选会话 %s 条", user, len(conversations))
    matches: list[tuple[str, str | None, str | None]] = []
    max_workers = max(1, min(workers, len(conversations) or 1))

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {
            executor.submit(
                fetch_conversation_messages,
                client,
                console_base,
                app_id,
                headers,
                item,
            ): item
            for item in conversations
        }
        for future in concurrent.futures.as_completed(future_map):
            conv_id, messages = future.result()
            for message in messages:
                if not contains_marker(message, marker_prefix):
                    continue
                matches.append(
                    (
                        conv_id,
                        extract_marker(message, marker_prefix),
                        extract_workflow_run_id(message),
                    )
                )

    # 同一条消息的嵌套结构可能重复暴露 run ID，因此用稳定 tuple 去重。
    unique_matches = sorted(set(matches), key=lambda item: (item[1] or "", item[0]))
    run_tasks: list[tuple[str, str | None]] = []
    for _, marker, run_id in unique_matches:
        if run_id:
            run_tasks.append((run_id, marker))
    unique_run_tasks = sorted(set(run_tasks), key=lambda item: item[0])

    safe_runs: list[dict[str, Any]] = []
    detail_workers = max(1, min(workers, len(unique_run_tasks) or 1))
    with concurrent.futures.ThreadPoolExecutor(max_workers=detail_workers) as executor:
        future_map = {
            executor.submit(
                fetch_workflow_detail,
                client,
                console_base,
                app_id,
                headers,
                run_id,
            ): (run_id, marker)
            for run_id, marker in unique_run_tasks
        }
        for future in concurrent.futures.as_completed(future_map):
            run_id, marker = future_map[future]
            detail = future.result()
            status = str(detail.get("status") or "").lower()
            failed_nodes = (
                fetch_failed_nodes(
                    client,
                    console_base,
                    app_id,
                    headers,
                    run_id,
                )
                if status in {"failed", "error"}
                else None
            )
            safe_runs.append(safe_run_summary(detail, marker, failed_nodes))
    safe_runs.sort(key=lambda item: str(item.get("marker") or item.get("id") or ""))
    summary = summarize_runs(safe_runs)
    summary.update(
        {
            "candidate_conversations": len(conversations),
            "matched_messages": len(unique_matches),
            "messages_without_workflow_run_id": sum(
                1 for _, _, run_id in unique_matches if not run_id
            ),
        }
    )
    return summary


def fetch_failed_runs(
    client: HttpClient,
    console_base: str,
    app_id: str,
    headers: Mapping[str, str],
    user: str,
    start: datetime,
    end: datetime,
    max_pages: int,
    workers: int,
) -> dict[str, Any]:
    """从已验证的 Advanced Chat 失败运行接口读取 user 失败记录。

    Args:
        client: HTTP 客户端。
        console_base: Console API 根地址。
        app_id: Dify App UUID。
        headers: Console 鉴权头。
        user: 要筛选的终端用户。
        start: 北京时间窗口起点。
        end: 北京时间窗口终点。
        max_pages: 会话和运行列表最大页数。
        workers: 读取详情和节点的并行线程数。

    Returns:
        脱敏失败运行汇总。

    Raises:
        DiagnosticError: Console 请求失败时抛出。
    """

    conversations = fetch_user_conversations(
        client,
        console_base,
        app_id,
        headers,
        user,
        start,
        end,
        max_pages,
    )
    user_conversation_ids = {
        conv_id
        for item in conversations
        if (conv_id := conversation_id(item)) is not None
    }

    failed_records: list[dict[str, Any]] = []
    last_id: str | None = None
    limit = 100
    for _ in range(max_pages):
        params: dict[str, Any] = {
            "triggered_from": "app-run",
            "status": "failed",
            "limit": limit,
        }
        if last_id:
            params["last_id"] = last_id
        url = (
            f"{console_base.rstrip('/')}/apps/{urllib.parse.quote(app_id)}/"
            f"advanced-chat/workflow-runs?{urllib.parse.urlencode(params)}"
        )
        payload = console_get(client, url, headers)
        items = extract_items(payload)
        for item in items:
            conv_id = _first_string(item, ("conversation_id", "conversation.id"))
            if (
                conv_id in user_conversation_ids
                and within_window(item, start, end)
            ):
                failed_records.append(item)
        if not payload_has_more(payload, len(items), limit) or not items:
            break
        next_last_id = _first_string(items[-1], ("id", "workflow_run_id"))
        if not next_last_id or next_last_id == last_id:
            break
        last_id = next_last_id

    run_ids = sorted(
        {
            run_id
            for item in failed_records
            if (run_id := _first_string(item, ("id", "workflow_run_id")))
        }
    )
    safe_runs: list[dict[str, Any]] = []
    max_workers = max(1, min(workers, len(run_ids) or 1))

    def load_failed_run(run_id: str) -> dict[str, Any]:
        """读取并脱敏一个失败 run。

        Args:
            run_id: workflow run ID。

        Returns:
            含失败节点的安全摘要。

        Raises:
            DiagnosticError: 详情或节点请求失败时抛出。
        """

        detail = fetch_workflow_detail(
            client,
            console_base,
            app_id,
            headers,
            run_id,
        )
        nodes = fetch_failed_nodes(
            client,
            console_base,
            app_id,
            headers,
            run_id,
        )
        return safe_run_summary(detail, failed_nodes=nodes)

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(load_failed_run, run_id) for run_id in run_ids]
        for future in concurrent.futures.as_completed(futures):
            safe_runs.append(future.result())
    safe_runs.sort(key=lambda item: str(item.get("created_at") or ""))
    summary = summarize_runs(safe_runs)
    summary["candidate_conversations"] = len(conversations)
    return summary


def resolve_app_id(
    client: HttpClient,
    service_base: str,
    console_base: str,
    app_key: str,
    console_headers: Mapping[str, str],
) -> str:
    """用 App API Key 的应用名在 Console 中自动解析 App UUID。

    Args:
        client: HTTP 客户端。
        service_base: Dify Service API 根地址。
        console_base: Dify Console API 根地址。
        app_key: 发布应用的 ``app-`` key。
        console_headers: Console 登录请求头。

    Returns:
        唯一匹配的 App UUID。

    Raises:
        DiagnosticError: `/info` 失败、应用名缺失或 Console 匹配不唯一时抛出。
    """

    info_result = client.request_json(
        "GET",
        f"{service_base.rstrip('/')}/info",
        {
            "Authorization": f"Bearer {app_key}",
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    if info_result.status != 200 or not isinstance(info_result.data, dict):
        raise DiagnosticError(
            f"无法通过 Dify /info 识别应用：HTTP {info_result.status}"
        )
    app_name = info_result.data.get("name")
    if not isinstance(app_name, str) or not app_name.strip():
        raise DiagnosticError("Dify /info 未返回应用名，请显式提供 DIFY_APP_ID")
    params = urllib.parse.urlencode(
        {"page": 1, "limit": 100, "name": app_name.strip()}
    )
    payload = console_get(
        client,
        f"{console_base.rstrip('/')}/apps?{params}",
        console_headers,
    )
    exact_matches = [
        item
        for item in extract_items(payload)
        if str(item.get("name") or "").strip() == app_name.strip()
        and item.get("id") not in (None, "")
    ]
    if len(exact_matches) != 1:
        raise DiagnosticError(
            "无法唯一匹配 Dify App UUID，请在 .env 填写 DIFY_APP_ID"
        )
    return str(exact_matches[0]["id"])


def poll_marker_logs(
    fetch_once: Callable[[], dict[str, Any]],
    expected: int,
    wait_seconds: float,
    poll_seconds: float,
) -> dict[str, Any]:
    """轮询 marker 日志，直到数量满足预期或超时。

    Args:
        fetch_once: 执行一次只读日志查询的函数。
        expected: 期望匹配到的消息数量。
        wait_seconds: 最长轮询秒数；0 表示只查一次。
        poll_seconds: 两次查询之间的间隔秒数。

    Returns:
        最后一次日志查询结果，并附带轮询状态。

    Raises:
        DiagnosticError: 参数非法或单次查询失败时抛出。
    """

    if wait_seconds < 0 or poll_seconds <= 0:
        raise DiagnosticError("log-wait 必须 >= 0，log-poll 必须 > 0")
    deadline = time.monotonic() + wait_seconds
    attempts = 0
    while True:
        attempts += 1
        result = fetch_once()
        matched = int(result.get("matched_messages") or 0)
        if matched >= expected:
            result["poll"] = {
                "attempts": attempts,
                "complete": True,
                "expected_messages": expected,
            }
            return result
        if time.monotonic() >= deadline:
            result["poll"] = {
                "attempts": attempts,
                "complete": False,
                "expected_messages": expected,
            }
            return result
        LOGGER.info(
            "Dify 日志已匹配 %s/%s，%s 秒后继续只读查询",
            matched,
            expected,
            poll_seconds,
        )
        time.sleep(min(poll_seconds, max(0.0, deadline - time.monotonic())))


def run_load(args: argparse.Namespace, include_logs: bool) -> dict[str, Any]:
    """执行正式后端压测、可选直连对照和可选日志关联。

    Args:
        args: ``argparse`` 解析后的命令参数。
        include_logs: 为 ``True`` 时在流量测试后查询 Console 日志。

    Returns:
        最终脱敏报告。

    Raises:
        DiagnosticError: 凭据、预检、配置或日志查询失败时抛出。
    """

    if not args.confirm_production:
        raise DiagnosticError(
            "正式流量测试必须显式添加 --confirm-production"
        )
    validate_concurrency(args.concurrency, "concurrency")
    if args.direct_concurrency < 0 or args.direct_concurrency > MAX_SAFE_CONCURRENCY:
        raise DiagnosticError(
            f"direct-concurrency 必须在 0 到 {MAX_SAFE_CONCURRENCY} 之间"
        )

    account_token = get_secret(
        "YD_ACCOUNT_TOKEN",
        "请输入赢单正式账号 Token",
        required=True,
    )
    assert account_token is not None
    client = HttpClient(args.timeout, args.no_proxy)
    sub_id, role = resolve_live_role(
        client,
        args.api_base,
        account_token,
        str(args.user),
        args.url,
        args.model_code,
    )
    marker_prefix = build_marker_prefix(sub_id)
    run_started = datetime.now(SHANGHAI)
    emit_phase(
        "identified",
        {
            "marker_prefix": marker_prefix,
            "sub_id": sub_id,
            "role": {
                "id": role.role_id,
                "type": role.role_type,
                "name": role.role_name,
                "role_model": role.role_model,
                "model_code": role.model_code,
                "model_name": role.model_name,
                "input_keys": sorted(role.inputs.keys()),
            },
        },
    )

    production_url = f"{args.api_base.rstrip('/')}/index/dify/chat"
    production_headers = {
        "Authorization": f"Bearer {account_token}",
        "Accept": "text/event-stream",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
    }
    preflight_marker = f"{marker_prefix}PREFLIGHT"
    preflight = client.stream_post(
        production_url,
        production_headers,
        {
            **production_payload(preflight_marker, str(args.user), role),
            "query": build_synthetic_query(preflight_marker, "preflight"),
        },
        preflight_marker,
        "preflight",
    )
    emit_phase("preflight", {"result": dataclasses.asdict(preflight)})
    if (
        preflight.http_status != 200
        or preflight.sse_error
        or preflight.error_category is not None
    ):
        raise DiagnosticError("正式后端单请求预检失败，已停止并发测试")

    LOGGER.info("开始正式后端 %s 并发；POST 不自动重试", args.concurrency)

    def production_worker(marker: str) -> StreamResult:
        """执行一次正式后端请求。

        Args:
            marker: 唯一诊断 marker。

        Returns:
            脱敏流式请求结果。

        Raises:
            网络错误会由 ``stream_post`` 转换为结果。
        """

        return client.stream_post(
            production_url,
            production_headers,
            production_payload(marker, str(args.user), role),
            marker,
            "production",
        )

    production_started_perf = time.perf_counter()
    production_results = run_concurrent_batch(
        args.concurrency,
        lambda index: f"{marker_prefix}PROD_{index:03d}",
        production_worker,
    )
    production_summary = summarize_stream_results(production_results)
    production_summary["wall_ms"] = _elapsed_ms(production_started_perf)
    emit_phase("production_batch", {"summary": production_summary})

    direct_results: list[StreamResult] = []
    direct_summary: dict[str, Any] | None = None
    app_key: str | None = None
    if args.direct_concurrency:
        app_key = get_secret(
            "DIFY_APP_API_KEY",
            "请输入对应 Dify App API Key",
            required=True,
        )
        assert app_key is not None
        LOGGER.info(
            "开始 Dify Service API %s 并发直连对照；POST 不自动重试",
            args.direct_concurrency,
        )
        direct_headers = {
            "Authorization": f"Bearer {app_key}",
            "Accept": "text/event-stream",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        }
        direct_url = f"{args.dify_service_base.rstrip('/')}/chat-messages"

        def direct_worker(marker: str) -> StreamResult:
            """执行一次 Dify Service API 直连请求。

            Args:
                marker: 唯一诊断 marker。

            Returns:
                脱敏流式请求结果。

            Raises:
                网络错误会由 ``stream_post`` 转换为结果。
            """

            return client.stream_post(
                direct_url,
                direct_headers,
                direct_payload(marker, str(args.user), role),
                marker,
                "direct",
            )

        direct_started_perf = time.perf_counter()
        direct_results = run_concurrent_batch(
            args.direct_concurrency,
            lambda index: f"{marker_prefix}DIRECT_{index:03d}",
            direct_worker,
        )
        direct_summary = summarize_stream_results(direct_results)
        direct_summary["wall_ms"] = _elapsed_ms(direct_started_perf)
        emit_phase("direct_batch", {"summary": direct_summary})

    run_finished = datetime.now(SHANGHAI)
    logs_summary: dict[str, Any] | None = None
    app_id: str | None = None
    if include_logs:
        cookie = get_secret(
            "DIFY_CONSOLE_COOKIE",
            "请输入 Dify Console Cookie",
            required=True,
        )
        csrf_token = get_secret(
            "DIFY_CSRF_TOKEN",
            "请输入可选 Dify Console CSRF Token 兼容覆盖值",
            required=False,
        )
        authorization = get_secret(
            "DIFY_CONSOLE_AUTHORIZATION",
            "请输入可选 Console Authorization",
            required=False,
        )
        assert cookie is not None
        console_headers = build_console_headers(
            cookie,
            csrf_token,
            authorization,
        )
        app_id = args.app_id or os.environ.get("DIFY_APP_ID", "").strip() or None
        if app_id is None:
            app_key = app_key or get_secret(
                "DIFY_APP_API_KEY",
                "请输入对应 Dify App API Key 以自动识别 App ID",
                required=True,
            )
            assert app_key is not None
            app_id = resolve_app_id(
                client,
                args.dify_service_base,
                args.dify_console_base,
                app_key,
                console_headers,
            )
        expected = 1 + len(production_results) + len(direct_results)
        query_start = run_started - timedelta(minutes=2)
        # 给异步排队的后台请求留出时间；每次 Console 请求仍是只读 GET。
        query_end = run_finished + timedelta(
            seconds=max(args.log_wait, 60) + args.timeout
        )

        def fetch_once() -> dict[str, Any]:
            """执行一次本轮 marker 的只读 Console 查询。

            Returns:
                脱敏日志关联汇总。

            Raises:
                DiagnosticError: Console 请求失败时抛出。
            """

            return fetch_marker_runs(
                client,
                args.dify_console_base,
                app_id,
                console_headers,
                str(args.user),
                marker_prefix,
                query_start,
                query_end,
                args.max_log_pages,
                args.log_workers,
            )

        logs_summary = poll_marker_logs(
            fetch_once,
            expected,
            args.log_wait,
            args.log_poll,
        )
        emit_phase("dify_logs", {"summary": logs_summary})

    report = {
        "schema_version": 1,
        "command": "both" if include_logs else "load",
        "marker_prefix": marker_prefix,
        "user": str(args.user),
        "feature": {
            "url": args.url,
            "sub_id": sub_id,
            "role_id": role.role_id,
            "role_type": role.role_type,
            "role_name": role.role_name,
            "role_model": role.role_model,
            "model_code": role.model_code,
            "model_name": role.model_name,
            "input_keys": sorted(role.inputs.keys()),
        },
        "started_at": run_started.isoformat(),
        "finished_at": run_finished.isoformat(),
        "preflight": dataclasses.asdict(preflight),
        "production": production_summary,
        "direct": direct_summary,
        "dify_logs": logs_summary,
        "dify_app_id": app_id,
    }
    write_report(args.output, report)
    emit_phase(
        "complete",
        {
            "marker_prefix": marker_prefix,
            "production_count": len(production_results),
            "direct_count": len(direct_results),
            "logs_matched": (
                logs_summary.get("matched_messages")
                if logs_summary is not None
                else None
            ),
        },
    )
    return report


def run_logs(args: argparse.Namespace) -> dict[str, Any]:
    """只读查询已有 marker 或 Advanced Chat 失败运行。

    Args:
        args: ``logs`` 子命令参数。

    Returns:
        脱敏 Console 日志报告。

    Raises:
        DiagnosticError: 参数、凭据或 Console 请求失败时抛出。
    """

    if not args.marker_prefix and not args.failed_only:
        raise DiagnosticError("logs 必须提供 --marker-prefix 或 --failed-only")
    client = HttpClient(args.timeout, args.no_proxy)
    cookie = get_secret(
        "DIFY_CONSOLE_COOKIE",
        "请输入 Dify Console Cookie",
        required=True,
    )
    csrf_token = get_secret(
        "DIFY_CSRF_TOKEN",
        "请输入可选 Dify Console CSRF Token 兼容覆盖值",
        required=False,
    )
    authorization = get_secret(
        "DIFY_CONSOLE_AUTHORIZATION",
        "请输入可选 Console Authorization",
        required=False,
    )
    assert cookie is not None
    headers = build_console_headers(cookie, csrf_token, authorization)
    app_id = args.app_id or os.environ.get("DIFY_APP_ID", "").strip() or None
    if app_id is None:
        app_key = get_secret(
            "DIFY_APP_API_KEY",
            "请输入可选 Dify App API Key 以自动识别 App ID",
            required=False,
        )
        if app_key is None:
            raise DiagnosticError(
                "缺少 DIFY_APP_ID；只读日志不需要 DIFY_APP_API_KEY，"
                "请从目标 Dify 应用 URL 或 Console 请求 URL 复制 App UUID"
            )
        app_id = resolve_app_id(
            client,
            args.dify_service_base,
            args.dify_console_base,
            app_key,
            headers,
        )

    now = datetime.now(SHANGHAI)
    default_start = (
        now.replace(hour=0, minute=0, second=0, microsecond=0)
        if args.failed_only
        else now - timedelta(hours=2)
    )
    start = parse_cli_datetime(args.start, default_start)
    end = parse_cli_datetime(args.end, now)
    if end < start:
        raise DiagnosticError("--end 不能早于 --start")

    if args.failed_only:
        summary = fetch_failed_runs(
            client,
            args.dify_console_base,
            app_id,
            headers,
            str(args.user),
            start,
            end,
            args.max_log_pages,
            args.log_workers,
        )
        mode = "failed_only"
    else:
        assert args.marker_prefix is not None

        def fetch_once() -> dict[str, Any]:
            """执行一次 marker 日志查询。

            Returns:
                脱敏 marker run 汇总。

            Raises:
                DiagnosticError: Console 请求失败时抛出。
            """

            return fetch_marker_runs(
                client,
                args.dify_console_base,
                app_id,
                headers,
                str(args.user),
                args.marker_prefix,
                start,
                end,
                args.max_log_pages,
                args.log_workers,
            )

        summary = poll_marker_logs(
            fetch_once,
            max(0, args.expected),
            args.log_wait,
            args.log_poll,
        )
        mode = "marker"

    report = {
        "schema_version": 1,
        "command": "logs",
        "mode": mode,
        "user": str(args.user),
        "app_id": app_id,
        "marker_prefix": args.marker_prefix,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "summary": summary,
    }
    write_report(args.output, report)
    emit_phase("logs_complete", report)
    return report


def run_self_test() -> dict[str, Any]:
    """执行完全离线的解析器和统计函数自检。

    Returns:
        每个离线断言的通过情况。

    Raises:
        AssertionError: 任一核心纯函数行为不符合预期时抛出。
    """

    checks: list[str] = []
    assert (
        parse_feature_url(
            "https://top-yd.com/chat?menuId=23&subId=47&modelType=dify"
        )
        == "47"
    )
    checks.append("feature_url")

    role_payload = {
        "data": [
            {
                "id": 47,
                "type": 47,
                "role": "来访接待",
                "roleModel": "dify",
                "difyJson": json.dumps(
                    {
                        "models": [
                            {
                                "code": "A",
                                "model_name": "deepseek-v4-flash",
                                "inputs": {
                                    "skill_key": "visit-reception",
                                    "model_key": "deepseek-v4-flash",
                                },
                            }
                        ]
                    }
                ),
            }
        ]
    }
    role = select_role(role_payload, "47", "A")
    assert role.role_type == "47"
    assert role.inputs["skill_key"] == "visit-reception"
    checks.append("role_selection")

    assert percentile([1, 2, 3, 4], 50) == 2.5
    assert percentile([], 95) is None
    checks.append("percentile")

    cookie = (
        "theme=light; __Host-access_token=fake-access-token; "
        "__Host-csrf_token=fake.csrf.token=="
    )
    headers = build_console_headers(cookie)
    assert headers["Cookie"] == cookie
    assert headers["X-CSRF-Token"] == "fake.csrf.token=="
    override_headers = build_console_headers(
        "access_token=fake-access-token; csrf_token=cookie-token",
        "override-token",
    )
    assert override_headers["X-CSRF-Token"] == "override-token"
    try:
        build_console_headers("access_token=fake-access-token")
    except DiagnosticError as exc:
        assert "DIFY_CSRF_TOKEN" in str(exc)
    else:
        raise AssertionError("缺少 CSRF 的 Cookie 应被拒绝")
    checks.append("console_cookie_csrf")

    runs = [
        {
            "created_at": "2026-07-28T10:00:00+08:00",
            "finished_at": "2026-07-28T10:00:03+08:00",
        },
        {
            "created_at": "2026-07-28T10:00:01+08:00",
            "finished_at": "2026-07-28T10:00:02+08:00",
        },
        {
            "created_at": "2026-07-28T10:00:03+08:00",
            "finished_at": "2026-07-28T10:00:04+08:00",
        },
    ]
    assert max_observed_concurrency(runs) == 2
    checks.append("max_observed_concurrency")

    sample = {
        "query": "[YD_DIAG_47_20260728_100000_A1B2C3_PROD_007] secret text"
    }
    prefix = "YD_DIAG_47_20260728_100000_A1B2C3_"
    assert contains_marker(sample, prefix)
    assert extract_marker(sample, prefix) == f"{prefix}PROD_007"
    checks.append("marker_correlation")

    safe = safe_run_summary(
        {
            "id": "run-1",
            "status": "failed",
            "created_at": 1785204000,
            "error": "provider 503 with customer prompt",
            "inputs": {"private": "must not leak"},
            "outputs": {"private": "must not leak"},
        }
    )
    serialized = json.dumps(safe)
    assert "must not leak" not in serialized
    assert safe["error_category"] == "service_unavailable"
    checks.append("redaction")

    result = {"ok": True, "checks": checks}
    emit_phase("self_test", result)
    return result


def add_http_options(parser: argparse.ArgumentParser) -> None:
    """为子命令添加公共 HTTP 参数。

    Args:
        parser: 要扩展的 argparse parser。

    Returns:
        无返回值。

    Raises:
        不主动抛出异常。
    """

    parser.add_argument(
        "--timeout",
        type=float,
        default=180,
        help="单请求超时秒数，默认 180",
    )
    parser.add_argument(
        "--no-proxy",
        action="store_true",
        help="忽略系统代理，直接连接目标地址",
    )
    parser.add_argument(
        "--dify-service-base",
        default=os.environ.get(
            "DIFY_SERVICE_BASE",
            DEFAULT_DIFY_SERVICE_BASE,
        ),
        help="Dify Service API 根地址",
    )
    parser.add_argument(
        "--dify-console-base",
        default=os.environ.get(
            "DIFY_CONSOLE_BASE",
            DEFAULT_DIFY_CONSOLE_BASE,
        ),
        help="Dify Console API 根地址",
    )
    parser.add_argument(
        "--output",
        help="可选：写入脱敏 JSON 报告的路径",
    )


def add_log_options(parser: argparse.ArgumentParser) -> None:
    """为需要 Console 日志的命令添加公共参数。

    Args:
        parser: 要扩展的 argparse parser。

    Returns:
        无返回值。

    Raises:
        不主动抛出异常。
    """

    parser.add_argument(
        "--app-id",
        help="Dify App UUID；缺省时读取 DIFY_APP_ID 或尝试自动识别",
    )
    parser.add_argument(
        "--max-log-pages",
        type=int,
        default=10,
        help="Console 列表最多读取页数，默认 10",
    )
    parser.add_argument(
        "--log-workers",
        type=int,
        default=10,
        help="只读日志详情并行线程数，默认 10",
    )
    parser.add_argument(
        "--log-wait",
        type=float,
        default=240,
        help="等待异步日志出现的最长秒数，默认 240",
    )
    parser.add_argument(
        "--log-poll",
        type=float,
        default=10,
        help="日志轮询间隔秒数，默认 10",
    )


def build_parser() -> argparse.ArgumentParser:
    """构建命令行解析器。

    Returns:
        配置完成的 ``ArgumentParser``。

    Raises:
        不主动抛出异常。
    """

    parser = argparse.ArgumentParser(
        description="正式 Dify 链路并发测试与 Console 日志关联工具",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="输出更详细的本地运行日志",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    for command in ("load", "both"):
        subparser = subparsers.add_parser(
            command,
            help=(
                "正式后端压测"
                if command == "load"
                else "正式压测 + Dify 直连对照 + Console 日志"
            ),
        )
        subparser.add_argument("--url", required=True, help="正式功能页面 URL")
        subparser.add_argument(
            "--concurrency",
            type=int,
            default=50,
            help="正式后端并发数，默认 50",
        )
        subparser.add_argument(
            "--direct-concurrency",
            type=int,
            default=10 if command == "both" else 0,
            help="Dify 直连对照并发数；load 默认 0，both 默认 10",
        )
        subparser.add_argument("--user", default="39", help="终端用户 ID，默认 39")
        subparser.add_argument(
            "--model-code",
            default="A",
            help="线上角色模型档位，默认 A",
        )
        subparser.add_argument(
            "--api-base",
            default=os.environ.get("YD_API_BASE", DEFAULT_API_BASE),
            help="赢单正式 API 根地址",
        )
        subparser.add_argument(
            "--confirm-production",
            action="store_true",
            help="确认已获授权，可向正式环境发送合成测试流量",
        )
        add_http_options(subparser)
        if command == "both":
            add_log_options(subparser)

    logs_parser = subparsers.add_parser(
        "logs",
        help="只读查询 marker 或 Advanced Chat 失败运行",
    )
    logs_parser.add_argument("--user", default="39", help="终端用户 ID，默认 39")
    logs_parser.add_argument("--marker-prefix", help="要精确关联的诊断 marker 前缀")
    logs_parser.add_argument(
        "--failed-only",
        action="store_true",
        help="改用已验证的 Advanced Chat failed runs 接口",
    )
    logs_parser.add_argument("--start", help="查询起点 ISO 时间，建议带 +08:00")
    logs_parser.add_argument("--end", help="查询终点 ISO 时间，建议带 +08:00")
    logs_parser.add_argument(
        "--expected",
        type=int,
        default=0,
        help="marker 模式期望消息数；达到后停止轮询",
    )
    add_http_options(logs_parser)
    add_log_options(logs_parser)
    logs_parser.set_defaults(log_wait=0)

    subparsers.add_parser("self-test", help="执行完全离线的核心函数自检")
    return parser


def validate_args(args: argparse.Namespace) -> None:
    """执行 argparse 难以表达的跨参数校验。

    Args:
        args: 已解析命令参数。

    Returns:
        无返回值。

    Raises:
        DiagnosticError: 页数、线程数或 expected 非法时抛出。
    """

    if args.command in {"both", "logs"}:
        if args.max_log_pages < 1 or args.max_log_pages > 100:
            raise DiagnosticError("max-log-pages 必须在 1 到 100 之间")
        if args.log_workers < 1 or args.log_workers > 50:
            raise DiagnosticError("log-workers 必须在 1 到 50 之间")
        if args.log_wait < 0 or args.log_poll <= 0:
            raise DiagnosticError("log-wait 必须 >= 0，log-poll 必须 > 0")
    if args.command == "logs" and args.expected < 0:
        raise DiagnosticError("expected 不能小于 0")


def main(argv: Sequence[str] | None = None) -> int:
    """程序入口。

    Args:
        argv: 可选命令参数；缺省时使用 ``sys.argv``。

    Returns:
        0 表示成功，2 表示安全可展示的诊断错误，3 表示意外错误。

    Raises:
        不向顶层调用方继续抛出异常。
    """

    skill_root = Path(__file__).resolve().parents[1]
    try:
        load_env_file(skill_root / ".env")
        parser = build_parser()
        args = parser.parse_args(argv)
        configure_logging(args.verbose)
        validate_args(args)
        if args.command == "self-test":
            run_self_test()
        elif args.command == "logs":
            run_logs(args)
        elif args.command == "load":
            run_load(args, include_logs=False)
        elif args.command == "both":
            run_load(args, include_logs=True)
        else:  # pragma: no cover - argparse 已限制命令集合
            raise DiagnosticError(f"未知命令：{args.command}")
        return 0
    except DiagnosticError as exc:
        LOGGER.error("%s", exc)
        emit_phase("error", {"category": "diagnostic_error", "message": str(exc)})
        return 2
    except KeyboardInterrupt:
        LOGGER.warning("操作者已中断；进行中的单次 HTTP 请求可能仍由服务端继续处理")
        emit_phase("error", {"category": "interrupted"})
        return 130
    except Exception as exc:  # pragma: no cover - 顶层安全网
        LOGGER.exception("发生未预期错误")
        emit_phase(
            "error",
            {
                "category": f"unexpected_{type(exc).__name__.lower()}",
                "message": "请使用 --verbose 查看本地堆栈；报告中未输出业务响应",
            },
        )
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
