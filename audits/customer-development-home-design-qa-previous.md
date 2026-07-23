# 客户开发 Lead Enrichment 首页 Design QA

## 对照信息

- source visual truth path: `/var/folders/94/2dlbsm3968j4rqjll_d32qb40000gn/T/codex-clipboard-61033fec-59a9-4d64-82c1-d9937a741e93.png`
- implementation URL: `http://127.0.0.1:8765/#/customer-development`
- implementation screenshot path: `/Users/garden/YD/Prototype/audits/customer-development-home-implementation-final.png`
- narrow screenshot path: `/Users/garden/YD/Prototype/audits/customer-development-home-narrow.png`
- viewport: desktop `1487 × 1058`；窄屏 `720 × 900`
- pixel dimensions and density: source `1487 × 1058`；implementation `1487 × 1058`；desktop CSS viewport `1487 × 1058`；`devicePixelRatio = 1`，无需密度归一化
- state: `#/customer-development` / Lead Enrichment 搜索条件首页 / 默认四项搜索条件
- full-view comparison evidence: source visual 与 implementation screenshot 已在同一次视觉比较输入中打开核对
- focused region comparison evidence: 主标题、四项输入区、搜索按钮、数据源覆盖区和最近搜索区在全尺寸截图中均可清晰阅读，因此未另做局部裁切

## Findings

- 未发现可执行的 P0 / P1 / P2 问题。
- [P3] 参考图侧栏约为 367px，现有产品侧栏保持项目统一的 260px；主工作区内部的相对留白、横向输入和按钮位置已按参考图复刻。为避免影响其它页面，没有全局放大侧栏。
- [P3] 输入项和数据源使用项目现有本地 SVG 图标，轮廓与参考图略有差异，但保持了同一黑色线性语言，也避免了临时绘制或远程依赖。

## 必查维度

- 字体与层级：橙色 kicker、44px 主标题、16px 说明正文、14–16px 表单层级与参考图一致；无异常换行、截断或字重漂移。
- 间距与布局：桌面端四项输入保持单行，CTA 独立右对齐；数据源区顶部为 `601.7px`、底部为 `903.3px`，最近搜索区从 `903.3px` 延伸至首屏底部，主要纵向节奏与参考图一致。
- 色彩与 token：继续使用项目暖白底、深灰正文和 Vinco Orange；按钮、焦点环和 hover 状态沿用现有品牌 token，没有新增渐变或厚重阴影。
- 图片与资源：该页面无摄影、插画或装饰性位图；所有可见业务图标均为项目已有本地 SVG，清晰度正常，无占位图和远程资源。
- 文案与内容：Lead Enrichment 定位、主标题、说明文案、四项默认值、18+ 数据源分组、交叉验证说明和最近搜索模板均与目标图一致。
- 交互与状态：已实测最近搜索模板可回填四项输入；点击“开始搜索并补全”会经过 searching 状态并进入 `#/customer-development/results`；清空历史有本地反馈；浏览器控制台无 error / warning。
- 响应式：`720 × 900` 下页面无横向溢出，四项输入与数据源分组按单列堆叠，主操作仍可访问。

## Comparison history

- Pass 1：首轮桌面截图显示主标题为 48px，数据源区因弹性行高延伸至约 946px，最近搜索区偏低。
- Fix：主标题上限收紧到 44px；最近搜索区最小高度由 92px 调整为 138px；默认产品和目标文案改为目标图中的简洁版本。
- Pass 2：同尺寸对照后，标题宽度、输入区、CTA、数据源区和最近搜索分界线均与目标图对齐；没有剩余 P0 / P1 / P2 问题。

## Open Questions

- 无阻塞问题。

## Implementation Checklist

- [x] Lead Enrichment 首屏定位与主标题完成。
- [x] 四项输入继续绑定原有 customerDevBrief 状态。
- [x] “开始搜索并补全”保留完整搜索跳转。
- [x] 18+ 数据源改为紧凑、明确不可点击的信息区。
- [x] 最近搜索模板可回填，清空历史有反馈。
- [x] 桌面与窄屏浏览器检查完成。
- [x] `node --check` 与 87 项自动测试通过。

final result: passed
