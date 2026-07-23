"""更新客户档案 Tool。"""

from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from lib.tool_helpers import invoke_json_tool


class UpdateCustomerTool(Tool):
    """先读取现有档案，再合并字段，避免局部更新清空其它内容。"""

    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        """按 customer_id 合并 changes，并把完整可编辑字段保存回赢单。"""

        yield from invoke_json_tool(
            self,
            "customer.update",
            lambda client: client.update_customer(
                tool_parameters.get("customer_id"),
                tool_parameters.get("changes"),
            ),
        )
