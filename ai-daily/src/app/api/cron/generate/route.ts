import { NextResponse } from "next/server";
import { generateAfternoonLesson } from "@/lib/generateAfternoon";
import { generateMorningLesson } from "@/lib/generateMorning";
import { formatShanghaiDate } from "@/lib/time";

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slot = new URL(request.url).searchParams.get("slot");
  if (slot !== "morning" && slot !== "afternoon") {
    return NextResponse.json(
      { error: "slot 必须是 morning 或 afternoon" },
      { status: 400 },
    );
  }

  const date = formatShanghaiDate(new Date());
  try {
    const writeResult =
      slot === "morning"
        ? await generateMorningLesson(date)
        : await generateAfternoonLesson(date);
    return NextResponse.json({ ok: true, writeResult, date });
  } catch (error) {
    console.error(`生成 ${date} ${slot} 课程失败`, error);
    return NextResponse.json(
      { ok: false, error: "课程生成失败", date },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
