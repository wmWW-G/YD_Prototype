# 客户 Kass A/B 版 Design QA

## A 版客户档案布局注释

### 对照信息

- source visual truth path: `/Users/garden/Library/Containers/com.sw33tlie.macshot.macshot/Data/Library/Application Support/com.sw33tlie.macshot/clipboard/Screenshot 2026-07-23 at 15-56-14.png`
- implementation URL: `http://localhost:8765/#/customer-kass/A`
- implementation full screenshot: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/kass-a-profile-layout-1728x802.png`
- latest clean-header screenshot: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/kass-a-clean-header-profile-1728x896.png`
- implementation focused screenshot: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/kass-a-profile-layout-focus-980x610.jpg`
- full-view comparison evidence: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/kass-a-profile-full-reference-vs-page.jpg`
- focused comparison evidence: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/kass-a-profile-reference-vs-implementation.jpg`
- viewport: desktop `1728 × 802`；responsive check `720 × 900`
- source pixels: `1560 × 1838`；它是结构草图，不是指定浏览器视口
- implementation pixels: full page `1728 × 802`；focused region `980 × 610`
- CSS size and density normalization: desktop viewport 与全页截图均为 1:1 CSS 像素；focused comparison 将草图顶部结构裁切并等比放入同高面板，只比较用户标出的信息结构，不把手绘线条粗细当作产品视觉 token
- state: `#/customer-kass/A` → A 级 → `ABC Trading` → `客户信息`，使用无背调、无跟进记录的本地样例状态

### Findings

- 未发现可执行的 P0 / P1 / P2 问题。
- [P3] 参考图的黑红粗线、彩色渐变背景和超高空白是结构示意；实现保留赢单现有暖白、细边框、品牌橙和真实桌面高度，只复刻“一张连续工作纸、左档案右速览、下方整行跟进记录”的信息架构。

### 必查维度

- 字体与层级：沿用项目现有系统字体；左侧「档案」、右侧客户背景和下方「跟进与待办」形成三层阅读顺序，没有新增不一致字体。
- 间距与布局：桌面档案区为 `223.5px / 698.5px` 两栏，左档案入口与右速览等高；下方跟进区占整行并填满余下空间。`720px` 下自动改为单列，没有横向溢出。
- 色彩与 token：使用现有暖白背景、浅灰边框和品牌橙；没有照搬草图用于标注的红黑线或渐变背景。
- 图片与资源：本次目标只有布局线框，不包含产品图、图标或摄影资源；实现没有用占位图片、手绘 SVG 或 CSS 图形替代资产。
- 文案与内容：右侧只展示稳定客户背景、公司规模、采购角色、市场渠道和资信情况；询盘、跟进和待办没有混入档案速览。
- 交互与可访问性：整张「档案」卡可点击打开完整资料抽屉；「补充背调」「新增跟进记录」和待办交互继续可用；语义结构保留 `section`、`button`、`dl` 和真实 checkbox。

### Comparison history

- Pass 1：把草图顶部结构与 `ABC Trading` 客户信息页裁切到同一张对照图。左侧档案块、右侧四条速览、下方整行跟进区域均已对齐；没有 P0 / P1 / P2，因此未进行视觉返工循环。

### Verification

- 桌面浏览器：档案区尺寸 `980 × 244px`，外层工作纸 `980 × 610px`，页面无横向溢出。
- 窄屏浏览器：`720 × 900` 下档案与速览切为单列，页面和工作纸均无横向溢出。
- 交互：点击「档案」成功打开并关闭客户详细档案；切换到有记录的 `Global Sourcing Inc.` 后仍显示 2 条跟进记录与 2 项关联待办。
- 浏览器控制台：0 条 error。
- A 版客户标题右侧已不再渲染意向标签或“同步最近消息”按钮；标题、国家、询盘来源和阶段保持完整，标题区没有空占位。
- 自动验证：`node --check src/app.js`、`node --check src/data.js`、`git diff --check` 通过；`npm test` 102 项通过、0 失败。

## B 版对照信息

