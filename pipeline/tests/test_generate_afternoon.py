import json

import pytest

from src import paths
from src.generate_afternoon import DISCLAIMER, generate_afternoon
from src.validate import validate_lesson


def generated_hotspot(length: int = 1500) -> dict:
    return {
        "type": "hotspot",
        "title": "一个值得关注的 AI 新进展",
        "estimatedMinutes": 20,
        "intro": "字" * length,
        "sections": [
            {"heading": "发生了什么", "body": ""},
            {"heading": "为什么火", "body": ""},
            {"heading": "与你何干", "body": ""},
        ],
        "quiz": [
            {
                "question": "核心是什么？",
                "options": ["A", "B"],
                "answerIndex": 0,
                "explanation": "解析",
            },
            {
                "question": "如何看待？",
                "options": ["A", "B"],
                "answerIndex": 1,
                "explanation": "解析",
            },
        ],
        "takeaway": "理性看待热点",
        "disclaimer": "模型返回的错误句子",
        "sourceIndexes": [0],
    }


@pytest.fixture
def content_tmp(tmp_path, monkeypatch):
    content = tmp_path / "content"
    lessons = content / "lessons"
    lessons.mkdir(parents=True)
    topics = [
        {
            "type": "fallback_classic",
            "title": "经典复盘：AI 幻觉",
            "subject": "AI 幻觉",
            "action": "核验关键事实",
        },
        {
            "type": "fallback_tool",
            "title": "工具打卡：摘要",
            "subject": "长文摘要",
            "action": "回看原文",
        },
    ]
    (content / "fallback-topics.json").write_text(
        json.dumps(topics, ensure_ascii=False), encoding="utf-8"
    )
    (content / "fallback-progress.json").write_text(
        '{"nextIndex": 0}\n', encoding="utf-8"
    )
    monkeypatch.setattr(paths, "content_dir", lambda: content)
    monkeypatch.setattr(paths, "lessons_dir", lambda: lessons)
    return content


def test_afternoon_hotspot_writes_sources_and_fixed_disclaimer(content_tmp):
    candidate = {
        "title": "AI news",
        "url": "https://example.com/news",
        "summary": "A useful update",
        "published_at": "2026-09-22T08:00:00Z",
    }
    prompts = []

    def fake_chat(system, user):
        prompts.append((system, user))
        return generated_hotspot()

    lesson, result = generate_afternoon(
        "2026-09-22",
        chat_json=fake_chat,
        fetch_candidates=lambda: [candidate],
    )

    assert result == "written"
    assert lesson["status"] == "ok"
    assert lesson["sources"] == [{"title": candidate["title"], "url": candidate["url"]}]
    assert lesson["disclaimer"] == DISCLAIMER == "根据公开信息整理，非投资/内幕建议。"
    assert "零基础" in prompts[0][0]
    assert "严格 JSON" in prompts[0][0]


def test_afternoon_empty_candidates_writes_valid_fallback_without_chat(content_tmp):
    called = False

    def fake_chat(_system, _user):
        nonlocal called
        called = True
        raise AssertionError("空候选不应调用 LLM")

    lesson, result = generate_afternoon(
        "2026-09-22",
        chat_json=fake_chat,
        fetch_candidates=lambda: [],
    )

    assert called is False
    assert result == "written"
    assert lesson["type"] == "fallback_classic"
    assert lesson["disclaimer"] == DISCLAIMER
    assert validate_lesson(lesson) == (True, [])
    assert json.loads(
        (content_tmp / "fallback-progress.json").read_text(encoding="utf-8")
    ) == {"nextIndex": 1}


def test_afternoon_failed_or_invalid_chat_falls_back(content_tmp):
    calls = 0

    def fake_chat(_system, _user):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise RuntimeError("LLM unavailable")
        return generated_hotspot(100)

    lesson, result = generate_afternoon(
        "2026-09-23",
        chat_json=fake_chat,
        fetch_candidates=lambda: [
            {"title": "新闻", "url": "https://example.com", "summary": "摘要"}
        ],
    )

    assert calls == 1
    assert result == "written"
    assert lesson["type"].startswith("fallback_")


def test_afternoon_skip_existing_ok_does_not_advance_fallback(content_tmp):
    existing = generated_hotspot() | {
        "date": "2026-09-22",
        "slot": "afternoon",
        "status": "ok",
        "createdAt": "2026-09-22T00:00:00Z",
        "disclaimer": DISCLAIMER,
    }
    existing.pop("sourceIndexes")
    (content_tmp / "lessons" / "2026-09-22-afternoon.json").write_text(
        json.dumps(existing, ensure_ascii=False), encoding="utf-8"
    )

    _, result = generate_afternoon(
        "2026-09-22",
        chat_json=lambda _system, _user: pytest.fail("已有 ok 稿时不应调用 LLM"),
        fetch_candidates=lambda: [
            {"title": "新闻", "url": "https://example.com", "summary": "摘要"}
        ],
    )

    assert result == "skipped_existing_ok"
    assert json.loads(
        (content_tmp / "fallback-progress.json").read_text(encoding="utf-8")
    ) == {"nextIndex": 0}
