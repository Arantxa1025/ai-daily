import { z } from "zod";
import { createFallbackLesson } from "./fallbackHotspot";
import { chatJson } from "./llm";
import { writeLesson } from "./lessonStore";
import { fetchHotspotCandidates, type HotspotCandidate } from "./rss";
import type { Lesson } from "./types";
import { validateLesson } from "./validateLesson";

const generatedLessonSchema = z.object({
  type: z.literal("hotspot"),
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
  disclaimer: z.string().min(1),
  sourceIndexes: z.array(z.number().int().nonnegative()).max(3).optional(),
});

export interface GenerateAfternoonDependencies {
  fetchCandidates: () => Promise<HotspotCandidate[]>;
  chatJson: typeof chatJson;
  writeLesson: typeof writeLesson;
  now: () => Date;
}

const defaultDependencies: GenerateAfternoonDependencies = {
  fetchCandidates: fetchHotspotCandidates,
  chatJson,
  writeLesson,
  now: () => new Date(),
};

const SYSTEM_PROMPT = `你是面向 AI 零基础学习者的热点课程作者。
从候选资讯中选择一个可信且对普通人有意义的主热点，不要补写候选中没有的事实。
输出严格 JSON，不要 Markdown，不要额外说明。字段必须是：
type（固定 hotspot）、title、estimatedMinutes、intro、sections、quiz、takeaway、disclaimer、sourceIndexes。
sourceIndexes 是实际采用的候选序号数组；sections 必须有 3～4 个，覆盖“发生了什么、为什么火、和普通人有什么关系”；quiz 必须有 2～3 题。
disclaimer 必须说明“根据公开信息整理，非投资/内幕建议”。
正文总长度（intro 加小节标题和正文）控制在 1500～2500 个字符。`;

function userPrompt(candidates: HotspotCandidate[], retryReasons?: string[]): string {
  const material = candidates
    .slice(0, 12)
    .map(
      (candidate, index) =>
        `[${index}] 标题：${candidate.title}\n链接：${candidate.url}\n摘要：${candidate.summary ?? "无"}`,
    )
    .join("\n\n");
  const correction = retryReasons?.length
    ? `\n上一次稿件未通过校验，请修正：${retryReasons.join("；")}`
    : "";
  return `请根据以下候选编写今天的热点课：\n\n${material}${correction}`;
}

function buildHotspotLesson(
  generated: z.infer<typeof generatedLessonSchema>,
  candidates: HotspotCandidate[],
  date: string,
  createdAt: string,
): Lesson {
  const indexes = generated.sourceIndexes?.length ? generated.sourceIndexes : [0];
  const sources = [...new Set(indexes)]
    .map((index) => candidates[index])
    .filter((candidate): candidate is HotspotCandidate => candidate !== undefined)
    .map(({ title, url }) => ({ title, url }));
  const { sourceIndexes: _sourceIndexes, ...content } = generated;
  void _sourceIndexes;
  return {
    ...content,
    date,
    slot: "afternoon",
    status: "ok",
    sources: sources.length ? sources : [{ title: candidates[0].title, url: candidates[0].url }],
    createdAt,
  };
}

export async function generateAfternoonLesson(
  date: string,
  dependencies: Partial<GenerateAfternoonDependencies> = {},
): Promise<Lesson> {
  const deps = { ...defaultDependencies, ...dependencies };
  const createdAt = deps.now().toISOString();
  let candidates: HotspotCandidate[] = [];
  try {
    candidates = await deps.fetchCandidates();
  } catch {
    candidates = [];
  }

  if (candidates.length) {
    let retryReasons: string[] | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const raw = await deps.chatJson(SYSTEM_PROMPT, userPrompt(candidates, retryReasons));
        const parsed = generatedLessonSchema.safeParse(raw);
        if (!parsed.success) {
          retryReasons = ["返回的 JSON 字段或结构不符合要求"];
          continue;
        }
        const lesson = buildHotspotLesson(parsed.data, candidates, date, createdAt);
        const validation = validateLesson(lesson);
        if (!validation.ok) {
          retryReasons = validation.reasons;
          continue;
        }
        await deps.writeLesson(lesson);
        return lesson;
      } catch {
        break;
      }
    }
  }

  const fallback = createFallbackLesson(date, createdAt);
  const validation = validateLesson(fallback);
  if (!validation.ok) {
    fallback.status = "draft_quality";
  }
  await deps.writeLesson(fallback);
  return fallback;
}