- source visual truth path: `/var/folders/94/2dlbsm3968j4rqjll_d32qb40000gn/T/codex-clipboard-df0d32a1-9739-4855-9b1a-5fd53a2e6443.png`
- implementation URL: `http://localhost:8765/#/customer-kass/B`
- implementation desktop screenshot: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/kass-b-implementation-1749x899.png`
- implementation modal screenshot: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/kass-b-modal-1749x899.png`
- implementation final screenshot: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/kass-b-final-1447x802.png`
- implementation tablet screenshot: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/kass-b-tablet-900x900.png`
- full-view comparison evidence: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/kass-b-reference-vs-modal.png`
- focused modal comparison evidence: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/kass-b-modal-focus.png`
- focused right-context comparison evidence: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/kass-b-context-focus.png`
- current parity source visual: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/kass-a-clean-header-profile-1728x896.png`
- current B shared-layout screenshot: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/kass-b-shared-profile-layout-1728x896.png`
- current A/B combined comparison: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/kass-a-vs-b-shared-layout.jpg`
- viewport: fidelity comparison `1749 × 899`；默认桌面 `1447 × 802`；窄屏 `900 × 900`、`720 × 900`
- source pixels: `1749 × 899`
- implementation comparison pixels: `1749 × 899`
- CSS size and density normalization: source 与 implementation 均按 `1749 × 899`、1:1 像素尺寸比较；未做密度缩放
- current parity state: `#/customer-kass/B` → A 级 → `Global Sourcing Inc.`；将右栏与 A 版同一客户的“档案 + 快速回忆 + 跟进与待办”逐项比较

## Findings

- 未发现可执行的 P0 / P1 / P2 问题。
- [P3] B 版右栏可用宽度小于 A 版全宽页签，因此宽桌面将共用工作纸收进约 `913px` 右栏；字段、内容层级和交互完全共用，只有容器宽度与滚动方式不同。
- [P3] 参考图弹窗使用图标式关闭，当前实现沿用赢单原型的文字“关闭”；不影响搜索和切换客户。
- [P3] `720px` 下沿用现有赢单工作台规则隐藏全局侧栏，当前客户的对话和上下文仍完整可用；本轮参考图是桌面态，未新增移动端客户选择器。

## 必查维度

- 字体与层级：沿用赢单原型现有系统字体与字重；CRM Agent、客户名、档案、快速回忆信息、跟进与待办形成清楚层级；长客户名和侧栏客户名均可稳定截断或换行。
- 间距与布局：`1728 × 896` 桌面为全局侧栏、`513px` Agent 主区、`913px` 客户上下文三栏；右栏独立滚动，输入框固定在 Agent 底部。右栏工作纸复用 A 版的左档案右速览、下方整行跟进结构。
- 色彩与 token：延续赢单暖白、浅灰边框和品牌橙；B 版不再额外维护意向 / 阶段标签色板，客户阶段只保留在标题辅助信息中。
- 图片与资源：页面不需要产品图或摄影资产；导航继续使用项目现有 SVG 图标。参考产品特有的品牌 Logo、Agent 图标和国旗未复制或伪造，保留赢单自己的品牌组件。
- 文案与内容：使用本地虚构客户数据；B 级弹窗有 16 条完整样例，未复制真实客户、邮箱、手机号或线上历史。
- 图标与控件：侧栏展开态、客户激活态、禁用发送按钮、橙色主操作和复选待办均有明确状态；未新增手绘 SVG 或占位图片。
- 交互与状态：侧栏先独立选择方案 A/B，再在方案内部选择 A/B/C/D 客户等级；B 版等级使用单开手风琴，切换等级保持 `#/customer-kass/B`；完整客户弹窗支持搜索、滚动和客户切换；Agent 输入可发送本地原型消息；完整资料抽屉、新增跟进、待办完成均可操作。
- 无障碍：三栏使用 `main`、`aside`、`section` 语义；弹窗与详细档案使用 `role="dialog"` / `aria-modal`；等级按钮带 `aria-expanded`；待办为真实 checkbox。
- 响应式：`1260px` 及以下主区和右栏纵向堆叠、工作区可滚动；右栏宽度不足 `480px` 时档案和速览自动改为单列。`1250 × 920`、`1055 × 920` 与 `720 × 900` 均无横向溢出或内容裁切。

