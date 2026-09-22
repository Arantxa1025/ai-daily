import fs from "fs/promises";
import path from "path";
import type { Lesson, LessonSlot } from "./types";

function getRoot(): string {
  return process.env.LESSON_ROOT ?? path.join(process.cwd(), "content/lessons");
}

function filePath(date: string, slot: LessonSlot): string {
  return path.join(getRoot(), `${date}-${slot}.json`);
}

export async function readLesson(date: string, slot: LessonSlot): Promise<Lesson | null> {
  try {
    const raw = await fs.readFile(filePath(date, slot), "utf-8");
    return JSON.parse(raw) as Lesson;
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

export async function writeLesson(lesson: Lesson): Promise<"written" | "skipped_existing_ok"> {
  const fp = filePath(lesson.date, lesson.slot);
  const existing = await readLesson(lesson.date, lesson.slot);
  if (existing?.status === "ok") {
    return "skipped_existing_ok";
  }
  await fs.mkdir(getRoot(), { recursive: true });
  await fs.writeFile(fp, JSON.stringify(lesson, null, 2) + "\n", "utf-8");
  return "written";
}

export async function listRecentDates(limit: number): Promise<string[]> {
  const root = getRoot();
  let entries: string[];
  try {
    entries = await fs.readdir(root);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return [];
    }
    throw err;
  }

  const dates = entries
    .map((name) => {
      const m = name.match(/^(\d{4}-\d{2}-\d{2})-(morning|afternoon)\.json$/);
      return m ? m[1] : null;
    })
    .filter((d): d is string => d !== null);

  const unique = [...new Set(dates)].sort((a, b) => b.localeCompare(a));
  return unique.slice(0, limit);
}
