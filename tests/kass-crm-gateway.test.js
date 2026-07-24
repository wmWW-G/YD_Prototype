const test = require("node:test");
const assert = require("node:assert/strict");

const { createKassCrmGateway } = require("../lib/kass-crm-gateway");

/**
 * 创建完全内存化的原型存储。
 *
 * @returns {{ store: { read: Function, write: Function }, rows: Map<string, object> }} 测试存储和可观察数据。
 * @throws {Error} 本函数不主动抛异常。
 */
function createMemoryStore() {
  const rows = new Map();
  return {
    rows,
    store: {
      async read(workspaceId) {
        const value = rows.get(workspaceId);
        return value ? JSON.parse(JSON.stringify(value)) : null;
      },
      async write(workspaceId, value) {
        rows.set(workspaceId, JSON.parse(JSON.stringify(value)));
      }
    }
  };
}

/**
 * 创建一个没有任何真实赢单凭证的原型网关。
 *
 * @returns {{ gateway: ReturnType<typeof createKassCrmGateway>, rows: Map<string, object> }} 网关和测试数据。
 * @throws {Error} 本函数不主动抛异常。
 */
function createTestGateway() {
  const { store, rows } = createMemoryStore();
  return {
    rows,
    gateway: createKassCrmGateway({
      store,
      fetchImpl: async () => {
        throw new Error("prototype gateway must not call an upstream CRM");
      },
      env: {}
    })
  };
}

const WORKSPACE_ID = "workspace-1234567890";
const OTHER_WORKSPACE_ID = "workspace-abcdefghij";

const BOOTSTRAP_CUSTOMER = {
  id: "kass-a-1",
  name: "Prototype Buyer",
  country: "United States",
  level: "A",
  stage: "新询盘",
  intent: "中高意向",
  product: "保温杯",
  quantity: "50,000 pcs",
  tradeTerm: "FOB Shanghai",
  backgroundProfile: {
    overview: "只用于原型联调的虚拟客户。",
    companySize: "51–200 人",
    sources: ["原型客户档案"]
  },
  followupRecords: [{
    id: "followup-initial",
    date: "2026-07-24",
    time: "10:00",
    owner: "张伟",
    channel: "邮件",
    title: "客户确认目标数量",
    summary: "客户确认目标数量为 50,000 pcs。",
    tasks: []
  }]
};

test("bootstraps one virtual customer and reads a combined context", async () => {
  const { gateway } = createTestGateway();

  const bootstrap = await gateway.execute({
    method: "POST",
    body: {
      action: "bootstrap_customer",
      workspace_id: WORKSPACE_ID,
      customer: BOOTSTRAP_CUSTOMER
    }
  });
  const context = await gateway.execute({
    method: "GET",
    query: {
      action: "context",
      workspace_id: WORKSPACE_ID,
      customer_ref: "kass-a-1"
    }
  });

  assert.equal(bootstrap.ok, true);
  assert.equal(bootstrap.mode, "prototype");
  assert.equal(bootstrap.data.created, true);
  assert.equal(context.data.customer.name, "Prototype Buyer");
  assert.equal(context.data.customer.backgroundProfile.companySize, "51–200 人");
  assert.equal(context.data.followups[0].id, "followup-initial");
});

test("keeps different browser workspaces isolated", async () => {
  const { gateway } = createTestGateway();
  await gateway.execute({
    method: "POST",
    body: {
      action: "bootstrap_customer",
      workspace_id: WORKSPACE_ID,
      customer: BOOTSTRAP_CUSTOMER
    }
  });

  await assert.rejects(
    () => gateway.execute({
      method: "GET",
      query: {
        action: "context",
        workspace_id: OTHER_WORKSPACE_ID,
        customer_ref: "kass-a-1"
      }
    }),
    (error) => error.code === "prototype_customer_not_found" && error.statusCode === 404
  );
});

