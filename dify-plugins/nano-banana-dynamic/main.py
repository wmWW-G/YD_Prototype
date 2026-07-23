from dify_plugin import Plugin, DifyPluginEnv

# 4K 图片和复杂参考图可能需要数分钟，运行时上限应略高于 HTTP 读取超时。
plugin = Plugin(DifyPluginEnv(MAX_REQUEST_TIMEOUT=360))

if __name__ == "__main__":
    plugin.run()
