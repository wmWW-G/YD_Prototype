/* global window */

/**
 * 左侧导航分组数据。
 *
 * 为什么把导航写成数据：
 * - 线上赢单的左侧导航入口很多，后续经常会增删。
 * - 数据化后，开发同事只改这里就能调整导航，不需要翻渲染代码。
 *
 * @type {Array<{
 *   id: string,
 *   label: string,
 *   icon: string,
 *   type: "single" | "group",
 *   children?: Array<{ id: string, label: string, icon: string }>
 * }>}
 */
window.NAV_GROUPS = [
  { id: "ask", label: "问一下", icon: "assets/icons/01_ask.svg", type: "single" },
  { id: "sales-prep", label: "销售准备", icon: "assets/icons/03_market_research.svg", type: "single" },
  {
    id: "deal-advisor",
    label: "成交顾问",
    icon: "assets/icons/00a_deal_advisor.svg",
    type: "group",
    children: [
      { id: "customer-research", label: "客户背调顾问", icon: "assets/icons/02_background_check.svg" },
      { id: "negotiation-scene", label: "场景谈判顾问", icon: "assets/icons/06_negotiation.svg" },
      { id: "inquiry-reply", label: "询盘分析回复", icon: "assets/icons/07_inquiry_reply.svg" }
    ]
  },
  {
    id: "skills",
    label: "技能Skill",
    icon: "assets/icons/00b_skills.svg",
    type: "group",
    children: [
      { id: "market-research", label: "市场调研", icon: "assets/icons/03_market_research.svg" },
      { id: "cold-email", label: "新客开发信", icon: "assets/icons/04_new_client_letter.svg" },
      { id: "complaint", label: "客诉处理", icon: "assets/icons/08_complaint.svg" },
      { id: "reactivation", label: "客户激活", icon: "assets/icons/09_activation.svg" },
      { id: "relationship", label: "关系维护", icon: "assets/icons/05_relationship.svg" },
      { id: "phone-sales", label: "海外电销", icon: "assets/icons/10_overseas_call.svg" },
      { id: "video-meeting", label: "视频会议", icon: "assets/icons/11_video_meeting.svg" },
      { id: "field-visit", label: "地推陌拜", icon: "assets/icons/12_field_sales.svg" },
      { id: "visit-reception", label: "来访接待", icon: "assets/icons/13_visitor_reception.svg" },
      { id: "title-combo", label: "标题组合", icon: "assets/icons/15_combined_title.svg" },
      { id: "trade-show", label: "展会成交", icon: "assets/icons/14_exhibition.svg" }
    ]
  },
  {
    id: "customer-kass",
    label: "客户Kass",
    icon: "assets/icons/02_background_check.svg",
    type: "group",
    children: [
      { id: "customer-kass-a", label: "A", icon: "◎" },
      { id: "customer-kass-b", label: "B", icon: "◎" }
    ]
  }
];

/**
 * 假历史记录。
 *
 * 注意：
 * - 这里不能复制用户线上真实历史。
 * - 只保留能表达布局的短文本。
 *
 * @type {string[]}
 */
window.HISTORY_ITEMS = [
  "输出html",
  "卡死了?",
  "付款条件,、",
  "重中之重?",
  "?",
  "Yellow Door Energy...",
  "在吗",
  "?",
  "? ?",
  "在不"
];

/**
 * 销售准备顶部标签。
 *
 * @type {Array<{ id: string, label: string, icon: string }>}
 */
window.SALES_TABS = [
  { id: "flow", label: "外贸流程" },
  { id: "company", label: "了解公司" },
  { id: "market", label: "产品&市场" },
  { id: "cases", label: "案例知识库" }
];

/**
 * 外贸成交 12 阶段。
 *
 * 字段说明：
 * - id：稳定 ID，用于点击切换。
 * - title：阶段名称。
 * - desc：阶段一句话说明。
 * - goal：判断目标。
 * - output：关键产出。
 * - next：下一步动作。
 * - actions：这个阶段要做什么。
 * - tips：注意事项。
 * - materials：资料或表格按钮。
 * - functions：可跳转的赢单功能入口。
 *
 * @type {Array<{
 *   id: string,
 *   title: string,
 *   desc: string,
 *   goal: string,
 *   output: string,
 *   next: string,
 *   actions: string[],
 *   tips: string[],
 *   materials: string[],
 *   functions: string[]
 * }>}
 */
