import { generateMorningLesson } from "../src/lib/generateMorning";
import { formatShanghaiDate } from "../src/lib/time";

async function main(): Promise<void> {
  const slot = process.argv[2];
  if (slot !== "morning" && slot !== "afternoon") {
    throw new Error("用法：npx tsx scripts/generate.ts <morning|afternoon>");
  }
  if (!process.env.LLM_API_KEY) {
    throw new Error("缺少 LLM_API_KEY，请先配置大模型 API 密钥后再生成课程");
  }
  if (!process.env.LLM_BASE_URL) {
    throw new Error("缺少 LLM_BASE_URL，请配置兼容 OpenAI 的接口地址");
  }
  if (slot === "afternoon") {
    throw new Error("下午热点生成将在后续任务中实现，目前请使用 morning");
  }

  const lesson = await generateMorningLesson(formatShanghaiDate(new Date()));
  console.log(
    `早间课程已处理：${lesson.date} Day ${lesson.curriculumDay}《${lesson.title}》，状态 ${lesson.status}`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`生成失败：${message}`);
  process.exitCode = 1;
});
