import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ArrowLeft,
  Layers,
  Split,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FolderTree,
} from "lucide-react";
import { System2PlanningChart } from "./System2PlanningChart";
import {
  ReturnRateStepFilter,
  PNL_STEP_TICKS,
  getStepBracketBounds,
} from "./ReturnRateStepFilter";
import {
  calculateBatchPlanning,
  calculateStats,
  calculateOptionPortfolioSummary,
  generateAveragingDownRows,
  generatePyramidUpRows,
} from "../lib/calculations";
import { getVisualPriceLevels } from "../lib/visualLevels";
import { playClickSound, playSwipeSound } from "../lib/audio";
import { Trade } from "../types";

export interface PrimialPyramidViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  allTabs: any[];
  selectedCardIds?: Set<string>;
  currentHoldingSubTab?: string;
  onSelectHoldingSubTab?: (subTab: string) => void;
  currentViewTab?: string;
  onSelectViewTab?: (viewTab: any) => void;
  tradesMap?: Record<string, Trade[]>;
  strategiesMap?: Record<string, any>;
  ordersMap?: Record<string, any[]>;
  totalCapital: number;
  virtualCapital: number;
  maxStrategyRiskPool60: number;
  initialDirection?: "gain" | "loss";
  initialSelectedBracket?: number | null;
  initialStockId?: string | null;
  initialStockSymbol?: string | null;
  onNavigateToDetail?: (tabId: string) => void;
}

const getDisplayHoldingStatus = (
  status: string | undefined
): "觀察中" | "候選名單" | "買進操作" | "賣出操作" | "平倉操作" | "乖離名單" => {
  if (
    status === "觀察中" ||
    status === "買進操作" ||
    status === "賣出操作" ||
    status === "平倉操作" ||
    status === "乖離名單"
  )
    return status;
  return "候選名單";
};

// 判斷該卡片在個股卡片上是否有打勾
const isTabCardChecked = (tab: any, cardSelection?: Set<string>): boolean => {
  if (!tab) return false;
  if (cardSelection && cardSelection.has(tab.id)) return true;
  if (tab.isSelected === true || tab.checked === true || tab.isChecked === true) return true;
  return false;
};

// 若剛好有兩個相同的股票名稱在同一目錄下，顯示個股卡片有打勾的既可
const filterDuplicateSameSymbolTabs = (tabs: any[], cardSelection?: Set<string>): any[] => {
  const groups = new Map<string, any[]>();
  tabs.forEach((tab) => {
    const sym = (tab?.symbol || "").trim().toUpperCase();
    if (!sym) return;
    if (!groups.has(sym)) {
      groups.set(sym, []);
    }
    groups.get(sym)!.push(tab);
  });

  const result: any[] = [];
  const seen = new Set<string>();
  tabs.forEach((tab) => {
    const sym = (tab?.symbol || "").trim().toUpperCase();
    if (!sym || seen.has(sym)) return;
    seen.add(sym);

    const group = groups.get(sym)!;
    if (group.length <= 1) {
      result.push(group[0]);
    } else {
      // 優先尋找個股卡片有打勾的
      const checkedTab = group.find((t) => isTabCardChecked(t, cardSelection));
      if (checkedTab) {
        result.push(checkedTab);
      } else {
        // 若都未打勾，則優先保留有實際持股或交易記錄的卡片，次之保留首檔
        const withHolding = group.find(
          (t) => (t.holdingQuantity && t.holdingQuantity > 0) || (t.trades && t.trades.length > 0)
        );
        result.push(withHolding || group[0]);
      }
    }
  });

  return result;
};