window.TRADE_STAGES = [
  {
    id: "lead",
    title: "线索到达",
    desc: "判断线索是否有真实采购动机，先别急着报价。",
    goal: "阶段1：记录来源、国家、公司名和联系人",
    output: "线索登记表 / 2份资料",
    next: "进入「客户背景」继续推进",
    actions: ["记录来源、国家、公司名和联系人", "判断客户是否可能是真买家"],
    tips: ["线索来源不清时，先补客户身份", "无效线索要尽早过滤，避免浪费报价时间"],
    materials: ["下载线索登记表", "下载客户背景表"],
    functions: ["客户背调", "客户KASS"],
    mistakes: ["看到询盘就立刻报价，不查客户背景", "登记得潦草，过两天连联系人都对不上"],
    kpi: ["来源/国家/公司名/联系人 4 项必填", "无效线索过滤率 ≥ 40%"],
    materialFields: [
      ["线索登记表", ["客户来源", "国家 / 地区", "公司名", "联系人 / 职务", "原始消息"]],
      ["客户背景表", ["公司主营", "员工规模", "采购角色判断", "成交可能性 ABC"]]
    ],
    video: { title: "如何 3 分钟判断一条询盘值不值得跟", duration: "03:12" }
  },
  {
    id: "background",
    title: "背景调查",
    desc: "查国家背景、公司背景和联系人背景，建立第一层判断。",
    goal: "确认客户所在市场、采购角色和公司可信度",
    output: "客户背景表 / 风险记录",
    next: "把有效客户沉淀到客户KASS",
    actions: ["核对官网、社媒和公司信息", "判断客户行业、规模和采购可能性"],
    tips: ["不要只看客户一句询价就报价", "先确认客户是否匹配公司目标市场"],
    materials: ["下载客户背景表", "下载风险检查表"],
    functions: ["客户背调", "客户KASS"],
    mistakes: ["只看官网首页就下结论，没查 LinkedIn / Google", "把从没成交过的国家当主战场"],
    kpi: ["官网 + 社媒 + 第三方至少 3 个渠道", "判断采购角色（采购 / 技术 / 老板）必填"],
    materialFields: [
      ["客户背景表", ["公司年限", "员工规模", "主营业务", "采购角色"]],
      ["风险检查表", ["付款风险", "市场制裁", "信用证可行性", "汇率敏感度"]]
    ],
    video: { title: "外贸客户背调的 6 个必看维度", duration: "05:48" }
  },
  {
    id: "inquiry",
    title: "询盘分级",
    desc: "读懂客户字面需求、言外之意和真实采购阶段。",
    goal: "判断客户是询价、比价、找供应商还是准备下单",
    output: "询盘分析表 / 客户等级",
    next: "决定首回邮件和补问问题",
    actions: ["提取产品、数量、市场和交期信息", "标记缺失条件和客户诚意"],
    tips: ["信息缺口越多，越要先问清楚", "高价值询盘要优先进入商机"],
    materials: ["下载询盘分析表", "下载客户分级表"],
    functions: ["询盘分析回复", "客户KASS"],
    mistakes: ["所有询盘都报价，分不出 A / B / C", "把明显比价的客户当真买家追"],
    kpi: ["每条询盘 1 分钟内打 A/B/C 标签", "A 级询盘当天进入商机池"],
    materialFields: [
      ["询盘分析表", ["产品/规格", "数量", "目标市场", "交期", "缺失条件"]],
      ["客户分级表", ["A/B/C 标签", "诚意度评分", "判断依据 3 条"]]
    ],
    video: { title: "1 分钟读懂询盘等级的实战拆解", duration: "04:21" }
  },
  {
    id: "opportunity",
    title: "转为商机",
    desc: "把有效询盘变成可推进的商机，确认下一步要换什么结果。",
    goal: "明确客户等级、采购角色和推进目标",
    output: "商机评估表 / 需求确认表",
    next: "进入询盘首回或关系维护",
    actions: ["确认客户要报价、样品、会议还是资料", "写清楚下一步要客户给什么反馈"],
    tips: ["没有下一步的商机很容易变成无效跟进", "把客户阶段写进客户档案"],
    materials: ["下载商机评估表", "下载需求确认表"],
    functions: ["客户KASS", "关系维护"],
    mistakes: ["没写清楚客户要的'下一步'就转商机", "把没有联系人的询盘也升级为商机"],
    kpi: ["每条商机必须有客户角色 + 下一步动作", "商机 ≤ 48 小时内首次跟进"],
    materialFields: [
      ["商机评估表", ["客户等级", "采购角色", "预期金额", "推进目标"]],
      ["需求确认表", ["下一步要拿到的", "时限", "可让步空间"]]
    ],
    video: { title: "把询盘转成商机要补哪 4 个字段", duration: "03:55" }
  },
  {
    id: "first-reply",
    title: "询盘首回",
    desc: "首封回复要专业、克制，先确认关键条件再给方案。",
    goal: "建立专业感，并把缺失信息问回来",
    output: "首回邮件 / 补问信息清单",
    next: "根据客户反馈进入连环跟进",
    actions: ["感谢询盘并复述需求", "补问关键条件，不急着给过多承诺"],
    tips: ["首回不要写得像群发模板", "报价前要确认规格、数量和交付条件"],
    materials: ["下载首回模板", "下载补问清单"],
    functions: ["询盘分析回复", "新客开发信"],
    mistakes: ["首回就给最低价", "用群发模板复制粘贴，签名忘了换"],
    kpi: ["首次回复 < 24 小时", "首回邮件至少 3 个补问问题"],
    materialFields: [
      ["首回邮件模板", ["称呼", "复述客户需求", "补问 3 个关键问题", "下一步建议"]],
      ["补问清单", ["规格", "数量", "交期", "目标港", "付款方式", "认证要求"]]
    ],
    video: { title: "首封邮件不踩坑的 5 个细节", duration: "06:04" }
  },
  {
    id: "follow-up",
    title: "连环跟进",
    desc: "客户不回复时，用有节奏的触达建立记忆点。",
    goal: "让客户愿意继续沟通，而不是被催单压迫",
    output: "跟进节奏表 / 多轮邮件",
    next: "进入建立链接或客户激活",
    actions: ["设计 3-5 轮跟进节奏", "每一轮都提供新信息或新价值"],
    tips: ["不要每天机械催回复", "跟进内容要围绕客户利益变化"],
    materials: ["下载跟进节奏表", "下载催回复模板"],
    functions: ["客户激活", "关系维护"],
    mistakes: ["每天问一遍'Any update?'", "只用邮件跟进，不切 WhatsApp / 电话"],
    kpi: ["3-5 轮节奏，每轮间隔 2-5 天", "每轮至少新增 1 个价值点"],
    materialFields: [
      ["跟进节奏表", ["第几轮", "渠道", "话题点", "间隔天数"]],
      ["催回复模板", ["软提醒", "硬提醒", "止损话术"]]
    ],
    video: { title: "客户不回邮件时的 5 轮节奏设计", duration: "07:36" }
  },
  {
    id: "trust",
    title: "建立链接",
    desc: "用公司实力、产品价值和案例，让客户愿意继续谈。",
    goal: "让客户相信你值得继续沟通",
    output: "公司证明资料 / 案例资料",
    next: "报价前进入八问八查",
    actions: ["匹配客户国家和行业的案例", "补充认证、交付证明和样品方案"],
    tips: ["客户先信任你，才会认真看报价", "案例要匹配客户场景，不要乱发资料包"],
    materials: ["下载公司介绍", "下载案例资料"],
    functions: ["了解公司", "案例知识库"],
    mistakes: ["资料包一次性甩完，没匹配客户场景", "把欧洲案例给中东客户看"],
    kpi: ["案例匹配国家 + 行业 ≥ 2 维度", "公司介绍 + 案例发送率 ≥ 90%"],
    materialFields: [
      ["公司介绍", ["一句话定位", "工厂照片", "产能", "认证"]],
      ["案例资料", ["客户国家", "行业", "成交规模", "交付证据"]]
    ],
    video: { title: "怎么选案例最能打动客户", duration: "05:12" }
  },
  {
    id: "check",
    title: "八问八查",
    desc: "报价前做完整核查，避免信息缺口导致报价无效。",
    goal: "确认报价必须条件和客户真实约束",
    output: "报价前检查表 / 客户条件表",
    next: "进入报价阶段",
    actions: ["确认规格、数量、包装、交期、港口和付款条件", "检查报价边界和可让步条件"],
    tips: ["缺少关键条件时不要硬报死价", "报价要留出谈判空间和有效期"],
    materials: ["下载报价前检查表", "下载客户条件表"],
    functions: ["场景谈判顾问", "询盘分析回复"],
    mistakes: ["缺关键条件就硬报死价", "报价前没确认付款方式"],
    kpi: ["规格 / 数量 / 包装 / 交期 / 港口 / 付款 6 项齐全", "报价前检查表 100% 完成"],
    materialFields: [
      ["报价前检查表", ["规格", "数量", "包装", "交期", "目标港", "付款方式", "认证", "有效期"]],
      ["客户条件表", ["底线价", "可让步项", "增值附加"]]
    ],
    video: { title: "报价前必查的 8 项硬指标", duration: "04:48" }
  },
  {
    id: "quote",
    title: "报价",
    desc: "先讲价值和条件，再给价格，控制有效期和报价边界。",
    goal: "给出专业报价，并设置后续推进动作",
    output: "报价邮件 / 报价单",
    next: "推动客户确认样品或会议",
    actions: ["说明产品价值、配置和交付条件", "给出价格、有效期和下一步建议"],
    tips: ["不要只发价格表", "报价后要设计客户回应路径"],
    materials: ["下载报价单", "下载报价邮件模板"],
    functions: ["谈判", "新客开发信"],
    mistakes: ["只发价格表，没讲价值", "报价没有效期，半年后客户还来谈"],
    kpi: ["报价邮件 ≥ 2 个证据材料（案例 / 认证）", "报价单标明有效期 15-30 天"],
    materialFields: [
      ["报价单", ["产品 SKU", "单价", "MOQ", "交期", "包装", "付款方式", "有效期"]],
      ["报价邮件模板", ["价值锚点", "条件说明", "下一步建议", "签名"]]
    ],
    video: { title: "怎么写一封不被砍价的报价邮件", duration: "08:14" }
  },
  {
    id: "sample",
    title: "样品",
    desc: "用样品验证需求和质量，推动客户从询价进入订单。",
    goal: "确认样品规格、费用、寄送和验收标准",
    output: "样品申请表 / 样品跟进表",
    next: "样品确认后推进大货单",
    actions: ["确认样品规格和用途", "约定样品反馈时间和后续动作"],
    tips: ["样品不是结束，要提前约定反馈", "样品费用和运费要说清楚"],
    materials: ["下载样品申请表", "下载样品跟进表"],
    functions: ["客户KASS", "关系维护"],
    mistakes: ["免费寄完不约反馈时间", "样品规格和大货不一致"],
    kpi: ["样品确认时间 ≤ 14 天", "样品 → 大货成交率 ≥ 40%"],
    materialFields: [
      ["样品申请表", ["规格", "用途", "费用", "运费承担", "目的地"]],
      ["样品跟进表", ["寄出时间", "签收时间", "反馈截止", "下一步"]]
    ],
    video: { title: "样品环节最该约定的 3 件事", duration: "04:02" }
  },
  {
    id: "bulk-order",
    title: "大货单",
    desc: "样品确认后，进入 PI、付款、生产、出货和交付管理。",
    goal: "把客户确认转成可执行订单",
    output: "PI / 生产交付表",
    next: "进入成交复购和交付复盘",
    actions: ["确认 PI、付款、生产排期和验货节点", "同步客户关键里程碑"],
    tips: ["订单阶段不要只靠口头确认", "付款、交期、质检和物流节点要留痕"],
    materials: ["下载PI模板", "下载生产交付表"],
    functions: ["客户KASS", "视频会议"],
    mistakes: ["PI 没写清楚验货标准", "付款节点和生产节点对不上"],
    kpi: ["PI / 付款 / 排产 / 验货 4 个里程碑齐全", "首单交付准时率 ≥ 95%"],
    materialFields: [
      ["PI 模板", ["买家信息", "卖家信息", "SKU 与单价", "付款方式", "交期", "运输条款", "验货标准"]],
      ["生产交付表", ["排产时间", "下线时间", "QC 节点", "装箱时间", "船期"]]
    ],
    video: { title: "PI 怎么签客户不返工", duration: "09:24" }
  },
  {
    id: "repurchase",
    title: "成交复购",
    desc: "完成订单执行后，继续沉淀复盘和复购机会。",
    goal: "把一次成交变成长期客户关系",
    output: "成交复盘表 / 复购跟进表",
    next: "进入客户维护和复购计划",
    actions: ["记录订单执行、交付结果和客户反馈", "设计复购、转介绍和新品推荐动作"],
    tips: ["成交不是结束，复购才是长期价值", "把成交路径写入客户档案，后续 AI 才能继续调用"],
    materials: ["下载成交复盘表", "下载复购跟进表"],
    functions: ["客户KASS", "关系维护"],
    mistakes: ["成交完没复盘，下一单从头开始", "不主动推介新品 / 复购"],
    kpi: ["每个客户成交后 30 天内复盘", "复购客户占比 ≥ 30%"],
    materialFields: [
      ["成交复盘表", ["成交路径", "客户决策点", "AI 抓不到的关键细节"]],
      ["复购跟进表", ["复购窗口", "新品推荐", "转介绍触发条件"]]
    ],
    video: { title: "成交客户的 30 天复盘动作清单", duration: "06:42" }
  }
];

