"""读取客户档案 Tool。"""

from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from lib.tool_helpers import invoke_json_tool


class GetCustomerTool(Tool):
    """让 Agent 只读获取一个客户的完整档案。"""

    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        """按 customer_id 查询档案并校验其属于固定账号。"""

        yield from invoke_json_tool(
            self,
            "customer.get",
            lambda client: client.get_customer(tool_parameters.get("customer_id")),
        )
