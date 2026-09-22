# Python Daily Pipeline + Pages Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Python + MiniMax-M3 按上海时间每天 07:30/17:30 自动生成早间基础与晚间热点 Lesson JSON，经 GitHub Actions 提交并触发现有 GitHub Pages 部署。

**Architecture:** 新建 `pipeline/`：配置白名单 → 抓取/筛选 → MiniMax 写稿 → 校验 → 写入 `ai-daily/content/lessons/`（复用 curriculum/progress）。`daily-generate.yml` 定时 push；现有 `deploy-pages.yml` 负责建站。

**Tech Stack:** Python 3.11+、`httpx`、`feedparser`、`PyYAML`、`pytest`；MiniMax OpenAI 兼容 API（国内 `https://api.minimaxi.com/v1`，模型 `MiniMax-M3`）；GitHub Actions cron。

## Global Constraints

- 时区：`Asia/Shanghai`；早 `07:30` / 晚 `17:30`（UTC cron：`30 23 * * *` / `30 9 * * *`）
- API：`MINIMAX_API_KEY`；默认 `MINIMAX_BASE_URL=https://api.minimaxi.com/v1`；`MINIMAX_MODEL=MiniMax-M3`
- 输出路径：`ai-daily/content/lessons/{date}-{slot}.json`；大纲/进度：`ai-daily/content/curriculum.json`、`progress.json`
- Lesson 字段与 TS `Lesson` 一致；字数约 1500–2500；quiz 2–3；热点必有 disclaimer
- 已有 `status===ok` 不覆盖；热点空源走 fallback；密钥不进仓库
- Pages URL：`https://arantxa1025.github.io/ai-daily/`

---

## 文件结构（锁定）

```text
pipeline/
  requirements.txt
  pyproject.toml                 # 可选；至少 requirements + pytest.ini
  pytest.ini
  config/sources.yaml
  src/
    __init__.py
    paths.py                     # 定位仓库根与 content 目录
    models.py                    # TypedDict / dataclass Lesson
    llm_minimax.py
    fetch_sources.py
    validate.py
    store.py
    curriculum.py
    fallback.py
    generate_morning.py
    generate_afternoon.py
  tests/
    test_validate.py
    test_store.py
    test_fetch_sources.py
    test_fallback.py
    fixtures/sample.rss.xml
  run.py
.github/workflows/daily-generate.yml
docs/.../specs/...               # 已有，更新状态
ai-daily/README.md               # 补充 Secrets 与定时说明
```

---

### Task 1: Scaffold + paths + Lesson 模型

**Files:**
- Create: `pipeline/requirements.txt`
- Create: `pipeline/pytest.ini`
- Create: `pipeline/src/__init__.py`
- Create: `pipeline/src/paths.py`
- Create: `pipeline/src/models.py`
- Create: `pipeline/tests/test_paths.py`

**Interfaces:**
- Produces:
  - `repo_root() -> Path`
  - `content_dir() -> Path` → `ai-daily/content`
  - `lessons_dir() -> Path`
  - `Lesson` TypedDict（字段对齐 TS）

- [ ] **Step 1: 写 `requirements.txt`**

```text
httpx>=0.27
feedparser>=6.0
PyYAML>=6.0
pytest>=8.0
```

- [ ] **Step 2: 写失败测试 `tests/test_paths.py`**

```python
from src.paths import content_dir, lessons_dir, repo_root

def test_content_dir_points_at_ai_daily_content():
    assert content_dir().name == "content"
    assert content_dir().parent.name == "ai-daily"
    assert (content_dir() / "curriculum.json").exists()
    assert lessons_dir() == content_dir() / "lessons"
    assert repo_root().joinpath("pipeline").is_dir()
```

- [ ] **Step 3: 实现 `paths.py` / `models.py`**

`paths.py` 从 `Path(__file__).resolve()` 向上找到含 `ai-daily/content` 的仓库根。

`models.py` 使用 `TypedDict` 定义 `Lesson`、`QuizItem`、`LessonSection`、`LessonSource`。

- [ ] **Step 4: 跑测**

```bash
cd pipeline && python -m pytest tests/test_paths.py -v
```

Expected: PASS

- [ ] **Step 5: Commit** `chore: scaffold python pipeline package`

---

### Task 2: validate + store（不覆盖 ok）

**Files:**
- Create: `pipeline/src/validate.py`
- Create: `pipeline/src/store.py`
- Create: `pipeline/tests/test_validate.py`
- Create: `pipeline/tests/test_store.py`

**Interfaces:**
- `body_char_count(lesson) -> int`：`intro + sum(heading+body for sections)`
- `validate_lesson(lesson) -> tuple[bool, list[str]]`
- `read_lesson(date, slot) -> dict | None`
- `write_lesson(lesson) -> Literal["written", "skipped_existing_ok"]`

- [ ] **Step 1: validate 测试**（1499 失败、1500 通过、2501 失败；hotspot 无 disclaimer 失败；quiz 边界）

- [ ] **Step 2: 实现 validate**

