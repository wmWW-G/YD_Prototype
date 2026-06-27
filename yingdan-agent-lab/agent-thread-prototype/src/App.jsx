import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Download,
  FileText,
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

const navItems = [
  { label: '新对话', icon: PenLine },
  { label: '赢单外贸顾问', icon: Sparkles },
  { label: '我的Agent', icon: Bot },
  { label: '技能Skill', icon: ListChecks },
  { label: '外接生态', icon: LayoutGrid },
  { label: '客户Kass', icon: UsersRound },
];

const collapsibleNavLabels = ['赢单外贸顾问', '客户Kass'];

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
        name: '小满 CRM MCP',
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
        name: 'Shopify MCP',
        provider: 'Shopify',
        desc: '商品、订单、客户和独立站运营数据',
        status: '可添加',
        mark: 'S',
        tone: 'green',
      },
      {
        name: 'SHOPLINE MCP',
        provider: 'SHOPLINE',
        desc: '独立站商品、订单和营销活动连接',
        status: '可添加',
        mark: 'SL',
        tone: 'dark',
      },
      {
        name: 'WordPress MCP',
        provider: 'WordPress',
        desc: '官网页面、博客内容和询盘表单管理',
        status: '可添加',
        mark: 'W',
        tone: 'gray',
      },
      {
        name: 'Google Trends MCP',
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
        name: 'Apollo.io MCP',
        provider: 'Apollo.io',
        desc: 'B2B 公司调研、联系人线索和销售触达',
        status: '可添加',
        mark: 'A',
        tone: 'yellow',
      },
      {
        name: 'Ahrefs MCP',
        provider: 'Ahrefs',
        desc: 'SEO 关键词、竞品网站和内容机会',
        status: '可添加',
        mark: 'a',
        tone: 'orange',
      },
      {
        name: 'Instantly MCP',
        provider: 'Instantly',
        desc: '冷邮件外联、序列任务和回复状态',
        status: '可添加',
        mark: 'I',
        tone: 'blue',
      },
      {
        name: 'Mailchimp MCP',
        provider: 'Mailchimp',
        desc: '邮件订阅、营销活动和客户分组',
        status: '可添加',
        mark: 'M',
        tone: 'dark',
      },
      {
        name: 'Klaviyo MCP',
        provider: 'Klaviyo',
        desc: '独立站邮件营销和客户自动化触达',
        status: '可添加',
        mark: 'K',
        tone: 'gray',
      },
      {
        name: 'Semrush MCP',
        provider: 'Semrush',
        desc: '竞品流量、广告关键词和市场搜索洞察',
        status: '可添加',
        mark: 'Se',
        tone: 'orange',
      },
    ],
  },
  {
    title: '通用工具 MCP',
    plugins: [
      {
        name: 'Gmail MCP',
        provider: 'Google Mail',
        desc: '读取邮件线程、生成回复草稿和跟进提醒',
        status: '可添加',
        mark: 'GM',
        tone: 'red',
      },
      {
        name: 'Google Drive MCP',
        provider: 'Google Drive',
        desc: '读取报价单、产品资料、合同和案例文件',
        status: '可添加',
        mark: 'D',
        tone: 'green',
      },
      {
        name: 'Notion MCP',
        provider: 'Notion',
        desc: '同步团队知识库、SOP 和客户记录',
        status: '可添加',
        mark: 'N',
        tone: 'dark',
      },
      {
        name: 'Slack MCP',
        provider: 'Slack',
        desc: '团队消息、客户事项和内部协作提醒',
        status: '可添加',
        mark: 'S',
        tone: 'purple',
      },
      {
        name: '飞书 MCP',
        provider: 'Lark / 飞书',
        desc: '云文档、多维表格、审批和任务协同',
        status: '可添加',
        mark: '飞',
        tone: 'blue',
      },
      {
        name: '自定义 MCP',
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
  const [activeNav, setActiveNav] = useState('新对话');
  const [expandedNav, setExpandedNav] = useState('');
  const [activeAdvisorId, setActiveAdvisorId] = useState('ask');
  const [activeLevelId, setActiveLevelId] = useState('A');
  const [activeCustomerId, setActiveCustomerId] = useState('global-sourcing');
  const [activeKassTab, setActiveKassTab] = useState('thread');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [draft, setDraft] = useState('');
  const [newConversationDraft, setNewConversationDraft] = useState('执行Skill：alibaba-inquiry-meeting');
  const [skillAgentStatus, setSkillAgentStatus] = useState('idle');
  const [skillAgentResult, setSkillAgentResult] = useState(null);
  const [skillAgentError, setSkillAgentError] = useState('');
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
   * 从新对话入口执行 Skill Agent。
   *
   * 作用：
   * - 识别用户输入的 `执行Skill：alibaba-inquiry-meeting`。
   * - 调用本地后端 `/api/agent/message`，由后端执行真实 Accio/Alibaba 只读采集和 XLSX builder。
   * - 把结果展示成新对话里的 Agent 进度和产物卡片。
   *
   * 参数：无。
   * 返回值：Promise<void>。
   * 可能抛出的异常：函数内部捕获网络和接口异常，并转成页面错误提示。
   */
  async function handleRunNewConversationAgent() {
    if (!newConversationDraft.trim()) {
      setToast('先输入要执行的 Skill');
      return;
    }

    setSkillAgentStatus('running');
    setSkillAgentError('');
    setSkillAgentResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/agent/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newConversationDraft }),
      });
      const payload = await response.json();

      if (!response.ok || payload.ok === false) {
        const message = payload.message || payload.error || 'Agent 执行失败';
        setSkillAgentStatus('error');
        setSkillAgentError(message);
        setToast(message);
        return;
      }

      setSkillAgentResult(payload);
      setSkillAgentStatus('completed');
      setToast('alibaba-inquiry-meeting 已执行完成');
    } catch (error) {
      setSkillAgentStatus('error');
      setSkillAgentError(`本地后端未启动或请求失败：${error.message}`);
      setToast(`本地后端未启动或请求失败：${error.message}`);
    }
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
          agentResult={skillAgentResult}
          agentStatus={skillAgentStatus}
          draft={newConversationDraft}
          onDraftChange={setNewConversationDraft}
          onRunAgent={handleRunNewConversationAgent}
          onPrototypeAction={handlePrototypeAction}
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
 * - agentResult：Agent 执行结果对象。
 * - agentStatus：Agent 状态，idle/running/completed/error。
 * - draft：新对话输入框内容。
 * - onDraftChange：更新新对话输入内容的回调函数。
 * - onRunAgent：执行 Agent 的回调函数。
 * - onPrototypeAction：原型反馈回调函数。
 *
 * 返回值：React 新对话页面。
 * 可能抛出的异常：不主动抛异常。
 */
