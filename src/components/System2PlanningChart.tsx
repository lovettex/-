import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  registerables,
  ChartData,
  ChartOptions,
  Plugin,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { Trade } from '../types';
import { formatTimestamp } from '../lib/dateUtils';
import {
  ChevronDown,
  ChevronUp,
  History,
  Sparkles,
  Layers,
  Split,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { calculateBatchPlanning, calculateLiveOptionTradeMetrics } from '../lib/calculations';
import {
  getSimulatedPreOrders,
  addSimulatedPreOrder,
  deleteSimulatedPreOrder,
  mergeAndSyncPreOrders,
  clearAllSimulatedPreOrders,
} from '../utils/simulatedPreOrdersStorage';

// Register all Chart.js components and controllers
ChartJS.register(...registerables);

export interface VisualPriceLevel {
  id: string;
  type: 'support' | 'stopLoss' | 'resistance' | 'takeProfit' | 'divider';
  label: string; // e.g. "支撐" | "止損" | "壓力" | "止盈" | "卡片分隔線"
  price: number;
  color: string; // #facc15, #ef4444, #f87171, #10b981, #6366f1
  note?: string;
  isCardDivider?: boolean;
}

export interface BatchInfo {
  index: number;
  name: string;
  size: number;
  bought: number;
  remaining: number;
  split1: {
    name: string;
    shortLabel: string;
    size: number;
    bought: number;
    remaining: number;
    percent: string;
  };
  split2: {
    name: string;
    shortLabel: string;
    size: number;
    bought: number;
    remaining: number;
    percent: string;
  };
}

export interface AveragingRowData {
  price: string;
  quantity: string;
  quantity2?: string;
  bought?: boolean;
  riskFlag?: boolean;
}

export interface SimulatedPreOrderItem {
  id: string;
  price: number;
  quantity?: number;
  direction?: 'BUY' | 'SELL';
  notes?: string;
  createdAt?: any;
}

interface System2PlanningChartProps {
  currentPrice: number;
  holdingAvgPrice: number;
  holdingQty: number;
  batches: BatchInfo[];
  averagingRowsSys2: AveragingRowData[];
  pyramidRows?: AveragingRowData[];
  calcMode?: 'averaging' | 'breakout';
  includeCurrentHolding: boolean;
  refPnLPointSys2?: string;
  usableCapital?: number;
  plannedQty?: number;
  trades?: Trade[];
  optionsCalcData?: any;
  visualLevels?: VisualPriceLevel[];
  compact?: boolean;
  symbol?: string;
  companyName?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  showCardDividers?: boolean;
  onToggleCardDividers?: () => void;
  showStrikePrices?: boolean;
  onToggleStrikePrices?: () => void;
  showPreOrders?: boolean;
  onTogglePreOrders?: () => void;
  preOrders?: SimulatedPreOrderItem[];
  onAddPreOrder?: () => void;
  selectedLevelTypes?: {
    support: boolean;
    stopLoss: boolean;
    resistance: boolean;
    takeProfit: boolean;
  };
  onToggleLevelType?: (type: 'support' | 'stopLoss' | 'resistance' | 'takeProfit') => void;
  onSelectAllLevelTypes?: () => void;
  onDeselectAllLevelTypes?: () => void;
  onBatchClick?: (
    batchIndex: number,
    batchName: string,
    split1Qty: number,
    split2Qty: number,
    targetSplit?: 1 | 2
  ) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  hideHeader?: boolean;
}

export const System2PlanningChart: React.FC<System2PlanningChartProps> = ({
  currentPrice,
  holdingAvgPrice,
  holdingQty,
  batches,
  averagingRowsSys2,
  pyramidRows,
  calcMode = 'averaging',
  includeCurrentHolding,
  usableCapital = 0,
  plannedQty = 0,
  trades = [],
  optionsCalcData,
  visualLevels = [],
  compact = false,
  symbol,
  companyName,
  isExpanded: propIsExpanded,
  onToggleExpand,
  showCardDividers: propShowCardDividers,
  onToggleCardDividers,
  showStrikePrices: propShowStrikePrices,
  onToggleStrikePrices,
  showPreOrders: propShowPreOrders,
  onTogglePreOrders,
  preOrders: propPreOrders = [],
  onAddPreOrder,
  selectedLevelTypes: propSelectedLevelTypes,
  onToggleLevelType,
  onSelectAllLevelTypes,
  onDeselectAllLevelTypes,
  onBatchClick,
  isFullscreen = false,
  onToggleFullscreen,
  hideHeader = false,
}) => {
  const [internalExpanded, setInternalExpanded] = useState<boolean>(true);
  const isExpanded = propIsExpanded !== undefined ? propIsExpanded : internalExpanded;
  const handleToggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  const [showTrades, setShowTrades] = useState<boolean>(true);
  const [showAvgCost, setShowAvgCost] = useState<boolean>(true);
  const [showCardDividersLocal, setShowCardDividersLocal] = useState<boolean>(false);
  const showCardDividers = propShowCardDividers !== undefined ? propShowCardDividers : showCardDividersLocal;
  const handleToggleCardDividers = () => {
    if (onToggleCardDividers) {
      onToggleCardDividers();
    } else {
      setShowCardDividersLocal((prev) => !prev);
    }
  };

  // 行權價開關狀態 (預設關閉，點擊後才開啟黑色垂直虛線、合約金額與當前損益)
  const [showStrikePricesLocal, setShowStrikePricesLocal] = useState<boolean>(false);
  const showStrikePrices = propShowStrikePrices !== undefined ? propShowStrikePrices : showStrikePricesLocal;
  const handleToggleStrikePrices = () => {
    if (onToggleStrikePrices) {
      onToggleStrikePrices();
    } else {
      setShowStrikePricesLocal((prev) => !prev);
    }
  };

  // 模擬預購單 (#00F5E2) 開關狀態 (預設開啟，繪製於軸下方如同目前價格與平均成本)
  const [showPreOrdersLocal, setShowPreOrdersLocal] = useState<boolean>(true);
  const showPreOrders = propShowPreOrders !== undefined ? propShowPreOrders : showPreOrdersLocal;
  const handleTogglePreOrders = () => {
    if (onTogglePreOrders) {
      onTogglePreOrders();
    } else {
      setShowPreOrdersLocal((prev) => !prev);
    }
  };

  // 即時連動與讀取該標的之模擬預購單
  const [preOrdersSyncTick, setPreOrdersSyncTick] = useState(0);
  const [isLocalPreOrderModalOpen, setIsLocalPreOrderModalOpen] = useState(false);
  const [localPreOrderPrice, setLocalPreOrderPrice] = useState('');
  const [localPreOrderQty, setLocalPreOrderQty] = useState('100');
  const [localPreOrderNotes, setLocalPreOrderNotes] = useState('');

  useEffect(() => {
    const update = () => {
      setPreOrdersSyncTick((t) => t + 1);
    };
    window.addEventListener('simulated-preorders-updated', update);
    return () => window.removeEventListener('simulated-preorders-updated', update);
  }, []);

  const effectivePreOrders = useMemo(() => {
    void preOrdersSyncTick;
    if (symbol) {
      return mergeAndSyncPreOrders(symbol, propPreOrders);
    }
    const list = propPreOrders || [];
    const map = new Map<string, any>();
    list.forEach((po: any, idx) => {
      if (!po || po.price === undefined || isNaN(Number(po.price)) || Number(po.price) <= 0) return;
      const key = String(po.id || `pre-${po.price}-${idx}`);
      map.set(key, {
        id: key,
        price: Number(po.price),
        quantity: Number(po.quantity) || 0,
        direction: po.direction || 'BUY',
        notes: po.notes || '',
      });
    });
    return Array.from(map.values()).sort((a, b) => b.price - a.price);
  }, [propPreOrders, symbol, preOrdersSyncTick]);

  const handleOpenPreOrderManager = () => {
    if (onAddPreOrder) {
      onAddPreOrder();
      return;
    }
    if (currentPrice > 0 && !localPreOrderPrice) {
      setLocalPreOrderPrice((currentPrice * 0.97).toFixed(2));
    }
    setIsLocalPreOrderModalOpen(true);
  };

  const handleLocalAddPreOrder = () => {
    if (!symbol) return;
    const p = parseFloat(localPreOrderPrice);
    if (isNaN(p) || p <= 0) return;
    const q = parseInt(localPreOrderQty) || 100;
    addSimulatedPreOrder(symbol, {
      price: p,
      quantity: q,
      direction: 'BUY',
      notes: localPreOrderNotes ? `[模擬預購單] ${localPreOrderNotes}` : '[模擬預購單]',
    });
    setLocalPreOrderPrice('');
    setLocalPreOrderNotes('');
    setPreOrdersSyncTick((t) => t + 1);
  };

  const handleLocalDeletePreOrder = (orderId: string, price?: number) => {
    if (!symbol) return;
    deleteSimulatedPreOrder(symbol, orderId, price);
    setPreOrdersSyncTick((t) => t + 1);
  };

  // 關鍵防線四種類別獨立複選狀態 (支撐、止損、壓力、止盈)
  // 預設只顯示「支撐」，止損、壓力、止盈預設為 false，可由用戶點擊選單隨時複選啟用
  const [selectedLevelTypesLocal, setSelectedLevelTypesLocal] = useState<{
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
  const selectedLevelTypes = propSelectedLevelTypes !== undefined ? propSelectedLevelTypes : selectedLevelTypesLocal;

  const [isLevelsDropdownOpen, setIsLevelsDropdownOpen] = useState<boolean>(false);
  const levelsDropdownRef = useRef<HTMLDivElement>(null);

  // 快捷鍵 Alt + D (卡片分隔線), Alt + R (支撐), Alt + P (壓力) 獨立監聽 (若非外部完全控制)
  useEffect(() => {
    if (propSelectedLevelTypes !== undefined && propShowCardDividers !== undefined) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.getAttribute('contenteditable') === 'true';
      if (isInput) return;

      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === 'D' || e.key === 'd' || e.code === 'KeyD')
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleToggleCardDividers();
        return;
      }

      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === 'R' || e.key === 'r' || e.code === 'KeyR')
      ) {
        e.preventDefault();
        e.stopPropagation();
        toggleLevelType('support');
        return;
      }

      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === 'P' || e.key === 'p' || e.code === 'KeyP')
      ) {
        e.preventDefault();
        e.stopPropagation();
        toggleLevelType('resistance');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [propSelectedLevelTypes, propShowCardDividers]);

  // 點擊下拉選單外部自動收合
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (levelsDropdownRef.current && !levelsDropdownRef.current.contains(event.target as Node)) {
        setIsLevelsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [yAxisMode, setYAxisMode] = useState<'shares' | 'percent'>('shares');
  const [hoveredItem, setHoveredItem] = useState<{
    type: 'step' | 'trade' | 'visualLevel' | 'avgCost' | 'currentPrice' | 'optionTrade' | 'simulatedPreOrder';
    data: any;
  } | null>(null);
  const lastHoverKeyRef = useRef<string>('');
  const [selectedItem, setSelectedItem] = useState<{
    type: 'step' | 'trade' | 'visualLevel' | 'avgCost' | 'currentPrice' | 'optionTrade' | 'simulatedPreOrder';
    data: any;
  } | null>(null);
  const [showAllSplits, setShowAllSplits] = useState<boolean>(false);

  // Normalize numeric values safely
  const currentPriceNum = useMemo(() => {
    return typeof currentPrice === 'number' ? currentPrice : parseFloat(String(currentPrice)) || 0;
  }, [currentPrice]);

  const holdingAvgPriceNum = useMemo(() => {
    return typeof holdingAvgPrice === 'number' ? holdingAvgPrice : parseFloat(String(holdingAvgPrice)) || 0;
  }, [holdingAvgPrice]);

  // 依切換模式決定階梯配置:
  // 突破加碼: 向上突破試算 (系統一 2% 階梯遞增: +2%, +4%, +6%, +8%)
  // 分批攤平: 向下攤平試算 (系統二 3% 階梯遞減: -3%, -6%, -9%, -12%)
  const stepConfigs = useMemo(
    () => calcMode === 'breakout' ? [
      { index: 0, label: '加碼#1', addPct: 2, percent: 15, name: '第一批 (+2%)', subtitle: '初期試探', isBreakout: true },
      { index: 1, label: '加碼#2', addPct: 4, percent: 25, name: '第二批 (+4%)', subtitle: '突破加碼', isBreakout: true },
      { index: 2, label: '加碼#3', addPct: 6, percent: 35, name: '第三批 (+6%)', subtitle: '強勢加碼', isBreakout: true },
      { index: 3, label: '加碼#4', addPct: 8, percent: 25, name: '第四批 (+8%)', subtitle: '目標達標', isBreakout: true },
    ] : [
      { index: 0, label: '第1批', dropPct: 3, percent: 15, name: '第一批 (15%)', subtitle: '初期試探' },
      { index: 1, label: '第2批', dropPct: 6, percent: 25, name: '第二批 (25%)', subtitle: '基準倉位' },
      { index: 2, label: '第3批', dropPct: 9, percent: 35, name: '第三批 (35%)', subtitle: '防守加碼' },
      { index: 3, label: '第4批', dropPct: 12, percent: 25, name: '第四批 (25%)', subtitle: '強制平倉防線' },
    ],
    [calcMode]
  );

  // 計算有效持有股數 (優先取 holdingQty，次取 trades 計算之淨買入股數，再取 batch 中的已購買總和，與 averagingRowsSys2 已購合計)
  const effectiveHoldingShares = useMemo(() => {
    const numHolding = typeof holdingQty === 'number' ? holdingQty : parseFloat(String(holdingQty)) || 0;
    const netTradeShares = (trades || []).reduce((sum, t) => {
      if (t?.isOptionTrade) return sum;
      const q = typeof t.quantity === 'number' ? t.quantity : parseFloat(String(t.quantity)) || 0;
      if (t.type === 'BUY') return sum + q;
      if (t.type === 'SELL') return sum - q;
      return sum;
    }, 0);
    const propBatchesBought = (batches || []).reduce((acc, b) => acc + (b?.bought || 0), 0);
    const activeRows = calcMode === 'breakout' ? (pyramidRows || averagingRowsSys2) : averagingRowsSys2;
    const checkedRowsBought = (activeRows || []).reduce((sum, r) => {
      if (!r?.bought) return sum;
      const q1 = r?.quantity ? parseFloat(r.quantity) : 0;
      const q2 = r?.quantity2 ? parseFloat(r.quantity2) : 0;
      return sum + (q1 + q2 > 0 ? q1 + q2 : 0);
    }, 0);
    return Math.max(0, numHolding, netTradeShares, propBatchesBought, checkedRowsBought);
  }, [holdingQty, trades, batches, averagingRowsSys2, pyramidRows, calcMode]);

  // Filter & sort past stock trades (exclude option purchase records so options ONLY display as black dashed lines)
  const validTrades = useMemo(() => {
    return (trades || [])
      .filter((t) => !t?.isOptionTrade && typeof t.price === 'number' && t.price > 0 && typeof t.quantity === 'number' && t.quantity > 0)
      .map((t) => ({
        ...t,
        dateFormatted: formatTimestamp(t.tradeDate, 'yyyy-MM-dd') || '未知日期',
      }));
  }, [trades]);

  // Compute calculated values for each pyramid step
  const stepItems = useMemo(() => {
    const baseRef = currentPrice > 0 ? currentPrice : (holdingAvgPrice > 0 ? holdingAvgPrice : 100);
    const activeRows = calcMode === 'breakout' ? (pyramidRows || averagingRowsSys2) : averagingRowsSys2;

    // 若尚未提供 plannedQty，但已有 batches prop，優先使用 batches 中的總預購股數
    const propPlannedTotal = (batches || []).reduce((sum, b) => sum + (Number(b?.size) || 0), 0);
    let effPlannedQty = plannedQty && plannedQty > 0
      ? plannedQty
      : (propPlannedTotal > 0 ? propPlannedTotal : 0);

    if (effPlannedQty <= 0 && activeRows && activeRows.length > 0) {
      const sumRows = activeRows.reduce((acc, r) => {
        const q1 = r?.quantity ? parseFloat(r.quantity) : 0;
        const q2 = r?.quantity2 ? parseFloat(r.quantity2) : 0;
        return acc + q1 + q2;
      }, 0);
      if (sumRows > 0) effPlannedQty = sumRows;
    }
    const buyTradesTotal = (validTrades || []).filter((t: any) => t.type === 'BUY').reduce((acc: number, t: any) => acc + (Number(t.quantity) || 0), 0);
    const benchmarkHolding = Math.max(effectiveHoldingShares, buyTradesTotal);
    if (effPlannedQty <= 0 && benchmarkHolding > 0) {
      effPlannedQty = Math.max(benchmarkHolding, Math.ceil(benchmarkHolding / 0.15));
    }

    // 使用集中化 calculations 模組計算四批次規劃與已購數量，確保各元件數值完全一致
    const planResult = calculateBatchPlanning({
      plannedQty: effPlannedQty,
      usableCapital,
      currentPrice: currentPriceNum,
      holdingQty: effectiveHoldingShares,
      trades,
      averagingRowsSys2: activeRows,
      plannedBuyQty: effPlannedQty,
    });

    return stepConfigs.map((cfg) => {
      const row = activeRows?.[cfg.index];
      const batch = batches?.[cfg.index];
      const planBatch = planResult?.batches?.[cfg.index];
      const safePlanBatch = {
        name: planBatch?.name || cfg.name,
        size: typeof planBatch?.size === 'number' ? planBatch.size : 0,
        bought: typeof planBatch?.bought === 'number' ? planBatch.bought : 0,
        remaining: typeof planBatch?.remaining === 'number' ? planBatch.remaining : 0,
        split1: {
          name: planBatch?.split1?.name || `${cfg.name} 拆分 1`,
          shortLabel: planBatch?.split1?.shortLabel || '拆分 1',
          size: typeof planBatch?.split1?.size === 'number' ? planBatch.split1.size : 0,
          bought: typeof planBatch?.split1?.bought === 'number' ? planBatch.split1.bought : 0,
          remaining: typeof planBatch?.split1?.remaining === 'number' ? planBatch.split1.remaining : 0,
          percent: planBatch?.split1?.percent || '7%',
        },
        split2: {
          name: planBatch?.split2?.name || `${cfg.name} 拆分 2`,
          shortLabel: planBatch?.split2?.shortLabel || '拆分 2',
          size: typeof planBatch?.split2?.size === 'number' ? planBatch.split2.size : 0,
          bought: typeof planBatch?.split2?.bought === 'number' ? planBatch.split2.bought : 0,
          remaining: typeof planBatch?.split2?.remaining === 'number' ? planBatch.split2.remaining : 0,
          percent: planBatch?.split2?.percent || '8%',
        },
      };

      // Step price: user manual input or formula from current price
      const manualPrice = row?.price ? parseFloat(row.price) : 0;
      let stepPrice = 0;
      if (manualPrice > 0) {
        stepPrice = manualPrice;
      } else if (calcMode === 'breakout') {
        stepPrice = Math.round(baseRef * (1 + ((cfg as any).addPct || (cfg.index + 1) * 2) / 100) * 100) / 100;
      } else {
        stepPrice = Math.round(baseRef * (1 - ((cfg as any).dropPct || (cfg.index + 1) * 3) / 100) * 100) / 100;
      }

      // 優先完全參照傳入之 batch prop（若已由個股頁面或模態視窗集中計算提供，直接採用權威數據）
      const hasPropBatch = Boolean(batch && typeof batch.size === 'number' && batch.size > 0);
      const targetQty = hasPropBatch
        ? batch!.size
        : (safePlanBatch.size > 0 ? safePlanBatch.size : (safePlanBatch.split1.size + safePlanBatch.split2.size));

      const boughtQty = hasPropBatch && batch!.bought !== undefined
        ? batch!.bought
        : safePlanBatch.bought;

      const remainingQty = hasPropBatch && batch!.remaining !== undefined
        ? batch!.remaining
        : Math.max(0, targetQty - boughtQty);

      const isReached = calcMode === 'breakout'
        ? ((currentPrice > 0 && currentPrice >= stepPrice) || (targetQty > 0 && boughtQty >= targetQty) || boughtQty > 0 || Boolean(row?.bought))
        : ((currentPrice > 0 && currentPrice <= stepPrice) || (targetQty > 0 && boughtQty >= targetQty) || boughtQty > 0 || Boolean(row?.bought));

      const stepCost = stepPrice * (targetQty > 0 ? targetQty : boughtQty);

      const split1 = (hasPropBatch && batch!.split1) ? {
        name: batch!.split1.name || safePlanBatch.split1.name,
        shortLabel: batch!.split1.shortLabel || safePlanBatch.split1.shortLabel,
        percent: batch!.split1.percent || safePlanBatch.split1.percent,
        size: batch!.split1.size,
        bought: batch!.split1.bought,
        remaining: batch!.split1.remaining,
      } : safePlanBatch.split1;

      const split2 = (hasPropBatch && batch!.split2) ? {
        name: batch!.split2.name || safePlanBatch.split2.name,
        shortLabel: batch!.split2.shortLabel || safePlanBatch.split2.shortLabel,
        percent: batch!.split2.percent || safePlanBatch.split2.percent,
        size: batch!.split2.size,
        bought: batch!.split2.bought,
        remaining: batch!.split2.remaining,
      } : safePlanBatch.split2;

      return {
        ...cfg,
        dropPct: (cfg as any).dropPct,
        addPct: (cfg as any).addPct,
        price: stepPrice,
        size: targetQty,
        bought: boughtQty,
        remaining: remainingQty,
        isReached,
        stepCost,
        split1,
        split2,
      };
    });
  }, [stepConfigs, averagingRowsSys2, pyramidRows, calcMode, batches, currentPrice, currentPriceNum, holdingAvgPrice, plannedQty, effectiveHoldingShares, trades, validTrades, usableCapital]);

  // 期權購買紀錄：優先讀取交易紀錄中的期權部位 (isOptionTrade)，若無則讀取已儲存之期權計算器紀錄 (optionsCalcData)
  // 在金字塔圖表上只顯示黑色虛線，上方標籤依序為：行權價 -> 正上方顯示合約金額 (×100股) -> 正上方顯示當前損益金額
  const optionPurchaseRecords = useMemo(() => {
    const rawOptionTrades = (trades || []).filter((t) => Boolean(t && t.isOptionTrade));
    if (rawOptionTrades.length > 0) {
      return rawOptionTrades
        .map((t, idx) => {
          const metrics = calculateLiveOptionTradeMetrics(t, currentPriceNum);
          return {
            id: t.id || `opt-trade-${idx}`,
            rawTrade: t,
            ...metrics,
            dateFormatted: t.purchaseDate
              ? String(t.purchaseDate).replace(/-/g, '/')
              : formatTimestamp(t.tradeDate, 'yyyy-MM-dd') || '未知日期',
          };
        })
        .filter((item) => item.strikePrice > 0 && isFinite(item.strikePrice));
    }

    if (
      optionsCalcData &&
      optionsCalcData.strikePrice &&
      Number(optionsCalcData.strikePrice) > 0 &&
      optionsCalcData.entryOptionPrice
    ) {
      const metrics = calculateLiveOptionTradeMetrics(optionsCalcData, currentPriceNum);
      if (metrics.strikePrice > 0 && isFinite(metrics.strikePrice)) {
        return [
          {
            id: 'opt-saved-calc',
            rawTrade: optionsCalcData,
            ...metrics,
            dateFormatted: optionsCalcData.purchaseDate
              ? String(optionsCalcData.purchaseDate).replace(/-/g, '/')
              : '已儲存期權紀錄',
          },
        ];
      }
    }

    return [];
  }, [trades, optionsCalcData, currentPriceNum]);

  const buyTrades = useMemo(() => validTrades.filter((t) => t.type === 'BUY'), [validTrades]);
  const sellTrades = useMemo(() => validTrades.filter((t) => t.type === 'SELL'), [validTrades]);

  const totalPlannedShares = useMemo(() => stepItems.reduce((acc, s) => acc + s.size, 0), [stepItems]);
  const totalBoughtShares = useMemo(() => {
    const sumStepBought = stepItems.reduce((acc, s) => acc + s.bought, 0);
    return effectiveHoldingShares > 0 ? Math.min(sumStepBought, effectiveHoldingShares) : sumStepBought;
  }, [stepItems, effectiveHoldingShares]);
  const totalTradesCount = validTrades.length + optionPurchaseRecords.length;

  // 視覺關鍵防線（琥珀黃:支撐、警示紅:止損、玫瑰粉:壓力、翡翠綠:止盈）
  // 優先採用用戶/策略自訂防線；若未設定任何或部分防線，則智慧補充預設參考防線，保證按鈕打開時完整視覺化呈現
  const effectiveVisualLevels = useMemo<VisualPriceLevel[]>(() => {
    const list: VisualPriceLevel[] = [];
    const hasType = (t: string) => (visualLevels || []).some((l) => l.type === t);

    // 1. 先加入所有已設定的自訂防線
    if (visualLevels && visualLevels.length > 0) {
      visualLevels.forEach((vl) => {
        const p = typeof vl.price === 'number' ? vl.price : parseFloat(String(vl.price));
        if (!isNaN(p) && p > 0) {
          list.push({
            ...vl,
            price: p,
          });
        }
      });
    }

    // 2. 如果關鍵防線尚未由用戶設定，且有目前價格，依據經典交易比例自動提供參考防線，讓圖表虛線與圖例百分之百呈現
    if (currentPriceNum > 0) {
      if (!hasType('support')) {
        list.push({
          id: 'auto-support',
          type: 'support',
          label: '支撐',
          price: Math.round(currentPriceNum * 0.95 * 100) / 100,
          color: '#d97706', // 琥珀黃
          note: '系統參考支撐 (-5%)',
        });
      }
      if (!hasType('stopLoss')) {
        list.push({
          id: 'auto-stoploss',
          type: 'stopLoss',
          label: '止損',
          price: Math.round(currentPriceNum * 0.92 * 100) / 100,
          color: '#dc2626', // 警示紅
          note: '系統參考止損 (-8%)',
        });
      }
      if (!hasType('resistance')) {
        list.push({
          id: 'auto-resistance',
          type: 'resistance',
          label: '壓力',
          price: Math.round(currentPriceNum * 1.05 * 100) / 100,
          color: '#e11d48', // 玫瑰粉
          note: '系統參考壓力 (+5%)',
        });
      }
      if (!hasType('takeProfit')) {
        list.push({
          id: 'auto-takeprofit',
          type: 'takeProfit',
          label: '止盈',
          price: Math.round(currentPriceNum * 1.12 * 100) / 100,
          color: '#059669', // 翡翠綠
          note: '系統參考止盈 (+12%)',
        });
      }
    }

    return list.sort((a, b) => a.price - b.price);
  }, [visualLevels, currentPriceNum]);

  // 關鍵防線四種型別設定 (支撐、止損、壓力、止盈)
  const LEVEL_TYPE_CONFIGS = useMemo(
    () => [
      { type: 'support' as const, label: '支撐', shortcut: 'Alt+R', color: '#d97706', textColor: 'text-amber-700' },
      { type: 'stopLoss' as const, label: '止損', shortcut: '', color: '#dc2626', textColor: 'text-red-700' },
      { type: 'resistance' as const, label: '壓力', shortcut: 'Alt+P', color: '#e11d48', textColor: 'text-rose-700' },
      { type: 'takeProfit' as const, label: '止盈', shortcut: '', color: '#059669', textColor: 'text-emerald-700' },
    ],
    []
  );

  // 各類別防線檔數統計
  const countByType = useMemo(() => {
    const counts: Record<string, number> = {
      support: 0,
      stopLoss: 0,
      resistance: 0,
      takeProfit: 0,
    };
    effectiveVisualLevels.forEach((vl) => {
      if (counts[vl.type] !== undefined) {
        counts[vl.type]++;
      }
    });
    return counts;
  }, [effectiveVisualLevels]);

  // 數據圖示化卡片的分隔線 (同步顯示)
  const cardDividers = useMemo<VisualPriceLevel[]>(() => {
    return effectiveVisualLevels.filter((lvl) => lvl.type === 'divider' || lvl.isCardDivider);
  }, [effectiveVisualLevels]);

  // 實際依據下拉複選狀態與卡片分隔線開關過濾後欲呈現的關鍵防線
  const displayedVisualLevels = useMemo(() => {
    return effectiveVisualLevels.filter((lvl) => {
      if (lvl.type === 'divider' || lvl.isCardDivider) {
        return showCardDividers;
      }
      return selectedLevelTypes[lvl.type as keyof typeof selectedLevelTypes];
    });
  }, [effectiveVisualLevels, selectedLevelTypes, showCardDividers]);

  const activeTypesCount = useMemo(() => {
    return Object.values(selectedLevelTypes).filter(Boolean).length;
  }, [selectedLevelTypes]);

  const isAllLevelsSelected = useMemo(() => {
    return activeTypesCount === LEVEL_TYPE_CONFIGS.length;
  }, [activeTypesCount, LEVEL_TYPE_CONFIGS.length]);

  // 下拉按鈕動態文字
  const levelsButtonLabel = useMemo(() => {
    const activeLabels = LEVEL_TYPE_CONFIGS
      .filter((cfg) => selectedLevelTypes[cfg.type])
      .map((cfg) => cfg.label);

    if (activeLabels.length === 0) {
      return '關鍵防線 (未勾選 · 0 檔)';
    }
    if (activeLabels.length === LEVEL_TYPE_CONFIGS.length) {
      return `關鍵防線 (支撐/止損/壓力/止盈) (${displayedVisualLevels.length} 檔)`;
    }
    return `關鍵防線 (${activeLabels.join('/')}) (${displayedVisualLevels.length} 檔)`;
  }, [selectedLevelTypes, displayedVisualLevels.length, LEVEL_TYPE_CONFIGS]);

  const toggleLevelType = (type: 'support' | 'stopLoss' | 'resistance' | 'takeProfit') => {
    if (onToggleLevelType) {
      onToggleLevelType(type);
    } else {
      setSelectedLevelTypesLocal((prev) => ({
        ...prev,
        [type]: !prev[type],
      }));
    }
  };

  const selectAllLevelTypes = () => {
    if (onSelectAllLevelTypes) {
      onSelectAllLevelTypes();
    } else {
      setSelectedLevelTypesLocal({
        support: true,
        stopLoss: true,
        resistance: true,
        takeProfit: true,
      });
    }
  };

  const deselectAllLevelTypes = () => {
    if (onDeselectAllLevelTypes) {
      onDeselectAllLevelTypes();
    } else {
      setSelectedLevelTypesLocal({
        support: false,
        stopLoss: false,
        resistance: false,
        takeProfit: false,
      });
    }
  };

  // Compute X-axis boundaries (including currentPrice, holdingAvgPrice, step prices, trade prices, and displayed visual levels)
  const { minX, maxX } = useMemo(() => {
    const allPrices: number[] = [];
    if (currentPriceNum > 0) allPrices.push(currentPriceNum);
    if (showAvgCost && holdingAvgPriceNum > 0) allPrices.push(holdingAvgPriceNum);
    stepItems.forEach((s) => allPrices.push(s.price));
    if (showTrades) {
      validTrades.forEach((t) => allPrices.push(t.price));
    }
    if (showStrikePrices && optionPurchaseRecords && optionPurchaseRecords.length > 0) {
      optionPurchaseRecords.forEach((opt) => {
        if (opt.strikePrice > 0 && isFinite(opt.strikePrice)) {
          allPrices.push(opt.strikePrice);
        }
      });
    }
    if (displayedVisualLevels.length > 0) {
      displayedVisualLevels.forEach((vl) => {
        const p = typeof vl.price === 'number' ? vl.price : parseFloat(String(vl.price));
        if (!isNaN(p) && p > 0 && isFinite(p)) {
          allPrices.push(p);
        }
      });
    }
    if (showPreOrders && effectivePreOrders && effectivePreOrders.length > 0) {
      effectivePreOrders.forEach((po) => {
        const p = typeof po.price === 'number' ? po.price : parseFloat(String(po.price));
        if (!isNaN(p) && p > 0 && isFinite(p)) {
          allPrices.push(p);
        }
      });
    }

    if (allPrices.length === 0) return { minX: 60, maxX: 100 };
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    const safeMin = isFinite(min) ? min : 60;
    const safeMax = isFinite(max) ? max : 100;
    const span = safeMax - safeMin || 10;
    // 當啟用行權價顯示時，適度優化左右邊界比例，預留充足空間防止多行標籤貼邊
    const padding = isAllLevelsSelected
      ? span * 0.09 + 1.2
      : showStrikePrices && optionPurchaseRecords.length > 0
      ? span * 0.13 + 1.8
      : span * 0.12 + 1.5;
    const calculatedMin = Math.max(0, Math.floor((safeMin - padding) * 10) / 10);
    const calculatedMax = Math.max(calculatedMin + 2, Math.ceil((safeMax + padding) * 10) / 10);

    return {
      minX: calculatedMin,
      maxX: calculatedMax,
    };
  }, [currentPriceNum, holdingAvgPriceNum, showAvgCost, stepItems, validTrades, optionPurchaseRecords, showTrades, showStrikePrices, showPreOrders, effectivePreOrders, displayedVisualLevels, isAllLevelsSelected]);

  // Sorted step items by price ascending
  const sortedStepItems = useMemo(() => {
    return [...stepItems].sort((a, b) => a.price - b.price);
  }, [stepItems]);

  const maxYValue = useMemo(() => {
    let maxVal = 0;
    stepItems.forEach((s) => {
      const val = yAxisMode === 'shares' ? s.size : s.percent;
      if (val > maxVal) maxVal = val;
      const bVal = yAxisMode === 'shares' ? Math.min(s.bought, s.size * 1.5) : (s.size > 0 ? (s.bought / s.size) * s.percent : 0);
      if (bVal > maxVal) maxVal = bVal;
    });
    if (showTrades && yAxisMode === 'shares') {
      const maxStepVal = maxVal > 0 ? maxVal : 50;
      validTrades.forEach((t) => {
        // 限制過去交易單筆極端股數不拉爆 Y 軸上限，保持金字塔階梯圖形完整優雅
        const cappedQty = Math.min(t.quantity, maxStepVal * 1.35);
        if (cappedQty > maxVal) maxVal = cappedQty;
      });
    }
    return maxVal > 0 ? maxVal * 1.35 : 50; // give ample headroom for multi-line text annotations
  }, [stepItems, validTrades, showTrades, yAxisMode]);

  // Datasets for Chart.js
  const chartData: ChartData<'line'> = useMemo(() => {
    // 1. Pyramid steps planned dataset (connected points at target size)
    const stepPoints = sortedStepItems.map((s) => ({
      x: s.price,
      y: yAxisMode === 'shares' ? s.size : s.percent,
    }));

    const datasets: any[] = [
      {
        type: 'line' as const,
        label: `各批次攤平曲線 (預購目標: ${totalPlannedShares} 股)`,
        data: stepPoints,
        showLine: true,
        borderColor: '#94a3b8', // slate-400
        borderWidth: 2.2,
        borderDash: [5, 4],
        tension: 0.12,
        pointRadius: 8,
        pointHoverRadius: 12,
        pointHitRadius: 25,
        pointBackgroundColor: sortedStepItems.map((s) =>
          s.bought >= s.size && s.size > 0
            ? '#059669' // dark green fully bought
            : s.bought > 0
            ? '#10b981' // emerald green partially bought
            : s.isReached
            ? '#34d399' // mint green price reached
            : '#ffffff'
        ),
        pointBorderColor: sortedStepItems.map((s) =>
          s.bought > 0 ? '#047857' : s.isReached ? '#059669' : '#64748b'
        ),
        pointBorderWidth: 2.5,
        order: 1,
      },
    ];

    // 3. Past BUY trades (平時只顯示藍點，滑鼠懸停時顯示價格標籤)
    if (showTrades && buyTrades.length > 0) {
      datasets.push({
        type: 'line' as const,
        label: `歷史買入交易 (${buyTrades.length} 筆)`,
        data: buyTrades.map((t) => ({
          x: t.price,
          y: yAxisMode === 'shares' ? Math.min(t.quantity, maxYValue * 0.8) : 15,
        })),
        showLine: false,
        pointStyle: 'circle' as const, // 圓形藍點
        pointRadius: 6.5,
        pointHoverRadius: 10,
        pointBackgroundColor: '#2563eb', // blue-600
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointHoverBackgroundColor: '#1d4ed8',
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2.5,
        order: 0,
      });
    }

    // 4. Past SELL trades (if any)
    if (showTrades && sellTrades.length > 0) {
      datasets.push({
        type: 'line' as const,
        label: `歷史賣出交易 (${sellTrades.length} 筆)`,
        data: sellTrades.map((t) => ({
          x: t.price,
          y: yAxisMode === 'shares' ? Math.min(t.quantity, maxYValue * 0.8) : 15,
        })),
        showLine: false,
        pointStyle: 'circle' as const,
        pointRadius: 6.5,
        pointHoverRadius: 10,
        pointBackgroundColor: '#ea580c', // orange-600
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointHoverBackgroundColor: '#c2410c',
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2.5,
        order: 0,
      });
    }

    return {
      datasets,
    };
  }, [sortedStepItems, yAxisMode, showTrades, buyTrades, sellTrades, displayedVisualLevels, totalPlannedShares, totalBoughtShares]);

  const chartRef = useRef<any>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartContainerHeight, setChartContainerHeight] = useState<number>(compact ? 285 : 390);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.round(entry.contentRect.height);
        if (h > 50) {
          setChartContainerHeight((prev) => (Math.abs(prev - h) > 3 ? h : prev));
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const renderedLinesRef = useRef<{ id: string; type: string; renderX: number; data: any }[]>([]);

  const drawDataRef = useRef({
    currentPriceNum,
    holdingAvgPriceNum,
    showAvgCost,
    displayedVisualLevels,
    stepItems,
    sortedStepItems,
    yAxisMode,
    showTrades,
    showStrikePrices,
    buyTrades,
    sellTrades,
    optionPurchaseRecords,
    isAllLevelsSelected,
    hoveredItem,
    showPreOrders,
    preOrders: effectivePreOrders,
  });

  drawDataRef.current = {
    currentPriceNum,
    holdingAvgPriceNum,
    showAvgCost,
    displayedVisualLevels,
    stepItems,
    sortedStepItems,
    yAxisMode,
    showTrades,
    showStrikePrices,
    buyTrades,
    sellTrades,
    optionPurchaseRecords,
    isAllLevelsSelected,
    hoveredItem,
    showPreOrders,
    preOrders: effectivePreOrders,
  };

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        try {
          chartRef.current.destroy?.();
        } catch {}
      }
    };
  }, []);

  useEffect(() => {
    if (chartRef.current && typeof chartRef.current.update === 'function') {
      try {
        chartRef.current.update('none');
      } catch {
        // Safe fallback if chart is mid-lifecycle
      }
    }
  }, [
    displayedVisualLevels,
    currentPriceNum,
    holdingAvgPriceNum,
    showAvgCost,
    yAxisMode,
    showTrades,
    showStrikePrices,
    buyTrades,
    sellTrades,
    optionPurchaseRecords,
    isAllLevelsSelected,
    showPreOrders,
    effectivePreOrders,
  ]);

  // Custom Chart.js annotation plugin:
  // 1. Vertical PURPLE dashed line & clean tag for currentPrice (top only, no obstructive bottom badge)
  // 2. Vertical ORANGE dashed line & clean tag for holdingAvgPrice (top only, no obstructive bottom badge)
  // 3. Vertical DASHED LINES & clean tags for visual levels (支撐/止損/壓力/止盈) with collision-avoiding placement
  // 4. Labels above each pyramid step: "$價格 -跌幅%" and "已購買 X / 預購入 Y 股"
  // 5. Historical trades: Direct price and shares tag labels directly on the canvas!
  const customAnnotationPlugin = useMemo<Plugin<'line'>>(() => {
    return {
      id: `pyramidAndCurrentPricePlugin_${symbol ? String(symbol).replace(/[^a-zA-Z0-9]/g, '_') : 'default'}`,
      afterDraw: (chart) => {
        try {
          const { ctx, chartArea, scales } = chart;
          const xScale = scales.x;
          const yScale = scales.y;

          if (!xScale || !yScale || !chartArea || chartArea.width <= 0 || chartArea.height <= 0) return;

        // Extract latest values from ref to completely eliminate stale closure issues
        const {
          currentPriceNum,
          holdingAvgPriceNum,
          showAvgCost,
          displayedVisualLevels,
          stepItems,
          sortedStepItems,
          yAxisMode,
          showTrades,
          showStrikePrices,
          buyTrades,
          sellTrades,
          optionPurchaseRecords,
          isAllLevelsSelected,
          showPreOrders,
          preOrders,
        } = drawDataRef.current;

        // Collect all active vertical dashed lines & their labels
        interface DashedLineConfig {
          id: string;
          type: string;
          xPos: number;
          price: number;
          fullText: string;
          extraLinesAbove?: { text: string; textColor: string }[];
          lineColor: string;
          textColor: string;
          priority: number;
          isTriggered: boolean;
          rawItem: any;
        }

        const lineConfigs: DashedLineConfig[] = [];

        // 1. Current price (目前價格) - 紫色虛線 (當前市價即時生效，觸發綠點)
        if (currentPriceNum > 0) {
          const xPos = xScale.getPixelForValue(currentPriceNum);
          if (xPos >= chartArea.left - 5 && xPos <= chartArea.right + 5) {
            lineConfigs.push({
              id: 'current-price',
              type: 'currentPrice',
              xPos,
              price: currentPriceNum,
              fullText: `目前價格 $${currentPriceNum.toFixed(2)}`,
              lineColor: '#9333ea', // purple-600
              textColor: '#7e22ce', // purple-700
              priority: 6,
              isTriggered: true,
              rawItem: { price: currentPriceNum, avgCost: holdingAvgPriceNum },
            });
          }
        }

        // 2. Holding average price (平均成本) - #EEABFF 虛線 (市價達到或高於成本價視為觸發回本)
        if (showAvgCost && holdingAvgPriceNum > 0) {
          const xPos = xScale.getPixelForValue(holdingAvgPriceNum);
          if (xPos >= chartArea.left - 5 && xPos <= chartArea.right + 5) {
            const isTriggered = currentPriceNum > 0 && currentPriceNum >= holdingAvgPriceNum;
            lineConfigs.push({
              id: 'avg-cost',
              type: 'avgCost',
              xPos,
              price: holdingAvgPriceNum,
              fullText: `平均成本 $${holdingAvgPriceNum.toFixed(2)}`,
              lineColor: '#EEABFF',
              textColor: '#EEABFF',
              priority: 5,
              isTriggered,
              rawItem: { price: holdingAvgPriceNum, quantity: holdingQty, currentPrice: currentPriceNum },
            });
          }
        }

        // 2.5 模擬預購單 (Simulated Pre-Orders) - #00F5E2 虛線與軸下方標籤 (呈現方式如同目前價格與平均成本)
        if (showPreOrders && preOrders && preOrders.length > 0) {
          preOrders.forEach((order, idx) => {
            const price = typeof order.price === 'number' ? order.price : parseFloat(String(order.price));
            if (isNaN(price) || price <= 0) return;
            const xPos = xScale.getPixelForValue(price);
            if (xPos >= chartArea.left - 5 && xPos <= chartArea.right + 5) {
              const isTriggered = currentPriceNum > 0 && (order.direction === 'SELL' ? currentPriceNum >= price : currentPriceNum <= price);
              const qtyLabel = order.quantity && order.quantity > 0 ? ` (${order.quantity}股)` : '';
              lineConfigs.push({
                id: `preorder-${order.id || idx}`,
                type: 'simulatedPreOrder',
                xPos,
                price,
                fullText: `模擬預購單 $${price.toFixed(2)}${qtyLabel}`,
                lineColor: '#00F5E2',
                textColor: '#008f84', // 深藍綠色提升明度反差，外圍有柔和光暈保護，搭配 #00F5E2 虛線
                priority: 4.8,
                isTriggered,
                rawItem: order,
              });
            }
          });
        }

        // 3. Visual levels (支撐 / 止損 / 壓力 / 止盈) - 彩色虛線 (依下拉複選型別分別顯示)
        if (displayedVisualLevels && displayedVisualLevels.length > 0) {
          displayedVisualLevels.forEach((lvl, idx) => {
            const price = typeof lvl.price === 'number' ? lvl.price : parseFloat(String(lvl.price));
            if (isNaN(price) || price <= 0) return;
            const xPos = xScale.getPixelForValue(price);
            if (xPos >= chartArea.left - 5 && xPos <= chartArea.right + 5) {
              let textColor = lvl.color;
              let priority = 1;
              let isTriggered = false;

              if (lvl.type === 'support') {
                textColor = '#b45309'; // amber-700
                priority = 1;
                // 支撐：市價跌至或破支撐價視為觸發
                isTriggered = currentPriceNum > 0 && currentPriceNum <= price;
              } else if (lvl.type === 'stopLoss') {
                textColor = '#b91c1c'; // red-700
                priority = 2;
                // 止損：市價跌破或達到止損價視為觸發
                isTriggered = currentPriceNum > 0 && currentPriceNum <= price;
              } else if (lvl.type === 'resistance') {
                textColor = '#be123c'; // rose-700
                priority = 3;
                // 壓力：市價漲至或突破壓力價視為觸發
                isTriggered = currentPriceNum > 0 && currentPriceNum >= price;
              } else if (lvl.type === 'takeProfit') {
                textColor = '#047857'; // emerald-700
                priority = 4;
                // 止盈：市價漲至或達到止盈目標價視為觸發
                isTriggered = currentPriceNum > 0 && currentPriceNum >= price;
              } else if (lvl.type === 'divider' || lvl.isCardDivider) {
                textColor = lvl.color || '#4f46e5'; // indigo-600
                priority = 0;
                isTriggered = currentPriceNum > 0 && Math.abs(currentPriceNum - price) / price < 0.01;
              }

              lineConfigs.push({
                id: `lvl-${lvl.id || idx}`,
                type: lvl.type,
                xPos,
                price,
                fullText: `${lvl.label} $${price.toFixed(2)}`,
                lineColor: lvl.color,
                textColor,
                priority,
                isTriggered,
                rawItem: lvl,
              });
            }
          });
        }

        // 4. 期權購買紀錄 - 只需要顯示黑色虛線，上面標籤是交易的行權價，正上方顯示合約金額 (×100股)，在其合約價格正上方也顯示當前損益金額
        if (showStrikePrices && optionPurchaseRecords && optionPurchaseRecords.length > 0) {
          optionPurchaseRecords.forEach((opt, idx) => {
            const strikePrice = Number(opt.strikePrice);
            if (isNaN(strikePrice) || strikePrice <= 0) return;
            const xPos = xScale.getPixelForValue(strikePrice);
            if (xPos >= chartArea.left - 5 && xPos <= chartArea.right + 5) {
              const isTriggered =
                currentPriceNum > 0 &&
                (opt.optionType === 'put' ? currentPriceNum <= strikePrice : currentPriceNum >= strikePrice);
              const pnlSign = opt.currentPnL >= 0 ? '+' : '-';
              const pnlText = `當前損益 ${pnlSign}$${Math.abs(opt.currentPnL).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`;
              const contractText = `合約金額 (×100股) $${opt.contractAmount.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}`;
              const strikeText = `行權價 $${strikePrice.toFixed(2)}`;

              lineConfigs.push({
                id: `opt-${opt.id || idx}`,
                type: 'optionTrade',
                xPos,
                price: strikePrice,
                fullText: strikeText,
                extraLinesAbove: [
                  {
                    text: contractText,
                    textColor: '#09090b', // 合約金額 (×100股) 在行權價正上方
                  },
                  {
                    text: pnlText,
                    textColor: opt.currentPnL > 0 ? '#047857' : opt.currentPnL < 0 ? '#b91c1c' : '#09090b', // 當前損益金額 在合約價格正上方
                  },
                ],
                lineColor: '#09090b', // 黑色虛線
                textColor: '#09090b', // 黑色標籤
                priority: -1, // 優先配置於該價位虛線正上方最底層基準，使三層標籤緊貼黑色虛線正上方
                isTriggered,
                rawItem: opt,
              });
            }
          });
        }

        // Sort items by price ascending; if identical price, sort by priority
        lineConfigs.sort((a, b) => {
          if (Math.abs(a.price - b.price) > 0.001) {
            return a.price - b.price;
          }
          return a.priority - b.priority;
        });

        // 4. 若是關鍵防線全選狀態，調整虛線之間距離的比例，避免視覺太過壅擠
        const renderXList = lineConfigs.map((item) => item.xPos);
        if (isAllLevelsSelected && lineConfigs.length > 1) {
          const chartWidth = chartArea.right - chartArea.left;
          // 動態計算舒適的最小間距 (30px ~ 40px)
          const minGap = Math.min(40, Math.max(26, (chartWidth - 50) / (lineConfigs.length + 1)));
          const minBound = chartArea.left + 16;
          const maxBound = chartArea.right - 16;

          // 進行多輪比例舒緩與間距調整
          for (let iter = 0; iter < 15; iter++) {
            for (let i = 0; i < renderXList.length - 1; i++) {
              const gap = renderXList[i + 1] - renderXList[i];
              if (gap < minGap) {
                const push = (minGap - gap) / 2;
                renderXList[i] -= push;
                renderXList[i + 1] += push;
              }
            }
            // 邊界保護防止超出圖表畫布
            if (renderXList[0] < minBound) {
              const shift = minBound - renderXList[0];
              for (let i = 0; i < renderXList.length; i++) renderXList[i] += shift;
            }
            if (renderXList[renderXList.length - 1] > maxBound) {
              const shift = renderXList[renderXList.length - 1] - maxBound;
              for (let i = 0; i < renderXList.length; i++) renderXList[i] -= shift;
            }
          }
        }

        // Calculate upward-stacked positions for all labels
        // 統一在各自虛線正上方顯示；若太近則往上重疊堆疊顯示
        interface PlacedTag {
          x: number;
          width: number;
          y: number;
        }
        const placedTags: PlacedTag[] = [];

        ctx.font = 'bold 10px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

        const multiLineGap = 13;
        const positionedItems = lineConfigs.map((item, idx) => {
          const renderX = renderXList[idx];
          const extraLines = item.extraLinesAbove || [];
          const allTexts = [item.fullText, ...extraLines.map((l) => l.text)];
          const textWidth = Math.max(...allTexts.map((t) => ctx.measureText(t).width));
          const safeX = Math.max(
            chartArea.left + textWidth / 2 + 4,
            Math.min(chartArea.right - textWidth / 2 - 4, renderX)
          );

          // 第一層 (Layer 0) 位於 X 軸下方 (虛線加長向下延伸至標籤)
          const baseY = chartArea.bottom + 48;
          const rowStep = 18;
          const totalRows = 1 + extraLines.length;
          let currentY = baseY;
          let hasOverlap = true;
          let safety = 0;

          // 下方區自動避讓：若相鄰價位線標籤太近，則往下遞增堆疊排開 (currentY 往下遞增)，每一層均做碰撞檢測
          while (hasOverlap && safety < 10) {
            hasOverlap = false;
            for (let r = 0; r < totalRows; r++) {
              const checkY = currentY + r * multiLineGap;
              const rowCollision = placedTags.some((placed) => {
                const yOverlap = Math.abs(placed.y - checkY) < 13;
                const xOverlap = Math.abs(placed.x - safeX) < (placed.width + textWidth) / 2 + 6;
                return yOverlap && xOverlap;
              });
              if (rowCollision) {
                hasOverlap = true;
                break;
              }
            }

            if (hasOverlap) {
              currentY += rowStep; // 往下避讓移動一層
            }
            safety++;
          }

          for (let r = 0; r < totalRows; r++) {
            placedTags.push({ x: safeX, width: textWidth, y: currentY + r * multiLineGap });
          }

          return {
            ...item,
            renderX,
            safeX,
            tagY: currentY,
            textWidth,
          };
        });

        // 更新全域 renderedLinesRef 供游標準確 hover 判定
        renderedLinesRef.current = positionedItems.map((item) => ({
          id: item.id,
          type: item.type,
          renderX: item.renderX,
          data: item.rawItem,
        }));

        // 繪製各價位線 (虛線移到 X 軸下方，由 X 軸向下延伸連到標籤，尾部帶無填色小圓點)
        const drawnLines = new Set<string>();
        positionedItems.forEach((item) => {
          const key = `${Math.round(item.renderX * 2) / 2}-${item.lineColor}`;
          if (drawnLines.has(key)) return;
          drawnLines.add(key);

          // 判斷線寬與線條樣式
          let lineWidth = 2.0;
          let isCardDivider = item.type === 'divider' || item.rawItem?.isCardDivider;
          if (item.type === 'avgCost') {
            lineWidth = 2.5; // 平均成本虛線
          } else if (item.type === 'currentPrice') {
            lineWidth = 2.4; // 現價虛線
          } else if (item.type === 'simulatedPreOrder') {
            lineWidth = 2.4; // 模擬預購單 (#00F5E2) 虛線
          } else if (item.type === 'optionTrade') {
            lineWidth = 2.2; // 期權購買紀錄：黑色虛線
          } else if (isCardDivider) {
            lineWidth = 3.0;
          }

          // 1. 若為卡片分隔線，保留圖表內部垂直分隔
          if (isCardDivider) {
            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([]);
            ctx.strokeStyle = item.lineColor;
            ctx.lineWidth = lineWidth;
            ctx.moveTo(item.renderX, chartArea.top);
            ctx.lineTo(item.renderX, chartArea.bottom);
            ctx.stroke();
            ctx.restore();
          }

          // 2. 價位線(虛線)移到軸下方，由 X 軸向下延伸連到標籤，尾部帶無填色小圓點
          const circleRadius = 2.8;
          const circleY = item.tagY - 10.5;
          const lineEndY = circleY - circleRadius;

          ctx.save();
          ctx.beginPath();
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = item.lineColor;
          ctx.lineWidth = Math.min(lineWidth, 2.2);
          ctx.moveTo(item.renderX, chartArea.bottom);
          if (Math.abs(item.safeX - item.renderX) > 2) {
            const midY = (chartArea.bottom + lineEndY) / 2;
            ctx.lineTo(item.renderX, midY);
            ctx.lineTo(item.safeX, midY);
            ctx.lineTo(item.safeX, lineEndY);
          } else {
            ctx.lineTo(item.renderX, lineEndY);
          }
          ctx.stroke();

          // 虛線尾部添加一個小圓點 (無填滿任何顏色，純線條空心圓)
          ctx.beginPath();
          ctx.setLineDash([]); // 實線外框圓
          ctx.strokeStyle = item.lineColor;
          ctx.lineWidth = 1.6;
          ctx.arc(item.safeX, circleY, circleRadius, 0, Math.PI * 2);
          // 嚴格無填滿任何顏色 (不調用 ctx.fill())
          ctx.stroke();
          ctx.restore();
        });

        // 繪製純文字標籤 (移至 X 軸下方，無外框純文字，帶微白柔和光暈保護文字)
        positionedItems.forEach((item) => {
          ctx.save();
          ctx.font = 'bold 10.5px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // 微光暈防重疊干擾
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.lineWidth = 3.5;
          ctx.lineJoin = 'round';
          ctx.strokeText(item.fullText, item.safeX, item.tagY);

          // 純文字本體 (例如 目前價格 $71.70, 平均成本 $71.88, 支撐 $75.00, 行權價 $70.00)
          ctx.fillStyle = item.textColor;
          ctx.fillText(item.fullText, item.safeX, item.tagY);

          // 若有額外多層標籤 (期權：第2行 合約金額 (×100股)，第3行 當前損益)
          if (item.extraLinesAbove && item.extraLinesAbove.length > 0) {
            item.extraLinesAbove.forEach((extra, extraIdx) => {
              const extraY = item.tagY + (extraIdx + 1) * multiLineGap;
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
              ctx.lineWidth = 3.5;
              ctx.lineJoin = 'round';
              ctx.strokeText(extra.text, item.safeX, extraY);

              ctx.fillStyle = extra.textColor;
              ctx.fillText(extra.text, item.safeX, extraY);
            });
          }

          ctx.restore();
        });

        // 繪製 X 軸置底居中「股價」標題
        ctx.save();
        ctx.font = 'bold 11.5px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#64748b';
        ctx.fillText('股價', (chartArea.left + chartArea.right) / 2, chart.height - 4);
        ctx.restore();

        // 3. 上方區：買入點資訊 (Pyramid Step Direct Annotations) - 保留於 X 軸上方，自動避讓防重疊
        interface PlacedStepTag {
          x: number;
          width: number;
          y: number;
        }
        const placedStepTags: PlacedStepTag[] = [];

        ctx.save();
        stepItems.forEach((step) => {
          const px = xScale.getPixelForValue(step.price);
          const yVal = yAxisMode === 'shares' ? step.size : step.percent;
          const py = yScale.getPixelForValue(yVal);

          if (px >= chartArea.left - 20 && px <= chartArea.right + 20) {
            // Text Line 1: "$80.93 -3% (15%)" or "$80.93 +2% (15%)"
            const pctSign = step.addPct !== undefined ? `+${step.addPct}%` : `-${step.dropPct}%`;
            const line1 = `$${step.price.toFixed(2)}  ${pctSign} (${step.percent}%)`;
            // Text Line 2: "已購 X / 預購 Y 股 (進度%)"
            const progressRatio = step.size > 0 ? Math.min(100, Math.round((step.bought / step.size) * 100)) : 0;
            const pctText = step.size > 0 ? ` (${progressRatio}%)` : '';
            const line2 = `已購 ${step.bought} / 預購 ${step.size} 股${pctText}`;

            ctx.font = 'bold 12.5px monospace, system-ui, sans-serif';
            const w1 = ctx.measureText(line1).width;
            ctx.font = 'bold 11.5px system-ui, -apple-system, sans-serif';
            const w2 = ctx.measureText(line2).width;
            const tagW = Math.max(w1, w2);

            // 上方區自動避讓計算 (若相鄰階梯太近，自動向上調整高低層次，絕不重疊)
            const baseTagY = py - 7;
            const rowStepUp = 26;
            let currentTagY = baseTagY;
            let stepOverlap = true;
            let stepSafety = 0;

            while (stepOverlap && stepSafety < 6) {
              stepOverlap = placedStepTags.some((placed) => {
                const xOverlap = Math.abs(placed.x - px) < (placed.width + tagW) / 2 + 8;
                const yOverlap = Math.abs(placed.y - currentTagY) < 22;
                return xOverlap && yOverlap;
              });

              if (stepOverlap) {
                currentTagY -= rowStepUp; // 向上避讓堆疊
              }
              stepSafety++;
            }

            // 防止超出頂部邊界
            if (currentTagY - 18 < chartArea.top - 16) {
              currentTagY = Math.max(chartArea.top + 4, currentTagY);
            }

            placedStepTags.push({ x: px, width: tagW, y: currentTagY });

            // 若有向上避讓，繪製細緻引導導線連接至節點
            if (currentTagY < baseTagY) {
              ctx.save();
              ctx.setLineDash([2, 2]);
              ctx.strokeStyle = step.bought > 0 ? 'rgba(16, 185, 129, 0.45)' : 'rgba(148, 163, 184, 0.45)';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(px, py - 3);
              ctx.lineTo(px, currentTagY + 2);
              ctx.stroke();
              ctx.restore();
            }

            // 若節點明顯高於 X 軸，向下連至 X 軸的垂直引線
            if (chartArea.bottom - py > 14) {
              ctx.save();
              ctx.setLineDash([2, 3]);
              ctx.strokeStyle = step.bought > 0 ? 'rgba(16, 185, 129, 0.45)' : (step.isReached ? 'rgba(16, 185, 129, 0.35)' : 'rgba(148, 163, 184, 0.35)');
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(px, py + 8);
              ctx.lineTo(px, chartArea.bottom);
              ctx.stroke();
              ctx.restore();
            }

            // 繪製文字 Line 2 (靠近節點)
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';

            ctx.font = 'bold 11.5px system-ui, -apple-system, sans-serif';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.lineWidth = 3.5;
            ctx.lineJoin = 'round';
            ctx.strokeText(line2, px, currentTagY);
            ctx.fillStyle = step.bought > 0 ? '#047857' : (step.isReached ? '#059669' : '#475569');
            ctx.fillText(line2, px, currentTagY);

            // 繪製文字 Line 1 (頂行)
            ctx.font = 'bold 12.5px monospace, system-ui, sans-serif';
            ctx.strokeText(line1, px, currentTagY - 14);
            ctx.fillStyle = step.isReached ? '#047857' : '#64748b';
            ctx.fillText(line1, px, currentTagY - 14);

            ctx.restore();
          }
        });
        ctx.restore();

        // 4. Draw Historical Trades Price & Quantity ONLY on hover (平常狀態下只顯示藍點，滑鼠經過時才顯示價格標籤)
        if (showTrades && validTrades.length > 0) {
          const activeElements = (chart as any).getActiveElements ? (chart as any).getActiveElements() : [];
          const currentHover = drawDataRef.current?.hoveredItem;
          const hoveredTradeData = currentHover?.type === 'trade' ? currentHover.data : null;

          ctx.save();
          validTrades.forEach((trade, idx) => {
            const tx = xScale.getPixelForValue(trade.price);
            const maxStepVal = drawDataRef.current?.sortedStepItems ? Math.max(...drawDataRef.current.sortedStepItems.map(s => Math.max(s.size, s.bought)), 10) : 50;
            const yVal = yAxisMode === 'shares' ? Math.min(trade.quantity, maxStepVal * 1.25) : 15;
            const ty = yScale.getPixelForValue(yVal);

            if (tx >= chartArea.left - 15 && tx <= chartArea.right + 15) {
              const isBuy = trade.type === 'BUY';

              // 判斷此筆交易是否正被滑鼠懸停 (hover)
              const isHovered = Boolean(
                (hoveredTradeData && (
                  (hoveredTradeData.id && trade.id && hoveredTradeData.id === trade.id) ||
                  (hoveredTradeData.price === trade.price && hoveredTradeData.quantity === trade.quantity && (hoveredTradeData.dateFormatted === trade.dateFormatted || !hoveredTradeData.dateFormatted)) ||
                  hoveredTradeData === trade
                )) ||
                activeElements.some((el: any) => {
                  const ds = chart.data.datasets[el.datasetIndex];
                  return ds && (ds.label?.includes('買入') || ds.label?.includes('賣出')) && (ds.data[el.index] as any)?.raw === trade;
                })
              );

              // 只有在滑鼠經過該點時才渲染價格與股數標籤浮動卡片
              if (isHovered) {
                const label = `${isBuy ? '買' : '賣'} ${trade.quantity}股 @ $${trade.price.toFixed(2)}${trade.dateFormatted ? ` (${trade.dateFormatted})` : ''}`;

                ctx.font = 'bold 11.5px monospace, system-ui, sans-serif';
                const textWidth = ctx.measureText(label).width;
                const tagW = textWidth + 14;
                const tagH = 22;

                // Alternate offset to ensure tag is well-placed above point
                const tagX = Math.max(chartArea.left + 4, Math.min(chartArea.right - tagW - 4, tx - tagW / 2));
                const tagY = ty - tagH - 12 < chartArea.top ? ty + 12 : ty - tagH - 10;

                // Drop shadow
                ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 3;

                // Pill background
                ctx.fillStyle = isBuy ? 'rgba(239, 246, 255, 0.98)' : 'rgba(255, 247, 237, 0.98)';
                ctx.strokeStyle = isBuy ? '#2563eb' : '#ea580c';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') {
                  ctx.roundRect(tagX, tagY, tagW, tagH, 6);
                } else {
                  ctx.rect(tagX, tagY, tagW, tagH);
                }
                ctx.fill();
                ctx.stroke();

                // Clear shadow for crisp text
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;

                // Text
                ctx.fillStyle = isBuy ? '#1e40af' : '#9a3412';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, tagX + tagW / 2, tagY + tagH / 2);
              }
            }
          });
          ctx.restore();
        }
      } catch (err) {
        console.warn('pyramidAndCurrentPricePlugin afterDraw error:', err);
      }
    },
  };
}, [symbol]);

  // Chart options with disabled in-canvas tooltip and onHover handler to update fixed top HUD
  const chartOptions: ChartOptions<'line'> = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      hover: {
        mode: 'nearest',
        intersect: true,
        animationDuration: 0,
      },
      responsiveAnimationDuration: 0,
      layout: {
        padding: {
          top: 24, // 上方預留買入點標籤避讓空間
          // X 軸上方與下方空間平分 (50% / 50%)
          // 畫布總高度為 chartContainerHeight，令 chartArea.bottom 位於 chartContainerHeight * 0.5
          // bottom padding = chartContainerHeight * 0.5 - estimatedXScaleHeight(22)
          bottom: Math.max(50, Math.round(chartContainerHeight * 0.5 - 22)),
          left: 16,
          right: 16,
        },
      },
      interaction: {
        mode: 'nearest',
        intersect: true,
      },
      onHover: (event, elements, chart) => {
        try {
          let nextHover: {
            type: 'step' | 'trade' | 'visualLevel' | 'avgCost' | 'currentPrice' | 'optionTrade' | 'simulatedPreOrder';
            data: any;
          } | null = null;
          let hoverKey = '';

          if (elements && elements.length > 0) {
            const el = elements[0];
            const datasetIndex = el.datasetIndex;
            const dataIndex = el.index;

            const targetDataset = chart?.data?.datasets?.[datasetIndex];

            if (targetDataset?.label?.includes('各批次攤平曲線') || datasetIndex === 0) {
              // Pyramid step
              const item = sortedStepItems[dataIndex];
              if (item) {
                nextHover = { type: 'step', data: item };
                hoverKey = `step_${item.name}_${item.price}_${item.bought}`;
              }
            } else if (targetDataset?.label?.includes('買入')) {
              // Buy trade
              const item = buyTrades[dataIndex];
              if (item) {
                nextHover = { type: 'trade', data: item };
                hoverKey = `trade_buy_${item.price}_${item.quantity}_${item.dateFormatted || ''}_${dataIndex}`;
              }
            } else if (targetDataset?.label?.includes('賣出')) {
              // Sell trade
              const item = sellTrades[dataIndex];
              if (item) {
                nextHover = { type: 'trade', data: item };
                hoverKey = `trade_sell_${item.price}_${item.quantity}_${item.dateFormatted || ''}_${dataIndex}`;
              }
            }
          }

          if (!nextHover) {
            const chartX = event.x;

            // 優先以實際渲染之虛線位置 (含全選間距比例舒緩) 進行懸停判定
            if (renderedLinesRef.current && renderedLinesRef.current.length > 0 && chartX !== null && chartX !== undefined) {
              const hitLine = renderedLinesRef.current.find((l) => Math.abs(l.renderX - chartX) <= 12);
              if (hitLine) {
                if (hitLine.type === 'currentPrice') {
                  nextHover = {
                    type: 'currentPrice',
                    data: {
                      price: currentPriceNum,
                      avgCost: holdingAvgPriceNum,
                    },
                  };
                  hoverKey = `cur_${currentPriceNum}_${holdingAvgPriceNum}`;
                } else if (hitLine.type === 'avgCost') {
                  nextHover = {
                    type: 'avgCost',
                    data: {
                      price: holdingAvgPriceNum,
                      quantity: holdingQty,
                      currentPrice: currentPriceNum,
                    },
                  };
                  hoverKey = `avg_${holdingAvgPriceNum}_${holdingQty}_${currentPriceNum}`;
                } else if (hitLine.type === 'simulatedPreOrder') {
                  nextHover = {
                    type: 'simulatedPreOrder',
                    data: hitLine.data,
                  };
                  hoverKey = `pre_${hitLine.data.id || ''}_${hitLine.data.price}`;
                } else if (hitLine.type === 'optionTrade') {
                  nextHover = {
                    type: 'optionTrade',
                    data: hitLine.data,
                  };
                  hoverKey = `opt_${hitLine.data.id}_${hitLine.data.strikePrice}_${hitLine.data.currentPnL}`;
                } else {
                  nextHover = { type: 'visualLevel', data: hitLine.data };
                  hoverKey = `lvl_${hitLine.data.label}_${hitLine.data.price}`;
                }
              }
            }

            const xScale = chart?.scales?.x;

            // Fallback: Check if hovering near holdingAvgPrice line (Average Cost)
            if (!nextHover && showAvgCost && holdingAvgPriceNum > 0 && xScale && chartX !== null && chartX !== undefined) {
              const hoveredPrice = xScale.getValueForPixel(chartX);
              if (typeof hoveredPrice === 'number') {
                const span = maxX - minX || 10;
                const threshold = span * 0.025;
                if (Math.abs(holdingAvgPriceNum - hoveredPrice) <= threshold) {
                  nextHover = {
                    type: 'avgCost',
                    data: {
                      price: holdingAvgPriceNum,
                      quantity: holdingQty,
                      currentPrice: currentPriceNum,
                    },
                  };
                  hoverKey = `avg_${holdingAvgPriceNum}_${holdingQty}_${currentPriceNum}`;
                }
              }
            }

            // Fallback: Check if hovering near currentPrice line (Current Price)
            if (!nextHover && currentPriceNum > 0 && xScale && chartX !== null && chartX !== undefined) {
              const hoveredPrice = xScale.getValueForPixel(chartX);
              if (typeof hoveredPrice === 'number') {
                const span = maxX - minX || 10;
                const threshold = span * 0.025;
                if (Math.abs(currentPriceNum - hoveredPrice) <= threshold) {
                  nextHover = {
                    type: 'currentPrice',
                    data: {
                      price: currentPriceNum,
                      avgCost: holdingAvgPriceNum,
                    },
                  };
                  hoverKey = `cur_${currentPriceNum}_${holdingAvgPriceNum}`;
                }
              }
            }

            // Fallback: Check if hovering near a visual level line
            if (!nextHover && displayedVisualLevels && displayedVisualLevels.length > 0 && xScale && chartX !== null && chartX !== undefined) {
              const hoveredPrice = xScale.getValueForPixel(chartX);
              if (typeof hoveredPrice === 'number') {
                const span = maxX - minX || 10;
                const threshold = span * 0.02; // within 2% of price span
                const nearestLvl = displayedVisualLevels.find((vl) => Math.abs(vl.price - hoveredPrice) <= threshold);
                if (nearestLvl) {
                  nextHover = { type: 'visualLevel', data: nearestLvl };
                  hoverKey = `lvl_${nearestLvl.label}_${nearestLvl.price}`;
                }
              }
            }
          }

          if (lastHoverKeyRef.current !== hoverKey) {
            lastHoverKeyRef.current = hoverKey;
            setHoveredItem(nextHover);
          }
        } catch {
          // ignore hover error
        }
      },
      onClick: (_event, elements, chart) => {
        try {
          if (elements && elements.length > 0) {
            const el = elements[0];
            const datasetIndex = el.datasetIndex;
            const dataIndex = el.index;
            const targetDataset = chart?.data?.datasets?.[datasetIndex];

            if (targetDataset?.label?.includes('各批次攤平曲線') || datasetIndex === 0) {
              const item = sortedStepItems[dataIndex];
              if (item) setSelectedItem({ type: 'step', data: item });
            } else if (targetDataset?.label?.includes('買入')) {
              const item = buyTrades[dataIndex];
              if (item) setSelectedItem({ type: 'trade', data: item });
            } else if (targetDataset?.label?.includes('賣出')) {
              const item = sellTrades[dataIndex];
              if (item) setSelectedItem({ type: 'trade', data: item });
            }
          }
        } catch {
          // ignore click error
        }
      },
      plugins: {
        legend: {
          display: false, // We use custom bottom legend
        },
        tooltip: {
          enabled: false, // Disabled to prevent obscuring points on canvas!
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: minX,
          max: maxX,
          title: {
            display: false, // 由 custom plugin 於最底部居中平滑繪製，避免 Chart.js title 與避讓標籤碰撞
          },
          grid: {
            color: 'rgba(241, 245, 249, 0.95)',
            lineWidth: 1,
          },
          ticks: {
            color: '#064e3b',
            font: { size: 11, weight: 'bold' as const },
            callback: (value) => `$${Number(value).toFixed(2)}`,
            padding: 3,
          },
        },
        y: {
          type: 'linear',
          beginAtZero: true,
          max: maxYValue,
          display: false, // Clean background
          grid: {
            display: false,
          },
        },
      },
    };
  }, [sortedStepItems, buyTrades, sellTrades, minX, maxX, maxYValue, displayedVisualLevels, showAvgCost, holdingAvgPriceNum, currentPriceNum, holdingQty, showStrikePrices, optionPurchaseRecords, chartContainerHeight, showPreOrders, effectivePreOrders]);

  return (
    <div
      className={`w-full bg-white transition-shadow duration-200 ${
        isFullscreen
          ? "h-full flex flex-col justify-between p-2.5 sm:p-3 rounded-none overflow-hidden"
          : compact
          ? "p-2.5 sm:p-3 rounded-xl"
          : "border border-zinc-200/90 rounded-2xl p-5 sm:p-6 shadow-xs mb-4"
      }`}
    >
      {/* 1. Header (Title, Purple Current Price, Orange Avg Price) */}
      {!hideHeader && (
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-100 shrink-0 ${
            isFullscreen ? "gap-1 pb-1" : compact ? "gap-1.5 pb-2" : "gap-4 pb-4"
          }`}
        >
          <div>
            {symbol ? (
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3
                  className={`font-black tracking-tight text-zinc-950 font-mono leading-none ${
                    isFullscreen || compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"
                  }`}
                >
                  {symbol}
                </h3>
                {companyName && (
                  <span className="text-zinc-500 text-xs sm:text-sm font-semibold tracking-wider truncate max-w-[200px] sm:max-w-[320px]">
                    {companyName}
                  </span>
                )}
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-full ml-1">
                  分批進場金字塔
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3
                  className={`font-black tracking-tight text-zinc-900 ${
                    isFullscreen || compact ? "text-base sm:text-lg" : "text-xl sm:text-2xl"
                  }`}
                >
                  分批進場金字塔
                </h3>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-full">
                  動態互動圖表
                </span>
              </div>
            )}
            {!compact && !isFullscreen && (
              <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                以目前價格 ${currentPrice > 0 ? currentPrice.toFixed(2) : '--'} 為基準，沿價格下跌階梯逐批增加配置
              </p>
            )}
          </div>

          {/* Right side: 目前價格 (Purple) & 平均成本 (Orange) & Collapse */}
          <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
            {/* 目前價格 Card (Purple) */}
            <div
              className={`bg-purple-50/70 border border-purple-200/80 text-right flex flex-col justify-center items-end shadow-2xs ${
                isFullscreen || compact
                  ? "px-2 py-0.5 sm:px-2.5 sm:py-1 min-w-[76px] sm:min-w-[84px] rounded-lg"
                  : "px-4 py-2 min-w-[120px] rounded-2xl"
              }`}
            >
              <span className={`font-bold text-purple-700 flex items-center gap-1 ${isFullscreen || compact ? "text-[9px]" : "text-[10px]"}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                目前價格
              </span>
              <span
                className={`font-black font-mono text-purple-700 leading-tight ${
                  isFullscreen || compact ? "text-base sm:text-lg" : "text-2xl sm:text-3xl"
                }`}
              >
                ${currentPriceNum > 0 ? currentPriceNum.toFixed(2) : '--'}
              </span>
            </div>

            {/* 平均成本 Card (Orange) */}
            {holdingAvgPriceNum > 0 && (
              <div
                className={`bg-orange-50/70 border border-orange-200/80 text-right flex flex-col justify-center items-end shadow-2xs ${
                  isFullscreen || compact
                    ? "px-2 py-0.5 sm:px-2.5 sm:py-1 min-w-[76px] sm:min-w-[84px] rounded-lg"
                    : "px-4 py-2 min-w-[120px] rounded-2xl"
                }`}
              >
                <span className={`font-bold text-orange-700 flex items-center gap-1 ${isFullscreen || compact ? "text-[9px]" : "text-[10px]"}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  平均成本
                </span>
                <span
                  className={`font-black font-mono text-orange-600 leading-tight ${
                    isFullscreen || compact ? "text-base sm:text-lg" : "text-2xl sm:text-3xl"
                  }`}
                >
                  ${holdingAvgPriceNum.toFixed(2)}
                </span>
              </div>
            )}

            {/* 模擬預購單 Card (#00F5E2) */}
            {showPreOrders && effectivePreOrders && effectivePreOrders.length > 0 && (
              <div
                className={`bg-[#00F5E2]/10 border border-[#00F5E2]/40 text-right flex flex-col justify-center items-end shadow-2xs ${
                  isFullscreen || compact
                    ? "px-2 py-0.5 sm:px-2.5 sm:py-1 min-w-[76px] sm:min-w-[84px] rounded-lg"
                    : "px-4 py-2 min-w-[120px] rounded-2xl"
                }`}
              >
                <span className={`font-medium text-[#007a70] dark:text-[#00F5E2] flex items-center gap-1 ${isFullscreen || compact ? "text-[9px]" : "text-[10px]"}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00F5E2] shadow-[0_0_6px_#00F5E2]" />
                  模擬預購單
                </span>
                <span
                  className={`font-semibold font-mono text-[#007a70] dark:text-[#00F5E2] leading-tight ${
                    isFullscreen || compact ? "text-base sm:text-lg" : "text-2xl sm:text-3xl"
                  }`}
                >
                  ${effectivePreOrders[0].price.toFixed(2)}
                </span>
              </div>
            )}

            {/* Fullscreen Toggle */}
            {onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer border border-zinc-200/80 shrink-0"
                title={isFullscreen ? '縮小退出全螢幕 (Esc)' : '放大全螢幕顯示'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4 text-amber-500" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            )}

            {/* Collapse / Expand Toggle */}
            <button
              type="button"
              onClick={handleToggleExpand}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer border border-zinc-200/80 shrink-0"
              title={isExpanded ? '收合圖表' : '展開圖表'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className={isFullscreen ? "flex-1 flex flex-col min-h-0 space-y-1.5 pt-1 overflow-hidden" : compact ? "space-y-2 pt-1.5" : "space-y-3.5 pt-3"}>
          {/* Controls Bar: Toggle past trades, toggle Y-axis, summary metrics */}
          <div
            className={`flex flex-wrap items-center justify-between pt-0.5 shrink-0 ${
              isFullscreen || compact ? "gap-1.5 text-xs" : "gap-2.5"
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              {/* 模擬預購單 (#00F5E2) 開關 */}
              <div className="flex items-center rounded-lg border border-[#00F5E2]/50 overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={handleTogglePreOrders}
                  className={`inline-flex items-center gap-1.5 font-medium transition-all cursor-pointer ${
                    compact ? "px-2 sm:px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
                  } ${
                    showPreOrders
                      ? 'bg-[#00F5E2]/25 text-[#006e64] dark:text-[#00F5E2]'
                      : 'bg-zinc-100/90 text-zinc-600 hover:text-zinc-900'
                  }`}
                  title="開啟/關閉圖表上的模擬預購單 (#00F5E2)"
                >
                  <span className="w-2.5 h-0 border-t-2 border-[#00F5E2] shrink-0" />
                  <span>模擬預購單{effectivePreOrders.length > 0 ? ` (${effectivePreOrders.length} 筆)` : ''}</span>
                  <span
                    className={`${compact ? "w-1.5 h-1.5" : "w-2 h-2"} rounded-full ${
                      showPreOrders ? "bg-[#00F5E2] shadow-[0_0_6px_#00F5E2]" : "bg-zinc-400"
                    }`}
                  />
                </button>
                {(onAddPreOrder || symbol) && (
                  <button
                    type="button"
                    onClick={handleOpenPreOrderManager}
                    className={`px-2 py-1 bg-[#00F5E2]/20 hover:bg-[#00F5E2]/35 text-[#006e64] font-bold border-l border-[#00F5E2]/40 transition-colors cursor-pointer flex items-center gap-0.5 ${
                      compact ? "text-[11px]" : "text-xs"
                    }`}
                    title="管理或新增刪除模擬預購單"
                  >
                    <Plus className="w-3 h-3 stroke-[2.5]" />
                    <span>{effectivePreOrders.length > 0 ? '管理' : '新增'}</span>
                  </button>
                )}
              </div>

              {/* 行權價 (新增) - 預設關閉 */}
              <button
                type="button"
                onClick={handleToggleStrikePrices}
                className={`inline-flex items-center gap-1.5 rounded-lg font-bold transition-all cursor-pointer border ${
                  compact ? "px-2 sm:px-2.5 py-1 text-[11px]" : "px-3 py-1.5 rounded-xl text-xs"
                } ${
                  showStrikePrices
                    ? 'bg-zinc-900 border-zinc-950 text-white shadow-2xs'
                    : 'bg-emerald-50/60 border-emerald-200 text-emerald-950 hover:text-emerald-700'
                }`}
                title="開啟/關閉期權行權價與合約金額黑色虛線 (預設關閉)"
              >
                <span className="w-2.5 h-0 border-t-2 border-dashed border-zinc-400 shrink-0" />
                <span>行權價{optionPurchaseRecords.length > 0 ? ` (${optionPurchaseRecords.length} 筆)` : ''}</span>
                <span className={`${compact ? "w-1.5 h-1.5" : "w-2 h-2"} rounded-full ${showStrikePrices ? 'bg-white' : 'bg-emerald-300'}`} />
              </button>

              {/* Toggle Past Trades Button */}
              <button
                type="button"
                onClick={() => setShowTrades(!showTrades)}
                className={`inline-flex items-center gap-1.5 rounded-lg font-bold transition-all cursor-pointer border ${
                  compact ? "px-2 sm:px-2.5 py-1 text-[11px]" : "px-3 py-1.5 rounded-xl text-xs"
                } ${
                  showTrades
                    ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-2xs'
                    : 'bg-emerald-50/60 border-emerald-200 text-emerald-950 hover:text-emerald-700'
                }`}
              >
                <History className={`${compact ? "w-3 h-3" : "w-3.5 h-3.5"} text-blue-700`} />
                <span>過去交易紀錄 ({totalTradesCount} 筆)</span>
                <span className={`${compact ? "w-1.5 h-1.5" : "w-2 h-2"} rounded-full ${showTrades ? 'bg-blue-600' : 'bg-emerald-300'}`} />
              </button>

              {/* Toggle Average Cost Dashed Line */}
              {holdingAvgPriceNum > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAvgCost(!showAvgCost)}
                  className={`inline-flex items-center gap-1.5 rounded-lg font-bold transition-all cursor-pointer border ${
                    compact ? "px-2 sm:px-2.5 py-1 text-[11px]" : "px-3 py-1.5 rounded-xl text-xs"
                  } ${
                    showAvgCost
                      ? 'bg-purple-50/80 border-[#EEABFF] text-purple-950 shadow-2xs'
                      : 'bg-emerald-50/60 border-emerald-200 text-emerald-950 hover:text-emerald-700'
                  }`}
                >
                  <span className="w-2 h-0 border-t-[2px] border-dashed border-[#EEABFF] shrink-0" />
                  <span>平均成本 (${holdingAvgPriceNum.toFixed(2)})</span>
                  <span className={`${compact ? "w-1.5 h-1.5" : "w-2 h-2"} rounded-full ${showAvgCost ? 'bg-[#EEABFF]' : 'bg-emerald-300'}`} />
                </button>
              )}

              {/* Toggle Visual Price Levels (Support/StopLoss/Resistance/TakeProfit) - 下拉複選選單 */}
              <div className="relative" ref={levelsDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsLevelsDropdownOpen((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 rounded-lg font-bold transition-all cursor-pointer border ${
                    compact ? "px-2 sm:px-2.5 py-1 text-[11px]" : "px-3 py-1.5 rounded-xl text-xs"
                  } ${
                    activeTypesCount > 0
                      ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-2xs'
                      : 'bg-emerald-50/60 border-emerald-200 text-emerald-950 hover:text-emerald-700'
                  }`}
                  title="點擊設定分別顯示：支撐、止損、壓力、止盈"
                >
                  <Layers className={`${compact ? "w-3 h-3" : "w-3.5 h-3.5"} text-amber-700 shrink-0`} />
                  <span>{levelsButtonLabel}</span>
                  <span className={`${compact ? "w-1.5 h-1.5" : "w-2 h-2"} rounded-full ${activeTypesCount > 0 ? 'bg-amber-600' : 'bg-emerald-300'}`} />
                  <ChevronDown
                    className={`${compact ? "w-3 h-3" : "w-3.5 h-3.5"} text-amber-800 transition-transform duration-200 ${
                      isLevelsDropdownOpen ? 'rotate-180 text-amber-900' : ''
                    }`}
                  />
                </button>

                {/* 下拉複選內容選單 */}
                {isLevelsDropdownOpen && (
                  <div className="absolute left-0 mt-1.5 w-68 bg-white rounded-xl shadow-xl border border-emerald-200 p-2.5 z-40 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between px-1 py-1 border-b border-emerald-100 mb-1.5">
                      <span className="text-xs font-black text-emerald-950">關鍵防線類別篩選</span>
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={selectAllLevelTypes}
                          className="text-amber-800 hover:text-amber-900 font-black hover:underline cursor-pointer"
                        >
                          全選
                        </button>
                        <span className="text-emerald-300">|</span>
                        <button
                          type="button"
                          onClick={deselectAllLevelTypes}
                          className="text-emerald-800 hover:text-emerald-950 font-bold hover:underline cursor-pointer"
                        >
                          全不選
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {LEVEL_TYPE_CONFIGS.map((cfg) => {
                        const isChecked = selectedLevelTypes[cfg.type];
                        const count = countByType[cfg.type] || 0;
                        return (
                          <label
                            key={cfg.type}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors border ${
                              isChecked
                                ? 'bg-amber-50/70 border-amber-200 hover:bg-amber-50'
                                : 'bg-emerald-50/30 border-transparent hover:bg-emerald-50/80'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleLevelType(cfg.type)}
                                className="w-3.5 h-3.5 rounded border-emerald-300 text-amber-700 focus:ring-amber-500 cursor-pointer"
                              />
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-3.5 h-0 border-t-2 border-dashed shrink-0"
                                  style={{ borderColor: cfg.color }}
                                />
                                <span className={`text-xs font-black ${cfg.textColor}`}>{cfg.label}</span>
                                {cfg.shortcut && (
                                  <span className="text-[10px] text-zinc-400 font-mono font-normal">
                                    ({cfg.shortcut})
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-emerald-950 bg-white border border-emerald-200 px-2 py-0.5 rounded-md shadow-2xs">
                              {count} 檔
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Toggle Card Dividers Button (同步卡片分隔線 - 預設不顯示，手動開啟 / 快捷鍵 Alt + D) */}
              <button
                type="button"
                onClick={handleToggleCardDividers}
                className={`inline-flex items-center gap-1.5 rounded-lg font-bold transition-all cursor-pointer border ${
                  compact ? "px-2 sm:px-2.5 py-1 text-[11px]" : "px-3 py-1.5 rounded-xl text-xs"
                } ${
                  showCardDividers
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-950 shadow-2xs ring-1 ring-indigo-200'
                    : 'bg-emerald-50/60 border-emerald-200 text-emerald-950 hover:text-emerald-700'
                }`}
                title="同步顯示數據圖示化卡片上的分隔線 (實體線，快捷鍵 Alt + D)"
              >
                <Split className={`${compact ? "w-3 h-3" : "w-3.5 h-3.5"} text-indigo-700 shrink-0`} />
                <span>卡片分隔線{cardDividers.length > 0 ? ` (${cardDividers.length} 條)` : ''}</span>
                <span className="hidden sm:inline text-[10px] text-zinc-400 font-mono font-normal">(Alt+D)</span>
                <span className={`${compact ? "w-1.5 h-1.5" : "w-2 h-2"} rounded-full ${showCardDividers ? 'bg-indigo-600' : 'bg-zinc-300'}`} />
              </button>

              {/* 若為全選防線狀態，顯示間距已優化徽章 */}
              {isAllLevelsSelected && (
                <span className="hidden sm:inline-flex items-center text-[10px] font-black text-emerald-900 bg-emerald-100/90 border border-emerald-300 px-2.5 py-1 rounded-xl shadow-2xs">
                  全選防線 · 間距已比例優化
                </span>
              )}

              {/* Y-axis Metric Toggle */}
              <div className="inline-flex items-center bg-emerald-50/80 p-0.5 rounded-xl border border-emerald-200 text-xs">
                <button
                  type="button"
                  onClick={() => setYAxisMode('shares')}
                  className={`px-2.5 py-1 rounded-lg font-black text-[11px] transition-all cursor-pointer ${
                    yAxisMode === 'shares'
                      ? 'bg-white text-emerald-950 shadow-2xs border border-emerald-200/80'
                      : 'text-emerald-800 hover:text-emerald-950'
                  }`}
                >
                  高度：股數 (股)
                </button>
                <button
                  type="button"
                  onClick={() => setYAxisMode('percent')}
                  className={`px-2.5 py-1 rounded-lg font-black text-[11px] transition-all cursor-pointer ${
                    yAxisMode === 'percent'
                      ? 'bg-white text-emerald-950 shadow-2xs border border-emerald-200/80'
                      : 'text-emerald-800 hover:text-emerald-950'
                  }`}
                >
                  高度：配置比例 (%)
                </button>
              </div>
            </div>

            {/* Prominent Direct Progress Metric */}
            <div
              className={`text-emerald-950 bg-emerald-50/90 border border-emerald-200 shadow-2xs font-bold ${
                compact ? "text-[11px] px-2.5 py-1 rounded-lg" : "text-xs px-3 py-1.5 rounded-xl"
              }`}
            >
              <span>整體進度：</span>
              <span className={`font-black text-emerald-800 font-mono ml-1 ${compact ? "text-xs" : "text-sm"}`}>
                已購買: {totalBoughtShares} 股
              </span>
              <span className="text-emerald-400 mx-1 font-black">/</span>
              <span className={`font-black text-emerald-950 font-mono ${compact ? "text-xs" : "text-sm"}`}>
                預購入: {totalPlannedShares} 股
              </span>
            </div>
          </div>

          {/* 2. 固定即時情報視窗 (深綠色高對比背景，字體明亮高對比，完全避免暗灰色，固定高度杜絕震盪) */}
          <div
            className={`bg-[#032e20] text-white shadow-xs border border-[#0b5338] flex items-center justify-between overflow-hidden shrink-0 select-none ${
              isFullscreen ? "h-[36px] sm:h-[38px] rounded-lg px-2.5 py-1 text-[11px]" : compact ? "h-[38px] sm:h-[40px] rounded-lg px-2.5 py-1 text-[11px]" : "h-[48px] sm:h-[52px] rounded-xl px-3.5 py-2 text-xs"
            }`}
          >
            {hoveredItem ? (
              hoveredItem.type === 'step' ? (
                <div className="flex items-center justify-between w-full gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-md font-black text-xs bg-emerald-500 text-white shadow-xs">
                      {hoveredItem.data.name}
                    </span>
                    <span className="text-xs font-bold text-emerald-100 hidden sm:inline">
                      {hoveredItem.data.subtitle} ({hoveredItem.data.addPct !== undefined ? `+${hoveredItem.data.addPct}%` : `-${hoveredItem.data.dropPct}%`})
                    </span>
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                        hoveredItem.data.isReached
                          ? 'bg-emerald-500 text-white border border-emerald-300'
                          : 'bg-[#06422d] text-amber-300 border border-amber-400/70'
                      }`}
                    >
                      {hoveredItem.data.isReached ? '● 已到達／已買入' : '○ 尚未觸發'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 sm:gap-4 text-xs font-mono shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="text-emerald-200 text-[10px] sm:text-xs font-sans font-bold">預計價:</span>
                      <span className="font-black text-emerald-300 text-xs sm:text-sm">
                        ${hoveredItem.data.price.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-emerald-200 text-[10px] sm:text-xs font-sans font-bold hidden sm:inline">股數:</span>
                      <span className="font-black text-white text-xs sm:text-sm">
                        已購 <span className="text-emerald-300">{hoveredItem.data.bought}</span> / 預購 {hoveredItem.data.size} 股
                      </span>
                    </div>
                    <div className="flex items-center gap-1 hidden md:flex">
                      <span className="text-emerald-200 text-[10px] sm:text-xs font-sans font-bold">配置:</span>
                      <span className="font-black text-teal-200 text-xs sm:text-sm">{hoveredItem.data.percent}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-emerald-200 text-[10px] sm:text-xs font-sans font-bold hidden md:inline">資金:</span>
                      <span className="font-black text-amber-300 text-xs sm:text-sm">
                        ${hoveredItem.data.stepCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </div>
              ) : hoveredItem.type === 'trade' ? (
                <div className="flex items-center justify-between w-full gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-md font-black text-xs text-white shadow-xs ${
                        hoveredItem.data.type === 'BUY' ? 'bg-blue-600' : 'bg-orange-600'
                      }`}
                    >
                      歷史{hoveredItem.data.type === 'BUY' ? '買入' : '賣出'}交易
                    </span>
                    <span className="text-xs font-bold text-white">
                      {hoveredItem.data.dateFormatted}
                    </span>
                    {hoveredItem.data.batch && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-500 text-white border border-blue-300 hidden sm:inline">
                        {hoveredItem.data.batch}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 sm:gap-4 text-xs font-mono shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="text-emerald-200 text-[10px] sm:text-xs font-sans font-bold">價格:</span>
                      <span className="font-black text-blue-300 text-xs sm:text-sm">
                        ${hoveredItem.data.price.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-emerald-200 text-[10px] sm:text-xs font-sans font-bold">股數:</span>
                      <span className="font-black text-white text-xs sm:text-sm">{hoveredItem.data.quantity} 股</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-emerald-200 text-[10px] sm:text-xs font-sans font-bold hidden sm:inline">總金額:</span>
                      <span className="font-black text-amber-300 text-xs sm:text-sm">
                        ${(hoveredItem.data.price * hoveredItem.data.quantity).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 hidden md:flex">
                      <span className="text-emerald-200 text-[10px] sm:text-xs font-sans font-bold">經手:</span>
                      <span className="text-white text-xs font-bold">
                        {hoveredItem.data.operator || '人'} ・ {hoveredItem.data.purpose || '加碼'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : hoveredItem.type === 'simulatedPreOrder' ? (
                <div className="flex items-center justify-between w-full gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-md font-bold text-xs bg-[#00F5E2] text-zinc-950 shadow-xs">
                      模擬預購單
                    </span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-[#00F5E2]">
                      ${hoveredItem.data.price.toFixed(2)}
                    </span>
                    {hoveredItem.data.quantity > 0 && (
                      <span className="text-xs font-normal text-emerald-100 hidden sm:inline">
                        ({hoveredItem.data.quantity} 股)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 sm:gap-4 text-xs font-mono shrink-0">
                    {currentPriceNum > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-emerald-200 font-sans font-normal text-[10px] sm:text-xs">距現價:</span>
                        <span className={`font-bold text-xs sm:text-sm ${hoveredItem.data.price <= currentPriceNum ? 'text-emerald-300' : 'text-amber-300'}`}>
                          {hoveredItem.data.price >= currentPriceNum ? '+' : ''}
                          ${(hoveredItem.data.price - currentPriceNum).toFixed(2)} ({(((hoveredItem.data.price - currentPriceNum) / currentPriceNum) * 100).toFixed(2)}%)
                        </span>
                      </div>
                    )}
                    {hoveredItem.data.quantity > 0 && (
                      <div className="flex items-center gap-1 hidden sm:flex">
                        <span className="text-emerald-200 font-sans font-normal text-[10px] sm:text-xs">預計金額:</span>
                        <span className="font-bold text-xs sm:text-sm text-cyan-200">
                          ${(hoveredItem.data.price * hoveredItem.data.quantity).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    )}
                    {symbol && (
                      <button
                        type="button"
                        onClick={() => handleLocalDeletePreOrder(hoveredItem.data.id, hoveredItem.data.price)}
                        className="px-2 py-0.5 rounded bg-rose-600/90 hover:bg-rose-500 text-white text-[10px] font-sans font-bold cursor-pointer flex items-center gap-1 transition-colors"
                        title="刪除此筆模擬預購單"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                        <span>刪除</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : hoveredItem.type === 'avgCost' ? (
                <div className="flex items-center justify-between w-full gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-md font-black text-xs bg-orange-600 text-white shadow-xs">
                      持有平均成本
                    </span>
                    <span className="text-xs sm:text-sm font-black font-mono text-orange-300">
                      ${hoveredItem.data.price.toFixed(2)}
                    </span>
                    {hoveredItem.data.quantity > 0 && (
                      <span className="text-xs font-bold text-emerald-100 hidden sm:inline">
                        (持有 {hoveredItem.data.quantity} 股)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 sm:gap-4 text-xs font-mono shrink-0">
                    {hoveredItem.data.currentPrice > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-emerald-200 font-sans font-bold text-[10px] sm:text-xs">距現價:</span>
                        <span className={`font-black text-xs sm:text-sm ${hoveredItem.data.currentPrice >= hoveredItem.data.price ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {hoveredItem.data.currentPrice >= hoveredItem.data.price ? '+' : ''}
                          ${(hoveredItem.data.currentPrice - hoveredItem.data.price).toFixed(2)} ({(((hoveredItem.data.currentPrice - hoveredItem.data.price) / hoveredItem.data.price) * 100).toFixed(2)}%)
                        </span>
                      </div>
                    )}
                    {hoveredItem.data.quantity > 0 && hoveredItem.data.currentPrice > 0 && (
                      <div className="flex items-center gap-1 hidden sm:flex">
                        <span className="text-emerald-200 font-sans font-bold text-[10px] sm:text-xs">未實現:</span>
                        <span className={`font-black text-xs sm:text-sm ${hoveredItem.data.currentPrice >= hoveredItem.data.price ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {hoveredItem.data.currentPrice >= hoveredItem.data.price ? '+' : ''}
                          ${((hoveredItem.data.currentPrice - hoveredItem.data.price) * hoveredItem.data.quantity).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    )}
                    <span className="text-orange-300 text-[10px] sm:text-xs font-sans font-bold hidden md:inline">
                      橘色虛線標註
                    </span>
                  </div>
                </div>
              ) : hoveredItem.type === 'currentPrice' ? (
                <div className="flex items-center justify-between w-full gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-md font-black text-xs bg-purple-600 text-white shadow-xs">
                      即時目前價格
                    </span>
                    <span className="text-xs sm:text-sm font-black font-mono text-purple-300">
                      ${hoveredItem.data.price.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 sm:gap-4 text-xs font-mono shrink-0">
                    {hoveredItem.data.avgCost > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-emerald-200 font-sans font-bold text-[10px] sm:text-xs">距平均成本:</span>
                        <span className={`font-black text-xs sm:text-sm ${hoveredItem.data.price >= hoveredItem.data.avgCost ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {hoveredItem.data.price >= hoveredItem.data.avgCost ? '+' : ''}
                          ${(hoveredItem.data.price - hoveredItem.data.avgCost).toFixed(2)} ({(((hoveredItem.data.price - hoveredItem.data.avgCost) / hoveredItem.data.avgCost) * 100).toFixed(2)}%)
                        </span>
                      </div>
                    )}
                    <span className="text-purple-300 text-[10px] sm:text-xs font-sans font-bold hidden sm:inline">
                      紫色虛線標註
                    </span>
                  </div>
                </div>
              ) : hoveredItem.type === 'optionTrade' ? (
                <div className="flex items-center justify-between w-full gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-md font-black text-xs bg-zinc-950 text-white border border-zinc-600 shadow-xs">
                      期權{hoveredItem.data.positionSide === 'sell' ? '賣出' : '買入'} ({String(hoveredItem.data.optionType || 'call').toUpperCase()})
                    </span>
                    <span className="text-xs font-bold text-emerald-100 hidden sm:inline">
                      {hoveredItem.data.dateFormatted} · 已過 {hoveredItem.data.daysElapsed} 天
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 sm:gap-4 text-xs font-mono shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="text-emerald-200 font-sans font-bold text-[10px] sm:text-xs">行權價:</span>
                      <span className="font-black text-white text-xs sm:text-sm">
                        ${Number(hoveredItem.data.strikePrice || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-emerald-200 font-sans font-bold text-[10px] sm:text-xs">合約金額(×100股):</span>
                      <span className="font-black text-amber-300 text-xs sm:text-sm">
                        ${Number(hoveredItem.data.contractAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-emerald-200 font-sans font-bold text-[10px] sm:text-xs">當前損益:</span>
                      <span
                        className={`font-black text-xs sm:text-sm ${
                          Number(hoveredItem.data.currentPnL || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {Number(hoveredItem.data.currentPnL || 0) >= 0 ? '+' : '-'}$
                        {Math.abs(Number(hoveredItem.data.currentPnL || 0)).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="px-2 py-0.5 rounded-md font-black text-xs text-white shadow-xs"
                      style={{ backgroundColor: hoveredItem.data.color }}
                    >
                      {hoveredItem.data.label}防線
                    </span>
                    <span className="text-xs sm:text-sm font-black font-mono text-white">
                      ${hoveredItem.data.price.toFixed(2)}
                    </span>
                    {hoveredItem.data.note && (
                      <span className="text-xs font-bold text-emerald-100 hidden sm:inline">
                        ({hoveredItem.data.note})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 sm:gap-4 text-xs font-mono shrink-0">
                    {currentPriceNum > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-emerald-200 font-sans font-bold text-[10px] sm:text-xs">距現價:</span>
                        <span className={`font-black text-xs sm:text-sm ${hoveredItem.data.price >= currentPriceNum ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {hoveredItem.data.price >= currentPriceNum ? '+' : ''}${(hoveredItem.data.price - currentPriceNum).toFixed(2)} ({(((hoveredItem.data.price - currentPriceNum) / currentPriceNum) * 100).toFixed(1)}%)
                        </span>
                      </div>
                    )}
                    {holdingAvgPriceNum > 0 && (
                      <div className="flex items-center gap-1 hidden sm:flex">
                        <span className="text-emerald-200 font-sans font-bold text-[10px] sm:text-xs">距均價:</span>
                        <span className={`font-black text-xs sm:text-sm ${hoveredItem.data.price >= holdingAvgPriceNum ? 'text-emerald-300' : 'text-amber-300'}`}>
                          {hoveredItem.data.price >= holdingAvgPriceNum ? '+' : ''}${(hoveredItem.data.price - holdingAvgPriceNum).toFixed(2)} ({(((hoveredItem.data.price - holdingAvgPriceNum) / holdingAvgPriceNum) * 100).toFixed(1)}%)
                        </span>
                      </div>
                    )}
                    <span className="text-teal-200 text-[10px] sm:text-xs font-sans font-bold hidden md:inline">
                      視覺防線標註
                    </span>
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center justify-between w-full text-xs text-emerald-100 gap-2 min-w-0">
                <div className="flex items-center gap-1.5 truncate">
                  <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                  <span className="font-bold text-emerald-50 text-[11px] sm:text-xs truncate">
                    💡 滑鼠懸停至階梯、交易紀錄或關鍵防線虛線上即時顯示情資，已固定於上方不遮擋圖表
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono shrink-0">
                  {currentPriceNum > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-emerald-200 font-sans font-bold text-[10px] sm:text-xs">當前:</span>
                      <span className="text-purple-300 font-black text-xs sm:text-sm">${currentPriceNum.toFixed(2)}</span>
                    </div>
                  )}
                  {holdingAvgPriceNum > 0 && (
                    <>
                      <span className="text-emerald-500">|</span>
                      <div className="flex items-center gap-1">
                        <span className="text-emerald-200 font-sans font-bold text-[10px] sm:text-xs">均價:</span>
                        <span className="text-orange-300 font-black text-xs sm:text-sm">${holdingAvgPriceNum.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  {displayedVisualLevels && displayedVisualLevels.length > 0 && (
                    <>
                      <span className="text-emerald-500 hidden sm:inline">|</span>
                      <span className="text-amber-300 font-black text-[10px] sm:text-xs hidden sm:inline">防線: {displayedVisualLevels.length} 檔已啟用</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 3. Chart Canvas Area (X 軸平分 50/50 上下空間，全螢幕模式 flex-1 min-h-0) */}
          <div
            ref={chartContainerRef}
            className={`relative w-full ${
              isFullscreen
                ? "flex-1 min-h-0 w-full"
                : compact
                ? "h-[260px] sm:h-[285px] lg:h-[305px] xl:h-[325px] pt-1"
                : "h-[360px] sm:h-[390px] lg:h-[420px] xl:h-[440px] pt-1"
            }`}
          >
            <Chart
              key={`chart_${symbol || 'default'}_${calcMode}_${compact ? 'compact' : 'full'}`}
              ref={chartRef}
              type="line"
              data={chartData}
              options={chartOptions}
              plugins={[customAnnotationPlugin]}
            />
          </div>

          {/* 4. 底部說明註解 (只顯示上面的攤平曲線、綠點、圓點、交易紀錄與明細快捷入口) */}
          <div
            className={`flex flex-wrap items-center justify-center sm:justify-start border-t border-emerald-100 shrink-0 ${
              isFullscreen || compact
                ? "gap-x-4 gap-y-1 text-[11px] pt-1"
                : "gap-x-6 gap-y-2 text-xs pt-2 font-bold text-emerald-950"
            }`}
          >
            {/* 攤平曲線 */}
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <span className="w-4 h-0.5 border-b-2 border-dashed border-slate-400 shrink-0" />
              <span>各批次攤平曲線（預定目標階梯）</span>
            </div>

            {/* 已購買／已到達 */}
            <div className="flex items-center gap-1.5 font-bold text-emerald-800">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-600 shrink-0" />
              <span>已購買／已到達價位（綠點）</span>
            </div>

            {/* 尚未觸發 */}
            <div className="flex items-center gap-1.5 font-bold text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-slate-400 bg-white shrink-0" />
              <span>尚未觸發（白底圓點）</span>
            </div>

            {/* 歷史交易紀錄 */}
            {showTrades && validTrades.length > 0 && (
              <div className="flex items-center gap-1.5 font-bold text-blue-800">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-white shrink-0" />
                <span>歷史交易紀錄 ({validTrades.length} 筆，懸停顯示價格)</span>
              </div>
            )}

            {/* 期權購買紀錄 (黑色虛線) */}
            {showStrikePrices && optionPurchaseRecords.length > 0 && (
              <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                <span className="w-4 h-0.5 border-b-2 border-dashed border-zinc-950 shrink-0" />
                <span>期權購買紀錄 ({optionPurchaseRecords.length} 筆 · 黑色虛線：行權價 / 合約金額 / 當前損益)</span>
              </div>
            )}

            {/* 提示點擊圓點查看拆分明細按鈕 */}
            <button
              type="button"
              onClick={() => {
                const target = sortedStepItems[0] || stepItems[0];
                if (target) setSelectedItem({ type: 'step', data: target });
              }}
              className="sm:ml-auto text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 hover:underline cursor-pointer bg-emerald-50/80 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200/80 transition-colors"
              title="點擊查看分批拆分交易階段明細"
            >
              <Layers className="w-3 h-3 text-emerald-600" />
              <span>點擊圖表圓點查看 4 批拆分交易明細</span>
            </button>
          </div>

          {/* 5. Selected Item Interactive Card (When element is clicked) */}
          {selectedItem && (
            <div className="p-3.5 sm:p-4 rounded-xl border bg-zinc-50 border-zinc-200/80 transition-all space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedItem.type === 'step' ? (
                    <>
                      <span className="px-2 py-0.5 rounded-md font-black text-xs bg-emerald-600 text-white">
                        {selectedItem.data.name}
                      </span>
                      <span className="text-xs font-bold text-zinc-800">
                        {selectedItem.data.subtitle} ({selectedItem.data.addPct !== undefined ? `+${selectedItem.data.addPct}%` : `-${selectedItem.data.dropPct}%`})
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          selectedItem.data.bought >= selectedItem.data.size && selectedItem.data.size > 0
                            ? 'bg-emerald-600 text-white'
                            : selectedItem.data.bought > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : selectedItem.data.isReached
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-zinc-200 text-zinc-700'
                        }`}
                      >
                        {selectedItem.data.bought >= selectedItem.data.size && selectedItem.data.size > 0
                          ? '已全數買入'
                          : selectedItem.data.bought > 0
                          ? '部分已購入'
                          : selectedItem.data.isReached
                          ? '已到達價位'
                          : '等待下跌觸發'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        className={`px-2 py-0.5 rounded-md font-black text-xs text-white ${
                          selectedItem.data.type === 'BUY' ? 'bg-blue-600' : 'bg-orange-600'
                        }`}
                      >
                        歷史{selectedItem.data.type === 'BUY' ? '買入' : '賣出'}
                      </span>
                      <span className="text-xs font-bold text-zinc-800">
                        {selectedItem.data.dateFormatted}
                      </span>
                      {selectedItem.data.batch && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                          {selectedItem.data.batch}
                        </span>
                      )}
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="text-xs text-zinc-400 hover:text-zinc-700 font-semibold cursor-pointer"
                >
                  關閉詳情
                </button>
              </div>

              {/* Data fields */}
              {selectedItem.type === 'step' ? (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white p-2 rounded-lg border border-zinc-200 shadow-2xs">
                      <span className="text-[10px] text-zinc-400 block font-medium">預計進場價</span>
                      <span className="text-sm font-black font-mono text-emerald-700">
                        ${selectedItem.data.price.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-zinc-200 shadow-2xs">
                      <span className="text-[10px] text-zinc-400 block font-medium">已購買 / 預購入</span>
                      <span className="text-sm font-black font-mono text-zinc-800">
                        已購 {selectedItem.data.bought} / 預購 {selectedItem.data.size} 股
                        {selectedItem.data.size > 0 && (
                          <span className="text-emerald-700 ml-1 text-xs">
                            ({Math.round((selectedItem.data.bought / selectedItem.data.size) * 100)}%)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-zinc-200 shadow-2xs">
                      <span className="text-[10px] text-zinc-400 block font-medium">配置佔比</span>
                      <span className="text-sm font-black font-mono text-zinc-800">
                        {selectedItem.data.percent}%
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-zinc-200 shadow-2xs flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-zinc-400 block font-medium">本梯次所需資金</span>
                        <span className="text-sm font-black font-mono text-zinc-800">
                          ${selectedItem.data.stepCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      {onBatchClick && (
                        <button
                          type="button"
                          onClick={() => {
                            const s1 = selectedItem.data.split1?.size || 0;
                            const s2 = selectedItem.data.split2?.size || 0;
                            onBatchClick(selectedItem.data.index, selectedItem.data.name, s1, s2);
                          }}
                          className="px-2 py-1 text-[11px] font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors cursor-pointer shrink-0"
                        >
                          帶入數量
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 拆分交易階段明細 (所處階段所需的個別股數 | 已購買 數量 | 預購買數量) */}
                  <div className="pt-2.5 border-t border-zinc-200/90 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
                        <span className="text-xs font-black text-zinc-900 tracking-tight">
                          {selectedItem.data.name} 拆分交易進度明細
                        </span>
                        <span className="text-[11px] text-zinc-500 font-medium hidden sm:inline">
                          (所處階段所需個別股數 ｜ 已購買 數量 ｜ 預購買數量)
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* 批次快速切換 Tabs */}
                        <div className="flex items-center bg-zinc-200/70 p-0.5 rounded-lg text-[11px]">
                          {sortedStepItems.map((st) => (
                            <button
                              key={st.index}
                              type="button"
                              onClick={() => setSelectedItem({ type: 'step', data: st })}
                              className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                                selectedItem.data.index === st.index
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/80'
                              }`}
                            >
                              {st.label}
                            </button>
                          ))}
                        </div>

                        {/* 展開/收合全部 4 批對照表按鈕 */}
                        <button
                          type="button"
                          onClick={() => setShowAllSplits((prev) => !prev)}
                          className="px-2 py-0.5 rounded-md text-[11px] font-bold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200 border border-emerald-300/80 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Layers className="w-3 h-3 text-emerald-700" />
                          <span>{showAllSplits ? '只看當前批次' : '展開全部 4 批對照'}</span>
                        </button>
                      </div>
                    </div>

                    {/* 當前批次雙拆分卡片 */}
                    {!showAllSplits ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {/* Split 1 */}
                        <div className="p-3 bg-white rounded-xl border border-emerald-200/90 shadow-2xs space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-black">
                                {selectedItem.data.split1.name}
                              </span>
                              <span className="text-[11px] font-bold text-zinc-500">
                                佔比 {selectedItem.data.split1.percent}
                              </span>
                            </div>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded ${
                                selectedItem.data.split1.bought >= selectedItem.data.split1.size && selectedItem.data.split1.size > 0
                                  ? 'bg-emerald-600 text-white'
                                  : selectedItem.data.split1.bought > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-zinc-100 text-zinc-600'
                              }`}
                            >
                              {selectedItem.data.split1.bought >= selectedItem.data.split1.size && selectedItem.data.split1.size > 0
                                ? '已全數買入'
                                : selectedItem.data.split1.bought > 0
                                ? `已購 ${Math.round((selectedItem.data.split1.bought / selectedItem.data.split1.size) * 100)}%`
                                : '尚未購買'}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-200/70">
                              <span className="text-[10px] text-zinc-500 block font-medium">所處階段所需個別股數</span>
                              <span className="text-sm font-black font-mono text-zinc-900 mt-0.5 block">
                                {selectedItem.data.split1.size} 股
                              </span>
                            </div>
                            <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-200/70">
                              <span className="text-[10px] text-emerald-700 block font-bold">已購買 數量</span>
                              <span className="text-sm font-black font-mono text-emerald-800 mt-0.5 block">
                                {selectedItem.data.split1.bought} 股
                              </span>
                            </div>
                            <div className="bg-amber-50/70 p-2 rounded-lg border border-amber-200/70">
                              <span className="text-[10px] text-amber-700 block font-bold">預購買數量</span>
                              <span className="text-sm font-black font-mono text-amber-900 mt-0.5 block">
                                {selectedItem.data.split1.remaining} 股
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Split 2 */}
                        <div className="p-3 bg-white rounded-xl border border-emerald-200/90 shadow-2xs space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-black">
                                {selectedItem.data.split2.name}
                              </span>
                              <span className="text-[11px] font-bold text-zinc-500">
                                佔比 {selectedItem.data.split2.percent}
                              </span>
                            </div>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded ${
                                selectedItem.data.split2.bought >= selectedItem.data.split2.size && selectedItem.data.split2.size > 0
                                  ? 'bg-emerald-600 text-white'
                                  : selectedItem.data.split2.bought > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-zinc-100 text-zinc-600'
                              }`}
                            >
                              {selectedItem.data.split2.bought >= selectedItem.data.split2.size && selectedItem.data.split2.size > 0
                                ? '已全數買入'
                                : selectedItem.data.split2.bought > 0
                                ? `已購 ${Math.round((selectedItem.data.split2.bought / selectedItem.data.split2.size) * 100)}%`
                                : '尚未購買'}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-200/70">
                              <span className="text-[10px] text-zinc-500 block font-medium">所處階段所需個別股數</span>
                              <span className="text-sm font-black font-mono text-zinc-900 mt-0.5 block">
                                {selectedItem.data.split2.size} 股
                              </span>
                            </div>
                            <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-200/70">
                              <span className="text-[10px] text-emerald-700 block font-bold">已購買 數量</span>
                              <span className="text-sm font-black font-mono text-emerald-800 mt-0.5 block">
                                {selectedItem.data.split2.bought} 股
                              </span>
                            </div>
                            <div className="bg-amber-50/70 p-2 rounded-lg border border-amber-200/70">
                              <span className="text-[10px] text-amber-700 block font-bold">預購買數量</span>
                              <span className="text-sm font-black font-mono text-amber-900 mt-0.5 block">
                                {selectedItem.data.split2.remaining} 股
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {sortedStepItems.map((step) => (
                          <div
                            key={step.index}
                            className={
                              selectedItem.data.index === step.index
                                ? 'p-2.5 bg-white rounded-xl border transition-all border-emerald-500 ring-2 ring-emerald-400/30 shadow-sm'
                                : 'p-2.5 bg-white rounded-xl border transition-all border-zinc-200/90 shadow-2xs'
                            }
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded font-black text-xs bg-emerald-700 text-white">
                                  {step.name}
                                </span>
                                <span className="text-xs font-bold text-zinc-700">
                                  目標進場價 ${step.price.toFixed(2)} ({step.addPct !== undefined ? `+${step.addPct}%` : `-${step.dropPct}%`})
                                </span>
                                <span className="text-[11px] text-zinc-500 font-mono">
                                  總預購: {step.size} 股 ｜ 總已購: {step.bought} 股
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedItem({ type: 'step', data: step })}
                                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                              >
                                切換至此批
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {/* Sub Split 1 */}
                              <div className="p-2 bg-zinc-50/80 rounded-lg border border-zinc-200/60">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-black text-xs text-zinc-800">
                                    {step.split1.name}
                                  </span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-zinc-200 text-zinc-700">
                                    佔比 {step.split1.percent}
                                  </span>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                                  <div className="bg-white p-1 rounded border border-zinc-200/60">
                                    <span className="text-[9px] text-zinc-400 block">所需個別股數</span>
                                    <span className="font-mono font-black text-zinc-800 text-xs">
                                      {step.split1.size} 股
                                    </span>
                                  </div>
                                  <div className="bg-emerald-50/80 p-1 rounded border border-emerald-100">
                                    <span className="text-[9px] text-emerald-700 block font-medium">已購買 數量</span>
                                    <span className="font-mono font-black text-emerald-800 text-xs">
                                      {step.split1.bought} 股
                                    </span>
                                  </div>
                                  <div className="bg-amber-50/80 p-1 rounded border border-amber-100">
                                    <span className="text-[9px] text-amber-700 block font-medium">預購買數量</span>
                                    <span className="font-mono font-black text-amber-900 text-xs">
                                      {step.split1.remaining} 股
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Sub Split 2 */}
                              <div className="p-2 bg-zinc-50/80 rounded-lg border border-zinc-200/60">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-black text-xs text-zinc-800">
                                    {step.split2.name}
                                  </span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-zinc-200 text-zinc-700">
                                    佔比 {step.split2.percent}
                                  </span>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                                  <div className="bg-white p-1 rounded border border-zinc-200/60">
                                    <span className="text-[9px] text-zinc-400 block">所需個別股數</span>
                                    <span className="font-mono font-black text-zinc-800 text-xs">
                                      {step.split2.size} 股
                                    </span>
                                  </div>
                                  <div className="bg-emerald-50/80 p-1 rounded border border-emerald-100">
                                    <span className="text-[9px] text-emerald-700 block font-medium">已購買 數量</span>
                                    <span className="font-mono font-black text-emerald-800 text-xs">
                                      {step.split2.bought} 股
                                    </span>
                                  </div>
                                  <div className="bg-amber-50/80 p-1 rounded border border-amber-100">
                                    <span className="text-[9px] text-amber-700 block font-medium">預購買數量</span>
                                    <span className="font-mono font-black text-amber-900 text-xs">
                                      {step.split2.remaining} 股
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div className="bg-white p-2 rounded-lg border border-zinc-200 shadow-2xs">
                    <span className="text-[10px] text-zinc-400 block font-medium">成交價格</span>
                    <span className="text-sm font-black font-mono text-blue-700">
                      ${selectedItem.data.price.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-zinc-200 shadow-2xs">
                    <span className="text-[10px] text-zinc-400 block font-medium">成交數量</span>
                    <span className="text-sm font-black font-mono text-zinc-800">
                      {selectedItem.data.quantity} 股
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-zinc-200 shadow-2xs">
                    <span className="text-[10px] text-zinc-400 block font-medium">成交總額</span>
                    <span className="text-sm font-black font-mono text-zinc-800">
                      ${(selectedItem.data.price * selectedItem.data.quantity).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-zinc-200 shadow-2xs">
                    <span className="text-[10px] text-zinc-400 block font-medium">經手人員 / 目的</span>
                    <span className="text-xs font-bold text-zinc-700">
                      {selectedItem.data.operator || '人'} ・ {selectedItem.data.purpose || '加碼'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 內建模擬預購單管理對話窗 (支援在 Primial 視窗或任何獨立圖表內直接新增與刪除預購單) */}
          {isLocalPreOrderModalOpen && (
            <div
              className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
              onClick={() => setIsLocalPreOrderModalOpen(false)}
            >
              <div
                className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-zinc-200 p-5 text-zinc-900 space-y-4 animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#00F5E2] shadow-[0_0_8px_#00F5E2]" />
                    <h4 className="font-bold text-base text-zinc-900">
                      模擬預購單管理 {symbol ? `(${symbol})` : ''}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLocalPreOrderModalOpen(false)}
                    className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {currentPrice > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-zinc-500">快速填入參考價位 (現價 ${currentPrice.toFixed(2)})：</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { label: '-3%', factor: 0.97 },
                        { label: '-6%', factor: 0.94 },
                        { label: '-9%', factor: 0.91 },
                        { label: '現價', factor: 1.0 },
                        { label: '+2%', factor: 1.02 },
                        { label: '+4%', factor: 1.04 },
                      ].map((preset) => {
                        const val = (currentPrice * preset.factor).toFixed(2);
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setLocalPreOrderPrice(val)}
                            className={`px-2 py-1 text-xs rounded-lg border font-mono cursor-pointer transition-all ${
                              localPreOrderPrice === val
                                ? 'bg-[#00F5E2]/25 border-[#00F5E2] text-[#006e64] font-bold'
                                : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                            }`}
                          >
                            {preset.label} (${val})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-bold text-zinc-700 block mb-1">預購價格 ($) *</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="例如 75.50"
                      value={localPreOrderPrice}
                      onChange={(e) => setLocalPreOrderPrice(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#00F5E2]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-700 block mb-1">預購股數 (股)</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      placeholder="100"
                      value={localPreOrderQty}
                      onChange={(e) => setLocalPreOrderQty(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#00F5E2]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-600 block mb-1">備註 (選填)</label>
                  <input
                    type="text"
                    placeholder="例如：第一批回踩支撐預購"
                    value={localPreOrderNotes}
                    onChange={(e) => setLocalPreOrderNotes(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#00F5E2]"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleLocalAddPreOrder}
                  disabled={!localPreOrderPrice || parseFloat(localPreOrderPrice) <= 0}
                  className="w-full py-2 rounded-xl bg-[#008f84] hover:bg-[#007065] disabled:opacity-40 text-white font-bold text-xs transition-all cursor-pointer"
                >
                  + 新增插入模擬預購單
                </button>

                <div className="pt-2 border-t border-zinc-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-700">
                      目前已設定預購單 ({effectivePreOrders.length} 筆)：
                    </span>
                    {effectivePreOrders.length > 1 && symbol && (
                      <button
                        type="button"
                        onClick={() => {
                          clearAllSimulatedPreOrders(symbol, effectivePreOrders);
                          setPreOrdersSyncTick((t) => t + 1);
                        }}
                        className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>全部清除</span>
                      </button>
                    )}
                  </div>
                  {effectivePreOrders.length === 0 ? (
                    <div className="text-xs text-zinc-400 py-3 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                      尚無模擬預購單
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {effectivePreOrders.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-cyan-50/60 border border-[#00F5E2]/40 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-[#00F5E2] shrink-0" />
                            <span className="font-bold font-mono text-zinc-900">${item.price.toFixed(2)}</span>
                            {item.quantity > 0 && (
                              <span className="text-zinc-500 font-mono">({item.quantity} 股)</span>
                            )}
                            {item.notes && (
                              <span className="text-[11px] text-zinc-400 truncate max-w-[120px]">
                                {String(item.notes).replace(/^\[模擬預購單\]\s*/, '')}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleLocalDeletePreOrder(item.id, item.price)}
                            className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>刪除</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
