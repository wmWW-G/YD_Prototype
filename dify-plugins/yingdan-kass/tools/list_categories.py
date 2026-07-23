"""列出客户分层 Tool。"""

from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from lib.tool_helpers import invoke_json_tool


class ListCategoriesTool(Tool):
    """让 Agent 只读查询固定账号的客户分层。"""

    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        """执行客户分层查询；无参数，也不会产生线上写入。"""

        yield from invoke_json_tool(self, "category.list", lambda client: client.list_categories())
