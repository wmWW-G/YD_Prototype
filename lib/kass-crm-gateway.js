const crypto = require("node:crypto");

const REDIS_KEY_PREFIX = "yd-prototype:kass-crm:v1:";
const WORKSPACE_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * 当前原型允许 Agent 修改的客户顶层字段。
 *
 * API 对 Agent 暴露 snake_case，内部仍保存前端已经使用的 camelCase。
 * 这样既让 Prompt 容易书写，也避免为了接入原型 API 大面积重构页面数据结构。
 */
const CUSTOMER_CHANGE_FIELD_MAP = Object.freeze({
  name: "name",
  country: "country",
  level: "level",
  stage: "stage",
  intent: "intent",
  product: "product",
  quantity: "quantity",
  trade_term: "tradeTerm",
  customization: "customization",
  inquiry: "inquiry",
  summary: "summary",
  next_action: "nextAction",
  website: "website",
  contact: "contact"
});

/**
 * 当前原型客户详细档案允许修改的字段。
 */
const PROFILE_CHANGE_FIELD_MAP = Object.freeze({
  overview: "overview",
  company_background: "companyBackground",
  main_business: "mainBusiness",
  entered_at: "enteredAt",
  founded_year: "foundedYear",
  company_size: "companySize",
  company_type: "companyType",
  organization: "organization",
  purchasing_role: "purchasingRole",
  market_channels: "marketChannels",
  contact_name: "contactName",
  contact_role: "contactRole",
  social_media: "socialMedia",
  contact_email: "contactEmail",
  whatsapp: "whatsapp",
  annual_revenue: "annualRevenue",
  cooperation_stage: "cooperationStage",
  purchase_cycle: "purchaseCycle",
  purchase_potential: "purchasePotential",
  product_preference: "productPreference",
  purchase_preference: "purchasePreference",
  expandable_products: "expandableProducts",
  payment_terms: "paymentTerms",
  final_consignee: "finalConsignee",
  credit_status: "creditStatus",
  cooperation_value: "cooperationValue",
  competitors: "competitors",
  competitive_advantage: "competitiveAdvantage",
  current_suppliers: "currentSuppliers",
  sources: "sources",
  updated_at: "updatedAt",
  incomplete_items: "incompleteItems"
});

const FOLLOWUP_FIELDS = new Set([
  "date",
  "dayLabel",
  "time",
  "owner",
  "channel",
  "title",
  "summary",
  "tasks"
]);

const TASK_FIELDS = new Set(["id", "title", "dueDate", "status"]);

/**
 * 可安全返回给浏览器和 Dify Agent 的业务错误。
 */
