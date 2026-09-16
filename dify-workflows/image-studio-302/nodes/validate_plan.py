"""在收费生图前验证 Lite 的结构化规划；不修补、猜测或静默接受损坏结果。"""
import json


def main(text: str, jobs: list, all_jobs: list) -> dict:
    """校验规划并合并受控约束。

    text 为 LLM 原始 JSON，jobs 为本次执行图位，all_jobs 为完整图位。
    返回 prompt 与 jobs，保持原图位字段和顺序。JSON/字段/图位错误抛 ValueError，阻止生图。
    """
    if not isinstance(text, str) or len(text) > 100000:
        raise ValueError('规划响应为空或超长')
    try:
        plan = json.loads(text)
    except (ValueError, TypeError):
        raise ValueError('规划不是合法 JSON，已停止生图') from None
    if not isinstance(plan, dict) or set(plan) != {'visual_summary', 'style', 'images'}:
        raise ValueError('规划顶层字段不符合约定')
    for name in ('visual_summary', 'style'):
        if not isinstance(plan[name], str) or not 1 <= len(plan[name].strip()) <= 6000:
            raise ValueError('规划摘要或风格为空、类型错误或超长')
    images = plan['images']
    if not isinstance(images, list) or len(images) != len(all_jobs):
        raise ValueError('规划图位数量不匹配')
    by_id = {}
    for image, expected in zip(images, all_jobs):
        if not isinstance(image, dict) or set(image) != {'slot_id', 'prompt'}:
            raise ValueError('逐张规划字段不符合约定')
        if image['slot_id'] != expected['slot_id'] or image['slot_id'] in by_id:
            raise ValueError('规划图位标识或顺序不匹配')
        prompt = image['prompt']
        if not isinstance(prompt, str) or not 1 <= len(prompt.strip()) <= 16000:
            raise ValueError('生图 prompt 为空、类型错误或超长')
        by_id[image['slot_id']] = prompt.strip()
    result = []
    for job in jobs:
        # 原任务的事实边界和修改范围始终保留；LLM 规划仅补充可执行视觉细节。
        prompt = (job['prompt'] + '\n统一视觉方案：' + plan['style']
                  + '\n逐张创作规划（如与上述事实或用户限制冲突，以上述限制为准）：'
                  + by_id[job['slot_id']])
        result.append({**job, 'prompt': prompt})
    if not result:
        raise ValueError('没有可执行图位')
    return {'prompt': result[0]['prompt'], 'jobs': result}
