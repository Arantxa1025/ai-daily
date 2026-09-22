This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## 生成早间课程

项目使用兼容 OpenAI Chat Completions 的大模型接口。先配置服务端环境变量：

```bash
export LLM_API_KEY="你的 API 密钥"
export LLM_BASE_URL="https://你的接口地址/v1"
export LLM_MODEL="模型名称" # 可选，默认 gpt-4o-mini
```

在项目根目录手动生成当天（Asia/Shanghai）的早间基础课：

```bash
npx tsx scripts/generate.ts morning
```

生成器读取 `content/progress.json` 对应的大纲主题，质量校验失败会重试一次。最终可读稿成功写入后才推进 `nextDay`；已有 `ok` 稿不会被覆盖，也不会推进课程进度。下午热点命令入口已预留，将由后续任务实现。

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
