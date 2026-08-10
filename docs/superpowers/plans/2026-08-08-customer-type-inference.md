# PDL Customer Type Inference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an accurate-first, evidence-backed customer-type inference and ranking flow for the local PDL company search without crawling websites, calling an LLM, or claiming verified company roles.

**Architecture:** The Python + DuckDB service owns the 20-role allowlist, computes role and product scores across the full country candidate set, and returns structured evidence. The static frontend sends product industries and the selected role separately, then renders confidence labels and evidence without overwriting PDL's original industry. Existing company import, contact-source boundaries, and the 500-row response cap remain unchanged.

**Tech Stack:** Python 3.11, DuckDB, Python `unittest`, vanilla JavaScript, CSS, Node.js `node:test`.

## Global Constraints

- Do not crawl company websites, LinkedIn, or any third-party page.
- Do not call an LLM or add an external package/API.
- Do not invent customer types, contacts, emails, phone numbers, product catalogs, or purchasing intent.
- `country` remains an exact filter; customer type is an optional ranking preference, not a hard guarantee.
- “High confidence” requires both an industry evidence family and a name/domain evidence family.
- Name and domain matches are one evidence family and cannot be double-counted.
- Medium-support roles can never exceed “possible”; unsupported roles always remain “unknown”.
- Keep the API response cap at 500 companies.
- Preserve the PDL `industry` field and show inference separately.
- Keep all query values allowlisted or parameter-bound; never concatenate user input into SQL or regex.
- The worktree already contains unrelated and overlapping unstaged changes. Never revert them. Do not commit an implementation task if staging the touched file would include pre-existing changes outside that task; leave the changes unstaged and report the skipped commit.

---

## File Structure

- Modify `customer-development-data-sources/pdl/pdl_local.py`: role profiles, pure evidence evaluator, ranked DuckDB query, query parsing, and JSON response fields.
- Modify `tests/test_pdl_local.py`: deterministic role-scoring, sorting, unsupported-role, validation, and HTTP response tests.
- Modify `src/data.js`: add the optional “不限 / 智能推荐” choice while preserving the existing 20 business roles.
- Modify `src/app.js`: send product industries and role separately, normalize inference fields, and render labels/evidence/counts.
- Modify `src/styles.css`: confidence badges, summary counts, evidence presentation, and responsive table sizing.
- Modify `index.html`: bump the local app/style cache version after frontend behavior changes.
- Modify `tests/customer-development-flow.test.js`: static contract tests for the role parameter, copy boundaries, badges, and cache version.
- Modify `CONTEXT.md`: record the implemented ranking semantics and verification commands only after runtime verification passes.

---

### Task 1: Define and Test the Customer-Role Evidence Model

**Files:**
- Modify: `tests/test_pdl_local.py`
- Modify: `customer-development-data-sources/pdl/pdl_local.py`

**Interfaces:**
- Produces: `RoleProfile`, `RoleMatch`, `CUSTOMER_ROLE_PROFILES`, `NO_ROLE_PREFERENCE`, and `infer_customer_role(company: Mapping[str, object], requested_role: str) -> RoleMatch`.
- `RoleMatch.to_dict()` returns `requested_role`, `role_support`, `role_match_score`, `role_match_level`, `role_match_label`, `role_match_evidence`, and `role_verified`.
- Later tasks use the exact 20 role keys already defined in `CUSTOMER_DEVELOPMENT.customerTypes`.

- [x] **Step 1: Add failing tests for role coverage and confidence boundaries**

Import the new symbols in `tests/test_pdl_local.py` and add tests equivalent to:

```python
from pdl_local import (  # noqa: E402
    CUSTOMER_ROLE_PROFILES,
    NO_ROLE_PREFERENCE,
    PdlDataError,
    PdlRequestHandler,
    PdlStore,
    SearchFilters,
    import_dataset,
    infer_customer_role,
    parse_search_filters,
)

EXPECTED_CUSTOMER_ROLES = {
    "进口商", "批发商", "分销商", "经销商", "代理商", "贸易公司",
    "品牌商", "制造商", "OEM / ODM 采购商", "零售商", "连锁零售商",
    "电商卖家", "工程承包商", "EPC 承包商", "系统集成商", "项目开发商",
    "采购服务商", "最终用户企业", "政府 / 公共机构", "设计院 / 顾问公司",
}

def test_role_profiles_cover_every_customer_type(self) -> None:
    self.assertEqual(set(CUSTOMER_ROLE_PROFILES), EXPECTED_CUSTOMER_ROLES)

def test_high_confidence_requires_industry_and_identity_evidence(self) -> None:
    high = infer_customer_role(
        {"name": "Solar Distribution GmbH", "website": "solar-distribution.de", "industry": "wholesale"},
        "分销商",
    )
    industry_only = infer_customer_role(
        {"name": "Solar Beispiel GmbH", "website": "solar-beispiel.de", "industry": "wholesale"},
        "分销商",
    )
    self.assertEqual(high.level, "high")
    self.assertEqual(high.score, 85)
    self.assertEqual(len(high.evidence), 2)
    self.assertEqual(industry_only.level, "medium")
    self.assertEqual(industry_only.score, 45)

def test_name_and_domain_are_one_evidence_family(self) -> None:
    match = infer_customer_role(
        {"name": "Example Distribution", "website": "example-distribution.com", "industry": None},
        "分销商",
    )
    self.assertEqual(match.score, 40)
    self.assertEqual(match.level, "weak")

def test_unsupported_role_never_claims_a_match(self) -> None:
    match = infer_customer_role(
        {"name": "Example Brands", "website": "example-brands.com", "industry": "retail"},
        "品牌商",
    )
    self.assertEqual(match.support, "none")
    self.assertEqual(match.score, 0)
    self.assertEqual(match.level, "unknown")
    self.assertFalse(match.verified)
```

- [x] **Step 2: Run the focused tests and verify they fail for missing symbols**

Run:

```bash
customer-development-data-sources/pdl/.venv/bin/python -m unittest \
  tests.test_pdl_local.PdlLocalTest.test_role_profiles_cover_every_customer_type \
  tests.test_pdl_local.PdlLocalTest.test_high_confidence_requires_industry_and_identity_evidence \
  tests.test_pdl_local.PdlLocalTest.test_name_and_domain_are_one_evidence_family \
  tests.test_pdl_local.PdlLocalTest.test_unsupported_role_never_claims_a_match -v
```

Expected: import errors for the new role-matching symbols.

- [x] **Step 3: Implement immutable profiles and the pure evaluator**

Add fully documented dataclasses and constants near `SearchFilters` in `pdl_local.py`:

```python
from typing import Literal, Mapping

RoleSupport = Literal["high", "medium", "none"]
RoleLevel = Literal["high", "medium", "weak", "unknown"]
NO_ROLE_PREFERENCE = "不限 / 智能推荐"

@dataclasses.dataclass(frozen=True)
class RoleProfile:
    support: RoleSupport
    industries: tuple[str, ...] = ()
    strong_terms: tuple[str, ...] = ()
    weak_terms: tuple[str, ...] = ()
    conflict_terms: tuple[str, ...] = ()
    industry_terms: tuple[str, ...] = ()

@dataclasses.dataclass(frozen=True)
class RoleMatch:
    requested_role: str
    support: RoleSupport
    score: int
    level: RoleLevel
    label: str
    evidence: tuple[dict[str, str], ...]
    verified: bool = False

    def to_dict(self) -> dict[str, object]:
        return {
            "requested_role": self.requested_role,
            "role_support": self.support,
            "role_match_score": self.score,
            "role_match_level": self.level,
            "role_match_label": self.label,
            "role_match_evidence": list(self.evidence),
            "role_verified": self.verified,
        }
```

Define all 20 profiles exactly once. Use these support groups and exact profile keys:

