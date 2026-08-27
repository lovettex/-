import { StockTab, ChartAnnotation } from "../types";
import { PositionMap, HOLDING_CONFIG } from "../components/DynamicVisualLinesModal";
import { db } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

/**
 * 分類分隔線顏色
 * 支援紅/黑/藍/綠/黃 等色系
 */
export function classifyLineColor(
  colorStr?: string
): "red" | "black" | "blue" | "green" | "yellow" | "other" {
  if (!colorStr) return "other";
  const c = colorStr.toLowerCase().trim();

  // 紅色系 (Stop Loss / Resistance)
  if (
    c === "#ef4444" ||
    c === "#dc2626" ||
    c === "#f87171" ||
    c === "#e11d48" ||
    c === "#f43f5e" ||
    c === "#ff0000" ||
    c === "#e53e3e" ||
    c === "#b91c1c" ||
    c === "#991b1b" ||
    c.includes("239, 68, 68") ||
    c.includes("248, 113, 113") ||
    c.includes("220, 38, 38") ||
    c === "red"
  ) {
    return "red";
  }

  // 黑色系 (Base / Benchmark / Balance)
  if (
    c === "#000000" ||
    c === "#000" ||
    c === "#18181b" ||
    c === "#27272a" ||
    c === "#1e293b" ||
    c === "#333333" ||
    c === "#0f172a" ||
    c === "#09090b" ||
    c === "#3f3f46" ||
    c === "#52525b" ||
    c.includes("0, 0, 0") ||
    c === "black"
  ) {
    return "black";
  }

  // 藍色系 (Support / Add Position)
  if (
    c === "#2563eb" ||
    c === "#3b82f6" ||
    c === "#1d4ed8" ||
    c === "#60a5fa" ||
    c === "#0284c7" ||
    c === "#0ea5e9" ||
    c === "#38bdf8" ||
    c === "#1e40af" ||
    c.includes("37, 99, 235") ||
    c.includes("59, 130, 246") ||
    c.includes("96, 165, 250") ||
    c === "blue"
  ) {
    return "blue";
  }

  // 綠色系 (Floor / Buy)
  if (
    c === "#16a34a" ||
    c === "#10b981" ||
    c === "#059669" ||
    c === "#22c55e" ||
    c === "#15803d" ||
    c === "#4ade80" ||
    c === "#047857" ||
    c === "#065f46" ||
    c.includes("22, 163, 74") ||
    c.includes("16, 185, 129") ||
    c === "green"
  ) {
    return "green";
  }

  // 黃色/金色系 (Take profit / Deep value)
  if (
    c === "#eab308" ||
    c === "#facc15" ||
    c === "#ca8a04" ||
    c === "#d97706" ||
    c === "#f59e0b" ||
    c === "#fbbf24" ||
    c.includes("234, 179, 8") ||
    c.includes("250, 204, 21") ||
    c === "yellow"
  ) {
    return "yellow";
  }

  // RGB / RGBA 解析
  if (c.startsWith("rgb")) {
    const match = c.match(/\d+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0], 10);
      const g = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      if (r < 55 && g < 55 && b < 55) return "black";
      if (r > 175 && g < 105 && b < 105) return "red";
      if (b > 150 && r < 120) return "blue";
      if (g > 130 && r < 120 && b < 150) return "green";
      if (r > 170 && g > 140 && b < 100) return "yellow";
    }
  }

  // Hex 解析色相判斷
  if (c.startsWith("#") && (c.length === 7 || c.length === 4)) {
    let hex = c.replace("#", "");
    if (hex.length === 3) hex = hex.split("").map((x) => x + x).join("");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    if (r < 55 && g < 55 && b < 55) return "black";
    if (r > 175 && g < 105 && b < 105) return "red";
    if (b > 150 && r < 120) return "blue";
    if (g > 130 && r < 120 && b < 150) return "green";
    if (r > 170 && g > 140 && b < 100) return "yellow";
  }

  return "other";
}

