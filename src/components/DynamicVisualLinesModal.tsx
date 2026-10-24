import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  X,
  Save,
  SlidersHorizontal,
  ChevronDown,
  RotateCcw,
  Sparkles,
  Check,
  Search,
  Eye,
  EyeOff,
  BoxSelect,
  Star,
  Layers,
  Activity,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Tag,
  Info,
  Plus,
  Trash2,
  ListPlus,
  FolderOpen,
  Minus,
  Circle,
  Square,
  CheckSquare,
  Download,
  Upload,
  RefreshCw,
  Crosshair,
  Ruler,
  HelpCircle,
  MoveVertical,
  ArrowLeft,
  ChevronUp,
  Split,
} from "lucide-react";
import { toast } from "sonner";
import { playClickSound, playSuccessSound } from "../lib/audio";
import { StockTab } from "../types";
import { getTimestampMillis } from "../lib/dateUtils";
import { System2PlanningChart } from "./System2PlanningChart";
import { getVisualPriceLevels } from "../lib/visualLevels";
import { generateAveragingDownRows, generatePyramidUpRows, calculateStats, calculateBatchPlanning } from "../lib/calculations";
import {
  syncSubTabDividersToCanvas,
  formatTagDate,
  analyzeCardDividers,
  calculateCanvasYFromDividers,
  calculateCanvasYDetails,
  getAxisZoneForCanvasY,
  CARD_TOP_Y,
  CARD_BOTTOM_Y,
  CANVAS_TOP_YELLOW_Y,
  CANVAS_RED_Y,
  CANVAS_BLACK_Y,
  CANVAS_BLUE_Y,
  CANVAS_GREEN_Y,
  CANVAS_BOTTOM_YELLOW_Y,
  CanvasYCalculationDetails,
} from "../utils/visualLinesSync";
import {
  getVisualLinesDataSync,
  revalidateVisualLinesDataAsync,
  saveVisualLinesDataOptimistic,
} from "../utils/visualLinesStorage";
import { db } from "../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

export interface PositionMap {
  [symbol: string]: {
    x: number; // percentage 0 - 100
    y: number; // percentage 0 - 100
    sizeOffset?: number; // per-tag size offset (+/- 2px steps)
    shape?: "circle"; // tag shape (always 'circle')
    color?: string; // custom circle background color hex
    hidden?: boolean; // whether tag is hidden on visual board
    dcaProgress?: "#1" | "#2" | "#3" | "#4" | string; // 攤平進度 #1, #2, #3, #4 或拆分交易選項
    updatedAt?: string;
  };
}