规则：字数 1500–2500；quiz 长度 2–3；每题 `options>=2` 且 `0 <= answerIndex < len(options)`；`type in {hotspot, fallback_*}` 必须有非空 `disclaimer`。

- [ ] **Step 3: store 测试**（tmpdir monkeypatch `lessons_dir`）：写入可读；已有 ok 再写返回 `skipped_existing_ok` 且文件不变。

- [ ] **Step 4: 实现 store**（UTF-8 JSON，indent=2，末尾换行）

- [ ] **Step 5: Commit** `feat: add lesson validate and json store`

---

### Task 3: MiniMax 客户端

**Files:**
- Create: `pipeline/src/llm_minimax.py`
- Create: `pipeline/tests/test_llm_minimax.py`

**Interfaces:**
- `chat_json(system: str, user: str, *, client=None) -> dict`
- 环境变量：`MINIMAX_API_KEY`（缺则抛中文错误）、`MINIMAX_BASE_URL`（默认 `https://api.minimaxi.com/v1`）、`MINIMAX_MODEL`（默认 `MiniMax-M3`）
- POST `{base}/chat/completions`，`response_format: {type: json_object}`（若国内接口不支持则提示词强制 JSON + `json.loads` 抽取）
- 使用 `max_completion_tokens`（如 8192）；Bearer 鉴权

- [ ] **Step 1: 测试用 httpx MockTransport**：断言 URL、Authorization、model、返回 JSON 被解析

- [ ] **Step 2: 无 KEY 时抛错文案含「MINIMAX_API_KEY」**

- [ ] **Step 3: 实现并跑通 pytest**

- [ ] **Step 4: Commit** `feat: add MiniMax-M3 OpenAI-compatible client`

---

### Task 4: 热点源配置 + fetch

**Files:**
- Create: `pipeline/config/sources.yaml`
- Create: `pipeline/src/fetch_sources.py`
- Create: `pipeline/tests/test_fetch_sources.py`
- Create: `pipeline/tests/fixtures/sample.rss.xml`

**Interfaces:**
- `load_sources_config(path=None) -> dict`
- `fetch_hotspot_candidates(*, now: datetime | None = None, fetch_url=None) -> list[Candidate]`
- `Candidate`: `title`, `url`, `summary`, `published_at` (aware UTC or ISO)

默认 `sources.yaml`（enabled）：

```yaml
hotspot:
  max_age_hours: 48
  per_source_limit: 6
  sources:
    - name: DeepMind Blog
      type: rss
      url: https://deepmind.google/blog/rss.xml
      enabled: true
    - name: TechCrunch AI
      type: rss
      url: https://techcrunch.com/category/artificial-intelligence/feed/
      enabled: true
    - name: OpenAI Blog
      type: rss
      url: https://openai.com/blog/rss.xml
      enabled: true
    - name: Google AI Blog
      type: rss
      url: https://blog.google/technology/ai/rss/
      enabled: true
```

（若某 URL 404，实现中单源失败跳过；可在 README 注明可改。）

- [ ] **Step 1: fixture RSS 含新旧两条 pubDate；测试只保留 48h 内；每源最多 N 条；源失败不抛总失败**

- [ ] **Step 2: 用 feedparser 实现；时区比较用 `now` 注入**

- [ ] **Step 3: Commit** `feat: add configurable hotspot RSS fetch`

---

### Task 5: curriculum + fallback + morning/afternoon 生成

**Files:**
- Create: `pipeline/src/curriculum.py`
- Create: `pipeline/src/fallback.py`
- Create: `pipeline/src/generate_morning.py`
- Create: `pipeline/src/generate_afternoon.py`
- Create: `pipeline/tests/test_fallback.py`
- Create: `pipeline/tests/test_generate_morning.py`
- Create: `pipeline/tests/test_generate_afternoon.py`

**Interfaces:**
- `get_topic_for_day(day: int) -> dict | None`（读 `ai-daily/content/curriculum.json`）
- `read_progress() / write_progress(next_day: int)`
- `pick_fallback_topic() / advance_fallback()`（读写下 `ai-daily/content/fallback-progress.json` + `fallback-topics.json`）
- `generate_morning(date: str, *, chat_json=...) -> tuple[lesson, write_result]`
- `generate_afternoon(date: str, *, chat_json=..., fetch_candidates=...) -> tuple[lesson, write_result]`

逻辑对齐现 TS：
- morning：nextDay → LLM → validate → 重试 1 → write；written 且可展示则 nextDay+1；大纲空则 raise 中文错误
- afternoon：候选 → LLM；失败/空 → fallback 模板或 LLM+topic；disclaimer 固定句：「根据公开信息整理，非投资/内幕建议。」

- [ ] **Step 1: 用假 chat_json / 假 fetch 写测：成功写入、skip ok、空候选 fallback、校验失败后 draft_quality**

- [ ] **Step 2: 实现生成器（提示词：零基础、术语跟人话、严格 JSON 字段）**

