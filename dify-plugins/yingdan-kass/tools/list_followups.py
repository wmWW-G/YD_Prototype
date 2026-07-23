"""列出客户跟进记录 Tool。"""

from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from lib.tool_helpers import invoke_json_tool


class ListFollowupsTool(Tool):
    """让 Agent 分页读取指定客户的跟进记录。"""

    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        """按客户、页码、页大小和可选日期查询跟进记录。"""

        yield from invoke_json_tool(
            self,
            "followup.list",
            lambda client: client.list_followups(
                tool_parameters.get("customer_id"),
                tool_parameters.get("page_num") or 1,
                tool_parameters.get("page_size") or 20,
                tool_parameters.get("record_date") or "",
            ),
        )
