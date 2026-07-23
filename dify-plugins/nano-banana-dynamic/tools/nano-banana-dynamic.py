"""Nano Banana 2、Nano Banana Pro 与 GPT Image 2 的 Dify Tool 实现。"""

import base64
import binascii
import logging
from collections.abc import Generator, Sequence
from dataclasses import dataclass
from typing import Any

import requests
from dify_plugin import Tool
from dify_plugin.config.logger_format import plugin_logger_handler
from dify_plugin.entities.tool import ToolInvokeMessage

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if plugin_logger_handler not in logger.handlers:
    logger.addHandler(plugin_logger_handler)

GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
OPENROUTER_IMAGES_URL = "https://openrouter.ai/api/v1/images"
DEFAULT_MODEL = "gemini-3.1-flash-image"
OPENROUTER_MODEL = "openai/gpt-image-2"
OPENROUTER_QUALITY = "auto"
SUPPORTED_MODELS = {
    "gemini-3.1-flash-image",
    "gemini-3-pro-image",
    OPENROUTER_MODEL,
}
FLASH_RATIOS = {
    "1:1",
    "1:4",
    "1:8",
    "2:3",
    "3:2",
    "3:4",
    "4:1",
    "4:3",
    "4:5",
    "5:4",
    "8:1",
    "9:16",
    "16:9",
    "21:9",
}
PRO_RATIOS = {
    "1:1",
    "2:3",
    "3:2",
    "3:4",
    "4:3",
    "4:5",
    "5:4",
    "9:16",
    "16:9",
    "21:9",
}
MAX_GEMINI_REFERENCES = 14
MAX_OPENROUTER_REFERENCES = 16


@dataclass(frozen=True)
class GeneratedImage:
    """一个供应商返回的已解码图片。

    属性:
        data: 已解码的图片二进制内容。
        mime_type: 图片 MIME 类型，例如 image/png。
    """

    data: bytes
    mime_type: str


@dataclass(frozen=True)
class GenerationResult:
    """一次供应商生图调用的统一结果。

    属性:
        images: 生成的图片列表。
        texts: 供应商附带返回的文本列表。
        metadata: 可安全输出到 Dify 的调用元数据，不包含凭证。
    """

    images: list[GeneratedImage]
    texts: list[str]
    metadata: dict[str, Any]


def normalize_model(raw_model: Any) -> str:
    """把工作流传入的模型名或常见别名转换为正式模型 ID。

    参数:
        raw_model: Dify 上游变量传入的任意值。空值默认使用 Nano Banana 2。

    返回值:
        Gemini 或 OpenRouter 当前使用的正式模型 ID。

    异常:
        ValueError: 值不是本插件支持的三个模型之一时抛出。
    """
    value = str(raw_model or DEFAULT_MODEL).strip().lower()
    aliases = {
        "nano banana 2": "gemini-3.1-flash-image",
        "nano-banana-2": "gemini-3.1-flash-image",
        "nano_banana_2": "gemini-3.1-flash-image",
        "gemini-3.1-flash-image-preview": "gemini-3.1-flash-image",
        "nano banana pro": "gemini-3-pro-image",
        "nano-banana-pro": "gemini-3-pro-image",
        "nano_banana_pro": "gemini-3-pro-image",
        "gemini-3-pro-image-preview": "gemini-3-pro-image",
        "gpt image 2": OPENROUTER_MODEL,
        "gpt-image-2": OPENROUTER_MODEL,
        "gpt_image_2": OPENROUTER_MODEL,
    }
    model = aliases.get(value, value)
    if model not in SUPPORTED_MODELS:
        raise ValueError(
            "model 仅支持 gemini-3.1-flash-image、gemini-3-pro-image "
            "或 openai/gpt-image-2。"
        )
    return model


def normalize_aspect_ratio(raw_ratio: Any, model: str) -> str:
    """校验并标准化工作流请求的画面比例。

    参数:
        raw_ratio: 上游传入的比例；支持 16:9，也兼容 16/9 和 auto。
        model: 已由 normalize_model 校验过的正式模型 ID。

    返回值:
        Gemini 使用其支持的冒号格式比例；OpenRouter 模型保留请求值用于元数据。

    异常:
        ValueError: Gemini 模型不支持指定比例时抛出。
    """
    ratio = str(raw_ratio or "auto").strip().lower().replace("/", ":")
    if model == OPENROUTER_MODEL:
        return ratio or "auto"
    if ratio == "auto":
        # 不显式发送比例时，Google 会尽量跟随输入图比例；
        # 如果没有输入图，则使用官方默认的 1:1。
        return "auto"

    allowed = FLASH_RATIOS if model == "gemini-3.1-flash-image" else PRO_RATIOS
    if ratio not in allowed:
        supported = ", ".join(sorted(allowed))
        raise ValueError(f"模型 {model} 不支持比例 {ratio}；可用值：{supported}。")
    return ratio


