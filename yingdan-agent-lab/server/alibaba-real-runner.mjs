import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildInquiryMeetingXlsx, inspectAlibabaInquiryMeetingSkill } from './alibaba-skill.mjs';

const DEFAULT_BRIDGE_ROOT = '/Users/garden/YD/ReverseAccio/alibaba-mcp-bridge';
const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:4097/mcp/proxy';
const REQUIRED_TOOLS = [
  'subaccount_query',
  'query_seller_acct_dim_diag_data',
  'query_seller_shop_dim_diag_data',
  'query_seller_chat_quality_check_detail',
];
const OPTIONAL_TOOLS = ['findCustomerShopInfo', 'query_contact', 'get_buyer_basic_info'];
const BUYER_TYPES = [0, 1];

/**
 * resolvePreviousFullWeek 计算当前日期之前的完整自然周。
 *
 * 作用：
 * - 把“上周询盘分析会”稳定解释成上一个周一到周日。
 * - 避免使用滚动 7 天，因为目标 skill 明确要求完整自然周。
 *
 * 参数：
 * - now：当前时间，Date 对象；测试可注入固定时间。
 *
 * 返回值：包含 start、end、label 的周期对象，日期格式为 YYYY-MM-DD。
 * 可能抛出的异常：now 不是有效 Date 时抛出 Error。
 */
export function resolvePreviousFullWeek(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error('valid Date is required');
  }

  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceMonday = (current.getDay() + 6) % 7;
  const thisMonday = addDays(current, -daysSinceMonday);
  const lastMonday = addDays(thisMonday, -7);
  const lastSunday = addDays(lastMonday, 6);

  return {
    start: formatLocalDate(lastMonday),
    end: formatLocalDate(lastSunday),
    label: '上周完整自然周',
  };
}

/**
 * createBridgeClient 创建 Accio 本地网关只读调用客户端。
 *
 * 作用：
 * - 从 bridge `.env` 读取本地网关密码和 agentId，但不输出密钥。
 * - 从 `tools.json` 做工具发现，避免凭记忆调用不存在的 Alibaba 工具。
 * - 把每次网关响应原样落到本地 raw 目录，供验收审计；日志里只放摘要。
 *
 * 参数：
 * - options.bridgeRoot：bridge 目录，默认指向本机 ReverseAccio。
 * - options.gatewayUrl：Accio 本地网关地址，默认 `127.0.0.1:4097/mcp/proxy`。
 * - options.rawDir：原始响应保存目录，字符串。
 * - options.timeoutMs：单次工具调用超时毫秒数。
 * - options.fetchImpl：可选 fetch 实现，测试可注入。
 *
 * 返回值：包含 listTools 和 callTool 的对象。
 * 可能抛出的异常：`.env`、token、agentId 或工具目录缺失时抛出。
 */
