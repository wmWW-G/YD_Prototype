"""离线验证 DSL 与 Code 节点。所有图片响应均为测试构造，不联网、不产生生图费用。"""
import copy
import inspect
import json
import logging
from pathlib import Path
import unittest
import yaml

ROOT=Path(__file__).resolve().parent
from build_workflows import KINDS
IMAGE={'type':'image','mime_type':'image/png','size':2048,'filename':'fixture.png'}
SLOTS=[{'id':'hero','role':'main','brief':''},{'id':'specification','role':'spec','brief':'容量 300 ml'}]


def load(kind):
    """读取 kind 对应 DSL，返回字典；文件不存在或 YAML 错误时抛异常。"""
    return yaml.safe_load((ROOT/(KINDS[kind].replace(' ', '_')+'.yaml')).read_text())


def run(kind,node_id,**overrides):
    """从实际交付 YAML 执行 Code 节点；以虚构输入运行，业务校验错误直接抛出供测试断言。"""
    data=next(n['data'] for n in load(kind)['workflow']['graph']['nodes'] if n['id']==node_id)
    scope={}
    exec(compile(data['code'],kind+'/'+node_id,'exec'),scope)
    values={'product_image':copy.deepcopy(IMAGE),'style_image':None,'logo_image':None,'source_image':copy.deepcopy(IMAGE),
            'instruction':'柔和自然光','visual_direction':'简洁展示','image_text':'','language':'英语',
            'aspect_ratio':'auto' if kind=='edit' else '1:1','quantity':1,
            'slots_json':json.dumps(SLOTS if kind=='set' else [{'id':'intro','role':'intro','brief':''}],ensure_ascii=False),
            'retry_slot_ids_json':'','image_model':'gpt-image-2.5-flare'}
    values.update(overrides)
    if node_id == 'prepare':
        for name in ('product_image','style_image','logo_image','source_image'):
            file = values.get(name)
            for attr in ('type','mime_type','size'):
                values[name+'_'+attr] = file.get(attr) if isinstance(file, dict) else None
    return scope['main'](**{name:values[name] for name in inspect.signature(scope['main']).parameters})


def meta(kind='main',quantity=1):
    """返回经实际 prepare 节点校验的虚构任务元数据，无额外异常。"""
    return run(kind,'prepare',quantity=quantity)['metadata']