def normalize_resolution(raw_resolution: Any, model: str) -> str:
    """校验并标准化工作流请求的输出分辨率。

    参数:
        raw_resolution: 上游传入的分辨率，例如 auto、1K、2k、0.5K。
        model: 已校验的正式模型 ID。

    返回值:
        Gemini API 接受的 512、1K、2K、4K，或 GPT Image 2 的请求记录值。

    异常:
        ValueError: Gemini 分辨率未知，或对 Nano Banana Pro 传入 512 时抛出。
    """
    value = str(raw_resolution or "auto").strip().upper().replace(" ", "")
    if model == OPENROUTER_MODEL:
        return value.lower() if value == "AUTO" else value
    if value == "AUTO":
        # 保留 auto，让 Google 自行使用当前默认的 1K，
        # 同时避免在未来默认值变更时把旧值写死。
        return "auto"
    if value in {"0.5K", "512PX"}:
        value = "512"

    allowed = {"512", "1K", "2K", "4K"}
    if value not in allowed:
        raise ValueError("resolution 仅支持 auto、0.5K/512、1K、2K 或 4K。")
    if model == "gemini-3-pro-image" and value == "512":
        raise ValueError("Nano Banana Pro 不支持 0.5K/512，请使用 1K、2K 或 4K。")
    return value


def validate_reference_images(
    images: Sequence[Any],
    max_images: int,
) -> list[tuple[str, bytes]]:
    """读取并校验 Dify ToolFile 参考图片。

    参数:
        images: Dify ToolFile 对象序列。
        max_images: 当前模型允许的最大参考图数量。

    返回值:
        由 MIME 类型和 bytes 内容组成的元组列表。

    异常:
        ValueError: 图片过多、文件不是图片或二进制内容不可读时抛出。
    """
    if len(images) > max_images:
        raise ValueError(f"当前模型参考图片最多 {max_images} 张。")

    validated: list[tuple[str, bytes]] = []
    for index, image in enumerate(images, start=1):
        mime_type = str(getattr(image, "mime_type", "") or "").lower()
        blob = getattr(image, "blob", None)
        if not mime_type.startswith("image/"):
            raise ValueError(
                f"第 {index} 个参考文件不是图片：{mime_type or '未知类型'}。"
            )
        if not isinstance(blob, (bytes, bytearray)):
            raise ValueError(f"第 {index} 个参考图片缺少可读取的二进制内容。")
        validated.append((mime_type, bytes(blob)))
    return validated


def build_interaction_input(
    prompt: str,
    images: Sequence[Any],
) -> str | list[dict[str, str]]:
    """构造 Google Gemini Interactions API 输入。

    参数:
        prompt: 非空的图片生成或编辑指令。
        images: Dify ToolFile 参考图片序列。

    返回值:
        无参考图时返回提示词；有参考图时返回 text/image 内容块列表。

    异常:
        ValueError: 参考图片不符合 Gemini 限制时抛出。
    """
    if not images:
        return prompt

    content: list[dict[str, str]] = [{"type": "text", "text": prompt}]
    for mime_type, blob in validate_reference_images(
        images,
        MAX_GEMINI_REFERENCES,
    ):
        content.append(
            {
                "type": "image",
                "mime_type": mime_type,
                "data": base64.b64encode(blob).decode("ascii"),
            }
        )
    return content


def build_openrouter_references(images: Sequence[Any]) -> list[dict[str, Any]]:
    """构造 OpenRouter Image API 的 base64 data URL 参考图。

    参数:
        images: Dify ToolFile 参考图片序列。

    返回值:
        OpenRouter input_references 数组；无参考图时为空列表。

    异常:
        ValueError: 参考图片超过 16 张或文件内容无效时抛出。
    """
    references: list[dict[str, Any]] = []
    for mime_type, blob in validate_reference_images(
        images,
        MAX_OPENROUTER_REFERENCES,
    ):
        encoded = base64.b64encode(blob).decode("ascii")
        references.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{mime_type};base64,{encoded}",
                },
            }
        )
    return references