## Comparison history

- Pass 1：将参考图与实现的 `1749 × 899` 弹窗状态放入同一张对照图，并补充弹窗、右栏两个局部对照。确认结构、密度和视觉节奏一致，用户要求的背调 / 跟进业务差异属于主动调整，没有 P0 / P1 / P2。
- 浏览器验收前已把 B 版默认侧栏改为只展开一个等级，并补齐 16 条 B 级客户，使 A/B/C/D 在常见桌面高度可见、弹窗长列表可滚动。
- Pass 2：以 A 版当前客户信息工作纸作为新的 source visual truth，让 B 版直接复用同一渲染函数；删除 B 版旧的独立背调 / 跟进 DOM 后，在 `1728 × 896` 和 `1055 × 920` 复核，无 P0 / P1 / P2。
- Pass 3：把等宽改为 `44% / 56%`，但在用户当前 `1313 × 920` 视口仅形成 `445px / 566px`，用户明确指出差异仍不明显，记录为 [P2] 主区域比例层级不足。
- Pass 4：将桌面比例直接拉开为 `36% / 64%`，同一视口复核为 `364px / 647px`；对比图确认右侧已明显成为主区，同时页面无横向溢出，P2 已关闭。

## Verification

- `node --check src/app.js`：通过。
- `node --check src/data.js`：通过。
- `npm test`：102 项通过，0 失败。
- `git diff --check`：通过。
- 浏览器控制台：0 条 error。
- B 版右栏：`.kass-customer-hub`、`.kass-profile-file`、`.kass-profile-memory`、`.kass-followup-workspace` 各 1 个；旧 `.kass-compare-research` / `.kass-compare-followup` 均为 0。
- B 版完整资料：点击档案入口成功打开「客户详细档案」，5 个资料分组完整显示，并可关闭。
- 浏览器交互：客户弹窗搜索得到唯一 Atlas 结果；从弹窗切换客户成功；B 版内部切到 C 级后 URL 保持不变；Agent 回复正确引用 C 级客户；完整资料五个分组可打开与关闭；待办勾选后显示“已完成”；新增跟进表单可打开和取消。
- A 版回归：`#/customer-kass/A` 仍显示独立客户栏和「AI 助理 / 客户信息」页签；客户标题不再包含“中高意向”或“同步最近消息”，工作纸内容不变。
- 浏览器布局：`1749 × 899`、`1447 × 802`、`900 × 900`、`720 × 900` 均无页面级横向溢出。
- 本轮新增布局验证：`1728 × 896` 为 `513px / 913px`，右栏档案区约为 `201px / 628px`；`1250 × 920` 自动纵向堆叠，页面级横向溢出为 false。

## B 版两栏重心审查

### Evidence

- scope: `#/customer-kass/B` 的 CRM Agent 与客户信息两栏比例
- user goal: 让页面主次更明确，同时保证 Agent 对话和客户资料都可持续阅读
- before screenshot: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/03-kass-b-subtle-44-56-1313x920.png`
- after screenshot: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/04-kass-b-strong-36-64-1313x920.png`
- combined comparison: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/kass-b-strong-column-ratio-before-after.jpg`

### Findings

1. [P2] `44% / 56%` 状态：在用户当前 `1313 × 920` 视口只有 `445px / 566px`，两栏轮廓仍接近，视觉重心不够明确。
2. `36% / 64%` 状态：通过。同一视口变为 `364px / 647px`，右栏约为 Agent 的 1.78 倍；档案、速览和跟进形成明确主区，Agent 仍保留完整输入与阅读能力。
3. 响应式：`1250 × 920` 下已切为单列上下堆叠，没有横向溢出；宽桌面 `1728 × 896` 下为 `513px / 913px`。
4. 可访问性证据边界：本轮只调整 CSS 网格比例，DOM 阅读顺序、语义和交互控件没有变化；截图不能替代键盘、缩放和屏幕阅读器的完整验证。

## A/B 共用资料状态卡审查

### Evidence

- user-provided before crop: `/var/folders/94/2dlbsm3968j4rqjll_d32qb40000gn/T/codex-clipboard-1b08123f-e894-4e33-af87-1fc94ca31cc0.png`
- current-run before page: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/05-kass-profile-status-card-before.png`
- A implementation: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/06-kass-profile-status-card-after-a.png`
- B implementation: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/07-kass-profile-status-card-after-b.png`
- focused component: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/08-kass-profile-status-card-component.png`
- combined comparison: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/kass-profile-status-card-before-after.jpg`

