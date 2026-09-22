import { NextResponse } from "next/server";
import { readLesson } from "@/lib/lessonStore";
import { getRecommendedSlot } from "@/lib/time";
import type { Lesson, LessonSlot } from "@/lib/types";

type Summary = {
  title: string;
  estimatedMinutes: number;
  status: Lesson["status"];
  type: Lesson["type"];
  href: string;
};

function toSummary(lesson: Lesson): Summary {
  return {
    title: lesson.title,
    estimatedMinutes: lesson.estimatedMinutes,
    status: lesson.status,
    type: lesson.type,
    href: `/learn/${lesson.date}/${lesson.slot}`,
  };
}

export async function GET() {
  const rec = getRecommendedSlot();
  const lessons: { morning?: Summary; afternoon?: Summary } = {};

  for (const slot of ["morning", "afternoon"] as LessonSlot[]) {
    const lesson = await readLesson(rec.date, slot);
    if (lesson) {
      lessons[slot] = toSummary(lesson);
    }
  }

  return NextResponse.json({
    date: rec.date,
    primary: rec.primary,
    secondary: rec.secondary,
    nextUpdateLabel: rec.nextUpdateLabel,
    yesterday: rec.yesterday,
    lessons,
  });
}
