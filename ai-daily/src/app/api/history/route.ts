import { NextResponse } from "next/server";
import { listRecentDates, readLesson } from "@/lib/lessonStore";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam === null ? 14 : Number.parseInt(limitParam, 10);

  if (!Number.isFinite(limit) || limit < 1) {
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
  }

  const dates = await listRecentDates(limit);
  const items = await Promise.all(
    dates.map(async (date) => {
      const [morning, afternoon] = await Promise.all([
        readLesson(date, "morning"),
        readLesson(date, "afternoon"),
      ]);
      return {
        date,
        morning: morning !== null,
        afternoon: afternoon !== null,
      };
    }),
  );

  return NextResponse.json({ items });
}
