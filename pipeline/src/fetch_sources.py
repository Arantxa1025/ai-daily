from __future__ import annotations

import calendar
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, TypedDict

import feedparser
import httpx
import yaml

_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "sources.yaml"


class Candidate(TypedDict):
    title: str
    url: str
    summary: str
    published_at: str


def _default_config_path() -> Path:
    return _CONFIG_PATH


def load_sources_config(path: str | Path | None = None) -> dict:
    config_path = Path(path) if path is not None else _default_config_path()
    with config_path.open(encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _entry_published_at(entry: feedparser.FeedParserDict) -> datetime | None:
    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    if parsed is not None:
        timestamp = calendar.timegm(parsed)
        return datetime.fromtimestamp(timestamp, tz=timezone.utc)
    return None


def _strip_html(value: str | None) -> str:
    if not value:
        return ""
    cleaned = re.sub(r"<[^>]+>", " ", value)
    cleaned = (
        cleaned.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
    )
    return " ".join(cleaned.split())


def _parse_feed(
    xml: str,
    *,
    now: datetime,
    max_age: timedelta,
    per_source_limit: int,
) -> list[Candidate]:
    cutoff = now - max_age
    parsed = feedparser.parse(xml)
    candidates: list[Candidate] = []

    for entry in parsed.entries:
        published_at = _entry_published_at(entry)
        title = (entry.get("title") or "").strip()
        url = (entry.get("link") or "").strip()
        if not published_at or not title or not url:
            continue
        if published_at < cutoff or published_at > now:
            continue
        summary = _strip_html(
            entry.get("summary") or entry.get("description") or ""
        )
        candidates.append(
            {
                "title": title,
                "url": url,
                "summary": summary,
                "published_at": published_at.isoformat().replace("+00:00", "Z"),
            }
        )

    candidates.sort(key=lambda item: item["published_at"], reverse=True)
    return candidates[:per_source_limit]


def _merge_round_robin(source_results: list[list[Candidate]]) -> list[Candidate]:
    unique: dict[str, Candidate] = {}
    longest = max((len(result) for result in source_results), default=0)
    for index in range(longest):
        for result in source_results:
            if index >= len(result):
                continue
            candidate = result[index]
            if candidate["url"] not in unique:
                unique[candidate["url"]] = candidate
    return list(unique.values())


def _default_fetch_url(url: str) -> str:
    response = httpx.get(
        url,
        headers={"User-Agent": "ai-daily-rss/1.0"},
        timeout=10.0,
    )
    response.raise_for_status()
    return response.text


def fetch_hotspot_candidates(
    *,
    now: datetime | None = None,
    fetch_url: Callable[[str], str] | None = None,
) -> list[Candidate]:
    config = load_sources_config()
    hotspot = config["hotspot"]
    max_age = timedelta(hours=int(hotspot["max_age_hours"]))
    per_source_limit = int(hotspot["per_source_limit"])
    current = _ensure_utc(now or datetime.now(timezone.utc))
    fetch = fetch_url or _default_fetch_url

    source_results: list[list[Candidate]] = []
    for source in hotspot.get("sources", []):
        if not source.get("enabled", True):
            continue
        if source.get("type") != "rss":
            continue
        try:
            xml = fetch(source["url"])
            source_results.append(
                _parse_feed(
                    xml,
                    now=current,
                    max_age=max_age,
                    per_source_limit=per_source_limit,
                )
            )
        except Exception:
            source_results.append([])

    return _merge_round_robin(source_results)