def decode_image_data(data: Any, service_name: str) -> bytes:
    """安全解码供应商返回的 Base64 图片。

    参数:
        data: 供应商 JSON 中的 Base64 字符串。
        service_name: 用于错误提示的供应商名称。

    返回值:
        解码后的图片 bytes。

    异常:
        ValueError: 数据为空或不是有效 Base64 时抛出。
    """
    if not data:
        raise ValueError(f"{service_name} 返回了空图片数据。")
    try:
        return base64.b64decode(str(data), validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError(f"{service_name} 返回的图片数据不是有效 Base64。") from exc


def extract_gemini_content(
    payload: dict[str, Any],
) -> tuple[list[GeneratedImage], list[str]]:
    """从 Google Interactions API 响应提取图片和文本。

    参数:
        payload: Google API 解码后的 JSON 对象。

    返回值:
        二元组（图片列表, 文本列表）。

    异常:
        ValueError: 返回的图片 Base64 数据损坏时抛出。
    """
    generated_images: list[GeneratedImage] = []
    generated_texts: list[str] = []
    raw_steps = payload.get("steps") or payload.get("outputs") or []
    if not isinstance(raw_steps, list):
        raw_steps = []

    for step in raw_steps:
        if not isinstance(step, dict):
            continue
        blocks = step.get("content", [])
        if isinstance(blocks, dict):
            blocks = [blocks]
        if not isinstance(blocks, list):
            continue

        for block in blocks:
            if not isinstance(block, dict):
                continue
            block_type = block.get("type")
            if block_type == "text" and block.get("text"):
                generated_texts.append(str(block["text"]))
            elif block_type == "image" and block.get("data"):
                generated_images.append(
                    GeneratedImage(
                        data=decode_image_data(block["data"], "Google"),
                        # Gemini Interactions 当前对这两个模型只接受
                        # JPEG 输出；若响应未重复 MIME，必须与请求格式一致。
                        mime_type=str(block.get("mime_type") or "image/jpeg"),
                    )
                )
    return generated_images, generated_texts


def extract_openrouter_content(
    payload: dict[str, Any],
) -> tuple[list[GeneratedImage], list[str]]:
    """从 OpenRouter Image API 响应提取图片和修订提示词。

    参数:
        payload: OpenRouter API 解码后的 JSON 对象。

    返回值:
        二元组（图片列表, 文本列表）。

    异常:
        ValueError: data 不是数组，或图片 Base64 数据损坏时抛出。
    """
    raw_images = payload.get("data", [])
    if not isinstance(raw_images, list):
        raise ValueError("OpenRouter 返回的 data 不是图片数组。")

    generated_images: list[GeneratedImage] = []
    generated_texts: list[str] = []
    for item in raw_images:
        if not isinstance(item, dict):
            continue
        if item.get("revised_prompt"):
            generated_texts.append(str(item["revised_prompt"]))
        if item.get("b64_json"):
            generated_images.append(
                GeneratedImage(
                    data=decode_image_data(item["b64_json"], "OpenRouter"),
                    mime_type=str(item.get("media_type") or "image/png"),
                )
            )
    return generated_images, generated_texts


def response_error_message(
    response: requests.Response,
    service_name: str,
) -> str:
    """从失败的 HTTP 响应提取不泄密的错误信息。

    参数:
        response: requests 返回的 HTTP 响应。
        service_name: Google 或 OpenRouter 等供应商名称。

    返回值:
        优先返回 error.message，否则返回供应商名称与 HTTP 状态码。

    异常:
        无。JSON 解析失败会自动回退。
    """
    try:
        payload = response.json()
        error = payload.get("error", {}) if isinstance(payload, dict) else {}
        if isinstance(error, dict) and error.get("message"):
            return str(error["message"])
        if isinstance(error, str) and error:
            return error
    except ValueError:
        pass
    return f"{service_name} 返回 HTTP {response.status_code}。"


def post_json(
    url: str,
    headers: dict[str, str],
    payload: dict[str, Any],
    service_name: str,
) -> dict[str, Any]:
    """发送一次非流式图片生成请求并返回 JSON。

    参数:
        url: 固定的官方 API 地址。
        headers: 当前供应商鉴权请求头。
        payload: 已校验的请求体。
        service_name: 用于日志和异常信息的供应商名称。

    返回值:
        供应商返回的 JSON 字典。

    异常:
        RuntimeError: 请求超时、网络失败、HTTP 失败或返回非 JSON 字典时抛出。
    """
    try:
        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=(10, 330),
        )
    except requests.Timeout as exc:
        logger.error("%s image request timed out", service_name)
        raise RuntimeError(f"{service_name} 生图请求超时，请稍后重试。") from exc
    except requests.RequestException as exc:
        logger.error("%s image request failed: %s", service_name, type(exc).__name__)
        raise RuntimeError(f"无法连接 {service_name}，请检查网络或代理。") from exc

    if not response.ok:
        message = response_error_message(response, service_name)
        logger.error("%s image request returned HTTP %d", service_name, response.status_code)
        raise RuntimeError(f"{service_name} 生图失败：{message}")

    try:
        response_payload = response.json()
    except ValueError as exc:
        raise RuntimeError(f"{service_name} 返回了无法解析的响应。") from exc
    if not isinstance(response_payload, dict):
        raise RuntimeError(f"{service_name} 返回的数据结构异常。")
    return response_payload


