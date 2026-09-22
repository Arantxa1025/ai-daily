from __future__ import annotations

import json
from typing import Literal

from src import paths
from src.models import Lesson, LessonSlot

WriteResult = Literal["written", "skipped_existing_ok"]


def read_lesson(date: str, slot: LessonSlot) -> dict | None:
    path = paths.lessons_dir() / f"{date}-{slot}.json"
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def write_lesson(lesson: Lesson) -> WriteResult:
    existing = read_lesson(lesson["date"], lesson["slot"])
    if existing is not None and existing.get("status") == "ok":
        return "skipped_existing_ok"

    path = paths.lessons_dir() / f"{lesson['date']}-{lesson['slot']}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(lesson, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return "written"
