#!/usr/bin/env python3
"""Pipeline CLI entrypoint."""

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

_PIPELINE_DIR = Path(__file__).resolve().parent
if str(_PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(_PIPELINE_DIR))

from src.generate_afternoon import generate_afternoon
from src.generate_morning import generate_morning


def _shanghai_today() -> str:
    return datetime.now(ZoneInfo("Asia/Shanghai")).date().isoformat()


def _validate_date(value: str) -> str:
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            f"无效日期 {value!r}，请使用 YYYY-MM-DD"
        ) from exc
    return value


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="AI 每日课程生成流水线")
    parser.add_argument("slot", choices=["morning", "afternoon"], help="生成时段")
    parser.add_argument(
        "--date",
        type=_validate_date,
        default=None,
        help="课程日期（默认：上海当日）",
    )
    args = parser.parse_args(argv)
    date = args.date or _shanghai_today()

    try:
        if args.slot == "morning":
            lesson, write_result = generate_morning(date)
        else:
            lesson, write_result = generate_afternoon(date)
    except Exception as exc:
        print(f"生成失败：{exc}", file=sys.stderr)
        return 1

    print(f"日期：{date}")
    print(f"写入：{write_result}")
    print(f"标题：{lesson['title']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