### Findings

1. [P2] 调整前：左栏用大号“档案”占据主要视觉面积，只重复“资料已合并”，用户无法快速判断资料来自哪里、是否完整，信息价值与占用面积不匹配。
2. 调整后：通过。左栏改为资料状态入口，按“待完善数量 → 来源数量 → 两个具体来源 → 完整资料入口”阅读；字号回归正常产品层级，不再制造封面式空块。
3. 信息边界：通过。资料来源与完善状态只放左栏，稳定客户事实继续放右栏；右栏补充操作仅显示“补充背调”，不再重复待完善数量。
4. A/B 一致性：通过。两套方案共用 `renderKassCustomerHub()`，同一客户显示同一资料状态；B 版 `176 × 265px` 卡片无内部或页面级溢出。
5. 交互与可访问性：通过。整张状态卡仍是原生 `button`，可打开并关闭五组客户详细档案；来源和状态进入可访问名称。截图无法替代完整键盘焦点与屏幕阅读器验证。

## A/B Agent 对话方向审查

### Evidence

- annotated source state: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/09-kass-chat-before-a.png`
- A implementation: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/11-kass-chat-after-a.png`
- B implementation: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/13-kass-chat-after-b-1447x896.png`
- combined comparison: `/Users/garden/.codex/visualizations/2026/07/23/019f8c8c-f48a-70f1-ae64-b961c5c3c701/kass-chat-left-right-before-after.jpg`

### Findings

1. [P2] 调整前：用户消息和 CRM Agent 消息都从左侧开始，角色切换主要依赖头像与底色，聊天方向不够直观。
2. 调整后：通过。用户头像与消息气泡整体靠右，CRM Agent 头像与分析卡保持靠左，A/B 两版和后续动态消息共用同一套方向规则。
3. 宽屏 B 版：通过。`1447 × 896` 下仍保持 Agent 36% / 客户信息 64%，用户消息在 Agent 栏右侧、分析卡在左侧，页面无横向溢出。
4. 窄栏可读性：通过。用户气泡使用内容自适应宽度并限制最大宽度，短消息不再铺满整行；Agent 的长分析仍使用完整可用宽度。
5. 可访问性边界：DOM 顺序和原生文本语义保持不变，视觉换边只由 CSS 完成；截图无法替代屏幕阅读器对消息角色的完整验证。

## Open Questions

- 无阻塞问题。

## Implementation Checklist

- [x] B 路由使用独立三栏对照布局，不改 A 版。
- [x] A/B/C/D 等级和高频客户进入全局侧栏子菜单。
- [x] “查看全部”按等级打开可搜索客户弹窗。
- [x] Agent 对话支持本地原型追问。
- [x] A/B Agent 对话统一为用户消息靠右、CRM Agent 消息靠左。
- [x] B 版右栏与 A 版共用同一套“资料状态 + 快速回忆 + 跟进与待办”组件。
- [x] 跟进记录和其产生的待办保持在同一容器，并在两套方案中呈现一致。
- [x] A 版客户标题移除意向标签与“同步最近消息”。
- [x] 完成桌面、窄屏、控制台、交互和自动测试验收。

## Follow-up Polish

- 如果后续把 B 版扩展为正式移动端产品，可在小屏增加独立的“选择客户”抽屉；当前不影响本轮桌面对比展示。

final result: passed

---

# 客户开发全球网络背景 Design QA

## 对照信息

- source visual truth path: `/Users/garden/.codex/generated_images/01a0315a-2ab4-7ae0-a18b-3ab054638b2e/exec-a23d1e29-9aa6-451a-9d5c-7af5fcca5003.png`
- implementation URL: `http://127.0.0.1:8788/index.html#/customer-development`
- generated background asset: `/Users/garden/YD/Prototype/assets/generated/customer-development-global-network.png`
- implementation screenshot: `/Users/garden/.codex/visualizations/2026/08/24/01a0315a-2ab4-7ae0-a18b-3ab054638b2e/customer-development-network-fullbleed.png`
- full-view comparison evidence: `/Users/garden/.codex/visualizations/2026/08/24/01a0315a-2ab4-7ae0-a18b-3ab054638b2e/customer-development-network-fullbleed-comparison.png`
- viewport: browser CSS viewport `1440 × 1024`；responsive check `900 × 900`
- source pixels: `1487 × 1058`；implementation pixels: `1440 × 1024`
- density normalization: source 等比归一到 `1440 × 1024` 后与实现截图并排比较；两者均为 1× CSS 密度
- state: 客户开发首页 → 社媒获客 → 德国 → 光伏组件 → 品牌商 → 100 家