```python
CUSTOMER_ROLE_PROFILES = {
    "进口商": RoleProfile("high", ("import and export", "international trade and development"), ("importer", "imports", "import/export", "importadora", "importaciones", "importateur", "进出口")),
    "批发商": RoleProfile("high", ("wholesale",), ("wholesale", "wholesaler", "cash and carry", "mayorista", "atacado", "grosshandel", "批发")),
    "分销商": RoleProfile("high", ("wholesale", "import and export"), ("distributor", "distribution", "distributora", "distribuidora", "distributeur", "分销"), conflict_terms=("manufacturer", "manufacturing", "factory", "制造", "工厂")),
    "经销商": RoleProfile("high", ("wholesale", "retail"), ("dealer", "dealership", "authorized dealer", "经销"), conflict_terms=("manufacturer", "manufacturing", "factory", "制造", "工厂")),
    "代理商": RoleProfile("medium", ("wholesale", "import and export"), ("authorized agent", "sales agent", "representative", "代理"), ("agency",)),
    "贸易公司": RoleProfile("high", ("import and export", "international trade and development"), ("trading", "trading company", "commercial trading", "comercializadora", "贸易")),
    "品牌商": RoleProfile("none", weak_terms=("brand", "brands", "品牌")),
    "制造商": RoleProfile("high", (), ("manufacturer", "manufacturing", "factory", "works", "fabrication", "制造", "工厂"), industry_terms=("manufacturing", "production")),
    "OEM / ODM 采购商": RoleProfile("none", weak_terms=("oem", "odm")),
    "零售商": RoleProfile("high", ("retail", "supermarkets"), ("retailer", "retail", "store", "supermarket", "hypermarket", "零售", "超市")),
    "连锁零售商": RoleProfile("medium", ("retail", "supermarkets"), ("retail chain", "chain stores", "retail group", "supermarket group", "连锁"), ("stores", "group")),
    "电商卖家": RoleProfile("medium", ("retail", "internet"), ("ecommerce", "e-commerce", "online store", "online shop", "marketplace", "电商")),
    "工程承包商": RoleProfile("high", ("construction", "civil engineering"), ("contractor", "contracting", "engineering and construction", "工程承包")),
    "EPC 承包商": RoleProfile("high", ("construction", "civil engineering", "mechanical or industrial engineering"), ("epc", "engineering procurement construction", "turnkey contractor")),
    "系统集成商": RoleProfile("high", ("industrial automation", "information technology and services"), ("system integrator", "systems integration", "integration services", "系统集成")),
    "项目开发商": RoleProfile("medium", ("renewables & environment", "real estate", "construction"), ("project developer", "project development", "development projects", "项目开发")),
    "采购服务商": RoleProfile("medium", ("logistics and supply chain", "outsourcing/offshoring"), ("procurement services", "sourcing company", "buying office", "purchasing services", "采购服务")),
    "最终用户企业": RoleProfile("none"),
    "政府 / 公共机构": RoleProfile("high", ("government administration", "public policy", "public safety"), ("government", "ministry", "municipality", "city council", "public authority", "政府", "市政")),
    "设计院 / 顾问公司": RoleProfile("high", ("architecture & planning", "civil engineering", "design", "management consulting"), ("design institute", "consulting engineers", "engineering consultant", "architects", "设计院", "顾问")),
}
```

Implement term-boundary matching with `re.escape`; name and domain share a single identity score. Industry evidence matches either the exact `industries` allowlist or one of the canonical fragments in `industry_terms`; the latter is required for values such as `electrical/electronic manufacturing`. Apply `+45` industry, `+40` strong name, otherwise `+25` strong domain, otherwise `+10` weak identity, and `-40` conflict. Clamp to `0..100`. Force missing-industry text-only results to at most `weak`; cap medium profiles at score 74/level medium; force none profiles to score 0/unknown.

- [x] **Step 4: Run the role model tests**

Run the four focused tests from Step 2.

Expected: all four pass.

- [x] **Step 5: Review staging safety before commit**

Run:

