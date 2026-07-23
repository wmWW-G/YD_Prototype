"""Dify 图片工具供应商配置与第三方 API 密钥校验。"""

import logging
from typing import Any

import requests
from dify_plugin import ToolProvider
from dify_plugin.config.logger_format import plugin_logger_handler
from dify_plugin.errors.tool import ToolProviderCredentialValidationError

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if plugin_logger_handler not in logger.handlers:
    logger.addHandler(plugin_logger_handler)


class NanoBananaDynamicProvider(ToolProvider):
    """注册三模型生图工具，并验证 Google 或 OpenRouter 凭证。"""

    _GEMINI_MODEL_CHECK_URL = (
        "https://generativelanguage.googleapis.com/v1beta/"
        "models/gemini-3.1-flash-image"
    )
    _OPENROUTER_KEY_CHECK_URL = "https://openrouter.ai/api/v1/key"

    def _validate_credentials(self, credentials: dict[str, Any]) -> None:
        """验证用户填写的一个或两个供应商 API Key。

        参数:
            credentials: Dify 保存的凭证字典，可包含 gemini_api_key、
                openrouter_api_key，至少应提供一个。

        返回值:
            无。所有已填写密钥验证通过时直接返回。

        异常:
            ToolProviderCredentialValidationError: 两个密钥都为空，或任一已填写
                密钥无效、超时、无法连接时抛出。异常不会回显密钥。
        """
        gemini_key = str(credentials.get("gemini_api_key") or "").strip()
        openrouter_key = str(credentials.get("openrouter_api_key") or "").strip()
        if not gemini_key and not openrouter_key:
            raise ToolProviderCredentialValidationError(
                "Gemini API Key 与 OpenRouter API Key 至少填写一个。"
            )

        if gemini_key:
            self._validate_key(
                service_name="Gemini",
                url=self._GEMINI_MODEL_CHECK_URL,
                headers={"x-goog-api-key": gemini_key},
            )
        if openrouter_key:
            self._validate_key(
                service_name="OpenRouter",
                url=self._OPENROUTER_KEY_CHECK_URL,
                headers={"Authorization": f"Bearer {openrouter_key}"},
            )

    @staticmethod
    def _validate_key(
        service_name: str,
        url: str,
        headers: dict[str, str],
    ) -> None:
        """向供应商的只读端点验证一个 API Key。

        参数:
            service_name: 用于日志和错误提示的供应商名称。
            url: 不产生费用的只读验证端点。
            headers: 已组装的鉴权请求头；只用于当前请求，不写日志。

        返回值:
            无。HTTP 2xx 时直接返回。

        异常:
            ToolProviderCredentialValidationError: 超时、网络失败或 HTTP 非 2xx
                时抛出。
        """
        try:
            response = requests.get(url, headers=headers, timeout=(5, 15))
        except requests.Timeout as exc:
            logger.warning("%s credential validation timed out", service_name)
            raise ToolProviderCredentialValidationError(
                f"验证 {service_name} API Key 超时，请检查网络后重试。"
            ) from exc
        except requests.RequestException as exc:
            logger.warning(
                "%s credential validation request failed: %s",
                service_name,
                type(exc).__name__,
            )
            raise ToolProviderCredentialValidationError(
                f"无法连接 {service_name}，请检查网络或代理设置。"
            ) from exc

        if response.ok:
            logger.info("%s API credential validation succeeded", service_name)
            return

        # 只提取服务端 message 字段，不回显含密钥的请求头。
        message = f"HTTP {response.status_code}"
        try:
            payload = response.json()
            error = payload.get("error", {}) if isinstance(payload, dict) else {}
            if isinstance(error, dict) and error.get("message"):
                message = str(error["message"])
        except ValueError:
            pass
        raise ToolProviderCredentialValidationError(
            f"{service_name} API Key 验证失败：{message}"
        )
