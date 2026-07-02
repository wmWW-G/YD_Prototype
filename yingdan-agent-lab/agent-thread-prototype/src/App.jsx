import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Download,
  FileText,
  History,
  LayoutGrid,
  ListChecks,
  MoreHorizontal,
  Paperclip,
  PenLine,
  Plus,
  Search,
  Send,
  Sparkles,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import {
  agentThreadStatusFromPayload,
  agentThreadStatusFromRestoredSession,
} from './agentThreadStatus.js';
import {
  buildReferenceDraftBlock,
  readReferenceFileText,
  referenceFileErrorMessage,
} from './agentReferenceMaterials.js';
import { mergeStreamingProgressItem } from './agentThreadProgress.js';
import { deriveAgentThreadTaskTitle } from './agentThreadTitle.js';
import { getNewConversationComposerState } from './agentThreadComposerState.js';
import {
  safeAgentInlineLabel,
  sanitizeAgentActivityItemForDisplay,
  sanitizeAgentConfirmationForDisplay,
  sanitizeAgentNeedsInputForDisplay,
  sanitizeAgentProcessStepForDisplay,
  scrubAgentArtifactDisplayName,
} from './agentThreadDisplayText.js';
import {
  buildAgentRequestContext,
  buildRecoverableWaitingContext,
  getCurrentAgentArtifact,
  pickNextSkillAgentResult,
} from './agentThreadContext.js';

const navItems = [
  { label: '新对话', icon: PenLine },
  { label: '赢单外贸顾问', icon: Sparkles },
  { label: '我的Agent', icon: Bot },
  { label: '技能Skill', icon: ListChecks },
  { label: '外接生态', icon: LayoutGrid },
  { label: '客户Kass', icon: UsersRound },
];

const collapsibleNavLabels = ['赢单外贸顾问', '客户Kass'];
const AGENT_THREAD_STORAGE_KEY = 'yingdan-agent-thread-state-v1';

const skillItems = [
  { id: 'market-research', label: '市场调研', desc: '分析目标市场、客户类型和切入机会', category: '获客准备', usage: 86 },
  { id: 'cold-email', label: '新客开发信', desc: '生成首次触达、报价和催回复邮件', category: '客户开发', usage: 132 },
  { id: 'complaint', label: '客诉处理', desc: '分析客诉责任并生成沟通方案', category: '订单服务', usage: 41 },
  { id: 'reactivation', label: '客户激活', desc: '唤醒沉默客户和老客户', category: '客户维护', usage: 58 },
  { id: 'relationship', label: '关系维护', desc: '节日、生日和项目节点轻商务触达', category: '客户维护', usage: 73 },
  { id: 'phone-sales', label: '海外电销', desc: '生成电话开场和异议处理脚本', category: '沟通推进', usage: 29 },
  { id: 'video-meeting', label: '视频会议', desc: '准备会议议程、发言和会后跟进', category: '沟通推进', usage: 36 },
  { id: 'field-visit', label: '地推陌拜', desc: '线下拜访前准备客户摸底和话术', category: '线下成交', usage: 17 },
  { id: 'visit-reception', label: '来访接待', desc: '客户来厂、验厂和接待方案', category: '线下成交', usage: 22 },
  { id: 'title-combo', label: '标题组合', desc: '组合商品标题、卖点和 FAQ', category: '内容运营', usage: 91 },
  { id: 'trade-show', label: '展会成交', desc: '展前、展中、展后成交推进', category: '展会场景', usage: 44 },
];

const advisorGroups = [
  {
    label: '基础顾问',
    items: [
      { id: 'ask', label: '问一下', desc: '外贸问题通用问答和快速建议' },
      { id: 'sales-prep', label: '销售准备', desc: '公司、产品、案例和外贸流程准备' },
    ],
  },
  {
    label: '成交顾问',
    items: [
      { id: 'customer-research', label: '客户背调顾问', desc: '整理客户画像、风险点和沟通建议' },
      { id: 'negotiation-scene', label: '场景谈判顾问', desc: '根据谈判场景生成推进策略' },
      { id: 'inquiry-reply', label: '询盘分析回复', desc: '判断询盘意向并生成英文回复' },
    ],
  },
];

const advisorPromptExamples = {
  ask: '新手外贸业务员今天应该先做哪三件事？',
  'sales-prep': '帮我整理这个产品的客户常问问题和回复要点。',
  'customer-research': '帮我分析这个客户的背景、采购可能性和风险点。',
  'negotiation-scene': '客户说价格太高，帮我设计一套不直接降价的回复策略。',
  'inquiry-reply': '帮我分析这条询盘值不值得跟，并生成英文回复草稿。',
  'market-research': '帮我调研这个产品在美国市场的客户类型和切入机会。',
  'cold-email': '帮我写一封开发美国批发商的英文开发信。',
  complaint: '客户投诉交期延误，帮我判断责任并生成英文安抚回复。',
  reactivation: '帮我激活一个 90 天没回复的老客户。',
  relationship: '帮我写一条自然的节日问候，不要太销售。',
  'phone-sales': '帮我准备一段海外电销开场白和常见异议回复。',
  'video-meeting': '帮我整理一个客户视频会议议程和会后跟进邮件。',
  'field-visit': '帮我准备陌拜这个客户前要问的问题和现场观察清单。',
  'visit-reception': '客户下周来厂验厂，帮我做接待流程和介绍话术。',
  'title-combo': '帮我把这些关键词组合成外贸商品标题、卖点和 FAQ。',
  'trade-show': '帮我安排展会后 7 天内的客户分层跟进计划。',
};

const myAgents = [
  {
    name: '询盘分析回复 Agent',
    role: '处理阿里国际站、邮件和表单询盘',
    skills: ['询盘分析', '英文回复', '跟进计划'],
    status: '团队默认',
    runCount: 128,
  },
  {
    name: '客户背调 Agent',
    role: '为业务员整理客户公司背景和风险点',
    skills: ['客户画像', '官网摘要', '采购可能性'],
    status: '已启用',
    runCount: 64,
  },
  {
    name: '展会成交 Agent',
    role: '展前邀约、展中接待、展后跟进',
    skills: ['邀约话术', '接待清单', '跟进邮件'],
    status: '草稿',
    runCount: 19,
  },
];

const ecosystemPluginGroups = [
  {
    title: '本地插件',
    plugins: [
      {
        name: '赢单国际站插件',
        provider: 'Alibaba.com',
        desc: '读取询盘、客户页、店铺看板和商品运营线索',
        status: '已安装',
        mark: '国',
        tone: 'orange',
      },
      {
        name: '小满 CRM 连接器',
        provider: '小满科技',
        desc: '连接客户、联系人、跟进记录和业务阶段',
        status: '待授权',
        mark: '小',
        tone: 'blue',
      },
    ],
  },
  {
    title: '电商与市场',
    plugins: [
      {
        name: '国际站生意助手',
        provider: 'Alibaba.com',
        desc: '店铺诊断、询盘分析、商品机会和运营建议',
        status: '推荐',
        mark: '阿',
        tone: 'orange',
      },
      {
        name: '1688 采购工具集',
        provider: '1688',
        desc: '选品、找货、供应商和价格信息查询',
        status: '可添加',
        mark: '1688',
        tone: 'orange',
      },
      {
        name: 'Shopify 连接器',
        provider: 'Shopify',
        desc: '商品、订单、客户和独立站运营数据',
        status: '可添加',
        mark: 'S',
        tone: 'green',
      },
      {
        name: 'SHOPLINE 连接器',
        provider: 'SHOPLINE',
        desc: '独立站商品、订单和营销活动连接',
        status: '可添加',
        mark: 'SL',
        tone: 'dark',
      },
      {
        name: 'WordPress 连接器',
        provider: 'WordPress',
        desc: '官网页面、博客内容和询盘表单管理',
        status: '可添加',
        mark: 'W',
        tone: 'gray',
      },
      {
        name: 'Google Trends 连接器',
        provider: 'Google',
        desc: '搜索趋势、国家热度和关键词变化',
        status: '可添加',
        mark: 'G',
        tone: 'blue',
      },
    ],
  },
  {
    title: '获客与营销',
    plugins: [
      {
        name: 'Apollo.io 连接器',
        provider: 'Apollo.io',
        desc: 'B2B 公司调研、联系人线索和销售触达',
        status: '可添加',
        mark: 'A',
        tone: 'yellow',
      },
      {
        name: 'Ahrefs 连接器',
        provider: 'Ahrefs',
        desc: 'SEO 关键词、竞品网站和内容机会',
        status: '可添加',
        mark: 'a',
        tone: 'orange',
      },
      {
        name: 'Instantly 连接器',
        provider: 'Instantly',
        desc: '冷邮件外联、序列任务和回复状态',
        status: '可添加',
        mark: 'I',
        tone: 'blue',
      },
      {
        name: 'Mailchimp 连接器',
        provider: 'Mailchimp',
        desc: '邮件订阅、营销活动和客户分组',
        status: '可添加',
        mark: 'M',
        tone: 'dark',
      },
      {
        name: 'Klaviyo 连接器',
        provider: 'Klaviyo',
        desc: '独立站邮件营销和客户自动化触达',
        status: '可添加',
        mark: 'K',
        tone: 'gray',
      },
      {
        name: 'Semrush 连接器',
        provider: 'Semrush',
        desc: '竞品流量、广告关键词和市场搜索洞察',
        status: '可添加',
        mark: 'Se',
        tone: 'orange',
      },
    ],
  },
  {
    title: '通用工具连接器',
    plugins: [
      {
        name: 'Gmail 连接器',
        provider: 'Google Mail',
        desc: '读取邮件线程、生成回复草稿和跟进提醒',
        status: '可添加',
        mark: 'GM',
        tone: 'red',
      },
      {
        name: 'Google Drive 连接器',
        provider: 'Google Drive',
        desc: '读取报价单、产品资料、合同和案例文件',
        status: '可添加',
        mark: 'D',
        tone: 'green',
      },
      {
        name: 'Notion 连接器',
        provider: 'Notion',
        desc: '同步团队知识库、SOP 和客户记录',
        status: '可添加',
        mark: 'N',
        tone: 'dark',
      },
      {
        name: 'Slack 连接器',
        provider: 'Slack',
        desc: '团队消息、客户事项和内部协作提醒',
        status: '可添加',
        mark: 'S',
        tone: 'purple',
      },
      {
        name: '飞书连接器',
        provider: 'Lark / 飞书',
        desc: '云文档、多维表格、审批和任务协同',
        status: '可添加',
        mark: '飞',
        tone: 'blue',
      },
      {
        name: '自定义连接器',
        provider: '本地配置',
        desc: '连接企业内部系统、ERP、BI 或私有 API',
        status: '创建',
        mark: '+',
        tone: 'gray',
      },
    ],
  },
];

const customerLevels = [
  {
    id: 'A',
    label: 'A 重点推进',
    desc: '高意向、近期要报价或催单',
    customers: [
      {
        id: 'global-sourcing',
        name: 'Global Sourcing Inc.',
        country: 'United States',
        source: 'Alibaba.com 询盘',
        stage: '新询盘',
        intent: '中高意向',
        lastTouch: '2026-06-26 14:31',
        product: '500ml 不锈钢保温杯',
        quantity: '50,000 pcs',
        terms: 'FOB Shanghai',
        custom: 'Logo printing',
        summary: '客户询问价格、MOQ 和交期，订单量较大，适合先回复基础报价范围并补问包装、Logo 文件和目标交期。',
        nextAction: '先发澄清回复，再补报价单',
        profile: [
          ['客户类型', '海外采购商'],
          ['国家/地区', 'United States'],
          ['来源渠道', 'Alibaba.com'],
          ['当前阶段', '新询盘待回复'],
          ['重点关注', '价格、MOQ、交期、Logo 定制'],
        ],
        todos: [
          { title: '确认目标交期', due: '今天', state: '待办' },
          { title: '索取 Logo 文件和包装要求', due: '今天', state: '待办' },
          { title: '准备 500ml 产品基础报价', due: '明天', state: '建议' },
        ],
        taskRecords: [
          { title: '询盘分析 · Global Sourcing Inc.', time: '2026-06-26 14:32', result: '生成意向判断、英文回复草稿和跟进计划' },
          { title: '客户卡片摘要写入', time: '2026-06-26 14:31', result: '等待用户确认保存' },
        ],
      },
      {
        id: 'nordic-home',
        name: 'Nordic Home Supply',
        country: 'Sweden',
        source: '展会名片',
        stage: '已寄样',
        intent: '高意向',
        lastTouch: '2026-06-25 18:20',
        product: '家居收纳套装',
        quantity: '首单 3,000 sets',
        terms: 'DDP Stockholm',
        custom: '环保包装',
        summary: '客户已收到样品，关注环保包装和到港成本，需要跟进反馈并确认首单数量。',
        nextAction: '催样品反馈并给 DDP 估价区间',
        profile: [
          ['客户类型', '北欧家居渠道商'],
          ['国家/地区', 'Sweden'],
          ['来源渠道', '展会'],
          ['当前阶段', '样品反馈'],
          ['重点关注', '环保、包装、到港成本'],
        ],
        todos: [
          { title: '询问样品试用反馈', due: '今天', state: '待办' },
          { title: '整理环保包装证书', due: '明天', state: '建议' },
        ],
        taskRecords: [
          { title: '展后跟进邮件', time: '2026-06-25 18:20', result: '生成二次跟进邮件' },
        ],
      },
    ],
  },
  {
    id: 'B',
    label: 'B 培养跟进',
    desc: '有需求但节奏较慢，需要保持触达',
    customers: [
      {
        id: 'felipe-trade',
        name: 'Felipe Trade Ltd.',
        country: 'Brazil',
        source: '邮件开发',
        stage: '价格比较',
        intent: '中意向',
        lastTouch: '2026-06-24 09:12',
        product: '运动水壶',
        quantity: '10,000 pcs',
        terms: 'FOB Ningbo',
        custom: '彩盒彩印',
        summary: '客户在比较多家供应商，价格敏感，需要给出分层报价和交期优势。',
        nextAction: '发送阶梯报价和交期对比',
        profile: [
          ['客户类型', '南美进口商'],
          ['国家/地区', 'Brazil'],
          ['来源渠道', '邮件开发'],
          ['当前阶段', '价格比较'],
          ['重点关注', '单价、包装、交期'],
        ],
        todos: [
          { title: '补发阶梯报价', due: '明天', state: '待办' },
          { title: '准备竞品价格对比', due: '本周', state: '建议' },
        ],
        taskRecords: [
          { title: '价格异议回复', time: '2026-06-24 09:12', result: '生成降价边界和替代方案' },
        ],
      },
    ],
  },
  {
    id: 'C',
    label: 'C 观察激活',
    desc: '暂不明确采购窗口，低频维护',
    customers: [
      {
        id: 'miller-wholesale',
        name: 'Miller Wholesale',
        country: 'Canada',
        source: '老客户',
        stage: '沉默 90 天',
        intent: '待激活',
        lastTouch: '2026-06-12 11:04',
        product: '厨房用品',
        quantity: '待确认',
        terms: '待确认',
        custom: '待确认',
        summary: '老客户近期没有新询盘，适合用新品和旺季备货理由做轻触达。',
        nextAction: '发送新品激活邮件',
        profile: [
          ['客户类型', '加拿大批发商'],
          ['国家/地区', 'Canada'],
          ['来源渠道', '老客户'],
          ['当前阶段', '沉默客户'],
          ['重点关注', '新品、旺季备货'],
        ],
        todos: [{ title: '发送新品激活邮件', due: '本周', state: '建议' }],
        taskRecords: [
          { title: '客户激活草稿', time: '2026-06-12 11:04', result: '生成轻触达邮件' },
        ],
      },
    ],
  },
];

