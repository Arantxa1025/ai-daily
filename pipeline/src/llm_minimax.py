from __future__ import annotations

import json
import os
import re

import httpx

DEFAULT_BASE_URL = "https://api.minimaxi.com/v1"
DEFAULT_MODEL = "MiniMax-M3"
MAX_COMPLETION_TOKENS = 8192

_JSON_SYSTEM_SUFFIX = (
    "\n\n你必须只输出合法 JSON 对象，不要包含 markdown 代码块或其他说明文字。"
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


def _parse_json_content(content: str) -> dict:
    text = content.strip()
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    block = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if block:
        parsed = json.loads(block.group(1))
        if isinstance(parsed, dict):
            return parsed

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        parsed = json.loads(text[start : end + 1])
        if isinstance(parsed, dict):
            return parsed

    raise ValueError("无法从 MiniMax 响应中解析 JSON")


def chat_json(system: str, user: str, *, client: httpx.Client | None = None) -> dict:
    api_key = _get_api_key()
    base_url = _get_base_url()
    model = _get_model()
    url = f"{base_url}/chat/completions"

    payload: dict = {
        "model": model,
        "max_completion_tokens": MAX_COMPLETION_TOKENS,
        "response_format": {"type": "json_object"},
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
        if response.status_code == 400 and "response_format" in response.text.lower():
            payload.pop("response_format")
            payload["messages"][0]["content"] = system + _JSON_SYSTEM_SUFFIX
            response = client.post(url, json=payload, headers=headers)

        if response.status_code >= 400:
            raise RuntimeError(f"MiniMax API {response.status_code}: {response.text}")

        data = response.json()
        choices = data.get("choices") or []
        content = choices[0].get("message", {}).get("content") if choices else None
        if not content:
            raise RuntimeError("MiniMax 返回内容为空")
        return _parse_json_content(content)
    finally:
        if owns_client:
            client.close()
