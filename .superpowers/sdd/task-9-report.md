# Task 9：端到端验收报告

**状态：** 通过  
**日期：** 2026-09-22

## 验收清单

- [x] 时间边界：`src/lib/time.test.ts` 覆盖 06:59、07:30、17:29、17:30；完整测试通过。
- [x] 分享路由：无 Cookie 的 `curl` 请求 `/learn/2026-09-21/morning` 与 `/learn/2026-09-21/afternoon` 均返回 200；课程 API 同样返回 200。
- [x] 不覆盖：`lessonStore` 测试确认已有 `status=ok` 稿件返回 `skipped_existing_ok` 且内容不变。
- [x] 降级：空候选、资讯拉取异常和 LLM 失败均由测试确认写入 fallback；运行不依赖 `LLM_API_KEY`。
- [x] 小测：组件测试覆盖选对、选错、解析展示与答题后锁定。
- [x] 移动端：CSS 在 680px 断点切为单栏，CTA 满宽，历史列表单列，正文保持 1.08rem / 1.95 行高；生产构建通过。
- [x] Important 回归：新增“已有 ok 下午课时跳过降级稿且不推进 `fallback-progress.nextIndex`”测试。
- [x] Cron 鉴权：无密钥请求返回 401。

## 验证结果

- `npm test`：10 个测试文件、39 个测试全部通过。
- `npm run lint`：通过。
- `npm run build`：Next.js 生产构建通过，分享页与 API 动态路由均成功生成。

## 用户交接

### 本地地址

在 `ai-daily` 目录执行 `npm run dev`，浏览器打开 <http://localhost:3000>。若 3000 端口已被占用，Next.js 会在终端显示实际端口（本次验收自动使用 3001）。

### 配置密钥

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

- `LLM_API_KEY`：填写大模型服务密钥。
- `CRON_SECRET`：填写一段不可猜测的随机字符串。
- 使用兼容 OpenAI 的其他服务时，按服务商配置 `LLM_BASE_URL` 和 `LLM_MODEL`。

密钥只保存在服务端环境变量中，不要提交 `.env.local`。

### 手动补跑

在 `ai-daily` 根目录执行：

```bash
npx tsx scripts/generate.ts morning
npx tsx scripts/generate.ts afternoon
```

日期按 `Asia/Shanghai` 计算；已有 `ok` 稿不会被覆盖。下午资讯源或模型不可用时会自动写入 fallback 课程。

## 已知关注项

- 当前 MVP 使用本地 JSON 存储，适合本地使用；Vercel 函数文件系统不提供持久化，线上自动生成前需迁移到托管数据库或对象存储。
- Vitest 输出一条未来版本的配置加载兼容性警告，不影响当前测试通过。
