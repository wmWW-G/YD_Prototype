"""KASS 原型 CRM 固定 HTTP 客户端与字段白名单。"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Mapping

import requests


logger = logging.getLogger(__name__)

API_URL = "https://yd-prototype-dify-proxy.vercel.app/api/kass-crm"
DEFAULT_TIMEOUT = (5, 25)
SCOPED_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{3,80}$")

CUSTOMER_FIELDS = {
    "name",
    "country",
    "level",
    "stage",
    "intent",
    "product",
    "quantity",
    "trade_term",
    "customization",
    "inquiry",
    "summary",
    "next_action",
    "website",
    "contact",
}

PROFILE_FIELDS = {
    "overview",
    "company_background",
    "main_business",
    "entered_at",
    "founded_year",
    "company_size",
    "company_type",
    "organization",
    "purchasing_role",
    "market_channels",
    "contact_name",
    "contact_role",
    "social_media",
    "contact_email",
    "whatsapp",
    "annual_revenue",
    "cooperation_stage",
    "purchase_cycle",
    "purchase_potential",
    "product_preference",
    "purchase_preference",
    "expandable_products",
    "payment_terms",
    "final_consignee",
    "credit_status",
    "cooperation_value",
    "competitors",
    "competitive_advantage",
    "current_suppliers",
    "sources",
    "updated_at",
    "incomplete_items",
}

FOLLOWUP_FIELD_MAP = {
    "date": "date",
    "day_label": "dayLabel",
    "time": "time",
    "owner": "owner",
    "channel": "channel",
    "title": "title",
    "summary": "summary",
    "tasks": "tasks",
}

TASK_FIELD_MAP = {
    "id": "id",
    "title": "title",
    "due_date": "dueDate",
    "status": "status",
}


@dataclass(frozen=True)
class KassPrototypeCrmError(Exception):
    """可安全返回给 Agent 的原型 API 错误。

    属性:
        user_message: 不含内部凭证或调用栈的中文错误说明。
        safe_code: 供日志和 Agent 判断的稳定错误码。
        status_code: 可选 HTTP 状态码。
    """

    user_message: str
    safe_code: str = "kass_prototype_crm_error"
    status_code: int | None = None

    def __str__(self) -> str:
        """返回安全错误文案。"""

        return self.user_message


def require_scoped_id(value: Any, field_name: str, min_length: int = 3) -> str:
    """校验工作区、客户和跟进记录引用。

    参数:
        value: Agent 提供的原始 ID。
        field_name: 用于错误提示的字段名称。
        min_length: 允许的最小长度；工作区 ID 使用更严格的 16。

    返回值:
        符合原型网关规则的 ID。

    异常:
        KassPrototypeCrmError: ID 为空、过短或包含非法字符。
    """

    text = str(value or "").strip()
    if len(text) < min_length or not SCOPED_ID_PATTERN.fullmatch(text):
        raise KassPrototypeCrmError(
            f"{field_name} 格式无效。",
            safe_code="invalid_parameter",
        )
    return text


def require_mapping(value: Any, field_name: str, *, allow_empty: bool = False) -> dict[str, Any]:
    """把 Agent 对象参数转换为普通字典。

    参数:
        value: Dify Tool 传入的对象。
        field_name: 用于错误提示的参数名。
        allow_empty: 是否接受空对象。

    返回值:
        一份新的普通字典。

    异常:
        KassPrototypeCrmError: 输入不是对象，或不允许空对象时为空。
    """

    if not isinstance(value, Mapping):
        raise KassPrototypeCrmError(
            f"{field_name} 必须是对象。",
            safe_code="invalid_parameter",
        )
    result = dict(value)
    if not allow_empty and not result:
        raise KassPrototypeCrmError(
            f"{field_name} 至少需要一个字段。",
            safe_code="invalid_parameter",
        )
    return result


def keep_allowed_fields(
    value: Any,
    allowed_fields: set[str],
    field_name: str,
    *,
    allow_empty: bool = False,
) -> dict[str, Any]:
    """拒绝白名单外字段并复制允许字段。

    参数:
        value: Agent 传入的对象。
        allowed_fields: 当前业务动作允许的字段集合。
        field_name: 参数名。
        allow_empty: 是否允许空对象。

    返回值:
        仅包含允许字段的字典。

    异常:
        KassPrototypeCrmError: 对象为空、类型错误或包含未知字段。
    """

    data = require_mapping(value, field_name, allow_empty=allow_empty)
    unknown = sorted(set(data) - allowed_fields)
    if unknown:
        raise KassPrototypeCrmError(
            f"{field_name} 包含不支持的字段：{', '.join(unknown)}。",
            safe_code="unsupported_field",
        )
    return data


def normalize_tasks(value: Any) -> list[dict[str, Any]]:
    """把 snake_case 任务字段转换为原型 API 使用的 camelCase。

    参数:
        value: 跟进记录中的任务数组。

    返回值:
        可直接提交给原型 API 的任务数组。

    异常:
        KassPrototypeCrmError: 任务不是数组、数量过多或字段不在白名单。
    """

    if value is None:
        return []
    if not isinstance(value, list) or len(value) > 20:
        raise KassPrototypeCrmError(
            "tasks 必须是不超过 20 项的数组。",
            safe_code="invalid_parameter",
        )

    tasks: list[dict[str, Any]] = []
    for index, item in enumerate(value):
        task = keep_allowed_fields(
            item,
            set(TASK_FIELD_MAP),
            f"tasks[{index}]",
        )
        mapped = {
            TASK_FIELD_MAP[field]: field_value
            for field, field_value in task.items()
            if field_value is not None
        }
        tasks.append(mapped)
    return tasks


def normalize_followup(value: Any, field_name: str) -> dict[str, Any]:
    """转换跟进记录字段并保留完整任务数组。

    参数:
        value: record 或 changes 对象。
        field_name: 用于错误提示的参数名。

    返回值:
        原型 API 可接受的跟进记录对象。

    异常:
        KassPrototypeCrmError: 结构、字段或任务不合法。
    """

    record = keep_allowed_fields(value, set(FOLLOWUP_FIELD_MAP), field_name)
    mapped = {
        FOLLOWUP_FIELD_MAP[field]: field_value
        for field, field_value in record.items()
        if field != "tasks" and field_value is not None
    }
    if "tasks" in record:
        mapped["tasks"] = normalize_tasks(record["tasks"])
    return mapped


class KassPrototypeCrmClient:
    """调用固定 KASS 原型 API 的无凭证客户端。"""

    def __init__(self, timeout: tuple[int, int] = DEFAULT_TIMEOUT) -> None:
        """初始化固定客户端。

        参数:
            timeout: requests 使用的连接与读取超时秒数。

        返回值:
            无。

        异常:
            本函数不主动抛异常。
        """

        self.timeout = timeout

    def request(
        self,
        method: str,
        *,
        params: Mapping[str, Any] | None = None,
        json_body: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        """向固定原型 API 发起请求并验证统一响应。

        参数:
            method: 只允许 GET 或 POST。
            params: GET 查询参数。
            json_body: POST JSON 请求体。

        返回值:
            原型 API 的完整成功响应，包含 ok、mode、action 和 data。

        异常:
            KassPrototypeCrmError: 方法、网络、HTTP、JSON 或业务响应异常。
        """

        normalized_method = str(method or "").upper()
        if normalized_method not in {"GET", "POST"}:
            raise KassPrototypeCrmError(
                "插件内部只允许 GET 和 POST。",
                safe_code="invalid_method",
            )

        logger.info("KASS prototype CRM request started: %s", normalized_method)
        try:
            response = requests.request(
                method=normalized_method,
                url=API_URL,
                headers={"Content-Type": "application/json"},
                params=dict(params or {}),
                json=dict(json_body) if json_body is not None else None,
                timeout=self.timeout,
            )
        except requests.Timeout as exc:
            raise KassPrototypeCrmError(
                "KASS 原型接口请求超时，请稍后重试。",
                safe_code="timeout",
            ) from exc
        except requests.RequestException as exc:
            raise KassPrototypeCrmError(
                "无法连接 KASS 原型接口，请检查插件网络。",
                safe_code="network_error",
            ) from exc

        try:
            payload = response.json()
        except ValueError as exc:
            raise KassPrototypeCrmError(
                "KASS 原型接口返回了无法解析的数据。",
                safe_code="invalid_response",
                status_code=response.status_code,
            ) from exc

        if not response.ok or not isinstance(payload, Mapping) or payload.get("ok") is not True:
            safe_message = payload.get("message") if isinstance(payload, Mapping) else None
            safe_code = payload.get("code") if isinstance(payload, Mapping) else None
            raise KassPrototypeCrmError(
                str(safe_message or f"KASS 原型接口返回 HTTP {response.status_code}。"),
                safe_code=str(safe_code or "api_error"),
                status_code=response.status_code,
            )

        logger.info(
            "KASS prototype CRM request completed: %s",
            payload.get("action", "unknown"),
        )
        return dict(payload)

    def get_context(self, workspace_id: Any, customer_ref: Any) -> dict[str, Any]:
        """查询当前原型客户完整上下文。"""

        return self.request(
            "GET",
            params={
                "action": "context",
                "workspace_id": require_scoped_id(workspace_id, "workspace_id", 16),
                "customer_ref": require_scoped_id(customer_ref, "customer_ref"),
            },
        )

    def update_customer(
        self,
        workspace_id: Any,
        customer_ref: Any,
        changes: Any,
        profile_changes: Any,
    ) -> dict[str, Any]:
        """更新客户顶层资料和背调档案。"""

        safe_changes = keep_allowed_fields(
            changes or {},
            CUSTOMER_FIELDS,
            "changes",
            allow_empty=True,
        )
        safe_profile_changes = keep_allowed_fields(
            profile_changes or {},
            PROFILE_FIELDS,
            "profile_changes",
            allow_empty=True,
        )
        if not safe_changes and not safe_profile_changes:
            raise KassPrototypeCrmError(
                "changes 和 profile_changes 至少需要一个字段。",
                safe_code="invalid_parameter",
            )
        return self.request(
            "POST",
            json_body={
                "action": "update_customer",
                "workspace_id": require_scoped_id(workspace_id, "workspace_id", 16),
                "customer_ref": require_scoped_id(customer_ref, "customer_ref"),
                "changes": safe_changes,
                "profile_changes": safe_profile_changes,
            },
        )

    def create_followup(
        self,
        workspace_id: Any,
        customer_ref: Any,
        record: Any,
    ) -> dict[str, Any]:
        """创建一条原型跟进记录。"""

        return self.request(
            "POST",
            json_body={
                "action": "create_followup",
                "workspace_id": require_scoped_id(workspace_id, "workspace_id", 16),
                "customer_ref": require_scoped_id(customer_ref, "customer_ref"),
                "record": normalize_followup(record, "record"),
            },
        )

    def update_followup(
        self,
        workspace_id: Any,
        customer_ref: Any,
        followup_id: Any,
        changes: Any,
    ) -> dict[str, Any]:
        """更新一条原型跟进记录及其任务。"""

        return self.request(
            "POST",
            json_body={
                "action": "update_followup",
                "workspace_id": require_scoped_id(workspace_id, "workspace_id", 16),
                "customer_ref": require_scoped_id(customer_ref, "customer_ref"),
                "followup_id": require_scoped_id(followup_id, "followup_id"),
                "changes": normalize_followup(changes, "changes"),
            },
        )

    def delete_followup(
        self,
        workspace_id: Any,
        customer_ref: Any,
        followup_id: Any,
    ) -> dict[str, Any]:
        """删除用户明确确认的原型跟进记录。"""

        return self.request(
            "POST",
            json_body={
                "action": "delete_followup",
                "workspace_id": require_scoped_id(workspace_id, "workspace_id", 16),
                "customer_ref": require_scoped_id(customer_ref, "customer_ref"),
                "followup_id": require_scoped_id(followup_id, "followup_id"),
            },
        )
