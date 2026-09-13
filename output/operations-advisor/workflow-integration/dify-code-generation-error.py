# 用于 generation_error 代码节点；输入/输出变量配置保持不变。
def main() -> dict:
    """返回运行失败的原有四字段接口；无输入，不暴露内部异常或商家数据，不抛业务异常。"""
    # 用结构化返回值表达业务失败；stderr 会被沙箱视为执行失败，故不向 stderr 写日志。
    return {'status': 'invalid_output', 'report': {}, 'chat_inputs': {},
            'error': '本次报告未能完成生成或校验，请稍后重试；持续失败时检查模型节点的运行记录。'}
