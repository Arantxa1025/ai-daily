// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Quiz from "./Quiz";
import type { QuizItem } from "@/lib/types";

const item: QuizItem = {
  question: "模型为什么会产生幻觉？",
  options: ["它在预测下一个词", "它故意撒谎"],
  answerIndex: 0,
  explanation: "模型是在生成最可能的文字，并不天然知道事实真假。",
};

describe("Quiz", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderQuiz() {
    await act(async () => root.render(<Quiz items={[item]} />));
    return Array.from(container.querySelectorAll("button"));
  }

  it("shows the explanation and locks the question after a correct choice", async () => {
    const buttons = await renderQuiz();

    await act(async () => buttons[0].click());

    expect(container.textContent).toContain("答对了。");
    expect(container.textContent).toContain(item.explanation);
    expect(buttons.every((button) => button.disabled)).toBe(true);
  });

  it("uses explicit wording after an incorrect choice", async () => {
    const buttons = await renderQuiz();

    await act(async () => buttons[1].click());

    expect(container.textContent).toContain("这次没答对。");
    expect(container.textContent).toContain(item.explanation);
  });
});
