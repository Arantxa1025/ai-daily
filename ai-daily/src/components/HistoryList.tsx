import Link from "next/link";
import type { LessonSlot } from "@/lib/types";

export type HistoryEntry = {
  date: string;
  slots: LessonSlot[];
};

type HistoryListProps = {
  entries: HistoryEntry[];
};

const slotName = {
  morning: "基础",
  afternoon: "热点",
} as const;

function compactDate(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)} 月 ${Number(day)} 日`;
}

export default function HistoryList({ entries }: HistoryListProps) {
  if (entries.length === 0) return null;

  return (
    <section className="history" aria-labelledby="history-title">
      <div className="history-heading">
        <div>
          <div className="section-kicker">往期学习</div>
          <h2 id="history-title">最近更新</h2>
        </div>
        <p>想复习时，随时回来。</p>
      </div>
      <ol className="history-list">
        {entries.map((entry) => (
          <li key={entry.date}>
            <time dateTime={entry.date}>{compactDate(entry.date)}</time>
            <div className="history-links">
              {entry.slots.map((slot) => (
                <Link href={`/learn/${entry.date}/${slot}`} key={slot}>
                  {slotName[slot]}
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
