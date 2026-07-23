"""创建客户档案 Tool。"""

from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from lib.tool_helpers import invoke_json_tool


class CreateCustomerTool(Tool):
    """让 Agent 用受控字段创建客户档案。"""

    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        """创建 profile 对象，并由客户端自动绑定 Provider 的 user_id。"""

        yield from invoke_json_tool(
            self,
            "customer.create",
            lambda client: client.create_customer(tool_parameters.get("profile")),
        )
