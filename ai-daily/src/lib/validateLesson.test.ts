import { describe, expect, it } from "vitest";
import type { Lesson } from "./types";
import { countChineseAwareChars, validateLesson } from "./validateLesson";

function lessonWithContentLength(length: number, over: Partial<Lesson> = {}): Lesson {
  return {
    date: "2026-09-22",
    slot: "morning",
    type: "basics",
    title: "AI 入门",
    estimatedMinutes: 20,
    intro: "引".repeat(length),
    sections: [{ heading: "", body: "" }],
    quiz: [
      { question: "问题一", options: ["A", "B"], answerIndex: 0, explanation: "解析" },
      { question: "问题二", options: ["A", "B"], answerIndex: 1, explanation: "解析" },
    ],
    takeaway: "一句话总结",
    status: "ok",
    createdAt: "2026-09-22T00:00:00.000Z",
    ...over,
  };
}

describe("countChineseAwareChars", () => {
  it("只统计开篇与各小节标题、正文的字符数", () => {
    const lesson = lessonWithContentLength(2, {
      intro: "你好",
      sections: [
        { heading: "标题", body: "正文" },
        { heading: "二", body: "内容" },
      ],
    });

    expect(countChineseAwareChars(lesson)).toBe(9);
  });
});

describe("validateLesson", () => {
  it.each([
    [1499, false],
    [1500, true],
    [2500, true],
    [2501, false],
  ])("字数为 %i 时 ok=%s", (length, expected) => {
    expect(validateLesson(lessonWithContentLength(length)).ok).toBe(expected);
  });

  it("拒绝少于两题或多于三题的小测", () => {
    const oneQuiz = lessonWithContentLength(1500);
    oneQuiz.quiz = oneQuiz.quiz.slice(0, 1);
    const fourQuiz = lessonWithContentLength(1500);
    fourQuiz.quiz = [...fourQuiz.quiz, ...fourQuiz.quiz];

    expect(validateLesson(oneQuiz).reasons).toContain("小测题目数量必须为 2～3 道");
    expect(validateLesson(fourQuiz).reasons).toContain("小测题目数量必须为 2～3 道");
  });

  it("拒绝选项不足或答案索引越界的题目", () => {
    const lesson = lessonWithContentLength(1500);
    lesson.quiz[0].options = ["唯一选项"];
    lesson.quiz[1].answerIndex = 2;

    const result = validateLesson(lesson);
    expect(result.reasons).toContain("第 1 题至少需要 2 个选项");
    expect(result.reasons).toContain("第 2 题答案索引无效");
  });

  it.each(["hotspot", "fallback_classic", "fallback_tool"] as const)(
    "拒绝缺少免责声明的 %s 内容",
    (type) => {
      const result = validateLesson(lessonWithContentLength(1500, { type }));
      expect(result.ok).toBe(false);
      expect(result.reasons).toContain("热点或降级内容必须包含免责声明");
    },
  );
});
