export async function chatJson(system: string, user: string): Promise<unknown> {
  const key = process.env.LLM_API_KEY;
  if (!key) {
    throw new Error("缺少 LLM_API_KEY，无法调用大模型");
  }

  const baseUrl = process.env.LLM_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("缺少 LLM_BASE_URL，无法调用大模型");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
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

  if (!response.ok) {
    throw new Error(`LLM ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM 返回内容为空");
  }

  return JSON.parse(content) as unknown;
}
