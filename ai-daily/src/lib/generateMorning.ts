import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { getTopicForDay } from "./curriculum";
import { chatJson } from "./llm";
import { writeLesson } from "./lessonStore";
import type { Lesson } from "./types";
import { validateLesson } from "./validateLesson";

const generatedLessonSchema = z.object({
  type: z.literal("basics"),
  title: z.string().min(1),
  estimatedMinutes: z.number().int().positive(),
  intro: z.string(),
  sections: z
    .array(z.object({ heading: z.string().min(1), body: z.string() }))
    .min(3)
    .max(4),
  quiz: z
    .array(
      z.object({
        question: z.string().min(1),
        options: z.array(z.string()).min(2),
        answerIndex: z.number().int(),
        explanation: z.string().min(1),
      }),
    )
    .min(2)
    .max(3),
  takeaway: z.string().min(1),
});

type GeneratedLesson = z.infer<typeof generatedLessonSchema>;

interface Progress {
  nextDay: number;
}

export interface GenerateMorningDependencies {
  chatJson: typeof chatJson;
  writeLesson: typeof writeLesson;
  now: () => Date;
}

const defaultDependencies: GenerateMorningDependencies = {
  chatJson,
  writeLesson,
  now: () => new Date(),
};

function contentRoot(): string {
  return process.env.CONTENT_ROOT ?? path.join(process.cwd(), "content");
}

function progressPath(): string {
  return path.join(contentRoot(), "progress.json");
}

async function readProgress(): Promise<Progress> {
  const progress = JSON.parse(await fs.readFile(progressPath(), "utf-8")) as Progress;
  if (!Number.isInteger(progress.nextDay) || progress.nextDay < 1) {
    throw new Error("progress.json 中的 nextDay 必须是正整数");
  }
  return progress;
}

async function advanceProgress(progress: Progress): Promise<void> {
  await fs.writeFile(
    progressPath(),
    `${JSON.stringify({ nextDay: progress.nextDay + 1 }, null, 2)}\n`,
    "utf-8",
  );
}

function buildLesson(
  generated: GeneratedLesson,
  date: string,
  curriculumDay: number,
  createdAt: string,
): Lesson {
  return {
    ...generated,
    date,
    slot: "morning",
    status: "ok",
    createdAt,
    curriculumDay,
  };
}

const SYSTEM_PROMPT = `你是面向 AI 零基础学习者的课程作者。
所有术语出现后都要立即用人话解释，并使用贴近日常生活的例子。
输出严格 JSON，不要 Markdown，不要额外说明。字段必须是：
type（固定 basics）、title、estimatedMinutes、intro、sections、quiz、takeaway。
sections 必须有 3～4 个，每项含 heading、body；quiz 必须有 2～3 题，每题含 question、options、answerIndex、explanation。
不要输出 date、slot、status、createdAt 或 curriculumDay。正文总长度（intro 加小节标题和正文）控制在 1500～2500 个字符。`;

function userPrompt(day: number, title: string, bullets: string[], retryReasons?: string[]): string {
  const correction = retryReasons?.length
    ? `\n上一次稿件未通过校验，请修正：${retryReasons.join("；")}`
    : "";
  return `请编写第 ${day} 天基础课《${title}》。必须覆盖：${bullets.join("；")}。${correction}`;
}

export async function generateMorningLesson(
  date: string,
  dependencies: Partial<GenerateMorningDependencies> = {},
): Promise<{
  lesson: Lesson;
  writeResult: Awaited<ReturnType<typeof writeLesson>>;
}> {
  const deps = { ...defaultDependencies, ...dependencies };
  const progress = await readProgress();
  const topic = getTopicForDay(progress.nextDay);
  if (!topic) {
    throw new Error(
      `课程大纲已结束：找不到第 ${progress.nextDay} 天内容，请扩展 content/curriculum.json 后再生成`,
    );
  }

  let retryReasons: string[] | undefined;
  let finalLesson: Lesson | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await deps.chatJson(
      SYSTEM_PROMPT,
      userPrompt(topic.day, topic.title, topic.bullets, retryReasons),
    );
    const parsed = generatedLessonSchema.safeParse(raw);
    if (!parsed.success) {
      if (attempt === 0) {
        retryReasons = ["返回的 JSON 字段或结构不符合要求"];
        continue;
      }
      throw new Error(`LLM 返回结构无效：${z.prettifyError(parsed.error)}`);
    }

    const lesson = buildLesson(
      parsed.data,
      date,
      topic.day,
      deps.now().toISOString(),
    );
    const validation = validateLesson(lesson);
    finalLesson = lesson;
    if (validation.ok) {
      break;
    }
    retryReasons = validation.reasons;
  }

  if (!finalLesson) {
    throw new Error("未能生成早间课程");
  }
  const validation = validateLesson(finalLesson);
  finalLesson.status = validation.ok ? "ok" : "draft_quality";

  const result = await deps.writeLesson(finalLesson);
  if (
    result === "written" &&
    (finalLesson.status === "ok" || finalLesson.status === "draft_quality")
  ) {
    await advanceProgress(progress);
  }

  return { lesson: finalLesson, writeResult: result };
}
