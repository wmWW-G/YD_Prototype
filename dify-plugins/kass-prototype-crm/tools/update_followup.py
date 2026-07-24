"""修改 KASS 原型跟进记录 Tool。"""

from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from lib.tool_helpers import invoke_json_tool


class UpdateFollowupTool(Tool):
    """修改指定跟进记录，也可用完整 tasks 数组更新任务状态。"""

    def _invoke(
        self,
        tool_parameters: dict[str, Any],
    ) -> Generator[ToolInvokeMessage, None, None]:
        """按 followup_id 更新跟进字段和关联任务。"""

        yield from invoke_json_tool(
            self,
            "update_followup",
            lambda client: client.update_followup(
                tool_parameters.get("workspace_id"),
                tool_parameters.get("customer_ref"),
                tool_parameters.get("followup_id"),
                tool_parameters.get("changes"),
            ),
        )