```bash
git diff -- tests/test_pdl_local.py customer-development-data-sources/pdl/pdl_local.py
git status --short
```

If either file contains pre-existing changes outside this task, do not stage or commit it. Otherwise commit only these two files with `git commit -m "feat: define PDL customer role evidence"`.

---

### Task 2: Rank the Full DuckDB Candidate Set and Extend the API

**Files:**
- Modify: `tests/test_pdl_local.py`
- Modify: `customer-development-data-sources/pdl/pdl_local.py`

**Interfaces:**
- Consumes: `CUSTOMER_ROLE_PROFILES`, `NO_ROLE_PREFERENCE`, and `infer_customer_role()` from Task 1.
- Extends: `SearchFilters` with `role: str = ""` while keeping `industries` as product-industry values.
- Produces: per-company role fields from `RoleMatch.to_dict()`, `product_industry_match: bool`, and `match_score: int`.

- [x] **Step 1: Expand the deterministic fixture with ranked role examples**

Add unique-domain German rows to `setUp()`:

```python
{
    "id": "de-distributor-1",
    "name": "Solar Distribution GmbH",
    "website": "solar-distribution.de",
    "size": "11-50",
    "founded": "2015",
    "industry": "wholesale",
    "locality": "Hamburg",
    "region": "Hamburg",
    "country": "germany",
    "linkedin_url": "linkedin.com/company/solar-distribution",
},
{
    "id": "de-manufacturer-1",
    "name": "Solar Factory Werke GmbH",
    "website": "solar-factory.de",
    "size": "201-500",
    "founded": "2008",
    "industry": "renewables & environment",
    "locality": "Munich",
    "region": "Bavaria",
    "country": "germany",
    "linkedin_url": "linkedin.com/company/solar-factory",
},
```

Update existing count assertions to reflect four imported unique companies.

- [x] **Step 2: Add failing ranked-search and validation tests**

Add tests equivalent to:

```python
def test_ranked_search_scores_before_limit_and_returns_evidence(self) -> None:
    import_dataset(self.csv_path, self.database_path)
    payload = PdlStore(self.database_path).search(
        SearchFilters(
            country="germany",
            industries=("renewables & environment",),
            role="分销商",
            limit=1,
        )
    )
    company = payload["companies"][0]
    self.assertEqual(company["name"], "Solar Distribution GmbH")
    self.assertEqual(company["role_match_level"], "high")
    self.assertEqual(company["role_match_score"], 85)
    self.assertFalse(company["role_verified"])
    self.assertEqual({item["field"] for item in company["role_match_evidence"]}, {"industry", "name"})

def test_unsupported_role_keeps_product_candidates_without_claiming_role(self) -> None:
    import_dataset(self.csv_path, self.database_path)
    payload = PdlStore(self.database_path).search(
        SearchFilters(
            country="germany",
            industries=("renewables & environment",),
            role="品牌商",
            limit=20,
        )
    )
    self.assertGreaterEqual(payload["total"], 1)
    self.assertTrue(all(row["role_match_level"] == "unknown" for row in payload["companies"]))

def test_parse_search_filters_accepts_known_role_and_rejects_unknown_role(self) -> None:
    filters = parse_search_filters("country=germany&industry=wholesale&role=%E5%88%86%E9%94%80%E5%95%86")
    self.assertEqual(filters.role, "分销商")
    with self.assertRaisesRegex(ValueError, "不支持的客户类型"):
        parse_search_filters("role=made-up-role")
```

- [x] **Step 3: Run the new tests and confirm they fail**

Run:

```bash
customer-development-data-sources/pdl/.venv/bin/python -m unittest \
  tests.test_pdl_local.PdlLocalTest.test_ranked_search_scores_before_limit_and_returns_evidence \
  tests.test_pdl_local.PdlLocalTest.test_unsupported_role_keeps_product_candidates_without_claiming_role \
  tests.test_pdl_local.PdlLocalTest.test_parse_search_filters_accepts_known_role_and_rejects_unknown_role -v
```

