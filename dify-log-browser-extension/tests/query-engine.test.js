const assert = require("node:assert/strict");
const test = require("node:test");

/**
 * 加载待实现的查询引擎。
 *
 * 为什么要捕获模块不存在的异常：测试必须先于生产代码创建。第一次执行时，
 * 查询引擎还不存在；这里把“模块不存在”转换成普通断言失败，确保红灯来自
 * 缺少功能，而不是测试文件自身崩溃。
 *
 * @returns {Record<string, Function>} 查询引擎导出的函数集合。
 * @throws {Error} 本函数不主动抛异常；模块缺失时返回空对象。
 */
function loadEngine() {
  try {
    return require("../query-engine.js");
  } catch (error) {
    if (error && error.code === "MODULE_NOT_FOUND") {
      return {};
    }
    throw error;
  }
}

const engine = loadEngine();
const APP_ID = "11111111-1111-4111-8111-111111111111";

/**
 * 创建只按预设顺序返回 JSON 的离线客户端。
 *
 * 这个假客户端不接触网络，只记录查询引擎真正构造出的路径和参数。测试由此
 * 验证我们自己的分页、筛选和白名单合同，而不是验证一个虚构的 HTTP mock。
 *
 * @param {Array<unknown>} responses - 每次 GET 依次返回的完整 Dify 风格响应。
 * @returns {{ getJson: Function, calls: Array<{ path: string, params: Record<string, unknown> }> }} 客户端函数和调用记录。
 * @throws {Error} 预设响应耗尽时抛出，表示查询引擎发出了未预期请求。
 */
function createRecordingClient(responses) {
  const queue = [...responses];
  const calls = [];

  return {
    calls,
    async getJson(path, params = {}) {
      calls.push({ path, params: { ...params } });
      if (!queue.length) {
        throw new Error(`未预期的离线 GET：${path}`);
      }
      return queue.shift();
    }
  };
}

test("parseDifyLogsUrl 只接受 Dify Cloud 的应用日志页", () => {
  assert.equal(typeof engine.parseDifyLogsUrl, "function");

  assert.deepEqual(
    engine.parseDifyLogsUrl(`https://cloud.dify.ai/app/${APP_ID}/logs`),
    {
      origin: "https://cloud.dify.ai",
      appId: APP_ID
    }
  );
  assert.equal(
    engine.parseDifyLogsUrl(`https://cloud.dify.ai/app/${APP_ID}/workflow`),
    null
  );
  assert.equal(
    engine.parseDifyLogsUrl(`https://evil.example/app/${APP_ID}/logs`),
    null
  );
  assert.equal(engine.parseDifyLogsUrl("not-a-url"), null);
});

test("buildTimeWindow 把今天和自定义输入固定解释为北京时间", () => {
  assert.equal(typeof engine.buildTimeWindow, "function");

  const now = new Date("2026-08-20T02:30:00.000Z");
  assert.deepEqual(engine.buildTimeWindow({ preset: "today" }, now), {
    start: "2026-08-20T00:00:00+08:00",
    end: "2026-08-20T10:30:00+08:00",
    timezone: "Asia/Shanghai"
  });
  assert.deepEqual(engine.buildTimeWindow({ preset: "recent-1h" }, now), {
    start: "2026-08-20T09:30:00+08:00",
    end: "2026-08-20T10:30:00+08:00",
    timezone: "Asia/Shanghai"
  });
  assert.deepEqual(
    engine.buildTimeWindow({
      preset: "custom",
      start: "2026-08-20T08:15",
      end: "2026-08-20T09:45"
    }, now),
    {
      start: "2026-08-20T08:15:00+08:00",
      end: "2026-08-20T09:45:00+08:00",
      timezone: "Asia/Shanghai"
    }
  );
  assert.throws(
    () => engine.buildTimeWindow({ preset: "custom", start: "", end: "" }, now),
    /起止时间/
  );
});

