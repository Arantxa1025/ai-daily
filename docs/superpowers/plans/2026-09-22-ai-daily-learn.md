# AI 每日学习站 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做一个可部署的 Next.js 网页：每天 07:30 / 17:30（上海时区）自动生成「AI 基础」与「AI 热点」两更，支持阅读、小测与分享链接。

**Architecture:** JSON 文件内容库 + 服务端 API + 定时/手动生成脚本。网页只读内容库；生成器调用 LLM（及热点 RSS）写稿入库；首页按上海时间推荐当前该读的槽位。

**Tech Stack:** Next.js 15 (App Router) + TypeScript + Vitest；内容存 `content/lessons/*.json`；生成用 OpenAI 兼容 API；可选 Vercel Cron；RSS 用 `fast-xml-parser`。

## Global Constraints

- 时区：`Asia/Shanghai`；更新时刻：早 `07:30`、晚 `17:30`
- 单篇约 1500～2500 字、2～3 道选择题；热点须有免责声明
- 无登录、无推送、无成绩落库；密钥仅服务端环境变量
- 大纲进度：自 `curriculumStartDate` 起算 Day N；生成失败不跳课
- 质量闸门：校验失败重试 1 次；有成功稿则不覆盖；否则可写 `draft_quality`
- 分享路径：`/learn/:date/:slot`，`slot` 为 `morning` | `afternoon`
- 文案与 UI 面向零基础；必要术语须跟一句人话解释（写进生成提示词）

---

## 文件结构（锁定）

```text
ai-daily/                          # Next.js 项目根（在仓库 /Users/my/Desktop/ai学习 下创建）
  package.json
  vitest.config.ts
  .env.example
  content/
    curriculum.json                # 60～90 天大纲
    progress.json                  # { nextDay: number } 早更进度
    lessons/                       # YYYY-MM-DD-morning.json / -afternoon.json
    fixtures/                      # 测试与本地演示用假数据
  src/
    lib/
      types.ts                     # Lesson 等类型
      time.ts                      # 上海时区、推荐槽位
      lessonStore.ts               # 读写 JSON 内容库
      curriculum.ts                # Day N ↔ 大纲
      validateLesson.ts            # 字数/测验/必填字段闸门
      llm.ts                       # OpenAI 兼容客户端
      generateMorning.ts
      generateAfternoon.ts
      rss.ts                       # 拉取热点候选
      fallbackHotspot.ts           # 经典复盘 / 工具打卡
    app/
      layout.tsx
      page.tsx                     # 首页
      globals.css
      learn/[date]/[slot]/page.tsx
      api/today/route.ts
      api/lesson/[date]/[slot]/route.ts
      api/history/route.ts
      api/cron/generate/route.ts   # Cron + CRON_SECRET
    components/
      HomeDashboard.tsx
      LessonView.tsx
      Quiz.tsx
      HistoryList.tsx
  scripts/
    generate.ts                    # 手动：tsx scripts/generate.ts morning|afternoon
  vercel.json                      # cron 07:30 / 17:30 UTC 换算说明见 Task 10
  README.md                        # 零基础部署清单
```

---

### Task 1: 脚手架、类型与假数据

**Files:**
- Create: `ai-daily/package.json`（通过 `create-next-app`）
- Create: `ai-daily/src/lib/types.ts`
- Create: `ai-daily/content/fixtures/2026-09-21-morning.json`
- Create: `ai-daily/content/fixtures/2026-09-21-afternoon.json`
- Create: `ai-daily/vitest.config.ts`
- Create: `ai-daily/.env.example`

**Interfaces:**
- Produces: `Lesson`、`LessonSlot`、`LessonType`、`LessonStatus` 类型，供后续全部任务使用

- [ ] **Step 1: 创建 Next.js 项目**

在 `/Users/my/Desktop/ai学习` 下执行：

```bash
cd "/Users/my/Desktop/ai学习"
npx create-next-app@15 ai-daily --typescript --eslint --app --src-dir --tailwind --no-turbopack --import-alias "@/*" --use-npm
cd ai-daily
npm install -D vitest @vitejs/plugin-react jsdom
npm install fast-xml-parser zod
```

