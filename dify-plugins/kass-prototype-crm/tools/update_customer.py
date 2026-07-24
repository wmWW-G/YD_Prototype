"""修改 KASS 原型客户 Tool。"""

from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from lib.tool_helpers import invoke_json_tool


class UpdateCustomerTool(Tool):
    """只修改用户明确要求的客户或背调字段。"""

    def _invoke(
        self,
        tool_parameters: dict[str, Any],
    ) -> Generator[ToolInvokeMessage, None, None]:
        """提交客户顶层字段和背调字段的白名单修改。"""

        yield from invoke_json_tool(
            self,
            "update_customer",
            lambda client: client.update_customer(
                tool_parameters.get("workspace_id"),
                tool_parameters.get("customer_ref"),
                tool_parameters.get("changes"),
                tool_parameters.get("profile_changes"),
            ),
        )
