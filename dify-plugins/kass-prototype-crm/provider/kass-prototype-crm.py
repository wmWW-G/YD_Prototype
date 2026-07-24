"""KASS 原型 CRM Tool Provider。

插件使用固定的公开原型 API，不需要用户配置地址、Token 或账号。因此 Provider
没有凭证表单，也不会出现把真实赢单凭证误填到原型插件的风险。
"""

from typing import Any

from dify_plugin import ToolProvider


class KassPrototypeCrmProvider(ToolProvider):
    """注册不需要凭证的 KASS 原型 CRM 工具。"""

    def _validate_credentials(self, credentials: dict[str, Any]) -> None:
        """接受空凭证。

        参数:
            credentials: Dify Provider 传入的配置。当前插件不读取其中任何字段。

        返回值:
            无。固定 API 地址由插件代码控制，不需要用户配置。

        异常:
            本函数不主动抛异常。
        """

        del credentials
