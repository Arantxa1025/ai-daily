"use client";

import { useState } from "react";
import type { QuizItem } from "@/lib/types";

type QuizProps = {
  items: QuizItem[];
};

function QuizQuestion({ item, index }: { item: QuizItem; index: number }) {
  const [selected, setSelected] = useState<number | null>(null);
  const isCorrect = selected === item.answerIndex;

  return (
    <section className="quiz-question" aria-labelledby={`quiz-question-${index}`}>
      <p className="quiz-number">第 {index + 1} 题</p>
      <h3 id={`quiz-question-${index}`}>{item.question}</h3>
      <div className="quiz-options" role="group" aria-label={`第 ${index + 1} 题选项`}>
        {item.options.map((option, optionIndex) => {
          const isChosen = selected === optionIndex;
          const classNames = [
            "quiz-option",
            selected !== null && optionIndex === item.answerIndex ? "is-answer" : "",
            isChosen && !isCorrect ? "is-wrong" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              className={classNames}
              disabled={selected !== null}
              key={option}
              onClick={() => setSelected(optionIndex)}
              type="button"
            >
              <span aria-hidden="true">{String.fromCharCode(65 + optionIndex)}</span>
              {option}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <div
          className={`quiz-feedback ${isCorrect ? "is-correct" : "is-incorrect"}`}
          role="status"
        >
          <strong>{isCorrect ? "答对了。" : "这次没答对。"}</strong>
          <p>{item.explanation}</p>
        </div>
      )}
    </section>
  );
}

export default function Quiz({ items }: QuizProps) {
  if (items.length === 0) return null;

  return (
    <section className="quiz" aria-labelledby="quiz-title">
      <div className="section-kicker">随堂小测</div>
      <h2 id="quiz-title">停一下，确认你真的懂了</h2>
      <p className="quiz-intro">每题只能选择一次，不计分，也不会保存结果。</p>
      <div className="quiz-list">
        {items.map((item, index) => (
          <QuizQuestion item={item} index={index} key={`${index}-${item.question}`} />
        ))}
      </div>
    </section>
  );
}
