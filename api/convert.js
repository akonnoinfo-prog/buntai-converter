const STYLE_PROMPTS = {
  casual: `You are a Japanese writing style converter. Convert the input Japanese text to casual conversational Japanese (口語体). Rules: - Keep ALL information and meaning exactly the same - Use natural spoken Japanese like talking to a close friend - Use sentence endings like 「だよ」「だね」「してるよ」「じゃん」「かな」「だったよ」 - Replace formal words with everyday words - Output ONLY the converted Japanese text, nothing else`,
  polite: `You are a Japanese writing style converter. Convert the input Japanese text to formal polite Japanese (敬語). Rules: - Keep ALL information and meaning exactly the same - Use 「です・ます」form throughout - Use honorific expressions naturally - Output ONLY the converted Japanese text, nothing else`,
  sns: `You are a Japanese writing style converter. Convert the input Japanese text to SNS-style Japanese for X (Twitter) or Instagram. Rules: - Keep ALL information and meaning exactly the same - Break into short lines with line breaks - Add 1-2 relevant emojis at the end - Start with a hook phrase like 「実は」「正直に言うと」「これ知ってた？」 - Output ONLY the converted Japanese text, nothing else`,
  cool: `You are a Japanese writing style converter. Convert the input Japanese text to cool, minimal, dry Japanese (クール体言止め). Rules: - Keep ALL information and meaning exactly the same - Use 体言止め (noun endings) wherever possible - Remove all filler words and unnecessary expressions - Short, sharp, intelligent tone - Output ONLY the converted Japanese text, nothing else`,
  heat: `You are a Japanese writing style converter. Convert the input Japanese text to passionate, high-energy Japanese. Rules: - Keep ALL information and meaning exactly the same - Use lots of 「！」 - Add enthusiastic words like 「最高」「絶対」「本気で」「めちゃくちゃ」 - Make it sound exciting and motivating - Output ONLY the converted Japanese text, nothing else`,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, style } = req.body;

  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "テキストを入力してください" });
  }

  if (!style || !STYLE_PROMPTS[style]) {
    return res.status(400).json({ error: "無効なスタイルです" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "APIキーが設定されていません" });
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "qwen/qwen3-32b",
      messages: [
        { role: "system", content: STYLE_PROMPTS[style] },
        { role: "user", content: text.trim() },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Groq API error:", err);
    return res.status(502).json({ error: "API呼び出しに失敗しました" });
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ?? "";
  const result = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  return res.status(200).json({ result });
}
