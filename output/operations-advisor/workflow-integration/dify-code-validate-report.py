# 用于 validate_report 和 validate_repaired 两个代码节点；输入/输出变量配置保持不变。
import json
SCHEMA = {'type': 'object', 'properties': {'name': {'type': 'string'}, 'sub': {'type': 'string'}, 'data_status': {'type': 'string', 'enum': ['sufficient', 'partial', 'insufficient']}, 'conclusion': {'type': 'string'}, 'points': {'type': 'array', 'items': {'type': 'string'}}, 'rows': {'type': 'array', 'items': {'type': 'array', 'items': {'type': 'string'}}}, 'content_markdown': {'type': 'string'}, 'evidence': {'type': 'array', 'items': {'type': 'object', 'properties': {'id': {'type': 'string'}, 'source': {'type': 'string'}, 'fact': {'type': 'string'}}, 'required': ['id', 'source', 'fact'], 'additionalProperties': False}}, 'actions': {'type': 'array', 'items': {'type': 'object', 'properties': {'id': {'type': 'string'}, 'target': {'type': 'string'}, 'decision': {'type': 'string'}, 'steps': {'type': 'array', 'items': {'type': 'string'}}, 'priority': {'type': 'string', 'enum': ['P0', 'P1', 'P2']}, 'owner': {'type': 'string'}, 'acceptance': {'type': 'array', 'items': {'type': 'string'}}, 'review': {'type': 'string'}, 'evidence_ids': {'type': 'array', 'items': {'type': 'string'}}}, 'required': ['id', 'target', 'decision', 'steps', 'priority', 'owner', 'acceptance', 'review', 'evidence_ids'], 'additionalProperties': False}}, 'missing_data': {'type': 'array', 'items': {'type': 'string'}}, 'follow_up_questions': {'type': 'array', 'items': {'type': 'string'}}}, 'required': ['name', 'sub', 'data_status', 'conclusion', 'points', 'rows', 'content_markdown', 'evidence', 'actions', 'missing_data', 'follow_up_questions'], 'additionalProperties': False}
def check(value: object, rule: dict, path: str = 'report') -> None:
    """递归检查Schema；参数为值、规则和字段路径，无返回值，违规抛ValueError。

    不在错误中打印模型值；只报告字段路径，避免将商家数据带入运行日志。
    """
    kind = rule['type']
    if kind == 'object':
        if not isinstance(value, dict) or set(value) != set(rule['required']):
            raise ValueError(path + ':字段不匹配')
        for key, subrule in rule['properties'].items():
            check(value[key], subrule, path + '.' + key)
    elif kind == 'array':
        if not isinstance(value, list):
            raise ValueError(path + ':不是数组')
        for index, item in enumerate(value):
            check(item, rule['items'], path + '[' + str(index) + ']')
    elif kind == 'string':
        if not isinstance(value, str):
            raise ValueError(path + ':不是字符串')
        if 'enum' in rule and value not in rule['enum']:
            raise ValueError(path + ':枚举无效')


def nonblank(value: str, path: str) -> None:
    """要求字符串非空白；参数为字符串和路径，无返回值，空白抛ValueError。"""
    if not value.strip():
        raise ValueError(path + ':不可为空白')


def main(text: str, module: str, function_name: str, report_id: str, business_context: str) -> dict:
    """校验模型JSON并注入可信报告身份，返回原有四字段接口。

    text为模型结果，其余参数来自输入校验节点。类型、内容结构或容量不符时返回
    invalid_output与空report/chat_inputs，不输出半成品；不抛业务异常。
    本节点验证结构与引用关系，不能证明经营判断正确或证据内容真实。
    """
    try:
        if not isinstance(text, str) or len(text) > 100000:
            raise ValueError('模型输出类型或长度无效')
        raw = text.strip()
        # 兼容仅包裹完整JSON的代码围栏；不从夹杂说明的文本里猜取花括号。
        lines = raw.splitlines()
        if len(lines) >= 3 and lines[0].strip().lower() in ('```json', '```') and lines[-1].strip() == '```':
            raw = '\n'.join(lines[1:-1])
        report = json.loads(raw)
        check(report, SCHEMA)
        if report['name'] != function_name:
            raise ValueError('报告入口不匹配')
        for field in ('name', 'sub', 'conclusion', 'content_markdown'):
            nonblank(report[field], 'report.' + field)
        if len(report['points']) > 5 or len(report['follow_up_questions']) > 3:
            raise ValueError('摘要或快捷追问过多')
        for field in ('points', 'missing_data', 'follow_up_questions'):
            for item in report[field]:
                nonblank(item, 'report.' + field)
        rows = report['rows']
        if rows and (not rows[0] or any(len(row) != len(rows[0]) for row in rows)):
            raise ValueError('表格列数不一致')
        if rows:
            for cell in rows[0]:
                nonblank(cell, 'report.rows表头')
        evidence_ids = []
        for entry in report['evidence']:
            for field in ('id', 'source', 'fact'):
                nonblank(entry[field], 'report.evidence.' + field)
            evidence_ids.append(entry['id'])
        if len(set(evidence_ids)) != len(evidence_ids):
            raise ValueError('证据ID重复')
        if report['data_status'] == 'sufficient' and not evidence_ids:
            raise ValueError('资料充足状态必须有实际证据')
        if report['data_status'] != 'sufficient' and not report['missing_data']:
            raise ValueError('资料不足状态必须说明关键缺口')
        action_ids = []
        for action in report['actions']:
            for field in ('id', 'target', 'decision', 'owner', 'review'):
                nonblank(action[field], 'report.actions.' + field)
            action_ids.append(action['id'])
            for field in ('steps', 'acceptance'):
                if not action[field]:
                    raise ValueError('report.actions.' + field + ':至少一项')
                for item in action[field]:
                    nonblank(item, 'report.actions.' + field)
            refs = action['evidence_ids']
            if len(refs) != len(set(refs)) or any(ref not in evidence_ids for ref in refs):
                raise ValueError('行动证据引用重复或不存在')
        if len(set(action_ids)) != len(action_ids):
            raise ValueError('行动ID重复')
        # 身份只取调用方有效输入，禁止模型伪造；接入字段和schema_version保持不变。
        report.update({'schema_version': '1.0', 'module': module,
                       'function_name': function_name, 'report_id': report_id})
        envelope = {'schema_version': '1.0', 'report_id': report_id,
                    'module': module, 'function_name': function_name, 'report': report}
        serialized = json.dumps(envelope, ensure_ascii=False)
        if len(serialized) > 64000:
            raise ValueError('报告超过追问容量，需保留处理范围并精简重复内容')
        # Dify 的对象输出检查对二维数组兼容不足；仅把传输副本中的 rows 编码为文本。
        # serialized 已保留原始二维数组，追问上下文和报告业务结构均不改变。
        transport_report = dict(report)
        transport_report['rows'] = json.dumps(report['rows'], ensure_ascii=False)
        return {'status': 'ok', 'report': transport_report,
                'chat_inputs': {'module': module, 'business_context': business_context,
                                'diagnosis_context': serialized}, 'error': ''}
    except (ValueError, TypeError, KeyError, RecursionError) as exc:
        message = 'JSON无法解析' if isinstance(exc, json.JSONDecodeError) else str(exc)
        return {'status': 'invalid_output', 'report': {}, 'chat_inputs': {},
                'error': '结构化输出校验失败：' + message}