class WorkflowChecks(unittest.TestCase):
    """针对五份最终 DSL 检查数据流、业务限制、响应错误以及逐张重试行为。"""

    def test_graph_and_bindings(self):
        """每份 DAG 可达、绑定存在、迭代归属正确，且所有代码参数与声明完全匹配。"""
        for kind in KINDS:
            with self.subTest(kind=kind):
                w=load(kind)['workflow'];g=w['graph'];nodes={n['id']:n for n in g['nodes']}
                self.assertEqual(len(nodes),len(g['nodes']))
                outputs={'env':{v['name'] for v in w['environment_variables']},'sys':{'files','user_id'}}
                for nid,n in nodes.items():
                    d=n['data'];t=d['type']
                    outputs[nid]=set(d.get('outputs',{})) if t=='code' else {v['variable'] for v in d['variables']} if t=='start' else {'text','reasoning_content','usage'} if t=='llm' else {'body','status_code','headers','files'} if t=='http-request' else {'output'} if t=='variable-aggregator' else {'item','index','output'} if t=='iteration' else set()
                    if t=='code':
                        scope={};exec(compile(d['code'],nid,'exec'),scope)
                        self.assertEqual(set(inspect.signature(scope['main']).parameters),{v['variable'] for v in d['variables']})
                selectors=[]
                for nid,n in nodes.items():
                    d=n['data']
                    if d['type']=='code':selectors += [v['value_selector'] for v in d['variables']]
                    if d['type']=='end':selectors += [v['value_selector'] for v in d['outputs']]
                    if d['type']=='http-request':
                        selectors += [p['file'] for p in d['body']['data'] if p['type']=='file']
                        self.assertFalse(d['retry_config']['retry_enabled'])
                        self.assertEqual(d['url'],'https://api.302.ai/v1/images/generations' if nid=='text_render' else 'https://api.302.ai/v1/images/edits')
                    if d['type']=='iteration':
                        selectors += [d['iterator_selector'],d['output_selector']]
                        self.assertEqual(nodes[d['start_node_id']]['data']['type'],'iteration-start')
                    if 'parentId' in n:
                        self.assertEqual(n['parentId'],'images');self.assertTrue(d['isInIteration'])
                for selector in selectors:
                    self.assertIn(selector[0],outputs);self.assertIn(selector[1],outputs[selector[0]])
                adjacency={nid:[] for nid in nodes}
                for e in g['edges']:
                    self.assertIn(e['source'],nodes);self.assertIn(e['target'],nodes)
                    adjacency[e['source']].append(e['target'])
                if 'images' in nodes:adjacency['images'].append('each_start')
                visiting=set();visited=set()
                def visit(nid):
                    """深度遍历验证 DAG；遇环触发断言，不产生副作用。"""
                    self.assertNotIn(nid,visiting)
                    if nid in visited:return
                    visiting.add(nid)
                    for target in adjacency[nid]:visit(target)
                    visiting.remove(nid);visited.add(nid)
                visit('start');self.assertEqual(visited,set(nodes))
                self.assertEqual(w['environment_variables'][0]['value'],'')

    def test_default_values_editor_compatibility(self):
        """对象/数组异常默认值必须为合法 JSON 文本，避免 Monaco 收到非字符串后崩溃。"""
        for kind in KINDS:
            with self.subTest(kind=kind):
                http=next(n['data'] for n in load(kind)['workflow']['graph']['nodes'] if n['data']['type']=='http-request')
                for item in http['default_value']:
                    if item['type']=='object' or item['type'].startswith('array'):
                        self.assertIsInstance(item['value'],str)
                        self.assertIsInstance(json.loads(item['value']),dict if item['type']=='object' else list)

    def test_planner_configuration(self):
        """原生 JSON Schema 参数和图片绑定必须存在，生图只能位于规划校验之后。"""
        for kind in KINDS:
            g=load(kind)['workflow']['graph'];nodes={n['id']:n['data'] for n in g['nodes']}
            model=nodes['planner']['model']
            self.assertEqual(model['name'],'doubao-seed-2-0-lite-260215')
            self.assertEqual(model['completion_params']['response_format'],'json_schema')
            schema=json.loads(model['completion_params']['json_schema'])
            self.assertTrue(schema['strict']);self.assertFalse(schema['schema']['additionalProperties'])
            self.assertTrue(nodes['planner']['vision']['enabled'])
            self.assertIn({'source':'planner','target':'validate_plan'},[{'source':e['source'],'target':e['target']} for e in g['edges']])
            if kind in ('set','listing'):
                self.assertEqual(nodes['images']['iterator_selector'],['validate_plan','jobs'])
            else:
                self.assertEqual(nodes['render']['body']['data'][0]['value'],'{{#validate_plan.prompt#}}')

    def test_planner_rejects_invalid_output(self):
        """缺字段、错误类型、多图少图、错序与 Markdown 均在收费节点前被拒绝。"""
        prepared=run('set','prepare')
        good={'visual_summary':'Visible product','style':'Soft neutral light',
              'images':[{'slot_id':j['slot_id'],'prompt':'Photograph the actual product.'} for j in prepared['all_jobs']]}
        result=run('set','validate_plan',text=json.dumps(good),jobs=prepared['jobs'],all_jobs=prepared['all_jobs'])
        self.assertEqual([j['slot_id'] for j in result['jobs']],['hero','specification'])
        self.assertIn('Photograph',result['jobs'][0]['prompt'])
        wrongs=[{}, {**good,'extra':1}, {**good,'style':[]}, {**good,'images':good['images'][:1]},
                {**good,'images':list(reversed(good['images']))}, {**good,'images':[{'slot_id':'hero','prompt':''},good['images'][1]]}]
        for wrong in wrongs:
            with self.assertRaises(ValueError):run('set','validate_plan',text=json.dumps(wrong),jobs=prepared['jobs'],all_jobs=prepared['all_jobs'])
        with self.assertRaises(ValueError):run('set','validate_plan',text='```json\n{}\n```',jobs=prepared['jobs'],all_jobs=prepared['all_jobs'])

    def test_planner_retry_uses_full_plan(self):
        """指定重试图位时仍验证完整规划，仅执行所选图位。"""
        prepared=run('set','prepare',retry_slot_ids_json='["specification"]')
        self.assertEqual(len(prepared['all_jobs']),2)
        plan={'visual_summary':'Bottle','style':'Neutral', 'images':[{'slot_id':j['slot_id'],'prompt':'Frame '+j['slot_id']} for j in prepared['all_jobs']]}
        result=run('set','validate_plan',text=json.dumps(plan),jobs=prepared['jobs'],all_jobs=prepared['all_jobs'])
        self.assertEqual([j['slot_id'] for j in result['jobs']],['specification'])

    def test_main_default_and_quantity(self):
        """主图默认英语，版数映射输出数量，方向与商品身份规则均保留。"""
        value=run('main','prepare',quantity=4)
        self.assertEqual(value['quantity'],'4');self.assertEqual(value['metadata']['expected'],4)
        self.assertIn('英语',value['prompt']);self.assertIn('不主动',value['prompt'].replace('不要主动','不主动'))

    def test_required_product(self):
        """所有流程允许无图生成，但不允许无图无描述。"""
        for kind in KINDS:
            value=run(kind,'prepare',product_image=None,source_image=None,instruction='蓝色圆柱杯')
            self.assertEqual(value['has_images'],'no')
            self.assertIn('文字',value['prompt'])
            with self.assertRaises(ValueError):run(kind,'prepare',product_image=None,source_image=None,instruction='')

    def test_auxiliary_image_route_and_logo(self):
        """只有参考图或 Logo 仍走 edits，且 Logo 必须位于左上角。"""
        for key in ('style_image','logo_image'):
            value=run('main','prepare',product_image=None,**{key:IMAGE})
            self.assertEqual(value['has_images'],'yes')
        self.assertIn('左上角',run('main','prepare',logo_image=IMAGE)['prompt'])

    def test_text_request_json(self):
        """文生图请求经过 JSON 编码，不因引号/换行破坏请求。"""
        for kind in KINDS:
            value=run(kind,'text_request',prompt='a "cup"\nblue',size='1024x1024',quantity='1',model='gpt-image-2.5-flare')
            self.assertEqual(json.loads(value['body'])['prompt'],'a "cup"\nblue')

    def test_v3_contract_and_render_types(self):
        """用户要求移除任务标识；迭代开始必须使用专用前端组件。"""
        for kind in KINDS:
            nodes={n['id']:n for n in load(kind)['workflow']['graph']['nodes']}
            self.assertNotIn('task_id',[v['variable'] for v in nodes['start']['data']['variables']])
            self.assertNotIn('task_id',run(kind,'prepare')['metadata'])
            self.assertIn('image_route',nodes)
            if kind in ('set','listing'):
                self.assertEqual(nodes['each_start']['type'],'custom-iteration-start')
                self.assertEqual(nodes['images']['data']['output_selector'],['render_result','output'])

    def test_iteration_layout_has_no_overlap(self):
        """迭代内的分支节点不可互相覆盖，保证修复后画布可编辑。"""
        from itertools import combinations
        for kind in ('set','listing'):
            nodes=[n for n in load(kind)['workflow']['graph']['nodes'] if n.get('parentId')]
            for a,b in combinations(nodes,2):
                x,y=a['position']['x'],a['position']['y']
                bx,by=b['position']['x'],b['position']['y']
                overlap=x<bx+b['width'] and bx<x+a['width'] and y<by+b['height'] and by<y+a['height']
                self.assertFalse(overlap,(kind,a['id'],b['id']))

    def test_file_type_size(self):
        """拒绝非图片、超限和空文件。"""
        for fixture in ({**IMAGE,'mime_type':'text/html'},{**IMAGE,'size':11*1024*1024},{**IMAGE,'size':0}):
            with self.assertRaises(ValueError):run('main','prepare',product_image=fixture)

    def test_integer_counts(self):
        """数量拒绝小数、布尔、超限和 NaN。"""
        for quantity in (0,11,1.5,True,float('nan')):
            with self.assertRaises(ValueError):run('main','prepare',quantity=quantity)

    def test_supported_models(self):
        """只接受用户要求的 2.5 型号，旧 2.0 不能被静默使用。"""
        for model in ('gpt-image-2.5-flare','gpt-image-2.5-sunburst'):
            self.assertEqual(run('main','prepare',image_model=model)['metadata']['model'],model)
        with self.assertRaises(ValueError):run('main','prepare',image_model='gpt-image-2')

    def test_optional_defaults(self):
        """API 调用省略选填文本时仍应用页面默认值。"""
        value=run('main','prepare',language='',visual_direction='',aspect_ratio='',quantity=None)
        self.assertEqual(value['metadata']['language'],'英语');self.assertEqual(value['size'],'1024x1024')

    def test_attached_text_and_reference(self):
        """附带信息必填；上传参考图后，不把失效的附带信息混入提示词。"""
        with self.assertRaises(ValueError):run('main','prepare',visual_direction='附带信息')
        self.assertIn('容量',run('main','prepare',visual_direction='附带信息',image_text='容量 300 ml')['prompt'])
        prompt=run('main','prepare',style_image=IMAGE,visual_direction='附带信息',image_text='STALE_TEXT')['prompt']
        self.assertNotIn('STALE_TEXT',prompt);self.assertIn('优先于',prompt)

    def test_suite_slots(self):
        """逐张任务绑定原始 ID、规格和整套说明，包含完整结构而非只读当前行。"""
        value=run('set','prepare');self.assertEqual(len(value['jobs']),2)
        self.assertEqual(value['jobs'][1]['slot_id'],'specification')
        self.assertIn('300 ml',value['jobs'][1]['prompt']);self.assertIn('柔和自然光',value['jobs'][1]['prompt'])

    def test_invalid_slots(self):
        """开放方向仍拒绝空数组、重复ID、非法方向类型和超过容量。"""
        cases=[[],[SLOTS[0],SLOTS[0]],[SLOTS[0],{**SLOTS[1],'role':''}],
               [SLOTS[0],{**SLOTS[1],'role':['核心卖点']}],SLOTS*6]
        for slots in cases:
            with self.assertRaises(ValueError):run('set','prepare',slots_json=json.dumps(slots))

    def test_listing_roles(self):
        """旧别名仍解析为原标签；新方向不需要注册，且不修改返回role原文。"""
        self.assertEqual(run('listing','prepare')['jobs'][0]['role'],'intro')
        slots=[{'id':'new','role':'礼赠故事','brief':''}]
        value=run('listing','prepare',instruction='',slots_json=json.dumps(slots))
        self.assertEqual(value['jobs'][0]['role'],'礼赠故事')
        self.assertEqual(value['jobs'][0]['title'],'礼赠故事')
        self.assertIn('通用扩写要求',value['jobs'][0]['prompt'])

    def test_open_direction_and_sparse_inputs(self):
        """仅商品图和新方向可规划；保留旧别名、长度限制、无图描述校验与指定顺序。"""
        self.assertIn('收纳巧思',run('main','prepare',instruction='',visual_direction='收纳巧思')['prompt'])
        slots=[{'id':'a','role':'核心卖点','brief':''},{'id':'b','role':'礼赠故事','brief':''}]
        value=run('set','prepare',instruction='',slots_json=json.dumps(slots))
        self.assertEqual([j['role'] for j in value['jobs']],['核心卖点','礼赠故事'])
        for direction in (['bad'],'x'*101):
            with self.assertRaises(ValueError):run('main','prepare',visual_direction=direction)
        with self.assertRaises(ValueError):run('main','prepare',product_image=None,instruction='',visual_direction='核心卖点')

    def test_subset_retry_keeps_full_context(self):
        """重试只执行失败图位，仍保持完整任务下的提示词与原序号。"""
        full=run('set','prepare');retry=run('set','prepare',retry_slot_ids_json='["specification"]')
        self.assertEqual(retry['jobs'],[full['jobs'][1]])
        for raw in ('[]','["unknown"]','["hero","hero"]','{}'):
            with self.assertRaises(ValueError):run('set','prepare',retry_slot_ids_json=raw)

    def test_edit_source_and_instruction(self):
        """调整必须有要求；提供原图时保持未修改部分，无图时从零生成。"""
        for changes in ({'instruction':''},):
            with self.assertRaises(ValueError):run('edit','prepare',**changes)
        self.assertIn('只按修改要求',run('edit','prepare')['prompt'])
        self.assertEqual(run('edit','prepare')['size'],'auto')

    def test_similar_identity_and_style(self):
        """同款依据实际可用素材区分双图、单图和文字生成。"""
        self.assertIn('只有商品图',run('similar','prepare',source_image=None)['prompt'])
        self.assertIn('只有选中结果图',run('similar','prepare',product_image=None)['prompt'])
        self.assertIn('输入图 2',run('similar','prepare')['prompt'])

    def test_ratio_auto_fallback(self):
        """非文档明确尺寸使用 auto，比例仍进入提示词，不能假称像素比已强制保证。"""
        value=run('main','prepare',aspect_ratio='9:16')
        self.assertEqual(value['size'],'auto');self.assertIn('9:16',value['prompt'])

    def test_response_success_partial(self):
        """响应张数不足不能返回成功，但保留已生成图片。"""
        body=json.dumps({'data':[{'url':'https://example.org/generated.png'}]})
        value=run('main','normalize',body=body,status_code=200,metadata=meta())['result']
        self.assertEqual(value['status'],'succeeded')
        value=run('main','normalize',body=body,status_code=200,metadata=meta(quantity=2))['result']
        self.assertEqual(value['status'],'partial');self.assertEqual(len(value['images']),1)

    def test_response_errors_do_not_leak(self):
        """错误正文不出现在业务输出；超时标 unknown，禁止当作确定未执行。"""
        for status in (0,401,403,429,500):
            value=run('main','normalize',body='PRIVATE_PROVIDER_PAYLOAD',status_code=status,metadata=meta())['result']
            self.assertNotIn('PRIVATE_PROVIDER_PAYLOAD',json.dumps(value))
            self.assertEqual(value['status'],'unknown' if status==0 else 'failed')

    def test_bad_response_urls(self):
        """拒绝非法 JSON、HTML、无 URL 和可执行/内嵌凭据 URL。"""
        for body in ('<html>error</html>','[]','{}',json.dumps({'data':[{'b64_json':'large'}]}),
                     json.dumps({'data':[{'url':'javascript:alert(1)'}]}),json.dumps({'data':[{'url':'https://name:secret@example.org/'}]})):
            self.assertEqual(run('main','normalize',body=body,status_code=200,metadata=meta())['result']['status'],'failed')

    def test_aggregate_order_and_missing(self):
        """汇总按图位排序，缺少返回的项保留 unknown 记录。"""
        prepared=run('set','prepare')
        row={'slot_id':'specification','status':'succeeded','images':[{'url':'https://example.org/2.png'}]}
        result=run('set','aggregate',results=[row],jobs=prepared['jobs'],metadata=prepared['metadata'])['result']
        self.assertEqual([r['slot_id'] for r in result['items']],['hero','specification'])
        self.assertEqual(result['status'],'partial');self.assertEqual(result['failed_slot_ids'],['hero'])


if __name__=='__main__':
    logging.basicConfig(level=logging.INFO)
    logging.info('开始离线验证；不会调用 302.AI')
    unittest.main(verbosity=2)
