# Dify Log Browser Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Token Mind branded Chrome Side Panel extension that reuses the current Dify Cloud Console session to query and redact failed Chatflow logs without Cookie copying, F12, a backend, or write requests.

**Architecture:** A Manifest V3 service worker observes only successful Dify Console GET request CSRF headers, keeps the confirmed token in `chrome.storage.session`, validates the active `/app/{app_id}/logs` tab, and runs a pure query engine through a hard-coded GET allowlist. A Side Panel submits structured filters and renders only the engine's redacted report.

**Tech Stack:** Chrome Manifest V3 (Chrome 114+), Side Panel API, `chrome.webRequest`, `chrome.storage.session`, native JavaScript, HTML/CSS, Node.js built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-20-dify-log-browser-extension-design.md`

## Global Constraints

- Create `dify-log-browser-extension/`; do not modify or merge with `browser-extension/`.
- Support only `https://cloud.dify.ai/app/{app_id}/logs` in version 0.1.0.
- Use native JavaScript with no runtime dependencies, build system, backend, or remote code.
- Use Token Mind branded icon assets copied from `tokenmind-skill-hub/public/brand/`.
- Send only the six Dify Console GET request families listed in the design spec.
- Never read, persist, log, render, or return Cookie, Authorization, inputs, outputs, prompts, answers, tool payloads, raw errors, or stack traces.
- Store the confirmed CSRF only in `chrome.storage.session`; clear it on extension/browser restart and after an authentication failure.
- Interpret and display time in `Asia/Shanghai`; default maximum page count is 30.
- Do not run, retry, stop, or mutate a Dify application or workflow.

---

### Task 1: Pure query engine and security policy

**Files:**
- Create: `dify-log-browser-extension/query-engine.js`
- Create: `dify-log-browser-extension/tests/query-engine.test.js`

**Interfaces:**
- Produces: `DifyLogQueryEngine.parseDifyLogsUrl(url)`, `buildTimeWindow(input, now)`, `isAllowedConsoleUrl(url, appId)`, `classifyError(value)`, `safeRun(run, nodes)`, and `queryLogs(options)`.
- `queryLogs(options)` consumes `{ getJson, appId, mode, userId, marker, start, end, maxPages, onProgress }` and returns a redacted report.

- [ ] **Step 1: Write failing tests for URL, time, allowlist, redaction, strict user matching, pagination, marker lookup, and coverage fields**

```js
test("parseDifyLogsUrl accepts only a Dify Cloud logs URL", () => {
  assert.deepEqual(engine.parseDifyLogsUrl("https://cloud.dify.ai/app/11111111-1111-4111-8111-111111111111/logs"), {
    origin: "https://cloud.dify.ai",
    appId: "11111111-1111-4111-8111-111111111111"
  });
  assert.equal(engine.parseDifyLogsUrl("https://cloud.dify.ai/app/11111111-1111-4111-8111-111111111111/workflow"), null);
});

test("safeRun removes raw business and error content", () => {
  const report = engine.safeRun({ id: "run-1", status: "failed", error: "private", inputs: { secret: true } }, []);
  assert.equal(JSON.stringify(report).includes("private"), false);
  assert.equal(JSON.stringify(report).includes("secret"), false);
});
```

- [ ] **Step 2: Run the engine test and verify RED**

Run: `node --test dify-log-browser-extension/tests/query-engine.test.js`

Expected: FAIL because `query-engine.js` and the exported functions do not exist.

- [ ] **Step 3: Implement the minimal pure engine**

```js
(function initDifyLogQueryEngine(globalScope) {
  const API_ORIGIN = "https://cloud.dify.ai";
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function parseDifyLogsUrl(value) {
    const url = new URL(value);
    const match = url.pathname.match(/^\/app\/([^/]+)\/logs\/?$/);
    if (url.origin !== API_ORIGIN || !match || !UUID_PATTERN.test(match[1])) return null;
    return { origin: API_ORIGIN, appId: match[1] };
  }

  function isAllowedConsoleUrl(value, appId) {
    const url = new URL(value);
    const encodedAppId = encodeURIComponent(appId);
    const base = `/console/api/apps/${encodedAppId}/`;
    const suffix = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : "";
    return url.origin === API_ORIGIN && [
      /^chat-conversations$/,
      /^chat-messages$/,
      /^advanced-chat\/workflow-runs$/,
      /^advanced-chat\/workflow-runs\/count$/,
      /^workflow-runs\/[^/]+$/,
      /^workflow-runs\/[^/]+\/node-executions$/
    ].some(pattern => pattern.test(suffix));
  }

  const api = { parseDifyLogsUrl, isAllowedConsoleUrl };
  globalScope.DifyLogQueryEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
```

Implement `queryLogs(options)` immediately below these policy functions. For `user-failed`, call `chat-conversations` first, strictly compare `from_end_user_session_id`, then intersect failed runs by `conversation_id`. For `app-failed`, page failed runs directly. For `marker`, strictly match conversations, scan `chat-messages` only in memory for the supplied marker, then resolve run IDs. All modes must load run detail and node executions with a three-worker queue before returning the final `buildReport` result.