class KassCrmGatewayError extends Error {
  /**
   * @param {string} message - 不含存储凭证和内部响应的用户可见错误。
   * @param {number} statusCode - HTTP 状态码。
   * @param {string} code - 稳定错误代码。
   */
  constructor(message, statusCode = 400, code = "kass_gateway_error") {
    super(message);
    this.name = "KassCrmGatewayError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * 复制一份只包含 JSON 数据的对象，防止调用方继续修改存储内的引用。
 *
 * @param {unknown} value - 需要复制的值。
 * @returns {unknown} JSON 安全副本。
 * @throws {TypeError} 值无法序列化时抛出。
 */
function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * 校验工作区或客户引用。
 *
 * 工作区 ID 由浏览器随机生成，只用于隔离不同浏览器的虚拟数据。它不是账号、
 * Access Token 或真实客户 ID。
 *
 * @param {unknown} value - 原始 ID。
 * @param {string} fieldName - 错误提示字段名。
 * @param {number} minLength - 最小长度。
 * @returns {string} 合法 ID。
 * @throws {KassCrmGatewayError} ID 为空或格式不合法时抛出。
 */
function requireScopedId(value, fieldName, minLength = 3) {
  const text = String(value || "").trim();
  const allowed = new RegExp(`^[A-Za-z0-9._-]{${minLength},80}$`);
  if (!allowed.test(text)) {
    throw new KassCrmGatewayError(
      `${fieldName} 格式无效。`,
      400,
      "invalid_parameter"
    );
  }
  return text;
}

/**
 * 校验非空文本。
 *
 * @param {unknown} value - 原始文本。
 * @param {string} fieldName - 错误提示字段名。
 * @returns {string} 去除首尾空白后的文本。
 * @throws {KassCrmGatewayError} 文本为空时抛出。
 */
function requireText(value, fieldName) {
  const text = String(value || "").trim();
  if (!text) {
    throw new KassCrmGatewayError(`${fieldName} 不能为空。`, 400, "invalid_parameter");
  }
  return text;
}

/**
 * 把任意值限制为可控长度的文本。
 *
 * @param {unknown} value - Agent 或前端传入的值。
 * @param {number} maxLength - 最大字符数。
 * @returns {string} 截断后的文本。
 * @throws {Error} 本函数不主动抛异常。
 */
function normalizeText(value, maxLength = 4000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

/**
 * 校验并复制跟进记录里的任务。
 *
 * @param {unknown} tasks - 原始任务数组。
 * @returns {Array<{ id: string, title: string, dueDate: string, status: string }>} 安全任务数组。
 * @throws {KassCrmGatewayError} 任务结构或字段不合法时抛出。
 */
function sanitizeTasks(tasks) {
  if (tasks === undefined) return [];
  if (!Array.isArray(tasks) || tasks.length > 20) {
    throw new KassCrmGatewayError("tasks 必须是不超过 20 项的数组。", 400, "invalid_parameter");
  }

  return tasks.map((task, index) => {
    if (!task || typeof task !== "object" || Array.isArray(task)) {
      throw new KassCrmGatewayError(`tasks[${index}] 必须是对象。`, 400, "invalid_parameter");
    }
    const unknown = Object.keys(task).filter((field) => !TASK_FIELDS.has(field));
    if (unknown.length) {
      throw new KassCrmGatewayError(
        `tasks[${index}] 包含不支持的字段：${unknown.join(", ")}。`,
        400,
        "unsupported_field"
      );
    }
    return {
      id: normalizeText(task.id, 100) || `task-${crypto.randomUUID()}`,
      title: requireText(task.title, `tasks[${index}].title`).slice(0, 300),
      dueDate: normalizeText(task.dueDate, 20),
      status: normalizeText(task.status, 30) || "待处理"
    };
  });
}

/**
 * 校验并复制一条跟进记录。
 *
 * @param {unknown} record - 原始跟进记录。
 * @param {{ requireContent?: boolean, generateId?: boolean }} options - 是否要求正文及是否生成 ID。
 * @returns {Record<string, unknown>} 前端可以直接渲染的跟进记录。
 * @throws {KassCrmGatewayError} 结构或字段不合法时抛出。
 */
function sanitizeFollowup(record, { requireContent = true, generateId = false } = {}) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new KassCrmGatewayError("record 必须是对象。", 400, "invalid_parameter");
  }

  const unknown = Object.keys(record).filter((field) => field !== "id" && !FOLLOWUP_FIELDS.has(field));
  if (unknown.length) {
    throw new KassCrmGatewayError(
      `record 包含不支持的字段：${unknown.join(", ")}。`,
      400,
      "unsupported_field"
    );
  }

  const title = normalizeText(record.title, 300);
  const summary = normalizeText(record.summary, 5000);
  if (requireContent && !title && !summary) {
    throw new KassCrmGatewayError(
      "record.title 和 record.summary 至少需要填写一项。",
      400,
      "invalid_parameter"
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);
  return {
    id: normalizeText(record.id, 100) || (generateId ? `followup-${crypto.randomUUID()}` : ""),
    date: normalizeText(record.date, 20) || today,
    dayLabel: normalizeText(record.dayLabel, 30),
    time: normalizeText(record.time, 20) || nowTime,
    owner: normalizeText(record.owner, 100) || "CRM Agent",
    channel: normalizeText(record.channel, 100) || "Agent 对话",
    title: title || summary.slice(0, 80),
    summary: summary || title,
    tasks: sanitizeTasks(record.tasks)
  };
}

/**
 * 只复制页面现有客户快照中允许进入原型存储的字段。
 *
 * @param {unknown} value - 浏览器传入的当前客户快照。
 * @returns {Record<string, unknown>} 可持久化的原型客户。
 * @throws {KassCrmGatewayError} 客户结构不合法时抛出。
 */
function sanitizeBootstrapCustomer(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new KassCrmGatewayError("customer 必须是对象。", 400, "invalid_parameter");
  }

  const customerRef = requireScopedId(value.customerRef || value.id, "customer.customer_ref");
  const profile = value.backgroundProfile && typeof value.backgroundProfile === "object"
    ? cloneJson(value.backgroundProfile)
    : {};
  const followupRecords = Array.isArray(value.followupRecords)
    ? value.followupRecords.slice(0, 100).map((record) => sanitizeFollowup(record, { requireContent: false }))
    : [];

  return {
    id: customerRef,
    customerRef,
    name: requireText(value.name, "customer.name").slice(0, 200),
    shortName: normalizeText(value.shortName, 10),
    country: normalizeText(value.country, 100),
    industry: normalizeText(value.industry, 200),
    website: normalizeText(value.website, 500),
    contact: normalizeText(value.contact, 200),
    level: normalizeText(value.level, 20),
    risk: normalizeText(value.risk, 30),
    stage: normalizeText(value.stage, 100),
    intent: normalizeText(value.intent, 100),
    product: normalizeText(value.product, 300),
    quantity: normalizeText(value.quantity, 100),
    tradeTerm: normalizeText(value.tradeTerm, 100),
    customization: normalizeText(value.customization, 300),
    inquiry: normalizeText(value.inquiry, 10000),
    summary: normalizeText(value.summary, 5000),
    nextAction: normalizeText(value.nextAction, 1000),
    tags: Array.isArray(value.tags) ? value.tags.slice(0, 20).map((item) => normalizeText(item, 100)) : [],
    backgroundProfile: profile,
    followupRecords,
    updatedAt: new Date().toISOString()
  };
}

/**
 * 按白名单转换客户或档案修改字段。
 *
 * @param {unknown} value - changes 或 profile_changes。
 * @param {Record<string, string>} fieldMap - Agent 字段到前端字段的映射。
 * @param {string} fieldName - 错误提示字段名。
 * @param {{ allowEmpty?: boolean }} options - 是否允许空对象；组合更新会在外层统一校验。
 * @returns {Record<string, unknown>} 转换后的字段。
 * @throws {KassCrmGatewayError} 对象为空或包含未知字段时抛出。
 */
function mapChanges(value, fieldMap, fieldName, { allowEmpty = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new KassCrmGatewayError(`${fieldName} 必须是对象。`, 400, "invalid_parameter");
  }
  const unknown = Object.keys(value).filter((field) => !fieldMap[field]);
  if (unknown.length) {
    throw new KassCrmGatewayError(
      `${fieldName} 包含不支持的字段：${unknown.join(", ")}。`,
      400,
      "unsupported_field"
    );
  }
  const mapped = Object.fromEntries(
    Object.entries(value).map(([field, fieldValue]) => {
      const target = fieldMap[field];
      if (field === "sources" || field === "incomplete_items") {
        if (!Array.isArray(fieldValue)) {
          throw new KassCrmGatewayError(`${fieldName}.${field} 必须是数组。`, 400, "invalid_parameter");
        }
        return [target, fieldValue.slice(0, 30).map((item) => normalizeText(item, 200))];
      }
      return [target, normalizeText(fieldValue, field === "inquiry" ? 10000 : 5000)];
    })
  );
  if (!allowEmpty && !Object.keys(mapped).length) {
    throw new KassCrmGatewayError(`${fieldName} 至少需要一个字段。`, 400, "invalid_parameter");
  }
  return mapped;
}

/**
 * 创建使用 Upstash Redis REST API 的原型客户存储。
 *
 * 该存储只保存虚拟客户快照，绝不读取赢单账号、Access Token 或线上客户接口。
 *
 * @param {{ env?: NodeJS.ProcessEnv | Record<string, string>, fetchImpl?: typeof fetch }} options - 环境变量和网络实现。
 * @returns {{ read: Function, write: Function }} 工作区读写接口。
 * @throws {Error} 创建本身不主动抛异常。
 */
function createKassPrototypeStore({ env = process.env, fetchImpl = global.fetch } = {}) {
  const redisUrl = String(env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL || "").replace(/\/$/, "");
  const redisToken = String(env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN || "");

  /**
   * 执行一条 Redis REST 命令。
   *
   * @param {string[]} command - Redis 命令数组。
   * @returns {Promise<unknown>} Redis result。
   * @throws {KassCrmGatewayError} 存储未配置、网络或业务失败时抛出。
   */
  async function runRedis(command) {
    if (!redisUrl || !redisToken) {
      throw new KassCrmGatewayError(
        "KASS 原型存储尚未配置。",
        503,
        "prototype_store_not_configured"
      );
    }

    let response;
    try {
      response = await fetchImpl(redisUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(command)
      });
    } catch (_error) {
      throw new KassCrmGatewayError(
        "KASS 原型存储暂时无法连接。",
        502,
        "prototype_store_unavailable"
      );
    }

    const rawText = await response.text();
    let payload = null;
    try {
      payload = rawText ? JSON.parse(rawText) : {};
    } catch (_error) {
      throw new KassCrmGatewayError(
        "KASS 原型存储返回了无法解析的数据。",
        502,
        "prototype_store_invalid_response"
      );
    }
    if (!response.ok || payload?.error) {
      throw new KassCrmGatewayError(
        "KASS 原型存储操作失败。",
        502,
        "prototype_store_error"
      );
    }
    return payload?.result ?? null;
  }

