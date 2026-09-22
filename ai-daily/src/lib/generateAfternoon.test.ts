import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateAfternoonLesson } from "./generateAfternoon";
import { validateLesson } from "./validateLesson";

function generatedHotspot() {
  return {
    type: "hotspot",
    title: "一个值得关注的 AI 新进展",
    estimatedMinutes: 20,
    intro: "字".repeat(500),
    sections: [
      { heading: "发生了什么", body: "字".repeat(400) },
      { heading: "为什么火", body: "字".repeat(400) },
      { heading: "与你何干", body: "字".repeat(400) },
    ],
    quiz: [
      {
        question: "这条热点的核心是什么？",
        options: ["A", "B"],
        answerIndex: 0,
        explanation: "解析一",
      },
      {
        question: "应该如何看待？",
        options: ["A", "B"],
        answerIndex: 1,
        explanation: "解析二",
      },
    ],
    takeaway: "理性看待热点。",
    disclaimer: "根据公开信息整理，非投资/内幕建议。",
  };
}

describe("generateAfternoonLesson", () => {
  afterEach(() => {
    delete process.env.LESSON_ROOT;
  });

  it("空候选不调用 LLM，仍写入带免责声明的合格降级稿", async () => {
    const chatJson = vi.fn();
    const lessonRoot = await fs.mkdtemp(path.join(os.tmpdir(), "afternoon-"));
    process.env.LESSON_ROOT = lessonRoot;

    const lesson = await generateAfternoonLesson("2026-09-22", {
      fetchCandidates: vi.fn().mockResolvedValue([]),
      chatJson,
      now: () => new Date("2026-09-22T09:30:00.000Z"),
    });
    const stored = JSON.parse(
      await fs.readFile(path.join(lessonRoot, "2026-09-22-afternoon.json"), "utf-8"),
    );

    expect(chatJson).not.toHaveBeenCalled();
    expect(["fallback_classic", "fallback_tool"]).toContain(lesson.type);
    expect(lesson.disclaimer).toContain("公开信息");
    expect(validateLesson(lesson)).toEqual({ ok: true, reasons: [] });
    expect(stored).toEqual(lesson);
    await fs.rm(lessonRoot, { recursive: true, force: true });
  });

  it("LLM 失败时改用降级稿，而不是中断生成", async () => {
    const lesson = await generateAfternoonLesson("2026-09-23", {
      fetchCandidates: vi.fn().mockResolvedValue([
        { title: "AI news", url: "https://example.com/ai-news" },
      ]),
      chatJson: vi.fn().mockRejectedValue(new Error("LLM unavailable")),
      writeLesson: vi.fn().mockResolvedValue("written"),
    });

    expect(lesson.type).toMatch(/^fallback_(classic|tool)$/);
    expect(lesson.sources).toBeUndefined();
  });

  it("热点生成成功时写入来源", async () => {
    const candidate = {
      title: "AI news",
      url: "https://example.com/ai-news",
      summary: "A useful update",
    };
    const lesson = await generateAfternoonLesson("2026-09-24", {
      fetchCandidates: vi.fn().mockResolvedValue([candidate]),
      chatJson: vi.fn().mockResolvedValue(generatedHotspot()),
      writeLesson: vi.fn().mockResolvedValue("written"),
      now: () => new Date("2026-09-24T09:30:00.000Z"),
    });

    expect(lesson.type).toBe("hotspot");
    expect(lesson.status).toBe("ok");
    expect(lesson.sources).toEqual([{ title: candidate.title, url: candidate.url }]);
  });
});
