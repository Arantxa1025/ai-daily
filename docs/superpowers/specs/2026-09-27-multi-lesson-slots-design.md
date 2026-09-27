# 早晚多篇内容（按素材质量动态出稿）— 设计规格

**日期：** 2026-09-27  
**状态：** 待实现  
**关联：** `docs/superpowers/specs/2026-09-22-python-daily-pipeline-design.md`；站点 `ai-daily/`；流水线 `pipeline/`

## 1. 目标

每天早间 / 晚间仍各跑一次定时生成，但**每个时段可产出多篇 Lesson**，篇数不设硬上限，由素材质量动态决定。

- 晚间：够格的 **AI 新闻**各自成篇；并从新闻提炼 **新概念** 成篇；无新闻时从概念词库补篇。
- 早间：大纲 **基础课**必出 1 篇；有值得拆开的点再加 **延伸** 篇。

### 成功标准

- Actions 仍在上海 07:30 / 17:30 各生成对应槽位；一次可写入多个 JSON 后统一 commit。
- 首页能按槽位列出当日多篇；旧单文件路由与内容仍可读。
- 已有 `status: ok` 的同 id 稿不被覆盖；重跑只补缺失篇。
- 无够格新闻时晚间仍有可读内容（词库概念或 fallback）。

### 明确不做（本期）

- 推送通知、登录、多用户订阅。
- 无限量狂刷 API（保留可配置软上限防爆账单）。
- 改动定时时刻或更换 LLM 供应商。

## 2. 已拍板决定

| 项 | 决定 |
|----|------|
| 篇数模型 | 方案 B：每时段多篇；不设硬上限 |
| 篇数规则 | 方案 A：按素材质量动态出稿 |
| 概念来源 | 方案 B：从当天新闻提炼；无新闻走概念词库 |
| 存储形态 | 方案 1：一槽多文件（非整包合集） |
| 软上限 | `max_news_lessons` 默认 5；`max_extension_lessons` 默认 2；可在配置改 |

## 3. 存储与 Lesson 契约

### 文件命名

```text
{date}-{slot}-{theme}-{nn}.json
```

示例：

- `2026-09-27-morning-basics-01.json`
- `2026-09-27-morning-extension-01.json`
- `2026-09-27-afternoon-news-01.json`
- `2026-09-27-afternoon-concept-01.json`

`nn` 为两位序号，同日同槽同 theme 从 `01` 递增。

### 旧文件兼容

仍识别 `{date}-{slot}.json`：

- 视为该槽位第一篇；
- `theme` 推断：`morning` → `basics`，`afternoon` → `news`；
- `id` 推断为文件名去扩展名（即 `{date}-{slot}`）。

### 新增 / 调整字段

| 字段 | 说明 |
|------|------|
| `id` | 与文件名（无 `.json`）一致 |
| `theme` | `basics` \| `news` \| `concept` \| `extension` |
| `type` | `basics` \| `hotspot` \| **`concept`**（新增）；新闻仍用 `hotspot`；延伸用 `basics` |
| `relatedIds` | 可选 `string[]`，新闻 ↔ 概念互链 |
| `slot` / `date` / `status` 等 | 与现有一致 |

其余字段（`title`、`estimatedMinutes`、`intro`、`sections`、`quiz`、`takeaway`、热点 `disclaimer`/`sources`）沿用现有校验语义。

### 幂等

- 写入前若已存在同路径且 `status == ok` → `skipped_existing_ok`。
- 重跑同一槽位：扫描已有 ids，只生成缺失主题/序号。

## 4. 生成流水线

### 晚间 afternoon

1. 抓取 `sources.yaml` RSS → 去重、限龄（`max_age_hours`）。
2. **质量门槛**（候选需同时满足，否则丢弃）：
   - 标题非空、有 URL；
   - 摘要或正文片段达到最低信息量（可配置，默认摘要 ≥ 40 字或有可用 summary）；
   - 与当日已选候选标题相似度不高（简单规范化字符串 / 关键词重叠即可，不必上向量库）。