Expected: failures because `SearchFilters.role` and ranked API fields do not exist.

- [x] **Step 4: Add role parsing and allowlist validation**

Extend `SearchFilters`:

```python
role: str = ""
```

In `parse_search_filters()`, read `role`, enforce the existing text length boundary, and allow only empty string, `NO_ROLE_PREFERENCE`, or a key in `CUSTOMER_ROLE_PROFILES`. Raise `ValueError(f"不支持的客户类型：{role}")` for any other value.

- [x] **Step 5: Build trusted SQL evidence expressions from the selected profile**

Add documented helpers with these signatures:

```python
def _regex_pattern(terms: Sequence[str]) -> str:
    """Return one case-insensitive, token-boundary RE2-compatible pattern."""

def _role_sql_expressions(profile: RoleProfile | None) -> dict[str, str]:
    """Return trusted SQL fragments for industry, strong name/domain, weak identity, conflict, and score."""
```

Only interpolate patterns produced from `CUSTOMER_ROLE_PROFILES` after escaping every term. Continue binding country, product industries, years, query text, limit, and offset as `?` parameters.

Refactor `PdlStore.search()` into CTEs. `_role_sql_expressions()` must return the keys `industry_match`, `strong_name_match`, `strong_domain_match`, `weak_identity_match`, `conflict_match`, `candidate_match`, and `score`. The `score` expression applies the same weights and support cap as `infer_customer_role()`. Build `product_match_sql` with bound `?` placeholders and use this concrete query shape:

```python
role_sql = _role_sql_expressions(profile)
product_match_sql = (
    f"industry IN ({', '.join('?' for _ in product_industries)})"
    if product_industries
    else "FALSE"
)
candidate_where_sql = (
    "(product_industry_match OR role_candidate_match)"
    if product_industries or profile and profile.support != "none"
    else "TRUE"
)
sql = f"""
WITH base AS (
    SELECT
        id, name, website, size, founded, industry,
        locality, region, country, linkedin_url,
        {product_match_sql} AS product_industry_match,
        {role_sql['candidate_match']} AS role_candidate_match
    FROM companies
    {where_sql}
), recalled AS MATERIALIZED (
    SELECT * FROM base
    WHERE product_industry_match OR role_candidate_match
), signals AS (
    SELECT *,
        {role_sql['score']} AS role_match_score,
        (CASE WHEN website IS NOT NULL THEN 40 ELSE 0 END
         + CASE WHEN linkedin_url IS NOT NULL THEN 30 ELSE 0 END
         + CASE WHEN industry IS NOT NULL THEN 20 ELSE 0 END
         + CASE WHEN size IS NOT NULL THEN 10 ELSE 0 END) AS data_completeness
    FROM recalled
), ranked AS (
    SELECT *,
        CASE
            WHEN role_match_score >= 75 THEN 0
            WHEN role_match_score >= 45 THEN 1
            WHEN role_match_score >= 20 THEN 2
            ELSE 3
        END AS role_rank,
        CAST(ROUND(role_match_score * 0.5
            + CASE WHEN product_industry_match THEN 40 ELSE 0 END
            + data_completeness * 0.1) AS INTEGER) AS match_score
    FROM signals
)
SELECT *, COUNT(*) OVER () AS filtered_total
FROM ranked
ORDER BY role_rank,
         match_score DESC,
         CASE WHEN website IS NOT NULL THEN 0 ELSE 1 END,
         CASE WHEN linkedin_url IS NOT NULL THEN 0 ELSE 1 END,
         name
LIMIT ? OFFSET ?
"""
```

Append product-industry parameters once at the position used by `product_match_sql`, followed by the existing base-filter parameters and the final limit/offset values. Role patterns are escaped server-owned constants and never contain user input.

For the supported-role ranked path, build `where_sql` only from country, size, founded-year, and free-text query conditions; do not also place product industries in `where_sql`, because the `candidates` CTE owns the product/role OR recall.

