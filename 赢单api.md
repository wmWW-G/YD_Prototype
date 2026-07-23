---
title: 默认模块
language_tabs:
  - shell: Shell
  - http: HTTP
  - javascript: JavaScript
  - ruby: Ruby
  - python: Python
  - php: PHP
  - java: Java
  - go: Go
toc_footers: []
includes: []
search: true
code_clipboard: true
highlight_theme: darkula
headingLevel: 2
generator: "@tarslib/widdershins v4.0.30"

---

# 默认模块

Base URLs:

# Authentication

- HTTP Authentication, scheme: bearer

# auth模块

## POST 注册接口

POST /auth/register

> Body 请求参数

```json
{
    "username": "[REDACTED_PHONE]",
    "password": "123456",
    "phone": "[REDACTED_PHONE]",
    "nickname": "测试用户1",
    "smsCode": "666",
    "inviteCode": ""
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 手机号/密码登录

POST /auth/login

> Body 请求参数

```json
{
    "username": "[REDACTED_PHONE]",
    "password": "123456"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 验证码校验接口

POST /auth/checkSmsCode

> Body 请求参数

```json
{
    "phone": "[REDACTED_PHONE]",
    "code": "666"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 修改密码接口

POST /auth/changePassword

> Body 请求参数

```json
{
    "username": "[REDACTED_PHONE]",
    "password": "123456"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 获取用户列表

GET /auth/list

> Body 请求参数

```json
{}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|current|query|integer| 否 |none|
|size|query|integer| 否 |none|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 更新用户状态 0禁用 1启用

POST /auth/updateStatus

> Body 请求参数

```json
{
    "id": 1,
    "status": 0
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 新增用户积分

POST /auth/account/add

> Body 请求参数

```json
{
    "userId": 1,
    "points":   ## 新增积分数
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 获取短信验证码 Copy

GET /auth/getSmsCode

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|phone|query|string| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 绑定子账号

POST /auth/bind

> Body 请求参数

```json
{
    "phone": "[REDACTED_PHONE]"
    "smsCode": "666",
    "parentUserId": ""
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 短信登录接口

POST /auth/loginBySms

> Body 请求参数

```json
{
    "phone": "[REDACTED_PHONE]",
    "code": "675443"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

# index模块

## GET 赢单后台获取人设列表

GET /index/role/getRoleList

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 赢单前台获取人设列表

GET /index/role/getList

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 新增AI人设

POST /index/role/insert

> Body 请求参数

```json
{
    "role": "",
    "roleCharacter": "",
    "roleLevel": 1,
    "menuId": 1,
    "type": 1,
    "sort": 1
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 更新AI人设

POST /index/role/update

> Body 请求参数

```json
{
    "id": 1,
    "role": "测试",
    "roleCharacter": "测试",
    "sort": 1
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 流式AI提问

POST /index/public/getYDGlChatGenerateToToolStream

> Body 请求参数

```json
{
    "type":1,
    "content":"你是干啥用的",
    "sessionId": "",
    "userId": "",
    "files": [
        {
            "fileUrl": "https://example.com/files/document1.pdf",
            "fileType": "application/pdf"
        },
        {
            "fileUrl": "https://example.com/files/document2.docx",
            "fileType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }
    ]
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 获取对话历史列表

GET /index/public/conversation/list

> Body 请求参数

```json
{}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|query|string| 否 |none|
|type|query|integer| 否 |none|
|pageNum|query|integer| 否 |none|
|pageSize|query|integer| 否 |none|
|title|query|string| 否 |none|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 获取历史对话详情消息

GET /index/public/conversation/history

> Body 请求参数

```json
{}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|sessionId|query|string| 否 |none|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 获取人设菜单

GET /index/menu/getMenuList

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 新建人设菜单

POST /index/menu/insert

> Body 请求参数

```json
{
    "menuName": ""
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 新增用户知识库

POST /index/role/knowledge/add

> Body 请求参数

```json
{
    "userId": 1,
    "roleType": 1,
    "roleKnowledge": ""
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 编辑用户知识库

POST /index/role/knowledge/update

> Body 请求参数

```json
{
    "id": 1,
    "roleKnowledge": "测试测试"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 获取用户知识库列表

POST /index/role/knowledge/getByType

> Body 请求参数

```json
{
    "userId": 1,
    "roleType": 1
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 获取ai模型列表

GET /index/aimodel/getList

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 上传文件接口

POST /index/file/upload

> Body 请求参数

```yaml
file: ""

```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|
|» file|body|string(binary)| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 前台上传文件接口

POST /index/file/uploadFile

> Body 请求参数

```yaml
file: ""

```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|
|» file|body|string(binary)| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 获取一级菜单列表

GET /index/role/getLevel1Menu

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 前台上传文件至coze接口

POST /index/file/uploadCoze

> Body 请求参数

```yaml
file: file://C:\Users\Administrator\Desktop\公司介绍模拟.pdf

```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|
|» file|body|string(binary)| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

# customer模块

## POST 新增客户

POST /index/customer/add

> Body 请求参数

```json
{
  "userId": ,
  "customerCode": "KH20240315001",
  "customerName": "北京科技有限公司",
  "customerSource": "官网",
  "customerCountry": "中国",
  "customerCategory": "A类客户",
  "orderAmount": 150000.00,
  "orderFrequency": "月度",
  "customFrequency": "",
  "followUpFrequency": "每周"
  "sessionId":
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 新增客户跟进

POST /index/followUp/add

> Body 请求参数

```json
{
  "userId": 1001,
  "followDateStart": "2025-04-01",
  "followDateEnd": "2025-04-05",
  "followTarget": "KH20240401001 / 北京科技有限公司",
  "followLevel": "A",
  "followItem": "F",
  "followMethod": "电话沟通",
  "otherExplain": "客户对价格有疑虑，已解释成本构成。",
  "relatedName": "",
  "relatedFile": "contract_v2.pdf",
  "eventDesc": "客户表示希望下周再确认一次报价细节，目前暂未下单。",
  "needCooperate": true,
  "processTime": "2025-04-03",
  "reviewContent": "客户响应积极，但决策链较长，需持续跟进。",
  "newPlan": "下周三再次电话确认审批进度，同步提供案例支持。",
  "resultContent": "客户初步接受报价，需财务复核。",
  "solution": "客户初步接受报价，需财务复核。",
  "principal": "张三",
  "task": "准备合同模板及案例资料",
  "finishTime": "2025-04-03"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 获取客户列表

POST /index/customer/getList

> Body 请求参数

```json
{
  "userId": 20,
  "customerCategory": ""
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 根据用户id获取客户跟进列表

GET /index/followUp/getByUser

> Body 请求参数

```json
{}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|query|integer| 否 |none|
|pageNum|query|integer| 否 |none|
|pageSize|query|integer| 否 |none|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 根据客户名称获取客户跟进列表

GET /index/followUp/getByCustomerName

> Body 请求参数

```json
{}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|query|integer| 否 |none|
|followTarget|query|string| 否 |none|
|pageNum|query|integer| 否 |none|
|pageSize|query|integer| 否 |none|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 根据id获取客户跟进列表

GET /index/followUp/getById

> Body 请求参数

```json
{}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|query|integer| 否 |none|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 根据客户target获取客户详情

GET /index/customer/getByTarget

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|target|query|string| 否 |none|
|userId|query|string| 否 |none|

> 返回示例

> 200 Response

```json
{"code":0,"msg":"操作成功","data":{"id":12,"userId":39,"customerCode":"0948578","customerName":"Sandy","customerSource":"朋友推荐","customerCountry":"中国","customerCategory":"A","orderAmount":100000.00,"orderFrequency":"月度","customFrequency":"","followUpFrequency":"每月","createTime":"2026-03-31T09:28:41","updateTime":null},"error":true,"ok":false}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## DELETE 删除客户

DELETE /index/customer/delete

> Body 请求参数

```json
{}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|customerId|query|integer| 否 |none|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

# customerCategory

## POST 新增客户层级

POST /index/customerCategory/add

> Body 请求参数

```json
{
    "userId": 1,
    "customerCategory": S,
    "remark": ""
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 编辑客户层级

POST /index/customerCategory/update

> Body 请求参数

```json
{
    "id": 1,
    "userId": 1,
    "customerCategory": S
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## DELETE 删除客户层级

DELETE /index/customerCategory/delete

> Body 请求参数

```json
{}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|query|integer| 否 |none|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 根据用户获取客户层级列表

GET /index/customerCategory/getByUser

> Body 请求参数

```json
{}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|query|integer| 否 |none|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

# rag

## POST 上传知识库文件接口

POST /index/roleFile/add

> Body 请求参数

```json
{
    "role_type": "1",
    "mimeType": "application/pdf",
    "fileUrl": "https://ydan.oss-cn-shenzhen.aliyuncs.com/uploads/4e12ea7f175c482d8dcc19e0b0b5b8a4_1775815180095.pdf"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 获取知识库文件列表

GET /index/roleFile/list

> Body 请求参数

```json
{}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|pageSize|query|integer| 否 |none|
|pageNum|query|integer| 否 |none|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## DELETE 删除知识库文件

DELETE /index/roleFile/delete

> Body 请求参数

```json
{}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|query|integer| 否 |none|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

# 会话模块

## PUT 更新会话名称

PUT /index/public/conversation/update

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|query|integer| 是 |none|
|name|query|string| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## DELETE 删除会话

DELETE /index/public/conversation/delete

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|sessionId|query|string| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## PUT 更新会话置顶状态

PUT /index/public/conversation/updateTop

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|query|integer| 是 |none|
|top|query|integer| 否 |0为不置顶,1为置顶|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

# 人设菜单模块

## GET 获取二级菜单列表

GET /index/role/getLevel2Menu

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 获取人设列表新

GET /index/role/roleList

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 获取人设列表新 Copy

GET /index/role/getRoleMneuList

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 获取一级人设列表

GET /index/role/getParentList

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## PUT 更新人设上级菜单

PUT /index/role/updateMenu

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|ids|query|integer| 否 |none|
|menuId|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## PUT 更新二级菜单上级菜单

PUT /index/role/menu/updateMenu

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|query|integer| 否 |none|
|menuParentId|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 复制人设

POST /index/role/copyRole

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|query|integer| 否 |none|
|menuId|query|integer| 否 |none|
|userId|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 复制菜单

POST /index/role/menu/copyMenu

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|query|integer| 否 |none|
|menuParentId|query|integer| 否 |none|
|userId|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## DELETE 删除人设

DELETE /index/role/delete

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 删除菜单

POST /index/role/menu/delete

> Body 请求参数

```json
{
    "id":
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

# 公司资料模块

## POST 新增或更新公司资料

POST /index/company/profile/save-or-update

> Body 请求参数

```json
{
  "id": ,
  "userId": 1001,
  "profileName": "一句话SLG",
  "profileDescription": "对外第一句话介绍公司定位",
  "profileTags": "[\"源头工厂\",\"OEM/立体机动\",\"28年行业沉淀\"]",
  "profileContent": "28+年专业设计生产纸盒&卡牌&书刊&笔记 OEM&ODM 源头工厂",
  "sort": 1
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 获取公司资料列表

GET /index/company/profile/list

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## DELETE 删除公司资料

DELETE /index/company/profile/delete

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

# 产品模块

## POST 批量增加产品

POST /index/product/batchAdd

> Body 请求参数

```json
[
    {
        "userId": 1001,
        "category": "智能门锁面板",
        "productImage": "Q3智能压铸面板",
        "function": "智能门锁外观面板，承载屏幕、按键与品牌展示",
        "parameters": "锌合金压铸；表面喷涂；支持定制颜色",
        "sellingPoints": "定制化外观适配品牌展示需求",
        "weaknesses": "安装孔位需要确认",
        "useCases": "智能门锁、工程门禁项目",
        "marketAnalysis": "全球智能门锁市场持续增长",
        "competitorAnalysis": "竞争集中在外观设计和表面处理",
        "customerProfile": "智能门锁品牌商",
        "priceMoq": "USD 6.8 / 500pcs",
        "remarks": "测试数据"
    },
    {
        "userId": 1001,
        "category": "门锁总成套",
        "productImage": "X-Series门锁总成套",
        "function": "整套门锁方案，适合渠道快速上架",
        "parameters": "标准尺寸，适配主流门厚",
        "sellingPoints": "配套齐全，适合打包销售",
        "weaknesses": "包装较重，运输成本偏高",
        "useCases": "住宅智能锁、公寓锁配套销售",
        "marketAnalysis": "住宅与公寓智能锁需求稳定",
        "competitorAnalysis": "竞争聚焦产品完整性与价格优势",
        "customerProfile": "五金渠道商、电商卖家",
        "priceMoq": "USD 28 / 100pcs",
        "remarks": "建议补充产品详细参数"
    },
    {
        "userId": 1001,
        "category": "智能家居联网配件",
        "productImage": "WiFi低功耗通信模块",
        "function": "用于智能锁联网、远程开门、消息推送",
        "parameters": "2.4GHz WiFi；低功耗方案；适配主板",
        "sellingPoints": "低功耗设计适配智能门锁续航需求",
        "weaknesses": "需要和主控板协议匹配",
        "useCases": "智能锁方案商集成、智能家居联动",
        "marketAnalysis": "智能家居联网配件需求持续增长",
        "competitorAnalysis": "竞争聚焦功耗控制与协议适配能力",
        "customerProfile": "智能锁方案商、ODM客户",
        "priceMoq": "USD 3.2 / 1000pcs",
        "remarks": ""
    }
]
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 获取用户产品分页数据

GET /index/product/page

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|query|integer| 否 |none|
|pageNum|query|integer| 否 |none|
|pageSize|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 根据分类获取产品列表

GET /index/product/listByCategory

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|query|integer| 否 |none|
|category|query|string| 否 |none|
|pageNum|query|integer| 否 |none|
|pageSize|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## PUT 更新产品信息

PUT /index/product/update

> Body 请求参数

```json

    {
        "id":
        "userId": 1,
        "category": "门锁总成套",
        "productImage": "X-Series门锁总成套",
        "function": "整套门锁方案，适合渠道快速上架",
        "parameters": "标准尺寸，适配主流门厚",
        "sellingPoints": "配套齐全，适合打包销售",
        "weaknesses": "包装较重，运输成本偏高",
        "useCases": "住宅智能锁、公寓锁配套销售",
        "marketAnalysis": "住宅与公寓智能锁需求稳定",
        "competitorAnalysis": "竞争聚焦产品完整性与价格优势",
        "customerProfile": "五金渠道商、电商卖家",
        "priceMoq": "USD 28 / 100pcs",
        "remarks": "建议补充产品详细参数"
    }

```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 获取用户分类列表

GET /index/product/category/list

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

# 客户KASS模块

## POST 保存客户资料详情

POST /index/customer/profile/save

> Body 请求参数

```json
{
    "id": ,
    "userId": 123,
    "sessionId": "",
    "customerSource": "客户转调/招商沉淀",
    "companyName": "Yellow Door Energy",
    "customerCategory": "重点客户",
    "website": "https://www.yellowdoorenergy.com",
    "establishmentYear": "2015",
    "industryRanking": "Top 10",
    "orgStructure": "采购部 → 技术部 → 财务部 → CEO",
    "kp": "Procurement Manager",
    "socialMedia": "LinkedIn",
    "companySize": "100-500人",
    "companyType": "新能源/工商业储能",
    "countryRegion": "阿联酋",
    "salesChannel": "项目渠道",
    "entryDate": "2026-05-07",
    "logoUrl": "https://cdn.xxx.com/logos/yde.png",
    "firstCooperation": "否",
    "transactionAmount": "待补充",
    "productPreference": "客户询问 Q3 智能压铸面板是否可提供 500 套阶梯报价",
    "procurementPreference": "重视交付证明、认证资料、阶梯报价和售后响应",
    "expandableProducts": "储能一体机、配套结构件、安装服务",
    "cooperationTimes": "0",
    "annualRevenue": "待补充",
    "procurementCycle": "季度采购",
    "procurementPotential": "A级",
    "contactName": "Procurement Team",
    "position": "采购经理",
    "email": "[REDACTED_EMAIL]",
    "whatsapp": "+971 50 123 4567",
    "hobbies": "关注项目交付效率、技术细节",
    "competitorName": "Supplier A / Supplier B",
    "competitiveAdvantage": "交付稳定、项目案例丰富、认证齐全",
    "cooperativeSuppliers": "现有供应商 X / 备选供应商 Y"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{"success":false,"code":40101,"message":"未提供访问令牌，请先登录","path":"/index/customer/profile/save","timestamp":1780368451795,"data":null}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 根据用户获取客户列表

GET /index/customer/profile/listbycategoty

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{"success":false,"code":40101,"message":"未提供访问令牌，请先登录","path":"/index/customer/profile/save","timestamp":1780368451795,"data":null}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## DELETE 删除客户资料档案

DELETE /index/customer/profile/delete

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{"success":false,"code":40101,"message":"未提供访问令牌，请先登录","path":"/index/customer/profile/save","timestamp":1780368451795,"data":null}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 根据id获取客户档案详情

GET /index/customer/profile/detail

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{"success":false,"code":40101,"message":"未提供访问令牌，请先登录","path":"/index/customer/profile/save","timestamp":1780368451795,"data":null}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 添加客户跟进记录

POST /index/customer/followup/save

> Body 请求参数

```json
{
  "customerId": 1001,
  "customerIntent": "客户希望推进500套小批量试单并获取相关PI等信息",
  "recordDate": "2026-05-22",
  "title": "客户回复并提出小批量试单及PI相关要求",
  "summary": "客户表示2pcs样品可安排，希望按500套小批量试单，要求出PI及相关付款、生产周期等信息",
  "followUpMethod": "邮件",
  "detail": "客户今天邮件回复，2pcs sample可先安排，但希望按500套小批量试单推进。要求出包含500套单价、总金额、30%定金和70%尾款付款方式、预计生产周期、包装方式、DHL样品寄送时间及后续大货海运到Dubai交付周期的PI，还提到包装先按neutral package，不做logo，外箱贴基础产品标签，PI上注明价格有效期15天并要求明天前发过去",
  "keyPoints": "2pcs样品可安排,按500套小批量试单推进,要求PI及相关付款、周期等信息,包装及价格有效期要求",
  "nextAction": "按客户要求明天前发送包含相关内容的PI"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## PUT 更新客户跟进记录

PUT /index/customer/followup/update

> Body 请求参数

```json
{
  "id": 1,
  "customerId": 1001,
  "customerIntent": "客户希望推进500套小批量试单并获取相关PI等信息",
  "recordDate": "2026-05-22",
  "title": "客户回复并提出小批量试单及PI相关要求",
  "summary": "客户表示2pcs样品可安排，希望按500套小批量试单，要求出PI及相关付款、生产周期等信息",
  "followUpMethod": "邮件",
  "detail": "客户今天邮件回复，2pcs sample可先安排，但希望按500套小批量试单推进。要求出包含500套单价、总金额、30%定金和70%尾款付款方式、预计生产周期、包装方式、DHL样品寄送时间及后续大货海运到Dubai交付周期的PI，还提到包装先按neutral package，不做logo，外箱贴基础产品标签，PI上注明价格有效期15天并要求明天前发过去",
  "keyPoints": "2pcs样品可安排,按500套小批量试单推进,要求PI及相关付款、周期等信息,包装及价格有效期要求",
  "nextAction": "按客户要求明天前发送包含相关内容的PI"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 查看跟进记录详情

GET /index/customer/followup/detail

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## DELETE 删除跟进记录

DELETE /index/customer/followup/delete

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 根据客户获取跟进记录列表

GET /index/customer/followup/pageByCustomerId

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|customerId|query|integer| 否 |none|
|pageNum|query|integer| 否 |none|
|pageSize|query|integer| 否 |none|
|recordDate|query|string| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 获取用户跟进流程

GET /index/customer/process/getbyuser

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 更新用户跟进流程当前节点

POST /index/customer/process/update-node

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|query|integer| 否 |none|
|nodeName|query|string| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

# 扣子接口模块

## POST 工作流接口

POST /index/coze/workStream

> Body 请求参数

```json
{
  "input": "这是一个典型的**首次背调模式**。以下是对中东可再生能源开发商 Yellow Door Energy 的完整背调报告与开发建议。\n\n### 一．这是什么类型的客户？\n\n**结论：**\nYellow Door Energy（简称 YDE）是中东和非洲地区**第一梯队的大型工商业（C&I）分布式光伏与储能项目开发商（IPP）**。\n\n**依据：**\n他们不卖货给C端，也不做简单的贸易分销，而是采用“投资-建设-运营”（太阳能租赁 / PPA 购电协议）模式为大型企业提供清洁能源。目前在手和规划项目超过 400 MW，目标规模超 1GW。其采购特点是直接面对重大项目，对光伏组件、逆变器、电池储能系统（BESS）有极其庞大的**直采或指定 EPC 采购需求**，属于国内新能源制造企业的“战略级大买家”。\n\n### 二．公司介绍\n\n- **公司名称：** Yellow Door Energy\n- **品牌名称：** Yellow Door Energy\n- **注册公司全称或法定实体：** Yellow Door Energy Holdings (受多方基金和资方注资)\n- **地址：** 总部位于阿联酋迪拜（Suite 3207, JBC 1 Cluster G, Jumeirah Lakes Towers, Dubai），在沙特、南非、巴林、约旦和阿曼设有分公司。\n- **官网：** www.yellowdoorenergy.com\n- **主要社媒主页：** LinkedIn、Facebook、Instagram、YouTube 均有布局，LinkedIn 最为活跃。\n- **联系方式：** +971 4 454 3033（迪拜总部）；[REDACTED_EMAIL]\n- **线上店铺情况：** 不适用（项目开发商，无2C网店）。\n- **线下门店情况：** 企业未公开（无传统门店，但在多国设有区域办公室）。\n- **社媒粉丝数量级：** 在 LinkedIn 等B2B平台具有极高的行业影响力和广泛的关注度。\n- **主要销售模式：** B2B 项目开发，为中大型工商业客户（如雀巢、大卖场、医院、钢铁厂）提供 15-25 年的清洁能源长期供电协议（PPA），主打“客户零资本支出（0 CapEx）”。\n- **预测可能合作中的中国供应商：** 由于中东光伏项目高度依赖中国供应链，推测其必然与国内头部（Tier 1）组件厂（如晶科、隆基、天合等）及逆变器巨头（华为、阳光电源等）有深度合作。\n\n### 三．公司实力评估\n\n- **成立时间与经营年限：** 2015年成立，深耕中东新能源市场约10年。\n- **员工规模区间：** 120人以上的核心光伏与储能专家团队。\n- **主要市场与覆盖区域：** 核心市场为阿联酋、沙特、约旦、巴林、阿曼及南非。\n- **资质与认证：** 多次获得中东太阳能行业协会（MESIA）“太阳能行业领导力奖”及 SolarQuarter 等行业大奖。\n- **品牌知名度与影响力：** 实力极为雄厚。2022年，公司获得由知名投资机构 Actis 领投的 4 亿美元股权融资。其核心股东包括世界银行旗下的国际金融公司（IFC）、日本三井物产（Mitsui & Co.）以及阿拉伯能源基金（TAEF）。\n- **综述评价：** 拥有顶级的国际资本背景，现金流充裕且项目储备丰富，履约能力和付款能力极强。\n\n### 四．产品线与能力\n\n- **主营品类与核心产品：** 屋顶光伏、地面光伏、光伏车棚、电池储能系统（BESS）及混合能源解决方案。\n- **典型产品工艺与材质：** 追求高转化率技术。其公开新闻中明确提到在车棚等项目中广泛使用“双面高效光伏组件（Bifacial panels）”。\n- **产品档次与价格区间：** 属于 Tier 1 级别的商用和工业用标准。既要保证 25 年以上的稳定发电生命周期，又要将度电成本（LCOE）压到最低。\n- **渠道布局：** 直接攻克大型终端用电户。近期大项目包括阿联酋 EMSTEEL 的 31.5 MW 屋顶项目，沙特 SADAFCO 的 2.9 MW 项目等。\n- **销售策略与卖点：** 替客户出资建站，承诺降低电费开支、提高电力可靠性并助力企业实现“净零排放”。\n- **定制能力或项目能力：** 具备从投融资、系统设计、工程建设（EPC）到后期运营维护（O&M）的全生命周期管理能力。\n\n### 五．关键决策人员与联络建议\n\n- **关键人物：**\n  - **姓名：** Jeremy Crane\n  - **职位：** 集团 CEO 兼创始人\n  - **公开邮箱：** [REDACTED_EMAIL] （基于公开邮箱后缀及高管名片规则推断）\n  - **LinkedIn 或其他主页：** LinkedIn 极度活跃，常作为行业意见领袖发声。\n  - **姓名：** Leandro Bento\n  - **职位：** 集团 CTO（负责整体技术路线与工程选型）\n  - **姓名：** Khaled Chebaro\n  - **职位：** 沙特地区总监（负责沙特市场项目开拓）\n\n- **联系策略：**\n  - **建议首要接触角色：** 作为设备供应商，不建议一上来就找 CEO。优先在 LinkedIn 上搜索并添加其 CTO（Leandro Bento）、**Procurement Manager（采购经理）** 或 **Supply Chain Director（供应链总监）**。\n  - **建议使用渠道：** LinkedIn 站内开发信为主，配合打迪拜总部总机要求转接采购部。\n  - **首次联络切入角度：** 从“提升系统全生命周期发电增益、降低 LCOE、解决中东高温沙尘场景衰减问题”切入，直接询问其新项目的设备供应商准入标准（Vendor Registration）。\n\n### 六．近 3 年进口相关数据\n\n- **国别进口趋势：** 阿联酋与沙特目前正处于“2050/2060净零愿景”的爆发期，工商业分布式光伏和储能装机量激增。\n- **主要进口来源国：** 绝对依赖中国的新能源供应链。\n- **常见采购模式：** 由开发商总部统筹进入合格供应商库（Vendor List），具体项目可能由其内部团队直采，或由中标的 EPC 分包商在指定品牌库中采购。\n- **供应商集中度：** 高度集中在具有国际认证（如 TUV 等）和银行可融资性（Bankability）的国际一线品牌。\n- **可参考数据来源：** 未查到该公司单体的公开进口海关数据，仅从国家与品类层面推断，其每年采购规模在百兆瓦（MW）级别，采购金额在数千万至亿美元级别。\n\n### 七．风险与注意事项\n\n- **信用与合规风险：** 风险极低。由世界级财团和机构注资，合规性极强，属于优质良性资产开发商。\n- **业务稳定性风险：** 与客户签订的多为 15-20 年的长协 PPA，业务模式抗风险能力强。\n- **价格与利润风险：** 风险较高。开发商的利润空间建立在极致的成本控制上，他们对组件和储能设备的报价极其敏感，供应商面临的竞标压价会非常惨烈。\n- **沟通与执行风险：** 技术准入门槛极高，对高温衰减、产品质保（如 25 年线性功率质保）、项目地认证（如沙特 SASO）有严苛要求。\n- **其它注意点：** 供应商库的准入审核周期可能长达半年到一年，需要准备极度完善的英文技术文档、验厂报告及财务审计证明。\n\n### 八．对我司的合作价值与切入建议\n\n**合作价值评估：**\n- **潜在采购规模：** 每年百兆瓦级别，属于能大幅拉动业绩的 **VIP 战略级客户**。\n- **对我司匹配度：** 若你司是国内光伏组件、逆变器、大储（BESS）或光伏支架的**源头工厂且具备一定品牌知名度**，匹配度极高；若你司是纯贸易中间商，极难切入，因为他们具有直接跨国接洽源头大厂的能力。\n- **合作周期预期：** 长线作战。从首次接触、资质入库、技术答疑、打样测试到最终项目落地，通常需要 6-12 个月以上。\n\n**优先切入方向：**\n- **建议主推产品线或方案：** 适配中东地貌的 N 型/高效双面光伏组件、抗高温的工商业储能一体机、或具备智能清洗功能的光伏相关设备。\n- **建议主打卖点：** 优异的耐高温防沙尘性能、长效的质保承诺、以及在中东本地的服务与售后响应能力。\n- **建议报价策略：** 首单建议报“战略成本价”以敲开供应商大门；必须接受大客户标准的账期（如开立信用证 L/C）。\n- **首轮沟通框架：** \n  “你好 [采购负责人姓名]，得知 YDE 刚拿下了 EMSTEEL 31.5MW 等大型项目，祝贺你们。我们是 [你司名称]，专注制造适配中东高温高反照率场景的高效 [产品，如双面组件/储能设备]。我们期望申请加入 YDE 的合格供应商库，通过提供更具竞争力的 LCOE 方案，助力你们在 GCC 地区的 1GW 开发目标。能否发一份你们的 Vendor Registration Form？”\n\n### 九．主要来源\n- **官网或网店：** Yellow Door Energy 官网\n- **社媒：** LinkedIn\n- **行业或新闻网站：** 彭博社/路透补充新闻、Renewables Now 行业新闻、WAM (阿联酋通讯社)\n- **其它公开来源：** 欧洲复兴开发银行 (EBRD) 公开项目文件、Actis 投资通告\n\n---\n**顾问提示：** \n这类大开发商是新能源外贸的“香饽饽”。如果你能提供你司的具体产品线（如是做光伏板、支架、逆变器还是储能电池），以及你司是工厂还是贸易商身份，我可以为你生成更精准的**针对性竞标策略**与**话术**。",
  "type": "type5",
  "userId": 1001,
  "customerId":
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 上传文件到扣子

POST /index/coze/uploadFile

> Body 请求参数

```yaml
file: file://C:\Users\Administrator\Desktop\公司介绍模拟.pdf

```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|
|» file|body|string(binary)| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 扣子chat接口

POST /index/coze/chat

> Body 请求参数

```json
{
  "content": "你好，你是什么",
  "contentExt": "",
  "userId": 1001,
  "sessionId": "",
  "customerId":
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 根据客户id获取聊天记录

GET /index/coze/chat/getByCustomer

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|customerId|query|string| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

# 案例知识库模块

## GET 文件信息模糊查询

GET /index/fileAnalysis//listByCategory

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|query|integer| 否 |none|
|categoryLabel|query|string| 否 |none|
|pageNum|query|integer| 否 |none|
|pageSize|query|integer| 否 |none|
|keyword|query|string| 否 |none|

> 返回示例

> 200 Response

```json
{"code":0,"msg":"操作成功","data":{"records":[{"id":3,"userId":37,"workflowId":"7644852197557108742","fileUrl":"https://ydan.oss-cn-shenzhen.aliyuncs.com/uploads/81c2e63ddd124927b43fe51008833b01_1780490934833.docx","fileName":"公司介绍模拟","docTitle":"PulseWatch Technology Co., Ltd.","fileType":"docx","textLen":2255,"categoryKey":"faq","categoryLabel":"百问百答","countLabel":"Word","fileLabel":"Word","cardDesc":"提供深圳智能穿戴设备厂商的企业资质、产品、产能及服务信息，助力外贸业务前期客户沟通","cardTitle":"PulseWatch科技公司介绍","definitionConfidence":0.95,"definitionOneSentence":"这是一份深圳PulseWatch科技公司的介绍文件，涵盖公司概况、核心产品、产能资质、市场服务等内容，适合外贸业务中客户初步沟通、需求匹配时调用。","definitionReason":"文档为完整的企业介绍资料，不属于客户案例或内部复盘，符合faq分类规则。","summary":"本文件详细介绍了深圳PulseWatch科技有限公司的基本情况，包括2014年成立的垂直整合智能穿戴设备设计制造商身份，核心产品覆盖运动智能手表、时尚系列、老人儿童健康 tracker等，同时展示了工厂产能、质量认证、全球市场布局及服务承诺，可帮助外贸业务员快速向客户传递企业实力与业务范围。","mainTopics":"[\"企业基本概况\",\"核心产品系列\",\"生产制造能力\",\"质量认证体系\",\"全球市场分布\",\"客户服务承诺\",\"联系方式\"]","businessScenarios":"[\"新客户初次询盘回复\",\"客户资质背景查询\",\"产品选型推荐\",\"产能交付能力说明\",\"认证合规性解释\",\"售后政策沟通\"]","keyFacts":"[\"2014年成立，总部位于中国深圳\",\"是智能手表、健身 tracker及连接穿戴设备的垂直整合设计制造商\",\"产品销往北美、欧洲等60多个国家和地区\",\"拥有深圳宝安12000平方米工厂，通过ISO9001/ISO14001认证\",\"配备6条SMT生产线、10条组装线，月产能30万台成品穿戴设备\",\"产品通过CE、RED、RoHS、FCC等多项国际认证\",\"提供OEM/ODM定制服务，含私模和品牌UI定制\",\"样品交期5-7天（库存款）、15-20天（OEM款）\",\"批量生产交期为PI确认后25-35天\",\"提供1-2年质保及全球RMA支持\"]","keywords":"[\"PulseWatch\",\"智能穿戴设备\",\"外贸厂商\",\"OEM/ODM\"]","products":"[\"运动智能手表\",\"时尚智能手表\",\"老人儿童健康 tracker\",\"轻量化健身手环\",\"户外GPS手表\",\"智能穿戴设备\"]","countries":"[\"美国\",\"德国\",\"法国\",\"英国\",\"墨西哥\",\"巴西\",\"阿联酋\",\"沙特阿拉伯\",\"澳大利亚\",\"越南\"]","businessTerms":"[\"OEM\",\"ODM\",\"样品交期\",\"批量交期\",\"质保\",\"RMA支持\",\"认证\"]","quickFilters":"[\"产品\",\"产能\",\"认证\",\"交期\",\"售后\",\"市场\"]","tags":"[\"#智能穿戴\",\"#外贸厂商\",\"#企业介绍\",\"#OEM/ODM\",\"#全球认证\"]","rawJson":"{\"card\":{\"category_key\":\"faq\",\"category_label\":\"百问百答\",\"count_label\":\"Word\",\"desc\":\"提供深圳智能穿戴设备厂商的企业资质、产品、产能及服务信息，助力外贸业务前期客户沟通\",\"file_label\":\"Word\",\"quick_filters\":[\"产品\",\"产能\",\"认证\",\"交期\",\"售后\",\"市场\"],\"tags\":[\"#智能穿戴\",\"#外贸厂商\",\"#企业介绍\",\"#OEM/ODM\",\"#全球认证\"],\"title\":\"PulseWatch科技公司介绍\"},\"content_profile\":{\"business_scenarios\":[\"新客户初次询盘回复\",\"客户资质背景查询\",\"产品选型推荐\",\"产能交付能力说明\",\"认证合规性解释\",\"售后政策沟通\"],\"key_facts\":[\"2014年成立，总部位于中国深圳\",\"是智能手表、健身 tracker及连接穿戴设备的垂直整合设计制造商\",\"产品销往北美、欧洲等60多个国家和地区\",\"拥有深圳宝安12000平方米工厂，通过ISO9001/ISO14001认证\",\"配备6条SMT生产线、10条组装线，月产能30万台成品穿戴设备\",\"产品通过CE、RED、RoHS、FCC等多项国际认证\",\"提供OEM/ODM定制服务，含私模和品牌UI定制\",\"样品交期5-7天（库存款）、15-20天（OEM款）\",\"批量生产交期为PI确认后25-35天\",\"提供1-2年质保及全球RMA支持\"],\"main_topics\":[\"企业基本概况\",\"核心产品系列\",\"生产制造能力\",\"质量认证体系\",\"全球市场分布\",\"客户服务承诺\",\"联系方式\"],\"summary\":\"本文件详细介绍了深圳PulseWatch科技有限公司的基本情况，包括2014年成立的垂直整合智能穿戴设备设计制造商身份，核心产品覆盖运动智能手表、时尚系列、老人儿童健康 tracker等，同时展示了工厂产能、质量认证、全球市场布局及服务承诺，可帮助外贸业务员快速向客户传递企业实力与业务范围。\"},\"definition\":{\"category_key\":\"faq\",\"category_label\":\"百问百答\",\"confidence\":0.95,\"file_type_name\":\"企业介绍型资料\",\"one_sentence\":\"这是一份深圳PulseWatch科技公司的介绍文件，涵盖公司概况、核心产品、产能资质、市场服务等内容，适合外贸业务中客户初步沟通、需求匹配时调用。\",\"reason\":\"文档为完整的企业介绍资料，不属于客户案例或内部复盘，符合faq分类规则。\"},\"error\":\"\",\"ok\":true,\"qa_items\":[],\"search_index\":{\"business_terms\":[\"OEM\",\"ODM\",\"样品交期\",\"批量交期\",\"质保\",\"RMA支持\",\"认证\"],\"countries\":[\"美国\",\"德国\",\"法国\",\"英国\",\"墨西哥\",\"巴西\",\"阿联酋\",\"沙特阿拉伯\",\"澳大利亚\",\"越南\"],\"keywords\":[\"PulseWatch\",\"智能穿戴设备\",\"外贸厂商\",\"OEM/ODM\"],\"products\":[\"运动智能手表\",\"时尚智能手表\",\"老人儿童健康 tracker\",\"轻量化健身手环\",\"户外GPS手表\",\"智能穿戴设备\"],\"questions\":[]},\"source\":{\"detected_qa_count\":0,\"doc_title\":\"PulseWatch Technology Co., Ltd.\",\"file_name\":\"公司介绍模拟\",\"file_type\":\"docx\",\"text_len\":2255},\"warnings\":[]}","createdAt":"2026-06-03T20:49:13"},{"id":2,"userId":37,"workflowId":"7644852197557108742","fileUrl":"https://ydan.oss-cn-shenzhen.aliyuncs.com/uploads/1f140c9dbdf34028889ff0c59b2a2d8c_1780490606421.docx","fileName":"公司介绍模拟","docTitle":"PulseWatch Technology Co., Ltd.","fileType":"docx","textLen":2255,"categoryKey":"faq","categoryLabel":"百问百答","countLabel":"Word","fileLabel":"Word","cardDesc":"介绍深圳PulseWatch科技的核心产品、产能资质、服务政策与全球市场布局","cardTitle":"PulseWatch科技公司介绍","definitionConfidence":0.95,"definitionOneSentence":"这是一份智能穿戴设备厂商的公司介绍文件，涵盖公司概况、核心产品、产能资质、服务政策等内容，适合外贸销售向客户介绍企业实力与合作方案时使用。","definitionReason":"文档主体为公司完整介绍，不属于客户案例或内部复盘，符合faq分类规则。","summary":"本文件是深圳PulseWatch科技有限公司的官方介绍，详细说明了企业成立时间、总部地点、核心产品矩阵、制造产能、质量认证、全球市场覆盖范围、服务承诺及联系方式，可帮助外贸业务员快速向海外客户传递企业实力与合作优势。","mainTopics":"[\"公司基本概况\",\"核心产品系列\",\"制造生产能力\",\"质量认证体系\",\"全球市场布局\",\"客户服务承诺\",\"企业联系方式\"]","businessScenarios":"[\"新客户初次询盘回复\",\"客户企业实力考察\",\"合作意向初步沟通\",\"产品方案介绍\",\"售后政策说明\"]","keyFacts":"[\"公司2014年成立，总部位于中国深圳\",\"是智能手表、健身追踪器等穿戴设备的垂直整合设计与制造商\",\"产品销往北美、欧洲等60多个国家和地区\",\"拥有深圳宝安12000平方米工厂，通过ISO9001/ISO14001认证\",\"配备6条SMT生产线、10条组装线，月产能30万台成品可穿戴设备\",\"产品通过CE、RED、RoHS、FCC等多项国际认证\",\"提供OEM/ODM定制服务，含私模和品牌UI定制\",\"样品交期5-7天（库存款），量产交期25-35天\",\"提供1-2年质保与全球RMA支持\"]","keywords":"[\"PulseWatch\",\"智能穿戴设备\",\"外贸厂商\",\"OEM/ODM\",\"公司介绍\"]","products":"[\"运动智能手表\",\"时尚系列智能手表\",\"老人儿童健康追踪器\",\"轻量化健身手环\",\"户外GPS手表\",\"智能穿戴定制服务\"]","countries":"[\"美国\",\"德国\",\"法国\",\"英国\",\"墨西哥\",\"巴西\",\"阿联酋\",\"沙特阿拉伯\",\"澳大利亚\",\"越南\"]","businessTerms":"[\"OEM\",\"ODM\",\"样品交期\",\"量产交期\",\"质保\",\"RMA支持\",\"认证\"]","quickFilters":"[\"产品\",\"产能\",\"认证\",\"交期\",\"售后\",\"市场\"]","tags":"[\"#智能穿戴\",\"#外贸厂商\",\"#公司介绍\",\"#OEM/ODM\",\"#全球供应链\"]","rawJson":"{\"card\":{\"category_key\":\"faq\",\"category_label\":\"百问百答\",\"count_label\":\"Word\",\"desc\":\"介绍深圳PulseWatch科技的核心产品、产能资质、服务政策与全球市场布局\",\"file_label\":\"Word\",\"quick_filters\":[\"产品\",\"产能\",\"认证\",\"交期\",\"售后\",\"市场\"],\"tags\":[\"#智能穿戴\",\"#外贸厂商\",\"#公司介绍\",\"#OEM/ODM\",\"#全球供应链\"],\"title\":\"PulseWatch科技公司介绍\"},\"content_profile\":{\"business_scenarios\":[\"新客户初次询盘回复\",\"客户企业实力考察\",\"合作意向初步沟通\",\"产品方案介绍\",\"售后政策说明\"],\"key_facts\":[\"公司2014年成立，总部位于中国深圳\",\"是智能手表、健身追踪器等穿戴设备的垂直整合设计与制造商\",\"产品销往北美、欧洲等60多个国家和地区\",\"拥有深圳宝安12000平方米工厂，通过ISO9001/ISO14001认证\",\"配备6条SMT生产线、10条组装线，月产能30万台成品可穿戴设备\",\"产品通过CE、RED、RoHS、FCC等多项国际认证\",\"提供OEM/ODM定制服务，含私模和品牌UI定制\",\"样品交期5-7天（库存款），量产交期25-35天\",\"提供1-2年质保与全球RMA支持\"],\"main_topics\":[\"公司基本概况\",\"核心产品系列\",\"制造生产能力\",\"质量认证体系\",\"全球市场布局\",\"客户服务承诺\",\"企业联系方式\"],\"summary\":\"本文件是深圳PulseWatch科技有限公司的官方介绍，详细说明了企业成立时间、总部地点、核心产品矩阵、制造产能、质量认证、全球市场覆盖范围、服务承诺及联系方式，可帮助外贸业务员快速向海外客户传递企业实力与合作优势。\"},\"definition\":{\"category_key\":\"faq\",\"category_label\":\"百问百答\",\"confidence\":0.95,\"file_type_name\":\"公司介绍类资料\",\"one_sentence\":\"这是一份智能穿戴设备厂商的公司介绍文件，涵盖公司概况、核心产品、产能资质、服务政策等内容，适合外贸销售向客户介绍企业实力与合作方案时使用。\",\"reason\":\"文档主体为公司完整介绍，不属于客户案例或内部复盘，符合faq分类规则。\"},\"error\":\"\",\"ok\":true,\"qa_items\":[],\"search_index\":{\"business_terms\":[\"OEM\",\"ODM\",\"样品交期\",\"量产交期\",\"质保\",\"RMA支持\",\"认证\"],\"countries\":[\"美国\",\"德国\",\"法国\",\"英国\",\"墨西哥\",\"巴西\",\"阿联酋\",\"沙特阿拉伯\",\"澳大利亚\",\"越南\"],\"keywords\":[\"PulseWatch\",\"智能穿戴设备\",\"外贸厂商\",\"OEM/ODM\",\"公司介绍\"],\"products\":[\"运动智能手表\",\"时尚系列智能手表\",\"老人儿童健康追踪器\",\"轻量化健身手环\",\"户外GPS手表\",\"智能穿戴定制服务\"],\"questions\":[]},\"source\":{\"detected_qa_count\":0,\"doc_title\":\"PulseWatch Technology Co., Ltd.\",\"file_name\":\"公司介绍模拟\",\"file_type\":\"docx\",\"text_len\":2255},\"warnings\":[]}","createdAt":"2026-06-03T20:43:47"}],"total":2,"size":10,"current":1,"pages":1},"error":false,"ok":true}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 分类数目和快捷搜索数据

GET /index/fileAnalysis/categoryStats

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{"code":0,"msg":"操作成功","data":{"records":[{"id":3,"userId":37,"workflowId":"7644852197557108742","fileUrl":"https://ydan.oss-cn-shenzhen.aliyuncs.com/uploads/81c2e63ddd124927b43fe51008833b01_1780490934833.docx","fileName":"公司介绍模拟","docTitle":"PulseWatch Technology Co., Ltd.","fileType":"docx","textLen":2255,"categoryKey":"faq","categoryLabel":"百问百答","countLabel":"Word","fileLabel":"Word","cardDesc":"提供深圳智能穿戴设备厂商的企业资质、产品、产能及服务信息，助力外贸业务前期客户沟通","cardTitle":"PulseWatch科技公司介绍","definitionConfidence":0.95,"definitionOneSentence":"这是一份深圳PulseWatch科技公司的介绍文件，涵盖公司概况、核心产品、产能资质、市场服务等内容，适合外贸业务中客户初步沟通、需求匹配时调用。","definitionReason":"文档为完整的企业介绍资料，不属于客户案例或内部复盘，符合faq分类规则。","summary":"本文件详细介绍了深圳PulseWatch科技有限公司的基本情况，包括2014年成立的垂直整合智能穿戴设备设计制造商身份，核心产品覆盖运动智能手表、时尚系列、老人儿童健康 tracker等，同时展示了工厂产能、质量认证、全球市场布局及服务承诺，可帮助外贸业务员快速向客户传递企业实力与业务范围。","mainTopics":"[\"企业基本概况\",\"核心产品系列\",\"生产制造能力\",\"质量认证体系\",\"全球市场分布\",\"客户服务承诺\",\"联系方式\"]","businessScenarios":"[\"新客户初次询盘回复\",\"客户资质背景查询\",\"产品选型推荐\",\"产能交付能力说明\",\"认证合规性解释\",\"售后政策沟通\"]","keyFacts":"[\"2014年成立，总部位于中国深圳\",\"是智能手表、健身 tracker及连接穿戴设备的垂直整合设计制造商\",\"产品销往北美、欧洲等60多个国家和地区\",\"拥有深圳宝安12000平方米工厂，通过ISO9001/ISO14001认证\",\"配备6条SMT生产线、10条组装线，月产能30万台成品穿戴设备\",\"产品通过CE、RED、RoHS、FCC等多项国际认证\",\"提供OEM/ODM定制服务，含私模和品牌UI定制\",\"样品交期5-7天（库存款）、15-20天（OEM款）\",\"批量生产交期为PI确认后25-35天\",\"提供1-2年质保及全球RMA支持\"]","keywords":"[\"PulseWatch\",\"智能穿戴设备\",\"外贸厂商\",\"OEM/ODM\"]","products":"[\"运动智能手表\",\"时尚智能手表\",\"老人儿童健康 tracker\",\"轻量化健身手环\",\"户外GPS手表\",\"智能穿戴设备\"]","countries":"[\"美国\",\"德国\",\"法国\",\"英国\",\"墨西哥\",\"巴西\",\"阿联酋\",\"沙特阿拉伯\",\"澳大利亚\",\"越南\"]","businessTerms":"[\"OEM\",\"ODM\",\"样品交期\",\"批量交期\",\"质保\",\"RMA支持\",\"认证\"]","quickFilters":"[\"产品\",\"产能\",\"认证\",\"交期\",\"售后\",\"市场\"]","tags":"[\"#智能穿戴\",\"#外贸厂商\",\"#企业介绍\",\"#OEM/ODM\",\"#全球认证\"]","rawJson":"{\"card\":{\"category_key\":\"faq\",\"category_label\":\"百问百答\",\"count_label\":\"Word\",\"desc\":\"提供深圳智能穿戴设备厂商的企业资质、产品、产能及服务信息，助力外贸业务前期客户沟通\",\"file_label\":\"Word\",\"quick_filters\":[\"产品\",\"产能\",\"认证\",\"交期\",\"售后\",\"市场\"],\"tags\":[\"#智能穿戴\",\"#外贸厂商\",\"#企业介绍\",\"#OEM/ODM\",\"#全球认证\"],\"title\":\"PulseWatch科技公司介绍\"},\"content_profile\":{\"business_scenarios\":[\"新客户初次询盘回复\",\"客户资质背景查询\",\"产品选型推荐\",\"产能交付能力说明\",\"认证合规性解释\",\"售后政策沟通\"],\"key_facts\":[\"2014年成立，总部位于中国深圳\",\"是智能手表、健身 tracker及连接穿戴设备的垂直整合设计制造商\",\"产品销往北美、欧洲等60多个国家和地区\",\"拥有深圳宝安12000平方米工厂，通过ISO9001/ISO14001认证\",\"配备6条SMT生产线、10条组装线，月产能30万台成品穿戴设备\",\"产品通过CE、RED、RoHS、FCC等多项国际认证\",\"提供OEM/ODM定制服务，含私模和品牌UI定制\",\"样品交期5-7天（库存款）、15-20天（OEM款）\",\"批量生产交期为PI确认后25-35天\",\"提供1-2年质保及全球RMA支持\"],\"main_topics\":[\"企业基本概况\",\"核心产品系列\",\"生产制造能力\",\"质量认证体系\",\"全球市场分布\",\"客户服务承诺\",\"联系方式\"],\"summary\":\"本文件详细介绍了深圳PulseWatch科技有限公司的基本情况，包括2014年成立的垂直整合智能穿戴设备设计制造商身份，核心产品覆盖运动智能手表、时尚系列、老人儿童健康 tracker等，同时展示了工厂产能、质量认证、全球市场布局及服务承诺，可帮助外贸业务员快速向客户传递企业实力与业务范围。\"},\"definition\":{\"category_key\":\"faq\",\"category_label\":\"百问百答\",\"confidence\":0.95,\"file_type_name\":\"企业介绍型资料\",\"one_sentence\":\"这是一份深圳PulseWatch科技公司的介绍文件，涵盖公司概况、核心产品、产能资质、市场服务等内容，适合外贸业务中客户初步沟通、需求匹配时调用。\",\"reason\":\"文档为完整的企业介绍资料，不属于客户案例或内部复盘，符合faq分类规则。\"},\"error\":\"\",\"ok\":true,\"qa_items\":[],\"search_index\":{\"business_terms\":[\"OEM\",\"ODM\",\"样品交期\",\"批量交期\",\"质保\",\"RMA支持\",\"认证\"],\"countries\":[\"美国\",\"德国\",\"法国\",\"英国\",\"墨西哥\",\"巴西\",\"阿联酋\",\"沙特阿拉伯\",\"澳大利亚\",\"越南\"],\"keywords\":[\"PulseWatch\",\"智能穿戴设备\",\"外贸厂商\",\"OEM/ODM\"],\"products\":[\"运动智能手表\",\"时尚智能手表\",\"老人儿童健康 tracker\",\"轻量化健身手环\",\"户外GPS手表\",\"智能穿戴设备\"],\"questions\":[]},\"source\":{\"detected_qa_count\":0,\"doc_title\":\"PulseWatch Technology Co., Ltd.\",\"file_name\":\"公司介绍模拟\",\"file_type\":\"docx\",\"text_len\":2255},\"warnings\":[]}","createdAt":"2026-06-03T20:49:13"},{"id":2,"userId":37,"workflowId":"7644852197557108742","fileUrl":"https://ydan.oss-cn-shenzhen.aliyuncs.com/uploads/1f140c9dbdf34028889ff0c59b2a2d8c_1780490606421.docx","fileName":"公司介绍模拟","docTitle":"PulseWatch Technology Co., Ltd.","fileType":"docx","textLen":2255,"categoryKey":"faq","categoryLabel":"百问百答","countLabel":"Word","fileLabel":"Word","cardDesc":"介绍深圳PulseWatch科技的核心产品、产能资质、服务政策与全球市场布局","cardTitle":"PulseWatch科技公司介绍","definitionConfidence":0.95,"definitionOneSentence":"这是一份智能穿戴设备厂商的公司介绍文件，涵盖公司概况、核心产品、产能资质、服务政策等内容，适合外贸销售向客户介绍企业实力与合作方案时使用。","definitionReason":"文档主体为公司完整介绍，不属于客户案例或内部复盘，符合faq分类规则。","summary":"本文件是深圳PulseWatch科技有限公司的官方介绍，详细说明了企业成立时间、总部地点、核心产品矩阵、制造产能、质量认证、全球市场覆盖范围、服务承诺及联系方式，可帮助外贸业务员快速向海外客户传递企业实力与合作优势。","mainTopics":"[\"公司基本概况\",\"核心产品系列\",\"制造生产能力\",\"质量认证体系\",\"全球市场布局\",\"客户服务承诺\",\"企业联系方式\"]","businessScenarios":"[\"新客户初次询盘回复\",\"客户企业实力考察\",\"合作意向初步沟通\",\"产品方案介绍\",\"售后政策说明\"]","keyFacts":"[\"公司2014年成立，总部位于中国深圳\",\"是智能手表、健身追踪器等穿戴设备的垂直整合设计与制造商\",\"产品销往北美、欧洲等60多个国家和地区\",\"拥有深圳宝安12000平方米工厂，通过ISO9001/ISO14001认证\",\"配备6条SMT生产线、10条组装线，月产能30万台成品可穿戴设备\",\"产品通过CE、RED、RoHS、FCC等多项国际认证\",\"提供OEM/ODM定制服务，含私模和品牌UI定制\",\"样品交期5-7天（库存款），量产交期25-35天\",\"提供1-2年质保与全球RMA支持\"]","keywords":"[\"PulseWatch\",\"智能穿戴设备\",\"外贸厂商\",\"OEM/ODM\",\"公司介绍\"]","products":"[\"运动智能手表\",\"时尚系列智能手表\",\"老人儿童健康追踪器\",\"轻量化健身手环\",\"户外GPS手表\",\"智能穿戴定制服务\"]","countries":"[\"美国\",\"德国\",\"法国\",\"英国\",\"墨西哥\",\"巴西\",\"阿联酋\",\"沙特阿拉伯\",\"澳大利亚\",\"越南\"]","businessTerms":"[\"OEM\",\"ODM\",\"样品交期\",\"量产交期\",\"质保\",\"RMA支持\",\"认证\"]","quickFilters":"[\"产品\",\"产能\",\"认证\",\"交期\",\"售后\",\"市场\"]","tags":"[\"#智能穿戴\",\"#外贸厂商\",\"#公司介绍\",\"#OEM/ODM\",\"#全球供应链\"]","rawJson":"{\"card\":{\"category_key\":\"faq\",\"category_label\":\"百问百答\",\"count_label\":\"Word\",\"desc\":\"介绍深圳PulseWatch科技的核心产品、产能资质、服务政策与全球市场布局\",\"file_label\":\"Word\",\"quick_filters\":[\"产品\",\"产能\",\"认证\",\"交期\",\"售后\",\"市场\"],\"tags\":[\"#智能穿戴\",\"#外贸厂商\",\"#公司介绍\",\"#OEM/ODM\",\"#全球供应链\"],\"title\":\"PulseWatch科技公司介绍\"},\"content_profile\":{\"business_scenarios\":[\"新客户初次询盘回复\",\"客户企业实力考察\",\"合作意向初步沟通\",\"产品方案介绍\",\"售后政策说明\"],\"key_facts\":[\"公司2014年成立，总部位于中国深圳\",\"是智能手表、健身追踪器等穿戴设备的垂直整合设计与制造商\",\"产品销往北美、欧洲等60多个国家和地区\",\"拥有深圳宝安12000平方米工厂，通过ISO9001/ISO14001认证\",\"配备6条SMT生产线、10条组装线，月产能30万台成品可穿戴设备\",\"产品通过CE、RED、RoHS、FCC等多项国际认证\",\"提供OEM/ODM定制服务，含私模和品牌UI定制\",\"样品交期5-7天（库存款），量产交期25-35天\",\"提供1-2年质保与全球RMA支持\"],\"main_topics\":[\"公司基本概况\",\"核心产品系列\",\"制造生产能力\",\"质量认证体系\",\"全球市场布局\",\"客户服务承诺\",\"企业联系方式\"],\"summary\":\"本文件是深圳PulseWatch科技有限公司的官方介绍，详细说明了企业成立时间、总部地点、核心产品矩阵、制造产能、质量认证、全球市场覆盖范围、服务承诺及联系方式，可帮助外贸业务员快速向海外客户传递企业实力与合作优势。\"},\"definition\":{\"category_key\":\"faq\",\"category_label\":\"百问百答\",\"confidence\":0.95,\"file_type_name\":\"公司介绍类资料\",\"one_sentence\":\"这是一份智能穿戴设备厂商的公司介绍文件，涵盖公司概况、核心产品、产能资质、服务政策等内容，适合外贸销售向客户介绍企业实力与合作方案时使用。\",\"reason\":\"文档主体为公司完整介绍，不属于客户案例或内部复盘，符合faq分类规则。\"},\"error\":\"\",\"ok\":true,\"qa_items\":[],\"search_index\":{\"business_terms\":[\"OEM\",\"ODM\",\"样品交期\",\"量产交期\",\"质保\",\"RMA支持\",\"认证\"],\"countries\":[\"美国\",\"德国\",\"法国\",\"英国\",\"墨西哥\",\"巴西\",\"阿联酋\",\"沙特阿拉伯\",\"澳大利亚\",\"越南\"],\"keywords\":[\"PulseWatch\",\"智能穿戴设备\",\"外贸厂商\",\"OEM/ODM\",\"公司介绍\"],\"products\":[\"运动智能手表\",\"时尚系列智能手表\",\"老人儿童健康追踪器\",\"轻量化健身手环\",\"户外GPS手表\",\"智能穿戴定制服务\"],\"questions\":[]},\"source\":{\"detected_qa_count\":0,\"doc_title\":\"PulseWatch Technology Co., Ltd.\",\"file_name\":\"公司介绍模拟\",\"file_type\":\"docx\",\"text_len\":2255},\"warnings\":[]}","createdAt":"2026-06-03T20:43:47"}],"total":2,"size":10,"current":1,"pages":1},"error":false,"ok":true}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 快捷搜索接口

GET /index/fileAnalysis/searchByQuickFilterValue

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|query|integer| 否 |none|
|quickFilter|query|string| 否 |none|
|pageNum|query|integer| 否 |none|
|pageSize|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{"code":0,"msg":"操作成功","data":{"records":[{"id":3,"userId":37,"workflowId":"7644852197557108742","fileUrl":"https://ydan.oss-cn-shenzhen.aliyuncs.com/uploads/81c2e63ddd124927b43fe51008833b01_1780490934833.docx","fileName":"公司介绍模拟","docTitle":"PulseWatch Technology Co., Ltd.","fileType":"docx","textLen":2255,"categoryKey":"faq","categoryLabel":"百问百答","countLabel":"Word","fileLabel":"Word","cardDesc":"提供深圳智能穿戴设备厂商的企业资质、产品、产能及服务信息，助力外贸业务前期客户沟通","cardTitle":"PulseWatch科技公司介绍","definitionConfidence":0.95,"definitionOneSentence":"这是一份深圳PulseWatch科技公司的介绍文件，涵盖公司概况、核心产品、产能资质、市场服务等内容，适合外贸业务中客户初步沟通、需求匹配时调用。","definitionReason":"文档为完整的企业介绍资料，不属于客户案例或内部复盘，符合faq分类规则。","summary":"本文件详细介绍了深圳PulseWatch科技有限公司的基本情况，包括2014年成立的垂直整合智能穿戴设备设计制造商身份，核心产品覆盖运动智能手表、时尚系列、老人儿童健康 tracker等，同时展示了工厂产能、质量认证、全球市场布局及服务承诺，可帮助外贸业务员快速向客户传递企业实力与业务范围。","mainTopics":"[\"企业基本概况\",\"核心产品系列\",\"生产制造能力\",\"质量认证体系\",\"全球市场分布\",\"客户服务承诺\",\"联系方式\"]","businessScenarios":"[\"新客户初次询盘回复\",\"客户资质背景查询\",\"产品选型推荐\",\"产能交付能力说明\",\"认证合规性解释\",\"售后政策沟通\"]","keyFacts":"[\"2014年成立，总部位于中国深圳\",\"是智能手表、健身 tracker及连接穿戴设备的垂直整合设计制造商\",\"产品销往北美、欧洲等60多个国家和地区\",\"拥有深圳宝安12000平方米工厂，通过ISO9001/ISO14001认证\",\"配备6条SMT生产线、10条组装线，月产能30万台成品穿戴设备\",\"产品通过CE、RED、RoHS、FCC等多项国际认证\",\"提供OEM/ODM定制服务，含私模和品牌UI定制\",\"样品交期5-7天（库存款）、15-20天（OEM款）\",\"批量生产交期为PI确认后25-35天\",\"提供1-2年质保及全球RMA支持\"]","keywords":"[\"PulseWatch\",\"智能穿戴设备\",\"外贸厂商\",\"OEM/ODM\"]","products":"[\"运动智能手表\",\"时尚智能手表\",\"老人儿童健康 tracker\",\"轻量化健身手环\",\"户外GPS手表\",\"智能穿戴设备\"]","countries":"[\"美国\",\"德国\",\"法国\",\"英国\",\"墨西哥\",\"巴西\",\"阿联酋\",\"沙特阿拉伯\",\"澳大利亚\",\"越南\"]","businessTerms":"[\"OEM\",\"ODM\",\"样品交期\",\"批量交期\",\"质保\",\"RMA支持\",\"认证\"]","quickFilters":"[\"产品\",\"产能\",\"认证\",\"交期\",\"售后\",\"市场\"]","tags":"[\"#智能穿戴\",\"#外贸厂商\",\"#企业介绍\",\"#OEM/ODM\",\"#全球认证\"]","rawJson":"{\"card\":{\"category_key\":\"faq\",\"category_label\":\"百问百答\",\"count_label\":\"Word\",\"desc\":\"提供深圳智能穿戴设备厂商的企业资质、产品、产能及服务信息，助力外贸业务前期客户沟通\",\"file_label\":\"Word\",\"quick_filters\":[\"产品\",\"产能\",\"认证\",\"交期\",\"售后\",\"市场\"],\"tags\":[\"#智能穿戴\",\"#外贸厂商\",\"#企业介绍\",\"#OEM/ODM\",\"#全球认证\"],\"title\":\"PulseWatch科技公司介绍\"},\"content_profile\":{\"business_scenarios\":[\"新客户初次询盘回复\",\"客户资质背景查询\",\"产品选型推荐\",\"产能交付能力说明\",\"认证合规性解释\",\"售后政策沟通\"],\"key_facts\":[\"2014年成立，总部位于中国深圳\",\"是智能手表、健身 tracker及连接穿戴设备的垂直整合设计制造商\",\"产品销往北美、欧洲等60多个国家和地区\",\"拥有深圳宝安12000平方米工厂，通过ISO9001/ISO14001认证\",\"配备6条SMT生产线、10条组装线，月产能30万台成品穿戴设备\",\"产品通过CE、RED、RoHS、FCC等多项国际认证\",\"提供OEM/ODM定制服务，含私模和品牌UI定制\",\"样品交期5-7天（库存款）、15-20天（OEM款）\",\"批量生产交期为PI确认后25-35天\",\"提供1-2年质保及全球RMA支持\"],\"main_topics\":[\"企业基本概况\",\"核心产品系列\",\"生产制造能力\",\"质量认证体系\",\"全球市场分布\",\"客户服务承诺\",\"联系方式\"],\"summary\":\"本文件详细介绍了深圳PulseWatch科技有限公司的基本情况，包括2014年成立的垂直整合智能穿戴设备设计制造商身份，核心产品覆盖运动智能手表、时尚系列、老人儿童健康 tracker等，同时展示了工厂产能、质量认证、全球市场布局及服务承诺，可帮助外贸业务员快速向客户传递企业实力与业务范围。\"},\"definition\":{\"category_key\":\"faq\",\"category_label\":\"百问百答\",\"confidence\":0.95,\"file_type_name\":\"企业介绍型资料\",\"one_sentence\":\"这是一份深圳PulseWatch科技公司的介绍文件，涵盖公司概况、核心产品、产能资质、市场服务等内容，适合外贸业务中客户初步沟通、需求匹配时调用。\",\"reason\":\"文档为完整的企业介绍资料，不属于客户案例或内部复盘，符合faq分类规则。\"},\"error\":\"\",\"ok\":true,\"qa_items\":[],\"search_index\":{\"business_terms\":[\"OEM\",\"ODM\",\"样品交期\",\"批量交期\",\"质保\",\"RMA支持\",\"认证\"],\"countries\":[\"美国\",\"德国\",\"法国\",\"英国\",\"墨西哥\",\"巴西\",\"阿联酋\",\"沙特阿拉伯\",\"澳大利亚\",\"越南\"],\"keywords\":[\"PulseWatch\",\"智能穿戴设备\",\"外贸厂商\",\"OEM/ODM\"],\"products\":[\"运动智能手表\",\"时尚智能手表\",\"老人儿童健康 tracker\",\"轻量化健身手环\",\"户外GPS手表\",\"智能穿戴设备\"],\"questions\":[]},\"source\":{\"detected_qa_count\":0,\"doc_title\":\"PulseWatch Technology Co., Ltd.\",\"file_name\":\"公司介绍模拟\",\"file_type\":\"docx\",\"text_len\":2255},\"warnings\":[]}","createdAt":"2026-06-03T20:49:13"},{"id":2,"userId":37,"workflowId":"7644852197557108742","fileUrl":"https://ydan.oss-cn-shenzhen.aliyuncs.com/uploads/1f140c9dbdf34028889ff0c59b2a2d8c_1780490606421.docx","fileName":"公司介绍模拟","docTitle":"PulseWatch Technology Co., Ltd.","fileType":"docx","textLen":2255,"categoryKey":"faq","categoryLabel":"百问百答","countLabel":"Word","fileLabel":"Word","cardDesc":"介绍深圳PulseWatch科技的核心产品、产能资质、服务政策与全球市场布局","cardTitle":"PulseWatch科技公司介绍","definitionConfidence":0.95,"definitionOneSentence":"这是一份智能穿戴设备厂商的公司介绍文件，涵盖公司概况、核心产品、产能资质、服务政策等内容，适合外贸销售向客户介绍企业实力与合作方案时使用。","definitionReason":"文档主体为公司完整介绍，不属于客户案例或内部复盘，符合faq分类规则。","summary":"本文件是深圳PulseWatch科技有限公司的官方介绍，详细说明了企业成立时间、总部地点、核心产品矩阵、制造产能、质量认证、全球市场覆盖范围、服务承诺及联系方式，可帮助外贸业务员快速向海外客户传递企业实力与合作优势。","mainTopics":"[\"公司基本概况\",\"核心产品系列\",\"制造生产能力\",\"质量认证体系\",\"全球市场布局\",\"客户服务承诺\",\"企业联系方式\"]","businessScenarios":"[\"新客户初次询盘回复\",\"客户企业实力考察\",\"合作意向初步沟通\",\"产品方案介绍\",\"售后政策说明\"]","keyFacts":"[\"公司2014年成立，总部位于中国深圳\",\"是智能手表、健身追踪器等穿戴设备的垂直整合设计与制造商\",\"产品销往北美、欧洲等60多个国家和地区\",\"拥有深圳宝安12000平方米工厂，通过ISO9001/ISO14001认证\",\"配备6条SMT生产线、10条组装线，月产能30万台成品可穿戴设备\",\"产品通过CE、RED、RoHS、FCC等多项国际认证\",\"提供OEM/ODM定制服务，含私模和品牌UI定制\",\"样品交期5-7天（库存款），量产交期25-35天\",\"提供1-2年质保与全球RMA支持\"]","keywords":"[\"PulseWatch\",\"智能穿戴设备\",\"外贸厂商\",\"OEM/ODM\",\"公司介绍\"]","products":"[\"运动智能手表\",\"时尚系列智能手表\",\"老人儿童健康追踪器\",\"轻量化健身手环\",\"户外GPS手表\",\"智能穿戴定制服务\"]","countries":"[\"美国\",\"德国\",\"法国\",\"英国\",\"墨西哥\",\"巴西\",\"阿联酋\",\"沙特阿拉伯\",\"澳大利亚\",\"越南\"]","businessTerms":"[\"OEM\",\"ODM\",\"样品交期\",\"量产交期\",\"质保\",\"RMA支持\",\"认证\"]","quickFilters":"[\"产品\",\"产能\",\"认证\",\"交期\",\"售后\",\"市场\"]","tags":"[\"#智能穿戴\",\"#外贸厂商\",\"#公司介绍\",\"#OEM/ODM\",\"#全球供应链\"]","rawJson":"{\"card\":{\"category_key\":\"faq\",\"category_label\":\"百问百答\",\"count_label\":\"Word\",\"desc\":\"介绍深圳PulseWatch科技的核心产品、产能资质、服务政策与全球市场布局\",\"file_label\":\"Word\",\"quick_filters\":[\"产品\",\"产能\",\"认证\",\"交期\",\"售后\",\"市场\"],\"tags\":[\"#智能穿戴\",\"#外贸厂商\",\"#公司介绍\",\"#OEM/ODM\",\"#全球供应链\"],\"title\":\"PulseWatch科技公司介绍\"},\"content_profile\":{\"business_scenarios\":[\"新客户初次询盘回复\",\"客户企业实力考察\",\"合作意向初步沟通\",\"产品方案介绍\",\"售后政策说明\"],\"key_facts\":[\"公司2014年成立，总部位于中国深圳\",\"是智能手表、健身追踪器等穿戴设备的垂直整合设计与制造商\",\"产品销往北美、欧洲等60多个国家和地区\",\"拥有深圳宝安12000平方米工厂，通过ISO9001/ISO14001认证\",\"配备6条SMT生产线、10条组装线，月产能30万台成品可穿戴设备\",\"产品通过CE、RED、RoHS、FCC等多项国际认证\",\"提供OEM/ODM定制服务，含私模和品牌UI定制\",\"样品交期5-7天（库存款），量产交期25-35天\",\"提供1-2年质保与全球RMA支持\"],\"main_topics\":[\"公司基本概况\",\"核心产品系列\",\"制造生产能力\",\"质量认证体系\",\"全球市场布局\",\"客户服务承诺\",\"企业联系方式\"],\"summary\":\"本文件是深圳PulseWatch科技有限公司的官方介绍，详细说明了企业成立时间、总部地点、核心产品矩阵、制造产能、质量认证、全球市场覆盖范围、服务承诺及联系方式，可帮助外贸业务员快速向海外客户传递企业实力与合作优势。\"},\"definition\":{\"category_key\":\"faq\",\"category_label\":\"百问百答\",\"confidence\":0.95,\"file_type_name\":\"公司介绍类资料\",\"one_sentence\":\"这是一份智能穿戴设备厂商的公司介绍文件，涵盖公司概况、核心产品、产能资质、服务政策等内容，适合外贸销售向客户介绍企业实力与合作方案时使用。\",\"reason\":\"文档主体为公司完整介绍，不属于客户案例或内部复盘，符合faq分类规则。\"},\"error\":\"\",\"ok\":true,\"qa_items\":[],\"search_index\":{\"business_terms\":[\"OEM\",\"ODM\",\"样品交期\",\"量产交期\",\"质保\",\"RMA支持\",\"认证\"],\"countries\":[\"美国\",\"德国\",\"法国\",\"英国\",\"墨西哥\",\"巴西\",\"阿联酋\",\"沙特阿拉伯\",\"澳大利亚\",\"越南\"],\"keywords\":[\"PulseWatch\",\"智能穿戴设备\",\"外贸厂商\",\"OEM/ODM\",\"公司介绍\"],\"products\":[\"运动智能手表\",\"时尚系列智能手表\",\"老人儿童健康追踪器\",\"轻量化健身手环\",\"户外GPS手表\",\"智能穿戴定制服务\"],\"questions\":[]},\"source\":{\"detected_qa_count\":0,\"doc_title\":\"PulseWatch Technology Co., Ltd.\",\"file_name\":\"公司介绍模拟\",\"file_type\":\"docx\",\"text_len\":2255},\"warnings\":[]}","createdAt":"2026-06-03T20:43:47"}],"total":2,"size":10,"current":1,"pages":1},"error":false,"ok":true}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

# 邀请码模块

## POST 批量生成邀请码

POST /auth/invite-code/generate

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|batchName|query|string| 否 |none|
|points|query|integer| 否 |none|
|quantity|query|integer| 否 |none|
|expiryDate|query|string| 否 |none|
|salesOwner|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{"code":0,"msg":"操作成功","data":"批量生成成功！共生成 10 个邀请码","error":false,"ok":true}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 分页查询邀请码

GET /auth/invite-code/page

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|pageNum|query|string| 否 |none|
|pageSize|query|string| 否 |none|

> 返回示例

> 200 Response

```json
{"code":0,"msg":"操作成功","data":"批量生成成功！共生成 10 个邀请码","error":false,"ok":true}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## DELETE 删除邀请码

DELETE /auth/invite-code/delete

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{"code":0,"msg":"操作成功","data":"批量生成成功！共生成 10 个邀请码","error":false,"ok":true}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 查询用户邀请码

GET /auth/user-invite-code/user

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{"code":0,"msg":"操作成功","data":"批量生成成功！共生成 10 个邀请码","error":false,"ok":true}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 获取邀请用户列表

GET /auth/invite-code/getInviteUsers

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|query|integer| 否 |none|
|pageNum|query|integer| 否 |none|
|pageSize|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{"code":0,"msg":"操作成功","data":"批量生成成功！共生成 10 个邀请码","error":false,"ok":true}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

# 支付宝支付

## POST 获取支付宝支付链接

POST /index/pay/ali/pagePay

> Body 请求参数

```json
{
    "outTradeNo": "ORDER20260629001",
    "totalAmount": "88.88",
    "subject": "iPhone 16G 手机"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{"msg":"success","code":0,"data":"<form name=\"punchout_form\" method=\"post\" action=\"https://openapi.alipay.com/gateway.do?charset=UTF-8&method=alipay.trade.page.pay&sign=SVVCdM4Zgl9QjNlVDqJLimDT%2FDtbMPyh83N7%2BS%2BjmdzYUrzHz%2BxW6X7XkKINi5r90NVO9Lfz0TeNa%2F1%2F0FpCBvZ8Y2BklOIkQ6gMNTfUTFBs%2FUqvWL95GzRdCsco2efhk%2B0BMc3a5r4eOeM9HHHHS5TuRBkUYe2p5nGUINEPBM9qcfe0SIvR%2Byp0aib5hCWAjV6sVQCEux1UTCqOmTyS0ep3cX52oVffB0jQpy3ls7HR5CZq5qtTZG3yjLG81brCuoW8BvLOIXH9JARb7YBAhp9gGs3tj7LOoTatgWGJ14wH8Rb5YB9RdmyCDyF7zHeoD6Jihn2zD6rvAj40qAt1MQ%3D%3D&version=1.0&app_id=2021006167668095&sign_type=RSA2&timestamp=2026-06-30+14%3A16%3A18&alipay_sdk=alipay-sdk-java-4.40.865.ALL&format=json\">\n<input type=\"hidden\" name=\"biz_content\" value=\"{&quot;extend_params&quot;:{},&quot;out_trade_no&quot;:&quot;ORDER20260629001&quot;,&quot;product_code&quot;:&quot;FAST_INSTANT_TRADE_PAY&quot;,&quot;subject&quot;:&quot;iPhone 16G 手机&quot;,&quot;total_amount&quot;:&quot;88.88&quot;}\">\n<input type=\"submit\" value=\"立即支付\" style=\"display:none\" >\n</form>\n<script>document.forms[0].submit();</script>"}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 查询支付订单详情

POST /index/pay/ali/query

> Body 请求参数

```json
{
    "outTradeNo": "ORDER20260629002"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{"msg":"success","code":0,"data":"<form name=\"punchout_form\" method=\"post\" action=\"https://openapi.alipay.com/gateway.do?charset=UTF-8&method=alipay.trade.page.pay&sign=SVVCdM4Zgl9QjNlVDqJLimDT%2FDtbMPyh83N7%2BS%2BjmdzYUrzHz%2BxW6X7XkKINi5r90NVO9Lfz0TeNa%2F1%2F0FpCBvZ8Y2BklOIkQ6gMNTfUTFBs%2FUqvWL95GzRdCsco2efhk%2B0BMc3a5r4eOeM9HHHHS5TuRBkUYe2p5nGUINEPBM9qcfe0SIvR%2Byp0aib5hCWAjV6sVQCEux1UTCqOmTyS0ep3cX52oVffB0jQpy3ls7HR5CZq5qtTZG3yjLG81brCuoW8BvLOIXH9JARb7YBAhp9gGs3tj7LOoTatgWGJ14wH8Rb5YB9RdmyCDyF7zHeoD6Jihn2zD6rvAj40qAt1MQ%3D%3D&version=1.0&app_id=2021006167668095&sign_type=RSA2&timestamp=2026-06-30+14%3A16%3A18&alipay_sdk=alipay-sdk-java-4.40.865.ALL&format=json\">\n<input type=\"hidden\" name=\"biz_content\" value=\"{&quot;extend_params&quot;:{},&quot;out_trade_no&quot;:&quot;ORDER20260629001&quot;,&quot;product_code&quot;:&quot;FAST_INSTANT_TRADE_PAY&quot;,&quot;subject&quot;:&quot;iPhone 16G 手机&quot;,&quot;total_amount&quot;:&quot;88.88&quot;}\">\n<input type=\"submit\" value=\"立即支付\" style=\"display:none\" >\n</form>\n<script>document.forms[0].submit();</script>"}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## POST 创建支付宝订单

POST /index/pay/ali/create

> Body 请求参数

```json
{
    "userId": 1111,
    "totalAmount": 199.99,
    "subject": "华为 Mate 60 Pro",
    "body": "华为 Mate 60 Pro 昆仑玻璃版 5G智能手机 256GB",
    "orderPoint": 1111
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|

> 返回示例

> 200 Response

```json
{"msg":"success","code":0,"data":"<form name=\"punchout_form\" method=\"post\" action=\"https://openapi.alipay.com/gateway.do?charset=UTF-8&method=alipay.trade.page.pay&sign=SVVCdM4Zgl9QjNlVDqJLimDT%2FDtbMPyh83N7%2BS%2BjmdzYUrzHz%2BxW6X7XkKINi5r90NVO9Lfz0TeNa%2F1%2F0FpCBvZ8Y2BklOIkQ6gMNTfUTFBs%2FUqvWL95GzRdCsco2efhk%2B0BMc3a5r4eOeM9HHHHS5TuRBkUYe2p5nGUINEPBM9qcfe0SIvR%2Byp0aib5hCWAjV6sVQCEux1UTCqOmTyS0ep3cX52oVffB0jQpy3ls7HR5CZq5qtTZG3yjLG81brCuoW8BvLOIXH9JARb7YBAhp9gGs3tj7LOoTatgWGJ14wH8Rb5YB9RdmyCDyF7zHeoD6Jihn2zD6rvAj40qAt1MQ%3D%3D&version=1.0&app_id=2021006167668095&sign_type=RSA2&timestamp=2026-06-30+14%3A16%3A18&alipay_sdk=alipay-sdk-java-4.40.865.ALL&format=json\">\n<input type=\"hidden\" name=\"biz_content\" value=\"{&quot;extend_params&quot;:{},&quot;out_trade_no&quot;:&quot;ORDER20260629001&quot;,&quot;product_code&quot;:&quot;FAST_INSTANT_TRADE_PAY&quot;,&quot;subject&quot;:&quot;iPhone 16G 手机&quot;,&quot;total_amount&quot;:&quot;88.88&quot;}\">\n<input type=\"submit\" value=\"立即支付\" style=\"display:none\" >\n</form>\n<script>document.forms[0].submit();</script>"}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 获取用户账单列表

GET /index/pay/ali/query/page

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|query|integer| 否 |none|
|pageNum|query|integer| 否 |none|
|pageSize|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{"msg":"success","code":0,"data":"<form name=\"punchout_form\" method=\"post\" action=\"https://openapi.alipay.com/gateway.do?charset=UTF-8&method=alipay.trade.page.pay&sign=SVVCdM4Zgl9QjNlVDqJLimDT%2FDtbMPyh83N7%2BS%2BjmdzYUrzHz%2BxW6X7XkKINi5r90NVO9Lfz0TeNa%2F1%2F0FpCBvZ8Y2BklOIkQ6gMNTfUTFBs%2FUqvWL95GzRdCsco2efhk%2B0BMc3a5r4eOeM9HHHHS5TuRBkUYe2p5nGUINEPBM9qcfe0SIvR%2Byp0aib5hCWAjV6sVQCEux1UTCqOmTyS0ep3cX52oVffB0jQpy3ls7HR5CZq5qtTZG3yjLG81brCuoW8BvLOIXH9JARb7YBAhp9gGs3tj7LOoTatgWGJ14wH8Rb5YB9RdmyCDyF7zHeoD6Jihn2zD6rvAj40qAt1MQ%3D%3D&version=1.0&app_id=2021006167668095&sign_type=RSA2&timestamp=2026-06-30+14%3A16%3A18&alipay_sdk=alipay-sdk-java-4.40.865.ALL&format=json\">\n<input type=\"hidden\" name=\"biz_content\" value=\"{&quot;extend_params&quot;:{},&quot;out_trade_no&quot;:&quot;ORDER20260629001&quot;,&quot;product_code&quot;:&quot;FAST_INSTANT_TRADE_PAY&quot;,&quot;subject&quot;:&quot;iPhone 16G 手机&quot;,&quot;total_amount&quot;:&quot;88.88&quot;}\">\n<input type=\"submit\" value=\"立即支付\" style=\"display:none\" >\n</form>\n<script>document.forms[0].submit();</script>"}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

# 积分日志

## GET 获取积分日志

GET /index/point-log/add-point-logs

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|query|integer| 否 |none|
|pageNum|query|integer| 否 |none|
|pageSize|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

## GET 消耗积分日志

GET /index/point-log/minus-point-logs

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|query|integer| 否 |none|
|pageNum|query|integer| 否 |none|
|pageSize|query|integer| 否 |none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

# 数据模型
