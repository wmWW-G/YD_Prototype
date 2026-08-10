# 客户开发结果排序 Implementation Plan

> **For Codex:** 按测试驱动方式逐项实现；不要把查询参数直接拼接进 SQL。

**Goal:** 为 PDL 客户开发结果增加默认推荐排序、资料最完整和公司规模三种可切换排序，并给出可解释的推荐依据。

**Architecture:** Python 本地服务在 DuckDB 完整候选集上计算产品相关度、客户类型、可行动性和资料完整度，再分页返回；浏览器只传白名单排序值并展示结果，不在前端重新打乱分页数据。

**Tech Stack:** Python 3、DuckDB、`unittest`、原生 HTML/CSS/JavaScript。

---

### Task 1: 定义排序接口契约

**Files:**
- Modify: `tests/test_pdl_local.py`
- Modify: `customer-development-data-sources/pdl/pdl_local.py`

1. 先写默认排序、白名单校验、完整度排序和规模排序的失败测试。
2. 为 `SearchFilters` 增加 `sort`，只接受 `recommended`、`complete`、`size_desc`。
3. 接口响应回传当前排序值和各评分分项。

### Task 2: 实现 DuckDB 确定性推荐分

**Files:**
- Modify: `customer-development-data-sources/pdl/pdl_local.py`
- Test: `tests/test_pdl_local.py`

1. 产品行业按映射顺序区分核心行业和相关行业。
2. 客户类型有限制时计入角色证据分；不限时把权重让给产品行业。
3. 官网、LinkedIn、所在地、规模、成立时间和行业组成可行动性与完整度分。
4. 同分使用稳定哈希，不回退到公司名称字母顺序。

### Task 3: 接入结果页控件

**Files:**
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Modify: `index.html`
- Modify: `tests/customer-development-flow.test.js`

1. 工具栏增加三项排序控件，默认推荐排序。
2. 切换后直接刷新当前结果，保留页面和已有名单，避免重新播放搜索动画。
3. “线索说明”展示推荐依据；加载中禁用控件并防止旧请求覆盖新结果。

### Task 4: 验证和文档同步

**Files:**
- Modify: `CONTEXT.md`

1. 运行 Python 排序测试和现有前端测试。
2. 启动本地 PDL 服务，在浏览器验证默认排序、三项切换、错误状态和窄屏布局。
3. 用 `git diff --check` 检查格式，并记录实际验证边界。
