"""消费确认令牌并执行删除 Tool。"""

from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from lib.confirmation import consume_delete_confirmation
from lib.tool_helpers import invoke_json_tool


class ExecuteDeleteTool(Tool):
    """只接受 prepare_delete 生成的一次性令牌执行删除。"""

    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        """令牌有效时执行一次远端删除；令牌会在调用前立即失效。"""

        def operation(client: Any) -> dict[str, Any]:
            """消费令牌，删除其绑定对象，并返回不含凭证的结果。"""

            confirmed = consume_delete_confirmation(
                self.session.storage,
                client.user_id,
                tool_parameters.get("confirmation_token"),
            )
            result = client.delete_resource(
                confirmed["resource_type"],
                confirmed["resource_id"],
            )
            return {
                "deleted": True,
                "resource": confirmed,
                "api_result": result,
            }

        yield from invoke_json_tool(self, "delete.execute", operation)
