#!/usr/bin/env python3
"""只读查询并脱敏分析 Dify Console 运行日志。

脚本只使用 Python 标准库，保留参数构造、分页、分类、脱敏和离线自测
能力；命令行只提供 ``self-test``，不读取凭据，也不发送网络请求。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
from datetime import datetime
from pathlib import Path
from typing import Any, Mapping, Protocol, Sequence
from zoneinfo import ZoneInfo


SHANGHAI = ZoneInfo("Asia/Shanghai")


class QueryError(RuntimeError):
    """表示可以安全展示且不包含凭据或业务内容的查询错误。"""


class ReadOnlyJsonClient(Protocol):
    """离线查询逻辑所需的最小 JSON 客户端合同。

    实际线上请求由 Chrome 中的 Dify 页面发起。本协议只让纯查询逻辑可用
    假客户端做离线测试，不提供 Cookie、CSRF、HTTP 或网络实现。
    """

    def get(self, path: str, params: Mapping[str, Any] | None = None) -> Any:
        """返回预先提供的 JSON 响应。

        Args:
            path: Console API 相对路径，用于断言查询路由。
            params: 可选查询参数，用于断言筛选条件。

        Returns:
            调用方提供的 JSON 兼容值。

        Raises:
            具体实现可在缺少预设响应时抛出断言异常。
        """

        ...


def classify_error(value: Any) -> str:
    """把原始错误文本归类，避免在报告中泄露原文。

    Args:
        value: Dify run 或节点中的原始错误值。

    Returns:
        稳定的中文错误类别。

    Raises:
        不主动抛出异常。
    """

    text = str(value or "").lower()
    rules = (
        (("402", "insufficient", "balance", "quota exceeded"), "余额或计费边界"),
        (("429", "rate limit", "too many requests"), "限流"),
        (("503", "service unavailable"), "上游服务暂不可用"),
        (("plugin daemon",), "Plugin Daemon 异常"),
        (("502", "bad gateway", "serverless"), "网关或 serverless 上游异常"),
        (("413", "request too large", "payload too large"), "请求载荷过大"),
        (("timeout", "timed out"), "请求超时"),
        (("connection closed", "connection reset", "broken pipe"), "连接中断"),
        (("incomplete chunked read",), "响应分块读取不完整"),
        (("invalid json", "llmresultchunk"), "响应解析或模型流格式异常"),
    )
    for needles, category in rules:
        if any(needle in text for needle in needles):
            return category
    return "失败边界已确认，具体错误为空" if not text.strip() else "未分类运行错误"


def extract_items(payload: Any) -> list[dict[str, Any]]:
    """从 Dify 常见响应结构中提取记录列表。

    Args:
        payload: Console JSON 响应。

    Returns:
        仅包含字典记录的列表。

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


def has_more(payload: Any, item_count: int, limit: int) -> bool:
    """判断分页响应是否仍有下一页。

    Args:
        payload: 当前页 JSON。
        item_count: 当前页记录数。
        limit: 请求页大小。

    Returns:
        明确字段优先，否则以是否满页保守判断。

    Raises:
        不主动抛出异常。
    """

    if isinstance(payload, dict):
        for container in (payload, payload.get("data")):
            if not isinstance(container, dict):
                continue
            for key in ("has_more", "hasMore"):
                if key in container:
                    return bool(container[key])
    return item_count >= limit


def first_string(payload: Mapping[str, Any], paths: Sequence[str]) -> str | None:
    """按候选点路径读取第一个非空字符串。

    Args:
        payload: 要读取的字典。
        paths: 点分隔的候选路径。

    Returns:
        第一个非空值转成的字符串，找不到时返回 ``None``。

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


def parse_datetime(value: Any) -> datetime | None:
    """把 epoch 或 ISO 时间转换成上海时区时间。

    Args:
        value: 秒/毫秒 epoch、数字字符串或 ISO 字符串。

    Returns:
        带时区的 datetime；无法解析时返回 ``None``。

    Raises:
        不向调用方传播格式异常。
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
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=SHANGHAI)
    return parsed.astimezone(SHANGHAI)


def cli_datetime(value: str | None, fallback: datetime) -> datetime:
    """解析命令行时间或使用默认时间。

    Args:
        value: 可选 ISO 时间字符串。
        fallback: 未提供时使用的默认时间。

    Returns:
        上海时区时间。

    Raises:
        QueryError: 显式时间无法解析时抛出。
    """

    if not value:
        return fallback.astimezone(SHANGHAI)
    parsed = parse_datetime(value)
    if parsed is None:
        raise QueryError(f"无法解析时间 {value!r}；请使用 ISO 格式并建议带 +08:00")
    return parsed