- [ ] **Step 2: 写 `src/lib/types.ts`**

```typescript
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
```

- [ ] **Step 3: 写入两份 fixture（字段齐全，各含 2 道题）**

路径：`content/fixtures/2026-09-21-morning.json`、`...-afternoon.json`。  
`afternoon` 必须含 `disclaimer: "根据公开信息整理，非投资/内幕建议。"`。  
正文总字数（`intro + sections.body` 拼接）落在 1500～2500。

- [ ] **Step 4: 配置 Vitest**

`vitest.config.ts`：

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

在 `package.json` scripts 增加：`"test": "vitest run"`。

- [ ] **Step 5: 写 `.env.example`**

```bash
LLM_API_KEY=
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
CRON_SECRET=change-me
CURRICULUM_START_DATE=2026-09-22
```

- [ ] **Step 6: 提交（若仓库已 git init）**

```bash
git add -A && git commit -m "chore: scaffold Next.js app with Lesson types and fixtures"
```

若尚未 `git init`，先在 `/Users/my/Desktop/ai学习` 初始化后再提交；**仅在用户已允许提交时执行本步**。

---

### Task 2: 上海时区与首页推荐逻辑

**Files:**
- Create: `ai-daily/src/lib/time.ts`
- Create: `ai-daily/src/lib/time.test.ts`

**Interfaces:**
- Produces:
  - `getShanghaiNow(date?: Date): { date: string; minutes: number }`
  - `getRecommendedSlot(now?: Date): { date: string; primary: LessonSlot | null; secondary: LessonSlot | null; nextUpdateLabel: string | null; yesterday: string }`
- 规则（`minutes` = 当日 0 点起的分钟数）：
  - `< 7:30`：primary=null，提示下一更 07:30，提供 yesterday
  - `>= 7:30 && < 17:30`：primary=`morning`，secondary 视下午是否已有稿（本函数只返回槽位意图：secondary=`afternoon` 表示「若已更新则可展示」）
  - `>= 17:30`：primary=`afternoon`，secondary=`morning`

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect } from "vitest";
import { getRecommendedSlot } from "./time";

function atShanghai(isoLocal: string): Date {
  // isoLocal 例: "2026-09-22T07:29:00" 视为上海本地墙钟，转成对应 UTC Date
  return new Date(
    new Date(isoLocal + "+08:00").toLocaleString("en-US", { timeZone: "UTC" })
  );
}

// 更稳妥：直接用带偏移的 Instant
function sh(s: string): Date {
  return new Date(s.includes("+") || s.endsWith("Z") ? s : s + "+08:00");
}

describe("getRecommendedSlot", () => {
  it("before 07:30 recommends waiting", () => {
    const r = getRecommendedSlot(sh("2026-09-22T06:59:00+08:00"));
    expect(r.date).toBe("2026-09-22");
    expect(r.primary).toBeNull();
    expect(r.nextUpdateLabel).toMatch(/07:30/);
    expect(r.yesterday).toBe("2026-09-21");
  });

  it("at 07:30 primary morning", () => {
    const r = getRecommendedSlot(sh("2026-09-22T07:30:00+08:00"));
    expect(r.primary).toBe("morning");
    expect(r.secondary).toBe("afternoon");
  });

  it("at 17:29 still morning primary", () => {
    const r = getRecommendedSlot(sh("2026-09-22T17:29:00+08:00"));
    expect(r.primary).toBe("morning");
  });

  it("at 17:30 primary afternoon", () => {
    const r = getRecommendedSlot(sh("2026-09-22T17:30:00+08:00"));
    expect(r.primary).toBe("afternoon");
    expect(r.secondary).toBe("morning");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd "/Users/my/Desktop/ai学习/ai-daily" && npm test -- src/lib/time.test.ts
```

Expected: FAIL（模块不存在或导出缺失）

- [ ] **Step 3: 实现 `time.ts`**

```typescript
const TZ = "Asia/Shanghai";

export function formatShanghaiDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // YYYY-MM-DD
}

export function shanghaiMinutesSinceMidnight(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  const minute = Number(parts.find((p) => p.type === "minute")!.value);
  return hour * 60 + minute;
}

export function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + delta));
  return utc.toISOString().slice(0, 10);
}

