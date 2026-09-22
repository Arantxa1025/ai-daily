import json

import pytest

from src import paths
from src.generate_morning import generate_morning


def generated(length: int) -> dict:
    return {
        "type": "basics",
        "title": "AI 是什么",
        "estimatedMinutes": 20,
        "intro": "字" * length,
        "sections": [
            {"heading": "概念", "body": ""},
            {"heading": "例子", "body": ""},
            {"heading": "边界", "body": ""},
        ],
        "quiz": [
            {
                "question": "问题一",
                "options": ["A", "B"],
                "answerIndex": 0,
                "explanation": "解析",
            },
            {
                "question": "问题二",
                "options": ["A", "B"],
                "answerIndex": 1,
                "explanation": "解析",
            },
        ],
        "takeaway": "记住核心概念",
    }


@pytest.fixture
def content_tmp(tmp_path, monkeypatch):
    content = tmp_path / "content"
    lessons = content / "lessons"
    lessons.mkdir(parents=True)
    (content / "curriculum.json").write_text(
        json.dumps(
            [{"day": 1, "title": "AI 到底是什么", "bullets": ["概念", "边界"]}],
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (content / "progress.json").write_text('{"nextDay": 1}\n', encoding="utf-8")
    monkeypatch.setattr(paths, "content_dir", lambda: content)
    monkeypatch.setattr(paths, "lessons_dir", lambda: lessons)
    return content


def test_morning_retries_then_writes_and_advances(content_tmp):
    replies = iter([generated(100), generated(1500)])
    prompts = []

    def fake_chat(system, user):
        prompts.append((system, user))
        return next(replies)

    lesson, result = generate_morning("2026-09-22", chat_json=fake_chat)

    assert len(prompts) == 2
    assert "零基础" in prompts[0][0]
    assert "术语" in prompts[0][0] and "人话" in prompts[0][0]
    assert "严格 JSON" in prompts[0][0]
    assert result == "written"
    assert lesson["status"] == "ok"
    assert lesson["curriculumDay"] == 1
    assert json.loads(
        (content_tmp / "progress.json").read_text(encoding="utf-8")
    ) == {"nextDay": 2}


def test_morning_writes_draft_quality_after_second_invalid_reply(content_tmp):
    lesson, result = generate_morning(
        "2026-09-22", chat_json=lambda _system, _user: generated(100)
    )

    assert result == "written"
    assert lesson["status"] == "draft_quality"
    assert json.loads(
        (content_tmp / "progress.json").read_text(encoding="utf-8")
    ) == {"nextDay": 2}


def test_morning_skip_existing_ok_does_not_advance(content_tmp):
    existing = generated(1500) | {
        "date": "2026-09-22",
        "slot": "morning",
        "status": "ok",
        "createdAt": "2026-09-22T00:00:00Z",
    }
    (content_tmp / "lessons" / "2026-09-22-morning.json").write_text(
        json.dumps(existing, ensure_ascii=False), encoding="utf-8"
    )

    _, result = generate_morning(
        "2026-09-22",
        chat_json=lambda _system, _user: pytest.fail("已有 ok 稿时不应调用 LLM"),
    )

    assert result == "skipped_existing_ok"
    assert json.loads(
        (content_tmp / "progress.json").read_text(encoding="utf-8")
    ) == {"nextDay": 1}


def test_morning_raises_clear_error_when_outline_is_empty(content_tmp):
    (content_tmp / "progress.json").write_text('{"nextDay": 2}\n', encoding="utf-8")

    with pytest.raises(
        RuntimeError,
        match="课程大纲已结束：找不到第 2 天内容，请扩展 content/curriculum.json 后再生成",
    ):
        generate_morning("2026-09-23", chat_json=lambda _system, _user: generated(1500))
