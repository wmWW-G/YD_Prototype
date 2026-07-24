"""新增 KASS 原型跟进记录 Tool。"""

from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from lib.tool_helpers import invoke_json_tool


class CreateFollowupTool(Tool):
    """保存已经发生并由用户确认的原型跟进事实。"""

    def _invoke(
        self,
        tool_parameters: dict[str, Any],
    ) -> Generator[ToolInvokeMessage, None, None]:
        """创建一条跟进记录，可同时保存关联任务。"""

        yield from invoke_json_tool(
            self,
            "create_followup",
            lambda client: client.create_followup(
                tool_parameters.get("workspace_id"),
                tool_parameters.get("customer_ref"),
                tool_parameters.get("record"),
            ),
        )