/**
 * 檢查個股卡片是否符合匯入條件：
 * 必須至少有「黑色與藍色」或「黑色與紅色」等分隔線
 */
export interface CardDividerAnalysis {
  isEligible: boolean;
  blackLines: ChartAnnotation[];
  blueLines: ChartAnnotation[];
  redLines: ChartAnnotation[];
  greenLines: ChartAnnotation[];
  yellowLines: ChartAnnotation[];
  allDividers: { ann: ChartAnnotation; colorType: string; y: number }[];
}

export function analyzeCardDividers(tab: StockTab): CardDividerAnalysis {
  const annotations = tab.chartAnnotations || [];
  const dividerList: { ann: ChartAnnotation; colorType: string; y: number }[] = [];

  for (const ann of annotations) {
    const isDivider =
      ann.type === "divider" ||
      (ann.type === "line" &&
        Math.abs((ann.y2 ?? ann.y1 ?? 0) - (ann.y1 ?? 0)) < 6 &&
        Math.abs((ann.x2 ?? 100) - (ann.x1 ?? 0)) >= 15);

    if (isDivider) {
      const colorType = classifyLineColor(ann.color);
      const y = ann.y !== undefined 
        ? ann.y 
        : (ann.y1 !== undefined && ann.y2 !== undefined ? (ann.y1 + ann.y2) / 2 : (ann.y1 ?? 0));
      dividerList.push({ ann, colorType, y });
    }
  }

  const blackLines = dividerList.filter((d) => d.colorType === "black").map((d) => d.ann);
  const blueLines = dividerList.filter((d) => d.colorType === "blue").map((d) => d.ann);
  const redLines = dividerList.filter((d) => d.colorType === "red").map((d) => d.ann);
  const greenLines = dividerList.filter((d) => d.colorType === "green").map((d) => d.ann);
  const yellowLines = dividerList.filter((d) => d.colorType === "yellow").map((d) => d.ann);

  // 納入匯入範圍的規則：只要卡片上有繪製任何水平分隔線即具備同步資格
  const isEligible = dividerList.length > 0;

  return {
    isEligible,
    blackLines,
    blueLines,
    redLines,
    greenLines,
    yellowLines,
    allDividers: dividerList,
  };
}

/**
 * 計算現價與分隔線在卡片上的相對位置，並投射至動態視覺線畫布 Y 軸座標 (0-100%)
 * 畫布標準 6 條視覺基準線高度：
 * 頂黃 12% (頂部獲利), 紅 28% (停損警戒), 黑 44% (基準中軸), 藍 60% (回檔加碼), 綠 76% (底部買進), 底黃 90% (深幅價值)
 */
