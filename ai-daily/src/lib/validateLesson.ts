import type { Lesson } from "./types";

export interface LessonValidation {
  ok: boolean;
  reasons: string[];
}

export function countChineseAwareChars(lesson: Lesson): number {
  return (
    lesson.intro +
    lesson.sections.map((section) => section.heading + section.body).join("")
  ).length;
}

export function validateLesson(lesson: Lesson): LessonValidation {
  const reasons: string[] = [];
  const contentLength = countChineseAwareChars(lesson);

  if (contentLength < 1500 || contentLength > 2500) {
    reasons.push(`正文长度需为 1500～2500 字，当前为 ${contentLength} 字`);
  }
  if (lesson.quiz.length < 2 || lesson.quiz.length > 3) {
    reasons.push("小测题目数量必须为 2～3 道");
  }
  lesson.quiz.forEach((item, index) => {
    if (item.options.length < 2) {
      reasons.push(`第 ${index + 1} 题至少需要 2 个选项`);
    }
    if (
      !Number.isInteger(item.answerIndex) ||
      item.answerIndex < 0 ||
      item.answerIndex >= item.options.length
    ) {
      reasons.push(`第 ${index + 1} 题答案索引无效`);
    }
  });
  if (
    ["hotspot", "fallback_classic", "fallback_tool"].includes(lesson.type) &&
    !lesson.disclaimer?.trim()
  ) {
    reasons.push("热点或降级内容必须包含免责声明");
  }

  return { ok: reasons.length === 0, reasons };
}
