---
name: yingdan-dify-high-concurrency-test
description: Diagnose production Dify Chatflow latency and failures from a formal feature URL by running configurable concurrent POST requests against the winning-app backend, optionally running a direct Dify control batch, and correlating Dify Console logs for a specific user such as 39. Use when the user asks to load-test a top-yd.com Dify page, determine whether latency or 504 errors originate in the backend or Dify, find matching workflow runs or failed nodes, or repeat the production diagnostic with Chrome used only to bootstrap missing Console access.
---

# 赢单 Dify 高并发测试

Use the bundled Python script for deterministic production load tests and Dify log correlation. Chrome is only a one-time credential bootstrap: the operator manually copies the App ID and complete Console Cookie from F12 into the Skill-local `.env`. The script derives the CSRF header from that Cookie. After that, run role discovery, traffic generation, pagination, marker matching, user filtering, workflow lookup, and failed-node inspection with the Python script.

## Execution priority

Follow this order without waiting for the user to volunteer every value:

1. Read the Skill-local `.env`.
2. If `DIFY_APP_ID` is missing, use the Chrome plugin with the existing logged-in Dify session to open the exact target application and read its UUID from the visible application URL or Console request URL.
3. If the Console Cookie is missing or expired, use the Chrome plugin to open the correct application Logs page and position the operator at the matching read-only Network request. Ask the operator to copy its complete Cookie with F12 and save it to `.env`; do not ask separately for CSRF unless automatic extraction reports that the Cookie is incomplete.
4. As soon as `.env` is complete, stop using Chrome. Run all load generation, pagination, user filtering, marker correlation, workflow lookup, timing analysis, and failed-node inspection with the Python script.

Do not ask the user for an App ID before attempting to read it from the visible logged-in Dify page. Do not perform row-by-row log inspection in Chrome merely because Chrome was used for bootstrap.

Chrome control must not inspect or export cookies, local storage, browser profiles, passwords, or session stores. Therefore the Cookie handoff requires the operator's one-time F12 copy; do not bypass this boundary through Chrome profile files, macOS Keychain, or hidden browser state.

## Safety gates

1. Obtain explicit authorization for the production URL and requested concurrency.
2. Use only synthetic diagnostic messages; never send customer data.
3. Run one production preflight before the concurrent batch. Stop if it fails.
4. Never retry POST requests automatically; retries can duplicate calls and charges.
5. Credentials may be stored only in the ignored, permission-`600` Skill-local `.env` when the operator explicitly chooses that workflow. Never print them, copy them into reports, or commit them.
6. Treat Console endpoints as internal and version-sensitive. Use them read-only.

## Get Console values from Chrome F12

Use this only when the Console values are missing or expired. When the values were not supplied, first use the Chrome plugin to open the exact Dify application and its Logs page. The operator performs the sensitive value copy manually; the agent must not inspect Chrome cookies, local storage, profiles, password stores, or session stores.

1. Log in to Dify Cloud, open the exact target application, and enter its **Logs** page.
2. Press `F12`, select **Network**, then select **Fetch/XHR**. Clear the old requests and refresh the Logs page.
3. Select one successful `GET` request whose URL contains either:
   - `/console/api/apps/<APP_ID>/chat-conversations`, or
   - `/console/api/apps/<APP_ID>/advanced-chat/workflow-runs`.
4. Read only these values from **Headers → Request Headers**:
   - `DIFY_APP_ID`: the UUID between `/apps/` and the next `/` in the Request URL. The same UUID is usually visible in the Dify application page URL.
   - `DIFY_CONSOLE_COOKIE`: the complete value after the `Cookie:` request header. Do not copy the literal `Cookie:` prefix. The complete value normally contains both the access-token Cookie and a `csrf_token` or `__Host-csrf_token` Cookie.
5. If Chrome hides the Cookie header, right-click the selected request and choose **Copy → Copy as cURL**. Copy only the complete Cookie value from that text; never execute or save the cURL command.
6. Put the values into:

