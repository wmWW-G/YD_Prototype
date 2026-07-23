"""赢单 KASS HTTP 客户端单元测试。"""

from __future__ import annotations

import unittest
from typing import Any
from unittest.mock import patch

import requests

from lib.client import (
    PROFILE_UPDATE_FIELD_MAP,
    YingdanApiClient,
    YingdanApiError,
)


class FakeResponse:
    """提供 requests.Response 测试所需的最小接口。"""

    def __init__(self, payload: Any, status_code: int = 200) -> None:
        """保存测试响应体和 HTTP 状态码。"""

        self._payload = payload
        self.status_code = status_code
        self.ok = 200 <= status_code < 400

    def json(self) -> Any:
        """返回构造时提供的 JSON 响应体。"""

        return self._payload


class YingdanApiClientTests(unittest.TestCase):
    """验证鉴权、字段合并、归属检查和安全错误。"""

    def setUp(self) -> None:
        """为每个测试创建相同的固定账号客户端。"""

        self.client = YingdanApiClient(
            "https://api.top-yd.com",
            "test-secret-token",
            42,
        )

    @patch("lib.client.requests.request")
    def test_list_categories_sends_fixed_user_and_bearer(self, request_mock: Any) -> None:
        """只读分层请求应绑定 user_id，并通过请求头发送 Token。"""

        request_mock.return_value = FakeResponse(
            {"code": 0, "data": [{"id": 1, "customerCategory": "A"}]}
        )

        result = self.client.list_categories()

        self.assertEqual(result[0]["customerCategory"], "A")
        kwargs = request_mock.call_args.kwargs
        self.assertEqual(kwargs["params"], {"userId": 42})
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test-secret-token")
        self.assertNotIn("test-secret-token", kwargs["url"])

    @patch("lib.client.requests.request")
    def test_authentication_error_never_echoes_token(self, request_mock: Any) -> None:
        """鉴权失败消息不能包含 Provider 中的真实 Access Token。"""

        request_mock.return_value = FakeResponse(
            {"code": 40101, "message": "expired"},
            status_code=401,
        )

        with self.assertRaises(YingdanApiError) as caught:
            self.client.list_categories()

        self.assertEqual(caught.exception.safe_code, "authentication_failed")
        self.assertNotIn("test-secret-token", caught.exception.user_message)

    @patch("lib.client.requests.request")
    def test_update_category_uses_live_put_method(self, request_mock: Any) -> None:
        """客户分层更新必须使用线上实测成功的 PUT 方法。"""

        request_mock.return_value = FakeResponse({"code": 0, "data": None})

        self.client.update_category(3, "A", "updated")

        kwargs = request_mock.call_args.kwargs
        self.assertEqual(kwargs["method"], "PUT")
        self.assertEqual(kwargs["url"], "https://api.top-yd.com/index/customerCategory/update")

    @patch("lib.client.requests.request")
    def test_update_customer_reads_and_merges_before_save(self, request_mock: Any) -> None:
        """局部更新必须遵循线上字段契约并强制使用固定 user_id。"""

        request_mock.side_effect = [
            FakeResponse(
                {
                    "code": 0,
                    "data": {
                        "id": 7,
                        "userId": 42,
                        "companyName": "Acme",
                        "customerCategory": "A",
                        "email": "old@example.test",
                        "cooperationTimes": "2",
                    },
                }
            ),
            FakeResponse({"code": 0, "data": {"id": 7}}),
        ]

        result = self.client.update_customer(7, {"whatsapp": "+1 555 0100"})

        self.assertEqual(result, {"id": 7})
        save_kwargs = request_mock.call_args_list[1].kwargs
        body = save_kwargs["json"]
        self.assertEqual(save_kwargs["method"], "POST")
        self.assertEqual(body["companyName"], "Acme")
        self.assertEqual(body["email"], "old@example.test")
        self.assertEqual(body["whatsapp"], "+1 555 0100")
        self.assertEqual(body["cooperationTimes"], 2)
        self.assertEqual(body["id"], 7)
        self.assertEqual(body["userId"], 42)
        self.assertNotIn("customerCategory", body)
        self.assertEqual(
            set(body),
            set(PROFILE_UPDATE_FIELD_MAP.values()) | {"id", "userId"},
        )

    def test_update_customer_rejects_category_move_before_network(self) -> None:
        """当前生产更新契约不支持通过档案保存接口移动客户分层。"""

        with self.assertRaises(YingdanApiError) as caught:
            self.client.update_customer(7, {"customer_category": "B"})

        self.assertEqual(caught.exception.safe_code, "invalid_parameter")

    @patch("lib.client.requests.request")
    def test_update_customer_rejects_invalid_cooperation_times(
        self,
        request_mock: Any,
    ) -> None:
        """合作次数必须在发起保存请求前转换成非负整数。"""

        request_mock.return_value = FakeResponse(
            {
                "code": 0,
                "data": {
                    "id": 7,
                    "userId": 42,
                    "companyName": "Acme",
                    "customerCategory": "A",
                },
            }
        )

        with self.assertRaises(YingdanApiError) as caught:
            self.client.update_customer(7, {"cooperation_times": "not-a-number"})

        self.assertEqual(caught.exception.safe_code, "invalid_parameter")
        self.assertEqual(request_mock.call_count, 1)

    @patch("lib.client.requests.request")
    def test_customer_with_invalid_owner_is_rejected_safely(self, request_mock: Any) -> None:
        """异常 userId 不能触发 ValueError，也不能绕过固定账号归属检查。"""

        request_mock.return_value = FakeResponse(
            {"code": 0, "data": {"id": 7, "userId": "not-a-number"}}
        )

        with self.assertRaises(YingdanApiError) as caught:
            self.client.get_customer(7)

        self.assertEqual(caught.exception.safe_code, "ownership_mismatch")

    def test_unknown_customer_field_is_rejected_before_network(self) -> None:
        """LLM 构造的任意字段不能穿透明确允许列表。"""

        with self.assertRaises(YingdanApiError) as caught:
            self.client.create_customer(
                {
                    "company_name": "Acme",
                    "customer_category": "A",
                    "user_id": 999,
                }
            )

        self.assertEqual(caught.exception.safe_code, "invalid_parameter")

    @patch("lib.client.requests.request")
    def test_network_exception_is_converted_to_safe_error(self, request_mock: Any) -> None:
        """网络异常只返回稳定错误，不回显请求头或底层调用细节。"""

        request_mock.side_effect = requests.ConnectionError("low-level failure")

        with self.assertRaises(YingdanApiError) as caught:
            self.client.list_categories()

        self.assertEqual(caught.exception.safe_code, "network_error")
        self.assertNotIn("test-secret-token", caught.exception.user_message)


if __name__ == "__main__":
    unittest.main()
