"""创建客户分层 Tool。"""

from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from lib.tool_helpers import invoke_json_tool


class CreateCategoryTool(Tool):
    """让 Agent 在固定账号下创建客户分层。"""

    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        """使用 category_name 和可选 remark 创建分层并返回 API 结果。"""

        yield from invoke_json_tool(
            self,
            "category.create",
            lambda client: client.create_category(
                tool_parameters.get("category_name"),
                tool_parameters.get("remark") or "",
            ),
        )
