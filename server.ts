import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 images
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Add the chip analysis route
  app.post("/api/analyze-chips", async (req, res) => {
    try {
      const { imageBase64, symbol } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "請上傳或提供股票走勢圖檔進行分析" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "伺服器未設定 GEMINI_API_KEY，請在設定中添加金鑰。" });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Extract raw base64 data from potential data url
      const matches = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      let mimeType = "image/png";
      let data = imageBase64;
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        data = matches[2];
      }

      const prompt = `
你是一位精通技術分析與籌碼面（主力資金操作路徑）的 AI 投資顧問。
請仔細掃描並分析使用者上傳的 K 線走勢圖（或股票截圖）。

請結合以下主力資金週期與量價行為框架進行分析：
1. 主力資金操作5大階段特徵：
   - 吸籌：週期底部，K線小幅震盪、股價橫盤、成交量萎縮（低位量縮）。籌碼由散戶流向主力。散戶不宜重倉介入，應納入觀察清單。
   - 洗盤：股價刻意打壓、洗盤震盪，甚至跌破關鍵支撐後迅速拉回（假跌破）。初期可能量增（恐慌拋售），末期浮籌乾淨量縮（賣壓枯竭）。散戶要確認支撐位，別被洗出去。
   - 拉升：試升期（溫和量增、小陽線推進），主升段（突破關鍵壓力、均線呈現多頭排列、放量上漲）。散戶應順勢跟上，鎖定趨勢溢價。
   - 整理(換手)：中高位橫向震盪、量能縮小。主力未大規模撤離，是在進行籌碼沉澱（正向訊號）。散戶應保持耐心觀察換手。
   - 出貨：多月高位或股價大幅上漲後高檔震盪。有致命量價背離（量大不漲），或跌破關鍵支撐底線下行。散戶要提高警覺，果斷減倉避險。

2. 移動平均線 (SMA) 決策過濾（5/10/20日短期、50/100/200日長期）：
   - 黃金交叉買入：短期線上穿長期線（長期基準線如 200 SMA 斜率需持平或向上，若長期線下跌則嚴禁買入以免踩假突破）。
   - 死亡交叉賣出：短期線下穿長期線時，若長期基準線仍上升則為強勢回調，嚴禁盲目追空。

3. 水平線支撐/壓力轉換：
   - 壓力被突破轉換為第一道支撐防禦線；支撐位被跌破則轉換為未來反彈的沉重壓力。

4. 微觀K線預警組合：
   - 十字星（多空博奕平局，趨勢衰竭變盤）及超長下影線（代表有強大支撐，代表下方買盤介入）。
   - W底/頭肩底/倒頭肩/三重底具備高勝率 65%-80% 買入條件，M頭/雙頂/菱形頂/倒V型反轉則是歷史上防範暴跌高可靠的 100% 賣出/避險信號。

請針對此走勢圖（個股：${symbol || '未命名'}）進行深入量價位與結構剖析，並回覆結構化 JSON 內容，完全契合 responseSchema 的定義：
- 主力所處的操作階段（選取正在發生的階段，請客觀判斷）
- 詳細的技術型態與籌碼說明，務必詳盡專業
- 具體的散戶應對策略與操作建議
- 是否存在買入/賣出警告、它的類型（只能是 "買入警告"、"賣出警告" 或 "無"）和詳細分析（請對照手冊裡的警告概率，指出 100%, 80%, 65% 等級）
- 微觀K線支持（是否有十字星/超長下影線支撐，類型為 "十字星"、"超長下影線"、"無" 或 "兩者皆有"）
- 是否屬於 買入 / 賣出 / 等待 交易信號型態，以及原因。
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              mimeType,
              data,
            },
          },
          {
            text: prompt,
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              stage: {
                type: Type.OBJECT,
                properties: {
                  accumulation: { type: Type.BOOLEAN, description: "吸籌期：低位量縮、橫盤整理（悄悄買）" },
                  shakeout: { type: Type.BOOLEAN, description: "洗盤期：假跌破、趕散戶、初期量增末期量縮" },
                  markup: { type: Type.BOOLEAN, description: "拉升期：均線多頭、放量上漲、主升段推進" },
                  consolidation: { type: Type.BOOLEAN, description: "整理期(換手)：高位換手、籌碼沈澱" },
                  distribution: { type: Type.BOOLEAN, description: "出貨期：高檔震盪、量價背離、破底下跌" }
                },
                required: ["accumulation", "shakeout", "markup", "consolidation", "distribution"]
              },
              patternExplanation: { type: Type.STRING, description: "技術型態說明。分析經典型態（如W底/M頭/旗形等）、支撐壓力轉換與移動平均線" },
              actionSuggestions: { type: Type.STRING, description: "散戶應對策略與操作建議。必須明確、具體且簡潔明瞭" },
              warnings: {
                type: Type.OBJECT,
                properties: {
                  hasWarning: { type: Type.BOOLEAN, description: "是否存在買入或賣出警告" },
                  type: { type: Type.STRING, description: "必須是以下之一：'買入警告', '賣出警告', '無'" },
                  details: { type: Type.STRING, description: "警告的存在性與概率詳細分析" }
                },
                required: ["hasWarning", "type", "details"]
              },
              candlestickSupport: {
                type: Type.OBJECT,
                properties: {
                  hasSupport: { type: Type.BOOLEAN, description: "是否有十字星或超長下影線支撐" },
                  type: { type: Type.STRING, description: "必須是以下之一：'十字星', '超長下影線', '無', '兩者皆有'" },
                  details: { type: Type.STRING, description: "微觀 K 線支撐詳細分析" }
                },
                required: ["hasSupport", "type", "details"]
              },
              signalType: { type: Type.STRING, description: "必須是以下之一：'買入', '賣出', '等待'" },
              signalExplanation: { type: Type.STRING, description: "屬於買入、賣出或等待等技術型態的原因解釋" }
            },
            required: [
              "stage",
              "patternExplanation",
              "actionSuggestions",
              "warnings",
              "candlestickSupport",
              "signalType",
              "signalExplanation"
            ]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        return res.status(500).json({ error: "Gemini 晶片分析回傳空白內容" });
      }

      const result = JSON.parse(responseText.trim());
      res.json(result);
    } catch (error: any) {
      console.error("Chip analysis error:", error);
      res.status(500).json({ error: error.message || "主力與籌碼分析失敗，請稍後再試。" });
    }
  });

  // Add a proxy route for Yahoo Finance
  app.get("/api/stock/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
         return res.status(response.status).json({ error: 'Failed to fetch data' });
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // For Express 4
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
