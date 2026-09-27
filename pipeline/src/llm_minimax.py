from __future__ import annotations

import json
import os
import re

import httpx

DEFAULT_BASE_URL = "https://api.minimaxi.com/v1"
DEFAULT_MODEL = "MiniMax-M3"
MAX_COMPLETION_TOKENS = 8192

_JSON_SYSTEM_SUFFIX = (
    "\n\n你必须只输出一个合法 JSON 对象。"
    "不要输出 markdown 代码块、思考过程或其他说明文字。"
)

_THINK_TAG_RE = re.compile(
    r"<(?:think|thinking|reason|reasoning)\b[^>]*>.*?</(?:think|thinking|reason|reasoning)>",
    re.DOTALL | re.IGNORECASE,
)


def _get_api_key() -> str:
    key = os.environ.get("MINIMAX_API_KEY")
    if not key:
        raise RuntimeError("缺少环境变量 MINIMAX_API_KEY，无法调用 MiniMax")
    return key


def _get_base_url() -> str:
    return os.environ.get("MINIMAX_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def _get_model() -> str:
    return os.environ.get("MINIMAX_MODEL", DEFAULT_MODEL)


def _strip_noise(content: str) -> str:
    text = _THINK_TAG_RE.sub("", content)
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if fence:
        text = fence.group(1).strip()
    return text


def _parse_json_content(content: str) -> dict:
    """Parse the first JSON object from model output; ignore trailing junk."""
    text = _strip_noise(content)
    if not text:
        raise ValueError("无法从 MiniMax 响应中解析 JSON：内容为空")

    decoder = json.JSONDecoder()
    start = text.find("{")
    if start == -1:
        preview = text[:200].replace("\n", "\\n")
        raise ValueError(f"无法从 MiniMax 响应中解析 JSON：未找到对象。片段：{preview}")

    try:
        parsed, _end = decoder.raw_decode(text, start)
    except json.JSONDecodeError as exc:
        preview = text[start : start + 240].replace("\n", "\\n")
        raise ValueError(
            f"无法从 MiniMax 响应中解析 JSON：{exc}。片段：{preview}"
        ) from exc

    if not isinstance(parsed, dict):
        raise ValueError("无法从 MiniMax 响应中解析 JSON：根节点不是对象")
    return parsed


def chat_json(system: str, user: str, *, client: httpx.Client | None = None) -> dict:
    api_key = _get_api_key()
    base_url = _get_base_url()
    model = _get_model()
    url = f"{base_url}/chat/completions"

    payload: dict = {
        "model": model,
        "max_completion_tokens": MAX_COMPLETION_TOKENS,
        "response_format": {"type": "json_object"},
        # MiniMax-M3 可能默认带 thinking；关闭后更易得到纯 JSON
        "thinking": {"type": "disabled"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    owns_client = client is None
    if client is None:
        client = httpx.Client(timeout=120.0)

    try:
        response = client.post(url, json=payload, headers=headers)
        # Some gateways reject unknown fields / response_format — peel them and retry.
        if response.status_code == 400:
            body_lower = response.text.lower()
            retried = False
            if "thinking" in body_lower:
                payload.pop("thinking", None)
                retried = True
            if "response_format" in body_lower:
                payload.pop("response_format", None)
                payload["messages"][0]["content"] = system + _JSON_SYSTEM_SUFFIX
                retried = True
            if retried:
                response = client.post(url, json=payload, headers=headers)

        if response.status_code >= 400:
            raise RuntimeError(f"MiniMax API {response.status_code}: {response.text}")

        data = response.json()
        choices = data.get("choices") or []
        message = choices[0].get("message", {}) if choices else {}
        content = message.get("content")
        if not content:
            raise RuntimeError("MiniMax 返回内容为空")
        return _parse_json_content(content)
    finally:
        if owns_client:
            client.close()
