import { StockTab, ChartAnnotation } from "../types";
import { PositionMap, HOLDING_CONFIG } from "../components/DynamicVisualLinesModal";
import { db } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

/**
 * 分類分隔線顏色
 * 支援紅/黑/藍/綠/黃/白 等全色系 (HSL / RGB / HEX 智慧色相分類)
 */
export function classifyLineColor(
  colorStr?: string
): "red" | "black" | "blue" | "green" | "yellow" | "other" {
  if (!colorStr) return "other";
  const c = colorStr.toLowerCase().trim();

  // 1. 常見直接精確 Hex 比對
  // 紅色/粉紅系 (Stop Loss / Resistance / 停損警戒)
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
    c === "#ec4899" || // 玫瑰粉
    c === "red"
  ) {
    return "red";
  }

  // 綠色/薄荷綠系 (Floor / Buy / 底部買進 / 止盈綠 / 薄荷綠)
  if (
    c === "#16a34a" ||
    c === "#10b981" || // 止盈綠
    c === "#14b8a6" || // 薄荷綠
    c === "#059669" ||
    c === "#22c55e" ||
    c === "#15803d" ||
    c === "#4ade80" ||
    c === "#84cc16" ||
    c === "#047857" ||
    c === "#065f46" ||
    c === "green"
  ) {
    return "green";
  }

  // 藍色/青色/靛青系 (Support / Add Position / 回檔加碼 / 天空青 / 系統藍 / 靛青藍 / 神秘紫)
  if (
    c === "#2563eb" ||
    c === "#3b82f6" || // 系統藍
    c === "#06b6d4" || // 天空青
    c === "#6366f1" || // 靛青藍
    c === "#a855f7" || // 神秘紫
    c === "#1d4ed8" ||
    c === "#60a5fa" ||
    c === "#0284c7" ||
    c === "#0ea5e9" ||
    c === "#38bdf8" ||
    c === "#1e40af" ||
    c === "blue" ||
    c === "cyan"
  ) {
    return "blue";
  }

  // 黃色/金色/橘色系 (Take profit / Deep value / 頂部獲利 / 深幅價值 / 關鍵黃 / 強勢橘)
  if (
    c === "#eab308" || // 關鍵黃
    c === "#f97316" || // 強勢橘
    c === "#facc15" ||
    c === "#ca8a04" ||
    c === "#d97706" ||
    c === "#f59e0b" ||
    c === "#fbbf24" ||
    c === "yellow" ||
    c === "orange"
  ) {
    return "yellow";
  }

  // 黑色/深灰/純白/中性系 (Base / Benchmark / Balance / 基準中軸 / 經典黑 / 質感灰 / 純白)
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
    c === "#64748b" || // 質感灰
    c === "#ffffff" ||
    c === "#fff" ||
    c === "black" ||
    c === "white" ||
    c === "gray"
  ) {
    return "black";
  }

  // 2. 解析 RGB / RGBA 或 HEX 進行精確 HSL 色相分析
  let r = 0, g = 0, b = 0;
  if (c.startsWith("rgb")) {
    const match = c.match(/\d+/g);
    if (match && match.length >= 3) {
      r = parseInt(match[0], 10);
      g = parseInt(match[1], 10);
      b = parseInt(match[2], 10);
    }
  } else if (c.startsWith("#")) {
    let hex = c.replace("#", "");
    if (hex.length === 3) hex = hex.split("").map((x) => x + x).join("");
    if (hex.length >= 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
  }

  // RGB 轉 HSL
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const l = (max + min) / 2;

  // 極黑、極白或無飽和度之灰色一律歸為黑色系 (中軸基準)
  if (l <= 0.18 || l >= 0.95 || d < 0.12) {
    return "black";
  }

  let h = 0;
  if (max === rn) {
    h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  } else if (max === gn) {
    h = ((bn - rn) / d + 2) * 60;
  } else {
    h = ((rn - gn) / d + 4) * 60;
  }

  // 依色相區間判定：
  // 345° ~ 20°: 紅色 / 粉紅
  if (h >= 345 || h <= 20) return "red";
  // 20° ~ 68°: 黃色 / 橙色
  if (h > 20 && h <= 68) return "yellow";
  // 68° ~ 175°: 綠色 (包含薄荷綠、草綠、墨綠、青翠綠)
  if (h > 68 && h <= 175) return "green";
  // 175° ~ 285°: 藍色 / 天空青 / 靛青 / 紫色
  if (h > 175 && h <= 285) return "blue";
  // 285° ~ 345°: 洋紅 / 玫瑰紅
  if (h > 285 && h < 345) return "red";

  return "other";
}

