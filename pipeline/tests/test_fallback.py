import json

from src import paths
from src.fallback import advance_fallback, pick_fallback_topic


def test_fallback_topics_rotate_and_wrap(tmp_path, monkeypatch):
    content = tmp_path / "content"
    content.mkdir()
    topics = [
        {"type": "fallback_classic", "title": "主题一", "subject": "一", "action": "做一"},
        {"type": "fallback_tool", "title": "主题二", "subject": "二", "action": "做二"},
    ]
    (content / "fallback-topics.json").write_text(
        json.dumps(topics, ensure_ascii=False), encoding="utf-8"
    )
    (content / "fallback-progress.json").write_text(
        '{"nextIndex": 1}\n', encoding="utf-8"
    )
    monkeypatch.setattr(paths, "content_dir", lambda: content)

    assert pick_fallback_topic()["title"] == "主题二"
    advance_fallback()

    assert json.loads(
        (content / "fallback-progress.json").read_text(encoding="utf-8")
    ) == {"nextIndex": 0}
    assert pick_fallback_topic()["title"] == "主题一"
