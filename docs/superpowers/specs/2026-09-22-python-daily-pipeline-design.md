# Python 定时生成 + GitHub Pages 更新 — 设计规格

**日期：** 2026-09-22  
**状态：** 待用户确认后进入实现计划  
**关联：** 现有静态站 `ai-daily/`（GitHub Pages：https://arantxa1025.github.io/ai-daily/）

## 1. 目标

用 **Python** 分析固定权威数据源，每天自动生成「早间基础 / 晚间热点」两篇 Lesson JSON，经 **GitHub Actions** 在固定时刻提交到仓库，触发现有 Pages 部署，使手机网页内容不再长期静态。

### 成功标准

- 上海时间 **07:30** 产出当日 `morning` 稿；**17:30** 产出当日 `afternoon` 稿  
- 生成后网站在数分钟内可刷新看到新内容（Actions 构建完成后）  
- 密钥仅存 GitHub Secrets；白名单源可配置、可改  
- 失败有降级，不覆盖已有 `status: ok` 稿  

### 明确不做（本期）

- Vercel Cron / 线上可写文件系统  
- 以 TypeScript 生成器作为线上主路径（可保留本地脚本，默认不再用于 Actions）  
- 登录、推送通知、多用户  

## 2. 已拍板决定

| 项 | 决定 |
|----|------|
| 架构 | 方案 1：Python 流水线 + Actions 双定时 + 现有 Pages |
| 写稿 | Python 抓源 + **MiniMax-M3** |
| API | 国内 `https://api.minimaxi.com/v1`（OpenAI 兼容） |
| 数据源 | 默认权威白名单，配置文件可改（选项 C） |
| 输出格式 | 与现有 `Lesson` JSON 一致，写入 `ai-daily/content/lessons/` |

## 3. 端到端流程

```
sources.yaml / curriculum
        ↓
Python fetch + filter（热点：近 48h、多源轮询）
        ↓
MiniMax-M3 生成白话课 + 小测
        ↓
validate（字数 1500–2500、quiz 2–3、热点 disclaimer）
        ↓
write JSON（ok 不覆盖）
        ↓
git commit + push（仅有变更时）
        ↓
现有 Deploy GitHub Pages 工作流重建站点
```

### 调度（Asia/Shanghai）

| Cron（UTC 换算） | 槽位 |
|------------------|------|
| `30 23 * * *`（UTC）≈ 上海 07:30 | morning |
| `30 9 * * *`（UTC）≈ 上海 17:30 | afternoon |

另支持 `workflow_dispatch`，可选手动指定 `slot=morning|afternoon`。

## 4. 仓库结构

```text
pipeline/
  requirements.txt
  config/
    sources.yaml              # 热点源白名单
  src/
    llm_minimax.py
    fetch_sources.py
    validate.py
    store.py
    generate_morning.py
    generate_afternoon.py
    fallback.py
  run.py                      # python -m / run.py morning|afternoon
.github/workflows/
  daily-generate.yml          # 定时生成并 push
  deploy-pages.yml            # 已有：静态构建发布
ai-daily/
  content/
    curriculum.json           # 早间大纲（复用）
    progress.json
    lessons/
    fallback-topics.json      # 可复用或由 Python 读同一文件
```

早间大纲优先 **复用** `ai-daily/content/curriculum.json` 与 `progress.json`，避免两套进度。

## 5. 配置与密钥

### `pipeline/config/sources.yaml`（示例语义）

```yaml
hotspot:
  max_age_hours: 48
  per_source_limit: 6
  sources:
    - name: DeepMind Blog
      type: rss
      url: https://...
      enabled: true
    # ... Google AI Blog, OpenAI Blog, 等默认权威源
```

### GitHub Secrets

| Name | 必填 | 默认 |
|------|------|------|
| `MINIMAX_API_KEY` | 是 | — |
| `MINIMAX_BASE_URL` | 否 | `https://api.minimaxi.com/v1` |
| `MINIMAX_MODEL` | 否 | `MiniMax-M3` |

调用：`POST {BASE_URL}/chat/completions`，`Authorization: Bearer …`，模型名 `MiniMax-M3`；优先使用 `max_completion_tokens`（若接口要求）。

### Actions 权限

- `daily-generate.yml`：`contents: write`（提交课程与 progress）  
- `deploy-pages.yml`：保持现有 `pages: write` + `id-token: write`  
- 提交身份：`github-actions[bot]`；仅当 lessons/progress 等有 diff 才 push，避免空提交  

## 6. 生成规则（与现站一致）

### 早间 `morning`

- 读 `progress.nextDay` → 大纲主题 → LLM JSON → validate → 写入  
- 成功可展示（`ok` / `draft_quality`）且 `writeResult=written` 时 `nextDay += 1`  
- 大纲耗尽：清晰失败信息，不写空稿  

### 晚间 `afternoon`

- 按 `sources.yaml` 拉取 → 48h 过滤 → 每源限额后合并  
- 有候选：热点稿 + `sources` + disclaimer  
- 无候选 / LLM 失败：fallback 主题顺序轮换，仍含 disclaimer  

### 质量闸门

- 正文字符数约 1500–2500  
- quiz 2–3 题  
- 校验失败重试 1 次；无成功稿时可落 `draft_quality`；已有 `ok` 不覆盖  

## 7. Lesson JSON 契约

与现有 TypeScript `Lesson` 类型对齐（字段名不变），保证 Pages 前端无需改协议即可渲染。

## 8. 测试与验收

- 单元：RSS 解析与时效过滤、validate、store 不覆盖 ok  
- 集成（可选、有 Key 时）：对 MiniMax 一次 smoke（可跳过 CI）  
- Actions：手动 `workflow_dispatch` 跑通 morning/afternoon → 仓库出现 JSON → Pages 200  
- 手机打开 https://arantxa1025.github.io/ai-daily/ 可见新日期内容  

## 9. 用户一次性操作清单

1. 仓库 Settings → Secrets and variables → Actions → 新建 `MINIMAX_API_KEY`  
2. （可选）设置 `MINIMAX_BASE_URL` / `MINIMAX_MODEL`  
3. Actions 中手动跑一次 `daily-generate` 验证  
4. 之后依赖定时即可；改源只需改 `sources.yaml` 并 push  

---

确认本规格后，下一步编写实现计划再编码。
