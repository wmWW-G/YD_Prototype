"""按分层列出客户 Tool。"""

from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from lib.tool_helpers import invoke_json_tool


class ListCustomersTool(Tool):
    """让 Agent 只读查询某个客户分层中的客户。"""

    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        """按 category 查询客户列表，不产生线上写入。"""

        yield from invoke_json_tool(
            self,
            "customer.list",
            lambda client: client.list_customers(tool_parameters.get("category")),
        )