export function calculateCanvasYFromDividers(
  tab: StockTab,
  strategy?: any,
  averageCost?: number
): number | null {
  const analysis = analyzeCardDividers(tab);
  if (!analysis.isEligible) return null;

  // 1. 完整收集現價與所有目標價格，以完全還原 StockCardVisualizer 的 SVG Y 軸映射尺度
  const allPrices: number[] = [];
  const tabAny = tab as any;
  const dynPrice =
    tab.currentPrice && tab.currentPrice > 0
      ? tab.currentPrice
      : tabAny.price && tabAny.price > 0
      ? tabAny.price
      : 0;

  if (dynPrice > 0) allPrices.push(dynPrice);

  const cost =
    averageCost && averageCost > 0
      ? averageCost
      : tabAny.averageCost && tabAny.averageCost > 0
      ? tabAny.averageCost
      : tabAny.buyPrice && tabAny.buyPrice > 0
      ? tabAny.buyPrice
      : 0;
  if (cost > 0) allPrices.push(cost);

  // 匯總所有可能影響卡片高度尺度的規劃價格
  if (Array.isArray(tabAny.plannedOrders)) {
    tabAny.plannedOrders.forEach((o: any) => {
      const p = typeof o.price === "number" ? o.price : parseFloat(o.price || o.priceStr);
      if (!isNaN(p) && p > 0) allPrices.push(p);
    });
  }

  if (strategy) {
    if (Array.isArray(strategy.tpTargets)) {
      strategy.tpTargets.forEach((tp: any) => {
        const p = typeof tp.price === "number" ? tp.price : parseFloat(tp.price);
        if (!isNaN(p) && p > 0) allPrices.push(p);
      });
    }
    if (Array.isArray(strategy.slTargets)) {
      strategy.slTargets.forEach((sl: any) => {
        const p = typeof sl.price === "number" ? sl.price : parseFloat(sl.price);
        if (!isNaN(p) && p > 0) allPrices.push(p);
      });
    }
    if (Array.isArray(strategy.entries)) {
      strategy.entries.forEach((en: any) => {
        const p = typeof en.priceStr === "number" ? en.priceStr : parseFloat(en.priceStr);
        if (!isNaN(p) && p > 0) allPrices.push(p);
      });
    }
    if (Array.isArray(strategy.resistanceZones)) {
      strategy.resistanceZones.forEach((rz: any) => {
        const p = typeof rz.price === "number" ? rz.price : parseFloat(rz.price);
        if (!isNaN(p) && p > 0) allPrices.push(p);
      });
    }
    if (Array.isArray(strategy.supportZones)) {
      strategy.supportZones.forEach((sz: any) => {
        const p = typeof sz.price === "number" ? sz.price : parseFloat(sz.price);
        if (!isNaN(p) && p > 0) allPrices.push(p);
      });
    }
  }

  if (tab.stopLossPrice && tab.stopLossPrice > 0) allPrices.push(tab.stopLossPrice);
  if (tab.takeProfitPrice && tab.takeProfitPrice > 0) allPrices.push(tab.takeProfitPrice);

  if (Array.isArray(tab.averagingRows)) {
    tab.averagingRows.forEach((r) => {
      const p = parseFloat(r.price);
      if (!isNaN(p) && p > 0) allPrices.push(p);
    });
  }
  if (Array.isArray(tab.averagingRowsSys2)) {
    tab.averagingRowsSys2.forEach((r) => {
      const p = parseFloat(r.price);
      if (!isNaN(p) && p > 0) allPrices.push(p);
    });
  }

  // 1.1 精確計算現價在卡片上的 SVG 百分比高度 (0: 頂部最高價, 100: 底部最低價)
  let cpCardY: number = 50;
  if (allPrices.length > 0) {
    let maxP = Math.max(...allPrices);
    let minP = Math.min(...allPrices);
    if (maxP === minP) {
      maxP *= 1.1;
      minP *= 0.9;
    } else {
      const padding = (maxP - minP) * 0.15;
      maxP += padding;
      minP -= padding;
    }
    const currentP = dynPrice > 0 ? dynPrice : (minP + maxP) / 2;
    const pct = ((currentP - minP) / (maxP - minP)) * 78;
    cpCardY = 96 - pct;
  }

  // 2. 取得卡片上各色系分隔線的實際繪製位置
  const blackDividers = analysis.allDividers.filter((d) => d.colorType === "black").map((d) => d.y);
  const blueDividers = analysis.allDividers.filter((d) => d.colorType === "blue").map((d) => d.y);
  const redDividers = analysis.allDividers.filter((d) => d.colorType === "red").map((d) => d.y);
  const greenDividers = analysis.allDividers.filter((d) => d.colorType === "green").map((d) => d.y);
  const yellowDividers = analysis.allDividers.filter((d) => d.colorType === "yellow").map((d) => d.y);

  // 基準中軸 (黑色線)：優先選取最接近卡片中央 (Y=50) 的黑色線
  let cardBlackY = blackDividers.length > 0
    ? blackDividers.reduce((prev, curr) => (Math.abs(curr - 50) < Math.abs(prev - 50) ? curr : prev))
    : undefined;

  // 紅色線 (阻力/警戒)：取黑色線上方最靠近黑色線的紅色線 (y 最大者)
  const redAboveBlack = cardBlackY !== undefined ? redDividers.filter((y) => y < cardBlackY) : redDividers;
  let cardRedY = redAboveBlack.length > 0
    ? Math.max(...redAboveBlack)
    : (redDividers.length > 0 ? Math.min(...redDividers) : undefined);

  // 藍色線 (支撐/加碼)：取黑色線下方最靠近黑色線的藍色線 (y 最小者)
  const blueBelowBlack = cardBlackY !== undefined ? blueDividers.filter((y) => y > cardBlackY) : blueDividers;
  let cardBlueY = blueBelowBlack.length > 0
    ? Math.min(...blueBelowBlack)
    : (blueDividers.length > 0 ? Math.max(...blueDividers) : undefined);

  // 綠色線 (底部/強買)：取藍色線下方最靠近藍色線的綠色線
  const greenRefY = cardBlueY ?? cardBlackY ?? 50;
  const greenBelowBlue = greenDividers.filter((y) => y > greenRefY);
  let cardGreenY = greenBelowBlue.length > 0
    ? Math.min(...greenBelowBlue)
    : (greenDividers.length > 0 ? Math.max(...greenDividers) : undefined);

  // 頂部黃色線 (頂部獲利)：取紅色/黑色線上方者
  const redRefY = cardRedY ?? cardBlackY ?? 50;
  const yellowAboveRed = yellowDividers.filter((y) => y < redRefY);
  let cardYellowTopY = yellowAboveRed.length > 0
    ? Math.max(...yellowAboveRed)
    : (yellowDividers.length > 0 && yellowDividers.some((y) => y < 45) ? Math.min(...yellowDividers.filter((y) => y < 45)) : undefined);

  // 底部黃色線 (深幅價值)：取綠色/藍色/黑色線下方者
  const bottomRefY = cardGreenY ?? cardBlueY ?? cardBlackY ?? 50;
  const yellowBelowBottom = yellowDividers.filter((y) => y > bottomRefY);
  let cardYellowBottomY = yellowBelowBottom.length > 0
    ? Math.min(...yellowBelowBottom)
    : (yellowDividers.length > 0 && yellowDividers.some((y) => y > 55) ? Math.max(...yellowDividers.filter((y) => y > 55)) : undefined);

  // 3. 智慧計算相鄰基準線的卡片物理間隔尺度 (delta)
  let delta = 16;
  if (cardBlackY !== undefined && cardRedY !== undefined && cardBlackY > cardRedY) {
    delta = Math.max(3, cardBlackY - cardRedY);
  } else if (cardBlueY !== undefined && cardBlackY !== undefined && cardBlueY > cardBlackY) {
    delta = Math.max(3, cardBlueY - cardBlackY);
  } else if (cardBlueY !== undefined && cardRedY !== undefined && cardBlueY > cardRedY) {
    delta = Math.max(3, (cardBlueY - cardRedY) / 2);
  } else if (cardGreenY !== undefined && cardBlueY !== undefined && cardGreenY > cardBlueY) {
    delta = Math.max(3, cardGreenY - cardBlueY);
  } else if (cardGreenY !== undefined && cardBlackY !== undefined && cardGreenY > cardBlackY) {
    delta = Math.max(3, (cardGreenY - cardBlackY) / 2);
  }

  // 4. 若有未繪製的分隔線，根據已知線段等比例補齊虛擬基準錨點
  if (cardBlackY === undefined) {
    if (cardRedY !== undefined && cardBlueY !== undefined) {
      cardBlackY = (cardRedY + cardBlueY) / 2;
    } else if (cardRedY !== undefined && cardGreenY !== undefined) {
      cardBlackY = (cardRedY + cardGreenY) / 2;
    } else if (cardRedY !== undefined) {
      cardBlackY = cardRedY + delta;
    } else if (cardBlueY !== undefined) {
      cardBlackY = cardBlueY - delta;
    } else if (cardGreenY !== undefined) {
      cardBlackY = cardGreenY - 2 * delta;
    } else if (cardYellowTopY !== undefined) {
      cardBlackY = cardYellowTopY + 2 * delta;
    } else if (cardYellowBottomY !== undefined) {
      cardBlackY = cardYellowBottomY - 3 * delta;
    } else {
      cardBlackY = 50;
    }
  }

  if (cardRedY === undefined) cardRedY = cardBlackY - delta;
  if (cardBlueY === undefined) cardBlueY = cardBlackY + delta;
  if (cardGreenY === undefined) cardGreenY = cardBlueY + delta;
  if (cardYellowTopY === undefined) cardYellowTopY = cardRedY - delta;
  if (cardYellowBottomY === undefined) cardYellowBottomY = cardGreenY + delta * (14 / 16);

  // 5. 幾何約束保證嚴格單調遞增 (頂黃 < 紅 < 黑 < 藍 < 綠 < 底黃)
  cardYellowTopY = Math.min(cardRedY - 2, cardYellowTopY);
  cardRedY = Math.max(cardYellowTopY + 2, Math.min(cardBlackY - 2, cardRedY));
  cardBlueY = Math.max(cardBlackY + 2, Math.min(cardGreenY - 2, cardBlueY));
  cardGreenY = Math.max(cardBlueY + 2, Math.min(cardYellowBottomY - 2, cardGreenY));
  cardYellowBottomY = Math.max(cardGreenY + 2, cardYellowBottomY);

  // 6. 建立 6 個嚴格對齊動態視覺線畫布的控制錨點
  const anchors = [
    { cardY: cardYellowTopY, canvasY: 12 },    // 頂部獲利
    { cardY: cardRedY, canvasY: 28 },          // 停損警戒
    { cardY: cardBlackY, canvasY: 44 },        // 基準中軸
    { cardY: cardBlueY, canvasY: 60 },         // 回檔加碼
    { cardY: cardGreenY, canvasY: 76 },        // 底部買進
    { cardY: cardYellowBottomY, canvasY: 90 }, // 深幅價值
  ];

  // 7. 高精度分段線性插值 (Piecewise Linear Interpolation)
  let canvasY: number;

  if (cpCardY <= anchors[0].cardY) {
    // 現價高於頂部黃色線 (往頂部超買區延伸)
    const cardSpan = Math.max(1, anchors[1].cardY - anchors[0].cardY);
    const canvasSpan = anchors[1].canvasY - anchors[0].canvasY; // 16%
    const dist = anchors[0].cardY - cpCardY;
    canvasY = anchors[0].canvasY - (dist / cardSpan) * canvasSpan;
  } else if (cpCardY >= anchors[anchors.length - 1].cardY) {
    // 現價低於底部黃色線 (往底部超賣區延伸)
    const lastIdx = anchors.length - 1;
    const cardSpan = Math.max(1, anchors[lastIdx].cardY - anchors[lastIdx - 1].cardY);
    const canvasSpan = anchors[lastIdx].canvasY - anchors[lastIdx - 1].canvasY; // 14%
    const dist = cpCardY - anchors[lastIdx].cardY;
    canvasY = anchors[lastIdx].canvasY + (dist / cardSpan) * canvasSpan;
  } else {
    // 現價落在兩相鄰分隔線之間，計算精準比例 t ∈ [0, 1]
    let found = false;
    canvasY = 44;
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      if (cpCardY >= a.cardY && cpCardY <= b.cardY) {
        const cardInterval = Math.max(0.0001, b.cardY - a.cardY);
        const t = (cpCardY - a.cardY) / cardInterval;
        canvasY = a.canvasY + t * (b.canvasY - a.canvasY);
        found = true;
        break;
      }
    }
    if (!found) {
      canvasY = 44;
    }
  }

  // 8. 靠近分隔線吸附精度：若極度靠近某分隔線 (小於 0.3% 畫布高度誤差)，精確吸附對齊該分隔線
  for (const anchor of anchors) {
    if (Math.abs(canvasY - anchor.canvasY) <= 0.3) {
      canvasY = anchor.canvasY;
      break;
    }
  }

  // 9. 安全邊界限制與精度四捨五入 (保留 6% ~ 94% 可視範圍，精確保留小數點一位)
  const clampedY = Math.max(6, Math.min(94, Math.round(canvasY * 10) / 10));
  return clampedY;
}

