"""动态生图工具的参数校验、请求构造与响应解析测试。"""

import base64
import importlib.util
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


def load_tool_module():
    """从带连字符的 Dify 工具文件路径加载 Python 模块。

    参数:
        无。

    返回值:
        已加载的工具模块对象。

    异常:
        RuntimeError: Python 无法为目标文件创建导入规格时抛出。
    """
    module_path = (
        Path(__file__).resolve().parents[1]
        / "tools"
        / "nano-banana-dynamic.py"
    )
    spec = importlib.util.spec_from_file_location(
        "nano_banana_dynamic_tool",
        module_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("无法加载 Nano Banana 工具模块。")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


tool = load_tool_module()


class ParameterNormalizationTests(unittest.TestCase):
    """验证模型下拉值、比例和分辨率输入。"""

    def test_model_aliases_map_to_ga_models(self):
        """旧 preview ID 和产品别名应转换为当前正式模型。"""
        self.assertEqual(
            tool.normalize_model("Nano Banana 2"),
            "gemini-3.1-flash-image",
        )
        self.assertEqual(
            tool.normalize_model("gemini-3-pro-image-preview"),
            "gemini-3-pro-image",
        )
        self.assertEqual(
            tool.normalize_model("gpt-image-2"),
            "openai/gpt-image-2",
        )

    def test_flash_accepts_extended_ratio_but_pro_rejects_it(self):
        """Nano Banana 2 支持 1:8，而 Pro 必须给出明确校验错误。"""
        self.assertEqual(
            tool.normalize_aspect_ratio("1/8", "gemini-3.1-flash-image"),
            "1:8",
        )
        with self.assertRaises(ValueError):
            tool.normalize_aspect_ratio("1:8", "gemini-3-pro-image")

    def test_resolution_normalization_is_model_aware(self):
        """0.5K 应转换为 API 值 512，且仅允许 Nano Banana 2 使用。"""
        self.assertEqual(
            tool.normalize_resolution("0.5k", "gemini-3.1-flash-image"),
            "512",
        )
        self.assertEqual(
            tool.normalize_resolution("2k", "gemini-3-pro-image"),
            "2K",
        )
        with self.assertRaises(ValueError):
            tool.normalize_resolution("512", "gemini-3-pro-image")

    def test_openrouter_dimension_values_are_recorded_without_rejection(self):
        """GPT Image 2 的尺寸请求应保留在元数据中但不写入 API。"""
        self.assertEqual(
            tool.normalize_aspect_ratio("16/9", "openai/gpt-image-2"),
            "16:9",
        )
        self.assertEqual(
            tool.normalize_resolution("2k", "openai/gpt-image-2"),
            "2K",
        )

    def test_auto_dimensions_remain_auto_for_gemini(self):
        """auto 应保留到请求构造阶段，以便省略字段。"""
        self.assertEqual(
            tool.normalize_aspect_ratio("auto", "gemini-3.1-flash-image"),
            "auto",
        )
        self.assertEqual(
            tool.normalize_resolution("auto", "gemini-3-pro-image"),
            "auto",
        )


class RequestAndResponseTests(unittest.TestCase):
    """验证两个供应商的参考图请求体与响应解析。"""

    def test_reference_image_is_encoded_for_interactions_api(self):
        """Dify ToolFile 的二进制图片应转换为 Base64 image 块。"""
        image = SimpleNamespace(mime_type="image/png", blob=b"image-bytes")
        result = tool.build_interaction_input("edit it", [image])
        self.assertIsInstance(result, list)
        self.assertEqual(result[0], {"type": "text", "text": "edit it"})
        self.assertEqual(result[1]["type"], "image")
        self.assertEqual(
            base64.b64decode(result[1]["data"]),
            b"image-bytes",
        )

    def test_steps_response_yields_text_and_image(self):
        """GA Interactions API 的 steps 内容应同时解析文本与图片。"""
        encoded = base64.b64encode(b"png-data").decode("ascii")
        payload = {
            "steps": [
                {
                    "type": "model_output",
                    "content": [
                        {"type": "text", "text": "done"},
                        {
                            "type": "image",
                            "mime_type": "image/png",
                            "data": encoded,
                        },
                    ],
                }
            ]
        }
        images, texts = tool.extract_gemini_content(payload)
        self.assertEqual(texts, ["done"])
        self.assertEqual(images[0].data, b"png-data")
        self.assertEqual(images[0].mime_type, "image/png")

    def test_gemini_image_without_mime_type_defaults_to_jpeg(self):
        """Gemini 未回传 MIME 时应与已请求的 JPEG 格式保持一致。"""
        encoded = base64.b64encode(b"jpeg-data").decode("ascii")
        payload = {
            "steps": [
                {
                    "content": [
                        {
                            "type": "image",
                            "data": encoded,
                        }
                    ]
                }
            ]
        }
        images, _ = tool.extract_gemini_content(payload)
        self.assertEqual(images[0].mime_type, "image/jpeg")

    def test_openrouter_reference_uses_a_base64_data_url(self):
        """本地参考图应转为 OpenRouter 支持的 Base64 data URL。"""
        image = SimpleNamespace(mime_type="image/webp", blob=b"webp-data")
        result = tool.build_openrouter_references([image])
        self.assertEqual(result[0]["type"], "image_url")
        data_url = result[0]["image_url"]["url"]
        self.assertTrue(data_url.startswith("data:image/webp;base64,"))
        self.assertEqual(
            base64.b64decode(data_url.split(",", maxsplit=1)[1]),
            b"webp-data",
        )

    def test_openrouter_response_yields_image_and_revised_prompt(self):
        """OpenRouter data[] 中的 Base64 图片与修订提示词应被解析。"""
        payload = {
            "data": [
                {
                    "b64_json": base64.b64encode(b"image-data").decode(
                        "ascii"
                    ),
                    "media_type": "image/png",
                    "revised_prompt": "a refined prompt",
                }
            ]
        }
        images, texts = tool.extract_openrouter_content(payload)
        self.assertEqual(texts, ["a refined prompt"])
        self.assertEqual(images[0].data, b"image-data")
        self.assertEqual(images[0].mime_type, "image/png")

    def test_openrouter_request_omits_unsupported_dimension_fields(self):
        """GPT Image 2 请求不应发送当前 endpoint 未声明的尺寸字段。"""
        encoded = base64.b64encode(b"image-data").decode("ascii")
        fake_response = {
            "data": [{"b64_json": encoded, "media_type": "image/png"}],
            "usage": {"cost": 0.01},
        }

        # 替换真实 HTTP 函数，避免单元测试产生费用或依赖外网。
        with patch.object(tool, "post_json", return_value=fake_response) as mocked:
            result = tool.generate_with_openrouter(
                api_key="test-key",
                prompt="draw a product",
                images=[],
            )

        sent_payload = mocked.call_args.kwargs["payload"]
        self.assertEqual(sent_payload["model"], "openai/gpt-image-2")
        self.assertEqual(sent_payload["quality"], "auto")
        self.assertNotIn("aspect_ratio", sent_payload)
        self.assertNotIn("resolution", sent_payload)
        self.assertNotIn("size", sent_payload)
        self.assertFalse(result.metadata["dimension_control_applied"])

    def test_gemini_auto_dimensions_are_omitted_from_response_format(self):
        """Gemini auto 不应被写死为 1:1 / 1K，以便跟随参考图。"""
        encoded = base64.b64encode(b"image-data").decode("ascii")
        fake_response = {
            "steps": [
                {
                    "content": [
                        {
                            "type": "image",
                            "mime_type": "image/png",
                            "data": encoded,
                        }
                    ]
                }
            ]
        }

        # 替换真实 Google API，只验证插件最终组装的请求体。
        with patch.object(tool, "post_json", return_value=fake_response) as mocked:
            tool.generate_with_gemini(
                api_key="test-key",
                prompt="edit the visual",
                model="gemini-3.1-flash-image",
                aspect_ratio="auto",
                resolution="auto",
                images=[],
            )

        response_format = mocked.call_args.kwargs["payload"]["response_format"]
        self.assertEqual(response_format["type"], "image")
        self.assertEqual(response_format["mime_type"], "image/jpeg")
        self.assertNotIn("aspect_ratio", response_format)
        self.assertNotIn("image_size", response_format)


if __name__ == "__main__":
    unittest.main()