class PyramidCardErrorBoundary extends React.Component<
  { symbol: string; children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`PyramidCardErrorBoundary caught error for ${this.props.symbol}:`, error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full max-w-[99%] xl:max-w-[98%] 2xl:max-w-[1880px] mx-auto bg-white rounded-xl border border-rose-200/90 shadow-sm p-4 text-center">
          <div className="font-bold text-rose-700 text-sm mb-1">
            {this.props.symbol} 金字塔圖表載入時發生狀況
          </div>
          <p className="text-xs text-zinc-500 mb-3 font-mono">
            {this.state.error?.message || '請點擊下方按鈕重試'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-3 py-1 bg-rose-50 border border-rose-300 hover:bg-rose-100 rounded-lg text-xs font-bold text-rose-800 transition cursor-pointer"
          >
            重試載入
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// 拆分交易百分比選項 (8 大標準拆分交易)
export interface SplitTradeOption {
  id: string; // 標準 ID, 如 "第一批拆分交易(7%)"
  label: string; // 顯示名稱
  batchNum: "#1" | "#2" | "#3" | "#4";
  batchGroup: "第一批" | "第二批" | "第三批" | "第四批";
  shortName: string; // 簡短標籤, 如 "批1(7%)"
  percent: number; // 0.07
  percentText: string; // "7%"
  color: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export const SPLIT_TRADE_OPTIONS: SplitTradeOption[] = [
  // === 第一批 ===
  {
    id: "第一批拆分交易(7%)",
    label: "第一批拆分交易(7%)",
    batchNum: "#1",
    batchGroup: "第一批",
    shortName: "第一批拆分交易(7%)",
    percent: 0.07,
    percentText: "7%",
    color: "#38BDF8",
    badgeBg: "bg-blue-900",
    badgeText: "text-blue-100",
    badgeBorder: "border-blue-400",
  },
  {
    id: "第一批拆分交易(8%)",
    label: "第一批拆分交易(8%)",
    batchNum: "#1",
    batchGroup: "第一批",
    shortName: "第一批拆分交易(8%)",
    percent: 0.08,
    percentText: "8%",
    color: "#22D3EE",
    badgeBg: "bg-cyan-900",
    badgeText: "text-cyan-100",
    badgeBorder: "border-cyan-400",
  },

  // === 第二批 ===
  {
    id: "第二批拆分交易(10%)",
    label: "第二批拆分交易(10%)",
    batchNum: "#2",
    batchGroup: "第二批",
    shortName: "第二批拆分交易(10%)",
    percent: 0.10,
    percentText: "10%",
    color: "#2DD4BF",
    badgeBg: "bg-teal-900",
    badgeText: "text-teal-100",
    badgeBorder: "border-teal-400",
  },
  {
    id: "第二批拆分交易(15%)",
    label: "第二批拆分交易(15%)",
    batchNum: "#2",
    batchGroup: "第二批",
    shortName: "第二批拆分交易(15%)",
    percent: 0.15,
    percentText: "15%",
    color: "#4ADE80",
    badgeBg: "bg-emerald-900",
    badgeText: "text-emerald-100",
    badgeBorder: "border-emerald-400",
  },

  // === 第三批 ===
  {
    id: "第三批拆分交易(15%)",
    label: "第三批拆分交易(15%)",
    batchNum: "#3",
    batchGroup: "第三批",
    shortName: "第三批拆分交易(15%)",
    percent: 0.15,
    percentText: "15%",
    color: "#FB923C",
    badgeBg: "bg-amber-900",
    badgeText: "text-amber-100",
    badgeBorder: "border-amber-400",
  },
  {
    id: "第三批拆分交易(20%)",
    label: "第三批拆分交易(20%)",
    batchNum: "#3",
    batchGroup: "第三批",
    shortName: "第三批拆分交易(20%)",
    percent: 0.20,
    percentText: "20%",
    color: "#FACC15",
    badgeBg: "bg-orange-900",
    badgeText: "text-orange-100",
    badgeBorder: "border-orange-400",
  },

  // === 第四批 ===
  {
    id: "第四批拆分交易(10%)",
    label: "第四批拆分交易(10%)",
    batchNum: "#4",
    batchGroup: "第四批",
    shortName: "第四批拆分交易(10%)",
    percent: 0.10,
    percentText: "10%",
    color: "#C084FC",
    badgeBg: "bg-purple-900",
    badgeText: "text-purple-100",
    badgeBorder: "border-purple-400",
  },
  {
    id: "第四批拆分交易(15%)",
    label: "第四批拆分交易(15%)",
    batchNum: "#4",
    batchGroup: "第四批",
    shortName: "第四批拆分交易(15%)",
    percent: 0.15,
    percentText: "15%",
    color: "#F472B6",
    badgeBg: "bg-pink-900",
    badgeText: "text-pink-100",
    badgeBorder: "border-pink-400",
  },
];

/**
 * 查詢與匹配拆分交易選項（相容空格與不同命名格式）
 */
export function findSplitTradeOption(val?: string): SplitTradeOption | undefined {
  if (!val) return undefined;
  const clean = val.replace(/\s+/g, "");
  return SPLIT_TRADE_OPTIONS.find(
    (opt) =>
      opt.id.replace(/\s+/g, "") === clean ||
      opt.label.replace(/\s+/g, "") === clean ||
      opt.shortName.replace(/\s+/g, "") === clean ||
      clean.includes(opt.id.replace(/\s+/g, "")) ||
      (clean.includes(opt.batchGroup) && clean.includes(opt.percentText))
  );
}

/**
 * 取得攤平進度或拆分交易的高對比顏色背景徽章樣式
 */
export function getDcaProgressBadge(dca?: string) {
  if (!dca) return null;
  const splitOpt = findSplitTradeOption(dca);
  if (splitOpt) {
    return {
      label: splitOpt.shortName || splitOpt.label,
      bg: splitOpt.badgeBg,
      text: splitOpt.badgeText,
      border: splitOpt.badgeBorder,
    };
  }
  if (dca === "#1") {
    return {
      label: "第一批 (#1)",
      bg: "bg-blue-900",
      text: "text-blue-100",
      border: "border-blue-400",
    };
  }
  if (dca === "#2") {
    return {
      label: "第二批 (#2)",
      bg: "bg-emerald-900",
      text: "text-emerald-100",
      border: "border-emerald-400",
    };
  }
  if (dca === "#3") {
    return {
      label: "第三批 (#3)",
      bg: "bg-amber-900",
      text: "text-amber-100",
      border: "border-amber-400",
    };
  }
  if (dca === "#4") {
    return {
      label: "第四批 (#4)",
      bg: "bg-purple-900",
      text: "text-purple-100",
      border: "border-purple-400",
    };
  }
  return {
    label: dca,
    bg: "bg-zinc-900",
    text: "text-zinc-100",
    border: "border-zinc-500",
  };
}

export interface SplitCompanionStage {
  stageName: string; // e.g. "第一批拆分(8%)"
  fullStageName: string; // e.g. "第一批拆分交易(8%)"
  stageSize: number; // e.g. 35 股
  stageBought: number; // e.g. 0 股
  stageRemaining: number; // e.g. 35 股
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export interface SplitStageDetail {
  isSplitSelected: boolean;
  stageName: string; // e.g. "第一批拆分(7%)"
  fullStageName: string; // e.g. "第一批拆分交易(7%)"
  batchGroup: string; // e.g. "第一批"
  stageSize: number; // e.g. 47 股
  stageBought: number; // e.g. 38 股
  stageRemaining: number; // 該階段剩餘可用股數 e.g. 9 股
  totalPlanned: number;
  totalBought: number;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  // 同步提供接續拆分階段資訊 (如 1st 7%->8%、1st 8%->2nd 10%、2nd 10%->15%、2nd 15%->3rd 15%、3rd 15%->20%、3rd 20%->4th 10%、4th 10%->15%)
  companionStage?: SplitCompanionStage | null;
}

/**
 * 輔助計算目前所處的拆分交易階段與該階段剩餘可用股數
 */
export function calculateSplitTradeStageDetail(
  tab: any,
  dcaProgress?: string,
  plannedQty: number = 0,
  holdingQty: number = 0,
  strategy?: any
): SplitStageDetail | null {
  const rowsSys2 = tab?.averagingRowsSys2 || strategy?.averagingRowsSys2;
  const rowsSys1 = tab?.averagingRows || strategy?.averagingRows;

  // 優先從系統二 (averagingRowsSys2) 或系統一 (averagingRows) 讀取使用者自訂的各階段預計購買股數 (例如 55 張)
  const sys2Row0_q1 = parseFloat(rowsSys2?.[0]?.quantity || "");
  const sys2Row0_q2 = parseFloat(rowsSys2?.[0]?.quantity2 || "");
  const sys2Row1_q1 = parseFloat(rowsSys2?.[1]?.quantity || "");
  const sys2Row1_q2 = parseFloat(rowsSys2?.[1]?.quantity2 || "");
  const sys2Row2_q1 = parseFloat(rowsSys2?.[2]?.quantity || "");
  const sys2Row2_q2 = parseFloat(rowsSys2?.[2]?.quantity2 || "");
  const sys2Row3_q1 = parseFloat(rowsSys2?.[3]?.quantity || "");
  const sys2Row3_q2 = parseFloat(rowsSys2?.[3]?.quantity2 || "");

  const sys1Row0_q1 = parseFloat(rowsSys1?.[0]?.quantity || "");
  const sys1Row0_q2 = parseFloat(rowsSys1?.[0]?.quantity2 || "");
  const sys1Row1_q1 = parseFloat(rowsSys1?.[1]?.quantity || "");
  const sys1Row1_q2 = parseFloat(rowsSys1?.[1]?.quantity2 || "");
  const sys1Row2_q1 = parseFloat(rowsSys1?.[2]?.quantity || "");
  const sys1Row2_q2 = parseFloat(rowsSys1?.[2]?.quantity2 || "");
  const sys1Row3_q1 = parseFloat(rowsSys1?.[3]?.quantity || "");
  const sys1Row3_q2 = parseFloat(rowsSys1?.[3]?.quantity2 || "");

  const custom1_a = !isNaN(sys2Row0_q1) && sys2Row0_q1 > 0 ? sys2Row0_q1 : (!isNaN(sys1Row0_q1) && sys1Row0_q1 > 0 ? sys1Row0_q1 : 0);
  const custom1_b = !isNaN(sys2Row0_q2) && sys2Row0_q2 > 0 ? sys2Row0_q2 : (!isNaN(sys1Row0_q2) && sys1Row0_q2 > 0 ? sys1Row0_q2 : 0);
  const custom2_a = !isNaN(sys2Row1_q1) && sys2Row1_q1 > 0 ? sys2Row1_q1 : (!isNaN(sys1Row1_q1) && sys1Row1_q1 > 0 ? sys1Row1_q1 : 0);
  const custom2_b = !isNaN(sys2Row1_q2) && sys2Row1_q2 > 0 ? sys2Row1_q2 : (!isNaN(sys1Row1_q2) && sys1Row1_q2 > 0 ? sys1Row1_q2 : 0);
  const custom3_a = !isNaN(sys2Row2_q1) && sys2Row2_q1 > 0 ? sys2Row2_q1 : (!isNaN(sys1Row2_q1) && sys1Row2_q1 > 0 ? sys1Row2_q1 : 0);
  const custom3_b = !isNaN(sys2Row2_q2) && sys2Row2_q2 > 0 ? sys2Row2_q2 : (!isNaN(sys1Row2_q2) && sys1Row2_q2 > 0 ? sys1Row2_q2 : 0);
  const custom4_a = !isNaN(sys2Row3_q1) && sys2Row3_q1 > 0 ? sys2Row3_q1 : (!isNaN(sys1Row3_q1) && sys1Row3_q1 > 0 ? sys1Row3_q1 : 0);
  const custom4_b = !isNaN(sys2Row3_q2) && sys2Row3_q2 > 0 ? sys2Row3_q2 : (!isNaN(sys1Row3_q2) && sys1Row3_q2 > 0 ? sys1Row3_q2 : 0);

  const totalFromCustomRows =
    custom1_a + custom1_b + custom2_a + custom2_b + custom3_a + custom3_b + custom4_a + custom4_b;

  let effectivePlanned = plannedQty > 0 ? plannedQty : totalFromCustomRows;
  if (effectivePlanned <= 0) {
    if (holdingQty > 0) {
      effectivePlanned = Math.max(holdingQty, Math.round(holdingQty / 0.15));
    } else {
      effectivePlanned = 1000;
    }
  }

  const totalBought = Math.max(0, holdingQty);

  // 1. 第一批 (15%) -> 第一批拆分交易(7%) + 第一批交易(8%)
  const size1_a = custom1_a > 0 ? custom1_a : Math.round(effectivePlanned * 0.07);
  const size1_b = custom1_b > 0 ? custom1_b : Math.max(0, Math.ceil(effectivePlanned * 0.15) - size1_a);
  const size1 = size1_a + size1_b;

  // 2. 第二批 (25%) -> 第二批拆分交易(10%) + 第二批拆分交易(15%)
  const size2_a = custom2_a > 0 ? custom2_a : Math.round(effectivePlanned * 0.10);
  const size2_b = custom2_b > 0 ? custom2_b : Math.max(0, Math.ceil(effectivePlanned * 0.25) - size2_a);
  const size2 = size2_a + size2_b;

  // 3. 第三批 (35%) -> 第三批拆分交易(15%) + 第三批拆分交易(20%)
  const size3_a = custom3_a > 0 ? custom3_a : Math.round(effectivePlanned * 0.15);
  const size3_b = custom3_b > 0 ? custom3_b : Math.max(0, Math.ceil(effectivePlanned * 0.35) - size3_a);
  const size3 = size3_a + size3_b;

  // 4. 第四批 (25%) -> 第四批拆分交易 (10%) + 第四批拆分交易 (15%)
  const size4_a = custom4_a > 0 ? custom4_a : Math.round(effectivePlanned * 0.10);
  const size4_b = custom4_b > 0 ? custom4_b : Math.max(0, Math.ceil(effectivePlanned * 0.25) - size4_a);
  const size4 = size4_a + size4_b;

  // 各批拆分已購與剩餘股數計算 (累進階梯推進)
  // 該階段剩餘股數 = 該階段預計購買數量 扣除 該階段已購買數量
  const bought1_a = Math.min(totalBought, size1_a);
  const rem1_a = Math.max(0, size1_a - bought1_a);

  const remAfter1_a = Math.max(0, totalBought - size1_a);
  const bought1_b = Math.min(remAfter1_a, size1_b);
  const rem1_b = Math.max(0, size1_b - bought1_b);

  const remAfter1 = Math.max(0, totalBought - size1);
  const bought2_a = Math.min(remAfter1, size2_a);
  const rem2_a = Math.max(0, size2_a - bought2_a);

  const remAfter2_a = Math.max(0, remAfter1 - size2_a);
  const bought2_b = Math.min(remAfter2_a, size2_b);
  const rem2_b = Math.max(0, size2_b - bought2_b);

  const remAfter2 = Math.max(0, totalBought - size1 - size2);
  const bought3_a = Math.min(remAfter2, size3_a);
  const rem3_a = Math.max(0, size3_a - bought3_a);

  const remAfter3_a = Math.max(0, remAfter2 - size3_a);
  const bought3_b = Math.min(remAfter3_a, size3_b);
  const rem3_b = Math.max(0, size3_b - bought3_b);

  const remAfter3 = Math.max(0, totalBought - size1 - size2 - size3);
  const bought4_a = Math.min(remAfter3, size4_a);
  const rem4_a = Math.max(0, size4_a - bought4_a);

  const remAfter4_a = Math.max(0, remAfter3 - size4_a);
  const bought4_b = Math.min(remAfter4_a, size4_b);
  const rem4_b = Math.max(0, size4_b - bought4_b);

  // 若已有實際持股 (totalBought > 0)，優先依據累計已購數量精確判定當前所處之進行中批次 (避免被舊標籤或已滿批之早前批次卡死)
  if (totalBought > 0) {
    if (totalBought >= (size1 + size2 + size3)) {
      // 第三批已 100% 購買完畢 (餘 0 股)，必定已推進至第四批拆分交易
      if (totalBought < (size1 + size2 + size3 + size4_a)) {
        return {
          isSplitSelected: true,
          stageName: "第四批拆分(10%)",
          fullStageName: "第四批拆分交易(10%)",
          batchGroup: "第四批",
          stageSize: size4_a,
          stageBought: bought4_a,
          stageRemaining: rem4_a,
          totalPlanned: effectivePlanned,
          totalBought,
          badgeBg: "bg-purple-900",
          badgeText: "text-purple-100",
          badgeBorder: "border-purple-400",
          companionStage: {
            stageName: "第四批拆分(15%)",
            fullStageName: "第四批拆分交易(15%)",
            stageSize: size4_b,
            stageBought: bought4_b,
            stageRemaining: rem4_b,
            badgeBg: "bg-pink-900",
            badgeText: "text-pink-100",
            badgeBorder: "border-pink-400",
          },
        };
      } else {
        return {
          isSplitSelected: true,
          stageName: "第四批拆分(15%)",
          fullStageName: "第四批拆分交易(15%)",
          batchGroup: "第四批",
          stageSize: size4_b,
          stageBought: bought4_b,
          stageRemaining: rem4_b,
          totalPlanned: effectivePlanned,
          totalBought,
          badgeBg: "bg-pink-900",
          badgeText: "text-pink-100",
          badgeBorder: "border-pink-400",
          companionStage: null,
        };
      }
    } else if (totalBought >= (size1 + size2)) {
      // 第二批已 100% 購買完畢，推進至第三批拆分交易
      if (totalBought < (size1 + size2 + size3_a)) {
        return {
          isSplitSelected: true,
          stageName: "第三批拆分(15%)",
          fullStageName: "第三批拆分交易(15%)",
          batchGroup: "第三批",
          stageSize: size3_a,
          stageBought: bought3_a,
          stageRemaining: rem3_a,
          totalPlanned: effectivePlanned,
          totalBought,
          badgeBg: "bg-amber-900",
          badgeText: "text-amber-100",
          badgeBorder: "border-amber-400",
          companionStage: {
            stageName: "第三批拆分(20%)",
            fullStageName: "第三批拆分交易(20%)",
            stageSize: size3_b,
            stageBought: bought3_b,
            stageRemaining: rem3_b,
            badgeBg: "bg-orange-900",
            badgeText: "text-orange-100",
            badgeBorder: "border-orange-400",
          },
        };
      } else {
        return {
          isSplitSelected: true,
          stageName: "第三批拆分(20%)",
          fullStageName: "第三批拆分交易(20%)",
          batchGroup: "第三批",
          stageSize: size3_b,
          stageBought: bought3_b,
          stageRemaining: rem3_b,
          totalPlanned: effectivePlanned,
          totalBought,
          badgeBg: "bg-orange-900",
          badgeText: "text-orange-100",
          badgeBorder: "border-orange-400",
          companionStage: {
            stageName: "第四批拆分(10%)",
            fullStageName: "第四批拆分交易(10%)",
            stageSize: size4_a,
            stageBought: bought4_a,
            stageRemaining: rem4_a,
            badgeBg: "bg-purple-900",
            badgeText: "text-purple-100",
            badgeBorder: "border-purple-400",
          },
        };
      }
    } else if (totalBought >= size1) {
      // 第一批已 100% 購買完畢，推進至第二批拆分交易
      if (totalBought < (size1 + size2_a)) {
        return {
          isSplitSelected: true,
          stageName: "第二批拆分(10%)",
          fullStageName: "第二批拆分交易(10%)",
          batchGroup: "第二批",
          stageSize: size2_a,
          stageBought: bought2_a,
          stageRemaining: rem2_a,
          totalPlanned: effectivePlanned,
          totalBought,
          badgeBg: "bg-teal-900",
          badgeText: "text-teal-100",
          badgeBorder: "border-teal-400",
          companionStage: {
            stageName: "第二批拆分(15%)",
            fullStageName: "第二批拆分交易(15%)",
            stageSize: size2_b,
            stageBought: bought2_b,
            stageRemaining: rem2_b,
            badgeBg: "bg-emerald-900",
            badgeText: "text-emerald-100",
            badgeBorder: "border-emerald-400",
          },
        };
      } else {
        return {
          isSplitSelected: true,
          stageName: "第二批拆分(15%)",
          fullStageName: "第二批拆分交易(15%)",
          batchGroup: "第二批",
          stageSize: size2_b,
          stageBought: bought2_b,
          stageRemaining: rem2_b,
          totalPlanned: effectivePlanned,
          totalBought,
          badgeBg: "bg-emerald-900",
          badgeText: "text-emerald-100",
          badgeBorder: "border-emerald-400",
          companionStage: {
            stageName: "第三批拆分(15%)",
            fullStageName: "第三批拆分交易(15%)",
            stageSize: size3_a,
            stageBought: bought3_a,
            stageRemaining: rem3_a,
            badgeBg: "bg-amber-900",
            badgeText: "text-amber-100",
            badgeBorder: "border-amber-400",
          },
        };
      }
    } else {
      // 處於第一批拆分交易
      if (totalBought < size1_a) {
        return {
          isSplitSelected: true,
          stageName: "第一批拆分(7%)",
          fullStageName: "第一批拆分交易(7%)",
          batchGroup: "第一批",
          stageSize: size1_a,
          stageBought: bought1_a,
          stageRemaining: rem1_a,
          totalPlanned: effectivePlanned,
          totalBought,
          badgeBg: "bg-blue-900",
          badgeText: "text-blue-100",
          badgeBorder: "border-blue-400",
          companionStage: {
            stageName: "第一批拆分(8%)",
            fullStageName: "第一批拆分交易(8%)",
            stageSize: size1_b,
            stageBought: bought1_b,
            stageRemaining: rem1_b,
            badgeBg: "bg-cyan-900",
            badgeText: "text-cyan-100",
            badgeBorder: "border-cyan-400",
          },
        };
      } else {
        return {
          isSplitSelected: true,
          stageName: "第一批拆分(8%)",
          fullStageName: "第一批拆分交易(8%)",
          batchGroup: "第一批",
          stageSize: size1_b,
          stageBought: bought1_b,
          stageRemaining: rem1_b,
          totalPlanned: effectivePlanned,
          totalBought,
          badgeBg: "bg-cyan-900",
          badgeText: "text-cyan-100",
          badgeBorder: "border-cyan-400",
          companionStage: {
            stageName: "第二批拆分(10%)",
            fullStageName: "第二批拆分交易(10%)",
            stageSize: size2_a,
            stageBought: bought2_a,
            stageRemaining: rem2_a,
            badgeBg: "bg-teal-900",
            badgeText: "text-teal-100",
            badgeBorder: "border-teal-400",
          },
        };
      }
    }
  }

  const splitOpt = findSplitTradeOption(dcaProgress);

  if (splitOpt) {
    let stageSize = 0;
    let stageBought = 0;
    let stageRemaining = 0;
    let companionStage: SplitCompanionStage | null = null;

    const optId = splitOpt.id.replace(/\s+/g, "");
    if (optId.includes("第一批") && (optId.includes("7%") || optId.includes("拆分1"))) {
      stageSize = size1_a;
      stageBought = bought1_a;
      stageRemaining = rem1_a;
      // 若已經有第一批拆分交易(7%)，則也顯示第一批拆分交易(8%)以及剩餘股數和預購股數
      companionStage = {
        stageName: "第一批拆分(8%)",
        fullStageName: "第一批拆分交易(8%)",
        stageSize: size1_b,
        stageBought: bought1_b,
        stageRemaining: rem1_b,
        badgeBg: "bg-cyan-900",
        badgeText: "text-cyan-100",
        badgeBorder: "border-cyan-400",
      };
    } else if (optId.includes("第一批") && (optId.includes("8%") || optId.includes("拆分2"))) {
      stageSize = size1_b;
      stageBought = bought1_b;
      stageRemaining = rem1_b;
      // 若已經有第一批拆分交易(8%)，則也顯示第二批拆分交易(10%)以及剩餘股數和預購股數
      companionStage = {
        stageName: "第二批拆分(10%)",
        fullStageName: "第二批拆分交易(10%)",
        stageSize: size2_a,
        stageBought: bought2_a,
        stageRemaining: rem2_a,
        badgeBg: "bg-teal-900",
        badgeText: "text-teal-100",
        badgeBorder: "border-teal-400",
      };
    } else if (optId.includes("第二批") && (optId.includes("10%") || optId.includes("拆分1"))) {
      stageSize = size2_a;
      stageBought = bought2_a;
      stageRemaining = rem2_a;
      // 若已經有第二批拆分交易(10%)，則也顯示第二批拆分交易(15%)以及剩餘股數和預購股數
      companionStage = {
        stageName: "第二批拆分(15%)",
        fullStageName: "第二批拆分交易(15%)",
        stageSize: size2_b,
        stageBought: bought2_b,
        stageRemaining: rem2_b,
        badgeBg: "bg-emerald-900",
        badgeText: "text-emerald-100",
        badgeBorder: "border-emerald-400",
      };
    } else if (optId.includes("第二批") && (optId.includes("15%") || optId.includes("拆分2"))) {
      stageSize = size2_b;
      stageBought = bought2_b;
      stageRemaining = rem2_b;
      // 若已經有第二批拆分交易(15%)，則也顯示第三批拆分交易(15%)以及剩餘股數和預購股數
      companionStage = {
        stageName: "第三批拆分(15%)",
        fullStageName: "第三批拆分交易(15%)",
        stageSize: size3_a,
        stageBought: bought3_a,
        stageRemaining: rem3_a,
        badgeBg: "bg-amber-900",
        badgeText: "text-amber-100",
        badgeBorder: "border-amber-400",
      };
    } else if (optId.includes("第三批") && (optId.includes("15%") || optId.includes("拆分1"))) {
      stageSize = size3_a;
      stageBought = bought3_a;
      stageRemaining = rem3_a;
      // 若已經有第三批拆分交易(15%)，則也顯示第三批拆分交易(20%)以及剩餘股數和預購股數
      companionStage = {
        stageName: "第三批拆分(20%)",
        fullStageName: "第三批拆分交易(20%)",
        stageSize: size3_b,
        stageBought: bought3_b,
        stageRemaining: rem3_b,
        badgeBg: "bg-orange-900",
        badgeText: "text-orange-100",
        badgeBorder: "border-orange-400",
      };
    } else if (optId.includes("第三批") && (optId.includes("20%") || optId.includes("拆分2"))) {
      stageSize = size3_b;
      stageBought = bought3_b;
      stageRemaining = rem3_b;
      // 若已經有第三批拆分交易(20%)，則也顯示第四批拆分交易(10%)以及剩餘股數和預購股數
      companionStage = {
        stageName: "第四批拆分(10%)",
        fullStageName: "第四批拆分交易(10%)",
        stageSize: size4_a,
        stageBought: bought4_a,
        stageRemaining: rem4_a,
        badgeBg: "bg-purple-900",
        badgeText: "text-purple-100",
        badgeBorder: "border-purple-400",
      };
    } else if (optId.includes("第四批") && (optId.includes("10%") || optId.includes("拆分1"))) {
      stageSize = size4_a;
      stageBought = bought4_a;
      stageRemaining = rem4_a;
      // 若已經有第四批拆分交易(10%)，則也顯示第四批拆分交易(15%)以及剩餘股數和預購股數
      companionStage = {
        stageName: "第四批拆分(15%)",
        fullStageName: "第四批拆分交易(15%)",
        stageSize: size4_b,
        stageBought: bought4_b,
        stageRemaining: rem4_b,
        badgeBg: "bg-pink-900",
        badgeText: "text-pink-100",
        badgeBorder: "border-pink-400",
      };
    } else if (optId.includes("第四批") && (optId.includes("15%") || optId.includes("拆分2"))) {
      stageSize = size4_b;
      stageBought = bought4_b;
      stageRemaining = rem4_b;
    } else {
      stageSize = Math.round(effectivePlanned * splitOpt.percent);
      stageBought = Math.min(totalBought, stageSize);
      stageRemaining = Math.max(0, stageSize - stageBought);
    }

    return {
      isSplitSelected: true,
      stageName: splitOpt.shortName,
      fullStageName: splitOpt.label,
      batchGroup: splitOpt.batchGroup,
      stageSize,
      stageBought,
      stageRemaining,
      totalPlanned: effectivePlanned,
      totalBought,
      badgeBg: splitOpt.badgeBg,
      badgeText: splitOpt.badgeText,
      badgeBorder: splitOpt.badgeBorder,
      companionStage,
    };
  }

  // 自動推算目前所處的拆分子階段
  let currentStageName = "第一批拆分交易(7%)";
  let currentFullStageName = "第一批拆分交易(7%)";
  let currentBatchGroup = "第一批";
  let stageSize = size1_a;
  let stageBought = bought1_a;
  let stageRemaining = rem1_a;
  let badgeBg = "bg-blue-900";
  let badgeText = "text-blue-100";
  let badgeBorder = "border-blue-400";
  let companionStage: SplitCompanionStage | null = null;

  if (dcaProgress === "#4" || totalBought >= (size1 + size2 + size3)) {
    if (totalBought < (size1 + size2 + size3 + size4_a)) {
      currentStageName = "第四批拆分交易(10%)";
      currentFullStageName = "第四批拆分交易(10%)";
      currentBatchGroup = "第四批";
      stageSize = size4_a;
      stageBought = bought4_a;
      stageRemaining = rem4_a;
      badgeBg = "bg-purple-900";
      badgeText = "text-purple-100";
      badgeBorder = "border-purple-400";
      companionStage = {
        stageName: "第四批拆分(15%)",
        fullStageName: "第四批拆分交易(15%)",
        stageSize: size4_b,
        stageBought: bought4_b,
        stageRemaining: rem4_b,
        badgeBg: "bg-pink-900",
        badgeText: "text-pink-100",
        badgeBorder: "border-pink-400",
      };
    } else {
      currentStageName = "第四批拆分交易(15%)";
      currentFullStageName = "第四批拆分交易(15%)";
      currentBatchGroup = "第四批";
      stageSize = size4_b;
      stageBought = bought4_b;
      stageRemaining = rem4_b;
      badgeBg = "bg-pink-900";
      badgeText = "text-pink-100";
      badgeBorder = "border-pink-400";
    }
  } else if (dcaProgress === "#3" || totalBought >= (size1 + size2)) {
    if (totalBought < (size1 + size2 + size3_a)) {
      currentStageName = "第三批拆分交易(15%)";
      currentFullStageName = "第三批拆分交易(15%)";
      currentBatchGroup = "第三批";
      stageSize = size3_a;
      stageBought = bought3_a;
      stageRemaining = rem3_a;
      badgeBg = "bg-amber-900";
      badgeText = "text-amber-100";
      badgeBorder = "border-amber-400";
      companionStage = {
        stageName: "第三批拆分(20%)",
        fullStageName: "第三批拆分交易(20%)",
        stageSize: size3_b,
        stageBought: bought3_b,
        stageRemaining: rem3_b,
        badgeBg: "bg-orange-900",
        badgeText: "text-orange-100",
        badgeBorder: "border-orange-400",
      };
    } else {
      currentStageName = "第三批拆分交易(20%)";
      currentFullStageName = "第三批拆分交易(20%)";
      currentBatchGroup = "第三批";
      stageSize = size3_b;
      stageBought = bought3_b;
      stageRemaining = rem3_b;
      badgeBg = "bg-orange-900";
      badgeText = "text-orange-100";
      badgeBorder = "border-orange-400";
      // 若已經有第三批拆分交易(20%)，則也顯示第四批拆分交易(10%)以及剩餘股數和預購股數
      companionStage = {
        stageName: "第四批拆分(10%)",
        fullStageName: "第四批拆分交易(10%)",
        stageSize: size4_a,
        stageBought: bought4_a,
        stageRemaining: rem4_a,
        badgeBg: "bg-purple-900",
        badgeText: "text-purple-100",
        badgeBorder: "border-purple-400",
      };
    }
  } else if (dcaProgress === "#2" || totalBought >= size1) {
    if (totalBought < (size1 + size2_a)) {
      currentStageName = "第二批拆分交易(10%)";
      currentFullStageName = "第二批拆分交易(10%)";
      currentBatchGroup = "第二批";
      stageSize = size2_a;
      stageBought = bought2_a;
      stageRemaining = rem2_a;
      badgeBg = "bg-teal-900";
      badgeText = "text-teal-100";
      badgeBorder = "border-teal-400";
      companionStage = {
        stageName: "第二批拆分(15%)",
        fullStageName: "第二批拆分交易(15%)",
        stageSize: size2_b,
        stageBought: bought2_b,
        stageRemaining: rem2_b,
        badgeBg: "bg-emerald-900",
        badgeText: "text-emerald-100",
        badgeBorder: "border-emerald-400",
      };
    } else {
      currentStageName = "第二批拆分交易(15%)";
      currentFullStageName = "第二批拆分交易(15%)";
      currentBatchGroup = "第二批";
      stageSize = size2_b;
      stageBought = bought2_b;
      stageRemaining = rem2_b;
      badgeBg = "bg-emerald-900";
      badgeText = "text-emerald-100";
      badgeBorder = "border-emerald-400";
      // 若已經有第二批拆分交易(15%)，則也顯示第三批拆分交易(15%)以及剩餘股數和預購股數
      companionStage = {
        stageName: "第三批拆分(15%)",
        fullStageName: "第三批拆分交易(15%)",
        stageSize: size3_a,
        stageBought: bought3_a,
        stageRemaining: rem3_a,
        badgeBg: "bg-amber-900",
        badgeText: "text-amber-100",
        badgeBorder: "border-amber-400",
      };
    }
  } else {
    if (totalBought < size1_a) {
      currentStageName = "第一批拆分交易(7%)";
      currentFullStageName = "第一批拆分交易(7%)";
      currentBatchGroup = "第一批";
      stageSize = size1_a;
      stageBought = bought1_a;
      stageRemaining = rem1_a;
      badgeBg = "bg-blue-900";
      badgeText = "text-blue-100";
      badgeBorder = "border-blue-400";
      companionStage = {
        stageName: "第一批拆分(8%)",
        fullStageName: "第一批拆分交易(8%)",
        stageSize: size1_b,
        stageBought: bought1_b,
        stageRemaining: rem1_b,
        badgeBg: "bg-cyan-900",
        badgeText: "text-cyan-100",
        badgeBorder: "border-cyan-400",
      };
    } else {
      currentStageName = "第一批拆分交易(8%)";
      currentFullStageName = "第一批拆分交易(8%)";
      currentBatchGroup = "第一批";
      stageSize = size1_b;
      stageBought = bought1_b;
      stageRemaining = rem1_b;
      badgeBg = "bg-cyan-900";
      badgeText = "text-cyan-100";
      badgeBorder = "border-cyan-400";
      // 若已經有第一批拆分交易(8%)，則也顯示第二批拆分交易(10%)以及剩餘股數和預購股數
      companionStage = {
        stageName: "第二批拆分(10%)",
        fullStageName: "第二批拆分交易(10%)",
        stageSize: size2_a,
        stageBought: bought2_a,
        stageRemaining: rem2_a,
        badgeBg: "bg-teal-900",
        badgeText: "text-teal-100",
        badgeBorder: "border-teal-400",
      };
    }
  }

  return {
    isSplitSelected: false,
    stageName: currentStageName,
    fullStageName: currentFullStageName,
    batchGroup: currentBatchGroup,
    stageSize,
    stageBought,
    stageRemaining,
    totalPlanned: effectivePlanned,
    totalBought,
    badgeBg,
    badgeText,
    badgeBorder,
    companionStage,
  };
}

export interface BatchStageInfo {
  batchNum: number; // 1 | 2 | 3 | 4
  batchTitle: string; // "第一批15%" | "第二批25%" | "第三批35%" | "第四批25%"
  plannedQty: number; // 該批總計預購股數
  boughtQty: number; // 該批已購股數
  remainingQty: number; // 該批剩餘股數
}

export interface StockBatchProgressSummary {
  currentBatch: BatchStageInfo;
  nextBatch: BatchStageInfo | null;
  batches: BatchStageInfo[];
}

/**
 * 取得個股四批次交易進度摘要資訊 (第一批15%, 第二批25%, 第三批35%, 第四批25%)
 * 用於滑鼠移入股票圓圈時之快顯對話窗顯示 (目前所處批次與下一批次之總計預購股數與已購股數)
 */
export function getStockBatchProgressSummary(
  tab?: any,
  strategy?: any,
  plannedQty: number = 0,
  holdingQty: number = 0,
  dcaProgress?: string
): StockBatchProgressSummary {
  const rowsSys2 = tab?.averagingRowsSys2 || strategy?.averagingRowsSys2;
  const rowsSys1 = tab?.averagingRows || strategy?.averagingRows;

  // 取得自訂拆分/各列股數
  const sys2Row0_q1 = parseFloat(rowsSys2?.[0]?.quantity || "");
  const sys2Row0_q2 = parseFloat(rowsSys2?.[0]?.quantity2 || "");
  const sys2Row1_q1 = parseFloat(rowsSys2?.[1]?.quantity || "");
  const sys2Row1_q2 = parseFloat(rowsSys2?.[1]?.quantity2 || "");
  const sys2Row2_q1 = parseFloat(rowsSys2?.[2]?.quantity || "");
  const sys2Row2_q2 = parseFloat(rowsSys2?.[2]?.quantity2 || "");
  const sys2Row3_q1 = parseFloat(rowsSys2?.[3]?.quantity || "");
  const sys2Row3_q2 = parseFloat(rowsSys2?.[3]?.quantity2 || "");

  const sys1Row0_q1 = parseFloat(rowsSys1?.[0]?.quantity || "");
  const sys1Row0_q2 = parseFloat(rowsSys1?.[0]?.quantity2 || "");
  const sys1Row1_q1 = parseFloat(rowsSys1?.[1]?.quantity || "");
  const sys1Row1_q2 = parseFloat(rowsSys1?.[1]?.quantity2 || "");
  const sys1Row2_q1 = parseFloat(rowsSys1?.[2]?.quantity || "");
  const sys1Row2_q2 = parseFloat(rowsSys1?.[2]?.quantity2 || "");
  const sys1Row3_q1 = parseFloat(rowsSys1?.[3]?.quantity || "");
  const sys1Row3_q2 = parseFloat(rowsSys1?.[3]?.quantity2 || "");

  const custom1_a = !isNaN(sys2Row0_q1) && sys2Row0_q1 > 0 ? sys2Row0_q1 : (!isNaN(sys1Row0_q1) && sys1Row0_q1 > 0 ? sys1Row0_q1 : 0);
  const custom1_b = !isNaN(sys2Row0_q2) && sys2Row0_q2 > 0 ? sys2Row0_q2 : (!isNaN(sys1Row0_q2) && sys1Row0_q2 > 0 ? sys1Row0_q2 : 0);
  const custom2_a = !isNaN(sys2Row1_q1) && sys2Row1_q1 > 0 ? sys2Row1_q1 : (!isNaN(sys1Row1_q1) && sys1Row1_q1 > 0 ? sys1Row1_q1 : 0);
  const custom2_b = !isNaN(sys2Row1_q2) && sys2Row1_q2 > 0 ? sys2Row1_q2 : (!isNaN(sys1Row1_q2) && sys1Row1_q2 > 0 ? sys1Row1_q2 : 0);
  const custom3_a = !isNaN(sys2Row2_q1) && sys2Row2_q1 > 0 ? sys2Row2_q1 : (!isNaN(sys1Row2_q1) && sys1Row2_q1 > 0 ? sys1Row2_q1 : 0);
  const custom3_b = !isNaN(sys2Row2_q2) && sys2Row2_q2 > 0 ? sys2Row2_q2 : (!isNaN(sys1Row2_q2) && sys1Row2_q2 > 0 ? sys1Row2_q2 : 0);
  const custom4_a = !isNaN(sys2Row3_q1) && sys2Row3_q1 > 0 ? sys2Row3_q1 : (!isNaN(sys1Row3_q1) && sys1Row3_q1 > 0 ? sys1Row3_q1 : 0);
  const custom4_b = !isNaN(sys2Row3_q2) && sys2Row3_q2 > 0 ? sys2Row3_q2 : (!isNaN(sys1Row3_q2) && sys1Row3_q2 > 0 ? sys1Row3_q2 : 0);

  const totalFromCustomRows =
    custom1_a + custom1_b + custom2_a + custom2_b + custom3_a + custom3_b + custom4_a + custom4_b;

  let effectivePlanned = plannedQty > 0 ? plannedQty : totalFromCustomRows;
  if (effectivePlanned <= 0) {
    if (holdingQty > 0) {
      effectivePlanned = Math.max(holdingQty, Math.round(holdingQty / 0.15));
    } else {
      effectivePlanned = 1000;
    }
  }

  const totalBought = Math.max(0, holdingQty);

  // 第一批15%
  const size1_a = custom1_a > 0 ? custom1_a : Math.round(effectivePlanned * 0.07);
  const size1_b = custom1_b > 0 ? custom1_b : Math.max(0, Math.ceil(effectivePlanned * 0.15) - size1_a);
  const size1 = size1_a + size1_b;

  // 第二批25%
  const size2_a = custom2_a > 0 ? custom2_a : Math.round(effectivePlanned * 0.10);
  const size2_b = custom2_b > 0 ? custom2_b : Math.max(0, Math.ceil(effectivePlanned * 0.25) - size2_a);
  const size2 = size2_a + size2_b;

  // 第三批35%
  const size3_a = custom3_a > 0 ? custom3_a : Math.round(effectivePlanned * 0.15);
  const size3_b = custom3_b > 0 ? custom3_b : Math.max(0, Math.ceil(effectivePlanned * 0.35) - size3_a);
  const size3 = size3_a + size3_b;

  // 第四批25%
  const size4_a = custom4_a > 0 ? custom4_a : Math.round(effectivePlanned * 0.10);
  const size4_b = custom4_b > 0 ? custom4_b : Math.max(0, Math.ceil(effectivePlanned * 0.25) - size4_a);
  const size4 = size4_a + size4_b;

  // 各批已購股數計算 (累進階梯)
  const bought1 = Math.min(totalBought, size1);
  const bought2 = Math.min(Math.max(0, totalBought - size1), size2);
  const bought3 = Math.min(Math.max(0, totalBought - size1 - size2), size3);
  const bought4 = Math.min(Math.max(0, totalBought - size1 - size2 - size3), size4);

  const batch1: BatchStageInfo = {
    batchNum: 1,
    batchTitle: "第一批15%",
    plannedQty: size1,
    boughtQty: bought1,
    remainingQty: Math.max(0, size1 - bought1),
  };
  const batch2: BatchStageInfo = {
    batchNum: 2,
    batchTitle: "第二批25%",
    plannedQty: size2,
    boughtQty: bought2,
    remainingQty: Math.max(0, size2 - bought2),
  };
  const batch3: BatchStageInfo = {
    batchNum: 3,
    batchTitle: "第三批35%",
    plannedQty: size3,
    boughtQty: bought3,
    remainingQty: Math.max(0, size3 - bought3),
  };
  const batch4: BatchStageInfo = {
    batchNum: 4,
    batchTitle: "第四批25%",
    plannedQty: size4,
    boughtQty: bought4,
    remainingQty: Math.max(0, size4 - bought4),
  };

  const batches = [batch1, batch2, batch3, batch4];

  // 判定目前所處批次 (1, 2, 3, 4)
  let currentNum = 1;
  if (totalBought > 0) {
    if (totalBought >= (size1 + size2 + size3)) {
      currentNum = 4;
    } else if (totalBought >= (size1 + size2)) {
      currentNum = 3;
    } else if (totalBought >= size1) {
      currentNum = 2;
    } else {
      currentNum = 1;
    }
  } else {
    // 依 dcaProgress 或 rows 標記輔助推算
    const p = (dcaProgress || "").replace(/\s+/g, "");
    if (p.includes("第四批") || p.includes("第4批") || p === "#4" || rowsSys2?.[3]?.bought || (parseFloat(rowsSys2?.[3]?.boughtQty || "") > 0) || rowsSys1?.[3]?.bought) {
      currentNum = 4;
    } else if (p.includes("第三批") || p.includes("第3批") || p === "#3" || rowsSys2?.[2]?.bought || (parseFloat(rowsSys2?.[2]?.boughtQty || "") > 0) || rowsSys1?.[2]?.bought) {
      currentNum = 3;
    } else if (p.includes("第二批") || p.includes("第2批") || p === "#2" || rowsSys2?.[1]?.bought || (parseFloat(rowsSys2?.[1]?.boughtQty || "") > 0) || rowsSys1?.[1]?.bought) {
      currentNum = 2;
    } else {
      currentNum = 1;
    }
  }

  const currentBatch = batches[currentNum - 1];
  // 若目前已經在第四批 則不須顯示下一批
  const nextBatch = currentNum < 4 ? batches[currentNum] : null;

  return {
    currentBatch,
    nextBatch,
    batches,
  };
}

/**
 * 自動且精準推算目前所處的拆分進度或攤平欄位
 * 依序檢查：
 * 1. 使用者在看板手動設定之 dcaProgress (8 大拆分交易選項之一或 #1~#4)
 * 2. 歷史交易記錄 (trades) 中選取之批次 (如 第一批拆分交易(8%)、第二批拆分交易(15%)、第三批拆分交易(20%) 等)
 * 3. 系統二 (averagingRowsSys2) 或系統一 (averagingRows) 的購買勾選標記
 * 4. 根據目前持股量 (holdingQty) 與規劃股數推算所處拆分階段
 */
export function getEffectiveDcaProgress(
  dcaProgress?: string,
  tab?: any,
  trades: any[] = [],
  holdingQty: number = 0,
  plannedQty: number = 0,
  strategy?: any
): string | undefined {
  const getMillis = (val: any): number => {
    if (!val) return 0;
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    if (typeof val.toMillis === "function") {
      try { return val.toMillis(); } catch {}
    }
    if (typeof val.toDate === "function") {
      try { return val.toDate().getTime(); } catch {}
    }
    if (val instanceof Date) return isNaN(val.getTime()) ? 0 : val.getTime();
    if (typeof val.seconds === "number") return val.seconds * 1000;
    if (typeof val._seconds === "number") return val._seconds * 1000;
    if (typeof val === "string") {
      const p = new Date(val).getTime();
      return isNaN(p) ? 0 : p;
    }
    return 0;
  };

  const getProgressRank = (val?: string): number => {
    if (!val) return 0;
    const v = val.replace(/\s+/g, "");
    if (v.includes("第四批") || v.includes("第4批") || v.includes("#4")) {
      return v.includes("15%") ? 8 : 7;
    }
    if (v.includes("第三批") || v.includes("第3批") || v.includes("#3")) {
      return v.includes("20%") ? 6 : 5;
    }
    if (v.includes("第二批") || v.includes("第2批") || v.includes("#2")) {
      return (v.includes("15%") || v.includes("25%")) ? 4 : 3;
    }
    if (v.includes("第一批") || v.includes("第1批") || v.includes("#1")) {
      return (v.includes("8%") || v.includes("15%")) ? 2 : 1;
    }
    return 0;
  };

  // 1. 從歷史交易記錄 (trades) 中檢查最高階段與最新階段
  let tradeDetected: string | undefined = undefined;
  let maxTradeDetected: string | undefined = undefined;
  let maxRank = 0;

  if (trades && Array.isArray(trades) && trades.length > 0) {
    // 依交易時間降冪排序（最新交易優先）
    const sortedTrades = [...trades].sort((a, b) => {
      const timeA = getMillis(a.tradeDate) || getMillis(a.createdAt);
      const timeB = getMillis(b.tradeDate) || getMillis(b.createdAt);
      return timeB - timeA;
    });

    for (const t of sortedTrades) {
      if (t.batch && typeof t.batch === "string") {
        const b = t.batch.replace(/\s+/g, "");
        // 嚴格比對 8 種拆分交易選項
        for (const opt of SPLIT_TRADE_OPTIONS) {
          const optClean = opt.id.replace(/\s+/g, "");
          const optShortClean = opt.shortName.replace(/\s+/g, "");
          if (b.includes(optClean) || b.includes(optShortClean) || (b.includes(opt.batchGroup) && b.includes(opt.percentText))) {
            if (!tradeDetected) tradeDetected = opt.id;
            const r = getProgressRank(opt.id);
            if (r > maxRank) {
              maxRank = r;
              maxTradeDetected = opt.id;
            }
          }
        }

        // 支援一般批次選項 (例如 "第四批交易 (25%)", "第四批", "#4", "第4批")
        if (b.includes("第四批") || b.includes("第4批") || b.includes("#4")) {
          const id = b.includes("15%") ? "第四批拆分交易(15%)" : "第四批拆分交易(10%)";
          if (!tradeDetected) tradeDetected = id;
          const r = getProgressRank(id);
          if (r > maxRank) { maxRank = r; maxTradeDetected = id; }
        } else if (b.includes("第三批") || b.includes("第3批") || b.includes("#3")) {
          const id = b.includes("20%") ? "第三批拆分交易(20%)" : "第三批拆分交易(15%)";
          if (!tradeDetected) tradeDetected = id;
          const r = getProgressRank(id);
          if (r > maxRank) { maxRank = r; maxTradeDetected = id; }
        } else if (b.includes("第二批") || b.includes("第2批") || b.includes("#2")) {
          const id = (b.includes("15%") || b.includes("25%")) ? "第二批拆分交易(15%)" : "第二批拆分交易(10%)";
          if (!tradeDetected) tradeDetected = id;
          const r = getProgressRank(id);
          if (r > maxRank) { maxRank = r; maxTradeDetected = id; }
        } else if (b.includes("第一批") || b.includes("第1批") || b.includes("#1")) {
          const id = (b.includes("8%") || b.includes("15%")) ? "第一批拆分交易(8%)" : "第一批拆分交易(7%)";
          if (!tradeDetected) tradeDetected = id;
          const r = getProgressRank(id);
          if (r > maxRank) { maxRank = r; maxTradeDetected = id; }
        }
      }
    }
  }

  // 2. 取得自訂拆分股數並計算累計門檻
  const rowsSys2 = tab?.averagingRowsSys2 || strategy?.averagingRowsSys2;
  const rowsSys1 = tab?.averagingRows || strategy?.averagingRows;

  const q1_0 = parseFloat(rowsSys2?.[0]?.quantity || rowsSys1?.[0]?.quantity || "0") || 0;
  const q2_0 = parseFloat(rowsSys2?.[0]?.quantity2 || rowsSys1?.[0]?.quantity2 || "0") || 0;
  const q1_1 = parseFloat(rowsSys2?.[1]?.quantity || rowsSys1?.[1]?.quantity || "0") || 0;
  const q2_1 = parseFloat(rowsSys2?.[1]?.quantity2 || rowsSys1?.[1]?.quantity2 || "0") || 0;
  const q1_2 = parseFloat(rowsSys2?.[2]?.quantity || rowsSys1?.[2]?.quantity || "0") || 0;
  const q2_2 = parseFloat(rowsSys2?.[2]?.quantity2 || rowsSys1?.[2]?.quantity2 || "0") || 0;
  const q1_3 = parseFloat(rowsSys2?.[3]?.quantity || rowsSys1?.[3]?.quantity || "0") || 0;
  const q2_3 = parseFloat(rowsSys2?.[3]?.quantity2 || rowsSys1?.[3]?.quantity2 || "0") || 0;

  const totalCustom = q1_0 + q2_0 + q1_1 + q2_1 + q1_2 + q2_2 + q1_3 + q2_3;
  const effPlanned = plannedQty > 0 ? plannedQty : (totalCustom > 0 ? totalCustom : (holdingQty > 0 ? holdingQty : 1000));

  const s1_a = q1_0 > 0 ? q1_0 : Math.round(effPlanned * 0.07);
  const s1_b = q2_0 > 0 ? q2_0 : Math.max(0, Math.ceil(effPlanned * 0.15) - s1_a);
  const s1 = s1_a + s1_b;

  const s2_a = q1_1 > 0 ? q1_1 : Math.round(effPlanned * 0.10);
  const s2_b = q2_1 > 0 ? q2_1 : Math.max(0, Math.ceil(effPlanned * 0.25) - s2_a);
  const s2 = s2_a + s2_b;

  const s3_a = q1_2 > 0 ? q1_2 : Math.round(effPlanned * 0.15);
  const s3_b = q2_2 > 0 ? q2_2 : Math.max(0, Math.ceil(effPlanned * 0.35) - s3_a);
  const s3 = s3_a + s3_b;

  const s4_a = q1_3 > 0 ? q1_3 : Math.round(effPlanned * 0.10);

  // 3. 根據已購持股數量判定拆分階段
  let holdingDetected: string | undefined = undefined;
  if (holdingQty > 0) {
    if (holdingQty >= (s1 + s2 + s3 + s4_a)) {
      holdingDetected = "第四批拆分交易(15%)";
    } else if (holdingQty >= (s1 + s2 + s3)) {
      holdingDetected = "第四批拆分交易(10%)";
    } else if (holdingQty >= (s1 + s2 + s3_a)) {
      holdingDetected = "第三批拆分交易(20%)";
    } else if (holdingQty >= (s1 + s2)) {
      holdingDetected = "第三批拆分交易(15%)";
    } else if (holdingQty >= (s1 + s2_a)) {
      holdingDetected = "第二批拆分交易(15%)";
    } else if (holdingQty >= s1) {
      holdingDetected = "第二批拆分交易(10%)";
    } else if (holdingQty >= s1_a) {
      holdingDetected = "第一批拆分交易(8%)";
    } else {
      holdingDetected = "第一批拆分交易(7%)";
    }
  }

  // 4. 檢查系統二 (averagingRowsSys2) 或系統一 (averagingRows) 的購買標記
  let rowDetected: string | undefined = undefined;
  if (rowsSys2?.[3]?.bought || (parseFloat(rowsSys2?.[3]?.boughtQty) > 0) || rowsSys1?.[3]?.bought) {
    rowDetected = "第四批拆分交易(15%)";
  } else if (rowsSys2?.[2]?.bought || (parseFloat(rowsSys2?.[2]?.boughtQty) > 0) || rowsSys1?.[2]?.bought) {
    rowDetected = "第四批拆分交易(10%)";
  } else if (rowsSys2?.[1]?.bought || (parseFloat(rowsSys2?.[1]?.boughtQty) > 0) || rowsSys1?.[1]?.bought) {
    rowDetected = "第三批拆分交易(15%)";
  } else if (rowsSys2?.[0]?.bought || (parseFloat(rowsSys2?.[0]?.boughtQty) > 0) || rowsSys1?.[0]?.bought) {
    rowDetected = "第二批拆分交易(10%)";
  }

  // 5. 評估各來源的階段等級
  const manualRank = getProgressRank(dcaProgress);
  const tradeRank = Math.max(getProgressRank(tradeDetected), maxRank);
  const rowRank = getProgressRank(rowDetected);
  const holdingRank = getProgressRank(holdingDetected);

  // 若真實持股、真實/模擬交易或系統攤平列已推進到更高的批次，取實際進度最高者，避免被舊設定卡住
  const maxActualRank = Math.max(tradeRank, rowRank, holdingRank);
  if (maxActualRank > manualRank) {
    if (holdingRank === maxActualRank && holdingDetected) return holdingDetected;
    if (tradeRank === maxActualRank && maxTradeDetected) return maxTradeDetected;
    if (rowRank === maxActualRank && rowDetected) return rowDetected;
  }

  if (dcaProgress) return dcaProgress;
  if (holdingDetected) return holdingDetected;
  if (maxTradeDetected) return maxTradeDetected;
  if (rowDetected) return rowDetected;

  return undefined;
}

/**
 * 取得個股的基準倉位與強制平倉價位
 */
export function getStockBaseAndForceClosePrices(
  tab?: any,
  strategy?: any,
  overridePrice?: number
): {
  basePrice: number | null;
  forceClosePrice: number | null;
} {
  if (!tab && !strategy && !overridePrice) return { basePrice: null, forceClosePrice: null };

  let basePrice: number | null = null;
  let forceClosePrice: number | null = null;

  const rowsSys2 = tab?.averagingRowsSys2 || strategy?.averagingRowsSys2;
  const rowsSys1 = tab?.averagingRows || strategy?.averagingRows;

  // 1. 優先從系統二 (averagingRowsSys2) 取得：第 2 欄 (-6%) 為基準倉位，第 4 欄 (-12%) 為強制平倉
  if (rowsSys2 && Array.isArray(rowsSys2)) {
    const p1 = parseFloat(rowsSys2[1]?.price);
    if (!isNaN(p1) && p1 > 0) basePrice = p1;

    const p3 = parseFloat(rowsSys2[3]?.price);
    if (!isNaN(p3) && p3 > 0) forceClosePrice = p3;
  }

  // 2. 次優先從系統一 (averagingRows) 取得：第 3 欄 (-6%) 為基準倉位，第 6 欄 (-12%) 為強制平倉
  if (rowsSys1 && Array.isArray(rowsSys1)) {
    if (basePrice === null) {
      const p2 = parseFloat(rowsSys1[2]?.price);
      if (!isNaN(p2) && p2 > 0) basePrice = p2;
    }
    if (forceClosePrice === null) {
      const p5 = parseFloat(rowsSys1[5]?.price);
      if (!isNaN(p5) && p5 > 0) forceClosePrice = p5;
    }
  }

  // 3. 檢查停損價作為強制平倉
  const stopLoss = tab?.stopLossPrice || strategy?.stopLossPrice;
  if (forceClosePrice === null && stopLoss && Number(stopLoss) > 0) {
    forceClosePrice = Number(stopLoss);
  }

  // 4. 若仍無手動設定，依參考價 (refPnLPointSys2 / refPnLPoint / averageCost / currentPrice / overridePrice) 推算 -6% 基準倉位與 -12% 強制平倉
  const ref = parseFloat(
    tab?.refPnLPointSys2 || strategy?.refPnLPointSys2 ||
    tab?.refPnLPoint || strategy?.refPnLPoint ||
    tab?.averageCost || tab?.currentPrice || (overridePrice && overridePrice > 0 ? String(overridePrice) : "0")
  );
  if (ref > 0) {
    if (basePrice === null) {
      basePrice = Math.round(ref * 0.94 * 100) / 100; // -6%
    }
    if (forceClosePrice === null) {
      forceClosePrice = Math.round(ref * 0.88 * 100) / 100; // -12%
    }
  }

  return { basePrice, forceClosePrice };
}

// 預設標籤 Solid Color 明亮純色邊框色系選單 (包含 #DCFA57，改以明亮色系為主，預設黑為 1px)
export const TAG_COLOR_OPTIONS = [
  { id: "solid-default-black", label: "預設黑色 (1px)", bg: "#000000", border: "#27272A", isDefault: true },
  { id: "solid-lime-glow", label: "螢光黃綠 (#DCFA57)", bg: "#DCFA57", border: "#C8EA3E" },
  { id: "solid-sky-blue", label: "亮天藍", bg: "#38BDF8", border: "#0284C7" },
  { id: "solid-cyan", label: "亮天青", bg: "#22D3EE", border: "#06B6D4" },
  { id: "solid-emerald", label: "亮翡翠綠", bg: "#34D399", border: "#059669" },
  { id: "solid-green", label: "亮草綠", bg: "#4ADE80", border: "#16A34A" },
  { id: "solid-yellow", label: "亮檸檬黃", bg: "#FACC15", border: "#CA8A04" },
  { id: "solid-orange", label: "亮活力橙", bg: "#FB923C", border: "#EA580C" },
  { id: "solid-red", label: "鮮亮紅", bg: "#F87171", border: "#DC2626" },
  { id: "solid-pink", label: "亮霓虹粉", bg: "#F472B6", border: "#DB2777" },
  { id: "solid-purple", label: "亮薰衣紫", bg: "#C084FC", border: "#9333EA" },
  { id: "solid-indigo", label: "亮靛青紫", bg: "#818CF8", border: "#4F46E5" },
];

/**
 * 判斷顏色是否為淺色系，自適應深色/淺色排版字體
 */
export function isColorLight(hexOrRgb?: string): boolean {
  if (!hexOrRgb) return true;
  const lower = hexOrRgb.toLowerCase();
  if (
    lower === "#f7f5f5" ||
    lower === "#ffffff" ||
    lower === "#d2f800" ||
    lower === "#b5aaa0" ||
    lower === "#c4b3a3" ||
    lower === "#9c9283"
  ) {
    return true;
  }
  let c = hexOrRgb.replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  if (c.length === 6) {
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 165;
  }
  return true;
}

/**
 * 將顏色轉換為具有指定透明度的 rgba 字串
 */
export function hexToRgba(hexOrRgb?: string, alpha: number = 0.76): string {
  if (!hexOrRgb) return `rgba(247, 245, 245, ${alpha})`;
  if (hexOrRgb.startsWith("rgba")) return hexOrRgb;
  if (hexOrRgb.startsWith("rgb")) {
    return hexOrRgb.replace("rgb", "rgba").replace(")", `, ${alpha})`);
  }
  let c = hexOrRgb.replace("#", "");
  if (c.length === 3) {
    c = c.split("").map((x) => x + x).join("");
  }
  if (c.length === 6) {
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(247, 245, 245, ${alpha})`;
}

interface DynamicVisualLinesModalProps {
  isOpen: boolean;
  onClose: () => void;
  allTabs: StockTab[];
  selectedCardIds?: Set<string>;
  onSelectAllCards?: () => void;
  onDeselectAllCards?: () => void;
  onToggleCardSelected?: (tabId: string) => void;
  userId?: string;
  initialTradeType?: "active" | "real" | "all" | "completed";
  onSelectStock?: (tabId: string, symbol: string) => void;
  strategiesMap?: Record<string, any>;
  tradesMap?: Record<string, any[]>;
  statsMap?: Record<
    string,
    {
      averagePrice?: number;
      totalQuantity?: number;
      unrealizedPnL?: number;
      unrealizedPnLPercent?: number;
      realizedPnL?: number;
    }
  >;
  maxStrategyRiskPool60?: number;
}

// 6 Horizontal Visual Lines (黑色: D軸, 藍色: B軸, 綠色: G軸, 黃色: Y軸, 紅色: R軸)
export const VISUAL_LINES = [
  { id: "line-top-yellow", axis: "Y", yPercent: 12, color: "#EAB308", label: "頂部獲利", desc: "Take Profit / 極限超買" },
  { id: "line-red", axis: "R", yPercent: 28, color: "#EF4444", label: "停損警戒", desc: "Stop Loss / 阻力警戒" },
  { id: "line-black", axis: "D", yPercent: 44, color: "#000000", label: "基準中軸", desc: "Base / 成本平衡線" },
  { id: "line-blue", axis: "B", yPercent: 60, color: "#2563EB", label: "回檔加碼", desc: "Support / 回檔支撐" },
  { id: "line-green", axis: "G", yPercent: 76, color: "#16A34A", label: "底部買進", desc: "Floor / 強力買進" },
  { id: "line-bottom-yellow", axis: "Y", yPercent: 90, color: "#EAB308", label: "深幅價值", desc: "Deep Value / 極限超賣" },
];

// 5 Background Color Bands Between the 6 Lines
export const VISUAL_BANDS = [
  {
    id: "band-pink",
    top: 12,
    bottom: 28,
    bg: "rgba(244, 63, 94, 0.08)", // 淡粉紅色帶 (深色模式微透光)
    label: "淡粉紅色區域",
  },
  {
    id: "band-gray",
    top: 28,
    bottom: 44,
    bg: "rgba(255, 255, 255, 0.02)", // 淡灰色帶
    label: "淡灰色區域",
  },
  {
    id: "band-blue",
    top: 44,
    bottom: 60,
    bg: "rgba(59, 130, 246, 0.08)", // 淡藍色帶
    label: "淡藍色區域",
  },
  {
    id: "band-emerald",
    top: 60,
    bottom: 76,
    bg: "rgba(16, 185, 129, 0.08)", // 淡青綠色帶
    label: "淡青綠色區域",
  },
  {
    id: "band-gold",
    top: 76,
    bottom: 90,
    bg: "rgba(234, 179, 8, 0.08)", // 淡金色帶
    label: "淡金色區域",
  },
];

// 輔助測試基準線 (包含 6 大主軸 12/28/44/60/76/90% 與 5 大區間中線 20/36/52/68/83%)
export const AUXILIARY_TEST_INTERVALS = [
  { yPercent: 12, label: "頂黃 Y軸 (12.0%)", isMain: true, color: "#EAB308", desc: "頂部獲利 / Take Profit" },
  { yPercent: 20, label: "Y-R 中線 (20.0%)", isMain: false, color: "#FB7185", desc: "淡粉紅中線" },
  { yPercent: 28, label: "紅色 R軸 (28.0%)", isMain: true, color: "#EF4444", desc: "停損警戒 / Stop Loss" },
  { yPercent: 36, label: "R-D 中線 (36.0%)", isMain: false, color: "#9CA3AF", desc: "淡灰中線" },
  { yPercent: 44, label: "黑色 D軸 (44.0%)", isMain: true, color: "#000000", desc: "基準中軸 / Base Balance" },
  { yPercent: 52, label: "D-B 中線 (52.0%)", isMain: false, color: "#60A5FA", desc: "淡藍中線" },
  { yPercent: 60, label: "藍色 B軸 (60.0%)", isMain: true, color: "#2563EB", desc: "回檔加碼 / Support" },
  { yPercent: 68, label: "B-G 中線 (68.0%)", isMain: false, color: "#34D399", desc: "淡青綠中線" },
  { yPercent: 76, label: "綠色 G軸 (76.0%)", isMain: true, color: "#16A34A", desc: "底部買進 / Floor Buy" },
  { yPercent: 83, label: "G-Y 中線 (83.0%)", isMain: false, color: "#FACC15", desc: "淡金中線" },
  { yPercent: 90, label: "底黃 Y軸 (90.0%)", isMain: true, color: "#EAB308", desc: "深幅價值 / Deep Value" },
];

export const HOLDING_CONFIG: Record<
  string,
  {
    labelActive: string;
    labelReal: string;
    icon: React.ElementType;
    color: string;
    bg: string;
    border: string;
    dot: string;
    badge: string;
  }
> = {
  "觀察中": {
    labelActive: "虛擬交易",
    labelReal: "觀察中",
    icon: Eye,
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-200",
    dot: "bg-sky-500",
    badge: "bg-sky-100 text-sky-800",
  },
  "候選名單": {
    labelActive: "候選名單",
    labelReal: "候選名單",
    icon: Star,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-800",
  },
  "買進操作": {
    labelActive: "買進操作",
    labelReal: "買進操作",
    icon: TrendingUp,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-800",
  },
  "賣出操作": {
    labelActive: "賣出操作",
    labelReal: "賣出操作",
    icon: TrendingDown,
    color: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
    dot: "bg-rose-500",
    badge: "bg-rose-100 text-rose-800",
  },
  "平倉操作": {
    labelActive: "平倉操作",
    labelReal: "平倉操作",
    icon: CheckCircle2,
    color: "text-fuchsia-600",
    bg: "bg-fuchsia-50",
    border: "border-fuchsia-200",
    dot: "bg-fuchsia-500",
    badge: "bg-fuchsia-100 text-fuchsia-800",
  },
  "乖離名單": {
    labelActive: "乖離名單",
    labelReal: "乖離名單",
    icon: Activity,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    dot: "bg-indigo-500",
    badge: "bg-indigo-100 text-indigo-800",
  },
};

export const SUB_TABS_LIST = [
  "觀察中",
  "候選名單",
  "買進操作",
  "賣出操作",
  "平倉操作",
  "乖離名單",
] as const;

// 支援滑鼠拖曳與滾輪的水平滾動 Hook (Drag-and-Scroll)
function useDragToScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const isDraggingRef = useRef(false);
  const justDraggedRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // 僅支援滑鼠左鍵
    if (e.button !== 0 || !ref.current) return;
    const target = e.target as HTMLElement;
    // 不攔截文字輸入框等
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;

    isDownRef.current = true;
    startXRef.current = e.clientX;
    scrollLeftRef.current = ref.current.scrollLeft;
    isDraggingRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDownRef.current || !ref.current) return;
    const dx = e.clientX - startXRef.current;
    if (!isDraggingRef.current && Math.abs(dx) > 4) {
      isDraggingRef.current = true;
    }
    if (isDraggingRef.current) {
      ref.current.scrollLeft = scrollLeftRef.current - dx;
    }
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current) {
      justDraggedRef.current = true;
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 80);
    }
    isDownRef.current = false;
    isDraggingRef.current = false;
  };

  const handleMouseLeave = () => {
    if (isDraggingRef.current) {
      justDraggedRef.current = true;
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 80);
    }
    isDownRef.current = false;
    isDraggingRef.current = false;
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (justDraggedRef.current || isDraggingRef.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (ref.current && e.deltaY && !e.deltaX) {
      ref.current.scrollLeft += e.deltaY;
    }
  };

  return {
    ref,
    props: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
      onClickCapture: handleClickCapture,
      onWheel: handleWheel,
    },
  };
}

export const DynamicVisualLinesModal: React.FC<DynamicVisualLinesModalProps> = ({
  isOpen,
  onClose,
  allTabs,
  selectedCardIds,
  onSelectAllCards,
  onDeselectAllCards,
  onToggleCardSelected,
  userId,
  initialTradeType = "active",
  onSelectStock,
  strategiesMap,
  tradesMap,
  statsMap,
  maxStrategyRiskPool60,
}) => {
  // 1. 交易總覽主分頁選單 ("active" | "real" | "completed" | "all")
  const [mainTabFilter, setMainTabFilter] = useState<"active" | "real" | "completed" | "all">(
    initialTradeType === "real"
      ? "real"
      : initialTradeType === "completed"
      ? "completed"
      : initialTradeType === "all"
      ? "all"
      : "active"
  );

  // 1.5 交易模式 Tabs 狀態 ("simulated" 虛擬交易 | "real" 真實交易 | "all" 全部)
  const [activeTradeModeTab, setActiveTradeModeTab] = useState<"simulated" | "real" | "all">(() => {
    if (initialTradeType === "real") return "real";
    return "simulated";
  });

  // 上方按鈕區塊水平拖曳滾動 (Drag-to-Scroll)
  const topBarDrag = useDragToScroll();
  const subBarDrag = useDragToScroll();

  // 2. 子分頁分類選單 ("all" 或特定子分頁)
  const [selectedSubTab, setSelectedSubTab] = useState<string>("all");

  // 3. 搜尋股票代號
  const [stockSearchQuery, setStockSearchQuery] = useState("");

  // 篩選標籤：只顯示交易中
  const [showOnlyTrading, setShowOnlyTrading] = useState<boolean>(false);

  // 下拉選單開關
  const [isMainTabDropdownOpen, setIsMainTabDropdownOpen] = useState(false);
  const [isSubTabDropdownOpen, setIsSubTabDropdownOpen] = useState(false);
  const [isStockDropdownOpen, setIsStockDropdownOpen] = useState(false);
  const [isSplitTradeDropdownOpen, setIsSplitTradeDropdownOpen] = useState(false);

  // 輔助視覺狀態 - 預設不顯示線條標籤
  const [showLineLabels, setShowLineLabels] = useState(false);
  const [showPriceBadge, setShowPriceBadge] = useState(false);
  // 輔助線測試狀態 - 統一基準點與輔助線座標診斷
  const [showAuxiliaryTestLines, setShowAuxiliaryTestLines] = useState(false);
  const [selectedDiagnosticSymbol, setSelectedDiagnosticSymbol] = useState<string | null>(null);
  const [hoveredDiagnosticSymbol, setHoveredDiagnosticSymbol] = useState<string | null>(null);

  // 框選矩形區域 (像素座標，滑鼠在畫布空白處拖曳即自動框選)
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // 顯示隱藏標籤開關 (預設 false: 隱藏標籤不渲染；true: 隱藏標籤以半透明顯示)
  const [showHiddenTags, setShowHiddenTags] = useState(false);

  // 勾選的個別股票標籤（用於個別尺寸調整、顏色套用或隱藏操作）
  const [selectedTagSymbols, setSelectedTagSymbols] = useState<string[]>([]);

  // Primial 分批進場金字塔動態互動圖表視圖開關與當前聚焦個股 (Alt+Z)
  const [showPyramidView, setShowPyramidView] = useState<boolean>(false);
  const [activePyramidSymbol, setActivePyramidSymbol] = useState<string>("");
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});
  const pyramidScrollContainerRef = useRef<HTMLDivElement>(null);

  // 分批進場金字塔圖表之卡片分隔線 (Alt+D)、支撐 (Alt+R)、壓力 (Alt+P)、攤平與突破價位 (Alt+T / Alt+B) 狀態控制
  const [pyramidShowCardDividers, setPyramidShowCardDividers] = useState<boolean>(false);
  // 行權價開關狀態 (預設關閉，點擊後開啟顯示期權黑色虛線/行權價/合約金額/當前損益)
  const [pyramidShowStrikePrices, setPyramidShowStrikePrices] = useState<boolean>(false);
  const handleTogglePyramidStrikePrices = useCallback(() => {
    playClickSound();
    setPyramidShowStrikePrices((prev) => {
      const next = !prev;
      toast.info(next ? "已開啟「行權價」黑色虛線與合約金額" : "已關閉「行權價」顯示", {
        id: "pyramid-strike-toggle",
        duration: 1500,
      });
      return next;
    });
  }, [playClickSound]);
  const [pyramidCalcMode, setPyramidCalcMode] = useState<"averaging" | "breakout">("averaging");
  const [pyramidLevelTypes, setPyramidLevelTypes] = useState<{
    support: boolean;
    stopLoss: boolean;
    resistance: boolean;
    takeProfit: boolean;
  }>({
    support: true,
    stopLoss: false,
    resistance: false,
    takeProfit: false,
  });

  // 全域標籤尺寸調整偏移量 (每次 +/- 2px，儲存至 localStorage)
  const [tagSizeOffset, setTagSizeOffset] = useState<number>(() => {
    return getVisualLinesDataSync(userId).tagSizeOffset;
  });

  // 標籤位置狀態（同步即時由記憶體/本地讀取，0ms 開啟）
  const [positions, setPositions] = useState<PositionMap>(() => {
    return getVisualLinesDataSync(userId).positions;
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingPositions, setIsUpdatingPositions] = useState(false);

  // 即時現價快取與抓取狀態 (針對 INTC 等尚未有現價之個股或手動更新)
  const [livePrices, setLivePrices] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("visual_lines_live_prices");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [isFetchingPriceMap, setIsFetchingPriceMap] = useState<Record<string, boolean>>({});
  const [isRefreshingAllPrices, setIsRefreshingAllPrices] = useState(false);
  const attemptedAutoFetchSymbolsRef = useRef<Set<string>>(new Set());

  // Modal 關閉時清空已嘗試自動抓取的標籤紀錄
  useEffect(() => {
    if (!isOpen) {
      attemptedAutoFetchSymbolsRef.current.clear();
    }
  }, [isOpen]);

  // 抓取指定個股的最新即時現價
  const fetchLivePriceForSymbol = useCallback(
    async (sym: string, showToast = false) => {
      const upperSym = sym.trim().toUpperCase();
      if (!upperSym) return null;

      setIsFetchingPriceMap((prev) => ({ ...prev, [upperSym]: true }));
      try {
        const response = await fetch(`/api/stock/${encodeURIComponent(upperSym)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const price =
          typeof data?.price === "number" && data.price > 0
            ? data.price
            : data?.chart?.result?.[0]?.meta?.regularMarketPrice;

        if (price && typeof price === "number" && price > 0) {
          setLivePrices((prev) => {
            const next = { ...prev, [upperSym]: price };
            try {
              localStorage.setItem("visual_lines_live_prices", JSON.stringify(next));
            } catch {
              // ignore
            }
            return next;
          });

          // 注意：為確保「視覺圖示化卡片」上的自訂分隔線與價格坐標系統絕對穩定不偏移，
          // 動態視覺線看板抓取的即時現價僅維護於本看板的 livePrices 中，
          // 絕不同步複寫 Firestore stockTabs 卡片數據，避免破壞使用者在卡片上設定的分隔線位置。

          if (showToast) {
            playSuccessSound();
            toast.success(`已成功抓取 ${upperSym} 最新現價：$${price.toFixed(2)}`, {
              id: `price-${upperSym}`,
            });
          }
          return price;
        } else {
          if (showToast) {
            toast.error(`無法取得 ${upperSym} 現價，請確認代號是否正確`);
          }
          return null;
        }
      } catch (err) {
        console.error(`Fetch price failed for ${upperSym}:`, err);
        if (showToast) {
          toast.error(`抓取 ${upperSym} 現價時發生網路錯誤`);
        }
        return null;
      } finally {
        setIsFetchingPriceMap((prev) => ({ ...prev, [upperSym]: false }));
      }
    },
    [allTabs]
  );

  // 批次抓取多檔個股的最新現價
  const fetchPricesForSymbols = useCallback(
    async (symbols: string[], showFeedback = false) => {
      const validSyms = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()))).filter(Boolean);
      if (validSyms.length === 0) return;

      setIsRefreshingAllPrices(true);
      if (showFeedback) {
        toast.info(`正在更新 ${validSyms.length} 檔股票最新現價...`, { id: "refresh-prices" });
      }

      let successCount = 0;
      await Promise.allSettled(
        validSyms.map(async (sym) => {
          const res = await fetchLivePriceForSymbol(sym, false);
          if (res && res > 0) successCount++;
        })
      );

      setIsRefreshingAllPrices(false);
      if (showFeedback) {
        if (successCount > 0) {
          playSuccessSound();
          toast.success(`成功更新 ${successCount} 檔股票最新現價！`, { id: "refresh-prices" });
        } else {
          toast.error("更新現價失敗，請稍候重試", { id: "refresh-prices" });
        }
      }
    },
    [fetchLivePriceForSymbol]
  );

  // 手動一鍵重新抓取畫布所有可見股票最新現價
  const handleRefreshAllCanvasPrices = () => {
    if (activeCanvasSymbols.length === 0) {
      toast.info("目前畫布上沒有股票標籤");
      return;
    }
    playClickSound();
    fetchPricesForSymbols(activeCanvasSymbols, true);
  };

  const canvasRef = useRef<HTMLDivElement>(null);
  const mainTabDropdownRef = useRef<HTMLDivElement>(null);
  const subTabDropdownRef = useRef<HTMLDivElement>(null);
  const stockDropdownRef = useRef<HTMLDivElement>(null);
  const splitTradeDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 拖曳狀態
  const draggingSymbolRef = useRef<string | null>(null);
  const dragOffsetRef = useRef<{ offsetX: number; offsetY: number }>({ offsetX: 0, offsetY: 0 });

  // 畫布視角垂直滾動平移 (Canvas Viewport Pan Y - 透過滾輪上下平移，方便查看被頂部按鈕欄遮擋的快顯示窗或底部文字，不影響個股所在位置)
  const [canvasPanY, setCanvasPanY] = useState<number>(0);
  const canvasPanYRef = useRef<number>(0);
  useEffect(() => {
    canvasPanYRef.current = canvasPanY;
  }, [canvasPanY]);

  // 切換主/子分頁或重新開啟時自動復位視角
  useEffect(() => {
    setCanvasPanY(0);
  }, [isOpen, mainTabFilter, activeTradeModeTab, selectedSubTab]);

  // 監聽畫布原生 wheel 滾輪事件，上下平移視角（支援阻止外層滾動並提供物理阻尼流暢體驗）
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl || !isOpen) return;

    const handleWheel = (e: WheelEvent) => {
      // 若游標正位於有內部滾動條的面板（例如診斷清單、下拉選單等），則保留其正常內部滾動
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[data-scrollable], .overflow-y-auto, .overflow-auto, select, textarea")) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      // deltaY > 0 (滾輪向下滾動) -> 視角向下看，畫布整體向上移動 (canvasPanY 減少，露出底部被擋住的股票或文字)
      // deltaY < 0 (滾輪向上滾動) -> 視角向上看，畫布整體向下移動 (canvasPanY 增加，露出頂部被固定按鈕列擋住的快顯示窗)
      setCanvasPanY((prev) => {
        const next = prev - e.deltaY * 0.85;
        // 限制在上下各 800px 範圍，防止無限滾動飄移
        return Math.max(-800, Math.min(800, Math.round(next)));
      });
    };

    canvasEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      canvasEl.removeEventListener("wheel", handleWheel);
    };
  }, [isOpen]);

  // 雙擊畫布空白處快速復位視角
  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent) => {
    const targetEl = e.target as HTMLElement | null;
    if (
      targetEl &&
      (targetEl.closest("button") ||
        targetEl.closest("input") ||
        targetEl.closest("[data-tag-symbol]") ||
        targetEl.closest("[data-no-marquee]"))
    ) {
      return;
    }
    if (canvasPanYRef.current !== 0) {
      playClickSound();
      setCanvasPanY(0);
      toast.info("已恢復預設視角 (0px)");
    }
  }, []);

  // 載入已儲存的標籤位置、形狀與大小 (0ms 讀取快取 + 背景靜默非同步複驗)
  const loadPositions = useCallback(() => {
    const data = getVisualLinesDataSync(userId);
    setPositions(data.positions);
    setTagSizeOffset(data.tagSizeOffset);
    setHasUnsavedChanges(false);

    // 背景靜默複驗 Firestore（不卡頓、不阻塞 UI）
    revalidateVisualLinesDataAsync(userId, (fresh) => {
      setPositions(fresh.positions);
      setTagSizeOffset(fresh.tagSizeOffset);
    });
  }, [userId]);

  useEffect(() => {
    if (isOpen) {
      loadPositions();
    }
  }, [isOpen, loadPositions]);

  // 即時監聽個別標籤位置儲存事件，達成雙向同步
  useEffect(() => {
    const handlePositionsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ symbol: string; position: { x: number; y: number }; allPositions?: PositionMap }>;
      if (customEvent.detail?.allPositions) {
        setPositions(customEvent.detail.allPositions);
      } else if (customEvent.detail?.symbol && customEvent.detail?.position) {
        setPositions((prev) => ({
          ...prev,
          [customEvent.detail.symbol]: {
            ...prev[customEvent.detail.symbol],
            ...customEvent.detail.position,
            updatedAt: new Date().toISOString(),
          },
        }));
      }
    };

    window.addEventListener("visual_lines_positions_updated", handlePositionsUpdated);
    return () => window.removeEventListener("visual_lines_positions_updated", handlePositionsUpdated);
  }, []);

  // 切換主分頁時自動重設子分頁為全部，並連動交易模式 Tabs
  const handleSelectMainTab = (newMainTab: "active" | "real" | "completed" | "all") => {
    playClickSound();
    setMainTabFilter(newMainTab);
    if (newMainTab === "real") {
      setActiveTradeModeTab("real");
    } else if (newMainTab === "active") {
      setActiveTradeModeTab("simulated");
    } else if (newMainTab === "all") {
      setActiveTradeModeTab("all");
    }
    setSelectedSubTab("all");
    setIsMainTabDropdownOpen(false);
  };

  // 切換交易模式 Tabs (虛擬交易 | 真實交易 | 全部)
  const handleTradeModeTabChange = (mode: "simulated" | "real" | "all") => {
    playClickSound();
    setActiveTradeModeTab(mode);
    if (mode === "real") {
      setMainTabFilter("real");
    } else if (mode === "simulated") {
      setMainTabFilter("active");
    } else {
      setMainTabFilter("all");
    }
    setSelectedSubTab("all");
    setIsMainTabDropdownOpen(false);
    setIsSubTabDropdownOpen(false);
    setIsStockDropdownOpen(false);
  };

  // 點擊外部關閉下拉選單
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!target || (target instanceof Element && !document.body.contains(target))) {
        return;
      }
      if (mainTabDropdownRef.current && !mainTabDropdownRef.current.contains(target)) {
        setIsMainTabDropdownOpen(false);
      }
      if (subTabDropdownRef.current && !subTabDropdownRef.current.contains(target)) {
        setIsSubTabDropdownOpen(false);
      }
      if (stockDropdownRef.current && !stockDropdownRef.current.contains(target)) {
        setIsStockDropdownOpen(false);
      }
      if (splitTradeDropdownRef.current && !splitTradeDropdownRef.current.contains(target)) {
        setIsSplitTradeDropdownOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener("mousedown", handleClickOutside);
      return () => window.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // 1. 虛擬交易股票 Map (排除 COMPLETED，若同一代號有複數張卡片，嚴格優先選取 Tickbox 勾選者，若皆勾選或皆未勾選則依評分最高者)
  const simulatedStockMap = useMemo(() => {
    const map = new Map<string, StockTab>();
    const simTabs = allTabs.filter(
      (t) => t.status !== "COMPLETED" && t.tradeType !== "real" && (t.symbol || "").trim() !== ""
    );

    const groups = new Map<string, StockTab[]>();
    simTabs.forEach((t) => {
      const sym = (t?.symbol || "").trim().toUpperCase();
      if (!sym) return;
      if (!groups.has(sym)) groups.set(sym, []);
      groups.get(sym)!.push(t);
    });

    groups.forEach((tabsForSym, sym) => {
      if (tabsForSym.length === 1) {
        map.set(sym, tabsForSym[0]);
      } else {
        const checked = selectedCardIds ? tabsForSym.filter((t) => selectedCardIds.has(t.id)) : [];
        const candidates = checked.length > 0 ? checked : tabsForSym;

        const scored = candidates.map((t) => {
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
            score: isEligible + dividerCount * 10 + hasPrice * 50,
            updateTime,
          };
        });
        scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : b.updateTime - a.updateTime));
        map.set(sym, scored[0].tab);
      }
    });

    // 補足其餘非活躍（如 COMPLETED）的虛擬交易卡片作為備援
    allTabs
      .filter((t) => t.tradeType !== "real" && (t?.symbol || "").trim() !== "")
      .forEach((t) => {
        const sym = (t?.symbol || "").trim().toUpperCase();
        if (sym && !map.has(sym)) {
          map.set(sym, t);
        }
      });

    return map;
  }, [allTabs, selectedCardIds, strategiesMap, statsMap]);

  // 2. 真實交易股票 Map (排除 COMPLETED，若同一代號有複數張卡片，嚴格優先選取 Tickbox 勾選者，若皆勾選或皆未勾選則依評分最高者)
  const realStockMap = useMemo(() => {
    const map = new Map<string, StockTab>();
    const realTabs = allTabs.filter(
      (t) => t.status !== "COMPLETED" && t.tradeType === "real" && (t?.symbol || "").trim() !== ""
    );

    const groups = new Map<string, StockTab[]>();
    realTabs.forEach((t) => {
      const sym = (t?.symbol || "").trim().toUpperCase();
      if (!sym) return;
      if (!groups.has(sym)) groups.set(sym, []);
      groups.get(sym)!.push(t);
    });

    groups.forEach((tabsForSym, sym) => {
      if (tabsForSym.length === 1) {
        map.set(sym, tabsForSym[0]);
      } else {
        const checked = selectedCardIds ? tabsForSym.filter((t) => selectedCardIds.has(t.id)) : [];
        const candidates = checked.length > 0 ? checked : tabsForSym;

        const scored = candidates.map((t) => {
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
            score: isEligible + dividerCount * 10 + hasPrice * 50,
            updateTime,
          };
        });
        scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : b.updateTime - a.updateTime));
        map.set(sym, scored[0].tab);
      }
    });

    // 補足其餘非活躍（如 COMPLETED）的真實交易卡片作為備援
    allTabs
      .filter((t) => t.tradeType === "real" && (t?.symbol || "").trim() !== "")
      .forEach((t) => {
        const sym = (t?.symbol || "").trim().toUpperCase();
        if (sym && !map.has(sym)) {
          map.set(sym, t);
        }
      });

    return map;
  }, [allTabs, selectedCardIds, strategiesMap, statsMap]);

  // 3. 綜合股票 Map (用於全部模式，若同股票在真實與虛擬皆有，優先依勾選狀態，若皆有勾選或皆未勾選則以真實交易卡片或有現價者優先)
  const combinedStockMap = useMemo(() => {
    const map = new Map<string, StockTab>();

    // 先放入虛擬交易卡片
    simulatedStockMap.forEach((tab, sym) => {
      map.set(sym, tab);
    });

    // 放入真實交易卡片
    realStockMap.forEach((tab, sym) => {
      const existing = map.get(sym);
      if (!existing) {
        map.set(sym, tab);
      } else {
        const isRealChecked = selectedCardIds?.has(tab.id);
        const isSimChecked = selectedCardIds?.has(existing.id);
        if (isRealChecked && !isSimChecked) {
          map.set(sym, tab);
        } else if (!isRealChecked && isSimChecked) {
          // 保留虛擬
        } else {
          // 兩邊皆勾選或皆未勾選，優先選擇有現價者，若皆有現價或皆無現價則真實交易卡片優先
          const tabHasPrice = tab.currentPrice !== undefined && Number(tab.currentPrice) > 0;
          const existingHasPrice = existing.currentPrice !== undefined && Number(existing.currentPrice) > 0;
          if (!existingHasPrice && tabHasPrice) {
            map.set(sym, tab);
          } else if (existingHasPrice && !tabHasPrice) {
            // 保留 existing (有現價)
          } else {
            map.set(sym, tab);
          }
        }
      }
    });

    // 補充其餘分頁
    allTabs.forEach((t) => {
      const sym = (t.symbol || "").trim().toUpperCase();
      if (sym && !map.has(sym)) {
        map.set(sym, t);
      }
    });

    return map;
  }, [simulatedStockMap, realStockMap, allTabs, selectedCardIds]);

  // 4. 全部股票 Map (動態對齊當前交易模式 Tabs，確保在虛擬交易顯示虛擬卡片數據、真實交易顯示真實卡片數據)
  const allStockMap = useMemo(() => {
    if (activeTradeModeTab === "real") {
      const map = new Map<string, StockTab>(combinedStockMap);
      realStockMap.forEach((tab, sym) => map.set(sym, tab));
      return map;
    }
    if (activeTradeModeTab === "simulated") {
      const map = new Map<string, StockTab>(combinedStockMap);
      simulatedStockMap.forEach((tab, sym) => map.set(sym, tab));
      return map;
    }
    return combinedStockMap;
  }, [activeTradeModeTab, realStockMap, simulatedStockMap, combinedStockMap]);

  // 主分頁分類下的美股數據集 (嚴格對應交易總覽之層級)
  const mainTabFilteredPool = useMemo(() => {
    return allTabs.filter((tab) => {
      if (mainTabFilter === "active") {
        // 持有中 (虛擬/模擬交易)
        return tab.status !== "COMPLETED" && tab.tradeType !== "real";
      }
      if (mainTabFilter === "real") {
        // 真實交易
        return tab.status !== "COMPLETED" && tab.tradeType === "real";
      }
      if (mainTabFilter === "completed") {
        // 已完成
        return tab.status === "COMPLETED";
      }
      // 全部交易 (不限)
      return true;
    });
  }, [allTabs, mainTabFilter]);

  // 當前篩選下的股票清單 (主分頁 + 子分頁)
  const filteredTabs = useMemo(() => {
    return mainTabFilteredPool.filter((tab) => {
      if (selectedSubTab === "all") return true;

      if (mainTabFilter === "completed") {
        if (selectedSubTab === "real") return tab.tradeType === "real";
        if (selectedSubTab === "simulated") return tab.tradeType !== "real";
        return true;
      }

      const status = tab.holdingStatus || "候選名單";
      return status === selectedSubTab;
    });
  }, [mainTabFilteredPool, selectedSubTab, mainTabFilter]);

  // 取得此篩選條件下的不重複股票清單 (嚴格限制：只包含在主畫面有勾選 Tickbox 之個股卡片)
  const availableBlockStocks = useMemo(() => {
    const symMap = new Map<string, StockTab>();
    if (selectedCardIds && selectedCardIds.size > 0) {
      filteredTabs
        .filter((tab) => selectedCardIds.has(tab.id))
        .forEach((tab) => {
          const sym = (tab?.symbol || "").trim().toUpperCase();
          if (sym && !symMap.has(sym)) {
            symMap.set(sym, tab);
          }
        });
    }
    return Array.from(symMap.values()).sort((a, b) => (a?.symbol || "").localeCompare(b?.symbol || ""));
  }, [filteredTabs, selectedCardIds]);

  // 判斷股票標籤是否符合當前交易模式 Tabs (嚴格限定僅在主畫面有勾選 Tickbox 之卡片才可出現在視覺線看板中)
  const isSymbolMatchTradeMode = useCallback(
    (sym: string) => {
      if (!selectedCardIds || selectedCardIds.size === 0) return false;
      const cleanSym = sym.trim().toUpperCase();

      if (activeTradeModeTab === "real") {
        return allTabs.some(
          (t) =>
            (t.symbol || "").trim().toUpperCase() === cleanSym &&
            t.tradeType === "real" &&
            t.status !== "COMPLETED" &&
            selectedCardIds.has(t.id)
        );
      }
      if (activeTradeModeTab === "simulated") {
        return allTabs.some(
          (t) =>
            (t.symbol || "").trim().toUpperCase() === cleanSym &&
            t.tradeType !== "real" &&
            t.status !== "COMPLETED" &&
            selectedCardIds.has(t.id)
        );
      }
      return allTabs.some(
        (t) =>
          (t.symbol || "").trim().toUpperCase() === cleanSym &&
          t.status !== "COMPLETED" &&
          selectedCardIds.has(t.id)
      );
    },
    [allTabs, selectedCardIds, activeTradeModeTab]
  );

  // 判斷股票是否為「交易中」狀態 (依使用者規定：只會顯示籌碼管理中有持有數量的，持有數量為 0 股的不算交易中)
  const isStockTrading = useCallback(
    (sym: string) => {
      const cleanSym = sym.trim().toUpperCase();
      const tab =
        allStockMap.get(cleanSym) ||
        allTabs.find((t) => (t.symbol || "").trim().toUpperCase() === cleanSym);
      const tabId = tab?.id || cleanSym;

      // 1. 若該個股在籌碼管理中有交易紀錄 trades，透過 calculateStats 計算精準持有股數
      const trades = tradesMap?.[tabId] || tradesMap?.[cleanSym];
      if (trades && trades.length > 0) {
        const stats = calculateStats(trades, tab?.currentPrice);
        return Math.abs(stats.totalQuantity) > 0;
      }

      // 2. 若 tradesMap 包含該股票且為空陣列，代表在籌碼管理中目前為 0 筆交易，持有數量為 0 股
      if (tradesMap && (tabId in tradesMap || cleanSym in tradesMap)) {
        return false;
      }

      // 3. 檢查傳入的 statsMap (籌碼統計數據)
      const stat = statsMap?.[tabId] || statsMap?.[cleanSym];
      if (stat?.totalQuantity !== undefined) {
        return Math.abs(stat.totalQuantity) > 0;
      }

      // 4. 若無交易紀錄與 statsMap，最後檢查 tab 自身儲存之 holdingQuantity
      const tabQty =
        typeof tab?.holdingQuantity === "number"
          ? tab.holdingQuantity
          : parseFloat(String(tab?.holdingQuantity || 0));
      return Math.abs(tabQty) > 0;
    },
    [allStockMap, allTabs, statsMap, tradesMap]
  );

  // 目前在圖表畫布上呈現的標籤清單 (視覺線看板嚴格執行只顯示個股卡片為勾選狀態的個股，並套用隱藏設定與只顯示交易中過濾)
  const activeCanvasSymbols = useMemo(() => {
    if (!selectedCardIds || selectedCardIds.size === 0) {
      return [];
    }

    const uniqueSyms = new Set<string>();
    allTabs.forEach((t) => {
      if (t.status === "COMPLETED") return;
      if (!selectedCardIds.has(t.id)) return;
      if (activeTradeModeTab === "real" && t.tradeType !== "real") return;
      if (activeTradeModeTab === "simulated" && t.tradeType === "real") return;

      const sym = (t.symbol || "").trim().toUpperCase();
      if (sym) {
        uniqueSyms.add(sym);
      }
    });

    let symbols = Array.from(uniqueSyms);

    if (!showHiddenTags) {
      symbols = symbols.filter((sym) => !positions[sym]?.hidden);
    }
    if (showOnlyTrading) {
      symbols = symbols.filter((sym) => isStockTrading(sym));
    }
    return symbols;
  }, [selectedCardIds, allTabs, activeTradeModeTab, showHiddenTags, positions, showOnlyTrading, isStockTrading]);

  // 各交易模式在畫布上的標籤數量計算 (嚴格對應勾選卡片與過濾條件)
  const simulatedCanvasCount = useMemo(() => {
    if (!selectedCardIds || selectedCardIds.size === 0) return 0;
    const syms = new Set<string>();
    allTabs.forEach((t) => {
      if (t.status !== "COMPLETED" && t.tradeType !== "real" && selectedCardIds.has(t.id)) {
        const sym = (t.symbol || "").trim().toUpperCase();
        if (sym && (showHiddenTags || !positions[sym]?.hidden) && (!showOnlyTrading || isStockTrading(sym))) {
          syms.add(sym);
        }
      }
    });
    return syms.size;
  }, [selectedCardIds, allTabs, showHiddenTags, positions, showOnlyTrading, isStockTrading]);

  const realCanvasCount = useMemo(() => {
    if (!selectedCardIds || selectedCardIds.size === 0) return 0;
    const syms = new Set<string>();
    allTabs.forEach((t) => {
      if (t.status !== "COMPLETED" && t.tradeType === "real" && selectedCardIds.has(t.id)) {
        const sym = (t.symbol || "").trim().toUpperCase();
        if (sym && (showHiddenTags || !positions[sym]?.hidden) && (!showOnlyTrading || isStockTrading(sym))) {
          syms.add(sym);
        }
      }
    });
    return syms.size;
  }, [selectedCardIds, allTabs, showHiddenTags, positions, showOnlyTrading, isStockTrading]);

  const totalCanvasCount = useMemo(() => {
    if (!selectedCardIds || selectedCardIds.size === 0) return 0;
    const syms = new Set<string>();
    allTabs.forEach((t) => {
      if (t.status !== "COMPLETED" && selectedCardIds.has(t.id)) {
        const sym = (t.symbol || "").trim().toUpperCase();
        if (sym && (showHiddenTags || !positions[sym]?.hidden) && (!showOnlyTrading || isStockTrading(sym))) {
          syms.add(sym);
        }
      }
    });
    return syms.size;
  }, [selectedCardIds, allTabs, showHiddenTags, positions, showOnlyTrading, isStockTrading]);

  // 所有在圖表上的股票代號
  const allCanvasSymbols = useMemo(() => {
    return activeCanvasSymbols;
  }, [activeCanvasSymbols]);

  // 已標記隱藏的股票標籤數量
  const hiddenCount = useMemo(() => {
    if (!selectedCardIds || selectedCardIds.size === 0) return 0;
    const checkedSyms = new Set<string>();
    allTabs.forEach((t) => {
      if (t.status !== "COMPLETED" && selectedCardIds.has(t.id)) {
        if (activeTradeModeTab === "real" && t.tradeType !== "real") return;
        if (activeTradeModeTab === "simulated" && t.tradeType === "real") return;
        const sym = (t.symbol || "").trim().toUpperCase();
        if (sym) checkedSyms.add(sym);
      }
    });
    return Array.from(checkedSyms).filter((sym) => Boolean(positions[sym]?.hidden)).length;
  }, [selectedCardIds, allTabs, activeTradeModeTab, positions]);

  // 當前交易模式下處於「交易中」的畫布標籤數量
  const tradingSymbolsCount = useMemo(() => {
    return activeCanvasSymbols.filter((sym) => isStockTrading(sym)).length;
  }, [activeCanvasSymbols, isStockTrading]);

  // 自動偵測畫布上現價缺失或為 0 的個股 (例如 INTC)，並於背景自動抓取最新現價 (每檔個股只自動嘗試一次，避免失敗時無限循環觸發)
  useEffect(() => {
    if (!isOpen || activeCanvasSymbols.length === 0) return;

    const missingSymbols = activeCanvasSymbols.filter((sym) => {
      if (attemptedAutoFetchSymbolsRef.current.has(sym)) return false;
      const tab =
        allStockMap.get(sym) ||
        allTabs.find((t) => (t.symbol || "").trim().toUpperCase() === sym);
      const hasTabPrice =
        tab?.currentPrice !== undefined &&
        tab.currentPrice !== null &&
        Number(tab.currentPrice) > 0;
      const hasLivePrice = (livePrices[sym] ?? 0) > 0;
      return !hasTabPrice && !hasLivePrice;
    });

    if (missingSymbols.length > 0) {
      missingSymbols.forEach((s) => attemptedAutoFetchSymbolsRef.current.add(s));
      fetchPricesForSymbols(missingSymbols, false);
    }
  }, [isOpen, activeCanvasSymbols, allStockMap, allTabs, livePrices, fetchPricesForSymbols]);

  // 判斷勾選的股票標籤是否全部為隱藏狀態
  const isAllSelectedHidden = useMemo(() => {
    if (selectedTagSymbols.length === 0) return false;
    return selectedTagSymbols.every((sym) => Boolean(positions[sym]?.hidden));
  }, [selectedTagSymbols, positions]);

  // 取得子分頁的顯示名稱 (依據主分頁切換 "虛擬交易" / "觀察中")
  const getSubTabLabel = useCallback(
    (subTabKey: string) => {
      if (subTabKey === "all") return "全部子分頁";
      const conf = HOLDING_CONFIG[subTabKey];
      if (!conf) return subTabKey;
      return mainTabFilter === "active" ? conf.labelActive : conf.labelReal;
    },
    [mainTabFilter]
  );

  // 主分頁顯示文字
  const mainTabDisplayInfo = useMemo(() => {
    switch (mainTabFilter) {
      case "active":
        return {
          title: "持有中",
          subtitle: "(模擬交易)",
          icon: Activity,
          badgeColor: "bg-emerald-600 text-white",
          count: allTabs.filter((t) => t.status !== "COMPLETED" && t.tradeType !== "real").length,
        };
      case "real":
        return {
          title: "真實交易",
          subtitle: "",
          icon: ShieldCheck,
          badgeColor: "bg-teal-600 text-white",
          count: allTabs.filter((t) => t.status !== "COMPLETED" && t.tradeType === "real").length,
        };
      case "completed":
        return {
          title: "已完成",
          subtitle: "(歷史交易)",
          icon: CheckCircle2,
          badgeColor: "bg-purple-600 text-white",
          count: allTabs.filter((t) => t.status === "COMPLETED").length,
        };
      case "all":
      default:
        return {
          title: "全部交易",
          subtitle: "",
          icon: Layers,
          badgeColor: "bg-zinc-800 text-white",
          count: allTabs.length,
        };
    }
  }, [mainTabFilter, allTabs]);

  // 新增股票標籤至畫布
  const handleAddStockToCanvas = (symbol: string, initialTabInfo?: StockTab) => {
    const sym = symbol.trim().toUpperCase();
    if (positions[sym]) return;

    playClickSound();
    const tab = initialTabInfo || allStockMap.get(sym);
    const currentTotal = Object.keys(positions).length;

    let targetYPercent = 44; // 基準中軸
    const status = tab?.holdingStatus || "候選名單";
    if (status === "賣出操作" || status === "平倉操作") {
      targetYPercent = 16;
    } else if (status === "買進操作") {
      targetYPercent = 74;
    } else if (status === "觀察中") {
      targetYPercent = 58;
    } else if (status === "乖離名單") {
      targetYPercent = 88;
    } else {
      targetYPercent = 38 + (currentTotal % 4) * 12;
    }

    const targetXPercent = Math.min(85, Math.max(15, 20 + (currentTotal % 6) * 12 + (Math.floor(currentTotal / 6) * 4)));

    setPositions((prev) => ({
      ...prev,
      [sym]: {
        ...prev[sym],
        x: parseFloat(targetXPercent.toFixed(2)),
        y: parseFloat(targetYPercent.toFixed(2)),
        shape: "circle",
        sizeOffset: prev[sym]?.sizeOffset ?? 0,
        updatedAt: new Date().toISOString(),
      },
    }));
    setHasUnsavedChanges(true);
    toast.success(`已將 ${sym} 新增至視覺線圖表！`, { id: `add-${sym}`, duration: 1500 });

    // 若該股票無現價，立即背景非同步抓取
    if ((!tab?.currentPrice || Number(tab.currentPrice) <= 0) && (!livePrices[sym] || livePrices[sym] <= 0)) {
      fetchLivePriceForSymbol(sym, false);
    }
  };

  // 一鍵新增目前篩選區塊內的所有股票至畫布
  const handleAddAllBlockStocks = () => {
    if (availableBlockStocks.length === 0) return;
    playClickSound();

    let addedCount = 0;
    const newPos = { ...positions };

    availableBlockStocks.forEach((tab, index) => {
      const sym = (tab?.symbol || "").trim().toUpperCase();
      if (!sym) return;
      if (!newPos[sym]) {
        addedCount++;
        const totalNow = Object.keys(newPos).length;
        let targetYPercent = 44;
        const status = tab.holdingStatus || "候選名單";
        if (status === "賣出操作" || status === "平倉操作") {
          targetYPercent = 16;
        } else if (status === "買進操作") {
          targetYPercent = 74;
        } else if (status === "觀察中") {
          targetYPercent = 58;
        } else if (status === "乖離名單") {
          targetYPercent = 88;
        } else {
          targetYPercent = 38 + (totalNow % 4) * 12;
        }

        const targetXPercent = Math.min(88, Math.max(12, 15 + ((totalNow + index) % 7) * 11));
        newPos[sym] = {
          x: parseFloat(targetXPercent.toFixed(2)),
          y: parseFloat(targetYPercent.toFixed(2)),
          shape: "circle",
          sizeOffset: 0,
          updatedAt: new Date().toISOString(),
        };
      }
    });

    setPositions(newPos);
    setHasUnsavedChanges(true);
    toast.success(`已將 ${addedCount} 檔區塊股票新增至圖表！`, { id: "add-all-block" });

    // 背景抓取無現價者
    const missingInBlock = availableBlockStocks
      .map((t) => (t.symbol || "").trim().toUpperCase())
      .filter((s) => s && (!livePrices[s] || livePrices[s] <= 0));
    if (missingInBlock.length > 0) {
      fetchPricesForSymbols(missingInBlock, false);
    }
  };

  // 一鍵從卡片同步分隔線現價相對位置 (僅同步有勾選 Tickbox 之個股卡片)
  const handleSyncDividersFromCards = async () => {
    playClickSound();

    // 檢查是否有勾選任何卡片；若有勾選以勾選為主，若無勾選則自動以畫布上目前現有的股票卡片為對象
    let activeAndRealPool: StockTab[] = [];
    if (selectedCardIds && selectedCardIds.size > 0) {
      activeAndRealPool = allTabs.filter(
        (tab) => tab.status !== "COMPLETED" && selectedCardIds.has(tab.id)
      );
    } else {
      const activeSymbols = new Set(Object.keys(positions).map((s) => s.trim().toUpperCase()));
      if (activeSymbols.size > 0) {
        activeAndRealPool = allTabs.filter(
          (tab) => tab.status !== "COMPLETED" && activeSymbols.has((tab.symbol || "").trim().toUpperCase())
        );
      }
    }

    if (activeAndRealPool.length === 0) {
      toast.info("請先在卡片列表中勾選要同步的個股卡片（勾選圓形 Tickbox），或先新增股票至畫布");
      return;
    }

    // 依股票代號分組，若同一檔股票在不同子分頁存在多張卡片，智慧選擇具備完整分隔線與現價的最佳卡片
    const symbolGroups = new Map<string, StockTab[]>();
    activeAndRealPool.forEach((tab) => {
      const sym = (tab.symbol || "").trim().toUpperCase();
      if (!sym) return;
      if (!symbolGroups.has(sym)) {
        symbolGroups.set(sym, []);
      }
      symbolGroups.get(sym)!.push(tab);
    });

    const targetTabs: StockTab[] = [];
    symbolGroups.forEach((tabsForSym) => {
      if (tabsForSym.length === 1) {
        targetTabs.push(tabsForSym[0]);
        return;
      }

      // 檢查各卡片的分隔線合格度
      const scored = tabsForSym.map((t) => {
        const analysis = analyzeCardDividers(t);
        const dividerCount = analysis.allDividers.length;
        const hasPrice = (t.currentPrice && t.currentPrice > 0) ? 1 : 0;
        const isEligible = analysis.isEligible ? 100 : 0;
        const modeMatchBonus =
          (activeTradeModeTab === "real" && t.tradeType === "real") ||
          (activeTradeModeTab === "simulated" && t.tradeType !== "real")
            ? 500
            : 0;
        const updateTime = getTimestampMillis(t.updatedAt) || getTimestampMillis(t.createdAt);
        return {
          tab: t,
          score: modeMatchBonus + isEligible + dividerCount * 10 + hasPrice * 5,
          updateTime,
        };
      });

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.updateTime - a.updateTime;
      });

      // 選取最高分之卡片，並若其現價缺失但同代號其他卡片有現價，進行現價補全
      const bestTab = { ...scored[0].tab };
      if (!bestTab.currentPrice || bestTab.currentPrice <= 0) {
        const altWithPrice = tabsForSym.find((t) => t.currentPrice && t.currentPrice > 0);
        if (altWithPrice) {
          bestTab.currentPrice = altWithPrice.currentPrice;
        }
      }
      targetTabs.push(bestTab);
    });

    if (targetTabs.length === 0) {
      toast.error("所勾選的股票卡片中沒有可同步的資料");
      return;
    }

    const res = await syncSubTabDividersToCanvas(targetTabs, userId, strategiesMap, statsMap);
    if (res.updatedCount > 0) {
      playSuccessSound();
      const resolved = applyAvoidOverlapToPositions(
        res.allPositions,
        canvasRef.current,
        tagSizeOffset
      );
      setPositions(resolved.positions);
      setHasUnsavedChanges(false);
      await savePositionsDirectly(resolved.positions, tagSizeOffset);
      toast.success(
        `成功同步所勾選的 ${res.updatedCount} 檔股票分隔線現價位置 (${res.updatedSymbols.join(", ")})`,
        { duration: 4000 }
      );
    } else {
      toast.info(
        "所勾選的卡片中，尚未找到包含分隔線的卡片（請在視覺圖示化卡片上繪製分隔線後再同步）"
      );
    }
  };

  // 從圖表畫布中刪除股票標籤
  const handleRemoveStockFromCanvas = (symbol: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    playClickSound();

    const sym = symbol.trim().toUpperCase();
    setSelectedTagSymbols((prev) => prev.filter((s) => s !== sym));
    setPositions((prev) => {
      const next = { ...prev };
      delete next[sym];
      return next;
    });
    setHasUnsavedChanges(true);
    toast.info(`已從圖表中移除標籤 ${sym}`);
  };

  // 清空畫布上所有標籤
  const handleClearAllCanvas = () => {
    if (Object.keys(positions).length === 0) return;
    playClickSound();
    handleResetAllCanvas();
  };

  // 一鍵「重置」：刪除畫布上所有個股標籤並即時更新與儲存
  const handleResetAllCanvas = () => {
    playClickSound();
    const currentCount = Object.keys(positions).length;
    if (currentCount === 0) {
      toast.info("目前畫布上沒有個股標籤可重置");
      return;
    }

    // 1. 本地狀態與快取重置
    setSelectedTagSymbols([]);
    setPositions({});
    setHasUnsavedChanges(false);

    // 2. 秒速樂觀寫入（記憶體 + LocalStorage + 廣播 + 背景同步 Firestore）
    saveVisualLinesDataOptimistic(userId, {}, tagSizeOffset);

    playSuccessSound();
    toast.success(`已成功重置！已刪除畫布上所有個股標籤 (共清除 ${currentCount} 檔)`, {
      id: "canvas-reset-all",
    });
  };

  // 勾選 / 取消勾選單一標籤
  const handleToggleTagSelection = (symbol: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    playClickSound();
    const sym = symbol.trim().toUpperCase();
    setSelectedTagSymbols((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  // 全選 / 取消全選畫布上的標籤
  const handleSelectAllTags = () => {
    playClickSound();
    if (selectedTagSymbols.length === activeCanvasSymbols.length && activeCanvasSymbols.length > 0) {
      setSelectedTagSymbols([]);
      toast.info("已取消所有股票標籤選取");
    } else {
      setSelectedTagSymbols([...activeCanvasSymbols]);
      toast.info(`已選取畫布上全部 ${activeCanvasSymbols.length} 檔股票標籤`);
    }
  };

  // 調整標籤尺寸 (+ / - 2px)
  const handleAdjustTagSize = (delta: number) => {
    playClickSound();
    if (selectedTagSymbols.length > 0) {
      // 僅針對勾選的標籤調整尺寸
      setPositions((prev) => {
        const next = { ...prev };
        selectedTagSymbols.forEach((sym) => {
          if (next[sym]) {
            const currentOffset = next[sym].sizeOffset !== undefined ? next[sym].sizeOffset! : tagSizeOffset;
            const nextOffset = Math.max(-10, Math.min(24, currentOffset + delta));
            next[sym] = {
              ...next[sym],
              sizeOffset: nextOffset,
            };
          }
        });
        return next;
      });
      setHasUnsavedChanges(true);
      toast.info(`已將勾選的 ${selectedTagSymbols.length} 檔標籤尺寸${delta > 0 ? "放大" : "縮小"} 2px`, { id: "tag-size" });
    } else {
      // 未勾選時調整預設尺寸
      setTagSizeOffset((prev) => {
        const next = Math.max(-6, Math.min(16, prev + delta));
        try {
          localStorage.setItem("visualLines_tagSizeOffset", String(next));
        } catch {}
        return next;
      });
      toast.info(`已將預設標籤尺寸${delta > 0 ? "放大" : "縮小"} 2px`, { id: "tag-size" });
    }
  };

  // 重設標籤尺寸
  const handleResetTagSize = () => {
    playClickSound();
    if (selectedTagSymbols.length > 0) {
      setPositions((prev) => {
        const next = { ...prev };
        selectedTagSymbols.forEach((sym) => {
          if (next[sym]) {
            const copy = { ...next[sym] };
            delete copy.sizeOffset;
            next[sym] = copy;
          }
        });
        return next;
      });
      setHasUnsavedChanges(true);
      toast.info(`已重設勾選的 ${selectedTagSymbols.length} 檔標籤尺寸為預設`, { id: "tag-size-reset" });
    } else {
      setTagSizeOffset(0);
      try {
        localStorage.setItem("visualLines_tagSizeOffset", "0");
      } catch {}
      toast.info("已重設標籤預設尺寸", { id: "tag-size-reset" });
    }
  };

  // 為勾選的標籤設定邊框顏色 (若選中預設黑或未指定則恢復 1px 黑色邊框，其餘套用 6px 亮色邊框)
  const handleSetTagColor = (colorHex?: string) => {
    playClickSound();
    if (selectedTagSymbols.length > 0) {
      const isResetToDefault = !colorHex || colorHex === "#000000";
      setPositions((prev) => {
        const next = { ...prev };
        selectedTagSymbols.forEach((sym) => {
          if (next[sym]) {
            next[sym] = {
              ...next[sym],
              color: isResetToDefault ? undefined : colorHex,
              updatedAt: new Date().toISOString(),
            };
          }
        });
        return next;
      });
      setHasUnsavedChanges(true);
      if (isResetToDefault) {
        toast.info(`已將勾選的 ${selectedTagSymbols.length} 檔標籤重設為預設黑色邊框 (1px)`, {
          id: "tag-color",
        });
      } else {
        const colorObj = TAG_COLOR_OPTIONS.find((c) => c.bg === colorHex);
        toast.info(`已將勾選的 ${selectedTagSymbols.length} 檔標籤邊框顏色設為「${colorObj?.label || colorHex}」 (6px)`, {
          id: "tag-color",
        });
      }
    }
  };

  // 直接儲存位置資料庫並廣播更新（極速 0ms 樂觀寫入 + 背景非同步 Firestore 同步）
  const savePositionsDirectly = useCallback(
    (targetPositions: PositionMap, currentTagSizeOffset: number = tagSizeOffset) => {
      const sanitized = saveVisualLinesDataOptimistic(userId, targetPositions, currentTagSizeOffset);
      setPositions(sanitized);
      setHasUnsavedChanges(false);
      return sanitized;
    },
    [userId, tagSizeOffset]
  );

  // 自動檢測並校準具備分隔線設定的股票（特別是 XEL），使其標籤位置與卡片分隔線及現價精確同步，且絕不更動卡片上的分隔線數據
  const calibratedTabKeysRef = useRef<string>("");
  useEffect(() => {
    if (!isOpen || allTabs.length === 0) return;

    // 建立快取鍵以避免每一 render 重複執行
    const activeKey = allTabs
      .map((t) => `${t.id}_${t.symbol}_${t.currentPrice || (t as any).price}_${t.chartAnnotations?.length || 0}`)
      .join("|");
    if (calibratedTabKeysRef.current === activeKey) return;
    calibratedTabKeysRef.current = activeKey;

    let hasUpdates = false;
    const nextPositions: PositionMap = { ...positions };

    allTabs.forEach((tab) => {
      const sym = (tab.symbol || "").trim().toUpperCase();
      if (!sym) return;

      const hasDividers = Boolean(
        tab.chartAnnotations?.some(
          (a) =>
            a.type === "divider" ||
            (a.type === "line" &&
              Math.abs((a.y2 ?? a.y1 ?? 0) - (a.y1 ?? 0)) < 8 &&
              Math.abs((a.x2 ?? 100) - (a.x1 ?? 0)) >= 10)
        )
      );

      // 僅對已在畫布上的股票或 XEL 進行校準，避免將未放置標籤強制塞入畫布
      const existingPos = positions[sym];
      if (hasDividers || sym === "XEL") {
        if (!existingPos && sym !== "XEL") return;

        const strat = strategiesMap?.[tab.id] || (tab as any).strategy;
        const stat = statsMap?.[tab.id];
        const avgCost = stat?.totalQuantity !== 0 ? stat?.averagePrice : undefined;
        const holdingQty = stat?.totalQuantity ?? (tab as any).holdingQuantity;
        const targetY = calculateCanvasYFromDividers(tab, strat, avgCost, holdingQty);

        if (targetY !== null && !isNaN(targetY)) {
          const currentY = existingPos?.y;
          const diff = currentY !== undefined ? Math.abs(currentY - targetY) : 999;
          // 若偏差大於 0.1% 則校準
          if (diff > 0.1) {
            nextPositions[sym] = {
              ...existingPos,
              x: existingPos?.x ?? 50,
              y: targetY,
              shape: existingPos?.shape || "circle",
              sizeOffset: existingPos?.sizeOffset ?? tagSizeOffset,
              updatedAt: new Date().toISOString(),
            };
            hasUpdates = true;
          }
        }
      }
    });

    if (hasUpdates) {
      setPositions(nextPositions);
      saveVisualLinesDataOptimistic(userId, nextPositions, tagSizeOffset);
    }
  }, [isOpen, allTabs, strategiesMap, statsMap, tagSizeOffset, userId, positions]);

  // 設定/切換勾選股票標籤的攤平進度 (#1, #2, #3, #4) 或拆分交易選項並自動儲存
  const handleSetDcaProgress = async (step?: "#1" | "#2" | "#3" | "#4" | string) => {
    if (selectedTagSymbols.length === 0) {
      toast.info("請先勾選欲設定攤平進度或拆分交易的股票標籤");
      return;
    }
    playClickSound();

    // 若全部已是該進度，點擊再次切換為清除 (undefined)；若有指定則設定為該進度
    const isAllSame = step !== undefined && selectedTagSymbols.every((s) => positions[s]?.dcaProgress === step);
    const targetStep = isAllSame || step === undefined ? undefined : step;

    const nextPositions: PositionMap = { ...positions };
    selectedTagSymbols.forEach((sym) => {
      if (nextPositions[sym]) {
        nextPositions[sym] = {
          ...nextPositions[sym],
          dcaProgress: targetStep,
          updatedAt: new Date().toISOString(),
        };
      }
    });

    setPositions(nextPositions);

    try {
      await savePositionsDirectly(nextPositions);
      if (targetStep) {
        playSuccessSound();
        const splitOpt = findSplitTradeOption(targetStep);
        const displayLabel = splitOpt ? splitOpt.label : targetStep;
        toast.success(`已將勾選的 ${selectedTagSymbols.length} 檔標籤設定為「${displayLabel}」（已自動儲存）`, {
          id: "dca-progress-save",
        });
      } else {
        toast.info(`已清除勾選的 ${selectedTagSymbols.length} 檔標籤之進度標記（已自動儲存）`, {
          id: "dca-progress-save",
        });
      }
    } catch (e: any) {
      toast.error("自動儲存失敗：" + (e?.message || "請手動點擊儲存"));
    }
  };

  // 隱藏 / 解除隱藏勾選的股票標籤
  const handleToggleHideSelected = () => {
    if (selectedTagSymbols.length === 0) {
      toast.info("請先勾選欲隱藏或顯示的股票標籤");
      return;
    }
    playClickSound();

    const willHide = !isAllSelectedHidden; // 若不全為隱藏狀態則設為隱藏，若全為隱藏狀態則解除隱藏
    setPositions((prev) => {
      const next = { ...prev };
      selectedTagSymbols.forEach((sym) => {
        if (next[sym]) {
          next[sym] = {
            ...next[sym],
            hidden: willHide,
            updatedAt: new Date().toISOString(),
          };
        }
      });
      return next;
    });
    setHasUnsavedChanges(true);

    if (willHide) {
      toast.info(`已隱藏勾選的 ${selectedTagSymbols.length} 檔股票標籤（可點擊「顯示隱藏」檢視或解除）`, {
        id: "tag-hide",
      });
      // 隱藏後取消勾選，保持畫布乾淨
      setSelectedTagSymbols([]);
    } else {
      toast.success(`已解除隱藏勾選的 ${selectedTagSymbols.length} 檔股票標籤！`, {
        id: "tag-hide",
      });
    }
  };

  // 一鍵解除所有股票標籤的隱藏狀態
  const handleUnhideAll = () => {
    playClickSound();
    setPositions((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((sym) => {
        if (next[sym]?.hidden) {
          next[sym] = {
            ...next[sym],
            hidden: false,
            updatedAt: new Date().toISOString(),
          };
        }
      });
      return next;
    });
    setHasUnsavedChanges(true);
    toast.success(`已解除全部 ${hiddenCount} 檔股票標籤的隱藏狀態！`, { id: "tag-unhide-all" });
  };

  // 匯出股票儲存位置訊息 (JSON 格式下載)
  const handleExportPositions = () => {
    playClickSound();
    const count = Object.keys(positions).length;
    if (count === 0) {
      toast.info("目前畫布上沒有股票標籤可供匯出");
      return;
    }

    const exportData = {
      version: "1.0",
      type: "visual_lines_board_positions",
      exportedAt: new Date().toISOString(),
      tagSizeOffset,
      count,
      positions,
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `StockPositions_VisualLines_${dateStr}_(${count}檔).json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    playSuccessSound();
    toast.success(`成功匯出 ${count} 檔股票儲存位置訊息！`, { id: "export-positions" });
  };

  // 觸發選擇匯入檔案
  const handleTriggerImport = () => {
    playClickSound();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  // 處理匯入股票儲存位置訊息
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      let importedPositions: PositionMap = {};
      let importedTagSizeOffset: number | undefined;

      if (data && typeof data === "object") {
        if (data.positions && typeof data.positions === "object") {
          importedPositions = data.positions;
        } else if (!data.positions && Object.keys(data).length > 0 && !data.version) {
          // 直接是 PositionMap 格式
          importedPositions = data;
        }
        if (typeof data.tagSizeOffset === "number") {
          importedTagSizeOffset = data.tagSizeOffset;
        }
      }

      const validEntries = Object.entries(importedPositions).filter(([sym, pos]) => {
        return sym && pos && typeof pos.x === "number" && typeof pos.y === "number";
      });

      if (validEntries.length === 0) {
        toast.error("匯入檔案格式不正確或未包含有效的股票位置資料");
        return;
      }

      const sanitized: PositionMap = {};
      validEntries.forEach(([sym, pos]) => {
        const cleanSym = sym.trim().toUpperCase();
        sanitized[cleanSym] = {
          x: Math.max(0, Math.min(100, pos.x)),
          y: Math.max(0, Math.min(100, pos.y)),
          shape: "circle",
          sizeOffset: typeof pos.sizeOffset === "number" ? pos.sizeOffset : 0,
          color: pos.color && pos.color !== "#000000" ? pos.color : undefined,
          hidden: Boolean(pos.hidden),
          dcaProgress: pos.dcaProgress || undefined,
          updatedAt: pos.updatedAt || new Date().toISOString(),
        };
      });

      // 合併至目前位置（或覆蓋更新）
      setPositions((prev) => ({
        ...prev,
        ...sanitized,
      }));

      if (importedTagSizeOffset !== undefined) {
        setTagSizeOffset(importedTagSizeOffset);
      }

      setHasUnsavedChanges(true);
      playSuccessSound();
      toast.success(`成功匯入 ${validEntries.length} 檔股票儲存位置訊息！請記得點擊「儲存」以同步至雲端。`, {
        id: "import-positions",
        duration: 4000,
      });
    } catch (err) {
      console.error("匯入位置檔案失敗:", err);
      toast.error("讀取匯入檔案失敗，請確認檔案為正確的 JSON 格式");
    }
  };

  /**
   * 純水平 X 軸微調避開重疊核心演算法 (平行左右散開重疊個股，包含下方資訊文字框在內，嚴格保持 Y 軸高低位置 100% 不變，嚴格保留原有的顏色邊框、尺寸偏移、隱藏與各項屬性)
   */
  const applyAvoidOverlapToPositions = (
    inputPositions: PositionMap,
    canvasEl: HTMLElement | null,
    globalTagSizeOffset: number = 0
  ): { positions: PositionMap; movedCount: number } => {
    const entries = Object.entries(inputPositions);
    if (entries.length <= 1) {
      return { positions: { ...inputPositions }, movedCount: 0 };
    }

    const canvasWidth = canvasEl ? Math.max(300, canvasEl.clientWidth) : 1200;
    const canvasHeight = canvasEl ? Math.max(200, canvasEl.clientHeight) : 600;

    // 精確計算每檔股票包含下方文字資訊卡 (拆分交易階段、已購/預計數量、損益、基準/平倉) 在內的完整 2D 幾何邊界
    interface TagBoundingGeometry {
      sym: string;
      x: number; // 當前 X 百分比 (0~100)
      y: number; // 固定的 Y 百分比 (0~100)
      topYPx: number; // 頂部 Y 像素 (圓圈頂部)
      bottomYPx: number; // 底部 Y 像素 (包含下方多列文字卡)
      halfWidthPx: number; // 水平半寬 (取圓圈與文字框最大值 + 安全邊界)
    }

    const working: { [sym: string]: TagBoundingGeometry } = {};

    entries.forEach(([sym, pos]) => {
      const effectiveSizeOffset = (pos.sizeOffset ?? 0) + globalTagSizeOffset;
      const circleSize = Math.max(44, 54 + effectiveSizeOffset * 2.2);
      const circleRadius = circleSize / 2;

      const tab = allStockMap.get(sym) || allTabs.find((t) => (t.symbol || "").trim().toUpperCase() === sym);
      const strat = tab ? (strategiesMap?.[tab.id] || (tab as any)?.strategy) : undefined;
      const rowsSys2 = tab?.averagingRowsSys2 || strat?.averagingRowsSys2;
      const rowsSys1 = tab?.averagingRows || strat?.averagingRows;
      const stat = tab ? statsMap?.[tab.id] : undefined;
      const effectiveHoldingQty = stat?.totalQuantity ?? (tab as any)?.holdingQuantity ?? 0;
      const batchPlannedSizes = [
        parseFloat(rowsSys2?.[0]?.quantity || "") || 0,
        parseFloat(rowsSys2?.[1]?.quantity || "") || 0,
        parseFloat(rowsSys2?.[2]?.quantity || "") || 0,
        parseFloat(rowsSys2?.[3]?.quantity || "") || 0,
      ];
      const totalSys2Planned = batchPlannedSizes.reduce((a, b) => a + b, 0);
      const totalSys1Planned = (rowsSys1 || []).reduce((sum: number, r: any) => {
        const q1 = parseFloat(r?.quantity || "") || 0;
        const q2 = parseFloat(r?.quantity2 || "") || 0;
        return sum + q1 + q2;
      }, 0);
      const effectivePlannedBuyQty =
        (tab as any)?.plannedBuyQty && (tab as any).plannedBuyQty > 0
          ? (tab as any).plannedBuyQty
          : totalSys2Planned > 0
          ? totalSys2Planned
          : totalSys1Planned > 0
          ? totalSys1Planned
          : 0;

      const cardTrades = tab ? (tradesMap?.[tab.id] || (tab as any).trades || []) : [];
      const effectiveDcaProgress = getEffectiveDcaProgress(
        pos.dcaProgress,
        tab,
        cardTrades,
        effectiveHoldingQty,
        effectivePlannedBuyQty,
        strat
      );

      const splitOpt = findSplitTradeOption(effectiveDcaProgress);
      const splitStageDetail = calculateSplitTradeStageDetail(
        tab,
        effectiveDcaProgress,
        effectivePlannedBuyQty,
        effectiveHoldingQty,
        strat
      );
      const tabCurPrice =
        (tab as any)?.currentPrice !== undefined && (tab as any).currentPrice !== null && Number((tab as any).currentPrice) > 0
          ? Number((tab as any).currentPrice)
          : (livePrices[sym] || 0);

      const { basePrice: basePositionPrice, forceClosePrice: forcedLiquidationPrice } =
        getStockBaseAndForceClosePrices(tab, strat, tabCurPrice);

      const effectiveUnrealizedPnL = stat?.unrealizedPnL ?? (tab as any)?.unrealizedPnL ?? 0;
      const hasHoldingOrPnL = effectiveHoldingQty !== 0 || effectiveUnrealizedPnL !== 0;

      const hasInfo = Boolean(
        effectiveDcaProgress ||
        effectivePlannedBuyQty > 0 ||
        effectiveHoldingQty > 0 ||
        effectiveUnrealizedPnL !== 0 ||
        basePositionPrice !== null ||
        forcedLiquidationPrice !== null ||
        tabCurPrice > 0
      );

      // 理論幾何尺寸計算（以充裕的安全裕度為準）
      let estimatedTopOffset = circleRadius + 8;
      let estimatedBottomOffset = circleRadius + 8;
      let estimatedHalfWidth = circleRadius + 16;

      if (hasInfo) {
        // 行 1 (拆分交易 / 剩餘股數 / 已購預購數量 / 無庫存)
        const row1Width = splitStageDetail ? 240 : 190;
        // 行 2 (未實現損益)
        const row2Width = hasHoldingOrPnL ? 170 : 0;
        // 行 3 (基準 / 平倉)
        const row3Width = (basePositionPrice !== null || forcedLiquidationPrice !== null) ? 190 : 0;

        let rowCount = 1; // 只要 hasInfo 為 true，第 1 行必然會渲染 (含無庫存)
        if (splitStageDetail?.companionStage) rowCount += 1.5;
        if (hasHoldingOrPnL) rowCount++;
        if (basePositionPrice !== null || forcedLiquidationPrice !== null) rowCount++;

        const maxContentWidth = Math.max(circleSize, row1Width, row2Width, row3Width);
        const totalInfoHeight = rowCount * 26 + 14;

        estimatedBottomOffset = circleRadius + 4 + totalInfoHeight + 12;
        estimatedHalfWidth = Math.max(circleRadius + 18, maxContentWidth / 2 + 16);
      }

      // 若 DOM 已存在且能測量，讀取實際 DOM 尺寸做雙重強化
      const yPx = (pos.y / 100) * canvasHeight;
      let measuredTopY = yPx - estimatedTopOffset;
      let measuredBottomY = yPx + estimatedBottomOffset;
      let finalHalfWidth = estimatedHalfWidth;

      if (canvasEl) {
        try {
          const domTag = canvasEl.querySelector(`[data-tag-symbol="${sym}"]`) as HTMLElement | null;
          if (domTag) {
            const canvasRect = canvasEl.getBoundingClientRect();
            const tagRect = domTag.getBoundingClientRect();
            const childElements = Array.from(domTag.querySelectorAll("*"));
            
            let minTop = tagRect.top;
            let maxBottom = tagRect.bottom;
            let minLeft = tagRect.left;
            let maxRight = tagRect.right;

            childElements.forEach((el) => {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                minTop = Math.min(minTop, rect.top);
                maxBottom = Math.max(maxBottom, rect.bottom);
                minLeft = Math.min(minLeft, rect.left);
                maxRight = Math.max(maxRight, rect.right);
              }
            });

            const domTopY = minTop - canvasRect.top;
            const domBottomY = maxBottom - canvasRect.top;
            const domHalfW = Math.max((maxRight - minLeft) / 2 + 14, circleRadius + 16);

            measuredTopY = Math.min(measuredTopY, domTopY - 6);
            measuredBottomY = Math.max(measuredBottomY, domBottomY + 8);
            finalHalfWidth = Math.max(finalHalfWidth, domHalfW);
          }
        } catch {
          // fallback to estimated
        }
      }

      working[sym] = {
        sym,
        x: pos.x,
        y: pos.y,
        topYPx: measuredTopY,
        bottomYPx: measuredBottomY,
        halfWidthPx: Math.max(finalHalfWidth, 80),
      };
    });

    const symbols = Object.keys(working);
    const n = symbols.length;

    const originalX: { [sym: string]: number } = {};
    symbols.forEach((sym) => {
      originalX[sym] = working[sym].x;
    });

    const minXPercent = 4.0; // 邊界保護 (4.0%)
    const maxXPercent = 96.0; // 邊界保護 (96.0%)
    const paddingX = 22; // 水平安全間距 (px)
    const verticalSafetyMargin = 10; // 垂直重疊判定安全容許裕度 (px)

    // 輔助判定：兩標籤在垂直 Y 軸方向是否重疊 (含下方資訊框覆蓋)
    const isVerticallyOverlapping = (a: TagBoundingGeometry, b: TagBoundingGeometry): boolean => {
      return (
        a.topYPx < b.bottomYPx + verticalSafetyMargin &&
        b.topYPx < a.bottomYPx + verticalSafetyMargin
      );
    };

    // 1. 群組平行左右連鎖排斥與區間完全展開 (Graph Connected Components Clustering & Spread)
    const visited = new Set<string>();
    symbols.forEach((startSym) => {
      if (visited.has(startSym)) return;

      const cluster: string[] = [startSym];
      visited.add(startSym);

      // BFS 連鎖搜尋所有垂直方向重疊的個股
      const queue = [startSym];
      while (queue.length > 0) {
        const currentSym = queue.shift()!;
        const currentGeo = working[currentSym];

        symbols.forEach((otherSym) => {
          if (visited.has(otherSym)) return;
          const otherGeo = working[otherSym];
          if (isVerticallyOverlapping(currentGeo, otherGeo)) {
            visited.add(otherSym);
            cluster.push(otherSym);
            queue.push(otherSym);
          }
        });
      }

      if (cluster.length > 1) {
        // 依目前 X 座標由左至右排序
        cluster.sort((a, b) => working[a].x - working[b].x);

        // 計算此群組安全無重疊排列所需的總寬度 (px)
        let requiredTotalWidthPx = 0;
        for (let c = 0; c < cluster.length - 1; c++) {
          const geo1 = working[cluster[c]];
          const geo2 = working[cluster[c + 1]];
          requiredTotalWidthPx += geo1.halfWidthPx + geo2.halfWidthPx + paddingX;
        }

        const requiredTotalWidthPercent = (requiredTotalWidthPx / canvasWidth) * 100;
        const availableWidthPercent = maxXPercent - minXPercent;

        if (requiredTotalWidthPercent <= availableWidthPercent) {
          // 以原始群組重心為基準置中散開
          const avgX = cluster.reduce((sum, s) => sum + working[s].x, 0) / cluster.length;
          let currentX = avgX - requiredTotalWidthPercent / 2;

          if (currentX < minXPercent) {
            currentX = minXPercent;
          } else if (currentX + requiredTotalWidthPercent > maxXPercent) {
            currentX = maxXPercent - requiredTotalWidthPercent;
          }

          working[cluster[0]].x = Math.max(minXPercent, Math.min(maxXPercent, Math.round(currentX * 100) / 100));
          for (let c = 0; c < cluster.length - 1; c++) {
            const geo1 = working[cluster[c]];
            const geo2 = working[cluster[c + 1]];
            const stepPercent = ((geo1.halfWidthPx + geo2.halfWidthPx + paddingX) / canvasWidth) * 100;
            currentX += stepPercent;
            working[cluster[c + 1]].x = Math.max(minXPercent, Math.min(maxXPercent, Math.round(currentX * 100) / 100));
          }
        } else {
          // 若標籤密集超出總寬度，在可用寬度內均勻鋪開排列
          const stepPercent = availableWidthPercent / (cluster.length - 1);
          cluster.forEach((s, idx) => {
            working[s].x = Math.round((minXPercent + idx * stepPercent) * 100) / 100;
          });
        }
      }
    });

    // 2. 跨群組全域物理排斥微調放鬆 (200 輪 Relaxation Pass)
    const iterations = 200;
    for (let iter = 0; iter < iterations; iter++) {
      let anyCollision = false;
      const damping = Math.max(0.7, 0.98 - (iter / iterations) * 0.25);

      for (let i = 0; i < n; i++) {
        const symA = symbols[i];
        const a = working[symA];
        const aPxX = (a.x / 100) * canvasWidth;

        for (let j = i + 1; j < n; j++) {
          const symB = symbols[j];
          const b = working[symB];
          const bPxX = (b.x / 100) * canvasWidth;

          if (isVerticallyOverlapping(a, b)) {
            const minSafeDistanceX = a.halfWidthPx + b.halfWidthPx + paddingX;
            const dx = bPxX - aPxX;
            const absDx = Math.abs(dx);

            if (absDx < minSafeDistanceX) {
              anyCollision = true;
              const overlap = minSafeDistanceX - absDx;
              const shiftPx = (overlap / 2) * damping;
              const shiftPercent = (shiftPx / canvasWidth) * 100;

              if (absDx < 0.1) {
                const dir = symA.localeCompare(symB) < 0 ? -1 : 1;
                a.x = Math.max(minXPercent, Math.min(maxXPercent, a.x - shiftPercent * dir));
                b.x = Math.max(minXPercent, Math.min(maxXPercent, b.x + shiftPercent * dir));
              } else if (dx > 0) {
                a.x = Math.max(minXPercent, a.x - shiftPercent);
                b.x = Math.min(maxXPercent, b.x + shiftPercent);
              } else {
                a.x = Math.min(maxXPercent, a.x + shiftPercent);
                b.x = Math.max(minXPercent, b.x - shiftPercent);
              }
            }
          }
        }
      }

      if (!anyCollision && iter > 25) {
        break;
      }
    }

    // 3. 終極保底硬性防撞掃描 (100 次強制間隔修正，確保 100% 絕對 0 遮擋)
    for (let iter = 0; iter < 100; iter++) {
      let moved = false;
      for (let i = 0; i < n; i++) {
        const symA = symbols[i];
        const a = working[symA];
        const aPxX = (a.x / 100) * canvasWidth;

        for (let j = i + 1; j < n; j++) {
          const symB = symbols[j];
          const b = working[symB];
          const bPxX = (b.x / 100) * canvasWidth;

          if (isVerticallyOverlapping(a, b)) {
            const minSafeDistanceX = a.halfWidthPx + b.halfWidthPx + paddingX;
            const dx = bPxX - aPxX;
            const absDx = Math.abs(dx);

            if (absDx < minSafeDistanceX) {
              moved = true;
              const overlap = minSafeDistanceX - absDx;
              const shiftPercent = ((overlap / 2 + 1) / canvasWidth) * 100;
              if (dx >= 0) {
                a.x = Math.max(minXPercent, a.x - shiftPercent);
                b.x = Math.min(maxXPercent, b.x + shiftPercent);
              } else {
                a.x = Math.min(maxXPercent, a.x + shiftPercent);
                b.x = Math.max(minXPercent, b.x - shiftPercent);
              }
            }
          }
        }
      }
      if (!moved) break;
    }

    // 產生新位置映射 (嚴格保持 Y 座標 100% 不變，且顏色邊框等屬性完整保留)
    let totalMovedCount = 0;
    const newPositions: PositionMap = { ...inputPositions };
    symbols.forEach((sym) => {
      const diff = Math.abs(working[sym].x - originalX[sym]);
      if (diff > 0.05) {
        totalMovedCount++;
      }
      if (newPositions[sym]) {
        newPositions[sym] = {
          ...newPositions[sym],
          x: Math.round(working[sym].x * 100) / 100,
          // Y 座標嚴格保持傳入之 Y 座標 (100% 不變)
          y: inputPositions[sym].y,
          // 保持既有顏色邊框與各項設定
          color: inputPositions[sym].color,
          sizeOffset: inputPositions[sym].sizeOffset,
          shape: inputPositions[sym].shape,
          hidden: inputPositions[sym].hidden,
          dcaProgress: inputPositions[sym].dcaProgress,
          updatedAt: inputPositions[sym].updatedAt || new Date().toISOString(),
        };
      }
    });

    return { positions: newPositions, movedCount: totalMovedCount };
  };

  // 一鍵避開重疊：保持 Y 軸（現價相對高度）不變，平行左右移動散開重疊的個股標籤並即時自動儲存
  const handleAvoidOverlap = async () => {
    playClickSound();
    const entries = Object.entries(positions);
    if (entries.length <= 1) {
      toast.info("目前畫布上的標籤數量不足以產生重疊");
      return;
    }

    const { positions: newPositions, movedCount } = applyAvoidOverlapToPositions(
      positions,
      canvasRef.current,
      tagSizeOffset
    );

    if (movedCount > 0) {
      setPositions(newPositions);
      setHasUnsavedChanges(true);
      await savePositionsDirectly(newPositions, tagSizeOffset);
      playSuccessSound();
      toast.success(`已完成平行左右避開重疊！共微調散開了 ${movedCount} 檔股票標籤（現價高度維持不變）。`, {
        id: "avoid-overlap",
        duration: 3500,
      });
    } else {
      toast.info("目前畫布上所有股票標籤已均勻平行分散，無重疊需要調整。");
    }
  };

  // 一鍵「更新位置」：以 Tickbox 有勾選之卡片為主，嚴格忽略未勾選卡片（即使代號相同亦不參考），自動同步分隔線與現價相對 Y 軸位置，並自動水平避開重疊，且 100% 保持既有顏色邊框、形狀與尺寸
  const handleUpdatePositions = async () => {
    playClickSound();
    setIsUpdatingPositions(true);

    try {
      // 1. 優先以 Tickbox 勾選卡片為主；若未在外部勾選，則自動針對畫布上現存的股票代號進行同步更新
      let checkedTabs: StockTab[] = [];
      if (selectedCardIds && selectedCardIds.size > 0) {
        checkedTabs = allTabs.filter(
          (t) => selectedCardIds.has(t.id) && (t.symbol || "").trim() !== ""
        );
      } else {
        const canvasSymbols = new Set(Object.keys(positions).map((s) => s.trim().toUpperCase()));
        if (canvasSymbols.size > 0) {
          checkedTabs = allTabs.filter(
            (t) => t.status !== "COMPLETED" && canvasSymbols.has((t.symbol || "").trim().toUpperCase())
          );
        }
      }

      if (checkedTabs.length === 0) {
        toast.info("請先在卡片列表中勾選要同步的個股卡片（勾選圓形 Tickbox），或先新增股票標籤至畫布。");
        setIsUpdatingPositions(false);
        return;
      }

      // 依股票代號分組（僅限有勾選的卡片）
      const symbolGroups = new Map<string, StockTab[]>();
      checkedTabs.forEach((tab) => {
        const sym = (tab.symbol || "").trim().toUpperCase();
        if (!sym) return;
        if (!symbolGroups.has(sym)) {
          symbolGroups.set(sym, []);
        }
        symbolGroups.get(sym)!.push(tab);
      });

      const nowIso = new Date().toISOString();
      const updatedPositions: PositionMap = { ...positions };
      let updatedCount = 0;
      let tabIndex = 0;

      symbolGroups.forEach((tabsForSym, sym) => {
        const prevPos = positions[sym];

        // 若同一個股票代號有多張勾選的卡片，從勾選的卡片中評選最佳卡片（絕不參考未勾選卡片）
        let targetTab: StockTab;
        if (tabsForSym.length === 1) {
          targetTab = tabsForSym[0];
        } else {
          const scored = tabsForSym.map((t) => {
            const analysis = analyzeCardDividers(t);
            const dividerCount = analysis.allDividers.length;
            const hasPrice = t.currentPrice && t.currentPrice > 0 ? 1 : 0;
            const isEligible = analysis.isEligible ? 100 : 0;
            const modeMatchBonus =
              (activeTradeModeTab === "real" && t.tradeType === "real") ||
              (activeTradeModeTab === "simulated" && t.tradeType !== "real")
                ? 500
                : 0;
            const updateTime = getTimestampMillis(t.updatedAt) || getTimestampMillis(t.createdAt);
            return {
              tab: t,
              score: modeMatchBonus + isEligible + dividerCount * 10 + hasPrice * 5,
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

        // 計算該勾選卡片的分隔線與現價 Y 軸位置
        const canvasY = calculateCanvasYFromDividers(targetTab, strat, avgCost, holdingQty);
        if (canvasY !== null) {
          const defaultX = 20 + ((tabIndex % 6) * 12);
          const initialX = prevPos?.x !== undefined ? prevPos.x : defaultX;

          // 嚴格保留原有的顏色邊框 (color)、尺寸偏移 (sizeOffset)、形狀 (shape)、隱藏狀態 (hidden) 與攤平進度 (dcaProgress)
          updatedPositions[sym] = {
            ...prevPos,
            x: initialX,
            y: canvasY,
            shape: prevPos?.shape || "circle",
            sizeOffset: prevPos?.sizeOffset ?? 0,
            color: prevPos?.color && prevPos.color !== "#000000" ? prevPos.color : undefined,
            hidden: Boolean(prevPos?.hidden),
            dcaProgress: prevPos?.dcaProgress,
            updatedAt: nowIso,
          };
          updatedCount++;
          tabIndex++;
        }
      });

      if (updatedCount === 0) {
        toast.info("所勾選的卡片未能計算出有效的現價或分隔線位置，請確認卡片價格。");
        setIsUpdatingPositions(false);
        return;
      }

      // 2. 同步水平避開重疊 (保持剛剛計算好的 Y 軸現價相對高度)
      const resolved = applyAvoidOverlapToPositions(
        updatedPositions,
        canvasRef.current,
        tagSizeOffset
      );

      // 3. 更新 state 與即時儲存至 Firestore / LocalStorage
      setPositions(resolved.positions);
      setHasUnsavedChanges(false);

      await savePositionsDirectly(resolved.positions, tagSizeOffset);

      // 4. 觸發自訂事件通知全域同步
      window.dispatchEvent(
        new CustomEvent("visual_lines_positions_updated", {
          detail: {
            allPositions: resolved.positions,
          },
        })
      );

      playSuccessSound();
      toast.success(
        `已成功更新位置！已依勾選之 ${updatedCount} 檔卡片同步分隔線與現價位置（已避開重疊並完整保留原本顏色邊框與尺寸）`,
        {
          id: "update-positions",
          duration: 4000,
        }
      );
    } catch (err) {
      console.error("Update positions error:", err);
      toast.error("更新位置時發生錯誤，請稍後再試");
    } finally {
      setIsUpdatingPositions(false);
    }
  };

  // 輔助函式：返回交易總覽時進入全螢幕模式
  const triggerFullscreenOverview = () => {
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn("Fullscreen request rejected:", err);
        });
      }
    } catch (e) {
      console.warn("Trigger fullscreen error:", e);
    }
  };

  // 點擊原點跳轉至該股視覺圖示化卡片
  const handleJumpToCard = (tabId: string, symbol: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    playClickSound();
    triggerFullscreenOverview();

    if (onSelectStock) {
      onSelectStock(tabId, symbol);
    } else {
      window.dispatchEvent(
        new CustomEvent("jump_to_stock_card", {
          detail: { tabId, symbol },
        })
      );
      onClose();
    }

    toast.info(`正在前往「${symbol}」視覺圖示化卡片...`, {
      id: `jump-${symbol}`,
      duration: 2000,
    });
  };

  // 單檔股票依卡片分隔線與現價重新校準座標
  const handleCalibrateSingleStock = useCallback(
    (sym: string) => {
      const tab = allStockMap.get(sym) || allTabs.find((t) => (t.symbol || "").trim().toUpperCase() === sym);
      if (!tab) {
        toast.error(`找不到股票「${sym}」的資料`);
        return;
      }
      const strat = strategiesMap?.[tab.id] || (tab as any).strategy;
      const stat = statsMap?.[tab.id];
      const avgCost = stat?.totalQuantity !== 0 ? stat?.averagePrice : undefined;
      const holdingQty = stat?.totalQuantity ?? (tab as any).holdingQuantity;
      const targetY = calculateCanvasYFromDividers(
        tab,
        strat,
        avgCost,
        holdingQty
      );

      if (targetY === null) {
        toast.error(`無法為「${sym}」計算卡片分隔線座標`);
        return;
      }

      const newPos = {
        ...positions,
        [sym]: {
          ...positions[sym],
          y: targetY,
          shape: "circle" as const,
          sizeOffset: positions[sym]?.sizeOffset ?? tagSizeOffset,
          updatedAt: new Date().toISOString(),
        },
      };
      setPositions(newPos);
      savePositionsDirectly(newPos, tagSizeOffset);
      playSuccessSound();
      toast.success(`已將「${sym}」依卡片分隔線精準校準至 Y: ${targetY.toFixed(1)}%`, {
        id: `calib-${sym}`,
      });
    },
    [allStockMap, allTabs, statsMap, strategiesMap, tagSizeOffset, positions, savePositionsDirectly]
  );

  // 全域所有畫布股票一鍵依卡片分隔線重新校準座標
  const handleCalibrateAllActiveStocks = useCallback(() => {
    if (activeCanvasSymbols.length === 0) return;
    let count = 0;
    const newPositions: PositionMap = { ...positions };

    activeCanvasSymbols.forEach((sym) => {
      const tab = allStockMap.get(sym) || allTabs.find((t) => (t.symbol || "").trim().toUpperCase() === sym);
      if (!tab) return;
      const strat = strategiesMap?.[tab.id] || (tab as any).strategy;
      const stat = statsMap?.[tab.id];
      const avgCost = stat?.totalQuantity !== 0 ? stat?.averagePrice : undefined;
      const holdingQty = stat?.totalQuantity ?? (tab as any).holdingQuantity;
      const targetY = calculateCanvasYFromDividers(
        tab,
        strat,
        avgCost,
        holdingQty
      );
      if (targetY === null) return;

      newPositions[sym] = {
        ...newPositions[sym],
        y: targetY,
        shape: "circle",
        sizeOffset: newPositions[sym]?.sizeOffset ?? tagSizeOffset,
        updatedAt: new Date().toISOString(),
      };
      count++;
    });

    setPositions(newPositions);
    savePositionsDirectly(newPositions, tagSizeOffset);
    playSuccessSound();
    toast.success(`已將畫布上 ${count} 檔股票依各自卡片分隔線重新校準座標`, {
      id: "calib-all",
    });
  }, [activeCanvasSymbols, allStockMap, positions, statsMap, strategiesMap, tagSizeOffset, savePositionsDirectly]);

  // 儲存位置、形狀與大小 (Save button 或 Shift + S，0ms 秒存)
  const handleSavePositions = useCallback(() => {
    playSuccessSound();
    const saved = savePositionsDirectly(positions, tagSizeOffset);
    toast.success(`圖表標籤位置、形狀與尺寸已成功儲存！(共 ${Object.keys(saved).length} 檔)`, {
      id: "visual-lines-save",
      duration: 2500,
    });
  }, [positions, tagSizeOffset, savePositionsDirectly]);

  // 切換 Primial 分批進場金字塔動態互動圖表 (Alt+Z)
  const handleTogglePyramidView = useCallback(() => {
    if (showPyramidView) {
      setShowPyramidView(false);
      playClickSound();
      toast.info("已返回視覺線看板 (Alt + Z)", { id: "primial-close", duration: 1200 });
      return;
    }

    // 若尚未勾選/框選股票，智慧自動帶入畫布上現有的股票 (或全庫股票)
    let targetSymbols = [...selectedTagSymbols];
    if (targetSymbols.length === 0) {
      if (activeCanvasSymbols && activeCanvasSymbols.length > 0) {
        targetSymbols = [...activeCanvasSymbols];
        setSelectedTagSymbols(targetSymbols);
      } else if (allTabs && allTabs.length > 0) {
        const fromTabs = allTabs.map((t) => (t?.symbol || "").trim().toUpperCase()).filter(Boolean);
        if (fromTabs.length > 0) {
          targetSymbols = fromTabs;
          setSelectedTagSymbols(targetSymbols);
        }
      }
    }

    if (targetSymbols.length === 0) {
      playClickSound();
      toast.info("目前畫布或清單中尚無股票可供開啟金字塔圖表", {
        id: "primial-need-selection",
        duration: 2500,
      });
      return;
    }

    playSuccessSound();
    setShowPyramidView(true);
    setActivePyramidSymbol(targetSymbols[0]);
    toast.success(`已開啟 Primial 金字塔圖表 (${targetSymbols.length} 檔，按 Alt + Z 返回)`, {
      id: "primial-open",
      duration: 1500,
    });
  }, [showPyramidView, selectedTagSymbols, activeCanvasSymbols, allTabs]);

  // 跨設備或未勾選時，保證 Primial 視圖始終能取用最完整的個股代號集合
  const displayPyramidSymbols = useMemo(() => {
    if (selectedTagSymbols && selectedTagSymbols.length > 0) {
      return selectedTagSymbols;
    }
    if (activeCanvasSymbols && activeCanvasSymbols.length > 0) {
      return activeCanvasSymbols;
    }
    if (allTabs && allTabs.length > 0) {
      return allTabs.map((t) => (t?.symbol || "").trim().toUpperCase()).filter(Boolean);
    }
    return [];
  }, [selectedTagSymbols, activeCanvasSymbols, allTabs]);

  // 跳轉至指定個股卡片並將畫面上下置中
  const handleJumpToPyramidStock = useCallback((symbol: string) => {
    const cleanSym = symbol.trim().toUpperCase();
    setActivePyramidSymbol(cleanSym);
    playClickSound();
    // 若該卡片目前為收合狀態，自動展開以便完整呈現圖表內容
    setCollapsedCards((prev) => (prev[cleanSym] ? { ...prev, [cleanSym]: false } : prev));
    setTimeout(() => {
      const cardEl = document.getElementById(`pyramid-card-${cleanSym}`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 40);
  }, []);

  // 單獨展開/收合卡片
  const toggleCardCollapse = useCallback((symbol: string) => {
    playClickSound();
    setCollapsedCards((prev) => ({
      ...prev,
      [symbol]: !prev[symbol],
    }));
  }, []);

  // 全部展開/收合 (依 displayPyramidSymbols 為準)
  const toggleAllCardsCollapse = useCallback(() => {
    playClickSound();
    const symbols = displayPyramidSymbols;
    if (symbols.length === 0) return;
    const allCollapsed = symbols.every((sym) => Boolean(collapsedCards[sym]));
    const nextState: Record<string, boolean> = { ...collapsedCards };
    symbols.forEach((sym) => {
      nextState[sym] = !allCollapsed;
    });
    setCollapsedCards(nextState);
  }, [displayPyramidSymbols, collapsedCards]);

  // 快捷切換 Primial 金字塔圖表卡片分隔線 (Alt + D)
  const handleTogglePyramidCardDividers = useCallback(() => {
    playClickSound();
    setPyramidShowCardDividers((prev) => {
      const next = !prev;
      toast.info(next ? "已開啟「卡片分隔線」(Alt + D)" : "已關閉「卡片分隔線」(Alt + D)", {
        id: "pyramid-card-dividers-toggle",
        duration: 1200,
      });
      return next;
    });
  }, []);

  // 快捷切換 Primial 金字塔圖表支撐 (Alt + R)
  const handleTogglePyramidSupport = useCallback(() => {
    playClickSound();
    setPyramidLevelTypes((prev) => {
      const next = { ...prev, support: !prev.support };
      toast.info(next.support ? "已開啟「支撐防線」(Alt + R)" : "已關閉「支撐防線」(Alt + R)", {
        id: "pyramid-support-toggle",
        duration: 1200,
      });
      return next;
    });
  }, []);

  // 快捷切換 Primial 金字塔圖表壓力 (Alt + P)
  const handleTogglePyramidResistance = useCallback(() => {
    playClickSound();
    setPyramidLevelTypes((prev) => {
      const next = { ...prev, resistance: !prev.resistance };
      toast.info(next.resistance ? "已開啟「壓力防線」(Alt + P)" : "已關閉「壓力防線」(Alt + P)", {
        id: "pyramid-resistance-toggle",
        duration: 1200,
      });
      return next;
    });
  }, []);

  // 快捷切換 Primial 金字塔圖表 攤平 | 突破價位 (Alt + T / Alt + B)
  const handleTogglePyramidCalcMode = useCallback((targetMode?: "averaging" | "breakout") => {
    playClickSound();
    setPyramidCalcMode((prev) => {
      const next = targetMode !== undefined ? targetMode : (prev === "averaging" ? "breakout" : "averaging");
      if (next === "breakout") {
        toast.info("已切換為：向上突破加碼價位試算 (+2%, +4%, +6%, +8%)", {
          id: "pyramid-calc-mode-toggle",
          duration: 1500,
        });
      } else {
        toast.info("已切換為：向下分批攤平價位試算 (-3%, -6%, -9%, -12%)", {
          id: "pyramid-calc-mode-toggle",
          duration: 1500,
        });
      }
      return next;
    });
  }, []);

  // 計算個股 Primial 金字塔圖表所有必要資料
  const getStockPyramidData = useCallback(
    (symbol: string) => {
      try {
        const cleanSym = (symbol || "").trim().toUpperCase();
        const candidateTabs = (allTabs || []).filter(
          (t) => (t?.symbol || "").trim().toUpperCase() === cleanSym
        );
        const tab =
          allStockMap?.get(cleanSym) ||
          candidateTabs.find((t) => t?.status !== "COMPLETED") ||
          candidateTabs[0];
        const tabId = tab?.id || cleanSym;
        const strategy = strategiesMap?.[tabId] || strategiesMap?.[cleanSym];

        // 取得歷史交易 (若當前 tabId 無資料，跨候選 tab 或 tab.trades 補全)
        let rawTrades: any[] = tradesMap?.[tabId] || tradesMap?.[cleanSym] || [];
        if ((!rawTrades || rawTrades.length === 0) && candidateTabs.length > 0) {
          for (const cTab of candidateTabs) {
            if (cTab?.id && tradesMap?.[cTab.id] && tradesMap[cTab.id].length > 0) {
              rawTrades = tradesMap[cTab.id];
              break;
            }
          }
        }
        if ((!rawTrades || rawTrades.length === 0) && Array.isArray((tab as any)?.trades) && (tab as any).trades.length > 0) {
          rawTrades = (tab as any).trades;
        }
        const trades = Array.isArray(rawTrades) ? rawTrades.filter((t) => t && typeof t === "object") : [];

        // 取得統計數據
        let stats = statsMap?.[tabId] || statsMap?.[cleanSym];
        if (!stats && candidateTabs.length > 0) {
          for (const cTab of candidateTabs) {
            if (cTab?.id && statsMap?.[cTab.id]) {
              stats = statsMap[cTab.id];
              break;
            }
          }
        }

        // 現價
        const liveP = livePrices?.[cleanSym];
        const currentPrice =
          typeof liveP === "number" && liveP > 0
            ? liveP
            : tab?.currentPrice && tab.currentPrice > 0
            ? tab.currentPrice
            : stats?.averagePrice && stats.averagePrice > 0
            ? stats.averagePrice
            : 0;

        // 若 stats 缺少或持有數為 0，且存在 trades，透過 calculateStats 即時動態計算精準持有數據
        if ((!stats || stats.totalQuantity === undefined || stats.totalQuantity === 0) && trades.length > 0) {
          stats = calculateStats(trades, currentPrice);
        }

        // 平均成本
        const holdingAvgPrice =
          stats?.averagePrice && stats.averagePrice > 0
            ? stats.averagePrice
            : typeof tab?.averageCost === "number" && tab.averageCost > 0
            ? tab.averageCost
            : !isNaN(parseFloat(String(tab?.averageCost))) && parseFloat(String(tab?.averageCost)) > 0
            ? parseFloat(String(tab?.averageCost))
            : 0;

        // 持有股數
        let holdingQty =
          stats?.totalQuantity !== undefined && stats.totalQuantity !== null && !isNaN(stats.totalQuantity)
            ? stats.totalQuantity
            : typeof tab?.holdingQuantity === "number" && !isNaN(tab.holdingQuantity)
            ? tab.holdingQuantity
            : !isNaN(parseFloat(String(tab?.holdingQuantity)))
            ? parseFloat(String(tab?.holdingQuantity))
            : 0;

        // 資金池與預計購買量計算 (支援 plannedBuyPercent、plannedBuyQty、averagingRowsSys2 與持有股數推算)
        const currentRiskPool =
          maxStrategyRiskPool60 && maxStrategyRiskPool60 > 0 ? maxStrategyRiskPool60 : 100000;
        const plannedPercent =
          tab?.plannedBuyPercent !== undefined && tab?.plannedBuyPercent !== null && !isNaN(Number(tab.plannedBuyPercent))
            ? Number(tab.plannedBuyPercent)
            : 0;
        const usableCapital = plannedPercent > 0 ? currentRiskPool * (plannedPercent / 100) : 0;
        
        let plannedQty = 0;
        if (currentPrice > 0 && usableCapital > 0) {
          plannedQty = Math.floor(usableCapital / currentPrice);
        } else if (tab?.plannedBuyQty && Number(tab.plannedBuyQty) > 0) {
          plannedQty = Number(tab.plannedBuyQty);
        }

        // 向下攤平試算設定 (系統2) 與 向上突破加碼試算設定 (系統1)
        const { sys2: defaultSys2 } = generateAveragingDownRows(
          holdingAvgPrice > 0 ? holdingAvgPrice : currentPrice
        );
        const { sys1: defaultUp1 } = generatePyramidUpRows(
          holdingAvgPrice > 0 ? holdingAvgPrice : currentPrice
        );

        const averagingRowsSys2 =
          tab?.averagingRowsSys2 &&
          Array.isArray(tab.averagingRowsSys2) &&
          tab.averagingRowsSys2.length > 0
            ? tab.averagingRowsSys2
            : defaultSys2;

        const pyramidRows =
          tab?.pyramidRows &&
          Array.isArray(tab.pyramidRows) &&
          tab.pyramidRows.length > 0
            ? tab.pyramidRows
            : (tab?.averagingRows && Array.isArray(tab.averagingRows) && tab.averagingRows.length > 0 ? tab.averagingRows : defaultUp1);

        const activeRows = pyramidCalcMode === "breakout" ? pyramidRows : averagingRowsSys2;

        // 若尚未設定 plannedQty，嘗試從 activeRows 計算填寫之各批總預購股數
        if (plannedQty <= 0 && activeRows && activeRows.length > 0) {
          const rowsSum = activeRows.reduce((acc: number, r: any) => {
            const q1 = r?.quantity ? parseFloat(r.quantity) : 0;
            const q2 = r?.quantity2 ? parseFloat(r.quantity2) : 0;
            return acc + (isNaN(q1) ? 0 : q1) + (isNaN(q2) ? 0 : q2);
          }, 0);
          if (rowsSum > 0) plannedQty = rowsSum;
        }

        // 若仍為 0 且已有持股或交易紀錄，以持股推算或作為規劃基準
        if (plannedQty <= 0 && holdingQty > 0) {
          plannedQty = Math.max(holdingQty, Math.ceil(holdingQty / 0.15));
        }

        // 使用 calculations 模組集中計算四批次規劃與已購數量，保證所有頁面與圖表數值精確同步
        const batchPlanResult = calculateBatchPlanning({
          plannedQty,
          usableCapital,
          currentPrice,
          holdingQty,
          trades,
          averagingRowsSys2: activeRows,
          plannedBuyQty: tab?.plannedBuyQty ? Number(tab.plannedBuyQty) : undefined,
          plannedBuyPercent: tab?.plannedBuyPercent !== undefined && tab?.plannedBuyPercent !== null ? Number(tab.plannedBuyPercent) : undefined,
          tradeType: tab?.tradeType,
          maxStrategyRiskPool60,
        });

        const batchConfigList = batchPlanResult?.batches || [];
        const plannedShares = batchPlanResult?.plannedQty || plannedQty;
        holdingQty = Math.max(holdingQty, batchPlanResult?.totalBought || 0);

        // 關鍵防線
        const visualLevels = getVisualPriceLevels(tab, strategy, (tab as any)?.plannedOrders) || [];

        // 公司英文名稱
        const companyName = tab?.companyName || (tab as any)?.cardTitle || (tab as any)?.name || cleanSym;

        return {
          symbol: cleanSym,
          tab,
          companyName,
          currentPrice,
          holdingAvgPrice,
          holdingQty,
          usableCapital,
          plannedQty: plannedShares || plannedQty,
          batchConfigList,
          averagingRowsSys2,
          pyramidRows,
          trades,
          visualLevels,
        };
      } catch (err) {
        console.error(`getStockPyramidData error for ${symbol}:`, err);
        return {
          symbol: (symbol || "").trim().toUpperCase(),
          tab: null,
          companyName: (symbol || "").trim().toUpperCase(),
          currentPrice: 0,
          holdingAvgPrice: 0,
          holdingQty: 0,
          usableCapital: 0,
          plannedQty: 0,
          batchConfigList: [],
          averagingRowsSys2: [],
          trades: [],
          visualLevels: [],
        };
      }
    },
    [
      allStockMap,
      allTabs,
      strategiesMap,
      tradesMap,
      statsMap,
      livePrices,
      maxStrategyRiskPool60,
    ]
  );

  // 當處於 Primial 視圖時，監聽滾動事件使頂部 Tabs 與畫面中最近的個股卡片雙向連動
  useEffect(() => {
    if (!showPyramidView || displayPyramidSymbols.length === 0) return;

    const container = pyramidScrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const containerCenterY = containerRect.top + containerRect.height / 2;

      let closestSymbol = displayPyramidSymbols[0];
      let minDistance = Infinity;

      displayPyramidSymbols.forEach((sym) => {
        const el = document.getElementById(`pyramid-card-${sym}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const elCenterY = rect.top + rect.height / 2;
          const distance = Math.abs(elCenterY - containerCenterY);
          if (distance < minDistance) {
            minDistance = distance;
            closestSymbol = sym;
          }
        }
      });

      if (closestSymbol) {
        setActivePyramidSymbol((prev) => (prev !== closestSymbol ? closestSymbol : prev));
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [showPyramidView, displayPyramidSymbols]);

  const lastHKeyPressTimeRef = useRef<number>(0);

  // 鍵盤快速鍵 (Shift + S, Alt + W, Escape, Double H / Shift + H)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === "INPUT" || activeEl?.tagName === "TEXTAREA" || activeEl?.getAttribute("contenteditable") === "true";

      // 快捷鍵 Alt + Z 切換 Primial 分批進場金字塔動態互動圖表 (支援 Windows / Mac Option+Z / 注音及各鍵盤輸入法)
      const isAltZ =
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "z" || e.key === "Z" || e.code === "KeyZ" || e.key === "Ω" || e.keyCode === 90 || e.which === 90);

      if (isAltZ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (isInput) {
          (activeEl as HTMLElement)?.blur?.();
        }
        handleTogglePyramidView();
        return;
      }

      if (isInput) return;

      // 0. 快速連按兩次 H H 或 Shift + H -> 切換全螢幕 / 預覽模式
      const isPureH = (e.key === "h" || e.key === "H") && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
      if (isPureH) {
        const now = Date.now();
        if (now - lastHKeyPressTimeRef.current <= 500) {
          e.preventDefault();
          lastHKeyPressTimeRef.current = 0;
          if (!document.fullscreenElement) {
            if (document.documentElement.requestFullscreen) {
              document.documentElement.requestFullscreen().then(() => {
                toast.success("已進入全螢幕 / 預覽模式", { id: "fullscreen-mode", duration: 1500 });
              }).catch(() => {
                toast.success("已切換預覽模式", { id: "fullscreen-mode", duration: 1500 });
              });
            } else {
              toast.success("已切換預覽模式", { id: "fullscreen-mode", duration: 1500 });
            }
          } else {
            if (document.exitFullscreen) {
              document.exitFullscreen().then(() => {
                toast.info("已退出全螢幕 / 預覽模式", { id: "fullscreen-mode", duration: 1500 });
              }).catch(() => {});
            }
          }
          return;
        } else {
          lastHKeyPressTimeRef.current = now;
        }
      }

      if (e.shiftKey && (e.key === "H" || e.key === "h") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (!document.fullscreenElement) {
          if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().then(() => {
              toast.success("已進入全螢幕 / 預覽模式", { id: "fullscreen-mode", duration: 1500 });
            }).catch(() => {});
          }
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen().then(() => {
              toast.info("已退出全螢幕 / 預覽模式", { id: "fullscreen-mode", duration: 1500 });
            }).catch(() => {});
          }
        }
        return;
      }

      if (e.shiftKey && (e.key === "S" || e.key === "s") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        handleSavePositions();
        return;
      }

      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "W" || e.key === "w" || e.code === "KeyW")
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerFullscreenOverview();
        onClose();
        return;
      }

      // 快捷鍵 Alt + D: 快速切換卡片分隔線 (金字塔圖表)
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "D" || e.key === "d" || e.code === "KeyD" || e.key === "∂")
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (isInput) (activeEl as HTMLElement)?.blur?.();
        handleTogglePyramidCardDividers();
        return;
      }

      // 快捷鍵 Alt + R: 快速切換支撐 (金字塔圖表)
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "R" || e.key === "r" || e.code === "KeyR" || e.key === "®")
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (isInput) (activeEl as HTMLElement)?.blur?.();
        handleTogglePyramidSupport();
        return;
      }

      // 快捷鍵 Alt + P: 快速切換壓力 (金字塔圖表)
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "P" || e.key === "p" || e.code === "KeyP" || e.key === "π")
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (isInput) (activeEl as HTMLElement)?.blur?.();
        handleTogglePyramidResistance();
        return;
      }

      // 快捷鍵 Alt + T: 快速切換攤平價位 (金字塔圖表)
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "T" || e.key === "t" || e.code === "KeyT" || e.key === "†")
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (isInput) (activeEl as HTMLElement)?.blur?.();
        handleTogglePyramidCalcMode("averaging");
        return;
      }

      // 快捷鍵 Alt + B: 快速切換突破價位 (金字塔圖表)
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "B" || e.key === "b" || e.code === "KeyB" || e.key === "∫")
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (isInput) (activeEl as HTMLElement)?.blur?.();
        handleTogglePyramidCalcMode("breakout");
        return;
      }

      // 快捷鍵 Alt + 左右按鍵：在 Primal 頁面切換個股名稱 tab；在主看板切換虛擬/真實交易 tab
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.code === "ArrowLeft" || e.code === "ArrowRight")
      ) {
        e.preventDefault();
        e.stopPropagation();

        if (showPyramidView && displayPyramidSymbols.length > 0) {
          const isLeft = e.key === "ArrowLeft" || e.code === "ArrowLeft";
          const currentSym = (activePyramidSymbol || displayPyramidSymbols[0] || "").trim().toUpperCase();
          const curIdx = displayPyramidSymbols.findIndex(
            (s) => s.trim().toUpperCase() === currentSym
          );
          const safeCurIdx = curIdx >= 0 ? curIdx : 0;
          const nextIdx = isLeft
            ? (safeCurIdx - 1 + displayPyramidSymbols.length) % displayPyramidSymbols.length
            : (safeCurIdx + 1) % displayPyramidSymbols.length;
          const nextSym = displayPyramidSymbols[nextIdx].trim().toUpperCase();
          handleJumpToPyramidStock(nextSym);
          toast.info(`已切換個股：${nextSym} (${nextIdx + 1}/${displayPyramidSymbols.length})`, {
            id: "primal-stock-switch",
            duration: 1000,
          });
          return;
        }

        const nextMode = e.key === "ArrowLeft"
          ? (activeTradeModeTab === "simulated" ? "real" : "simulated")
          : (activeTradeModeTab === "real" ? "simulated" : "real");
        handleTradeModeTabChange(nextMode);
        toast.info(nextMode === "real" ? "已切換至：真實交易 (Alt + →)" : "已切換至：虛擬交易 (Alt + ←)", {
          id: "trade-mode-toggle",
          duration: 1200,
        });
        return;
      }

      if (e.key === "Escape") {
        if (showPyramidView) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          setShowPyramidView(false);
          playClickSound();
          toast.info("已返回視覺線看板 (Esc)", { id: "primial-close", duration: 1200 });
          return;
        }
        if (isMainTabDropdownOpen || isSubTabDropdownOpen || isStockDropdownOpen) {
          setIsMainTabDropdownOpen(false);
          setIsSubTabDropdownOpen(false);
          setIsStockDropdownOpen(false);
          return;
        }
        triggerFullscreenOverview();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [
    isOpen,
    handleSavePositions,
    onClose,
    isMainTabDropdownOpen,
    isSubTabDropdownOpen,
    isStockDropdownOpen,
    activeTradeModeTab,
    handleTogglePyramidView,
    showPyramidView,
    displayPyramidSymbols,
    activePyramidSymbol,
    handleJumpToPyramidStock,
    handleTogglePyramidCardDividers,
    handleTogglePyramidSupport,
    handleTogglePyramidResistance,
  ]);

  // 滑鼠與觸控拖曳標籤
  const handleTagPointerDown = (
    e: React.MouseEvent | React.TouchEvent,
    symbol: string,
    currentX: number,
    currentY: number
  ) => {
    if (!canvasRef.current) return;
    
    // 如果點擊的是按鈕或其子元素 (如勾選按鈕、刪除按鈕、狀態圓點按鈕)，交由各自的事件處理器
    const targetEl = e.target as HTMLElement | null;
    if (targetEl && (targetEl.closest("button") || targetEl.tagName === "BUTTON")) {
      return;
    }

    // 不要在 mousedown 立即 e.preventDefault()，避免阻止瀏覽器正常的 dblclick (雙擊) 事件派發
    if ("touches" in e) {
      e.preventDefault();
    }
    e.stopPropagation();

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const currentPanY = canvasPanYRef.current;
    const tagPixelX = canvasRect.left + (currentX / 100) * canvasRect.width;
    const tagPixelY = canvasRect.top + currentPanY + (currentY / 100) * canvasRect.height;

    const startClientX = clientX;
    const startClientY = clientY;
    let hasMoved = false;

    // 記錄初始位置快照，便於按住 Shift 水平移動或群組同步移動
    const initialPositions = { ...positions };
    const cleanSym = symbol.trim().toUpperCase();
    const isSymSelected = selectedTagSymbols.includes(cleanSym);

    // 監聽 Shift 鍵即時按下/放開狀態
    let isShiftHeld = "shiftKey" in e && Boolean((e as React.MouseEvent).shiftKey);

    const handleKeyDownDuringDrag = (ke: KeyboardEvent) => {
      if (ke.key === "Shift") {
        isShiftHeld = true;
      }
    };
    const handleKeyUpDuringDrag = (ke: KeyboardEvent) => {
      if (ke.key === "Shift") {
        isShiftHeld = false;
      }
    };
    window.addEventListener("keydown", handleKeyDownDuringDrag);
    window.addEventListener("keyup", handleKeyUpDuringDrag);

    draggingSymbolRef.current = symbol;
    dragOffsetRef.current = {
      offsetX: clientX - tagPixelX,
      offsetY: clientY - tagPixelY,
    };

    const handlePointerMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!draggingSymbolRef.current || !canvasRef.current) return;

      const curMoveX = "touches" in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curMoveY = "touches" in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const dist = Math.hypot(curMoveX - startClientX, curMoveY - startClientY);
      if (dist > 4) {
        hasMoved = true;
      }

      if (hasMoved) {
        moveEvent.preventDefault();
      }

      const isShift =
        isShiftHeld || Boolean("shiftKey" in moveEvent && (moveEvent as MouseEvent).shiftKey);

      const rect = canvasRef.current.getBoundingClientRect();
      const activeSymbol = draggingSymbolRef.current;

      if (isShift) {
        // 【按下 Shift 水平方向移動】：嚴格鎖定 Y 軸高度（現價相對高度維持 100% 不變），僅允許在水平 X 軸自由左右平移
        const targetPixelX = curMoveX - dragOffsetRef.current.offsetX;
        const rawPctX = ((targetPixelX - rect.left) / rect.width) * 100;
        const boundedX = Math.max(2, Math.min(96, rawPctX));
        const deltaX = boundedX - currentX;

        // 若當前拖曳的股票為勾選狀態，且同時有勾選其他股票，則所有勾選的股票一同水平位移 deltaX，各自維持各自原先的 Y 軸高度
        if (isSymSelected && selectedTagSymbols.length > 1) {
          setPositions((prev) => {
            const next = { ...prev };
            const nowIso = new Date().toISOString();
            selectedTagSymbols.forEach((s) => {
              const basePos = initialPositions[s] || prev[s];
              if (basePos) {
                const newX = Math.max(2, Math.min(96, basePos.x + deltaX));
                next[s] = {
                  ...basePos,
                  x: parseFloat(newX.toFixed(2)),
                  y: basePos.y, // 鎖定 Y 軸高度不變
                  updatedAt: nowIso,
                };
              }
            });
            return next;
          });
        } else {
          // 單檔股票水平移動：Y 軸嚴格鎖定於起始位置
          const origY = initialPositions[activeSymbol]?.y ?? currentY;
          setPositions((prev) => ({
            ...prev,
            [activeSymbol]: {
              ...prev[activeSymbol],
              x: parseFloat(boundedX.toFixed(2)),
              y: origY, // 鎖定 Y 軸高度不變
              shape: "circle",
              sizeOffset: prev[activeSymbol]?.sizeOffset ?? 0,
              updatedAt: new Date().toISOString(),
            },
          }));
        }
        setHasUnsavedChanges(true);
      } else {
        // 原本的定位與自由拖曳功能 (保持完全不變)
        const targetPixelX = curMoveX - dragOffsetRef.current.offsetX;
        const targetPixelY = curMoveY - dragOffsetRef.current.offsetY;

        const rawPctX = ((targetPixelX - rect.left) / rect.width) * 100;
        const rawPctY = ((targetPixelY - (rect.top + canvasPanYRef.current)) / rect.height) * 100;

        const boundedX = Math.max(2, Math.min(96, rawPctX));
        const boundedY = Math.max(2, Math.min(96, rawPctY));

        setPositions((prev) => ({
          ...prev,
          [activeSymbol]: {
            ...prev[activeSymbol],
            x: parseFloat(boundedX.toFixed(2)),
            y: parseFloat(boundedY.toFixed(2)),
            shape: "circle",
            sizeOffset: prev[activeSymbol]?.sizeOffset ?? 0,
            updatedAt: new Date().toISOString(),
          },
        }));
        setHasUnsavedChanges(true);
      }
    };

    const handlePointerUp = (upEvent: MouseEvent | TouchEvent) => {
      const activeSym = draggingSymbolRef.current;
      draggingSymbolRef.current = null;
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDownDuringDrag);
      window.removeEventListener("keyup", handleKeyUpDuringDrag);

      // 若滑鼠或手指沒有實質位移（單純點擊一下），則切換勾選狀態 (已勾選 -> 取消勾選；未勾選 -> 勾選)
      if (!hasMoved && activeSym) {
        const curUpX = "changedTouches" in upEvent ? upEvent.changedTouches[0].clientX : (upEvent as MouseEvent).clientX;
        const curUpY = "changedTouches" in upEvent ? upEvent.changedTouches[0].clientY : (upEvent as MouseEvent).clientY;
        const totalDist = Math.hypot(curUpX - startClientX, curUpY - startClientY);
        if (totalDist <= 4) {
          playClickSound();
          const cleanSym = activeSym.trim().toUpperCase();
          setSelectedTagSymbols((prev) =>
            prev.includes(cleanSym) ? prev.filter((s) => s !== cleanSym) : [...prev, cleanSym]
          );
        }
      }
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: false });
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove, { passive: false });
    window.addEventListener("touchend", handlePointerUp);
  };

  // 處理畫布空白處框選複數股票標籤 (Box Selection Marquee)
  const handleCanvasPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return;

    // 檢查點擊目標是否為互動元件（標籤、按鈕、輸入框、下拉選單等），如果是則不觸發畫布框選
    const targetEl = e.target as HTMLElement | null;
    if (
      targetEl &&
      (targetEl.closest("button") ||
        targetEl.closest("input") ||
        targetEl.closest("[data-tag-symbol]") ||
        targetEl.closest("[data-no-marquee]"))
    ) {
      return;
    }

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const currentPanY = canvasPanYRef.current;
    const startCanvasX = clientX - canvasRect.left;
    const startCanvasY = clientY - canvasRect.top - currentPanY;

    let isMarquee = false;
    let latestCurX = startCanvasX;
    let latestCurY = startCanvasY;

    const handlePointerMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!canvasRef.current) return;
      const curClientX = "touches" in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curClientY = "touches" in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const rect = canvasRef.current.getBoundingClientRect();
      latestCurX = curClientX - rect.left;
      latestCurY = curClientY - rect.top - canvasPanYRef.current;

      const dist = Math.hypot(latestCurX - startCanvasX, latestCurY - startCanvasY);
      if (dist > 5) {
        isMarquee = true;
        moveEvent.preventDefault();
        setSelectionBox({
          startX: startCanvasX,
          startY: startCanvasY,
          currentX: latestCurX,
          currentY: latestCurY,
        });
      }
    };

    const handlePointerUp = (upEvent: MouseEvent | TouchEvent) => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);

      if (isMarquee && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const minX = Math.min(startCanvasX, latestCurX);
        const maxX = Math.max(startCanvasX, latestCurX);
        const minY = Math.min(startCanvasY, latestCurY);
        const maxY = Math.max(startCanvasY, latestCurY);

        if (maxX - minX >= 6 || maxY - minY >= 6) {
          const selectedInBox: string[] = [];
          activeCanvasSymbols.forEach((sym) => {
            const pos = positions[sym];
            if (!pos) return;
            const tagPx = (pos.x / 100) * rect.width;
            const tagPy = (pos.y / 100) * rect.height;
            const effOffset = pos.sizeOffset !== undefined ? pos.sizeOffset : tagSizeOffset;
            const tagRadius = Math.max(44, 54 + effOffset * 2.2) / 2;

            // 判斷標籤圓形是否落入或相交於框選矩形
            if (
              tagPx + tagRadius >= minX &&
              tagPx - tagRadius <= maxX &&
              tagPy + tagRadius >= minY &&
              tagPy - tagRadius <= maxY
            ) {
              selectedInBox.push(sym);
            }
          });

          if (selectedInBox.length > 0) {
            playSuccessSound();
            const isShift = (upEvent as MouseEvent).shiftKey;
            setSelectedTagSymbols((prev) => {
              if (isShift) {
                return Array.from(new Set([...prev, ...selectedInBox]));
              }
              return selectedInBox;
            });
            toast.success(`已框選 ${selectedInBox.length} 檔股票標籤（已直接勾選）`, { id: "box-select" });
          } else {
            const isShift = (upEvent as MouseEvent).shiftKey;
            if (!isShift) {
              setSelectedTagSymbols([]);
            }
          }
        }
      } else {
        // 單純點擊空白處且未按 Shift，取消所有勾選
        const isShift = (upEvent as MouseEvent).shiftKey;
        if (!isShift) {
          setSelectedTagSymbols([]);
        }
      }

      setSelectionBox(null);
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: false });
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove, { passive: false });
    window.addEventListener("touchend", handlePointerUp);
  };

  // 自動依 6 條視覺線整齊排列圖表上的標籤
  const handleAutoArrange = () => {
    const syms = Object.keys(positions);
    if (syms.length === 0) {
      toast.info("圖表上尚無標籤可排列，請先新增股票標籤");
      return;
    }
    playClickSound();

    const newPosMap: PositionMap = {};
    const lineIndices = [0, 1, 2, 3, 4, 5];

    syms.forEach((sym, index) => {
      const lineIdx = lineIndices[index % lineIndices.length];
      const targetLine = VISUAL_LINES[lineIdx];

      const itemsInLine = Math.ceil(syms.length / VISUAL_LINES.length) || 1;
      const slotInLine = Math.floor(index / VISUAL_LINES.length);
      const startX = 14;
      const endX = 86;
      const stepX = itemsInLine > 1 ? (endX - startX) / itemsInLine : 25;
      const xPct = Math.min(88, startX + slotInLine * stepX + (index % 2 === 0 ? 0 : 3));

      newPosMap[sym] = {
        ...positions[sym],
        x: parseFloat(xPct.toFixed(2)),
        y: targetLine.yPercent - 2,
        shape: "circle",
        sizeOffset: positions[sym]?.sizeOffset ?? 0,
        updatedAt: new Date().toISOString(),
      };
    });

    setPositions(newPosMap);
    setHasUnsavedChanges(true);
    toast.info("已將圖表標籤自動依視覺線對齊排列");
  };

  if (!isOpen) return null;

  const MainIcon = mainTabDisplayInfo.icon;

  return (
    <div className="fixed inset-0 z-[99999] bg-white flex flex-col select-none overflow-hidden font-sans">
      {/* Top Header Bar - Nike Athletic High-Contrast Aesthetic */}
      <header className="w-full bg-[#111111] text-white border-b border-zinc-800/90 px-3 sm:px-4 py-2 flex items-center justify-between gap-3 shadow-md z-50 shrink-0 relative overflow-visible">
        {/* Left: Primary Navigation & Stock Selector & Action Buttons (支援滑鼠 drag and scroll 左右滑動) */}
        <div
          ref={topBarDrag.ref}
          {...topBarDrag.props}
          className="flex items-center gap-2.5 relative z-40 overflow-x-auto scrollbar-hide no-scrollbar flex-1 min-w-0 select-none cursor-grab active:cursor-grabbing py-0.5"
        >
          {/* Main Title Badge - Nike Bold Style */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black rounded-full shadow-sm shrink-0 select-none">
            <SlidersHorizontal className="w-3.5 h-3.5 text-black stroke-[2.5]" />
            <span className="font-black text-xs tracking-wider uppercase font-sans">
              視覺線看板
            </span>
          </div>

          {/* 交易模式切換 Tabs (僅保留 虛擬交易 | 真實交易，支援快捷鍵 Alt + ← / →) */}
          <div className="flex items-center bg-zinc-900/95 p-0.5 rounded-full border border-zinc-700/80 shadow-inner shrink-0">
            {/* 虛擬交易 (模擬交易) */}
            <button
              type="button"
              onClick={() => handleTradeModeTabChange("simulated")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black transition-all cursor-pointer select-none active:scale-95 ${
                activeTradeModeTab === "simulated"
                  ? "bg-white text-black shadow-md ring-1 ring-white"
                  : "text-zinc-300 hover:text-white hover:bg-zinc-800/60"
              }`}
              title="僅顯示虛擬交易 (模擬交易) 個股標籤 (快捷鍵: Alt + ←)"
            >
              <Activity className={`w-3.5 h-3.5 ${activeTradeModeTab === "simulated" ? "text-emerald-600 stroke-[2.5]" : "text-emerald-400"}`} />
              <span>虛擬交易</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                activeTradeModeTab === "simulated" ? "bg-black text-white" : "bg-zinc-800 text-zinc-300"
              }`}>
                {simulatedCanvasCount}
              </span>
            </button>

            {/* 真實交易 */}
            <button
              type="button"
              onClick={() => handleTradeModeTabChange("real")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black transition-all cursor-pointer select-none active:scale-95 ${
                activeTradeModeTab === "real"
                  ? "bg-[#D2F800] text-black shadow-md ring-1 ring-[#D2F800]"
                  : "text-zinc-300 hover:text-white hover:bg-zinc-800/60"
              }`}
              title="僅顯示真實交易個股標籤 (快捷鍵: Alt + →)"
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${activeTradeModeTab === "real" ? "text-black stroke-[2.5]" : "text-teal-400"}`} />
              <span>真實交易</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                activeTradeModeTab === "real" ? "bg-black text-[#D2F800]" : "bg-zinc-800 text-zinc-300"
              }`}>
                {realCanvasCount}
              </span>
            </button>
          </div>

          {/* 分隔線 */}
          <div className="w-[1px] h-4 bg-zinc-800 shrink-0" />

          {/* 「只顯示交易中」按鈕標籤 (取代原先選擇區塊股票下拉選單) */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setShowOnlyTrading((prev) => !prev);
            }}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 select-none shrink-0 ${
              showOnlyTrading
                ? "bg-[#D2F800] hover:bg-[#bce000] text-black ring-2 ring-[#D2F800]/60 shadow-[0_0_12px_rgba(210,248,0,0.35)]"
                : "bg-zinc-900/95 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80"
            }`}
            title={showOnlyTrading ? "目前僅顯示交易中股票標籤（點擊切換為顯示全部）" : "點擊僅顯示進行交易中的股票標籤"}
          >
            <Tag className={`w-3.5 h-3.5 ${showOnlyTrading ? "text-black stroke-[2.5]" : "text-[#D2F800] stroke-[2.5]"}`} />
            <span>只顯示交易中</span>
            <span
              className={`text-[10px] px-1.5 sm:px-2 py-0.2 rounded-full font-mono font-black ${
                showOnlyTrading ? "bg-black text-[#D2F800]" : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {tradingSymbolsCount} 檔
            </span>
          </button>

          {/* 分隔線 */}
          <div className="w-[1px] h-4 bg-zinc-800 shrink-0" />

          {/* 截圖中的操作按鈕組 (放在第一列)：更新位置 | 同步分隔線 | 避開重疊 | 重置 */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* 0. 一鍵「更新現價」按鈕 */}
            <button
              type="button"
              onClick={handleRefreshAllCanvasPrices}
              disabled={isRefreshingAllPrices}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 bg-sky-950/90 hover:bg-sky-900 text-sky-300 border border-sky-500/80 hover:border-sky-400 rounded-full text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 hover:scale-[1.02] shrink-0 disabled:opacity-50 select-none"
              title="一鍵更新畫布所有股票最新即時現價（從 Yahoo Finance 即時抓取）"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-400 stroke-[2.2] ${isRefreshingAllPrices ? "animate-spin" : ""}`} />
              <span className="hidden xl:inline">更新現價</span>
              <span className="xl:hidden">現價</span>
            </button>

            {/* 1. 一鍵「更新位置」按鈕 */}
            <button
              type="button"
              onClick={handleUpdatePositions}
              disabled={isUpdatingPositions}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/80 hover:border-emerald-400 rounded-full text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 hover:scale-[1.02] hover:shadow-emerald-950/50 shrink-0 disabled:opacity-50 select-none"
              title="一鍵更新位置：自動同步目前所有股票之分隔線現價，同時自動水平避開重疊，並完整保留原本顏色邊框與尺寸"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 stroke-[2.2] ${isUpdatingPositions ? "animate-spin" : ""}`} />
              <span className="hidden xl:inline">更新位置</span>
              <span className="xl:hidden">更新</span>
            </button>

            {/* 2. 一鍵同步分隔線現價至畫布按鈕 */}
            <button
              type="button"
              onClick={handleSyncDividersFromCards}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-[#D2F800] border border-zinc-700/90 hover:border-[#D2F800]/50 rounded-full text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 hover:scale-[1.02] shrink-0 select-none"
              title="一鍵同步「持有中」與「真實交易」下所有子分頁個股卡片之現價與分隔線相對位置"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#D2F800]" />
              <span className="hidden xl:inline">同步分隔線</span>
              <span className="xl:hidden">同步</span>
            </button>

            {/* 2.5 Primial (分批進場金字塔動態互動圖表) 按鈕 */}
            <button
              type="button"
              onClick={handleTogglePyramidView}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 hover:scale-[1.02] shrink-0 select-none ${
                selectedTagSymbols.length > 0
                  ? "bg-amber-400 hover:bg-amber-300 text-black border border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.45)]"
                  : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/90 hover:border-zinc-500"
              }`}
              title={
                selectedTagSymbols.length > 0
                  ? `Primial (分批進場金字塔動態互動圖表) - 已選取 ${selectedTagSymbols.length} 檔 (Alt+Z)`
                  : "Primial (分批進場金字塔動態互動圖表) - 點擊或按 Alt+Z 開啟"
              }
            >
              <Layers className={`w-3.5 h-3.5 ${selectedTagSymbols.length > 0 ? "text-black stroke-[2.5]" : "text-amber-400 stroke-[2.2]"}`} />
              <span>Primial</span>
              {selectedTagSymbols.length > 0 && (
                <span className="px-1.5 py-0.2 bg-black/20 text-black text-[10px] rounded-full font-mono font-black">
                  {selectedTagSymbols.length}
                </span>
              )}
            </button>

            {/* 3. 匯出 / 匯入位置訊息整合操作群組 (Icon 按鈕設計) */}
            <div className="flex items-center bg-zinc-900 border border-zinc-700/90 hover:border-zinc-500/70 rounded-full p-0.5 shadow-sm shrink-0 transition-colors">
              {/* 隱藏的檔案上傳 Input 用於匯入位置 */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileImport}
                accept=".json,application/json"
                className="hidden"
              />

              {/* 匯出股票儲存位置訊息按鈕 (Icon 按鈕) */}
              <button
                type="button"
                onClick={handleExportPositions}
                className="w-7 h-7 flex items-center justify-center text-zinc-200 hover:text-white hover:bg-zinc-800 rounded-full transition-all cursor-pointer select-none active:scale-95 shrink-0"
                title="匯出位置 (JSON 格式備份)"
              >
                <Download className="w-3.5 h-3.5 text-sky-400 stroke-[2.2]" />
              </button>

              {/* 分隔線 */}
              <div className="w-[1px] h-3 bg-zinc-700 mx-0.5" />

              {/* 匯入股票儲存位置訊息按鈕 (Icon 按鈕) */}
              <button
                type="button"
                onClick={handleTriggerImport}
                className="w-7 h-7 flex items-center justify-center text-zinc-200 hover:text-white hover:bg-zinc-800 rounded-full transition-all cursor-pointer select-none active:scale-95 shrink-0"
                title="匯入位置 (JSON 格式)"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400 stroke-[2.2]" />
              </button>
            </div>

            {/* 4. 一鍵「重置」按鈕 */}
            <button
              type="button"
              onClick={handleResetAllCanvas}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 bg-zinc-900 hover:bg-rose-950/80 text-rose-300 hover:text-rose-200 border border-zinc-700/80 hover:border-rose-700/80 rounded-full text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 hover:scale-[1.02] shrink-0 select-none"
              title="一鍵重置並刪除畫布上所有個股標籤"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400 stroke-[2.5]" />
              <span>重置</span>
            </button>
          </div>
        </div>

        {/* Right: Actions, Status & Save Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Status Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 text-[11px] font-black rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300">
            {hasUnsavedChanges ? (
              <span className="flex items-center gap-1.5 text-amber-400 font-black animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                未儲存 (Shift+S)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[#D2F800] font-black">
                <span className="w-2 h-2 rounded-full bg-[#D2F800] shadow-[0_0_8px_rgba(210,248,0,0.8)]" />
                已儲存 ({activeCanvasSymbols.length} 檔)
              </span>
            )}
          </div>

          {/* 顯示 / 隱藏標籤開關 (Icon 按鈕設計，包含隱藏數量角標與狀態) */}
          <button
            type="button"
            onClick={() => {
              const next = !showHiddenTags;
              setShowHiddenTags(next);
              playClickSound();
              if (next) {
                toast.info(`已開啟「顯示隱藏」，畫布上顯示 ${hiddenCount} 檔已隱藏股票（半透明標示）`, {
                  id: "toggle-show-hidden",
                });
              } else {
                toast.info("已關閉「顯示隱藏」", { id: "toggle-show-hidden" });
              }
            }}
            title={
              showHiddenTags
                ? `顯示隱藏標籤 (已開啟，目前含 ${hiddenCount} 檔已隱藏，點擊關閉)`
                : `顯示隱藏標籤 (目前有 ${hiddenCount} 檔已隱藏，點擊檢視)`
            }
            className={`relative w-8 h-8 rounded-full border text-xs font-black transition-all cursor-pointer flex items-center justify-center active:scale-95 shrink-0 ${
              showHiddenTags
                ? "bg-amber-400 text-black border-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.35)]"
                : hiddenCount > 0
                ? "bg-zinc-900 border-amber-500/60 text-amber-300 hover:bg-zinc-800"
                : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {showHiddenTags ? (
              <Eye className="w-4 h-4 text-black stroke-[2.5]" />
            ) : (
              <EyeOff className="w-4 h-4 text-current stroke-[2.2]" />
            )}
            {hiddenCount > 0 && (
              <span
                className={`absolute -top-1 -right-1 px-1 min-w-[15px] h-[15px] flex items-center justify-center text-[9px] rounded-full font-mono font-black leading-none shadow-sm ${
                  showHiddenTags ? "bg-black text-amber-400" : "bg-amber-500 text-black"
                }`}
              >
                {hiddenCount}
              </span>
            )}
          </button>

          {/* 一鍵全部解除隱藏按鈕 (當處於顯示隱藏模式且有隱藏標籤時提供快捷按鈕) */}
          {showHiddenTags && hiddenCount > 0 && (
            <button
              type="button"
              onClick={handleUnhideAll}
              className="px-2.5 py-1.5 rounded-full border border-emerald-500/80 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-200 text-xs font-black transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm animate-in fade-in"
              title={`一鍵解除全部 ${hiddenCount} 檔股票標籤的隱藏狀態`}
            >
              <Eye className="w-3 h-3 text-emerald-400" />
              <span className="hidden md:inline">全部取消隱藏</span>
              <span className="md:hidden">全部取消</span>
            </button>
          )}

          {/* 儲存按鈕 (Icon 按鈕設計，支援 Shift+S 快捷鍵) */}
          <button
            type="button"
            onClick={handleSavePositions}
            disabled={isSaving}
            title={hasUnsavedChanges ? "儲存位置 (Shift+S，有未儲存變更)" : "儲存位置 (Shift+S)"}
            className={`w-8 h-8 rounded-full text-xs font-black transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-md shrink-0 ${
              hasUnsavedChanges
                ? "bg-amber-400 hover:bg-amber-300 text-black shadow-amber-400/30 animate-pulse"
                : "bg-white hover:bg-zinc-200 text-black shadow-white/20"
            }`}
          >
            <Save className="w-4 h-4 text-black stroke-[2.5]" />
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              triggerFullscreenOverview();
              onClose();
            }}
            title="關閉並以全螢幕返回交易總覽 (Esc)"
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer active:scale-90"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </header>

      {/* Sub Toolbar - Tag Selection, Style Tools & Live Data Bar (支援滑鼠 drag and scroll 左右滑動) */}
      <div
        ref={subBarDrag.ref}
        {...subBarDrag.props}
        className="w-full bg-[#161618] text-white border-b border-zinc-800/80 px-3 sm:px-4 py-1.5 flex items-center justify-between gap-3 shadow-sm z-40 shrink-0 relative overflow-x-auto scrollbar-hide no-scrollbar select-none cursor-grab active:cursor-grabbing"
      >
        {/* Left: Tag Selection, Style Tools & Live Data */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 6. 圓形標籤管理工具：框選模式 / 勾選選取 / 隱藏標籤 / 圓形尺寸調整 (-/+) / 重設 */}
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700/90 rounded-full px-2 py-0.5 shadow-sm shrink-0">
            {/* 勾選 / 全選按鈕 */}
            <button
              type="button"
              onClick={handleSelectAllTags}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black transition-all cursor-pointer select-none active:scale-95 ${
                selectedTagSymbols.length > 0
                  ? "bg-[#D2F800] text-black shadow-sm"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
              title={
                selectedTagSymbols.length > 0
                  ? `已勾選 ${selectedTagSymbols.length} 檔 (點擊取消全選)`
                  : "勾選標籤可個別調整圓形尺寸與隱藏 (點擊全選)"
              }
            >
              {selectedTagSymbols.length > 0 ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-black" />
                  <span>已選 {selectedTagSymbols.length} 檔</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="hidden sm:inline">全選</span>
                </>
              )}
            </button>

            {/* 隱藏標籤按鈕 (當有股票處於勾選狀態時顯示，Icon 按鈕設計) */}
            {selectedTagSymbols.length > 0 && (
              <button
                type="button"
                onClick={handleToggleHideSelected}
                className={`w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-black transition-all cursor-pointer select-none active:scale-95 animate-in fade-in zoom-in-95 duration-150 shrink-0 ${
                  isAllSelectedHidden
                    ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-sm"
                    : "bg-amber-500/90 text-black hover:bg-amber-400 shadow-sm"
                }`}
                title={
                  isAllSelectedHidden
                    ? `解除勾選的 ${selectedTagSymbols.length} 檔股票標籤之隱藏狀態`
                    : `隱藏勾選的 ${selectedTagSymbols.length} 檔股票標籤 (可隨時從「顯示隱藏」檢視或恢復)`
                }
              >
                {isAllSelectedHidden ? (
                  <Eye className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                )}
              </button>
            )}

            {/* 圓形尺寸調整組 (- / 數值 / +) */}
            <div className="flex items-center gap-0.5 bg-zinc-950 border border-zinc-800 rounded-full px-1 py-0.5">
              <button
                type="button"
                onClick={() => handleAdjustTagSize(-2)}
                className="w-5 h-5 flex items-center justify-center rounded-full bg-transparent hover:bg-zinc-800 text-zinc-200 transition-all cursor-pointer active:scale-90"
                title={
                  selectedTagSymbols.length > 0
                    ? `縮小勾選的 ${selectedTagSymbols.length} 檔圓形標籤 (-2px)`
                    : "縮小預設圓形標籤 (-2px)"
                }
              >
                <Minus className="w-3 h-3 text-zinc-200" />
              </button>

              <button
                type="button"
                onClick={handleResetTagSize}
                className="px-2 py-0.5 text-center cursor-pointer select-none rounded-full hover:bg-zinc-800 transition-colors flex items-center gap-1"
                title="點擊重設尺寸"
              >
                <Circle className="w-2.5 h-2.5 text-zinc-400" />
                <span className="text-[10.5px] font-mono font-black text-white">
                  {selectedTagSymbols.length === 1
                    ? `${(positions[selectedTagSymbols[0]]?.sizeOffset ?? tagSizeOffset) > 0 ? "+" : ""}${
                        positions[selectedTagSymbols[0]]?.sizeOffset ?? tagSizeOffset
                      }px`
                    : selectedTagSymbols.length > 1
                    ? `選取${selectedTagSymbols.length}`
                    : tagSizeOffset > 0
                    ? `+${tagSizeOffset}px`
                    : tagSizeOffset < 0
                    ? `${tagSizeOffset}px`
                    : "大小"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleAdjustTagSize(2)}
                className="w-5 h-5 flex items-center justify-center rounded-full bg-transparent hover:bg-zinc-800 text-zinc-200 transition-all cursor-pointer active:scale-90"
                title={
                  selectedTagSymbols.length > 0
                    ? `放大勾選的 ${selectedTagSymbols.length} 檔圓形標籤 (+2px)`
                    : "放大預設圓形標籤 (+2px)"
                }
              >
                <Plus className="w-3 h-3 text-zinc-200" />
              </button>
            </div>

            {/* 顏色選擇區塊 (當股票處於 tickbox 勾選狀態時在大小按鈕旁顯示) */}
            {selectedTagSymbols.length > 0 && (
              <div className="flex items-center gap-1 sm:gap-1.5 bg-zinc-950 border border-zinc-700 rounded-full px-1.5 sm:px-2 py-0.5 shadow-sm animate-in fade-in zoom-in-95 duration-150 shrink-0">
                <span className="text-[10px] font-black text-zinc-400 mr-0.5 select-none hidden md:inline uppercase tracking-wider">
                  邊框:
                </span>
                <div className="flex items-center gap-0.5 sm:gap-1">
                  {TAG_COLOR_OPTIONS.map((c) => {
                    const isAllThisColor = c.isDefault
                      ? selectedTagSymbols.every((s) => !positions[s]?.color || positions[s]?.color === "#000000")
                      : selectedTagSymbols.every((s) => positions[s]?.color === c.bg);

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSetTagColor(c.isDefault ? undefined : c.bg)}
                        title={`${c.label} ${c.isDefault ? "(1px 黑色預設)" : "(6px 邊框)"}`}
                        className={`w-3.5 h-3.5 rounded-full transition-all cursor-pointer relative hover:scale-125 shrink-0 ${
                          isAllThisColor
                            ? "ring-2 ring-[#D2F800] ring-offset-1 ring-offset-black scale-110 shadow-xs"
                            : "hover:ring-1 hover:ring-zinc-400 opacity-90 hover:opacity-100"
                        }`}
                        style={{
                          backgroundColor: c.bg,
                          border: `1px solid ${c.border}`,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}



            {/* 單選個股即時數據資訊膠囊 (顯示攤平進度、拆分交易、已購/預計股數、基準倉位/強制平倉與未實現損益) */}
            {selectedTagSymbols.length === 1 && (() => {
              const sym = selectedTagSymbols[0];
              const tab = allStockMap.get(sym) || allTabs.find((t) => (t.symbol || "").trim().toUpperCase() === sym);
              const stat = tab ? statsMap?.[tab.id] : undefined;
              const pos = positions[sym];
              const holdingQty =
                stat?.totalQuantity !== undefined && stat.totalQuantity !== 0
                  ? stat.totalQuantity
                  : tab?.holdingQuantity || 0;
              const avgCost =
                stat?.averagePrice !== undefined && stat.averagePrice > 0
                  ? stat.averagePrice
                  : tab?.averageCost || 0;
              const curPrice =
                tab?.currentPrice !== undefined && tab.currentPrice !== null && Number(tab.currentPrice) > 0
                  ? Number(tab.currentPrice)
                  : (livePrices[sym] || 0);
              let pnl = stat?.unrealizedPnL || 0;
              if (holdingQty > 0 && avgCost > 0 && curPrice > 0) {
                pnl = (curPrice - avgCost) * holdingQty;
              } else if (holdingQty < 0 && avgCost > 0 && curPrice > 0) {
                pnl = (avgCost - curPrice) * Math.abs(holdingQty);
              }
              const planQty = tab?.plannedBuyQty || 0;
              const strat = tab ? (strategiesMap?.[tab.id] || (tab as any)?.strategy) : undefined;
              const cardTrades = tab ? (tradesMap?.[tab.id] || (tab as any)?.trades || []) : [];
              const dca = getEffectiveDcaProgress(pos?.dcaProgress, tab, cardTrades, holdingQty, planQty, strat);
              const splitOpt = findSplitTradeOption(dca);
              const splitDetail = calculateSplitTradeStageDetail(tab, dca, planQty, holdingQty, strat);
              const { basePrice, forceClosePrice } = getStockBaseAndForceClosePrices(tab, strat, curPrice);

              return (
                <div className="hidden lg:flex items-center gap-1.5 xl:gap-2 bg-zinc-950/95 border border-zinc-700/80 rounded-full px-2.5 py-0.5 text-[11px] font-mono text-zinc-300 shadow-sm animate-in fade-in select-none max-w-full overflow-x-auto no-scrollbar shrink">
                  <span className="font-sans font-black text-white shrink-0">{sym}</span>
                  {splitDetail ? (
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-black border shrink-0 ${splitDetail.badgeBg} ${splitDetail.badgeText} ${splitDetail.badgeBorder}`}
                    >
                      {splitDetail.fullStageName}
                    </span>
                  ) : dca ? (
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-black border shrink-0 ${
                        splitOpt
                          ? `${splitOpt.badgeBg} ${splitOpt.badgeText} ${splitOpt.badgeBorder}`
                          : "text-[#D2F800] bg-[#D2F800]/15 border-[#D2F800]/50"
                      }`}
                    >
                      {splitOpt ? splitOpt.label : dca}
                    </span>
                  ) : null}
                  {splitDetail && (
                    <span className="text-purple-300 font-bold shrink-0">
                      [可用剩餘: <strong className="text-purple-200 font-black">{splitDetail.stageRemaining.toLocaleString()}</strong> 股]
                    </span>
                  )}
                  {splitDetail?.companionStage && (
                    <span className="text-cyan-300 font-bold bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-500/40 text-[10px] shrink-0">
                      <span className="hidden xl:inline">{splitDetail.companionStage.fullStageName}: 預購 </span>
                      <span className="xl:hidden">{splitDetail.companionStage.stageName}: 預</span>
                      <strong className="text-amber-300 font-black">{splitDetail.companionStage.stageSize.toLocaleString()}</strong> 股 / 餘 <strong className="text-purple-200 font-black">{splitDetail.companionStage.stageRemaining.toLocaleString()}</strong> 股
                    </span>
                  )}
                  <span className="shrink-0" title={splitDetail ? `總持股: ${holdingQty.toLocaleString()} / 總預計: ${planQty.toLocaleString()} 股` : undefined}>
                    {splitDetail ? (
                      <>
                        <span className="hidden 2xl:inline">階段已購: </span>
                        <span className="2xl:hidden">已購: </span>
                        <strong className="text-cyan-300 font-black">{splitDetail.stageBought.toLocaleString()}</strong>
                        <span className="text-zinc-400">
                          {" "}/ <span className="hidden 2xl:inline">階段預計: </span><strong className="text-amber-300 font-bold">{splitDetail.stageSize.toLocaleString()}</strong>
                        </span>
                        {" "}股
                        <span className="text-zinc-500 text-[10px] ml-1.5 font-normal hidden 2xl:inline">
                          (總持股: {holdingQty.toLocaleString()}{planQty > 0 ? ` / 總預計: ${planQty.toLocaleString()}` : ""} 股)
                        </span>
                      </>
                    ) : (
                      <>
                        已購: <strong className="text-white font-black">{holdingQty.toLocaleString()}</strong>
                        {planQty > 0 && (
                          <span className="text-zinc-400">
                            {" "}/ 預計: <strong className="text-amber-300 font-bold">{planQty.toLocaleString()}</strong>
                          </span>
                        )}
                        {" "}股
                      </>
                    )}
                  </span>

                  {/* 基準倉位 / 強制平倉 價位標籤 */}
                  {basePrice !== null && (
                    <span className="text-amber-300 bg-amber-950/80 border border-amber-500/50 px-1.5 py-0.2 rounded font-black text-[10px] shrink-0">
                      基準: ${basePrice >= 100 ? basePrice.toFixed(1) : basePrice.toFixed(2)}
                    </span>
                  )}
                  {forceClosePrice !== null && (
                    <span className="text-rose-300 bg-rose-950/80 border border-rose-500/50 px-1.5 py-0.2 rounded font-black text-[10px] shrink-0">
                      平倉: ${forceClosePrice >= 100 ? forceClosePrice.toFixed(1) : forceClosePrice.toFixed(2)}
                    </span>
                  )}

                  {(holdingQty !== 0 || pnl !== 0) && (
                    <span
                      className={`font-black px-1.5 py-0.2 rounded shrink-0 ${
                        pnl > 0
                          ? "text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 shadow-xs"
                          : pnl < 0
                          ? "text-rose-300 bg-rose-950/80 border border-rose-500/40 shadow-xs"
                          : "text-zinc-300 bg-zinc-900 border border-zinc-700/60"
                      }`}
                    >
                      未實現: {pnl > 0 ? `+$${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : pnl < 0 ? `-$${Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00"}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Main Visualizer Fullscreen Canvas with Depth of Field */}
      <main
        ref={canvasRef}
        onMouseDown={handleCanvasPointerDown}
        onTouchStart={handleCanvasPointerDown}
        onDoubleClick={handleCanvasDoubleClick}
        className="flex-1 relative w-full h-full bg-[#1e2024] select-none overflow-hidden cursor-default"
      >
        {/* Optical Depth of Field Ambient Lighting Layer */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background:
              "radial-gradient(ellipse 95% 85% at 50% 48%, rgba(38, 41, 46, 0.5) 0%, rgba(26, 28, 32, 0.75) 55%, rgba(18, 19, 22, 0.95) 100%)",
          }}
        />

        {/* Subtle Top & Bottom Depth Vignettes */}
        <div
          className="absolute inset-x-0 top-0 h-32 pointer-events-none z-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0, 0, 0, 0.4) 0%, transparent 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-32 pointer-events-none z-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, transparent 100%)",
          }}
        />

        {/* 畫布視角垂直動態平移層 (Canvas Viewport Pan Y Layer - 滾動滑鼠滾輪上下平移，不改變股票真實座標位置) */}
        <div
          className="w-full h-full absolute inset-0 will-change-transform transition-transform duration-75 ease-out pointer-events-none"
          style={{ transform: `translateY(${canvasPanY}px)` }}
        >
        {/* Box Selection (Marquee) Visual Overlay */}
        {selectionBox && (
          <div
            className="absolute z-50 pointer-events-none border-2 border-sky-500 bg-sky-500/15 rounded-xs shadow-sm transition-none"
            style={{
              left: `${Math.min(selectionBox.startX, selectionBox.currentX)}px`,
              top: `${Math.min(selectionBox.startY, selectionBox.currentY)}px`,
              width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}px`,
              height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}px`,
            }}
          >
            <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-sky-600 text-white rounded text-[10px] font-mono font-black shadow-xs flex items-center gap-1">
              <BoxSelect className="w-3 h-3 text-white" />
              <span>框選範圍</span>
            </div>
          </div>
        )}

        {/* Background Color Bands Between Lines */}
        {VISUAL_BANDS.map((band) => (
          <div
            key={band.id}
            className="absolute left-0 right-0 pointer-events-none transition-colors z-0"
            style={{
              top: `${band.top}%`,
              height: `${band.bottom - band.top}%`,
              backgroundColor: band.bg,
            }}
          />
        ))}

        {/* Render 6 Horizontal Lines across full width */}
        {VISUAL_LINES.map((line) => (
          <div
            key={line.id}
            className="absolute left-0 right-0 pointer-events-none group flex items-center z-10"
            style={{ top: `${line.yPercent}%` }}
          >
            {/* The colored continuous horizontal bar */}
            <div
              className="w-full transition-all"
              style={{
                height: line.color === "#000000" ? "4px" : "3.5px",
                backgroundColor: line.color === "#000000" ? "#27272a" : line.color,
                boxShadow:
                  line.color === "#000000"
                    ? "0 0 0 1.5px rgba(255, 255, 255, 0.35), 0 0 12px rgba(0, 0, 0, 0.8)"
                    : `0 0 10px ${line.color}55`,
              }}
            />

            {/* Left Axis Letter Badge in Gray font (D, B, G, Y, R) */}
            <div
              className="absolute left-3 sm:left-4 -top-3 px-1.5 py-0.5 rounded text-[11px] sm:text-xs font-mono font-black text-zinc-200 bg-zinc-900/90 border border-zinc-700 shadow-xs pointer-events-none select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] flex items-center gap-1"
              title={`${line.axis}軸 (${line.label})`}
            >
              <span>{line.axis}</span>
              {showAuxiliaryTestLines && (
                <span className="text-[9.5px] font-bold text-zinc-400 font-mono">
                  {line.yPercent.toFixed(1)}%
                </span>
              )}
            </div>

            {/* Line label with Nike typography at the right margin */}
            {showLineLabels && (
              <div
                className="absolute right-4 -top-5 px-3 py-1 rounded-full text-[11px] font-black pointer-events-none tracking-wider flex items-center gap-2 shadow-lg border border-white/15 backdrop-blur-md"
                style={{
                  color: "#ffffff",
                  backgroundColor: "rgba(24, 25, 28, 0.92)",
                }}
              >
                <span className="text-zinc-400 font-mono font-black mr-0.5">{line.axis}</span>
                <span className="text-white font-black uppercase">{line.label}</span>
                <span className="text-[9.5px] text-zinc-400 font-mono font-bold">[{line.desc}]</span>
              </div>
            )}
          </div>
        ))}

        {/* 輔助測試中間基準線 (20%, 36%, 52%, 68%, 83%) */}
        {showAuxiliaryTestLines &&
          AUXILIARY_TEST_INTERVALS.filter((line) => !line.isMain).map((line) => (
            <div
              key={line.yPercent}
              className="absolute left-0 right-0 pointer-events-none flex items-center z-10 animate-in fade-in duration-200"
              style={{ top: `${line.yPercent}%` }}
            >
              <div
                className="w-full border-t border-dashed transition-all"
                style={{
                  borderColor: line.color,
                  opacity: 0.65,
                }}
              />
              <div className="absolute left-16 -top-2.5 px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-white/95 border border-zinc-300 text-zinc-600 shadow-xs pointer-events-none select-none">
                {line.label}
              </div>
              <div className="absolute right-16 -top-2.5 px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-white/95 border border-zinc-300 text-zinc-600 shadow-xs pointer-events-none select-none">
                {line.yPercent.toFixed(1)}%
              </div>
            </div>
          ))}

        {/* 輔助測試射線 (Auxiliary Laser Rays through each Tag) */}
        {showAuxiliaryTestLines &&
          activeCanvasSymbols.map((sym) => {
            const pos = positions[sym];
            if (!pos) return null;
            const isTarget =
              sym === selectedDiagnosticSymbol ||
              sym === hoveredDiagnosticSymbol ||
              selectedTagSymbols.includes(sym);

            return (
              <div
                key={`laser-${sym}`}
                className="absolute left-0 right-0 pointer-events-none flex items-center z-15 transition-opacity"
                style={{
                  top: `${pos.y}%`,
                  opacity: isTarget ? 0.95 : 0.4,
                }}
              >
                <div
                  className={`w-full border-t ${
                    isTarget ? "border-sky-500 border-solid" : "border-zinc-400 border-dotted"
                  }`}
                />
                <div
                  className={`absolute right-2 -top-2.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-black shadow-xs ${
                    isTarget
                      ? "bg-sky-600 text-white border border-sky-400"
                      : "bg-zinc-900/90 text-zinc-300 border border-zinc-700"
                  }`}
                >
                  {sym} Y: {pos.y.toFixed(1)}%
                </div>
              </div>
            );
          })}

        {/* Draggable Stock Symbol Tags on Canvas (Android 扁平化運動球體標籤: 內部純白 #FFFFFF, 文字極致黑 #000000, 邊緣約 2px Solid Color 邊框, 含最新現價, 下方顯示攤平進度、已購/預計數量與未實現損益) */}
        {activeCanvasSymbols.map((sym) => {
          const pos = positions[sym];
          if (!pos) return null;
          const tab =
            allStockMap.get(sym) ||
            allTabs.find((t) => (t.symbol || "").trim().toUpperCase() === sym);
          const stat = tab ? statsMap?.[tab.id] : undefined;
          const conf = HOLDING_CONFIG[tab?.holdingStatus || "候選名單"];

          const effectiveSizeOffset = pos.sizeOffset !== undefined ? pos.sizeOffset : tagSizeOffset;
          const isSelected = selectedTagSymbols.includes(sym);
          const isHidden = Boolean(pos.hidden);

          const symbolFontSize = Math.max(10, 13 + Math.round(effectiveSizeOffset * 0.85));
          const priceFontSize = Math.max(8, 10 + Math.round(effectiveSizeOffset * 0.5));
          const dotSize = Math.max(5, 7 + Math.round(effectiveSizeOffset * 0.3));
          const btnSize = Math.max(14, 16 + Math.round(effectiveSizeOffset * 0.3));
          const circleSize = Math.max(44, 54 + effectiveSizeOffset * 2.2);

          const hasAppliedColor = Boolean(pos.color && pos.color !== "#000000");
          const tagBorderColor = hasAppliedColor ? pos.color! : "#000000";
          const borderThickness = hasAppliedColor ? "6px" : "1px";

          // 1. 已購數量 (Bought / Holding Quantity) & 平均成本
          const effectiveHoldingQty =
            stat?.totalQuantity !== undefined && stat.totalQuantity !== 0
              ? stat.totalQuantity
              : tab?.holdingQuantity || 0;
          const effectiveAvgPrice =
            stat?.averagePrice !== undefined && stat.averagePrice > 0
              ? stat.averagePrice
              : tab?.averageCost || 0;
          const curPriceNum =
            tab?.currentPrice !== undefined && tab.currentPrice !== null && Number(tab.currentPrice) > 0
              ? Number(tab.currentPrice)
              : (livePrices[sym] || 0);

          // 2. 預計購買數量 (Planned Buy Quantity)
          const strat = tab ? (strategiesMap?.[tab.id] || (tab as any)?.strategy) : undefined;
          const rowsSys2 = tab?.averagingRowsSys2 || strat?.averagingRowsSys2;
          const rowsSys1 = tab?.averagingRows || strat?.averagingRows;
          const cardTrades = tab ? (tradesMap?.[tab.id] || (tab as any)?.trades || []) : [];

          const modalPlan = calculateBatchPlanning({
            currentPrice: curPriceNum,
            holdingQty: effectiveHoldingQty,
            trades: cardTrades,
            averagingRowsSys2: rowsSys2,
            plannedBuyQty: tab?.plannedBuyQty ? Number(tab.plannedBuyQty) : undefined,
            plannedBuyPercent: tab?.plannedBuyPercent !== undefined && tab?.plannedBuyPercent !== null ? Number(tab.plannedBuyPercent) : undefined,
            tradeType: tab?.tradeType,
            maxStrategyRiskPool60,
          });

          const batchPlannedSizes: number[] = modalPlan.batches.map((b) => b.size);
          const effectivePlannedBuyQty = modalPlan.plannedQty;
          const effectiveDcaProgress = getEffectiveDcaProgress(
            pos.dcaProgress,
            tab,
            cardTrades,
            effectiveHoldingQty,
            effectivePlannedBuyQty,
            strat
          );

          // 拆分交易選項與基準倉位/強制平倉價位計算
          const splitOpt = findSplitTradeOption(effectiveDcaProgress);
          const splitStageDetail = calculateSplitTradeStageDetail(
            tab,
            effectiveDcaProgress,
            effectivePlannedBuyQty,
            effectiveHoldingQty,
            strat
          );
          const { basePrice: basePositionPrice, forceClosePrice: forcedLiquidationPrice } =
            getStockBaseAndForceClosePrices(tab, strat, curPriceNum);

          // 4. 未實現損益金額 (Unrealized PnL)
          const effectiveUnrealizedPnL = (() => {
            if (stat?.unrealizedPnL !== undefined && stat.unrealizedPnL !== 0) {
              return stat.unrealizedPnL;
            }
            if (effectiveHoldingQty > 0 && effectiveAvgPrice > 0 && curPriceNum > 0) {
              return (curPriceNum - effectiveAvgPrice) * effectiveHoldingQty;
            }
            if (effectiveHoldingQty < 0 && effectiveAvgPrice > 0 && curPriceNum > 0) {
              return (effectiveAvgPrice - curPriceNum) * Math.abs(effectiveHoldingQty);
            }
            return 0;
          })();
          const hasHoldingOrPnL = effectiveHoldingQty !== 0 || effectiveUnrealizedPnL !== 0;

          // 格式化最新現價
          const formattedCurrentPrice = (() => {
            if (curPriceNum > 0) {
              return `$${curPriceNum >= 100 ? curPriceNum.toFixed(1) : curPriceNum.toFixed(2)}`;
            }
            return null;
          })();

          // 判定是否已經進行第一批、第二批、第三批、第四批交易或拆分交易
          // 規則：若持有數量為 0 (或小於等於 0)，代表沒有任何交易，不須顯示「(交易中)」標籤
          const isBatchTrading = Boolean(effectiveHoldingQty && Math.abs(effectiveHoldingQty) > 0);

          // 計算四批次交易進度摘要資訊 (第一批15%, 第二批25%, 第三批35%, 第四批25%)
          // 支援自訂每批/拆分股數與自動累進階梯，若目前已經在第四批則 nextBatch 為 null
          const batchProgress = getStockBatchProgressSummary(
            tab,
            strat,
            effectivePlannedBuyQty,
            effectiveHoldingQty,
            effectiveDcaProgress
          );

          // 判斷是否接近畫布頂部 (若 y < 16% 則快顯對話窗改顯示於圓圈下方，避免被畫布頂部裁切)
          const isNearTop = pos.y < 16;

          return (
            <div
              key={sym}
              data-tag-symbol={sym}
              onMouseDown={(e) => handleTagPointerDown(e, sym, pos.x, pos.y)}
              onTouchStart={(e) => handleTagPointerDown(e, sym, pos.x, pos.y)}
              onDoubleClick={(e) => {
                if (isSelected && tab) {
                  handleJumpToCard(tab.id, sym, e);
                }
              }}
              className={`absolute z-20 hover:z-50 group select-none pointer-events-auto ${
                isHidden ? "opacity-60 hover:opacity-100" : ""
              }`}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
              }}
            >
              {/* 基準點：以圓圈幾何中心為絕對定位基準 (0, 0)，嚴格錨定於 (pos.x%, pos.y%) */}
              <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center cursor-grab active:cursor-grabbing">
                {/* 輔助測試十字瞄準線 (當開啟輔助線測試時標記圓圈精準中心) */}
                {showAuxiliaryTestLines && (
                  <div className="absolute pointer-events-none w-8 h-8 flex items-center justify-center opacity-75 z-30">
                    <div className="absolute w-full h-[1px] bg-sky-500 shadow-xs" />
                    <div className="absolute h-full w-[1px] bg-sky-500 shadow-xs" />
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-600 ring-1 ring-white" />
                  </div>
                )}

                {/* Android Flat Design Spherical Tag - 運動球體標籤 (內部純白 #FFFFFF, 依設定顯示 6px 套用純色或 1px 預設黑, 勾選不改變邊框顏色, 內部文字 #000000) */}
                <div
                  className={`relative flex flex-col items-center justify-center rounded-full transition-all select-none bg-white shadow-md hover:shadow-lg hover:scale-105 ${
                    isHidden ? "border-dashed ring-1 ring-amber-500/50" : ""
                  }`}
                  style={{
                    width: `${circleSize}px`,
                    height: `${circleSize}px`,
                    backgroundColor: "#FFFFFF",
                    border: `${borderThickness} ${isHidden ? "dashed" : "solid"} ${tagBorderColor}`,
                    boxShadow: isHidden
                      ? "0 1px 4px rgba(0,0,0,0.08)"
                      : "0 2px 6px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)",
                  }}
                >
                  {/* 隱藏標籤指示徽章 (當處於顯示隱藏模式下醒目標示) */}
                  {isHidden && (
                    <div className="absolute -top-3.5 px-1.5 py-0.2 bg-zinc-900/95 text-amber-300 border border-amber-500/60 rounded-full text-[8.5px] font-black flex items-center gap-0.5 pointer-events-none shadow-md z-30 tracking-tight">
                      <EyeOff className="w-2.5 h-2.5 text-amber-300 stroke-[2.5]" />
                      <span>隱藏中</span>
                    </div>
                  )}
                  {/* Tickbox positioned at top-left of circle */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleTagSelection(sym, e)}
                    title={isSelected ? "取消勾選 (已勾選時可按住 Shift 拖曳水平方向移動)" : "勾選以個別調整尺寸與邊框顏色，或按住 Shift 水平方向移動"}
                    className={`absolute -top-1.5 -left-1.5 rounded-full flex items-center justify-center transition-all cursor-pointer z-10 ${
                      isSelected
                        ? "bg-[#D2F800] text-black border border-white shadow-xs scale-110"
                        : "bg-zinc-800 text-transparent border border-zinc-500 hover:border-zinc-300 opacity-60 group-hover:opacity-100"
                    }`}
                    style={{
                      width: `${Math.max(13, 15 + Math.round(effectiveSizeOffset * 0.2))}px`,
                      height: `${Math.max(13, 15 + Math.round(effectiveSizeOffset * 0.2))}px`,
                    }}
                  >
                    <Check
                      style={{
                        width: `${Math.max(8, 10 + Math.round(effectiveSizeOffset * 0.2))}px`,
                        height: `${Math.max(8, 10 + Math.round(effectiveSizeOffset * 0.2))}px`,
                      }}
                      className={isSelected ? "opacity-100 stroke-[3.5]" : "opacity-0"}
                    />
                  </button>

                  {/* Status Dot (當處於勾選狀態時，點擊原點跳轉至該股視覺圖示化卡片) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      if (isSelected && tab) {
                        handleJumpToCard(tab.id, sym, e);
                      }
                    }}
                    disabled={!isSelected}
                    title={
                      isSelected && tab
                        ? `點擊前往「${sym}」視覺圖示化卡片`
                        : `${sym} (${tab?.holdingStatus || "候選名單"})`
                    }
                    className={`rounded-full ${conf?.dot || "bg-emerald-500"} shrink-0 mb-0.5 transition-all z-10 ${
                      isSelected
                        ? "cursor-pointer hover:scale-150 ring-2 ring-[#D2F800] active:scale-90 shadow-xs animate-pulse"
                        : "cursor-default ring-1 ring-black/15"
                    }`}
                    style={{
                      width: `${Math.max(5, dotSize)}px`,
                      height: `${Math.max(5, dotSize)}px`,
                    }}
                  />

                  {/* Stock Symbol - 內部文字極致黑 #000000 */}
                  <span
                    className="font-black font-sans tracking-tight leading-none text-center uppercase z-10 select-none text-black"
                    style={{
                      fontSize: `${symbolFontSize}px`,
                      color: "#000000",
                    }}
                  >
                    {sym}
                  </span>

                  {/* Latest Current Price - 最新現價 (內部文字極致黑 #000000) */}
                  {formattedCurrentPrice ? (
                    <span
                      className="font-mono font-black tracking-tight leading-none text-center mt-0.5 z-10 select-none text-black"
                      style={{
                        fontSize: `${priceFontSize}px`,
                        color: "#000000",
                      }}
                    >
                      {formattedCurrentPrice}
                    </span>
                  ) : (
                    <span
                      className="font-mono font-bold leading-none text-center mt-0.5 z-10 opacity-30 select-none text-black"
                      style={{
                        fontSize: `${priceFontSize}px`,
                        color: "#000000",
                      }}
                    >
                      $--
                    </span>
                  )}

                  {/* Delete button on hover / touch */}
                  <button
                    type="button"
                    onClick={(e) => handleRemoveStockFromCanvas(sym, e)}
                    title={`從圖表刪除 ${sym}`}
                    className="opacity-0 group-hover:opacity-100 absolute -top-1.5 -right-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-all cursor-pointer shadow-sm z-20 active:scale-90"
                    style={{
                      width: `${btnSize}px`,
                      height: `${btnSize}px`,
                    }}
                  >
                    <X style={{ width: `${Math.max(8, btnSize - 6)}px`, height: `${Math.max(8, btnSize - 6)}px` }} className="stroke-[2.5]" />
                  </button>

                  {/* 交易中標示徽章 (持有數量 > 0 且進行交易中時顯示 #CDFF3D 背景、黑色文字小標籤 (交易中)) */}
                  {isBatchTrading && (
                    <div
                      className="absolute -bottom-2 px-1.5 py-0.2 bg-[#CDFF3D] text-black border border-black/40 rounded-full text-[8px] font-black shadow-xs tracking-tight flex items-center justify-center pointer-events-none z-20 whitespace-nowrap"
                      style={{ backgroundColor: "#CDFF3D", color: "#000000" }}
                    >
                      <span>(交易中)</span>
                    </div>
                  )}
                </div>

                {/* 滑鼠移動到該股票圓圈上時顯示的快顯對話窗 (全面取代原先灰色對話窗，字級加大 5px 帶來清晰體驗) */}
                <div
                  className={`absolute left-0 -translate-x-1/2 flex items-center pointer-events-none select-none z-50 transition-all duration-150 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 drop-shadow-2xl ${
                    isNearTop ? "flex-col-reverse" : "flex-col"
                  }`}
                  style={{
                    ...(isNearTop
                      ? { top: `${circleSize / 2 + (isBatchTrading ? 32 : 26)}px` }
                      : { bottom: `${circleSize / 2 + 12}px` }),
                  }}
                >
                  <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-700/90 rounded-xl p-3.5 shadow-2xl flex flex-col gap-2 min-w-[350px] whitespace-nowrap ring-1 ring-white/10 text-left">
                    {/* 標頭：個股代碼、現價與交易狀態 (原字級均 +5px) */}
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2 px-0.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-white font-black text-[19px] tracking-tight">{sym}</span>
                        {formattedCurrentPrice && (
                          <span className="text-[#CDFF3D] font-mono font-black text-[17px]">{formattedCurrentPrice}</span>
                        )}
                        {isHidden && (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[14px] px-1.5 py-0.5 rounded font-black">
                            隱藏中
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isBatchTrading && (
                          <span className="bg-[#CDFF3D] text-black text-[14px] px-2 py-0.5 rounded-xs font-black">
                            交易中
                          </span>
                        )}
                        <span className={`text-[14.5px] px-2 py-0.5 rounded font-bold ${
                          tab?.tradeType === "real"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                        }`}>
                          {tab?.tradeType === "real" ? "真實交易" : "模擬交易"}
                        </span>
                        <span className="text-zinc-400 text-[15px] font-medium">
                          {tab?.holdingStatus || "候選名單"}
                        </span>
                      </div>
                    </div>

                    {/* (目前) 批次資訊 - 高對比黃綠高亮 (原字級均 +5px) */}
                    <div className="flex flex-col bg-zinc-900/90 rounded-lg px-2.5 py-2 border border-[#CDFF3D]/50 shadow-inner">
                      <div className="flex items-center justify-between text-[16px] leading-none">
                        <div className="flex items-center gap-2">
                          <span className="bg-[#CDFF3D] text-black text-[14.5px] px-1.5 py-0.5 rounded-xs font-black tracking-tight shrink-0">
                            目前
                          </span>
                          <span className="font-black text-[#CDFF3D] text-[16.5px]">
                            {batchProgress.currentBatch.batchTitle}
                          </span>
                        </div>
                        {batchProgress.currentBatch.remainingQty > 0 ? (
                          <span className="text-[15px] text-zinc-400 font-mono">
                            剩餘: <strong className="text-zinc-200">{batchProgress.currentBatch.remainingQty.toLocaleString()}</strong> 股
                          </span>
                        ) : (
                          <span className="text-[15px] text-[#CDFF3D] font-bold">該批已滿額</span>
                        )}
                      </div>
                      <div className="text-[16px] text-zinc-200 mt-2 flex items-center justify-between font-mono">
                        <span>
                          總計預購股數: <strong className="text-white font-black">{batchProgress.currentBatch.plannedQty.toLocaleString()}</strong> 股
                        </span>
                        <span className="text-zinc-500 font-bold mx-1.5">|</span>
                        <span>
                          已購股數: <strong className="text-[#CDFF3D] font-black">{batchProgress.currentBatch.boughtQty.toLocaleString()}</strong> 股
                        </span>
                      </div>
                    </div>

                    {/* (下一批) 批次資訊 - 若目前在第四批則不顯示 (原字級均 +5px) */}
                    {batchProgress.nextBatch && (
                      <div className="flex flex-col bg-zinc-900/70 rounded-lg px-2.5 py-2 border border-sky-500/40">
                        <div className="flex items-center justify-between text-[16px] leading-none">
                          <div className="flex items-center gap-2">
                            <span className="bg-sky-500 text-black text-[14.5px] px-1.5 py-0.5 rounded-xs font-black tracking-tight shrink-0">
                              下一批
                            </span>
                            <span className="font-black text-sky-300 text-[16.5px]">
                              {batchProgress.nextBatch.batchTitle}
                            </span>
                          </div>
                          <span className="text-[15px] text-zinc-400 font-mono">
                            剩餘: <strong className="text-zinc-300">{batchProgress.nextBatch.remainingQty.toLocaleString()}</strong> 股
                          </span>
                        </div>
                        <div className="text-[16px] text-zinc-300 mt-2 flex items-center justify-between font-mono">
                          <span>
                            總計預購股數: <strong className="text-white font-black">{batchProgress.nextBatch.plannedQty.toLocaleString()}</strong> 股
                          </span>
                          <span className="text-zinc-500 font-bold mx-1.5">|</span>
                          <span>
                            已購股數: <strong className="text-sky-300 font-black">{batchProgress.nextBatch.boughtQty.toLocaleString()}</strong> 股
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 拆分階段細部資訊 (若有拆分交易，原字級均 +5px) */}
                    {splitStageDetail && (
                      <div className="flex flex-col bg-zinc-900/50 rounded-lg px-2.5 py-1.5 border border-purple-500/30 text-[15px]">
                        <div className="flex items-center justify-between text-purple-300 font-bold">
                          <span>拆分階段: {splitStageDetail.fullStageName}</span>
                          <span className="text-zinc-400 font-mono">
                            剩餘: <strong className="text-purple-200">{splitStageDetail.stageRemaining.toLocaleString()}</strong> 股
                          </span>
                        </div>
                        <div className="text-zinc-400 mt-1 font-mono flex items-center justify-between">
                          <span>階段預計: <strong className="text-zinc-200">{splitStageDetail.stageSize.toLocaleString()}</strong> 股</span>
                          <span className="text-zinc-500 mx-1.5">|</span>
                          <span>階段已購: <strong className="text-purple-300">{splitStageDetail.stageBought.toLocaleString()}</strong> 股</span>
                        </div>
                        {splitStageDetail.companionStage && (
                          <div className="text-[14.5px] text-amber-300/90 mt-1 border-t border-purple-900/40 pt-1">
                            伴隨: {splitStageDetail.companionStage.fullStageName} (預計 {splitStageDetail.companionStage.stageSize.toLocaleString()} / 已購 {splitStageDetail.companionStage.stageBought.toLocaleString()} / 餘 {splitStageDetail.companionStage.stageRemaining.toLocaleString()})
                          </div>
                        )}
                      </div>
                    )}

                    {/* 持股成本、未實現損益、基準/強平價位區塊 (原字級均 +5px) */}
                    {(effectiveHoldingQty > 0 || hasHoldingOrPnL || basePositionPrice !== null || forcedLiquidationPrice !== null) && (
                      <div className="grid grid-cols-2 gap-2 bg-zinc-900/50 rounded-lg p-2 border border-zinc-800 text-[15px]">
                        {effectiveAvgPrice > 0 && (
                          <div className="text-zinc-400 font-mono">
                            成本: <strong className="text-white">${effectiveAvgPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                          </div>
                        )}
                        {effectiveHoldingQty > 0 && (
                          <div className="text-zinc-400 font-mono text-right">
                            持股: <strong className="text-zinc-200">{effectiveHoldingQty.toLocaleString()}</strong> 股
                          </div>
                        )}
                        {hasHoldingOrPnL && (
                          <div className="text-zinc-400 font-mono col-span-2 flex items-center justify-between">
                            <span>未實現損益:</span>
                            <strong className={`font-black ${effectiveUnrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {effectiveUnrealizedPnL >= 0 ? "+" : "-"}${Math.abs(effectiveUnrealizedPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </strong>
                          </div>
                        )}
                        {(basePositionPrice !== null || forcedLiquidationPrice !== null) && (
                          <div className="col-span-2 flex items-center justify-between text-[14.5px] text-zinc-400 border-t border-zinc-800 pt-1.5 font-mono">
                            {basePositionPrice !== null && (
                              <span>基準倉位: <strong className="text-zinc-200">${basePositionPrice.toFixed(2)}</strong></span>
                            )}
                            {forcedLiquidationPrice !== null && (
                              <span>強平價: <strong className="text-rose-400">${forcedLiquidationPrice.toFixed(2)}</strong></span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 底部快捷提示 (原字級均 +5px) */}
                    <div className="text-[14px] text-zinc-400 text-center border-t border-zinc-800/80 pt-1.5">
                      {isSelected && tab ? "雙擊或點擊原點前往卡片 • 按住 Shift 鎖定水平拖曳" : "按住拖曳移動 • 按住 Shift 鎖定水平"}
                    </div>
                  </div>

                  {/* 指示箭頭 */}
                  <div
                    className={`w-0 h-0 border-x-5 border-x-transparent ${
                      isNearTop
                        ? "border-b-6 border-b-zinc-800 -mb-px"
                        : "border-t-6 border-t-zinc-800 -mt-px"
                    }`}
                  />
                </div>
              </div>

              {/* 攤平進度 (#1~#4) / 拆分交易 (含當前第幾批拆分與剩餘可用股數)、預計/已購數量、未實現損益與基準倉位/強制平倉價位 - 懸掛於圓圈下方，不影響圓圈中心座標基準 */}
              {(effectiveDcaProgress || effectivePlannedBuyQty > 0 || effectiveHoldingQty > 0 || effectiveUnrealizedPnL !== 0 || basePositionPrice !== null || forcedLiquidationPrice !== null) && (
                <div
                  className="absolute left-0 -translate-x-1/2 flex flex-col items-center pointer-events-none select-none z-10 animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    top: isBatchTrading ? `${circleSize / 2 + 5}px` : `${circleSize / 2 + 3}px`,
                    width: "max-content",
                    minWidth: "140px",
                    maxWidth: `${Math.max(210, circleSize + 125)}px`,
                  }}
                >
                  {/* 【批次明細列表】：每一批次單行整合，實心圓點 + 批次名稱與百分比(粗體) + 已/預股數(較小較淡接在後方) + 餘 X 股靠右 */}
                  {(splitStageDetail || effectiveDcaProgress || effectivePlannedBuyQty > 0 || effectiveHoldingQty > 0) && (() => {
                    // 輔助函式：提取批次名稱 (例如 "第四批" -> "第4批", "第三批" -> "第3批", "第二批" -> "第2批", "第一批" -> "第1批")
                    const extractBatchLabel = (group?: string, name?: string) => {
                      const source = (group || "") + " " + (name || "");
                      if (source.includes("第四批") || source.includes("第4批") || source.includes("#4")) return "第4批";
                      if (source.includes("第三批") || source.includes("第3批") || source.includes("#3")) return "第3批";
                      if (source.includes("第二批") || source.includes("第2批") || source.includes("#2")) return "第2批";
                      if (source.includes("第一批") || source.includes("第1批") || source.includes("#1")) return "第1批";
                      return "第1批";
                    };

                    // 輔助函式：提取階段百分比文字
                    const extractPercent = (name?: string) => {
                      if (!name) return "";
                      const m = name.match(/(\d+%)/);
                      return m ? m[1] : "";
                    };

                    // 輔助函式：根據批次取得圓點顏色（高對比且與拆分交易選項色彩一致）
                    const getDotColor = (label: string, isCompanion = false) => {
                      if (label.includes("4")) return isCompanion ? "#f472b6" : "#c084fc";
                      if (label.includes("3")) return isCompanion ? "#facc15" : "#fb923c";
                      if (label.includes("2")) return isCompanion ? "#4ade80" : "#2dd4bf";
                      return isCompanion ? "#22d3ee" : "#38bdf8";
                    };

                    // 輔助函式：格式化次要文字（已 X／預 Y 或 預購 X 股）
                    const formatSubLine = (bought: number, size: number, isCurrentWithStock: boolean) => {
                      if (bought > 0 || isCurrentWithStock) {
                        return `已 ${bought.toLocaleString()}／預 ${size.toLocaleString()}`;
                      }
                      if (size > 0) {
                        return `預購 ${size.toLocaleString()} 股`;
                      }
                      return "";
                    };

                    if (splitStageDetail) {
                      const batchLabel1 = extractBatchLabel(
                        splitStageDetail.batchGroup,
                        splitStageDetail.fullStageName || splitStageDetail.stageName
                      );
                      const pct1 = extractPercent(splitStageDetail.fullStageName || splitStageDetail.stageName);
                      const sub1 = formatSubLine(
                        splitStageDetail.stageBought,
                        splitStageDetail.stageSize,
                        effectiveHoldingQty > 0
                      );

                      const comp = splitStageDetail.companionStage;
                      const batchLabel2 = comp
                        ? extractBatchLabel(undefined, comp.fullStageName || comp.stageName)
                        : "";
                      const pct2 = comp ? extractPercent(comp.fullStageName || comp.stageName) : "";
                      const sub2 = comp
                        ? formatSubLine(comp.stageBought, comp.stageSize, false)
                        : "";

                      return (
                        <div className="w-full flex flex-col">
                          {/* 當前階段：單行呈現，動態顯示對應批次，已/預股數接在批次後方 */}
                          <div className="flex items-center justify-between gap-1.5 w-full leading-tight py-0.5">
                            <div className="flex items-center gap-1 min-w-0">
                              {/* 實心圓點：動態批次顏色 */}
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0 shadow-xs ring-1 ring-white/30"
                                style={{ backgroundColor: getDotColor(batchLabel1, false) }}
                              />
                              <span className="text-[11px] font-sans font-bold text-white tracking-tight whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                {batchLabel1}{pct1 ? " " : ""}{pct1 && <strong className="font-mono font-black text-white">{pct1}</strong>}
                              </span>
                              {sub1 && (
                                <span className="text-[9.5px] font-mono font-medium text-zinc-400 tracking-tight whitespace-nowrap ml-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                  {sub1}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-sans font-bold text-white tracking-tight whitespace-nowrap pl-1.5 ml-auto drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                              餘 {splitStageDetail.stageRemaining.toLocaleString()} 股
                            </span>
                          </div>

                          {/* 伴隨階段：單行呈現，動態顯示對應伴隨批次 */}
                          {comp && (
                            <div className="flex items-center justify-between gap-1.5 w-full leading-tight py-0.5 mt-0.5">
                              <div className="flex items-center gap-1 min-w-0">
                                {/* 實心圓點：動態伴隨批次顏色 */}
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0 shadow-xs ring-1 ring-white/30"
                                  style={{ backgroundColor: getDotColor(batchLabel2, true) }}
                                />
                                <span className="text-[11px] font-sans font-bold text-white tracking-tight whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                  {batchLabel2}{pct2 ? " " : ""}{pct2 && <strong className="font-mono font-black text-white">{pct2}</strong>}
                                </span>
                                {sub2 && (
                                  <span className="text-[9.5px] font-mono font-medium text-zinc-400 tracking-tight whitespace-nowrap ml-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                    {sub2}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-sans font-bold text-white tracking-tight whitespace-nowrap pl-1.5 ml-auto drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                餘 {comp.stageRemaining.toLocaleString()} 股
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    }

                    // 非拆分交易模式下的攤平進度或預購
                    const batchLabel = effectiveDcaProgress
                      ? (effectiveDcaProgress.includes("4") ? "第4批" :
                         effectiveDcaProgress.includes("3") ? "第3批" :
                         effectiveDcaProgress.includes("2") ? "第2批" :
                         effectiveDcaProgress.includes("1") ? "第1批" :
                         `第${effectiveDcaProgress.replace("#", "")}批`)
                      : "第1批";
                    const remShares = Math.max(0, effectivePlannedBuyQty - effectiveHoldingQty);
                    const subText = effectiveHoldingQty > 0
                      ? `已 ${effectiveHoldingQty.toLocaleString()}／預 ${effectivePlannedBuyQty.toLocaleString()}`
                      : effectivePlannedBuyQty > 0
                      ? `預購 ${effectivePlannedBuyQty.toLocaleString()} 股`
                      : "";

                    return (
                      <div className="w-full flex flex-col">
                        <div className="flex items-center justify-between gap-1.5 w-full leading-tight py-0.5">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0 shadow-xs ring-1 ring-white/30" style={{ backgroundColor: "#0e7490" }} />
                            <span className="text-[11px] font-sans font-bold text-white tracking-tight whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                              {batchLabel}
                            </span>
                            {subText && (
                              <span className="text-[9.5px] font-mono font-medium text-zinc-400 tracking-tight whitespace-nowrap ml-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                {subText}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-sans font-bold text-white tracking-tight whitespace-nowrap pl-1.5 ml-auto drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                            餘 {remShares.toLocaleString()} 股
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 【底部損益區】：與批次列表之間留適度垂直間距 */}
                  {(hasHoldingOrPnL || basePositionPrice !== null || forcedLiquidationPrice !== null) && (
                    <div className="flex flex-col items-center w-full mt-1.5">
                      {/* 置中顯示「未實現 −$X.XX」，字級明顯大於其他文字、粗體，虧損紅色，獲利綠色 */}
                      {hasHoldingOrPnL && (
                        <div className="flex items-center justify-center whitespace-nowrap leading-tight">
                          <span
                            className={`font-mono font-black text-[13.5px] tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${
                              effectiveUnrealizedPnL < 0
                                ? "text-[#ef4444]"
                                : effectiveUnrealizedPnL > 0
                                ? "text-[#10b981]"
                                : "text-zinc-300"
                            }`}
                          >
                            {effectiveUnrealizedPnL < 0
                              ? `未實現 -$${Math.abs(effectiveUnrealizedPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : effectiveUnrealizedPnL > 0
                              ? `未實現 +$${effectiveUnrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : "未實現 $0.00"}
                          </span>
                        </div>
                      )}

                      {/* 下方置中顯示一行「基準 X.XX → 平倉 X.XX」，改成白色粗體 */}
                      {(basePositionPrice !== null || forcedLiquidationPrice !== null) && (
                        <div className="flex items-center justify-center text-[10.5px] font-mono font-bold text-white leading-tight mt-0.5 whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                          {basePositionPrice !== null && forcedLiquidationPrice !== null ? (
                            <span>
                              基準 {basePositionPrice >= 100 ? basePositionPrice.toFixed(1) : basePositionPrice.toFixed(2)} → 平倉 {forcedLiquidationPrice >= 100 ? forcedLiquidationPrice.toFixed(1) : forcedLiquidationPrice.toFixed(2)}
                            </span>
                          ) : basePositionPrice !== null ? (
                            <span>
                              基準 {basePositionPrice >= 100 ? basePositionPrice.toFixed(1) : basePositionPrice.toFixed(2)}
                            </span>
                          ) : (
                            <span>
                              平倉 {forcedLiquidationPrice! >= 100 ? forcedLiquidationPrice!.toFixed(1) : forcedLiquidationPrice!.toFixed(2)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        </div>

        {/* 視角平移指示與一鍵復位膠囊 (當使用者使用滑鼠滾輪上下移動時顯示，點擊或雙擊空白處可復位) */}
        {canvasPanY !== 0 && (
          <div className="absolute top-4 right-4 z-40 flex items-center gap-2 bg-zinc-950/90 border border-zinc-700/90 rounded-full px-3 py-1.5 shadow-2xl backdrop-blur-md text-xs font-mono animate-in fade-in zoom-in-95 duration-150 pointer-events-auto select-none">
            <span className="text-zinc-300 flex items-center gap-1">
              <MoveVertical className="w-3.5 h-3.5 text-[#CDFF3D]" />
              <span>視角位移:</span>
              <strong className="text-[#CDFF3D]">
                {canvasPanY > 0 ? `+${Math.round(canvasPanY)}` : Math.round(canvasPanY)}px
              </strong>
            </span>
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setCanvasPanY(0);
                toast.info("已恢復預設置中視角");
              }}
              className="px-2.5 py-0.5 rounded-full bg-[#CDFF3D] hover:bg-[#b8ea2e] text-black font-black text-[11px] cursor-pointer transition-all active:scale-95 shadow-sm"
              title="恢復畫布至預設置中視角 (雙擊空白處亦可復位)"
            >
              復位
            </button>
          </div>
        )}

        {/* Bottom Coordinate Diagnostic & Calibration HUD (當開啟輔助線測試時顯示) */}
        {showAuxiliaryTestLines && activeCanvasSymbols.length > 0 && (() => {
          const activeDiagSym =
            (selectedDiagnosticSymbol && activeCanvasSymbols.includes(selectedDiagnosticSymbol))
              ? selectedDiagnosticSymbol
              : (selectedTagSymbols.length > 0 && activeCanvasSymbols.includes(selectedTagSymbols[0]))
              ? selectedTagSymbols[0]
              : activeCanvasSymbols[0];

          const diagTab = activeDiagSym
            ? allStockMap.get(activeDiagSym) || allTabs.find((t) => (t.symbol || "").trim().toUpperCase() === activeDiagSym)
            : undefined;
          const diagStrat = diagTab ? (strategiesMap?.[diagTab.id] || (diagTab as any).strategy) : undefined;
          const stat = diagTab ? statsMap?.[diagTab.id] : undefined;
          const avgCost = stat?.totalQuantity !== 0 ? stat?.averagePrice : undefined;
          const holdingQty = stat?.totalQuantity ?? (diagTab as any)?.holdingQuantity;
          const diagDetails = diagTab
            ? calculateCanvasYDetails(diagTab, diagStrat, avgCost, holdingQty)
            : null;
          const currentPos = activeDiagSym ? positions[activeDiagSym] : undefined;
          const currentY = currentPos?.y ?? 50;
          const targetY = diagDetails?.canvasY ?? 50;
          const diffY = currentY - targetY;

          return (
            <div className="absolute bottom-10 left-5 z-40 bg-zinc-950/95 border border-zinc-700/90 text-white rounded-2xl p-3.5 shadow-2xl backdrop-blur-md max-w-lg w-full animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-auto">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#D2F800] text-black flex items-center justify-center font-black">
                    <Crosshair className="w-3 h-3 text-black stroke-[3]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white tracking-wider flex items-center gap-1.5 uppercase">
                      座標換算診斷與校準 HUD
                    </h4>
                    <span className="text-[9.5px] text-zinc-400 font-mono">
                      統一基準點: 卡片[7~93%] ➔ 畫布[12~90%]
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCalibrateAllActiveStocks}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono font-black text-[#D2F800] border border-zinc-600 transition-all cursor-pointer active:scale-95"
                    title="將畫布上所有股票依卡片分隔線重新計算座標"
                  >
                    全圖校準
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAuxiliaryTestLines(false)}
                    className="p-1 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Stock Selector Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1.5 mb-2 scrollbar-none">
                <span className="text-[10px] text-zinc-400 font-bold shrink-0">選取診斷:</span>
                {activeCanvasSymbols.map((sym) => {
                  const isCur = sym === activeDiagSym;
                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => {
                        setSelectedDiagnosticSymbol(sym);
                        playClickSound();
                      }}
                      className={`px-2 py-0.5 rounded-full text-[10.5px] font-mono font-black transition-all shrink-0 cursor-pointer ${
                        isCur
                          ? "bg-[#D2F800] text-black shadow-xs scale-105"
                          : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-700"
                      }`}
                    >
                      {sym}
                    </button>
                  );
                })}
              </div>

              {/* Diagnostic Details Content */}
              {diagTab && diagDetails ? (
                <div className="space-y-2 text-[11px]">
                  {/* Grid stats */}
                  <div className="grid grid-cols-3 gap-2 bg-zinc-900/80 border border-zinc-800 rounded-xl p-2 font-mono">
                    <div className="flex flex-col">
                      <span className="text-[9.5px] text-zinc-400">最新現價</span>
                      <strong className="text-white text-xs font-black">
                        ${diagDetails.currentPrice > 0 ? diagDetails.currentPrice.toFixed(2) : "-"}
                      </strong>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9.5px] text-zinc-400">卡片原始 Y%</span>
                      <strong className="text-amber-300 text-xs font-black">
                        {diagDetails.cardPriceY.toFixed(1)}%
                      </strong>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9.5px] text-zinc-400">目標畫布 Y%</span>
                      <strong className="text-[#D2F800] text-xs font-black">
                        {diagDetails.canvasY.toFixed(1)}%
                      </strong>
                    </div>
                  </div>

                  {/* Alignment & Anchors breakdown */}
                  <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-2 space-y-1">
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="text-zinc-400">投射計算狀態:</span>
                      {diagDetails.isSnapped && diagDetails.snappedTo ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1 font-mono">
                          <Check className="w-3 h-3 stroke-[3]" />
                          精準吸附: {diagDetails.snappedTo}
                        </span>
                      ) : (
                        <span className="text-sky-300 font-bold font-mono">
                          📐 區間分段線性插值 (Piecewise Linear)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="text-zinc-400">所屬視覺區域:</span>
                      <span className="text-zinc-200 font-bold">
                        {diagDetails.zone.name} ({diagDetails.nearestLine.axis}軸附近)
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="text-zinc-400">目前畫布 Y 偏差:</span>
                      <span className={`font-mono font-black ${Math.abs(diffY) <= 0.5 ? "text-emerald-400" : "text-amber-400"}`}>
                        目前: {currentY.toFixed(1)}% (偏差: {diffY >= 0 ? `+${diffY.toFixed(1)}%` : `${diffY.toFixed(1)}%`})
                      </span>
                    </div>

                    {/* Anchors list */}
                    {diagDetails.anchors.length > 0 && (
                      <div className="mt-1 pt-1 border-t border-zinc-800 text-[10px]">
                        <span className="text-zinc-400 font-bold">卡片分隔線對齊錨點 ({diagDetails.anchors.length} 條):</span>
                        <div className="flex flex-wrap gap-1.5 mt-0.5 font-mono">
                          {diagDetails.anchors.map((anc, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.2 rounded bg-black/60 border border-zinc-600 text-zinc-200 text-[9.5px]"
                            >
                              {anc.name}: 卡片 {anc.cardY.toFixed(0)}% ➔ 畫布 {anc.canvasY.toFixed(0)}%
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions for active stock */}
                  <div className="flex items-center justify-end gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleCalibrateSingleStock(activeDiagSym)}
                      className="px-3 py-1 bg-[#D2F800] hover:bg-[#bde000] text-black font-black text-xs rounded-full transition-all cursor-pointer active:scale-95 flex items-center gap-1 shadow-sm"
                    >
                      <RefreshCw className="w-3 h-3 text-black stroke-[2.5]" />
                      <span>校準「{activeDiagSym}」至目標座標 ({diagDetails.canvasY.toFixed(1)}%)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-zinc-400 py-2 text-center">
                  請選取一檔股票以檢視座標診斷
                </div>
              )}
            </div>
          );
        })()}

        {/* Empty state hint */}
        {activeCanvasSymbols.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-700 text-white flex items-center justify-center mb-4 shadow-2xl">
              <Tag className="w-7 h-7 text-[#D2F800]" />
            </div>
            {(!selectedCardIds || selectedCardIds.size === 0) ? (
              <>
                <p className="font-black text-lg sm:text-xl text-white uppercase tracking-wider mb-1.5">
                  目前尚未在主畫面勾選任何個股卡片
                </p>
                <p className="text-xs text-zinc-400 max-w-md leading-relaxed mb-5 font-medium">
                  視覺線看板嚴格執行「僅顯示已勾選卡片」，以避免畫面過多標籤造成凌亂。請在主畫面勾選您想關注的個股，或點擊下方按鈕一鍵全選。
                </p>
                <div className="flex items-center gap-3 pointer-events-auto">
                  {onSelectAllCards && (
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        onSelectAllCards();
                      }}
                      className="px-5 py-2.5 bg-[#D2F800] hover:bg-[#bce000] text-black rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-2 transition-all shadow-lg cursor-pointer active:scale-95"
                    >
                      <CheckSquare className="w-4 h-4 text-black stroke-[2.5]" />
                      <span>一鍵全選所有卡片</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      onClose();
                    }}
                    className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-2 transition-all shadow-lg cursor-pointer active:scale-95 border border-zinc-700"
                  >
                    <span>返回主畫面勾選</span>
                  </button>
                </div>
              </>
            ) : showOnlyTrading ? (
              <>
                <p className="font-black text-lg sm:text-xl text-white uppercase tracking-wider mb-1.5">
                  目前勾選的個股中沒有「交易中」的股票
                </p>
                <p className="text-xs text-zinc-400 max-w-md leading-relaxed mb-4 font-medium">
                  您已在主畫面勾選 {selectedCardIds.size} 張卡片，但目前均無持股或已開啟「只顯示交易中」。點擊下方按鈕可切換顯示全部已勾選標籤。
                </p>
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setShowOnlyTrading(false);
                  }}
                  className="pointer-events-auto px-5 py-2.5 bg-[#D2F800] hover:bg-[#bce000] text-black rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-2 transition-all shadow-lg cursor-pointer active:scale-95"
                >
                  <Tag className="w-4 h-4 text-black stroke-[2.5]" />
                  <span>切換顯示全部已勾選標籤</span>
                </button>
              </>
            ) : (
              <>
                <p className="font-black text-lg sm:text-xl text-white uppercase tracking-wider mb-1.5">
                  圖表上目前沒有符合當前篩選的美股標籤
                </p>
                <p className="text-xs text-zinc-400 max-w-md leading-relaxed mb-4 font-medium">
                  您已勾選 {selectedCardIds.size} 張個股卡片。可點選下方「同步分隔線」自動將卡片中符合條件的個股同步至畫布。
                </p>
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    handleSyncDividersFromCards();
                  }}
                  className="pointer-events-auto px-5 py-2.5 bg-[#D2F800] hover:bg-[#bce000] text-black rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-2 transition-all shadow-lg cursor-pointer active:scale-95"
                >
                  <SlidersHorizontal className="w-4 h-4 text-black stroke-[2.5]" />
                  <span>從已勾選卡片同步標籤至畫布</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Bottom Helper Bar - Nike Precision Track Aesthetic */}
        <div className="absolute bottom-3 left-5 right-5 flex items-center justify-between text-[11px] text-zinc-400 font-mono pointer-events-none">
          <div className="flex items-center gap-4">
            <span className="text-[#CDFF3D] font-bold">• 滾輪上下平移視角 (雙擊空白處復位)</span>
            <span>• 拖曳標籤任意定位 (DRAG TO POSITION)</span>
            <span>• 懸停標籤可點擊 <strong className="text-rose-400 font-bold">✕</strong> 刪除</span>
            <span>• 儲存快速鍵 <strong className="text-white font-black">SHIFT + S</strong></span>
            <span>• Primial 金字塔 <strong className="text-amber-400 font-black">ALT + Z</strong></span>
          </div>
          <div>
            <span className="uppercase tracking-wider">圖表共有 <strong className="text-white font-black text-xs">{activeCanvasSymbols.length}</strong> 檔標籤</span>
          </div>
        </div>
      </main>

      {/* Primial 分批進場金字塔動態互動圖表視圖 (Alt+Z) */}
      {showPyramidView && (
        <div className="fixed inset-0 z-[100] flex flex-col h-screen w-screen max-h-screen bg-[#0f1115] text-white select-none overflow-hidden animate-in fade-in duration-150">
          {/* Primial 頂部導航欄 (Sticky Header) */}
          <div className="w-full bg-[#18181b] border-b border-zinc-800 px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3 shadow-lg z-30 shrink-0">
            {/* 左側：返回畫布按鈕 + 標題 */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setShowPyramidView(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-100 hover:text-white rounded-full text-xs font-black transition-all cursor-pointer shadow-sm border border-zinc-700/80"
                title="返回視覺線看板 (Esc / Alt+Z)"
              >
                <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>返回畫布</span>
                <span className="hidden sm:inline text-[10px] text-zinc-400 font-mono font-normal">(Esc / Alt+Z)</span>
              </button>

              <div className="h-4 w-[1px] bg-zinc-700 hidden sm:block" />

              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>Primial</span>
                  <span className="hidden md:inline text-xs font-bold text-zinc-400">分批進場金字塔動態互動圖表</span>
                </span>
                <span className="px-2 py-0.5 bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-black rounded-full">
                  已選取 {displayPyramidSymbols.length} 檔
                </span>
              </div>
            </div>

            {/* 中間：個股的名字 Tab (可點擊快速跳轉到該股，並將畫面上下置中) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-hide py-1 max-w-[45vw] sm:max-w-[55vw] lg:max-w-[60vw]">
              {displayPyramidSymbols.map((symbol) => {
                const cleanSym = symbol.trim().toUpperCase();
                const isActive = (activePyramidSymbol || displayPyramidSymbols[0]) === cleanSym;
                const pData = getStockPyramidData(cleanSym);
                return (
                  <button
                    key={cleanSym}
                    type="button"
                    onClick={() => handleJumpToPyramidStock(cleanSym)}
                    className={`px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 active:scale-95 select-none ${
                      isActive
                        ? "bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.5)] ring-2 ring-amber-300 font-mono"
                        : "bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 font-mono"
                    }`}
                    title={`點擊快速跳轉到 ${cleanSym} 並將畫面上下置中`}
                  >
                    <span>{cleanSym}</span>
                    {pData.currentPrice > 0 && (
                      <span className={`text-[10px] font-mono ${isActive ? "text-zinc-900 font-bold" : "text-zinc-400"}`}>
                        ${pData.currentPrice.toFixed(2)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 右側：防線/分隔線快捷開關 + 攤平/突破價位 + 全部展開/收合 + 關閉 */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* 行權價 (新增) - 預設關閉 */}
              <button
                type="button"
                onClick={handleTogglePyramidStrikePrices}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer border active:scale-95 shrink-0 select-none ${
                  pyramidShowStrikePrices
                    ? "bg-zinc-950 text-white border-zinc-400 shadow-[0_0_8px_rgba(255,255,255,0.25)] ring-1 ring-zinc-400"
                    : "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700/60"
                }`}
                title="開啟/關閉期權行權價與合約金額黑色虛線 (預設關閉)"
              >
                <span className="w-2.5 h-0 border-t-2 border-dashed border-zinc-300 shrink-0" />
                <span>行權價</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    pyramidShowStrikePrices ? "bg-white shadow-[0_0_6px_#ffffff]" : "bg-zinc-500"
                  }`}
                />
              </button>

              {/* 攤平 | 突破價位 (快捷按鍵: Alt+T / Alt+B) */}
              <div className="flex items-center bg-zinc-900/90 border border-zinc-700/80 rounded-full p-0.5 shadow-xs shrink-0 select-none">
                <button
                  type="button"
                  onClick={() => handleTogglePyramidCalcMode("averaging")}
                  className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-xs font-black transition-all cursor-pointer border active:scale-95 select-none ${
                    pyramidCalcMode === "averaging"
                      ? "bg-emerald-600 text-white border-emerald-400/60 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                      : "bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-transparent"
                  }`}
                  title="向下分批攤平價位試算 (-3%, -6%, -9%, -12%) [快捷鍵 Alt + T]"
                >
                  <span>攤平</span>
                  <span className="text-[10px] font-mono opacity-80 font-normal">Alt+T</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      pyramidCalcMode === "averaging" ? "bg-emerald-300 shadow-[0_0_6px_#6ee7b7]" : "bg-zinc-600"
                    }`}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => handleTogglePyramidCalcMode("breakout")}
                  className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-xs font-black transition-all cursor-pointer border active:scale-95 select-none ${
                    pyramidCalcMode === "breakout"
                      ? "bg-indigo-600 text-white border-indigo-400/60 shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                      : "bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-transparent"
                  }`}
                  title="向上突破加碼價位試算 (+2%, +4%, +6%, +8%) [快捷鍵 Alt + B]"
                >
                  <span>突破價位</span>
                  <span className="text-[10px] font-mono opacity-80 font-normal">Alt+B</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      pyramidCalcMode === "breakout" ? "bg-indigo-300 shadow-[0_0_6px_#a5b4fc]" : "bg-zinc-600"
                    }`}
                  />
                </button>
              </div>

              <div className="h-4 w-[1px] bg-zinc-700 hidden sm:block" />

              {/* 卡片分隔線 (Alt + D) */}
              <button
                type="button"
                onClick={handleTogglePyramidCardDividers}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer border active:scale-95 shrink-0 select-none ${
                  pyramidShowCardDividers
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-400/60 shadow-[0_0_8px_rgba(99,102,241,0.3)] ring-1 ring-indigo-400/50"
                    : "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700/60"
                }`}
                title="快速打開/關閉卡片分隔線 (Alt + D)"
              >
                <Split className={`w-3.5 h-3.5 ${pyramidShowCardDividers ? "text-indigo-400" : "text-zinc-400"}`} />
                <span className="hidden sm:inline">分隔線</span>
                <span className="sm:hidden">分</span>
                <span className="text-[10px] font-mono text-zinc-400 font-normal">Alt+D</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    pyramidShowCardDividers ? "bg-indigo-400 shadow-[0_0_6px_#818cf8]" : "bg-zinc-500"
                  }`}
                />
              </button>

              {/* 支撐 (Alt + R) */}
              <button
                type="button"
                onClick={handleTogglePyramidSupport}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer border active:scale-95 shrink-0 select-none ${
                  pyramidLevelTypes.support
                    ? "bg-amber-500/20 text-amber-300 border-amber-400/60 shadow-[0_0_8px_rgba(245,158,11,0.3)] ring-1 ring-amber-400/50"
                    : "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700/60"
                }`}
                title="快速打開/關閉支撐防線 (Alt + R)"
              >
                <span className="w-2.5 h-0 border-t-2 border-dashed border-amber-400 shrink-0" />
                <span>支撐</span>
                <span className="text-[10px] font-mono text-zinc-400 font-normal">Alt+R</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    pyramidLevelTypes.support ? "bg-amber-400 shadow-[0_0_6px_#fbbf24]" : "bg-zinc-500"
                  }`}
                />
              </button>

              {/* 壓力 (Alt + P) */}
              <button
                type="button"
                onClick={handleTogglePyramidResistance}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer border active:scale-95 shrink-0 select-none ${
                  pyramidLevelTypes.resistance
                    ? "bg-rose-500/20 text-rose-300 border-rose-400/60 shadow-[0_0_8px_rgba(244,63,94,0.3)] ring-1 ring-rose-400/50"
                    : "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700/60"
                }`}
                title="快速打開/關閉壓力防線 (Alt + P)"
              >
                <span className="w-2.5 h-0 border-t-2 border-dashed border-rose-400 shrink-0" />
                <span>壓力</span>
                <span className="text-[10px] font-mono text-zinc-400 font-normal">Alt+P</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    pyramidLevelTypes.resistance ? "bg-rose-400 shadow-[0_0_6px_#fb7185]" : "bg-zinc-500"
                  }`}
                />
              </button>

              <div className="h-4 w-[1px] bg-zinc-700 hidden md:block" />

              <button
                type="button"
                onClick={toggleAllCardsCollapse}
                className="px-2.5 sm:px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-full text-xs font-bold transition-all border border-zinc-700/60 cursor-pointer active:scale-95 shrink-0"
              >
                {displayPyramidSymbols.length > 0 && displayPyramidSymbols.every((sym) => Boolean(collapsedCards[sym])) ? "全部展開" : "全部收合"}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-all cursor-pointer active:scale-95 shrink-0"
                title="關閉看板"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* 滾動內容區塊：個股金字塔互動圖表卡片列表 (上下區塊適當縮小，邊界左右擴張，min-h-0 h-full 原生滾動，置中完整顯示) */}
          <div
            ref={pyramidScrollContainerRef}
            data-scrollable="true"
            onWheel={(e) => {
              e.stopPropagation();
            }}
            className="flex-1 min-h-0 h-full overflow-y-auto px-2 sm:px-4 lg:px-6 py-2.5 sm:py-3 space-y-4 bg-[#f3f4f6] scrollbar-hide no-scrollbar [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none] overscroll-contain focus:outline-none scroll-smooth"
          >
            {displayPyramidSymbols.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] text-zinc-500 bg-white rounded-xl border border-zinc-200/90 shadow-sm p-8 text-center max-w-xl mx-auto my-8">
                <Layers className="w-10 h-10 text-amber-400/80 mb-3" />
                <div className="text-base font-bold text-zinc-700 mb-1">目前尚無選取的個股</div>
                <div className="text-xs text-zinc-400">請在視覺線看板勾選標籤，或在畫布上加入股票後再行開啟金字塔圖表</div>
              </div>
            ) : (
              displayPyramidSymbols.map((symbol) => {
                const cleanSym = symbol.trim().toUpperCase();
                const pData = getStockPyramidData(cleanSym);
                const isCollapsed = Boolean(collapsedCards[cleanSym]);

                return (
                  <PyramidCardErrorBoundary key={cleanSym} symbol={cleanSym}>
                    <div
                      id={`pyramid-card-${cleanSym}`}
                      className="w-full max-w-[99%] xl:max-w-[98%] 2xl:max-w-[1880px] mx-auto bg-white rounded-xl border border-zinc-200/90 shadow-sm p-2.5 sm:p-3.5 transition-shadow duration-200 hover:shadow-md"
                    >
                      {/* 卡片主體：分批進場金字塔動態互動圖表 (整合代號/公司名與收合功能，移除重複雙標題，上下微縮置中完整顯示) */}
                      <System2PlanningChart
                        compact={true}
                        symbol={cleanSym}
                        companyName={pData.companyName || pData.tab?.companyName || cleanSym}
                        isExpanded={!isCollapsed}
                        onToggleExpand={() => toggleCardCollapse(cleanSym)}
                        currentPrice={pData.currentPrice}
                        holdingAvgPrice={pData.holdingAvgPrice}
                        holdingQty={pData.holdingQty}
                        batches={pData.batchConfigList}
                        averagingRowsSys2={pData.averagingRowsSys2}
                        pyramidRows={pData.pyramidRows}
                        calcMode={pyramidCalcMode}
                        includeCurrentHolding={true}
                        refPnLPointSys2=""
                        usableCapital={pData.usableCapital}
                        plannedQty={pData.plannedQty}
                        trades={pData.trades}
                        optionsCalcData={pData.tab?.optionsCalcData}
                        visualLevels={pData.visualLevels}
                        showCardDividers={pyramidShowCardDividers}
                        onToggleCardDividers={handleTogglePyramidCardDividers}
                        showStrikePrices={pyramidShowStrikePrices}
                        onToggleStrikePrices={handleTogglePyramidStrikePrices}
                        selectedLevelTypes={pyramidLevelTypes}
                        onToggleLevelType={(type) => {
                          setPyramidLevelTypes((prev) => ({
                            ...prev,
                            [type]: !prev[type],
                          }));
                        }}
                        onSelectAllLevelTypes={() => {
                          setPyramidLevelTypes({
                            support: true,
                            stopLoss: true,
                            resistance: true,
                            takeProfit: true,
                          });
                        }}
                        onDeselectAllLevelTypes={() => {
                          setPyramidLevelTypes({
                            support: false,
                            stopLoss: false,
                            resistance: false,
                            takeProfit: false,
                          });
                        }}
                      />
                    </div>
                  </PyramidCardErrorBoundary>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

