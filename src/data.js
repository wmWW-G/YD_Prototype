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
  { id: "customer-development", label: "客户开发", icon: "assets/icons/04_new_client_letter.svg", type: "single" },
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
      { id: "yd-artifact", label: "YD Artifact", icon: "assets/icons/16_yd_artifact.svg" },
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
      { id: "customer-kass-b", label: "B", icon: "◎" },
      { id: "customer-kass-c", label: "C", icon: "◎" },
      { id: "customer-kass-d", label: "D", icon: "◎" }
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
 * 客户背调顾问的原型数据。
 *
 * 为什么单独维护：
 * - 这个页面通过“不需要知识库的总库”执行 `customer-research` Skill。
 * - 主静态原型不能把 Dify API Key 写进前端，所以这里仅放产品可见的输入模板和结果样例。
 * - 真实路由和输入协议维护在 `dify-chatflows/Chatflow-不需要知识库的总库/`。
 *
 * @type {{
 *   samplePrompt: string,
 *   chips: string[],
 *   quickPrompts: Array<{ label: string, prompt: string }>,
 *   report: {
 *     company: string,
 *     country: string,
 *     industry: string,
 *     fitScore: string,
 *     summary: string,
 *     sections: Array<{ title: string, items: string[] }>,
 *     risks: Array<{ level: string, text: string }>,
 *     nextActions: string[]
 *   }
 * }}
 */
window.CUSTOMER_RESEARCH_FLOW = {
  samplePrompt: "公司名：Yellow Door Energy\n国家/地区：阿联酋 / 中东\n行业：新能源、分布式太阳能、储能\n官网：https://www.yellowdoorenergy.com\n我的产品：工商业储能方案、光伏配套设备\n目标：判断客户采购可能性、关键决策链、切入话术和下一步动作",
  chips: ["公司名", "官网", "国家/地区", "行业标签", "我的产品", "开发目标"],
  quickPrompts: [
    {
      label: "中东新能源客户",
      prompt: "公司名：Yellow Door Energy\n国家/地区：阿联酋 / 中东\n行业：新能源、分布式太阳能、储能\n官网：https://www.yellowdoorenergy.com\n我的产品：工商业储能方案、光伏配套设备\n目标：判断客户采购可能性、关键决策链、切入话术和下一步动作"
    },
    {
      label: "欧洲工程采购商",
      prompt: "公司名：SolarTech Solutions GmbH\n国家/地区：德国\n行业：光伏 EPC、工商业项目承包商\n官网：www.solartech-solutions.de\n我的产品：光伏组件 + 工商业储能方案\n目标：判断是否适合作为 A 类客户，并给出首次开发邮件角度"
    },
    {
      label: "询盘前快速背调",
      prompt: "客户信息：客户通过官网询盘，提到正在找储能系统供应商，但没有给数量和项目地点。\n国家/地区：沙特\n行业：EPC 承包商\n我的产品：5kW-100kW 工商业储能方案\n目标：先判断客户质量，再告诉我第一封回复要问什么"
    }
  ],
  report: {
    company: "Yellow Door Energy",
    country: "阿联酋 / 中东",
    industry: "分布式太阳能、工商业能源服务、PPA",
    fitScore: "A-",
    summary: "该客户更像区域能源项目服务商，采购决策会围绕项目收益、交付能力、认证、融资和长期运维展开。适合用中东项目案例、交付周期和质保能力切入，不建议一开始只推单品价格。",
    sections: [
      {
        title: "客户画像",
        items: ["服务工商业客户，重视项目回报周期和长期稳定性。", "中东市场项目属性明显，通常需要供应商证明本地交付经验。", "采购链条可能包含技术、项目、财务和高层多角色参与。"]
      },
      {
        title: "采购可能性",
        items: ["若其近期有新建或扩容项目，储能和光伏配套设备有切入空间。", "如果只做 PPA 或项目开发，直接卖设备的转化路径会更长。", "适合先确认项目类型、容量、并网要求、安装地和采购时间表。"]
      },
      {
        title: "切入话术",
        items: ["先用区域项目经验建立可信度，再问项目阶段。", "强调认证、交付、质保和长期运维配合，而不是只讲价格。", "建议把首次沟通目标设为确认项目需求和约技术会议。"]
      }
    ],
    risks: [
      { level: "中", text: "决策链可能较长，单个采购联系人未必能直接拍板。" },
      { level: "中", text: "若没有中东案例或认证材料，容易在供应商筛选阶段被过滤。" },
      { level: "低", text: "客户方向与新能源高度相关，业务匹配度较高。" }
    ],
    nextActions: ["补齐中东项目案例、认证、质保和交付周期资料。", "首封邮件询问项目国家、容量、并网/离网场景和采购时间。", "若客户回复项目已立项，推进一次 20 分钟技术会议。"]
  }
};

/**
 * 客户开发工作台示例数据。
 *
 * 为什么放在 data.js：
 * - 这个页面本质是原型里的业务样例，不是真实接口数据。
 * - 后续用户要改国家、客户类型、渠道或线索卡片时，只改这里会更直观。
 *
 * @type {{
 *   countryGroups: Array<{ id: string, label: string, countries: string[] }>,
 *   productGroups: Array<{ id: string, label: string, products: string[] }>,
 *   customerTypes: string[],
 *   quantities: number[],
 *   segments: string[],
 *   channels: Array<{ name: string, count: number, note: string }>,
 *   leads: Array<{
 *     id: string,
 *     company: string,
 *     country: string,
 *     countryName: string,
 *     type: string,
 *     source: string,
 *     priority: "A" | "B" | "C",
 *     score: number,
 *     reason: string,
 *     missing: string,
 *     next: string,
 *     updated: string,
 *     role: string,
 *     contact: string,
 *     website: string,
 *     location: string,
 *     size: string,
 *     founded: string,
 *     evidence: string[],
 *     opener: string,
 *     tags: string[]
 *   }>,
 *   cadence: Array<{ day: string, action: string, goal: string }>
 * }}
 */
