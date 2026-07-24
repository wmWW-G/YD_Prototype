"""Dify Tool 的统一调用、日志和安全错误返回。"""

from __future__ import annotations

import logging
from collections.abc import Callable, Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.config.logger_format import plugin_logger_handler
from dify_plugin.entities.tool import ToolInvokeMessage

from lib.client import KassPrototypeCrmClient, KassPrototypeCrmError


logger = logging.getLogger("kass_prototype_crm.tools")
logger.setLevel(logging.INFO)
if plugin_logger_handler not in logger.handlers:
    logger.addHandler(plugin_logger_handler)


def invoke_json_tool(
    tool: Tool,
    action: str,
    operation: Callable[[KassPrototypeCrmClient], dict[str, Any]],
) -> Generator[ToolInvokeMessage, None, None]:
    """执行一个原型 Tool 并返回稳定 JSON。

    参数:
        tool: 当前 Dify Tool 实例，用于创建 JSON 消息。
        action: 日志和失败响应使用的稳定动作名。
        operation: 接收固定客户端并返回原型 API 成功响应的函数。

    返回值:
        生成一个 Tool JSON 消息。成功响应保留 API 的 ok/action/data；
        失败响应包含 ok=false、error 和安全 message。

    异常:
        已知和未知异常都在函数内转换，不把调用栈或底层响应返回给模型。
    """

    logger.info("KASS prototype CRM tool started: %s", action)
    try:
        result = operation(KassPrototypeCrmClient())
        logger.info("KASS prototype CRM tool completed: %s", action)
        yield tool.create_json_message(result)
    except KassPrototypeCrmError as exc:
        logger.warning(
            "KASS prototype CRM tool failed: %s %s",
            action,
            exc.safe_code,
        )
        yield tool.create_json_message(
            {
                "ok": False,
                "action": action,
                "error": exc.safe_code,
                "message": exc.user_message,
            }
        )
    except Exception as exc:
        logger.exception(
            "KASS prototype CRM tool failed unexpectedly: %s %s",
            action,
            type(exc).__name__,
        )
        yield tool.create_json_message(
            {
                "ok": False,
                "action": action,
                "error": "internal_error",
                "message": "KASS 原型插件执行失败，请检查 Dify 插件日志。",
            }
        )
