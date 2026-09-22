import HomeClient, { type LessonCatalog } from "@/components/HomeClient";
import type { HistoryEntry } from "@/components/HistoryList";
import { listRecentDates, readLesson } from "@/lib/lessonStore";
import type { LessonSlot } from "@/lib/types";

async function lessonsFor(date: string) {
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
  const recentDates = await listRecentDates(60);
  const catalog: LessonCatalog = {};

  await Promise.all(
    recentDates.map(async (date) => {
      catalog[date] = await lessonsFor(date);
    }),
  );

  const history: HistoryEntry[] = recentDates
    .map((date) => ({
      date,
      slots: (["morning", "afternoon"] as LessonSlot[]).filter((slot) => catalog[date]?.[slot]),
    }))
    .filter((entry) => entry.slots.length > 0);

  return <HomeClient catalog={catalog} history={history} />;
}