window.CUSTOMER_DEVELOPMENT = {
  /*
   * 国家/地区按七大洲分组，页面一次只能选择一个国家或地区。
   * 目录覆盖 249 个国际贸易中常用的国家与地区条目；中文名称采用适合业务筛选的短名，
   * 既包含主权国家，也包含可独立开展市场筛选的属地和海外领地。
   */
  countryGroups: [
    {
      id: "asia",
      label: "亚洲",
      countries: ["阿富汗", "阿联酋", "阿曼", "阿塞拜疆", "巴基斯坦", "巴勒斯坦", "巴林", "不丹", "朝鲜", "东帝汶", "菲律宾", "格鲁吉亚", "哈萨克斯坦", "韩国", "吉尔吉斯斯坦", "柬埔寨", "卡塔尔", "科威特", "老挝", "黎巴嫩", "马尔代夫", "马来西亚", "蒙古", "孟加拉国", "缅甸", "尼泊尔", "日本", "塞浦路斯", "沙特阿拉伯", "斯里兰卡", "塔吉克斯坦", "泰国", "土耳其", "土库曼斯坦", "文莱", "乌兹别克斯坦", "新加坡", "叙利亚", "亚美尼亚", "也门", "伊拉克", "伊朗", "以色列", "印度", "印度尼西亚", "约旦", "越南", "中国大陆", "中国香港", "中国澳门", "中国台湾"]
    },
    {
      id: "europe",
      label: "欧洲",
      countries: ["阿尔巴尼亚", "爱尔兰", "爱沙尼亚", "安道尔", "奥地利", "奥兰群岛", "白俄罗斯", "保加利亚", "北马其顿", "比利时", "冰岛", "波黑", "波兰", "丹麦", "德国", "俄罗斯", "法国", "法罗群岛", "梵蒂冈", "芬兰", "根西岛", "荷兰", "黑山", "捷克", "克罗地亚", "拉脱维亚", "立陶宛", "列支敦士登", "卢森堡", "罗马尼亚", "马耳他", "马恩岛", "摩尔多瓦", "摩纳哥", "挪威", "葡萄牙", "瑞典", "瑞士", "塞尔维亚", "圣马力诺", "斯洛伐克", "斯洛文尼亚", "斯瓦尔巴和扬马延", "乌克兰", "西班牙", "希腊", "匈牙利", "意大利", "英国", "泽西岛", "直布罗陀"]
    },
    {
      id: "north-america",
      label: "北美洲",
      countries: ["安圭拉", "安提瓜和巴布达", "阿鲁巴", "巴巴多斯", "巴哈马", "巴拿马", "百慕大", "波多黎各", "伯利兹", "多米尼加", "多米尼克", "法属圣马丁", "哥斯达黎加", "格林纳达", "格陵兰", "古巴", "瓜德罗普", "海地", "荷属加勒比区", "洪都拉斯", "加拿大", "开曼群岛", "库拉索", "马提尼克", "美国", "美属维尔京群岛", "墨西哥", "蒙特塞拉特", "尼加拉瓜", "萨尔瓦多", "圣巴泰勒米", "圣基茨和尼维斯", "圣卢西亚", "圣马丁（荷属）", "圣皮埃尔和密克隆", "圣文森特和格林纳丁斯", "特克斯和凯科斯群岛", "特立尼达和多巴哥", "危地马拉", "牙买加", "英属维尔京群岛"]
    },
    {
      id: "south-america",
      label: "南美洲",
      countries: ["阿根廷", "巴拉圭", "巴西", "秘鲁", "玻利维亚", "布韦岛", "厄瓜多尔", "法属圭亚那", "福克兰群岛（马尔维纳斯）", "哥伦比亚", "圭亚那", "南乔治亚和南桑威奇群岛", "苏里南", "委内瑞拉", "乌拉圭", "智利"]
    },
    {
      id: "africa",
      label: "非洲",
      countries: ["阿尔及利亚", "埃及", "埃塞俄比亚", "安哥拉", "贝宁", "博茨瓦纳", "布基纳法索", "布隆迪", "赤道几内亚", "多哥", "厄立特里亚", "佛得角", "冈比亚", "刚果（布）", "刚果（金）", "吉布提", "几内亚", "几内亚比绍", "加纳", "加蓬", "津巴布韦", "喀麦隆", "科摩罗", "科特迪瓦", "肯尼亚", "莱索托", "利比里亚", "利比亚", "留尼汪", "卢旺达", "马达加斯加", "马拉维", "马里", "毛里求斯", "毛里塔尼亚", "马约特", "摩洛哥", "莫桑比克", "纳米比亚", "南非", "南苏丹", "尼日尔", "尼日利亚", "塞拉利昂", "塞内加尔", "塞舌尔", "圣赫勒拿", "圣多美和普林西比", "斯威士兰", "苏丹", "索马里", "坦桑尼亚", "突尼斯", "乌干达", "西撒哈拉", "赞比亚", "乍得", "中非共和国", "英属印度洋领地", "法属南部领地"]
    },
    {
      id: "oceania",
      label: "大洋洲",
      countries: ["澳大利亚", "巴布亚新几内亚", "北马里亚纳群岛", "法属波利尼西亚", "斐济", "关岛", "赫德岛和麦克唐纳群岛", "基里巴斯", "科科斯（基林）群岛", "库克群岛", "马绍尔群岛", "美属萨摩亚", "美国本土外小岛屿", "密克罗尼西亚联邦", "瑙鲁", "纽埃", "诺福克岛", "帕劳", "皮特凯恩", "萨摩亚", "圣诞岛", "所罗门群岛", "汤加", "图瓦卢", "托克劳", "瓦努阿图", "瓦利斯和富图纳", "新喀里多尼亚", "新西兰"]
    },
    {
      id: "antarctica",
      label: "南极洲",
      countries: ["南极洲"]
    }
  ],
  /*
   * 行业产品采用“大类 → 具体产品”的单选结构。
   * 大类服务于快速定位，具体产品才会写入获客条件，避免把过宽的行业名直接当产品。
   */
  productGroups: [
    { id: "energy", label: "新能源与电力", products: ["光伏组件", "光伏电池片", "光伏逆变器", "光伏支架", "户用储能", "工商业储能", "大型储能系统", "动力电池", "锂电池组", "充电桩", "风力发电设备", "配电设备"] },
    { id: "machinery", label: "机械与工业设备", products: ["包装机械", "食品机械", "纺织机械", "塑料机械", "橡胶机械", "印刷机械", "制药机械", "木工机械", "矿山机械", "工业泵", "工业阀门", "空压机"] },
    { id: "industrial-parts", label: "工业零部件", products: ["轴承", "齿轮", "减速机", "联轴器", "工业链条", "传动带", "液压元件", "气动元件", "密封件", "工业紧固件", "模具", "工业弹簧"] },
    { id: "electronic-components", label: "电子元器件", products: ["集成电路", "电容器", "电阻器", "连接器", "继电器", "传感器", "PCB 电路板", "半导体器件", "晶振", "电感器", "开关元件", "电子线束"] },
    { id: "consumer-electronics", label: "消费电子", products: ["智能手机", "平板电脑", "笔记本电脑", "智能手表", "蓝牙耳机", "音响设备", "移动电源", "智能穿戴设备", "数码相机", "游戏外设", "电脑配件", "手机配件"] },
    { id: "appliances", label: "家用电器", products: ["空调", "冰箱", "洗衣机", "电视机", "厨房小家电", "清洁电器", "个人护理电器", "空气净化器", "净水器", "风扇", "取暖器", "咖啡机"] },
    { id: "lighting", label: "照明产品", products: ["LED 灯泡", "LED 灯管", "商业照明", "工业照明", "户外照明", "太阳能灯", "道路照明", "景观照明", "智能照明", "应急照明", "舞台灯光", "灯具配件"] },
    { id: "building", label: "建筑与建材", products: ["建筑板材", "瓷砖", "石材", "水泥制品", "保温材料", "防水材料", "门窗", "幕墙系统", "屋面材料", "装饰材料", "建筑玻璃", "预制建筑"] },
    { id: "furniture", label: "家具与家居", products: ["办公家具", "卧室家具", "客厅家具", "餐厅家具", "酒店家具", "户外家具", "儿童家具", "定制家具", "床垫", "家具收纳系统", "家居装饰", "卫浴家具"] },
    { id: "hardware-tools", label: "五金与工具", products: ["手动工具", "电动工具", "气动工具", "园林工具", "焊接工具", "切削工具", "测量工具", "锁具", "门窗五金", "建筑五金", "紧固件", "工具箱"] },
    { id: "automotive", label: "汽车零配件", products: ["发动机零部件", "制动系统", "转向系统", "悬挂系统", "汽车滤清器", "汽车照明", "车载电子", "汽车空调配件", "新能源汽车配件", "轮胎", "轮毂", "汽车内饰"] },
    { id: "transport", label: "交通运输设备", products: ["乘用车", "商用车", "电动汽车", "摩托车", "电动摩托车", "自行车", "电动自行车", "挂车", "专用车辆", "轨道交通设备", "车辆维修设备", "汽车诊断设备"] },
    { id: "textile-materials", label: "纺织面料", products: ["棉纱", "化纤纱", "针织面料", "梭织面料", "功能性面料", "无纺布", "产业用纺织品", "蕾丝面料", "牛仔面料", "里料", "服装辅料", "家纺面料"] },
    { id: "apparel", label: "服装", products: ["男装", "女装", "童装", "运动服", "户外服装", "工作服", "内衣", "泳装", "针织服装", "羽绒服", "皮革服装", "功能性服装"] },
    { id: "shoes-bags", label: "鞋包与配饰", products: ["运动鞋", "休闲鞋", "皮鞋", "安全鞋", "箱包", "旅行箱", "背包", "手提包", "皮带", "帽子", "围巾", "时尚饰品"] },
    { id: "beauty", label: "美妆与个护", products: ["护肤品", "彩妆", "香水香氛", "美容仪器", "美发用品", "假发", "美甲用品", "口腔护理", "洗护用品", "个人清洁用品", "剃须用品", "化妆工具"] },
    { id: "medical", label: "医疗与健康", products: ["诊断设备", "医用影像设备", "手术器械", "医用耗材", "康复设备", "健康监测设备", "牙科设备", "牙科耗材", "实验室设备", "防护用品", "急救用品", "保健用品"] },
    { id: "chemicals", label: "化工原料", products: ["基础化学品", "精细化学品", "食品添加剂", "饲料添加剂", "水处理化学品", "表面活性剂", "催化剂", "油田化学品", "纺织助剂", "皮革化学品", "电子化学品", "日化原料"] },
    { id: "rubber-plastics", label: "橡塑制品", products: ["塑料薄膜", "塑料板材", "塑料管材", "工程塑料", "塑料容器", "橡胶板", "橡胶管", "工业胶带", "硅胶制品", "橡胶密封件", "再生塑料", "塑料母粒"] },
    { id: "metals", label: "冶金与矿产", products: ["钢材", "不锈钢", "铝材", "铜材", "有色金属", "金属粉末", "铸件", "锻件", "焊接材料", "耐火材料", "非金属矿产", "金属丝网"] },
    { id: "food-beverage", label: "食品与饮料", products: ["休闲食品", "烘焙食品", "糖果巧克力", "方便食品", "冷冻食品", "罐头食品", "乳制品", "饮料", "茶叶", "咖啡", "调味品", "食品原料"] },
    { id: "agriculture", label: "农业与园艺", products: ["新鲜水果", "新鲜蔬菜", "粮食谷物", "坚果籽类", "食用菌", "花卉苗木", "农用薄膜", "灌溉设备", "温室设备", "肥料", "农药", "饲料"] },
    { id: "packaging", label: "包装与印刷", products: ["纸质包装", "塑料包装", "金属包装", "玻璃包装", "食品包装", "化妆品包装", "标签", "印刷品", "包装材料", "包装容器", "展示架", "环保包装"] },
    { id: "daily-consumer", label: "日用消费品", products: ["厨房用品", "餐具", "杯壶", "清洁用品", "洗衣用品", "卫浴用品", "一次性用品", "家居收纳", "雨具", "钟表", "眼镜", "日用杂货"] },
    { id: "baby-toys", label: "母婴与玩具", products: ["婴儿服装", "婴儿用品", "婴儿推车", "儿童安全座椅", "喂养用品", "益智玩具", "毛绒玩具", "塑胶玩具", "遥控玩具", "户外玩具", "模型玩具", "电子游戏玩具"] },
    { id: "sports-outdoor", label: "运动与户外", products: ["健身器材", "球类用品", "水上运动用品", "露营装备", "登山用品", "骑行装备", "滑雪用品", "钓鱼用品", "运动护具", "瑜伽用品", "游乐设施", "户外炊具"] },
    { id: "pet", label: "宠物用品", products: ["宠物食品", "宠物零食", "宠物玩具", "宠物服饰", "宠物窝垫", "宠物牵引用品", "宠物清洁用品", "宠物美容用品", "宠物喂食器", "猫砂", "水族用品", "宠物医疗用品"] },
    { id: "office-education", label: "办公与文教", products: ["办公用品", "文具", "纸制品", "书写工具", "文件管理用品", "教学用品", "美术用品", "办公设备", "打印耗材", "会议设备", "学校家具", "教育电子产品"] },
    { id: "security-fire", label: "安防与消防", products: ["视频监控设备", "门禁系统", "防盗报警器", "智能锁", "楼宇对讲", "消防报警设备", "灭火器", "消防水带", "消防泵", "个人防护装备", "道路安全设施", "安检设备"] },
    { id: "environment-water", label: "环保与水处理", products: ["污水处理设备", "净水设备", "过滤设备", "反渗透设备", "废气处理设备", "除尘设备", "固废处理设备", "垃圾分类设备", "环境监测设备", "节能设备", "水处理膜", "环保耗材"] },
    { id: "instruments", label: "仪器与仪表", products: ["测量仪器", "分析仪器", "实验室仪器", "光学仪器", "温度仪表", "压力仪表", "流量仪表", "电工仪表", "称重设备", "自动化仪表", "无损检测设备", "环境检测仪器"] },
    { id: "commercial-equipment", label: "商用服务设备", products: ["商用厨房设备", "酒店用品", "餐饮设备", "自动售货机", "零售展示设备", "收银设备", "洗衣房设备", "清洁设备", "冷链设备", "制冰机", "商用咖啡机", "美容美发设备"] },
    { id: "gifts-crafts", label: "礼品与工艺品", products: ["促销礼品", "商务礼品", "节庆用品", "树脂工艺品", "金属工艺品", "木制工艺品", "陶瓷工艺品", "玻璃工艺品", "蜡烛香薰", "仿真花", "纪念品", "礼品包装"] },
    { id: "logistics", label: "仓储与物流设备", products: ["货架", "托盘", "叉车", "搬运车", "输送设备", "分拣设备", "仓储机器人", "物流容器", "周转箱", "冷链物流设备", "装卸设备", "物流包装"] },
    { id: "marine-aviation", label: "船舶与航空", products: ["船舶设备", "船用发动机", "船用电气设备", "船舶甲板机械", "救生设备", "游艇及配件", "航空零部件", "无人机", "地面保障设备", "航空电子设备", "机场设备", "航空维修工具"] },
    { id: "digital-services", label: "软件与数字服务", products: ["企业管理软件", "跨境电商软件", "客户关系管理系统", "工业软件", "网络安全服务", "云计算服务", "数据分析服务", "人工智能解决方案", "物联网解决方案", "移动应用开发", "数字营销服务", "IT 外包服务"] }
  ],
  /* 通用客户类型不绑定具体行业，便于产品选择变化后继续复用。 */
  customerTypes: [
    "不限 / 智能推荐",
    "进口商",
    "批发商",
    "分销商",
    "经销商",
    "代理商",
    "贸易公司",
    "品牌商",
    "制造商",
    "OEM / ODM 采购商",
    "零售商",
    "连锁零售商",
    "电商卖家",
    "工程承包商",
    "EPC 承包商",
    "系统集成商",
    "项目开发商",
    "采购服务商",
    "最终用户企业",
    "政府 / 公共机构",
    "设计院 / 顾问公司"
  ],
  // 所有获客来源只使用这一组固定档位，避免地图、海关等入口各自维护不同数量。
  quantities: [20, 50, 100, 200],
  segments: ["工程采购商", "进口批发商", "品牌方", "经销商", "EPC 承包商"],
  channels: [
    { name: "Google / 官网", count: 42, note: "适合找有官网和项目案例的目标客户" },
    { name: "LinkedIn", count: 28, note: "适合判断联系人职位和决策链" },
    { name: "展会名录", count: 18, note: "适合优先开发近期有采购动作的客户" },
    { name: "老客户转介绍", count: 7, note: "适合高信任起步，优先进入 A/B 客户" }
  ],
  leads: [
    {
      id: "solartech",
      company: "SolarTech Solutions GmbH",
      country: "DE",
      countryName: "德国",
      type: "EPC 承包商",
      source: "LinkedIn",
      priority: "A",
      score: 93,
      reason: "官网披露光伏 EPC 项目招标",
      missing: "预算，决策人邮箱",
      next: "发送开发信",
      updated: "07-02",
      role: "采购总监",
      contact: "Dr. Markus Weber",
      website: "www.solartech-solutions.de",
      location: "慕尼黑，德国",
      size: "51-200 人",
      founded: "2012 年",
      evidence: ["官网项目案例：2024年沙特光伏电站 120MW EPC 总包", "LinkedIn：近期发布在迪拜能源展参与动态", "新闻：公司获得南非光伏项目 EPC 合同"],
      opener: "您好 Dr. Weber，我是 Vinco 的 Lily，我们为中东光伏 EPC 项目提供高效储能与光储解决方案。",
      tags: ["高匹配客户 (A)", "EPC", "德国"]
    },
    {
      id: "greenvolt",
      company: "GreenVolt Energy LLC",
      country: "AE",
      countryName: "阿联酋",
      type: "EPC 承包商",
      source: "展会名录",
      priority: "A",
      score: 88,
      reason: "官网展示 3 个在建 EPC 项目",
      missing: "预算",
      next: "发送开发信",
      updated: "07-02",
      role: "项目采购",
      contact: "Ahmed Khalid",
      website: "www.greenvoltenergy.ae",
      location: "迪拜，阿联酋",
      size: "100-300 人",
      founded: "2016 年",
      evidence: ["展会名录中包含“工商业储能”标签", "官网展示 3 个在建太阳能 EPC 项目", "LinkedIn 最近招聘项目采购经理"],
      opener: "您好 Ahmed，我们注意到 GreenVolt 正在推进多个太阳能项目，想分享一套适合中东工商业场景的储能方案。",
      tags: ["高匹配客户 (A)", "中东", "项目多"]
    },
    {
      id: "sunrise",
      company: "SunRise Power Co.",
      country: "IN",
      countryName: "印度",
      type: "分销商",
      source: "Google",
      priority: "A",
      score: 82,
      reason: "官网展示光伏产品经销业务",
      missing: "决策人",
      next: "补充信息",
      updated: "07-02",
      role: "渠道负责人",
      contact: "待确认",
      website: "www.sunrisepower.in",
      location: "孟买，印度",
      size: "20-80 人",
      founded: "2018 年",
      evidence: ["官网有光伏配件与储能类目", "Google 搜索结果显示其区域分销业务", "未找到明确采购负责人邮箱"],
      opener: "您好，我们看到 SunRise Power 正在经营光伏产品线，想了解贵司是否在寻找户储补充产品。",
      tags: ["高匹配客户 (A)", "需补联系人"]
    },
    {
      id: "brightway",
      company: "BrightWay Solar Ltd.",
      country: "ZA",
      countryName: "南非",
      type: "系统集成商",
      source: "LinkedIn",
      priority: "A",
      score: 86,
      reason: "官网展示储能集成项目",
      missing: "公司规模",
      next: "发送开发信",
      updated: "07-01",
      role: "业务开发负责人",
      contact: "Nandi Mokoena",
      website: "www.brightwaysolar.co.za",
      location: "约翰内斯堡，南非",
      size: "待确认",
      founded: "2014 年",
      evidence: ["LinkedIn 多次发布储能项目交付动态", "官网案例覆盖工商业太阳能系统", "南非公开电力信息记录近期停电情况"],
      opener: "您好 Nandi，我们关注到 BrightWay 在南非工商业太阳能项目上的经验，想分享一套储能配套方案。",
      tags: ["高匹配客户 (A)", "系统集成"]
    },
    {
      id: "mena",
      company: "Mena Solar Contracting",
      country: "SA",
      countryName: "沙特",
      type: "EPC 承包商",
      source: "推荐客户",
      priority: "A",
      score: 91,
      reason: "公开招标包含储能设备",
      missing: "预算",
      next: "安排跟进",
      updated: "07-01",
      role: "采购经理",
      contact: "Faisal N.",
      website: "www.menasolar.sa",
      location: "利雅得，沙特",
      size: "80-150 人",
      founded: "2011 年",
      evidence: ["推荐客户提到其正在寻找储能供应商", "官网展示大型地面电站项目", "招标信息显示近期采购逆变器和电池系统"],
      opener: "您好 Faisal，我们从合作伙伴处了解到贵司近期关注储能供应链，想分享中东项目交付案例。",
      tags: ["高匹配客户 (A)", "推荐"]
    },
    {
      id: "energia",
      company: "Energia FZCO",
      country: "AE",
      countryName: "阿联酋",
      type: "分销商",
      source: "Google",
      priority: "B",
      score: 76,
      reason: "官网销售光伏组件与配件",
      missing: "决策人邮箱",
      next: "补充信息",
      updated: "07-01",
      role: "采购角色待确认",
      contact: "待确认",
      website: "www.energiafzco.ae",
      location: "迪拜，阿联酋",
      size: "20-60 人",
      founded: "2019 年",
      evidence: ["官网展示光伏组件和配件", "官网未展示独立的储能产品页面", "LinkedIn 公司主页存在员工名录入口"],
      opener: "您好，我们看到 Energia 正在经营光伏产品，想了解是否有计划补充户用储能产品线。",
      tags: ["中等匹配客户 (B)", "需补邮箱"]
    },
    {
      id: "ecofuture",
      company: "EcoFuture Ltd.",
      country: "GB",
      countryName: "英国",
      type: "工程公司",
      source: "LinkedIn",
      priority: "B",
      score: 72,
      reason: "官网展示可再生能源项目",
      missing: "项目时间",
      next: "补充信息",
      updated: "06-30",
      role: "项目负责人",
      contact: "Oliver Smith",
      website: "www.ecofuture.co.uk",
      location: "伦敦，英国",
      size: "30-90 人",
      founded: "2015 年",
      evidence: ["LinkedIn 发布绿色建筑和能源项目", "官网未展示储能产品采购信息", "公开页面未披露储能采购计划"],
      opener: "您好 Oliver，我们看到 EcoFuture 参与多个可再生能源项目，想分享一份储能配套案例。",
      tags: ["中等匹配客户 (B)", "项目待确认"]
    },
    {
      id: "solarplus",
      company: "SolarPlus Trading",
      country: "TR",
      countryName: "土耳其",
      type: "贸易商",
      source: "展会名录",
      priority: "B",
      score: 69,
      reason: "官网展示光伏配件经销业务",
      missing: "采购品类",
      next: "发送开发信",
      updated: "06-30",
      role: "销售负责人",
      contact: "Emre Yilmaz",
      website: "www.solarplustr.com",
      location: "伊斯坦布尔，土耳其",
      size: "15-50 人",
      founded: "2020 年",
      evidence: ["展会名录包含光伏配件标签", "官网展示的产品主要为光伏配件", "公开资料未披露储能采购记录"],
      opener: "您好 Emre，我们看到 SolarPlus 经营光伏配件，想了解是否考虑补充储能产品。",
      tags: ["中等匹配客户 (B)", "贸易商"]
    },
    {
      id: "homepower",
      company: "HomePower Systems",
      country: "US",
      countryName: "美国",
      type: "零售商",
      source: "Google",
      priority: "C",
      score: 51,
      reason: "官网主要面向零售终端",
      missing: "业务模式",
      next: "暂不跟进",
      updated: "06-29",
      role: "门店采购",
      contact: "待确认",
      website: "www.homepowersystems.com",
      location: "加州，美国",
      size: "10-30 人",
      founded: "2017 年",
      evidence: ["官网主要展示零售终端产品", "公开页面未展示批量采购或项目交付信息", "官网联系入口为消费者咨询表单"],
      opener: "您好，我们想了解 HomePower 是否有批量采购户储产品计划。",
      tags: ["低匹配客户 (C)", "暂不跟进"]
    },
    {
      id: "global-electrics",
      company: "Global Electrics Inc.",
      country: "CA",
      countryName: "加拿大",
      type: "贸易商",
      source: "LinkedIn",
      priority: "C",
      score: 48,
      reason: "官网主营电工耗材",
      missing: "产品需求",
      next: "暂不跟进",
      updated: "06-29",
      role: "采购待确认",
      contact: "待确认",
      website: "www.globalelectrics.ca",
      location: "多伦多，加拿大",
      size: "20-50 人",
      founded: "2010 年",
      evidence: ["官网主营类目为电工耗材", "官网未展示太阳能或储能类目", "LinkedIn 页面主营描述为电工耗材贸易"],
      opener: "您好，我们想确认贵司是否有太阳能储能类产品规划。",
      tags: ["低匹配客户 (C)", "不优先"]
    },
    {
      id: "sunhouse",
      company: "SunHouse Decor",
      country: "AU",
      countryName: "澳大利亚",
      type: "零售商",
      source: "Google",
      priority: "C",
      score: 44,
      reason: "官网主营家居装饰",
      missing: "业务模式",
      next: "暂不跟进",
      updated: "06-28",
      role: "店铺负责人",
      contact: "待确认",
      website: "www.sunhousedecor.au",
      location: "悉尼，澳大利亚",
      size: "10-20 人",
      founded: "2021 年",
      evidence: ["官网主营类目为家居装饰", "官网未展示能源产品", "公开社媒未展示能源产品信息"],
      opener: "您好，我们想了解贵司是否有太阳能户外产品规划。",
      tags: ["低匹配客户 (C)", "暂不跟进"]
    }
  ],
  cadence: [
    { day: "D1", action: "首封开发信", goal: "确认客户是否愿意看产品资料" },
    { day: "D3", action: "案例跟进", goal: "补同国家或同行业案例，建立信任" },
    { day: "D7", action: "WhatsApp / LinkedIn 轻触达", goal: "换一个渠道确认联系人是否有效" },
    { day: "D14", action: "止损或转入客户Kass", goal: "有回复进 A/B 客户，无回复进入低频激活" }
  ]
};

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
    totalCount: 28,
    desc: "高意向、近期要报价或催单",
    customers: [
      {
        id: "kass-a-1",
        name: "Global Sourcing Inc.",
        shortName: "G",
        stage: "新询盘",
        country: "United States",
        industry: "Alibaba.com 询盘",
        website: "global-sourcing.example",
        contact: "Emily Carter",
        level: "A",
        risk: "中",
        intent: "中高意向",
        product: "500ml 不锈钢保温杯",
        quantity: "50,000 pcs",
        tradeTerm: "FOB Shanghai",
        customization: "Logo printing",
        inquiry: "Hi,\nWe are looking for 50,000 pcs of 500ml 不锈钢保温杯.\nPlease share price for FOB Shanghai, lead time, and MOQ.\nLogo printing needed.\nThanks.",
        summary: "客户询问价格、MOQ 和交期，订单量较大，适合先回复基础报价范围并补问包装、Logo 文件和目标交期。",
        nextAction: "先发澄清回复，再补报价单",
        backgroundProfile: {
          overview: "美国消费品进口与分销商，主营饮具与家居礼赠品，主要面向北美零售市场。",
          companyBackground: "美国消费品进口与分销商",
          mainBusiness: "饮具与家居礼赠品",
          enteredAt: "2026-07-23",
          foundedYear: "2012 年",
          companySize: "51–200 人",
          companyType: "消费品进口与分销商",
          organization: "采购、产品与渠道团队协同决策",
          purchasingRole: "品牌方 / 进口商",
          marketChannels: "北美零售 · Amazon · 独立站",
          contactName: "Emily Carter",
          contactRole: "采购负责人",
          socialMedia: "LinkedIn · 独立站",
          contactEmail: "通过国际站站内信联系",
          whatsapp: "尚未建立 WhatsApp 联系",
          annualRevenue: "约 5,000 万–1 亿美元（公开信息估算）",
          cooperationStage: "首次接洽",
          purchaseCycle: "年度补货型",
          purchasePotential: "较高",
          productPreference: "饮具、家居礼赠品",
          purchasePreference: "多 SKU 组合、稳定交付与定制能力",
          expandableProducts: "旅行杯、便携饮具、礼赠套装",
          paymentTerms: "待补充",
          finalConsignee: "待补充",
          creditStatus: "注册信息已核验；首次合作，付款条件待确认",
          cooperationValue: "具备年度补货与多 SKU 拓展潜力",
          competitors: "北美同类饮具与礼赠品进口商",
          competitiveAdvantage: "交付稳定、定制响应快、多 SKU 组合能力",
          currentSuppliers: "未公开披露",
          sources: ["客户背调顾问", "国际站询盘"],
          updatedAt: "2026-07-23",
          incompleteItems: ["付款条件", "最终收货主体"]
        },
        followupRecords: [
          {
            id: "kass-a-1-followup-20260723",
            date: "2026-07-23",
            dayLabel: "今天",
            time: "10:18",
            owner: "张伟",
            channel: "邮件",
            title: "客户询问价格、MOQ 和交期，并想了解包装与 Logo 细节",
            summary: "客户希望尽快拿到详细报价与打样安排，重点关注价格、MOQ、交期、包装方式与 Logo 印刷效果。",
            tasks: [
              {
                id: "kass-a-1-task-quote",
                title: "补充报价与 MOQ、交期（FOB Shanghai）",
                dueDate: "2026-07-24",
                status: "待处理"
              },
              {
                id: "kass-a-1-task-packaging",
                title: "发送包装方案与 Logo 印刷效果参考",
                dueDate: "2026-07-25",
                status: "待处理"
              }
            ]
          },
          {
            id: "kass-a-1-followup-20260720",
            date: "2026-07-20",
            dayLabel: "",
            time: "15:32",
            owner: "张伟",
            channel: "邮件",
            title: "客户首次询盘：500ml 不锈钢保温杯，要求 Logo printing",
            summary: "客户通过 Alibaba.com 提交询盘，询问产品规格、最小起订量和价格等信息。",
            tasks: []
          }
        ],
        tags: ["新询盘", "中高意向", "大货采购"],
        records: 3,
        recentActivities: 2,
        openTasks: 3
      },
      {
        id: "kass-a-2",
        name: "Nordic Home Supply",
        shortName: "N",
        stage: "已寄样",
        country: "Sweden",
        industry: "Home & Living",
        website: "nordic-home.example",
        contact: "Linnea Berg",
        level: "A",
        risk: "低",
        intent: "高意向",
        product: "竹纤维餐具套装",
        quantity: "8,000 sets",
        tradeTerm: "DDP Stockholm",
        customization: "Retail packaging",
        inquiry: "Sample received. Please confirm the revised packaging artwork and final delivery schedule.",
        summary: "客户已收样并进入包装确认阶段，需要优先锁定包装稿和最终交期。",
        nextAction: "确认包装稿并锁定交期",
        tags: ["已寄样", "高意向", "包装确认"],
        records: 6,
        recentActivities: 4,
        openTasks: 2
      },
      {
        id: "kass-a-3",
        name: "ABC Trading",
        shortName: "A",
        stage: "待报价",
        country: "Germany",
        industry: "B2B Marketplace",
        website: "abc-trading.example",
        contact: "Mia Schneider",
        level: "A",
        risk: "低",
        intent: "中高意向",
        product: "不锈钢厨房用品",
        quantity: "12,000 pcs",
        tradeTerm: "FOB Ningbo",
        customization: "Private label",
        inquiry: "Please prepare an indicative quotation for our private-label kitchenware range.",
        summary: "客户已给出产品方向和自有品牌需求，当前应补齐规格并尽快形成报价范围。",
        nextAction: "确认规格并生成报价草稿",
        tags: ["待报价", "中高意向", "自有品牌"],
        records: 2,
        recentActivities: 3,
        openTasks: 2
      },
      {
        id: "kass-a-4",
        name: "Green Home",
        shortName: "G",
        stage: "已跟进",
        country: "United States",
        industry: "Home & Living",
        website: "green-home.example",
        contact: "Olivia Reed",
        level: "A",
        risk: "中",
        intent: "中意向",
        product: "环保收纳用品",
        quantity: "6,000 sets",
        tradeTerm: "DDP Los Angeles",
        customization: "Recycled packaging",
        inquiry: "We need more details about recycled packaging and delivery to Los Angeles.",
        summary: "客户关注环保包装和到门交付，需先确认包装证明与 DDP 成本。",
        nextAction: "补充环保包装证明与运费",
        tags: ["已跟进", "中意向", "环保包装"],
        records: 4,
        recentActivities: 2,
        openTasks: 1
      },
      {
        id: "kass-a-5",
        name: "Joseph Import",
        shortName: "J",
        stage: "新询盘",
        country: "Canada",
        industry: "Importer",
        website: "joseph-import.example",
        contact: "Joseph Martin",
        level: "A",
        risk: "中",
        intent: "中高意向",
        product: "户外保温壶",
        quantity: "10,000 pcs",
        tradeTerm: "FOB Shanghai",
        customization: "Color box",
        inquiry: "Please quote 10,000 vacuum flasks with custom color boxes.",
        summary: "客户数量明确且有包装定制，适合先确认容量、颜色和交期后快速报价。",
        nextAction: "确认容量颜色并准备报价",
        tags: ["新询盘", "中高意向", "包装定制"],
        records: 1,
        recentActivities: 1,
        openTasks: 3
      },
      {
        id: "kass-a-6",
        name: "Blue Ocean Ltd.",
        shortName: "B",
        stage: "已跟进",
        country: "United Kingdom",
        industry: "Distributor",
        website: "blue-ocean.example",
        contact: "Harry Wilson",
        level: "A",
        risk: "低",
        intent: "中意向",
        product: "旅行杯",
        quantity: "5,000 pcs",
        tradeTerm: "CIF Felixstowe",
        customization: "Gift box",
        inquiry: "Can you provide a CIF price and gift box options for travel mugs?",
        summary: "客户正在比较交付条款和礼盒方案，需要提供两档包装报价。",
        nextAction: "发送两档礼盒与 CIF 报价",
        tags: ["已跟进", "中意向", "礼盒"],
        records: 3,
        recentActivities: 2,
        openTasks: 2
      },
      {
        id: "kass-a-7",
        name: "Prime Choice",
        shortName: "P",
        stage: "待报价",
        country: "Australia",
        industry: "Retail",
        website: "prime-choice.example",
        contact: "Ava Brown",
        level: "A",
        risk: "低",
        intent: "中高意向",
        product: "运动水杯",
        quantity: "15,000 pcs",
        tradeTerm: "FOB Shanghai",
        customization: "Pantone color",
        inquiry: "We need Pantone matched bottles for our new sports range.",
        summary: "客户数量和定制方向清晰，应确认色号、样品成本及量产周期。",
        nextAction: "确认 Pantone 色号并安排样品",
        tags: ["待报价", "中高意向", "颜色定制"],
        records: 2,
        recentActivities: 2,
        openTasks: 2
      },
      {
        id: "kass-a-8",
        name: "Sunrise Trading",
        shortName: "S",
        stage: "已跟进",
        country: "Netherlands",
        industry: "Trading Company",
        website: "sunrise-trading.example",
        contact: "Noah de Vries",
        level: "A",
        risk: "中",
        intent: "中意向",
        product: "咖啡随行杯",
        quantity: "8,500 pcs",
        tradeTerm: "FOB Ningbo",
        customization: "Laser logo",
        inquiry: "Please confirm laser logo cost and the earliest production slot.",
        summary: "客户关注激光 Logo 成本和排产，需要尽快同步工艺加价与可用产能。",
        nextAction: "确认工艺加价与最早排产",
        tags: ["已跟进", "中意向", "激光 Logo"],
        records: 3,
        recentActivities: 2,
        openTasks: 1
      }
    ]
  },
  {
    id: "customer-kass-b",
    label: "B",
    totalCount: 16,
    desc: "这里展示客户 Kass 下 B 的所有客户",
    customers: [
      {
        id: "kass-b-1",
        name: "Brightway Retail GmbH",
        shortName: "B",
        stage: "背景调查",
        country: "Germany",
        industry: "经销商",
        website: "brightway-retail.example",
        contact: "Jonas Weber",
        level: "B",
        risk: "低",
        intent: "中意向",
        product: "户外便携灯",
        quantity: "待确认",
        tradeTerm: "待确认",
        customization: "EU packaging",
        inquiry: "Please send your catalogue and indicative price for portable outdoor lights.",
        summary: "客户仍处于资料收集阶段，应先补齐采购量、目标渠道和认证要求。",
        nextAction: "发送目录并补问采购计划",
        backgroundProfile: {
          overview: "德国户外生活方式零售商，经营露营照明与便携户外用品，主要通过区域门店和电商渠道销售。",
          companyBackground: "德国户外生活方式零售商",
          mainBusiness: "露营照明、便携户外用品",
          enteredAt: "2026-07-22",
          foundedYear: "2017 年",
          companySize: "11–50 人",
          companyType: "零售商 / 区域经销商",
          organization: "采购与商品团队共同评估，负责人确认首单",
          purchasingRole: "区域零售采购方",
          marketChannels: "德国区域门店 · 独立站 · 电商平台",
          contactName: "Jonas Weber",
          contactRole: "品类采购",
          socialMedia: "LinkedIn · Instagram",
          contactEmail: "通过国际站站内信联系",
          whatsapp: "待建立联系",
          annualRevenue: "约 1,000 万–3,000 万欧元（公开信息估算）",
          cooperationStage: "目录评估",
          purchaseCycle: "季度选品型",
          purchasePotential: "中等",
          productPreference: "便携灯、露营照明配件",
          purchasePreference: "CE / RoHS 资料完整、欧洲零售包装、低起订试单",
          expandableProducts: "营地灯、头灯、太阳能户外灯",
          paymentTerms: "待确认",
          finalConsignee: "德国区域仓",
          creditStatus: "企业登记信息可核验；首次合作建议控制账期",
          cooperationValue: "适合从小批量试单切入，验证后可扩充户外照明 SKU",
          competitors: "欧洲本地户外照明品牌与跨境平台供应商",
          competitiveAdvantage: "认证资料齐全、包装响应快、小批量组合供货",
          currentSuppliers: "未公开披露",
          sources: ["客户背调顾问", "国际站询盘"],
          updatedAt: "2026-07-23",
          incompleteItems: ["付款条件", "年度采购计划"]
        },
        followupRecords: [
          {
            id: "kass-b-1-followup-20260723",
            date: "2026-07-23",
            dayLabel: "今天",
            time: "11:06",
            owner: "张伟",
            channel: "国际站",
            title: "客户索要便携户外灯目录与参考价",
            summary: "客户希望先筛选适合德国零售渠道的款式，并确认 CE / RoHS、欧洲包装和可接受的试单数量。",
            tasks: [
              {
                id: "kass-b-1-task-catalogue",
                title: "发送户外灯目录与三款建议型号",
                dueDate: "2026-07-24",
                status: "待处理"
              },
              {
                id: "kass-b-1-task-plan",
                title: "补问目标渠道、首单数量与认证要求",
                dueDate: "2026-07-25",
                status: "待处理"
              }
            ]
          },
          {
            id: "kass-b-1-followup-20260722",
            date: "2026-07-22",
            dayLabel: "昨天",
            time: "16:40",
            owner: "张伟",
            channel: "背调导入",
            title: "完成基础背调并判断为 B 级培育客户",
            summary: "公司主体与销售渠道可核验，目前采购数量和年度计划仍不明确。",
            tasks: []
          }
        ],
        tags: ["背景调查", "中意向", "待补采购量"],
        records: 2,
        recentActivities: 2,
        openTasks: 2
      },
      {
        id: "kass-b-2",
        name: "Mondo Living S.r.l.",
        shortName: "M",
        stage: "已跟进",
        country: "Italy",
        industry: "家居零售",
        website: "mondo-living.example",
        contact: "Giulia Romano",
        level: "B",
        risk: "低",
        intent: "中意向",
        product: "玻璃储物罐",
        quantity: "3,000 sets",
        tradeTerm: "FOB Ningbo",
        customization: "Color sleeve",
        inquiry: "We are reviewing glass storage jar sets for our autumn home collection.",
        summary: "客户处于秋季选品阶段，数量中等，适合用组合款和包装方案推进。",
        nextAction: "发送组合款与彩袖包装方案",
        tags: ["已跟进", "中意向", "秋季选品"],
        records: 3,
        recentActivities: 2,
        openTasks: 1
      },
      {
        id: "kass-b-3",
        name: "Atlas Trade House",
        shortName: "A",
        stage: "新询盘",
        country: "United Arab Emirates",
        industry: "综合贸易",
        website: "atlas-trade.example",
        contact: "Omar Hassan",
        level: "B",
        risk: "中",
        intent: "中意向",
        product: "酒店用托盘",
        quantity: "待确认",
        tradeTerm: "CIF Jebel Ali",
        customization: "Hotel logo",
        inquiry: "Please share hotel tray options and your MOQ for private logo.",
        summary: "客户已给出应用场景，但数量和项目时间尚未明确，需要先做资格判断。",
        nextAction: "补问酒店项目与数量",
        tags: ["新询盘", "中意向", "酒店项目"],
        records: 1,
        recentActivities: 1,
        openTasks: 2
      },
      {
        id: "kass-b-4",
        name: "Oak & Pine Market",
        shortName: "O",
        stage: "待报价",
        country: "United Kingdom",
        industry: "生活方式零售",
        website: "oak-pine.example",
        contact: "Sophie Clark",
        level: "B",
        risk: "低",
        intent: "中意向",
        product: "木质厨房配件",
        quantity: "2,500 sets",
        tradeTerm: "FOB Shanghai",
        customization: "FSC packaging",
        inquiry: "Could you quote 2,500 kitchen accessory sets with FSC packaging?",
        summary: "需求较清晰但规模有限，可用标准款加环保包装形成快速报价。",
        nextAction: "确认 FSC 包装成本并报价",
        tags: ["待报价", "中意向", "环保包装"],
        records: 2,
        recentActivities: 2,
        openTasks: 1
      },
      {
        id: "kass-b-5",
        name: "Northstar Outdoor",
        shortName: "N",
        stage: "已寄资料",
        country: "Canada",
        industry: "户外用品",
        website: "northstar-outdoor.example",
        contact: "Ethan Brooks",
        level: "B",
        risk: "中",
        intent: "中意向",
        product: "折叠露营桌",
        quantity: "1,800 pcs",
        tradeTerm: "CIF Vancouver",
        customization: "Retail carton",
        inquiry: "We need compact folding tables for next spring and are collecting supplier information.",
        summary: "客户为下一季做供应商储备，当前重点是建立资料完整度和后续提醒。",
        nextAction: "补齐承重测试并设置季前提醒",
        tags: ["已寄资料", "中意向", "季节采购"],
        records: 2,
        recentActivities: 1,
        openTasks: 2
      },
      {
        id: "kass-b-6",
        name: "Casa Nova Import",
        shortName: "C",
        stage: "背景调查",
        country: "Spain",
        industry: "家居进口",
        website: "casa-nova.example",
        contact: "Lucía Martín",
        level: "B",
        risk: "中",
        intent: "中意向",
        product: "浴室收纳套装",
        quantity: "待确认",
        tradeTerm: "待确认",
        customization: "Spanish packaging",
        inquiry: "We are looking for new bathroom organizers. Please introduce your main ranges.",
        summary: "客户刚开始了解产品线，需通过目录选择和渠道问题判断真实采购计划。",
        nextAction: "发送目录并确认销售渠道",
        tags: ["背景调查", "中意向", "目录筛选"],
        records: 1,
        recentActivities: 1,
        openTasks: 1
      },
      {
        id: "kass-b-7",
        name: "Riverside Concepts",
        shortName: "R",
        stage: "已跟进",
        country: "United States",
        industry: "礼赠品",
        level: "B",
        risk: "低",
        intent: "中意向",
        product: "商务礼赠杯",
        quantity: "4,000 pcs",
        tradeTerm: "FOB Shanghai",
        customization: "Laser logo",
        inquiry: "We are reviewing corporate drinkware for year-end gifts.",
        summary: "客户有明确礼赠场景，仍需确认预算与交付节点。",
        nextAction: "补问预算并发送礼赠案例",
        tags: ["已跟进", "中意向", "礼赠项目"],
        records: 2,
        recentActivities: 1,
        openTasks: 1
      },
      {
        id: "kass-b-8",
        name: "Sol y Mar Distribución",
        shortName: "S",
        stage: "新询盘",
        country: "Mexico",
        industry: "区域分销",
        level: "B",
        risk: "中",
        intent: "中意向",
        product: "户外饮具",
        quantity: "待确认",
        tradeTerm: "CIF Manzanillo",
        customization: "Spanish packaging",
        inquiry: "Please introduce outdoor drinkware suitable for distribution in Mexico.",
        summary: "客户方向明确但缺少数量，应先通过渠道与认证问题判断潜力。",
        nextAction: "确认分销区域与首单数量",
        tags: ["新询盘", "中意向", "区域分销"],
        records: 1,
        recentActivities: 1,
        openTasks: 2
      },
      {
        id: "kass-b-9",
        name: "Urban Nest Co.",
        shortName: "U",
        stage: "待报价",
        country: "Australia",
        industry: "家居电商",
        level: "B",
        risk: "低",
        intent: "中意向",
        product: "厨房收纳",
        quantity: "2,000 sets",
        tradeTerm: "FOB Ningbo",
        customization: "Private label",
        inquiry: "Could you provide a starter quotation for private-label kitchen organizers?",
        summary: "客户计划小批量试单，可用标准款和低门槛定制推进。",
        nextAction: "提供三款试单组合报价",
        tags: ["待报价", "中意向", "小单测试"],
        records: 2,
        recentActivities: 2,
        openTasks: 1
      },
      {
        id: "kass-b-10",
        name: "Hanseatic Supply",
        shortName: "H",
        stage: "背景调查",
        country: "Germany",
        industry: "B2B 供应",
        level: "B",
        risk: "中",
        intent: "中意向",
        product: "仓储周转用品",
        quantity: "待确认",
        tradeTerm: "待确认",
        customization: "待确认",
        inquiry: "We are adding new warehouse utility products and would like your catalogue.",
        summary: "客户尚处于供应商搜集期，需要补齐主营渠道和采购周期。",
        nextAction: "完成主体核验并补问采购周期",
        tags: ["背景调查", "中意向", "供应商搜集"],
        records: 1,
        recentActivities: 1,
        openTasks: 1
      },
      {
        id: "kass-b-11",
        name: "Maison Verde",
        shortName: "M",
        stage: "资料已发",
        country: "France",
        industry: "环保家居",
        level: "B",
        risk: "低",
        intent: "中意向",
        product: "可持续餐厨用品",
        quantity: "待确认",
        tradeTerm: "FOB Shanghai",
        customization: "FSC packaging",
        inquiry: "Thank you for the sustainable kitchenware catalogue. We are reviewing it.",
        summary: "客户关注可持续材料，适合用认证资料和环保包装案例继续培育。",
        nextAction: "补发材料认证与包装案例",
        tags: ["资料已发", "中意向", "可持续材料"],
        records: 2,
        recentActivities: 1,
        openTasks: 1
      },
      {
        id: "kass-b-12",
        name: "Baltic Choice",
        shortName: "B",
        stage: "已跟进",
        country: "Poland",
        industry: "连锁零售",
        level: "B",
        risk: "中",
        intent: "中意向",
        product: "季节性家居用品",
        quantity: "3,500 sets",
        tradeTerm: "FOB Ningbo",
        customization: "Retail display",
        inquiry: "We are considering seasonal household items for selected stores.",
        summary: "客户为部分门店选品，需确认试点门店数量与陈列要求。",
        nextAction: "补问试点门店与陈列尺寸",
        tags: ["已跟进", "中意向", "门店试点"],
        records: 2,
        recentActivities: 1,
        openTasks: 2
      },
      {
        id: "kass-b-13",
        name: "Noble Hospitality",
        shortName: "N",
        stage: "新询盘",
        country: "Saudi Arabia",
        industry: "酒店采购",
        level: "B",
        risk: "中",
        intent: "中意向",
        product: "客房用品",
        quantity: "待确认",
        tradeTerm: "CIF Jeddah",
        customization: "Hotel branding",
        inquiry: "Please share guest-room amenity options for a hospitality project.",
        summary: "项目场景清晰但决策链未知，应先确认酒店数量和项目时间。",
        nextAction: "确认项目规模与决策人",
        tags: ["新询盘", "中意向", "酒店项目"],
        records: 1,
        recentActivities: 1,
        openTasks: 2
      },
      {
        id: "kass-b-14",
        name: "Maple Lane Wholesale",
        shortName: "M",
        stage: "待报价",
        country: "Canada",
        industry: "批发",
        level: "B",
        risk: "低",
        intent: "中意向",
        product: "冬季保温用品",
        quantity: "5,000 pcs",
        tradeTerm: "CIF Vancouver",
        customization: "Bilingual packaging",
        inquiry: "Please quote insulated products with English and French retail packaging.",
        summary: "数量明确且有双语包装需求，可在确认法规标识后推进报价。",
        nextAction: "确认双语包装内容并报价",
        tags: ["待报价", "中意向", "双语包装"],
        records: 2,
        recentActivities: 2,
        openTasks: 1
      },
      {
        id: "kass-b-15",
        name: "Eastbridge Commerce",
        shortName: "E",
        stage: "已寄资料",
        country: "Singapore",
        industry: "跨境电商",
        level: "B",
        risk: "中",
        intent: "中意向",
        product: "小型家居用品",
        quantity: "待确认",
        tradeTerm: "FOB Shenzhen",
        customization: "E-commerce carton",
        inquiry: "We are evaluating compact home products for Southeast Asian marketplaces.",
        summary: "客户关注跨境电商尺寸和包装，需要用平台适配数据继续推进。",
        nextAction: "发送平台热销款与包装尺寸",
        tags: ["已寄资料", "中意向", "跨境电商"],
        records: 2,
        recentActivities: 1,
        openTasks: 1
      },
      {
        id: "kass-b-16",
        name: "Vega Home Partners",
        shortName: "V",
        stage: "背景调查",
        country: "Netherlands",
        industry: "家居分销",
        level: "B",
        risk: "低",
        intent: "中意向",
        product: "桌面收纳",
        quantity: "待确认",
        tradeTerm: "待确认",
        customization: "EU packaging",
        inquiry: "We would like to learn more about your desktop organization range.",
        summary: "客户正在收集供应商资料，可用欧洲合规与组合供货能力建立差异。",
        nextAction: "发送欧盟合规资料与组合目录",
        tags: ["背景调查", "中意向", "组合供货"],
        records: 1,
        recentActivities: 1,
        openTasks: 1
      }
    ]
  },
  {
    id: "customer-kass-c",
    label: "C",
    totalCount: 43,
    desc: "低频维护、等待明确采购计划",
    customers: [
      {
        id: "kass-c-1",
        name: "Harborline Merchants",
        shortName: "H",
        stage: "待唤醒",
        country: "New Zealand",
        industry: "综合进口",
        website: "harborline.example",
        contact: "Mason Taylor",
        level: "C",
        risk: "中",
        intent: "低意向",
        product: "家居日用品",
        quantity: "待确认",
        tradeTerm: "待确认",
        customization: "待确认",
        inquiry: "Please keep us updated when you have new home-living collections.",
        summary: "客户暂无明确采购计划，适合按新品节奏轻量维护。",
        nextAction: "下次新品发布时触达",
        tags: ["待唤醒", "低意向", "新品维护"],
        records: 2,
        recentActivities: 0,
        openTasks: 1
      },
      {
        id: "kass-c-2",
        name: "Lumière Maison",
        shortName: "L",
        stage: "长期培育",
        country: "France",
        industry: "家居买手店",
        website: "lumiere-maison.example",
        contact: "Camille Dubois",
        level: "C",
        risk: "低",
        intent: "低意向",
        product: "桌面装饰",
        quantity: "待确认",
        tradeTerm: "待确认",
        customization: "待确认",
        inquiry: "We may revisit the collection after our winter buying season.",
        summary: "采购窗口尚未到，当前只需保留偏好并按周期提醒。",
        nextAction: "冬季选品前一个月提醒",
        tags: ["长期培育", "低意向", "采购周期"],
        records: 1,
        recentActivities: 0,
        openTasks: 1
      },
      {
        id: "kass-c-3",
        name: "Pacific Value Stores",
        shortName: "P",
        stage: "资料已发",
        country: "Chile",
        industry: "折扣零售",
        website: "pacific-value.example",
        contact: "Martín Rojas",
        level: "C",
        risk: "中",
        intent: "低意向",
        product: "促销礼品",
        quantity: "待确认",
        tradeTerm: "CIF San Antonio",
        customization: "待确认",
        inquiry: "Thank you for the catalogue. We will contact you if a suitable promotion comes up.",
        summary: "客户暂未形成项目，应保留活动节点并减少高频打扰。",
        nextAction: "季度活动前发送精选清单",
        tags: ["资料已发", "低意向", "活动采购"],
        records: 1,
        recentActivities: 0,
        openTasks: 0
      }
    ]
  },
  {
    id: "customer-kass-d",
    label: "D",
    totalCount: 9,
    desc: "暂缓投入、保留基础资料",
    customers: [
      {
        id: "kass-d-1",
        name: "Everwell General Trading",
        shortName: "E",
        stage: "暂缓跟进",
        country: "South Africa",
        industry: "综合贸易",
        website: "everwell-trading.example",
        contact: "Thabo Nkosi",
        level: "D",
        risk: "高",
        intent: "低意向",
        product: "待确认",
        quantity: "待确认",
        tradeTerm: "待确认",
        customization: "待确认",
        inquiry: "Please send all products and your lowest prices.",
        summary: "需求过于宽泛且缺少公司与采购信息，暂不投入高频跟进。",
        nextAction: "等待客户补充明确需求",
        tags: ["暂缓跟进", "低意向", "信息不足"],
        records: 1,
        recentActivities: 0,
        openTasks: 0
      },
      {
        id: "kass-d-2",
        name: "Quick Deal Network",
        shortName: "Q",
        stage: "待核验",
        country: "United States",
        industry: "线上贸易",
        website: "quick-deal.example",
        contact: "Alex Morgan",
        level: "D",
        risk: "高",
        intent: "低意向",
        product: "待确认",
        quantity: "待确认",
        tradeTerm: "待确认",
        customization: "待确认",
        inquiry: "Need best price urgently. Contact me outside the platform.",
        summary: "主体与采购用途尚未核验，建议留在平台内沟通并控制信息披露。",
        nextAction: "核验主体后再决定是否推进",
        tags: ["待核验", "低意向", "风险提醒"],
        records: 1,
        recentActivities: 0,
        openTasks: 0
      }
    ]
  }
];

