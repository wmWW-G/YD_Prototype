"""整套汇总：保留失败图位，输出顺序严格遵循输入而非完成时间。"""
import json


def main(results: list, jobs: list, metadata: dict) -> dict:
    """results 为迭代返回数组，jobs 为原始方案；返回统一结果和 JSON，不抛常规响应异常。"""
    by_id = {row.get('slot_id'):row for row in (results or []) if isinstance(row,dict)}
    ordered = []
    for job in jobs:
        row = by_id.get(job['slot_id']) or {'slot_id':job['slot_id'],'index':job['index'],
              'role':job['role'],'title':job['title'],'status':'unknown','images':[],
              'error_code':'ITERATION_RESULT_MISSING','retry_advice':'check_provider_before_retry'}
        ordered.append(row)
    successes = sum(row['status'] == 'succeeded' for row in ordered)
    status = 'succeeded' if successes == len(jobs) else 'partial' if successes else 'failed'
    result = {**metadata,'status':status,'items':ordered,'succeeded_count':successes,
              'failed_slot_ids':[row['slot_id'] for row in ordered if row['status']!='succeeded']}
    return {'result':result,'result_json':json.dumps(result,ensure_ascii=False)}
