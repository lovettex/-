import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import "dotenv/config";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  const AGNES_API_URL = process.env.VITE_AGNES_API_BASE || 'https://apihub.agnes-ai.com';

  async function callAgnesAI(prompt: string, systemPrompt?: string) {
    const apiKey = process.env.AGNES_API_KEY;
    if (!apiKey) throw new Error('AGNES_API_KEY not configured');

    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const response = await fetch(`${AGNES_API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'agnes-2.0-flash', messages, max_tokens: 2000, temperature: 0.7 }),
    });

    if (!response.ok) throw new Error(`Agnes AI API error ${response.status}: ${await response.text()}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // Chip analysis
  app.post("/api/analyze-chips", async (req, res) => {
    try {
      const { imageBase64, symbol } = req.body;
      if (!imageBase64) return res.status(400).json({ error: "請上傳股票走勢圖檔" });

      const prompt = `你是一位精通技術分析與籌碼面的 AI 投資顧問。請分析上傳的 K 線走勢圖。

請回覆以下結構化 JSON：
{
  "stage": { "accumulation": false, "shakeout": false, "markup": false, "consolidation": false, "distribution": false },
  "patternExplanation": "技術型態說明",
  "actionSuggestions": "散戶應對策略",
  "warnings": { "hasWarning": false, "type": "買入警告|賣出警告|無", "details": "分析" },
  "candlestickSupport": { "hasSupport": false, "type": "十字星|超長下影線|無|兩者皆有", "details": "分析" },
  "signalType": "買入|賣出|等待",
  "signalExplanation": "原因解釋"
}

股票代號: ${symbol || '未命名'}`;

      const text = await callAgnesAI(prompt);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'parse failed', raw: text };
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "分析失敗" });
    }
  });

  // Yahoo Finance proxy
  app.get("/api/stock/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const { range, interval } = req.query;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval || "1d"}${range ? `&range=${range}` : ""}`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json' }
      });
      if (!response.ok) return res.status(response.status).json({ error: 'Failed to fetch data' });
      res.json(await response.json());
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Generate operation note with Agnes AI
  app.post("/api/generate-operation-note", async (req, res) => {
    try {
      const { symbol, currentPrice, rating, qualityScore, valueScore, crashSimilarity, buyRate, sellRate, volatility, strategyData } = req.body;
      const currentPriceStr = currentPrice ? `$${currentPrice}` : "未知";

      const systemPrompt = "你是一個量化與風控並重的選股模型設計顧問。請保持專業簡潔，輸出 Markdown 格式。";
      const prompt = `請根據以下股票資訊給出「執行操作備註」建議，分三部分：1.當前情境分析 2.進場操作建議 3.綜合考量與注意事項。

股票代號: ${symbol}
現價: ${currentPriceStr}
綜合評分: ${rating || "未評分"}/10, 品質: ${qualityScore || "未評分"}, 價值: ${valueScore || "未評分"}
崩盤相似度: ${crashSimilarity || "未評分"}, 買氣: ${buyRate || "未評分"}, 賣氣: ${sellRate || "未評分"}
波動性: ${volatility || "未知"}

交易計畫:
分批進場: ${JSON.stringify(strategyData?.entries || [])}
止盈: ${JSON.stringify(strategyData?.tpTargets || [])}
止損: ${JSON.stringify(strategyData?.slTargets || [])}
止損條件: ${strategyData?.slConditions || "無"}
壓力區: ${JSON.stringify(strategyData?.resistanceZones || [])}
支撐區: ${JSON.stringify(strategyData?.supportZones || [])}`;

      const text = await callAgnesAI(prompt, systemPrompt);
      res.json({ text });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "取得操作備註失敗" });
    }
  });

  // Scan PDF
  app.post("/api/scan-pdf", async (req, res) => {
    try {
      const { pdfBase64 } = req.body;
      if (!pdfBase64) return res.status(400).json({ error: "請提供 PDF" });

      const prompt = `Extract trading strategy from PDF. Return JSON:
{ "entries": [{"type":"BUY/SELL","priceStr":"","quantityStr":"","notes":""}], 
  "tpTargets": [{"price":0,"quantity":0}],
  "slTargets": [{"price":0,"percentage":0,"quantity":0}],
  "slConditions": "",
  "resistanceZones": [{"price":0,"notes":""}],
  "supportZones": [{"price":0,"notes":""}] }
For ranges like 100~200, use average. Remove currency symbols.`;

      const text = await callAgnesAI(prompt + "\n\nPDF Base64 available via user.");
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      res.json(JSON.parse(jsonMatch[0]));
    } catch (error: any) {
      res.status(500).json({ error: error.message || "掃描 PDF 失敗" });
    }
  });

  // Vite dev middleware or production static serve
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
}

startServer();