export function getRecommendedSlot(now = new Date()) {
  const date = formatShanghaiDate(now);
  const minutes = shanghaiMinutesSinceMidnight(now);
  const yesterday = addDays(date, -1);
  const morningAt = 7 * 60 + 30;
  const afternoonAt = 17 * 60 + 30;

  if (minutes < morningAt) {
    return {
      date,
      primary: null as const,
      secondary: null as const,
      nextUpdateLabel: "今日基础预计 07:30 更新",
      yesterday,
    };
  }
  if (minutes < afternoonAt) {
    return {
      date,
      primary: "morning" as const,
      secondary: "afternoon" as const,
      nextUpdateLabel: "今日热点预计 17:30 更新",
      yesterday,
    };
  }
  return {
    date,
    primary: "afternoon" as const,
    secondary: "morning" as const,
    nextUpdateLabel: null,
    yesterday,
  };
}
```

- [ ] **Step 4: 再跑测试确认通过**

```bash
npm test -- src/lib/time.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**（用户允许时）`feat: add Shanghai timezone recommendation helpers`

---

### Task 3: 内容库读写

**Files:**
- Create: `ai-daily/src/lib/lessonStore.ts`
- Create: `ai-daily/src/lib/lessonStore.test.ts`
- Create: `ai-daily/content/lessons/.gitkeep`

**Interfaces:**
- Produces:
  - `lessonPath(date, slot): string` → `content/lessons/${date}-${slot}.json`
  - `readLesson(date, slot): Promise<Lesson | null>`
  - `writeLesson(lesson: Lesson): Promise<"written" | "skipped_existing_ok">`  
    规则：若已存在且 `status === "ok"`，新稿无论什么都不覆盖，返回 `skipped_existing_ok`；否则写入
  - `listRecentDates(limit: number): Promise<string[]>` 扫描 lessons 目录，按日期降序去重

- [ ] **Step 1: 写测试**（用临时目录：通过环境变量 `LESSON_ROOT` 注入，默认 `content/lessons`）

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { readLesson, writeLesson } from "./lessonStore";
import type { Lesson } from "./types";

function sample(over: Partial<Lesson> = {}): Lesson {
  return {
    date: "2026-09-22",
    slot: "morning",
    type: "basics",
    title: "t",
    estimatedMinutes: 20,
    intro: "i".repeat(400),
    sections: [{ heading: "h", body: "b".repeat(1200) }],
    quiz: [
      { question: "q", options: ["a", "b"], answerIndex: 0, explanation: "e" },
      { question: "q2", options: ["a", "b"], answerIndex: 1, explanation: "e" },
    ],
    takeaway: "x",
    status: "ok",
    createdAt: new Date().toISOString(),
    ...over,
  };
}