/**
 * 为尚未手工编写完整背调的客户生成结构一致的原型档案。
 *
 * 作用：
 * - A、B 两套页面共用同一批客户；这里保证用户切换任意等级、任意客户时，
 *   右侧“资料状态、稳定背景、完整档案”都拥有同样完整的字段结构。
 * - 已经手工整理过的客户档案不会被覆盖；函数只补齐其他本地样例。
 *
 * 为什么集中生成：
 * - 这些客户名称和官网均为原型样例，不能伪装成真实线上背调结果。
 * - 用客户现有国家、行业、产品、阶段等样例字段组合展示数据，既能完整验收 UI，
 *   又能明确标注“未接入真实征信/未公开”，避免虚构真实客户事实。
 *
 * @param {typeof window.KASS_GROUPS[number]["customers"][number]} customer - 当前原型客户。
 * @param {typeof window.KASS_GROUPS[number]} group - 客户所属 A/B/C/D 等级。
 * @param {number} customerIndex - 客户在当前等级中的顺序，用于稳定选择样例规模和周期。
 * @returns {object} 与客户详细档案抽屉完全一致的结构化背调字段。
 * @throws {Error} 本函数不主动抛异常。
 */
function createKassPrototypeBackgroundProfile(customer, group, customerIndex) {
  const companySizes = ["11–50 人", "51–200 人", "201–500 人"];
  const purchaseCycles = ["季度选品型", "项目采购型", "年度补货型"];
  const enteredDay = String(Math.max(10, 23 - (customerIndex % 10))).padStart(2, "0");
  const marketChannels = `${customer.country}本地渠道 · 独立站 · B2B 采购`;
  const procurementPotential = `${group.label} 级 · ${customer.intent || "待评估"}`;
  const contactName = customer.contact || "采购团队";

  return {
    overview: `${customer.country}${customer.industry || "采购"}客户，当前关注${customer.product || "待确认产品"}；本页为 CRM Agent 联调使用的完整原型档案，不代表真实线上背调结论。`,
    companyBackground: `${customer.country}${customer.industry || "采购"}企业（原型样例）`,
    mainBusiness: customer.industry || `${customer.product || "相关产品"}采购与销售`,
    enteredAt: `2026-07-${enteredDay}`,
    foundedYear: `${2011 + (customerIndex % 10)} 年`,
    companySize: companySizes[customerIndex % companySizes.length],
    companyType: customer.industry || "进口商 / 经销商",
    organization: group.label === "A"
      ? "采购负责人初筛 → 产品与合规评估 → 管理层确认"
      : "品类采购初筛 → 商品团队评估 → 负责人确认",
    purchasingRole: group.label === "A" ? "重点采购方 / 进口商" : `${customer.industry || "品类"}采购方`,
    marketChannels,
    contactName,
    contactRole: group.label === "A" ? "采购负责人" : "品类采购 / 项目联系人",
    socialMedia: "LinkedIn · 公司官网",
    contactEmail: "通过国际站站内信或官网联系",
    whatsapp: "尚未建立 WhatsApp 联系",
    annualRevenue: "样例资料未披露；正式版由背调或业务员补充",
    cooperationStage: customer.stage || "初次接洽",
    purchaseCycle: purchaseCycles[customerIndex % purchaseCycles.length],
    purchasePotential: procurementPotential,
    productPreference: customer.product || "待确认产品",
    purchasePreference: `${customer.customization || "常规包装"} · ${customer.tradeTerm || "贸易条款待确认"} · 重视交期与资料完整度`,
    expandableProducts: `${customer.product || "当前品类"}配套款、包装升级与组合 SKU`,
    paymentTerms: "首次合作付款条件尚未约定，需在正式报价前确认",
    finalConsignee: customer.tradeTerm && customer.tradeTerm !== "待确认"
      ? `按 ${customer.tradeTerm} 条款确认最终收货主体`
      : "最终收货主体尚未确认",
    creditStatus: "原型样例未接入真实企业征信；正式写入前必须重新核验",
    cooperationValue: `${customer.intent || `${group.label}级意向`}，可围绕${customer.product || "当前需求"}继续验证采购计划与复购空间`,
    competitors: `${customer.country}本地同类供应商、国际 B2B 平台供应商`,
    competitiveAdvantage: "资料响应快、定制沟通清楚、可按采购量提供分档方案",
    currentSuppliers: "样例资料未披露，建议在下一次沟通中确认",
    sources: ["原型客户档案", "询盘样例"],
    updatedAt: "2026-07-24",
    incompleteItems: ["真实征信", "付款条件", "最终收货主体"]
  };
}