/**
 * 視覺圖示化分隔線軸定義：
 * 黑色: D軸 (D) - 基準中軸 (44%)
 * 藍色: B軸 (B) - 回檔加碼 (60%)
 * 綠色: G軸 (G) - 底部買進 (76%)
 * 黃色: Y軸 (Y) - 頂部獲利 (12%) / 深幅價值 (90%)
 * 紅色: R軸 (R) - 停損警戒 (28%)
 */
export type AxisLetter = "D" | "B" | "G" | "Y" | "R";

export function getAxisLetterForColor(colorStr?: string): AxisLetter | "" {
  const c = classifyLineColor(colorStr);
  switch (c) {
    case "black":
      return "D";
    case "blue":
      return "B";
    case "green":
      return "G";
    case "yellow":
      return "Y";
    case "red":
      return "R";
    default:
      return "";
  }
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
        Math.abs((ann.y2 ?? ann.y1 ?? 0) - (ann.y1 ?? 0)) < 8 &&
        Math.abs((ann.x2 ?? 100) - (ann.x1 ?? 0)) >= 10);

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

  const hasPrice = Boolean((tab.currentPrice && tab.currentPrice > 0) || ((tab as any).price && (tab as any).price > 0));
  const isEligible = dividerList.length > 0 || hasPrice;

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
 * 精確還原 StockCardVisualizer 內「現價標籤」在卡片畫布上的 SVG Y 軸百分比 (7% ~ 93%)
 */
