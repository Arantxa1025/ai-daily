import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { readLesson, writeLesson } from "./lessonStore";
import type { Lesson } from "./types";

function sample(over: Partial<Lesson> = {}): Lesson {
  return {
    date: "2026-09-22",
    slot: "morning",
    type: "basics",
    title: "t",
    estimatedMinutes: 20,
    intro: "i".repeat(400),
    sections: [{ heading: "h", body: "b".repeat(1200) }],
    quiz: [
      { question: "q", options: ["a", "b"], answerIndex: 0, explanation: "e" },
      { question: "q2", options: ["a", "b"], answerIndex: 1, explanation: "e" },
    ],
    takeaway: "x",
    status: "ok",
    createdAt: new Date().toISOString(),
    ...over,
  };
}

describe("lessonStore", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "lessons-"));
    process.env.LESSON_ROOT = dir;
  });
  afterEach(async () => {
    delete process.env.LESSON_ROOT;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("writes and reads", async () => {
    await writeLesson(sample());
    const got = await readLesson("2026-09-22", "morning");
    expect(got?.title).toBe("t");
  });

  it("does not overwrite status=ok", async () => {
    await writeLesson(sample({ title: "first" }));
    const result = await writeLesson(sample({ title: "second", status: "draft_quality" }));
    expect(result).toBe("skipped_existing_ok");
    expect((await readLesson("2026-09-22", "morning"))?.title).toBe("first");
  });
});
