from datetime import datetime, timezone
from typing import Callable

from src.fallback import (
    DISCLAIMER,
    advance_fallback,
    create_fallback_lesson,
    pick_fallback_topic,
)
from src.fetch_sources import fetch_hotspot_candidates
from src.llm_minimax import chat_json as default_chat_json
from src.models import Lesson
from src.store import WriteResult, write_lesson
from src.validate import validate_lesson

ChatJson = Callable[[str, str], dict]
FetchCandidates = Callable[[], list[dict]]

SYSTEM_PROMPT = """你是面向 AI 零基础学习者的热点课程作者。
所有术语都要紧跟人话解释；只使用候选资讯中的事实，不得补写无来源的信息。
输出严格 JSON，不要 Markdown，不要额外说明。字段必须是：
type（固定 hotspot）、title、estimatedMinutes、intro、sections、quiz、takeaway、disclaimer、sourceIndexes。
sections 必须有 3～4 个，覆盖“发生了什么、为什么火、和普通人有什么关系”；quiz 必须有 2～3 题。
disclaimer 必须是“根据公开信息整理，非投资/内幕建议。”。
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
    if value["type"] != "hotspot":
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
    if not all(
        isinstance(item, dict)
        and isinstance(item.get("question"), str)
        and bool(item["question"])
        and isinstance(item.get("options"), list)
        and len(item["options"]) >= 2
        and isinstance(item.get("answerIndex"), int)
        and not isinstance(item.get("answerIndex"), bool)
        and isinstance(item.get("explanation"), str)
        for item in quiz
    ):
        return False
    indexes = value.get("sourceIndexes", [0])
    return isinstance(indexes, list) and all(
        isinstance(index, int) and not isinstance(index, bool) and index >= 0
        for index in indexes
    )


def _user_prompt(candidates: list[dict], retry_reasons: list[str] | None = None) -> str:
    material = "\n\n".join(
        (
            f"[{index}] 标题：{candidate['title']}\n"
            f"链接：{candidate['url']}\n"
            f"摘要：{candidate.get('summary') or '无'}"
        )
        for index, candidate in enumerate(candidates[:12])
    )
    correction = (
        f"\n上一次稿件未通过校验，请修正：{'；'.join(retry_reasons)}"
        if retry_reasons
        else ""
    )
    return f"请根据以下候选编写今天的热点课：\n\n{material}{correction}"


def _build_hotspot(raw: dict, candidates: list[dict], date: str) -> Lesson:
    indexes = raw.get("sourceIndexes") or [0]
    seen: set[int] = set()
    sources = []
    for index in indexes:
        if index in seen or index >= len(candidates):
            continue
        seen.add(index)
        candidate = candidates[index]
        sources.append({"title": candidate["title"], "url": candidate["url"]})
    if not sources:
        sources = [{"title": candidates[0]["title"], "url": candidates[0]["url"]}]
    return {
        "type": "hotspot",
        "title": raw["title"],
        "estimatedMinutes": raw["estimatedMinutes"],
        "intro": raw["intro"],
        "sections": raw["sections"],
        "quiz": raw["quiz"],
        "takeaway": raw["takeaway"],
        "date": date,
        "slot": "afternoon",
        "status": "ok",
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "disclaimer": DISCLAIMER,
        "sources": sources,
    }


def _write_fallback(date: str) -> tuple[Lesson, WriteResult]:
    lesson = create_fallback_lesson(date, pick_fallback_topic())
    ok, _ = validate_lesson(lesson)
    if not ok:
        lesson["status"] = "draft_quality"
    result = write_lesson(lesson)
    if result == "written":
        advance_fallback()
    return lesson, result


def generate_afternoon(
    date: str,
    *,
    chat_json: ChatJson = default_chat_json,
    fetch_candidates: FetchCandidates = fetch_hotspot_candidates,
) -> tuple[Lesson, WriteResult]:
    try:
        candidates = fetch_candidates()
    except Exception:
        candidates = []

    if candidates:
        retry_reasons: list[str] | None = None
        for _attempt in range(2):
            try:
                raw = chat_json(SYSTEM_PROMPT, _user_prompt(candidates, retry_reasons))
            except Exception:
                break
            if not _valid_generated(raw):
                retry_reasons = ["返回的 JSON 字段或结构不符合要求"]
                continue
            lesson = _build_hotspot(raw, candidates, date)
            ok, reasons = validate_lesson(lesson)
            if not ok:
                retry_reasons = reasons
                continue
            return lesson, write_lesson(lesson)

    return _write_fallback(date)
