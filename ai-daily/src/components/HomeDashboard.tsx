import Link from "next/link";
import HistoryList, { type HistoryEntry } from "./HistoryList";
import type { Lesson, LessonSlot } from "@/lib/types";

type Recommendation = {
  date: string;
  primary: LessonSlot | null;
  secondary: LessonSlot | null;
  nextUpdateLabel: string | null;
  yesterday: string;
};

type HomeDashboardProps = {
  recommendation: Recommendation;
  todayLessons: Partial<Record<LessonSlot, Lesson>>;
  yesterdayLessons: Partial<Record<LessonSlot, Lesson>>;
  history: HistoryEntry[];
};

const slotCopy = {
  morning: { eyebrow: "今日基础", action: "开始今日基础" },
  afternoon: { eyebrow: "今日热点", action: "读今日热点" },
} as const;

function hrefFor(lesson: Lesson) {
  return `/learn/${lesson.date}/${lesson.slot}`;
}

function displayDate(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)} 月 ${Number(day)} 日`;
}

export default function HomeDashboard({
  recommendation,
  todayLessons,
  yesterdayLessons,
  history,
}: HomeDashboardProps) {
  const primaryLesson = recommendation.primary
    ? todayLessons[recommendation.primary]
    : undefined;
  const secondaryLesson = recommendation.secondary
    ? todayLessons[recommendation.secondary]
    : undefined;
  const yesterdayLesson = yesterdayLessons.afternoon ?? yesterdayLessons.morning;
  const waitingBeforeMorning = recommendation.primary === null;

  return (
    <main className="home-page">
      <header className="site-header">
        <span className="issue-date">{displayDate(recommendation.date)} · 上海时间</span>
        <span className="daily-note">每天两更，慢慢懂 AI</span>
      </header>

      <section className="home-hero" aria-labelledby="home-title">
        <p className="hero-overline">给零基础学习者的一份每日简报</p>
        <h1 className="wordmark" id="home-title">
          <span>AI</span> 每日
        </h1>
        <p className="hero-deck">不用追赶所有新词。每天四十分钟，把一个概念真正弄懂。</p>

        <div className="today-recommendation">
          {primaryLesson ? (
            <>
              <div className="recommendation-copy">
                <span className="section-kicker">{slotCopy[primaryLesson.slot].eyebrow}</span>
                <h2>{primaryLesson.title}</h2>
                <p>约 {primaryLesson.estimatedMinutes} 分钟 · 读完有小测</p>
                {primaryLesson.status === "draft_quality" && (
                  <p className="inline-notice">今日稿件质量降级，仍可阅读。</p>
                )}
              </div>
              <Link className="primary-cta" href={hrefFor(primaryLesson)}>
                {slotCopy[primaryLesson.slot].action}
                <span aria-hidden="true">→</span>
              </Link>
            </>
          ) : (
            <div className="recommendation-copy is-waiting">
              <span className="section-kicker">{waitingBeforeMorning ? "下一更" : "更新稍迟"}</span>
              <h2>{waitingBeforeMorning ? "早上七点半，我们一起开课" : "这一更还在路上"}</h2>
              <p>
                {recommendation.nextUpdateLabel ??
                  `${slotCopy[recommendation.primary!].eyebrow}暂未更新，请稍后再来。`}
              </p>
            </div>
          )}
        </div>

        <div className="secondary-actions">
          {secondaryLesson && (
            <Link href={hrefFor(secondaryLesson)}>
              <span>{slotCopy[secondaryLesson.slot].eyebrow}</span>
              {secondaryLesson.title}
            </Link>
          )}
          {!secondaryLesson && recommendation.nextUpdateLabel && primaryLesson && (
            <p className="update-note">{recommendation.nextUpdateLabel}</p>
          )}
          {yesterdayLesson && (
            <Link href={hrefFor(yesterdayLesson)}>
              <span>复习昨日</span>
              {yesterdayLesson.title}
            </Link>
          )}
        </div>
      </section>

      <HistoryList entries={history} />

      <footer className="home-footer">
        <span>AI 每日</span>
        <p>基础在早晨，热点在傍晚。无需登录，打开就学。</p>
      </footer>
    </main>
  );
}