## Findings

- 未发现可执行的 P0 / P1 / P2 问题。
- [P3] 参考图的全球点阵在右下区域略密，当前独立背景资产为保证按钮和查询文字对比度，整体降低了约一档不透明度；不影响图 2 的全球网络氛围与视觉方向。
- [P3] 项目现有侧栏宽度与参考图略有差异，主内容因此向右偏少量像素；这是复用赢单现有设计系统的有意约束。

## 必查维度

- 字体与层级：沿用赢单系统字体和现有字号；来源标题、自然语言查询句与主按钮的层级和参考图一致，没有新增装饰性字体。
- 间距与布局：保留无右栏、无查询卡的完整主工作区；背景从工作区四边直接铺满，外层 padding 为 `0px`，不再形成矩形画布或留白边。六个来源同排，查询句和主按钮保持原有位置。`900px` 下页面宽度与视口一致，无横向溢出。
- 色彩与 token：背景为低对比暖白、浅橙节点和右侧暖橙光带，继续使用赢单橙色与暖灰 token；中央文字区保持足够安静。
- 图片与资源：全球点阵、地图、弧线和节点来自独立 `1180 × 960` ImageGen 图片资产，没有用 CSS 图形、手绘 SVG 或 DOM 元素伪造。
- 文案与内容：数据来源、德国、光伏组件、品牌商、100 家与主按钮文案均和参考状态一致；没有加入额外说明、指标或右侧信息栏。
- 交互与可访问性：六个来源切换、国家与产品选择、客户类型和数量下拉继续可用；地图获客仍保留城市、行业、数量和公开联系方式字段；来源 tab 保留 `aria-selected`。

## Comparison history

- Pass 1：将选中的图 2 与实现截图归一到同一尺寸后并排比较。全球点阵、连接弧线、右侧暖橙光带、无卡片查询区和主按钮位置均已落地；未发现 P0 / P1 / P2，因此不需要视觉返工循环。
- Pass 2：用户指出背景仍被限制在矩形画布并留下外圈空白，记为 [P2] 页面整体仍有“大卡片”感。修复后将背景从 `.customer-dev-intelligence-canvas` 移到整个 `.workspace`，取消工作区 padding；`1440 × 1024` 对照确认背景从顶、右、底三边连续铺满，P2 已关闭。

## Focused comparison

- 未单独裁切局部图：原尺寸并排图中来源按钮、查询控件、主按钮和背景资产边缘均清晰可读，且本轮唯一新增可视资产是覆盖整个工作区的背景，局部裁切不会提供额外判断价值。

## Verification

- 浏览器：背景图片成功加载在 `.workspace`；工作区尺寸 `1180 × 960px`、padding `0px`；内部画布无背景图片；右侧说明栏数量为 0；社媒获客为选中态；控制台 0 条 error、0 条 warning。
- 响应式：`900 × 900` 下主画布宽 `876px`，页面无横向溢出，背景自动覆盖并裁切。
- 交互：地图获客的城市输入、64 个聚合行业入口和公开联系方式筛选均存在；恢复社媒获客后 `aria-selected="true"`。
- 自动验证：`node --check src/app.js`、`git diff --check` 通过；`npm test` 156 项通过、0 失败。