def safe_time(value: Any) -> str | None:
    """把可能的 Dify 时间字段转成 ISO 字符串。

    Args:
        value: 原始时间值。

    Returns:
        上海时区 ISO 字符串；无法解析时返回 ``None``。

    Raises:
        不主动抛出异常。
    """

    parsed = parse_datetime(value)
    return parsed.isoformat() if parsed else None


def in_window(item: Mapping[str, Any], start: datetime, end: datetime) -> bool:
    """判断记录创建时间是否位于指定窗口。

    Args:
        item: Dify 记录。
        start: 查询起点。
        end: 查询终点。

    Returns:
        时间缺失时保守返回 ``True``，否则返回区间判断结果。

    Raises:
        不主动抛出异常。
    """

    created = parse_datetime(item.get("created_at"))
    return True if created is None else start <= created <= end


def page_is_strictly_before_window(
    items: Sequence[Mapping[str, Any]], start: datetime
) -> bool:
    """判断一个倒序分页是否已经完整越过查询起点。

    Dify 的失败运行列表按 ``created_at`` 倒序返回。只有当本页非空且每条
    记录的时间都能解析、并且都早于查询起点时，后续页面才可以安全跳过。
    任何缺失或无法解析的时间都会让函数返回 ``False``，避免过早停止查询。

    Args:
        items: 当前失败运行分页中的记录。
        start: 用户指定的查询起点。

    Returns:
        本页能够证明后续页面均早于查询窗口时返回 ``True``。

    Raises:
        不主动抛出异常。
    """

    if not items:
        return False
    created_times = [parse_datetime(item.get("created_at")) for item in items]
    return all(created is not None and created < start for created in created_times)


def app_path(app_id: str, suffix: str) -> str:
    """构造经过 URL 转义的应用级 Console API 路径。

    Args:
        app_id: Dify App UUID。
        suffix: 应用路径后的接口片段。

    Returns:
        安全的相对 API 路径。

    Raises:
        QueryError: App ID 为空时抛出。
    """

    if not app_id.strip():
        raise QueryError("缺少 DIFY_APP_ID；请从目标应用可见 URL 复制 App UUID")
    return f"/apps/{urllib.parse.quote(app_id.strip(), safe='')}/{suffix.lstrip('/')}"


def fetch_conversations(
    client: ReadOnlyJsonClient,
    app_id: str,
    user: str,
    start: datetime,
    end: datetime,
    max_pages: int,
) -> tuple[list[dict[str, Any]], int, bool]:
    """分页读取并筛选指定终端用户的会话。

    Args:
        client: Console 客户端。
        app_id: Dify App UUID。
        user: ``from_end_user_session_id``。
        start: 查询起点。
        end: 查询终点。
        max_pages: 最大分页数。

    Returns:
        ``(匹配会话, 已读页数, 是否可能截断)``。

    Raises:
        QueryError: Console 请求失败时抛出。
    """

    matched: list[dict[str, Any]] = []
    limit = 100
    pages = 0
    truncated = False
    for page in range(1, max_pages + 1):
        payload = client.get(
            app_path(app_id, "chat-conversations"),
            {
                # Dify 服务端会把 keyword 用于模糊匹配 EndUser.session_id。
                # 这一步只负责缩小候选集，下面仍会做严格相等过滤，避免
                # 用户 129155 错误命中 1291550 一类相似 session ID。
                "keyword": user,
                "page": page,
                "limit": limit,
                "start": start.strftime("%Y-%m-%d %H:%M"),
                "end": end.strftime("%Y-%m-%d %H:%M"),
                "sort_by": "-created_at",
                "annotation_status": "all",
            },
        )
        pages += 1
        items = extract_items(payload)
        matched.extend(
            item
            for item in items
            if str(item.get("from_end_user_session_id")) == str(user)
            and in_window(item, start, end)
        )
        more = has_more(payload, len(items), limit)
        if not more:
            break
        if page == max_pages:
            truncated = True
    return matched, pages, truncated