  return {
    /**
     * @param {string} workspaceId - 原型工作区 ID。
     * @returns {Promise<Record<string, unknown> | null>} 工作区数据。
     */
    async read(workspaceId) {
      const stored = await runRedis(["GET", `${REDIS_KEY_PREFIX}${workspaceId}`]);
      if (!stored) return null;
      try {
        return JSON.parse(String(stored));
      } catch (_error) {
        throw new KassCrmGatewayError(
          "KASS 原型工作区数据已损坏。",
          502,
          "prototype_store_invalid_data"
        );
      }
    },

    /**
     * @param {string} workspaceId - 原型工作区 ID。
     * @param {Record<string, unknown>} state - 完整工作区数据。
     * @returns {Promise<void>} 写入完成后无返回值。
     */
    async write(workspaceId, state) {
      await runRedis([
        "SET",
        `${REDIS_KEY_PREFIX}${workspaceId}`,
        JSON.stringify(state),
        "EX",
        String(WORKSPACE_TTL_SECONDS)
      ]);
    }
  };
}

/**
 * 创建完全隔离于真实赢单后端的 KASS 原型 CRUD 网关。
 *
 * @param {{ env?: NodeJS.ProcessEnv | Record<string, string>, fetchImpl?: typeof fetch, store?: { read: Function, write: Function } }} options - 可注入存储，便于测试。
 * @returns {{ execute: Function }} Vercel Handler 可调用的网关。
 * @throws {Error} 创建本身不主动抛异常。
 */