/**
 * 为没有历史记录的原型客户生成两条完整跟进记录。
 *
 * 参数与返回值保持和真实 KASS 跟进接口一致的阅读口径：记录说明已经发生的沟通，
 * 待办则只描述尚未完成的下一步，不能把 Agent 建议伪装成历史事实。
 *
 * @param {typeof window.KASS_GROUPS[number]["customers"][number]} customer - 当前原型客户。
 * @param {number} customerIndex - 客户在等级中的稳定顺序。
 * @returns {Array<object>} 两条跟进记录，每条可包含由该记录产生的待办。
 * @throws {Error} 本函数不主动抛异常。
 */
function createKassPrototypeFollowups(customer, customerIndex) {
  const currentDay = String(Math.max(10, 23 - (customerIndex % 8))).padStart(2, "0");
  const previousDay = String(Math.max(8, Number(currentDay) - 2)).padStart(2, "0");
  const currentDate = `2026-07-${currentDay}`;
  const previousDate = `2026-07-${previousDay}`;
  const quantity = customer.quantity || "采购量待确认";
  const nextAction = customer.nextAction || "补齐采购条件并约定下一次沟通";

  return [
    {
      id: `${customer.id}-followup-${currentDate.replaceAll("-", "")}`,
      date: currentDate,
      dayLabel: customerIndex < 2 ? "最近" : "",
      time: `${String(9 + (customerIndex % 7)).padStart(2, "0")}:${customerIndex % 2 ? "35" : "20"}`,
      owner: "张伟",
      channel: customerIndex % 2 ? "国际站" : "邮件",
      title: `${customer.stage || "客户沟通"}：确认${customer.product || "产品方向"}与采购条件`,
      summary: `客户围绕${customer.product || "目标产品"}继续沟通，当前数量为${quantity}，贸易条款为${customer.tradeTerm || "待确认"}，定制要求为${customer.customization || "待确认"}。`,
      tasks: [
        {
          id: `${customer.id}-task-next`,
          title: nextAction,
          dueDate: "2026-07-25",
          status: "待处理"
        },
        {
          id: `${customer.id}-task-proof`,
          title: `准备${customer.product || "对应产品"}的资料、案例与交付说明`,
          dueDate: "2026-07-26",
          status: "待处理"
        }
      ]
    },
    {
      id: `${customer.id}-followup-${previousDate.replaceAll("-", "")}`,
      date: previousDate,
      dayLabel: "",
      time: `${String(14 + (customerIndex % 3)).padStart(2, "0")}:10`,
      owner: "张伟",
      channel: "询盘导入",
      title: `录入客户询盘并标记为 ${customer.level || "待定"} 级`,
      summary: customer.summary || `已录入客户需求并完成初步分级，后续需核验采购计划与关键联系人。`,
      tasks: []
    }
  ];
}

