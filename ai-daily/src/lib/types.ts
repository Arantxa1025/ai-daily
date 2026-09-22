export type LessonSlot = "morning" | "afternoon";
export type LessonType = "basics" | "hotspot" | "fallback_classic" | "fallback_tool";
export type LessonStatus = "ok" | "draft_quality" | "failed_placeholder";

export interface LessonSection {
  heading: string;
  body: string;
}

export interface QuizItem {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface LessonSource {
  title: string;
  url: string;
}

export interface Lesson {
  date: string; // YYYY-MM-DD
  slot: LessonSlot;
  type: LessonType;
  title: string;
  estimatedMinutes: number;
  intro: string;
  sections: LessonSection[];
  quiz: QuizItem[];
  takeaway: string;
  disclaimer?: string;
  status: LessonStatus;
  sources?: LessonSource[];
  createdAt: string; // ISO
  curriculumDay?: number; // morning only
}
