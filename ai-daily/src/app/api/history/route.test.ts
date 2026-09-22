import { beforeEach, describe, expect, it, vi } from "vitest";

const { listRecentDates, readLesson } = vi.hoisted(() => ({
  listRecentDates: vi.fn(),
  readLesson: vi.fn(),
}));

vi.mock("@/lib/lessonStore", () => ({ listRecentDates, readLesson }));

import { GET } from "./route";

describe("history route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listRecentDates.mockResolvedValue([]);
    readLesson.mockResolvedValue(null);
  });

  it("将请求的历史条数上限限制为 60", async () => {
    const response = await GET(new Request("http://localhost/api/history?limit=1000"));

    expect(response.status).toBe(200);
    expect(listRecentDates).toHaveBeenCalledWith(60);
  });
});
