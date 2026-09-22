from __future__ import annotations

from src.models import Lesson

_DISCLAIMER_TYPES = frozenset({"hotspot", "fallback_classic", "fallback_tool"})


def body_char_count(lesson: Lesson) -> int:
    return len(lesson["intro"]) + sum(
        len(section["heading"]) + len(section["body"]) for section in lesson["sections"]
    )


def validate_lesson(lesson: Lesson) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    content_length = body_char_count(lesson)

    if content_length < 1500 or content_length > 2500:
        reasons.append(f"正文长度需为 1500～2500 字，当前为 {content_length} 字")
    if len(lesson["quiz"]) < 2 or len(lesson["quiz"]) > 3:
        reasons.append("小测题目数量必须为 2～3 道")
    for index, item in enumerate(lesson["quiz"]):
        if len(item["options"]) < 2:
            reasons.append(f"第 {index + 1} 题至少需要 2 个选项")
        answer_index = item["answerIndex"]
        if (
            not isinstance(answer_index, int)
            or isinstance(answer_index, bool)
            or answer_index < 0
            or answer_index >= len(item["options"])
        ):
            reasons.append(f"第 {index + 1} 题答案索引无效")
    if lesson["type"] in _DISCLAIMER_TYPES and not (lesson.get("disclaimer") or "").strip():
        reasons.append("热点或降级内容必须包含免责声明")

    return len(reasons) == 0, reasons
