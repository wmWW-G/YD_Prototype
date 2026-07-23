"""赢单客户 KASS Tool Provider 凭证校验。"""

import logging
from typing import Any

from dify_plugin import ToolProvider
from dify_plugin.config.logger_format import plugin_logger_handler
from dify_plugin.errors.tool import ToolProviderCredentialValidationError

from lib.client import YingdanApiClient, YingdanApiError


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if plugin_logger_handler not in logger.handlers:
    logger.addHandler(plugin_logger_handler)


class YingdanKassProvider(ToolProvider):
    """注册赢单 KASS 工具，并用只读接口校验固定账号凭证。"""

    def _validate_credentials(self, credentials: dict[str, Any]) -> None:
        """校验 API 地址、固定用户 ID 与 Access Token。

        参数:
            credentials: Dify 保存的 Provider 配置，必须包含 api_base_url、
                user_id 与 access_token。

        返回值:
            无。只读的客户分层接口返回成功时直接结束。

        异常:
            ToolProviderCredentialValidationError: 配置缺失、Token 失效、
                API 返回错误或网络不可用时抛出。异常不会回显 Access Token。
        """
        try:
            client = YingdanApiClient.from_credentials(credentials)
            client.list_categories()
            logger.info("Yingdan KASS provider credential validation succeeded")
        except YingdanApiError as exc:
            logger.warning(
                "Yingdan KASS provider credential validation failed: %s",
                exc.safe_code,
            )
            raise ToolProviderCredentialValidationError(exc.user_message) from exc
        except Exception as exc:
            logger.warning(
                "Yingdan KASS provider credential validation failed: %s",
                type(exc).__name__,
            )
            raise ToolProviderCredentialValidationError(
                "无法验证赢单凭证，请检查 API 地址、用户 ID、Token 和网络。"
            ) from exc