/**
 * 格式化標籤更新時間戳記 (例如：08/22 09:22)
 */
export function formatTagDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${m}/${day} ${h}:${min}`;
  } catch (e) {
    return "";
  }
}

/**
 * 一鍵將給定子分頁內所有符合分隔線條件的卡片現價相對位置，同步儲存至動態視覺線畫布
 */
export async function syncSubTabDividersToCanvas(
  subTabTabs: StockTab[],
  userId?: string,
  strategiesMap?: Record<string, any>,
  statsMap?: Record<string, { averagePrice?: number; totalQuantity?: number }>
): Promise<{
  success: boolean;
  updatedCount: number;
  skippedCount: number;
  updatedSymbols: string[];
  allPositions: PositionMap;
}> {
  const storageKey = `visual_lines_board_positions_${userId || "guest"}`;
  let currentPositions: PositionMap = {};

  // 1. 讀取現有位置資料
  if (userId) {
    try {
      const docRef = doc(db, "users", userId, "visualLinesBoard", "positions");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const remotePos = docSnap.data()?.positions as PositionMap;
        if (remotePos && typeof remotePos === "object") {
          currentPositions = { ...remotePos };
        }
      }
    } catch (e) {
      console.warn("Failed to load firestore positions:", e);
    }
  }

  if (Object.keys(currentPositions).length === 0) {
    try {
      const localData = localStorage.getItem(storageKey);
      if (localData) {
        currentPositions = JSON.parse(localData);
      }
    } catch (e) {}
  }

  const updatedSymbols: string[] = [];
  const newPositions: PositionMap = { ...currentPositions };
  let updatedCount = 0;
  let skippedCount = 0;

  const nowIso = new Date().toISOString();

  // 2. 遍歷該子分頁所有卡片
  subTabTabs.forEach((tab, index) => {
    const sym = (tab.symbol || "").trim().toUpperCase();
    if (!sym) return;

    const strat = strategiesMap?.[tab.id];
    const stat = statsMap?.[tab.id];
    const avgCost = stat?.totalQuantity !== 0 ? stat?.averagePrice : undefined;

    const canvasY = calculateCanvasYFromDividers(tab, strat, avgCost);
    if (canvasY === null) {
      skippedCount++;
      return;
    }

    // 若原本已有 X 座標則保留，否則均勻分配
    const existingX = newPositions[sym]?.x;
    const defaultX = 20 + ((index % 6) * 12);
    const finalX = existingX !== undefined ? existingX : defaultX;

    newPositions[sym] = {
      ...newPositions[sym],
      x: finalX,
      y: canvasY,
      shape: "circle",
      sizeOffset: newPositions[sym]?.sizeOffset ?? 0,
      color: newPositions[sym]?.color || undefined,
      hidden: Boolean(newPositions[sym]?.hidden),
      dcaProgress: newPositions[sym]?.dcaProgress || undefined,
      updatedAt: nowIso,
    };

    updatedSymbols.push(sym);
    updatedCount++;
  });

  if (updatedCount > 0) {
    // 3. 儲存至 LocalStorage
    try {
      localStorage.setItem(storageKey, JSON.stringify(newPositions));
    } catch (e) {}

    // 4. 儲存至 Firestore
    if (userId) {
      try {
        const docRef = doc(db, "users", userId, "visualLinesBoard", "positions");
        await setDoc(
          docRef,
          {
            positions: newPositions,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      } catch (err) {
        console.warn("Failed to save synced positions to firestore:", err);
      }
    }

    // 5. 觸發即時事件通知各組件更新
    window.dispatchEvent(
      new CustomEvent("visual_lines_positions_updated", {
        detail: {
          allPositions: newPositions,
        },
      })
    );
  }

  return {
    success: updatedCount > 0,
    updatedCount,
    skippedCount,
    updatedSymbols,
    allPositions: newPositions,
  };
}
