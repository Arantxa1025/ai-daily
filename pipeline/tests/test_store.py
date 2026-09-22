import json

import pytest

from src import paths
from src.store import read_lesson, write_lesson


def sample(**over):
    lesson = {
        "date": "2026-09-22",
        "slot": "morning",
        "type": "basics",
        "title": "t",
        "estimatedMinutes": 20,
        "intro": "i" * 400,
        "sections": [{"heading": "h", "body": "b" * 1200}],
        "quiz": [
            {
                "question": "q",
                "options": ["a", "b"],
                "answerIndex": 0,
                "explanation": "e",
            },
            {
                "question": "q2",
                "options": ["a", "b"],
                "answerIndex": 1,
                "explanation": "e",
            },
        ],
        "takeaway": "x",
        "status": "ok",
        "createdAt": "2026-09-22T00:00:00.000Z",
    }
    lesson.update(over)
    return lesson


@pytest.fixture
def lessons_tmp(tmp_path, monkeypatch):
    lessons = tmp_path / "lessons"
    lessons.mkdir()
    monkeypatch.setattr(paths, "lessons_dir", lambda: lessons)
    return lessons


def test_write_lesson_and_read_back(lessons_tmp):
    write_lesson(sample())
    got = read_lesson("2026-09-22", "morning")
    assert got is not None
    assert got["title"] == "t"


def test_write_lesson_utf8_json_format(lessons_tmp):
    write_lesson(sample())
    raw = (lessons_tmp / "2026-09-22-morning.json").read_text(encoding="utf-8")
    assert raw.endswith("\n")
    assert json.loads(raw) == sample()


def test_write_lesson_skips_existing_ok(lessons_tmp):
    write_lesson(sample(title="first"))
    result = write_lesson(sample(title="second", status="draft_quality"))
    assert result == "skipped_existing_ok"
    assert read_lesson("2026-09-22", "morning")["title"] == "first"


def test_read_lesson_returns_none_when_missing(lessons_tmp):
    assert read_lesson("2099-01-01", "afternoon") is None
