import json

import httpx
import pytest

from src.llm_minimax import chat_json


@pytest.fixture
def env_with_key(monkeypatch):
    monkeypatch.setenv("MINIMAX_API_KEY", "test-key")
    monkeypatch.setenv("MINIMAX_BASE_URL", "https://api.minimaxi.com/v1")
    monkeypatch.setenv("MINIMAX_MODEL", "MiniMax-M3")


def test_chat_json_sends_correct_request(env_with_key):
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("Authorization")
        captured["body"] = json.loads(request.content.decode())
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": '{"title": "hello"}'}}],
            },
        )

    transport = httpx.MockTransport(handler)
    client = httpx.Client(transport=transport)

    result = chat_json("system prompt", "user prompt", client=client)

    assert captured["url"] == "https://api.minimaxi.com/v1/chat/completions"
    assert captured["auth"] == "Bearer test-key"
    assert captured["body"]["model"] == "MiniMax-M3"
    assert captured["body"]["max_completion_tokens"] == 8192
    assert captured["body"]["response_format"] == {"type": "json_object"}
    assert captured["body"]["messages"] == [
        {"role": "system", "content": "system prompt"},
        {"role": "user", "content": "user prompt"},
    ]
    assert result == {"title": "hello"}


def test_chat_json_missing_api_key(monkeypatch):
    monkeypatch.delenv("MINIMAX_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="MINIMAX_API_KEY"):
        chat_json("s", "u")