/*
 * 只补齐缺失数据，不覆盖已经手工整理的 Global Sourcing 和 Brightway 档案。
 * 这样既保留高质量样例，也保证 A/B 两套界面切换任意客户时右栏不会出现空卡片。
 */
window.KASS_GROUPS = window.KASS_GROUPS.map((group) => ({
  ...group,
  customers: group.customers.map((customer, customerIndex) => ({
    ...customer,
    backgroundProfile: customer.backgroundProfile
      || createKassPrototypeBackgroundProfile(customer, group, customerIndex),
    followupRecords: Array.isArray(customer.followupRecords) && customer.followupRecords.length
      ? customer.followupRecords
      : createKassPrototypeFollowups(customer, customerIndex)
  }))
}));

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
  { id: "admin-business", label: "经营分析", icon: "◈", parent: "用户" },
  { id: "admin-user", label: "用户总表", icon: "♟", parent: "用户" },
  { id: "admin-user-pool", label: "公海客户", icon: "♟", parent: "用户" },
  { id: "admin-paid-pool", label: "付费公海", icon: "♟", parent: "用户" },
  { id: "admin-user-sales", label: "销售信息", icon: "♟", parent: "用户" },
  { id: "admin-user-active", label: "活跃用户", icon: "♟", parent: "用户" },
  { id: "admin-user-paid", label: "付费用户", icon: "♟", parent: "用户" },
  { id: "admin-agent", label: "代理总览", icon: "♟", parent: "代理" },
  { id: "admin-knowledge", label: "知识库管理", icon: "☰", parent: "系统管理" },
  { id: "admin-invite", label: "邀请码管理", icon: "◇", parent: "用户" },
  { id: "admin-character", label: "AI人设管理", icon: "♣", parent: "系统管理" },
  { id: "admin-model", label: "AI模型管理", icon: "♟", parent: "系统管理" },
  { id: "admin-ai-cost", label: "AI成本监控", icon: "¥", parent: "系统管理" }
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
 * @type {Array<{ rank: number, feature: string, calls: string, users: string, avgUse: string, avgDuration: string, modelSplit: string, valueSignal: string, token: string, tokenShare: string, cost: string }>}
 */