When no role is selected, `NO_ROLE_PREFERENCE` is selected, or the role support is `none`, use the existing search SQL path unchanged so product-industry filtering and website/LinkedIn/name ordering do not regress. After fetching those rows, attach a neutral or unsupported `RoleMatch`, calculate `product_industry_match`, and expose `match_score` without using it to reorder the legacy result. If both role and product industries are absent, retain the existing country-only behavior.

For each returned row, call `infer_customer_role(row, filters.role)`, merge `RoleMatch.to_dict()`, preserve SQL `match_score`, and return `product_industry_match` as a boolean.

- [x] **Step 6: Extend HTTP behavior tests**

Update the existing HTTP request to include `role=%E5%88%86%E9%94%80%E5%95%86`, then assert `role_match_label` and `role_match_evidence` are present. Add an `urllib.error.HTTPError` assertion that `role=made-up-role` returns HTTP 400 with `code == "invalid_query"`.

- [x] **Step 7: Run the full Python suite**

Run:

```bash
customer-development-data-sources/pdl/.venv/bin/python -m unittest tests/test_pdl_local.py -v
```

Expected: all tests pass with no access to the 2.3 GB production database.

- [x] **Step 8: Review staging safety before commit**

Run `git diff --check` and inspect the two touched files. Commit only if staging contains no pre-existing unrelated changes; otherwise leave them unstaged and report why. Safe commit message: `feat: rank PDL companies by customer role evidence`.

---

### Task 3: Integrate Role Preference and Evidence Into the Prototype UI

**Files:**
- Modify: `src/data.js`
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Modify: `index.html`
- Modify: `tests/customer-development-flow.test.js`

**Interfaces:**
- Consumes API fields from Task 2.
- Produces frontend lead fields `roleMatchLevel`, `roleMatchLabel`, `roleMatchEvidence`, `roleSupport`, `roleVerified`, `productIndustryMatch`, and `matchScore`.
- The table and detail panel render these fields separately from `industry`.

- [x] **Step 1: Add failing frontend contract tests**

Add assertions equivalent to:

```javascript
test("客户类型作为可选偏好单独发送给 PDL", () => {
  assert.match(dataSource, /"不限 \/ 智能推荐"/);
  assert.match(appSource, /endpoint\.searchParams\.set\("role", brief\.role\)/);
  assert.match(appSource, /function getCustomerDevPdlProductIndustries\(brief\)/);
  assert.doesNotMatch(appSource, /CUSTOMER_DEV_PDL_ROLE_INDUSTRIES/);
});

test("客户类型推测保留 PDL 行业并展示证据边界", () => {
  assert.match(appSource, /优先客户类型（可选）/);
  assert.match(appSource, /role_match_evidence/);
  assert.match(appSource, /roleVerified/);
  assert.match(appSource, /未经公司官方资料核验/);
  assert.match(appSource, /高度疑似/);
  assert.match(appSource, /类型待核验/);
  assert.match(stylesSource, /\.customer-dev-role-badge\.is-high/);
});
```

Also load `src/data.js` into `dataSource` at the top of the test file.

- [x] **Step 2: Run the frontend test and confirm failure**

Run:

```bash
node --test tests/customer-development-flow.test.js
```

Expected: new assertions fail because role evidence integration does not exist.

- [x] **Step 3: Make the customer type optional and separate product industries**

In `src/data.js`, prepend `"不限 / 智能推荐"` to `customerTypes` without removing the 20 business roles.

In `src/app.js`:

- Change the default `customerDevBrief.role` to `"不限 / 智能推荐"`.
- Remove `CUSTOMER_DEV_PDL_ROLE_INDUSTRIES`; the backend is the single source of role rules.
- Rename `getCustomerDevPdlIndustries()` to `getCustomerDevPdlProductIndustries()` and return only the selected product group's industries.
- Continue sending each product industry as `industry`, and add `endpoint.searchParams.set("role", brief.role)`.
- Change field 03 label and ARIA text to `优先客户类型（可选）`.
- Update the search progress copy to `正在匹配 PDL 行业、公司名称与域名证据`.

