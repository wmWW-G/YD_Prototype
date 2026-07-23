## 赢单客户 KASS Dify Tool Plugin

固定绑定一个赢单账号，让 Dify Chatflow 的 Agent 节点通过 Tool 查询和管理客户分层、客户档案、跟进记录与文件。

### 安装

1. 在 Dify 的「插件」页面选择从本地文件安装。
2. 上传 `dist/yingdan-kass-0.1.2.difypkg`。
3. 配置 Provider 凭证：
   - `api_base_url`：默认 `https://api.top-yd.com`。
   - `user_id`：授权赢单账号的数字用户 ID。
   - `access_token`：授权登录响应中的 `data.accessToken`。
4. 在 Chatflow 的 Agent 节点中添加「赢单客户 KASS」下需要使用的 Tool。

`access_token` 与 `user_id` 只配置在 Provider，不会暴露为 LLM 参数。Token 失效后需要由管理员重新登录赢单并更新 Provider 配置。

### 第一版 Tools

- 客户分层：查询、新建、修改。
- 客户档案：按分层查询、读取详情、新建、安全合并修改。
- 跟进记录：分页查询、新建、安全合并修改。
- 文件：上传单个不超过 5 MB 的文件；上传结果不会自动写入客户档案。
- 删除：先调用 `prepare_delete` 读取目标并生成五分钟一次性令牌；用户明确确认后才能调用 `execute_delete`。

客户成交进度接口没有纳入第一版，因为当前线上只读验证返回异常，不能把未验证接口伪装成可用能力。

2026-07-22 已使用明确标记的临时数据完成真实线上 CRUD 联调：分层、客户、跟进记录的新增/查询/修改/删除及最终清理均已验证。实测确认客户分层更新必须使用 `PUT`；客户档案更新不支持通过当前保存接口修改 `customer_category`，且 `cooperation_times` 必须是非负整数。跟进详情和删除路径也已真实验证。

### Agent 使用建议

第一次接入时只勾选查询类 Tool，先测试：

```text
先列出客户分层，再查询 A 类客户。不要创建、修改或删除任何内容。
```

确认读取结果正确后，再逐步开启创建和修改 Tool。删除 Tool 建议保留在需要人工确认的专用 Agent 中。

### 本地验证

```bash
python -m unittest discover -s tests -v
dify plugin package . -o dist/yingdan-kass-0.1.2.difypkg
```

测试使用模拟 HTTP 响应，不包含真实账号、Token 或客户数据，也不会调用线上写入接口。
