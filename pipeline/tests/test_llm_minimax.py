import json

import httpx
import pytest

from src.llm_minimax import _parse_json_content, chat_json


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
    assert captured["body"]["thinking"] == {"type": "disabled"}
    assert captured["body"]["messages"] == [
        {"role": "system", "content": "system prompt"},
        {"role": "user", "content": "user prompt"},
    ]
    assert result == {"title": "hello"}


def test_chat_json_missing_api_key(monkeypatch):
    monkeypatch.delenv("MINIMAX_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="MINIMAX_API_KEY"):
        chat_json("s", "u")


def test_parse_json_ignores_trailing_extra_data():
    content = (
        '{"title": "hello", "sections": [{"heading": "a", "body": "b"}]}\n'
        '{"noise": true}\n'
        "extra commentary"
    )
    assert _parse_json_content(content)["title"] == "hello"


def test_parse_json_strips_think_tags_and_fence():
    content = """<think>
I should write JSON carefully }
</think>
```json
{"title": "world", "ok": true}
```
some trailing notes }
"""
    assert _parse_json_content(content) == {"title": "world", "ok": True}


def test_parse_json_repairs_unescaped_quotes_inside_strings():
    # Classic LLM glitch: Chinese text with raw " inside a JSON string.
    content = (
        '{"type":"basics","title":"第1天","intro":"把AI这层"神秘面纱"揭开。",'
        '"estimatedMinutes":12,"sections":[],"quiz":[],"takeaway":"ok"}'
    )
    parsed = _parse_json_content(content)
    assert parsed["title"] == "第1天"
    assert "神秘面纱" in parsed["intro"]


def test_chat_json_retries_without_thinking_when_rejected(env_with_key):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content.decode())
        calls.append(body)
        if "thinking" in body:
            return httpx.Response(400, text='{"error":"unknown field thinking"}')
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": '{"title": "ok"}'}}]},
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    result = chat_json("s", "u", client=client)
    assert result == {"title": "ok"}
    assert len(calls) == 2
    assert "thinking" not in calls[1]


def test_chat_json_repair_round_on_broken_json(env_with_key):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content.decode())
        calls.append(body)
        if len(calls) == 1:
            # Unrecoverable enough that repair_json alone may not always
            # produce a dict we trust — still exercise the second API call path
            # by returning something empty of braces first... use broken then fixed.
            return httpx.Response(
                200,
                json={
                    "choices": [
                        {
                            "message": {
                                "content": "NOT JSON AT ALL please fix me",
                            }
                        }
                    ]
                },
            )
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": '{"title": "fixed"}'}}]},
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    result = chat_json("s", "u", client=client)
    assert result == {"title": "fixed"}
    assert len(calls) == 2
    assert "不是合法 JSON" in calls[1]["messages"][1]["content"]
