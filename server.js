import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .env を手動ロード
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const [key, ...rest] = line.split("=");
      if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
    });
}

const STYLE_PROMPTS = {
  casual: `あなたは文体変換の専門家です。
入力された文章を、友達に話しかけるような自然な口語体に変換してください。
【ルール】
- 「です・ます」→「だよ・だね・してる・してた」
- 「〜については」→「〜は」
- 「〜する必要がある」→「〜しないとね」
- 「〜しております」→「〜してるよ」
- 難しい言葉は簡単な言葉に置き換える
- 文末は「〜だよ」「〜だね」「〜じゃん」「〜かな」など自然な口語にする
- 意味は絶対に変えない
- 変換後のテキストのみ出力。説明不要。`,
  polite: `あなたは文体変換の専門家です。
入力された文章を、丁寧で礼儀正しいビジネス文体に変換してください。
【ルール】
- 「です・ます」調を徹底する
- 「〜してる」→「〜しております」
- 「〜だと思う」→「〜かと存じます」
- クッション言葉を適度に使う（「恐れ入りますが」「お手数ですが」など）
- 意味は絶対に変えない
- 変換後のテキストのみ出力。説明不要。`,
  sns: `あなたは文体変換の専門家です。
入力された文章を、XやInstagramでバズりやすいSNS投稿文に変換してください。
【ルール】
- 短い文に区切る（1文20文字以内を目安）
- 改行を多めに使う
- 数字や具体例を使って読みやすくする
- 文末に適切な絵文字を1〜2個つける
- 「正直に言うと」「実は」などの共感フレーズを冒頭に入れる
- 意味は絶対に変えない
- 変換後のテキストのみ出力。説明不要。`,
  cool: `あなたは文体変換の専門家です。
入力された文章を、クールでミニマルな文体に変換してください。
【ルール】
- 余分な言葉をすべて削ぎ落とす
- 体言止めを積極的に使う
- 感情表現・クッション言葉は不要
- 短く、鋭く、知的に
- 「〜する必要がある」→「〜すべき」
- 意味は絶対に変えない
- 変換後のテキストのみ出力。説明不要。`,
  heat: `あなたは文体変換の専門家です。
入力された文章を、熱量が高くエネルギッシュな文体に変換してください。
【ルール】
- 感嘆符「！」を積極的に使う
- 「すごい」「最高」「絶対」「本気で」などの強調語を使う
- テンションが上がるポジティブな言い回しにする
- 「〜する必要がある」→「絶対やるべき！」
- 意味は絶対に変えない
- 変換後のテキストのみ出力。説明不要。`,
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

async function handleConvert(req, res) {
  let body = "";
  for await (const chunk of req) body += chunk;

  let parsed;
  try { parsed = JSON.parse(body); } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Invalid JSON" }));
  }

  const { text, style } = parsed;

  if (!text || !text.trim()) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "テキストを入力してください" }));
  }

  if (!STYLE_PROMPTS[style]) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "無効なスタイルです" }));
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "APIキーが設定されていません" }));
  }

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
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

  if (!groqRes.ok) {
    res.writeHead(502, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "API呼び出しに失敗しました" }));
  }

  const data = await groqRes.json();
  const raw = data.choices?.[0]?.message?.content ?? "";
  const result = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ result }));
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "POST" && req.url === "/api/convert") {
    return handleConvert(req, res);
  }

  // Static files
  let filePath = req.url === "/" ? "/index.html" : req.url;
  filePath = path.join(__dirname, "public", filePath);

  if (!fs.existsSync(filePath)) {
    res.writeHead(404); return res.end("Not found");
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
  fs.createReadStream(filePath).pipe(res);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n✅ ローカルサーバー起動中: http://localhost:${PORT}\n`);
});
