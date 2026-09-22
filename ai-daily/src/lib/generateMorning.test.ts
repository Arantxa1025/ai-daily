import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateMorningLesson } from "./generateMorning";

function generated(contentLength: number) {
  return {
    type: "basics",
    title: "AI 是什么",
    estimatedMinutes: 20,
    intro: "字".repeat(contentLength),
    sections: [
      { heading: "概念", body: "" },
      { heading: "例子", body: "" },
      { heading: "边界", body: "" },
    ],
    quiz: [
      { question: "问题一", options: ["A", "B"], answerIndex: 0, explanation: "解析" },
      { question: "问题二", options: ["A", "B"], answerIndex: 1, explanation: "解析" },
    ],
    takeaway: "记住核心概念",
  };
}

describe("generateMorningLesson", () => {
  let contentRoot: string;

  beforeEach(async () => {
    contentRoot = await fs.mkdtemp(path.join(os.tmpdir(), "morning-"));
    await fs.writeFile(path.join(contentRoot, "progress.json"), '{ "nextDay": 1 }\n');
    process.env.CONTENT_ROOT = contentRoot;
  });

  afterEach(async () => {
    delete process.env.CONTENT_ROOT;
    await fs.rm(contentRoot, { recursive: true, force: true });
  });

  it("校验失败后重试，成功写入才推进课程进度", async () => {
    const chat = vi
      .fn()
      .mockResolvedValueOnce(generated(100))
      .mockResolvedValueOnce(generated(1500));

    const { lesson, writeResult } = await generateMorningLesson("2026-09-22", {
      chatJson: chat,
      writeLesson: vi.fn().mockResolvedValue("written"),
      now: () => new Date("2026-09-22T00:00:00.000Z"),
    });

    expect(chat).toHaveBeenCalledTimes(2);
    expect(writeResult).toBe("written");
    expect(lesson.status).toBe("ok");
    expect(lesson.curriculumDay).toBe(1);
    expect(JSON.parse(await fs.readFile(path.join(contentRoot, "progress.json"), "utf-8"))).toEqual({
      nextDay: 2,
    });
  });

  it("二次校验仍失败时写入 draft_quality 并推进进度", async () => {
    const { lesson, writeResult } = await generateMorningLesson("2026-09-22", {
      chatJson: vi.fn().mockResolvedValue(generated(100)),
      writeLesson: vi.fn().mockResolvedValue("written"),
    });

    expect(writeResult).toBe("written");
    expect(lesson.status).toBe("draft_quality");
    expect(JSON.parse(await fs.readFile(path.join(contentRoot, "progress.json"), "utf-8")).nextDay).toBe(
      2,
    );
  });

  it("已有 ok 稿导致跳过写入时不推进进度", async () => {
    const { writeResult } = await generateMorningLesson("2026-09-22", {
      chatJson: vi.fn().mockResolvedValue(generated(1500)),
      writeLesson: vi.fn().mockResolvedValue("skipped_existing_ok"),
    });

    expect(writeResult).toBe("skipped_existing_ok");
    expect(JSON.parse(await fs.readFile(path.join(contentRoot, "progress.json"), "utf-8")).nextDay).toBe(
      1,
    );
  });

  it("课程大纲结束后给出明确的扩展提示", async () => {
    await fs.writeFile(path.join(contentRoot, "progress.json"), '{ "nextDay": 61 }\n');

    await expect(generateMorningLesson("2026-11-21")).rejects.toThrow(
      "课程大纲已结束：找不到第 61 天内容，请扩展 content/curriculum.json 后再生成",
    );
  });
});