/**
 * 阶段 → 我自己 KASS 客户的反查表。
 *
 * 为什么单独建一份：
 * - 这是变体 B 给业务员展示"我在该阶段还有哪些客户"的入口。
 * - 数据可以和 `KASS_GROUPS` 分开，不污染线上 1:1 复刻的 A/B 分组页。
 * - 后续接真实接口时只需替换 stage → customers[] 的映射。
 *
 * @type {Record<string, Array<{ name: string, country: string, industry: string, group: "A" | "B" }>>}
 */
window.FLOW_STAGE_CUSTOMERS = {
  lead: [
    { name: "Sunbright Energy", country: "Egypt", industry: "EPC", group: "A" },
    { name: "Mid-East Solar Co.", country: "UAE", industry: "Distributor", group: "A" },
    { name: "Latam Power Hub", country: "Mexico", industry: "Project", group: "B" }
  ],
  background: [
    { name: "Bravo Trade LLC", country: "Saudi Arabia", industry: "Distributor", group: "B" }
  ],
  inquiry: [
    { name: "Yellow Door Energy", country: "UAE", industry: "Solar", group: "A" },
    { name: "Atlas Renewables", country: "Spain", industry: "EPC", group: "A" }
  ],
  opportunity: [
    { name: "PT Surya Mandiri", country: "Indonesia", industry: "Brand", group: "A" }
  ],
  "first-reply": [
    { name: "Verde Soluciones", country: "Chile", industry: "Distributor", group: "B" }
  ],
  "follow-up": [
    { name: "Greenstone EPC", country: "Kenya", industry: "EPC", group: "A" },
    { name: "Kappa Solar", country: "Greece", industry: "Retail", group: "A" }
  ],
  trust: [
    { name: "Bayut Power", country: "UAE", industry: "Project", group: "A" }
  ],
  check: [
    { name: "Vento Pacific", country: "Australia", industry: "Distributor", group: "B" }
  ],
  quote: [
    { name: "Orion Solar S.A.", country: "Argentina", industry: "Brand", group: "A" }
  ],
  sample: [],
  "bulk-order": [
    { name: "Northern Lights AB", country: "Sweden", industry: "Retail", group: "A" }
  ],
  repurchase: [
    { name: "Cairo Energy Group", country: "Egypt", industry: "EPC", group: "B" }
  ]
};

/**
 * 12 个阶段在变体 A 的进度条上需要展示的简称（不超过 4 个汉字）。
 *
 * @type {Record<string, string>}
 */
/**
 * 升级套餐：当前展示 3 档。
 *
 * 字段说明：
 * - id：稳定 ID。
 * - name：套餐名。
 * - price / unit：价格 + 单位（如 ¥99 / 月）。
 * - tagline：一句话定位。
 * - features：套餐包含的能力列表，会渲染为 ✓ 行。
 * - cta / ctaToast：按钮文案 + 点击后弹出的 toast 内容。
 * - badge：右上角小标签（可选，例如"推荐"）。
 * - highlighted：是否高亮（推荐方案）。
 * - current：是否是当前方案（按钮置灰）。
 *
 * @type {Array<{
 *   id: string,
 *   name: string,
 *   price: string,
 *   unit: string,
 *   tagline: string,
 *   features: string[],
 *   cta: string,
 *   ctaToast?: string,
 *   badge?: string,
 *   highlighted?: boolean,
 *   current?: boolean
 * }>}
 */
/**
 * 用量明细页 · 单条用量记录。
 *
 * @type {Array<{ time: string, scene: string, model: string, credits: string }>}
 */
window.USAGE_RECORDS = [
  { time: "2026-06-08 01:27:51", scene: "客户背调顾问", model: "Qwen 3.6 Plus", credits: "1.01" },
  { time: "2026-06-08 01:26:23", scene: "询盘分析回复", model: "Qwen 3.6 Plus", credits: "0.6" },
  { time: "2026-06-08 01:25:34", scene: "场景谈判顾问", model: "标准", credits: "3.59" },
  { time: "2026-06-05 03:17:51", scene: "客户Kass · 1的", model: "Gemini 3 Flash", credits: "0.74" },
  { time: "2026-06-05 02:58:42", scene: "案例知识库搜索", model: "Qwen 3.6 Plus", credits: "0.2" },
  { time: "2026-06-05 02:58:30", scene: "新客开发信", model: "Gemini 3 Flash", credits: "8.94" },
  { time: "2026-06-02 18:42:11", scene: "市场调研", model: "标准", credits: "2.18" },
  { time: "2026-06-02 18:39:42", scene: "客户背调顾问", model: "Qwen 3.6 Plus", credits: "1.45" },
  { time: "2026-05-29 23:12:08", scene: "询盘首回模板生成", model: "Gemini 3 Flash", credits: "0.32" },
  { time: "2026-05-27 09:14:55", scene: "样品跟进", model: "Qwen 3.6 Plus", credits: "0.91" }
];

