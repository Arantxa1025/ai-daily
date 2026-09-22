import HomeDashboard from "@/components/HomeDashboard";
import type { HistoryEntry } from "@/components/HistoryList";
import { listRecentDates, readLesson } from "@/lib/lessonStore";
import { getRecommendedSlot } from "@/lib/time";
import type { Lesson, LessonSlot } from "@/lib/types";

export const dynamic = "force-dynamic";

async function lessonsFor(date: string): Promise<Partial<Record<LessonSlot, Lesson>>> {
  const [morning, afternoon] = await Promise.all([
    readLesson(date, "morning"),
    readLesson(date, "afternoon"),
  ]);

  return {
    ...(morning ? { morning } : {}),
    ...(afternoon ? { afternoon } : {}),
  };
}

export default async function Home() {
  const recommendation = getRecommendedSlot();
  const [todayLessons, yesterdayLessons, recentDates] = await Promise.all([
    lessonsFor(recommendation.date),
    lessonsFor(recommendation.yesterday),
    listRecentDates(8),
  ]);

  const history: HistoryEntry[] = await Promise.all(
    recentDates.map(async (date) => {
      const lessons = await lessonsFor(date);
      return {
        date,
        slots: (["morning", "afternoon"] as LessonSlot[]).filter((slot) => lessons[slot]),
      };
    }),
  );

  return (
    <HomeDashboard
      history={history.filter((entry) => entry.slots.length > 0)}
      recommendation={recommendation}
      todayLessons={todayLessons}
      yesterdayLessons={yesterdayLessons}
    />
  );
}
