"""PDL 本地导入和搜索的确定性单元测试。"""

from __future__ import annotations

import csv
import gzip
import json
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PDL_MODULE_DIR = PROJECT_ROOT / "customer-development-data-sources" / "pdl"
sys.path.insert(0, str(PDL_MODULE_DIR))

from pdl_local import (  # noqa: E402
    CUSTOMER_ROLE_PROFILES,
    HunterClient,
    NO_ROLE_PREFERENCE,
    PdlDataError,
    PdlRequestHandler,
    PdlStore,
    SearchFilters,
    import_dataset,
    infer_customer_role,
    normalize_hunter_domain,
    parse_search_filters,
)


EXPECTED_CUSTOMER_ROLES = {
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
    "设计院 / 顾问公司",
}


class PdlLocalTest(unittest.TestCase):
    """验证小样本导入、去重、筛选和输入边界。"""

    def setUp(self) -> None:
        """为每个测试创建独立 CSV 和 DuckDB 路径。

        Returns:
            无返回值。

        Raises:
            OSError: 临时目录或 CSV 无法创建时抛出。
        """

        self.temporary = tempfile.TemporaryDirectory(prefix="pdl-test-")
        self.root = Path(self.temporary.name)
        self.csv_path = self.root / "companies.csv"
        self.database_path = self.root / "companies.duckdb"
        rows = [
            {
                "id": "de-solar-1",
                "name": "Solar Beispiel GmbH",
                "website": "https://www.solar-beispiel.de",
                "size": "11-50",
                "founded": "2014",
                "industry": "renewables & environment",
                "locality": "Berlin",
                "region": "Berlin",
                "country": "germany",
                "linkedin_url": "linkedin.com/company/solar-beispiel",
            },
            {
                "id": "de-solar-duplicate",
                "name": "Solar Beispiel Duplicate",
                "website": "solar-beispiel.de",
                "size": "11-50",
                "founded": "2014",
                "industry": "renewables & environment",
                "locality": "Berlin",
                "region": "Berlin",
                "country": "germany",
                "linkedin_url": "linkedin.com/company/solar-beispiel-duplicate",
            },
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
            {
                "id": "de-weak-distributor-1",
                "name": "Solar Distribution Projects GmbH",
                "website": "solar-distribution-projects.de",
                "size": "51-200",
                "founded": "2012",
                "industry": "renewables & environment",
                "locality": "Cologne",
                "region": "North Rhine-Westphalia",
                "country": "germany",
                "linkedin_url": "linkedin.com/company/solar-distribution-projects",
            },
            {
                "id": "us-software-1",
                "name": "Example Software Inc",
                "website": "example-software.com",
                "size": "51-200",
                "founded": "2019",
                "industry": "computer software",
                "locality": "Austin",
                "region": "Texas",
                "country": "united states",
                "linkedin_url": "linkedin.com/company/example-software",
            },
        ]
        with self.csv_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)

    def tearDown(self) -> None:
        """删除本测试创建的临时文件。

        Returns:
            无返回值。

        Raises:
            OSError: 临时目录无法清理时可能抛出。
        """

        self.temporary.cleanup()

    def _append_sorting_fixture_rows(self) -> None:
        """向测试 CSV 追加两条只用于比较排序质量的公司记录。

        完整记录故意使用字母 ``Z`` 开头，残缺记录故意使用数字 ``0`` 开头。这样可以
        验证推荐排序依据数据质量，而不是继续沿用原来的公司名称字母顺序。

        Returns:
            无返回值。

        Raises:
            OSError: 测试 CSV 无法追加时抛出。
        """

        rows = [
            {
                "id": "sort-bare",
                "name": "0 Sorting Fixture Bare",
                "website": "",
                "size": "",
                "founded": "",
                "industry": "renewables & environment",
                "locality": "",
                "region": "",
                "country": "germany",
                "linkedin_url": "",
            },
            {
                "id": "sort-complete",
                "name": "Z Sorting Fixture Complete",
                "website": "sorting-fixture.example",
                "size": "10001+",
                "founded": "1998",
                "industry": "renewables & environment",
                "locality": "Frankfurt",
                "region": "Hesse",
                "country": "germany",
                "linkedin_url": "linkedin.com/company/sorting-fixture",
            },
        ]
        with self.csv_path.open("a", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
            writer.writerows(rows)

    def test_import_deduplicates_domains_and_searches_structured_fields(self) -> None:
        """同域名公司应去重，国家和行业筛选应返回真实字段。"""

        result = import_dataset(self.csv_path, self.database_path)
        self.assertEqual(result["company_count"], 5)

        store = PdlStore(self.database_path)
        payload = store.search(
            SearchFilters(
                country="germany",
                industries=("renewables & environment",),
                limit=20,
            )
        )
        self.assertEqual(payload["total"], 3)
        self.assertEqual(
            {company["name"] for company in payload["companies"]},
            {
                "Solar Beispiel GmbH",
                "Solar Factory Werke GmbH",
                "Solar Distribution Projects GmbH",
            },
        )
        self.assertTrue(
            all(
                company["match_score"] == 90
                and company["actionability_score"] == 25
                and company["data_completeness_score"] == 20
                for company in payload["companies"]
            )
        )

    def test_import_accepts_pdl_gzip_named_csv_zip(self) -> None:
        """PDL 官方的 ``.csv.zip`` 实为 GZIP 时应直接流式导入，不按普通 ZIP 解压。"""

        disguised_gzip_path = self.root / "free_company_dataset.csv.zip"
        disguised_gzip_path.write_bytes(gzip.compress(self.csv_path.read_bytes()))

        result = import_dataset(disguised_gzip_path, self.database_path)
        metadata = PdlStore(self.database_path).metadata()

        self.assertEqual(result["company_count"], 5)
        self.assertEqual(result["source_format"], "csv")
        self.assertEqual(metadata["license"], "CC0 1.0")

    def test_search_query_is_bound_as_text_not_sql(self) -> None:
        """带引号的搜索词只能作为普通文本，不能改变 WHERE 结构。"""

        import_dataset(self.csv_path, self.database_path)
        payload = PdlStore(self.database_path).search(SearchFilters(query="' OR 1=1 --"))
        self.assertEqual(payload["total"], 0)
        self.assertEqual(payload["companies"], [])

    def test_parse_search_filters_caps_limit_and_rejects_bad_year(self) -> None:
        """接口需要限制一次返回量，并拒绝明显无效的年份。"""

        filters = parse_search_filters("country=germany&industry=machinery&limit=99999")
        self.assertEqual(filters.limit, 500)
        self.assertEqual(filters.industries, ("machinery",))
        with self.assertRaises(ValueError):
            parse_search_filters("founded_from=not-a-year")

    def test_parse_search_filters_defaults_sort_and_rejects_unknown_sort(self) -> None:
        """排序默认使用推荐分，而且 URL 不能注入任意 ORDER BY 片段。"""

        self.assertEqual(parse_search_filters("country=germany").sort, "recommended")
        self.assertEqual(parse_search_filters("sort=complete").sort, "complete")
        self.assertEqual(parse_search_filters("sort=size_desc").sort, "size_desc")
        with self.assertRaisesRegex(ValueError, "不支持的排序方式"):
            parse_search_filters("sort=name%20DESC%3B%20DROP%20TABLE%20companies")

    def test_recommended_sort_scores_actionability_and_completeness_before_name(self) -> None:
        """默认推荐排序应让完整可行动的 Z 公司排在数字开头的残缺公司之前。"""

        self._append_sorting_fixture_rows()
        import_dataset(self.csv_path, self.database_path)
        payload = PdlStore(self.database_path).search(
            SearchFilters(
                country="germany",
                industries=("renewables & environment",),
                query="Sorting Fixture",
                limit=20,
            )
        )

        self.assertEqual(payload["sort"], "recommended")
        self.assertEqual(
            [company["name"] for company in payload["companies"]],
            ["Z Sorting Fixture Complete", "0 Sorting Fixture Bare"],
        )
        complete, bare = payload["companies"]
        self.assertEqual(complete["product_match_score"], 45)
        self.assertEqual(complete["actionability_score"], 25)
        self.assertEqual(complete["data_completeness_score"], 20)
        self.assertEqual(complete["match_score"], 90)
        self.assertEqual(bare["match_score"], 51)

    def test_complete_and_size_sort_modes_are_applied_before_pagination(self) -> None:
        """完整度和规模两种排序都应在 DuckDB 全量候选上完成后再截取结果。"""

        self._append_sorting_fixture_rows()
        import_dataset(self.csv_path, self.database_path)
        store = PdlStore(self.database_path)
        common = {
            "country": "germany",
            "industries": ("renewables & environment",),
            "query": "Sorting Fixture",
            "limit": 1,
        }

        complete_payload = store.search(SearchFilters(**common, sort="complete"))
        size_payload = store.search(SearchFilters(**common, sort="size_desc"))

        self.assertEqual(complete_payload["sort"], "complete")
        self.assertEqual(size_payload["sort"], "size_desc")
        self.assertEqual(complete_payload["total"], 2)
        self.assertEqual(size_payload["total"], 2)
        self.assertEqual(complete_payload["companies"][0]["id"], "sort-complete")
        self.assertEqual(size_payload["companies"][0]["id"], "sort-complete")

    def test_http_health_and_company_search_use_imported_database(self) -> None:
        """线程化 HTTP 服务应能返回健康状态和同源公司搜索 JSON。"""

        import_dataset(self.csv_path, self.database_path)
        PdlRequestHandler.store = PdlStore(self.database_path)
        server = ThreadingHTTPServer(("127.0.0.1", 0), PdlRequestHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        try:
            base_url = f"http://127.0.0.1:{server.server_port}"
            with urllib.request.urlopen(f"{base_url}/api/pdl/health", timeout=3) as response:
                health = json.loads(response.read().decode("utf-8"))
            with urllib.request.urlopen(
                f"{base_url}/api/pdl/companies?country=germany&industry=renewables%20%26%20environment"
                "&role=%E5%88%86%E9%94%80%E5%95%86&limit=20",
                timeout=3,
            ) as response:
                payload = json.loads(response.read().decode("utf-8"))
            with self.assertRaises(urllib.error.HTTPError) as raised:
                urllib.request.urlopen(
                    f"{base_url}/api/pdl/companies?country=germany&role=made-up-role",
                    timeout=3,
                )
            invalid_payload = json.loads(raised.exception.read().decode("utf-8"))

            self.assertTrue(health["ready"])
            self.assertEqual(health["company_count"], 5)
            self.assertEqual(payload["total"], 4)
            self.assertEqual(payload["companies"][0]["name"], "Solar Distribution Projects GmbH")
            self.assertEqual(payload["companies"][0]["role_match_label"], "高度疑似分销商")
            self.assertEqual(len(payload["companies"][0]["role_match_evidence"]), 2)
            self.assertEqual(raised.exception.code, 400)
            self.assertEqual(invalid_payload["code"], "invalid_query")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=3)

    def test_hunter_domain_normalization_accepts_public_domains_only(self) -> None:
        """Hunter 代理只能接收普通公网域名，不能把任意 URL 当成查询参数。"""

        self.assertEqual(normalize_hunter_domain("https://www.Example.com/contact"), "example.com")
        self.assertEqual(normalize_hunter_domain("solar-beispiel.de"), "solar-beispiel.de")
        with self.assertRaisesRegex(ValueError, "公司域名"):
            normalize_hunter_domain("localhost")
        with self.assertRaisesRegex(ValueError, "公司域名"):
            normalize_hunter_domain("https://user:password@example.com")

    def test_hunter_client_normalizes_and_prioritizes_domain_contacts(self) -> None:
        """Hunter Domain Search 应返回精简字段，并把决策人和个人邮箱排在前面。"""

        class FakeResponse:
            """模拟 ``urllib`` 成功响应，避免测试调用真实 Hunter 或消耗额度。"""

            def __enter__(self) -> "FakeResponse":
                return self

            def __exit__(self, *args: object) -> None:
                return None

            def read(self) -> bytes:
                payload = {
                    "data": {
                        "domain": "example.com",
                        "organization": "Example GmbH",
                        "pattern": "{first}",
                        "accept_all": False,
                        "emails": [
                            {
                                "value": "contact@example.com",
                                "type": "generic",
                                "confidence": 80,
                                "sources": [],
                                "first_name": None,
                                "last_name": None,
                                "position": None,
                                "seniority": None,
                                "department": None,
                                "decision_maker": None,
                                "linkedin": None,
                                "phone_number": None,
                                "verification": {"status": "valid"},
                            },
                            {
                                "value": "anna@example.com",
                                "type": "personal",
                                "confidence": 96,
                                "sources": [{"last_seen_on": "2026-07-01"}],
                                "first_name": "Anna",
                                "last_name": "Buyer",
                                "position": "Procurement Director",
                                "seniority": "executive",
                                "department": "management",
                                "decision_maker": True,
                                "linkedin": "https://www.linkedin.com/in/anna-buyer",
                                "phone_number": "+49 30 123456",
                                "verification": {"status": "valid"},
                            },
                        ],
                    },
                    "meta": {"results": 2, "limit": 10, "offset": 0},
                }
                return json.dumps(payload).encode("utf-8")

        client = HunterClient("test-key")
        with mock.patch("pdl_local.urllib.request.urlopen", return_value=FakeResponse()) as urlopen:
            result = client.domain_search("https://www.example.com/contact", limit=10)

        requested_url = urlopen.call_args.args[0].full_url
        self.assertIn("domain=example.com", requested_url)
        self.assertIn("api_key=test-key", requested_url)
        self.assertEqual(result["domain"], "example.com")
        self.assertEqual(result["total"], 2)
        self.assertEqual(result["contacts"][0]["name"], "Anna Buyer")
        self.assertTrue(result["contacts"][0]["decision_maker"])
        self.assertEqual(result["contacts"][0]["verification_status"], "valid")
        self.assertEqual(result["contacts"][1]["name"], "通用邮箱")
        self.assertNotIn("api_key", result)

    def test_hunter_http_endpoint_reports_missing_server_key_without_leaking_config(self) -> None:
        """未配置 Key 时接口应明确失败，而且状态接口只能返回布尔值。"""

        import_dataset(self.csv_path, self.database_path)
        original_client = PdlRequestHandler.hunter_client
        PdlRequestHandler.store = PdlStore(self.database_path)
        PdlRequestHandler.hunter_client = HunterClient("")
        server = ThreadingHTTPServer(("127.0.0.1", 0), PdlRequestHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        try:
            base_url = f"http://127.0.0.1:{server.server_port}"
            with urllib.request.urlopen(f"{base_url}/api/hunter/status", timeout=3) as response:
                status_payload = json.loads(response.read().decode("utf-8"))
            with self.assertRaises(urllib.error.HTTPError) as raised:
                urllib.request.urlopen(
                    f"{base_url}/api/hunter/domain-search?domain=example.com",
                    timeout=3,
                )
            error_payload = json.loads(raised.exception.read().decode("utf-8"))

            self.assertEqual(status_payload, {"configured": False, "provider": "hunter"})
            self.assertEqual(raised.exception.code, 503)
            self.assertEqual(error_payload["code"], "hunter_not_configured")
            self.assertNotIn("test-key", json.dumps(error_payload).lower())
            self.assertNotIn("api.hunter.io", json.dumps(error_payload).lower())
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=3)
            PdlRequestHandler.hunter_client = original_client

    def test_hunter_email_count_returns_only_free_aggregate_counts(self) -> None:
        """Email Count 只返回免费汇总数量，不能提前泄露联系人明细。"""

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, traceback):
                return False

            def read(self):
                payload = {
                    "data": {
                        "total": 12,
                        "personal_emails": 9,
                        "generic_emails": 3,
                    }
                }
                return json.dumps(payload).encode("utf-8")

        client = HunterClient("test-key")
        with mock.patch("pdl_local.urllib.request.urlopen", return_value=FakeResponse()) as urlopen:
            result = client.email_count("https://www.example.com/contact")

        requested_url = urlopen.call_args.args[0].full_url
        self.assertIn("/email-count?", requested_url)
        self.assertEqual(result["total"], 12)
        self.assertEqual(result["personal"], 9)
        self.assertEqual(result["generic"], 3)
        self.assertNotIn("contacts", result)
        self.assertNotIn("api_key", result)

    def test_import_rejects_wrong_dataset_without_name_field(self) -> None:
        """下载错文件时应给出明确错误，不能生成一个看似成功的空库。"""

        wrong_path = self.root / "wrong.csv"
        wrong_path.write_text("domain,country\nexample.com,germany\n", encoding="utf-8")
        with self.assertRaises(PdlDataError):
            import_dataset(wrong_path, self.database_path)

    def test_role_profiles_cover_every_customer_type(self) -> None:
        """服务端必须覆盖前端全部客户类型，避免选项与评分规则漂移。"""

        self.assertEqual(set(CUSTOMER_ROLE_PROFILES), EXPECTED_CUSTOMER_ROLES)
        self.assertNotIn(NO_ROLE_PREFERENCE, CUSTOMER_ROLE_PROFILES)

    def test_high_confidence_requires_industry_and_identity_evidence(self) -> None:
        """高度疑似必须同时拥有行业和公司身份文本两类独立证据。"""

        high = infer_customer_role(
            {
                "name": "Solar Distribution GmbH",
                "website": "solar-distribution.de",
                "industry": "wholesale",
            },
            "分销商",
        )
        industry_only = infer_customer_role(
            {
                "name": "Solar Beispiel GmbH",
                "website": "solar-beispiel.de",
                "industry": "wholesale",
            },
            "分销商",
        )

        self.assertEqual(high.level, "high")
        self.assertEqual(high.score, 85)
        self.assertEqual(len(high.evidence), 2)
        self.assertEqual(industry_only.level, "medium")
        self.assertEqual(industry_only.score, 45)

    def test_name_and_domain_are_one_evidence_family(self) -> None:
        """名称和域名重复同一身份词时不能伪装成两条独立证据。"""

        match = infer_customer_role(
            {
                "name": "Example Distribution",
                "website": "example-distribution.com",
                "industry": None,
            },
            "分销商",
        )

        self.assertEqual(match.score, 40)
        self.assertEqual(match.level, "weak")
        self.assertEqual(len(match.evidence), 1)
        self.assertEqual(match.evidence[0]["field"], "name")

    def test_product_industry_and_strong_identity_form_two_evidence_families(self) -> None:
        """产品行业与强身份词组合时可高置信，但产品行业不能单独冒充角色证据。"""

        matched = infer_customer_role(
            {
                "name": "Solar Distribution Projects GmbH",
                "website": "solar-distribution-projects.de",
                "industry": "renewables & environment",
            },
            "分销商",
            product_industry_match=True,
        )
        industry_only = infer_customer_role(
            {
                "name": "Solar Projects GmbH",
                "website": "solar-projects.de",
                "industry": "renewables & environment",
            },
            "分销商",
            product_industry_match=True,
        )

        self.assertEqual(matched.level, "high")
        self.assertEqual(matched.score, 85)
        self.assertEqual({item["field"] for item in matched.evidence}, {"industry", "name"})
        self.assertEqual(industry_only.level, "unknown")
        self.assertEqual(industry_only.score, 0)

    def test_unsupported_role_never_claims_a_match(self) -> None:
        """现有字段无法判断的角色必须保持未知，不能靠名称相似词硬猜。"""

        match = infer_customer_role(
            {
                "name": "Example Brands",
                "website": "example-brands.com",
                "industry": "retail",
            },
            "品牌商",
        )

        self.assertEqual(match.support, "none")
        self.assertEqual(match.score, 0)
        self.assertEqual(match.level, "unknown")
        self.assertFalse(match.verified)

    def test_ranked_search_scores_before_limit_and_returns_evidence(self) -> None:
        """产品相关且身份明确的分销商应排在无产品行业证据的普通分销商之前。"""

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

        self.assertEqual(company["name"], "Solar Distribution Projects GmbH")
        self.assertEqual(company["role_match_level"], "high")
        self.assertEqual(company["role_match_score"], 85)
        self.assertFalse(company["role_verified"])
        self.assertEqual(
            {item["field"] for item in company["role_match_evidence"]},
            {"industry", "name"},
        )

    def test_unsupported_role_keeps_product_candidates_without_claiming_role(self) -> None:
        """不可判断的角色继续返回产品行业候选，但不得生成角色结论。"""

        import_dataset(self.csv_path, self.database_path)
        payload = PdlStore(self.database_path).search(
            SearchFilters(
                country="germany",
                industries=("renewables & environment",),
                role="品牌商",
                limit=20,
            )
        )

        self.assertEqual(payload["total"], 3)
        self.assertTrue(all(row["role_match_level"] == "unknown" for row in payload["companies"]))
        self.assertTrue(all(row["role_match_score"] == 0 for row in payload["companies"]))

    def test_parse_search_filters_accepts_known_role_and_rejects_unknown_role(self) -> None:
        """查询参数只接受默认选项和20种已配置客户类型。"""

        filters = parse_search_filters(
            "country=germany&industry=wholesale&role=%E5%88%86%E9%94%80%E5%95%86"
        )
        self.assertEqual(filters.role, "分销商")
        with self.assertRaisesRegex(ValueError, "不支持的客户类型"):
            parse_search_filters("role=made-up-role")


if __name__ == "__main__":
    unittest.main()