3. 通过者进入新闻候选池；条数受 `max_news_lessons` 软上限裁剪（按发布时间新→旧）。
4. **每条够格新闻 → 1 篇 `theme=news`**（独立 LLM 调用；单条失败跳过，不影响其他）。
5. **概念提炼**：对已成功写入的新闻，让模型提出 0～2 个「零基础值得单独成篇」的概念；与近 N 天已有 concept 标题去重后生成 `theme=concept`，并填写 `relatedIds` 互链。
6. **无够格新闻**：从 `ai-daily/content/concept-bank.json`（可编辑词库）按进度取至少 1 篇概念；词库耗尽则走现有 afternoon fallback 热点。

### 早间 morning

1. **必出** 1 篇 `theme=basics`（现有 `curriculum.json` + `progress.json` 日进度；仅 basics 成功写入时推进 `nextDay`）。
2. **可选** 0～N 篇 `theme=extension`：仅当「基础课中出现值得单独拆开的术语/技能」判定通过时生成；受 `max_extension_lessons` 限制。

### 校验与篇幅

- 多篇场景下单篇正文建议 **800～1800** 字符（intro + sections）；单篇仍可保留小测 2～3 题。
- 首页可汇总展示「今日合计约 X 分钟」。
- JSON 解析继续使用现有 MiniMax 修复 / 重试策略。

### 配置扩展（建议写入 `sources.yaml` 或旁路 `pipeline/config/generation.yaml`）

```yaml
slots:
  afternoon:
    max_news_lessons: 5
    max_concepts_per_news: 2
    min_summary_chars: 40
  morning:
    max_extension_lessons: 2
concept_bank:
  path: ai-daily/content/concept-bank.json
  recent_dedupe_days: 14
```

## 5. 前端展示

- **路由**：`/learn/{date}/{slot}/{id}`；旧 `/learn/{date}/{slot}` 重定向到该槽位排序后的第一篇。
- **读取 API**：`readLessons(date, slot) → Lesson[]`（含旧单文件）；列表排序：theme 优先（basics → extension；news → concept），同 theme 按 `nn`。
- **首页**：早间 / 晚间各一块列表（多卡片），不再只推单篇主 CTA。
  - 卡片：theme 标签、标题、预计分钟；
  - 主操作：进入该槽第一篇，或「查看今日 N 篇」。
- **课内页**：若有 `relatedIds`，文末「相关阅读」。
- **历史**：按日期聚合，可展开看多篇标题。
- **文案**：页头 / 页脚改为「每天早晚更新，篇数随内容而定」类表述，去掉「固定两更各一篇」的暗示。

## 6. Actions / CLI

- `python pipeline/run.py morning|afternoon` 行为变为：生成该槽位**全部应出篇**并写盘；stdout 汇总写入 / 跳过条数。
- `daily-generate.yml` 的 `git add` 范围仍为 `ai-daily/content/lessons` 与 progress / concept-bank 进度文件；有任一变更即 commit。
- 提交信息可改为：`content: auto {slot} {date} (N lessons)`。

## 7. 风险与降级

| 风险 | 处理 |
|------|------|
| LLM / 网络导致部分篇失败 | 成功篇照常提交；失败篇下次重跑补写 |
| 新闻爆发导致费用过高 | 软上限 + 可配置 |
| 概念与大纲重复 | 近 N 天标题去重 + 词库进度 |
| 前端未部署完用户仍看旧站 | 旧单文件兼容；新路由上线前旧链仍可用 |

## 8. 验收清单

- [ ] 本地 / Actions 一次 afternoon 可产出 ≥1 新闻或 ≥1 概念文件
- [ ] 同日重跑不覆盖 ok 稿，可补缺失 theme/序号
- [ ] 旧 `{date}-afternoon.json` 仍能在首页与学习页打开
- [ ] 首页展示多卡片；相关阅读互链可用
- [ ] 无 RSS 时概念词库或 fallback 仍写出晚间内容
