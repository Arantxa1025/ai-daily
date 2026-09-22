# AI 每日学习站

每天提供 AI 基础课和热点课。当前 MVP 采用本地 JSON 存储，并保留带密钥保护的 Cron 接口供手动调用。

> **线上暂不自动生成。** Vercel 的只读/临时文件系统不能持久保存课程和进度，因此 `vercel.json` 未启用 Cron。请在本地运行 `npx tsx scripts/generate.ts morning` 或 `npx tsx scripts/generate.ts afternoon`，再提交生成的 JSON 并部署；未来接入数据库或对象存储后再启用线上定时生成。

## 手机每天看哪里

部署成功后，用手机浏览器打开 Vercel 给你的 **https://……vercel.app** 地址（可收藏到主屏幕）。

- **早上 7:30 后**：首页点「今日基础」
- **下午 5:30 后**：首页点「今日热点」

更新内容流程（电脑上做一次即可）：

1. 本地生成：`npx tsx scripts/generate.ts morning` / `afternoon`
2. 提交并推送课程 JSON
3. Vercel 自动重新部署（或手动 Deploy）
4. 手机刷新同一网址即可看到新内容

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
基础课大纲目前为 60 天；结束后需先扩展 `content/curriculum.json`，否则生成器会给出明确错误并停止。

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

## 零基础 Vercel 部署清单（手机可打开）

### 方式 A：命令行一键部署（推荐）

在 `ai-daily` 目录执行：

```bash
npx vercel login
npx vercel --prod
```

按提示在浏览器登录 Vercel（可用 GitHub / 邮箱）。结束后终端会打印公网链接，手机浏览器打开即可。

### 方式 B：网页导入

1. 把代码推送到 GitHub。
2. 登录 [Vercel](https://vercel.com/)，选择 **Add New → Project**，导入代码仓库；如果仓库根目录不是本项目，将 **Root Directory** 设为 `ai-daily`。
3. 在项目 **Settings → Environment Variables** 中可按需添加 `.env.example` 里的变量（纯阅读不强制；若要用线上手动 Cron 再填 `CRON_SECRET` / `LLM_API_KEY`）。
4. 在本地生成课程 JSON，提交并推送后点击 **Deploy**。
5. 用手机打开项目域名（形如 `https://xxx.vercel.app`）。

> 再次提醒：当前 MVP 线上暂不自动生成。请执行“本地生成 → 提交课程 JSON → 部署”；未来接入持久化存储后再恢复 Vercel Cron。`/api/cron/generate` 路由仍保留，供本地或具备可写持久化环境的受保护手动调用。