window.ADMIN_USER_PREVIEW_FUNCTION_SUMMARY = [
  { rank: 1, feature: "问一下", calls: "1,268", users: "342", avgUse: "3.7 次", avgDuration: "4分12秒", modelSplit: "标准 68% / Plus 32%", valueSignal: "刚需", token: "918K", tokenShare: "28%", cost: "¥86" },
  { rank: 2, feature: "客户背调顾问", calls: "936", users: "188", avgUse: "5.0 次", avgDuration: "7分40秒", modelSplit: "Plus 62% / 标准 38%", valueSignal: "刚需", token: "1,108K", tokenShare: "34%", cost: "¥142" },
  { rank: 3, feature: "询盘分析回复", calls: "642", users: "156", avgUse: "4.1 次", avgDuration: "6分18秒", modelSplit: "标准 72% / Plus 28%", valueSignal: "刚需", token: "672K", tokenShare: "20%", cost: "¥61" },
  { rank: 4, feature: "市场调研", calls: "420", users: "96", avgUse: "4.4 次", avgDuration: "8分05秒", modelSplit: "Flash 40% / 标准 60%", valueSignal: "需优化", token: "498K", tokenShare: "15%", cost: "¥49" },
  { rank: 5, feature: "新客开发信", calls: "386", users: "121", avgUse: "3.2 次", avgDuration: "3分56秒", modelSplit: "标准 81% / Plus 19%", valueSignal: "刚需", token: "286K", tokenShare: "9%", cost: "¥24" },
  { rank: 6, feature: "场景谈判顾问", calls: "304", users: "87", avgUse: "3.5 次", avgDuration: "6分44秒", modelSplit: "Plus 51% / 标准 49%", valueSignal: "需优化", token: "318K", tokenShare: "10%", cost: "¥31" },
  { rank: 7, feature: "客户Kass", calls: "218", users: "73", avgUse: "3.0 次", avgDuration: "5分20秒", modelSplit: "标准 64% / Plus 36%", valueSignal: "观察", token: "226K", tokenShare: "7%", cost: "¥22" },
  { rank: 8, feature: "案例知识库搜索", calls: "186", users: "64", avgUse: "2.9 次", avgDuration: "2分48秒", modelSplit: "标准 90% / Flash 10%", valueSignal: "鸡肋", token: "142K", tokenShare: "4%", cost: "¥13" },
  { rank: 9, feature: "产品&市场", calls: "164", users: "52", avgUse: "3.2 次", avgDuration: "4分36秒", modelSplit: "标准 70% / Plus 30%", valueSignal: "观察", token: "126K", tokenShare: "4%", cost: "¥12" },
  { rank: 10, feature: "报价邮件", calls: "132", users: "48", avgUse: "2.8 次", avgDuration: "3分12秒", modelSplit: "标准 86% / Plus 14%", valueSignal: "需优化", token: "96K", tokenShare: "3%", cost: "¥9" }
];

/**
 * User Preview 可选报表字段。
 *
 * @type {Array<{ id: string, label: string, group: string }>}
 */
window.ADMIN_USER_PREVIEW_FIELDS = [
  { id: "logIndex", label: "序号", group: "流水账" },
  { id: "usedAt", label: "使用时间", group: "流水账" },
  { id: "userContact", label: "手机号", group: "流水账" },
  { id: "lastActiveAt", label: "最后活跃时间", group: "流水账" },
  { id: "activeDays", label: "活跃天数", group: "流水账" },
  { id: "calledFeature", label: "调用功能", group: "流水账" },
  { id: "calledModel", label: "调用模型", group: "流水账" },
  { id: "callCount", label: "使用次数", group: "流水账" },
  { id: "inputToken", label: "输入消耗 Token", group: "流水账" },
  { id: "outputToken", label: "输出消耗 Token", group: "流水账" },
  { id: "totalToken", label: "消耗总计", group: "流水账" },
  { id: "creditBalance", label: "剩余积分", group: "流水账" },
  { id: "runStatus", label: "成状态（成功/失败）", group: "流水账" },
  { id: "estimatedCost", label: "成本（估算）", group: "流水账" },
  { id: "operationLog", label: "操作", group: "流水账" },
  { id: "trialDetails", label: "使用详情", group: "流水账" },
  { id: "userId", label: "用户ID", group: "基础" },
  { id: "username", label: "用户", group: "基础" },
  { id: "registeredAt", label: "注册时间", group: "基础" },
  { id: "registerSource", label: "注册来源", group: "用户来源" },
  { id: "channelName", label: "渠道名称", group: "用户来源" },
  { id: "channelSourceId", label: "渠道来源标识", group: "用户来源" },
  { id: "inviteRegisterAccount", label: "邀请注册账号", group: "用户来源" },
  { id: "inviteRechargeAccount", label: "邀请充值账号", group: "用户来源" },
  { id: "inviteCode", label: "邀请码", group: "用户来源" },
  { id: "salesOwner", label: "所属销售", group: "用户来源" },
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
  { id: "rechargeDate", label: "充值日期", group: "充值" },
  { id: "expiryDate", label: "到期日期", group: "充值" },
  { id: "rechargePlan", label: "充值套餐", group: "充值" },
  { id: "rechargeAmount", label: "充值金额", group: "充值" },
  { id: "renewalCountdown", label: "续费倒计时", group: "充值" },
  { id: "rechargeRecord", label: "充值记录", group: "充值" },
  { id: "creditUsed", label: "已用积分", group: "积分" },
  { id: "upgradeClickCount", label: "升级点击次数", group: "转化" },
  { id: "payPageViewCount", label: "支付页访问次数", group: "转化" },
  { id: "redeemedInviteAt", label: "邀请码兑换时间", group: "转化" },
  { id: "accountStatus", label: "用户状态", group: "用户状态" },
  { id: "accountActions", label: "账户操作", group: "账户操作" }
];

/**
 * User Preview 用户字段报表数据。
 *
 * @type {Array<Record<string, string>>}
 */
window.ADMIN_USER_PREVIEW_USERS = [
  { logIndex: "1", usedAt: "2026/06/13 10:05", userContact: "180****9154", lastActiveAt: "2026/06/13 15:42", activeDays: "6", calledFeature: "问一下", calledModel: "标准", callCount: "200", inputToken: "200", outputToken: "500", totalToken: "700", runStatus: "成功", estimatedCost: "¥0.01", operationLog: "查看所有记录", userId: "U-10001", username: "180****9154", registeredAt: "2026/06/08 01:27", registerSource: "销售邀请", inviteCode: "YD-TRY-M4Q9", salesOwner: "销售B", lastLoginAt: "2026/06/13 15:38", lastUsedAt: "2026/06/13 15:42", firstFeature: "问一下", topFeature: "客户背调顾问", lastFeature: "客户背调顾问", usageCount: "36", sessionCount: "18", messageCount: "146", avgRounds: "8.2", uploadCount: "5", exportCount: "3", tokenUsed: "218K", modelSplit: "Plus 62% / 标准 38%", amount: "¥99", paymentCount: "1", lastPaidAt: "2026/06/12 10:20", paidStatus: "专业版", creditBalance: "9,480", creditUsed: "520", upgradeClickCount: "3", payPageViewCount: "2", redeemedInviteAt: "2026/06/13 11:08" },
  { logIndex: "2", usedAt: "2026/06/13 10:05", userContact: "137****3499", lastActiveAt: "2026/06/13 14:18", activeDays: "1", calledFeature: "询盘分析回复", calledModel: "标准", callCount: "1,500", inputToken: "1,500", outputToken: "2,000", totalToken: "3,500", runStatus: "成功", estimatedCost: "¥0.07", operationLog: "查看所有记录", userId: "U-10002", username: "137****3499", registeredAt: "2026/06/13 09:53", registerSource: "自然注册", inviteCode: "-", salesOwner: "-", lastLoginAt: "2026/06/13 14:16", lastUsedAt: "2026/06/13 14:18", firstFeature: "问一下", topFeature: "问一下", lastFeature: "问一下", usageCount: "13", sessionCount: "5", messageCount: "38", avgRounds: "4.1", uploadCount: "0", exportCount: "0", tokenUsed: "42K", modelSplit: "标准 100%", amount: "¥0", paymentCount: "0", lastPaidAt: "-", paidStatus: "免费版", creditBalance: "0", creditUsed: "86", upgradeClickCount: "1", payPageViewCount: "0", redeemedInviteAt: "-" },
  { logIndex: "3", usedAt: "2026/06/13 10:12", userContact: "136****9392", lastActiveAt: "2026/06/13 13:06", activeDays: "1", calledFeature: "询盘分析回复", calledModel: "标准", callCount: "2", inputToken: "2,400", outputToken: "3,400", totalToken: "5,800", runStatus: "成功", estimatedCost: "¥0.11", operationLog: "查看所有记录", userId: "U-10003", username: "136****9392", registeredAt: "2026/06/13 09:51", registerSource: "销售邀请", inviteCode: "YD-TRY-8K2P", salesOwner: "销售A", lastLoginAt: "2026/06/13 13:02", lastUsedAt: "2026/06/13 13:06", firstFeature: "询盘分析回复", topFeature: "询盘分析回复", lastFeature: "询盘分析回复", usageCount: "2", sessionCount: "1", messageCount: "7", avgRounds: "3.5", uploadCount: "1", exportCount: "0", tokenUsed: "5.8K", modelSplit: "标准 100%", amount: "¥0", paymentCount: "0", lastPaidAt: "-", paidStatus: "免费版", creditBalance: "300", creditUsed: "20", upgradeClickCount: "0", payPageViewCount: "0", redeemedInviteAt: "2026/06/13 12:58" },
  { logIndex: "4", usedAt: "2026/06/13 10:18", userContact: "158****8358", lastActiveAt: "2026/06/13 10:12", activeDays: "1", calledFeature: "新客开发信", calledModel: "标准", callCount: "1", inputToken: "520", outputToken: "680", totalToken: "1,200", runStatus: "成功", estimatedCost: "¥0.02", operationLog: "查看所有记录", userId: "U-10004", username: "158****8358", registeredAt: "2026/06/13 10:02", registerSource: "展会二维码", inviteCode: "-", salesOwner: "销售A", lastLoginAt: "2026/06/13 10:10", lastUsedAt: "2026/06/13 10:12", firstFeature: "新客开发信", topFeature: "新客开发信", lastFeature: "新客开发信", usageCount: "1", sessionCount: "1", messageCount: "2", avgRounds: "1.0", uploadCount: "0", exportCount: "0", tokenUsed: "1.2K", modelSplit: "标准 100%", amount: "¥0", paymentCount: "0", lastPaidAt: "-", paidStatus: "免费版", creditBalance: "520", creditUsed: "0", upgradeClickCount: "0", payPageViewCount: "0", redeemedInviteAt: "-" },
  { logIndex: "5", usedAt: "2026/05/09 18:20", userContact: "133****9094", lastActiveAt: "2026/05/09 18:20", activeDays: "1", calledFeature: "问一下", calledModel: "标准", callCount: "1", inputToken: "380", outputToken: "520", totalToken: "900", runStatus: "成功", estimatedCost: "¥0.01", operationLog: "查看所有记录", userId: "U-10005", username: "133****9094", registeredAt: "2026/06/13 09:48", registerSource: "自然注册", inviteCode: "-", salesOwner: "-", lastLoginAt: "2026/05/09 18:18", lastUsedAt: "2026/05/09 18:20", firstFeature: "问一下", topFeature: "问一下", lastFeature: "问一下", usageCount: "1", sessionCount: "1", messageCount: "2", avgRounds: "0.8", uploadCount: "0", exportCount: "0", tokenUsed: "0.9K", modelSplit: "标准 100%", amount: "¥0", paymentCount: "0", lastPaidAt: "-", paidStatus: "免费版", creditBalance: "505", creditUsed: "15", upgradeClickCount: "0", payPageViewCount: "0", redeemedInviteAt: "-" },
  { logIndex: "6", usedAt: "2026/06/12 21:04", userContact: "189****4871", lastActiveAt: "2026/06/12 21:04", activeDays: "2", calledFeature: "市场调研", calledModel: "Flash", callCount: "7", inputToken: "12,000", outputToken: "16,000", totalToken: "28,000", runStatus: "成功", estimatedCost: "¥0.34", operationLog: "查看所有记录", userId: "U-10006", username: "189****4871", registeredAt: "2026/06/13 09:49", registerSource: "搜索投放", inviteCode: "-", salesOwner: "-", lastLoginAt: "2026/06/12 20:58", lastUsedAt: "2026/06/12 21:04", firstFeature: "市场调研", topFeature: "市场调研", lastFeature: "市场调研", usageCount: "7", sessionCount: "3", messageCount: "21", avgRounds: "5.6", uploadCount: "0", exportCount: "1", tokenUsed: "28K", modelSplit: "Flash 40% / 标准 60%", amount: "¥0", paymentCount: "0", lastPaidAt: "-", paidStatus: "免费版", creditBalance: "445", creditUsed: "75", upgradeClickCount: "2", payPageViewCount: "1", redeemedInviteAt: "-" },
  { logIndex: "7", usedAt: "2026/06/13 12:58", userContact: "178****7070", lastActiveAt: "2026/06/13 12:58", activeDays: "1", calledFeature: "场景谈判顾问", calledModel: "Plus", callCount: "22", inputToken: "41,000", outputToken: "55,000", totalToken: "96,000", runStatus: "成功", estimatedCost: "¥1.28", operationLog: "查看所有记录", userId: "U-10007", username: "178****7070", registeredAt: "2026/06/13 09:49", registerSource: "销售邀请", inviteCode: "YD-TEAM-7N6C", salesOwner: "销售主管", lastLoginAt: "2026/06/13 12:55", lastUsedAt: "2026/06/13 12:58", firstFeature: "客户背调顾问", topFeature: "场景谈判顾问", lastFeature: "场景谈判顾问", usageCount: "22", sessionCount: "9", messageCount: "82", avgRounds: "7.4", uploadCount: "3", exportCount: "4", tokenUsed: "96K", modelSplit: "Plus 51% / 标准 49%", amount: "¥499", paymentCount: "1", lastPaidAt: "2026/06/13 12:40", paidStatus: "团队版", creditBalance: "49,120", creditUsed: "880", upgradeClickCount: "4", payPageViewCount: "2", redeemedInviteAt: "2026/06/13 10:18" },
  { logIndex: "8", usedAt: "2026/06/13 09:55", userContact: "134****9547", lastActiveAt: "2026/06/13 09:55", activeDays: "1", calledFeature: "问一下", calledModel: "标准", callCount: "1", inputToken: "650", outputToken: "850", totalToken: "1,500", runStatus: "失败", estimatedCost: "¥0.02", operationLog: "查看所有记录", userId: "U-10008", username: "134****9547", registeredAt: "2026/06/13 09:51", registerSource: "自然注册", inviteCode: "-", salesOwner: "-", lastLoginAt: "2026/06/13 09:53", lastUsedAt: "2026/06/13 09:55", firstFeature: "问一下", topFeature: "问一下", lastFeature: "问一下", usageCount: "1", sessionCount: "1", messageCount: "3", avgRounds: "1.3", uploadCount: "0", exportCount: "0", tokenUsed: "1.5K", modelSplit: "标准 100%", amount: "¥0", paymentCount: "0", lastPaidAt: "-", paidStatus: "免费版", creditBalance: "520", creditUsed: "0", upgradeClickCount: "0", payPageViewCount: "0", redeemedInviteAt: "-" }
];

