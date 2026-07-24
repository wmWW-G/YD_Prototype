"""KASS 原型 CRM Dify Tool Plugin 入口。"""

from dify_plugin import DifyPluginEnv, Plugin


# 原型 API 正常请求应在 30 秒内完成；保留 60 秒可以覆盖偶发网络抖动，
# 同时避免一个失联请求长期占用 Dify Agent 的迭代时间。
plugin = Plugin(DifyPluginEnv(MAX_REQUEST_TIMEOUT=60))


if __name__ == "__main__":
    plugin.run()