test("updates customer and profile fields without any real CRM credential", async () => {
  const { gateway } = createTestGateway();
  await gateway.execute({
    method: "POST",
    body: {
      action: "bootstrap_customer",
      workspace_id: WORKSPACE_ID,
      customer: BOOTSTRAP_CUSTOMER
    }
  });

  const result = await gateway.execute({
    method: "POST",
    body: {
      action: "update_customer",
      workspace_id: WORKSPACE_ID,
      customer_ref: "kass-a-1",
      changes: {
        stage: "待报价",
        quantity: "60,000 pcs"
      },
      profile_changes: {
        company_size: "201–500 人",
        purchasing_role: "品牌采购负责人"
      }
    }
  });

  assert.equal(result.data.customer.stage, "待报价");
  assert.equal(result.data.customer.quantity, "60,000 pcs");
  assert.equal(result.data.customer.backgroundProfile.companySize, "201–500 人");
  assert.equal(result.data.customer.backgroundProfile.purchasingRole, "品牌采购负责人");
});

test("accepts an Agent update with customer changes and an empty profile_changes object", async () => {
  const { gateway } = createTestGateway();
  await gateway.execute({
    method: "POST",
    body: {
      action: "bootstrap_customer",
      workspace_id: WORKSPACE_ID,
      customer: BOOTSTRAP_CUSTOMER
    }
  });

  const result = await gateway.execute({
    method: "POST",
    body: {
      action: "update_customer",
      workspace_id: WORKSPACE_ID,
      customer_ref: "kass-a-1",
      changes: { stage: "报价跟进" },
      profile_changes: {}
    }
  });

  assert.equal(result.data.customer.stage, "报价跟进");
  assert.equal(result.data.customer.backgroundProfile.companySize, "51–200 人");
});

test("rejects a customer update when both change objects are empty", async () => {
  const { gateway } = createTestGateway();
  await gateway.execute({
    method: "POST",
    body: {
      action: "bootstrap_customer",
      workspace_id: WORKSPACE_ID,
      customer: BOOTSTRAP_CUSTOMER
    }
  });

  await assert.rejects(
    () => gateway.execute({
      method: "POST",
      body: {
        action: "update_customer",
        workspace_id: WORKSPACE_ID,
        customer_ref: "kass-a-1",
        changes: {},
        profile_changes: {}
      }
    }),
    (error) => error.code === "invalid_parameter"
  );
});

test("creates, updates, and deletes a virtual follow-up record", async () => {
  const { gateway } = createTestGateway();
  await gateway.execute({
    method: "POST",
    body: {
      action: "bootstrap_customer",
      workspace_id: WORKSPACE_ID,
      customer: BOOTSTRAP_CUSTOMER
    }
  });

  const created = await gateway.execute({
    method: "POST",
    body: {
      action: "create_followup",
      workspace_id: WORKSPACE_ID,
      customer_ref: "kass-a-1",
      record: {
        date: "2026-07-24",
        channel: "Agent 对话",
        title: "已发送新版报价",
        summary: "客户确认收到新版报价。",
        tasks: [{ title: "两天后确认反馈", dueDate: "2026-07-26", status: "待处理" }]
      }
    }
  });
  const followupId = created.data.record.id;

  const updated = await gateway.execute({
    method: "POST",
    body: {
      action: "update_followup",
      workspace_id: WORKSPACE_ID,
      customer_ref: "kass-a-1",
      followup_id: followupId,
      changes: {
        summary: "客户确认收到新版报价，并计划内部评审。"
      }
    }
  });
  const deleted = await gateway.execute({
    method: "POST",
    body: {
      action: "delete_followup",
      workspace_id: WORKSPACE_ID,
      customer_ref: "kass-a-1",
      followup_id: followupId
    }
  });

  assert.match(followupId, /^followup-/);
  assert.equal(updated.data.record.summary, "客户确认收到新版报价，并计划内部评审。");
  assert.equal(deleted.data.deleted_followup_id, followupId);
  assert.equal(deleted.data.followups.some((record) => record.id === followupId), false);
});

