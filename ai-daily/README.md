# AI 每日学习站

每天提供 AI 基础课和热点课。内容保存在仓库的 JSON 里，网站用 **GitHub Pages** 发布，手机浏览器可直接打开。

## 手机每天看哪里

部署成功后打开（仓库名为 `ai-daily` 时）：

**https://\<你的GitHub用户名\>.github.io/ai-daily/**

- **早上 7:30 后**：首页点「今日基础」
- **下午 5:30 后**：首页点「今日热点」

### 自动生成时间

GitHub Actions 使用 UTC cron，并按上海时间生成当天课程：

- 每天 **07:30** 运行 `morning`（UTC `30 23 * * *`）
- 每天 **17:30** 运行 `afternoon`（UTC `30 9 * * *`）

GitHub 的定时任务可能有几分钟延迟。工作流生成 JSON 并提交后，Pages 会自动重新发布。

## 首次配置自动生成

1. 打开仓库 **Settings → Secrets and variables → Actions**。
2. 新建必填 Secret `MINIMAX_API_KEY`。
3. 可选添加 `MINIMAX_BASE_URL` 和 `MINIMAX_MODEL`；未添加时分别使用
   `https://api.minimaxi.com/v1` 和 `MiniMax-M3`。
4. 将工作流合并到默认分支后，打开 **Actions → Daily Generate Lessons → Run workflow**，
   先选择 `morning` 手动运行一次并确认成功。

未配置 `MINIMAX_API_KEY` 时，工作流会失败并在日志中明确提示。GitHub 仅在默认分支上自动执行定时工作流。

## 手动触发或本地生成

GitHub 中可打开 **Actions → Daily Generate Lessons → Run workflow**，选择
`morning` 或 `afternoon`。本地也可以运行 Python 流水线：

```bash
pip install -r pipeline/requirements.txt
export MINIMAX_API_KEY="<你的密钥>"
python pipeline/run.py morning
python pipeline/run.py afternoon
```

课程日期按 `Asia/Shanghai`。已有 `ok` 稿会直接跳过，不调用模型，也不会推进课程或 fallback 进度。

## 修改热点来源

编辑仓库根目录的 `pipeline/config/sources.yaml`：

- 修改 `url` 可替换 RSS 来源；
- 设置 `enabled: false` 可临时停用来源；
- `max_age_hours` 控制资讯时效范围；
- `per_source_limit` 控制每个来源最多保留的条数。

提交并推送配置后，下次 `afternoon` 任务即会生效。单个来源抓取失败不会阻断其他来源。

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

## 发布到 GitHub Pages

1. 把本仓库推到 GitHub（公开仓库最简单）。
2. 打开仓库 **Settings → Pages → Build and deployment**，Source 选 **GitHub Actions**。
3. 推送 `master`/`main` 后查看 **Actions** 是否绿色。
4. 用手机打开 `https://<用户名>.github.io/ai-daily/`。