export async function createBridgeClient(options = {}) {
  const bridgeRoot = options.bridgeRoot || DEFAULT_BRIDGE_ROOT;
  const envPath = options.envPath || path.join(bridgeRoot, '.env');
  const toolsPath = options.toolsPath || path.join(bridgeRoot, 'tools.json');
  const gatewayUrl = options.gatewayUrl || DEFAULT_GATEWAY_URL;
  const rawDir = options.rawDir;
  const timeoutMs = options.timeoutMs || 15000;
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  const env = parseEnvFile(await readFile(envPath, 'utf8'));
  const token =
    options.gatewayToken ||
    env.ACCIO_GATEWAY_TOKEN ||
    env.PHOENIX_TELEMETRY_DEBUG_GATEWAY_PASSWORD ||
    process.env.ACCIO_GATEWAY_TOKEN ||
    process.env.PHOENIX_TELEMETRY_DEBUG_GATEWAY_PASSWORD;
  const username = options.gatewayUsername || env.ACCIO_GATEWAY_USERNAME || process.env.ACCIO_GATEWAY_USERNAME || 'phoenix';
  const agentId = options.agentId || env.ACCIO_AGENT_ID || process.env.ACCIO_AGENT_ID;

  if (!token) {
    throw new Error('Accio gateway token is required; refresh the bridge .env before running.');
  }
  if (!agentId) {
    throw new Error('ACCIO_AGENT_ID is required for Alibaba tool entitlement.');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch implementation is required');
  }

  return {
    async listTools() {
      const catalog = JSON.parse(await readFile(toolsPath, 'utf8'));
      const tools = Array.isArray(catalog) ? catalog : catalog.tools || [];
      return tools.map((tool) => tool.name).filter(Boolean);
    },

    async callTool(name, args = {}, context = {}) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      let text = '';

      try {
        response = await fetchImpl(gatewayUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Basic ${Buffer.from(`${username}:${token}`, 'utf8').toString('base64')}`,
          },
          body: JSON.stringify({ name, arguments: args, trace: { agentId } }),
          signal: controller.signal,
        });
        text = await response.text();
      } finally {
        clearTimeout(timeout);
      }

      const parsed = parsePossiblyJson(text);
      const data = unwrapGatewayResponse(parsed);
      const ok = Boolean(response?.ok && !data.isError && !parsed?.error);
      const rawPath = rawDir
        ? await writeRawToolResponse(rawDir, context.index || 0, name, {
            name,
            arguments: args,
            status: response?.status || 0,
            ok,
            response: parsed,
          })
        : '';

      return {
        ok,
        status: response?.status || 0,
        data: data.value,
        rawPath,
        byteLength: Buffer.byteLength(text, 'utf8'),
        error: ok ? '' : summarizeGatewayFailure(response?.status || 0, data.value),
      };
    },
  };
}

/**
 * runAlibabaInquiryMeetingReal 执行真实的 alibaba-inquiry-meeting 验收链路。
 *
 * 作用：
 * - 读取真实外部 Accio skill 包。
 * - 做 Alibaba 工具发现，只调用白名单只读工具。
 * - 将真实工具返回、缺失和失败统一整理成主持材料 JSON。
 * - 调用 skill 自带 XLSX builder，输出 `real-bridge` manifest 和 append-only run log。
 *
 * 参数：
 * - options.projectRoot：当前项目根目录，默认 process.cwd()。
 * - options.bridgeClient：可选 bridge 客户端；测试时注入，真实运行时默认创建。
 * - options.buildXlsx：可选 XLSX 构建函数；测试时注入，真实运行时默认 `buildInquiryMeetingXlsx`。
 * - options.now：当前时间，Date 对象，用于解析默认周期。
 * - options.period：可选显式周期；缺省使用上一个完整自然周。
 *
 * 返回值：Promise<object>，包含 runId、runLogPath、period、outputPath、manifestPath 和验证摘要。
 * 可能抛出的异常：外部 skill 缺失、没有任何真实只读工具成功、XLSX builder 失败或文件写入失败时抛出。
 */
export async function runAlibabaInquiryMeetingReal(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const period = options.period || resolvePreviousFullWeek(options.now || new Date());
  const runId = options.runId || generateRunId('alibaba-meeting');
  const workbenchRoot = path.join(projectRoot, 'workbench');
  const runLogPath = path.join(workbenchRoot, 'runs', `${runId}.jsonl`);
  const outputRoot = options.outputRoot || path.join(workbenchRoot, 'artifacts', 'alibaba-inquiry-meeting-real');
  const rawDir = path.join(outputRoot, 'raw', runId);

  await mkdir(path.dirname(runLogPath), { recursive: true });
  await mkdir(rawDir, { recursive: true });

  await appendRunEvent(runLogPath, {
    type: 'run.started',
    status: 'running',
    skillId: 'alibaba-inquiry-meeting',
    mode: 'real-bridge',
    period,
  });

  const skill = await inspectAlibabaInquiryMeetingSkill(options.skillPath);
  await appendRunEvent(runLogPath, {
    type: 'skill.loaded',
    skillName: skill.name,
    displayName: skill.displayName,
    evalCount: skill.evalCount,
  });

  await appendRunEvent(runLogPath, {
    type: 'eval.selected',
    evalId: 1,
    basis: '上周完整自然周 + 管理层询盘复盘 XLSX',
  });
  await appendRunEvent(runLogPath, { type: 'period.resolved', period });

  const bridgeClient = options.bridgeClient || (await createBridgeClient({ rawDir, timeoutMs: options.timeoutMs }));
  const availableTools = new Set(normalizeToolNames(await bridgeClient.listTools()));
  const discovery = [...REQUIRED_TOOLS, ...OPTIONAL_TOOLS].map((name) => ({
    name,
    available: availableTools.has(name),
    required: REQUIRED_TOOLS.includes(name),
  }));
  await appendRunEvent(runLogPath, {
    type: 'tool.discovery',
    requiredAvailable: discovery.filter((item) => item.required && item.available).length,
    requiredTotal: REQUIRED_TOOLS.length,
    optionalMissing: discovery.filter((item) => !item.required && !item.available).map((item) => item.name),
  });

  await appendRunEvent(runLogPath, { type: 'policy.checked', action: 'skill.read_external_package', decision: 'allow' });
  await appendRunEvent(runLogPath, { type: 'policy.checked', action: 'alibaba.read_only_tool', decision: 'allow' });

  const callIndex = { value: 0 };
  const observations = [];
  observations.push(
    await callDiscoveredTool({
      bridgeClient,
      availableTools,
      runLogPath,
      callIndex,
      toolName: 'subaccount_query',
      businessSource: '业务员清单',
      args: {},
    }),
  );

  for (const date of enumerateDates(period.start, period.end)) {
    for (const buyerType of BUYER_TYPES) {
      observations.push(
        await callDiscoveredTool({
          bridgeClient,
          availableTools,
          runLogPath,
          callIndex,
          toolName: 'query_seller_acct_dim_diag_data',
          businessSource: buyerType === 0 ? '业务员沟通诊断-大盘买家' : '业务员沟通诊断-L1重点买家',
          args: { buyerType, dateType: 0, queryDate: date },
          date,
        }),
      );
    }
  }

  for (const date of enumerateDates(period.start, period.end)) {
    for (const buyerType of BUYER_TYPES) {
      observations.push(
        await callDiscoveredTool({
          bridgeClient,
          availableTools,
          runLogPath,
          callIndex,
          toolName: 'query_seller_shop_dim_diag_data',
          businessSource: buyerType === 0 ? '店铺询盘接待总览-大盘买家' : '店铺询盘接待总览-L1重点买家',
          args: { buyerType, dateType: 0, queryDate: date },
          date,
        }),
      );
    }
  }

  for (const date of enumerateDates(period.start, period.end)) {
    observations.push(
      await callDiscoveredTool({
        bridgeClient,
        availableTools,
        runLogPath,
        callIndex,
        toolName: 'query_seller_chat_quality_check_detail',
        businessSource: '聊天质检明细',
        args: { queryDate: date },
        date,
      }),
    );
  }

  observations.push(
    await callDiscoveredTool({
      bridgeClient,
      availableTools,
      runLogPath,
      callIndex,
      toolName: 'findCustomerShopInfo',
      businessSource: '公司与主营背景',
      args: {},
      optional: true,
    }),
  );
  observations.push(
    await callDiscoveredTool({
      bridgeClient,
      availableTools,
      runLogPath,
      callIndex,
      toolName: 'query_contact',
      businessSource: '联系人清单',
      args: { type: 0, startVersion: startVersionSeconds(period.start) },
      optional: true,
    }),
  );

  const successfulRequired = observations.filter((item) => item.required && item.ok).length;
  if (successfulRequired === 0 && options.requireAtLeastOneToolSuccess !== false) {
    await appendRunEvent(runLogPath, {
      type: 'run.failed',
      status: 'failed',
      reason: 'NO_REQUIRED_ALIBABA_TOOL_SUCCEEDED',
    });
    throw new Error('No required Alibaba read-only tool succeeded; refusing to mark this as real-bridge acceptance.');
  }

  const payload = buildHostMaterialPayload({
    period,
    observations,
    discovery,
  });
  await writeFile(path.join(outputRoot, 'host-material.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await appendRunEvent(runLogPath, {
    type: 'diagnosis.generated',
    salespeople: payload.salespeople.length,
    priorityInquiries: payload.priority_inquiries.length,
    correctiveActions: payload.corrective_actions.length,
  });

  await appendRunEvent(runLogPath, { type: 'policy.checked', action: 'artifact.write_xlsx', decision: 'allow' });
  const buildXlsx = options.buildXlsx || buildInquiryMeetingXlsx;
  const xlsxResult = await buildXlsx({
    outputRoot,
    payload,
    skillPath: options.skillPath,
    manifestMode: 'real-bridge',
    validationNote: 'This workbook was generated from live Accio/Alibaba read-only tool execution where available; missing data is explicitly marked in business-facing sheets.',
    manifestExtras: {
      runId,
      runLogPath,
      rawDir,
      period,
      toolSummary: summarizeObservations(observations),
    },
  });
  const evidenceItems = buildAlibabaEvidenceItems(payload);
  const typedEvaluation = evaluateAlibabaTypedArtifact({
    evidenceItems,
    xlsxResult,
  });
  await appendRunEvent(runLogPath, {
    type: 'artifact.typed_evaluated',
    checks: typedEvaluation.checks,
    reasons: typedEvaluation.reasons,
    status: typedEvaluation.ok ? 'passed' : 'failed',
  });
  if (!typedEvaluation.ok) {
    await appendRunEvent(runLogPath, {
      type: 'run.failed',
      status: 'failed',
      reason: 'TYPED_EVALUATOR_REJECTED',
      detail: typedEvaluation.reasons.join('; '),
    });
    throw new Error(`typed evaluator rejected alibaba-inquiry-meeting artifact: ${typedEvaluation.reasons.join('; ')}`);
  }
  const evidenceLedgerPath = await writeAlibabaEvidenceLedger({
    items: evidenceItems,
    manifestPath: xlsxResult.manifestPath,
    payload,
    period,
    runId,
  });
  await appendRunEvent(runLogPath, {
    type: 'evidence.added',
    coverage: 'alibaba-inquiry-meeting',
    evidencePath: path.relative(workbenchRoot, evidenceLedgerPath),
    items: evidenceItems.length,
    status: 'complete',
  });

  await appendRunEvent(runLogPath, {
    type: 'artifact.written',
    artifactType: 'xlsx',
    outputPath: xlsxResult.outputPath,
    manifestPath: xlsxResult.manifestPath,
  });
  await appendRunEvent(runLogPath, { type: 'policy.checked', action: 'artifact.validate_xlsx', decision: 'allow' });
  await appendRunEvent(runLogPath, {
    type: 'artifact.validated',
    validation: xlsxResult.validation,
  });
  await appendRunEvent(runLogPath, {
    type: 'run.completed',
    status: 'completed',
    outputPath: xlsxResult.outputPath,
  });

  return {
    ok: true,
    mode: 'real-bridge',
    runId,
    runLogPath,
    rawDir,
    period,
    outputPath: xlsxResult.outputPath,
    evidenceLedgerPath,
    manifestPath: xlsxResult.manifestPath,
    workbookName: xlsxResult.workbookName,
    validation: xlsxResult.validation,
    toolSummary: summarizeObservations(observations),
  };
}

/**
 * buildHostMaterialPayload 把工具观察结果转成 XLSX builder 所需主持材料。
 *
 * 作用：
 * - 只从真实 observation 提取人员、重点询盘和覆盖情况。
 * - 在数据不足时写“未返回 / 不可判断 / 待复查”，避免编造客户或数字。
 * - 生成管理层能看懂的结论、问题、提问和行动表。
 *
 * 参数：
 * - input.period：复盘周期。
 * - input.observations：工具调用结果数组。
 * - input.discovery：工具发现结果数组。
 *
 * 返回值：标准化主持材料 JSON。
 * 可能抛出的异常：无。
 */
export function buildHostMaterialPayload(input) {
  const period = input.period;
  const observations = input.observations || [];
  const discovery = input.discovery || [];
  const range = `${period.start} ~ ${period.end}`;
  const coverage = buildCoverageRows(observations, discovery, range);
  const people = extractSalespeople(observations);
  const priorityInquiries = extractPriorityInquiries(observations);
  const missingBusinessSources = coverage.filter((row) => row.status !== '完整').map((row) => row.source);
  const hasPriorityEvidence = priorityInquiries.some((item) => item.buyer !== '未返回' || item.evidence !== '未返回');

  const reviewFinding = hasPriorityEvidence
    ? '质检明细中已经出现需要主管盯住的重点询盘风险；管理层本次应先确认负责人是否清楚下一步，以及是否已有报价、样品或下次沟通安排。'
    : '本次已完成只读采集，但重点询盘逐条证据覆盖不足；管理层可以先复查数据缺口和负责人分配，不能把未返回数据解释成没有跟进问题。';

  const reviewNote = missingBusinessSources.length
    ? `覆盖不足来源：${missingBusinessSources.slice(0, 4).join('、')}。`
    : '必采来源均已返回，可进入逐人和逐询盘复盘。';

  return {
    period,
    meeting: {
      audience: '老板 + 销售主管 + 管理团队',
      scope_note: '本次复盘只看询盘、IM 会话和业务员跟进动作。',
      focus: '用已获取的询盘和会话证据判断跟进风险，形成下周整改动作。',
    },
    coverage,
    review_summary: [
      {
        topic: hasPriorityEvidence ? '重点询盘跟进风险' : '数据覆盖与重点客户复查',
        finding: reviewFinding,
        owner: '销售主管',
        management_action: hasPriorityEvidence
          ? '会上逐条确认重点询盘负责人、当前推进结果和下次沟通安排。'
          : '先确认本周询盘复盘所需的数据来源是否齐全，再让主管按已返回线索复查重点客户。',
        review_metric: '下次复盘检查重点询盘是否都有负责人、报价或样品安排、下一次沟通时间。',
        note: reviewNote,
      },
    ],
    overview: buildOverviewRows(observations),
    salespeople: people.length ? people : buildUnknownSalespersonRows(observations),
    priority_inquiries: priorityInquiries.length ? priorityInquiries : buildUnknownPriorityRows(observations),
    common_issues: buildCommonIssues(priorityInquiries, missingBusinessSources, observations),
    review_questions: buildReviewQuestions(priorityInquiries, missingBusinessSources),
    corrective_actions: buildCorrectiveActions(priorityInquiries, missingBusinessSources),
    followup_items: buildFollowupItems(priorityInquiries, missingBusinessSources, observations),
  };
}

/**
 * writeAlibabaEvidenceLedger 保存询盘复盘 XLSX 的内部证据账本。
 *
 * 作用：
 * - 让真实 XLSX 产物不只依赖 manifest,还保留可机器检查的 evidence ledger。
 * - 只写业务化来源、覆盖、缺口和摘要,不写 bridge、tool name、raw path 或鉴权信息。
 * - 前台不直接展示这个 JSON;它是 Runtime 后台追溯和后续 typed evaluator 的输入。
 *
 * 参数：
 * - input.manifestPath：XLSX builder 生成的 manifest 路径,ledger 会写到同目录。
 * - input.payload：主持材料 payload。
 * - input.period：复盘周期。
 * - input.runId：本轮真实执行 runId。
 *
 * 返回值：Promise<string>,写入的 evidence-ledger.json 绝对路径。
 * 可能抛出的异常：目录创建或文件写入失败时抛出。
 */
async function writeAlibabaEvidenceLedger(input = {}) {
  if (!input.manifestPath) {
    throw new Error('writeAlibabaEvidenceLedger requires manifestPath');
  }

  const ledgerPath = path.join(path.dirname(input.manifestPath || ''), 'evidence-ledger.json');
  const payload = input.payload || {};
  const ledger = {
    artifact: {
      name: '询盘分析会.xlsx',
      type: 'xlsx',
    },
    createdAt: new Date().toISOString(),
    items: input.items || buildAlibabaEvidenceItems(payload),
    period: input.period || payload.period || {},
    runId: input.runId || '',
    skillId: 'alibaba-inquiry-meeting',
  };

  await mkdir(path.dirname(ledgerPath), { recursive: true });
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  return ledgerPath;
}

/**
 * evaluateAlibabaTypedArtifact 对真实询盘复盘产物执行最小 typed evaluator。
 *
 * 作用：
 * - 在 `run.completed` 前检查 XLSX builder validation 和 evidence ledger 结构。
 * - 防止 builder 或证据账本结构明显不合格时,Runtime 仍把任务标成完成。
 * - 这是内部质量门槛,前台仍只看到“检查结果”这类业务语言。
 *
 * 参数：
 * - input.xlsxResult：XLSX builder 返回值,包含 outputPath、manifestPath、validation。
 * - input.evidenceItems：即将写入 evidence ledger 的证据数组。
 *
 * 返回值：{ok:boolean, checks:object, reasons:string[]}。
 * 可能抛出的异常：当前函数只做内存检查,不主动抛出异常。
 */
function evaluateAlibabaTypedArtifact(input = {}) {
  const xlsxResult = input.xlsxResult || {};
  const validation = xlsxResult.validation || {};
  const evidenceItems = Array.isArray(input.evidenceItems) ? input.evidenceItems : [];
  const requiredSections = ['coverage', 'priority_inquiries', 'common_issues', 'corrective_actions'];
  const requiredFields = ['source', 'confidence', 'coverage', 'gap', 'freshness', 'summary'];
  const sections = new Set(evidenceItems.map((item) => item.section).filter(Boolean));
  const missingSections = requiredSections.filter((section) => !sections.has(section));
  const itemsWithMissingFields = evidenceItems.filter((item) =>
    requiredFields.some((field) => !Object.hasOwn(item, field))
  ).length;
  const internalLeakCount = evidenceItems.filter((item) => looksInternalEvidenceText(JSON.stringify(item))).length;
  const checks = {
    builderExitCode: validation.builderExitCode,
    hasManifestPath: Boolean(xlsxResult.manifestPath),
    hasOutputPath: Boolean(xlsxResult.outputPath),
    internalLeakCount,
    itemsWithMissingFields,
    missingSections,
    workbookExists: validation.workbookExists,
  };
  const reasons = [];

  if (!checks.hasOutputPath) {
    reasons.push('缺少 XLSX 输出路径');
  }
  if (!checks.hasManifestPath) {
    reasons.push('缺少 manifest 路径');
  }
  if (validation.builderExitCode !== 0) {
    reasons.push('XLSX builder 未正常退出');
  }
  if (validation.workbookExists !== true) {
    reasons.push('XLSX 文件未通过存在性校验');
  }
  if (missingSections.length) {
    reasons.push(`evidence ledger 缺少分区:${missingSections.join(',')}`);
  }
  if (itemsWithMissingFields > 0) {
    reasons.push('evidence ledger 存在缺字段条目');
  }
  if (internalLeakCount > 0) {
    reasons.push('evidence ledger 存在内部工具或本地路径泄漏');
  }

  return {
    checks,
    ok: reasons.length === 0,
    reasons,
  };
}

/**
 * buildAlibabaEvidenceItems 把主持材料转换成统一 evidence ledger item。
 *
 * 参数：
 * - payload：主持材料 payload,来源于真实 Alibaba 只读采集后的业务化摘要。
 *
 * 返回值：Array<object>,每条包含 section、source、confidence、coverage、gap、freshness、summary。
 * 可能抛出的异常：当前函数只做内存转换,不主动抛出异常。
 */
function buildAlibabaEvidenceItems(payload = {}) {
  const items = [];
  for (const row of payload.coverage || []) {
    items.push({
      section: 'coverage',
      source: businessSafeText(row.source || '数据覆盖'),
      confidence: row.status === '完整' ? 'high' : 'partial',
      coverage: businessSafeText(row.coverage || row.status || '待复查'),
      gap: row.status === '完整' ? '' : businessSafeText(row.note || '该来源覆盖不足,结论需标为待复查。'),
      freshness: businessSafeText(payload.period?.label || ''),
      summary: `${businessSafeText(row.source || '数据覆盖')}: ${businessSafeText(row.status || '待复查')}`,
    });
  }
  for (const row of payload.priority_inquiries || []) {
    items.push({
      section: 'priority_inquiries',
      source: businessSafeText(row.owner || '销售主管'),
      confidence: row.buyer && row.buyer !== '未返回' ? 'medium' : 'partial',
      coverage: businessSafeText(row.level || row.country || ''),
      gap: row.buyer === '未返回' ? '缺少可逐条复盘的买家和会话证据。' : '',
      freshness: businessSafeText(payload.period?.label || ''),
      summary: `${businessSafeText(row.buyer || '重点询盘')}: ${businessSafeText(row.evidence || row.issue || '待复查')}`,
    });
  }
  for (const row of payload.common_issues || []) {
    items.push({
      section: 'common_issues',
      source: '主持材料归因',
      confidence: 'medium',
      coverage: businessSafeText(row.issue || '共性问题'),
      gap: '',
      freshness: businessSafeText(payload.period?.label || ''),
      summary: `${businessSafeText(row.issue || '共性问题')}: ${businessSafeText(row.evidence || row.next_step || '待复查')}`,
    });
  }
  for (const row of payload.corrective_actions || []) {
    items.push({
      section: 'corrective_actions',
      source: businessSafeText(row.owner || '销售主管'),
      confidence: 'medium',
      coverage: businessSafeText(row.priority || 'P1'),
      gap: '',
      freshness: businessSafeText(payload.period?.label || ''),
      summary: `${businessSafeText(row.action || '整改动作')}: ${businessSafeText(row.verification || '下次复盘检查')}`,
    });
  }
  return items.filter((item) => item.summary && !looksInternalEvidenceText(JSON.stringify(item)));
}

/**
 * looksInternalEvidenceText 判断证据文本是否夹带内部工具、bridge 或本地路径词。
 *
 * 参数：
 * - value：待检查文本。
 *
 * 返回值：boolean,true 表示该文本不适合作为业务 evidence ledger 公开/落账内容。
 * 可能抛出的异常：当前函数只做正则检查,不主动抛出异常。
 */
function looksInternalEvidenceText(value = '') {
  return /query_|subaccount_query|bridge|Gateway|localhost|127\.0\.0\.1|file:\/\/|\/tmp\/|\/Users\/|\/var\/folders\/|workbench\/|rawPath|toolName/i.test(String(value || ''));
}

/**
 * callDiscoveredTool 调用一个经过发现确认的只读工具。
 *
 * 作用：
 * - 对缺失工具写降级事件，而不是让整个复盘中断。
 * - 对真实调用写 `tool.called` 事件和 rawPath。
 * - 对失败调用写 `tool.degraded` 事件，供最终 coverage 说明业务影响。
 *
 * 参数：
 * - options.bridgeClient：只读工具客户端。
 * - options.availableTools：已发现工具名集合。
 * - options.runLogPath：append-only run log 路径。
 * - options.callIndex：可变计数器，用于生成 raw 文件顺序。
 * - options.toolName：内部工具名。
 * - options.businessSource：业务化数据来源名称。
 * - options.args：工具入参。
 * - options.date：可选日期。
 * - options.optional：是否为补充工具。
 *
 * 返回值：Promise<object>，标准 observation。
 * 可能抛出的异常：不会主动抛出；工具异常会转成 ok:false observation。
 */
async function callDiscoveredTool(options) {
  const required = !options.optional && REQUIRED_TOOLS.includes(options.toolName);
  const observationBase = {
    toolName: options.toolName,
    businessSource: options.businessSource,
    date: options.date || '',
    required,
    args: options.args,
  };

  if (!options.availableTools.has(options.toolName)) {
    const observation = {
      ...observationBase,
      ok: false,
      missing: true,
      status: 'missing',
      data: null,
      rawPath: '',
      businessImpact: '当前工具不可用，本次只能在相关 sheet 标记未返回。',
    };
    await appendRunEvent(options.runLogPath, {
      type: 'tool.degraded',
      toolName: options.toolName,
      businessSource: options.businessSource,
      reason: 'missing',
    });
    return observation;
  }

  options.callIndex.value += 1;
  try {
    const result = await options.bridgeClient.callTool(options.toolName, options.args, {
      index: options.callIndex.value,
      businessSource: options.businessSource,
    });
    const observation = {
      ...observationBase,
      ok: Boolean(result.ok),
      missing: false,
      status: result.status || 0,
      data: result.data ?? null,
      rawPath: result.rawPath || '',
      byteLength: result.byteLength || 0,
      businessImpact: result.ok ? '已返回，可纳入本次复盘。' : '返回不可用，本次只能标记为未返回或待复查。',
      error: result.ok ? '' : businessSafeText(result.error || '返回不可用', '返回不可用'),
    };
    await appendRunEvent(options.runLogPath, {
      type: result.ok ? 'tool.called' : 'tool.degraded',
      toolName: options.toolName,
      businessSource: options.businessSource,
      ok: observation.ok,
      status: observation.status,
      rawPath: observation.rawPath,
      date: options.date || undefined,
    });
    return observation;
  } catch (error) {
    const observation = {
      ...observationBase,
      ok: false,
      missing: false,
      status: 'failed',
      data: null,
      rawPath: '',
      businessImpact: '调用失败，本次只能标记为未返回或待复查。',
      error: businessSafeText(error?.message || '调用失败', '调用失败'),
    };
    await appendRunEvent(options.runLogPath, {
      type: 'tool.degraded',
      toolName: options.toolName,
      businessSource: options.businessSource,
      reason: 'failed',
    });
    return observation;
  }
}

/**
 * buildCoverageRows 生成业务化的数据覆盖说明。
 *
 * 参数：
 * - observations：工具观察结果。
 * - discovery：工具发现结果。
 * - range：复盘日期范围文本。
 *
 * 返回值：coverage 数组。
 * 可能抛出的异常：无。
 */
function buildCoverageRows(observations, discovery, range) {
  const groups = [
    { source: '业务员清单', match: (item) => item.businessSource === '业务员清单' },
    { source: '业务员沟通诊断', match: (item) => item.businessSource.startsWith('业务员沟通诊断') },
    { source: '店铺询盘接待总览', match: (item) => item.businessSource.startsWith('店铺询盘接待总览') },
    { source: '聊天质检明细', match: (item) => item.businessSource === '聊天质检明细' },
    { source: '公司与主营背景', match: (item) => item.businessSource === '公司与主营背景' },
    { source: '联系人清单', match: (item) => item.businessSource === '联系人清单' },
  ];

  const rows = groups.map((group) => {
    const items = observations.filter(group.match);
    const okCount = items.filter((item) => item.ok).length;
    const attemptedCount = items.filter((item) => !item.missing).length;
    const status = okCount === items.length && items.length > 0 ? '完整' : okCount > 0 ? '部分' : '未返回';
    return {
      source: group.source,
      range,
      status,
      note:
        status === '完整'
          ? `已获取 ${okCount}/${items.length} 组数据，可用于本次复盘。`
          : attemptedCount > 0
            ? `仅获取 ${okCount}/${items.length} 组数据，相关判断只覆盖已返回部分。`
            : '本次未获取到该来源，相关人员、客户或指标只能列为不可判断。',
    };
  });

  const missingOptional = discovery.filter((item) => !item.required && !item.available).map((item) => item.name);
  if (missingOptional.length) {
    rows.push({
      source: '补充画像与交易线索',
      range,
      status: '未返回',
      note: '部分补充画像或交易核实入口本次不可用；不影响基础复盘结构，但重点询盘画像需要下次复查。',
    });
  }
  return rows;
}

/**
 * buildOverviewRows 生成管理层概览 sheet 的覆盖指标。
 *
 * 参数：
 * - observations：工具观察结果。
 *
 * 返回值：overview 数组。
 * 可能抛出的异常：无。
 */
function buildOverviewRows(observations) {
  const acct = countGroup(observations, (item) => item.businessSource.startsWith('业务员沟通诊断'));
  const shop = countGroup(observations, (item) => item.businessSource.startsWith('店铺询盘接待总览'));
  const chat = countGroup(observations, (item) => item.businessSource === '聊天质检明细');
  const shopRecords = observationRecords(observations, (item) => item.businessSource.startsWith('店铺询盘接待总览'));
  const firstReply = averageNumber(shopRecords, 'fiveMinReplyRate');
  const firstReplyAvg = averageNumber(shopRecords, 'fiveMinReplyRateAvg');
  const firstReplyTop = averageNumber(shopRecords, 'fiveMinReplyRate20th');
  const replyTime = averageNumber(shopRecords, 'replyTime');
  const replyTimeAvg = averageNumber(shopRecords, 'replyTimeAvg');
  const replyTimeTop = averageNumber(shopRecords, 'replyTime20th');
  const depthRate = averageNumber(shopRecords, 'buyerAb3Rate');
  const depthRateAvg = averageNumber(shopRecords, 'buyerAb3RateAvg');
  const depthRateTop = averageNumber(shopRecords, 'buyerAb3Rate20th');
  const unreadRate = averageNumber(shopRecords, 'buyerRnrRate');
  const remindOpen = averageNumber(shopRecords, 'remindOpenAcctNum');
  if (shopRecords.length) {
    const chat = countGroup(observations, (item) => item.businessSource === '聊天质检明细');
    return [
      {
        metric: '5分钟首次回复率（全员）',
        general_value: formatPercent(firstReply),
        l1_value: '按 L1+ 分组采集',
        industry_avg: formatPercent(firstReplyAvg),
        top20: formatPercent(firstReplyTop),
        meeting_judgement: firstReplyTop !== null && firstReply !== null && firstReply < firstReplyTop
          ? '整体低于 Top20% 门槛，会议应追问哪些账号拖慢首回速度。'
          : '首回速度已有可用数据，会议重点看低位账号和离线时段。',
      },
      {
        metric: '平均首次回复时长',
        general_value: formatHours(replyTime),
        l1_value: '按 L1+ 分组采集',
        industry_avg: formatHours(replyTimeAvg),
        top20: formatHours(replyTimeTop),
        meeting_judgement: replyTimeTop !== null && replyTime !== null && replyTime > replyTimeTop
          ? '首次回复时长高于头部门槛，需确认离线和周末是否有人接班。'
          : '回复时长可进入逐人复盘，重点看异常账号。',
      },
      {
        metric: '深度沟通率（≥3轮）',
        general_value: formatPercent(depthRate),
        l1_value: '按 L1+ 分组采集',
        industry_avg: formatPercent(depthRateAvg),
        top20: formatPercent(depthRateTop),
        meeting_judgement: depthRateTop !== null && depthRate !== null && depthRate < depthRateTop
          ? '深度沟通还没到头部水准，需看哪些账号只完成浅层接待。'
          : '深度沟通可作为本周业务员复盘的正向或短板信号。',
      },
      {
        metric: '已读未回率',
        general_value: formatPercent(unreadRate),
        l1_value: '未返回',
        industry_avg: '未返回',
        top20: '未返回',
        meeting_judgement: unreadRate !== null && unreadRate > 0.25
          ? '已读未回偏高，会议应检查主账号和重点询盘是否存在二次触达断点。'
          : '已读未回未形成明显高压信号，但仍需结合重点询盘逐条看。',
      },
      {
        metric: '消息提醒开启账号数',
        general_value: remindOpen === null ? '未返回' : `${Math.round(remindOpen)} 个`,
        l1_value: '未返回',
        industry_avg: '未返回',
        top20: '未返回',
        meeting_judgement: remindOpen !== null && remindOpen < 8
          ? '消息提醒覆盖不足，主管需要当场验收账号提醒状态。'
          : '消息提醒覆盖可作为下次会后追踪项继续抽查。',
      },
      {
        metric: '聊天质检明细覆盖',
        general_value: `已获取 ${chat.ok}/${chat.total} 天`,
        l1_value: '逐日采集',
        industry_avg: '未返回',
        top20: '未返回',
        meeting_judgement: chat.ok ? '可以从质检明细中挑选重点询盘和共性问题。' : '未返回时不能判断重点询盘质量。',
      },
    ];
  }
  return [
    {
      metric: '业务员沟通诊断覆盖',
      general_value: `已获取 ${acct.ok}/${acct.total} 组`,
      l1_value: '按 L1+ 分组采集',
      industry_avg: '未返回',
      top20: '未返回',
      meeting_judgement: acct.ok ? '可以用于逐人复盘，但只对已返回日期下结论。' : '未返回，不能判断业务员指标表现。',
    },
    {
      metric: '店铺询盘接待总览覆盖',
      general_value: `已获取 ${shop.ok}/${shop.total} 组`,
      l1_value: '按 L1+ 分组采集',
      industry_avg: '未返回',
      top20: '未返回',
      meeting_judgement: shop.ok ? '可以辅助判断本周大盘接待状态。' : '未返回，不能把缺失解释为店铺接待正常。',
    },
    {
      metric: '聊天质检明细覆盖',
      general_value: `已获取 ${chat.ok}/${chat.total} 天`,
      l1_value: '未返回',
      industry_avg: '未返回',
      top20: '未返回',
      meeting_judgement: chat.ok ? '可优先从质检明细中挑选重点询盘复盘。' : '未返回，重点询盘需要主管线下复查。',
    },
  ];
}

/**
 * extractSalespeople 从真实返回中提取业务员行。
 *
 * 参数：
 * - observations：工具观察结果。
 *
 * 返回值：salespeople 数组；只包含从返回值中看到的人员或账号。
 * 可能抛出的异常：无。
 */
function extractSalespeople(observations) {
  const metrics = aggregateSalespersonMetrics(observations);
  if (metrics.length) {
    return metrics.slice(0, 20).map((person, index) => ({
      rank: String(index + 1),
      name: person.name,
      performance: `周接待 ${formatNumber(person.newBuyerNum)} 人，5 分钟回复率 ${formatPercent(person.fiveMinReplyRate)}，平均首回 ${formatHours(person.replyTime)}，深度沟通 ${formatPercent(person.buyerAb3Rate)}，已读未回 ${formatPercent(person.buyerRnrRate)}。`,
      typical_inquiries: person.qualityCount
        ? `本周期质检命中 ${person.qualityCount} 条，需结合重点询盘逐条复盘。`
        : '本周期未提取到质检命中，仍需抽查重点客户是否有下一步。',
      meeting_comment: person.fiveMinReplyRate !== null && person.fiveMinReplyRate >= 0.6
        ? '回复速度处在团队前列，可作为内部打法样本；会议重点确认接待量上升后是否仍能稳住质量。'
        : '回复速度或跟进质量存在短板，会议应确认是离线接班、提醒设置还是优先级管理问题。',
      meeting_question: person.qualityCount
        ? `${person.name} 本周期质检命中的重点买家是否已经形成报价、样品或下一次沟通安排？`
        : `${person.name} 名下是否有高意向买家停在基础确认，没有进入报价或样品环节？`,
      next_week_action: '销售主管按该业务员名下重点询盘抽查负责人、报价或样品安排、下一次沟通时间。',
    }));
  }

  const names = new Set();
  for (const observation of observations.filter((item) => item.businessSource === '业务员清单' && item.ok)) {
    for (const record of collectObjects(observation.data)) {
      const name = salespersonName(record) || firstField(record, ['name', 'realName', 'nickName', 'displayName', 'userName', 'accountName', 'loginName', 'loginId']);
      const safeName = businessSafeText(name, '');
      if (safeName && safeName !== '未返回') {
        names.add(safeName);
      }
    }
  }

  return [...names].slice(0, 20).map((name, index) => ({
    rank: String(index + 1),
    name,
    performance: '已返回业务员清单；具体指标只按已返回的账号诊断日期复盘。',
    typical_inquiries: '典型询盘需结合聊天质检明细或会话证据确认。',
    meeting_comment: '当前先确认该业务员负责的重点询盘是否都有明确下一步；没有逐条证据时不做人责定性。',
    meeting_question: '本周该业务员名下是否有高意向买家停在基础确认，没有报价、样品或下次沟通安排？',
    next_week_action: '由销售主管抽查该业务员的重点询盘，检查负责人、报价或样品安排、下一次沟通时间。',
  }));
}

/**
 * extractPriorityInquiries 从聊天质检和诊断返回中提取重点询盘。
 *
 * 参数：
 * - observations：工具观察结果。
 *
 * 返回值：priority_inquiries 数组。
 * 可能抛出的异常：无。
 */
function extractPriorityInquiries(observations) {
  const rows = [];
  for (const observation of observations.filter((item) => item.businessSource === '聊天质检明细' && item.ok)) {
    for (const record of businessDataRecords(observation.data)) {
      const issue = businessSafeText(chatIssue(record), '');
      const evidence = businessSafeText(chatEvidence(record), '');
      const buyer = businessSafeText(buyerName(record), '');
      const owner = businessSafeText(salespersonName(record) || firstField(record, ['owner', 'sellerName', 'salesName', 'operatorName', 'accountName', 'loginName']), '');
      const level = businessSafeText(firstField(record, ['level', 'buyerLevel', 'buyerType', 'customerLevel']), '');
      const country = businessSafeText(firstField(record, ['country', 'countryCode', 'nation']), '');
      if (!issue && !evidence && !buyer && !owner) {
        continue;
      }
      rows.push({
        priority: issue || level ? 'P1' : 'P2',
        buyer: buyer || '未返回',
        level: level || '未返回',
        country: country || '未返回',
        owner: owner || '未返回',
        issue: issue || '质检明细返回异常线索，但问题类型未返回。',
        evidence: evidence || `质检明细在 ${observation.date || '本周期'} 返回线索，完整会话证据未返回。`,
        meeting_confirm: '会上确认负责人是否已经形成报价、样品安排或下一次沟通时间；证据不足时先列为待复查。',
        suggested_next_step: '由销售主管复核该询盘当前推进结果，并在下次复盘前检查客户回复状态。',
      });
      if (rows.length >= 30) {
        return rows;
      }
    }
  }
  return rows;
}

/**
 * buildUnknownSalespersonRows 在人员数据不足时生成不可判断说明。
 *
 * 参数：
 * - observations：工具观察结果。
 *
 * 返回值：salespeople 数组。
 * 可能抛出的异常：无。
 */
function buildUnknownSalespersonRows(observations) {
  const acct = countGroup(observations, (item) => item.businessSource.startsWith('业务员沟通诊断'));
  return [
    {
      rank: '1',
      name: '未返回',
      performance: acct.ok ? '账号维度诊断已有部分返回，但业务员姓名或账号清单未返回。' : '业务员清单和账号维度诊断均未形成可用人员明细。',
      typical_inquiries: '未返回',
      meeting_comment: '不能编造业务员姓名或个人表现；本次只记录数据缺口，等人员明细返回后再逐人复盘。',
      meeting_question: '本周账号诊断是否能补到具体业务员？如果不能，主管需要用内部客户分配表补证据。',
      next_week_action: '销售主管在下次复盘前提供业务员与重点询盘对应关系，再补逐人复盘。',
    },
  ];
}

/**
 * buildUnknownPriorityRows 在重点询盘不足时生成不可判断说明。
 *
 * 参数：
 * - observations：工具观察结果。
 *
 * 返回值：priority_inquiries 数组。
 * 可能抛出的异常：无。
 */
function buildUnknownPriorityRows(observations) {
  const chat = countGroup(observations, (item) => item.businessSource === '聊天质检明细');
  return [
    {
      priority: 'P2',
      buyer: '未返回',
      level: '未返回',
      country: '未返回',
      owner: '未返回',
      issue: chat.ok ? '聊天质检明细已返回，但未提取到可逐条复盘的买家、负责人或问题摘要。' : '聊天质检明细未返回，不能判断本周重点询盘问题。',
      evidence: '本次没有足够逐条会话证据；不能编造客户名、等级或消息内容。',
      meeting_confirm: '会上先确认质检明细和会话证据为什么不足，再决定是否补跑或人工抽查重点客户。',
      suggested_next_step: '销售主管按本周高意向客户清单抽查，记录负责人、报价或样品安排、下一次沟通时间。',
    },
  ];
}

/**
 * buildCommonIssues 生成共性问题归因。
 *
 * 参数：
 * - priorityInquiries：重点询盘数组。
 * - missingBusinessSources：覆盖不足来源列表。
 *
 * 返回值：common_issues 数组。
 * 可能抛出的异常：无。
 */
function buildCommonIssues(priorityInquiries, missingBusinessSources, observations = []) {
  const rows = [];
  if (priorityInquiries.some((item) => item.buyer !== '未返回')) {
    rows.push({
      issue: '重点询盘下一步不清',
      evidence: '质检明细中出现重点询盘线索，但部分记录缺少报价、样品安排或下一次沟通时间。',
      root_cause: '更像主管复盘口径和重点客户优先级管理不足，需要结合完整会话再判断个人能力或态度。',
      next_step: '每次复盘只检查重点询盘是否有负责人、推进结果和下次复查证据。',
    });
  }
  if (priorityInquiries.some((item) => /12 小时|已读未回|追问/.test(`${item.issue} ${item.evidence}`))) {
    rows.push({
      issue: '客户追问和超时回复集中出现',
      evidence: '重点询盘里出现超过 12 小时、已读未回或客户追问未承接的质检信号。',
      root_cause: '不是单条话术问题，而是重点买家进入后缺少主管日级待办和离线接班机制。',
      next_step: '主管每天固定检查重点买家待办，确认当日是否已有有效回复和下一步。',
    });
  }
  if (priorityInquiries.some((item) => /回复过短|打招呼|重复回复/.test(`${item.issue} ${item.evidence}`))) {
    rows.push({
      issue: '回复质量无法推进需求',
      evidence: '部分质检记录显示回复过短、只打招呼或重复回复，买家核心问题没有被承接。',
      root_cause: '业务员可能缺少按品类拆问题的答复模板，也可能没有及时拉产品或技术同事补证据。',
      next_step: '把重点询盘按产品、价格、认证、交付四类拆解，主管验收回复是否逐项回答。',
    });
  }
  const shopRecords = observationRecords(observations, (item) => item.businessSource.startsWith('店铺询盘接待总览'));
  const remindOpen = averageNumber(shopRecords, 'remindOpenAcctNum');
  if (remindOpen !== null && remindOpen < 8) {
    rows.push({
      issue: '消息提醒覆盖不足',
      evidence: `本周期消息提醒开启账号约 ${Math.round(remindOpen)} 个，未覆盖全部业务员账号。`,
      root_cause: '提醒状态没有被纳入复盘验收，离线和周末消息容易无人接班。',
      next_step: '例会前由每个账号提交提醒开启截图，主管抽查未开启账号本周不接重点询盘。',
    });
  }
  const accountRecords = observationRecords(observations, (item) => item.businessSource.startsWith('业务员沟通诊断'));
  const people = aggregateSalespersonMetrics(observations);
  const topVolume = people[0];
  const lowVolume = people.at(-1);
  if (accountRecords.length && topVolume && lowVolume && topVolume.newBuyerNum > lowVolume.newBuyerNum * 2) {
    rows.push({
      issue: '接待量分布不均',
      evidence: `${topVolume.name} 周接待 ${formatNumber(topVolume.newBuyerNum)} 人，${lowVolume.name} 周接待 ${formatNumber(lowVolume.newBuyerNum)} 人，差距超过 2 倍。`,
      root_cause: '新询盘默认流向少数账号，头部账号容易变成瓶颈，高质量但低接待量账号没有被充分利用。',
      next_step: '主管按品类和客户等级重分配新进询盘，并在下次复盘检查主账号接待量是否回落。',
    });
  }
  if (missingBusinessSources.length) {
    rows.push({
      issue: '复盘证据覆盖不足',
      evidence: `${missingBusinessSources.slice(0, 4).join('、')}未完整返回。`,
      root_cause: '数据源覆盖不足时，管理判断只能覆盖已获取部分，不能推导为团队没有问题。',
      next_step: '下次复盘前先确认这些来源是否能覆盖完整周期，再逐人追责。',
    });
  }
  return rows.length
    ? rows
    : [
        {
          issue: '重点客户复查节奏',
          evidence: '必采来源已返回，但仍需结合完整会话确认重点询盘是否形成推进结果。',
          root_cause: '复盘重点应从指标覆盖转向重点询盘闭环。',
          next_step: '销售主管按重点客户清单检查负责人、报价或样品安排、下一次沟通时间。',
        },
      ];
}

/**
 * buildFollowupItems 生成会后追踪项。
 *
 * 参数：
 * - priorityInquiries：重点询盘数组。
 * - missingBusinessSources：覆盖不足来源列表。
 * - observations：工具观察结果。
 *
 * 返回值：followup_items 数组。
 * 可能抛出的异常：无。
 */
function buildFollowupItems(priorityInquiries, missingBusinessSources, observations = []) {
  const shopRecords = observationRecords(observations, (item) => item.businessSource.startsWith('店铺询盘接待总览'));
  const firstReply = averageNumber(shopRecords, 'fiveMinReplyRate');
  const replyTime = averageNumber(shopRecords, 'replyTime');
  const remindOpen = averageNumber(shopRecords, 'remindOpenAcctNum');
  const items = [
    {
      check_item: '重点询盘是否形成闭环',
      verification: '下次会议逐条查看负责人、报价或样品安排、下一次沟通时间和客户回复状态。',
      status: '待复查',
    },
    {
      check_item: 'P0/P1 询盘行动表是否完成',
      verification: '对照下周跟进行动表检查每条重点询盘是否有平台会话或报价证据。',
      status: '待办',
    },
    {
      check_item: '行动表负责人是否逐条验收',
      verification: '销售主管下次会议逐条点名负责人，核对客户、动作、截止和验证证据。',
      status: '待办',
    },
    {
      check_item: '业务员 5 分钟回复率是否改善',
      verification: firstReply === null ? '下次复盘读取账号维度和店铺维度回复率。' : `下次复盘对比本次 ${formatPercent(firstReply)} 的团队基线。`,
      status: '待办',
    },
    {
      check_item: '平均首次回复时长是否下降',
      verification: replyTime === null ? '下次复盘读取平均首次回复时长。' : `下次复盘对比本次 ${formatHours(replyTime)} 的团队基线。`,
      status: '待办',
    },
    {
      check_item: '低回复账号是否完成主管复查',
      verification: '主管抽查低回复率业务员名下重点询盘，确认是否有离线接班和下一步。',
      status: '待办',
    },
    {
      check_item: '消息提醒是否全员开启',
      verification: remindOpen === null ? '下次复盘检查消息提醒开启账号数。' : `当前约 ${Math.round(remindOpen)} 个账号开启，下次要求截图验收。`,
      status: '待办',
    },
  ];
  if (priorityInquiries[0]?.buyer && priorityInquiries[0].buyer !== '未返回') {
    items.push({
      check_item: `${priorityInquiries[0].buyer} 是否完成重点推进`,
      verification: '下次会议查看该买家的回复、报价、样品或内部协同记录。',
      status: '待复查',
    });
  }
  if (missingBusinessSources.length) {
    items.push({
      check_item: '数据覆盖缺口是否消除',
      verification: '下次复盘前确认业务员、店铺总览、聊天质检和补充画像是否覆盖完整周期。',
      status: '待复查',
    });
  }
  return items;
}

/**
 * buildReviewQuestions 生成会议主持提问。
 *
 * 参数：
 * - priorityInquiries：重点询盘数组。
 * - missingBusinessSources：覆盖不足来源列表。
 *
 * 返回值：review_questions 数组。
 * 可能抛出的异常：无。
 */
function buildReviewQuestions(priorityInquiries, missingBusinessSources) {
  const first = priorityInquiries[0];
  const questions = [
    {
      target: first?.owner && first.owner !== '未返回' ? first.owner : '销售主管',
      meeting_question: first?.buyer && first.buyer !== '未返回'
        ? `${first.buyer} 当前是否已经有报价、样品安排或下一次沟通时间？`
        : '本周是否能列出需要主管盯住的重点询盘清单？',
      basis: first?.evidence || '重点询盘逐条证据不足，需要先确认客户和负责人。',
      expected_conclusion: '确认负责人、当前推进结果、下一步动作和下次复查证据。',
    },
  ];
  if (missingBusinessSources.length) {
    questions.push({
      target: '销售主管',
      meeting_question: '这些未完整返回的数据来源是否能在下次复盘前补齐？',
      basis: `${missingBusinessSources.slice(0, 4).join('、')}覆盖不足。`,
      expected_conclusion: '明确哪些管理判断可靠，哪些只能列为待复查。',
    });
  }
  for (const inquiry of priorityInquiries.slice(1, 7)) {
    questions.push({
      target: inquiry.owner && inquiry.owner !== '未返回' ? inquiry.owner : '销售主管',
      meeting_question: inquiry.buyer && inquiry.buyer !== '未返回'
        ? `${inquiry.buyer} 这条询盘当前卡点是什么，本周能否推进到明确报价或样品动作？`
        : '这条重点询盘缺少买家信息，负责人能否补齐会话证据？',
      basis: inquiry.evidence,
      expected_conclusion: '明确是否继续由原负责人推进，以及下次复盘看什么证据。',
    });
  }
  return questions;
}

/**
 * buildCorrectiveActions 生成下周跟进行动表。
 *
 * 参数：
 * - priorityInquiries：重点询盘数组。
 * - missingBusinessSources：覆盖不足来源列表。
 *
 * 返回值：corrective_actions 数组。
 * 可能抛出的异常：无。
 */
function buildCorrectiveActions(priorityInquiries, missingBusinessSources) {
  const first = priorityInquiries[0];
  const actions = [
    {
      priority: first?.priority || 'P1',
      action: first?.buyer && first.buyer !== '未返回'
        ? `复核 ${first.buyer}：${first.issue || '重点询盘'}，明确推进结果和下次沟通安排。`
        : '建立本周重点询盘复查清单，并逐条标记负责人和推进结果。',
      owner: first?.owner && first.owner !== '未返回' ? first.owner : '销售主管',
      customer: first?.buyer || '本周重点询盘清单',
      deadline: '下次复盘前',
      verification: '查看报价记录、样品安排、下一次沟通时间或客户回复状态。',
    },
  ];
  if (missingBusinessSources.length) {
    actions.push({
      priority: 'P2',
      action: '确认复盘数据覆盖口径，避免把未返回误判为没有问题。',
      owner: '销售主管',
      customer: '本周询盘复盘数据',
      deadline: '下次复盘前',
      verification: '检查业务员清单、店铺总览和聊天质检明细是否覆盖完整周期。',
    });
  }
  for (const inquiry of priorityInquiries.slice(1, 16)) {
    actions.push({
      priority: inquiry.priority || 'P1',
      action: inquiry.buyer && inquiry.buyer !== '未返回'
        ? `补齐 ${inquiry.buyer} 的推进结论：${inquiry.issue || '重点询盘需要主管复查'}。`
        : '补齐这条质检线索的买家、负责人和会话证据。',
      owner: inquiry.owner && inquiry.owner !== '未返回' ? inquiry.owner : '销售主管',
      customer: inquiry.buyer || '重点询盘线索',
      deadline: '下次复盘前',
      verification: '查看平台会话、报价记录、样品安排或客户回复状态。',
    });
  }
  if (actions.length < 3) {
    actions.push({
      priority: 'P1',
      action: '复盘本周回复速度最低的业务员账号，并确认离线接班和消息提醒是否打开。',
      owner: '销售主管',
      customer: '本周业务员询盘接待',
      deadline: '下次复盘前',
      verification: '查看账号维度回复率、回复时长和消息提醒开启状态。',
    });
  }
  return actions;
}

/**
 * summarizeObservations 生成 manifest 可读的工具摘要。
 *
 * 参数：
 * - observations：工具观察结果。
 *
 * 返回值：摘要对象。
 * 可能抛出的异常：无。
 */
function summarizeObservations(observations) {
  return {
    attempted: observations.filter((item) => !item.missing).length,
    succeeded: observations.filter((item) => item.ok).length,
    missing: observations.filter((item) => item.missing).length,
    requiredSucceeded: observations.filter((item) => item.required && item.ok).length,
    sources: [...new Set(observations.map((item) => item.businessSource))],
  };
}

/**
 * countGroup 统计某类 observation 的返回数量。
 *
 * 参数：
 * - observations：工具观察结果。
 * - predicate：分组判断函数。
 *
 * 返回值：包含 ok 和 total 的对象。
 * 可能抛出的异常：predicate 抛错时会透出。
 */
function countGroup(observations, predicate) {
  const items = observations.filter(predicate);
  return { ok: items.filter((item) => item.ok).length, total: items.length };
}

/**
 * aggregateSalespersonMetrics 汇总业务员维度诊断和质检命中。
 *
 * 参数：
 * - observations：工具观察结果。
 *
 * 返回值：按 5 分钟回复率排序的业务员指标数组。
 * 可能抛出的异常：无。
 */
function aggregateSalespersonMetrics(observations) {
  const people = new Map();
  const accountRecords = observationRecords(observations, (item) => item.businessSource.startsWith('业务员沟通诊断'));
  for (const record of accountRecords) {
    const name = salespersonName(record);
    if (!name) {
      continue;
    }
    const current = people.get(name) || {
      name,
      newBuyerNum: 0,
      fiveMinReplyRateValues: [],
      replyTimeValues: [],
      buyerAb3RateValues: [],
      buyerRnrRateValues: [],
      qualityCount: 0,
    };
    current.newBuyerNum += numberValue(record.newBuyerNum) || 0;
    pushNumber(current.fiveMinReplyRateValues, record.fiveMinReplyRate);
    pushNumber(current.replyTimeValues, record.replyTime);
    pushNumber(current.buyerAb3RateValues, record.buyerAb3Rate);
    pushNumber(current.buyerRnrRateValues, record.buyerRnrRate);
    people.set(name, current);
  }

  const qualityRecords = observationRecords(observations, (item) => item.businessSource === '聊天质检明细');
  for (const record of qualityRecords) {
    const name = salespersonName(record);
    if (!name) {
      continue;
    }
    const current = people.get(name) || {
      name,
      newBuyerNum: 0,
      fiveMinReplyRateValues: [],
      replyTimeValues: [],
      buyerAb3RateValues: [],
      buyerRnrRateValues: [],
      qualityCount: 0,
    };
    current.qualityCount += 1;
    people.set(name, current);
  }

  return [...people.values()]
    .map((person) => ({
      name: person.name,
      newBuyerNum: person.newBuyerNum,
      fiveMinReplyRate: average(person.fiveMinReplyRateValues),
      replyTime: average(person.replyTimeValues),
      buyerAb3Rate: average(person.buyerAb3RateValues),
      buyerRnrRate: average(person.buyerRnrRateValues),
      qualityCount: person.qualityCount,
    }))
    .sort((left, right) => {
      const rateDelta = (right.fiveMinReplyRate ?? -1) - (left.fiveMinReplyRate ?? -1);
      return rateDelta || right.newBuyerNum - left.newBuyerNum;
    });
}

/**
 * salespersonName 从记录里组装业务员姓名。
 *
 * 参数：
 * - record：Alibaba 业务记录。
 *
 * 返回值：业务员姓名；不可用时返回空字符串。
 * 可能抛出的异常：无。
 */
function salespersonName(record) {
  const direct = firstField(record, ['name', 'realName', 'nickName', 'displayName', 'userName', 'accountName', 'sellerName', 'salesName']);
  if (direct) {
    return businessSafeText(direct, '');
  }
  const firstName = firstField(record, ['firstName']);
  const lastName = firstField(record, ['lastName']);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return businessSafeText(fullName, '');
}

/**
 * buyerName 从记录里组合买家姓名或公司名。
 *
 * 参数：
 * - record：Alibaba 质检或会话记录。
 *
 * 返回值：买家名称；不可用时返回空字符串。
 * 可能抛出的异常：无。
 */
function buyerName(record) {
  const direct = firstField(record, ['buyer', 'buyerName', 'customerName', 'companyName', 'visitorName', 'conversationName']);
  if (direct) {
    return businessSafeText(direct, '');
  }
  const firstName = firstField(record, ['buyerFirstName']);
  const lastName = firstField(record, ['buyerLastName']);
  const fullName = [firstName, lastName].filter(Boolean).join(' / ').trim();
  return businessSafeText(fullName, '');
}

/**
 * chatIssue 把质检字段转成业务问题。
 *
 * 参数：
 * - record：聊天质检记录。
 *
 * 返回值：管理复盘问题文本。
 * 可能抛出的异常：无。
 */
function chatIssue(record) {
  const explicit = firstField(record, ['issue', 'problem', 'problemName', 'qualityProblem', 'reason']);
  if (explicit) {
    return explicit;
  }
  const flags = [];
  if (truthySignal(record.replyOver12hMsgTime) || truthySignal(record.replyOver12h)) {
    flags.push('超过 12 小时未形成有效回复');
  }
  if (truthySignal(record.buyerRnR) || truthySignal(record.buyerRnRMsgTime)) {
    flags.push('已读未回或客户追问未承接');
  }
  if (truthySignal(record.rcTooShort) || truthySignal(record.rcTooShortMsgContent)) {
    flags.push('回复过短，未回答买家核心问题');
  }
  if (truthySignal(record.onlyHi)) {
    flags.push('只停留在打招呼，没有推进需求确认');
  }
  if (truthySignal(record.repeatReplyMsgContent)) {
    flags.push('出现重复回复，可能影响买家信任');
  }
  if (truthySignal(record.evaluateUnsatisfied)) {
    flags.push('买家评价不满意，需要主管复查');
  }
  if (flags.length) {
    return flags.join('；');
  }
  return truthySignal(record.l3l4Buyer) ? '高等级买家需要主管复查跟进闭环' : '';
}

/**
 * chatEvidence 把质检消息字段转成可读证据。
 *
 * 参数：
 * - record：聊天质检记录。
 *
 * 返回值：证据文本。
 * 可能抛出的异常：无。
 */
function chatEvidence(record) {
  const evidence = firstField(record, [
    'evidence',
    'summary',
    'buyerMessage',
    'lastMessage',
    'buyerRnRMsgContent',
    'replyOver12hMsgContent',
    'rcTooShortMsgContent',
    'repeatReplyMsgContent',
  ]);
  if (evidence) {
    return evidence;
  }
  const time = firstField(record, ['replyOver12hMsgTime', 'buyerRnRMsgTime', 'rcTooShortMsgTime']);
  return time ? `质检记录时间：${time}` : '';
}

/**
 * averageNumber 计算一组记录某字段的平均值。
 *
 * 参数：
 * - records：业务记录数组。
 * - field：字段名。
 *
 * 返回值：平均数；没有可用值时返回 null。
 * 可能抛出的异常：无。
 */
function averageNumber(records, field) {
  return average(records.map((record) => numberValue(record[field])).filter((value) => value !== null));
}

/**
 * average 计算数字平均值。
 *
 * 参数：
 * - values：数字数组。
 *
 * 返回值：平均数；空数组返回 null。
 * 可能抛出的异常：无。
 */
function average(values) {
  const usable = values.filter((value) => value !== null && Number.isFinite(value));
  if (!usable.length) {
    return null;
  }
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

/**
 * numberValue 把字段转成数字。
 *
 * 参数：
 * - value：原始字段值。
 *
 * 返回值：数字；不可转时返回 null。
 * 可能抛出的异常：无。
 */
function numberValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * pushNumber 把可用数字加入数组。
 *
 * 参数：
 * - list：目标数组。
 * - value：原始字段值。
 *
 * 返回值：无。
 * 可能抛出的异常：无。
 */
function pushNumber(list, value) {
  const number = numberValue(value);
  if (number !== null) {
    list.push(number);
  }
}

/**
 * formatPercent 格式化比例或百分数。
 *
 * 参数：
 * - value：数字，0-1 按比例处理，大于 1 按百分数处理。
 *
 * 返回值：百分比文本；无值返回“未返回”。
 * 可能抛出的异常：无。
 */
function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '未返回';
  }
  const percent = Math.abs(value) <= 1 ? value * 100 : value;
  return `${percent.toFixed(2)}%`;
}

/**
 * formatHours 格式化小时数。
 *
 * 参数：
 * - value：小时数字。
 *
 * 返回值：小时文本；无值返回“未返回”。
 * 可能抛出的异常：无。
 */
function formatHours(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '未返回';
  }
  return `${Number(value).toFixed(2)} 小时`;
}

/**
 * formatNumber 格式化普通数字。
 *
 * 参数：
 * - value：数字。
 *
 * 返回值：整数或两位小数文本；无值返回“未返回”。
 * 可能抛出的异常：无。
 */
function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '未返回';
  }
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(2);
}

/**
 * truthySignal 判断质检字段是否代表命中。
 *
 * 参数：
 * - value：任意字段值。
 *
 * 返回值：布尔值。
 * 可能抛出的异常：无。
 */
function truthySignal(value) {
  if (value === null || value === undefined || value === '' || value === 0 || value === false) {
    return false;
  }
  if (typeof value === 'object' && !Object.keys(value).length) {
    return false;
  }
  return true;
}

/**
 * collectObjects 递归收集对象记录。
 *
 * 参数：
 * - value：任意 JSON 值。
 * - limit：最多收集多少对象。
 *
 * 返回值：对象数组。
 * 可能抛出的异常：无。
 */
function collectObjects(value, limit = 200) {
  const records = [];
  const visit = (item) => {
    if (records.length >= limit || item == null) {
      return;
    }
    if (Array.isArray(item)) {
      for (const child of item) visit(child);
      return;
    }
    if (typeof item === 'object') {
      records.push(item);
      for (const child of Object.values(item)) visit(child);
    }
  };
  visit(value);
  return records;
}

/**
 * businessDataRecords 从 Alibaba 返回中取真实 data 数组记录。
 *
 * 参数：
 * - value：工具返回的业务 JSON，常见形态为 {success,data:[...]}。
 *
 * 返回值：业务记录数组；如果没有 data 数组则退回递归对象收集。
 * 可能抛出的异常：无。
 */
function businessDataRecords(value) {
  if (Array.isArray(value?.data)) {
    return value.data.filter((item) => item && typeof item === 'object');
  }
  if (Array.isArray(value?.result?.data)) {
    return value.result.data.filter((item) => item && typeof item === 'object');
  }
  return collectObjects(value).filter((record) => hasBusinessFields(record));
}

/**
 * observationRecords 按来源提取所有业务记录。
 *
 * 参数：
 * - observations：工具观察结果。
 * - predicate：来源筛选函数。
 *
 * 返回值：业务记录数组。
 * 可能抛出的异常：predicate 抛错时会透出。
 */
function observationRecords(observations, predicate) {
  return observations.filter((item) => item.ok && predicate(item)).flatMap((item) => businessDataRecords(item.data));
}

/**
 * hasBusinessFields 判断对象是否像 Alibaba 业务记录。
 *
 * 参数：
 * - record：任意对象。
 *
 * 返回值：布尔值。
 * 可能抛出的异常：无。
 */
function hasBusinessFields(record) {
  const keys = Object.keys(record || {});
  return keys.some((key) => /firstName|lastName|buyer|reply|Rate|Num|Time|loginId|statsDate|contactName/i.test(key));
}

/**
 * firstField 从记录中按候选字段取第一个可用业务文本。
 *
 * 参数：
 * - record：一条对象记录。
 * - fields：候选字段名数组。
 *
 * 返回值：字段值字符串；找不到时返回空字符串。
 * 可能抛出的异常：无。
 */
function firstField(record, fields) {
  for (const field of fields) {
    if (record && Object.prototype.hasOwnProperty.call(record, field)) {
      const value = record[field];
      if (value !== null && value !== undefined && typeof value !== 'object' && String(value).trim()) {
        return String(value);
      }
    }
  }
  return '';
}

/**
 * businessSafeText 清理即将进入 XLSX 的业务文本。
 *
 * 参数：
 * - value：原始文本。
 * - fallback：文本为空或含内部技术词时的替代值。
 *
 * 返回值：适合给管理者看的单行文本。
 * 可能抛出的异常：无。
 */
function businessSafeText(value, fallback = '未返回') {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return fallback;
  }
  if (text === '[object Object]' || text === 'text') {
    return fallback;
  }
  if (/query_[A-Za-z0-9_]+|subaccount_query|Gateway|localhost|127\.0\.0\.1|file:\/\/|\/tmp\/|\/Users\/|\/var\/folders\/|workbench\/|Authorization|access token|ACCIO_GATEWAY_TOKEN|\/mcp\/proxy|bridge|Traceback|errorCode|errorMsg/i.test(text)) {
    return fallback;
  }
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

/**
 * enumerateDates 枚举开始和结束日期之间的每一天。
 *
 * 参数：
 * - start：YYYY-MM-DD。
 * - end：YYYY-MM-DD。
 *
 * 返回值：日期字符串数组。
 * 可能抛出的异常：日期格式无效时抛出 Error。
 */
function enumerateDates(start, end) {
  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);
  if (endDate < startDate) {
    throw new Error('period end must be after start');
  }
  const dates = [];
  for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
    dates.push(formatLocalDate(cursor));
  }
  return dates;
}

/**
 * startVersionSeconds 把复盘开始日期转成联系人增量查询秒级时间戳。
 *
 * 参数：
 * - dateText：YYYY-MM-DD。
 *
 * 返回值：Unix seconds。
 * 可能抛出的异常：日期格式无效时抛出 Error。
 */
function startVersionSeconds(dateText) {
  return Math.floor(parseDateOnly(dateText).getTime() / 1000);
}

/**
 * parseDateOnly 解析 YYYY-MM-DD 日期。
 *
 * 参数：
 * - value：日期字符串。
 *
 * 返回值：本地时区 Date。
 * 可能抛出的异常：格式无效时抛出 Error。
 */
function parseDateOnly(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`invalid date: ${value}`);
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * addDays 对本地日期加减天数。
 *
 * 参数：
 * - date：Date 对象。
 * - days：天数，正数向后、负数向前。
 *
 * 返回值：新的 Date 对象。
 * 可能抛出的异常：无。
 */
function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * formatLocalDate 格式化本地日期。
 *
 * 参数：
 * - date：Date 对象。
 *
 * 返回值：YYYY-MM-DD。
 * 可能抛出的异常：无。
 */
function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * appendRunEvent 追加一条 JSONL 运行事件。
 *
 * 参数：
 * - runLogPath：日志文件路径。
 * - event：事件对象。
 *
 * 返回值：Promise<void>。
 * 可能抛出的异常：文件写入失败时抛出系统异常。
 */
async function appendRunEvent(runLogPath, event) {
  await mkdir(path.dirname(runLogPath), { recursive: true });
  await appendFile(runLogPath, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`, 'utf8');
}

/**
 * normalizeToolNames 归一化工具发现结果。
 *
 * 参数：
 * - tools：工具名数组或工具对象数组。
 *
 * 返回值：工具名数组。
 * 可能抛出的异常：无。
 */
function normalizeToolNames(tools) {
  if (!Array.isArray(tools)) {
    return [];
  }
  return tools.map((tool) => (typeof tool === 'string' ? tool : tool?.name)).filter(Boolean);
}

/**
 * parseEnvFile 解析简单 `.env` 文本。
 *
 * 参数：
 * - content：文件内容。
 *
 * 返回值：键值对象。
 * 可能抛出的异常：无。
 */
function parseEnvFile(content) {
  return Object.fromEntries(
    String(content)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')];
      }),
  );
}