## Open Questions

- 无阻塞问题。

final result: passed

---

# 客户开发情报画布 Design QA

## 对照信息

- source visual truth path: `/Users/garden/.codex/generated_images/01a0315a-2ab4-7ae0-a18b-3ab054638b2e/exec-33c1201e-bd51-483f-a6a2-51704a61a747.png`
- implementation URL: `http://127.0.0.1:8788/index.html#/customer-development`
- implementation screenshot: `/Users/garden/.codex/visualizations/2026/08/24/01a0315a-2ab4-7ae0-a18b-3ab054638b2e/customer-development-intelligence-canvas-1440x1024.png`
- latest full-width screenshot: `/Users/garden/.codex/visualizations/2026/08/24/01a0315a-2ab4-7ae0-a18b-3ab054638b2e/customer-development-fullwidth-1728x924.png`
- combined comparison: `/Users/garden/.codex/visualizations/2026/08/24/01a0315a-2ab4-7ae0-a18b-3ab054638b2e/customer-development-reference-vs-implementation.png`
- viewport: desktop `1440 × 1024`；responsive check `720 × 900`
- state: 客户开发首页 → 社媒获客 → 德国 → 光伏组件 → 品牌商 → 100 家

## Findings

- 未发现可执行的 P0 / P1 / P2 问题。
- [P3] 参考图用圆形对勾和按钮箭头强化选中态与主操作；当前实现沿用赢单已有图标资源和橙色描边、按钮投影，没有为了像素相似新增手绘图标。
- 用户在浏览器标注中明确要求移除右侧“本次将补全”；实现已按该最新视觉决定删除整栏并让主工作区铺满，不再以原参考图的右栏作为保真目标。

## 必查维度

- 字体与层级：沿用赢单系统字体；“选择获客来源”和“自然语言目标客户”形成清楚的两级结构。
- 间距与布局：桌面主工作区铺满 `1180px` 内容画布，六个来源位于同一行；`720px` 下来源自动改为两列，页面无横向溢出。
- 色彩与 token：继续使用赢单暖白背景、浅灰边框和品牌橙，没有引入新的品牌色或渐变。
- 图片与资源：六个来源均复用项目现有 SVG 图标，没有占位图、手绘 SVG 或 CSS 图形。
- 文案与内容：界面只出现业务来源名称，不出现供应商品牌、接口说明或已移除的情报补全说明。
- 交互与状态：六个来源均可切换；企业数据库和地图获客保留真实现有流程；其余来源点击主按钮只显示不可用反馈，不伪造查询结果。
- 可访问性：来源使用 `role="tablist"` / `role="tab"` 和 `aria-selected`；查询选择器均有可读标签。

## Comparison history

- Pass 1：将参考图和当前 `1440 × 1024` 页面放入同一张对照图，发现六个来源最初全部挤在同一行，记为 P2。
- Fix：改为五列来源网格，并将展会获客放到第二行右侧；同时补齐地图获客的公开联系方式筛选和行业目录副说明。
- Pass 2：同尺寸复核后，主区、来源层级、自然语言句式、主操作和右侧情报栏均对齐，未发现新的 P0 / P1 / P2。
- Pass 3：根据浏览器标注删除右侧“本次将补全”，主区扩展到完整 `1180px`，六个来源排成一行；`1728 × 924` 下无空白栏或横向溢出。
- Pass 4：暖色背景加查询卡的尝试被用户明确否定，已完整撤回；后续只通过新的视觉方案探索背景层次，不在查询区套卡片。

## Verification

- 浏览器结构：右侧说明栏数量为 0；六个来源按钮完整显示，主画布宽度为 `1180px`。
- 不可用来源：海关获客主按钮显示“当前数据服务暂不可用，请稍后再试”，未进入伪结果页。
- 地图获客：目标城市、64 个聚合行业选择器、目标数量和公开联系方式筛选均存在。
- 响应式：`720 × 900` 页面宽度与视口同为 `720px`，无横向溢出。
- 浏览器控制台：0 条 error，0 条 warning。
- 自动验证：`node --check src/app.js`、`git diff --check` 通过；`npm test` 156 项通过、0 失败。

