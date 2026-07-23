"""创建客户跟进记录 Tool。"""

from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from lib.tool_helpers import invoke_json_tool


class CreateFollowupTool(Tool):
    """让 Agent 为已归属固定账号的客户创建跟进记录。"""

    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        """校验客户归属后创建 record 对象并返回 API 结果。"""

        yield from invoke_json_tool(
            self,
            "followup.create",
            lambda client: client.create_followup(
                tool_parameters.get("customer_id"),
                tool_parameters.get("record"),
            ),
        )