- [ ] **Step 3: Commit** `feat: add morning and afternoon python generators`

---

### Task 6: CLI `run.py`

**Files:**
- Create: `pipeline/run.py`

**Interfaces:**
- `python run.py morning|afternoon [--date YYYY-MM-DD]`
- 默认日期：上海当日 `Asia/Shanghai`
- 退出码：成功 0；缺密钥/大纲耗尽等非 0；打印简短中文结果（date、writeResult、title）

- [ ] **Step 1: 实现 argparse + 调用 generate_***

- [ ] **Step 2: 本地无 Key 时确认错误可读**

```bash
cd pipeline && env -u MINIMAX_API_KEY python run.py morning ; echo exit:$?
```

Expected: 非 0，文案含 MINIMAX_API_KEY

- [ ] **Step 3: Commit** `feat: add pipeline CLI entrypoint`

---

### Task 7: GitHub Action `daily-generate.yml`

**Files:**
- Create: `.github/workflows/daily-generate.yml`
- Modify: `ai-daily/README.md`
- Modify: `docs/superpowers/specs/2026-09-22-python-daily-pipeline-design.md`（状态改为实现中/完成）

**Workflow 要点：**

```yaml
name: Daily Generate Lessons
on:
  schedule:
    - cron: "30 23 * * *"   # morning 上海 07:30
    - cron: "30 9 * * *"    # afternoon 上海 17:30
  workflow_dispatch:
    inputs:
      slot:
        description: morning or afternoon
        required: true
        default: morning
        type: choice
        options: [morning, afternoon]

permissions:
  contents: write

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r pipeline/requirements.txt
      - name: Resolve slot
        id: slot
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            echo "value=${{ inputs.slot }}" >> $GITHUB_OUTPUT
          elif [ "${{ github.event.schedule }}" = "30 23 * * *" ]; then
            echo "value=morning" >> $GITHUB_OUTPUT
          else
            echo "value=afternoon" >> $GITHUB_OUTPUT
          fi
      - name: Generate
        env:
          MINIMAX_API_KEY: ${{ secrets.MINIMAX_API_KEY }}
          MINIMAX_BASE_URL: ${{ secrets.MINIMAX_BASE_URL || 'https://api.minimaxi.com/v1' }}
          MINIMAX_MODEL: ${{ secrets.MINIMAX_MODEL || 'MiniMax-M3' }}
        run: python pipeline/run.py ${{ steps.slot.outputs.value }}
      - name: Commit and push if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add ai-daily/content/lessons ai-daily/content/progress.json ai-daily/content/fallback-progress.json || true
          if git diff --staged --quiet; then
            echo "No content changes"
            exit 0
          fi
          git commit -m "content: auto ${{ steps.slot.outputs.value }} $(TZ=Asia/Shanghai date +%F)"
          git push
```

注意：`secrets.X || 'default'` 在 GitHub Actions 表达式里可能需改成：

```yaml
MINIMAX_BASE_URL: ${{ secrets.MINIMAX_BASE_URL }}
```

并在 run 步骤用 bash 默认值：`export MINIMAX_BASE_URL="${MINIMAX_BASE_URL:-https://api.minimaxi.com/v1}"`。

README 增加：Secrets 配置步骤、手动触发路径、定时说明、改 `sources.yaml` 方法。

- [ ] **Step 1: 添加 workflow + README**

- [ ] **Step 2: Commit + push 到 origin**（需用户已配 `MINIMAX_API_KEY` 才能真实生成；未配置时 workflow 应失败并明确日志）

- [ ] **Step 3: 文档中写明用户须在 GitHub 添加 Secret 后手动跑一次**

---

### Task 8: 验收清单

- [ ] 本地：`pytest` 全绿  
- [ ] 有 Key 时本地：`python run.py afternoon` 写出 JSON 且 validate 过  
- [ ] GitHub：Secret 已设 → Actions 手动 morning → 仓库出现文件 → Pages 构建成功 → 手机打开可见  
- [ ] 更新设计规格状态为「已实现」并 commit  

---

## Spec 覆盖自检

| 规格项 | 任务 |
|--------|------|
| MiniMax-M3 国内 API | Task 3, 7 |
| sources.yaml 可改白名单 | Task 4 |
| 07:30 / 17:30 定时 | Task 7 |
| Lesson JSON 契约 / 不覆盖 ok | Task 2, 5 |
| fallback / draft_quality | Task 5 |
| Pages 自动更新 | Task 7 push → 现有 deploy-pages |
| README 用户操作 | Task 7–8 |

---

## 执行方式

计划已保存到 `docs/superpowers/plans/2026-09-22-python-daily-pipeline.md`。

**两种执行方式：**

1. **Subagent-Driven（推荐）** — 每任务新子代理，任务间复查  
2. **Inline Execution** — 本会话连续执行  

你选 **1** 或 **2**？选好后开始实现。实现过程中你需要把 **`MINIMAX_API_KEY`** 加到 GitHub Secrets（我无法替你粘贴密钥）。
