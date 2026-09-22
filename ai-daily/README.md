# AI 每日学习站

每天按上海时间 07:30 生成 AI 基础课，17:30 生成 AI 热点课。项目使用 Next.js，并通过带密钥保护的 Cron 接口触发生成。

## 零基础本地运行清单

1. 从 [Node.js 官网](https://nodejs.org/) 安装 Node.js 20 LTS 或更高版本。
2. 在终端进入本项目目录并安装依赖：

```bash
cd ai-daily
npm install
```

3. 复制环境变量模板：

```bash
cp .env.example .env.local
```

4. 打开 `.env.local`，至少填写 `LLM_API_KEY`，并把 `CRON_SECRET` 改成一段无法猜到的随机字符串。兼容 OpenAI 的其他服务还需按服务商说明修改 `LLM_BASE_URL` 和 `LLM_MODEL`。
5. 启动开发服务器：

```bash
npm run dev
```

6. 浏览器打开 [http://localhost:3000](http://localhost:3000)。

## 手动生成课程

在项目根目录执行：

```bash
npx tsx scripts/generate.ts morning
npx tsx scripts/generate.ts afternoon
```

课程日期始终按 `Asia/Shanghai` 计算。已有 `ok` 稿不会被覆盖。

## 验证 Cron 接口

未提供密钥时应返回 `401`：

```bash
curl -i "http://localhost:3000/api/cron/generate?slot=morning"
```

使用 `.env.local` 中相同的 `CRON_SECRET` 可触发生成：

```bash
curl -i -H "Authorization: Bearer 你的CRON_SECRET" \
  "http://localhost:3000/api/cron/generate?slot=morning"
```

也可以把 `slot` 改成 `afternoon`，或使用相同 URL 发送 `POST` 请求。

## 零基础 Vercel 部署清单

1. 把代码推送到 GitHub。
2. 登录 [Vercel](https://vercel.com/)，选择 **Add New → Project**，导入代码仓库；如果仓库根目录不是本项目，将 **Root Directory** 设为 `ai-daily`。
3. 在项目 **Settings → Environment Variables** 中逐项添加 `.env.example` 里的变量；`LLM_API_KEY` 和 `CRON_SECRET` 必须填写真实值，且不要提交到 Git。
4. 点击 **Deploy**。`vercel.json` 会配置两次 UTC 定时任务：`23:30` 触发次日上海早课，`09:30` 触发当日上海热点课。
5. 部署后在 **Settings → Cron Jobs** 确认两条任务存在，并在 **Logs** 查看首次运行结果。

> 注意：当前 MVP 把课程写入本地 JSON。Vercel 函数文件系统不能作为持久化内容库；正式线上自动生成前，需要把课程和进度存储替换为托管数据库或对象存储。本地运行不受此限制。
