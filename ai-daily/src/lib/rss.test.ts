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
    </item>
    <item>
      <title>AI tool update</title>
      <link>https://example.com/tool-update</link>
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
    });

    expect(candidates).toEqual([
      {
        title: "Open model released",
        url: "https://example.com/open-model",
        summary: "A smaller and faster model.",
      },
      {
        title: "AI tool update",
        url: "https://example.com/tool-update",
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
    });

    expect(candidates).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