function NewConversationView({ agentError, agentResult, agentStatus, draft, onDraftChange, onRunAgent, onPrototypeAction }) {
  const isRunning = agentStatus === 'running';
  const progressItems = isRunning
    ? [
        { label: '读取Skill', detail: '正在加载 alibaba-inquiry-meeting', status: 'pending' },
        { label: '确定周期', detail: '准备上周完整自然周', status: 'pending' },
        { label: '采集只读数据', detail: '等待 Accio/Alibaba 返回', status: 'pending' },
        { label: '生成XLSX', detail: '采集完成后生成工作簿', status: 'pending' },
      ]
    : agentResult?.progress || [];

  return (
    <div className="new-chat-simple">
      <section className="new-chat-center" aria-label="新对话">
        <div className="assistant-lockup">
          <img src="/assets/yingdan-mark.svg" alt="赢单" />
          <div>
            <h1>赢单助手</h1>
            <button type="button" onClick={() => onPrototypeAction('原型反馈：正式版会打开 Agent 切换菜单')}>
              <Sparkles size={15} />
              切换Agent
            </button>
          </div>
          <p>处理外贸客户、询盘和成交任务</p>
        </div>

        <section className="new-chat-composer">
          <textarea
            className="large-prompt"
            placeholder="输入问题...（@ 引用客户 / 资料）"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
          />

          <div className="composer-toolbar inline-toolbar">
            <div className="composer-actions">
              <button type="button">
                <Paperclip size={16} />
                引用资料
              </button>
              <button type="button">
                <Sparkles size={16} />
                选择Skill
              </button>
            </div>
            <button type="button" className="send-button" disabled={isRunning} onClick={onRunAgent}>
              <Send size={16} />
              {isRunning ? '执行中' : '开始对话'}
            </button>
          </div>
        </section>

        <SkillAgentRunPanel
          agentError={agentError}
          agentResult={agentResult}
          agentStatus={agentStatus}
          progressItems={progressItems}
          onPrototypeAction={onPrototypeAction}
        />
      </section>
    </div>
  );
}

/**
 * SkillAgentRunPanel 渲染新对话里的 Skill Agent 执行状态。
 *
 * 作用：
 * - 把后端真实 runner 返回的进度、摘要和 XLSX 路径展示给用户。
 * - 让新对话像 Accio Work 一样能看到任务正在被执行，而不是只有聊天回复。
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

  return (
    <section className="skill-agent-panel" aria-label="Skill Agent 执行状态">
      <div className="progress-head">
        <div>
          <strong>alibaba-inquiry-meeting Agent</strong>
          <span>{agentResult?.summary || '正在执行 Skill、采集只读数据并生成询盘分析会 XLSX'}</span>
        </div>
        <span className={`progress-state ${stateClass}`}>{stateText}</span>
      </div>

      <div className="progress-strip skill-progress-strip">
        {progressItems.map((item) => (
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
            <strong>{agentResult.artifact.workbookName}</strong>
            <span>{agentResult.artifact.outputPath}</span>
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
            <span>点击开始分析后显示 Runtime 步骤</span>
          </div>
          <span className="progress-state pending">未开始</span>
        </div>
      </section>
    );
  }

  const activeItem = items.find((item) => item.status === 'pending') || items.at(-1);
  const statusText = analysisStatus === 'running'
    ? '正在调用 DeepSeek flash'
    : isConfirmed
      ? '已保存客户摘要'
      : '结果已生成，等待确认保存';
  const stateText = analysisStatus === 'running' ? '分析中' : isConfirmed ? '已完成' : '待确认';

  return (
    <section className="panel progress-panel">
      <div className="progress-head">
        <div>
          <strong>处理进度</strong>
          <span>{statusText}</span>
        </div>
        <span className={isConfirmed ? 'progress-state complete' : 'progress-state pending'}>
          {stateText}
        </span>
      </div>

      <div className="progress-strip" aria-label="处理进度">
        {items.map((item) => (
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
