import curriculum from "../../content/curriculum.json";

export interface CurriculumTopic {
  day: number;
  title: string;
  bullets: string[];
}

export function getTopicForDay(day: number): CurriculumTopic | null {
  if (!Number.isInteger(day) || day < 1) {
    return null;
  }

  return curriculum.find((topic) => topic.day === day) ?? null;
}
