from datetime import datetime, timezone
from pathlib import Path

import pytest

from src.fetch_sources import Candidate, fetch_hotspot_candidates, load_sources_config

FIXTURE = Path(__file__).parent / "fixtures" / "sample.rss.xml"
NOW = datetime(2026, 9, 22, 12, 0, 0, tzinfo=timezone.utc)


def _test_config(*, per_source_limit=6, extra_sources=None):
    sources = [
        {
            "name": "Sample Feed",
            "type": "rss",
            "url": "https://example.com/sample.rss.xml",
            "enabled": True,
        }
    ]
    if extra_sources:
        sources.extend(extra_sources)
    return {
        "hotspot": {
            "max_age_hours": 48,
            "per_source_limit": per_source_limit,
            "sources": sources,
        }
    }


@pytest.fixture
def rss_xml():
    return FIXTURE.read_text(encoding="utf-8")


def test_load_sources_config_default():
    config = load_sources_config()
    assert "hotspot" in config
    assert config["hotspot"]["max_age_hours"] == 48
    assert len(config["hotspot"]["sources"]) >= 4


def test_fetch_filters_by_max_age_hours(monkeypatch, rss_xml):
    monkeypatch.setattr(
        "src.fetch_sources.load_sources_config", lambda path=None: _test_config()
    )

    def fetch_url(url):
        return rss_xml

    candidates = fetch_hotspot_candidates(now=NOW, fetch_url=fetch_url)
    titles = {c["title"] for c in candidates}
    assert "Recent Article" in titles
    assert "Old Article" not in titles


def test_fetch_respects_per_source_limit(monkeypatch, rss_xml):
    monkeypatch.setattr(
        "src.fetch_sources.load_sources_config",
        lambda path=None: _test_config(per_source_limit=3),
    )

    candidates = fetch_hotspot_candidates(
        now=NOW, fetch_url=lambda url: rss_xml
    )
    assert len(candidates) == 3


def test_fetch_skips_failed_source_without_total_failure(monkeypatch, rss_xml):
    monkeypatch.setattr(
        "src.fetch_sources.load_sources_config",
        lambda path=None: _test_config(
            extra_sources=[
                {
                    "name": "Broken Feed",
                    "type": "rss",
                    "url": "https://example.com/broken.rss",
                    "enabled": True,
                }
            ]
        ),
    )

    def fetch_url(url):
        if "broken" in url:
            raise RuntimeError("404 Not Found")
        return rss_xml

    candidates = fetch_hotspot_candidates(now=NOW, fetch_url=fetch_url)
    assert len(candidates) > 0
    assert all(isinstance(c, dict) for c in candidates)
    for key in ("title", "url", "summary", "published_at"):
        assert key in candidates[0]


def test_candidate_published_at_is_utc_iso(monkeypatch, rss_xml):
    monkeypatch.setattr(
        "src.fetch_sources.load_sources_config", lambda path=None: _test_config()
    )

    candidates = fetch_hotspot_candidates(
        now=NOW, fetch_url=lambda url: rss_xml
    )
    recent = next(c for c in candidates if c["title"] == "Recent Article")
    assert recent["published_at"].endswith("Z") or "+00:00" in recent["published_at"]