window.UPGRADE_PLANS = [
  {
    id: "free",
    name: "免费版",
    price: "¥0",
    unit: "永久免费",
    tagline: "帮你跑完一次外贸成交全流程的入门方案",
    features: [
      "每月 520 积分",
      "基础成交顾问 + 询盘分析",
      "客户 Kass A / B 两个分组",
      "历史会话 10 条 · 案例库 50MB"
    ],
    cta: "当前方案",
    current: true
  },
  {
    id: "pro",
    name: "专业版",
    price: "¥99",
    unit: "/月（年付 ¥990）",
    tagline: "一个业务员一年成交 30+ 单的标配",
    features: [
      "每月 10,000 积分（约 200 次深度对话）",
      "高级模型 + 场景谈判顾问",
      "客户 Kass 不限分组 + 标签搜索",
      "案例知识库无限上传 / 全文检索",
      "优先客服 + 教学直播课"
    ],
    cta: "立即升级",
    ctaToast: "已模拟订阅专业版，正式版会跳转到支付页。",
    badge: "推荐",
    highlighted: true
  },
  {
    id: "team",
    name: "团队版",
    price: "¥499",
    unit: "/月 · 5 席起",
    tagline: "5 人以上的外贸团队 + 老板视角",
    features: [
      "不限积分 + 不限座席（按席计费）",
      "团队成员管理 / 权限分配",
      "客户 Kass 跨人协作 + 交接",
      "老板看板：阶段漏斗 / 团队复盘",
      "私有部署 + 定制接口集成"
    ],
    cta: "联系销售",
    ctaToast: "已模拟提交销售联系请求，正式版会打开企业表单。"
  }
];

window.FLOW_STAGE_SHORT = {
  lead: "线索",
  background: "背调",
  inquiry: "分级",
  opportunity: "商机",
  "first-reply": "首回",
  "follow-up": "跟进",
  trust: "链接",
  check: "八问",
  quote: "报价",
  sample: "样品",
  "bulk-order": "大货",
  repurchase: "复购"
};

/**
 * 还没有完整逆向的顶部标签内容。
 *
 * 当前先做成真实工作台样式的轻量占位，避免页面是空的。
 * 后续继续观察线上页面后，只需要替换这里的数据或新增专门渲染函数。
 *
 * @type {Record<string, { title: string, desc: string, cards: Array<{ title: string, text: string }> }>}
 */
window.COMPANY_MODULES = [
  {
    id: "tagline",
    title: "一句话定位",
    status: "已完成",
    summary: "公司核心对外介绍",
    tags: ["#智能穿戴", "#深圳制造", "#2014年成立"],
    detail: "直接修改这段内容即可，写完后点击右侧按钮，让 AI 帮你提炼成更适合外贸业务调用的表达",
    fields: ["PulseWatch Technology 是一家 2014 年成立于中国深圳的智能穿戴设备垂直整合设计与制造商，为全球 60 余个国家的品牌商、经销商、电信运营商及零售连锁企业提供产品与服务。"]
  },
  {
    id: "overview",
    title: "公司概况",
    status: "已完成",
    summary: "基础公司信息",
    tags: ["#成立时间", "#总部所在地", "#员工规模"],
    detail: "公司年限、规模、办公地等基础数据，方便业务员在自我介绍和报价邮件里复用",
    fields: ["成立时间：2014 年", "总部：中国 · 深圳", "员工规模：约 320 人，自有工厂 + 自有研发"]
  },
  {
    id: "products",
    title: "核心产品",
    status: "已完成",
    summary: "公司主营产品",
    tags: ["#智能手表", "#健康手环", "#OEM/ODM"],
    detail: "把核心 SKU、定位、典型客户列在这里，业务员一眼能看出公司能接什么单",
    fields: ["智能手表 / 健康手环 / 智能戒指", "OEM / ODM / 自有品牌三种合作模式", "支持小批量定制（MOQ 起 500 pcs）"]
  },
  {
    id: "manufacturing",
    title: "制造实力",
    status: "已完成",
    summary: "生产与供应链能力",
    tags: ["#自有工厂", "#月产能", "#交期"],
    detail: "工厂面积、产线、产能、交期这种采购方最关心的硬指标",
    fields: ["深圳光明 12,000㎡ 自有工厂", "月产能 30 万只智能穿戴设备", "标准交期 35-45 天，可走加急 25 天"]
  },
  {
    id: "quality",
    title: "质量与认证",
    status: "已完成",
    summary: "合规与质检能力",
    tags: ["#ISO9001", "#CE/FCC/RoHS", "#IP68"],
    detail: "把认证、合规、质检流程整理好，做欧美和中东客户时可以直接贴出来",
    fields: ["ISO9001、ISO14001 双体系认证", "产品通过 CE / FCC / RoHS / BQB", "全检 + AOI + 老化测试 72 小时"]
  },
  {
    id: "market",
    title: "市场与客户",
    status: "已完成",
    summary: "销售区域与客户类型",
    tags: ["#欧洲", "#中东", "#拉美"],
    detail: "现有市场、典型客户类型和成交规模，便于做相似国家、相似客户的复用推荐",
    fields: ["主力市场：欧洲、中东、拉美、东南亚", "客户类型：品牌商、电信运营商、零售连锁", "Top 3 客户单笔订单稳定在 30 万美金以上"]
  },
  {
    id: "service",
    title: "服务承诺",
    status: "已完成",
    summary: "交付与售后支持",
    tags: ["#样品 7 天", "#质保 24 个月", "#技术响应"],
    detail: "样品时效、质保、售后响应时间等业务员被客户反复追问的承诺",
    fields: ["样品 7 个工作日内寄出", "整机质保 24 个月，配件 12 个月", "技术问题 24 小时内首次响应"]
  },
  {
    id: "contact",
    title: "联系方式",
    status: "已完成",
    summary: "公司联络方式",
    tags: ["#官网", "#公司邮箱", "#销售热线"],
    detail: "贴在邮件签名、报价单脚注的标准联系方式",
    fields: ["官网：www.example-pulsewatch.com", "对外邮箱：sales@example.com", "电话：+86 755-0000-0000"]
  }
];

window.PRODUCT_ROWS = [
  {
    id: "solar-kit",
    category: "储能",
    name: "Solar Storage Kit",
    image: "SK",
    function: "离网供电与小型商业备用电",
    params: "5kWh / 10kWh，可并联扩容",
    selling: "安装快，适合电力不稳定市场",
    weakness: "海运体积偏大",
    scenario: "中东经销商、非洲项目商"
  },
  {
    id: "mounting",
    category: "支架",
    name: "Adjustable Mounting System",
    image: "MS",
    function: "屋顶和地面组件安装",
    params: "铝合金 / 10 年质保",
    selling: "抗腐蚀，安装孔位兼容性高",
    weakness: "需要确认当地风载",
    scenario: "EPC、安装商、批发客户"
  },
  {
    id: "inverter",
    category: "逆变器",
    name: "Hybrid Inverter",
    image: "HI",
    function: "光储一体控制",
    params: "3-12kW，支持远程监控",
    selling: "适配多种电池协议",
    weakness: "售前需确认认证版本",
    scenario: "家庭储能、轻商用项目"
  }
];