- [x] **Step 4: Normalize structured role evidence without creating facts**

In `normalizeCustomerDevPdlLead()` map API fields with safe fallbacks:

```javascript
const roleMatchEvidence = Array.isArray(company?.role_match_evidence)
  ? company.role_match_evidence.map((item) => ({
      field: String(item?.field || "").trim(),
      value: String(item?.value || "").trim(),
      message: String(item?.message || "").trim()
    })).filter((item) => item.message)
  : [];
const roleMatchLevel = ["high", "medium", "weak", "unknown"].includes(company?.role_match_level)
  ? company.role_match_level
  : "unknown";
```

Set `role` only to the API label or `客户类型待核验`; never set it directly from `brief.role`. Append evidence messages to the existing PDL facts list and keep `roleVerified` false unless a future independent source explicitly returns true.

- [x] **Step 5: Render counts, badge, and evidence**

In `renderCustomerDevResultsWorkspace()` calculate page counts from `leads` and render:

```text
本页 20 家：5 家高度疑似 · 8 家可能匹配 · 7 家待核验
```

Treat weak and unknown as待核验 in the summary. Replace the redundant table “来源” column with “客户类型推测”; keep the page-level PDL attribution. Render `lead.roleMatchLabel` in a badge with classes `is-high`, `is-medium`, `is-weak`, or `is-unknown`.

In `renderCustomerDevDetail()` and `renderCustomerDevCompanyPanel()`:

- Keep the PDL industry tag/fact.
- Add the inferred role badge as a separate tag/fact.
- Display `未经公司官方资料核验` whenever `roleVerified` is false.
- Include each role evidence message in the existing evidence tab.
- For unsupported roles, show `PDL 现有字段无法可靠判断该客户类型`.

Change the empty-state copy to ask users to adjust country or product only; customer type is not a hard filter.

- [x] **Step 6: Add confidence styles and preserve narrow screens**

Add `.customer-dev-role-badge` with compact pill styling and these semantic variants:

- `.is-high`: dark green text on pale green.
- `.is-medium`: amber text on pale amber.
- `.is-weak`: muted brown text on pale neutral.
- `.is-unknown`: gray text on light gray.

Update the fixed table column widths so “客户类型推测” can show one line without increasing the existing 850px minimum width beyond 940px. Reuse current horizontal overflow at narrow widths.

- [x] **Step 7: Bump frontend cache keys and update their test**

In `index.html`, change both app/style versions to one shared value:

```html
src/styles.css?v=20260808-pdl-role-v1
src/app.js?v=20260808-pdl-role-v1
```

Update the two exact version assertions in `tests/customer-development-flow.test.js`.

- [x] **Step 8: Run focused and full frontend tests**

Run:

```bash
node --check src/app.js
node --test tests/customer-development-flow.test.js
npm test
```

Expected: syntax check and all Node tests pass.

- [x] **Step 9: Review staging safety before commit**

Inspect diffs for all five touched files. Because these files already have pre-existing modifications, do not stage them unless individual task hunks can be isolated without including unrelated work. Safe commit message when isolation is proven: `feat: show PDL customer type inference`.

---

### Task 4: Validate the Real 35.8M-Company Database and Update Project Context

**Files:**
- Modify: `CONTEXT.md`
- Test: `customer-development-data-sources/pdl/data/pdl_companies.duckdb` (read-only runtime input; never commit)

**Interfaces:**
- Consumes the ranked `PdlStore.search()` and frontend UI from Tasks 2–3.
- Produces evidence-backed performance results and current project documentation.

- [x] **Step 1: Run deterministic regression suites**

Run:

```bash
customer-development-data-sources/pdl/.venv/bin/python -m unittest tests/test_pdl_local.py -v
node --check src/app.js
npm test
git diff --check
```

Expected: all tests pass and no whitespace errors are reported.

- [x] **Step 2: Benchmark real queries without modifying the database**