/**
 * parsePossiblyJson 尝试解析网关返回文本。
 *
 * 参数：
 * - text：HTTP 响应文本。
 *
 * 返回值：JSON 对象；不是 JSON 时返回 rawText 对象。
 * 可能抛出的异常：无。
 */
function parsePossiblyJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: String(text || '').slice(0, 500) };
  }
}

/**
 * unwrapGatewayResponse 兼容直接网关响应和 MCP content 响应。
 *
 * 参数：
 * - parsed：已解析响应。
 *
 * 返回值：包含 isError 和 value 的对象。
 * 可能抛出的异常：无。
 */
function unwrapGatewayResponse(parsed) {
  if (Array.isArray(parsed?.data?.content) && parsed.data.content[0]?.text) {
    return { isError: Boolean(parsed.data.isError), value: parsePossiblyJson(parsed.data.content[0].text) };
  }
  if (parsed && Object.prototype.hasOwnProperty.call(parsed, 'data')) {
    return { isError: false, value: parsed.data };
  }
  const result = parsed?.result ?? parsed;
  if (Array.isArray(result?.content) && result.content[0]?.text) {
    return { isError: Boolean(result.isError), value: parsePossiblyJson(result.content[0].text) };
  }
  return { isError: Boolean(result?.isError), value: result };
}

