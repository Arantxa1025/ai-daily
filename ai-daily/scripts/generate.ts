import { generateMorningLesson } from "../src/lib/generateMorning";
import { generateAfternoonLesson } from "../src/lib/generateAfternoon";
import { formatShanghaiDate } from "../src/lib/time";

async function main(): Promise<void> {
  const slot = process.argv[2];
  if (slot !== "morning" && slot !== "afternoon") {
    throw new Error("用法：npx tsx scripts/generate.ts <morning|afternoon>");
  }
  if (slot === "afternoon") {
    const lesson = await generateAfternoonLesson(formatShanghaiDate(new Date()));
    console.log(
      `晚间课程已处理：${lesson.date}《${lesson.title}》，类型 ${lesson.type}，状态 ${lesson.status}`,
    );
    return;
  }
  if (!process.env.LLM_API_KEY) {
    throw new Error("缺少 LLM_API_KEY，请先配置大模型 API 密钥后再生成课程");
  }
  if (!process.env.LLM_BASE_URL) {
    throw new Error("缺少 LLM_BASE_URL，请配置兼容 OpenAI 的接口地址");
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