window.CASE_CATEGORIES = [
  { id: "client", title: "客户案例", desc: "帮销售快速引用可成交的项目证据", count: 3 },
  { id: "review", title: "内部复盘", desc: "复盘成交路径、失误教训和团队经验", count: 2 },
  { id: "faq", title: "百问百答", desc: "常见问题、标准回复和禁用表达", count: 5 }
];

window.CASE_ITEMS = [
  { id: "uae-quote", category: "client", tags: ["报价", "交付证据"], title: "阿联酋项目报价推进", meta: "UAE / 储能 / 项目商", excerpt: "客户关注交期和付款节点，最终用交付照片、排产表和阶段付款方案推进。" },
  { id: "moq-rebuttal", category: "faq", tags: ["MOQ"], title: "客户压低 MOQ 怎么回", meta: "通用 / 首单谈判", excerpt: "先解释生产成本和包装损耗，再给样品单、小批量试单或混柜方案。" },
  { id: "after-sales", category: "review", tags: ["售后"], title: "逆变器售后复盘", meta: "拉美 / 售后", excerpt: "把问题拆成安装、使用环境和产品批次，回复时先稳住情绪，再给排查路径。" }
];

window.CUSTOMERS = [
  {
    id: "yellow-door",
    name: "Yellow Door Energy",
    shortName: "Y",
    country: "UAE",
    industry: "Solar / Energy",
    stage: "报价后跟进",
    score: 82,
    owner: "A",
    tags: ["项目商", "中东", "高意向"],
    profile: "关注大型商业屋顶太阳能项目，倾向稳定供应和明确交付节点。",
    inquiry: "Need solar mounting and storage proposal for a commercial rooftop project. Please share MOQ, lead time and certificates.",
    risk: ["需要确认付款条件", "项目时间表未完全明确"],
    nextActions: ["补发认证与交付案例", "约视频会议确认项目规模", "准备分阶段报价方案"]
  },
  {
    id: "bravo-trade",
    name: "Bravo Trade LLC",
    shortName: "B",
    country: "Saudi Arabia",
    industry: "Distributor",
    stage: "询盘分级",
    score: 64,
    owner: "B",
    tags: ["经销商", "比价中"],
    profile: "首次接触，主要询问价格和代理政策，需要判断真实采购计划。",
    inquiry: "Send your best price for hybrid inverter, we compare suppliers this week.",
    risk: ["比价信号明显", "缺少数量和认证要求"],
    nextActions: ["补问数量与目标认证", "用卖点差异降低纯比价", "设置 2 天跟进提醒"]
  }
];

window.CUSTOMER_TIMELINE = [
  { id: "t1", type: "背调", time: "09:30", title: "生成客户画像", text: "已整理国家、行业、采购角色和风险提醒。" },
  { id: "t2", type: "询盘", time: "11:05", title: "识别关键缺口", text: "缺少数量、交付地、认证版本和付款预期。" },
  { id: "t3", type: "跟进", time: "14:20", title: "准备报价后邮件", text: "建议先补案例和认证，再进入价格讨论。" }
];

window.KASS_GROUPS = [
  {
    id: "customer-kass-a",
    label: "A",
    desc: "这里展示客户 Kass 下 A 的所有客户",
    customers: [
      {
        id: "kass-a-1",
        name: "1的",
        stage: "线索到达",
        country: "待补充",
        industry: "终端工厂",
        website: "待补充",
        contact: "Sherry",
        level: "A",
        risk: "中",
        tags: ["项目型采购", "重视交付证明", "价格敏感度 中等"],
        records: 0
      }
    ]
  },
  {
    id: "customer-kass-b",
    label: "B",
    desc: "这里展示客户 Kass 下 B 的所有客户",
    customers: [
      {
        id: "kass-b-1",
        name: "B",
        stage: "背景调查",
        country: "待补充",
        industry: "经销商",
        website: "待补充",
        contact: "待补充",
        level: "B",
        risk: "低",
        tags: ["普通询盘", "待确认采购量", "需要补充官网"],
        records: 0
      }
    ]
  }
];

window.KASS_FLOW_STAGES = [
  "1-线索到达",
  "2-背景调查",
  "3-询盘分级",
  "4-转为商机",
  "5-询盘首回",
  "6-连环跟进",
  "7-建立链接",
  "8-八问八查",
  "9-报价",
  "10-样品",
  "11-大货单",
  "12-成交复购"
];

/**
 * 后台管理原型的左侧菜单。
 *
 * 为什么单独放一份后台菜单：
 * - 后台真实页面来自 SoybeanAdmin，信息架构和前台赢单工作台完全不同。
 * - 单独维护能避免把“管理系统”的菜单混进普通用户侧导航。
 *
 * @type {Array<{ id: string, label: string, icon: string, parent?: string }>}
 */
window.ADMIN_NAV_ITEMS = [
  { id: "admin-home", label: "首页", icon: "▣" },
  { id: "admin-knowledge", label: "知识库管理", icon: "☰", parent: "系统管理" },
  { id: "admin-user", label: "用户管理", icon: "♟", parent: "系统管理" },
  { id: "admin-user-preview", label: "User Preview", icon: "◉", parent: "系统管理" },
  { id: "admin-invite", label: "邀请码管理", icon: "◇", parent: "系统管理" },
  { id: "admin-character", label: "AI人设管理", icon: "♣", parent: "系统管理" },
  { id: "admin-model", label: "AI模型管理", icon: "♟", parent: "系统管理" }
];

/**
 * 知识库管理表格数据。
 *
 * 注意：
 * - 这里只保留后台字段形态和可读样例。
 * - 文件 URL 使用省略号，避免原型里沉淀完整线上资源地址。
 *
 * @type {Array<{ id: number, name: string, url: string, mime: string }>}
 */
window.ADMIN_KNOWLEDGE_ROWS = [
  { id: 1, name: "地推陌拜", url: "https://ydan.oss-cn-shenzhen.aliyuncs.com/uploads/..._field_visit.txt", mime: "text/plain" },
  { id: 2, name: "关系维护", url: "https://ydan.oss-cn-shenzhen.aliyuncs.com/uploads/..._relationship.txt", mime: "text/plain" },
  { id: 3, name: "海外电销", url: "https://ydan.oss-cn-shenzhen.aliyuncs.com/uploads/..._phone_sales.txt", mime: "text/plain" },
  { id: 4, name: "客户激活", url: "https://ydan.oss-cn-shenzhen.aliyuncs.com/uploads/..._reactivation.txt", mime: "text/plain" },
  { id: 5, name: "客诉处理", url: "https://ydan.oss-cn-shenzhen.aliyuncs.com/uploads/..._complaint.txt", mime: "text/plain" },
  { id: 6, name: "来访接待", url: "https://ydan.oss-cn-shenzhen.aliyuncs.com/uploads/..._visit_reception.txt", mime: "text/plain" },
  { id: 7, name: "视频会议", url: "https://ydan.oss-cn-shenzhen.aliyuncs.com/uploads/..._video_meeting.txt", mime: "text/plain" },
  { id: 8, name: "新客开发信", url: "https://ydan.oss-cn-shenzhen.aliyuncs.com/uploads/..._cold_email.txt", mime: "text/plain" },
  { id: 9, name: "展会成交_展后", url: "https://ydan.oss-cn-shenzhen.aliyuncs.com/uploads/..._expo_post.txt", mime: "text/plain" },
  { id: 10, name: "展会成交_展前", url: "https://ydan.oss-cn-shenzhen.aliyuncs.com/uploads/..._expo_pre.txt", mime: "text/plain" },
  { id: 11, name: "展会成交_展中", url: "https://ydan.oss-cn-shenzhen.aliyuncs.com/uploads/..._expo_during.txt", mime: "text/plain" },
  { id: 12, name: "场景谈判顾问", url: "https://ydan.oss-cn-shenzhen.aliyuncs.com/uploads/..._negotiation.txt", mime: "text/plain" },
  { id: 13, name: "询盘分析回复", url: "https://ydan.oss-cn-shenzhen.aliyuncs.com/uploads/..._inquiry_reply.txt", mime: "text/plain" }
];

