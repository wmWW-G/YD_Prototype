# Design QA - 赢单 Agent 工作台原型

## Source

- Source visual truth path: `/Users/garden/YD/Prototype/yingdan-agent-lab/agent-thread-prototype/design-qa-source.png`
- Implementation screenshot path: `/Users/garden/YD/Prototype/yingdan-agent-lab/agent-thread-prototype/design-qa-implementation-clean.png`
- Local URL: `http://127.0.0.1:5176/`
- Viewport: `1440 x 1024`
- State: default new conversation workspace, centered assistant lockup and large input composer visible.

## Full-View Comparison Evidence

The implementation was captured with Chrome headless at `1440 x 1024`, so the screenshot contains only the app content and not browser chrome.

The implementation preserves the selected ImageGen direction:

- Left navigation with the 赢单 brand, black/orange accent, and six top-level entries: 新对话、赢单外贸顾问、我的Agent、技能Skill、外接生态、客户Kass.
- Existing Winco Order advisor capabilities are grouped under 赢单外贸顾问 instead of being exposed as a Chatbot label; Skill now has its own top-level entry.
- 外接生态 uses a Codex-like plugin center with search, installed plugin icons, source filters, and categorized plugin rows for 国际站、小满 CRM、Shopify、Apollo.io、Gmail、飞书 and custom MCP tools.
- New conversation uses a simplified Accio-like empty state: centered assistant identity, no top workspace header, no right selection rail, and one large composer.
- Customer Kass uses a sidebar submenu for customer levels and a two-column workspace for customer list and selected customer detail.
- The selected customer detail supports customer-context chat, profile, todos, and task records as child tabs.
- The thread view keeps inquiry source, simplified processing progress, visible safety confirmation, analysis result preview, composer, and customer card.
- Quiet Accio-like desktop density, adapted to 赢单 brand colors and foreign-trade task content.

Focused region comparison was not separately needed because the key fidelity surfaces are visible in the full-view screenshot: sidebar, centered assistant lockup, and large new conversation composer.

## Findings

- No P0/P1/P2 findings remain.

## Required Fidelity Surfaces

- Fonts and typography: system UI Chinese font stack is used with strong black headings, 13-16px operational text, and readable line height. No negative letter spacing or clipped headings observed.
- Spacing and layout rhythm: desktop three-column layout matches the source direction. The composer is fixed near the bottom to keep the Agent input available, which is acceptable for the workbench behavior.
- Colors and visual tokens: black, white, pale warm gray, vivid orange, and restrained green states match the 赢单 logo direction and the generated source.
- Image quality and asset fidelity: the logo uses the real local 赢单 SVG asset copied into `public/assets/yingdan-mark.svg`; icons use `lucide-react` rather than hand-drawn SVG or text placeholders.
- Copy and content: Chinese UI labels reflect the selected product direction: concise new conversation, agent management, external ecosystem, customer Kass, customer-context chat, profile, todos, and task records.

## Patches Made During QA

- Reduced vertical density so the first screen better matches the source visual rhythm.
- Made the bottom composer visible in the desktop viewport.
- Fixed result card height so the composer does not obscure the main result structure.
- Updated document title and language to Chinese.
- Applied browser annotation revisions: `新任务` renamed to `新对话`, Skill / Alibaba / plugin entries merged into `外接生态`, standalone browser plugin nav removed, Tool calls removed from the user-facing UI, the Agent execution timeline simplified, and the right panel changed to a customer card with an AI summary.
- Expanded the prototype into a multi-workspace shell: `新对话`, `我的Agent`, `外接生态`, and `客户Kass`.
- Moved `任务记录` into the selected customer's detail tabs instead of keeping it as a left-nav top-level entry.
- Added customer levels and customer list behavior so clicking a customer changes the detail context.
- Moved customer levels from the main content area into the `客户Kass` sidebar submenu, leaving the main workspace for customer list and customer detail.
- Simplified `新对话`: removed the page header, customer context panel, recommended Agent panel, and quick prompt chips; enlarged the central input experience.
- Added `赢单外贸顾问` as a sidebar group for the existing Winco Order capabilities: 问一下、销售准备 and 成交顾问.
- Added `技能Skill` as a standalone sidebar entry with a Skill library page.
- Reworked `外接生态` from a connection-flow page into a Codex-like plugin/MCP center with search, installed plugin icons, filters, grouped rows, install states, and add actions.

## Follow-up Polish

- P3: The customer-thread composer can later become sticky inside the selected customer detail if long customer histories make scrolling awkward.
- P3: A second responsive pass can tune tablet and narrow desktop layouts if this prototype becomes the base for the Electron UI.

## Final Result

final result: passed