test("closes current tasks, appends next actions, and removes rejected todos", async () => {
  const { gateway } = createTestGateway();
  await gateway.execute({
    method: "POST",
    body: {
      action: "bootstrap_customer",
      workspace_id: WORKSPACE_ID,
      customer: {
        ...BOOTSTRAP_CUSTOMER,
        followupRecords: [{
          ...BOOTSTRAP_CUSTOMER.followupRecords[0],
          tasks: [
            {
              id: "task-quote",
              title: "发送正式报价",
              dueDate: "2026-07-24",
              status: "待处理"
            },
            {
              id: "task-package",
              title: "发送包装方案",
              dueDate: "2026-07-25",
              status: "待处理"
            }
          ]
        }]
      }
    }
  });

  const closedAndExtended = await gateway.execute({
    method: "POST",
    body: {
      action: "update_followup",
      workspace_id: WORKSPACE_ID,
      customer_ref: "kass-a-1",
      followup_id: "followup-initial",
      changes: {
        tasks: [
          {
            id: "task-quote",
            title: "发送正式报价",
            dueDate: "2026-07-24",
            status: "已完成"
          },
          {
            id: "task-package",
            title: "发送包装方案",
            dueDate: "2026-07-25",
            status: "已完成"
          },
          {
            id: "agent-next-followup-initial-1",
            title: "确认客户对报价与包装方案的反馈",
            dueDate: "",
            status: "待处理"
          }
        ]
      }
    }
  });

  assert.deepEqual(
    closedAndExtended.data.record.tasks.map((task) => task.status),
    ["已完成", "已完成", "待处理"]
  );
  assert.equal(
    closedAndExtended.data.record.tasks[2].id,
    "agent-next-followup-initial-1"
  );

  const removedRejectedTodo = await gateway.execute({
    method: "POST",
    body: {
      action: "update_followup",
      workspace_id: WORKSPACE_ID,
      customer_ref: "kass-a-1",
      followup_id: "followup-initial",
      changes: {
        tasks: closedAndExtended.data.record.tasks.slice(0, 2)
      }
    }
  });

  assert.equal(removedRejectedTodo.data.record.tasks.length, 2);
  assert.equal(
    removedRejectedTodo.data.record.tasks.some((task) => task.id.startsWith("agent-next-")),
    false
  );
  assert.deepEqual(
    removedRejectedTodo.data.record.tasks.map((task) => task.status),
    ["已完成", "已完成"]
  );
});

test("rejects unknown fields, arbitrary actions, and non-GET/POST methods", async () => {
  const { gateway } = createTestGateway();
  await gateway.execute({
    method: "POST",
    body: {
      action: "bootstrap_customer",
      workspace_id: WORKSPACE_ID,
      customer: BOOTSTRAP_CUSTOMER
    }
  });

  await assert.rejects(
    () => gateway.execute({
      method: "POST",
      body: {
        action: "update_customer",
        workspace_id: WORKSPACE_ID,
        customer_ref: "kass-a-1",
        changes: { arbitrary_url: "https://example.com" }
      }
    }),
    (error) => error.code === "unsupported_field"
  );

  await assert.rejects(
    () => gateway.execute({
      method: "GET",
      query: {
        action: "raw_proxy",
        workspace_id: WORKSPACE_ID,
        customer_ref: "kass-a-1"
      }
    }),
    (error) => error.code === "unsupported_action"
  );

  await assert.rejects(
    () => gateway.execute({
      method: "DELETE",
      body: {
        action: "delete_followup",
        workspace_id: WORKSPACE_ID,
        customer_ref: "kass-a-1",
        followup_id: "followup-initial"
      }
    }),
    (error) => error.code === "method_not_allowed"
  );
});
