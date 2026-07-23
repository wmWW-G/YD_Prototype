"""更新客户跟进记录 Tool。"""

from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from lib.tool_helpers import invoke_json_tool


class UpdateFollowupTool(Tool):
    """读取并合并现有跟进字段后更新，避免覆盖丢失。"""

    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        """按 followup_id 和 customer_id 合并 changes 并更新记录。"""

        yield from invoke_json_tool(
            self,
            "followup.update",
            lambda client: client.update_followup(
                tool_parameters.get("followup_id"),
                tool_parameters.get("customer_id"),
                tool_parameters.get("changes"),
            ),
        )
