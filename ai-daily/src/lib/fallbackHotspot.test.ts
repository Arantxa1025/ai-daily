import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fallbackTopics from "../../content/fallback-topics.json";
import {
  advanceFallbackProgress,
  createFallbackLesson,
  pickTopicIndex,
  readFallbackProgress,
} from "./fallbackHotspot";

describe("fallbackHotspot", () => {
  let contentRoot: string;

  beforeEach(async () => {
    contentRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fallback-"));
    await fs.writeFile(
      path.join(contentRoot, "fallback-progress.json"),
      '{ "nextIndex": 0 }\n',
    );
    process.env.CONTENT_ROOT = contentRoot;
  });

  afterEach(async () => {
    delete process.env.CONTENT_ROOT;
    await fs.rm(contentRoot, { recursive: true, force: true });
  });

  it("按 nextIndex 顺序选取主题，并在成功写入后推进", async () => {
    const progress = await readFallbackProgress();
    expect(pickTopicIndex(progress)).toBe(0);

    const first = createFallbackLesson("2026-09-22", pickTopicIndex(progress));
    expect(first.title).toBe(fallbackTopics[0].title);

    await advanceFallbackProgress(progress);

    const nextProgress = await readFallbackProgress();
    expect(nextProgress.nextIndex).toBe(1);

    const second = createFallbackLesson("2026-09-23", pickTopicIndex(nextProgress));
    expect(second.title).toBe(fallbackTopics[1].title);
  });

  it("nextIndex 到达末尾后按主题数量取模回绕", async () => {
    const lastIndex = fallbackTopics.length - 1;
    await fs.writeFile(
      path.join(contentRoot, "fallback-progress.json"),
      `${JSON.stringify({ nextIndex: lastIndex }, null, 2)}\n`,
    );

    const progress = await readFallbackProgress();
    const lesson = createFallbackLesson("2026-09-22", pickTopicIndex(progress));
    expect(lesson.title).toBe(fallbackTopics[lastIndex].title);

    await advanceFallbackProgress(progress);

    expect(JSON.parse(await fs.readFile(path.join(contentRoot, "fallback-progress.json"), "utf-8"))).toEqual({
      nextIndex: 0,
    });
  });
});
