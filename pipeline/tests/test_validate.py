import pytest

from src.validate import body_char_count, validate_lesson


def lesson_with_content_length(length: int, **over):
    lesson = {
        "date": "2026-09-22",
        "slot": "morning",
        "type": "basics",
        "title": "AI 入门",
        "estimatedMinutes": 20,
        "intro": "引" * length,
        "sections": [{"heading": "", "body": ""}],
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
        "takeaway": "一句话总结",
        "status": "ok",
        "createdAt": "2026-09-22T00:00:00.000Z",
    }
    lesson.update(over)
    return lesson


def test_body_char_count_sums_intro_and_sections():
    lesson = lesson_with_content_length(
        2,
        intro="你好",
        sections=[
            {"heading": "标题", "body": "正文"},
            {"heading": "二", "body": "内容"},
        ],
    )
    assert body_char_count(lesson) == 9


@pytest.mark.parametrize(
    ("length", "expected_ok"),
    [(1499, False), (1500, True), (2500, True), (2501, False)],
)
def test_validate_lesson_content_length(length, expected_ok):
    ok, _ = validate_lesson(lesson_with_content_length(length))
    assert ok is expected_ok


def test_validate_lesson_rejects_quiz_count_out_of_range():
    one_quiz = lesson_with_content_length(1500)
    one_quiz["quiz"] = one_quiz["quiz"][:1]
    four_quiz = lesson_with_content_length(1500)
    four_quiz["quiz"] = four_quiz["quiz"] * 2

    _, reasons_one = validate_lesson(one_quiz)
    _, reasons_four = validate_lesson(four_quiz)
    assert "小测题目数量必须为 2～3 道" in reasons_one
    assert "小测题目数量必须为 2～3 道" in reasons_four


def test_validate_lesson_rejects_invalid_quiz_options_and_answer_index():
    lesson = lesson_with_content_length(1500)
    lesson["quiz"][0]["options"] = ["唯一选项"]
    lesson["quiz"][1]["answerIndex"] = 2

    ok, reasons = validate_lesson(lesson)
    assert ok is False
    assert "第 1 题至少需要 2 个选项" in reasons
    assert "第 2 题答案索引无效" in reasons


@pytest.mark.parametrize("lesson_type", ["hotspot", "fallback_classic", "fallback_tool"])
def test_validate_lesson_requires_disclaimer_for_hotspot_and_fallback(lesson_type):
    ok, reasons = validate_lesson(lesson_with_content_length(1500, type=lesson_type))
    assert ok is False
    assert "热点或降级内容必须包含免责声明" in reasons