/**
 * User Preview 充值相关模拟字段。
 *
 * 为什么不直接写进上面的长对象：
 * - 用户字段报表已经有很多列，继续把充值字段塞进单行对象会很难读。
 * - 这里按用户序号补充模拟值，方便后续继续加充值字段。
 * - 这是后台 UI 原型数据，不代表真实订单或真实支付记录。
 *
 * @type {Array<{ rechargeDate: string, expiryDate: string, rechargePlan: string, rechargeAmount: string, renewalCountdown: string, rechargeRecord: string }>}
 */
const ADMIN_USER_PREVIEW_RECHARGE_FIELDS = [
  { rechargeDate: "2026/06/12", expiryDate: "2027/06/12", rechargePlan: "专业版年付", rechargeAmount: "¥99", renewalCountdown: "362 天", rechargeRecord: "2026/06/12 · 专业版年付 · ¥99" },
  { rechargeDate: "-", expiryDate: "-", rechargePlan: "免费版", rechargeAmount: "¥0", renewalCountdown: "-", rechargeRecord: "暂无充值" },
  { rechargeDate: "-", expiryDate: "-", rechargePlan: "免费版", rechargeAmount: "¥0", renewalCountdown: "-", rechargeRecord: "暂无充值" },
  { rechargeDate: "-", expiryDate: "-", rechargePlan: "免费版", rechargeAmount: "¥0", renewalCountdown: "-", rechargeRecord: "暂无充值" },
  { rechargeDate: "-", expiryDate: "-", rechargePlan: "免费版", rechargeAmount: "¥0", renewalCountdown: "-", rechargeRecord: "暂无充值" },
  { rechargeDate: "-", expiryDate: "-", rechargePlan: "免费版", rechargeAmount: "¥0", renewalCountdown: "-", rechargeRecord: "暂无充值" },
  { rechargeDate: "2026/06/13", expiryDate: "2027/06/13", rechargePlan: "团队版年付", rechargeAmount: "¥499", renewalCountdown: "363 天", rechargeRecord: "2026/06/13 · 团队版年付 · ¥499" },
  { rechargeDate: "-", expiryDate: "-", rechargePlan: "免费版", rechargeAmount: "¥0", renewalCountdown: "-", rechargeRecord: "暂无充值" }
];

/**
 * User Preview 用户来源、状态和账号操作模拟字段。
 *
 * @type {Array<{ channelName: string, channelSourceId: string, inviteRegisterAccount: string, inviteRechargeAccount: string, accountStatus: string, accountActions: string }>}
 */
const ADMIN_USER_PREVIEW_ACCOUNT_FIELDS = [
  { channelName: "销售邀请", channelSourceId: "sales-b-m4q9", inviteRegisterAccount: "销售B", inviteRechargeAccount: "销售B", accountStatus: "启用", accountActions: "启用/关闭/加积分/减积分/账号禁用/调整子账号" },
  { channelName: "自然注册", channelSourceId: "organic-web", inviteRegisterAccount: "-", inviteRechargeAccount: "-", accountStatus: "启用", accountActions: "启用/关闭/加积分/减积分/账号禁用/调整子账号" },
  { channelName: "销售邀请", channelSourceId: "sales-a-8k2p", inviteRegisterAccount: "销售A", inviteRechargeAccount: "-", accountStatus: "启用", accountActions: "启用/关闭/加积分/减积分/账号禁用/调整子账号" },
  { channelName: "展会二维码", channelSourceId: "expo-qr-0613", inviteRegisterAccount: "销售A", inviteRechargeAccount: "-", accountStatus: "启用", accountActions: "启用/关闭/加积分/减积分/账号禁用/调整子账号" },
  { channelName: "自然注册", channelSourceId: "organic-web", inviteRegisterAccount: "-", inviteRechargeAccount: "-", accountStatus: "关闭", accountActions: "启用/关闭/加积分/减积分/账号禁用/调整子账号" },
  { channelName: "搜索投放", channelSourceId: "sem-b2b-01", inviteRegisterAccount: "-", inviteRechargeAccount: "-", accountStatus: "启用", accountActions: "启用/关闭/加积分/减积分/账号禁用/调整子账号" },
  { channelName: "销售邀请", channelSourceId: "team-7n6c", inviteRegisterAccount: "销售主管", inviteRechargeAccount: "销售主管", accountStatus: "启用", accountActions: "启用/关闭/加积分/减积分/账号禁用/调整子账号" },
  { channelName: "自然注册", channelSourceId: "organic-web", inviteRegisterAccount: "-", inviteRechargeAccount: "-", accountStatus: "账号禁用", accountActions: "启用/关闭/加积分/减积分/账号禁用/调整子账号" }
];

window.ADMIN_USER_PREVIEW_USERS.forEach((user, index) => {
  Object.assign(
    user,
    ADMIN_USER_PREVIEW_RECHARGE_FIELDS[index] || ADMIN_USER_PREVIEW_RECHARGE_FIELDS[1],
    ADMIN_USER_PREVIEW_ACCOUNT_FIELDS[index] || ADMIN_USER_PREVIEW_ACCOUNT_FIELDS[1]
  );
});

/**
 * User Preview 子账号管理模拟数据。
 *
 * 为什么单独按主账号 ID 维护：
 * - 子账号管理弹窗是从用户总表某一行进入的，需要展示该主账号名下的子账号。
 * - 这里保留积分分配、已用、剩余和最近活跃，方便运营判断要不要调积分或停用。
 * - 当前仍是静态原型数据，不代表真实账号或真实手机号。
 *
 * @type {Record<string, Array<{ id: string, name: string, phone: string, status: string, allocatedCredit: number, usedCredit: number, remainingCredit: number, lastActiveAt: string }>>}
 */
window.ADMIN_USER_PREVIEW_SUB_ACCOUNTS = {
  "U-10001": [
    { id: "SUB-10001-1", name: "外贸业务A", phone: "180****2011", status: "启用", allocatedCredit: 3000, usedCredit: 1260, remainingCredit: 1740, lastActiveAt: "2026/06/13 15:20" },
    { id: "SUB-10001-2", name: "运营助理", phone: "180****2012", status: "启用", allocatedCredit: 1200, usedCredit: 460, remainingCredit: 740, lastActiveAt: "2026/06/13 11:42" },
    { id: "SUB-10001-3", name: "跟单同事", phone: "180****2013", status: "停用", allocatedCredit: 800, usedCredit: 780, remainingCredit: 20, lastActiveAt: "2026/06/10 18:06" }
  ],
  "U-10007": [
    { id: "SUB-10007-1", name: "销售一组", phone: "178****7101", status: "启用", allocatedCredit: 12000, usedCredit: 6800, remainingCredit: 5200, lastActiveAt: "2026/06/13 12:30" },
    { id: "SUB-10007-2", name: "展会组", phone: "178****7102", status: "启用", allocatedCredit: 9000, usedCredit: 3520, remainingCredit: 5480, lastActiveAt: "2026/06/13 09:18" },
    { id: "SUB-10007-3", name: "客服组", phone: "178****7103", status: "启用", allocatedCredit: 7000, usedCredit: 2160, remainingCredit: 4840, lastActiveAt: "2026/06/12 21:06" },
    { id: "SUB-10007-4", name: "只读观察", phone: "178****7104", status: "停用", allocatedCredit: 1000, usedCredit: 120, remainingCredit: 880, lastActiveAt: "2026/06/08 16:40" }
  ]
};

/**
 * 经营分析 - 三大核心数字。
 *
 * 为什么单独建一份:
 * - User Preview 是字段流水的自由报表; 经营分析是按角色组织的运营驾驶舱。
 * - 不复用同一份数据,方便后续运营和客服分别迭代字段。
 *
 * @type {Array<{ id: string, metric: string, value: string, delta: string, trend: "up"|"down" }>}
 */
window.ADMIN_BUSINESS_HEADLINE = [
  { id: "new-today", metric: "今日新增", value: "48", delta: "+12%", trend: "up" },
  { id: "paid-today", metric: "今日付费", value: "9", delta: "+50%", trend: "up" },
  { id: "deal-amount-today", metric: "今日成交金额", value: "¥8,920", delta: "+22%", trend: "up" }
];

/**
 * 经营分析 - 第二层辅助指标。
 *
 * @type {Array<{ metric: string, value: string }>}
 */
window.ADMIN_BUSINESS_SUB_METRICS = [
  { metric: "今日活跃", value: "326" },
  { metric: "付费会员总数", value: "186" },
  { metric: "累计成交", value: "¥286,400" },
  { metric: "Token 总消耗", value: "3.28M" },
  { metric: "Token 成本", value: "¥412" },
  { metric: "30 日续费率", value: "78%" }
];

/**
 * 经营分析 - 近 30 日趋势 (注册 / 付费 / 成交金额)。
 *
 * 为什么用三组并列数组:
 * - sparkline 渲染只需要数值序列,不需要每天单独建对象。
 * - labels 只在 tooltip 真正接入时用,原型用不到也保留。
 *
 * @type {{ labels: string[], register: number[], paid: number[], amount: number[] }}
 */
window.ADMIN_BUSINESS_TREND = {
  labels: ["5/15","5/16","5/17","5/18","5/19","5/20","5/21","5/22","5/23","5/24","5/25","5/26","5/27","5/28","5/29","5/30","5/31","6/1","6/2","6/3","6/4","6/5","6/6","6/7","6/8","6/9","6/10","6/11","6/12","6/13"],
  register: [22,28,34,30,26,33,40,38,46,42,38,44,40,48,52,45,42,48,55,50,47,52,58,54,49,56,62,58,52,48],
  paid: [3,4,5,3,4,6,5,6,7,5,4,6,5,7,8,6,5,7,8,6,5,7,9,7,6,8,10,9,7,9],
  amount: [2400,3100,3600,3000,3200,4100,3800,4400,5200,4000,3600,4500,3900,5100,5800,4200,3800,4900,5800,4600,4100,5200,6600,5100,4400,5800,7100,6500,5200,8920]
};