def generate_with_gemini(
    api_key: str,
    prompt: str,
    model: str,
    aspect_ratio: str,
    resolution: str,
    images: Sequence[Any],
) -> GenerationResult:
    """调用 Google Gemini Interactions API。

    参数:
        api_key: Gemini API Key。
        prompt: 图片生成或编辑提示词。
        model: Nano Banana 2 或 Nano Banana Pro 正式模型 ID。
        aspect_ratio: 已校验的 Google 画面比例。
        resolution: 已校验的 Google 图片分辨率。
        images: 可选 Dify ToolFile 参考图片。

    返回值:
        统一 GenerationResult，标记比例和分辨率已实际应用。

    异常:
        ValueError: 参考图或响应图片无效时抛出。
        RuntimeError: Google 请求失败或没有返回图片时抛出。
    """
    logger.info(
        "Starting Gemini image request model=%s ratio=%s resolution=%s references=%d",
        model,
        aspect_ratio,
        resolution,
        len(images),
    )
    response_format: dict[str, str] = {
        "type": "image",
        # Nano Banana 2 与 Pro 的当前 Interactions endpoint 会拒绝
        # image/png，并明确返回唯一支持值 image/jpeg。
        "mime_type": "image/jpeg",
    }
    # auto 通过省略字段表示，从而尊重 Google 对参考图比例
    # 和默认分辨率的处理，而不是人为强制为 1:1 / 1K。
    if aspect_ratio != "auto":
        response_format["aspect_ratio"] = aspect_ratio
    if resolution != "auto":
        response_format["image_size"] = resolution

    payload = post_json(
        url=GEMINI_INTERACTIONS_URL,
        headers={
            "x-goog-api-key": api_key,
            "Content-Type": "application/json",
        },
        payload={
            "model": model,
            "input": build_interaction_input(prompt, images),
            "response_format": response_format,
        },
        service_name="Google Gemini",
    )
    generated_images, generated_texts = extract_gemini_content(payload)
    if not generated_images:
        detail = generated_texts[0] if generated_texts else "响应中没有图片。"
        raise RuntimeError(f"Google Gemini 未生成图片：{detail}")
    return GenerationResult(
        images=generated_images,
        texts=generated_texts,
        metadata={
            "dimension_control_applied": True,
            "quality_control_applied": False,
        },
    )


