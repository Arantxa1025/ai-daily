from src.paths import content_dir, lessons_dir, repo_root


def test_content_dir_points_at_ai_daily_content():
    assert content_dir().name == "content"
    assert content_dir().parent.name == "ai-daily"
    assert (content_dir() / "curriculum.json").exists()
    assert lessons_dir() == content_dir() / "lessons"
    assert repo_root().joinpath("pipeline").is_dir()