export function calculateCardPriceY(
  tab: StockTab,
  strategy?: any,
  averageCost?: number,
  holdingQuantity?: number
): number {
  const tabAny = tab as any;
  const dynPrice =
    tab.currentPrice && tab.currentPrice > 0
      ? tab.currentPrice
      : tabAny.price && tabAny.price > 0
      ? tabAny.price
      : 0;

  const validOrders: { price: number; category?: string }[] = [];

  // 1. 策略目標價 (TP/SL/壓力/支撐/分批進出場)
  const strat = strategy || tabAny.strategy;
  if (strat) {
    if (Array.isArray(strat.tpTargets)) {
      strat.tpTargets.forEach((tp: any) => {
        const p = typeof tp.price === "number" ? tp.price : parseFloat(tp.price);
        if (!isNaN(p) && p > 0) validOrders.push({ price: p, category: "止盈設定" });
      });
    }
    if (Array.isArray(strat.slTargets)) {
      strat.slTargets.forEach((sl: any) => {
        const p = typeof sl.price === "number" ? sl.price : parseFloat(sl.price);
        if (!isNaN(p) && p > 0) validOrders.push({ price: p, category: "止損設定" });
      });
    }
    if (Array.isArray(strat.resistanceZones)) {
      strat.resistanceZones.forEach((rz: any) => {
        const p = typeof rz.price === "number" ? rz.price : parseFloat(rz.price);
        if (!isNaN(p) && p > 0) validOrders.push({ price: p, category: "壓力門檻" });
      });
    }
    if (Array.isArray(strat.supportZones)) {
      strat.supportZones.forEach((sz: any) => {
        const p = typeof sz.price === "number" ? sz.price : parseFloat(sz.price);
        if (!isNaN(p) && p > 0) validOrders.push({ price: p, category: "支撐門檻" });
      });
    }
    if (Array.isArray(strat.entries)) {
      strat.entries.forEach((entry: any) => {
        const p = typeof entry.price === "number" ? entry.price : parseFloat(entry.priceStr || entry.price);
        if (!isNaN(p) && p > 0) validOrders.push({ price: p, category: "分批進出場規劃" });
      });
    }
  }

  // 2. 規劃訂單
  if (Array.isArray(tabAny.plannedOrders)) {
    tabAny.plannedOrders.forEach((o: any) => {
      const p = typeof o.price === "number" ? o.price : parseFloat(o.price || o.priceStr);
      if (!isNaN(p) && p > 0) validOrders.push({ price: p, category: o.category || "分批進出場規劃" });
    });
  }

  if (tab.stopLossPrice && tab.stopLossPrice > 0) {
    validOrders.push({ price: tab.stopLossPrice, category: "止損設定" });
  }
  if (tab.takeProfitPrice && tab.takeProfitPrice > 0) {
    validOrders.push({ price: tab.takeProfitPrice, category: "止盈設定" });
  }

  // 3. 系統二向下攤平 (組別 1~4)
  const avgSys2Prices: number[] = [];
  const hasHoldings =
    (holdingQuantity !== undefined ? holdingQuantity > 0 : false) ||
    (averageCost !== undefined && averageCost > 0) ||
    (tabAny.holdingQuantity !== undefined && tabAny.holdingQuantity > 0);

  if (hasHoldings && tab.averagingRowsSys2 && tab.averagingRowsSys2.length > 0) {
    tab.averagingRowsSys2.slice(0, 4).forEach((row) => {
      const parsed = parseFloat(row.price);
      if (!isNaN(parsed) && parsed > 0) {
        avgSys2Prices.push(parsed);
      }
    });
  }

  if (tab.averagingRows && tab.averagingRows.length > 0) {
    tab.averagingRows.forEach((row) => {
      const parsed = parseFloat(row.price);
      if (!isNaN(parsed) && parsed > 0) {
        validOrders.push({ price: parsed, category: "分批進出場規劃" });
      }
    });
  }

  const cost =
    averageCost && averageCost > 0
      ? averageCost
      : tabAny.averageCost && tabAny.averageCost > 0
      ? tabAny.averageCost
      : tabAny.buyPrice && tabAny.buyPrice > 0
      ? tabAny.buyPrice
      : 0;

  const allPrices = [
    dynPrice,
    ...(cost > 0 ? [cost] : []),
    ...validOrders.map((o) => o.price),
    ...avgSys2Prices,
  ].filter((p) => typeof p === "number" && !isNaN(p) && p > 0);

  if (allPrices.length === 0) return 50;

  const uniqueSortedPrices = Array.from(new Set(allPrices)).sort((a, b) => a - b);
  const topY = 7;
  const bottomY = 93;

  if (uniqueSortedPrices.length <= 1) return 50;
  const n = uniqueSortedPrices.length;
  const targetP = dynPrice > 0 ? dynPrice : uniqueSortedPrices[Math.floor(uniqueSortedPrices.length / 2)];

  if (targetP <= uniqueSortedPrices[0]) return bottomY;
  if (targetP >= uniqueSortedPrices[n - 1]) return topY;

  for (let i = 0; i < n - 1; i++) {
    const pLow = uniqueSortedPrices[i];
    const pHigh = uniqueSortedPrices[i + 1];
    if (targetP >= pLow && targetP <= pHigh) {
      const yLow = bottomY - (i / (n - 1)) * (bottomY - topY);
      const yHigh = bottomY - ((i + 1) / (n - 1)) * (bottomY - topY);
      if (pHigh === pLow) return yLow;
      const ratio = (targetP - pLow) / (pHigh - pLow);
      return yLow + ratio * (yHigh - yLow);
    }
  }

  return 50;
}

/**
 * 計算現價與分隔線在卡片上的相對位置，並精準投射至動態視覺線畫布 Y 軸座標 (0-100%)
 * 畫布標準 6 條視覺基準線高度：
 * 頂黃 12% (頂部獲利), 紅 28% (停損警戒), 黑 44% (基準中軸), 藍 60% (回檔加碼), 綠 76% (底部買進), 底黃 90% (深幅價值)
 */