/**
 * 用户管理表格数据。
 *
 * 真实后台里用户名是手机号。原型里统一脱敏，避免复制真实用户信息。
 *
 * @type {Array<{ id: number, username: string, registeredAt: string, credits: number, subAccounts: string, messageCount: number, tokenCount: number, enabled: boolean }>}
 */
window.ADMIN_USER_ROWS = [
  { id: 1, username: "135****0024", registeredAt: "2026/06/13 10:02:34", credits: 0, subAccounts: "0/0", messageCount: 0, tokenCount: 0, enabled: true },
  { id: 2, username: "158****8358", registeredAt: "2026/06/13 10:02:22", credits: 0, subAccounts: "0/0", messageCount: 0, tokenCount: 0, enabled: true },
  { id: 3, username: "188****1044", registeredAt: "2026/06/13 09:53:37", credits: 0, subAccounts: "0/0", messageCount: 0, tokenCount: 0, enabled: true },
  { id: 4, username: "137****3499", registeredAt: "2026/06/13 09:53:00", credits: 0, subAccounts: "0/0", messageCount: 13, tokenCount: 4194, enabled: true },
  { id: 5, username: "134****9547", registeredAt: "2026/06/13 09:51:35", credits: 0, subAccounts: "0/0", messageCount: 0, tokenCount: 0, enabled: true },
  { id: 6, username: "136****9392", registeredAt: "2026/06/13 09:51:19", credits: 0, subAccounts: "0/0", messageCount: 2, tokenCount: 5860, enabled: true },
  { id: 7, username: "189****4871", registeredAt: "2026/06/13 09:49:46", credits: 0, subAccounts: "0/0", messageCount: 0, tokenCount: 0, enabled: true },
  { id: 8, username: "178****7070", registeredAt: "2026/06/13 09:49:21", credits: 0, subAccounts: "0/0", messageCount: 0, tokenCount: 0, enabled: true },
  { id: 9, username: "133****9094", registeredAt: "2026/06/13 09:48:31", credits: 0, subAccounts: "0/0", messageCount: 0, tokenCount: 0, enabled: true },
  { id: 10, username: "136****0196", registeredAt: "2026/06/13 09:44:17", credits: 0, subAccounts: "0/0", messageCount: 6, tokenCount: 13687, enabled: true }
];

/**
 * User Preview 数据概览指标。
 *
 * 为什么单独建这份数据：
 * - User Preview 是新方案试验页，不能影响现有「用户管理」。
 * - 这里把统计口径、当前值、金额和业务价值放在同一行，便于后续产品讨论。
 *
 * @type {Array<{ id: string, metric: string, value: string, amount: string }>}
 */
window.ADMIN_USER_PREVIEW_METRICS = [
  { id: "total-users", metric: "累计用户总数", value: "2,130", amount: "-" },
  { id: "total-deal-amount", metric: "累计成交金额", value: "¥286,400", amount: "-" },
  { id: "new-today", metric: "今日新增注册", value: "48", amount: "-" },
  { id: "active-today", metric: "今日活跃用户", value: "326", amount: "-" },
  { id: "paid-today", metric: "今日付费用户", value: "9", amount: "-" },
  { id: "paid-total", metric: "付费会员总数", value: "186", amount: "-" },
  { id: "deal-amount-today", metric: "今日成交金额", value: "¥8,920", amount: "-" },
  { id: "token-today", metric: "今日 Token 总消耗", value: "3,286,500", amount: "-" },
  { id: "token-cost-today", metric: "Token成本(估算)", value: "¥412", amount: "-" }
];

/**
 * User Preview 功能调用总看板。
 *
 * @type {Array<{ rank: number, feature: string, calls: string, users: string, avgUse: string, token: string, tokenShare: string, cost: string }>}
 */
window.ADMIN_USER_PREVIEW_FUNCTION_SUMMARY = [
  { rank: 1, feature: "问一下", calls: "1,268", users: "342", avgUse: "3.7 次", token: "918K", tokenShare: "28%", cost: "¥86" },
  { rank: 2, feature: "客户背调顾问", calls: "936", users: "188", avgUse: "5.0 次", token: "1,108K", tokenShare: "34%", cost: "¥142" },
  { rank: 3, feature: "询盘分析回复", calls: "642", users: "156", avgUse: "4.1 次", token: "672K", tokenShare: "20%", cost: "¥61" },
  { rank: 4, feature: "市场调研", calls: "420", users: "96", avgUse: "4.4 次", token: "498K", tokenShare: "15%", cost: "¥49" },
  { rank: 5, feature: "新客开发信", calls: "386", users: "121", avgUse: "3.2 次", token: "286K", tokenShare: "9%", cost: "¥24" },
  { rank: 6, feature: "场景谈判顾问", calls: "304", users: "87", avgUse: "3.5 次", token: "318K", tokenShare: "10%", cost: "¥31" },
  { rank: 7, feature: "客户Kass", calls: "218", users: "73", avgUse: "3.0 次", token: "226K", tokenShare: "7%", cost: "¥22" },
  { rank: 8, feature: "案例知识库搜索", calls: "186", users: "64", avgUse: "2.9 次", token: "142K", tokenShare: "4%", cost: "¥13" },
  { rank: 9, feature: "产品&市场", calls: "164", users: "52", avgUse: "3.2 次", token: "126K", tokenShare: "4%", cost: "¥12" },
  { rank: 10, feature: "报价邮件", calls: "132", users: "48", avgUse: "2.8 次", token: "96K", tokenShare: "3%", cost: "¥9" }
];

/**
 * User Preview 可选报表字段。
 *
 * @type {Array<{ id: string, label: string, group: string }>}
 */
window.ADMIN_USER_PREVIEW_FIELDS = [
  { id: "userId", label: "用户ID", group: "基础" },
  { id: "username", label: "用户", group: "基础" },
  { id: "registeredAt", label: "注册时间", group: "基础" },
  { id: "registerSource", label: "注册来源", group: "来源" },
  { id: "inviteCode", label: "邀请码", group: "来源" },
  { id: "salesOwner", label: "所属销售", group: "来源" },
  { id: "lastLoginAt", label: "最近登录时间", group: "登录" },
  { id: "lastUsedAt", label: "最近使用时间", group: "使用" },
  { id: "firstFeature", label: "首次使用功能", group: "使用" },
  { id: "topFeature", label: "最常用功能", group: "使用" },
  { id: "lastFeature", label: "最近使用功能", group: "使用" },
  { id: "usageCount", label: "功能调用次数", group: "使用" },
  { id: "sessionCount", label: "会话数", group: "使用" },
  { id: "messageCount", label: "消息数", group: "使用" },
  { id: "avgRounds", label: "平均对话轮数", group: "使用" },
  { id: "uploadCount", label: "上传次数", group: "深度行为" },
  { id: "exportCount", label: "导出次数", group: "深度行为" },
  { id: "tokenUsed", label: "Token 消耗", group: "成本" },
  { id: "modelSplit", label: "按模型分配", group: "成本" },
  { id: "amount", label: "金额", group: "金额" },
  { id: "paymentCount", label: "付款次数", group: "金额" },
  { id: "lastPaidAt", label: "最近付款时间", group: "金额" },
  { id: "paidStatus", label: "付费状态", group: "金额" },
  { id: "creditBalance", label: "剩余积分", group: "积分" },
  { id: "creditUsed", label: "已用积分", group: "积分" },
  { id: "upgradeClickCount", label: "升级点击次数", group: "转化" },
  { id: "payPageViewCount", label: "支付页访问次数", group: "转化" },
  { id: "redeemedInviteAt", label: "邀请码兑换时间", group: "转化" }
];

