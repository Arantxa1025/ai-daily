import { describe, expect, it, vi } from "vitest";
import { fetchHotspotCandidates } from "./rss";

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AI News</title>
    <item>
      <title>Open model released</title>
      <link>https://example.com/open-model</link>
      <description><![CDATA[<p>A smaller and faster model.</p>]]></description>
      <pubDate>Tue, 22 Sep 2026 08:00:00 GMT</pubDate>
    </item>
    <item>
      <title>AI tool update</title>
      <link>https://example.com/tool-update</link>
      <pubDate>Mon, 21 Sep 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

describe("fetchHotspotCandidates", () => {
  it("解析内联 RSS fixture，并清理摘要中的 HTML", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(RSS_FIXTURE, {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      }),
    );

    const candidates = await fetchHotspotCandidates({
      sources: ["https://example.com/rss"],
      fetchImpl,
      now: new Date("2026-09-22T12:00:00.000Z"),
    });

    expect(candidates).toEqual([
      {
        title: "Open model released",
        url: "https://example.com/open-model",
        summary: "A smaller and faster model.",
        publishedAt: "2026-09-22T08:00:00.000Z",
      },
      {
        title: "AI tool update",
        url: "https://example.com/tool-update",
        publishedAt: "2026-09-21T12:00:00.000Z",
      },
    ]);
  });

  it("跳过请求失败的源并保留其他源结果", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(new Response(RSS_FIXTURE, { status: 200 }));

    const candidates = await fetchHotspotCandidates({
      sources: ["https://broken.example/rss", "https://working.example/rss"],
      fetchImpl,
      now: new Date("2026-09-22T12:00:00.000Z"),
    });

    expect(candidates).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("过滤超过 48 小时和没有发布时间的候选，全部过期时返回空数组", async () => {
    const staleFixture = `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Old update</title>
          <link href="https://example.com/old" />
          <updated>2026-09-19T10:00:00Z</updated>
        </entry>
        <entry>
          <title>Undated update</title>
          <link href="https://example.com/undated" />
        </entry>
      </feed>`;

    const candidates = await fetchHotspotCandidates({
      sources: ["https://example.com/atom"],
      fetchImpl: vi.fn().mockResolvedValue(new Response(staleFixture, { status: 200 })),
      now: new Date("2026-09-22T12:00:00.000Z"),
    });

    expect(candidates).toEqual([]);
  });

  it("每源最多取 6 条并轮询合并，避免单一来源占满前列", async () => {
    const fixture = (source: string) => `<?xml version="1.0"?><rss><channel>${Array.from(
      { length: 8 },
      (_, index) => `<item>
        <title>${source}-${index + 1}</title>
        <link>https://example.com/${source}/${index + 1}</link>
        <pubDate>Tue, 22 Sep 2026 10:00:00 GMT</pubDate>
      </item>`,
    ).join("")}</channel></rss>`;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(fixture("deepmind"), { status: 200 }))
      .mockResolvedValueOnce(new Response(fixture("techcrunch"), { status: 200 }));

    const candidates = await fetchHotspotCandidates({
      sources: ["https://example.com/deepmind", "https://example.com/techcrunch"],
      fetchImpl,
      now: new Date("2026-09-22T12:00:00.000Z"),
    });

    expect(candidates).toHaveLength(12);
    expect(candidates.map(({ title }) => title).slice(0, 4)).toEqual([
      "deepmind-1",
      "techcrunch-1",
      "deepmind-2",
      "techcrunch-2",
    ]);
    expect(candidates.some(({ title }) => title === "deepmind-7")).toBe(false);
    expect(candidates.some(({ title }) => title === "techcrunch-7")).toBe(false);
  });
});