const initialProgress = [
  { label: '读取询盘', detail: '英文询盘已提取', status: 'complete' },
  { label: '分析需求', detail: '数量、条款、定制已识别', status: 'complete' },
  { label: '生成回复', detail: '草稿与缺口清单已生成', status: 'complete' },
  { label: '保存摘要', detail: '等待确认写入客户卡片', status: 'pending', needsConfirmation: true },
];

const API_BASE_URL = 'http://127.0.0.1:8787';

/**
 * parseReferenceFileViaServer 把需要后端解析的引用资料转成文本。
 *
 * 作用：
 * - XLSX 这类二进制资料不能直接用浏览器 text() 当业务上下文。
 * - 这里把文件体发给本地后端解析,前端只接收已经整理好的人类可读文本。
 *
 * 参数：
 * - file：浏览器 File 对象,需要支持 arrayBuffer()。
 *
 * 返回值：Promise<object>,包含 name 和 text。
 * 可能抛出的异常：网络失败、后端拒绝或解析失败时抛出带 userMessage 的异常。
 */
async function parseReferenceFileViaServer(file) {
  const response = await fetch(`${API_BASE_URL}/api/agent/reference/parse`, {
    body: JSON.stringify({
      dataBase64: arrayBufferToBase64(await file.arrayBuffer()),
      name: file.name,
      type: file.type,
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false || !payload.reference?.text) {
    throw Object.assign(new Error('Reference parse failed'), {
      code: payload.error || 'REFERENCE_FILE_PARSE_FAILED',
      userMessage: payload.message || '这份表格暂时解析失败,可以先复制关键内容到输入框。',
    });
  }
  return payload.reference;
}

/**
 * arrayBufferToBase64 把浏览器文件二进制转成 base64。
 *
 * 作用：
 * - 后端解析接口用 JSON 接收文件内容,所以需要把 ArrayBuffer 转成可传输字符串。
 * - 分块转换可以避免较大表格一次性展开参数导致浏览器报错。
 *
 * 参数：
 * - buffer：File.arrayBuffer() 返回的二进制内容。
 *
 * 返回值：base64 字符串。
 * 可能抛出的异常：浏览器不支持 btoa 或 buffer 无效时抛出原始异常。
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return window.btoa(binary);
}

/**
 * loadAgentThreadState 从浏览器本地存储恢复新对话线程。
 *
 * 作用：
 * - 让用户刷新页面后仍能看到刚才的任务、待确认状态和产物上下文。
 * - 这只是原型阶段的轻量恢复；正式版应迁移到后端会话和权限控制。
 *
 * 参数：无。
 * 返回值：线程状态对象；没有可恢复内容时返回空对象。
 * 可能抛出的异常：函数内部吞掉存储读取和 JSON 解析异常，避免影响页面启动。
 */
function loadAgentThreadState() {
  try {
    const raw = window.localStorage.getItem(AGENT_THREAD_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * saveAgentThreadState 把新对话线程保存到浏览器本地存储。
 *
 * 作用：
 * - 保存的是原型会话状态，不写真实客户资料到后端。
 * - 当线程为空时清理旧存储，避免用户下次打开看到过期任务。
 *
 * 参数：
 * - state：需要保存的线程状态对象。
 *
 * 返回值：无。
 * 可能抛出的异常：函数内部吞掉存储写入异常，例如隐私模式或存储额度不足。
 */
function saveAgentThreadState(state = {}) {
  try {
    const hasThread = state.sessionId || (state.messages || []).length > 0 || Object.keys(state.context || {}).length > 0;
    if (!hasThread) {
      window.localStorage.removeItem(AGENT_THREAD_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(AGENT_THREAD_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 原型恢复失败不应阻断主流程；用户仍可继续当前页面操作。
  }
}

/**
 * App 是赢单 Agent 工作台原型的入口组件。
 *
 * 作用：
 * - 控制左侧主导航、客户等级、客户选择、客户详情 Tab 和原型反馈。
 * - 根据当前入口渲染新对话、我的 Agent、外接生态或客户 Kass。
 *
 * 参数：无。
 * 返回值：React 页面节点。
 * 可能抛出的异常：正常渲染不主动抛异常；如果浏览器不支持现代 React 运行环境，构建工具会提前报错。
 */
export function App() {
  const restoredAgentThread = useMemo(() => loadAgentThreadState(), []);
  const [activeNav, setActiveNav] = useState('新对话');
  const [expandedNav, setExpandedNav] = useState('');
  const [activeAdvisorId, setActiveAdvisorId] = useState('ask');
  const [activeLevelId, setActiveLevelId] = useState('A');
  const [activeCustomerId, setActiveCustomerId] = useState('global-sourcing');
  const [activeKassTab, setActiveKassTab] = useState('thread');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [draft, setDraft] = useState('');
  const [newConversationDraft, setNewConversationDraft] = useState(restoredAgentThread.draft || '');
  const [skillAgentStatus, setSkillAgentStatus] = useState(agentThreadStatusFromRestoredSession(restoredAgentThread));
  const [skillAgentResult, setSkillAgentResult] = useState(restoredAgentThread.skillAgentResult || null);
  const [skillAgentError, setSkillAgentError] = useState('');
  const [agentSessionId, setAgentSessionId] = useState(restoredAgentThread.sessionId || '');
  const [agentSessionHistory, setAgentSessionHistory] = useState([]);
  const [agentSessionHistoryOpen, setAgentSessionHistoryOpen] = useState(false);
  const [agentTaskContext, setAgentTaskContext] = useState(restoredAgentThread.context || {});
  const [agentThreadTaskTitle, setAgentThreadTaskTitle] = useState(deriveAgentThreadTaskTitle(restoredAgentThread));
  const [agentThreadMessages, setAgentThreadMessages] = useState(restoredAgentThread.messages || []);
  const [expandedProcessMessageId, setExpandedProcessMessageId] = useState(restoredAgentThread.expandedProcessMessageId || '');
  const [streamingProgressItems, setStreamingProgressItems] = useState([]);
  const [artifactPreview, setArtifactPreview] = useState({ open: false, status: 'idle', artifact: null, content: '', error: '' });
  const newConversationInputRef = useRef(null);
  const [inquiryText, setInquiryText] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisRunId, setAnalysisRunId] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState([]);
  const [analysisStatus, setAnalysisStatus] = useState('idle');
  const [analysisError, setAnalysisError] = useState('');
  const [toast, setToast] = useState('');

  const activeLevel = useMemo(() => customerLevels.find((level) => level.id === activeLevelId) || customerLevels[0], [activeLevelId]);
  const activeAdvisor = useMemo(() => {
    return advisorGroups.flatMap((group) => group.items).find((item) => item.id === activeAdvisorId) || advisorGroups[0].items[0];
  }, [activeAdvisorId]);
  const selectedCustomer = useMemo(() => {
    return activeLevel.customers.find((customer) => customer.id === activeCustomerId) || activeLevel.customers[0];
  }, [activeCustomerId, activeLevel]);

  useEffect(() => {
    saveAgentThreadState({
      context: agentTaskContext,
      draft: newConversationDraft,
      expandedProcessMessageId,
      messages: agentThreadMessages,
      sessionId: agentSessionId,
      skillAgentResult,
      status: skillAgentStatus,
      taskTitle: agentThreadTaskTitle,
    });
  }, [agentSessionId, agentTaskContext, agentThreadMessages, agentThreadTaskTitle, expandedProcessMessageId, newConversationDraft, skillAgentResult, skillAgentStatus]);

  useEffect(() => {
    if (!restoredAgentThread.sessionId) {
      return undefined;
    }

    let isMounted = true;

    /**
     * restoreAgentThreadFromServer 用后端 session 文件刷新新对话线程。
     *
     * 作用：
     * - localStorage 只负责记住最后一个 sessionId 和兜底 UI 状态。
     * - 真正的 pending confirmation、artifact 和消息记录优先以后端保存的 session 为准。
     *
     * 参数：无。
     * 返回值：Promise<void>。
     * 可能抛出的异常：函数内部捕获网络异常，恢复失败时继续使用本地兜底状态。
     */
    async function restoreAgentThreadFromServer() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/agent/session/${encodeURIComponent(restoredAgentThread.sessionId)}`);
        const payload = await response.json();
        if (!isMounted || !response.ok || payload.ok === false || !payload.session) {
          return;
        }

        const session = payload.session;
        setAgentSessionId(session.sessionId || restoredAgentThread.sessionId);
        setAgentTaskContext(session.context || {});
        setAgentThreadMessages(session.messages || []);
        setExpandedProcessMessageId(session.expandedProcessMessageId || '');
        setSkillAgentResult(session.skillAgentResult || null);
        setSkillAgentStatus(agentThreadStatusFromRestoredSession(session));
        setAgentThreadTaskTitle(deriveAgentThreadTaskTitle(session));
      } catch {
        // 后端恢复失败时保留本地兜底状态；用户仍可继续手动发送。
      }
    }

    restoreAgentThreadFromServer();

    return () => {
      isMounted = false;
    };
  }, [restoredAgentThread.sessionId]);

  const progressItems = useMemo(() => {
    if (analysisStatus === 'running') {
      return [
        { label: '读取客户档案', detail: '正在读取 profile 和 memory', status: 'pending' },
        { label: '分析询盘意向', detail: '等待 DeepSeek flash 返回', status: 'pending' },
        { label: '生成英文回复', detail: '结果生成后展示', status: 'pending' },
        { label: '等待确认保存', detail: '写入客户记忆前需要确认', status: 'pending' },
      ];
    }

    if (!analysisProgress.length) {
      return [];
    }

    if (!isConfirmed) {
      return analysisProgress;
    }

    return analysisProgress.map((item) => {
      if (!item.needsConfirmation) {
        return item;
      }

      return { ...item, detail: '摘要已写入客户卡片', status: 'complete' };
    });
  }, [analysisProgress, analysisStatus, isConfirmed]);

  useEffect(() => {
    setInquiryText(buildInquiryText(selectedCustomer));
    setAnalysisResult(null);
    setAnalysisRunId('');
    setAnalysisProgress([]);
    setAnalysisStatus('idle');
    setAnalysisError('');
    setIsConfirmed(false);
  }, [selectedCustomer]);

  /**
   * 切换左侧主导航。
   *
   * 作用：
   * - 普通入口只切换右侧工作区。
   * - 带子菜单的入口再次点击时，只展开或收起子菜单，不清空右侧当前页面。
   * - 切到其他入口时自动收起之前的子菜单，避免左侧一直占很长。
   *
   * 参数：
   * - nextNav：要切换到的入口名称，字符串。
   *
   * 返回值：无。
   * 可能抛出的异常：不主动抛异常。
   */
  function handleSelectNav(nextNav) {
    const hasSubmenu = collapsibleNavLabels.includes(nextNav);

    if (nextNav === activeNav && hasSubmenu) {
      setExpandedNav((currentExpandedNav) => (currentExpandedNav === nextNav ? '' : nextNav));
      return;
    }

    setActiveNav(nextNav);
    setExpandedNav(hasSubmenu ? nextNav : '');
  }

  /**
   * 从左侧赢单外贸顾问子菜单切换具体顾问。
   *
   * 作用：
   * - 点击原有问答/成交顾问/Skill 能力时，主工作区进入赢单外贸顾问页面。
   * - 保留当前顾问 ID，方便右侧页面展示对应标题和占位内容。
   *
   * 参数：
   * - nextAdvisorId：顾问或 Skill 的 ID，字符串。
   *
   * 返回值：无。
   * 可能抛出的异常：不主动抛异常。
   */
  function handleSelectAdvisor(nextAdvisorId) {
    setActiveNav('赢单外贸顾问');
    setExpandedNav('赢单外贸顾问');
    setActiveAdvisorId(nextAdvisorId);
  }

  /**
   * 切换客户等级。
   *
   * 参数：
   * - nextLevelId：客户等级 ID，字符串，例如 A、B、C。
   *
   * 返回值：无。
   * 可能抛出的异常：不主动抛异常。
   */
  function handleSelectLevel(nextLevelId) {
    const nextLevel = customerLevels.find((level) => level.id === nextLevelId) || customerLevels[0];
    setActiveLevelId(nextLevel.id);
    setActiveCustomerId(nextLevel.customers[0].id);
    setActiveKassTab('thread');
  }

  /**
   * 从左侧客户Kass子菜单切换客户等级。
   *
   * 作用：
   * - 确保用户点击 A/B/C 等级时，主工作区停留在客户Kass。
   * - 复用客户等级切换逻辑，避免同一个动作维护两套状态。
   *
   * 参数：
   * - nextLevelId：客户等级 ID，字符串，例如 A、B、C。
   *
   * 返回值：无。
   * 可能抛出的异常：不主动抛异常。
   */
  function handleSelectKassLevel(nextLevelId) {
    setActiveNav('客户Kass');
    setExpandedNav('客户Kass');
    handleSelectLevel(nextLevelId);
  }

  /**
   * 切换当前客户。
   *
   * 参数：
   * - customerId：客户 ID，字符串。
   *
   * 返回值：无。
   * 可能抛出的异常：不主动抛异常。
   */
  function handleSelectCustomer(customerId) {
    setActiveCustomerId(customerId);
    setActiveKassTab('thread');
  }

  /**
   * 启动真实询盘分析。
   *
   * 作用：
   * - 调用本地 Node Runtime 的 `/api/inquiry/analyze`。
   * - 第一刀按用户要求使用 flash 模式做真实模型测试。
   * - 成功后保存 runId，等待用户确认再写入客户 memory。
   *
   * 参数：无。
   * 返回值：Promise<void>。
   * 可能抛出的异常：函数内部捕获网络和接口异常，并转成页面错误提示。
   */
  async function handleStartAnalysis() {
    if (!inquiryText.trim()) {
      setToast('先粘贴客户询盘内容');
      return;
    }

    setAnalysisStatus('running');
    setAnalysisError('');
    setAnalysisResult(null);
    setAnalysisRunId('');
    setAnalysisProgress([]);
    setIsConfirmed(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/inquiry/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerSlug: 'global-sourcing-inc',
          inquiryText,
          mode: 'fast',
        }),
      });
      const payload = await response.json();

      if (!response.ok || payload.ok === false) {
        const message = payload.error === 'MODEL_NOT_CONFIGURED'
          ? '模型未配置，请在 .env 里填 DEEPSEEK_API_KEY'
          : payload.message || payload.error || '询盘分析失败';
        setAnalysisStatus('error');
        setAnalysisError(message);
        setToast(message);
        return;
      }

      setAnalysisResult(payload.result);
      setAnalysisRunId(payload.runId);
      setAnalysisProgress(payload.progress || initialProgress);
      setAnalysisStatus('waiting');
      setToast('询盘分析完成，等待确认保存');
    } catch (error) {
      setAnalysisStatus('error');
      setAnalysisError('本地后端未启动或请求失败');
      setToast(`本地后端未启动或请求失败：${error.message}`);
    }
  }

  /**
   * 处理确认保存到客户卡片的动作。
   *
   * 参数：无。
   * 返回值：Promise<void>。
   * 可能抛出的异常：函数内部捕获接口异常，并转成 toast 提示。
   */
  async function handleConfirmContext() {
    if (!analysisRunId) {
      setToast('先完成一次询盘分析，再确认保存');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/runs/${analysisRunId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = await response.json();

      if (!response.ok || payload.ok === false) {
        setToast(payload.message || payload.error || '保存失败');
        return;
      }

      setIsConfirmed(true);
      setAnalysisStatus('completed');
      setToast('已确认保存到客户卡片');
    } catch (error) {
      setToast(`保存失败：${error.message}`);
    }
  }

  /**
   * 处理底部追问输入的发送动作。
   *
   * 参数：无。
   * 返回值：无。
   * 可能抛出的异常：不主动抛异常。
   */
  function handleSendDraft() {
    if (!draft.trim()) {
      setToast('先输入要追问或调整的内容');
      return;
    }

    setToast('已加入当前客户线程，等待 Agent 继续处理');
    setDraft('');
  }

  /**
   * 开始一条全新的外贸任务线程。
   *
   * 作用：
   * - 当用户已经有一条可继续的任务时，仍然可以像 Codex / Claude Code 一样明确开新任务。
   * - 清空旧 session、消息、上下文、产物预览和任务标题，避免新需求被误当成旧任务追问。
   * - 不删除后端历史 session 文件；这里只重置当前前台工作区，便于原型阶段保留排查证据。
   *
   * 参数：无。
   * 返回值：无。
   * 可能抛出的异常：不主动抛异常。
   */
  function handleStartNewConversationTask() {
    setNewConversationDraft('');
    setSkillAgentStatus('idle');
    setSkillAgentResult(null);
    setSkillAgentError('');
    setAgentSessionId('');
    setAgentTaskContext({});
    setAgentThreadTaskTitle('');
    setAgentThreadMessages([]);
    setExpandedProcessMessageId('');
    setStreamingProgressItems([]);
    setArtifactPreview({ open: false, status: 'idle', artifact: null, content: '', error: '' });
    saveAgentThreadState({});

    if (newConversationInputRef.current) {
      newConversationInputRef.current.value = '';
      newConversationInputRef.current.focus();
    }
    setToast('已开始新的外贸任务');
  }

  /**
   * 刷新新对话最近任务列表。
   *
   * 作用：
   * - 让用户能像 Codex / Claude Code 一样从最近任务线程切回去。
   * - 只读取后端净化后的 session 摘要,不把 runId、路径或内部上下文展示给前台。
   *
   * 参数：无。
   * 返回值：Promise<void>。
   * 可能抛出的异常：函数内部捕获接口异常,失败时只给 toast。
   */
  async function handleRefreshAgentSessionHistory() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/agent/sessions?limit=12`);
      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        setToast(payload.message || '最近任务暂时无法读取');
        return;
      }
      setAgentSessionHistory(payload.sessions || []);
      setAgentSessionHistoryOpen(true);
    } catch {
      setToast('最近任务暂时无法读取');
    }
  }

  /**
   * 从历史列表打开一条 Agent 任务线程。
   *
   * 作用：
   * - 用后端 session 恢复消息、产物、等待态和标题。
   * - 清空当前草稿和预览,避免切线程后把上一条任务的输入带过去。
   *
   * 参数：
   * - sessionId：要恢复的历史任务线程 ID。
   *
   * 返回值：Promise<void>。
   * 可能抛出的异常：函数内部捕获网络异常并转成 toast。
   */
  async function handleOpenAgentSessionFromHistory(sessionId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/agent/session/${encodeURIComponent(sessionId)}`);
      const payload = await response.json();
      if (!response.ok || payload.ok === false || !payload.session) {
        setToast(payload.message || '这条任务线程暂时无法打开');
        return;
      }
      const session = payload.session;
      setAgentSessionId(session.sessionId || sessionId);
      setAgentTaskContext(session.context || {});
      setAgentThreadMessages(session.messages || []);
      setExpandedProcessMessageId(session.expandedProcessMessageId || '');
      setSkillAgentResult(session.skillAgentResult || null);
      setSkillAgentStatus(agentThreadStatusFromRestoredSession(session));
      setAgentThreadTaskTitle(deriveAgentThreadTaskTitle(session));
      setNewConversationDraft('');
      setStreamingProgressItems([]);
      setArtifactPreview({ open: false, status: 'idle', artifact: null, content: '', error: '' });
      setAgentSessionHistoryOpen(false);
      if (newConversationInputRef.current) {
        newConversationInputRef.current.value = '';
      }
      setToast('已打开最近任务');
    } catch {
      setToast('这条任务线程暂时无法打开');
    }
  }

  /**
   * ensureRecoverableAgentSessionId 确保可恢复异常也有一个本地任务线程 ID。
   *
   * 作用：
   * - 如果后端还没来得及返回 sessionId 就中断,前端仍然需要保留“这是同一件事”。
   * - 下次用户补一句话时,这个 sessionId 会和 pendingTask 一起发给后端。
   *
   * 参数：无。
   * 返回值：当前或新生成的本地 sessionId。
   * 可能抛出的异常：无。
   */
  function ensureRecoverableAgentSessionId() {
    if (agentSessionId) {
      return agentSessionId;
    }
    const recoverableSessionId = createLocalAgentSessionId();
    setAgentSessionId(recoverableSessionId);
    return recoverableSessionId;
  }

  /**
   * 从新对话入口执行外贸任务 Agent。
   *
   * 作用：
   * - 接收用户用自然语言交代的外贸目标，例如开询盘分析会、写开发信或分析客户推进。
   * - 调用本地后端 `/api/agent/message`，由后端识别任务、拆解步骤并生成业务产物。
   * - 把结果展示成新对话里的任务线程、进度和文件卡片。
   *
   * 参数：
   * - overrideText：确认按钮传入的补充指令，字符串；为空时读取输入框内容。
   *
   * 返回值：Promise<void>。
   * 可能抛出的异常：函数内部捕获网络和接口异常，并转成页面错误提示。
   */
  async function handleRunNewConversationAgent(overrideText = '') {
    const currentDraft = (overrideText || newConversationInputRef.current?.value || newConversationDraft).trim();

    if (!currentDraft) {
      setToast(agentSessionId ? '先输入要继续补充的内容' : '先输入要交代的外贸任务');
      return;
    }

    const userMessage = buildLocalThreadMessage('user', currentDraft);
    let finalPayload = null;
    let streamError = null;

    setSkillAgentStatus('running');
    setSkillAgentError('');
    setStreamingProgressItems([]);
    setAgentThreadMessages((currentMessages) => [...currentMessages, userMessage]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/agent/message/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentDraft,
          sessionId: agentSessionId || undefined,
          context: buildAgentRequestContext(agentTaskContext, skillAgentResult),
        }),
      });

      if (!response.ok) {
        throw new Error('任务进度流连接失败');
      }

      await readAgentEventStream(response, ({ event, data }) => {
        if (event === 'progress') {
          setStreamingProgressItems((items) => mergeStreamingProgressItem(items, data));
          return;
        }
        if (event === 'result') {
          finalPayload = data;
          return;
        }
        if (event === 'error') {
          streamError = data;
        }
      });

      if (streamError) {
        const message = '这次任务中途卡住了。我没有生成业务材料，可以补充更多资料后继续，或稍后重试。';
        ensureRecoverableAgentSessionId();
        const recoverableContext = buildRecoverablePendingTaskContext(currentDraft);
        setSkillAgentStatus('waiting');
        setSkillAgentError('');
        setAgentTaskContext((currentContext) => buildRecoverableWaitingContext(currentContext, recoverableContext));
        setSkillAgentResult(null);
        setAgentThreadTaskTitle((currentTitle) => currentTitle || '本次外贸任务');
        setAgentThreadMessages((currentMessages) => [...currentMessages, buildLocalThreadMessage('assistant', message, { tone: 'warning' })]);
        setToast('等待补充后继续');
        return;
      }

      if (!finalPayload) {
        throw new Error('任务结束时没有收到结果');
      }

      const payload = finalPayload;
      const assistantMessages = (payload.messages || []).filter((message) => message.role === 'assistant');
      setAgentSessionId(payload.sessionId || agentSessionId);
      setAgentTaskContext(payload.context || (payload.artifact ? { artifact: payload.artifact, period: payload.period } : agentTaskContext));
      setSkillAgentResult((currentResult) => pickNextSkillAgentResult(payload, currentResult));
      const nextTaskTitle = deriveAgentThreadTaskTitle(payload, agentThreadTaskTitle);
      setAgentThreadTaskTitle(nextTaskTitle || '');
      setAgentThreadMessages((currentMessages) => [...currentMessages, ...assistantMessages]);
      setExpandedProcessMessageId(assistantMessages.find((message) => message.activity || message.process)?.id || '');
      setSkillAgentStatus(agentThreadStatusFromPayload(payload));
      setNewConversationDraft('');
      if (newConversationInputRef.current) {
        newConversationInputRef.current.value = '';
      }
      const nextToast = payload.kind === 'confirmation-required'
        ? '等待你确认后继续'
        : payload.kind === 'needs-input' || payload.kind === 'needs-input-followup'
          ? '还需要补充业务资料'
          : payload.kind === 'followup'
            ? '已接着这次任务继续处理'
            : '这次任务已完成';
      setToast(nextToast);
    } catch (error) {
      const message = '任务进度暂时没有连上。我没有生成业务材料，可以稍后重试，或继续补充客户、询盘和产品资料。';
      ensureRecoverableAgentSessionId();
      const recoverableContext = buildRecoverablePendingTaskContext(currentDraft);
      setSkillAgentStatus('waiting');
      setSkillAgentError('');
      setAgentTaskContext((currentContext) => buildRecoverableWaitingContext(currentContext, recoverableContext));
      setSkillAgentResult(null);
      setAgentThreadTaskTitle((currentTitle) => currentTitle || '本次外贸任务');
      setAgentThreadMessages((currentMessages) => [
        ...currentMessages,
        buildLocalThreadMessage('assistant', message, { tone: 'warning' }),
      ]);
      setToast('等待补充后继续');
    } finally {
      setStreamingProgressItems([]);
    }
  }

  /**
   * 展开或收起新对话线程中的执行过程。
   *
   * 参数：
   * - messageId：包含执行过程的助手消息 ID。
   *
   * 返回值：无。
   * 可能抛出的异常：不主动抛异常。
   */
  function handleToggleAgentProcess(messageId) {
    setExpandedProcessMessageId((currentMessageId) => (currentMessageId === messageId ? '' : messageId));
  }

  /**
   * 处理原型中的按钮点击反馈。
   *
   * 参数：
   * - message：要展示给用户的反馈文案，字符串。
   *
   * 返回值：无。
   * 可能抛出的异常：不主动抛异常。
   */
  function handlePrototypeAction(message) {
    setToast(message);
  }

  /**
   * handlePreviewAgentArtifact 打开当前新对话产物预览。
   *
   * 作用：
   * - 点击线程里的“查看文件”时,从后端按 sessionId 读取真实产物内容。
   * - 预览接口只返回当前任务绑定的产物,前端不直接读取任意本地路径。
   *
   * 参数：
   * - artifact：消息卡片上的产物摘要对象。
   * - options.messageId：可选,用于让后端打开这条消息当时绑定的产物。
   *
   * 返回值：Promise<void>。
   * 可能抛出的异常：函数内部捕获网络和接口异常，并展示为预览错误。
   */
  async function handlePreviewAgentArtifact(artifact = {}, options = {}) {
    if (!agentSessionId) {
      setToast('这次任务还没有可预览的文件');
      return;
    }

    const previewErrorMessage = '这个文件暂时无法预览。我没有改动原文件，可以稍后重试，或让我重新生成一份材料。';
    setArtifactPreview({ open: true, status: 'loading', artifact, content: '', error: '' });

    try {
      const params = new URLSearchParams();
      if (options.messageId) {
        params.set('messageId', options.messageId);
      }
      const query = params.toString();
      const response = await fetch(`${API_BASE_URL}/api/agent/session/${encodeURIComponent(agentSessionId)}/artifact${query ? `?${query}` : ''}`);
      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        setArtifactPreview({ open: true, status: 'error', artifact, content: '', error: previewErrorMessage });
        setToast('文件暂时无法预览');
        return;
      }

      setArtifactPreview({
        open: true,
        status: 'ready',
        artifact: {
          ...artifact,
          ...payload,
        },
        content: payload.content || '',
        error: '',
      });
    } catch (error) {
      setArtifactPreview({ open: true, status: 'error', artifact, content: '', error: previewErrorMessage });
      setToast('文件暂时无法预览');
    }
  }

  /**
   * handleCloseArtifactPreview 关闭产物预览面板。
   *
   * 参数：无。
   * 返回值：无。
   * 可能抛出的异常：无。
   */
  function handleCloseArtifactPreview() {
    setArtifactPreview((currentPreview) => ({ ...currentPreview, open: false }));
  }

  /**
   * handleRequestAgentArtifactExport 请求导出当前任务产物。
   *
   * 作用：
   * - 让用户在产物卡上直接点“导出”,不用猜应该输入哪句话。
   * - 这里不直接下载文件,而是把“导出文件”交回同一条 Agent 线程。
   * - 后端会先进入导出确认态,确认后才复制真实文件到 workbench/exports。
   *
   * 参数：无。
   * 返回值：Promise<void>。
   * 可能抛出的异常：内部复用 handleRunNewConversationAgent,异常会被该函数转成线程提示。
   */
  async function handleRequestAgentArtifactExport() {
    await handleRunNewConversationAgent('导出文件');
  }

  /**
   * 按当前主导航渲染工作区。
   *
   * 参数：无。
   * 返回值：React 工作区节点。
   * 可能抛出的异常：不主动抛异常。
   */
  function renderWorkspace() {
    if (activeNav === '新对话') {
      return (
          <NewConversationView
          agentError={skillAgentError}
          agentStatus={skillAgentStatus}
          currentArtifact={getCurrentAgentArtifact(agentTaskContext, skillAgentResult)}
          draft={newConversationDraft}
          expandedProcessMessageId={expandedProcessMessageId}
          inputRef={newConversationInputRef}
          agentSessionHistory={agentSessionHistory}
          agentSessionHistoryOpen={agentSessionHistoryOpen}
          messages={agentThreadMessages}
          sessionId={agentSessionId}
          streamingProgressItems={streamingProgressItems}
          taskTitle={agentThreadTaskTitle}
          onDraftChange={setNewConversationDraft}
          onConfirmAction={handleRunNewConversationAgent}
          onCloseArtifactPreview={handleCloseArtifactPreview}
          onPreviewArtifact={handlePreviewAgentArtifact}
          onRequestArtifactExport={handleRequestAgentArtifactExport}
          onRunAgent={handleRunNewConversationAgent}
          onOpenHistorySession={handleOpenAgentSessionFromHistory}
          onRefreshHistory={handleRefreshAgentSessionHistory}
          onToggleHistory={() => setAgentSessionHistoryOpen((isOpen) => !isOpen)}
          onStartNewTask={handleStartNewConversationTask}
          onPrototypeAction={handlePrototypeAction}
          onToggleProcess={handleToggleAgentProcess}
          artifactPreview={artifactPreview}
        />
      );
    }

    if (activeNav === '赢单外贸顾问') {
      return <AdvisorView activeAdvisor={activeAdvisor} onPrototypeAction={handlePrototypeAction} />;
    }

    if (activeNav === '我的Agent') {
      return <MyAgentView onPrototypeAction={handlePrototypeAction} />;
    }

    if (activeNav === '技能Skill') {
      return <SkillLibraryView onPrototypeAction={handlePrototypeAction} />;
    }

    if (activeNav === '外接生态') {
      return <EcosystemView onPrototypeAction={handlePrototypeAction} />;
    }

    return (
      <CustomerKassView
        activeLevel={activeLevel}
        activeCustomerId={activeCustomerId}
        activeKassTab={activeKassTab}
        draft={draft}
        inquiryText={inquiryText}
        analysisError={analysisError}
        analysisResult={analysisResult}
        analysisRunId={analysisRunId}
        analysisStatus={analysisStatus}
        isConfirmed={isConfirmed}
        progressItems={progressItems}
        selectedCustomer={selectedCustomer}
        onConfirmContext={handleConfirmContext}
        onDraftChange={setDraft}
        onInquiryTextChange={setInquiryText}
        onPrototypeAction={handlePrototypeAction}
        onSelectCustomer={handleSelectCustomer}
        onSelectTab={setActiveKassTab}
        onSend={handleSendDraft}
        onStartAnalysis={handleStartAnalysis}
      />
    );
  }

  return (
    <main className="app-shell">
      <Sidebar
        activeAdvisorId={activeAdvisorId}
        activeLevelId={activeLevelId}
        activeNav={activeNav}
        advisorGroups={advisorGroups}
        customerLevels={customerLevels}
        expandedNav={expandedNav}
        onSelectAdvisor={handleSelectAdvisor}
        onSelectLevel={handleSelectKassLevel}
        onSelectNav={handleSelectNav}
      />
      <section className="workspace" aria-label="赢单 Agent 工作台">
        {renderWorkspace()}
      </section>
      {toast ? <Toast message={toast} onClose={() => setToast('')} /> : null}
    </main>
  );
}

/**
 * buildLocalThreadMessage 创建前端本地线程消息。
 *
 * 作用：
 * - 用户发送后先把消息放进线程，减少等待感。
 * - 可恢复的异常也可以作为助手消息进入同一条 Session 视图。
 *
 * 参数：
 * - role：消息角色，user 或 assistant。
 * - content：消息正文。
 * - options.tone：可选语气标记，例如 warning 或 error。
 *
 * 返回值：线程消息对象。
 * 可能抛出的异常：无。
 */
function buildLocalThreadMessage(role, content, options = {}) {
  return {
    id: `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    tone: options.tone || '',
  };
}

/**
 * createLocalAgentSessionId 生成前端兜底的新对话任务线程 ID。
 *
 * 作用：
 * - 在后端还没返回 sessionId 就发生网络中断时,让前端仍能把下一句补充归到同一任务。
 * - ID 格式保持 `agent-session-*`,便于后端 session store 接受并在后续成功请求中保存。
 *
 * 参数：无。
 * 返回值：安全的本地 sessionId 字符串。
 * 可能抛出的异常：无。
 */
function createLocalAgentSessionId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `agent-session-local-${stamp}-${suffix}`;
}

/**
 * buildRecoverablePendingTaskContext 为前端可恢复异常构造待补充任务上下文。
 *
 * 作用：
 * - 记录用户原始任务,避免下一句补充被后端当成全新任务。
 * - 只保存业务补充所需的轻量信息,不保存 raw error 或底层技术细节。
 *
 * 参数：
 * - originalText：发生中断时用户输入的原始外贸任务。
 *
 * 返回值：包含 pendingTask 的 context 片段。
 * 可能抛出的异常：无。
 */
function buildRecoverablePendingTaskContext(originalText = '') {
  return {
    pendingTask: {
      missing: ['更多业务资料或更明确的产物要求'],
      originalText,
      reason: 'frontend_recoverable_error',
    },
  };
}

/**
 * readAgentEventStream 读取后端 SSE 任务流。
 *
 * 作用：
 * - 让新对话能在任务执行中逐步收到 progress / result / error。
 * - 前端不理解 Runtime、tool call 或 schema,只处理后端已经翻译好的业务事件。
 *
 * 参数：
 * - response：fetch 返回的 Response 对象。
 * - onEvent：每读到一个事件时调用,参数为 {event, data}。
 *
 * 返回值：Promise<void>。
 * 可能抛出的异常：浏览器不支持流读取、JSON 解析失败或网络中断时抛出。
 */
async function readAgentEventStream(response, onEvent) {
  if (!response.body) {
    throw new Error('当前浏览器不支持任务进度流');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    buffer = await drainSseBuffer(buffer, onEvent);

    if (done) {
      break;
    }
  }

  if (buffer.trim()) {
    await emitSseBlock(buffer, onEvent);
  }
}

async function drainSseBuffer(buffer, onEvent) {
  let nextBuffer = buffer;
  let boundary = nextBuffer.indexOf('\n\n');

  while (boundary >= 0) {
    const block = nextBuffer.slice(0, boundary);
    nextBuffer = nextBuffer.slice(boundary + 2);
    await emitSseBlock(block, onEvent);
    boundary = nextBuffer.indexOf('\n\n');
  }

  return nextBuffer;
}

async function emitSseBlock(block, onEvent) {
  const parsed = parseSseBlock(block);
  if (parsed) {
    await onEvent(parsed);
  }
}

function parseSseBlock(block) {
  const lines = String(block || '').split('\n');
  let event = 'message';
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.replace(/^event:\s*/, '').trim();
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.replace(/^data:\s*/, ''));
    }
  }

  if (!dataLines.length) {
    return null;
  }

  return {
    data: JSON.parse(dataLines.join('\n')),
    event,
  };
}

/**
 * buildInquiryText 根据当前客户生成可编辑的默认询盘。
 *
 * 参数：
 * - customer：当前客户对象。
 *
 * 返回值：英文询盘文本，字符串。
 * 可能抛出的异常：不主动抛异常。
 */
function buildInquiryText(customer) {
  return [
    'Hi,',
    `We are looking for ${customer.quantity} of ${customer.product}.`,
    `Please share price for ${customer.terms}, lead time, and MOQ.`,
    `${customer.custom} needed.`,
    'Thanks.',
  ].join('\n');
}

/**
 * Sidebar 渲染桌面端左侧导航。
 *
 * 参数：
 * - activeAdvisorId：当前赢单外贸顾问能力 ID，字符串。
 * - activeLevelId：当前客户等级 ID，字符串。
 * - activeNav：当前选中的导航名称，字符串。
 * - advisorGroups：赢单外贸顾问能力分组，用于渲染子菜单。
 * - customerLevels：客户等级数组，用于渲染客户Kass子菜单。
 * - expandedNav：当前展开的左侧子菜单名称，字符串；为空时表示全部收起。
 * - onSelectAdvisor：切换赢单外贸顾问能力的回调函数。
 * - onSelectLevel：切换客户等级的回调函数。
 * - onSelectNav：切换导航的回调函数。
 *
 * 返回值：React 导航节点。
 * 可能抛出的异常：不主动抛异常。
 */
function Sidebar({ activeAdvisorId, activeLevelId, activeNav, advisorGroups, customerLevels, expandedNav, onSelectAdvisor, onSelectLevel, onSelectNav }) {
  return (
    <aside className="sidebar" aria-label="主导航">
      <div className="traffic-lights" aria-hidden="true">
        <span className="traffic red" />
        <span className="traffic yellow" />
        <span className="traffic green" />
      </div>

      <div className="brand-lockup">
        <img src="/assets/yingdan-mark.svg" alt="赢单" />
        <div>
          <strong>赢单 Agent</strong>
          <span>Winco Order</span>
        </div>
      </div>

      <nav className="nav-list">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.label === activeNav;
          const hasSubmenu = collapsibleNavLabels.includes(item.label);
          const isExpanded = expandedNav === item.label;
          const shouldShowAdvisorSubmenu = item.label === '赢单外贸顾问' && isActive && isExpanded;
          const shouldShowKassSubmenu = item.label === '客户Kass' && isActive && isExpanded;

          return (
            <div className="nav-entry" key={item.label}>
              <button
                className={`nav-item ${isActive ? 'active' : ''}`}
                type="button"
                onClick={() => onSelectNav(item.label)}
              >
                <Icon size={18} />
                <span className="nav-label">{item.label}</span>
                {hasSubmenu ? (
                  <span className="nav-caret" aria-hidden="true">
                    {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </span>
                ) : null}
              </button>

              {shouldShowAdvisorSubmenu ? (
                <div className="advisor-submenu" aria-label="赢单外贸顾问能力">
                  {advisorGroups.map((group) => (
                    <div className="advisor-submenu-group" key={group.label}>
                      <span>{group.label}</span>
                      {group.items.map((advisor) => (
                        <button
                          className={advisor.id === activeAdvisorId ? 'active' : ''}
                          type="button"
                          key={advisor.id}
                          onClick={() => onSelectAdvisor(advisor.id)}
                        >
                          {advisor.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}

              {shouldShowKassSubmenu ? (
                <div className="nav-submenu" aria-label="客户Kass等级">
                  {customerLevels.map((level) => (
                    <button
                      className={level.id === activeLevelId ? 'active' : ''}
                      type="button"
                      key={level.id}
                      onClick={() => onSelectLevel(level.id)}
                    >
                      <span>{level.label}</span>
                      <em>{level.customers.length}</em>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="avatar" aria-hidden="true">
          外
        </div>
        <div>
          <strong>外贸老板</strong>
          <span>本地工作台</span>
        </div>
        <ChevronDown size={16} />
      </div>
    </aside>
  );
}

/**
 * WorkspaceHeader 渲染每个主工作区的顶部标题。
 *
 * 参数：
 * - title：标题文字，字符串。
 * - subtitle：副标题文字，字符串。
 * - chips：顶部状态标签数组。
 * - action：右侧主按钮配置，可选。
 *
 * 返回值：React 标题区域。
 * 可能抛出的异常：不主动抛异常。
 */
function WorkspaceHeader({ title, subtitle, chips = [], action }) {
  return (
    <header className="workspace-header">
      <div>
        <div className="title-line">
          <h1>{title}</h1>
          {chips.map((chip) => (
            <span className={chip.tone === 'orange' ? 'warning-chip' : 'source-chip'} key={chip.label}>
              {chip.label}
            </span>
          ))}
        </div>
        <p>{subtitle}</p>
      </div>

      <div className="header-actions">
        <button type="button" className="icon-button" aria-label="更多操作">
          <MoreHorizontal size={18} />
        </button>
        {action ? (
          <button type="button" className="secondary-button" onClick={action.onClick}>
            {action.label}
          </button>
        ) : null}
      </div>
    </header>
  );
}

/**
 * NewConversationView 渲染新对话入口。
 *
 * 参数：
 * - agentError：Agent 执行错误文案，字符串。
 * - agentStatus：Agent 状态，idle/running/waiting/completed/error。
 * - artifactPreview：当前产物预览面板状态。
 * - agentSessionHistory：最近任务线程摘要列表。
 * - agentSessionHistoryOpen：最近任务面板是否展开。
 * - currentArtifact：当前 session 绑定的产物摘要，用于提示用户正在续改哪份材料。
 * - draft：新对话输入框内容。
 * - expandedProcessMessageId：当前展开执行过程的消息 ID。
 * - inputRef：输入框 DOM 引用，用于发送时兜底读取当前值。
 * - messages：当前任务线程里的消息。
 * - sessionId：内部任务会话 ID，只用于续跑，不直接展示给业务用户。
 * - streamingProgressItems：后端流式返回的实时业务进度。
 * - taskTitle：当前线程识别出的业务任务名，只展示用户能理解的外贸任务标题。
 * - onDraftChange：更新新对话输入内容的回调函数。
 * - onCloseArtifactPreview：关闭产物预览的回调函数。
 * - onConfirmAction：确认或取消待确认动作的回调函数。
 * - onPreviewArtifact：打开产物预览的回调函数。
 * - onOpenHistorySession：从历史里打开一条任务线程。
 * - onRefreshHistory：刷新最近任务线程列表。
 * - onRequestArtifactExport：请求导出当前产物的回调函数,会先进入确认链路。
 * - onRunAgent：执行 Agent 的回调函数。
 * - onStartNewTask：清空当前线程并开始全新任务的回调函数。
 * - onPrototypeAction：原型反馈回调函数。
 * - onToggleProcess：展开或收起执行过程的回调函数。
 *
 * 返回值：React 新对话页面。
 * 可能抛出的异常：不主动抛异常。
 */
function NewConversationView({
  agentError,
  agentSessionHistory = [],
  agentSessionHistoryOpen = false,
  agentStatus,
  artifactPreview,
  currentArtifact,
  draft,
  expandedProcessMessageId,
  inputRef,
  messages,
  sessionId,
  streamingProgressItems,
  taskTitle,
  onDraftChange,
  onCloseArtifactPreview,
  onConfirmAction,
  onPreviewArtifact,
  onOpenHistorySession,
  onRefreshHistory,
  onRequestArtifactExport,
  onRunAgent,
  onStartNewTask,
  onPrototypeAction,
  onToggleHistory,
  onToggleProcess,
}) {
  const displayTaskTitle = safeAgentInlineLabel(taskTitle || '', { maxLength: 36 });
  const {
    canStartFreshTask,
    composerContextLabel,
    composerPlaceholder,
    hasActionableConfirmation,
    hasMessages,
    isRunning,
    isWaiting,
    latestMessageId,
    sendButtonLabel,
    statusChipLabel,
  } = getNewConversationComposerState({
    agentStatus,
    currentArtifact,
    messages,
    sessionId,
    taskTitle,
  });
  const referenceInputRef = useRef(null);
  const threadEndRef = useRef(null);
  const [referenceImportStatus, setReferenceImportStatus] = useState('');
  const examples = [
    '帮我开上周询盘分析会',
    '帮我分析这个客户下一步怎么推进',
    '帮我准备一封跟进开发信',
  ];
  const handleSubmit = (event) => {
    event.preventDefault();
    onRunAgent();
  };
  const handleUseExample = (example) => {
    onDraftChange(example);
    if (inputRef.current) {
      inputRef.current.value = example;
      inputRef.current.focus();
    }
  };
  const handleReferenceMaterialClick = () => {
    referenceInputRef.current?.click();
  };
  const handleReferenceFilesChange = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) {
      return;
    }

    try {
      const settledReferences = await Promise.allSettled(files.map((file) => readReferenceFileText(file, {
        parseBinaryReferenceFile: parseReferenceFileViaServer,
      })));
      const references = settledReferences
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);
      const failedMessages = settledReferences
        .filter((result) => result.status === 'rejected')
        .map((result) => referenceFileErrorMessage(result.reason));
      if (!references.length) {
        throw settledReferences.find((result) => result.status === 'rejected')?.reason;
      }
      const referenceBlock = buildReferenceDraftBlock(references);
      const nextDraft = [draft.trim(), referenceBlock].filter(Boolean).join('\n\n');
      onDraftChange(nextDraft);
      if (inputRef.current) {
        inputRef.current.value = nextDraft;
        inputRef.current.focus();
      }
      const failureNote = failedMessages.length ? `；${failedMessages.length} 份没有读入：${failedMessages[0]}` : '';
      setReferenceImportStatus(`已引用 ${references.length} 份资料，会和这次任务一起处理${failureNote}。`);
    } catch (error) {
      setReferenceImportStatus(referenceFileErrorMessage(error));
    }
  };

  useEffect(() => {
    if (!hasMessages && !isRunning && !artifactPreview?.open) {
      return;
    }
    threadEndRef.current?.scrollIntoView({
      behavior: isRunning ? 'smooth' : 'auto',
      block: 'end',
    });
  }, [artifactPreview?.open, hasMessages, isRunning, messages.length, streamingProgressItems.length]);

  return (
    <div className="agent-thread-page">
      <section className="agent-thread-shell" aria-label="新对话 Agent 线程">
        <header className="agent-thread-header">
          <div className="assistant-thread-title">
            <img src="/assets/yingdan-mark.svg" alt="赢单" />
            <div>
              <span>赢单任务台</span>
              <h1>{displayTaskTitle || '外贸任务'}</h1>
            </div>
          </div>
          <div className="agent-thread-actions">
            <button
              type="button"
              className="thread-history-button"
              onClick={() => {
                if (agentSessionHistoryOpen) {
                  onToggleHistory();
                  return;
                }
                onRefreshHistory();
              }}
              disabled={isRunning}
              aria-expanded={agentSessionHistoryOpen}
              aria-label="查看最近任务"
            >
              <History size={14} />
              历史
            </button>
            {canStartFreshTask ? (
              <button type="button" className="thread-new-task-button" onClick={onStartNewTask} disabled={isRunning} aria-label="开始新任务">
                <Plus size={14} />
                新任务
              </button>
            ) : null}
            <span className={['session-chip', sessionId ? 'active' : '', isWaiting ? 'waiting' : ''].filter(Boolean).join(' ')}>
              {statusChipLabel}
            </span>
          </div>
          {agentSessionHistoryOpen ? (
            <section className="thread-history-panel" aria-label="最近任务">
              <header>
                <strong>最近任务</strong>
                <button type="button" onClick={onToggleHistory} aria-label="关闭最近任务">
                  <X size={14} />
                </button>
              </header>
              {agentSessionHistory.length ? (
                <div className="thread-history-list">
                  {agentSessionHistory.map((item) => (
                    <HistorySessionButton
                      item={item}
                      key={item.sessionId}
                      onOpenHistorySession={onOpenHistorySession}
                      sessionId={sessionId}
                    />
                  ))}
                </div>
              ) : (
                <p>暂无最近任务</p>
              )}
            </section>
          ) : null}
        </header>

        <div className="agent-message-list" aria-label="Agent 对话消息">
          {!hasMessages ? (
            <div className="thread-empty-state">
              <strong>今天想推进哪件外贸成交任务？</strong>
              <span>客户、询盘、产品和目标都可以直接交给我。</span>
              <div className="thread-example-row" aria-label="常用任务示例">
                {examples.map((example) => (
                  <button type="button" key={example} onClick={() => handleUseExample(example)}>
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message) => (
            <AgentThreadMessage
              isArtifactActionDisabled={isRunning}
              isConfirmationActionable={Boolean(hasActionableConfirmation && message.id === latestMessageId)}
              isProcessExpanded={expandedProcessMessageId === message.id}
              key={message.id}
              message={message}
              onConfirmAction={onConfirmAction}
              onPreviewArtifact={onPreviewArtifact}
              onRequestArtifactExport={onRequestArtifactExport}
              onToggleProcess={onToggleProcess}
            />
          ))}

          {isRunning ? (
            <div className="agent-message assistant pending">
              <div className="message-avatar">
                <Bot size={16} />
              </div>
              <div className="message-bubble">
                <div className="message-meta">
                  <strong>赢单 Agent</strong>
                  <span>执行中</span>
                </div>
                <p>我开始处理这次任务了，会先识别目标，再核对资料并生成材料。</p>
                <p className="agent-safety-note">如果缺关键资料或涉及导出、保存、外发、扣费，我会停下来问你确认。</p>
                {streamingProgressItems.length ? (
                  <ExecutionProcess steps={streamingProgressItems} />
                ) : (
                  <div className="trace-waiting-card">
                    <span aria-hidden="true" />
                    <div>
                      <strong>正在连接任务进度</strong>
                      <p>正在等待第一步进度。</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {agentError && !isRunning ? (
            <div className="confirmation-row compact error">
              <CircleAlert size={16} />
              <span>{agentError}</span>
            </div>
          ) : null}

          {artifactPreview?.open ? (
            <ArtifactPreviewPanel
              preview={artifactPreview}
              onClose={onCloseArtifactPreview}
            />
          ) : null}
          <div className="thread-scroll-anchor" ref={threadEndRef} aria-hidden="true" />
        </div>

        <form className="agent-thread-composer" aria-label="继续追问" onSubmit={handleSubmit}>
          <textarea
            className="thread-prompt"
            placeholder={composerPlaceholder}
            ref={inputRef}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                onRunAgent();
              }
            }}
          />

          <div className="composer-toolbar inline-toolbar">
            <div className="composer-actions">
              {composerContextLabel ? <span className="composer-context-chip" title={composerContextLabel}>{composerContextLabel}</span> : null}
              <button type="button" onClick={handleReferenceMaterialClick} disabled={isRunning}>
                <Paperclip size={16} />
                引用资料
              </button>
              <input
                accept=".txt,.md,.csv,.xlsx,.xlsm,text/plain,text/markdown,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroenabled.12"
                className="reference-file-input"
                multiple
                onChange={handleReferenceFilesChange}
                ref={referenceInputRef}
                type="file"
              />
              {referenceImportStatus ? <span className="reference-import-status">{referenceImportStatus}</span> : null}
            </div>
            <button type="submit" className="send-button" disabled={isRunning} aria-label={sendButtonLabel} title={sendButtonLabel}>
              <Send size={16} />
              {sendButtonLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/**
 * HistorySessionButton 渲染最近任务列表里的单条任务。
 *
 * 作用：
 * - 历史列表可能来自后端摘要,也可能来自旧 localStorage 或异常恢复。
 * - 展示前必须再做一次前端净化,避免 runId、路径或 runtime 文件名穿透到 UI。
 *
 * 参数：
 * - item：最近任务摘要对象。
 * - onOpenHistorySession：打开历史任务的回调。
 * - sessionId：当前选中的 session id。
 *
 * 返回值：React 按钮。
 * 可能抛出的异常：不主动抛异常。
 */
function HistorySessionButton({ item = {}, onOpenHistorySession, sessionId = '' }) {
  const taskTitle = safeAgentInlineLabel(item.taskTitle || '外贸任务', { maxLength: 36 });
  const artifactName = item.artifactName
    ? scrubAgentArtifactDisplayName({ name: item.artifactName, type: item.artifactType || '' })
    : '';
  const preview = safeAgentInlineLabel(item.preview || artifactName || '继续这次任务', {
    fallback: artifactName || '继续这次任务',
    maxLength: 48,
  });

  return (
    <button
      type="button"
      className={item.sessionId === sessionId ? 'active' : ''}
      onClick={() => onOpenHistorySession(item.sessionId)}
    >
      <span>{taskTitle}</span>
      <strong>{preview}</strong>
      <small>
        {historyStatusLabel(item)}
        {artifactName ? ` · ${artifactName}` : ''}
      </small>
    </button>
  );
}

/**
 * historyStatusLabel 把后端线程状态转成业务可读文案。
 *
 * 参数：
 * - item：最近任务摘要,包含 status 和 kind。
 *
 * 返回值：用于最近任务列表的小标签。
 * 可能抛出的异常：无。
 */
function historyStatusLabel(item = {}) {
  if (item.kind === 'confirmation-required') {
    return '等待确认';
  }
  if (item.status === 'waiting') {
    return '等待补充';
  }
  if (item.status === 'completed') {
    return '已完成';
  }
  if (item.status === 'running') {
    return '处理中';
  }
  return '任务线程';
}

/**
 * agentArtifactDisplayName 返回前台可展示的产物名称。
 *
 * 作用：
 * - 消息产物卡、预览面板和运行状态卡都通过这里展示产物名。
 * - 防止旧缓存或异常 payload 把 runtime 文件名、路径或工具字段显示给用户。
 *
 * 参数：
 * - artifact：产物摘要对象。
 *
 * 返回值：安全的业务产物名。
 * 可能抛出的异常：无。
 */
function agentArtifactDisplayName(artifact = {}) {
  return scrubAgentArtifactDisplayName({
    name: artifact?.name || artifact?.workbookName || artifact?.fileName || '',
    type: artifact?.type || '',
  });
}

/**
 * AgentThreadMessage 渲染新对话线程里的一条消息。
 *
 * 参数：
 * - isArtifactActionDisabled：Agent 执行中是否暂停产物查看/导出按钮。
 * - isConfirmationActionable：这条消息里的确认卡是否仍是当前待处理动作。
 * - isProcessExpanded：当前消息执行过程是否展开。
 * - message：线程消息对象。
 * - onConfirmAction：确认卡片按钮回调函数。
 * - onPreviewArtifact：打开产物预览的回调函数。
 * - onRequestArtifactExport：请求导出产物的回调函数,必须走 Agent 确认链路。
 * - onToggleProcess：展开或收起执行过程的回调函数。
 *
 * 返回值：React 消息节点。
 * 可能抛出的异常：不主动抛异常。
 */
function AgentThreadMessage({
  isArtifactActionDisabled,
  isConfirmationActionable,
  isProcessExpanded,
  message,
  onConfirmAction,
  onPreviewArtifact,
  onRequestArtifactExport,
  onToggleProcess,
}) {
  const isUser = message.role === 'user';
  const timeline = message.activity || message.process;
  const timelineLabel = message.activity ? '本次操作记录' : '执行过程';
  const safeConfirmation = message.confirmation
    ? sanitizeAgentConfirmationForDisplay(message.confirmation)
    : null;

  return (
    <article className={`agent-message ${isUser ? 'user' : 'assistant'} ${message.tone || ''}`}>
      <div className="message-avatar">
        {isUser ? <UserRound size={16} /> : <Bot size={16} />}
      </div>
      <div className="message-bubble">
        <div className="message-meta">
          <strong>{isUser ? '你' : '赢单 Agent'}</strong>
          <span>{formatMessageTime(message.createdAt)}</span>
        </div>
        {message.content.split('\n').filter(Boolean).map((line) => (
          <p key={`${message.id}-${line}`}>{line}</p>
        ))}

        {timeline ? (
          <div className="message-process">
            <button type="button" onClick={() => onToggleProcess(message.id)}>
              {isProcessExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              {timelineLabel}
            </button>
            {isProcessExpanded && message.activity ? <ActivityStream items={message.activity.items || []} /> : null}
            {isProcessExpanded && !message.activity ? <ExecutionProcess steps={message.process.steps || []} /> : null}
          </div>
        ) : null}

        {message.needsInput ? (
          <MissingInputChecklist needsInput={message.needsInput} />
        ) : null}

        {safeConfirmation ? (
          <div className="confirmation-card inline-confirmation-card">
            <div>
              <strong>{safeConfirmation.title}</strong>
              <span>{safeConfirmation.body}</span>
            </div>
            {isConfirmationActionable ? (
              <div className="confirmation-card-actions">
                <button type="button" className="secondary" onClick={() => onConfirmAction(safeConfirmation.cancelActionText || '取消这一步')}>
                  {safeConfirmation.cancelLabel || '取消'}
                </button>
                <button type="button" onClick={() => onConfirmAction(safeConfirmation.confirmActionText || '确认继续')}>
                  {safeConfirmation.confirmLabel || '确认继续'}
                </button>
              </div>
            ) : (
              <div className="confirmation-card-resolved">这一步已处理或已被后续消息取代。</div>
            )}
          </div>
        ) : null}

        {message.artifact ? (
          <div className="skill-artifact-card thread-artifact-card">
            <FileText size={18} />
            <div>
              <strong>{agentArtifactDisplayName(message.artifact)}</strong>
              <span>{artifactStatusText(message.artifact)}</span>
            </div>
            <div className="artifact-card-actions">
              <button type="button" disabled={isArtifactActionDisabled} onClick={() => onPreviewArtifact(message.artifact, { messageId: message.id })}>
                <Search size={15} />
                查看
              </button>
              <button type="button" disabled={isArtifactActionDisabled} onClick={() => onRequestArtifactExport(message.artifact)}>
                <Download size={15} />
                导出
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

/**
 * MissingInputChecklist 渲染 Agent 等待用户补资料时的清单。
 *
 * 作用：
 * - 把后端返回的 needsInput.items 展示成可扫读列表。
 * - 让用户知道下一句该补什么,而不是从普通段落里猜。
 *
 * 参数：
 * - needsInput：缺资料卡片对象,包含 title、items 和 hint。
 *
 * 返回值：React 缺资料清单节点。
 * 可能抛出的异常：不主动抛异常。
 */
function MissingInputChecklist({ needsInput = {} }) {
  const safeNeedsInput = sanitizeAgentNeedsInputForDisplay(needsInput);
  const items = Array.isArray(safeNeedsInput.items) ? safeNeedsInput.items.filter(Boolean) : [];
  if (!items.length) {
    return null;
  }

  return (
    <section className="missing-input-checklist" aria-label="缺少资料">
      <header>
        <ListChecks size={16} />
        <div>
          <strong>{safeNeedsInput.title || '缺少资料'}</strong>
          <span>{safeNeedsInput.hint || '直接补一句话即可,我会接着这次任务继续。'}</span>
        </div>
      </header>
      <ul>
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>
            <Check size={14} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * artifactStatusText 把产物对象转成业务用户能看懂的状态文案。
 *
 * 参数：
 * - artifact：后端返回的产物信息，可能是 Markdown、XLSX 或其他文件。
 *
 * 返回值：文件卡片的副标题文案。
 * 可能抛出的异常：无。
 */
function artifactStatusText(artifact = {}) {
  if (artifact.exportedFrom) {
    return '已导出，可查看文件内容';
  }
  if (artifact.type === 'markdown') {
    return '已生成，可查看草稿内容';
  }
  if (artifact.type === 'xlsx' || artifact.workbookName) {
    return '已生成，可查看表格文件';
  }
  return '已生成，可查看本地文件';
}

/**
 * ArtifactPreviewPanel 渲染当前任务产物的内联预览。
 *
 * 作用：
 * - 让用户在 agent thread 里直接检查邮件草稿、客户分析和跟进计划。
 * - 对暂不支持内联渲染的文件,展示明确的文件摘要和状态。
 *
 * 参数：
 * - preview：预览状态对象,包含 status、artifact、content 和 error。
 * - onClose：关闭预览面板的回调函数。
 *
 * 返回值：React 预览面板。
 * 可能抛出的异常：不主动抛异常。
 */
function ArtifactPreviewPanel({ preview, onClose }) {
  const artifact = preview.artifact || {};
  const title = agentArtifactDisplayName(artifact) || '任务产物';
  const meta = [artifact.type ? artifact.type.toUpperCase() : '', formatBytes(artifact.sizeBytes)]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="artifact-preview-panel" aria-label="产物预览">
      <header>
        <div>
          <span>产物预览</span>
          <strong>{title}</strong>
          {meta ? <small>{meta}</small> : null}
        </div>
        <button type="button" onClick={onClose} aria-label="关闭产物预览">
          <X size={16} />
        </button>
      </header>

      {preview.status === 'loading' ? (
        <div className="artifact-preview-state">正在打开文件...</div>
      ) : null}

      {preview.status === 'error' ? (
        <div className="artifact-preview-state error">{preview.error || '文件预览失败'}</div>
      ) : null}

      {preview.status === 'ready' && artifact.previewNote ? (
        <div className="artifact-preview-state">{artifact.previewNote}</div>
      ) : null}

      {preview.status === 'ready' && artifact.quality ? (
        <ArtifactQualitySummary quality={artifact.quality} />
      ) : null}

      {preview.status === 'ready' && artifact.workbook?.sheets?.length ? (
        <WorkbookArtifactPreview workbook={artifact.workbook} />
      ) : null}

      {preview.status === 'ready' && preview.content ? (
        <MarkdownArtifactPreview content={preview.content} />
      ) : null}

      {preview.status === 'ready' && artifact.truncated ? (
        <div className="artifact-preview-state">内容较长，当前只展示前半部分。</div>
      ) : null}
    </section>
  );
}

/**
 * ArtifactQualitySummary 渲染产物检查结果。
 *
 * 作用：
 * - 把后端 Runtime 的依据覆盖检查转成用户能看懂的“已覆盖/待复核”摘要。
 * - 只展示后端已经清理过的业务事实,不展示 schema、JSON、tool call 或本地路径。
 *
 * 参数：
 * - quality：预览接口返回的检查摘要,包含 checkedFacts 和 missingFacts。
 *
 * 返回值：React 检查结果节点。
 * 可能抛出的异常：不主动抛异常。
 */
function ArtifactQualitySummary({ quality = {} }) {
  const checkedFacts = Array.isArray(quality.checkedFacts) ? quality.checkedFacts : [];
  const missingFacts = Array.isArray(quality.missingFacts) ? quality.missingFacts : [];
  const isPassed = quality.status === 'passed';

  return (
    <section className={`artifact-quality-summary ${isPassed ? 'passed' : 'needs-review'}`} aria-label="依据检查">
      <header>
        <strong>{quality.label || '依据检查'}</strong>
        <span>{isPassed ? '已覆盖' : '待复核'}</span>
      </header>
      <p>{quality.summary || (isPassed ? '已核对产物里的业务依据。' : '仍有依据需要补充确认。')}</p>

      {checkedFacts.length ? (
        <div className="artifact-quality-facts">
          {checkedFacts.map((fact) => (
            <span key={`${fact.kind || 'fact'}-${fact.label || ''}`}>{formatArtifactQualityFact(fact)}</span>
          ))}
        </div>
      ) : null}

      {missingFacts.length ? (
        <div className="artifact-quality-missing">
          <strong>待补充</strong>
          <div>
            {missingFacts.map((fact) => (
              <span key={`${fact.kind || 'missing'}-${fact.label || ''}`}>{formatArtifactQualityFact(fact)}</span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * formatArtifactQualityFact 把强类型依据 fact 转成用户可读文本。
 *
 * 参数：
 * - fact：后端返回的 `{ kind, label }` 业务事实。
 *
 * 返回值：例如 `产品：太阳能路灯`。
 * 可能抛出的异常：无。
 */
function formatArtifactQualityFact(fact = {}) {
  const label = String(fact.label || '').trim();
  if (!label) {
    return '';
  }

  const kindLabels = {
    concern: '关注点',
    market: '市场',
    next_action: '下一步',
    payment: '付款',
    price: '价格',
    product: '产品',
    quantity: '数量',
    sample: '样品',
    trade_term: '条款',
  };
  const prefix = kindLabels[fact.kind] || '事实';
  return `${prefix}：${label}`;
}

/**
 * WorkbookArtifactPreview 渲染 XLSX 工作簿的可扫读摘要。
 *
 * 作用：
 * - 让用户不用打开本地文件,也能确认 XLSX 真实包含哪些工作表。
 * - 展示每个工作表的行数和列数,帮助判断产物是不是空壳。
 *
 * 参数：
 * - workbook：后端预览接口返回的工作簿摘要,包含 sheetCount 和 sheets。
 *
 * 返回值：React 工作簿摘要节点。
 * 可能抛出的异常：不主动抛异常。
 */
function WorkbookArtifactPreview({ workbook = {} }) {
  const sheets = Array.isArray(workbook.sheets) ? workbook.sheets : [];
  if (!sheets.length) {
    return null;
  }

  return (
    <section className="workbook-artifact-preview" aria-label="工作表摘要">
      <header>
        <strong>工作表摘要</strong>
        <span>{workbook.sheetCount || sheets.length} 个工作表</span>
      </header>
      <div className="workbook-sheet-list">
        {sheets.map((sheet) => (
          <div className="workbook-sheet-row" key={sheet.name}>
            <strong>{sheet.name}</strong>
            <span>{sheet.rowCount || 0} 行</span>
            <span>{sheet.columnCount || 0} 列</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * MarkdownArtifactPreview 把 Markdown 文本转成安全的轻量预览。
 *
 * 参数：
 * - content：后端读取到的 Markdown 文本。
 *
 * 返回值：React 预览内容。
 * 可能抛出的异常：无。
 */
function MarkdownArtifactPreview({ content }) {
  const blocks = String(content || '').split('\n');
  return (
    <div className="markdown-artifact-preview">
      {blocks.map((line, index) => renderMarkdownPreviewLine(line, index))}
    </div>
  );
}

function renderMarkdownPreviewLine(line, index) {
  const key = `${index}-${line}`;
  if (!line.trim()) {
    return <div className="markdown-preview-space" key={key} />;
  }
  if (line.startsWith('# ')) {
    return <h3 key={key}>{line.replace(/^#\s+/, '')}</h3>;
  }
  if (line.startsWith('## ')) {
    return <h4 key={key}>{line.replace(/^##\s+/, '')}</h4>;
  }
  if (line.startsWith('> ')) {
    return <blockquote key={key}>{line.replace(/^>\s+/, '')}</blockquote>;
  }
  if (/^\d+\.\s+/.test(line)) {
    return <p className="markdown-preview-list" key={key}>{line}</p>;
  }
  if (line.startsWith('- ')) {
    return <p className="markdown-preview-list" key={key}>{line}</p>;
  }
  return <p key={key}>{line}</p>;
}

/**
 * formatBytes 把文件大小转成业务用户可读的文本。
 *
 * 参数：
 * - value：字节数。
 *
 * 返回值：格式化后的大小文本。
 * 可能抛出的异常：无。
 */
function formatBytes(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) {
    return '';
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * ActivityStream 渲染目标驱动 Agent 的业务化操作记录。
 *
 * 参数：
 * - items：活动项数组，每项包含 kind、title、detail 和 status。
 *
 * 返回值：React 活动流节点。
 * 可能抛出的异常：不主动抛异常。
 */
function ActivityStream({ items }) {
  const safeItems = items.map(sanitizeAgentActivityItemForDisplay);

  return (
    <div className="activity-stream">
      {safeItems.map((item, index) => (
        <div className={`activity-item ${item.kind} ${item.status || ''}`} key={`${item.kind}-${item.title}-${index}`}>
          <span className="activity-rail" aria-hidden="true">
            {item.status === 'complete' ? <Check size={11} /> : null}
          </span>
          <div>
            <span className="activity-kind">{formatActivityKind(item.kind)}</span>
            {item.phase ? <span className="progress-phase">{item.phase}</span> : null}
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
            {item.observation || item.nextAction ? (
              <div className="activity-meta-row">
                {item.observation ? <span>发现：{item.observation}</span> : null}
                {item.nextAction ? <span>下一步：{item.nextAction}</span> : null}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * ExecutionProcess 渲染可复用的执行过程列表。
 *
 * 参数：
 * - steps：执行步骤数组。
 *
 * 返回值：React 过程节点。
 * 可能抛出的异常：不主动抛异常。
 */
function ExecutionProcess({ steps }) {
  const safeSteps = steps.map(sanitizeAgentProcessStepForDisplay);

  return (
    <div className="progress-strip skill-progress-strip">
      {safeSteps.map((item, index) => (
        <div className={`progress-step ${item.status}`} key={`${item.label}-${item.phase || 'step'}-${index}`}>
          <span className="progress-dot" aria-hidden="true">
            {item.status === 'complete' ? <Check size={12} /> : null}
          </span>
          <div>
            {item.phase ? <span className="progress-phase">{item.phase}</span> : null}
            <strong>{item.label}</strong>
            <span>{item.detail}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * formatActivityKind 把后端活动类型转换成用户可扫读的业务标签。
 *
 * 参数：
 * - kind：活动类型，如 goal、action、observation。
 *
 * 返回值：中文短标签。
 * 可能抛出的异常：无。
 */
function formatActivityKind(kind) {
  const labels = {
    action: '处理',
    goal: '识别',
    observation: '检查',
    plan: '计划',
    thought: '判断',
  };
  return labels[kind] || '步骤';
}

/**
 * formatMessageTime 把 ISO 时间转成短时间。
 *
 * 参数：
 * - value：ISO 时间字符串。
 *
 * 返回值：HH:mm 文本。
 * 可能抛出的异常：无。
 */
function formatMessageTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

/**
 * SkillAgentRunPanel 渲染新对话里的外贸任务执行状态。
 *
 * 作用：
 * - 把后端返回的进度、摘要和产物路径展示给用户。
 * - 让新对话像 Codex / Claude Code 一样能看到任务正在被处理，而不是只有聊天回复。
 *
 * 参数：
 * - agentError：执行错误文案。
 * - agentResult：执行结果对象。
 * - agentStatus：Agent 状态。
 * - progressItems：进度项数组。
 * - onPrototypeAction：原型反馈回调函数。
 *
 * 返回值：React 执行状态卡片；未开始时返回 null。
 * 可能抛出的异常：不主动抛异常。
 */
function SkillAgentRunPanel({ agentError, agentResult, agentStatus, progressItems, onPrototypeAction }) {
  if (agentStatus === 'idle') {
    return null;
  }

  const stateText = agentStatus === 'running' ? '执行中' : agentStatus === 'completed' ? '已完成' : '失败';
  const stateClass = agentStatus === 'completed' ? 'complete' : 'pending';
  const taskTitle = safeAgentInlineLabel(agentResult?.taskTitle || '本次外贸任务', { maxLength: 36 });
  const artifactName = agentArtifactDisplayName(agentResult?.artifact) || '业务产物';
  const summary = safeAgentInlineLabel(agentResult?.summary || '正在识别任务、核对资料并生成业务材料', {
    fallback: '正在识别任务、核对资料并生成业务材料',
    maxLength: 90,
  });
  const safeProgressItems = progressItems.map(sanitizeAgentProcessStepForDisplay);

  return (
    <section className="skill-agent-panel" aria-label="外贸任务执行状态">
      <div className="progress-head">
        <div>
          <strong>{taskTitle}</strong>
          <span>{summary}</span>
        </div>
        <span className={`progress-state ${stateClass}`}>{stateText}</span>
      </div>

      <div className="progress-strip skill-progress-strip">
        {safeProgressItems.map((item) => (
          <div className={`progress-step ${item.status}`} key={item.label}>
            <span className="progress-dot" aria-hidden="true">
              {item.status === 'complete' ? <Check size={12} /> : null}
            </span>
            <div>
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </div>
          </div>
        ))}
      </div>

      {agentError ? (
        <div className="confirmation-row compact error">
          <CircleAlert size={16} />
          <span>{agentError}</span>
        </div>
      ) : null}

      {agentResult?.artifact ? (
        <div className="skill-artifact-card">
          <FileText size={18} />
          <div>
            <strong>{artifactName}</strong>
            <span>{artifactStatusText(agentResult.artifact)}</span>
          </div>
          <button type="button" onClick={() => onPrototypeAction('已定位到本地 XLSX 产物路径')}>
            <Download size={15} />
            产物
          </button>
        </div>
      ) : null}
    </section>
  );
}

/**
 * AdvisorView 渲染赢单现有外贸顾问能力的对话入口。
 *
 * 作用：
 * - 承接旧版赢单左侧的问一下、销售准备、成交顾问和 Skill。
 * - 让这些能力在新工作台里仍然从侧边栏进入，但不直接使用 Chatbot 这种技术命名。
 *
 * 参数：
 * - activeAdvisor：当前选中的顾问或 Skill 对象。
 * - onPrototypeAction：原型反馈回调函数。
 *
 * 返回值：React 顾问对话入口页面。
 * 可能抛出的异常：不主动抛异常。
 */
function AdvisorView({ activeAdvisor, onPrototypeAction }) {
  const defaultPrompt = advisorPromptExamples[activeAdvisor.id] || advisorPromptExamples.ask;

  return (
    <div className="advisor-page">
      <section className="advisor-center" aria-label="赢单外贸顾问">
        <div className="assistant-lockup compact">
          <img src="/assets/yingdan-mark.svg" alt="赢单" />
          <div>
            <h1>{activeAdvisor.label}</h1>
            <span className="advisor-mode">赢单外贸顾问</span>
          </div>
          <p>{activeAdvisor.desc}</p>
        </div>

        <section className="new-chat-composer advisor-composer">
          <textarea
            className="large-prompt"
            key={activeAdvisor.id}
            defaultValue={defaultPrompt}
            aria-label={`${activeAdvisor.label}输入区`}
          />

          <div className="composer-toolbar inline-toolbar">
            <div className="composer-actions">
              <button type="button" onClick={() => onPrototypeAction('原型反馈：正式版会引用客户、产品或公司资料')}>
                <Paperclip size={16} />
                引用资料
              </button>
              <button type="button" onClick={() => onPrototypeAction('原型反馈：正式版会切换客户上下文')}>
                <UsersRound size={16} />
                客户上下文
              </button>
            </div>
            <button type="button" className="send-button" onClick={() => onPrototypeAction(`已开始 ${activeAdvisor.label} 对话`)}>
              <Send size={16} />
              发送
            </button>
          </div>
        </section>
      </section>
    </div>
  );
}

/**
 * SkillLibraryView 渲染赢单预设 Skill 库。
 *
 * 作用：
 * - 把原来藏在赢单外贸顾问子菜单里的 Skill 独立成一级入口。
 * - 让用户能直接看到可被 Agent 调用的外贸业务 Skill。
 *
 * 参数：
 * - onPrototypeAction：原型反馈回调函数。
 *
 * 返回值：React Skill 库页面。
 * 可能抛出的异常：不主动抛异常。
 */
function SkillLibraryView({ onPrototypeAction }) {
  const categories = ['全部', ...new Set(skillItems.map((skill) => skill.category))];

  return (
    <>
      <WorkspaceHeader
        title="技能Skill"
        subtitle="赢单预设的外贸业务能力，可直接使用，也可以绑定到我的 Agent。"
        chips={[{ label: `${skillItems.length} 个预设 Skill` }, { label: 'Agent 可调用', tone: 'orange' }]}
        action={{ label: '创建Skill', onClick: () => onPrototypeAction('原型反馈：正式版会打开 Skill 创建向导') }}
      />

      <div className="page-body skill-page">
        <div className="toolbar-row">
          <label className="search-box">
            <Search size={17} />
            <input placeholder="搜索 Skill..." />
          </label>
          <div className="skill-category-row" aria-label="Skill 分类">
            {categories.slice(0, 5).map((category, index) => (
              <button className={index === 0 ? 'active' : ''} type="button" key={category}>
                {category}
              </button>
            ))}
          </div>
        </div>

        <section className="skill-library-grid">
          {skillItems.map((skill) => (
            <article className="skill-library-card" key={skill.id}>
              <div className="skill-card-head">
                <div className="agent-icon">
                  <Sparkles size={20} />
                </div>
                <span>{skill.category}</span>
              </div>
              <h2>{skill.label}</h2>
              <p>{skill.desc}</p>
              <div className="skill-card-bottom">
                <span>本月使用 {skill.usage} 次</span>
                <button type="button" onClick={() => onPrototypeAction(`打开 ${skill.label}`)}>
                  使用
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </>
  );
}

/**
 * MyAgentView 渲染我的 Agent 管理页面。
 *
 * 参数：
 * - onPrototypeAction：原型反馈回调函数。
 *
 * 返回值：React Agent 页面。
 * 可能抛出的异常：不主动抛异常。
 */
function MyAgentView({ onPrototypeAction }) {
  return (
    <>
      <WorkspaceHeader
        title="我的Agent"
        subtitle="管理外贸业务员会反复使用的 Agent。第一版先做配置和使用入口，不开放写代码。"
        chips={[{ label: '3 个 Agent' }, { label: '预设 Skill 驱动' }]}
        action={{ label: '新建Agent', onClick: () => onPrototypeAction('原型反馈：正式版会打开新建 Agent 表单') }}
      />

      <div className="page-body">
        <div className="toolbar-row">
          <label className="search-box">
            <Search size={17} />
            <input placeholder="搜索 Agent..." />
          </label>
          <button type="button" className="primary-soft-button" onClick={() => onPrototypeAction('已筛选团队默认 Agent')}>
            团队默认
          </button>
        </div>

        <section className="agent-grid">
          <button type="button" className="agent-create-card" onClick={() => onPrototypeAction('原型反馈：正式版会进入 Agent 创建向导')}>
            <Plus size={28} />
            <strong>新建自定义 Agent</strong>
            <span>选择角色、绑定 Skill、设置可访问资料。</span>
          </button>

          {myAgents.map((agent) => (
            <article className="agent-card" key={agent.name}>
              <div className="agent-card-top">
                <div className="agent-icon">
                  <Bot size={22} />
                </div>
                <span>{agent.status}</span>
              </div>
              <h2>{agent.name}</h2>
              <p>{agent.role}</p>
              <div className="skill-chip-row">
                {agent.skills.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
              <div className="agent-card-bottom">
                <span>本月运行 {agent.runCount} 次</span>
                <button type="button" onClick={() => onPrototypeAction(`打开 ${agent.name}`)}>
                  使用
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </>
  );
}

/**
 * EcosystemView 渲染外接生态页面。
 *
 * 参数：
 * - onPrototypeAction：原型反馈回调函数。
 *
 * 返回值：React 外接生态页面。
 * 可能抛出的异常：不主动抛异常。
 */
function EcosystemView({ onPrototypeAction }) {
  const allPlugins = ecosystemPluginGroups.flatMap((group) => group.plugins.map((plugin) => ({ ...plugin, group: group.title })));
  const installedPlugins = allPlugins.slice(0, 14);

  return (
    <div className="codex-plugin-page">
      <div className="codex-plugin-topbar">
        <div className="codex-plugin-tabs" aria-label="外接生态分类">
          <button type="button" className="active">插件</button>
          <button type="button" onClick={() => onPrototypeAction('技能Skill 已独立到左侧导航')}>技能</button>
        </div>

        <div className="codex-plugin-actions">
          <button type="button" aria-label="刷新插件">
            <MoreHorizontal size={17} />
          </button>
          <button type="button" aria-label="添加插件" onClick={() => onPrototypeAction('原型反馈：正式版会打开添加插件菜单')}>
            <Plus size={18} />
          </button>
        </div>
      </div>

      <section className="codex-plugin-content" aria-label="外接生态插件中心">
        <div className="codex-plugin-hero">
          <h1>插件</h1>
          <p>在常用工具和外贸系统中使用赢单 Agent</p>
          <label className="codex-plugin-search">
            <Search size={18} />
            <input placeholder="搜索插件" />
          </label>
        </div>

        <section className="installed-strip" aria-label="已安装插件">
          <div className="section-heading-row">
            <h2>已安装</h2>
            <button type="button" aria-label="管理已安装插件">
              <MoreHorizontal size={17} />
            </button>
          </div>
          <div className="installed-icons">
            {installedPlugins.map((plugin) => (
              <button
                type="button"
                className={`plugin-logo small ${plugin.tone}`}
                key={`${plugin.group}-${plugin.name}`}
                aria-label={plugin.name}
                onClick={() => onPrototypeAction(`打开 ${plugin.name}`)}
              >
                {plugin.mark}
              </button>
            ))}
          </div>
        </section>

        <div className="provider-filter" aria-label="插件来源筛选">
          <button type="button" className="active">由赢单提供</button>
          <button type="button">由工作空间提供</button>
          <button type="button">个人</button>
          <button type="button" aria-label="筛选">
            <ListChecks size={16} />
          </button>
        </div>

        {ecosystemPluginGroups.map((group) => (
          <section className="codex-plugin-section" key={group.title}>
            <h2>{group.title}</h2>
            <div className="codex-plugin-list">
              {group.plugins.map((plugin) => (
                <article className="codex-plugin-row" key={`${group.title}-${plugin.name}`}>
                  <div className={`plugin-logo ${plugin.tone}`} aria-hidden="true">
                    {plugin.mark}
                  </div>
                  <div>
                    <h3>{plugin.name}</h3>
                    <p>{plugin.desc}</p>
                  </div>
                  <button type="button" onClick={() => onPrototypeAction(`${plugin.name}：${plugin.status}`)}>
                    {plugin.status === '已安装' ? '已安装' : plugin.status === '待授权' ? '授权' : '安装'}
                  </button>
                  <button type="button" className="row-more" aria-label={`${plugin.name} 更多操作`}>
                    <MoreHorizontal size={16} />
                  </button>
                </article>
              ))}
            </div>
          </section>
        ))}
      </section>
    </div>
  );
}

/**
 * CustomerKassView 渲染客户 Kass 主页面。
 *
 * 参数：
 * - activeLevel：当前等级对象。
 * - activeCustomerId：当前客户 ID。
 * - activeKassTab：当前客户详情 Tab。
 * - analysisError：分析错误文案。
 * - analysisResult：真实模型结果对象。
 * - analysisRunId：当前 run ID。
 * - analysisStatus：分析状态。
 * - draft：当前追问输入内容。
 * - inquiryText：当前可编辑询盘文本。
 * - isConfirmed：是否已经确认保存客户摘要。
 * - progressItems：当前线程进度。
 * - selectedCustomer：当前选中的客户对象。
 * - onConfirmContext：确认保存回调。
 * - onDraftChange：更新追问输入回调。
 * - onInquiryTextChange：更新询盘文本回调。
 * - onPrototypeAction：原型反馈回调。
 * - onSelectCustomer：切换客户回调。
 * - onSelectTab：切换详情 Tab 回调。
 * - onSend：发送追问回调。
 * - onStartAnalysis：开始真实分析回调。
 *
 * 返回值：React 客户 Kass 页面。
 * 可能抛出的异常：不主动抛异常。
 */
function CustomerKassView({
  activeLevel,
  activeCustomerId,
  activeKassTab,
  analysisError,
  analysisResult,
  analysisRunId,
  analysisStatus,
  draft,
  inquiryText,
  isConfirmed,
  progressItems,
  selectedCustomer,
  onConfirmContext,
  onDraftChange,
  onInquiryTextChange,
  onPrototypeAction,
  onSelectCustomer,
  onSelectTab,
  onSend,
  onStartAnalysis,
}) {
  return (
    <>
      <WorkspaceHeader
        title="客户Kass"
        subtitle="按客户等级管理客户列表；进入某个客户后，围绕这个客户上下文聊天、看档案、事项和任务记录。"
        chips={[{ label: `${activeLevel.label}` }, { label: '任务记录已并入客户详情', tone: 'orange' }]}
        action={{ label: '新增客户', onClick: () => onPrototypeAction('原型反馈：正式版会打开新增客户表单') }}
      />

      <div className="kass-layout">
        <aside className="customer-list-panel">
          <div className="list-head">
            <div>
              <strong>{activeLevel.label}</strong>
              <span>{activeLevel.desc}</span>
            </div>
            <button type="button" aria-label="筛选客户">
              <Search size={16} />
            </button>
          </div>

          <div className="customer-list">
            {activeLevel.customers.map((customer) => (
              <button
                className={customer.id === activeCustomerId ? 'active' : ''}
                type="button"
                key={customer.id}
                onClick={() => onSelectCustomer(customer.id)}
              >
                <span>{customer.name}</span>
                <strong>{customer.stage}</strong>
                <small>{customer.country} · {customer.intent}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="customer-detail">
          <div className="customer-detail-head">
            <div>
              <h2>{selectedCustomer.name}</h2>
              <span>{selectedCustomer.country} · {selectedCustomer.source} · {selectedCustomer.stage}</span>
            </div>
            <span className="intent-badge">{selectedCustomer.intent}</span>
          </div>

          <div className="detail-tabs">
            {[
              ['thread', '对话线程'],
              ['profile', '详情档案'],
              ['todos', '事项'],
              ['records', '任务记录'],
            ].map(([id, label]) => (
              <button className={activeKassTab === id ? 'active' : ''} type="button" key={id} onClick={() => onSelectTab(id)}>
                {label}
              </button>
            ))}
          </div>

          {activeKassTab === 'thread' ? (
            <CustomerThread
              customer={selectedCustomer}
              analysisError={analysisError}
              analysisResult={analysisResult}
              analysisRunId={analysisRunId}
              analysisStatus={analysisStatus}
              draft={draft}
              inquiryText={inquiryText}
              isConfirmed={isConfirmed}
              progressItems={progressItems}
              onConfirmContext={onConfirmContext}
              onDraftChange={onDraftChange}
              onInquiryTextChange={onInquiryTextChange}
              onPrototypeAction={onPrototypeAction}
              onSend={onSend}
              onStartAnalysis={onStartAnalysis}
            />
          ) : null}
          {activeKassTab === 'profile' ? <CustomerProfile customer={selectedCustomer} /> : null}
          {activeKassTab === 'todos' ? <CustomerTodos customer={selectedCustomer} /> : null}
          {activeKassTab === 'records' ? <CustomerTaskRecords customer={selectedCustomer} /> : null}
        </section>
      </div>
    </>
  );
}

/**
 * CustomerThread 渲染某个客户上下文里的对话线程。
 *
 * 参数：
 * - analysisError：分析错误文案，字符串。
 * - analysisResult：真实模型返回的分析结果对象。
 * - analysisRunId：当前 run ID，字符串。
 * - analysisStatus：当前分析状态，字符串。
 * - customer：当前客户对象。
 * - draft：追问输入内容。
 * - inquiryText：可编辑询盘文本。
 * - isConfirmed：是否已经确认保存。
 * - progressItems：处理进度数组。
 * - onConfirmContext：确认保存回调。
 * - onDraftChange：更新追问输入回调。
 * - onInquiryTextChange：更新询盘文本回调。
 * - onPrototypeAction：原型反馈回调。
 * - onSend：发送追问回调。
 * - onStartAnalysis：开始真实分析回调。
 *
 * 返回值：React 对话线程。
 * 可能抛出的异常：不主动抛异常。
 */
function CustomerThread({
  analysisError,
  analysisResult,
  analysisRunId,
  analysisStatus,
  customer,
  draft,
  inquiryText,
  isConfirmed,
  progressItems,
  onConfirmContext,
  onDraftChange,
  onInquiryTextChange,
  onPrototypeAction,
  onSend,
  onStartAnalysis,
}) {
  return (
    <div className="customer-thread-grid">
      <section className="thread-column">
        <InquiryCard
          analysisStatus={analysisStatus}
          customer={customer}
          inquiryText={inquiryText}
          onInquiryTextChange={onInquiryTextChange}
          onStartAnalysis={onStartAnalysis}
        />
        <ProgressSummary
          analysisError={analysisError}
          analysisRunId={analysisRunId}
          analysisStatus={analysisStatus}
          items={progressItems}
          onConfirmContext={onConfirmContext}
          isConfirmed={isConfirmed}
        />
        <ResultPreview
          result={analysisResult}
          onExportDraft={() => onPrototypeAction('原型反馈：正式版会导出邮件草稿文件')}
        />
        <Composer draft={draft} onDraftChange={onDraftChange} onSend={onSend} onExportDraft={() => onPrototypeAction('原型反馈：正式版会导出邮件草稿文件')} />
      </section>
      <Inspector customer={customer} />
    </div>
  );
}

/**
 * InquiryCard 渲染客户原始询盘和真实分析入口。
 *
 * 参数：
 * - analysisStatus：当前分析状态，字符串。
 * - customer：当前客户对象。
 * - inquiryText：可编辑询盘文本。
 * - onInquiryTextChange：更新询盘文本的回调函数。
 * - onStartAnalysis：开始真实分析的回调函数。
 *
 * 返回值：React 询盘卡片。
 * 可能抛出的异常：不主动抛异常。
 */
function InquiryCard({ analysisStatus, customer, inquiryText, onInquiryTextChange, onStartAnalysis }) {
  const isRunning = analysisStatus === 'running';

  return (
    <article className="panel inquiry-panel">
      <div className="panel-heading">
        <div>
          <UserRound size={17} />
          <strong>客户询盘原文</strong>
          <span>来自 {customer.source}</span>
        </div>
        <time>14:31</time>
      </div>
      <div className="inquiry-editor">
        <textarea
          value={inquiryText}
          onChange={(event) => onInquiryTextChange(event.target.value)}
          aria-label={`${customer.name} 询盘内容`}
        />
        <div className="inquiry-actions">
          <span>使用 DeepSeek flash 真实分析</span>
          <button type="button" className="send-button" disabled={isRunning} onClick={onStartAnalysis}>
            <Sparkles size={16} />
            {isRunning ? '分析中' : '开始分析'}
          </button>
        </div>
      </div>
    </article>
  );
}

/**
 * ProgressSummary 渲染给业务用户看的轻量处理进度。
 *
 * 参数：
 * - items：进度项数组。
 * - onConfirmContext：确认保存到客户卡片的回调函数。
 * - isConfirmed：是否已经确认保存，布尔值。
 *
 * 返回值：React 轻量进度节点。
 * 可能抛出的异常：不主动抛异常。
 */
function ProgressSummary({ analysisError, analysisRunId, analysisStatus, items, onConfirmContext, isConfirmed }) {
  if (!items.length && !analysisError) {
    return (
      <section className="panel progress-panel empty-state-panel">
        <div className="progress-head">
          <div>
            <strong>处理进度</strong>
            <span>点击开始分析后显示处理步骤</span>
          </div>
          <span className="progress-state pending">未开始</span>
        </div>
      </section>
    );
  }

  const safeItems = items.map(sanitizeAgentProcessStepForDisplay);
  const activeItem = safeItems.find((item) => item.status === 'pending') || safeItems.at(-1);
  const statusText = analysisStatus === 'running'
    ? '正在调用 DeepSeek flash'
    : isConfirmed
      ? '已保存客户摘要'
      : '结果已生成，等待确认保存';
  const safeStatusText = safeAgentInlineLabel(statusText, {
    fallback: '正在处理当前询盘。',
    maxLength: 90,
  });
  const stateText = analysisStatus === 'running' ? '分析中' : isConfirmed ? '已完成' : '待确认';

  return (
    <section className="panel progress-panel">
      <div className="progress-head">
        <div>
          <strong>处理进度</strong>
          <span>{safeStatusText}</span>
        </div>
        <span className={isConfirmed ? 'progress-state complete' : 'progress-state pending'}>
          {stateText}
        </span>
      </div>

      <div className="progress-strip" aria-label="处理进度">
        {safeItems.map((item) => (
          <div className={`progress-step ${item.status}`} key={item.label}>
            <span className="progress-dot" aria-hidden="true">
              {item.status === 'complete' ? <Check size={12} /> : null}
            </span>
            <div>
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </div>
          </div>
        ))}
      </div>

      {analysisError ? (
        <div className="confirmation-row compact error">
          <CircleAlert size={16} />
          <span>{analysisError}</span>
        </div>
      ) : null}

      {!analysisError && analysisRunId && !isConfirmed && activeItem?.needsConfirmation ? (
        <div className="confirmation-row compact">
          <CircleAlert size={16} />
          <span>保存到客户卡片前需要确认。</span>
          <button type="button" onClick={onConfirmContext}>
            确认保存
          </button>
        </div>
      ) : null}
    </section>
  );
}

/**
 * ResultPreview 渲染分析结果预览。
 *
 * 参数：
 * - onExportDraft：导出草稿按钮回调函数。
 *
 * 返回值：React 结果区域。
 * 可能抛出的异常：不主动抛异常。
 */
function ResultPreview({ result, onExportDraft }) {
  if (!result) {
    return (
      <section className="panel result-panel empty-state-panel">
        <div className="section-title">
          <h2>分析结果预览</h2>
          <span>等待真实模型返回</span>
        </div>
        <p>点击「开始分析」后，这里会显示意向判断、信息缺口、风险提醒、英文回复草稿和下一步跟进。</p>
      </section>
    );
  }

  const dynamicCards = [
    {
      title: '客户意向判断',
      tag: result.intention?.level || '待判断',
      rows: [
        ['综合评分', `${result.intention?.score || 0} / 100`],
        ['判断依据', result.intention?.evidence || '模型未返回依据'],
      ],
    },
    {
      title: '信息缺口',
      tag: `${result.missingInfo?.length || 0} 项`,
      rows: (result.missingInfo || []).map((item, index) => [`${index + 1}`, item]),
    },
    {
      title: '风险提醒',
      tag: `${result.risks?.length || 0} 项`,
      rows: (result.risks || []).map((item, index) => [`${index + 1}`, item]),
    },
    {
      title: '下一步跟进计划',
      tag: '建议',
      rows: (result.nextSteps || []).map((item, index) => [`${index + 1}`, item]),
    },
  ];

  return (
    <section className="panel result-panel">
      <div className="section-title">
        <h2>分析结果预览</h2>
        <span>确认后可写入客户上下文</span>
      </div>

      <div className="result-grid">
        {dynamicCards.map((card) => (
          <article className="result-card" key={card.title}>
            <div className="result-card-title">
              <strong>{card.title}</strong>
              <span>{card.tag}</span>
            </div>
            <dl>
              {card.rows.map(([label, value]) => (
                <div key={`${card.title}-${label}`}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}

        <article className="result-card email-draft">
          <div className="result-card-title">
            <strong>英文回复草稿</strong>
            <button type="button" onClick={onExportDraft}>
              导出
            </button>
          </div>
          <div className="mail-copy">
            {result.replyDraft.split('\n').filter(Boolean).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

/**
 * Composer 渲染客户上下文里的追问输入区。
 *
 * 参数：
 * - draft：当前输入框内容。
 * - onDraftChange：更新输入内容的回调函数。
 * - onSend：发送追问的回调函数。
 * - onExportDraft：导出草稿的回调函数。
 *
 * 返回值：React 输入区。
 * 可能抛出的异常：不主动抛异常。
 */
function Composer({ draft, onDraftChange, onSend, onExportDraft }) {
  return (
    <section className="composer" aria-label="继续追问">
      <textarea
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder="继续追问，或输入要调整的回复语气..."
      />

      <div className="composer-toolbar">
        <div className="composer-actions">
          <button type="button">
            <Paperclip size={16} />
            引用资料
          </button>
          <button type="button">
            <Sparkles size={16} />
            切换Skill
          </button>
          <button type="button" onClick={onExportDraft}>
            <Download size={16} />
            导出草稿
          </button>
        </div>

        <button type="button" className="send-button" onClick={onSend}>
          <Send size={16} />
          发送
        </button>
      </div>
    </section>
  );
}

/**
 * Inspector 渲染右侧客户卡片。
 *
 * 参数：
 * - customer：当前客户对象。
 *
 * 返回值：React 右侧客户信息区域。
 * 可能抛出的异常：不主动抛异常。
 */
function Inspector({ customer }) {
  return (
    <aside className="inspector" aria-label="客户信息">
      <CustomerCard customer={customer} />
    </aside>
  );
}

/**
 * CustomerCard 渲染接近国际站业务场景的客户卡片。
 *
 * 参数：
 * - customer：当前客户对象。
 *
 * 返回值：React 客户卡片。
 * 可能抛出的异常：不主动抛异常。
 */
function CustomerCard({ customer }) {
  return (
    <section className="side-panel customer-card">
      <div className="customer-card-top">
        <div>
          <span className="eyebrow">{customer.source}</span>
          <h2>客户卡片</h2>
        </div>
        <button type="button" aria-label="收起客户卡片">
          <ChevronDown size={17} />
        </button>
      </div>

      <div className="customer-profile">
        <div className="customer-avatar" aria-hidden="true">
          {customer.name.slice(0, 1)}
        </div>
        <div>
          <strong>{customer.name}</strong>
          <span>{customer.country} · {customer.stage}</span>
        </div>
      </div>

      <div className="customer-tags" aria-label="客户状态">
        <span>{customer.stage}</span>
        <span>{customer.intent}</span>
      </div>

      <dl className="inquiry-facts">
        <div>
          <dt>采购产品</dt>
          <dd>{customer.product}</dd>
        </div>
        <div>
          <dt>采购数量</dt>
          <dd>{customer.quantity}</dd>
        </div>
        <div>
          <dt>询价条款</dt>
          <dd>{customer.terms}</dd>
        </div>
        <div>
          <dt>定制需求</dt>
          <dd>{customer.custom}</dd>
        </div>
      </dl>

      <div className="customer-summary-card">
        <div>
          <span>AI 摘要</span>
          <time>{customer.lastTouch}</time>
        </div>
        <p>{customer.summary}</p>
      </div>

      <div className="next-action-card">
        <span>建议动作</span>
        <strong>{customer.nextAction}</strong>
      </div>
    </section>
  );
}

/**
 * CustomerProfile 渲染客户详情档案。
 *
 * 参数：
 * - customer：当前客户对象。
 *
 * 返回值：React 客户档案。
 * 可能抛出的异常：不主动抛异常。
 */
function CustomerProfile({ customer }) {
  return (
    <section className="detail-panel-grid">
      <article className="panel profile-card">
        <div className="section-title">
          <h2>客户档案</h2>
          <span>基础信息和当前判断</span>
        </div>
        <dl className="profile-list">
          {customer.profile.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </article>
      <article className="panel profile-card">
        <div className="section-title">
          <h2>成交判断</h2>
          <span>来自最近一次分析</span>
        </div>
        <p>{customer.summary}</p>
        <div className="next-action-card embedded">
          <span>下一步</span>
          <strong>{customer.nextAction}</strong>
        </div>
      </article>
    </section>
  );
}

/**
 * CustomerTodos 渲染客户事项列表。
 *
 * 参数：
 * - customer：当前客户对象。
 *
 * 返回值：React 事项列表。
 * 可能抛出的异常：不主动抛异常。
 */
function CustomerTodos({ customer }) {
  return (
    <section className="panel task-panel">
      <div className="section-title">
        <h2>事项</h2>
        <span>围绕当前客户推进</span>
      </div>
      <div className="todo-list">
        {customer.todos.map((todo) => (
          <article className="todo-card" key={todo.title}>
            <ListChecks size={18} />
            <div>
              <strong>{todo.title}</strong>
              <span>{todo.due}</span>
            </div>
            <em>{todo.state}</em>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * CustomerTaskRecords 渲染并入客户 Kass 的任务记录。
 *
 * 参数：
 * - customer：当前客户对象。
 *
 * 返回值：React 任务记录列表。
 * 可能抛出的异常：不主动抛异常。
 */
function CustomerTaskRecords({ customer }) {
  return (
    <section className="panel task-panel">
      <div className="section-title">
        <h2>任务记录</h2>
        <span>不再作为左侧一级入口，按客户归档</span>
      </div>
      <div className="record-list">
        {customer.taskRecords.map((record) => (
          <article className="record-card" key={`${record.title}-${record.time}`}>
            <FileText size={18} />
            <div>
              <strong>{record.title}</strong>
              <span>{record.time}</span>
              <p>{record.result}</p>
            </div>
            <ChevronRight size={16} />
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * Toast 渲染底部轻提示。
 *
 * 参数：
 * - message：提示文案，字符串。
 * - onClose：关闭提示的回调函数。
 *
 * 返回值：React 提示组件。
 * 可能抛出的异常：不主动抛异常。
 */
function Toast({ message, onClose }) {
  return (
    <div className="toast" role="status">
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="关闭提示">
        <X size={15} />
      </button>
    </div>
  );
}