/**
 * User Preview 用户字段报表数据。
 *
 * @type {Array<Record<string, string>>}
 */
window.ADMIN_USER_PREVIEW_USERS = [
  { userId: "U-10001", username: "180****9154", registeredAt: "2026/06/08 01:27", registerSource: "销售邀请", inviteCode: "YD-TRY-M4Q9", salesOwner: "销售B", lastLoginAt: "2026/06/13 15:38", lastUsedAt: "2026/06/13 15:42", firstFeature: "问一下", topFeature: "客户背调顾问", lastFeature: "客户背调顾问", usageCount: "36", sessionCount: "18", messageCount: "146", avgRounds: "8.2", uploadCount: "5", exportCount: "3", tokenUsed: "218K", modelSplit: "Plus 62% / 标准 38%", amount: "¥99", paymentCount: "1", lastPaidAt: "2026/06/12 10:20", paidStatus: "专业版", creditBalance: "9,480", creditUsed: "520", upgradeClickCount: "3", payPageViewCount: "2", redeemedInviteAt: "2026/06/13 11:08" },
  { userId: "U-10002", username: "137****3499", registeredAt: "2026/06/13 09:53", registerSource: "自然注册", inviteCode: "-", salesOwner: "-", lastLoginAt: "2026/06/13 14:16", lastUsedAt: "2026/06/13 14:18", firstFeature: "问一下", topFeature: "问一下", lastFeature: "问一下", usageCount: "13", sessionCount: "5", messageCount: "38", avgRounds: "4.1", uploadCount: "0", exportCount: "0", tokenUsed: "42K", modelSplit: "标准 100%", amount: "¥0", paymentCount: "0", lastPaidAt: "-", paidStatus: "免费版", creditBalance: "0", creditUsed: "86", upgradeClickCount: "1", payPageViewCount: "0", redeemedInviteAt: "-" },
  { userId: "U-10003", username: "136****9392", registeredAt: "2026/06/13 09:51", registerSource: "销售邀请", inviteCode: "YD-TRY-8K2P", salesOwner: "销售A", lastLoginAt: "2026/06/13 13:02", lastUsedAt: "2026/06/13 13:06", firstFeature: "询盘分析回复", topFeature: "询盘分析回复", lastFeature: "询盘分析回复", usageCount: "2", sessionCount: "1", messageCount: "7", avgRounds: "3.5", uploadCount: "1", exportCount: "0", tokenUsed: "5.8K", modelSplit: "标准 100%", amount: "¥0", paymentCount: "0", lastPaidAt: "-", paidStatus: "免费版", creditBalance: "300", creditUsed: "20", upgradeClickCount: "0", payPageViewCount: "0", redeemedInviteAt: "2026/06/13 12:58" },
  { userId: "U-10004", username: "158****8358", registeredAt: "2026/06/13 10:02", registerSource: "展会二维码", inviteCode: "-", salesOwner: "销售A", lastLoginAt: "2026/06/13 10:10", lastUsedAt: "2026/06/13 10:12", firstFeature: "新客开发信", topFeature: "新客开发信", lastFeature: "新客开发信", usageCount: "1", sessionCount: "1", messageCount: "2", avgRounds: "1.0", uploadCount: "0", exportCount: "0", tokenUsed: "1.2K", modelSplit: "标准 100%", amount: "¥0", paymentCount: "0", lastPaidAt: "-", paidStatus: "免费版", creditBalance: "520", creditUsed: "0", upgradeClickCount: "0", payPageViewCount: "0", redeemedInviteAt: "-" },
  { userId: "U-10005", username: "133****9094", registeredAt: "2026/06/13 09:48", registerSource: "自然注册", inviteCode: "-", salesOwner: "-", lastLoginAt: "2026/05/09 18:18", lastUsedAt: "2026/05/09 18:20", firstFeature: "问一下", topFeature: "问一下", lastFeature: "问一下", usageCount: "1", sessionCount: "1", messageCount: "2", avgRounds: "0.8", uploadCount: "0", exportCount: "0", tokenUsed: "0.9K", modelSplit: "标准 100%", amount: "¥0", paymentCount: "0", lastPaidAt: "-", paidStatus: "免费版", creditBalance: "505", creditUsed: "15", upgradeClickCount: "0", payPageViewCount: "0", redeemedInviteAt: "-" },
  { userId: "U-10006", username: "189****4871", registeredAt: "2026/06/13 09:49", registerSource: "搜索投放", inviteCode: "-", salesOwner: "-", lastLoginAt: "2026/06/12 20:58", lastUsedAt: "2026/06/12 21:04", firstFeature: "市场调研", topFeature: "市场调研", lastFeature: "市场调研", usageCount: "7", sessionCount: "3", messageCount: "21", avgRounds: "5.6", uploadCount: "0", exportCount: "1", tokenUsed: "28K", modelSplit: "Flash 40% / 标准 60%", amount: "¥0", paymentCount: "0", lastPaidAt: "-", paidStatus: "免费版", creditBalance: "445", creditUsed: "75", upgradeClickCount: "2", payPageViewCount: "1", redeemedInviteAt: "-" },
  { userId: "U-10007", username: "178****7070", registeredAt: "2026/06/13 09:49", registerSource: "销售邀请", inviteCode: "YD-TEAM-7N6C", salesOwner: "销售主管", lastLoginAt: "2026/06/13 12:55", lastUsedAt: "2026/06/13 12:58", firstFeature: "客户背调顾问", topFeature: "场景谈判顾问", lastFeature: "场景谈判顾问", usageCount: "22", sessionCount: "9", messageCount: "82", avgRounds: "7.4", uploadCount: "3", exportCount: "4", tokenUsed: "96K", modelSplit: "Plus 51% / 标准 49%", amount: "¥499", paymentCount: "1", lastPaidAt: "2026/06/13 12:40", paidStatus: "团队版", creditBalance: "49,120", creditUsed: "880", upgradeClickCount: "4", payPageViewCount: "2", redeemedInviteAt: "2026/06/13 10:18" },
  { userId: "U-10008", username: "134****9547", registeredAt: "2026/06/13 09:51", registerSource: "自然注册", inviteCode: "-", salesOwner: "-", lastLoginAt: "2026/06/13 09:53", lastUsedAt: "2026/06/13 09:55", firstFeature: "问一下", topFeature: "问一下", lastFeature: "问一下", usageCount: "1", sessionCount: "1", messageCount: "3", avgRounds: "1.3", uploadCount: "0", exportCount: "0", tokenUsed: "1.5K", modelSplit: "标准 100%", amount: "¥0", paymentCount: "0", lastPaidAt: "-", paidStatus: "免费版", creditBalance: "520", creditUsed: "0", upgradeClickCount: "0", payPageViewCount: "0", redeemedInviteAt: "-" }
];

/**
 * 邀请码管理表格数据。
 *
 * 注意：
 * - 这里只展示后台字段形态和销售运营场景，不代表真实可兑换码。
 * - 用户名、手机号和销售姓名都使用模拟或脱敏内容，避免把真实敏感信息写进原型。
 *
 * @type {Array<{ id: number, code: string, credits: number, batch: string, owner: string, status: string, redeemedBy: string, redeemedAt: string, expiresAt: string, createdAt: string }>}
 */
