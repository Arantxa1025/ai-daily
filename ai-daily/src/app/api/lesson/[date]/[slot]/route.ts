import { NextResponse } from "next/server";
import { readLesson } from "@/lib/lessonStore";
import type { LessonSlot } from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidSlot(slot: string): slot is LessonSlot {
  return slot === "morning" || slot === "afternoon";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string; slot: string }> },
) {
  const { date, slot } = await params;

  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (!isValidSlot(slot)) {
    return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
  }

  const lesson = await readLesson(date, slot);
  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(lesson);
}