def walk_dicts(value: Any) -> list[Mapping[str, Any]]:
    """递归收集嵌套 JSON 中的字典，供兼容字段查找使用。

    Args:
        value: 任意 JSON 值。

    Returns:
        所有嵌套字典的扁平列表。

    Raises:
        不主动抛出异常。
    """

    found: list[Mapping[str, Any]] = []
    if isinstance(value, dict):
        found.append(value)
        for child in value.values():
            found.extend(walk_dicts(child))
    elif isinstance(value, list):
        for child in value:
            found.extend(walk_dicts(child))
    return found


def contains_marker(value: Any, marker_prefix: str) -> bool:
    """仅在内存中判断嵌套 JSON 是否包含 marker 前缀。

    Args:
        value: 消息 JSON。
        marker_prefix: 唯一诊断标记前缀。

    Returns:
        任意字符串包含前缀时返回 ``True``。

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


def workflow_run_id(message: Mapping[str, Any]) -> str | None:
    """从不同 Dify 版本的消息结构中提取 workflow run ID。

    Args:
        message: 单条会话消息。

    Returns:
        workflow run ID；找不到时返回 ``None``。

    Raises:
        不主动抛出异常。
    """

    direct = first_string(
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
    for item in walk_dicts(message):
        for key in ("workflow_run_id", "workflowRunId"):
            if item.get(key) not in (None, ""):
                return str(item[key])
    return None


def fetch_run_detail(
    client: ReadOnlyJsonClient, app_id: str, run_id: str
) -> dict[str, Any]:
    """读取单个 workflow run 详情。

    Args:
        client: Console 客户端。
        app_id: Dify App UUID。
        run_id: workflow run ID。

    Returns:
        仅在内存中使用的 run 详情字典。

    Raises:
        QueryError: 响应不是 JSON 对象时抛出。
    """

    payload = client.get(app_path(app_id, f"workflow-runs/{urllib.parse.quote(run_id, safe='')}"))
    if not isinstance(payload, dict):
        raise QueryError("workflow run 详情不是 JSON 对象")
    return payload["data"] if isinstance(payload.get("data"), dict) else payload


def fetch_failed_nodes(
    client: ReadOnlyJsonClient, app_id: str, run_id: str
) -> list[dict[str, Any]]:
    """读取失败节点并立即按字段白名单脱敏。

    Args:
        client: Console 客户端。
        app_id: Dify App UUID。
        run_id: workflow run ID。

    Returns:
        不含原始输入、输出和错误文本的失败节点列表。

    Raises:
        QueryError: Console 请求失败时抛出。
    """

    payload = client.get(
        app_path(
            app_id,
            f"workflow-runs/{urllib.parse.quote(run_id, safe='')}/node-executions",
        )
    )
    safe_nodes: list[dict[str, Any]] = []
    for node in extract_items(payload):
        status = str(node.get("status") or "")
        raw_error = node.get("error")
        if status.lower() not in {"failed", "error"} and not raw_error:
            continue
        safe_nodes.append(
            {
                "id": first_string(node, ("id",)),
                "node_id": first_string(node, ("node_id", "nodeId")),
                "title": first_string(node, ("title", "node_title")),
                "node_type": first_string(node, ("node_type", "nodeType")),
                "status": status or None,
                "elapsed_time": node.get("elapsed_time"),
                "created_at": safe_time(node.get("created_at")),
                "finished_at": safe_time(node.get("finished_at")),
                "retry_index": node.get("retry_index"),
                "error_category": classify_error(raw_error),
            }
        )
    return safe_nodes


def safe_run(run: Mapping[str, Any], nodes: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """把 run 详情转换成脱敏字段白名单。

    Args:
        run: 原始 run 详情，仅在内存中存在。
        nodes: 已脱敏失败节点。

    Returns:
        可安全写入报告的 run 摘要。

    Raises:
        不主动抛出异常。
    """

    status = str(run.get("status") or "")
    raw_error = run.get("error")
    return {
        "id": first_string(run, ("id", "workflow_run_id")),
        "conversation_id": first_string(run, ("conversation_id", "conversation.id")),
        "status": status or None,
        "triggered_from": run.get("triggered_from"),
        "created_at": safe_time(run.get("created_at")),
        "finished_at": safe_time(run.get("finished_at")),
        "elapsed_time": run.get("elapsed_time"),
        "total_steps": run.get("total_steps"),
        "total_tokens": run.get("total_tokens"),
        "error_category": (
            classify_error(raw_error)
            if raw_error or status.lower() in {"failed", "error"}
            else None
        ),
        "failed_nodes": list(nodes),
    }


def load_safe_run(
    client: ReadOnlyJsonClient, app_id: str, run_id: str
) -> dict[str, Any]:
    """读取一个 run 的详情和失败节点，并返回脱敏摘要。

    Args:
        client: Console 客户端。
        app_id: Dify App UUID。
        run_id: workflow run ID。

    Returns:
        脱敏 run 摘要。

    Raises:
        QueryError: 任一只读请求失败时抛出。
    """

    detail = fetch_run_detail(client, app_id, run_id)
    nodes = fetch_failed_nodes(client, app_id, run_id)
    return safe_run(detail, nodes)


def query_failed(
    client: ReadOnlyJsonClient,
    app_id: str,
    user: str | None,
    start: datetime,
    end: datetime,
    max_pages: int,
) -> dict[str, Any]:
    """查询 Advanced Chat 失败运行并定位失败节点。

    Args:
        client: Console 客户端。
        app_id: Dify App UUID。
        user: 可选终端用户 ID；为空时查询整个应用。
        start: 查询起点。
        end: 查询终点。
        max_pages: 最大分页数。

    Returns:
        含覆盖率和脱敏 runs 的报告主体。

    Raises:
        QueryError: Console 请求失败时抛出。
    """

    conversations: list[dict[str, Any]] = []
    conversation_pages = 0
    conversation_truncated = False
    allowed_conversation_ids: set[str] | None = None
    if user is not None:
        conversations, conversation_pages, conversation_truncated = fetch_conversations(
            client, app_id, user, start, end, max_pages
        )
        allowed_conversation_ids = {
            value
            for item in conversations
            if (value := first_string(item, ("id", "conversation_id")))
        }

    records: list[dict[str, Any]] = []
    limit = 100
    last_id: str | None = None
    run_pages = 0
    run_truncated = False
    run_window_complete = False
    for page in range(1, max_pages + 1):
        params: dict[str, Any] = {
            "triggered_from": "app-run",
            "status": "failed",
            "limit": limit,
        }
        if last_id:
            params["last_id"] = last_id
        payload = client.get(app_path(app_id, "advanced-chat/workflow-runs"), params)
        run_pages += 1
        items = extract_items(payload)
        for item in items:
            conversation = first_string(item, ("conversation_id", "conversation.id"))
            if in_window(item, start, end) and (
                allowed_conversation_ids is None or conversation in allowed_conversation_ids
            ):
                records.append(item)
        more = has_more(payload, len(items), limit)

        # 官方仓储层按 created_at 倒序分页。整页都早于查询起点后，后续页
        # 只会更早，可以结束查询且仍然声明时间窗口覆盖完整。
        if page_is_strictly_before_window(items, start):
            run_window_complete = True
            break
        if not more or not items:
            run_window_complete = True
            break
        next_last_id = first_string(items[-1], ("id", "workflow_run_id"))
        if not next_last_id or next_last_id == last_id:
            # 接口表示仍有后续页但游标缺失或没有前进时，不能把当前结果
            # 宣称为完整覆盖；保守标记截断，并停止可能的死循环。
            run_truncated = True
            break
        last_id = next_last_id
        if page == max_pages:
            run_truncated = True

    run_ids = sorted(
        {
            value
            for item in records
            if (value := first_string(item, ("id", "workflow_run_id")))
        }
    )
    runs = [load_safe_run(client, app_id, run_id) for run_id in run_ids]
    runs.sort(key=lambda item: str(item.get("created_at") or item.get("id") or ""))
    return {
        "queried_status": "failed",
        "candidate_conversations": len(conversations) if user is not None else None,
        "conversation_pages": conversation_pages,
        "conversation_pages_truncated": conversation_truncated,
        "failed_run_pages": run_pages,
        "failed_run_pages_truncated": run_truncated,
        "failed_run_window_complete": run_window_complete,
        "failed_list_records": len(records),
        "matched_runs": len(runs),
        "runs": runs,
    }


def query_marker(
    client: ReadOnlyJsonClient,
    app_id: str,
    user: str,
    marker_prefix: str,
    start: datetime,
    end: datetime,
    max_pages: int,
) -> dict[str, Any]:
    """按终端用户与 marker 精确关联 workflow run。

    Args:
        client: Console 客户端。
        app_id: Dify App UUID。
        user: 终端用户 ID。
        marker_prefix: 唯一 marker 前缀。
        start: 查询起点。
        end: 查询终点。
        max_pages: 会话最大分页数。

    Returns:
        含覆盖率和脱敏 runs 的报告主体。

    Raises:
        QueryError: Console 请求失败或 marker 为空时抛出。
    """

    if not marker_prefix.strip():
        raise QueryError("marker-prefix 不能为空")
    conversations, pages, truncated = fetch_conversations(
        client, app_id, user, start, end, max_pages
    )
    matched_messages = 0
    missing_run_ids = 0
    run_ids: set[str] = set()
    for conversation in conversations:
        conversation_id = first_string(conversation, ("id", "conversation_id"))
        if not conversation_id:
            continue
        payload = client.get(
            app_path(app_id, "chat-messages"),
            {"conversation_id": conversation_id, "limit": 100},
        )
        for message in extract_items(payload):
            if not contains_marker(message, marker_prefix):
                continue
            matched_messages += 1
            run_id = workflow_run_id(message)
            if run_id:
                run_ids.add(run_id)
            else:
                missing_run_ids += 1
    runs = [load_safe_run(client, app_id, run_id) for run_id in sorted(run_ids)]
    runs.sort(key=lambda item: str(item.get("created_at") or item.get("id") or ""))
    return {
        "candidate_conversations": len(conversations),
        "conversation_pages": pages,
        "conversation_pages_truncated": truncated,
        "matched_messages": matched_messages,
        "messages_without_workflow_run_id": missing_run_ids,
        "matched_runs": len(runs),
        "runs": runs,
    }


def build_report(
    mode: str,
    app_id: str,
    user: str | None,
    start: datetime,
    end: datetime,
    summary: Mapping[str, Any],
) -> dict[str, Any]:
    """组装最终报告并明确查询边界。

    Args:
        mode: ``failed`` 或 ``marker``。
        app_id: Dify App UUID。
        user: 可选终端用户 ID。
        start: 查询起点。
        end: 查询终点。
        summary: 查询得到的脱敏摘要。

    Returns:
        可序列化为 JSON 的完整报告。

    Raises:
        不主动抛出异常。
    """

    return {
        "tool": "dify-log-query-analysis",
        "read_only": True,
        "mode": mode,
        "app_id": app_id,
        "user": user,
        "window": {
            "start": start.isoformat(),
            "end": end.isoformat(),
            "timezone": "Asia/Shanghai",
        },
        "coverage_note": (
            "零匹配仅表示本应用、时间窗、筛选条件和分页覆盖内未匹配，"
            "不能扩大为线上没有失败。"
        ),
        "summary": dict(summary),
    }


def write_report(report: Mapping[str, Any], output: str | None) -> None:
    """把脱敏报告写入 stdout 或明确指定的文件。

    Args:
        report: 已脱敏报告。
        output: 可选输出路径；为空时打印到 stdout。

    Returns:
        无返回值。

    Raises:
        QueryError: 文件写入失败时抛出。
    """

    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if not output:
        print(rendered)
        return
    try:
        Path(output).expanduser().write_text(rendered + "\n", encoding="utf-8")
    except OSError as exc:
        raise QueryError(f"无法写入报告：{type(exc).__name__}") from exc


def run_self_test() -> None:
    """离线验证解析、脱敏、用户筛选和失败状态分页合同。

    Returns:
        无返回值；成功时打印固定 JSON。

    Raises:
        AssertionError: 任一核心合同失效时抛出。
    """

    assert classify_error("HTTP 402") == "余额或计费边界"
    assert classify_error("Plugin Daemon internal error") == "Plugin Daemon 异常"
    assert classify_error("") == "失败边界已确认，具体错误为空"
    parsed = parse_datetime("2026-08-14T00:00:00Z")
    assert parsed is not None and parsed.tzinfo is not None
    safe = safe_run(
        {
            "id": "run-1",
            "status": "failed",
            "error": "private raw error",
            "inputs": {"secret": "do-not-output"},
            "outputs": {"answer": "do-not-output"},
        },
        [],
    )
    rendered = json.dumps(safe, ensure_ascii=False)
    assert "private raw error" not in rendered
    assert "do-not-output" not in rendered
    assert set(safe) == {
        "id",
        "conversation_id",
        "status",
        "triggered_from",
        "created_at",
        "finished_at",
        "elapsed_time",
        "total_steps",
        "total_tokens",
        "error_category",
        "failed_nodes",
    }

    class RecordingClient:
        """记录离线请求并按顺序返回预设响应的最小假客户端。

        Args:
            responses: 每次 ``get`` 调用依次返回的 JSON 对象。

        Raises:
            AssertionError: 调用次数超过预设响应数量时抛出。
        """

        def __init__(self, responses: Sequence[Any]) -> None:
            """保存响应队列和请求记录，不执行任何网络访问。"""

            self.responses = list(responses)
            self.calls: list[tuple[str, dict[str, Any]]] = []

        def get(
            self, path: str, params: Mapping[str, Any] | None = None
        ) -> Any:
            """记录 GET 路径与参数，并返回下一条预设响应。

            Args:
                path: 只读 Console API 相对路径。
                params: 可选查询参数。

            Returns:
                下一条预设 JSON 响应。

            Raises:
                AssertionError: 没有剩余预设响应时抛出。
            """

            self.calls.append((path, dict(params or {})))
            assert self.responses, "离线假客户端收到未预期的 GET"
            return self.responses.pop(0)

    window_start = datetime(2026, 8, 19, 0, 0, tzinfo=SHANGHAI)
    window_end = datetime(2026, 8, 19, 23, 59, 59, tzinfo=SHANGHAI)
    conversation_client = RecordingClient(
        [
            {
                "data": [
                    {
                        "id": "conversation-exact",
                        "from_end_user_session_id": "129155",
                        "created_at": "2026-08-19T10:00:00+08:00",
                    },
                    {
                        "id": "conversation-fuzzy-only",
                        "from_end_user_session_id": "1291550",
                        "created_at": "2026-08-19T10:00:00+08:00",
                    },
                ],
                "has_more": False,
            }
        ]
    )
    conversations, _, _ = fetch_conversations(
        conversation_client, "app-test", "129155", window_start, window_end, 2
    )
    assert [item["id"] for item in conversations] == ["conversation-exact"]
    assert conversation_client.calls[0][1]["keyword"] == "129155"

    # 即使接口声称还有下一页，整页都早于起点时也应安全停止。这个测试还
    # 固定了 status=failed 与 triggered_from=app-run，防止未来误查全量状态。
    failed_client = RecordingClient(
        [
            {
                "data": [
                    {
                        "id": "run-old",
                        "conversation_id": "conversation-old",
                        "created_at": "2026-08-18T23:59:59+08:00",
                    }
                ],
                "has_more": True,
            }
        ]
    )
    failed_summary = query_failed(
        failed_client, "app-test", None, window_start, window_end, 20
    )
    assert len(failed_client.calls) == 1
    assert failed_client.calls[0][1]["status"] == "failed"
    assert failed_client.calls[0][1]["triggered_from"] == "app-run"
    assert failed_summary["queried_status"] == "failed"
    assert failed_summary["failed_run_window_complete"] is True
    assert failed_summary["failed_run_pages_truncated"] is False
    print(json.dumps({"self_test": "passed", "network_requests": 0}, ensure_ascii=False))


def build_parser() -> argparse.ArgumentParser:
    """构建只包含离线自测入口的命令行解析器。

    Returns:
        配置完成的参数解析器。

    Raises:
        不主动抛出异常。
    """

    parser = argparse.ArgumentParser(description="离线验证 Dify 日志查询与脱敏逻辑")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("self-test", help="执行完全离线的核心函数自测")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """执行离线自测，不提供任何联网或凭据入口。

    Args:
        argv: 可选命令参数；为空时读取 ``sys.argv``。

    Returns:
        0 表示成功，2 表示安全可展示的逻辑错误，3 表示自测或意外错误。

    Raises:
        不向顶层继续抛出异常。
    """

    try:
        args = build_parser().parse_args(argv)
        if args.command != "self-test":
            raise QueryError("脚本只允许执行离线 self-test")
        run_self_test()
        return 0
    except QueryError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2
    except AssertionError:
        print(json.dumps({"error": "offline_self_test_failed"}), file=sys.stderr)
        return 3
    except KeyboardInterrupt:
        print(json.dumps({"error": "interrupted"}), file=sys.stderr)
        return 130
    except Exception as exc:  # 顶层安全网只输出异常类型，避免泄露服务端数据。
        print(
            json.dumps({"error": f"unexpected_{type(exc).__name__.lower()}"}),
            file=sys.stderr,
        )
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
