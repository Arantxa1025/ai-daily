from pathlib import Path

_CONTENT_MARKER = Path("ai-daily") / "content"


def repo_root() -> Path:
    current = Path(__file__).resolve().parent
    for candidate in (current, *current.parents):
        if (candidate / _CONTENT_MARKER).is_dir():
            return candidate
    raise RuntimeError(f"Could not find repo root containing {_CONTENT_MARKER}")


def content_dir() -> Path:
    return repo_root() / _CONTENT_MARKER


def lessons_dir() -> Path:
    return content_dir() / "lessons"