Run one read-only `PdlStore.search()` query each for Germany, United States, and India, using a 20-row limit and representative roles `分销商`, `制造商`, and `系统集成商`. Record wall-clock time, returned rows, level counts, and the first three evidence labels. Do not print full company records or contact data.

Acceptance:

- Every query finishes within the existing 2.4-second search animation on this machine.
- High results have both industry and identity-text evidence.
- Unsupported-role control query `品牌商` returns product candidates but no high/medium role claims.

Observed on the real 35,828,987-company DuckDB index after the materialized recall optimization:

- Germany + distributor: 0.127 seconds; 20/20 returned results were high confidence and 17/20 also matched a product industry.
- United States + manufacturer: 1.106 seconds; 20/20 returned results were high confidence and matched a product industry.
- India + systems integrator: 0.196 seconds; 6 high and 14 medium results, all matching a product industry.
- Germany + brand control: 0.012 seconds; 20/20 returned results remained unknown.
- The first three high-confidence results in every supported-role query contained both industry and identity-text evidence. Product-industry matches sort above otherwise-equivalent generic role matches.

- [x] **Step 3: Start or reuse the local read-only service**

If port 8788 is not already serving the updated files, run:

```bash
customer-development-data-sources/pdl/.venv/bin/python \
  customer-development-data-sources/pdl/pdl_local.py serve \
  --database customer-development-data-sources/pdl/data/pdl_companies.duckdb \
  --host 127.0.0.1 --port 8788
```

Keep it local-only. Do not expose the server to another interface.

- [x] **Step 4: Verify the browser workflow**

Open `http://127.0.0.1:8788/index.html#/customer-development` and verify:

1. Field 03 says “优先客户类型（可选）” and includes “不限 / 智能推荐”.
2. Germany + 光伏组件 + 分销商 returns real PDL companies.
3. The result summary separates high, possible, and pending-verification counts.
4. The table shows PDL industry and customer-type inference separately.
5. Selecting a row shows evidence and “未经公司官方资料核验”.
6. Selecting 品牌商 never creates a verified/high-confidence brand claim.
7. Contacts remain empty and no email is synthesized.
8. The browser console has no errors and the layout remains usable at a narrow width.

Observed in the local in-app browser: distributor search returned 27,872 candidates with 20/20 high-confidence results on the first page; the detail panel displayed both evidence families and the unverified boundary; brand search returned 20/20 pending-verification results. At 960 px viewport width, the page itself did not overflow and the 920 px result table stayed inside its horizontal-scroll panel. A fresh local page produced zero console errors after local-only Service Worker cleanup.

- [x] **Step 5: Update `CONTEXT.md` with implemented facts**

Update the customer-development overview, file responsibility, and verification sections to say:

- Customer type is an optional, accurate-first ranking preference.
- PDL industry, name, and domain produce explainable high/medium/weak/unknown labels.
- High requires two evidence families; brand/OEM buyer/end-user roles remain unknown.
- The API returns structured role evidence and never marks it verified.
- Record the real benchmark commands and observed results, not estimates.

- [x] **Step 6: Run final checks after documentation changes**

Run:

```bash
customer-development-data-sources/pdl/.venv/bin/python -m unittest tests/test_pdl_local.py -v
npm test
git diff --check
git status --short
```

Expected: tests pass; status shows only intended task files plus pre-existing unrelated worktree changes.

- [x] **Step 7: Commit only if safe and hand off**

If the relevant hunks can be staged without capturing pre-existing edits, commit code/tests/context with `git commit -m "feat: infer PDL customer types from evidence"`. Otherwise leave implementation unstaged and explicitly list the files changed. In either case, report backend test results, Node test results, real-database timings, browser verification, and any remaining data limitations.

Handoff decision: keep the current `main` worktree unstaged. The repository already contained overlapping modifications in `src/app.js`, `src/styles.css`, `CONTEXT.md`, and other task-adjacent files, while the PDL source tree and backend test were already untracked. Staging these paths would capture work that cannot be proven to belong only to this feature.
