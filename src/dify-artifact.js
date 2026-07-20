/* global window */

(function exposeYdArtifactRenderer(globalObject) {
  /**
   * YD Artifact 页面允许执行专用渲染的 fenced code block 语言。
   *
   * 安全边界：
   * - 普通 `html` 代码块仍只显示源码，不会执行。
   * - 只有明确写成 `artifact` / `html-artifact` 的内容才进入沙箱 iframe。
   * - Mermaid 和 ECharts 都转成本站生成的静态 SVG，不执行模型输出的脚本。
   *
   * @type {ReadonlySet<string>}
   */
  const ARTIFACT_LANGUAGES = new Set([
    "mermaid",
    "echarts",
    "svg",
    "ui",
    "yd-ui",
    "artifact",
    "yd-artifact",
    "html-artifact"
  ]);

  /** @type {string[]} */
  const VISUAL_COLORS = ["#5f7185", "#cf744d", "#6f8b78", "#b29458", "#88758d"];
  const MAX_SOURCE_LENGTH = 100000;
  const MAX_SOURCE_PREVIEW_LENGTH = 12000;
  const INTERACTIVE_FRAME_MESSAGE_TYPE = "yd-artifact:resize";
  const INTERACTIVE_FRAME_MIN_HEIGHT = 320;
  const INTERACTIVE_FRAME_MAX_HEIGHT = 900;
  let renderSequence = 0;

  /**
   * 把模型返回的文字转成安全 HTML 文本。
   *
   * @param {unknown} value - 任意模型输出值。
   * @returns {string} 已转义的文本。
   * @throws {Error} 本函数不主动抛异常。
   */
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /**
   * 把数值限制在明确范围内，避免异常模型数据撑破 SVG 或页面。
   *
   * @param {unknown} value - 待限制的值。
   * @param {number} minimum - 最小值。
   * @param {number} maximum - 最大值。
   * @param {number} fallback - 非数字时使用的默认值。
   * @returns {number} 范围内的有限数字。
   * @throws {Error} 本函数不主动抛异常。
   */
  function clampNumber(value, minimum, maximum, fallback) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue)
      ? Math.min(maximum, Math.max(minimum, numberValue))
      : fallback;
  }

  /**
   * 将任意值转换成有限长度的产品文案。
   *
   * @param {unknown} value - 模型输出字段。
   * @param {number} [maximumLength=160] - 最多保留字符数。
   * @returns {string} 去除首尾空白并截断后的文字。
   * @throws {Error} 本函数不主动抛异常。
   */
  function toPlainText(value, maximumLength = 160) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    return text.length > maximumLength ? `${text.slice(0, maximumLength)}…` : text;
  }

  /**
   * 规范 fenced code block 的语言名称。
   *
   * @param {unknown} language - Markdown 代码块语言。
   * @returns {string} 小写语言名；空值返回空字符串。
   * @throws {Error} 本函数不主动抛异常。
   */
  function normalizeArtifactLanguage(language) {
    return String(language || "").trim().toLowerCase().split(/\s+/)[0] || "";
  }

  /**
   * 判断代码块是否需要交给 YD Artifact 渲染器。
   *
   * @param {unknown} language - Markdown 代码块语言。
   * @returns {boolean} 属于受控语言时返回 true。
   * @throws {Error} 本函数不主动抛异常。
   */
  function isArtifactLanguage(language) {
    return ARTIFACT_LANGUAGES.has(normalizeArtifactLanguage(language));
  }

  /**
   * 输出不包含模型原文的安全日志。
   *
   * 为什么不记录 source：模型回答可能包含客户资料，开发日志只需要知道哪种渲染失败。
   *
   * @param {string} language - 当前可视化类型。
   * @param {unknown} error - 解析或渲染错误。
   * @returns {void}
   * @throws {Error} 本函数不主动抛异常。
   */
  function logArtifactFailure(language, error) {
    const message = error instanceof Error ? error.message : String(error || "未知错误");
    globalObject?.console?.warn?.("[yd-artifact] render fallback", { language, message });
  }

  /**
   * 生成 Artifact 卡片头部。
   *
   * @param {string} eyebrow - 类型标签。
   * @param {string} title - 可视化标题。
   * @returns {string} 安全 HTML。
   * @throws {Error} 本函数不主动抛异常。
   */
  function renderArtifactHeader(eyebrow, title) {
    return `
      <header class="yd-artifact-header">
        <span class="yd-artifact-mark" aria-hidden="true">✦</span>
        <div>
          <span class="yd-artifact-eyebrow">${escapeHtml(eyebrow)}</span>
          <strong>${escapeHtml(title)}</strong>
        </div>
        <span class="yd-artifact-live">动态生成</span>
      </header>
    `;
  }

  /**
   * 为可视化保留一个默认收起的源码区。
   *
   * @param {string} source - 原始 Mermaid、JSON、SVG 或 HTML。
   * @param {string} language - 源码语言标签。
   * @returns {string} details HTML；源码为空时返回空字符串。
   * @throws {Error} 本函数不主动抛异常。
   */
  function renderSourceDetails(source, language) {
    const rawSource = String(source || "");
    if (!rawSource.trim()) return "";

    const preview = rawSource.length > MAX_SOURCE_PREVIEW_LENGTH
      ? `${rawSource.slice(0, MAX_SOURCE_PREVIEW_LENGTH)}\n…源码过长，已截断展示`
      : rawSource;

    return `
      <details class="yd-artifact-source">
        <summary>查看生成源码</summary>
        <pre><code class="language-${escapeHtml(language)}">${escapeHtml(preview)}</code></pre>
      </details>
    `;
  }

  /**
   * 渲染统一 Artifact 外壳。
   *
   * @param {{ eyebrow: string, title: string, body: string, source?: string, language?: string, className?: string }} options - 卡片内容。
   * @returns {string} 完整 Artifact HTML。
   * @throws {Error} 本函数不主动抛异常。
   */
  function renderArtifactShell({ eyebrow, title, body, source = "", language = "", className = "" }) {
    return `
      <section class="yd-artifact ${escapeHtml(className)}" data-yd-artifact="${escapeHtml(language || eyebrow)}">
        ${renderArtifactHeader(eyebrow, title)}
        <div class="yd-artifact-viewport">${body}</div>
        ${renderSourceDetails(source, language)}
      </section>
    `;
  }

  /**
   * 在流式代码块尚未闭合时显示稳定骨架，不反复尝试解析半截 JSON/SVG。
   *
   * @param {string} language - 当前代码块语言。
   * @returns {string} 加载骨架 HTML。
   * @throws {Error} 本函数不主动抛异常。
   */
  function renderArtifactLoading(language) {
    const labelMap = {
      mermaid: "正在绘制流程图",
      echarts: "正在整理数据图表",
      svg: "正在生成结构图",
      ui: "正在组合可视化组件",
      "yd-ui": "正在组合可视化组件",
      artifact: "正在构建 Artifact",
      "yd-artifact": "正在构建 Artifact",
      "html-artifact": "正在构建 Artifact"
    };
    const label = labelMap[language] || "正在生成可视化";

    return `
      <section class="yd-artifact yd-artifact-loading" aria-live="polite" aria-label="${escapeHtml(label)}">
        ${renderArtifactHeader("YD Artifact", label)}
        <div class="yd-artifact-skeleton" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
      </section>
    `;
  }

  /**
   * 把无法渲染的视觉块降级为清楚的错误卡片，同时保留可检查源码。
   *
   * @param {string} language - 可视化类型。
   * @param {string} message - 用户可理解的失败原因。
   * @param {string} source - 原始源码。
   * @returns {string} 失败卡片 HTML。
   * @throws {Error} 本函数不主动抛异常。
   */
  function renderArtifactError(language, message, source) {
    return renderArtifactShell({
      eyebrow: "可视化未完成",
      title: "这段内容暂时无法绘制",
      body: `<p class="yd-artifact-error-text">${escapeHtml(message)} 已保留源码，可以继续让 AI 修正这一段。</p>`,
      source,
      language,
      className: "yd-artifact-error"
    });
  }

  /**
   * 生成一个短而稳定的 SVG ID 后缀。
   *
   * @param {string} value - Mermaid 源码。
   * @returns {string} 只包含字母和数字的哈希。
   * @throws {Error} 本函数不主动抛异常。
   */
  function createShortHash(value) {
    let hash = 2166136261;
    for (const character of String(value || "")) {
      hash ^= character.codePointAt(0) || 0;
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0).toString(36);
  }

  /**
   * 从一个 Mermaid 节点片段提取 ID 与可见标签。
   *
   * 支持 Chatflow 提示词约定的 `A["标签"]`、圆括号和判断菱形写法。
   *
   * @param {string} token - 单个节点片段。
   * @returns {{ id: string, label: string } | null} 可识别节点；无 ID 时返回 null。
   * @throws {Error} 本函数不主动抛异常。
   */
  function parseMermaidNodeToken(token) {
    const cleanToken = String(token || "").trim();
    const idMatch = cleanToken.match(/^([A-Za-z0-9_-]+)/);
    if (!idMatch) return null;

    const id = idMatch[1];
    let label = cleanToken.slice(id.length).trim();
    label = label.replace(/^[\[({]+/, "").replace(/[\])}]+$/, "").trim();
    label = label.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_match, doubleQuoted, singleQuoted) => (
      doubleQuoted ?? singleQuoted ?? ""
    ));
    label = label.replace(/<[^>]*>/g, "").trim() || id;

    return { id, label: toPlainText(label, 80) };
  }

  /**
   * 解析 Chatflow 约定的 Mermaid flowchart 子集。
   *
   * @param {string} source - Mermaid 源码。
   * @returns {{ kind: "flowchart", direction: "LR" | "TD", title: string, nodes: Array<{ id: string, label: string }>, edges: Array<{ source: string, target: string }> }} 受控图结构。
   * @throws {Error} 没有有效节点或源码过长时抛出。
   */
  function parseMermaidFlowchart(source) {
    const rawSource = String(source || "");
    if (rawSource.length > MAX_SOURCE_LENGTH) throw new Error("流程图源码超过前端安全上限。");

    const lines = rawSource.replace(/\r\n/g, "\n").split("\n");
    const header = lines.find((line) => /^(?:flowchart|graph)\s+/i.test(line.trim()))?.trim() || "flowchart LR";
    const requestedDirection = header.match(/\s+(LR|RL|TB|TD|BT)\b/i)?.[1]?.toUpperCase() || "LR";
    const direction = ["TB", "TD", "BT"].includes(requestedDirection) ? "TD" : "LR";
    const nodesById = new Map();
    const edges = [];
    let title = "流程与关系";

    /**
     * 新增节点或用显式标签更新旧节点。
     *
     * @param {{ id: string, label: string } | null} node - 待加入节点。
     * @returns {void}
     */
    function rememberNode(node) {
      if (!node || nodesById.size >= 16) return;
      const previous = nodesById.get(node.id);
      nodesById.set(node.id, previous && node.label === node.id ? previous : node);
    }

    lines.forEach((rawLine) => {
      let line = rawLine.replace(/%%.*$/, "").trim();
      if (!line || /^(?:flowchart|graph)\b/i.test(line)) return;
      if (/^title\s+/i.test(line)) {
        title = toPlainText(line.replace(/^title\s+/i, ""), 80) || title;
        return;
      }
      if (/^(?:classDef|class|style|linkStyle|click|subgraph|end|direction)\b/i.test(line)) return;

      // 移除边上的纯文字标签，防止它被误判成节点 ID。
      line = line
        .replace(/\|[^|]*\|/g, "")
        .replace(/--\s+[^\n>-]+?\s+-->/g, "-->");

      const containsEdge = /-->|---|==>|-\.->/.test(line);
      const tokens = containsEdge
        ? line.split(/\s*(?:-->|---|==>|-\.->)\s*/).filter(Boolean)
        : [line];
      const parsedNodes = tokens.map(parseMermaidNodeToken).filter(Boolean);
      parsedNodes.forEach(rememberNode);

      if (containsEdge) {
        for (let index = 0; index < parsedNodes.length - 1 && edges.length < 28; index += 1) {
          edges.push({ source: parsedNodes[index].id, target: parsedNodes[index + 1].id });
        }
      }
    });

    const nodes = [...nodesById.values()];
    if (nodes.length === 0) throw new Error("没有识别到可绘制的 Mermaid 节点。");

    return { kind: "flowchart", direction, title, nodes, edges };
  }

  /**
   * 解析 Mermaid timeline 子集。
   *
   * @param {string} source - timeline 源码。
   * @returns {{ title: string, items: Array<{ label: string, title: string, description: string }> }} 时间线数据。
   * @throws {Error} 没有可用时间点时抛出。
   */
  function parseMermaidTimeline(source) {
    const lines = String(source || "").replace(/\r\n/g, "\n").split("\n");
    let title = "时间线";
    const items = [];

    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line || /^timeline$/i.test(line)) return;
      if (/^title\s+/i.test(line)) {
        title = toPlainText(line.replace(/^title\s+/i, ""), 80) || title;
        return;
      }

      const parts = line.split(":").map((part) => toPlainText(part, 120)).filter(Boolean);
      if (parts.length >= 2 && items.length < 16) {
        items.push({
          label: parts[0],
          title: parts[1],
          description: parts.slice(2).join(" · ")
        });
      }
    });

    if (items.length === 0) throw new Error("没有识别到可绘制的时间节点。");
    return { title, items };
  }

  /**
   * 把 Mermaid mindmap 的缩进关系转换为普通有向图。
   *
   * @param {string} source - mindmap 源码。
   * @returns {ReturnType<typeof parseMermaidFlowchart>} 供统一 SVG 布局使用的节点和边。
   * @throws {Error} 没有可用节点时抛出。
   */
  function parseMermaidMindmap(source) {
    const lines = String(source || "").replace(/\r\n/g, "\n").split("\n");
    const nodes = [];
    const edges = [];
    const parents = [];

    lines.forEach((rawLine) => {
      if (!rawLine.trim() || /^mindmap$/i.test(rawLine.trim())) return;
      const indent = rawLine.match(/^\s*/)?.[0]?.replace(/\t/g, "  ").length || 0;
      const label = toPlainText(
        rawLine.trim().replace(/^[A-Za-z0-9_-]+(?=[\[({])/, "").replace(/^[\[({]+/, "").replace(/[\])}]+$/, ""),
        80
      );
      if (!label || nodes.length >= 16) return;

      const node = { id: `mind-${nodes.length + 1}`, label };
      while (parents.length && parents[parents.length - 1].indent >= indent) parents.pop();
      if (parents.length) edges.push({ source: parents[parents.length - 1].id, target: node.id });
      nodes.push(node);
      parents.push({ id: node.id, indent });
    });

    if (nodes.length === 0) throw new Error("没有识别到可绘制的思维导图节点。");
    return { kind: "flowchart", direction: "LR", title: "结构关系", nodes, edges };
  }

  /**
   * 计算有向图中每个节点的层级。
   *
   * @param {Array<{ id: string }>} nodes - 图节点。
   * @param {Array<{ source: string, target: string }>} edges - 图边。
   * @returns {Map<string, number>} 节点 ID 到非负层级的映射。
   * @throws {Error} 本函数不主动抛异常；循环图会按已有结果和节点顺序兜底。
   */
  function calculateGraphLevels(nodes, edges) {
    const nodeIds = new Set(nodes.map((node) => node.id));
    const indegree = new Map(nodes.map((node) => [node.id, 0]));
    const outgoing = new Map(nodes.map((node) => [node.id, []]));
    const levels = new Map(nodes.map((node) => [node.id, 0]));

    edges.forEach((edge) => {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return;
      indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
      outgoing.get(edge.source)?.push(edge.target);
    });

    const queue = nodes.filter((node) => (indegree.get(node.id) || 0) === 0).map((node) => node.id);
    const visited = new Set();
    while (queue.length) {
      const sourceId = queue.shift();
      if (!sourceId || visited.has(sourceId)) continue;
      visited.add(sourceId);
      (outgoing.get(sourceId) || []).forEach((targetId) => {
        levels.set(targetId, Math.max(levels.get(targetId) || 0, (levels.get(sourceId) || 0) + 1));
        indegree.set(targetId, (indegree.get(targetId) || 0) - 1);
        if ((indegree.get(targetId) || 0) <= 0) queue.push(targetId);
      });
    }

    nodes.forEach((node, index) => {
      if (!visited.has(node.id)) levels.set(node.id, Math.max(levels.get(node.id) || 0, index));
    });
    if (edges.length === 0) nodes.forEach((node, index) => levels.set(node.id, index));
    return levels;
  }

  /**
   * 将长节点标签拆成最多两行，避免 SVG 文字溢出卡片。
   *
   * @param {string} value - 节点标签。
   * @returns {string[]} 一到两行文字。
   * @throws {Error} 本函数不主动抛异常。
   */
  function wrapDiagramLabel(value) {
    const text = toPlainText(value, 44);
    if (text.length <= 14) return [text];

    const breakAt = text.slice(0, 17).lastIndexOf(" ");
    const splitAt = breakAt >= 7 ? breakAt : 14;
    return [text.slice(0, splitAt).trim(), text.slice(splitAt).trim()].filter(Boolean).slice(0, 2);
  }

  /**
   * 把受控 Mermaid 图结构绘制成静态 SVG。
   *
   * @param {ReturnType<typeof parseMermaidFlowchart>} graph - 已解析图结构。
   * @param {string} source - 原始 Mermaid 源码，用于生成稳定 marker ID。
   * @returns {string} 可直接插入 Artifact 卡片的 SVG。
   * @throws {Error} 本函数不主动抛异常。
   */
  function renderMermaidGraphSvg(graph, source) {
    const nodeWidth = 174;
    const nodeHeight = 68;
    const gapPrimary = graph.direction === "LR" ? 92 : 70;
    const gapSecondary = 26;
    const padding = 36;
    const levels = calculateGraphLevels(graph.nodes, graph.edges);
    const groups = new Map();

    graph.nodes.forEach((node) => {
      const level = levels.get(node.id) || 0;
      if (!groups.has(level)) groups.set(level, []);
      groups.get(level).push(node);
    });

    const orderedLevels = [...groups.keys()].sort((left, right) => left - right);
    const levelIndex = new Map(orderedLevels.map((level, index) => [level, index]));
    const primaryCount = Math.max(1, orderedLevels.length);
    const secondaryCount = Math.max(1, ...[...groups.values()].map((items) => items.length));
    const width = graph.direction === "LR"
      ? padding * 2 + primaryCount * nodeWidth + (primaryCount - 1) * gapPrimary
      : padding * 2 + secondaryCount * nodeWidth + (secondaryCount - 1) * gapSecondary;
    const height = graph.direction === "LR"
      ? padding * 2 + secondaryCount * nodeHeight + (secondaryCount - 1) * gapSecondary
      : padding * 2 + primaryCount * nodeHeight + (primaryCount - 1) * gapPrimary;
    const canvasWidth = Math.max(620, width);
    const canvasHeight = Math.max(250, height);
    const positions = new Map();

    orderedLevels.forEach((level) => {
      const items = groups.get(level) || [];
      const primaryIndex = levelIndex.get(level) || 0;
      const groupExtent = items.length * nodeHeight + Math.max(0, items.length - 1) * gapSecondary;
      const groupWidth = items.length * nodeWidth + Math.max(0, items.length - 1) * gapSecondary;

      items.forEach((node, itemIndex) => {
        const x = graph.direction === "LR"
          ? (canvasWidth - width) / 2 + padding + primaryIndex * (nodeWidth + gapPrimary)
          : (canvasWidth - groupWidth) / 2 + itemIndex * (nodeWidth + gapSecondary);
        const y = graph.direction === "LR"
          ? (canvasHeight - groupExtent) / 2 + itemIndex * (nodeHeight + gapSecondary)
          : (canvasHeight - height) / 2 + padding + primaryIndex * (nodeHeight + gapPrimary);
        positions.set(node.id, { x, y });
      });
    });

    renderSequence += 1;
    const markerId = `yd-arrow-${createShortHash(source)}-${renderSequence}`;
    const edgeSvg = graph.edges.map((edge) => {
      const sourcePosition = positions.get(edge.source);
      const targetPosition = positions.get(edge.target);
      if (!sourcePosition || !targetPosition) return "";

      if (graph.direction === "LR") {
        const startX = sourcePosition.x + nodeWidth;
        const startY = sourcePosition.y + nodeHeight / 2;
        const endX = targetPosition.x - 8;
        const endY = targetPosition.y + nodeHeight / 2;
        const middleX = startX + Math.max(24, (endX - startX) / 2);
        return `<path d="M ${startX} ${startY} C ${middleX} ${startY}, ${middleX} ${endY}, ${endX} ${endY}" marker-end="url(#${markerId})"/>`;
      }

      const startX = sourcePosition.x + nodeWidth / 2;
      const startY = sourcePosition.y + nodeHeight;
      const endX = targetPosition.x + nodeWidth / 2;
      const endY = targetPosition.y - 8;
      const middleY = startY + Math.max(20, (endY - startY) / 2);
      return `<path d="M ${startX} ${startY} C ${startX} ${middleY}, ${endX} ${middleY}, ${endX} ${endY}" marker-end="url(#${markerId})"/>`;
    }).join("");

    const nodeSvg = graph.nodes.map((node) => {
      const position = positions.get(node.id);
      if (!position) return "";
      const textLines = wrapDiagramLabel(node.label);
      const firstLineY = position.y + nodeHeight / 2 - (textLines.length - 1) * 10;
      const textSvg = textLines.map((line, index) => (
        `<tspan x="${position.x + nodeWidth / 2}" y="${firstLineY + index * 20}">${escapeHtml(line)}</tspan>`
      )).join("");
      const level = levels.get(node.id) || 0;

      return `
        <g class="yd-artifact-diagram-node tone-${level % 3}">
          <rect x="${position.x}" y="${position.y}" width="${nodeWidth}" height="${nodeHeight}" rx="14"/>
          <text text-anchor="middle" dominant-baseline="middle">${textSvg}</text>
        </g>
      `;
    }).join("");

    return `
      <div class="yd-artifact-diagram-scroll" tabindex="0" role="region" aria-label="${escapeHtml(graph.title)}流程图">
        <svg class="yd-artifact-diagram" viewBox="0 0 ${canvasWidth} ${canvasHeight}" style="min-width:${Math.min(canvasWidth, 1100)}px" role="img" aria-label="${escapeHtml(graph.title)}">
          <defs>
            <marker id="${markerId}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L7,3 z"/>
            </marker>
          </defs>
          <g class="yd-artifact-diagram-edges">${edgeSvg}</g>
          ${nodeSvg}
        </svg>
      </div>
      <p class="yd-artifact-scroll-hint"><span aria-hidden="true">↔</span> 左右滑动查看完整流程</p>
    `;
  }

  /**
   * 渲染时间线 HTML；同时供 Mermaid timeline 和 `ui.timeline` 使用。
   *
   * @param {{ title: string, items: Array<{ label?: unknown, date?: unknown, title?: unknown, description?: unknown }> }} timeline - 时间线数据。
   * @returns {string} 时间线主体 HTML。
   * @throws {Error} 本函数不主动抛异常。
   */
  function renderTimelineBody(timeline) {
    const items = (Array.isArray(timeline.items) ? timeline.items : []).slice(0, 16);
    return `
      <ol class="yd-artifact-timeline">
        ${items.map((item, index) => {
          const label = toPlainText(item.label ?? item.date ?? `${index + 1}`, 40);
          const title = toPlainText(item.title ?? item.name ?? "阶段", 100);
          const description = toPlainText(item.description ?? item.detail ?? "", 240);
          return `
            <li>
              <span class="yd-artifact-timeline-index">${escapeHtml(label)}</span>
              <div><strong>${escapeHtml(title)}</strong>${description ? `<p>${escapeHtml(description)}</p>` : ""}</div>
            </li>
          `;
        }).join("")}
      </ol>
    `;
  }

  /**
   * 根据 Mermaid 首行选择受控解析器并渲染。
   *
   * @param {string} source - 完整 Mermaid 代码块。
   * @returns {string} Artifact HTML。
   * @throws {Error} 语法不在当前支持范围内时抛出，由上层统一降级。
   */
  function renderMermaidArtifact(source) {
    const firstMeaningfulLine = String(source || "").split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";

    if (/^timeline\b/i.test(firstMeaningfulLine)) {
      const timeline = parseMermaidTimeline(source);
      return renderArtifactShell({
        eyebrow: "时间线",
        title: timeline.title,
        body: renderTimelineBody(timeline),
        source,
        language: "mermaid",
        className: "yd-artifact-timeline-shell"
      });
    }

    const graph = /^mindmap\b/i.test(firstMeaningfulLine)
      ? parseMermaidMindmap(source)
      : parseMermaidFlowchart(source);
    return renderArtifactShell({
      eyebrow: "流程图",
      title: graph.title,
      body: renderMermaidGraphSvg(graph, source),
      source,
      language: "mermaid",
      className: "yd-artifact-flow-shell"
    });
  }

  /**
   * 从 ECharts data 项中取得有限数值。
   *
   * @param {unknown} item - 数字或 `{ value }` 对象。
   * @returns {number | null} 有效数值；不可用时返回 null。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getChartNumber(item) {
    const rawValue = item && typeof item === "object" && !Array.isArray(item) ? item.value : item;
    const value = Array.isArray(rawValue) ? rawValue[rawValue.length - 1] : rawValue;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  /**
   * 格式化坐标轴数字，避免长小数挤占图表。
   *
   * @param {number} value - 数值。
   * @returns {string} 紧凑文本。
   * @throws {Error} 本函数不主动抛异常。
   */
  function formatChartNumber(value) {
    const absolute = Math.abs(value);
    if (absolute >= 1000000) return `${(value / 1000000).toFixed(1).replace(/\.0$/, "")}m`;
    if (absolute >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(1).replace(/\.0$/, "");
  }

  /**
   * 将角度和半径转换成 SVG 坐标。
   *
   * @param {number} centerX - 圆心 X。
   * @param {number} centerY - 圆心 Y。
   * @param {number} radius - 半径。
   * @param {number} angle - 角度，0 度指向正上方。
   * @returns {{ x: number, y: number }} SVG 坐标。
   * @throws {Error} 本函数不主动抛异常。
   */
  function polarPoint(centerX, centerY, radius, angle) {
    const radians = (angle - 90) * Math.PI / 180;
    return { x: centerX + radius * Math.cos(radians), y: centerY + radius * Math.sin(radians) };
  }

  /**
   * 生成一个甜甜圈扇区路径。
   *
   * @param {number} centerX - 圆心 X。
   * @param {number} centerY - 圆心 Y。
   * @param {number} outerRadius - 外半径。
   * @param {number} innerRadius - 内半径。
   * @param {number} startAngle - 起始角度。
   * @param {number} endAngle - 结束角度。
   * @returns {string} SVG path d。
   * @throws {Error} 本函数不主动抛异常。
   */
  function createDonutArc(centerX, centerY, outerRadius, innerRadius, startAngle, endAngle) {
    const outerStart = polarPoint(centerX, centerY, outerRadius, endAngle);
    const outerEnd = polarPoint(centerX, centerY, outerRadius, startAngle);
    const innerStart = polarPoint(centerX, centerY, innerRadius, startAngle);
    const innerEnd = polarPoint(centerX, centerY, innerRadius, endAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerStart.x} ${innerStart.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${innerEnd.x} ${innerEnd.y}`,
      "Z"
    ].join(" ");
  }

  /**
   * 渲染 ECharts 饼图配置的安全 SVG 子集。
   *
   * @param {object} option - 已解析 ECharts JSON。
   * @param {object} series - 第一组 pie series。
   * @returns {string} 图表 SVG。
   * @throws {Error} 没有正数数据时抛出。
   */
  function renderPieChartSvg(option, series) {
    const data = (Array.isArray(series.data) ? series.data : [])
      .slice(0, 12)
      .map((item, index) => ({
        name: toPlainText(item?.name ?? `项目 ${index + 1}`, 40),
        value: Math.max(0, getChartNumber(item) ?? 0)
      }))
      .filter((item) => item.value > 0);
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (!total) throw new Error("饼图没有可绘制的正数数据。");

    const title = toPlainText(option?.title?.text ?? series.name ?? "数据占比", 80);
    let currentAngle = 0;
    const arcs = data.map((item, index) => {
      const angle = item.value / total * 360;
      const path = angle >= 359.999
        ? `<circle cx="245" cy="188" r="92" fill="none" stroke="${VISUAL_COLORS[index % VISUAL_COLORS.length]}" stroke-width="42"/>`
        : `<path d="${createDonutArc(245, 188, 113, 72, currentAngle, currentAngle + angle)}" fill="${VISUAL_COLORS[index % VISUAL_COLORS.length]}"/>`;
      currentAngle += angle;
      return path;
    }).join("");
    const legend = data.map((item, index) => `
      <g transform="translate(445 ${105 + index * 30})">
        <rect width="12" height="12" rx="3" fill="${VISUAL_COLORS[index % VISUAL_COLORS.length]}"/>
        <text x="22" y="10">${escapeHtml(item.name)} · ${escapeHtml(formatChartNumber(item.value))}</text>
      </g>
    `).join("");

    return `
      <div class="yd-artifact-chart-scroll" tabindex="0" role="region" aria-label="${escapeHtml(title)}饼图">
        <svg class="yd-artifact-chart" viewBox="0 0 760 380" role="img" aria-label="${escapeHtml(title)}">
          <text class="chart-title" x="38" y="38">${escapeHtml(title)}</text>
          ${arcs}
          <text class="chart-total-label" x="245" y="180" text-anchor="middle">合计</text>
          <text class="chart-total" x="245" y="210" text-anchor="middle">${escapeHtml(formatChartNumber(total))}</text>
          <g class="chart-legend">${legend}</g>
        </svg>
      </div>
      <p class="yd-artifact-scroll-hint"><span aria-hidden="true">↔</span> 左右滑动查看完整图表</p>
    `;
  }

  /**
   * 渲染 ECharts 柱状图/折线图配置的安全 SVG 子集。
   *
   * @param {object} option - 已解析 ECharts JSON。
   * @param {object[]} seriesList - bar/line series。
   * @returns {string} 图表 SVG。
   * @throws {Error} 缺少分类或数值时抛出。
   */
  function renderCartesianChartSvg(option, seriesList) {
    const xAxis = Array.isArray(option.xAxis) ? option.xAxis[0] || {} : option.xAxis || {};
    const categories = (Array.isArray(xAxis.data) ? xAxis.data : [])
      .slice(0, 16)
      .map((item) => toPlainText(item, 24));
    if (categories.length === 0) throw new Error("图表缺少 xAxis.data 分类数据。");

    const normalizedSeries = seriesList.slice(0, 5).map((series, seriesIndex) => ({
      type: String(series.type || "bar").toLowerCase() === "line" ? "line" : "bar",
      name: toPlainText(series.name ?? `系列 ${seriesIndex + 1}`, 32),
      values: categories.map((_category, itemIndex) => getChartNumber(series.data?.[itemIndex]))
    }));
    const numericValues = normalizedSeries.flatMap((series) => series.values).filter((value) => value !== null);
    if (numericValues.length === 0) throw new Error("图表没有可绘制的数值。");

    const minimumValue = Math.min(0, ...numericValues);
    const maximumValue = Math.max(0, ...numericValues);
    const range = maximumValue - minimumValue || 1;
    const title = toPlainText(option?.title?.text ?? normalizedSeries.map((series) => series.name).join(" / "), 80) || "数据图表";
    const plot = { x: 66, y: 72, width: 650, height: 220 };
    const slotWidth = plot.width / categories.length;
    const barSeries = normalizedSeries.filter((series) => series.type === "bar");
    const baselineY = plot.y + plot.height - ((0 - minimumValue) / range * plot.height);
    const grid = Array.from({ length: 5 }, (_item, index) => {
      const ratio = index / 4;
      const y = plot.y + plot.height * ratio;
      const value = maximumValue - range * ratio;
      return `<g><line x1="${plot.x}" y1="${y}" x2="${plot.x + plot.width}" y2="${y}"/><text x="54" y="${y + 4}" text-anchor="end">${escapeHtml(formatChartNumber(value))}</text></g>`;
    }).join("");
    const bars = barSeries.map((series, seriesIndex) => {
      const barWidth = Math.max(6, Math.min(26, slotWidth * 0.68 / Math.max(1, barSeries.length)));
      return series.values.map((value, itemIndex) => {
        if (value === null) return "";
        const valueY = plot.y + plot.height - ((value - minimumValue) / range * plot.height);
        const x = plot.x + itemIndex * slotWidth + slotWidth / 2 - (barSeries.length * barWidth) / 2 + seriesIndex * barWidth;
        const y = Math.min(valueY, baselineY);
        const height = Math.max(1, Math.abs(baselineY - valueY));
        const colorIndex = normalizedSeries.indexOf(series);
        return `<rect x="${x}" y="${y}" width="${Math.max(4, barWidth - 2)}" height="${height}" rx="3" fill="${VISUAL_COLORS[colorIndex % VISUAL_COLORS.length]}"/>`;
      }).join("");
    }).join("");
    const lines = normalizedSeries.filter((series) => series.type === "line").map((series) => {
      const colorIndex = normalizedSeries.indexOf(series);
      const points = series.values.map((value, itemIndex) => {
        if (value === null) return null;
        return {
          x: plot.x + itemIndex * slotWidth + slotWidth / 2,
          y: plot.y + plot.height - ((value - minimumValue) / range * plot.height)
        };
      }).filter(Boolean);
      if (points.length === 0) return "";
      const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
      return `
        <polyline points="${polyline}" fill="none" stroke="${VISUAL_COLORS[colorIndex % VISUAL_COLORS.length]}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
        ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="${VISUAL_COLORS[colorIndex % VISUAL_COLORS.length]}"/>`).join("")}
      `;
    }).join("");
    const labels = categories.map((category, index) => `
      <text x="${plot.x + index * slotWidth + slotWidth / 2}" y="${plot.y + plot.height + 24}" text-anchor="middle">${escapeHtml(toPlainText(category, 10))}</text>
    `).join("");
    const legend = normalizedSeries.map((series, index) => `
      <g transform="translate(${plot.x + index * 128} 348)">
        <rect width="14" height="8" rx="4" fill="${VISUAL_COLORS[index % VISUAL_COLORS.length]}"/>
        <text x="22" y="8">${escapeHtml(series.name)}</text>
      </g>
    `).join("");

    return `
      <div class="yd-artifact-chart-scroll" tabindex="0" role="region" aria-label="${escapeHtml(title)}数据图表">
        <svg class="yd-artifact-chart" viewBox="0 0 760 380" role="img" aria-label="${escapeHtml(title)}">
          <text class="chart-title" x="38" y="38">${escapeHtml(title)}</text>
          <g class="chart-grid">${grid}<line class="chart-baseline" x1="${plot.x}" y1="${baselineY}" x2="${plot.x + plot.width}" y2="${baselineY}"/></g>
          <g class="chart-bars">${bars}</g>
          <g class="chart-lines">${lines}</g>
          <g class="chart-labels">${labels}</g>
          <g class="chart-legend">${legend}</g>
        </svg>
      </div>
      <p class="yd-artifact-scroll-hint"><span aria-hidden="true">↔</span> 左右滑动查看完整图表</p>
    `;
  }

  /**
   * 解析并渲染 Chatflow 约定的 ECharts JSON 子集。
   *
   * @param {string} source - 只包含 JSON 对象的代码块。
   * @returns {string} Artifact HTML。
   * @throws {Error} JSON 损坏、过长或图表类型不支持时抛出。
   */
  function renderEchartsArtifact(source) {
    const rawSource = String(source || "").trim();
    if (rawSource.length > MAX_SOURCE_LENGTH) throw new Error("图表配置超过前端安全上限。");
    const option = JSON.parse(rawSource);
    if (!option || typeof option !== "object" || Array.isArray(option)) throw new Error("ECharts 代码块必须是一个 JSON 对象。");

    const seriesList = (Array.isArray(option.series) ? option.series : []).filter((series) => series && typeof series === "object");
    if (seriesList.length === 0) throw new Error("ECharts 配置缺少 series 数据。");
    const firstPie = seriesList.find((series) => String(series.type || "").toLowerCase() === "pie");
    const supportedCartesian = seriesList.filter((series) => ["bar", "line", ""].includes(String(series.type || "").toLowerCase()));
    const body = firstPie
      ? renderPieChartSvg(option, firstPie)
      : renderCartesianChartSvg(option, supportedCartesian);
    const title = toPlainText(option?.title?.text ?? firstPie?.name ?? "数据图表", 80) || "数据图表";

    return renderArtifactShell({
      eyebrow: firstPie ? "占比图" : "数据图",
      title,
      body,
      source,
      language: "echarts",
      className: "yd-artifact-chart-shell"
    });
  }

  /**
   * 渲染 `ui` 协议中的步骤流程组件。
   *
   * @param {object} payload - LLM 输出的受控组件数据。
   * @returns {string} 组件主体 HTML。
   * @throws {Error} 缺少步骤时抛出。
   */
  function renderUiStepFlow(payload) {
    const steps = (Array.isArray(payload.steps) ? payload.steps : Array.isArray(payload.items) ? payload.items : [])
      .slice(0, 12)
      .map((step, index) => typeof step === "string"
        ? { title: toPlainText(step, 80), description: "" }
        : {
            title: toPlainText(step?.title ?? step?.label ?? `步骤 ${index + 1}`, 80),
            description: toPlainText(step?.description ?? step?.detail ?? step?.subtitle ?? "", 180)
          });
    if (steps.length === 0) throw new Error("step-flow 组件缺少 steps。");

    return `
      <ol class="yd-artifact-step-flow">
        ${steps.map((step, index) => `
          <li>
            <span class="yd-artifact-step-index">${String(index + 1).padStart(2, "0")}</span>
            <div><strong>${escapeHtml(step.title)}</strong>${step.description ? `<p>${escapeHtml(step.description)}</p>` : ""}</div>
            ${index < steps.length - 1 ? `<span class="yd-artifact-step-arrow" aria-hidden="true">→</span>` : ""}
          </li>
        `).join("")}
      </ol>
    `;
  }

  /**
   * 渲染 `ui` 协议中的对比组件。
   *
   * @param {object} payload - LLM 输出的受控组件数据。
   * @returns {string} 组件主体 HTML。
   * @throws {Error} 缺少对比列时抛出。
   */
  function renderUiComparison(payload) {
    const columns = (Array.isArray(payload.columns) ? payload.columns : Array.isArray(payload.items) ? payload.items : [])
      .slice(0, 4);
    if (columns.length < 2) throw new Error("comparison 组件至少需要两列。");

    return `
      <div class="yd-artifact-comparison">
        ${columns.map((column, index) => {
          const title = toPlainText(column?.title ?? column?.label ?? `方案 ${index + 1}`, 80);
          const description = toPlainText(column?.description ?? column?.summary ?? "", 220);
          const items = (Array.isArray(column?.items) ? column.items : Array.isArray(column?.points) ? column.points : [])
            .slice(0, 8)
            .map((item) => toPlainText(typeof item === "string" ? item : item?.text ?? item?.label, 140))
            .filter(Boolean);
          return `
            <section>
              <span class="yd-artifact-column-index">${String(index + 1).padStart(2, "0")}</span>
              <h4>${escapeHtml(title)}</h4>
              ${description ? `<p>${escapeHtml(description)}</p>` : ""}
              ${items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
            </section>
          `;
        }).join("")}
      </div>
    `;
  }

  /**
   * 渲染 `ui` 协议中的指标组件。
   *
   * @param {object} payload - LLM 输出的受控组件数据。
   * @returns {string} 组件主体 HTML。
   * @throws {Error} 缺少指标时抛出。
   */
  function renderUiMetrics(payload) {
    const metrics = (Array.isArray(payload.metrics) ? payload.metrics : Array.isArray(payload.items) ? payload.items : []).slice(0, 8);
    if (metrics.length === 0) throw new Error("metrics 组件缺少 metrics。");

    return `
      <dl class="yd-artifact-metrics">
        ${metrics.map((metric) => {
          const label = toPlainText(metric?.label ?? metric?.title ?? "指标", 60);
          const value = toPlainText(metric?.value ?? metric?.amount ?? "—", 60);
          const note = toPlainText(metric?.note ?? metric?.description ?? "", 140);
          return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>${note ? `<p>${escapeHtml(note)}</p>` : ""}</div>`;
        }).join("")}
      </dl>
    `;
  }

  /**
   * 解析并渲染稳定的 `ui` JSON 组件协议。
   *
   * 支持 step-flow、comparison、metrics 和 timeline；未知组件不会执行任意 HTML。
   *
   * @param {string} source - JSON 代码块。
   * @returns {string} Artifact HTML。
   * @throws {Error} JSON 损坏、过长或组件类型未知时抛出。
   */
  function renderUiArtifact(source) {
    const rawSource = String(source || "").trim();
    if (rawSource.length > MAX_SOURCE_LENGTH) throw new Error("UI 组件数据超过前端安全上限。");
    const payload = JSON.parse(rawSource);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("ui 代码块必须是一个 JSON 对象。");

    const component = String(payload.component ?? payload.type ?? "").trim().toLowerCase();
    const title = toPlainText(payload.title ?? payload.heading ?? "可视化说明", 100) || "可视化说明";
    let body;
    let eyebrow;

    if (["step-flow", "steps", "flow"].includes(component)) {
      body = renderUiStepFlow(payload);
      eyebrow = "步骤流程";
    } else if (["comparison", "compare"].includes(component)) {
      body = renderUiComparison(payload);
      eyebrow = "方案对比";
    } else if (["metrics", "metric-grid", "stats", "stat-grid"].includes(component)) {
      body = renderUiMetrics(payload);
      eyebrow = "关键指标";
    } else if (component === "timeline") {
      const items = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.steps) ? payload.steps : [];
      if (items.length === 0) throw new Error("timeline 组件缺少 items。");
      body = renderTimelineBody({ title, items });
      eyebrow = "时间线";
    } else {
      throw new Error(`暂不支持组件类型「${component || "未填写"}」。`);
    }

    return renderArtifactShell({
      eyebrow,
      title,
      body,
      source,
      language: "ui",
      className: `yd-artifact-ui yd-artifact-ui-${escapeHtml(component || "unknown")}`
    });
  }

  /**
   * 移除 XML namespace 声明，避免把标准 SVG 的命名空间误判成外部网址。
   *
   * namespace 本身只是语法标识，不会触发网络请求；真正的资源引用仍由后续检查处理。
   *
   * @param {string} source - HTML 或 SVG 源码。
   * @returns {string} 移除 namespace 属性后的源码。
   * @throws {Error} 本函数不主动抛异常。
   */
  function stripXmlNamespaceDeclarations(source) {
    return String(source || "").replace(
      /\s+xmlns(?::[a-z][\w.-]*)?\s*=\s*(?:"[^"]*"|'[^']*')/gi,
      ""
    );
  }

  /**
   * 检查交互式 HTML 是否仍局限在当前沙箱内部。
   *
   * 这层检查不是用正则代替浏览器安全模型；真正的隔离仍依赖 opaque-origin sandbox 与 CSP。
   * 它的作用是提前拒绝模型最常见的外链、联网、跳转和动态执行写法，让失败可见且可修正。
   *
   * @param {string} source - 完整 HTML Artifact 源码。
   * @returns {void}
   * @throws {Error} 内容为空、过长或包含越界能力时抛出。
   */
  function assertSafeInteractiveHtml(source) {
    const rawSource = String(source || "").trim();
    if (!rawSource) throw new Error("HTML Artifact 内容为空。");
    if (rawSource.length > MAX_SOURCE_LENGTH) throw new Error("HTML Artifact 超过前端安全上限。");
    if (!/<[a-z][\s\S]*>/i.test(rawSource)) throw new Error("HTML Artifact 缺少可渲染的 HTML 元素。");

    if (/<\/?(?:iframe|frame|object|embed|applet)\b/i.test(rawSource)) {
      throw new Error("HTML Artifact 不允许继续嵌入其它页面或插件。");
    }
    if (/<base\b/i.test(rawSource) || /<meta\b[^>]*http-equiv\s*=\s*["']?refresh/i.test(rawSource)) {
      throw new Error("HTML Artifact 不允许修改基础地址或自动跳转。");
    }

    // 静态资源属性只允许页内锚点和内联 data 图片。相对路径也会发起请求，因此同样拒绝。
    const sourceWithoutNamespaces = stripXmlNamespaceDeclarations(rawSource);
    const resourceAttributePattern = /\s(?:src|href|xlink:href|action|formaction)\s*=\s*(["'])([\s\S]*?)\1/gi;
    for (const match of sourceWithoutNamespaces.matchAll(resourceAttributePattern)) {
      const value = String(match[2] || "").trim();
      if (!value || value.startsWith("#") || /^data:image\//i.test(value)) continue;
      throw new Error("HTML Artifact 不允许加载外部资源或提交到其它地址。");
    }

    // CSS url() 只能引用内联图片或当前文档片段；@import 始终会触发外部加载。
    if (/@import\b/i.test(sourceWithoutNamespaces)) {
      throw new Error("HTML Artifact 不允许通过 CSS 加载外部样式。");
    }
    for (const match of sourceWithoutNamespaces.matchAll(/url\(\s*(["']?)([^)'\"]+)\1\s*\)/gi)) {
      const value = String(match[2] || "").trim();
      if (value.startsWith("#") || /^data:image\//i.test(value)) continue;
      throw new Error("HTML Artifact 不允许通过 CSS 加载外部资源。");
    }

    const forbiddenRuntimePatterns = [
      /\bfetch\s*\(/i,
      /\b(?:XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|SharedWorker|Worker)\b/i,
      /\b(?:serviceWorker|localStorage|sessionStorage|indexedDB)\b/i,
      /\b(?:parent|top|opener)\s*\./i,
      /\bpostMessage\s*\(/i,
      /\bwindow\s*\.\s*open\s*\(/i,
      /\blocation\s*(?:\.|=)/i,
      /\beval\s*\(/i,
      /\bnew\s+Function\b/i
    ];
    if (forbiddenRuntimePatterns.some((pattern) => pattern.test(sourceWithoutNamespaces))) {
      throw new Error("HTML Artifact 包含不允许的联网、跳转、跨页面或动态执行能力。");
    }
  }

  /**
   * 检查 SVG 是否符合静态、无外部资源的最小安全约束。
   *
   * 真正的隔离仍由 sandbox iframe + CSP 提供；这里用于提前拒绝明显的脚本、事件和远程资源。
   *
   * @param {string} source - 完整 SVG。
   * @returns {void}
   * @throws {Error} 包含危险标签、事件属性、JavaScript URL 或远程资源时抛出。
   */
  function assertSafeSvg(source) {
    const rawSource = String(source || "");
    if (rawSource.length > MAX_SOURCE_LENGTH) throw new Error("SVG 超过前端安全上限。");
    if (!/<svg\b/i.test(rawSource)) throw new Error("SVG 代码块缺少完整的 svg 根元素。");
    if (/<\/?(?:script|foreignObject|iframe|object|embed|audio|video)\b/i.test(rawSource)) throw new Error("SVG 包含不允许的可执行或嵌入元素。");
    if (/\son[a-z]+\s*=/i.test(rawSource) || /javascript\s*:/i.test(rawSource)) throw new Error("SVG 包含不允许的事件或脚本 URL。");

    // 完整 SVG 通常会包含 `xmlns="http://www.w3.org/2000/svg"`。命名空间只是语法标识，
    // 浏览器不会因此发起网络请求，因此先移除 namespace 声明，再检查真正可能加载资源的 URL。
    // 这样能兼容 Dify/LLM 输出的标准 SVG，同时仍拒绝 href、CSS url() 和图片资源。
    const sourceWithoutXmlNamespaces = stripXmlNamespaceDeclarations(rawSource);
    if (/(?:https?:)?\/\//i.test(sourceWithoutXmlNamespaces) || /<image\b/i.test(rawSource)) {
      throw new Error("SVG 不允许加载外部图片或远程资源。");
    }
    for (const match of sourceWithoutXmlNamespaces.matchAll(/\s(?:href|xlink:href)\s*=\s*(["'])([\s\S]*?)\1/gi)) {
      if (!String(match[2] || "").trim().startsWith("#")) {
        throw new Error("SVG 不允许加载外部图片或远程资源。");
      }
    }
  }

  /**
   * 根据 SVG viewBox 估算 iframe 高度。
   *
   * @param {string} source - SVG 源码。
   * @returns {number} 240 到 520 像素之间的高度。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getSvgFrameHeight(source) {
    const match = String(source || "").match(/viewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
    if (!match) return 360;
    const width = clampNumber(match[1], 1, 10000, 760);
    const height = clampNumber(match[2], 1, 10000, 360);
    return Math.round(clampNumber(760 / width * height, 240, 520, 360));
  }

  /**
   * 为交互式 iframe 生成只含安全字符的唯一标识。
   *
   * 同一轮流式渲染可能出现多个 Artifact；序号避免相同源码对应到错误的 iframe。
   *
   * @param {string} source - HTML Artifact 源码。
   * @returns {string} 可安全写入 data 属性和桥接消息的标识。
   * @throws {Error} 本函数不主动抛异常。
   */
  function createInteractiveFrameId(source) {
    renderSequence += 1;
    return `yd-artifact-frame-${createShortHash(source)}-${renderSequence}`;
  }

  /**
   * 生成运行在 opaque-origin iframe 内的最小宿主桥接脚本。
   *
   * 这段脚本只负责三件事：阻止链接和表单离开沙箱、观察内容高度、把高度回报给父页面。
   * 它不读取父页面数据，也不向 Artifact 暴露任何宿主 API。
   *
   * @param {string} frameId - 当前 iframe 的唯一标识。
   * @returns {string} 可写入 sandbox 文档 head 的内联脚本。
   * @throws {Error} 本函数不主动抛异常。
   */
  function createInteractiveBridgeScript(frameId) {
    const safeFrameId = String(frameId || "").replace(/[^a-z0-9-]/gi, "").slice(0, 100);
    return `
      (function ydArtifactSandboxBridge() {
        "use strict";
        var frameId = ${JSON.stringify(safeFrameId)};
        var messageType = ${JSON.stringify(INTERACTIVE_FRAME_MESSAGE_TYPE)};
        var scheduledFrame = 0;
        var previousHeight = 0;

        function clampHeight(value) {
          var numericValue = Number(value) || ${INTERACTIVE_FRAME_MIN_HEIGHT};
          return Math.min(${INTERACTIVE_FRAME_MAX_HEIGHT}, Math.max(${INTERACTIVE_FRAME_MIN_HEIGHT}, numericValue));
        }

        function reportHeight() {
          scheduledFrame = 0;
          var root = document.documentElement;
          var body = document.body;
          var measuredHeight = Math.ceil(Math.max(
            root ? root.scrollHeight : 0,
            root ? root.offsetHeight : 0,
            body ? body.scrollHeight : 0,
            body ? body.offsetHeight : 0
          ));
          var nextHeight = clampHeight(measuredHeight + 2);
          if (Math.abs(nextHeight - previousHeight) < 2) return;
          previousHeight = nextHeight;
          window.parent.postMessage({ type: messageType, frameId: frameId, height: nextHeight }, "*");
        }

        function scheduleHeightReport() {
          if (scheduledFrame) window.cancelAnimationFrame(scheduledFrame);
          scheduledFrame = window.requestAnimationFrame(reportHeight);
        }

        // 本地表单的 JavaScript 处理器仍会运行，但浏览器默认提交永远被阻止。
        document.addEventListener("submit", function preventArtifactSubmit(event) {
          event.preventDefault();
          scheduleHeightReport();
        }, true);

        // 链接点击可以触发同页 JavaScript，但不能把 iframe 导航到其它地址。
        document.addEventListener("click", function preventArtifactNavigation(event) {
          var node = event.target;
          while (node && node !== document) {
            if (node.tagName === "A" && node.hasAttribute("href")) {
              event.preventDefault();
              break;
            }
            node = node.parentNode;
          }
          scheduleHeightReport();
        }, true);

        document.addEventListener("input", scheduleHeightReport, true);
        document.addEventListener("change", scheduleHeightReport, true);
        window.addEventListener("load", scheduleHeightReport);
        window.addEventListener("resize", scheduleHeightReport);

        document.addEventListener("DOMContentLoaded", function startArtifactObserver() {
          if (typeof ResizeObserver === "function") {
            var observer = new ResizeObserver(scheduleHeightReport);
            observer.observe(document.documentElement);
            if (document.body) observer.observe(document.body);
          }
          scheduleHeightReport();
        });
      }());
    `;
  }

  /**
   * 接收交互式 Artifact 的高度消息，并只更新消息来源对应的 iframe。
   *
   * `event.source === frame.contentWindow` 是关键校验：其它页面即使猜中 frameId，
   * 也不能借此修改任意 iframe。高度再次限幅，避免模型内容撑破整个工作区。
   *
   * @param {MessageEvent | { data?: unknown, source?: unknown }} event - 浏览器 message 事件。
   * @returns {void}
   * @throws {Error} 本函数不主动抛异常。
   */
  function handleInteractiveArtifactMessage(event) {
    const data = event?.data;
    if (!data || typeof data !== "object" || data.type !== INTERACTIVE_FRAME_MESSAGE_TYPE) return;

    const frameId = String(data.frameId || "");
    if (!/^yd-artifact-frame-[a-z0-9-]+$/i.test(frameId)) return;
    const documentObject = globalObject?.document;
    if (!documentObject?.querySelector) return;

    const frame = documentObject.querySelector(`[data-yd-artifact-frame="${frameId}"]`);
    if (!frame || event.source !== frame.contentWindow) return;

    const height = Math.round(clampNumber(
      data.height,
      INTERACTIVE_FRAME_MIN_HEIGHT,
      INTERACTIVE_FRAME_MAX_HEIGHT,
      480
    ));
    frame.style.height = `${height}px`;
    frame.dataset.ydArtifactReady = "true";
  }

  let interactiveBridgeBound = false;

  /**
   * 在宿主页面上只绑定一次 iframe 自适应高度监听器。
   *
   * @returns {boolean} 已绑定或本次成功绑定时返回 true；非浏览器环境返回 false。
   * @throws {Error} 本函数不主动抛异常。
   */
  function bindInteractiveArtifactBridge() {
    if (interactiveBridgeBound) return true;
    if (typeof globalObject?.addEventListener !== "function") return false;
    globalObject.addEventListener("message", handleInteractiveArtifactMessage);
    interactiveBridgeBound = true;
    return true;
  }

  /**
   * 生成只允许本地资源的沙箱文档。
   *
   * @param {string} content - SVG 或显式 HTML Artifact。
   * @param {"svg" | "html"} kind - 内容类型。
   * @param {{ frameId?: string }} [options] - HTML iframe 的宿主桥接配置。
   * @returns {string} 完整 srcdoc 文档。
   * @throws {Error} 本函数不主动抛异常。
   */
  function createSandboxDocument(content, kind, options = {}) {
    const isInteractiveHtml = kind === "html";
    const baseStyle = kind === "svg"
      ? "html,body{margin:0;min-height:100%;background:#fbfaf6}body{display:grid;place-items:center;padding:16px;box-sizing:border-box}svg{display:block;max-width:100%;height:auto}"
      : "html,body{margin:0;min-height:100%;overflow-x:hidden;background:#fbfaf6;color:#2e2b27;font-family:system-ui,sans-serif;color-scheme:light}body{padding:24px;box-sizing:border-box}*{box-sizing:border-box}a{color:#a9512b}button,input,select,textarea{font:inherit}button,select,input:not([type=checkbox]):not([type=radio]),textarea{min-height:44px}:focus-visible{outline:2px solid #cf744d;outline-offset:2px}@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;transition-duration:.01ms!important}}";
    const contentSecurityPolicy = isInteractiveHtml
      ? "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; script-src 'unsafe-inline'; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; child-src 'none'; form-action 'none'; base-uri 'none'"
      : "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; script-src 'none'; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; child-src 'none'; form-action 'none'; base-uri 'none'";
    const bridgeScript = isInteractiveHtml
      ? `<script>${createInteractiveBridgeScript(options.frameId || "")}</script>`
      : "";

    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}"><style>${baseStyle}</style>${bridgeScript}</head><body>${content}</body></html>`;
  }

  /**
   * 将 SVG 放进无脚本、无同源权限的 iframe。
   *
   * @param {string} source - 完整静态 SVG。
   * @returns {string} Artifact HTML。
   * @throws {Error} SVG 安全检查失败时抛出。
   */
  function renderSvgArtifact(source) {
    assertSafeSvg(source);
    const height = getSvgFrameHeight(source);
    const srcdoc = createSandboxDocument(source, "svg");
    const body = `<iframe class="yd-artifact-sandbox" sandbox="" title="AI 生成的 SVG 结构图" srcdoc="${escapeHtml(srcdoc)}" style="height:${height}px"></iframe>`;

    return renderArtifactShell({
      eyebrow: "结构图",
      title: "可视化说明",
      body,
      source,
      language: "svg",
      className: "yd-artifact-svg-shell"
    });
  }

  /**
   * 将显式 HTML Artifact 放进可运行本地 JavaScript 的隔离 iframe。
   *
   * sandbox 只授予 `allow-scripts`：不授予 same-origin、表单、弹窗、下载或顶层导航权限。
   * CSP 同时阻断网络、外部资源、Worker、子 frame 和动态 eval；脚本只能操作 iframe 自己的 DOM。
   *
   * @param {string} source - HTML 片段或单页文档。
   * @returns {string} Artifact HTML。
   * @throws {Error} 内容为空、过长或包含越界能力时抛出。
   */
  function renderHtmlArtifact(source) {
    const rawSource = String(source || "").trim();
    assertSafeInteractiveHtml(rawSource);
    const frameId = createInteractiveFrameId(rawSource);
    const srcdoc = createSandboxDocument(rawSource, "html", { frameId });
    const body = `<iframe class="yd-artifact-sandbox yd-artifact-html-frame" sandbox="allow-scripts" allow="" referrerpolicy="no-referrer" loading="lazy" data-yd-artifact-frame="${escapeHtml(frameId)}" title="AI 生成的交互式 HTML Artifact" srcdoc="${escapeHtml(srcdoc)}"></iframe>`;

    return renderArtifactShell({
      eyebrow: "交互式 HTML Artifact",
      title: "交互内容预览",
      body,
      source,
      language: "html",
      className: "yd-artifact-html-shell"
    });
  }

  /**
   * 供 Markdown 渲染器调用的统一代码块适配入口。
   *
   * @param {{ language?: unknown, code?: unknown, isComplete?: boolean }} block - 语言、源码和 fenced block 是否闭合。
   * @returns {string | null} 专用 Artifact HTML；不是受控语言时返回 null，让普通 Markdown 继续渲染代码。
   * @throws {Error} 所有渲染错误都在本函数内降级，不继续影响整轮回答。
   */
  function renderArtifactCodeBlock({ language, code, isComplete = true } = {}) {
    const normalizedLanguage = normalizeArtifactLanguage(language);
    if (!isArtifactLanguage(normalizedLanguage)) return null;
    if (!isComplete) return renderArtifactLoading(normalizedLanguage);

    const source = String(code || "");
    try {
      if (normalizedLanguage === "mermaid") return renderMermaidArtifact(source);
      if (normalizedLanguage === "echarts") return renderEchartsArtifact(source);
      if (normalizedLanguage === "svg") return renderSvgArtifact(source);
      if (normalizedLanguage === "ui" || normalizedLanguage === "yd-ui") return renderUiArtifact(source);
      return renderHtmlArtifact(source);
    } catch (error) {
      logArtifactFailure(normalizedLanguage, error);
      return renderArtifactError(
        normalizedLanguage,
        error instanceof Error ? error.message : "模型返回的可视化格式不完整。",
        source
      );
    }
  }

  const publicApi = {
    ARTIFACT_LANGUAGES: Object.freeze([...ARTIFACT_LANGUAGES]),
    createSandboxDocument,
    isArtifactLanguage,
    normalizeArtifactLanguage,
    parseMermaidFlowchart,
    parseMermaidTimeline,
    renderArtifactCodeBlock,
    renderEchartsArtifact,
    renderHtmlArtifact,
    renderMermaidArtifact,
    renderSvgArtifact,
    renderUiArtifact
  };

  // 浏览器环境在模块载入时建立一次高度桥接；Node 测试环境没有 addEventListener，会安全跳过。
  bindInteractiveArtifactBridge();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = publicApi;
  }

  if (globalObject) {
    globalObject.YD_ARTIFACT = publicApi;
  }
}(typeof window !== "undefined" ? window : globalThis));
