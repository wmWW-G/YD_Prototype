"""准备删除并生成一次性确认令牌 Tool。"""

from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from lib.confirmation import create_delete_confirmation
from lib.tool_helpers import invoke_json_tool


class PrepareDeleteTool(Tool):
    """只读核对对象，并把五分钟确认令牌写入 Dify Storage。"""

    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        """查询待删除对象；本 Tool 不会执行远端删除。"""

        def operation(client: Any) -> dict[str, Any]:
            """生成绑定固定用户和目标对象的一次性令牌。"""

            preview = client.preview_delete(
                tool_parameters.get("resource_type"),
                tool_parameters.get("resource_id"),
            )
            return create_delete_confirmation(
                self.session.storage,
                client.user_id,
                preview,
            )

        yield from invoke_json_tool(self, "delete.prepare", operation)