export const PrimialPyramidViewModal: React.FC<PrimialPyramidViewModalProps> = ({
  isOpen,
  onClose,
  allTabs = [],
  selectedCardIds,
  currentHoldingSubTab = "候選名單",
  onSelectHoldingSubTab,
  currentViewTab = "active",
  onSelectViewTab,
  tradesMap = {},
  strategiesMap = {},
  ordersMap = {},
  totalCapital,
  virtualCapital,
  maxStrategyRiskPool60,
  initialDirection = "gain",
  initialSelectedBracket = null,
  initialStockId = null,
  initialStockSymbol = null,
  onNavigateToDetail,
}) => {
  // 階梯軸過濾方向與級距狀態 (在 Primial 頂部內建，支援即時切換)
  const [direction, setDirection] = useState<"gain" | "loss">(initialDirection);
  const [selectedBracket, setSelectedBracket] = useState<number | null>(initialSelectedBracket);

  // 上一層級目錄狀態 (虛擬交易 vs 真實交易 vs 全部, 及所屬子目錄)
  const [activeDirectory, setActiveDirectory] = useState<{
    type: "virtual" | "real" | "all";
    subTab: string;
  }>({
    type: currentViewTab === "real" ? "real" : "virtual",
    subTab: currentHoldingSubTab || "候選名單",
  });
  const [isDirectoryMenuOpen, setIsDirectoryMenuOpen] = useState(false);
  const directoryDropdownRef = useRef<HTMLDivElement>(null);

  // 全域防線與線條控制開關
  const [pyramidShowStrikePrices, setPyramidShowStrikePrices] = useState<boolean>(false);
  const [pyramidShowCardDividers, setPyramidShowCardDividers] = useState<boolean>(false);
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

  // 個股卡片展開/收合狀態 (tabId -> boolean)
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});

  // 勾選的個股 TabId 清單 (預設全選符合條件的股票，亦可手動取消或全選)
  const [selectedTabIds, setSelectedTabIds] = useState<Set<string>>(new Set());
  const [hasInitializedSelection, setHasInitializedSelection] = useState<boolean>(false);

  // 當前選取/查看中的股票 Tab ID (用於下方導覽列黑線指示與滾動定位)
  const [activeJumpId, setActiveJumpId] = useState<string | null>(null);

  // 容器與導覽列 Ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const navTrackScrollRef = useRef<HTMLDivElement>(null);
  const navTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimeoutRef = useRef<any>(null);

  // 導覽列滑鼠拖曳橫向滾動 (Drag and Scroll)
  const isDraggingNavRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);
  const hasDraggedBeyondThresholdRef = useRef(false);
  const [isNavDragging, setIsNavDragging] = useState(false);

  const handleNavMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !navTrackScrollRef.current) return;
    isDraggingNavRef.current = true;
    dragStartXRef.current = e.pageX - navTrackScrollRef.current.getBoundingClientRect().left;
    dragScrollLeftRef.current = navTrackScrollRef.current.scrollLeft;
    hasDraggedBeyondThresholdRef.current = false;
  };

  const handleNavMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingNavRef.current || !navTrackScrollRef.current) return;
    const currentX = e.pageX - navTrackScrollRef.current.getBoundingClientRect().left;
    const walk = currentX - dragStartXRef.current;

    if (Math.abs(walk) > 4) {
      hasDraggedBeyondThresholdRef.current = true;
      if (!isNavDragging) setIsNavDragging(true);
    }

    if (hasDraggedBeyondThresholdRef.current) {
      e.preventDefault();
      navTrackScrollRef.current.scrollLeft = dragScrollLeftRef.current - walk;
    }
  };

  const handleNavMouseUpOrLeave = () => {
    if (!isDraggingNavRef.current) return;
    isDraggingNavRef.current = false;
    setTimeout(() => {
      setIsNavDragging(false);
      hasDraggedBeyondThresholdRef.current = false;
    }, 60);
  };

  const handleNavWheel = (e: React.WheelEvent) => {
    if (!navTrackScrollRef.current) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) > 0) {
      e.preventDefault();
      navTrackScrollRef.current.scrollLeft += delta;
    }
  };

  // 依據傳入的 currentViewTab 和 currentHoldingSubTab 初始化目錄
  useEffect(() => {
    if (isOpen) {
      setActiveDirectory({
        type: currentViewTab === "real" ? "real" : "virtual",
        subTab: currentHoldingSubTab || "候選名單",
      });
    }
  }, [isOpen, currentViewTab, currentHoldingSubTab]);

  // 點擊目錄下拉選單外部自動關閉
  useEffect(() => {
    if (!isDirectoryMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        directoryDropdownRef.current &&
        !directoryDropdownRef.current.contains(e.target as Node)
      ) {
        setIsDirectoryMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDirectoryMenuOpen]);

  // 切換上一層級目錄
  const handleSwitchDirectory = useCallback(
    (type: "virtual" | "real" | "all", subTab: string) => {
      playClickSound();
      setActiveDirectory({ type, subTab });
      setIsDirectoryMenuOpen(false);
      setSelectedBracket(null); // 切換目錄時自動重設階梯軸為「全部」，避免被特定級距擋住

      // 檢查目標目錄中個股的獲利/虧損分佈，自動校正 direction 方向
      const validTabs = (allTabs || []).filter(
        (t) => t && t.status === "ACTIVE" && t.symbol && !t.isHidden
      );
      let targetTabs = validTabs;
      if (type === "virtual") {
        targetTabs = validTabs.filter((t) => t.tradeType === "simulated" || !t.tradeType);
      } else if (type === "real") {
        targetTabs = validTabs.filter((t) => t.tradeType === "real");
      }
      if (subTab !== "全部") {
        targetTabs = targetTabs.filter((t) => getDisplayHoldingStatus(t.holdingStatus) === subTab);
      }

      if (targetTabs.length > 0) {
        let hasGain = false;
        let hasLoss = false;
        targetTabs.forEach((tab) => {
          const cur = Number(tab.currentPrice || 0);
          const avg = Number(tab.averageCost || 0);
          const ret = avg > 0 && cur > 0 ? ((cur - avg) / avg) * 100 : 0;
          if (ret >= 0) hasGain = true;
          else hasLoss = true;
        });

        if (direction === "gain" && !hasGain && hasLoss) {
          setDirection("loss");
        } else if (direction === "loss" && !hasLoss && hasGain) {
          setDirection("gain");
        }

        // 同步勾選新目錄的所有個股 ID
        setSelectedTabIds(new Set(targetTabs.map((t) => t.id)));
      } else {
        setSelectedTabIds(new Set());
      }

      if (type === "real") {
        onSelectViewTab?.("real");
        if (subTab !== "全部") onSelectHoldingSubTab?.(subTab);
      } else if (type === "virtual") {
        onSelectViewTab?.("active");
        if (subTab !== "全部") onSelectHoldingSubTab?.(subTab);
      }
    },
    [allTabs, direction, onSelectViewTab, onSelectHoldingSubTab]
  );

  // 鍵盤快捷鍵：Esc 或 Alt + Z 關閉，Alt + T / B / D / R / P，以及 Alt + 1..5 / Ctrl + Shift + 1..4 目錄切換
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        activeEl?.getAttribute("contenteditable") === "true";
      if (isInput) return;

      // 關閉：Esc 或 Alt + Z
      if (
        e.key === "Escape" ||
        (e.altKey && (e.key === "z" || e.key === "Z" || e.code === "KeyZ"))
      ) {
        e.preventDefault();
        onClose();
        return;
      }

      // Alt + T: 攤平
      if (e.altKey && !e.ctrlKey && !e.shiftKey && (e.key === "t" || e.key === "T" || e.code === "KeyT")) {
        e.preventDefault();
        setPyramidCalcMode("averaging");
        playClickSound();
        return;
      }

      // Alt + B: 突破價位
      if (e.altKey && !e.ctrlKey && !e.shiftKey && (e.key === "b" || e.key === "B" || e.code === "KeyB")) {
        e.preventDefault();
        setPyramidCalcMode("breakout");
        playClickSound();
        return;
      }

      // Alt + D: 分隔線
      if (e.altKey && !e.ctrlKey && !e.shiftKey && (e.key === "d" || e.key === "D" || e.code === "KeyD")) {
        e.preventDefault();
        setPyramidShowCardDividers((prev) => !prev);
        playClickSound();
        return;
      }

      // Alt + R: 支撐
      if (e.altKey && !e.ctrlKey && !e.shiftKey && (e.key === "r" || e.key === "R" || e.code === "KeyR")) {
        e.preventDefault();
        setPyramidLevelTypes((prev) => ({ ...prev, support: !prev.support }));
        playClickSound();
        return;
      }

      // Alt + P: 壓力
      if (e.altKey && !e.ctrlKey && !e.shiftKey && (e.key === "p" || e.key === "P" || e.code === "KeyP")) {
        e.preventDefault();
        setPyramidLevelTypes((prev) => ({ ...prev, resistance: !prev.resistance }));
        playClickSound();
        return;
      }

      // --- 快捷鍵切換目錄 ---
      // 虛擬交易: Alt + 1/2/3/4/5
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (e.code === "Digit1" || e.key === "1" || e.key === "¡") {
          e.preventDefault();
          handleSwitchDirectory("virtual", "觀察中");
          return;
        }
        if (e.code === "Digit2" || e.key === "2" || e.key === "™") {
          e.preventDefault();
          handleSwitchDirectory("virtual", "候選名單");
          return;
        }
        if (e.code === "Digit3" || e.key === "3" || e.key === "£") {
          e.preventDefault();
          handleSwitchDirectory("virtual", "買進操作");
          return;
        }
        if (e.code === "Digit4" || e.key === "4" || e.key === "¢") {
          e.preventDefault();
          handleSwitchDirectory("virtual", "賣出操作");
          return;
        }
        if (e.code === "Digit5" || e.key === "5" || e.key === "∞") {
          e.preventDefault();
          handleSwitchDirectory("virtual", "乖離名單");
          return;
        }
        // 全部目錄: Alt + 0 或 Alt + ↑
        if (e.code === "Digit0" || e.key === "0" || e.key === "º" || e.key === "ArrowUp") {
          e.preventDefault();
          handleSwitchDirectory("all", "全部");
          return;
        }
      }

      // 真實交易: Ctrl + Shift + 1/2/3/4
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey) {
        if (e.code === "Digit1" || e.key === "!" || e.key === "1") {
          e.preventDefault();
          handleSwitchDirectory("real", "觀察中");
          return;
        }
        if (e.code === "Digit2" || e.key === "@" || e.key === "2") {
          e.preventDefault();
          handleSwitchDirectory("real", "候選名單");
          return;
        }
        if (e.code === "Digit3" || e.key === "#" || e.key === "3") {
          e.preventDefault();
          handleSwitchDirectory("real", "買進操作");
          return;
        }
        if (e.code === "Digit4" || e.key === "$" || e.key === "4") {
          e.preventDefault();
          handleSwitchDirectory("real", "賣出操作");
          return;
        }
      }

      // 主模式切換: Shift + 1 (虛擬交易) / Shift + 2 (真實交易)
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.code === "Digit1" || e.key === "!") {
          e.preventDefault();
          handleSwitchDirectory("virtual", activeDirectory.subTab || "候選名單");
          return;
        }
        if (e.code === "Digit2" || e.key === "@") {
          e.preventDefault();
          handleSwitchDirectory("real", activeDirectory.subTab === "乖離名單" ? "候選名單" : activeDirectory.subTab || "候選名單");
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, activeDirectory, handleSwitchDirectory]);

  // 依當前選擇的目錄（上一層級）過濾股票清單（若剛好有兩個相同的股票名稱在同一目錄下，顯示個股卡片有打勾的既可）
  const directoryTabs = useMemo(() => {
    const validTabs = (allTabs || []).filter(
      (t) => t && t.status === "ACTIVE" && t.symbol && !t.isHidden
    );

    let rawList: any[] = [];
    if (activeDirectory.type === "all") {
      if (activeDirectory.subTab === "全部") rawList = validTabs;
      else {
        rawList = validTabs.filter(
          (t) => getDisplayHoldingStatus(t.holdingStatus) === activeDirectory.subTab
        );
      }
    } else if (activeDirectory.type === "virtual") {
      const virtualTabs = validTabs.filter(
        (t) => t.tradeType === "simulated" || !t.tradeType
      );
      if (activeDirectory.subTab === "全部") rawList = virtualTabs;
      else {
        rawList = virtualTabs.filter(
          (t) => getDisplayHoldingStatus(t.holdingStatus) === activeDirectory.subTab
        );
      }
    } else if (activeDirectory.type === "real") {
      const realTabs = validTabs.filter((t) => t.tradeType === "real");
      if (activeDirectory.subTab === "全部") rawList = realTabs;
      else {
        rawList = realTabs.filter(
          (t) => getDisplayHoldingStatus(t.holdingStatus) === activeDirectory.subTab
        );
      }
    } else {
      rawList = validTabs;
    }

    return filterDuplicateSameSymbolTabs(rawList, selectedCardIds);
  }, [allTabs, activeDirectory, selectedCardIds]);

  // 目錄統計數字 (方便在選單中顯示檔數，同步採用去重後的真實可顯示檔數)
  const directoryCounts = useMemo(() => {
    const validTabs = filterDuplicateSameSymbolTabs(
      (allTabs || []).filter((t) => t && t.status === "ACTIVE" && t.symbol && !t.isHidden),
      selectedCardIds
    );
    const virtualTabs = validTabs.filter(
      (t) => t.tradeType === "simulated" || !t.tradeType
    );
    const realTabs = validTabs.filter((t) => t.tradeType === "real");

    const getCount = (arr: any[], sub: string) => {
      if (sub === "全部") return arr.length;
      return arr.filter((t) => getDisplayHoldingStatus(t.holdingStatus) === sub).length;
    };

    return {
      allTotal: validTabs.length,
      virtual: {
        total: virtualTabs.length,
        "觀察中": getCount(virtualTabs, "觀察中"),
        "候選名單": getCount(virtualTabs, "候選名單"),
        "買進操作": getCount(virtualTabs, "買進操作"),
        "賣出操作": getCount(virtualTabs, "賣出操作"),
        "乖離名單": getCount(virtualTabs, "乖離名單"),
      },
      real: {
        total: realTabs.length,
        "觀察中": getCount(realTabs, "觀察中"),
        "候選名單": getCount(realTabs, "候選名單"),
        "買進操作": getCount(realTabs, "買進操作"),
        "賣出操作": getCount(realTabs, "賣出操作"),
      },
    };
  }, [allTabs, selectedCardIds]);

  const currentDirectoryLabel = useMemo(() => {
    if (activeDirectory.type === "all") {
      return activeDirectory.subTab === "全部" ? "全部目錄" : `全部 · ${activeDirectory.subTab}`;
    }
    const mainName = activeDirectory.type === "virtual" ? "虛擬" : "真實";
    return `${mainName} · ${activeDirectory.subTab}`;
  }, [activeDirectory]);

  // 計算每一檔 active tab 的報酬率與數據包
  const activeTabsList = directoryTabs;

  const stockDataMap = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        tab: any;
        cleanSym: string;
        companyName: string;
        currentPrice: number;
        holdingAvgPrice: number;
        holdingQty: number;
        returnPercentage: number;
        unrealizedPnL: number;
        trades: Trade[];
        strategy: any;
        plannedOrders: any[];
        usableCapital: number;
        plannedQty: number;
        batches: any[];
        averagingRowsSys2: any[];
        pyramidRows: any[];
        visualLevels: any[];
      }
    >();

    activeTabsList.forEach((tab) => {
      const cleanSym = (tab.symbol || "").trim().toUpperCase();
      if (!cleanSym) return;

      const tabId = tab.id || cleanSym;
      const strategy = strategiesMap[tabId] || strategiesMap[cleanSym] || tab.strategy || {};
      const plannedOrders = ordersMap[tabId] || ordersMap[cleanSym] || tab.plannedOrders || [];
      const trades = tradesMap[tabId] || tradesMap[cleanSym] || tab.trades || [];

      const currentPrice = Number(tab.currentPrice || 0);
      const stats = calculateStats(trades, currentPrice);
      const effectiveHoldingQty =
        stats.totalQuantity !== 0 ? stats.totalQuantity : tab.holdingQuantity || 0;
      const effectiveAvgPrice =
        stats.totalQuantity !== 0 && stats.averagePrice > 0
          ? stats.averagePrice
          : tab.averageCost || 0;

      const optionSummary = calculateOptionPortfolioSummary(
        trades,
        currentPrice,
        tab.optionsCalcData
      );

      const stockHoldingCost = effectiveHoldingQty * effectiveAvgPrice;
      const totalCostBasis =
        stockHoldingCost +
        (optionSummary.hasOptionRecords ? optionSummary.totalHoldingCost : 0);
      const stockUnrealizedPnL =
        stats.unrealizedPnL !== 0
          ? stats.unrealizedPnL
          : effectiveHoldingQty > 0 && effectiveAvgPrice > 0 && currentPrice > 0
          ? (currentPrice - effectiveAvgPrice) * effectiveHoldingQty
          : 0;
      const totalCombinedPnL =
        stockUnrealizedPnL +
        (optionSummary.hasOptionRecords ? optionSummary.totalCurrentPnL : 0);

      let returnPercentage = 0;
      if (totalCostBasis > 0) {
        returnPercentage = (totalCombinedPnL / totalCostBasis) * 100;
      } else if (effectiveAvgPrice > 0 && effectiveHoldingQty > 0 && currentPrice > 0) {
        returnPercentage =
          ((currentPrice - effectiveAvgPrice) / effectiveAvgPrice) * 100;
      } else if (
        optionSummary.hasOptionRecords &&
        optionSummary.totalHoldingCost > 0
      ) {
        returnPercentage = optionSummary.totalRoiPct;
      }

      const calculatedUnrealizedPnL = totalCombinedPnL;

      const isSimulated = tab.tradeType === "simulated";
      const usableCapital = isSimulated ? virtualCapital : totalCapital;
      const currentRiskPool =
        maxStrategyRiskPool60 && maxStrategyRiskPool60 > 0 ? maxStrategyRiskPool60 : 100000;

      const { sys2: defaultSys2 } = generateAveragingDownRows(
        effectiveAvgPrice > 0 ? effectiveAvgPrice : currentPrice
      );
      const { sys1: defaultUp1 } = generatePyramidUpRows(
        effectiveAvgPrice > 0 ? effectiveAvgPrice : currentPrice
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
          : tab?.averagingRows && Array.isArray(tab.averagingRows) && tab.averagingRows.length > 0
          ? tab.averagingRows
          : defaultUp1;

      const activeRows = pyramidCalcMode === "breakout" ? pyramidRows : averagingRowsSys2;

      let plannedQty = 0;
      const plannedPercent =
        tab?.plannedBuyPercent !== undefined && tab?.plannedBuyPercent !== null && !isNaN(Number(tab.plannedBuyPercent))
          ? Number(tab.plannedBuyPercent)
          : 0;
      if (currentPrice > 0 && plannedPercent > 0) {
        plannedQty = Math.floor((currentRiskPool * (plannedPercent / 100)) / currentPrice);
      } else if (tab?.plannedBuyQty && Number(tab.plannedBuyQty) > 0) {
        plannedQty = Number(tab.plannedBuyQty);
      }

      if (plannedQty <= 0 && activeRows && activeRows.length > 0) {
        const rowsSum = activeRows.reduce((acc: number, r: any) => {
          const q1 = r?.quantity ? parseFloat(r.quantity) : 0;
          const q2 = r?.quantity2 ? parseFloat(r.quantity2) : 0;
          return acc + (isNaN(q1) ? 0 : q1) + (isNaN(q2) ? 0 : q2);
        }, 0);
        if (rowsSum > 0) plannedQty = rowsSum;
      }

      const buyTradesSum = (trades || [])
        .filter((t: any) => t.type === 'BUY' && !t.isOptionTrade)
        .reduce((sum: number, t: any) => sum + (Number(t.quantity) || 0), 0);
      const benchmarkHold = Math.max(effectiveHoldingQty, buyTradesSum);
      if (benchmarkHold > 0 && benchmarkHold > plannedQty) {
        plannedQty = Math.max(plannedQty, benchmarkHold, Math.ceil(benchmarkHold / 0.15));
      } else if (plannedQty <= 0 && effectiveHoldingQty > 0) {
        plannedQty = Math.max(effectiveHoldingQty, Math.ceil(effectiveHoldingQty / 0.15));
      }

      const planResult = calculateBatchPlanning({
        plannedQty,
        usableCapital,
        currentPrice,
        holdingQty: effectiveHoldingQty,
        trades,
        averagingRowsSys2: activeRows,
        plannedBuyQty: tab?.plannedBuyQty ? Number(tab.plannedBuyQty) : undefined,
        plannedBuyPercent:
          tab?.plannedBuyPercent !== undefined && tab?.plannedBuyPercent !== null
            ? Number(tab.plannedBuyPercent)
            : undefined,
        tradeType: tab?.tradeType,
        maxStrategyRiskPool60,
      });

      const batches = planResult?.batches || [];
      const visualLevels = getVisualPriceLevels(tab, strategy, plannedOrders);
      const companyName = tab.companyName || tab.name || cleanSym;

      map.set(tabId, {
        id: tabId,
        tab,
        cleanSym,
        companyName,
        currentPrice,
        holdingAvgPrice: effectiveAvgPrice,
        holdingQty: effectiveHoldingQty,
        returnPercentage,
        unrealizedPnL: calculatedUnrealizedPnL,
        trades,
        strategy,
        plannedOrders,
        usableCapital,
        plannedQty: planResult?.plannedQty || plannedQty,
        batches,
        averagingRowsSys2,
        pyramidRows,
        visualLevels,
      });
    });

    return map;
  }, [
    activeTabsList,
    strategiesMap,
    ordersMap,
    tradesMap,
    pyramidCalcMode,
    totalCapital,
    virtualCapital,
    maxStrategyRiskPool60,
  ]);

  // 計算每個階梯軸 (2%, 3%, 5%, 8%, 10%, 15%) 的檔數計數，提供給 ReturnRateStepFilter
  const bracketCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const stepValues = [2, 3, 5, 8, 10, 15];

    let allDirectionCount = 0;
    stockDataMap.forEach((data) => {
      const ret = data.returnPercentage;
      if (direction === "gain" ? ret >= 0 : ret < 0) {
        allDirectionCount++;
      }
    });
    counts.all = allDirectionCount;

    stepValues.forEach((val) => {
      const bounds = getStepBracketBounds(val);
      if (!bounds) return;

      let c = 0;
      stockDataMap.forEach((data) => {
        const ret = data.returnPercentage;
        if (direction === "gain") {
          if (ret >= 0 && ret >= bounds.min && ret < bounds.max) {
            c++;
          }
        } else {
          // loss direction: 絕對值在區間內且 ret < 0
          const absRet = Math.abs(ret);
          if (ret < 0 && absRet >= bounds.min && absRet < bounds.max) {
            c++;
          }
        }
      });

      counts[String(val)] = c;
    });

    return counts;
  }, [stockDataMap, direction]);

  // 依據階梯軸篩選條件匹配過濾後的股票列表 (依看板原始順序排列，保持如截圖一貫排序)
  const filteredTabs = useMemo(() => {
    const list: (typeof stockDataMap extends Map<any, infer V> ? V : never)[] = [];

    activeTabsList.forEach((tab) => {
      const data = stockDataMap.get(tab.id);
      if (!data) return;

      const ret = data.returnPercentage;

      // 如果選「全部」
      if (selectedBracket === null) {
        if (direction === "gain" && ret >= 0) {
          list.push(data);
        } else if (direction === "loss" && ret < 0) {
          list.push(data);
        }
        return;
      }

      // 選特定級距 (例如 2%, 3%, 5%, 8%, 10%, 15%)
      const bounds = getStepBracketBounds(selectedBracket);
      if (!bounds) return;

      if (direction === "gain") {
        if (ret >= 0 && ret >= bounds.min && ret < bounds.max) {
          list.push(data);
        }
      } else {
        const absRet = Math.abs(ret);
        if (ret < 0 && absRet >= bounds.min && absRet < bounds.max) {
          list.push(data);
        }
      }
    });

    return list;
  }, [activeTabsList, stockDataMap, direction, selectedBracket]);

  // 初始化勾選狀態 (預設全選過濾後的股票)
  useEffect(() => {
    if (isOpen && !hasInitializedSelection && filteredTabs.length > 0) {
      setSelectedTabIds(new Set(filteredTabs.map((t) => t.id)));
      setHasInitializedSelection(true);
    }
  }, [isOpen, hasInitializedSelection, filteredTabs]);

  // 當目錄或階梯條件改變時，同步勾選所有符合過濾條件的個股
  const prevFilterKey = useRef(`${activeDirectory.type}_${activeDirectory.subTab}_${direction}_${selectedBracket}`);
  useEffect(() => {
    const key = `${activeDirectory.type}_${activeDirectory.subTab}_${direction}_${selectedBracket}`;
    if (prevFilterKey.current !== key) {
      prevFilterKey.current = key;
      setSelectedTabIds(new Set(filteredTabs.map((t) => t.id)));
    }
  }, [activeDirectory, direction, selectedBracket, filteredTabs]);

  // 最終呈現在畫面的個股卡片（有被勾選且符合過濾條件）
  const displayedTabs = useMemo(() => {
    if (selectedTabIds.size === 0) return filteredTabs;
    const matched = filteredTabs.filter((t) => selectedTabIds.has(t.id));
    // 如果切換目錄後原勾選清單無匹配個股，自動回退顯示新目錄的所有符合個股，避免出現空列表
    return matched.length > 0 ? matched : filteredTabs;
  }, [filteredTabs, selectedTabIds]);

  // 點擊導覽列快速跳轉並平滑滾動到該卡片
  const handleJumpToStock = useCallback((stockId: string) => {
    playClickSound();
    setActiveJumpId(stockId);
    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimeoutRef.current) {
      clearTimeout(programmaticScrollTimeoutRef.current);
    }
    programmaticScrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 700);

    const targetEl = document.getElementById(`primial-pyramid-card-${stockId}`);
    if (targetEl && scrollContainerRef.current) {
      targetEl.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      // 確保卡片若為收合狀態則自動展開
      setCollapsedCards((prev) => ({
        ...prev,
        [stockId]: false,
      }));
    }
  }, []);

  // 當初次開啟或從外部指定特定個股進入時，自動設定跳轉與對齊
  useEffect(() => {
    if (!isOpen) return;

    let targetStock: any = null;
    if (initialStockId) {
      targetStock = Array.from(stockDataMap.values()).find((s) => s.id === initialStockId);
    }
    if (!targetStock && initialStockSymbol) {
      const clean = initialStockSymbol.trim().toUpperCase();
      targetStock = Array.from(stockDataMap.values()).find((s) => s.cleanSym === clean);
    }

    if (targetStock) {
      if (targetStock.returnPercentage < 0) {
        setDirection("loss");
      } else {
        setDirection("gain");
      }
      setSelectedBracket(null);
      setActiveJumpId(targetStock.id);

      setTimeout(() => {
        handleJumpToStock(targetStock.id);
      }, 150);
    } else if (filteredTabs.length > 0) {
      setActiveJumpId(filteredTabs[0].id);
    }
  }, [isOpen, initialStockId, initialStockSymbol]);

  // 當目錄切換時，自動將導覽跳轉與指標重設至該目錄的首檔股票
  useEffect(() => {
    if (!isOpen) return;
    if (filteredTabs.length > 0) {
      setActiveJumpId(filteredTabs[0].id);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    } else {
      setActiveJumpId(null);
    }
  }, [activeDirectory]);

  // 滾動內容時，自動更新下方導覽列黑線指示位置
  const handleCardContainerScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const triggerY = containerRect.top + 160;

    let closestId: string | null = null;
    let minDiff = Infinity;

    displayedTabs.forEach((stock) => {
      const el = document.getElementById(`primial-pyramid-card-${stock.id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const diff = Math.abs(rect.top - triggerY);
        if (diff < minDiff) {
          minDiff = diff;
          closestId = stock.id;
        }
      }
    });

    if (closestId && closestId !== activeJumpId) {
      setActiveJumpId(closestId);
    }
  }, [displayedTabs, activeJumpId]);

  // 動態計算下方導覽列黑色指示底線寬度與位移 (對齊截圖二)
  useEffect(() => {
    const updateIndicator = () => {
      const activeId = activeJumpId || (filteredTabs.length > 0 ? filteredTabs[0].id : null);
      if (activeId) {
        const el = navTabRefs.current[activeId];
        if (el) {
          setIndicatorStyle({
            left: el.offsetLeft,
            width: el.offsetWidth,
          });

          // 自動滾動導覽列容器以維持選取的股票在可見視野內
          if (navTrackScrollRef.current) {
            const container = navTrackScrollRef.current;
            const scrollLeft =
              el.offsetLeft - container.clientWidth / 2 + el.offsetWidth / 2;
            container.scrollTo({
              left: Math.max(0, scrollLeft),
              behavior: "smooth",
            });
          }
        }
      }
    };

    const animId = requestAnimationFrame(updateIndicator);
    window.addEventListener("resize", updateIndicator);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeJumpId, filteredTabs]);

  // 全選 / 取消全選處理
  const handleSelectAll = useCallback(() => {
    playClickSound();
    setSelectedTabIds(new Set(filteredTabs.map((t) => t.id)));
  }, [filteredTabs]);

  const handleDeselectAll = useCallback(() => {
    playClickSound();
    setSelectedTabIds(new Set());
  }, []);

  const handleToggleTabSelection = useCallback((tabId: string) => {
    playClickSound();
    setSelectedTabIds((prev) => {
      const next = new Set(prev);
      if (next.has(tabId)) {
        next.delete(tabId);
      } else {
        next.add(tabId);
      }
      return next;
    });
  }, []);

  // 展開 / 收合單一卡片
  const toggleCardCollapse = useCallback((tabId: string) => {
    playClickSound();
    setCollapsedCards((prev) => ({
      ...prev,
      [tabId]: !prev[tabId],
    }));
  }, []);

  // 全部展開 / 全部收合
  const toggleAllCardsCollapse = useCallback(() => {
    playClickSound();
    const allCollapsed =
      displayedTabs.length > 0 &&
      displayedTabs.every((t) => Boolean(collapsedCards[t.id]));

    const nextState: Record<string, boolean> = {};
    displayedTabs.forEach((t) => {
      nextState[t.id] = !allCollapsed;
    });
    setCollapsedCards(nextState);
  }, [displayedTabs, collapsedCards]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col h-screen w-screen max-h-screen bg-[#0f1115] text-white select-none overflow-hidden animate-in fade-in duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Primial 頂部深色控制工具列 (Sticky Header) */}
      <div className="w-full bg-[#18181b] border-b border-zinc-800 px-3 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between gap-3 shadow-lg z-30 shrink-0">
        {/* 左側：返回按鈕 + 標題與選取檔數 */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-100 hover:text-white rounded-full text-xs font-black transition-all cursor-pointer shadow-sm border border-zinc-700/80"
            title="返回畫布看板 (Esc / Alt+Z)"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>返回畫布</span>
            <span className="hidden sm:inline text-[10px] text-zinc-400 font-mono font-normal">
              (Esc / Alt+Z)
            </span>
          </button>

          <div className="h-4 w-[1px] bg-zinc-700 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Primial</span>
              <span className="hidden md:inline text-xs font-bold text-zinc-400">
                分批進場金字塔動態互動圖表
              </span>
            </span>
            <span className="px-2 py-0.5 bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-black rounded-full font-mono">
              已選取 {displayedTabs.length} 檔
            </span>
          </div>
        </div>

        {/* 右側：防線/分隔線快捷開關 + 攤平/突破價位 + 全部展開/收合 + 關閉 */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
          {/* 行權價開關 */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setPyramidShowStrikePrices((prev) => !prev);
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer border active:scale-95 shrink-0 select-none ${
              pyramidShowStrikePrices
                ? "bg-zinc-950 text-white border-zinc-400 shadow-[0_0_8px_rgba(255,255,255,0.25)] ring-1 ring-zinc-400"
                : "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700/60"
            }`}
            title="開啟/關閉期權行權價與合約金額黑色虛線"
          >
            <span className="w-2.5 h-0 border-t-2 border-dashed border-zinc-300 shrink-0" />
            <span>行權價</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                pyramidShowStrikePrices
                  ? "bg-white shadow-[0_0_6px_#ffffff]"
                  : "bg-zinc-500"
              }`}
            />
          </button>

          {/* 攤平 | 突破價位 (快捷按鍵: Alt+T / Alt+B) */}
          <div className="flex items-center bg-zinc-900/90 border border-zinc-700/80 rounded-full p-0.5 shadow-xs shrink-0 select-none">
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setPyramidCalcMode("averaging");
              }}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer border active:scale-95 select-none ${
                pyramidCalcMode === "averaging"
                  ? "bg-emerald-600 text-white border-emerald-400/60 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                  : "bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-transparent"
              }`}
              title="向下分批攤平價位試算 (-3%, -6%, -9%, -12%) [快捷鍵 Alt + T]"
            >
              <span>攤平</span>
              <span className="text-[10px] font-mono opacity-80 font-normal">
                Alt+T
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  pyramidCalcMode === "averaging"
                    ? "bg-emerald-300 shadow-[0_0_6px_#6ee7b7]"
                    : "bg-zinc-600"
                }`}
              />
            </button>

            <button
              type="button"
              onClick={() => {
                playClickSound();
                setPyramidCalcMode("breakout");
              }}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer border active:scale-95 select-none ${
                pyramidCalcMode === "breakout"
                  ? "bg-emerald-600 text-white border-emerald-400/60 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                  : "bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-transparent"
              }`}
              title="向上突破價位試算 (+3%, +6%, +9%, +12%) [快捷鍵 Alt + B]"
            >
              <span>突破價位</span>
              <span className="text-[10px] font-mono opacity-80 font-normal">
                Alt+B
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  pyramidCalcMode === "breakout"
                    ? "bg-emerald-300 shadow-[0_0_6px_#6ee7b7]"
                    : "bg-zinc-600"
                }`}
              />
            </button>
          </div>

          <div className="h-4 w-[1px] bg-zinc-700 hidden sm:block" />

          {/* 分隔線 (Alt + D) */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setPyramidShowCardDividers((prev) => !prev);
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer border active:scale-95 shrink-0 select-none ${
              pyramidShowCardDividers
                ? "bg-indigo-600 text-white border-indigo-400/60 shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                : "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700/60"
            }`}
            title="開啟/關閉卡片分隔線 (Alt + D)"
          >
            <Split
              className={`w-3.5 h-3.5 stroke-[2.5] ${
                pyramidShowCardDividers ? "text-white" : "text-zinc-400"
              }`}
            />
            <span className="hidden sm:inline">分隔線</span>
            <span className="sm:hidden">分</span>
            <span className="text-[10px] font-mono text-zinc-400 font-normal">
              Alt+D
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                pyramidShowCardDividers
                  ? "bg-indigo-400 shadow-[0_0_6px_#818cf8]"
                  : "bg-zinc-500"
              }`}
            />
          </button>

          {/* 支撐 (Alt + R) */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setPyramidLevelTypes((prev) => ({
                ...prev,
                support: !prev.support,
              }));
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer border active:scale-95 shrink-0 select-none ${
              pyramidLevelTypes.support
                ? "bg-amber-500/20 text-amber-300 border-amber-400/60 shadow-[0_0_8px_rgba(245,158,11,0.3)] ring-1 ring-amber-400/50"
                : "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700/60"
            }`}
            title="快速打開/關閉支撐防線 (Alt + R)"
          >
            <span className="w-2.5 h-0 border-t-2 border-dashed border-amber-400 shrink-0" />
            <span>支撐</span>
            <span className="text-[10px] font-mono text-zinc-400 font-normal">
              Alt+R
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                pyramidLevelTypes.support
                  ? "bg-amber-400 shadow-[0_0_6px_#fbbf24]"
                  : "bg-zinc-500"
              }`}
            />
          </button>

          {/* 壓力 (Alt + P) */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setPyramidLevelTypes((prev) => ({
                ...prev,
                resistance: !prev.resistance,
              }));
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer border active:scale-95 shrink-0 select-none ${
              pyramidLevelTypes.resistance
                ? "bg-rose-500/20 text-rose-300 border-rose-400/60 shadow-[0_0_8px_rgba(244,63,94,0.3)] ring-1 ring-rose-400/50"
                : "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700/60"
            }`}
            title="快速打開/關閉壓力防線 (Alt + P)"
          >
            <span className="w-2.5 h-0 border-t-2 border-dashed border-rose-400 shrink-0" />
            <span>壓力</span>
            <span className="text-[10px] font-mono text-zinc-400 font-normal">
              Alt+P
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                pyramidLevelTypes.resistance
                  ? "bg-rose-400 shadow-[0_0_6px_#fb7185]"
                  : "bg-zinc-500"
              }`}
            />
          </button>

          <div className="h-4 w-[1px] bg-zinc-700 hidden md:block" />

          {/* 全部展開 / 全部收合 */}
          <button
            type="button"
            onClick={toggleAllCardsCollapse}
            className="px-2.5 sm:px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-full text-xs font-bold transition-all border border-zinc-700/60 cursor-pointer active:scale-95 shrink-0"
          >
            {displayedTabs.length > 0 &&
            displayedTabs.every((t) => Boolean(collapsedCards[t.id]))
              ? "全部展開"
              : "全部收合"}
          </button>

          {/* 關閉 X */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-all cursor-pointer active:scale-95 shrink-0"
            title="關閉"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* 2. 獲利/虧損%分級階梯軸即時篩選列 (Return Rate Step Filter - 頂部內建) */}
      <div className="w-full bg-[#f8fafc] border-b border-zinc-200/90 shadow-2xs shrink-0 text-zinc-900">
        <ReturnRateStepFilter
          direction={direction}
          onDirectionChange={setDirection}
          selectedBracket={selectedBracket}
          onBracketChange={setSelectedBracket}
          totalCount={activeTabsList.length}
          matchedCount={filteredTabs.length}
          bracketCounts={bracketCounts}
          selectedCardCount={selectedTabIds.size}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
        />
      </div>

      {/* 2.5 階梯軸正下方導覽列：上一層級目錄切換 + 股票代號導覽列 (支援 Drag and Scroll 及橫向滾動) */}
      <div className="w-full bg-[#f8fafc] sm:bg-[#ffffff] border-b border-zinc-200/90 shadow-2xs shrink-0 select-none">
        <div className="flex items-center w-full px-2 sm:px-6 max-w-7xl mx-auto gap-2 sm:gap-3 py-1">
          {/* 上一層級目錄選項按鈕 */}
          <div className="relative shrink-0" ref={directoryDropdownRef}>
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setIsDirectoryMenuOpen((prev) => !prev);
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200/90 active:scale-95 text-zinc-800 rounded-lg text-xs font-bold border border-zinc-300/80 shadow-2xs transition-all cursor-pointer select-none"
              title="切換上一層級目錄 (快捷鍵: Alt+1~5 / Ctrl+Shift+1~4 / Alt+0)"
            >
              <FolderTree className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="hidden lg:inline text-zinc-500 font-medium text-[11px]">目錄:</span>
              <span className="font-black text-zinc-900">{currentDirectoryLabel}</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-zinc-200/80 text-zinc-700 rounded-full shrink-0">
                {directoryTabs.length} 檔
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${
                  isDirectoryMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* 目錄下拉選單 */}
            {isDirectoryMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 bg-white rounded-xl shadow-2xl border border-zinc-200/90 p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150 text-zinc-900">
                <div className="px-2 py-1.5 text-[11px] font-black text-zinc-400 tracking-wider flex items-center justify-between border-b border-zinc-100 mb-1.5">
                  <span>選擇上一層級目錄</span>
                  <span className="font-mono text-[10px] text-zinc-400">支援快捷鍵切換</span>
                </div>

                {/* 全部目錄 */}
                <button
                  type="button"
                  onClick={() => handleSwitchDirectory("all", "全部")}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer mb-1 ${
                    activeDirectory.type === "all" && activeDirectory.subTab === "全部"
                      ? "bg-amber-500/10 text-amber-800 border border-amber-300"
                      : "hover:bg-zinc-100 text-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-amber-600 font-black">📂</span>
                    <span>全部股票目錄</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-400 font-mono">Alt+0 / Alt+↑</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-zinc-100 text-[10px] font-mono font-black text-zinc-600">
                      {directoryCounts.allTotal}
                    </span>
                  </div>
                </button>

                {/* 虛擬交易群組 */}
                <div className="mt-1 pt-1 border-t border-zinc-100">
                  <div className="px-2 py-1 text-[10px] font-black text-sky-600 tracking-wider flex items-center justify-between">
                    <span>虛擬交易 (Shift+1)</span>
                    <span className="text-zinc-400 font-mono">{directoryCounts.virtual.total} 檔</span>
                  </div>
                  {(["觀察中", "候選名單", "買進操作", "賣出操作", "乖離名單"] as const).map(
                    (sub, idx) => {
                      const isSubActive =
                        activeDirectory.type === "virtual" && activeDirectory.subTab === sub;
                      const count = directoryCounts.virtual[sub];
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => handleSwitchDirectory("virtual", sub)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isSubActive
                              ? "bg-sky-50 text-sky-800 border border-sky-300 shadow-2xs"
                              : "hover:bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                            <span>{sub}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-400 font-mono">Alt+{idx + 1}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black ${
                                count > 0 ? "bg-sky-100 text-sky-700" : "bg-zinc-100 text-zinc-400"
                              }`}
                            >
                              {count}
                            </span>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>

                {/* 真實交易群組 */}
                <div className="mt-1.5 pt-1.5 border-t border-zinc-100">
                  <div className="px-2 py-1 text-[10px] font-black text-emerald-600 tracking-wider flex items-center justify-between">
                    <span>真實交易 (Shift+2)</span>
                    <span className="text-zinc-400 font-mono">{directoryCounts.real.total} 檔</span>
                  </div>
                  {(["觀察中", "候選名單", "買進操作", "賣出操作"] as const).map(
                    (sub, idx) => {
                      const isSubActive =
                        activeDirectory.type === "real" && activeDirectory.subTab === sub;
                      const count = directoryCounts.real[sub];
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => handleSwitchDirectory("real", sub)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isSubActive
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs"
                              : "hover:bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>{sub}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-400 font-mono">
                              Ctrl+Shift+{idx + 1}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black ${
                                count > 0
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-zinc-100 text-zinc-400"
                              }`}
                            >
                              {count}
                            </span>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 垂直小分隔線 */}
          <div className="h-4 w-[1px] bg-zinc-300 shrink-0" />

          {/* 股票代號導覽列 (支援 Drag and Scroll 及橫向滾動) */}
          <div className="relative flex-1 min-w-0 overflow-hidden">
            {filteredTabs.length === 0 ? (
              <div className="py-1 text-xs text-zinc-400 italic">
                此目錄目前無符合個股，可點擊「上一層級目錄」或按 Alt+0 查看全部股票
              </div>
            ) : (
              <div
                ref={navTrackScrollRef}
                onMouseDown={handleNavMouseDown}
                onMouseMove={handleNavMouseMove}
                onMouseUp={handleNavMouseUpOrLeave}
                onMouseLeave={handleNavMouseUpOrLeave}
                onWheel={handleNavWheel}
                className={`flex flex-row items-center justify-start gap-6 sm:gap-8 overflow-x-auto scrollbar-hide no-scrollbar relative pt-1.5 pb-2 select-none ${
                  isNavDragging ? "cursor-grabbing" : "cursor-grab"
                }`}
              >
                {filteredTabs.map((stock) => {
                  const isSelected =
                    (activeJumpId || filteredTabs[0]?.id) === stock.id;
                  const strat = stock.strategy || {};

                  // 擷取策略標記狀態 (加碼、止盈、止損、平倉、觀察、選取)
                  const stratBadges: Array<{
                    key: string;
                    label: string;
                    dotClass: string;
                    lightClass: string;
                  }> = [];

                  if (strat.addChecked) {
                    stratBadges.push({
                      key: "add",
                      label: "加碼",
                      dotClass: "bg-emerald-500",
                      lightClass: "bg-emerald-50 text-emerald-700 border-emerald-300/80 shadow-2xs",
                    });
                  }
                  if (strat.tpChecked) {
                    stratBadges.push({
                      key: "tp",
                      label: "止盈",
                      dotClass: "bg-blue-500",
                      lightClass: "bg-blue-50 text-blue-700 border-blue-300/80 shadow-2xs",
                    });
                  }
                  if (strat.slChecked) {
                    stratBadges.push({
                      key: "sl",
                      label: "止損",
                      dotClass: "bg-rose-500",
                      lightClass: "bg-rose-50 text-rose-700 border-rose-300/80 shadow-2xs",
                    });
                  }
                  if (strat.closeChecked) {
                    stratBadges.push({
                      key: "close",
                      label: "平倉",
                      dotClass: "bg-amber-500",
                      lightClass: "bg-amber-50 text-amber-800 border-amber-300/80 shadow-2xs",
                    });
                  }
                  if (strat.observeChecked) {
                    stratBadges.push({
                      key: "observe",
                      label: "觀察",
                      dotClass: "bg-zinc-400",
                      lightClass: "bg-zinc-100 text-zinc-700 border-zinc-300/80 shadow-2xs",
                    });
                  }
                  if (strat.notesHighlighted) {
                    stratBadges.push({
                      key: "highlight",
                      label: "選取",
                      dotClass: "bg-violet-500",
                      lightClass: "bg-violet-50 text-violet-700 border-violet-300/80 shadow-2xs",
                    });
                  }

                  return (
                    <button
                      key={stock.id}
                      ref={(el) => {
                        navTabRefs.current[stock.id] = el;
                      }}
                      type="button"
                      onClick={() => {
                        if (hasDraggedBeyondThresholdRef.current) return;
                        handleJumpToStock(stock.id);
                      }}
                      className={`px-2.5 py-1 text-sm sm:text-base transition-all duration-200 cursor-pointer outline-none shrink-0 relative select-none inline-flex items-center gap-1.5 rounded-md hover:bg-zinc-100/60 ${
                        isSelected
                          ? "text-zinc-950 font-black tracking-wide"
                          : "text-zinc-400 hover:text-zinc-700 font-semibold tracking-wide"
                      }`}
                      title={`快速切換至 ${stock.cleanSym}`}
                    >
                      <span>{stock.cleanSym}</span>
                      {stratBadges.length > 0 && (
                        <span className="inline-flex items-center gap-1 pointer-events-none">
                          {stratBadges.map((badge) => (
                            <span
                              key={badge.key}
                              className={`inline-flex items-center gap-1 px-1.5 py-[2px] text-[10px] leading-none font-bold rounded-full border transition-all ${badge.lightClass}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${badge.dotClass}`} />
                              <span>{badge.label}</span>
                            </span>
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* 導覽列灰色底線軌道 (對齊截圖細橫線) */}
                <div
                  className="bottom-nav-track absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#e0e0e0] pointer-events-none"
                />

                {/* 導覽列黑色活動底線 indicator (對齊截圖 XEL 下方的黑條) */}
                <div
                  className="bottom-nav-indicator absolute bottom-0 h-[2.5px] bg-zinc-950 rounded-full pointer-events-none"
                  style={{
                    left: `${indicatorStyle.left}px`,
                    width: `${indicatorStyle.width}px`,
                    transition: isNavDragging
                      ? "none"
                      : "left 0.25s cubic-bezier(0.16, 1, 0.3, 1), width 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. 滾動內容區塊：個股金字塔動態互動圖表列表 (全寬/高對比滿版卡片) */}
      <div
        ref={scrollContainerRef}
        data-scrollable="true"
        onScroll={handleCardContainerScroll}
        onWheel={(e) => e.stopPropagation()}
        className="flex-1 min-h-0 h-full overflow-y-auto px-2 sm:px-4 lg:px-6 py-3 sm:py-4 space-y-4 bg-[#f3f4f6] scrollbar-hide no-scrollbar [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none] overscroll-contain focus:outline-none scroll-smooth"
      >
        {displayedTabs.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[360px] text-zinc-500 bg-white rounded-2xl border border-zinc-200/90 shadow-sm p-8 text-center max-w-xl mx-auto my-8">
            <Layers className="w-12 h-12 text-amber-500/80 mb-3" />
            <div className="text-base font-bold text-zinc-800 mb-1">
              目前沒有符合篩選條件的個股金字塔圖表
            </div>
            <div className="text-xs text-zinc-400 leading-relaxed mb-4">
              可嘗試在上方階梯軸點擊「全部」或其他報酬率級距，切換目錄或按 Alt+0 查看全部股票。
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setSelectedBracket(null);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer"
              >
                顯示當前目錄全部
              </button>
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  handleSwitchDirectory("all", "全部");
                  setSelectedBracket(null);
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer"
              >
                查看全部目錄 (Alt+0)
              </button>
            </div>
          </div>
        ) : (
          displayedTabs.map((stock) => {
            const isCollapsed = Boolean(collapsedCards[stock.id]);
            const isChecked = selectedTabIds.has(stock.id);

            return (
              <div
                key={stock.id}
                id={`primial-pyramid-card-${stock.id}`}
                className={`w-full max-w-[99%] xl:max-w-[98%] 2xl:max-w-[1880px] mx-auto bg-white rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md p-3 sm:p-4 text-zinc-900 ${
                  activeJumpId === stock.id
                    ? "border-amber-400 ring-2 ring-amber-300/60"
                    : "border-zinc-200/90"
                }`}
              >
                {/* 個股卡片頂部自定義導航條 */}
                <div className="flex items-center justify-between gap-3 pb-2.5 mb-2 border-b border-zinc-100 flex-wrap">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* 勾選切換框 */}
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleTabSelection(stock.id)}
                      className="w-4 h-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                      title={isChecked ? "取消勾選" : "勾選此檔股票"}
                    />

                    {/* 代號與公司名稱 */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg sm:text-xl font-black font-mono text-zinc-950 tracking-tight">
                        {stock.cleanSym}
                      </span>
                      {stock.companyName && (
                        <span className="text-xs sm:text-sm font-semibold text-zinc-500 truncate max-w-[200px] sm:max-w-[360px]">
                          {stock.companyName}
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-full ml-1">
                        分批進場金字塔
                      </span>
                    </div>

                    {/* 跳轉至個股詳情 */}
                    {stock.tab?.id && onNavigateToDetail && (
                      <button
                        type="button"
                        onClick={() => {
                          playClickSound();
                          onClose();
                          onNavigateToDetail(stock.tab.id);
                        }}
                        className="p-1 hover:bg-zinc-100 rounded-md text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                        title="開啟個股獨立詳情頁"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* 右側：損益報酬率標籤 + 現價與均價小卡 + 展開/收合按鈕 */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* 未實現損益金額與報酬率徽章 (對齊截圖二) */}
                    <div
                      className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl border shadow-2xs font-mono font-black text-xs ${
                        stock.unrealizedPnL > 0
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : stock.unrealizedPnL < 0
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-emerald-50/80 text-emerald-700 border-emerald-200"
                      }`}
                      title={`未實現損益: ${stock.unrealizedPnL >= 0 ? "+" : "-"}$${Math.abs(stock.unrealizedPnL).toFixed(2)} (${stock.returnPercentage >= 0 ? "+" : ""}${stock.returnPercentage.toFixed(2)}%)`}
                    >
                      <span className="text-[10px] font-bold text-zinc-500 font-sans hidden xs:inline">未實現</span>
                      <span className="tabular-nums">
                        {stock.unrealizedPnL > 0 ? "+" : stock.unrealizedPnL < 0 ? "-" : "+"}
                        ${Math.abs(stock.unrealizedPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10.5px] opacity-90 tabular-nums">
                        ({stock.returnPercentage >= 0 ? "+" : ""}{stock.returnPercentage.toFixed(2)}%)
                      </span>
                    </div>

                    {/* 目前價格膠囊 */}
                    {stock.currentPrice > 0 && (
                      <div className="px-3 py-1 bg-purple-50/80 border border-purple-200/70 rounded-xl text-center shadow-2xs">
                        <div className="text-[9.5px] font-bold text-purple-600 leading-none">
                          目前價格
                        </div>
                        <div className="text-sm font-mono font-black text-purple-900 leading-tight">
                          ${stock.currentPrice.toFixed(2)}
                        </div>
                      </div>
                    )}

                    {/* 平均成本膠囊 */}
                    {stock.holdingAvgPrice > 0 && (
                      <div className="px-3 py-1 bg-orange-50/80 border border-orange-200/70 rounded-xl text-center shadow-2xs">
                        <div className="text-[9.5px] font-bold text-orange-600 leading-none">
                          平均成本
                        </div>
                        <div className="text-sm font-mono font-black text-orange-950 leading-tight">
                          ${stock.holdingAvgPrice.toFixed(2)}
                        </div>
                      </div>
                    )}

                    {/* 單一卡片展開/收合按鈕 */}
                    <button
                      type="button"
                      onClick={() => toggleCardCollapse(stock.id)}
                      className="p-1.5 hover:bg-zinc-100 rounded-xl text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer"
                      title={isCollapsed ? "展開圖表" : "收合圖表"}
                    >
                      {isCollapsed ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronUp className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* 卡片圖表內容 (若收合則不顯示內部大圖表) */}
                {!isCollapsed && (
                  <div className="w-full overflow-hidden pt-1">
                    <System2PlanningChart
                      compact={true}
                      hideHeader={true}
                      symbol={stock.cleanSym}
                      companyName={stock.companyName}
                      isExpanded={!isCollapsed}
                      onToggleExpand={() => toggleCardCollapse(stock.id)}
                      currentPrice={stock.currentPrice}
                      holdingAvgPrice={stock.holdingAvgPrice}
                      holdingQty={stock.holdingQty}
                      batches={stock.batches}
                      averagingRowsSys2={stock.averagingRowsSys2}
                      pyramidRows={stock.pyramidRows}
                      calcMode={pyramidCalcMode}
                      includeCurrentHolding={true}
                      refPnLPointSys2=""
                      usableCapital={stock.usableCapital}
                      plannedQty={stock.plannedQty}
                      trades={stock.trades}
                      optionsCalcData={stock.tab?.optionsCalcData}
                      visualLevels={stock.visualLevels}
                      showCardDividers={pyramidShowCardDividers}
                      onToggleCardDividers={() => setPyramidShowCardDividers((prev) => !prev)}
                      showStrikePrices={pyramidShowStrikePrices}
                      onToggleStrikePrices={() => setPyramidShowStrikePrices((prev) => !prev)}
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
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
