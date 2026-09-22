import Link from "next/link";
import Quiz from "./Quiz";
import type { Lesson } from "@/lib/types";

type LessonViewProps = {
  lesson: Lesson;
};

const slotLabel = {
  morning: "AI 基础",
  afternoon: "AI 热点",
} as const;

function displayDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${year} 年 ${Number(month)} 月 ${Number(day)} 日`;
}

export default function LessonView({ lesson }: LessonViewProps) {
  return (
    <main className="lesson-page">
      <header className="site-header reading-header">
        <Link className="wordmark wordmark-small" href="/" aria-label="返回 AI 每日首页">
          AI 每日
        </Link>
        <Link className="back-link" href="/">
          返回今日推荐
        </Link>
      </header>

      {lesson.status === "draft_quality" && (
        <div className="quality-notice" role="status">
          今日稿件质量降级，仍可阅读。部分内容可能比平时简略。
        </div>
      )}

      <article className="lesson-article">
        <header className="lesson-hero">
          <div className="lesson-meta">
            <span>{slotLabel[lesson.slot]}</span>
            <span>{displayDate(lesson.date)}</span>
            <span>约 {lesson.estimatedMinutes} 分钟</span>
          </div>
          <h1>{lesson.title}</h1>
          <p className="lesson-intro">{lesson.intro}</p>
        </header>

        <div className="lesson-body">
          {lesson.sections.map((section, index) => (
            <section className="lesson-section" key={`${index}-${section.heading}`}>
              <div className="section-index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </div>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>

        <Quiz items={lesson.quiz} />

        <aside className="takeaway" aria-labelledby="takeaway-title">
          <div className="section-kicker">一句话带走</div>
          <h2 id="takeaway-title">{lesson.takeaway}</h2>
        </aside>

        {lesson.sources && lesson.sources.length > 0 && (
          <aside className="lesson-sources" aria-labelledby="sources-title">
            <h2 id="sources-title">参考来源</h2>
            <ul>
              {lesson.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} rel="noreferrer" target="_blank">
                    {source.title}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        )}

        {lesson.disclaimer && <p className="disclaimer">{lesson.disclaimer}</p>}
      </article>
    </main>
  );
}
