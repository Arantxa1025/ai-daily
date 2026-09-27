from __future__ import annotations

import json
import os
import re

import httpx
from json_repair import repair_json

DEFAULT_BASE_URL = "https://api.minimaxi.com/v1"
DEFAULT_MODEL = "MiniMax-M3"
MAX_COMPLETION_TOKENS = 8192

_JSON_SYSTEM_SUFFIX = (
    "\n\n你必须只输出一个合法 JSON 对象。"
    "不要输出 markdown 代码块、思考过程或其他说明文字。"
    "字符串内的中文引号请用「」或『』，不要使用英文双引号。"
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
    """Parse the first JSON object from model output; repair common LLM glitches."""
    text = _strip_noise(content)
    if not text:
        raise ValueError("无法从 MiniMax 响应中解析 JSON：内容为空")

    start = text.find("{")
    if start == -1:
        preview = text[:200].replace("\n", "\\n")
        raise ValueError(f"无法从 MiniMax 响应中解析 JSON：未找到对象。片段：{preview}")

    snippet = text[start:]
    decoder = json.JSONDecoder()
    try:
        parsed, _end = decoder.raw_decode(snippet)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    try:
        repaired = repair_json(snippet, return_objects=True)
    except Exception as exc:  # noqa: BLE001 — repair lib may raise varied errors
        preview = snippet[:240].replace("\n", "\\n")
        raise ValueError(
            f"无法从 MiniMax 响应中解析 JSON：修复失败 {exc}。片段：{preview}"
        ) from exc

    if isinstance(repaired, dict):
        return repaired
    if isinstance(repaired, list) and repaired and isinstance(repaired[0], dict):
        return repaired[0]

    preview = snippet[:240].replace("\n", "\\n")
    raise ValueError(f"无法从 MiniMax 响应中解析 JSON：根节点不是对象。片段：{preview}")


def _post_chat(
    client: httpx.Client,
    *,
    url: str,
    headers: dict,
    system: str,
    user: str,
) -> str:
    payload: dict = {
        "model": _get_model(),
        "max_completion_tokens": MAX_COMPLETION_TOKENS,
        "response_format": {"type": "json_object"},
        "thinking": {"type": "disabled"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }

    response = client.post(url, json=payload, headers=headers)
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
    return content


def chat_json(system: str, user: str, *, client: httpx.Client | None = None) -> dict:
    api_key = _get_api_key()
    base_url = _get_base_url()
    url = f"{base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    owns_client = client is None
    if client is None:
        client = httpx.Client(timeout=120.0)

    try:
        content = _post_chat(client, url=url, headers=headers, system=system, user=user)
        try:
            return _parse_json_content(content)
        except ValueError:
            # One repair round: ask the model to emit clean JSON only.
            repair_user = (
                "下面这段不是合法 JSON。请只输出修正后的完整 JSON 对象，"
                "不要 markdown、不要解释。字符串内中文引号用「」：\n\n"
                f"{content[:8000]}"
            )
            fixed = _post_chat(
                client,
                url=url,
                headers=headers,
                system=system + _JSON_SYSTEM_SUFFIX,
                user=repair_user,
            )
            return _parse_json_content(fixed)
    finally:
        if owns_client:
            client.close()
