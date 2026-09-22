import { XMLParser } from "fast-xml-parser";

export interface HotspotCandidate {
  title: string;
  url: string;
  summary?: string;
}

export interface FetchHotspotOptions {
  sources?: string[];
  fetchImpl?: typeof fetch;
}

const DEFAULT_SOURCES = [
  "https://deepmind.google/blog/rss.xml",
  "https://techcrunch.com/category/artificial-intelligence/feed/",
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim() || undefined;
  }
  if (value && typeof value === "object" && "#text" in value) {
    return text((value as { "#text": unknown })["#text"]);
  }
  return undefined;
}

function stripHtml(value: string | undefined): string | undefined {
  const cleaned = value
    ?.replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || undefined;
}

function atomUrl(link: unknown): string | undefined {
  for (const item of asArray(link)) {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
      const attrs = item as { "@_href"?: unknown; "@_rel"?: unknown };
      if (
        typeof attrs["@_href"] === "string" &&
        (attrs["@_rel"] === undefined || attrs["@_rel"] === "alternate")
      ) {
        return attrs["@_href"];
      }
    }
  }
  return undefined;
}

function parseFeed(xml: string): HotspotCandidate[] {
  const document = parser.parse(xml) as {
    rss?: { channel?: { item?: unknown } };
    feed?: { entry?: unknown };
  };
  const entries = [
    ...asArray(document.rss?.channel?.item),
    ...asArray(document.feed?.entry),
  ];

  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const title = text(item.title);
    const url = text(item.link) ?? atomUrl(item.link);
    if (!title || !url) return [];
    const summary = stripHtml(
      text(item.description) ?? text(item.summary) ?? text(item.content),
    );
    return [{ title, url, ...(summary ? { summary } : {}) }];
  });
}

function configuredSources(): string[] {
  const configured = process.env.HOTSPOT_RSS_URLS?.split(",")
    .map((source) => source.trim())
    .filter(Boolean);
  return configured?.length ? configured : DEFAULT_SOURCES;
}

export async function fetchHotspotCandidates(
  options: FetchHotspotOptions = {},
): Promise<HotspotCandidate[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sourceResults = await Promise.all(
    (options.sources ?? configuredSources()).map(async (source) => {
      try {
        const response = await fetchImpl(source, {
          headers: { "User-Agent": "ai-daily-rss/1.0" },
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) return [];
        return parseFeed(await response.text());
      } catch {
        return [];
      }
    }),
  );

  const unique = new Map<string, HotspotCandidate>();
  sourceResults.flat().forEach((candidate) => {
    if (!unique.has(candidate.url)) unique.set(candidate.url, candidate);
  });
  return [...unique.values()];
}
