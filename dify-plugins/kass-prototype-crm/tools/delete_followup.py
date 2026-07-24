"""删除 KASS 原型跟进记录 Tool。"""

from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from lib.tool_helpers import invoke_json_tool


class DeleteFollowupTool(Tool):
    """只删除用户在当前对话中明确确认的原型跟进记录。"""

    def _invoke(
        self,
        tool_parameters: dict[str, Any],
    ) -> Generator[ToolInvokeMessage, None, None]:
        """按 followup_id 删除指定记录。"""

        yield from invoke_json_tool(
            self,
            "delete_followup",
            lambda client: client.delete_followup(
                tool_parameters.get("workspace_id"),
                tool_parameters.get("customer_ref"),
                tool_parameters.get("followup_id"),
            ),
        )
