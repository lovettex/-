import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";

async function generateContentWithRetry(ai: GoogleGenAI, params: any, maxRetries = 4, initialDelay = 1000) {
  let attempt = 0;
  const originalModel = params.model;
  // Recommended fallback models for text and multimodal tasks when gemini-3.5-flash is overloaded
  const fallbackList = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
  
  while (true) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      attempt++;
      console.error(`Gemini API attempt ${attempt} failed with model ${params.model}:`, error);
      
      const errStr = String(error?.message || error || "");
      const isTransient = errStr.includes("503") || errStr.includes("UNAVAILABLE") || errStr.includes("high demand") || errStr.includes("429") || errStr.includes("ResourceExhausted") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("overloaded");
      
      if (attempt >= maxRetries || !isTransient) {
        // Restore the original model name before throwing
        params.model = originalModel;
        throw error;
      }
      
      // If we got a 503 or 429 error and current model is in our fallback list, transition to next model
      if (fallbackList.includes(params.model)) {
        const currentIndex = fallbackList.indexOf(params.model);
        if (currentIndex !== -1 && currentIndex < fallbackList.length - 1) {
          const nextModel = fallbackList[currentIndex + 1];
          console.warn(`Attempt ${attempt} failed on ${params.model}. Falling back to ${nextModel} for the next attempt.`);
          params.model = nextModel;
        }
      }
      
      const delay = initialDelay * Math.pow(2, attempt - 1);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

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

      const response = await generateContentWithRetry(ai, {
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
      const { range, interval } = req.query;
      
      const targetInterval = interval || "1d";
      const targetRange = range ? `&range=${range}` : "";
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${targetInterval}${targetRange}`;
      
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

  // Proxy route for generating stock operation notes with Gemini & Search Grounding
  app.post("/api/generate-operation-note", async (req, res) => {
    try {
      const {
        symbol,
        currentPrice,
        rating,
        qualityScore,
        valueScore,
        crashSimilarity,
        buyRate,
        sellRate,
        volatility,
        strategyData,
      } = req.body;

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

      const currentPriceStr = currentPrice ? `$${currentPrice}` : "未知";

      const prompt = `
        你是一個量化與風控並重的選股模型設計顧問，協助建立可實際交易的選股框架。
        請根據以下的股票資訊、個股評分指標及使用者的交易計畫，給出「執行操作備註」的建議。
        請善用你內建的 Google Search 能力尋找該股票 (${symbol}) 最新的新聞、財報數據或技術分析，
        並結合以下三個面相來擬定內容：
        1. 當前情境分析：結合最新現價 (${currentPriceStr})、市況與「個股評分指標」來評估目前狀況。
        2. 進場操作建議：融合當前計畫（分批進出場規劃、止盈/止損、關鍵價格門檻），給予具體的執行細節。
        3. 綜合考量與注意事項：點出潛在風險（特別是崩盤相似度、波動性等），以及距離目標價的多寡。

        請保持專業簡潔，條理分明。按照上述三大點進行段落劃分，輸出格式為純文字（Markdown 格式）。

        [當前狀態]
        股票代號: ${symbol}
        目前現價: ${currentPriceStr}

        [個股評分指標]
        綜合評分: ${rating || "未評分"} / 10
        企業體質 (Quality): ${qualityScore || "未評分"} / 10
        估值 (Value): ${valueScore || "未評分"} / 10
        崩盤相似度 (Crash Similarity): ${crashSimilarity || "未評分"} / 10
        看多訊號 (Buy Rate): ${buyRate || "未評分"} / 10
        看空訊號 (Sell Rate): ${sellRate || "未評分"} / 10
        波動性: ${volatility || "未知"}
        正向價值 (Pos Value): ${Math.max(0, Number(rating||5) - 5) + Math.max(0, Number(qualityScore||5) - 5) + Math.max(0, Number(valueScore||5) - 5) + Number(buyRate||5)}
        負向價值 (Neg Value): ${Math.max(0, 5 - Number(rating||5)) + Math.max(0, 5 - Number(qualityScore||5)) + Math.max(0, 5 - Number(valueScore||5)) + Number(sellRate||5)}
        
        [交易計畫與策略紀錄]
        分批進場規劃: ${JSON.stringify(strategyData?.entries || [])}
        止盈設定: ${JSON.stringify(strategyData?.tpTargets || [])}
        止損設定: ${JSON.stringify(strategyData?.slTargets || [])}
        止損條件: ${strategyData?.slConditions || "無"}
        上方壓力區: ${JSON.stringify(strategyData?.resistanceZones || [])}
        下方支撐區: ${JSON.stringify(strategyData?.supportZones || [])}
      `;

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      res.json({ text: response.text || "" });
    } catch (error: any) {
      console.error("AI operation note error:", error);
      res.status(500).json({ error: error.message || "取得 AI 操作備註失敗，請稍後再試。" });
    }
  });

  // Proxy route for scanning and extracting strategy details from PDF
  app.post("/api/scan-pdf", async (req, res) => {
    try {
      const { pdfBase64 } = req.body;
      if (!pdfBase64) {
        return res.status(400).json({ error: "請提供 PDF Base64 檔案內容。" });
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

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: pdfBase64,
                  mimeType: "application/pdf",
                },
              },
              {
                text: "Extract the trading strategy details from this PDF. Please match the data into entries (分批進場 - direction should be 'BUY' or 'SELL'), tpTargets (止盈設定), slTargets (止損設定) including slConditions (condition notes, if any), resistanceZones (關鍵心理門檻 壓力區) and supportZones (支撐區). For prices in resistanceZones and supportZones, if it's a range (e.g., 100~200), compute and return the average (150). Also, remove any currency symbols like $.",
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              entries: {
                type: Type.ARRAY,
                description: "List of entry orders (分批進出場規劃)",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, description: "BUY or SELL" },
                    priceStr: {
                      type: Type.STRING,
                      description: "Price or range",
                    },
                    quantityStr: { type: Type.STRING, description: "Quantity" },
                    notes: {
                      type: Type.STRING,
                      description: "Annotations or context",
                    },
                  },
                },
              },
              tpTargets: {
                type: Type.ARRAY,
                description: "List of take profit targets (止盈設定)",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    price: {
                      type: Type.NUMBER,
                      description: "Take profit price",
                    },
                    quantity: {
                      type: Type.NUMBER,
                      description: "Take profit quantity",
                    },
                  },
                },
              },
              slTargets: {
                type: Type.ARRAY,
                description: "List of stop loss targets (止損設定)",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    price: {
                      type: Type.NUMBER,
                      description: "Stop loss price",
                    },
                    percentage: {
                      type: Type.NUMBER,
                      description: "Stop loss percentage",
                    },
                    quantity: {
                      type: Type.NUMBER,
                      description: "Stop loss quantity",
                    },
                  },
                },
              },
              slConditions: {
                type: Type.STRING,
                description: "Stop loss dynamic/conditional description (動態/條件止損說明)",
              },
              resistanceZones: {
                type: Type.ARRAY,
                description: "List of resistance zones (關鍵心理門檻 壓力區)",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    price: {
                      type: Type.NUMBER,
                      description: "Resistance price point. If a range is given, compute the average. Remove $ symbols.",
                    },
                    notes: {
                      type: Type.STRING,
                      description: "Annotations or context",
                    },
                  },
                },
              },
              supportZones: {
                type: Type.ARRAY,
                description: "List of support zones (關鍵心理門檻 支撐區)",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    price: {
                      type: Type.NUMBER,
                      description: "Support price point. If a range is given, compute the average. Remove $ symbols.",
                    },
                    notes: {
                      type: Type.STRING,
                      description: "Annotations or context",
                    },
                  },
                },
              },
            },
          },
        },
      });

      const text = response.text;
      if (!text) throw new Error("No text returned from Gemini");

      const data = JSON.parse(text);
      res.json(data);
    } catch (error: any) {
      console.error("PDF Scan error:", error);
      res.status(500).json({ error: error.message || "掃描 PDF 失敗，請稍後再試。" });
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
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