export function calculateCanvasYFromDividers(
  tab: StockTab,
  strategy?: any,
  averageCost?: number,
  holdingQuantity?: number
): number | null {
  // 1. 精確計算現價標籤在卡片上的 SVG Y 軸高度 (7% ~ 93%)
  const cpCardY = calculateCardPriceY(tab, strategy, averageCost, holdingQuantity);

  const analysis = analyzeCardDividers(tab);

  // 2. 若卡片完全沒有任何分隔線，直接將卡片尺度 (7% ~ 93%) 線性投射至畫布視覺線 (12% ~ 90%)
  if (!analysis.allDividers || analysis.allDividers.length === 0) {
    const canvasY = 12 + ((cpCardY - 7) / (93 - 7)) * (90 - 12);
    return Math.max(6, Math.min(94, Math.round(canvasY * 10) / 10));
  }

  // 3. 取得卡片上各色系分隔線的實際繪製位置
  const blackDividers = analysis.allDividers.filter((d) => d.colorType === "black").map((d) => d.y);
  const blueDividers = analysis.allDividers.filter((d) => d.colorType === "blue").map((d) => d.y);
  const redDividers = analysis.allDividers.filter((d) => d.colorType === "red").map((d) => d.y);
  const greenDividers = analysis.allDividers.filter((d) => d.colorType === "green").map((d) => d.y);
  const yellowDividers = analysis.allDividers.filter((d) => d.colorType === "yellow").map((d) => d.y);
  const otherDividers = analysis.allDividers.filter((d) => d.colorType === "other").map((d) => d.y);

  // 建立真實分隔線錨點集合 (收集卡片上實際繪製的分隔線及其在看板上的標準目標高度)
  // 標準對照: 頂黃: 12%, 紅(警戒): 28%, 黑(中軸): 44%, 藍(加碼): 60%, 綠(買進): 76%, 底黃(深幅): 90%
  const detectedAnchors: { cardY: number; canvasY: number; name: string }[] = [];

  // 頂部黃色線 (頂部獲利)：卡片上方 (y < 40)
  const topYellows = yellowDividers.filter((y) => y < 40);
  if (topYellows.length > 0) {
    detectedAnchors.push({ cardY: Math.min(...topYellows), canvasY: 12, name: "topYellow" });
  }

  // 紅色線 (停損警戒)：卡片中上方阻力
  if (redDividers.length > 0) {
    detectedAnchors.push({ cardY: Math.min(...redDividers), canvasY: 28, name: "red" });
  }

  // 黑色線 (基準中軸)：卡片中間基準
  if (blackDividers.length > 0) {
    const closestBlack = blackDividers.reduce((prev, curr) =>
      Math.abs(curr - 50) < Math.abs(prev - 50) ? curr : prev
    );
    detectedAnchors.push({ cardY: closestBlack, canvasY: 44, name: "black" });
  }

  // 藍色線 (回檔加碼)：卡片中下方支撐
  if (blueDividers.length > 0) {
    detectedAnchors.push({ cardY: Math.min(...blueDividers), canvasY: 60, name: "blue" });
  }

  // 綠色線 (底部買進)：卡片下方買進
  if (greenDividers.length > 0) {
    detectedAnchors.push({ cardY: Math.max(...greenDividers), canvasY: 76, name: "green" });
  }

  // 底部黃色線 (深幅價值)：卡片最下方 (y > 60)
  const bottomYellows = yellowDividers.filter((y) => y > 60);
  if (bottomYellows.length > 0) {
    detectedAnchors.push({ cardY: Math.max(...bottomYellows), canvasY: 90, name: "bottomYellow" });
  }

  // 若卡片上有一般分隔線且未收集到標準色系線
  if (detectedAnchors.length === 0 && otherDividers.length > 0) {
    otherDividers.sort((a, b) => a - b);
    if (otherDividers.length === 1) {
      detectedAnchors.push({ cardY: otherDividers[0], canvasY: 44, name: "black" });
    } else {
      otherDividers.forEach((y, i) => {
        const cY = 28 + (i / (otherDividers.length - 1)) * (76 - 28);
        detectedAnchors.push({ cardY: y, canvasY: cY, name: `other-${i}` });
      });
    }
  }

  // 4. 排序所有實際存在的錨點 (按 cardY 升序)
  detectedAnchors.sort((a, b) => a.cardY - b.cardY);

  // 5. 加入卡片頂部與底部邊界錨點，建立覆蓋全範圍的映射
  const minCardY = detectedAnchors.length > 0 ? Math.min(7, detectedAnchors[0].cardY - 10) : 7;
  const maxCardY = detectedAnchors.length > 0 ? Math.max(93, detectedAnchors[detectedAnchors.length - 1].cardY + 10) : 93;

  const minCanvasY = detectedAnchors.length > 0 ? Math.min(10, detectedAnchors[0].canvasY - 12) : 10;
  const maxCanvasY = detectedAnchors.length > 0 ? Math.max(92, detectedAnchors[detectedAnchors.length - 1].canvasY + 10) : 92;

  const anchors = [
    { cardY: minCardY, canvasY: Math.max(6, minCanvasY) },
    ...detectedAnchors,
    { cardY: maxCardY, canvasY: Math.min(94, maxCanvasY) },
  ];

  // 6. 確保 anchors 的 canvasY 保持嚴格單調遞增 (拓撲保證)
  for (let i = 1; i < anchors.length; i++) {
    if (anchors[i].canvasY <= anchors[i - 1].canvasY) {
      anchors[i].canvasY = anchors[i - 1].canvasY + 2;
    }
  }

  // 7. 高精度分段線性插值 (Piecewise Linear Interpolation)
  let canvasY: number;

  if (cpCardY <= anchors[0].cardY) {
    canvasY = anchors[0].canvasY;
  } else if (cpCardY >= anchors[anchors.length - 1].cardY) {
    canvasY = anchors[anchors.length - 1].canvasY;
  } else {
    let found = false;
    canvasY = 44;
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      if (cpCardY >= a.cardY && cpCardY <= b.cardY) {
        const span = Math.max(0.0001, b.cardY - a.cardY);
        const t = (cpCardY - a.cardY) / span;
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
  for (const anchor of detectedAnchors) {
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

  // 2. 嚴格依股票代號分組，若同一代號包含多張卡片，僅從所傳入的卡片中評選最佳卡片
  const symbolGroups = new Map<string, StockTab[]>();
  subTabTabs.forEach((tab) => {
    const sym = (tab.symbol || "").trim().toUpperCase();
    if (!sym) return;
    if (!symbolGroups.has(sym)) {
      symbolGroups.set(sym, []);
    }
    symbolGroups.get(sym)!.push(tab);
  });

  let tabIndex = 0;
  symbolGroups.forEach((tabsForSym, sym) => {
    let targetTab: StockTab;
    if (tabsForSym.length === 1) {
      targetTab = tabsForSym[0];
    } else {
      const scored = tabsForSym.map((t) => {
        const analysis = analyzeCardDividers(t);
        const dividerCount = analysis.allDividers.length;
        const hasPrice = t.currentPrice && t.currentPrice > 0 ? 1 : 0;
        const isEligible = analysis.isEligible ? 100 : 0;
        const updateTime = t.updatedAt?.toMillis?.() || 0;
        return {
          tab: t,
          score: isEligible + dividerCount * 10 + hasPrice * 5,
          updateTime,
        };
      });
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.updateTime - a.updateTime;
      });
      targetTab = { ...scored[0].tab };
      if (!targetTab.currentPrice || targetTab.currentPrice <= 0) {
        const altWithPrice = tabsForSym.find((t) => t.currentPrice && t.currentPrice > 0);
        if (altWithPrice) {
          targetTab.currentPrice = altWithPrice.currentPrice;
        }
      }
    }

    const strat = strategiesMap?.[targetTab.id] || (targetTab as any).strategy;
    const stat = statsMap?.[targetTab.id];
    const avgCost = stat?.totalQuantity !== 0 ? stat?.averagePrice : undefined;
    const holdingQty = stat?.totalQuantity ?? (targetTab as any).holdingQuantity;

    const canvasY = calculateCanvasYFromDividers(targetTab, strat, avgCost, holdingQty);
    if (canvasY === null) {
      skippedCount++;
      return;
    }

    // 若原本已有 X 座標則保留，否則均勻分配
    const existingX = newPositions[sym]?.x;
    const defaultX = 20 + ((tabIndex % 6) * 12);
    const finalX = existingX !== undefined ? existingX : defaultX;

    newPositions[sym] = {
      ...newPositions[sym],
      x: finalX,
      y: canvasY,
      shape: newPositions[sym]?.shape || "circle",
      sizeOffset: newPositions[sym]?.sizeOffset ?? 0,
      color: newPositions[sym]?.color && newPositions[sym].color !== "#000000" ? newPositions[sym].color : undefined,
      hidden: Boolean(newPositions[sym]?.hidden),
      dcaProgress: newPositions[sym]?.dcaProgress || undefined,
      updatedAt: nowIso,
    };

    updatedSymbols.push(sym);
    updatedCount++;
    tabIndex++;
  });

  if (updatedCount > 0) {
    // 3. 儲存至 LocalStorage
    try {
      localStorage.setItem(storageKey, JSON.stringify(newPositions));
    } catch (e) {}

    // 4. 儲存至 Firestore (直接覆蓋舊座標紀錄為權威資料源)
    if (userId) {
      try {
        const docRef = doc(db, "users", userId, "visualLinesBoard", "positions");
        await setDoc(
          docRef,
          {
            positions: newPositions,
            updatedAt: nowIso,
          }
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
