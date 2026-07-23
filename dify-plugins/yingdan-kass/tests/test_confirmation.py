"""删除一次性确认机制单元测试。"""

from __future__ import annotations

import unittest

from lib.client import YingdanApiError
from lib.confirmation import create_delete_confirmation, consume_delete_confirmation


class FakeStorage:
    """在内存中模拟 Dify Storage 的 set/get/delete。"""

    def __init__(self) -> None:
        """初始化空的二进制键值存储。"""

        self.values: dict[str, bytes] = {}

    def set(self, key: str, value: bytes) -> None:
        """保存一个确认值。"""

        self.values[key] = value

    def get(self, key: str) -> bytes:
        """读取一个确认值；不存在时模拟 Storage 异常。"""

        if key not in self.values:
            raise KeyError(key)
        return self.values[key]

    def delete(self, key: str) -> None:
        """删除一个确认值；不存在时模拟 Storage 异常。"""

        del self.values[key]


class DeleteConfirmationTests(unittest.TestCase):
    """验证令牌绑定、过期与单次消费行为。"""

    def setUp(self) -> None:
        """为每个测试创建空 Storage。"""

        self.storage = FakeStorage()

    def test_confirmation_is_bound_and_single_use(self) -> None:
        """确认令牌只能被同一用户消费一次。"""

        prepared = create_delete_confirmation(
            self.storage,
            42,
            {
                "resource_type": "customer",
                "resource_id": 7,
                "display_name": "Acme",
            },
            now=1000,
            token_factory=lambda: "fixed-token",
        )

        consumed = consume_delete_confirmation(
            self.storage,
            42,
            prepared["confirmation_token"],
            now=1100,
        )

        self.assertEqual(consumed["resource_id"], 7)
        with self.assertRaises(YingdanApiError) as caught:
            consume_delete_confirmation(self.storage, 42, "fixed-token", now=1101)
        self.assertEqual(caught.exception.safe_code, "confirmation_not_found")

    def test_expired_confirmation_is_rejected(self) -> None:
        """超过五分钟的令牌必须失效且从 Storage 删除。"""

        create_delete_confirmation(
            self.storage,
            42,
            {"resource_type": "category", "resource_id": 3},
            ttl_seconds=300,
            now=1000,
            token_factory=lambda: "expired-token",
        )

        with self.assertRaises(YingdanApiError) as caught:
            consume_delete_confirmation(self.storage, 42, "expired-token", now=1300)

        self.assertEqual(caught.exception.safe_code, "confirmation_expired")
        self.assertEqual(self.storage.values, {})

    def test_other_user_cannot_consume_confirmation(self) -> None:
        """不同 Provider user_id 无法猜中并消费另一个账号的令牌。"""

        create_delete_confirmation(
            self.storage,
            42,
            {"resource_type": "followup", "resource_id": 9},
            now=1000,
            token_factory=lambda: "owner-token",
        )

        with self.assertRaises(YingdanApiError) as caught:
            consume_delete_confirmation(self.storage, 99, "owner-token", now=1100)

        self.assertEqual(caught.exception.safe_code, "confirmation_not_found")


if __name__ == "__main__":
    unittest.main()
