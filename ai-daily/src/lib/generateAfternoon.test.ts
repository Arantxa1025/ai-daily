import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fallbackTopics from "../../content/fallback-topics.json";
import { generateAfternoonLesson } from "./generateAfternoon";
import { writeLesson } from "./lessonStore";
import { validateLesson } from "./validateLesson";

function generatedHotspot({ introLength = 500 }: { introLength?: number } = {}) {
  return {
    type: "hotspot",
    title: "一个值得关注的 AI 新进展",
    estimatedMinutes: 20,
    intro: "字".repeat(introLength),
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
  let contentRoot: string;

  beforeEach(async () => {
    contentRoot = await fs.mkdtemp(path.join(os.tmpdir(), "afternoon-content-"));
    await fs.writeFile(
      path.join(contentRoot, "fallback-progress.json"),
      '{ "nextIndex": 0 }\n',
    );
    process.env.CONTENT_ROOT = contentRoot;
  });

  afterEach(async () => {
    delete process.env.LESSON_ROOT;
    delete process.env.CONTENT_ROOT;
    await fs.rm(contentRoot, { recursive: true, force: true });
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

  it("fetchCandidates 抛错时视为空候选并写入降级稿", async () => {
    const chatJson = vi.fn();
    const lessonRoot = await fs.mkdtemp(path.join(os.tmpdir(), "afternoon-"));
    process.env.LESSON_ROOT = lessonRoot;

    const lesson = await generateAfternoonLesson("2026-09-25", {
      fetchCandidates: vi.fn().mockRejectedValue(new Error("network down")),
      chatJson,
      now: () => new Date("2026-09-25T09:30:00.000Z"),
    });

    expect(chatJson).not.toHaveBeenCalled();
    expect(lesson.type).toMatch(/^fallback_(classic|tool)$/);
    expect(lesson.disclaimer).toContain("公开信息");
    expect(validateLesson(lesson)).toEqual({ ok: true, reasons: [] });
    await fs.rm(lessonRoot, { recursive: true, force: true });
  });

  it("有候选但 LLM/schema/校验连续失败两次时仍写入降级稿", async () => {
    const lessonRoot = await fs.mkdtemp(path.join(os.tmpdir(), "afternoon-"));
    process.env.LESSON_ROOT = lessonRoot;
    const chatJson = vi
      .fn()
      .mockResolvedValueOnce({ type: "hotspot", title: "缺字段" })
      .mockResolvedValueOnce(generatedHotspot({ introLength: 100 }));

    const lesson = await generateAfternoonLesson("2026-09-26", {
      fetchCandidates: vi.fn().mockResolvedValue([
        { title: "AI news", url: "https://example.com/ai-news" },
      ]),
      chatJson,
      now: () => new Date("2026-09-26T09:30:00.000Z"),
    });
    const stored = JSON.parse(
      await fs.readFile(path.join(lessonRoot, "2026-09-26-afternoon.json"), "utf-8"),
    );

    expect(chatJson).toHaveBeenCalledTimes(2);
    expect(lesson.type).toMatch(/^fallback_(classic|tool)$/);
    expect(lesson.disclaimer).toContain("公开信息");
    expect(validateLesson(lesson)).toEqual({ ok: true, reasons: [] });
    expect(stored).toEqual(lesson);
    await fs.rm(lessonRoot, { recursive: true, force: true });
  });

  it("连续两次降级写入时按顺序轮换主题并推进 nextIndex", async () => {
    const lessonRoot = await fs.mkdtemp(path.join(os.tmpdir(), "afternoon-"));
    process.env.LESSON_ROOT = lessonRoot;

    const first = await generateAfternoonLesson("2026-09-27", {
      fetchCandidates: vi.fn().mockResolvedValue([]),
      chatJson: vi.fn(),
      now: () => new Date("2026-09-27T09:30:00.000Z"),
    });
    const second = await generateAfternoonLesson("2026-09-28", {
      fetchCandidates: vi.fn().mockResolvedValue([]),
      chatJson: vi.fn(),
      now: () => new Date("2026-09-28T09:30:00.000Z"),
    });

    expect(first.title).toBe(fallbackTopics[0].title);
    expect(second.title).toBe(fallbackTopics[1].title);
    expect(
      JSON.parse(await fs.readFile(path.join(contentRoot, "fallback-progress.json"), "utf-8")),
    ).toEqual({ nextIndex: 2 });
    await fs.rm(lessonRoot, { recursive: true, force: true });
  });

  it("已有 ok 下午课时跳过降级稿且不推进 nextIndex", async () => {
    const lessonRoot = await fs.mkdtemp(path.join(os.tmpdir(), "afternoon-"));
    process.env.LESSON_ROOT = lessonRoot;
    const date = "2026-09-29";
    const existing = {
      ...generatedHotspot(),
      date,
      slot: "afternoon" as const,
      status: "ok" as const,
      createdAt: "2026-09-29T08:00:00.000Z",
    };
    await writeLesson(existing);
    const writeResults: string[] = [];

    await generateAfternoonLesson(date, {
      fetchCandidates: vi.fn().mockResolvedValue([]),
      chatJson: vi.fn(),
      writeLesson: async (lesson) => {
        const result = await writeLesson(lesson);
        writeResults.push(result);
        return result;
      },
      now: () => new Date("2026-09-29T09:30:00.000Z"),
    });

    expect(writeResults).toEqual(["skipped_existing_ok"]);
    expect(
      JSON.parse(await fs.readFile(path.join(contentRoot, "fallback-progress.json"), "utf-8")),
    ).toEqual({ nextIndex: 0 });
    expect(
      JSON.parse(await fs.readFile(path.join(lessonRoot, `${date}-afternoon.json`), "utf-8")),
    ).toEqual(existing);
    await fs.rm(lessonRoot, { recursive: true, force: true });
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
