from __future__ import annotations

import json

from src import paths


def get_topic_for_day(day: int) -> dict | None:
    if isinstance(day, bool) or not isinstance(day, int) or day < 1:
        return None
    topics = json.loads(
        (paths.content_dir() / "curriculum.json").read_text(encoding="utf-8")
    )
    return next((topic for topic in topics if topic.get("day") == day), None)


def read_progress() -> dict:
    progress = json.loads(
        (paths.content_dir() / "progress.json").read_text(encoding="utf-8")
    )
    next_day = progress.get("nextDay")
    if isinstance(next_day, bool) or not isinstance(next_day, int) or next_day < 1:
        raise ValueError("progress.json 中的 nextDay 必须是正整数")
    return {"nextDay": next_day}


def write_progress(next_day: int) -> None:
    if isinstance(next_day, bool) or not isinstance(next_day, int) or next_day < 1:
        raise ValueError("next_day 必须是正整数")
    path = paths.content_dir() / "progress.json"
    path.write_text(
        json.dumps({"nextDay": next_day}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
