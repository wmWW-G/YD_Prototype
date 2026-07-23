"""上传赢单文件 Tool。"""

from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from lib.client import YingdanApiError
from lib.tool_helpers import invoke_json_tool


class UploadFileTool(Tool):
    """让 Agent 上传一个不超过 5 MB 的 Dify 文件。"""

    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        """读取 Dify ToolFile 的名称、MIME 和二进制内容后上传。"""

        def operation(client: Any) -> Any:
            """校验 Dify ToolFile 后调用赢单上传接口。

            参数:
                client: 已由 Provider 凭证初始化的赢单客户端。

            返回值:
                赢单文件接口返回的数据。

            异常:
                YingdanApiError: 文件缺失或二进制内容不可读取时抛出。
            """

            file_object = tool_parameters.get("file")
            if file_object is None:
                raise YingdanApiError("file 不能为空。", safe_code="invalid_file")
            blob = getattr(file_object, "blob", None)
            if not isinstance(blob, (bytes, bytearray)):
                raise YingdanApiError(
                    "无法读取上传文件内容。",
                    safe_code="invalid_file",
                )
            return client.upload_file(
                str(getattr(file_object, "filename", None) or "upload.bin"),
                bytes(blob),
                str(
                    getattr(file_object, "mime_type", None)
                    or "application/octet-stream"
                ),
            )

        yield from invoke_json_tool(self, "file.upload", operation)
