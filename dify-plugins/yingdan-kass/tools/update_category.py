"""更新客户分层 Tool。"""

from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from lib.tool_helpers import invoke_json_tool


class UpdateCategoryTool(Tool):
    """让 Agent 更新固定账号中的客户分层。"""

    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        """按 category_id 更新名称和备注，并返回 API 结果。"""

        yield from invoke_json_tool(
            self,
            "category.update",
            lambda client: client.update_category(
                tool_parameters.get("category_id"),
                tool_parameters.get("category_name"),
                tool_parameters.get("remark") or "",
            ),
        )