- [ ] **Step 4: Run the engine tests and verify GREEN**

Run: `node --test dify-log-browser-extension/tests/query-engine.test.js`

Expected: all engine tests PASS with no network requests.

- [ ] **Step 5: Refactor comments and names while keeping tests green**

Run: `node --test dify-log-browser-extension/tests/query-engine.test.js`

Expected: PASS.

### Task 2: Manifest, CSRF observation, and authenticated read-only bridge

**Files:**
- Create: `dify-log-browser-extension/manifest.json`
- Create: `dify-log-browser-extension/background.js`
- Create: `dify-log-browser-extension/tests/background-policy.test.js`
- Create: `dify-log-browser-extension/icons/tokenmind-logo.svg`
- Create: `dify-log-browser-extension/icons/icon-16.png`
- Create: `dify-log-browser-extension/icons/icon-32.png`
- Create: `dify-log-browser-extension/icons/icon-48.png`
- Create: `dify-log-browser-extension/icons/icon-128.png`

**Interfaces:**
- Consumes: `DifyLogQueryEngine.parseDifyLogsUrl`, `isAllowedConsoleUrl`, and `queryLogs` from Task 1.
- Produces: runtime messages `GET_ACTIVE_CONTEXT`, `RUN_QUERY`, and progress events `QUERY_PROGRESS`.

- [ ] **Step 1: Write failing policy tests for minimal permissions, Token Mind icons, request-header filtering, and no Cookie APIs**

```js
test("manifest grants only Dify Cloud host access", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  assert.deepEqual(manifest.host_permissions, ["https://cloud.dify.ai/*"]);
  assert.equal(manifest.permissions.includes("cookies"), false);
});

test("background observes only X-CSRF-Token and never Cookie", () => {
  const source = fs.readFileSync(path.join(root, "background.js"), "utf8");
  assert.match(source, /x-csrf-token/i);
  assert.doesNotMatch(source, /chrome\.cookies/);
});
```

- [ ] **Step 2: Run the policy test and verify RED**

Run: `node --test dify-log-browser-extension/tests/background-policy.test.js`

Expected: FAIL because the manifest and background worker do not exist.

- [ ] **Step 3: Implement Manifest V3 and the service worker**

```js
importScripts("query-engine.js");

chrome.webRequest.onBeforeSendHeaders.addListener(
  captureCsrfCandidate,
  { urls: ["https://cloud.dify.ai/console/api/*"], types: ["xmlhttprequest"] },
  ["requestHeaders", "extraHeaders"]
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RUN_QUERY") {
    runQueryForValidatedTab(message).then(sendResponse, error => sendResponse(toSafeError(error)));
    return true;
  }
  return false;
});
```

The worker must correlate `requestId` with a 2xx `onCompleted` event before writing `{ csrfToken, capturedAt, origin }` to `chrome.storage.session`. Query URLs are built internally, validated against the active tab App ID, fetched with `credentials: "include"`, and never accept arbitrary headers or URLs from the panel.

- [ ] **Step 4: Copy Token Mind SVG and generate fixed PNG icon sizes**

Run: `sips -s format png <tokenmind favicon.svg> --out dify-log-browser-extension/icons/icon-source.png`, then resize copies to 16, 32, 48, and 128 pixels.

Expected: four square PNG files plus the transparent SVG used by the panel.

- [ ] **Step 5: Run policy and engine tests**

Run: `node --test dify-log-browser-extension/tests/*.test.js`

Expected: PASS.

### Task 3: Side Panel form and redacted results

**Files:**
- Create: `dify-log-browser-extension/sidepanel.html`
- Create: `dify-log-browser-extension/sidepanel.css`
- Create: `dify-log-browser-extension/sidepanel.js`
- Create: `dify-log-browser-extension/tests/sidepanel-contract.test.js`

**Interfaces:**
- Consumes: `GET_ACTIVE_CONTEXT`, `RUN_QUERY`, and `QUERY_PROGRESS` runtime messages from Task 2.
- Produces: structured query input `{ tabId, appId, mode, userId, marker, preset, start, end, maxPages }` with no arbitrary URL or headers.

- [ ] **Step 1: Write failing UI contract tests**

```js
test("side panel exposes the three approved query modes", () => {
  const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
  assert.match(html, /value="user-failed"/);
  assert.match(html, /value="app-failed"/);
  assert.match(html, /value="marker"/);
});

test("side panel renders text with DOM textContent and no innerHTML", () => {
  const source = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
  assert.match(source, /textContent/);
});
```

- [ ] **Step 2: Run the UI contract test and verify RED**

Run: `node --test dify-log-browser-extension/tests/sidepanel-contract.test.js`

Expected: FAIL because the Side Panel files do not exist.

- [ ] **Step 3: Implement the Token Mind branded Side Panel**

The form must display the active App ID, provide the three modes, the four time choices, user/marker conditional inputs, page limit, a single explicit query button, authentication guidance, progress, coverage cards, run cards, failed-node rows, and an empty state with the exact bounded wording from the spec.

