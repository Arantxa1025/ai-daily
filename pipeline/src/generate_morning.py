from __future__ import annotations

from datetime import datetime, timezone
from typing import Callable

from src.curriculum import get_topic_for_day, read_progress, write_progress
from src.llm_minimax import chat_json as default_chat_json
from src.models import Lesson
from src.store import WriteResult, read_lesson, write_lesson
from src.validate import validate_lesson

ChatJson = Callable[[str, str], dict]

SYSTEM_PROMPT = """你是面向 AI 零基础学习者的课程作者。
所有术语出现后都要立即用人话解释，并使用贴近日常生活的例子。
输出严格 JSON，不要 Markdown，不要额外说明。字段必须是：
type（固定 basics）、title、estimatedMinutes、intro、sections、quiz、takeaway。
sections 必须有 3～4 个，每项含 heading、body；quiz 必须有 2～3 题，每题含 question、options、answerIndex、explanation。
正文总长度（intro 加小节标题和正文）控制在 1500～2500 个字符。"""


def _valid_generated(value: dict) -> bool:
    required = {
        "type",
        "title",
        "estimatedMinutes",
        "intro",
        "sections",
        "quiz",
        "takeaway",
    }
    if not isinstance(value, dict) or not required.issubset(value):
        return False
    if value["type"] != "basics":
        return False
    if not isinstance(value["title"], str) or not value["title"]:
        return False
    if (
        isinstance(value["estimatedMinutes"], bool)
        or not isinstance(value["estimatedMinutes"], int)
        or value["estimatedMinutes"] <= 0
    ):
        return False
    if not isinstance(value["intro"], str) or not isinstance(value["takeaway"], str):
        return False
    sections = value["sections"]
    quiz = value["quiz"]
    if not isinstance(sections, list) or not 3 <= len(sections) <= 4:
        return False
    if not all(
        isinstance(item, dict)
        and isinstance(item.get("heading"), str)
        and bool(item["heading"])
        and isinstance(item.get("body"), str)
        for item in sections
    ):
        return False
    if not isinstance(quiz, list) or not 2 <= len(quiz) <= 3:
        return False
    return all(
        isinstance(item, dict)
        and isinstance(item.get("question"), str)
        and bool(item["question"])
        and isinstance(item.get("options"), list)
        and len(item["options"]) >= 2
        and all(isinstance(option, str) for option in item["options"])
        and isinstance(item.get("answerIndex"), int)
        and not isinstance(item.get("answerIndex"), bool)
        and isinstance(item.get("explanation"), str)
        and bool(item["explanation"])
        for item in quiz
    )


def _user_prompt(topic: dict, retry_reasons: list[str] | None = None) -> str:
    correction = (
        f"\n上一次稿件未通过校验，请修正：{'；'.join(retry_reasons)}"
        if retry_reasons
        else ""
    )
    return (
        f"请编写第 {topic['day']} 天基础课《{topic['title']}》。"
        f"必须覆盖：{'；'.join(topic['bullets'])}。{correction}"
    )


def _build_lesson(raw: dict, date: str, day: int) -> Lesson:
    return {
        "type": raw["type"],
        "title": raw["title"],
        "estimatedMinutes": raw["estimatedMinutes"],
        "intro": raw["intro"],
        "sections": raw["sections"],
        "quiz": raw["quiz"],
        "takeaway": raw["takeaway"],
        "date": date,
        "slot": "morning",
        "status": "ok",
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "curriculumDay": day,
    }


def generate_morning(
    date: str, *, chat_json: ChatJson = default_chat_json
) -> tuple[Lesson, WriteResult]:
    existing = read_lesson(date, "morning")
    if existing is not None and existing.get("status") == "ok":
        return existing, "skipped_existing_ok"

    progress = read_progress()
    topic = get_topic_for_day(progress["nextDay"])
    if topic is None:
        raise RuntimeError(
            f"课程大纲已结束：找不到第 {progress['nextDay']} 天内容，"
            "请扩展 content/curriculum.json 后再生成"
        )

    retry_reasons: list[str] | None = None
    final_lesson: Lesson | None = None
    for _attempt in range(2):
        raw = chat_json(SYSTEM_PROMPT, _user_prompt(topic, retry_reasons))
        if not _valid_generated(raw):
            retry_reasons = ["返回的 JSON 字段或结构不符合要求"]
            continue
        final_lesson = _build_lesson(raw, date, topic["day"])
        ok, reasons = validate_lesson(final_lesson)
        if ok:
            break
        retry_reasons = reasons

    if final_lesson is None:
        raise RuntimeError("LLM 连续两次返回无效结构，未能生成早间课程")

    ok, _ = validate_lesson(final_lesson)
    final_lesson["status"] = "ok" if ok else "draft_quality"
    result = write_lesson(final_lesson)
    if result == "written":
        write_progress(progress["nextDay"] + 1)
    return final_lesson, result