test("isAllowedConsoleUrl 只允许当前应用的六类 Console GET 路径", () => {
  assert.equal(typeof engine.isAllowedConsoleUrl, "function");

  const base = `https://cloud.dify.ai/console/api/apps/${APP_ID}`;
  const allowed = [
    `${base}/chat-conversations`,
    `${base}/chat-messages`,
    `${base}/advanced-chat/workflow-runs`,
    `${base}/advanced-chat/workflow-runs/count`,
    `${base}/workflow-runs/run-1`,
    `${base}/workflow-runs/run-1/node-executions`
  ];

  allowed.forEach((url) => assert.equal(engine.isAllowedConsoleUrl(url, APP_ID), true, url));
  assert.equal(engine.isAllowedConsoleUrl(`${base}/delete`, APP_ID), false);
  assert.equal(
    engine.isAllowedConsoleUrl(
      "https://cloud.dify.ai/console/api/apps/22222222-2222-4222-8222-222222222222/chat-conversations",
      APP_ID
    ),
    false
  );
  assert.equal(
    engine.isAllowedConsoleUrl(`https://evil.example/console/api/apps/${APP_ID}/chat-conversations`, APP_ID),
    false
  );
});

test("safeRun 只保留运维白名单并把原始错误归类", () => {
  assert.equal(typeof engine.safeRun, "function");

  const safe = engine.safeRun(
    {
      id: "run-1",
      conversation_id: "conversation-1",
      status: "failed",
      triggered_from: "app-run",
      created_at: "2026-08-20T08:00:00+08:00",
      finished_at: "2026-08-20T08:00:05+08:00",
      elapsed_time: 5,
      total_steps: 2,
      total_tokens: 88,
      error: "HTTP 402 private account detail",
      inputs: { secret: "never-render" },
      outputs: { answer: "never-render" }
    },
    [{
      id: "node-1",
      node_id: "model-node",
      title: "Agent",
      node_type: "llm",
      status: "failed",
      error_category: "余额或计费边界"
    }]
  );

  assert.deepEqual(Object.keys(safe).sort(), [
    "conversation_id",
    "created_at",
    "elapsed_time",
    "error_category",
    "failed_nodes",
    "finished_at",
    "id",
    "status",
    "total_steps",
    "total_tokens",
    "triggered_from"
  ]);
  assert.equal(safe.error_category, "余额或计费边界");
  assert.equal(JSON.stringify(safe).includes("private account detail"), false);
  assert.equal(JSON.stringify(safe).includes("never-render"), false);
});

test("queryLogs 对 keyword 候选再次严格匹配用户 ID", async () => {
  assert.equal(typeof engine.queryLogs, "function");

  const client = createRecordingClient([
    {
      data: [
        {
          id: "conversation-exact",
          from_end_user_session_id: "129155",
          created_at: "2026-08-20T09:00:00+08:00"
        },
        {
          id: "conversation-fuzzy",
          from_end_user_session_id: "1291550",
          created_at: "2026-08-20T09:01:00+08:00"
        }
      ],
      has_more: false
    },
    {
      data: [
        {
          id: "run-exact",
          conversation_id: "conversation-exact",
          status: "failed",
          created_at: "2026-08-20T09:05:00+08:00"
        },
        {
          id: "run-fuzzy",
          conversation_id: "conversation-fuzzy",
          status: "failed",
          created_at: "2026-08-20T09:06:00+08:00"
        }
      ],
      has_more: false
    },
    {
      data: {
        id: "run-exact",
        conversation_id: "conversation-exact",
        status: "failed",
        triggered_from: "app-run",
        created_at: "2026-08-20T09:05:00+08:00",
        finished_at: "2026-08-20T09:05:03+08:00",
        elapsed_time: 3,
        total_steps: 1,
        total_tokens: 25,
        error: "Plugin Daemon private original error",
        inputs: { query: "customer content" }
      }
    },
    {
      data: [{
        id: "node-1",
        node_id: "tool-node",
        title: "工具调用",
        node_type: "tool",
        status: "failed",
        elapsed_time: 2,
        created_at: "2026-08-20T09:05:00+08:00",
        finished_at: "2026-08-20T09:05:02+08:00",
        retry_index: 0,
        error: "Plugin Daemon private node error",
        inputs: { private: true },
        outputs: { private: true }
      }]
    }
  ]);

  const report = await engine.queryLogs({
    getJson: client.getJson,
    appId: APP_ID,
    mode: "user-failed",
    userId: "129155",
    start: "2026-08-20T08:00:00+08:00",
    end: "2026-08-20T10:00:00+08:00",
    maxPages: 30
  });

  assert.equal(report.read_only, true);
  assert.equal(report.summary.candidate_conversations, 1);
  assert.equal(report.summary.failed_list_records, 1);
  assert.equal(report.summary.matched_runs, 1);
  assert.equal(report.summary.runs[0].id, "run-exact");
  assert.equal(report.summary.runs[0].error_category, "Plugin Daemon 异常");
  assert.equal(report.summary.runs[0].failed_nodes[0].error_category, "Plugin Daemon 异常");
  assert.equal(JSON.stringify(report).includes("customer content"), false);
  assert.equal(JSON.stringify(report).includes("private original error"), false);
  assert.deepEqual(client.calls[0].params, {
    keyword: "129155",
    page: 1,
    limit: 100,
    start: "2026-08-20 08:00",
    end: "2026-08-20 10:00",
    sort_by: "-created_at",
    annotation_status: "all"
  });
  assert.deepEqual(client.calls[1].params, {
    triggered_from: "app-run",
    status: "failed",
    limit: 100
  });
});

