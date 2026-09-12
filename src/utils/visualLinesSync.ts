import { StockTab, ChartAnnotation } from "../types";
import { PositionMap, HOLDING_CONFIG } from "../components/DynamicVisualLinesModal";
import { getVisualLinesDataSync, saveVisualLinesDataOptimistic } from "./visualLinesStorage";
import { getTimestampMillis } from "../lib/dateUtils";

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

export const CARD_TOP_Y = 7; // 個股卡片頂部價格邊界 (最高價 7%)
export const CARD_BOTTOM_Y = 93; // 個股卡片底部價格邊界 (最低價 93%)

export const CANVAS_TOP_YELLOW_Y = 12; // 頂黃 (Y軸 - 頂部獲利)
export const CANVAS_RED_Y = 28; // 紅 (R軸 - 停損警戒)
export const CANVAS_BLACK_Y = 44; // 黑 (D軸 - 基準中軸)
export const CANVAS_BLUE_Y = 60; // 藍 (B軸 - 回檔加碼)
export const CANVAS_GREEN_Y = 76; // 綠 (G軸 - 底部買進)
export const CANVAS_BOTTOM_YELLOW_Y = 90; // 底黃 (Y軸 - 深幅價值)

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
 * 必須至少有分隔線或有效現價
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

export function analyzeCardDividers(
  tab: StockTab,
  strategy?: any,
  averageCost?: number,
  holdingQuantity?: number
): CardDividerAnalysis {
  const annotations = tab.chartAnnotations || [];
  const dividerList: { ann: ChartAnnotation; colorType: string; y: number }[] = [];

  // 精確還原卡片價格尺度，使錨定價格的分隔線能即時動態換算為卡片當前最新可視 Y 座標
  const { uniqueSortedPrices } = extractCardPricePoints(
    tab,
    strategy,
    averageCost,
    holdingQuantity
  );

  const topY = CARD_TOP_Y;
  const bottomY = CARD_BOTTOM_Y;

  const getYPct = (p: number) => {
    if (!uniqueSortedPrices || uniqueSortedPrices.length <= 1) return 50;
    const n = uniqueSortedPrices.length;
    if (p <= uniqueSortedPrices[0]) return bottomY;
    if (p >= uniqueSortedPrices[n - 1]) return topY;

    for (let i = 0; i < n - 1; i++) {
      const pLow = uniqueSortedPrices[i];
      const pHigh = uniqueSortedPrices[i + 1];
      if (p >= pLow && p <= pHigh) {
        const yLow = bottomY - (i / (n - 1)) * (bottomY - topY);
        const yHigh = bottomY - ((i + 1) / (n - 1)) * (bottomY - topY);
        if (pHigh === pLow) return yLow;
        const ratio = (p - pLow) / (pHigh - pLow);
        return yLow + ratio * (yHigh - yLow);
      }
    }
    return 50;
  };

  for (const ann of annotations) {
    const isDivider =
      ann.type === "divider" ||
      (ann.type === "line" &&
        Math.abs((ann.y2 ?? ann.y1 ?? 0) - (ann.y1 ?? 0)) < 8 &&
        Math.abs((ann.x2 ?? 100) - (ann.x1 ?? 0)) >= 10);

    if (isDivider) {
      const colorType = classifyLineColor(ann.color);
      let y: number;
      if (ann.price && ann.price > 0 && uniqueSortedPrices.length > 0) {
        const calcY = getYPct(ann.price);
        y = typeof calcY === "number" && !isNaN(calcY) ? Math.round(calcY * 100) / 100 : (ann.y ?? ann.y1 ?? 0);
      } else {
        y =
          ann.y !== undefined
            ? ann.y
            : ann.y1 !== undefined && ann.y2 !== undefined
            ? (ann.y1 + ann.y2) / 2
            : ann.y1 ?? 0;
      }
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
 * 統一提取個股卡片內的所有價格點，與 StockCardVisualizer 內部 100% 同步
 */
export function extractCardPricePoints(
  tab: StockTab,
  strategy?: any,
  averageCost?: number,
  holdingQuantity?: number
): {
  dynamicPrice: number;
  uniqueSortedPrices: number[];
} {
  if (!tab) {
    return { dynamicPrice: 0, uniqueSortedPrices: [] };
  }
  const tabAny = tab as any;
  const dynamicPrice =
    tab.currentPrice && tab.currentPrice > 0
      ? tab.currentPrice
      : tabAny.price && tabAny.price > 0
      ? tabAny.price
      : 0;

  const validOrders: { price: number; category?: string }[] = [];

  // 1. 若 tab 有 plannedOrders (卡片上的主要訂單集合)
  if (Array.isArray(tabAny.plannedOrders) && tabAny.plannedOrders.length > 0) {
    tabAny.plannedOrders.forEach((o: any) => {
      const p = typeof o.price === "number" ? o.price : parseFloat(o.price || o.priceStr);
      if (!isNaN(p) && p > 0) {
        validOrders.push({ price: p, category: o.category || "其他" });
      }
    });
  } else {
    // 若無 plannedOrders，則從 strategy 目標價提取
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
    if (tab.stopLossPrice && tab.stopLossPrice > 0) {
      validOrders.push({ price: tab.stopLossPrice, category: "止損設定" });
    }
    if (tab.takeProfitPrice && tab.takeProfitPrice > 0) {
      validOrders.push({ price: tab.takeProfitPrice, category: "止盈設定" });
    }
  }

  // 2. 系統二向下攤平 (組別 1~4)
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

  const cost =
    averageCost && averageCost > 0
      ? averageCost
      : tabAny.averageCost && tabAny.averageCost > 0
      ? tabAny.averageCost
      : tabAny.buyPrice && tabAny.buyPrice > 0
      ? tabAny.buyPrice
      : 0;

  const allPrices = [
    dynamicPrice,
    ...(cost > 0 ? [cost] : []),
    ...validOrders.map((o) => o.price),
    ...avgSys2Prices,
  ].filter((p) => typeof p === "number" && !isNaN(p) && p > 0);

  const uniqueSortedPrices = Array.from(new Set(allPrices)).sort((a, b) => a - b);
  return { dynamicPrice, uniqueSortedPrices };
}

/**
 * 精確還原 StockCardVisualizer 內「現價標籤」在卡片畫布上的 SVG Y 軸百分比 (CARD_TOP_Y 7% ~ CARD_BOTTOM_Y 93%)
 */
export function calculateCardPriceY(
  tab: StockTab,
  strategy?: any,
  averageCost?: number,
  holdingQuantity?: number
): number {
  const { dynamicPrice, uniqueSortedPrices } = extractCardPricePoints(
    tab,
    strategy,
    averageCost,
    holdingQuantity
  );

  if (uniqueSortedPrices.length === 0) return 50;
  if (uniqueSortedPrices.length <= 1) return 50;

  const topY = CARD_TOP_Y; // 7%
  const bottomY = CARD_BOTTOM_Y; // 93%
  const n = uniqueSortedPrices.length;
  const targetP = dynamicPrice > 0 ? dynamicPrice : uniqueSortedPrices[Math.floor(n / 2)];

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
 * 輔助線與座標診斷詳細結果介面
 */
export interface CanvasYCalculationDetails {
  canvasY: number;
  cardPriceY: number;
  currentPrice: number;
  anchors: { cardY: number; canvasY: number; name: string }[];
  nearestLine: {
    name: string;
    axis: string;
    yPercent: number;
    diff: number;
    color: string;
  };
  zone: {
    name: string;
    range: string;
    desc: string;
  };
  isSnapped: boolean;
  snappedTo?: string;
  dividerCount: number;
}

/**
 * 計算現價與分隔線在卡片上的相對位置，並提供完整的座標計算診斷資訊（用於輔助線測試與精準投射）
 */
export function calculateCanvasYDetails(
  tab: StockTab,
  strategy?: any,
  averageCost?: number,
  holdingQuantity?: number
): CanvasYCalculationDetails {
  const cpCardY = calculateCardPriceY(tab, strategy, averageCost, holdingQuantity);
  const analysis = analyzeCardDividers(tab, strategy, averageCost, holdingQuantity);
  const dynPrice = tab.currentPrice && tab.currentPrice > 0 ? tab.currentPrice : (tab as any).price || 0;

  // 1. 若卡片完全沒有任何分隔線，直接將卡片尺度 (7% ~ 93%) 線性投射至畫布視覺線 (12% ~ 90%)
  if (!analysis.allDividers || analysis.allDividers.length === 0) {
    const rawCanvasY =
      CANVAS_TOP_YELLOW_Y +
      ((cpCardY - CARD_TOP_Y) / (CARD_BOTTOM_Y - CARD_TOP_Y)) *
        (CANVAS_BOTTOM_YELLOW_Y - CANVAS_TOP_YELLOW_Y);
    const canvasY = Math.max(6, Math.min(94, Math.round(rawCanvasY * 10) / 10));
    const zoneInfo = getAxisZoneForCanvasY(canvasY);

    return {
      canvasY,
      cardPriceY: cpCardY,
      currentPrice: dynPrice,
      anchors: [
        { cardY: CARD_TOP_Y, canvasY: CANVAS_TOP_YELLOW_Y, name: "頂黃基準 (12%)" },
        { cardY: CARD_BOTTOM_Y, canvasY: CANVAS_BOTTOM_YELLOW_Y, name: "底黃基準 (90%)" },
      ],
      nearestLine: {
        name: zoneInfo.label,
        axis: zoneInfo.axis,
        yPercent: zoneInfo.targetY,
        diff: zoneInfo.diff,
        color: "#EAB308",
      },
      zone: {
        name: zoneInfo.label,
        range: `${zoneInfo.targetY}%`,
        desc: zoneInfo.desc,
      },
      isSnapped: false,
      dividerCount: 0,
    };
  }

  // 2. 建立真實分隔線錨點集合 (標準目標高度: 頂黃 12%, 紅 28%, 黑 44%, 藍 60%, 綠 76%, 底黃 90%)
  const detectedAnchors: { cardY: number; canvasY: number; name: string }[] = [];

  const dividersByColor = new Map<string, { y: number; ann: ChartAnnotation }[]>();
  analysis.allDividers.forEach((d) => {
    const list = dividersByColor.get(d.colorType) || [];
    list.push({ y: d.y, ann: d.ann });
    dividersByColor.set(d.colorType, list);
  });

  // 紅色線 (停損警戒 / 阻力門檻 - R軸 28%)
  const redList = dividersByColor.get("red") || [];
  redList.sort((a, b) => a.y - b.y);
  redList.forEach((item, idx) => {
    const offset = (idx - (redList.length - 1) / 2) * 2;
    detectedAnchors.push({
      cardY: item.y,
      canvasY: CANVAS_RED_Y + offset,
      name: redList.length > 1 ? `紅線-${idx + 1} (R軸 28%)` : "紅線 (R軸 28%)",
    });
  });

  // 黑色線 (基準中軸 - D軸 44%)
  const blackList = dividersByColor.get("black") || [];
  blackList.sort((a, b) => a.y - b.y);
  blackList.forEach((item, idx) => {
    const offset = (idx - (blackList.length - 1) / 2) * 2;
    detectedAnchors.push({
      cardY: item.y,
      canvasY: CANVAS_BLACK_Y + offset,
      name: blackList.length > 1 ? `黑線-${idx + 1} (D軸 44%)` : "黑線 (D軸 44%)",
    });
  });

  // 藍色線 (回檔加碼 / 支撐門檻 - B軸 60%)
  const blueList = dividersByColor.get("blue") || [];
  blueList.sort((a, b) => a.y - b.y);
  blueList.forEach((item, idx) => {
    const offset = (idx - (blueList.length - 1) / 2) * 2;
    detectedAnchors.push({
      cardY: item.y,
      canvasY: CANVAS_BLUE_Y + offset,
      name: blueList.length > 1 ? `藍線-${idx + 1} (B軸 60%)` : "藍線 (B軸 60%)",
    });
  });

  // 綠色線 (底部買進 - G軸 76%)
  const greenList = dividersByColor.get("green") || [];
  greenList.sort((a, b) => a.y - b.y);
  greenList.forEach((item, idx) => {
    const offset = (idx - (greenList.length - 1) / 2) * 2;
    detectedAnchors.push({
      cardY: item.y,
      canvasY: CANVAS_GREEN_Y + offset,
      name: greenList.length > 1 ? `綠線-${idx + 1} (G軸 76%)` : "綠線 (G軸 76%)",
    });
  });

  // 黃色線 (頂黃 12% / 底黃 90%)
  const yellowList = dividersByColor.get("yellow") || [];
  yellowList.sort((a, b) => a.y - b.y);
  if (yellowList.length === 1) {
    const yItem = yellowList[0];
    const isTop = yItem.y < 50;
    detectedAnchors.push({
      cardY: yItem.y,
      canvasY: isTop ? CANVAS_TOP_YELLOW_Y : CANVAS_BOTTOM_YELLOW_Y,
      name: isTop ? "頂黃 (Y軸 12%)" : "底黃 (Y軸 90%)",
    });
  } else if (yellowList.length > 1) {
    yellowList.forEach((item, idx) => {
      const isTop = idx === 0 || item.y < 50;
      const isBottom = idx === yellowList.length - 1 && item.y >= 50;
      const targetCanvasY = isBottom
        ? CANVAS_BOTTOM_YELLOW_Y
        : isTop
        ? CANVAS_TOP_YELLOW_Y
        : item.y < 50
        ? CANVAS_TOP_YELLOW_Y
        : CANVAS_BOTTOM_YELLOW_Y;
      detectedAnchors.push({
        cardY: item.y,
        canvasY: targetCanvasY,
        name: isBottom ? "底黃 (Y軸 90%)" : "頂黃 (Y軸 12%)",
      });
    });
  }

  // 其他自訂分隔線 (均勻映射至 28% ~ 76%)
  const otherList = dividersByColor.get("other") || [];
  if (otherList.length > 0) {
    otherList.sort((a, b) => a.y - b.y);
    otherList.forEach((item, idx) => {
      const cY =
        CANVAS_RED_Y +
        ((item.y - CARD_TOP_Y) / (CARD_BOTTOM_Y - CARD_TOP_Y)) *
          (CANVAS_GREEN_Y - CANVAS_RED_Y);
      detectedAnchors.push({
        cardY: item.y,
        canvasY: Math.round(cY * 10) / 10,
        name: `自訂線-${idx + 1}`,
      });
    });
  }

  // 3. 排序所有實際存在的錨點 (按 cardY 升序，由上至下)
  detectedAnchors.sort((a, b) => a.cardY - b.cardY);

  // 4. 確保 detectedAnchors 的 canvasY 保持嚴格單調遞增，防止投影顛倒
  for (let i = 1; i < detectedAnchors.length; i++) {
    if (detectedAnchors[i].canvasY <= detectedAnchors[i - 1].canvasY) {
      detectedAnchors[i].canvasY = detectedAnchors[i - 1].canvasY + 2.0;
    }
  }

  // 5. 加入卡片頂部與底部邊界錨點，建立覆蓋全範圍的平滑映射
  const firstAnchor = detectedAnchors[0];
  const lastAnchor = detectedAnchors[detectedAnchors.length - 1];

  const minCardY = Math.min(CARD_TOP_Y, firstAnchor ? firstAnchor.cardY - 5 : CARD_TOP_Y);
  const maxCardY = Math.max(CARD_BOTTOM_Y, lastAnchor ? lastAnchor.cardY + 5 : CARD_BOTTOM_Y);

  const minCanvasY = firstAnchor
    ? Math.max(6, Math.min(CANVAS_TOP_YELLOW_Y, firstAnchor.canvasY - 6))
    : CANVAS_TOP_YELLOW_Y;
  const maxCanvasY = lastAnchor
    ? Math.min(94, Math.max(CANVAS_BOTTOM_YELLOW_Y, lastAnchor.canvasY + 6))
    : CANVAS_BOTTOM_YELLOW_Y;

  const anchors = [
    { cardY: minCardY, canvasY: minCanvasY, name: "頂部邊界" },
    ...detectedAnchors,
    { cardY: maxCardY, canvasY: maxCanvasY, name: "底部邊界" },
  ];

  // 6. 確保 anchors 的 canvasY 保持嚴格單調遞增 (拓撲保證)
  for (let i = 1; i < anchors.length; i++) {
    if (anchors[i].canvasY <= anchors[i - 1].canvasY) {
      anchors[i].canvasY = anchors[i - 1].canvasY + 1.5;
    }
  }

  // 7. 高精度分段線性插值 (Piecewise Linear Interpolation)
  let rawCanvasY: number;

  if (cpCardY <= anchors[0].cardY) {
    rawCanvasY = anchors[0].canvasY;
  } else if (cpCardY >= anchors[anchors.length - 1].cardY) {
    rawCanvasY = anchors[anchors.length - 1].canvasY;
  } else {
    let found = false;
    rawCanvasY = CANVAS_BLACK_Y;
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      if (cpCardY >= a.cardY && cpCardY <= b.cardY) {
        const span = Math.max(0.0001, b.cardY - a.cardY);
        const t = (cpCardY - a.cardY) / span;
        rawCanvasY = a.canvasY + t * (b.canvasY - a.canvasY);
        found = true;
        break;
      }
    }
    if (!found) {
      rawCanvasY = CANVAS_BLACK_Y;
    }
  }

  // 8. 靠近分隔線吸附精度：若極度靠近某分隔線 (小於 0.8% 卡片高度或 0.5% 畫布高度)，精確吸附對齊
  let isSnapped = false;
  let snappedTo: string | undefined;
  for (const anchor of detectedAnchors) {
    if (
      Math.abs(cpCardY - anchor.cardY) <= 0.8 ||
      Math.abs(rawCanvasY - anchor.canvasY) <= 0.5
    ) {
      rawCanvasY = anchor.canvasY;
      isSnapped = true;
      snappedTo = anchor.name;
      break;
    }
  }

  // 9. 安全邊界限制與精度四捨五入 (保留 6% ~ 94% 可視範圍，精確保留小數點一位)
  const clampedY = Math.max(6, Math.min(94, Math.round(rawCanvasY * 10) / 10));
  const zoneInfo = getAxisZoneForCanvasY(clampedY);

  return {
    canvasY: clampedY,
    cardPriceY: cpCardY,
    currentPrice: dynPrice,
    anchors: detectedAnchors,
    nearestLine: {
      name: zoneInfo.label,
      axis: zoneInfo.axis,
      yPercent: zoneInfo.targetY,
      diff: zoneInfo.diff,
      color:
        zoneInfo.axis === "D"
          ? "#000000"
          : zoneInfo.axis === "B"
          ? "#2563EB"
          : zoneInfo.axis === "G"
          ? "#16A34A"
          : zoneInfo.axis === "R"
          ? "#EF4444"
          : "#EAB308",
    },
    zone: {
      name: zoneInfo.label,
      range: `${zoneInfo.targetY}%`,
      desc: zoneInfo.desc,
    },
    isSnapped,
    snappedTo,
    dividerCount: analysis.allDividers.length,
  };
}

/**
 * 計算現價與分隔線在卡片上的相對位置，並精準投射至動態視覺線畫布 Y 軸座標 (0-100%)
 */
export function calculateCanvasYFromDividers(
  tab: StockTab,
  strategy?: any,
  averageCost?: number,
  holdingQuantity?: number
): number | null {
  const details = calculateCanvasYDetails(tab, strategy, averageCost, holdingQuantity);
  return details.canvasY;
}

/**
 * 判定給定 Canvas Y 軸座標所屬的標準視覺線或區間
 */
export function getAxisZoneForCanvasY(canvasY: number): {
  type: "line" | "zone";
  axis: string;
  label: string;
  desc: string;
  targetY: number;
  diff: number;
} {
  const lines = [
    { axis: "Y", label: "頂黃 Y軸 (頂部獲利)", targetY: CANVAS_TOP_YELLOW_Y, desc: "Take Profit / 極限超買" },
    { axis: "R", label: "紅色 R軸 (停損警戒)", targetY: CANVAS_RED_Y, desc: "Stop Loss / 阻力警戒" },
    { axis: "D", label: "黑色 D軸 (基準中軸)", targetY: CANVAS_BLACK_Y, desc: "Base / 成本平衡線" },
    { axis: "B", label: "藍色 B軸 (回檔加碼)", targetY: CANVAS_BLUE_Y, desc: "Support / 回檔支撐" },
    { axis: "G", label: "綠色 G軸 (底部買進)", targetY: CANVAS_GREEN_Y, desc: "Floor / 強力買進" },
    { axis: "Y", label: "底黃 Y軸 (深幅價值)", targetY: CANVAS_BOTTOM_YELLOW_Y, desc: "Deep Value / 極限超賣" },
  ];

  for (const l of lines) {
    const diff = Math.abs(canvasY - l.targetY);
    if (diff <= 1.0) {
      return { type: "line", axis: l.axis, label: l.label, desc: l.desc, targetY: l.targetY, diff };
    }
  }

  if (canvasY < CANVAS_TOP_YELLOW_Y) {
    return {
      type: "zone",
      axis: "Y+",
      label: "頂部突破區 (<12%)",
      desc: "極限超買延伸區間",
      targetY: CANVAS_TOP_YELLOW_Y,
      diff: CANVAS_TOP_YELLOW_Y - canvasY,
    };
  } else if (canvasY < CANVAS_RED_Y) {
    return {
      type: "zone",
      axis: "Y-R",
      label: "Y - R 區間 (12%~28%)",
      desc: "淡粉紅 / 頂部獲利 ~ 停損警戒",
      targetY: 20,
      diff: Math.abs(canvasY - 20),
    };
  } else if (canvasY < CANVAS_BLACK_Y) {
    return {
      type: "zone",
      axis: "R-D",
      label: "R - D 區間 (28%~44%)",
      desc: "淡灰色 / 阻力警戒 ~ 基準中軸",
      targetY: 36,
      diff: Math.abs(canvasY - 36),
    };
  } else if (canvasY < CANVAS_BLUE_Y) {
    return {
      type: "zone",
      axis: "D-B",
      label: "D - B 區間 (44%~60%)",
      desc: "淡藍色 / 基準中軸 ~ 回檔加碼",
      targetY: 52,
      diff: Math.abs(canvasY - 52),
    };
  } else if (canvasY < CANVAS_GREEN_Y) {
    return {
      type: "zone",
      axis: "B-G",
      label: "B - G 區間 (60%~76%)",
      desc: "淡青綠 / 回檔加碼 ~ 底部買進",
      targetY: 68,
      diff: Math.abs(canvasY - 68),
    };
  } else if (canvasY <= CANVAS_BOTTOM_YELLOW_Y) {
    return {
      type: "zone",
      axis: "G-Y",
      label: "G - Y 區間 (76%~90%)",
      desc: "淡金色 / 底部買進 ~ 深幅價值",
      targetY: 83,
      diff: Math.abs(canvasY - 83),
    };
  } else {
    return {
      type: "zone",
      axis: "Y-",
      label: "底部超跌區 (>90%)",
      desc: "極限超賣延伸區間",
      targetY: CANVAS_BOTTOM_YELLOW_Y,
      diff: canvasY - CANVAS_BOTTOM_YELLOW_Y,
    };
  }
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
  statsMap?: Record<
    string,
    {
      averagePrice?: number;
      totalQuantity?: number;
      unrealizedPnL?: number;
      unrealizedPnLPercent?: number;
      realizedPnL?: number;
    }
  >
): Promise<{
  success: boolean;
  updatedCount: number;
  skippedCount: number;
  updatedSymbols: string[];
  allPositions: PositionMap;
}> {
  // 1. 同步即時讀取現有位置快取資料 (0ms 延遲)
  const currentData = getVisualLinesDataSync(userId);
  const currentPositions = currentData.positions;

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
        const strat = strategiesMap?.[t.id] || (t as any).strategy;
        const stat = statsMap?.[t.id];
        const avgCost = stat?.totalQuantity !== 0 ? stat?.averagePrice : undefined;
        const holdingQty = stat?.totalQuantity ?? (t as any).holdingQuantity;
        const analysis = analyzeCardDividers(t, strat, avgCost, holdingQty);
        const dividerCount = analysis.allDividers.length;
        const hasPrice = t.currentPrice && t.currentPrice > 0 ? 1 : 0;
        const isEligible = analysis.isEligible ? 100 : 0;
        const updateTime = getTimestampMillis(t.updatedAt) || getTimestampMillis(t.createdAt);
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
    // 3. 極速樂觀寫入（記憶體 + 本地快取 + 廣播 + 背景非同步寫入 Firestore）
    saveVisualLinesDataOptimistic(userId, newPositions, currentData.tagSizeOffset);
  }

  return {
    success: updatedCount > 0,
    updatedCount,
    skippedCount,
    updatedSymbols,
    allPositions: newPositions,
  };
}
