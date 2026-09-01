# Diagnostic contract

## Request path

The formal page URL supplies `subId`. Resolve the live role before load:

```text
GET https://api.top-yd.com/index/role/getRoleMneuList?userId={user}
Authorization: Bearer {YD_ACCOUNT_TOKEN}
```

Find the role whose `id` or `type` equals `subId`. Use its real `type`, the selected `difyJson.models[].model_name`, and that model's `inputs`.

Production SSE:

```text
POST https://api.top-yd.com/index/dify/chat
Authorization: Bearer {YD_ACCOUNT_TOKEN}
Content-Type: application/json
Accept: text/event-stream
```

Payload:

```json
{
  "query": "[MARKER] synthetic diagnostic message",
  "user": 39,
  "conversation_id": "",
  "type": 47,
  "modelCode": "A",
  "inputs": {
    "skill_key": "visit-reception",
    "model_key": "deepseek-v4-flash"
  },
  "files": []
}
```

The backend currently derives Dify inputs from the stored role configuration. Still send the live inputs to mirror the formal frontend contract.

## Dify surfaces and authentication

| Surface | Prefix | Credential | Purpose |
| --- | --- | --- | --- |
| Published Service API | `/v1` | App API Key | Direct control run and `/info` |
| Console API | `/console/api` | Complete login Cookie + RBAC; script derives CSRF header | Conversations, messages, workflow runs, failed nodes |

Never use an App API key as Console authentication.

## Exact log correlation

Use `chat-conversations` only to identify user/time candidates:

```text
GET /console/api/apps/{app_id}/chat-conversations
    ?page=1
    &limit=100
    &start=YYYY-MM-DD 00:00
    &end=YYYY-MM-DD 23:59
    &sort_by=-created_at
    &annotation_status=all
```

Filter client-side:

```text
from_end_user_session_id == "39"
```

Read each candidate's messages and match the unique marker:

```text
GET /console/api/apps/{app_id}/chat-messages
    ?conversation_id={conversation_id}
    &limit=100
```

Then read each matched workflow:

```text
GET /console/api/apps/{app_id}/workflow-runs/{workflow_run_id}
GET /console/api/apps/{app_id}/workflow-runs/{workflow_run_id}/node-executions
```

## Failed Advanced Chat runs

Do not use `chat-conversations?status=failed`. Use:

```text
GET /console/api/apps/{app_id}/advanced-chat/workflow-runs
    ?triggered_from=app-run
    &status=failed
    &limit=100
    &last_id={previous_page_last_id}
```

Cross-reference its `conversation_id` against conversations filtered to user `39`. Fetch failed node executions and return only operational metadata plus redacted errors.

## Root-cause signals

- `504` clustered around a fixed boundary, such as 120 seconds: gateway timeout.
- All markers later appear as succeeded runs: work continued after the client timed out.
- Production Dify run starts spread over a long interval, with low observed concurrency: upstream admission is serialized or queued.
- Direct Dify control starts quickly with higher observed concurrency: production backend is the bottleneck.
- Direct Dify and production both show the same low concurrency: investigate Dify workspace/app limits or downstream provider limits.
- Workflow elapsed time is short but client first-event time is long: waiting occurs before workflow execution.

Validated source documents in this repository:

- `dify-chatflows/Dify-Chatflow内部API索引.md`
- `dify-chatflows/Dify-Chatflow失败日志查询.md`
