import { describe, it, expect } from "vitest";
import { getRecommendedSlot } from "./time";

function sh(s: string): Date {
  return new Date(s.includes("+") || s.endsWith("Z") ? s : s + "+08:00");
}

describe("getRecommendedSlot", () => {
  it("before 07:30 recommends waiting", () => {
    const r = getRecommendedSlot(sh("2026-09-22T06:59:00+08:00"));
    expect(r.date).toBe("2026-09-22");
    expect(r.primary).toBeNull();
    expect(r.nextUpdateLabel).toMatch(/07:30/);
    expect(r.yesterday).toBe("2026-09-21");
  });

  it("at 07:30 primary morning", () => {
    const r = getRecommendedSlot(sh("2026-09-22T07:30:00+08:00"));
    expect(r.primary).toBe("morning");
    expect(r.secondary).toBe("afternoon");
  });

  it("at 17:29 still morning primary", () => {
    const r = getRecommendedSlot(sh("2026-09-22T17:29:00+08:00"));
    expect(r.primary).toBe("morning");
  });

  it("at 17:30 primary afternoon", () => {
    const r = getRecommendedSlot(sh("2026-09-22T17:30:00+08:00"));
    expect(r.primary).toBe("afternoon");
    expect(r.secondary).toBe("morning");
  });
});
