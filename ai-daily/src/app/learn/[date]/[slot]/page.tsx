import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LessonView from "@/components/LessonView";
import { listRecentDates, readLesson } from "@/lib/lessonStore";
import type { LessonSlot } from "@/lib/types";

type LessonPageProps = {
  params: Promise<{ date: string; slot: string }>;
};

function validSlot(slot: string): slot is LessonSlot {
  return slot === "morning" || slot === "afternoon";
}

function validDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export async function generateStaticParams() {
  const dates = await listRecentDates(365);
  const params: { date: string; slot: LessonSlot }[] = [];
  for (const date of dates) {
    for (const slot of ["morning", "afternoon"] as LessonSlot[]) {
      const lesson = await readLesson(date, slot);
      if (lesson) params.push({ date, slot });
    }
  }
  return params;
}

export async function generateMetadata({ params }: LessonPageProps): Promise<Metadata> {
  const { date, slot } = await params;
  if (!validDate(date) || !validSlot(slot)) return { title: "这一更还没好" };

  const lesson = await readLesson(date, slot);
  return {
    title: lesson?.title ?? "这一更还没好",
    description: lesson?.intro.slice(0, 100),
  };
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { date, slot } = await params;
  if (!validDate(date) || !validSlot(slot)) notFound();

  const lesson = await readLesson(date, slot);
  if (!lesson) notFound();

  return <LessonView lesson={lesson} />;
}
