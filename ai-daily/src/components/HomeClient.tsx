"use client";

import { useEffect, useMemo, useState } from "react";
import HomeDashboard from "@/components/HomeDashboard";
import type { HistoryEntry } from "@/components/HistoryList";
import { addDays, getRecommendedSlot } from "@/lib/time";
import type { Lesson, LessonSlot } from "@/lib/types";

export type LessonCatalog = Record<string, Partial<Record<LessonSlot, Lesson>>>;

type HomeClientProps = {
  catalog: LessonCatalog;
  history: HistoryEntry[];
};

export default function HomeClient({ catalog, history }: HomeClientProps) {
  const [recommendation, setRecommendation] = useState(() => getRecommendedSlot());

  useEffect(() => {
    setRecommendation(getRecommendedSlot());
    const id = window.setInterval(() => setRecommendation(getRecommendedSlot()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const todayLessons = useMemo(
    () => catalog[recommendation.date] ?? {},
    [catalog, recommendation.date],
  );
  const yesterdayLessons = useMemo(
    () => catalog[recommendation.yesterday] ?? catalog[addDays(recommendation.date, -1)] ?? {},
    [catalog, recommendation.date, recommendation.yesterday],
  );

  return (
    <HomeDashboard
      history={history}
      recommendation={recommendation}
      todayLessons={todayLessons}
      yesterdayLessons={yesterdayLessons}
    />
  );
}