def generate_with_openrouter(
    api_key: str,
    prompt: str,
    images: Sequence[Any],
) -> GenerationResult:
    """调用 OpenRouter 专用 Image API 的 GPT Image 2。

    参数:
        api_key: OpenRouter API Key。
        prompt: 图片生成或编辑提示词。
        images: 可选 Dify ToolFile 参考图片，最多 16 张。

    返回值:
        统一 GenerationResult，包含 OpenRouter usage 信息。

    异常:
        ValueError: 参考图或返回图片无效时抛出。
        RuntimeError: OpenRouter 请求失败或没有返回图片时抛出。
    """
    logger.info(
        "Starting OpenRouter image request model=%s references=%d",
        OPENROUTER_MODEL,
        len(images),
    )
    request_payload: dict[str, Any] = {
        "model": OPENROUTER_MODEL,
        "prompt": prompt,
        # 用户只选模型，不再单独选图片质量；由 OpenRouter
        # 与 GPT Image 2 按 auto 自动决定合适的质量档位。
        "quality": OPENROUTER_QUALITY,
        "n": 1,
    }
    references = build_openrouter_references(images)
    if references:
        request_payload["input_references"] = references

    payload = post_json(
        url=OPENROUTER_IMAGES_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        payload=request_payload,
        service_name="OpenRouter",
    )
    generated_images, generated_texts = extract_openrouter_content(payload)
    if not generated_images:
        raise RuntimeError("OpenRouter GPT Image 2 未返回图片。")
    usage = payload.get("usage", {})
    return GenerationResult(
        images=generated_images,
        texts=generated_texts,
        metadata={
            "dimension_control_applied": False,
            "dimension_control_note": (
                "OpenRouter 当前 openai/gpt-image-2 能力未声明 resolution "
                "或 aspect_ratio，本次输出尺寸由供应商自动选择。"
            ),
            "quality_mode": OPENROUTER_QUALITY,
            "quality_control_applied": False,
            "openrouter_usage": usage if isinstance(usage, dict) else {},
        },
    )


class NanoBananaDynamicTool(Tool):
    """Dify Tool：调用 Nano Banana 2 / Pro 或 GPT Image 2。"""

    def _invoke(
        self,
        tool_parameters: dict[str, Any],
    ) -> Generator[ToolInvokeMessage, None, None]:
        """执行一次图片生成或编辑请求。

        参数:
            tool_parameters: Dify 工具参数，包含 prompt、model、
                aspect_ratio、resolution 和可选 images。

        返回值:
            生成器。依次输出供应商文本、图片 BLOB 与调用元数据 JSON。

        异常:
            ValueError: 输入参数无效时抛出。
            RuntimeError: 对应模型凭证缺失、供应商失败或没有返回图片时抛出。
        """
        prompt = str(tool_parameters.get("prompt") or "").strip()
        if not prompt:
            raise ValueError("prompt 不能为空。")

        model = normalize_model(tool_parameters.get("model"))
        aspect_ratio = normalize_aspect_ratio(
            tool_parameters.get("aspect_ratio"),
            model,
        )
        resolution = normalize_resolution(
            tool_parameters.get("resolution"),
            model,
        )
        raw_images = tool_parameters.get("images") or []
        images = raw_images if isinstance(raw_images, list) else [raw_images]

        if model == OPENROUTER_MODEL:
            api_key = str(
                self.runtime.credentials.get("openrouter_api_key") or ""
            ).strip()
            if not api_key:
                raise RuntimeError(
                    "使用 openai/gpt-image-2 前，请在工具授权中填写 OpenRouter API Key。"
                )
            result = generate_with_openrouter(
                api_key=api_key,
                prompt=prompt,
                images=images,
            )
            filename_prefix = "gpt-image-2"
        else:
            api_key = str(
                self.runtime.credentials.get("gemini_api_key") or ""
            ).strip()
            if not api_key:
                raise RuntimeError(
                    "使用 Nano Banana 2 或 Nano Banana Pro 前，"
                    "请在工具授权中填写 Gemini API Key。"
                )
            result = generate_with_gemini(
                api_key=api_key,
                prompt=prompt,
                model=model,
                aspect_ratio=aspect_ratio,
                resolution=resolution,
                images=images,
            )
            filename_prefix = "nano-banana"

        for text in result.texts:
            yield self.create_text_message(text=text)

        extension_by_mime = {
            "image/jpeg": "jpg",
            "image/webp": "webp",
            "image/gif": "gif",
            "image/svg+xml": "svg",
        }
        for index, image in enumerate(result.images, start=1):
            extension = extension_by_mime.get(image.mime_type.lower(), "png")
            yield self.create_blob_message(
                blob=image.data,
                meta={
                    "filename": f"{filename_prefix}-{index}.{extension}",
                    "mime_type": image.mime_type,
                },
            )

        logger.info(
            "Image request completed model=%s images=%d",
            model,
            len(result.images),
        )
        metadata = {
            "model": model,
            "aspect_ratio": aspect_ratio,
            "resolution": resolution,
            "reference_image_count": len(images),
            "generated_image_count": len(result.images),
            **result.metadata,
        }
        yield self.create_json_message(metadata)
