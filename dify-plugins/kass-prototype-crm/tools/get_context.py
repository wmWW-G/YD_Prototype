"""查询 KASS 原型客户上下文 Tool。"""

from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from lib.tool_helpers import invoke_json_tool


class GetContextTool(Tool):
    """读取当前工作区中的客户资料、背调档案和跟进记录。"""

    def _invoke(
        self,
        tool_parameters: dict[str, Any],
    ) -> Generator[ToolInvokeMessage, None, None]:
        """按工作区与客户引用读取完整上下文。"""

        yield from invoke_json_tool(
            self,
            "context",
            lambda client: client.get_context(
                tool_parameters.get("workspace_id"),
                tool_parameters.get("customer_ref"),
            ),
        )
