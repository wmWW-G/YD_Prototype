"""KASS 原型 CRM 插件客户端测试。"""

from __future__ import annotations

import unittest
from unittest.mock import Mock, patch

import requests

from lib.client import (
    API_URL,
    KassPrototypeCrmClient,
    KassPrototypeCrmError,
)


WORKSPACE_ID = "workspace-1234567890abcdef"
CUSTOMER_REF = "kass-a-1"


class KassPrototypeCrmClientTests(unittest.TestCase):
    """验证固定端点、字段转换和安全错误边界。"""

    @staticmethod
    def _success_response(action: str, data: object) -> Mock:
        """构造 requests 风格成功响应。"""

        response = Mock()
        response.ok = True
        response.status_code = 200
        response.json.return_value = {
            "ok": True,
            "mode": "prototype",
            "action": action,
            "data": data,
        }
        return response

    @patch("lib.client.requests.request")
    def test_get_context_uses_only_the_fixed_prototype_url(self, request: Mock) -> None:
        """查询必须发往固定原型域名且不携带 Authorization。"""

        request.return_value = self._success_response("context", {"customer": {}})

        result = KassPrototypeCrmClient().get_context(WORKSPACE_ID, CUSTOMER_REF)

        self.assertTrue(result["ok"])
        kwargs = request.call_args.kwargs
        self.assertEqual(kwargs["url"], API_URL)
        self.assertEqual(kwargs["method"], "GET")
        self.assertEqual(kwargs["params"]["workspace_id"], WORKSPACE_ID)
        self.assertNotIn("Authorization", kwargs["headers"])

    @patch("lib.client.requests.request")
    def test_update_customer_accepts_one_nonempty_change_object(self, request: Mock) -> None:
        """客户字段或背调字段可以单独更新，另一对象允许为空。"""

        request.return_value = self._success_response(
            "update_customer",
            {"customer": {"stage": "待客户确认"}},
        )

        result = KassPrototypeCrmClient().update_customer(
            WORKSPACE_ID,
            CUSTOMER_REF,
            {"stage": "待客户确认"},
            {},
        )

        self.assertTrue(result["ok"])
        body = request.call_args.kwargs["json"]
        self.assertEqual(body["changes"], {"stage": "待客户确认"})
        self.assertEqual(body["profile_changes"], {})

    @patch("lib.client.requests.request")
    def test_followup_task_fields_are_mapped_to_the_gateway_contract(self, request: Mock) -> None:
        """Tool 的 snake_case due_date 必须映射成页面使用的 dueDate。"""

        request.return_value = self._success_response(
            "update_followup",
            {"record": {"id": "followup-1"}},
        )

        KassPrototypeCrmClient().update_followup(
            WORKSPACE_ID,
            CUSTOMER_REF,
            "followup-1",
            {
                "tasks": [
                    {
                        "id": "task-1",
                        "title": "发送报价",
                        "due_date": "2026-07-25",
                        "status": "已完成",
                    },
                    {
                        "id": "agent-next-followup-1",
                        "title": "确认报价反馈",
                        "due_date": "",
                        "status": "待处理",
                    }
                ]
            },
        )

        tasks = request.call_args.kwargs["json"]["changes"]["tasks"]
        self.assertEqual(tasks[0]["dueDate"], "2026-07-25")
        self.assertNotIn("due_date", tasks[0])
        self.assertEqual(tasks[1]["id"], "agent-next-followup-1")
        self.assertEqual(tasks[1]["status"], "待处理")

    def test_unknown_fields_and_empty_updates_are_rejected_before_http(self) -> None:
        """插件必须在联网前拒绝任意 URL 字段和空修改。"""

        client = KassPrototypeCrmClient()

        with self.assertRaisesRegex(KassPrototypeCrmError, "不支持的字段"):
            client.update_customer(
                WORKSPACE_ID,
                CUSTOMER_REF,
                {"arbitrary_url": "https://example.com"},
                {},
            )

        with self.assertRaisesRegex(KassPrototypeCrmError, "至少需要一个字段"):
            client.update_customer(WORKSPACE_ID, CUSTOMER_REF, {}, {})

    def test_invalid_workspace_id_is_rejected_before_http(self) -> None:
        """工作区 ID 不能包含查询串、路径或其它越权字符。"""

        with self.assertRaisesRegex(KassPrototypeCrmError, "workspace_id 格式无效"):
            KassPrototypeCrmClient().get_context(
                "https://example.com/?workspace=bad",
                CUSTOMER_REF,
            )

    @patch("lib.client.requests.request")
    def test_network_and_backend_errors_return_safe_messages(self, request: Mock) -> None:
        """网络或业务失败不得回显请求头、内部栈或凭证。"""

        request.side_effect = requests.Timeout("secret internal timeout")
        with self.assertRaisesRegex(KassPrototypeCrmError, "请求超时"):
            KassPrototypeCrmClient().get_context(WORKSPACE_ID, CUSTOMER_REF)

        response = Mock()
        response.ok = False
        response.status_code = 400
        response.json.return_value = {
            "ok": False,
            "code": "invalid_parameter",
            "message": "followup_id 格式无效。",
        }
        request.side_effect = None
        request.return_value = response

        with self.assertRaisesRegex(KassPrototypeCrmError, "followup_id 格式无效"):
            KassPrototypeCrmClient().delete_followup(
                WORKSPACE_ID,
                CUSTOMER_REF,
                "followup-1",
            )


if __name__ == "__main__":
    unittest.main()