window.ADMIN_INVITE_ROWS = [
  { id: 1, code: "YD-TRY-8K2P", credits: 500, batch: "6月展会试用", owner: "销售A", status: "未兑换", redeemedBy: "-", redeemedAt: "-", expiresAt: "2026/07/31", createdAt: "2026/06/13 10:32:18" },
  { id: 2, code: "YD-TRY-M4Q9", credits: 300, batch: "老客户激活", owner: "销售B", status: "已兑换", redeemedBy: "180****9154", redeemedAt: "2026/06/13 11:08:42", expiresAt: "2026/07/15", createdAt: "2026/06/12 18:05:21" },
  { id: 3, code: "YD-TEAM-7N6C", credits: 1000, batch: "团队试用", owner: "销售主管", status: "未兑换", redeemedBy: "-", redeemedAt: "-", expiresAt: "2026/08/01", createdAt: "2026/06/11 15:44:09" },
  { id: 4, code: "YD-TRY-X2V5", credits: 200, batch: "新用户首访", owner: "销售A", status: "已过期", redeemedBy: "-", redeemedAt: "-", expiresAt: "2026/06/01", createdAt: "2026/05/20 09:16:34" }
];

/**
 * AI 人设管理表格数据。
 *
 * @type {Array<{ id: number, name: string, level: string, description: string, prompt: string, guide: string, enabled: boolean, sort: number }>}
 */
window.ADMIN_CHARACTER_ROWS = [
  { id: 1, name: "B2B销售准备", level: "一级人设", description: "", prompt: "请输入查询内容[例如：3月新贸节老板 运营 业务要做什么工作？/ 新手外贸要准备什么]", guide: "请输入关于外贸相关的问题", enabled: false, sort: 1 },
  { id: 30, name: "问一下", level: "一级人设", description: "", prompt: "请输入查询内容[例如：3月新贸节老板 运营 业务要做什么工作？/ 新手外贸要准备什么]", guide: "请输入关于外贸相关的问题", enabled: true, sort: 1 },
  { id: 2, name: "外贸市场调研", level: "一级人设", description: "", prompt: "市场调研：墨西哥·建筑材料行业·PVC地板·目标客户是工程采购商和批发商", guide: "输入「核心产品」为主，可选加上「目标国家/地区」和「目标客户类型」，用于整体市场调研与选品推荐。", enabled: false, sort: 2 },
  { id: 3, name: "客户背调助手", level: "一级人设", description: "", prompt: "背调：中东·新能源行业·Yellow Door Energy", guide: "输入客户所在国家/地区 + 行业/标签 + 公司名称，用于做客户背景调研。", enabled: false, sort: 3 },
  { id: 4, name: "写开发信技巧", level: "一级人设", description: "", prompt: "写开发信：美国·美容仪器·目标客户是品牌商·英文·首次开发", guide: "输入目标国家/地区、行业/产品、客户类型、语言和开发目的。", enabled: false, sort: 4 },
  { id: 5, name: "询盘分析回复", level: "一级人设", description: "", prompt: "询盘分析：这是客户的英文询盘内容…… 帮我判断客户诚意并给一封回复建议", guide: "直接粘贴客户询盘/聊天记录全文，可补充产品、价格和底线。", enabled: false, sort: 5 },
  { id: 10, name: "客户激活顾问", level: "二级人设", description: "", prompt: "激活客户：美国户外用品品牌商，2年没下单，帮我写一封唤醒邮件", guide: "输入客户国家/地区、行业、沉默时长、历史合作和新卖点。", enabled: false, sort: 9 },
  { id: 110, name: "市场调研", level: "二级人设", description: "", prompt: "市场调研：墨西哥·建筑材料行业·PVC地板·目标客户是工程采购商和批发商", guide: "输入核心产品、目标国家/地区和目标客户类型。", enabled: true, sort: 11 },
  { id: 17, name: "电话跟进技巧", level: "二级人设", description: "", prompt: "美国 + EST + 催回复报价 + Price is too high / Let me think about it", guide: "根据客户关系和沟通目标，生成完整外贸电话脚本。", enabled: false, sort: 17 },
  { id: 18, name: "视频会议主持专家", level: "二级人设", description: "# 角色 你是一名B2B视频会议主持助手", prompt: "", guide: "", enabled: false, sort: 18 },
  { id: 19, name: "出货提醒顾问", level: "二级人设", description: "外贸B2B出货前确认与提醒文案顾问", prompt: "", guide: "", enabled: false, sort: 19 },
  { id: 32, name: "客户背调顾问", level: "二级人设", description: "", prompt: "背调：中东·新能源行业·Yellow Door Energy", guide: "输入客户信息，用于做客户背景调研。", enabled: true, sort: 28 },
  { id: 37, name: "新客开发信", level: "二级人设", description: "", prompt: "写开发信：美国·美容仪器·目标客户是品牌商·英文·首次开发", guide: "输入目标国家、行业、客户类型、语言和开发目的。", enabled: true, sort: 33 },
  { id: 419, name: "销售准备", level: "一级人设", description: "销售准备的功能入口。", prompt: "", guide: "", enabled: true, sort: 35 }
];

/**
 * AI 人设菜单管理弹窗数据。
 *
 * @type {Array<{ id: number, name: string, level: string, parent: string, logo: string, sort: number, createdAt: string }>}
 */
window.ADMIN_MENU_ROWS = [
  { id: 21, name: "问一下", level: "一级菜单", parent: "-", logo: "-", sort: 0, createdAt: "2026/4/15 16:56:03" },
  { id: 26, name: "测试一级人设菜单", level: "二级菜单", parent: "-", logo: "-", sort: 0, createdAt: "2026/4/23 10:18:11" },
  { id: 29, name: "背调谈判跟进", level: "二级菜单", parent: "-", logo: "-", sort: 0, createdAt: "2026/4/24 14:54:24" },
  { id: 4, name: "B2B销售百问", level: "二级菜单", parent: "-", logo: "预览", sort: 1, createdAt: "2026/2/5 16:11:52" },
  { id: 22, name: "成交顾问", level: "一级菜单", parent: "-", logo: "预览", sort: 1, createdAt: "2026/4/16 20:34:51" },
  { id: 5, name: "外贸市场调研", level: "二级菜单", parent: "-", logo: "预览", sort: 2, createdAt: "2026/2/5 16:13:37" },
  { id: 23, name: "技能Skill", level: "一级菜单", parent: "-", logo: "预览", sort: 3, createdAt: "2026/4/16 20:35:19" },
  { id: 6, name: "新客写开发信", level: "二级菜单", parent: "-", logo: "-", sort: 5, createdAt: "2026/2/5 16:14:31" },
  { id: 9, name: "询盘分析跟进", level: "二级菜单", parent: "-", logo: "-", sort: 6, createdAt: "2026/2/5 16:15:20" },
  { id: 46, name: "标题组合", level: "二级菜单", parent: "-", logo: "预览", sort: 44, createdAt: "2026/5/29 10:25:29" },
  { id: 13, name: "展会成交", level: "二级菜单", parent: "-", logo: "预览", sort: 55, createdAt: "2026/2/5 16:16:04" }
];

/**
 * AI 模型管理表格数据。
 *
 * @type {Array<{ id: number, modelId: string, thinking: string }>}
 */
window.ADMIN_MODEL_ROWS = [
  { id: 1, modelId: "gemini-3.0-pro-preview", thinking: "高" },
  { id: 2, modelId: "gemini-3.1-pro-preview", thinking: "高" }
];