```text
/Users/garden/YD/Prototype/.agents/skills/yingdan-dify-high-concurrency-test/.env
```

Use this shape:

```dotenv
DIFY_APP_ID=<UUID only>
DIFY_CONSOLE_COOKIE=<complete Cookie header value>
```

Do not put `Cookie:`, shell quotes, cURL flags, or the whole cURL command into `.env`. When Dify returns `401`, `403`, or a CSRF error, repeat these F12 steps and replace the expired Cookie.

Only when the script explicitly reports that the complete Cookie contains no recognizable CSRF value, copy the `X-CSRF-Token` request header into optional `DIFY_CSRF_TOKEN`. `DIFY_CONSOLE_AUTHORIZATION` is also an optional compatibility override and is not part of the normal setup.

## Run the script

The script is `scripts/dify_production_diagnostics.py`. It uses only the Python standard library.

Load-test a formal feature:

```bash
python3 scripts/dify_production_diagnostics.py load \
  --url 'https://top-yd.com/chat?menuId=23&subId=47&modelType=dify' \
  --concurrency 50 \
  --user 39 \
  --confirm-production
```

Run the production batch, a smaller direct-Dify control batch, and then correlate Console logs:

```bash
python3 scripts/dify_production_diagnostics.py both \
  --url 'https://top-yd.com/chat?menuId=23&subId=47&modelType=dify' \
  --concurrency 50 \
  --direct-concurrency 10 \
  --user 39 \
  --confirm-production
```

Query an existing marker without sending traffic:

```bash
python3 scripts/dify_production_diagnostics.py logs \
  --app-id '<DIFY_APP_UUID>' \
  --marker-prefix '<MARKER_PREFIX>' \
  --user 39 \
  --start '2026-07-28T17:20:00+08:00'
```

Query failed Advanced Chat runs and their failed nodes:

```bash
python3 scripts/dify_production_diagnostics.py logs \
  --app-id '<DIFY_APP_UUID>' \
  --user 39 \
  --failed-only \
  --start '2026-07-28T00:00:00+08:00'
```

Run the offline parser/statistics smoke test:

```bash
python3 scripts/dify_production_diagnostics.py self-test
```

## Credentials by operation

Load `Skill root/.env` automatically, then fall back to hidden terminal prompts. Never pass secrets as command-line flags.

| Operation | Required values |
| --- | --- |
| `logs` only | `DIFY_APP_ID` and complete `DIFY_CONSOLE_COOKIE` |
| `load` production test | `YD_ACCOUNT_TOKEN` |
| `both` with direct Dify control | All values above plus `DIFY_APP_API_KEY` |

`DIFY_CSRF_TOKEN` and `DIFY_CONSOLE_AUTHORIZATION` are compatibility overrides, not normal required values. `YD_API_BASE`, `DIFY_SERVICE_BASE`, and `DIFY_CONSOLE_BASE` are optional endpoint overrides.

An App API key cannot replace Console login credentials. When Console credentials are absent or expired, invoke the Chrome bootstrap automatically, obtain the visible App ID when possible, and guide the operator through the one-time complete-Cookie handoff. Do not automate password or MFA login.

## Interpret the comparison

Read `references/diagnostic-contract.md` before diagnosing backend-versus-Dify ownership.

Report separately:

- client HTTP distribution and fixed timeout boundary;
- time to the first SSE event and total duration;
- number and arrival spread of matching Dify conversations;
- workflow status, elapsed time, steps, and observed concurrency;
- direct-Dify control results at a smaller concurrency.

Strong backend-queue evidence is: production calls arrive at Dify in a long sequence with low observed concurrency, while the direct control batch starts quickly at higher concurrency. Fixed 504s followed by successful Dify runs mean the gateway timed out while background work continued.

Do not claim Dify failure merely because the frontend timed out. Do not claim backend failure without matching the production marker in Dify logs or running an appropriate direct control.