describe("lessonStore", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "lessons-"));
    process.env.LESSON_ROOT = dir;
  });
  afterEach(async () => {
    delete process.env.LESSON_ROOT;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("writes and reads", async () => {
    await writeLesson(sample());
    const got = await readLesson("2026-09-22", "morning");
    expect(got?.title).toBe("t");
  });

  it("does not overwrite status=ok", async () => {
    await writeLesson(sample({ title: "first" }));
    const result = await writeLesson(sample({ title: "second", status: "draft_quality" }));
    expect(result).toBe("skipped_existing_ok");
    expect((await readLesson("2026-09-22", "morning"))?.title).toBe("first");
  });
});
```

- [ ] **Step 2: 跑测确认失败 → 实现 `lessonStore.ts` → 再跑通过**

实现要点：`getRoot()` 读 `process.env.LESSON_ROOT` 或 `path.join(process.cwd(), "content/lessons")`；读写 UTF-8 JSON。

- [ ] **Step 3: 把 fixtures 复制到 `content/lessons/` 供本地演示**

```bash
cp content/fixtures/*.json content/lessons/
```

- [ ] **Step 4: Commit**（允许时）`feat: add JSON lesson store with no-overwrite for ok lessons`

---

### Task 4: 内容 API

**Files:**
- Create: `ai-daily/src/app/api/today/route.ts`
- Create: `ai-daily/src/app/api/lesson/[date]/[slot]/route.ts`
- Create: `ai-daily/src/app/api/history/route.ts`

**Interfaces:**
- Consumes: `getRecommendedSlot`、`readLesson`、`listRecentDates`
- Produces HTTP JSON：
  - `GET /api/today` → `{ date, primary, secondary, nextUpdateLabel, yesterday, lessons: { morning?: Summary, afternoon?: Summary } }`  
    `Summary = { title, estimatedMinutes, status, type, href }`
  - `GET /api/lesson/:date/:slot` → 全文或 404
  - `GET /api/history?limit=14` → `{ items: [{ date, morning: boolean, afternoon: boolean }] }`

- [ ] **Step 1: 实现三个 route.ts**（App Router `export async function GET`）

校验 `slot` ∈ `{morning,afternoon}`，`date` 匹配 `/^\d{4}-\d{2}-\d{2}$/`。

- [ ] **Step 2: 本地验证**

```bash
npm run dev
curl -s http://localhost:3000/api/today | head
curl -s http://localhost:3000/api/lesson/2026-09-21/morning | head
curl -s "http://localhost:3000/api/history?limit=7"
```

Expected: JSON 200；不存在的 lesson 返回 404。

- [ ] **Step 3: Commit**（允许时）`feat: add today/lesson/history API routes`

---

### Task 5: 首页与文章页 UI（含小测）

**Files:**
- Create: `ai-daily/src/components/HomeDashboard.tsx`
- Create: `ai-daily/src/components/LessonView.tsx`
- Create: `ai-daily/src/components/Quiz.tsx`
- Create: `ai-daily/src/components/HistoryList.tsx`
- Modify: `ai-daily/src/app/page.tsx`
- Modify: `ai-daily/src/app/layout.tsx`
- Create: `ai-daily/src/app/learn/[date]/[slot]/page.tsx`
- Modify: `ai-daily/src/app/globals.css`

**Interfaces:**
- Consumes: API 或服务端直接 `readLesson` / `getRecommendedSlot`（优先 **Server Component 直读 store**，避免多余请求）
- `Quiz`：客户端组件；点击选项后显示对错与 `explanation`；不请求后端

- [ ] **Step 1: 实现 `Quiz.tsx`（`"use client"`）**

选中后锁定本题；正确/错误用明确文案，展示解析。

- [ ] **Step 2: 实现 `LessonView`**：标题、预计分钟、intro、sections、Quiz、takeaway、disclaimer（若有）、`status === "draft_quality"` 时顶部提示条。

- [ ] **Step 3: 实现首页**：主 CTA / 次要入口 / 未更新提示 / 复习昨日 / `HistoryList`。

- [ ] **Step 4: 实现 `/learn/[date]/[slot]`**：读课；无课则友好 404 页（「这一更还没好」）。

- [ ] **Step 5: 视觉**：单栏、舒适正文字号、移动端可读；避免紫渐变套装与卡片堆砌；品牌名「AI 每日」在首页首屏可见。

- [ ] **Step 6: 手动验收**

- 打开 `/`，主按钮符合当前上海时间规则  
- 打开 `/learn/2026-09-21/morning`，完成小测反馈  
- 无 cookie 隐私窗同样可打开分享链接  

- [ ] **Step 7: Commit**（允许时）`feat: add home, lesson, and quiz UI`

---

### Task 6: 大纲与早间生成

**Files:**
- Create: `ai-daily/content/curriculum.json`（至少先写 14 天完整条目，并预留到 60 天的标题列表；不足可用占位标题后续补）
- Create: `ai-daily/content/progress.json` → `{ "nextDay": 1 }`
- Create: `ai-daily/src/lib/curriculum.ts`
- Create: `ai-daily/src/lib/curriculum.test.ts`
- Create: `ai-daily/src/lib/llm.ts`
- Create: `ai-daily/src/lib/validateLesson.ts`
- Create: `ai-daily/src/lib/validateLesson.test.ts`
- Create: `ai-daily/src/lib/generateMorning.ts`
- Create: `ai-daily/scripts/generate.ts`

**Interfaces:**
- `getTopicForDay(day: number): { day, title, bullets: string[] }`
- `countChineseAwareChars(lesson): number` — `intro + sections.map(s => s.heading+s.body).join("")` 长度
- `validateLesson(lesson): { ok: boolean; reasons: string[] }`  
  要求：字数 1500～2500；quiz 长度 2～3；每题 options≥2；`answerIndex` 合法；hotspot/fallback 类必须有 disclaimer
- `generateMorningLesson(date: string): Promise<Lesson>`  
  读 `progress.nextDay` → 取大纲 → LLM JSON → validate → 失败重试 1 次 → `writeLesson`；若写入成功且最终可展示，则 `nextDay += 1`
- LLM：`POST ${LLM_BASE_URL}/chat/completions`，`response_format: { type: "json_object" }`

- [ ] **Step 1: 写 `validateLesson` 测试与实现**

边界：1499 失败、1500 通过、2501 失败；缺 disclaimer 的 hotspot 失败。

- [ ] **Step 2: 写 `curriculum` 测试：day 1 有主题；超范围抛错或返回 null（选定一种：返回 null）**

- [ ] **Step 3: 实现 `llm.ts`**

```typescript
export async function chatJson(system: string, user: string): Promise<unknown> {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new Error("LLM_API_KEY missing");
  const res = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}
```

- [ ] **Step 4: 实现 `generateMorning.ts` 提示词**

System 约束：零基础、术语跟人话、输出严格 JSON 字段与 `Lesson` 一致（不含 date/slot/status/createdAt，由代码填充）、3～4 个 sections、2～3 quiz。

- [ ] **Step 5: `scripts/generate.ts`**

```bash
npx tsx scripts/generate.ts morning
npx tsx scripts/generate.ts afternoon
```

无 `LLM_API_KEY` 时打印清晰中文错误。

- [ ] **Step 6: 集成测（有密钥时）**

```bash
export LLM_API_KEY=... # 用户自备
npx tsx scripts/generate.ts morning
```

Expected: `content/lessons/今日日期-morning.json` 出现；`progress.nextDay` 增加。

- [ ] **Step 7: Commit**（允许时）`feat: add curriculum and morning lesson generator`

---

### Task 7: 热点 RSS、晚间生成与降级

**Files:**
- Create: `ai-daily/src/lib/rss.ts`
- Create: `ai-daily/src/lib/fallbackHotspot.ts`
- Create: `ai-daily/src/lib/generateAfternoon.ts`
- Create: `ai-daily/content/fallback-topics.json`（8～12 条经典主题/工具，供降级）

**Interfaces:**
- `fetchHotspotCandidates(): Promise<{ title: string; url: string; summary?: string }[]>`  
  源（可配置数组，默认至少 2 个公开 AI/科技 RSS；请求失败则跳过该源）
- `generateAfternoonLesson(date: string): Promise<Lesson>`  
  候选为空或 LLM 失败 → `fallback_classic` 或 `fallback_tool`（轮询 `fallback-topics.json`）仍生成满篇幅稿 + disclaimer
- 成功热点稿 `type: "hotspot"`，带 `sources`

- [ ] **Step 1: 实现 RSS 解析**（`fast-xml-parser`），单测可用一段内联 XML fixture。

- [ ] **Step 2: 实现降级生成（可走 LLM，也可用模板拼出合格字数；优先 LLM + fallback topic）**

- [ ] **Step 3: 实现 `generateAfternoon` 并接入 `scripts/generate.ts afternoon`**

- [ ] **Step 4: 验证空候选仍能写出文件且 `type` 为 fallback_*，含 disclaimer**

- [ ] **Step 5: Commit**（允许时）`feat: add afternoon hotspot generator with fallbacks`

---

### Task 8: Cron 接口与调度配置

**Files:**
- Create: `ai-daily/src/app/api/cron/generate/route.ts`
- Create: `ai-daily/vercel.json`
- Modify: `ai-daily/README.md`

**Interfaces:**
- `GET/POST /api/cron/generate?slot=morning|afternoon`  
  Header：`Authorization: Bearer ${CRON_SECRET}`，否则 401  
  成功：调用对应 generator，返回 `{ ok: true, writeResult, date }`

**Cron 时刻（Vercel 使用 UTC）：**

- 上海 07:30 = UTC **23:30**（前一日）→ cron `30 23 * * *` 跑 morning（注意日期用上海 `formatShanghaiDate`）
- 上海 17:30 = UTC **09:30** → cron `30 9 * * *` 跑 afternoon

`vercel.json` 示例：

```json
{
  "crons": [
    { "path": "/api/cron/generate?slot=morning", "schedule": "30 23 * * *" },
    { "path": "/api/cron/generate?slot=afternoon", "schedule": "30 9 * * *" }
  ]
}
```

（若平台对 query 支持不佳，改为 path `/api/cron/generate/morning` 两个路由。）

- [ ] **Step 1: 实现鉴权 + 生成**

- [ ] **Step 2: 本地 curl 测 401 与假密钥**

```bash
curl -i http://localhost:3000/api/cron/generate?slot=morning
# 401
curl -i -H "Authorization: Bearer change-me" "http://localhost:3000/api/cron/generate?slot=morning"
```

- [ ] **Step 3: README 写零基础清单**：安装 Node、复制 `.env.example`、填密钥、`npm run dev`、手动 generate、部署 Vercel、设 `CRON_SECRET`

- [ ] **Step 4: Commit**（允许时）`feat: add secured cron generate endpoint and docs`

---

### Task 9: 端到端验收清单

**Files:** 无新代码除非修 bug

- [ ] **Step 1: 按规格第 7 节跑手工清单**

| 项 | 操作 | 期望 |
|----|------|------|
| 时间边界 | 临时改测或信任 unit | 与 Task 2 一致 |
| 分享 | 隐私窗打开 `/learn/...` | 可读 |
| 不覆盖 | 对已有 ok 稿再 generate | skip |
| 降级 | 断网/空 RSS 跑 afternoon | fallback 入库 |
| 小测 | 选对选错 | 有解析 |
| 移动端 | 窄屏 | 单栏可读 |

- [ ] **Step 2: 更新设计文档状态为「实现中/已完成」**（`docs/superpowers/specs/2026-09-22-ai-daily-learn-design.md` 顶部状态字段）

- [ ] **Step 3: 向用户汇报**：本地地址、如何配置密钥、如何手动补跑

---

## Spec 覆盖自检

| 规格要求 | 任务 |
|----------|------|
| 早基础晚热点、07:30/17:30 | Task 2, 6, 7, 8 |
| 阅读+小测+分享链接 | Task 5 |
| 全自动 + 降级 | Task 6, 7 |
| Day N 不跳课 | Task 6 `progress.json` |
| 质量闸门与不覆盖 ok | Task 3, 6 |
| API today/lesson/history | Task 4 |
| 无登录等不做项 | 全任务未引入 |
| 部署与密钥说明 | Task 8 README |
| 预留小程序 | Task 4 API 可复用 |

---

## 执行方式

计划已保存到 `docs/superpowers/plans/2026-09-22-ai-daily-learn.md`。

两种执行方式：

1. **Subagent-Driven（推荐）** — 每任务派一个新子代理，任务间复查，迭代快  
2. **Inline Execution** — 本会话按 executing-plans 连续执行，设检查点  

你选哪一种？选好后我就开始实现。
