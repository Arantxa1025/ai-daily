from typing import Literal, NotRequired, TypedDict

LessonSlot = Literal["morning", "afternoon"]
LessonType = Literal["basics", "hotspot", "fallback_classic", "fallback_tool"]
LessonStatus = Literal["ok", "draft_quality", "failed_placeholder"]


class LessonSection(TypedDict):
    heading: str
    body: str


class QuizItem(TypedDict):
    question: str
    options: list[str]
    answerIndex: int
    explanation: str


class LessonSource(TypedDict):
    title: str
    url: str


class Lesson(TypedDict):
    date: str
    slot: LessonSlot
    type: LessonType
    title: str
    estimatedMinutes: int
    intro: str
    sections: list[LessonSection]
    quiz: list[QuizItem]
    takeaway: str
    status: LessonStatus
    createdAt: str
    disclaimer: NotRequired[str]
    sources: NotRequired[list[LessonSource]]
    curriculumDay: NotRequired[int]
