# 全技能总控单次运行成本动画

## 这个项目做什么

这是一个 39 秒、1920×1080 的 HyperFrames 单画布动画。它基于：

`dify-chatflows/Chatflow-全技能总控示例/赢单｜全技能总控 Chatflow.yml`

动画模拟一次“无附件、cold-email、选择 DeepSeek、Agent 实际调用两个 Tavily 工具”的节点运行，并逐步解释每个关键节点是否新增模型或工具供应商成本。

动画不是真实计费程序，也不会联网调用 Dify。它只使用 YML 中已经核对的节点结构和精确资源身份做可视化讲解。

## 入口和输出

- 动画源码：`index.html`
- 动效断言：`index.motion.json`
- HyperFrames 配置：`hyperframes.json`
- 视觉规范：`DESIGN.md`
- 预览入口：HyperFrames Studio 的项目地址
- 最终成片：用户确认预览后生成 `renders/chatflow-cost-calculation.mp4`
- 上一版错误的双 Chatflow 草稿已改名为 `renders/chatflow-cost-calculation.old-two-flow.mp4`，旧抽帧在 `snapshots-old-two-flow/`，不会冒充当前成片。

主时间线注册名为 `chatflow-cost-node-run`，总时长 39 秒。

## 画布结构

- 顶部：本轮模拟路径。
- 左侧：文件、知识库、Skill 三条真实并行支路，汇合到模型路由、Agent、工具和 Answer。
- 右侧：本轮成本账本，只在实际计费节点运行时点亮。
- 底部：逐节点白话解释。

为了避免把 35 个节点挤成难以阅读的小字，文件支路中的筛选、判断、模板和聚合器按非计费逻辑归组；知识库、实际 Agent 模型和两个工具调用保留精确资源名。

## 关键成本结论

- RAG 查询使用 `text-embedding-3-large`，产生 Embedding 成本。
- rerank 在 YML 中关闭，本轮不产生 rerank 模型成本。
- 前端选择值是 `deepseek-v4-pro`，实际 Agent 节点配置是 `deepseek-v4-flash`；计费必须以后者为准。
- `Tavily Search` 和 `Tavily Extract` 分别按实际成功调用归集。
- 用户输入、路由、Prompt、聚合和 Answer 节点不重复新增模型或工具费。
- 本轮无图片，`gemini-3.5-flash` 视觉节点没有执行，因此不计费。

## 修改入口

- 改节点文案或布局：编辑 `index.html`。
- 改颜色和视觉原则：先改 `DESIGN.md`，再同步 `index.html`。
- 改节点运行时间：修改 `index.html` 底部 GSAP 时间线，并同步根节点 `data-duration` 和 `index.motion.json`。
- 不要把 Dify API Key、真实客户资料或线上返回全文写进动画。

## 本地运行和验证

```bash
npm run dev
npm run check
npx --yes hyperframes@0.7.69 keyframes --composition index.html --json
npx --yes hyperframes@0.7.69 snapshot --composition index.html --times 1,10.5,22.5,29,35.5
```

验收标准：

- `npm run check` 没有 error。
- Runtime、Layout、Motion 均为 0 问题。
- 1 秒看到用户输入节点；10 秒 RAG 与 Embedding 账本同步点亮。
- 22 秒 Agent 与 `deepseek-v4-flash` 账本同步点亮。
- 25.5 秒和 28.5 秒两个 Tavily 工具分别点亮。
- 35 秒仍是同一个画布，并显示本轮四类成本汇总。
- 用户在 HyperFrames Studio 预览并确认后，才渲染最终 MP4。
