import Link from "next/link";

export default function LessonNotFound() {
  return (
    <main className="not-found-page">
      <Link className="wordmark wordmark-small" href="/">
        AI 每日
      </Link>
      <div className="not-found-content">
        <span className="section-kicker">稍后再来</span>
        <h1>这一更还没好</h1>
        <p>内容可能正在生成，或者这个日期还没有课程。先回首页看看今天推荐的内容吧。</p>
        <Link className="primary-cta" href="/">
          返回首页 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </main>
  );
}