/**
 * 经营分析 - 新用户转化漏斗。
 *
 * @type {Array<{ stage: string, value: number, conversion?: string, hint?: string }>}
 */
window.ADMIN_BUSINESS_FUNNEL = [
  { stage: "注册", value: 482, hint: "近 30 日累计" },
  { stage: "首次使用", value: 386, conversion: "80%" },
  { stage: "7 天回访", value: 224, conversion: "58%" },
  { stage: "付费", value: 62, conversion: "28%" },
  { stage: "30 日续费", value: 48, conversion: "77%" }
];

/**
 * 经营分析 - 渠道效率对比。
 *
 * rating 决定渠道标签颜色: high / watch / low。
 *
 * @type {Array<{ channel: string, register: number, activateRate: string, paidRate: string, cpa: string, ltv: string, rating: "high"|"watch"|"low" }>}
 */
window.ADMIN_BUSINESS_CHANNELS = [
  { channel: "销售邀请", register: 186, activateRate: "82%", paidRate: "21%", cpa: "¥38", ltv: "¥420", rating: "high" },
  { channel: "展会二维码", register: 92, activateRate: "76%", paidRate: "18%", cpa: "¥52", ltv: "¥360", rating: "high" },
  { channel: "搜索投放", register: 142, activateRate: "58%", paidRate: "9%", cpa: "¥86", ltv: "¥280", rating: "watch" },
  { channel: "自然注册", register: 62, activateRate: "44%", paidRate: "6%", cpa: "¥0", ltv: "¥180", rating: "low" }
];

/**
 * 经营分析 - 销售业绩 TOP 3。
 *
 * @type {Array<{ rank: number, name: string, invited: number, paid: number, amount: string }>}
 */
window.ADMIN_BUSINESS_TOP_SALES = [
  { rank: 1, name: "销售主管", invited: 24, paid: 9, amount: "¥4,491" },
  { rank: 2, name: "销售B", invited: 18, paid: 6, amount: "¥2,594" },
  { rank: 3, name: "销售A", invited: 16, paid: 4, amount: "¥1,996" }
];

/**
 * 经营分析 - 功能 ROI 明细。
 *
 * 为什么不复用 ADMIN_USER_PREVIEW_FUNCTION_SUMMARY:
 * - 那张是"调用量看板"思路, 列以 calls/tokens 为主。
 * - 这里是"功能价值"思路, 用 7 日回访率 + 付费提升判断 ROI,
 *   两套字段重叠少, 复用反而会被误改。
 *
 * @type {Array<{ feature: string, users: number, retention7: string, paidLift: string, cost: string, roi: string }>}
 */
window.ADMIN_BUSINESS_FEATURE_INSIGHTS = [
  { feature: "客户背调顾问", users: 188, retention7: "62%", paidLift: "+18%", cost: "¥142", roi: "高价值" },
  { feature: "问一下", users: 342, retention7: "54%", paidLift: "+12%", cost: "¥86", roi: "高价值" },
  { feature: "询盘分析回复", users: 156, retention7: "48%", paidLift: "+9%", cost: "¥61", roi: "高价值" },
  { feature: "新客开发信", users: 121, retention7: "41%", paidLift: "+6%", cost: "¥24", roi: "明星" },
  { feature: "场景谈判顾问", users: 87, retention7: "44%", paidLift: "+7%", cost: "¥31", roi: "明星" },
  { feature: "市场调研", users: 96, retention7: "32%", paidLift: "+3%", cost: "¥49", roi: "优化" },
  { feature: "客户Kass", users: 73, retention7: "38%", paidLift: "+4%", cost: "¥22", roi: "优化" },
  { feature: "产品&市场", users: 52, retention7: "28%", paidLift: "+2%", cost: "¥12", roi: "观察" },
  { feature: "案例知识库搜索", users: 64, retention7: "21%", paidLift: "0%", cost: "¥13", roi: "鸡肋" },
  { feature: "报价邮件", users: 48, retention7: "19%", paidLift: "-2%", cost: "¥9", roi: "鸡肋" }
];

/**
 * 经营分析 - 功能价值象限。
 *
 * color 控制象限格子的背景色: must / star / optimize / weak。
 *
 * @type {Array<{ id: string, label: string, hint: string, color: string, features: string[] }>}
 */
window.ADMIN_BUSINESS_QUADRANTS = [
  { id: "must", label: "高价值", hint: "高使用 × 高回报", color: "must", features: ["客户背调顾问","问一下","询盘分析回复"] },
  { id: "star", label: "明星潜力", hint: "高使用 × 待验证", color: "star", features: ["新客开发信","场景谈判顾问"] },
  { id: "optimize", label: "需优化", hint: "高成本 × 低回报", color: "optimize", features: ["市场调研","客户Kass"] },
  { id: "weak", label: "鸡肋", hint: "低使用 × 无价值", color: "weak", features: ["案例知识库搜索","报价邮件","产品&市场"] }
];

/**
 * 后台 · 公海客户 (未分配销售的免费用户)。
 *
 * 字段:用户 / 注册时间 / 注册来源 / 最近活跃 / 累计调用 / 状态。
 *
 * @type {Array<{ id: number, username: string, registeredAt: string, source: string, lastActiveAt: string, calls: number, status: string }>}
 */
window.ADMIN_USER_POOL_ROWS = [
  { id: 1, username: "137****3499", registeredAt: "2026/06/13 09:53", source: "自然注册", lastActiveAt: "2026/06/13 14:18", calls: 13, status: "待分配" },
  { id: 2, username: "133****9094", registeredAt: "2026/06/13 09:48", source: "自然注册", lastActiveAt: "2026/05/09 18:20", calls: 1, status: "沉默" },
  { id: 3, username: "189****4871", registeredAt: "2026/06/13 09:49", source: "搜索投放", lastActiveAt: "2026/06/12 21:04", calls: 7, status: "待分配" },
  { id: 4, username: "134****9547", registeredAt: "2026/06/13 09:51", source: "自然注册", lastActiveAt: "2026/06/13 09:55", calls: 1, status: "失败异常" },
  { id: 5, username: "188****1044", registeredAt: "2026/06/13 09:53", source: "自然注册", lastActiveAt: "-", calls: 0, status: "未激活" },
  { id: 6, username: "152****4480", registeredAt: "2026/06/12 18:42", source: "搜索投放", lastActiveAt: "2026/06/13 14:12", calls: 7, status: "失败异常" },
  { id: 7, username: "135****0024", registeredAt: "2026/06/13 10:02", source: "自然注册", lastActiveAt: "-", calls: 0, status: "未激活" }
];

/**
 * 后台 · 付费公海 (付费但未分配销售的用户)。
 *
 * @type {Array<{ id: number, username: string, plan: string, totalSpent: string, lastActiveAt: string, renewalCountdown: string }>}
 */
window.ADMIN_PAID_POOL_ROWS = [
  { id: 1, username: "180****9154", plan: "专业版", totalSpent: "¥99", lastActiveAt: "2026/06/13 15:42", renewalCountdown: "362 天" },
  { id: 2, username: "139****2207", plan: "专业版", totalSpent: "¥99", lastActiveAt: "2026/06/06 17:02", renewalCountdown: "14 天" },
  { id: 3, username: "176****3380", plan: "团队版", totalSpent: "¥499", lastActiveAt: "2026/06/13 09:18", renewalCountdown: "180 天" },
  { id: 4, username: "186****8810", plan: "专业版", totalSpent: "¥99", lastActiveAt: "2026/06/05 11:30", renewalCountdown: "9 天" },
  { id: 5, username: "162****1190", plan: "专业版", totalSpent: "¥198", lastActiveAt: "2026/06/13 11:20", renewalCountdown: "26 天" },
  { id: 6, username: "159****8077", plan: "团队版", totalSpent: "¥499", lastActiveAt: "2026/06/11 16:08", renewalCountdown: "320 天" }
];

/**
 * 后台 · 销售信息 (按销售维度统计业绩)。
 *
 * 为什么单独建一份, 不直接复用 ADMIN_BUSINESS_TOP_SALES:
 * - TOP_SALES 是看板上的精简榜单, 只有 3 行;
 *   销售信息子页要看到所有销售 + 转化率 + 平均 LTV, 字段更宽。
 *
 * @type {Array<{ id: number, name: string, ownedUsers: number, paidUsers: number, totalAmount: string, avgLtv: string, conversion: string }>}
 */
window.ADMIN_SALES_ROWS = [
  { id: 1, name: "销售主管", ownedUsers: 24, paidUsers: 9, totalAmount: "¥4,491", avgLtv: "¥499", conversion: "38%" },
  { id: 2, name: "销售B", ownedUsers: 18, paidUsers: 6, totalAmount: "¥2,594", avgLtv: "¥432", conversion: "33%" },
  { id: 3, name: "销售A", ownedUsers: 16, paidUsers: 4, totalAmount: "¥1,996", avgLtv: "¥499", conversion: "25%" },
  { id: 4, name: "销售C", ownedUsers: 12, paidUsers: 2, totalAmount: "¥198", avgLtv: "¥99", conversion: "17%" },
  { id: 5, name: "销售D", ownedUsers: 9, paidUsers: 1, totalAmount: "¥99", avgLtv: "¥99", conversion: "11%" },
  { id: 6, name: "销售E", ownedUsers: 7, paidUsers: 0, totalAmount: "¥0", avgLtv: "¥0", conversion: "0%" }
];

/**
 * 后台 · 活跃用户 (近 7 日有调用)。
 *
 * @type {Array<{ id: number, username: string, lastActiveAt: string, weekCalls: number, topFeature: string, plan: string }>}
 */
window.ADMIN_ACTIVE_USER_ROWS = [
  { id: 1, username: "180****9154", lastActiveAt: "2026/06/13 15:42", weekCalls: 36, topFeature: "客户背调顾问", plan: "专业版" },
  { id: 2, username: "178****7070", lastActiveAt: "2026/06/13 12:58", weekCalls: 22, topFeature: "场景谈判顾问", plan: "团队版" },
  { id: 3, username: "176****3380", lastActiveAt: "2026/06/13 09:18", weekCalls: 84, topFeature: "询盘分析回复", plan: "团队版" },
  { id: 4, username: "137****3499", lastActiveAt: "2026/06/13 14:18", weekCalls: 13, topFeature: "问一下", plan: "免费版" },
  { id: 5, username: "189****4871", lastActiveAt: "2026/06/12 21:04", weekCalls: 7, topFeature: "市场调研", plan: "免费版" },
  { id: 6, username: "162****1190", lastActiveAt: "2026/06/13 11:20", weekCalls: 28, topFeature: "新客开发信", plan: "专业版" },
  { id: 7, username: "152****4480", lastActiveAt: "2026/06/13 14:12", weekCalls: 7, topFeature: "市场调研", plan: "免费版" },
  { id: 8, username: "159****8077", lastActiveAt: "2026/06/11 16:08", weekCalls: 12, topFeature: "案例知识库搜索", plan: "团队版" }
];

/**
 * 后台 · 付费用户 (当前付费会员)。
 *
 * @type {Array<{ id: number, username: string, plan: string, paidAt: string, expireAt: string, renewalCountdown: string, status: string }>}
 */
window.ADMIN_PAID_USER_ROWS = [
  { id: 1, username: "180****9154", plan: "专业版年付", paidAt: "2026/06/12", expireAt: "2027/06/12", renewalCountdown: "362 天", status: "正常" },
  { id: 2, username: "178****7070", plan: "团队版年付", paidAt: "2026/06/13", expireAt: "2027/06/13", renewalCountdown: "363 天", status: "正常" },
  { id: 3, username: "176****3380", plan: "团队版半年付", paidAt: "2026/06/01", expireAt: "2026/12/01", renewalCountdown: "180 天", status: "正常" },
  { id: 4, username: "139****2207", plan: "专业版月付", paidAt: "2026/06/06", expireAt: "2026/06/27", renewalCountdown: "14 天", status: "续费提醒" },
  { id: 5, username: "186****8810", plan: "专业版月付", paidAt: "2026/06/01", expireAt: "2026/06/22", renewalCountdown: "9 天", status: "续费提醒" },
  { id: 6, username: "162****1190", plan: "专业版月付", paidAt: "2026/05/21", expireAt: "2026/07/09", renewalCountdown: "26 天", status: "正常" },
  { id: 7, username: "159****8077", plan: "团队版年付", paidAt: "2026/05/01", expireAt: "2027/05/01", renewalCountdown: "320 天", status: "正常" }
];

/**
 * 后台 · 代理总览 (经销代理列表)。
 *
 * 原型里只做单层代理 (没有二级 / 三级), 真实业务可能有层级和分润链。
 *
 * @type {Array<{ id: number, name: string, channelCode: string, newUsers: number, paidUsers: number, totalCommission: string, status: string }>}
 */
window.ADMIN_AGENT_ROWS = [
  { id: 1, name: "广东外贸联盟", channelCode: "AGT-GD-001", newUsers: 86, paidUsers: 21, totalCommission: "¥6,420", status: "启用" },
  { id: 2, name: "义乌跨境联合社", channelCode: "AGT-YW-008", newUsers: 64, paidUsers: 14, totalCommission: "¥4,180", status: "启用" },
  { id: 3, name: "深圳出海会客厅", channelCode: "AGT-SZ-022", newUsers: 42, paidUsers: 9, totalCommission: "¥2,640", status: "启用" },
  { id: 4, name: "义务展会渠道", channelCode: "AGT-YW-EXP", newUsers: 28, paidUsers: 4, totalCommission: "¥980", status: "试运行" },
  { id: 5, name: "宁波港产联盟", channelCode: "AGT-NB-017", newUsers: 12, paidUsers: 1, totalCommission: "¥220", status: "停用" }
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
  { id: 1, modelId: "deepseek-v4-pro", thinking: "高" },
  { id: 2, modelId: "gemini-3.5-flash", thinking: "低" }
];