test("queryLogs 使用 last_id 分页并在整页早于起点后完整停止", async () => {
  assert.equal(typeof engine.queryLogs, "function");

  const client = createRecordingClient([
    {
      data: [{
        id: "run-in-window",
        conversation_id: "conversation-1",
        status: "failed",
        created_at: "2026-08-20T09:00:00+08:00"
      }],
      has_more: true
    },
    {
      data: [{
        id: "run-before-window",
        conversation_id: "conversation-old",
        status: "failed",
        created_at: "2026-08-20T06:00:00+08:00"
      }],
      has_more: true
    },
    {
      data: {
        id: "run-in-window",
        conversation_id: "conversation-1",
        status: "failed",
        created_at: "2026-08-20T09:00:00+08:00",
        error: "timeout private"
      }
    },
    { data: [] }
  ]);

  const report = await engine.queryLogs({
    getJson: client.getJson,
    appId: APP_ID,
    mode: "app-failed",
    start: "2026-08-20T08:00:00+08:00",
    end: "2026-08-20T10:00:00+08:00",
    maxPages: 30
  });

  assert.equal(client.calls[1].params.last_id, "run-in-window");
  assert.equal(report.summary.failed_run_pages, 2);
  assert.equal(report.summary.failed_run_window_complete, true);
  assert.equal(report.summary.failed_run_pages_truncated, false);
  assert.equal(report.summary.matched_runs, 1);
});

test("queryLogs 的 marker 模式只返回包含 marker 的 workflow run", async () => {
  assert.equal(typeof engine.queryLogs, "function");

  const marker = "TRACE-20260820-XYZ";
  const client = createRecordingClient([
    {
      data: [{
        id: "conversation-marker",
        from_end_user_session_id: "129155",
        created_at: "2026-08-20T09:00:00+08:00"
      }],
      has_more: false
    },
    {
      data: [
        { id: "message-1", query: `诊断 ${marker}`, workflow_run_id: "run-marker" },
        { id: "message-2", query: "其他请求", workflow_run_id: "run-other" }
      ]
    },
    {
      data: {
        id: "run-marker",
        conversation_id: "conversation-marker",
        status: "failed",
        created_at: "2026-08-20T09:02:00+08:00",
        error: "503 private service detail"
      }
    },
    { data: [] }
  ]);

  const report = await engine.queryLogs({
    getJson: client.getJson,
    appId: APP_ID,
    mode: "marker",
    userId: "129155",
    marker,
    start: "2026-08-20T08:00:00+08:00",
    end: "2026-08-20T10:00:00+08:00",
    maxPages: 30
  });

  assert.equal(report.summary.matched_messages, 1);
  assert.equal(report.summary.matched_runs, 1);
  assert.equal(report.summary.runs[0].id, "run-marker");
  assert.equal(JSON.stringify(report).includes(marker), false);
  assert.equal(JSON.stringify(report).includes("private service detail"), false);
});

