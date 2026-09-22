# AI 每日学习站

每天提供 AI 基础课和热点课。内容保存在仓库的 JSON 里，网站用 **GitHub Pages** 发布，手机浏览器可直接打开。

## 手机每天看哪里

部署成功后打开（仓库名为 `ai-daily` 时）：

**https://\<你的GitHub用户名\>.github.io/ai-daily/**

- **早上 7:30 后**：首页点「今日基础」
- **下午 5:30 后**：首页点「今日热点」

### 更新内容（电脑上）

```bash
cd ai-daily
npx tsx scripts/generate.ts morning    # 需配置 .env.local 里的 LLM_API_KEY
npx tsx scripts/generate.ts afternoon
cd ..
git add ai-daily/content
git commit -m "content: update daily lessons"
git push
```

推送后 GitHub Actions 会自动重新发布，一两分钟后手机刷新即可。

## 零基础本地预览

1. 安装 [Node.js 20+](https://nodejs.org/)
2. 进入目录并安装依赖：

```bash
cd ai-daily
npm install
npm run dev
```

3. 打开 [http://localhost:3000](http://localhost:3000)

本地开发不加 `BASE_PATH`；线上 GitHub Pages 使用 `/ai-daily` 前缀。

## 手动生成课程

```bash
cd ai-daily
cp .env.example .env.local   # 填入 LLM_API_KEY
npx tsx scripts/generate.ts morning
npx tsx scripts/generate.ts afternoon
```

课程日期按 `Asia/Shanghai`。已有 `ok` 稿不会被覆盖。大纲 60 天用尽后需扩展 `content/curriculum.json`。

## 发布到 GitHub Pages

1. 把本仓库推到 GitHub（公开仓库最简单）。
2. 打开仓库 **Settings → Pages → Build and deployment**，Source 选 **GitHub Actions**。
3. 推送 `master`/`main` 后查看 **Actions** 是否绿色。
4. 用手机打开 `https://<用户名>.github.io/ai-daily/`。

> 当前为静态网站：不在线上自动写稿。生成请在本地完成后再 `git push`。