function createKassCrmGateway({
  env = process.env,
  fetchImpl = global.fetch,
  store = createKassPrototypeStore({ env, fetchImpl })
} = {}) {
  /**
   * 读取工作区；不存在时返回空结构。
   *
   * @param {string} workspaceId - 原型工作区 ID。
   * @returns {Promise<Record<string, unknown>>} 工作区数据。
   */
  async function readWorkspace(workspaceId) {
    return await store.read(workspaceId) || {
      version: 1,
      workspaceId,
      customers: {},
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * 获取一个已初始化客户。
   *
   * @param {Record<string, unknown>} workspace - 工作区。
   * @param {string} customerRef - 客户引用。
   * @returns {Record<string, unknown>} 客户快照。
   * @throws {KassCrmGatewayError} 客户尚未初始化时抛出。
   */
  function getCustomer(workspace, customerRef) {
    const customer = workspace.customers?.[customerRef];
    if (!customer) {
      throw new KassCrmGatewayError(
        "当前原型客户尚未初始化，请先由页面执行 bootstrap_customer。",
        404,
        "prototype_customer_not_found"
      );
    }
    return customer;
  }

  /**
   * 写回工作区并更新版本时间。
   *
   * @param {string} workspaceId - 原型工作区 ID。
   * @param {Record<string, unknown>} workspace - 工作区内容。
   * @returns {Promise<void>} 写入完成后无返回值。
   */
  async function persist(workspaceId, workspace) {
    workspace.updatedAt = new Date().toISOString();
    await store.write(workspaceId, workspace);
  }

  return {
    /**
     * 执行一个原型 CRUD action。
     *
     * @param {{ method: unknown, query?: Record<string, unknown>, body?: Record<string, unknown> }} request - Handler 解析后的请求。
     * @returns {Promise<{ ok: true, mode: "prototype", action: string, data: unknown }>} 统一响应。
     * @throws {KassCrmGatewayError} 参数、存储或业务失败时抛出。
     */
    async execute({ method, query = {}, body = {} }) {
      const normalizedMethod = String(method || "").toUpperCase();
      if (normalizedMethod !== "GET" && normalizedMethod !== "POST") {
        throw new KassCrmGatewayError(
          "KASS 原型网关只支持 GET 和 POST。",
          405,
          "method_not_allowed"
        );
      }

      const input = normalizedMethod === "GET" ? query : body;
      const action = requireText(input.action, "action");
      const workspaceId = requireScopedId(input.workspace_id, "workspace_id", 16);
      const workspace = await readWorkspace(workspaceId);

      if (normalizedMethod === "GET") {
        if (action === "customers") {
          return {
            ok: true,
            mode: "prototype",
            action,
            data: Object.values(workspace.customers || {}).map((customer) => ({
              customer_ref: customer.customerRef,
              name: customer.name,
              level: customer.level,
              stage: customer.stage,
              country: customer.country
            }))
          };
        }

        const customerRef = requireScopedId(input.customer_ref, "customer_ref");
        const customer = getCustomer(workspace, customerRef);
        if (action === "customer") {
          return { ok: true, mode: "prototype", action, data: cloneJson(customer) };
        }
        if (action === "followups") {
          return {
            ok: true,
            mode: "prototype",
            action,
            data: cloneJson(customer.followupRecords || [])
          };
        }
        if (action === "context") {
          return {
            ok: true,
            mode: "prototype",
            action,
            data: {
              customer: cloneJson(customer),
              followups: cloneJson(customer.followupRecords || []),
              contextVersion: workspace.updatedAt
            }
          };
        }
        throw new KassCrmGatewayError(
          `不支持的 GET action：${action}。`,
          400,
          "unsupported_action"
        );
      }

      if (action === "bootstrap_customer") {
        const customer = sanitizeBootstrapCustomer(body.customer);
        const existed = Boolean(workspace.customers[customer.customerRef]);
        if (!existed || body.force === true) {
          workspace.customers[customer.customerRef] = customer;
          await persist(workspaceId, workspace);
        }
        return {
          ok: true,
          mode: "prototype",
          action,
          data: {
            created: !existed,
            customer: cloneJson(workspace.customers[customer.customerRef])
          }
        };
      }

      const customerRef = requireScopedId(body.customer_ref, "customer_ref");
      const customer = getCustomer(workspace, customerRef);

      if (action === "update_customer") {
        // Agent 经常会同时返回 changes 与 profile_changes，其中一侧可能是空对象。
        // 两个对象都允许单独为空，但合起来必须至少有一个真实字段，避免无意义写入。
        const changes = body.changes
          ? mapChanges(body.changes, CUSTOMER_CHANGE_FIELD_MAP, "changes", { allowEmpty: true })
          : {};
        const profileChanges = body.profile_changes
          ? mapChanges(body.profile_changes, PROFILE_CHANGE_FIELD_MAP, "profile_changes", { allowEmpty: true })
          : {};
        if (!Object.keys(changes).length && !Object.keys(profileChanges).length) {
          throw new KassCrmGatewayError(
            "changes 和 profile_changes 至少需要一个字段。",
            400,
            "invalid_parameter"
          );
        }
        Object.assign(customer, changes);
        if (Object.keys(profileChanges).length) {
          customer.backgroundProfile = {
            ...(customer.backgroundProfile || {}),
            ...profileChanges,
            updatedAt: new Date().toISOString().slice(0, 10)
          };
        }
        customer.updatedAt = new Date().toISOString();
        await persist(workspaceId, workspace);
        return {
          ok: true,
          mode: "prototype",
          action,
          data: { customer: cloneJson(customer) }
        };
      }

      if (action === "create_followup") {
        const record = sanitizeFollowup(body.record, { generateId: true });
        customer.followupRecords = [record, ...(customer.followupRecords || [])];
        customer.updatedAt = new Date().toISOString();
        await persist(workspaceId, workspace);
        return {
          ok: true,
          mode: "prototype",
          action,
          data: { record: cloneJson(record), followups: cloneJson(customer.followupRecords) }
        };
      }

      const followupId = requireScopedId(body.followup_id, "followup_id");
      const followups = Array.isArray(customer.followupRecords) ? customer.followupRecords : [];
      const followupIndex = followups.findIndex((record) => record.id === followupId);
      if (followupIndex < 0) {
        throw new KassCrmGatewayError("没有找到这条原型跟进记录。", 404, "followup_not_found");
      }

      if (action === "update_followup") {
        const changes = sanitizeFollowup(
          { ...followups[followupIndex], ...(body.changes || {}) },
          { requireContent: true }
        );
        changes.id = followupId;
        followups[followupIndex] = changes;
        customer.followupRecords = followups;
        customer.updatedAt = new Date().toISOString();
        await persist(workspaceId, workspace);
        return {
          ok: true,
          mode: "prototype",
          action,
          data: { record: cloneJson(changes), followups: cloneJson(followups) }
        };
      }

      if (action === "delete_followup") {
        const [deleted] = followups.splice(followupIndex, 1);
        customer.followupRecords = followups;
        customer.updatedAt = new Date().toISOString();
        await persist(workspaceId, workspace);
        return {
          ok: true,
          mode: "prototype",
          action,
          data: {
            deleted_followup_id: deleted.id,
            followups: cloneJson(followups)
          }
        };
      }

      throw new KassCrmGatewayError(
        `不支持的 POST action：${action}。`,
        400,
        "unsupported_action"
      );
    }
  };
}

module.exports = {
  CUSTOMER_CHANGE_FIELD_MAP,
  PROFILE_CHANGE_FIELD_MAP,
  KassCrmGatewayError,
  createKassCrmGateway,
  createKassPrototypeStore
};