All result values must be inserted with `textContent`. The panel must disable query outside a Dify logs page and must never render a raw response object.

- [ ] **Step 4: Run all extension tests**

Run: `node --test dify-log-browser-extension/tests/*.test.js`

Expected: PASS.

### Task 4: Project documentation, packaging, and static verification

**Files:**
- Modify: `CONTEXT.md`
- Create: `dify-log-browser-extension/CONTEXT.md`
- Create: `dify-log-browser-extension/package-extension.sh`
- Create: `dify-log-browser-extension/tests/package-contract.test.js`
- Create: `dify-log-browser-extension-v0.1.0.zip`

**Interfaces:**
- Consumes: the completed unpacked extension directory.
- Produces: a documented local entry point and a ZIP whose root contains `manifest.json`.

- [ ] **Step 1: Write a failing package contract test**

```js
test("packaging script includes manifest at the ZIP root and excludes tests", () => {
  const source = fs.readFileSync(path.join(root, "package-extension.sh"), "utf8");
  assert.match(source, /manifest\.json/);
  assert.match(source, /-x.*tests/);
});
```

- [ ] **Step 2: Run the package contract test and verify RED**

Run: `node --test dify-log-browser-extension/tests/package-contract.test.js`

Expected: FAIL because the packaging script does not exist.

- [ ] **Step 3: Add documentation and the deterministic packaging script**

`CONTEXT.md` must identify the new extension as independent from the inquiry analyzer, document its entry path, Dify-only permissions, Chrome 114 floor, query modes, and validation commands. The extension-local `CONTEXT.md` must explain file responsibilities, request flow, security boundaries, local loading, and troubleshooting without exposing credentials.

- [ ] **Step 4: Run offline verification**

Run:

```bash
node --test dify-log-browser-extension/tests/*.test.js
python3 -m json.tool dify-log-browser-extension/manifest.json
rg -n "chrome\.cookies|Authorization|Cookie|<all_urls>|http://\*/\*|https://\*/\*|innerHTML\s*=" dify-log-browser-extension --glob '!tests/**'
```

Expected: tests PASS, Manifest parses, and the scan finds no forbidden implementation.

- [ ] **Step 5: Build and inspect the ZIP**

Run: `sh dify-log-browser-extension/package-extension.sh`

Expected: `dify-log-browser-extension-v0.1.0.zip` exists, contains `manifest.json` at its root, and excludes tests and development docs.

### Task 5: Real Chrome installation and Dify smoke test

**Files:**
- Modify only if a failing browser test produces a reproducible defect; write a failing Node test before every fix.

**Interfaces:**
- Consumes: unpacked `dify-log-browser-extension/` and the user's existing logged-in Chrome session.
- Produces: installation evidence, visible Side Panel verification, and either a successful read-only query or an explicit authentication/coverage blocker.

- [ ] **Step 1: Open Chrome extension management and load the unpacked directory**

Use the user-requested Chrome control surface to open `chrome://extensions`, enable developer mode if needed, choose “Load unpacked”, and select `/Users/garden/YD/Prototype/dify-log-browser-extension`.

- [ ] **Step 2: Open an existing or inferred Dify application logs page**

Open `https://cloud.dify.ai/app/{app_id}/logs` in the same Chrome profile. Do not read cookies, local storage, passwords, profiles, or hidden session state.

- [ ] **Step 3: Open the Token Mind extension Side Panel and verify the active App ID**

Confirm the Token Mind icon, three query modes, time presets, disabled conditional fields, and current App ID are visible without layout overflow.

- [ ] **Step 4: Run one bounded read-only smoke query**

Use “应用失败” with a short recent window. The query must send only GET requests. If login or CSRF is missing, refresh the logs page once through the supported UI and report the blocker instead of copying credentials.

- [ ] **Step 5: Re-run automated verification after any browser-derived fix**

Run: `node --test dify-log-browser-extension/tests/*.test.js`

Expected: PASS.

### Task 6: Final scope review and handoff

**Files:**
- Review only: `dify-log-browser-extension/**`, `CONTEXT.md`, `dify-log-browser-extension-v0.1.0.zip`.

**Interfaces:**
- Produces: final verification summary and exact install path.

- [ ] **Step 1: Compare implementation to every design-spec requirement**

Confirm Token Mind branding, separate directory, Chrome 114+, no backend/build, Dify-only host permission, CSRF session storage, GET allowlist, three modes, timezone, default 30 pages, bounded concurrency, redaction, error handling, docs, tests, ZIP, and Chrome verification.

- [ ] **Step 2: Inspect scoped Git diff without staging unrelated user work**

Run: `git status --short` and `git diff -- dify-log-browser-extension CONTEXT.md docs/superpowers/plans/2026-08-20-dify-log-browser-extension.md`.

- [ ] **Step 3: Report delivered paths and verified boundaries**

State separately: automated tests, Chrome installation/UI verification, live read-only query result or blocker, files created, ZIP path, and that no Dify write request occurred.

- [ ] **Step 4: Remind the user to commit Git**

Use the exact project reminder: `记得提交 git 喔`
