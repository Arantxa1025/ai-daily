import { describe, expect, it } from "vitest";
import curriculum from "../../content/curriculum.json";
import { getTopicForDay } from "./curriculum";

describe("curriculum", () => {
  it("第 1 天有完整主题", () => {
    expect(getTopicForDay(1)).toEqual({
      day: 1,
      title: expect.any(String),
      bullets: expect.arrayContaining([expect.any(String)]),
    });
  });

  it("超出范围或非法天数时返回 null", () => {
    expect(getTopicForDay(0)).toBeNull();
    expect(getTopicForDay(1.5)).toBeNull();
    expect(getTopicForDay(curriculum.length + 1)).toBeNull();
  });

  it("提供至少 60 天标题，前 14 天包含完整要点", () => {
    expect(curriculum.length).toBeGreaterThanOrEqual(60);
    for (const topic of curriculum.slice(0, 14)) {
      expect(topic.title.trim()).not.toBe("");
      expect(topic.bullets.length).toBeGreaterThanOrEqual(2);
      expect(topic.bullets.every((bullet) => bullet.trim().length > 0)).toBe(true);
    }
  });
});
