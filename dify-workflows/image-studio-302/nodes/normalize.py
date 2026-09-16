"""Dify Code 节点：只向调用端返回受控结果，不回显供应商错误正文。"""
import json
from urllib.parse import urlsplit


def main(body: str, status_code: int, metadata: dict, job=None) -> dict:
    """归一化同步图片响应；job 为套图当前图位或 None，返回 result 对象，不对响应格式异常抛错。

    网络超时由 HTTP 节点默认值进入本节点，不能自动重试，防止供应商已完成生图时重复扣费。
    """
    expected = 1 if job else metadata['expected']
    result = {'kind':metadata['kind'],
              'contract_version':metadata['contract_version'],'status':'failed',
              'images':[],'expected':expected,'error_code':'UPSTREAM_HTTP_ERROR',
              'retry_advice':'check_provider_before_retry','model':metadata['model']}
    if job:
        result.update({'slot_id':job['slot_id'],'index':job['index'],'role':job['role'],'title':job['title']})
    if not isinstance(status_code,(int,float)) or not 200 <= status_code < 300:
        if status_code == 0:
            result.update(status='unknown',error_code='TRANSPORT_OR_TIMEOUT')
        elif status_code in (401,403):
            result['error_code'] = 'AUTH_OR_PERMISSION'
        elif status_code == 429:
            result['error_code'] = 'RATE_LIMIT'
        return {'result':result}
    try:
        payload = json.loads(body)
        if not isinstance(payload,dict):
            raise ValueError()
        if payload.get('error'):
            result['error_code'] = 'PROVIDER_ERROR'
            return {'result':result}
        rows = payload.get('data')
        if not isinstance(rows,list) or not rows:
            raise ValueError()
        for index,row in enumerate(rows):
            if not isinstance(row,dict):
                raise ValueError()
            url = row.get('url','')
            parts = urlsplit(url)
            if parts.scheme != 'https' or not parts.hostname or parts.username or parts.password:
                raise ValueError()
            result['images'].append({'index':index,'url':url})
        result['status'] = 'succeeded' if len(result['images']) == expected else 'partial'
        result['error_code'] = '' if result['status'] == 'succeeded' else 'IMAGE_COUNT_MISMATCH'
        result['retry_advice'] = 'none' if result['status'] == 'succeeded' else 'check_provider_before_retry'
    except (ValueError, TypeError, AttributeError):
        result.update(status='failed',images=[],error_code='INVALID_IMAGE_RESPONSE')
    return {'result':result}