/**
 * summarizeGatewayFailure 把网关失败转成可记录但不泄密的文本。
 *
 * 参数：
 * - status：HTTP 状态码。
 * - value：响应内容。
 *
 * 返回值：短错误摘要。
 * 可能抛出的异常：无。
 */
function summarizeGatewayFailure(status, value) {
  if (status === 401) {
    return '本地网关鉴权失败，请刷新本地网关密码。';
  }
  if (value?.message) {
    return businessSafeText(value.message, '工具返回不可用');
  }
  if (value?.rawText) {
    return businessSafeText(value.rawText, '工具返回不可用');
  }
  return '工具返回不可用';
}

/**
 * writeRawToolResponse 写入原始工具响应审计文件。
 *
 * 参数：
 * - rawDir：raw 输出目录。
 * - index：调用序号。
 * - name：工具名。
 * - payload：要写入的对象，不包含 token。
 *
 * 返回值：写入文件路径。
 * 可能抛出的异常：文件写入失败时抛出系统异常。
 */
async function writeRawToolResponse(rawDir, index, name, payload) {
  await mkdir(rawDir, { recursive: true });
  const fileName = `${String(index).padStart(3, '0')}-${name.replace(/[^A-Za-z0-9_-]/g, '-')}.json`;
  const filePath = path.join(rawDir, fileName);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}

/**
 * generateRunId 生成本地 run id。
 *
 * 参数：
 * - prefix：run id 前缀。
 *
 * 返回值：形如 `<prefix>-YYYYMMDD-HHMMSS-ab12` 的字符串。
 * 可能抛出的异常：无。
 */
function generateRunId(prefix) {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const random = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${stamp}-${random}`;
}
