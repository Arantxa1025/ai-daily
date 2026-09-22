import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateMorningLesson, generateAfternoonLesson } = vi.hoisted(() => ({
  generateMorningLesson: vi.fn(),
  generateAfternoonLesson: vi.fn(),
}));

vi.mock("@/lib/generateMorning", () => ({ generateMorningLesson }));
vi.mock("@/lib/generateAfternoon", () => ({ generateAfternoonLesson }));

import { GET, POST } from "./route";

function request(slot = "morning", secret?: string): Request {
  const headers = secret ? { Authorization: `Bearer ${secret}` } : undefined;
  return new Request(`http://localhost/api/cron/generate?slot=${slot}`, {
    headers,
  });
}

describe("cron generate route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it("returns 401 when authorization is missing or incorrect", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("morning", "wrong"))).status).toBe(401);
    expect(generateMorningLesson).not.toHaveBeenCalled();
  });

  it("returns 400 for an unsupported slot", async () => {
    const response = await GET(request("evening", "test-secret"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "slot 必须是 morning 或 afternoon" });
  });

  it("generates the morning lesson using the Shanghai date", async () => {
    const lesson = { slot: "morning", title: "基础课", status: "ok" };
    generateMorningLesson.mockResolvedValue({
      lesson,
      writeResult: "written",
    });

    const response = await GET(request("morning", "test-secret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      slot: "morning",
      writeResult: "written",
      status: "ok",
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(generateMorningLesson).toHaveBeenCalledWith(body.date);
  });

  it("supports POST and dispatches afternoon generation", async () => {
    const lesson = { slot: "afternoon", title: "热点课", status: "draft_quality" };
    generateAfternoonLesson.mockResolvedValue({
      lesson,
      writeResult: "skipped_existing_ok",
    });

    const response = await POST(request("afternoon", "test-secret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      slot: "afternoon",
      writeResult: "skipped_existing_ok",
      status: "draft_quality",
    });
    expect(generateAfternoonLesson).toHaveBeenCalledWith(body.date);
  });
});