## Open Questions

- 无阻塞问题。

final result: passed

---

# TokenMind Dify 日志查询扩展 Design QA

## 对照信息

- source visual truth path: 用户本轮要求的“简约白底、三个使用场景分开”，并以被否定的旧版截图 `/private/tmp/dify-log-ui-audit/01-current-stacked-ui.png` 作为反例基线
- implementation URL: `http://127.0.0.1:8898/sidepanel.html`
- implementation home screenshot: `/private/tmp/dify-log-ui-audit/02-white-home.png`
- user-failed screenshot: `/private/tmp/dify-log-ui-audit/03-user-failed.png`
- marker screenshot: `/private/tmp/dify-log-ui-audit/04-marker.png`
- marker custom-time screenshot: `/private/tmp/dify-log-ui-audit/05-marker-custom-time.png`
- full-view comparison evidence: `/private/tmp/dify-log-ui-audit/06-before-after.png`
- viewport: Chrome Side Panel 窄栏 `380 × 900` CSS px
- source pixels: `380 × 1023`；implementation pixels: `380 × 900`
- CSS size and density normalization: 两侧均以 `380px` 窄栏宽度、1:1 CSS 像素检查；高度差来自旧版页面内容更长，不据此判断单个控件比例
- state: 本地预览无 Dify 登录上下文；重点验证首页信息架构、三个场景字段隔离和自定义时间展开状态

## Findings

- 未发现可执行的 P0 / P1 / P2 问题。
- [P3] 当前 App 状态卡保留一条浅黄色登录引导，用于区别普通说明和需要用户处理的状态；它没有延续旧版黑金装饰，但仍比页面其他区域更醒目，这是有意的状态语义。

## 必查维度

- 字体与层级：使用系统无衬线字体；品牌标题、场景标题、字段标签和说明形成四级层次，窄栏下没有异常截断。
- 间距与布局：首页只放三个场景入口；进入详情页后只呈现对应字段、时间范围、高级设置和查询按钮。`380px` 宽度无横向溢出。
- 色彩与 token：页面背景为纯白，主色为克制的蓝色，卡片使用浅灰边框；已移除旧版黑底、金色描边和全部渐变。
- 图片与资源：继续使用 TokenMind 原始 Logo 资源，没有用手绘 SVG、CSS 图形或占位图替代品牌资产。
- 文案与内容：三个入口分别对应“指定用户失败”“当前 App 失败”“marker 精确定位”；详情页只解释当前场景，不再展示其他模式。
- 交互与可访问性：三个入口与返回均为原生按钮；场景标题使用 heading；表单使用 label、fieldset、legend 和原生 radio。自定义时间展开后起止输入均可访问。

## Comparison history

- Pass 1：旧版把三种模式、用户 ID、时间范围和查询按钮堆在同一黑金页面，信息密度高，主任务不清楚，记为 P1。
- Fix：改成纯白首页三入口，三种模式进入独立详情页；详情页按场景显示零个、一个或两个业务输入字段。
- Pass 2：在 `380 × 900` 下逐一进入 `user-failed`、`app-failed`、`marker`，并展开 marker 的自定义时间。三个场景字段隔离正确，无横向溢出，未发现新的 P0 / P1 / P2。

## Verification

- 首页：只显示三个使用场景，不显示查询表单。
- 指定用户：只显示终端用户 ID，不显示 marker。
- 当前 App：不显示终端用户 ID和 marker，只显示时间范围。
- marker：同时显示终端用户 ID 和 marker；自定义时间可展开起止时间。
- 自动检查：Side Panel 合同测试 5 项通过，`sidepanel.js` 语法检查通过。

## Open Questions

- 无阻塞问题。

## Implementation Checklist

- [x] 改为简约纯白背景。
- [x] 移除黑金视觉和渐变。
- [x] 首页只保留三个场景入口。
- [x] 三个场景使用独立操作页并隔离字段。
- [x] 完成窄栏和关键交互状态检查。

## Follow-up Polish

- 等扩展在真实 Dify 日志页安装后，可再补一轮真实登录态、加载态和结果态的视觉检查。

final result: passed
