import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStockTabs } from '../hooks/useStockTabs';
import { playClickSound, playSuccessSound, playPriceImportSound } from '../lib/audio';
import { useTrades } from '../hooks/useTrades';
import { calculateStats, generateAveragingDownRows, generatePyramidUpRows, shouldUpdateAveragingRows, calculateBatchPlanning, calculateOptionPortfolioSummary, calculateLiveOptionTradeMetrics } from '../lib/calculations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { format } from 'date-fns';
import { Timestamp, collection, writeBatch, doc, serverTimestamp, addDoc, getDocs, deleteDoc, getDoc, getDocFromCache, setDoc, updateDoc } from 'firebase/firestore';
import { Trash2, BarChart3, ChevronDown, ChevronUp, Gamepad2, ShieldCheck, Upload, Download, ChevronLeft, CheckCircle2, RotateCcw, Loader2, HelpCircle, AlertTriangle, Save, Calculator, History, RefreshCw, Layers, TrendingDown, TrendingUp, Split, ShieldAlert, DollarSign, Wallet, Coins, Target, Activity, Compass, LineChart, ArrowRightLeft } from 'lucide-react';
import { toast } from "sonner";
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { safeSessionStorage, safeLocalStorage, cn } from '../lib/utils';
import { ScrollIn, InteractiveButton, Magnetic } from '../components/MotionWrappers';
import StrategyTab from '../components/StrategyTab';
import { BatchMultiSelect } from '../components/BatchMultiSelect';
import { formatTimestamp, getTimestampMillis, getTimestampDate } from '../lib/dateUtils';
import ChipAnalysisTab from '../components/ChipAnalysisTab';
import { System2PlanningChart, VisualPriceLevel } from '../components/System2PlanningChart';
import { usePlannedOrders } from '../hooks/usePlannedOrders';
import { useStrategy } from '../hooks/useStrategy';
import { getVisualPriceLevels } from '../lib/visualLevels';
import { OptionsCalculatorTab } from '../components/OptionsCalculatorTab';

function AnimatedNumber({
  value,
  duration = 1000,
  replayKey = 0,
  disabled = false,
  formatter = (n: number) => n.toLocaleString(),
}: {
  value: number;
  duration?: number;
  replayKey?: number;
  disabled?: boolean;
  formatter?: (n: number) => string;
}) {
  const [displayVal, setDisplayVal] = useState(disabled ? value : 0);

  useEffect(() => {
    if (disabled) {
      setDisplayVal(value);
      return;
    }
    let startTimestamp: number | null = null;
    const startVal = 0;
    const targetVal = value;
    let rafId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic: 1 - Math.pow(1 - progress, 3)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (targetVal - startVal) * easeProgress);
      setDisplayVal(current);

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setDisplayVal(targetVal);
      }
    };

    setDisplayVal(0);
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [value, duration, replayKey, disabled]);

  return <>{formatter(displayVal)}</>;
}

export default function StockTabDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tabs, loading: tabsLoading, updateTabStatus, updateCurrentPrice, updateTradeType, updateTab, deleteTab } = useStockTabs();
  const { trades, addTrade, updateTrade, deleteTrade } = useTrades(id);
  const { orders: plannedOrders } = usePlannedOrders(id);
  const { strategy } = useStrategy(id);

  const tab = tabs.find(t => t.id === id);

  const [tradeForm, setTradeForm] = useState({
    type: 'BUY',
    purpose: '加碼',
    batch: '',
    operator: '人',
    price: '',
    quantity: '',
    tradeDate: format(new Date(), 'yyyy-MM-dd'),
    fees: '',
    notes: ''
  });
  const [isTradeOpen, setIsTradeOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isSubmittingComplete, setIsSubmittingComplete] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(true); 
  const [isAveragingHelpOpen, setIsAveragingHelpOpen] = useState(false);
  const [isTradeListOpen, setIsTradeListOpen] = useState(true);
  const [chipsSubTab, setChipsSubTab] = useState<'calc' | 'trades'>('calc');
  const [finalPnLInput, setFinalPnLInput] = useState('');
  const [activeTab, setActiveTab] = useState('trades');
  const isInitialActiveTabMount = React.useRef(true);
  React.useEffect(() => {
    if (isInitialActiveTabMount.current) {
      isInitialActiveTabMount.current = false;
    } else {
      playClickSound();
    }
  }, [activeTab]);

  const mainTabListRef = useRef<HTMLDivElement>(null);
  const mainTabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  const subTabListRef = useRef<HTMLDivElement>(null);
  const subTabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [subIndicatorStyle, setSubIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  const updateMainTabIndicator = useCallback(() => {
    const activeEl = mainTabRefs.current[activeTab];
    if (activeEl && mainTabListRef.current) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
      });
    }
  }, [activeTab]);

  const updateSubTabIndicator = useCallback(() => {
    const activeEl = subTabRefs.current[chipsSubTab];
    if (activeEl && subTabListRef.current) {
      setSubIndicatorStyle({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
      });
    }
  }, [chipsSubTab]);

  useLayoutEffect(() => {
    updateMainTabIndicator();
  }, [updateMainTabIndicator, trades.length, plannedOrders.length]);

  useLayoutEffect(() => {
    updateSubTabIndicator();
  }, [updateSubTabIndicator, trades.length]);

  useEffect(() => {
    updateMainTabIndicator();
    updateSubTabIndicator();
    const handleResize = () => {
      updateMainTabIndicator();
      updateSubTabIndicator();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateMainTabIndicator, updateSubTabIndicator]);

  const handleMainTabKeyDown = (e: React.KeyboardEvent, currentKey: string) => {
    const keys = ['trades', 'strategy', 'chips'] as const;
    const currentIndex = keys.indexOf(currentKey as any);
    if (currentIndex === -1) return;

    let targetIndex = -1;
    if (e.key === 'ArrowRight') {
      targetIndex = (currentIndex + 1) % keys.length;
    } else if (e.key === 'ArrowLeft') {
      targetIndex = (currentIndex - 1 + keys.length) % keys.length;
    } else if (e.key === 'Home') {
      targetIndex = 0;
    } else if (e.key === 'End') {
      targetIndex = keys.length - 1;
    }

    if (targetIndex !== -1) {
      e.preventDefault();
      const targetTab = keys[targetIndex];
      setActiveTab(targetTab);
      mainTabRefs.current[targetTab]?.focus();
    }
  };
  const [currentPriceInput, setCurrentPriceInput] = useState('');
  const [plannedBuyPercentInput, setPlannedBuyPercentInput] = useState<string>('');
  const [stopLossInput, setStopLossInput] = useState<string>('');
  const [takeProfitInput, setTakeProfitInput] = useState<string>('');
  const [supportInput, setSupportInput] = useState<string>('');
  const [resistanceInput, setResistanceInput] = useState<string>('');
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [tempPrice, setTempPrice] = useState('');
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const tradesJsonFileInputRef = React.useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const [totalCapital, setTotalCapital] = useState<number>(() => {
    const saved = safeLocalStorage.getItem(`total-capital-${user?.uid || "guest"}`);
    return saved ? parseFloat(saved) : 1000000;
  });
  const [virtualCapital, setVirtualCapital] = useState<number>(() => {
    const saved = safeLocalStorage.getItem(`virtual-capital-${user?.uid || "guest"}`);
    return saved ? parseFloat(saved) : 1000000;
  });

  React.useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "userSettings", user.uid);
        let snapshot;
        try {
          snapshot = await getDoc(docRef);
        } catch (err) {
          const errMsg = (err instanceof Error ? err.message : String(err)).toLowerCase();
          if (
            errMsg.includes("offline") ||
            errMsg.includes("unavailable") ||
            errMsg.includes("could not reach") ||
            errMsg.includes("failed-precondition") ||
            errMsg.includes("deadline") ||
            errMsg.includes("network") ||
            errMsg.includes("timed out")
          ) {
            try {
              snapshot = await getDocFromCache(docRef);
            } catch {
              // Ignore cache miss
            }
          } else {
            throw err;
          }
        }

        if (snapshot && snapshot.exists()) {
          const data = snapshot.data();
          if (typeof data.totalCapital === "number") {
            setTotalCapital(data.totalCapital);
            safeLocalStorage.setItem(`total-capital-${user.uid}`, data.totalCapital.toString());
          }
          if (typeof data.virtualCapital === "number") {
            setVirtualCapital(data.virtualCapital);
            safeLocalStorage.setItem(`virtual-capital-${user.uid}`, data.virtualCapital.toString());
          }
        }
      } catch (error) {
        const errMsg = (error instanceof Error ? error.message : String(error)).toLowerCase();
        if (
          !errMsg.includes("offline") &&
          !errMsg.includes("unavailable") &&
          !errMsg.includes("could not reach") &&
          !errMsg.includes("failed-precondition") &&
          !errMsg.includes("deadline") &&
          !errMsg.includes("network") &&
          !errMsg.includes("timed out")
        ) {
          console.warn("Failed to fetch userSettings in StockTabDetail:", error);
        } else {
          console.info("[StockTabDetail] Using cached userSettings.");
        }
      }
    };
    fetchSettings();
  }, [user]);

  // Tab state for Dual System Calculation & Options Calculator (Down Averaging, Up Pyramiding, American Options Calculator)
  const [calcComparisonTab, setCalcComparisonTab] = useState<'down' | 'up' | 'options'>('down');

  // 4 rows for stock averaging down (System 1: -2%, -4%, -6%, -8%)
  const [averagingRows, setAveragingRows] = useState<{ price: string; quantity: string; quantity2?: string; bought?: boolean; riskFlag?: boolean }[]>([
    { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
    { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
    { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
    { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false }
  ]);
  // 4 rows for stock averaging down (System 2: -3%, -6%, -9%, -12%)
  const [averagingRowsSys2, setAveragingRowsSys2] = useState<{ price: string; quantity: string; quantity2?: string; bought?: boolean; riskFlag?: boolean }[]>([
    { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
    { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
    { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
    { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false }
  ]);
  const [includeCurrentHolding, setIncludeCurrentHolding] = useState(true);
  const [refPnLPoint, setRefPnLPoint] = useState('');
  const [refPnLPointSys2, setRefPnLPointSys2] = useState('');

  // 4 rows for stock breakout pyramid up (System 1: +2%, +4%, +6%, +8%)
  const [pyramidRows, setPyramidRows] = useState<{ price: string; quantity: string; quantity2?: string; bought?: boolean; riskFlag?: boolean }[]>([
    { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
    { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
    { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
    { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false }
  ]);
  // 4 rows for stock breakout pyramid up (System 2: +3%, +6%, +9%, +12%)
  const [pyramidRowsSys2, setPyramidRowsSys2] = useState<{ price: string; quantity: string; quantity2?: string; bought?: boolean; riskFlag?: boolean }[]>([
    { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
    { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
    { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
    { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false }
  ]);
  const [includeCurrentHoldingUp, setIncludeCurrentHoldingUp] = useState(true);
  const [refPnLPointUp, setRefPnLPointUp] = useState('');
  const [refPnLPointUpSys2, setRefPnLPointUpSys2] = useState('');

  // Primial 分批進場金字塔動態圖表頂部功能按鈕控制狀態 (完全對齊 Primial 頁面)
  const [pyramidCalcMode, setPyramidCalcMode] = useState<'averaging' | 'breakout'>('averaging');
  const [pyramidShowCardDividers, setPyramidShowCardDividers] = useState<boolean>(false);
  // 行權價開關狀態 (預設關閉，點擊後才開啟顯示黑色垂直虛線、合約金額與當前損益)
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

  // 籌碼管理 未實現損益是否含期權開關 (Toggle 開關，預設開啟)
  const [includeOptionsInPnL, setIncludeOptionsInPnL] = useState<boolean>(true);

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

  // 批次進場動畫系統狀態 (載入動畫、重播動畫、卡片外圈光暈、減少動態偏好)
  const [batchAnimKey, setBatchAnimKey] = useState(0);
  const [isBatchAnimActive, setIsBatchAnimActive] = useState(false);
  const [glowingBatchCardIndex, setGlowingBatchCardIndex] = useState<number | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    setIsBatchAnimActive(false);
    const timer = setTimeout(() => {
      setIsBatchAnimActive(true);
    }, 40);
    return () => clearTimeout(timer);
  }, [batchAnimKey]);

  const handleReplayBatchAnimation = useCallback(() => {
    playClickSound();
    setBatchAnimKey(k => k + 1);
  }, []);

  const triggerCardGlow = useCallback((batchIdx: number) => {
    setGlowingBatchCardIndex(batchIdx);
    setTimeout(() => {
      setGlowingBatchCardIndex(prev => (prev === batchIdx ? null : prev));
    }, 700);
  }, []);

  // 快捷切換金字塔圖表卡片分隔線 (Alt + D)
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

  // 快捷切換金字塔圖表支撐 (Alt + R)
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

  // 快捷切換金字塔圖表壓力 (Alt + P)
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

  // 快捷切換金字塔圖表 攤平 | 突破價位 (Alt + T / Alt + B)
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

  // 金字塔快捷鍵監聽 (Alt + D, Alt + R, Alt + P, Alt + T, Alt + B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        activeEl?.getAttribute("contenteditable") === "true";

      if (isInput) return;

      // Alt + D: 卡片分隔線
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "D" || e.key === "d" || e.code === "KeyD" || e.key === "∂")
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleTogglePyramidCardDividers();
        return;
      }

      // Alt + R: 支撐防線
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "R" || e.key === "r" || e.code === "KeyR" || e.key === "®")
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleTogglePyramidSupport();
        return;
      }

      // Alt + P: 壓力防線
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "P" || e.key === "p" || e.code === "KeyP" || e.key === "π")
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleTogglePyramidResistance();
        return;
      }

      // Alt + T: 分批攤平
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "T" || e.key === "t" || e.code === "KeyT" || e.key === "†")
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleTogglePyramidCalcMode("averaging");
        return;
      }

      // Alt + B: 突破價位
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "B" || e.key === "b" || e.code === "KeyB" || e.key === "∫")
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleTogglePyramidCalcMode("breakout");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleTogglePyramidCardDividers, handleTogglePyramidSupport, handleTogglePyramidResistance, handleTogglePyramidCalcMode]);

  // Percentage calculator states
  const [calcExpression, setCalcExpression] = useState('');
  const [calcBasePrice, setCalcBasePrice] = useState('');
  const [calcPercent, setCalcPercent] = useState('');
  const [calcType, setCalcType] = useState('SUB'); // 'ADD' or 'SUB'

  // Update currentPriceInput when tab data loads or changes
  React.useEffect(() => {
    if (tab?.currentPrice !== undefined) {
      setCurrentPriceInput(tab.currentPrice.toString());
    }
  }, [tab?.id, tab?.currentPrice]);

  const effectiveCapital = (tab?.tradeType === 'simulated' ? virtualCapital : totalCapital) || totalCapital || 1000000;
  const maxStrategyRiskPool60 = (effectiveCapital * 2) * 0.6;

  // 輔助計算各批次股票數 (第一批~第四批 與 拆分子批)
  const computeBatchSizes = (totalQty: number) => {
    const s1 = Math.ceil(totalQty * 0.15);
    const s1_a = Math.round(totalQty * 0.07);
    const s1_b = Math.max(0, s1 - s1_a);

    const s2 = Math.ceil(totalQty * 0.25);
    const s2_a = Math.round(totalQty * 0.10);
    const s2_b = Math.max(0, s2 - s2_a);

    const s3 = Math.ceil(totalQty * 0.35);
    const s3_a = Math.round(totalQty * 0.15);
    const s3_b = Math.max(0, s3 - s3_a);

    const s4 = Math.ceil(totalQty * 0.25);
    const s4_a = Math.round(totalQty * 0.10);
    const s4_b = Math.max(0, s4 - s4_a);

    return [
      { split1: s1_a, split2: s1_b, total: s1 },
      { split1: s2_a, split2: s2_b, total: s2 },
      { split1: s3_a, split2: s3_b, total: s3 },
      { split1: s4_a, split2: s4_b, total: s4 },
    ];
  };

  // Update plannedBuyPercentInput when tab data loads or changes
  React.useEffect(() => {
    if (tab?.plannedBuyPercent !== undefined && tab?.plannedBuyPercent !== null) {
      setPlannedBuyPercentInput(tab.plannedBuyPercent.toString());
    } else if (tab?.plannedBuyQty !== undefined && tab.plannedBuyQty > 0) {
      const price = (tab.currentPrice && tab.currentPrice > 0) ? tab.currentPrice : (parseFloat(currentPriceInput) || 0);
      if (price > 0 && maxStrategyRiskPool60 > 0) {
        const impliedPercent = ((tab.plannedBuyQty * price) / maxStrategyRiskPool60) * 100;
        setPlannedBuyPercentInput(Number(impliedPercent.toFixed(2)).toString());
      } else {
        setPlannedBuyPercentInput('');
      }
    } else {
      setPlannedBuyPercentInput('');
    }
  }, [tab?.id, tab?.plannedBuyPercent, tab?.plannedBuyQty, maxStrategyRiskPool60, tab?.currentPrice]);

  // Update stopLossInput when tab data loads or changes
  React.useEffect(() => {
    if (tab?.stopLossPrice !== undefined && tab?.stopLossPrice !== null) {
      setStopLossInput(tab.stopLossPrice ? tab.stopLossPrice.toString() : '');
    } else {
      setStopLossInput('');
    }
  }, [tab?.id, tab?.stopLossPrice]);

  // Update takeProfitInput when tab data loads or changes
  React.useEffect(() => {
    if (tab?.takeProfitPrice !== undefined && tab?.takeProfitPrice !== null) {
      setTakeProfitInput(tab.takeProfitPrice ? tab.takeProfitPrice.toString() : '');
    } else {
      setTakeProfitInput('');
    }
  }, [tab?.id, tab?.takeProfitPrice]);

  // Update supportInput when tab data loads or changes
  React.useEffect(() => {
    if (tab?.supportPrice !== undefined && tab?.supportPrice !== null) {
      setSupportInput(tab.supportPrice ? tab.supportPrice.toString() : '');
    } else {
      setSupportInput('');
    }
  }, [tab?.id, tab?.supportPrice]);

  // Update resistanceInput when tab data loads or changes
  React.useEffect(() => {
    if (tab?.resistancePrice !== undefined && tab?.resistancePrice !== null) {
      setResistanceInput(tab.resistancePrice ? tab.resistancePrice.toString() : '');
    } else {
      setResistanceInput('');
    }
  }, [tab?.id, tab?.resistancePrice]);

  // Update averaging rows & settings when tab loads (自動帶入預估佔比之批次股數)
  React.useEffect(() => {
    if (tab) {
      const basePrice = (stats?.averagePrice && stats.averagePrice > 0)
        ? stats.averagePrice
        : (tab?.currentPrice && tab.currentPrice > 0 ? tab.currentPrice : 0);
      const sys1Ratios = [0.98, 0.96, 0.94, 0.92];
      const sys2Ratios = [0.97, 0.94, 0.91, 0.88];
      const tabPlannedQty = tab.plannedBuyQty || (basePrice > 0 && maxStrategyRiskPool60 > 0 && tab.plannedBuyPercent ? Math.floor((maxStrategyRiskPool60 * (tab.plannedBuyPercent / 100)) / basePrice) : 0);
      const batchSizes = computeBatchSizes(tabPlannedQty);

      if (tab.averagingRows && Array.isArray(tab.averagingRows)) {
        const hasAnyQty = tab.averagingRows.some(r => (r?.quantity !== undefined && r?.quantity !== '') || (r?.quantity2 !== undefined && r?.quantity2 !== ''));
        const normalized = [0, 1, 2, 3].map(i => {
          const row = tab.averagingRows?.[i];
          const priceSys1 = basePrice > 0 ? (basePrice * sys1Ratios[i]).toFixed(2) : '';
          return {
            price: row?.price || (priceSys1 ? priceSys1 : ''),
            quantity: hasAnyQty ? (row?.quantity ?? '') : (tabPlannedQty > 0 ? batchSizes[i].split1.toString() : ''),
            quantity2: hasAnyQty ? (row?.quantity2 ?? '') : (tabPlannedQty > 0 ? batchSizes[i].split2.toString() : ''),
            bought: !!row?.bought,
            riskFlag: !!row?.riskFlag
          };
        });
        setAveragingRows(normalized);
      } else if (tabPlannedQty > 0) {
        const defaultRows = [0, 1, 2, 3].map(i => {
          const priceSys1 = basePrice > 0 ? (basePrice * sys1Ratios[i]).toFixed(2) : '';
          return {
            price: priceSys1,
            quantity: batchSizes[i].split1.toString(),
            quantity2: batchSizes[i].split2.toString(),
            bought: false,
            riskFlag: false
          };
        });
        setAveragingRows(defaultRows);
      }

      if (tab.averagingRowsSys2 && Array.isArray(tab.averagingRowsSys2)) {
        const hasAnyQty2 = tab.averagingRowsSys2.some(r => (r?.quantity !== undefined && r?.quantity !== '') || (r?.quantity2 !== undefined && r?.quantity2 !== ''));
        const normalized2 = [0, 1, 2, 3].map(i => {
          const row = tab.averagingRowsSys2?.[i];
          const priceSys2 = basePrice > 0 ? (basePrice * sys2Ratios[i]).toFixed(2) : '';
          return {
            price: row?.price || (priceSys2 ? priceSys2 : ''),
            quantity: hasAnyQty2 ? (row?.quantity ?? '') : (tabPlannedQty > 0 ? batchSizes[i].split1.toString() : ''),
            quantity2: hasAnyQty2 ? (row?.quantity2 ?? '') : (tabPlannedQty > 0 ? batchSizes[i].split2.toString() : ''),
            bought: !!row?.bought,
            riskFlag: !!row?.riskFlag
          };
        });
        setAveragingRowsSys2(normalized2);
      } else if (tabPlannedQty > 0) {
        const defaultRows2 = [0, 1, 2, 3].map(i => {
          const priceSys2 = basePrice > 0 ? (basePrice * sys2Ratios[i]).toFixed(2) : '';
          return {
            price: priceSys2,
            quantity: batchSizes[i].split1.toString(),
            quantity2: batchSizes[i].split2.toString(),
            bought: false,
            riskFlag: false
          };
        });
        setAveragingRowsSys2(defaultRows2);
      }

      if (tab.refPnLPoint !== undefined) {
        setRefPnLPoint(tab.refPnLPoint ? tab.refPnLPoint.toString() : '');
      }
      if (tab.refPnLPointSys2 !== undefined) {
        setRefPnLPointSys2(tab.refPnLPointSys2 ? tab.refPnLPointSys2.toString() : '');
      }
      if (tab.includeCurrentHolding !== undefined) {
        setIncludeCurrentHolding(tab.includeCurrentHolding);
      }
    }
  }, [tab?.id]);

  const [isSavingAveraging, setIsSavingAveraging] = useState(false);

  const handleSaveAveraging = async () => {
    if (!tab) return;
    setIsSavingAveraging(true);
    try {
      await updateTab(tab.id, {
        averagingRows,
        refPnLPoint,
        includeCurrentHolding,
        averagingRowsSys2,
        refPnLPointSys2,
      });
      playSuccessSound();
      toast.success('向下攤平試算內容（系統一與系統二）已成功儲存！');
    } catch (error) {
      toast.error('儲存失敗，請稍後再試');
    } finally {
      setIsSavingAveraging(false);
    }
  };

  const handlePlannedBuyPercentChange = async (val: string) => {
    setPlannedBuyPercentInput(val);
    const parsed = parseFloat(val);
    if (tab) {
      if (!isNaN(parsed) && parsed >= 0) {
        const cap = maxStrategyRiskPool60 * (parsed / 100);
        const price = (tab?.currentPrice && tab.currentPrice > 0) ? tab.currentPrice : (parseFloat(currentPriceInput) || 0);
        const qty = price > 0 ? Math.floor(cap / price) : 0;
        
        const batchSizes = computeBatchSizes(qty);
        const basePrice = (stats?.averagePrice && stats.averagePrice > 0)
          ? stats.averagePrice
          : (price > 0 ? price : 0);
        const sys1Ratios = [0.98, 0.96, 0.94, 0.92];
        const sys2Ratios = [0.97, 0.94, 0.91, 0.88];

        const newRowsSys1 = [0, 1, 2, 3].map(i => {
          const existing = averagingRows[i] || { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false };
          const priceSys1 = basePrice > 0 ? (basePrice * sys1Ratios[i]).toFixed(2) : existing.price;
          return {
            ...existing,
            price: existing.price || priceSys1,
            quantity: qty > 0 ? batchSizes[i].split1.toString() : '',
            quantity2: qty > 0 ? batchSizes[i].split2.toString() : '',
          };
        });

        const newRowsSys2 = [0, 1, 2, 3].map(i => {
          const existing = averagingRowsSys2[i] || { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false };
          const priceSys2 = basePrice > 0 ? (basePrice * sys2Ratios[i]).toFixed(2) : existing.price;
          return {
            ...existing,
            price: existing.price || priceSys2,
            quantity: qty > 0 ? batchSizes[i].split1.toString() : '',
            quantity2: qty > 0 ? batchSizes[i].split2.toString() : '',
          };
        });

        setAveragingRows(newRowsSys1);
        setAveragingRowsSys2(newRowsSys2);

        await updateTab(tab.id, {
          plannedBuyPercent: parsed,
          plannedBuyQty: qty,
          averagingRows: newRowsSys1,
          averagingRowsSys2: newRowsSys2,
        });
      } else if (val === '') {
        await updateTab(tab.id, {
          plannedBuyPercent: 0,
          plannedBuyQty: 0
        });
      }
    }
  };

  const handleStopLossChange = async (val: string) => {
    setStopLossInput(val);
    const parsed = parseFloat(val);
    if (tab) {
      if (!isNaN(parsed) && parsed >= 0) {
        await updateTab(tab.id, { stopLossPrice: parsed });
      } else if (val === '') {
        await updateTab(tab.id, { stopLossPrice: 0 });
      }
    }
  };

  const handleTakeProfitChange = async (val: string) => {
    setTakeProfitInput(val);
    const parsed = parseFloat(val);
    if (tab) {
      if (!isNaN(parsed) && parsed >= 0) {
        await updateTab(tab.id, { takeProfitPrice: parsed });
      } else if (val === '') {
        await updateTab(tab.id, { takeProfitPrice: 0 });
      }
    }
  };

  const handleSupportChange = async (val: string) => {
    setSupportInput(val);
    const parsed = parseFloat(val);
    if (tab) {
      if (!isNaN(parsed) && parsed >= 0) {
        await updateTab(tab.id, { supportPrice: parsed });
      } else if (val === '') {
        await updateTab(tab.id, { supportPrice: 0 });
      }
    }
  };

  const handleResistanceChange = async (val: string) => {
    setResistanceInput(val);
    const parsed = parseFloat(val);
    if (tab) {
      if (!isNaN(parsed) && parsed >= 0) {
        await updateTab(tab.id, { resistancePrice: parsed });
      } else if (val === '') {
        await updateTab(tab.id, { resistancePrice: 0 });
      }
    }
  };

  // Update preferredHoldingSubTab when tab changes so dashboard goes back to the right tab
  React.useEffect(() => {
    if (id) {
      safeSessionStorage.setItem('lastViewedStockId', id);
    }
    if (tab?.holdingStatus) {
       const displayStatus = ['觀察中', '買進操作', '賣出操作', '平倉操作', '乖離名單'].includes(tab.holdingStatus) ? tab.holdingStatus : '候選名單';
       safeSessionStorage.setItem('preferredHoldingSubTab', displayStatus);
    }
  }, [id, tab?.holdingStatus]);

  const lastDetailHKeyPressTimeRef = React.useRef<number>(0);

  // Keyboard shortcut handle (Shift + B to go back, Double H / Shift + H for fullscreen)
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.getAttribute('contenteditable') === 'true';
      
      // 快捷鍵 Alt + Z (或 Shift + B) -> 回到交易總覽頁面
      const isAltZ =
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ' || e.key === 'Ω' || e.keyCode === 90 || e.which === 90);

      const isShiftB =
        e.shiftKey &&
        (e.key === 'B' || e.key === 'b' || e.code === 'KeyB') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey;

      if (isAltZ || isShiftB) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (isInput) {
          (activeEl as HTMLElement)?.blur?.();
        }
        navigate('/', { state: { autoFlipTabId: id, returnStockId: id } });
        return;
      }

      if (isInput) return;

      // Double-tap 'h' / 'H' -> 進入/切換預覽模式 / 全螢幕
      const isPureH = (e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
      if (isPureH) {
        const now = Date.now();
        if (now - lastDetailHKeyPressTimeRef.current <= 500) {
          e.preventDefault();
          lastDetailHKeyPressTimeRef.current = 0;
          if (!document.fullscreenElement) {
            if (document.documentElement.requestFullscreen) {
              document.documentElement.requestFullscreen().then(() => {
                toast.success('已進入全螢幕 / 預覽模式', { id: 'fullscreen-mode', duration: 1500 });
              }).catch(() => {
                toast.success('已切換預覽模式', { id: 'fullscreen-mode', duration: 1500 });
              });
            } else {
              toast.success('已切換預覽模式', { id: 'fullscreen-mode', duration: 1500 });
            }
          } else {
            if (document.exitFullscreen) {
              document.exitFullscreen().then(() => {
                toast.info('已退出全螢幕 / 預覽模式', { id: 'fullscreen-mode', duration: 1500 });
              }).catch(() => {});
            }
          }
          return;
        } else {
          lastDetailHKeyPressTimeRef.current = now;
        }
      }

      if (e.shiftKey && e.key.toUpperCase() === 'H' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (!document.fullscreenElement) {
          if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().then(() => {
              toast.success('已進入全螢幕 / 預覽模式', { id: 'fullscreen-mode', duration: 1500 });
            }).catch(() => {});
          }
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen().then(() => {
              toast.info('已退出全螢幕 / 預覽模式', { id: 'fullscreen-mode', duration: 1500 });
            }).catch(() => {});
          }
        }
        return;
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
  }, [navigate, id]);

  const stats = calculateStats(trades, tab?.currentPrice);
  const optionPortfolio = React.useMemo(
    () => calculateOptionPortfolioSummary(trades, tab?.currentPrice, tab?.optionsCalcData),
    [trades, tab?.currentPrice, tab?.optionsCalcData]
  );

  // 尋找同股票代號的虛擬交易對應分頁 (若當前為真實交易，可用於一鍵移轉期權紀錄)
  const simulatedSiblingTab = React.useMemo(() => {
    if (!tab || tab.tradeType !== 'real') return null;
    return tabs.find(t => 
      t.id !== tab.id && 
      t.symbol?.trim().toUpperCase() === tab.symbol?.trim().toUpperCase() && 
      t.tradeType === 'simulated'
    ) || null;
  }, [tabs, tab]);

  const [isClearingRealOptions, setIsClearingRealOptions] = useState(false);
  const [isTransferringOptions, setIsTransferringOptions] = useState(false);

  // 清除此真實交易股票中的期權交易紀錄與期權試算設定
  const handleClearRealOptions = async () => {
    if (!tab) return;
    setIsClearingRealOptions(true);
    try {
      const optionTradesList = trades.filter(t => t.isOptionTrade);
      for (const ot of optionTradesList) {
        await deleteTrade(ot.id);
      }
      await updateTab(tab.id, { optionsCalcData: null });
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(`options_calc_${tab.id}`);
          localStorage.removeItem(`options_calc_${tab.symbol}_real`);
          localStorage.removeItem(`options_calc_${tab.symbol}`);
        } catch (e) {}
      }
      toast.success(`已成功清除 ${tab.symbol} 真實交易中的期權交易紀錄與試算！`);
    } catch (err) {
      toast.error('清除期權紀錄失敗，請稍後再試');
    } finally {
      setIsClearingRealOptions(false);
    }
  };

  // 一鍵將期權紀錄與試算轉移至對應的虛擬交易個股分頁
  const handleTransferOptionsToSimulated = async () => {
    if (!tab || !simulatedSiblingTab) return;
    setIsTransferringOptions(true);
    try {
      const optionTradesList = trades.filter(t => t.isOptionTrade);
      for (const ot of optionTradesList) {
        const sanitized: any = { ...ot };
        delete sanitized.id;
        Object.keys(sanitized).forEach(k => {
          if (sanitized[k] === undefined) delete sanitized[k];
        });
        await addDoc(collection(db, `stockTabs/${simulatedSiblingTab.id}/trades`), {
          ...sanitized,
          createdAt: serverTimestamp()
        });
        await deleteTrade(ot.id);
      }
      if (tab.optionsCalcData) {
        await updateTab(simulatedSiblingTab.id, { optionsCalcData: tab.optionsCalcData });
      }
      await updateTab(tab.id, { optionsCalcData: null });
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(`options_calc_${tab.id}`);
          localStorage.removeItem(`options_calc_${tab.symbol}_real`);
          localStorage.removeItem(`options_calc_${tab.symbol}`);
        } catch (e) {}
      }
      toast.success(`已將 ${optionTradesList.length} 筆期權紀錄與試算完整轉移至虛擬交易 (${simulatedSiblingTab.symbol})！`);
    } catch (err) {
      toast.error('轉移期權紀錄失敗，請稍後再試');
    } finally {
      setIsTransferringOptions(false);
    }
  };

  const prevTabIdRef = React.useRef<string | null>(null);
  const userHasModifiedCalcBasePriceRef = React.useRef<boolean>(false);

  // Prefill percentage calculator base price & refPnLPoint when data loaded
  React.useEffect(() => {
    if (!tab) return;

    const hasHolding = (stats?.totalQuantity ?? 0) !== 0 && (stats?.averagePrice ?? 0) > 0;
    const avgPrice = hasHolding ? stats.averagePrice : 0;
    const curPrice = tab.currentPrice && tab.currentPrice > 0 ? tab.currentPrice : 0;
    const baseVal = avgPrice > 0 ? avgPrice : curPrice;

    const isNewTab = prevTabIdRef.current !== tab.id;
    if (isNewTab) {
      prevTabIdRef.current = tab.id;
      userHasModifiedCalcBasePriceRef.current = false;
      if (baseVal > 0) {
        setCalcBasePrice(baseVal.toFixed(2));
      } else {
        setCalcBasePrice('');
      }
      setCalcPercent('3');
      setCalcType('SUB');

      if (tab.pyramidRows && Array.isArray(tab.pyramidRows)) {
        setPyramidRows(tab.pyramidRows);
      }
      if (tab.pyramidRowsSys2 && Array.isArray(tab.pyramidRowsSys2)) {
        setPyramidRowsSys2(tab.pyramidRowsSys2);
      }

      if (curPrice > 0) {
        if (!tab.refPnLPoint) {
          setRefPnLPoint(curPrice.toFixed(2));
        }
        if (!tab.refPnLPointSys2) {
          setRefPnLPointSys2(curPrice.toFixed(2));
        }
        if (!tab.refPnLPointUp) {
          setRefPnLPointUp(curPrice.toFixed(2));
        }
        if (!tab.refPnLPointUpSys2) {
          setRefPnLPointUpSys2(curPrice.toFixed(2));
        }
      } else {
        if (!tab.refPnLPoint) setRefPnLPoint('');
        if (!tab.refPnLPointSys2) setRefPnLPointSys2('');
        if (!tab.refPnLPointUp) setRefPnLPointUp('');
        if (!tab.refPnLPointUpSys2) setRefPnLPointUpSys2('');
      }
    } else {
      // If user has not manually modified the base price, keep it synced to average cost (if holding) or current price
      if (!userHasModifiedCalcBasePriceRef.current) {
        if (baseVal > 0) {
          setCalcBasePrice(baseVal.toFixed(2));
        }
      }
      if (curPrice > 0) {
        if (!refPnLPoint) setRefPnLPoint(curPrice.toFixed(2));
        if (!refPnLPointSys2) setRefPnLPointSys2(curPrice.toFixed(2));
        if (!refPnLPointUp) setRefPnLPointUp(curPrice.toFixed(2));
        if (!refPnLPointUpSys2) setRefPnLPointUpSys2(curPrice.toFixed(2));
      }
    }
  }, [tab?.id, tab?.currentPrice, stats?.averagePrice, stats?.totalQuantity]);

  // Keep expression in sync with manual inputs (section 2 -> section 1)
  React.useEffect(() => {
    const base = parseFloat(calcBasePrice) || 0;
    const op = calcType === 'ADD' ? '+' : '-';
    const pctStr = calcPercent === '' ? '' : calcPercent;
    
    if (base > 0) {
      if (pctStr !== '') {
        setCalcExpression(`${base.toFixed(2)} ${op} ${pctStr}%`);
      } else {
        setCalcExpression(`${base.toFixed(2)} ${op} 0%`);
      }
    }
  }, [calcBasePrice, calcType, calcPercent]);

  // Helper to parse and calculate: e.g. "56 - 7%" or "56 + 8%"
  const parseAndCalculatePercentage = (expr: string) => {
    if (!expr) return { success: false };
    
    // Clean string: remove leading/trailing spaces, remove leading $, and remove all spaces
    const clean = expr.trim().replace(/^\$/, '').replace(/\s+/g, '');
    
    // Regex matches:
    // Group 1: Base price (can have commas, digits, dots)
    // Group 2: Operator (+ or -)
    // Group 3: Percentage value (can have commas, digits, dots)
    // Optional trailing %
    const regex = /^([\d\.,]+)([\+\-])([\d\.,]+)%?$/;
    const match = clean.match(regex);
    
    if (match) {
      const baseStr = match[1].replace(/,/g, '');
      const op = match[2];
      const percentStr = match[3].replace(/,/g, '');
      
      const base = parseFloat(baseStr);
      const percent = parseFloat(percentStr);
      
      if (!isNaN(base) && !isNaN(percent)) {
        const isAdd = op === '+';
        const factor = isAdd ? (1 + percent / 100) : (1 - percent / 100);
        const result = base * factor;
        return { success: true, result, base, percent, isAdd };
      }
    }
    
    // If it's just a simple number (without operator)
    const simpleNumStr = clean.replace(/,/g, '');
    const simpleNum = parseFloat(simpleNumStr);
    if (!isNaN(simpleNum) && !clean.includes('+') && !clean.includes('-')) {
      return { success: true, result: simpleNum, base: simpleNum, percent: 0, isAdd: true };
    }
    
    return { success: false };
  };

  const parsedCalc = parseAndCalculatePercentage(calcExpression);

  // 當個股籌碼管理數據更新時，自動將最新持有數量與平均成本同步至 Firestore Tab 基礎資料
  React.useEffect(() => {
    if (!tab) return;
    const currentHoldingQty = tab.status !== 'COMPLETED' ? (stats?.totalQuantity ?? 0) : 0;
    const currentAvgPrice = (stats?.totalQuantity ?? 0) !== 0 && (stats?.averagePrice ?? 0) > 0 ? stats.averagePrice : 0;

    if (tab.holdingQuantity !== currentHoldingQty || tab.averageCost !== currentAvgPrice) {
      updateTab(tab.id, {
        holdingQuantity: currentHoldingQty,
        averageCost: currentAvgPrice,
      }).catch((err) => {
        console.error('Failed to sync holdingQuantity and averageCost to tab:', err);
      });
    }
  }, [tab?.id, tab?.status, tab?.holdingQuantity, tab?.averageCost, stats?.totalQuantity, stats?.averagePrice, updateTab]);

  // 當個股在籌碼管理區塊有持有數量數據且非已完成狀態時，自動依平均成本計算系統一與系統二組別1~4的預計購入股價 ($)（攤平與加碼）並且自動儲存設定
  React.useEffect(() => {
    if (!tab) return;
    if (tab.status === 'COMPLETED') return;

    const hasHolding = (stats?.totalQuantity ?? 0) !== 0 && (stats?.averagePrice ?? 0) > 0;
    if (!hasHolding) return;

    const avgPrice = stats.averagePrice;
    const { sys1: down1, sys2: down2 } = generateAveragingDownRows(avgPrice, averagingRows, averagingRowsSys2);
    const { sys1: up1, sys2: up2 } = generatePyramidUpRows(avgPrice, pyramidRows, pyramidRowsSys2);

    const isSys1Changed = down1.some((r, i) => r.price !== averagingRows[i]?.price);
    const isSys2Changed = down2.some((r, i) => r.price !== averagingRowsSys2[i]?.price);
    const isUp1Changed = up1.some((r, i) => r.price !== pyramidRows[i]?.price);
    const isUp2Changed = up2.some((r, i) => r.price !== pyramidRowsSys2[i]?.price);

    if (isSys1Changed || isSys2Changed || isUp1Changed || isUp2Changed) {
      if (isSys1Changed) setAveragingRows(down1);
      if (isSys2Changed) setAveragingRowsSys2(down2);
      if (isUp1Changed) setPyramidRows(up1);
      if (isUp2Changed) setPyramidRowsSys2(up2);

      // 自動將向下攤平與向上突破加碼試算設定儲存至 Firestore
      updateTab(tab.id, {
        averagingRows: down1,
        averagingRowsSys2: down2,
        pyramidRows: up1,
        pyramidRowsSys2: up2,
      }).catch((err) => {
        console.error('Failed to auto-save calculation rows:', err);
      });
    }
  }, [tab?.id, tab?.status, tab?.holdingStatus, stats?.averagePrice, stats?.totalQuantity]);

  // 若無持有數量時，依計算機算式填入首列股價
  React.useEffect(() => {
    const hasHolding = (stats?.totalQuantity ?? 0) !== 0 && (stats?.averagePrice ?? 0) > 0;
    if (hasHolding) return; // 有持有數量時由上方自動計算接管

    if (parsedCalc.success && typeof parsedCalc.result === 'number' && !isNaN(parsedCalc.result) && parsedCalc.result > 0) {
      const formattedResult = parsedCalc.result.toFixed(2);
      setAveragingRows((prevRows) => {
        if (prevRows[0].price === formattedResult) return prevRows;
        const newRows = [...prevRows];
        newRows[0] = { ...newRows[0], price: formattedResult };
        return newRows;
      });
      setAveragingRowsSys2((prevRows) => {
        if (prevRows[0].price === formattedResult) return prevRows;
        const newRows = [...prevRows];
        newRows[0] = { ...newRows[0], price: formattedResult };
        return newRows;
      });
      setPyramidRows((prevRows) => {
        if (prevRows[0].price === formattedResult) return prevRows;
        const newRows = [...prevRows];
        newRows[0] = { ...newRows[0], price: formattedResult };
        return newRows;
      });
      setPyramidRowsSys2((prevRows) => {
        if (prevRows[0].price === formattedResult) return prevRows;
        const newRows = [...prevRows];
        newRows[0] = { ...newRows[0], price: formattedResult };
        return newRows;
      });
    }
  }, [parsedCalc.success, parsedCalc.result, stats?.totalQuantity, stats?.averagePrice]);

  if (tabsLoading && !tab) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <p className="text-sm font-medium text-slate-600">載入個股資料中...</p>
      </div>
    );
  }

  if (!tab) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 gap-3">
        <p className="text-base font-semibold text-slate-700">找不到該股票分頁，或已被刪除。</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors"
        >
          返回儀表板
        </button>
      </div>
    );
  }

  const handlePresetClick = (p: string) => {
    const hasHolding = (stats?.totalQuantity ?? 0) !== 0 && (stats?.averagePrice ?? 0) > 0;
    const avgPrice = hasHolding ? stats.averagePrice : 0;
    const curPrice = tab?.currentPrice && tab.currentPrice > 0 ? tab.currentPrice : 0;
    const base = parseFloat(calcBasePrice) || avgPrice || curPrice || 0;
    if (base > 0) {
      const trimmed = p.trim();
      const isNeg = trimmed.startsWith('-');
      const val = trimmed.replace(/[\+\-%]/g, '').trim();
      setCalcType(isNeg ? 'SUB' : 'ADD');
      setCalcPercent(val);
      setCalcBasePrice(base.toFixed(2));
    }
  };

  // 一鍵根據手動輸入的基準股價 ($) 計算結果並匯入到系統一
  const handleImportBaseToSys1 = () => {
    const hasHolding = (stats?.totalQuantity ?? 0) !== 0 && (stats?.averagePrice ?? 0) > 0;
    const fallbackPrice = hasHolding ? stats.averagePrice : (tab?.currentPrice || 0);
    const base = parseFloat(calcBasePrice) || fallbackPrice;
    if (!base || base <= 0) {
      toast.error('請先於下方「基準股價 ($)」欄位輸入或確認有效數值');
      return;
    }
    playSuccessSound();

    if (calcComparisonTab === 'up') {
      // 向上突破加碼: +2%, +4%, +6%, +8%
      const p2 = (base * 1.02).toFixed(2);
      const p4 = (base * 1.04).toFixed(2);
      const p6 = (base * 1.06).toFixed(2);
      const p8 = (base * 1.08).toFixed(2);
      setPyramidRows(prev => {
        const next = [...prev];
        next[0] = { ...next[0], price: p2 };
        next[1] = { ...next[1], price: p4 };
        next[2] = { ...next[2], price: p6 };
        next[3] = { ...next[3], price: p8 };
        return next;
      });
      toast.success(`已將基準價 $${base.toFixed(2)} 依系統一階梯 (+2%, +4%, +6%, +8%) 匯入至加碼系統一欄位`);
    } else {
      // 向下攤平: -2%, -4%, -6%, -8%
      const p2 = (base * 0.98).toFixed(2);
      const p4 = (base * 0.96).toFixed(2);
      const p6 = (base * 0.94).toFixed(2);
      const p8 = (base * 0.92).toFixed(2);
      setAveragingRows(prev => {
        const next = [...prev];
        next[0] = { ...next[0], price: p2 };
        next[1] = { ...next[1], price: p4 };
        next[2] = { ...next[2], price: p6 };
        next[3] = { ...next[3], price: p8 };
        return next;
      });
      toast.success(`已將基準價 $${base.toFixed(2)} 依系統一階梯 (-2%, -4%, -6%, -8%) 匯入至系統一欄位`);
    }
  };

  // 一鍵根據手動輸入的基準股價 ($) 計算結果並匯入到系統二
  const handleImportBaseToSys2 = () => {
    const hasHolding = (stats?.totalQuantity ?? 0) !== 0 && (stats?.averagePrice ?? 0) > 0;
    const fallbackPrice = hasHolding ? stats.averagePrice : (tab?.currentPrice || 0);
    const base = parseFloat(calcBasePrice) || fallbackPrice;
    if (!base || base <= 0) {
      toast.error('請先於下方「基準股價 ($)」欄位輸入或確認有效數值');
      return;
    }
    playSuccessSound();

    if (calcComparisonTab === 'up') {
      // 向上突破加碼: +3%, +6%, +9%, +12%
      const p3 = (base * 1.03).toFixed(2);
      const p6 = (base * 1.06).toFixed(2);
      const p9 = (base * 1.09).toFixed(2);
      const p12 = (base * 1.12).toFixed(2);
      setPyramidRowsSys2(prev => {
        const next = [...prev];
        next[0] = { ...next[0], price: p3 };
        next[1] = { ...next[1], price: p6 };
        next[2] = { ...next[2], price: p9 };
        next[3] = { ...next[3], price: p12 };
        return next;
      });
      toast.success(`已將基準價 $${base.toFixed(2)} 依系統二階梯 (+3%, +6%, +9%, +12%) 匯入至加碼系統二欄位`);
    } else {
      // 向下攤平: -3%, -6%, -9%, -12%
      const p3 = (base * 0.97).toFixed(2);
      const p6 = (base * 0.94).toFixed(2);
      const p9 = (base * 0.91).toFixed(2);
      const p12 = (base * 0.88).toFixed(2);
      setAveragingRowsSys2(prev => {
        const next = [...prev];
        next[0] = { ...next[0], price: p3 };
        next[1] = { ...next[1], price: p6 };
        next[2] = { ...next[2], price: p9 };
        next[3] = { ...next[3], price: p12 };
        return next;
      });
      toast.success(`已將基準價 $${base.toFixed(2)} 依系統二階梯 (-3%, -6%, -9%, -12%) 匯入至系統二欄位`);
    }
  };

  // 一鍵同步匯入雙系統欄位
  const handleImportBaseToBoth = () => {
    const hasHolding = (stats?.totalQuantity ?? 0) !== 0 && (stats?.averagePrice ?? 0) > 0;
    const fallbackPrice = hasHolding ? stats.averagePrice : (tab?.currentPrice || 0);
    const base = parseFloat(calcBasePrice) || fallbackPrice;
    if (!base || base <= 0) {
      toast.error('請先於下方「基準股價 ($)」欄位輸入或確認有效數值');
      return;
    }
    playSuccessSound();

    if (calcComparisonTab === 'up') {
      // 系統一: +2%, +4%, +6%, +8%
      const p2 = (base * 1.02).toFixed(2);
      const p4 = (base * 1.04).toFixed(2);
      const p6 = (base * 1.06).toFixed(2);
      const p8 = (base * 1.08).toFixed(2);
      setPyramidRows(prev => {
        const next = [...prev];
        next[0] = { ...next[0], price: p2 };
        next[1] = { ...next[1], price: p4 };
        next[2] = { ...next[2], price: p6 };
        next[3] = { ...next[3], price: p8 };
        return next;
      });
      // 系統二: +3%, +6%, +9%, +12%
      const p3 = (base * 1.03).toFixed(2);
      const p6_2 = (base * 1.06).toFixed(2);
      const p9 = (base * 1.09).toFixed(2);
      const p12 = (base * 1.12).toFixed(2);
      setPyramidRowsSys2(prev => {
        const next = [...prev];
        next[0] = { ...next[0], price: p3 };
        next[1] = { ...next[1], price: p6_2 };
        next[2] = { ...next[2], price: p9 };
        next[3] = { ...next[3], price: p12 };
        return next;
      });
      toast.success(`已將基準價 $${base.toFixed(2)} 同步匯入至加碼系統一 (+2%~+8%) 與加碼系統二 (+3%~+12%) 全部欄位！`);
    } else {
      // 系統一: -2%, -4%, -6%, -8%
      const p2 = (base * 0.98).toFixed(2);
      const p4 = (base * 0.96).toFixed(2);
      const p6 = (base * 0.94).toFixed(2);
      const p8 = (base * 0.92).toFixed(2);
      setAveragingRows(prev => {
        const next = [...prev];
        next[0] = { ...next[0], price: p2 };
        next[1] = { ...next[1], price: p4 };
        next[2] = { ...next[2], price: p6 };
        next[3] = { ...next[3], price: p8 };
        return next;
      });
      // 系統二: -3%, -6%, -9%, -12%
      const p3 = (base * 0.97).toFixed(2);
      const p6_2 = (base * 0.94).toFixed(2);
      const p9 = (base * 0.91).toFixed(2);
      const p12 = (base * 0.88).toFixed(2);
      setAveragingRowsSys2(prev => {
        const next = [...prev];
        next[0] = { ...next[0], price: p3 };
        next[1] = { ...next[1], price: p6_2 };
        next[2] = { ...next[2], price: p9 };
        next[3] = { ...next[3], price: p12 };
        return next;
      });
      toast.success(`已將基準價 $${base.toFixed(2)} 同步匯入至系統一 (-2%~-8%) 與系統二 (-3%~-12%) 全部欄位！`);
    }
  };

  // Calculation of stock averaging for System 1 (-2%, -4%, -6%, -8%)
  const calculateAveraging = () => {
    let newSharesSum = 0;
    let newCostSum = 0;

    averagingRows.forEach(row => {
      const p = parseFloat(row.price);
      const q1 = parseFloat(row.quantity) || 0;
      const q2 = parseFloat(row.quantity2 ?? '') || 0;
      const q = q1 + q2;
      if (!isNaN(p) && p > 0 && q > 0) {
        newSharesSum += q;
        newCostSum += p * q;
      }
    });

    const currentShares = includeCurrentHolding ? stats.totalQuantity : 0;
    const currentPrice = includeCurrentHolding ? stats.averagePrice : 0;
    const currentCost = currentShares * currentPrice;

    const totalShares = currentShares + newSharesSum;
    const totalCost = currentCost + newCostSum;
    const finalAveragePrice = totalShares > 0 ? (totalCost / totalShares) : 0;

    let costReducedPercent = 0;
    if (stats.averagePrice > 0 && finalAveragePrice < stats.averagePrice) {
      costReducedPercent = ((stats.averagePrice - finalAveragePrice) / stats.averagePrice) * 100;
    }

    return {
      newSharesSum,
      newCostSum,
      totalShares,
      totalCost,
      finalAveragePrice,
      costReducedPercent
    };
  };

  // Calculation of stock averaging for System 2 (-3%, -6%, -9%, -12%)
  const calculateAveragingSys2 = () => {
    let newSharesSum = 0;
    let newCostSum = 0;

    averagingRowsSys2.forEach(row => {
      const p = parseFloat(row.price);
      const q1 = parseFloat(row.quantity) || 0;
      const q2 = parseFloat(row.quantity2 ?? '') || 0;
      const q = q1 + q2;
      if (!isNaN(p) && p > 0 && q > 0) {
        newSharesSum += q;
        newCostSum += p * q;
      }
    });

    const currentShares = includeCurrentHolding ? stats.totalQuantity : 0;
    const currentPrice = includeCurrentHolding ? stats.averagePrice : 0;
    const currentCost = currentShares * currentPrice;

    const totalShares = currentShares + newSharesSum;
    const totalCost = currentCost + newCostSum;
    const finalAveragePrice = totalShares > 0 ? (totalCost / totalShares) : 0;

    let costReducedPercent = 0;
    if (stats.averagePrice > 0 && finalAveragePrice < stats.averagePrice) {
      costReducedPercent = ((stats.averagePrice - finalAveragePrice) / stats.averagePrice) * 100;
    }

    return {
      newSharesSum,
      newCostSum,
      totalShares,
      totalCost,
      finalAveragePrice,
      costReducedPercent
    };
  };

  // Calculation of stock breakout pyramid up for System 1 (+2%, +4%, +6%, +8%)
  const calculatePyramidUp = () => {
    let newSharesSum = 0;
    let newCostSum = 0;

    pyramidRows.forEach(row => {
      const p = parseFloat(row.price);
      const q1 = parseFloat(row.quantity) || 0;
      const q2 = parseFloat(row.quantity2 ?? '') || 0;
      const q = q1 + q2;
      if (!isNaN(p) && p > 0 && q > 0) {
        newSharesSum += q;
        newCostSum += p * q;
      }
    });

    const currentShares = includeCurrentHoldingUp ? stats.totalQuantity : 0;
    const currentPrice = includeCurrentHoldingUp ? stats.averagePrice : 0;
    const currentCost = currentShares * currentPrice;

    const totalShares = currentShares + newSharesSum;
    const totalCost = currentCost + newCostSum;
    const finalAveragePrice = totalShares > 0 ? (totalCost / totalShares) : 0;

    let costDiffPercent = 0;
    if (stats.averagePrice > 0 && finalAveragePrice > 0) {
      costDiffPercent = ((finalAveragePrice - stats.averagePrice) / stats.averagePrice) * 100;
    }

    return {
      newSharesSum,
      newCostSum,
      totalShares,
      totalCost,
      finalAveragePrice,
      costDiffPercent
    };
  };

  // Calculation of stock breakout pyramid up for System 2 (+3%, +6%, +9%, +12%)
  const calculatePyramidUpSys2 = () => {
    let newSharesSum = 0;
    let newCostSum = 0;

    pyramidRowsSys2.forEach(row => {
      const p = parseFloat(row.price);
      const q1 = parseFloat(row.quantity) || 0;
      const q2 = parseFloat(row.quantity2 ?? '') || 0;
      const q = q1 + q2;
      if (!isNaN(p) && p > 0 && q > 0) {
        newSharesSum += q;
        newCostSum += p * q;
      }
    });

    const currentShares = includeCurrentHoldingUp ? stats.totalQuantity : 0;
    const currentPrice = includeCurrentHoldingUp ? stats.averagePrice : 0;
    const currentCost = currentShares * currentPrice;

    const totalShares = currentShares + newSharesSum;
    const totalCost = currentCost + newCostSum;
    const finalAveragePrice = totalShares > 0 ? (totalCost / totalShares) : 0;

    let costDiffPercent = 0;
    if (stats.averagePrice > 0 && finalAveragePrice > 0) {
      costDiffPercent = ((finalAveragePrice - stats.averagePrice) / stats.averagePrice) * 100;
    }

    return {
      newSharesSum,
      newCostSum,
      totalShares,
      totalCost,
      finalAveragePrice,
      costDiffPercent
    };
  };

  const avgResult = calculateAveraging();
  const parsedRefPnL = parseFloat(refPnLPoint);
  const hasRefPnL = refPnLPoint.trim() !== '' && !isNaN(parsedRefPnL);
  const calculatedPnLResult = hasRefPnL
    ? (avgResult.finalAveragePrice - parsedRefPnL) * avgResult.totalShares
    : null;

  const avgResultSys2 = calculateAveragingSys2();
  const parsedRefPnLSys2 = parseFloat(refPnLPointSys2);
  const hasRefPnLSys2 = refPnLPointSys2.trim() !== '' && !isNaN(parsedRefPnLSys2);
  const calculatedPnLResultSys2 = hasRefPnLSys2
    ? (avgResultSys2.finalAveragePrice - parsedRefPnLSys2) * avgResultSys2.totalShares
    : null;

  const pyrResult = calculatePyramidUp();
  const parsedRefPnLUp = parseFloat(refPnLPointUp);
  const hasRefPnLUp = refPnLPointUp.trim() !== '' && !isNaN(parsedRefPnLUp);
  const calculatedPnLResultUp = hasRefPnLUp
    ? (parsedRefPnLUp - pyrResult.finalAveragePrice) * pyrResult.totalShares
    : null;

  const pyrResultSys2 = calculatePyramidUpSys2();
  const parsedRefPnLUpSys2 = parseFloat(refPnLPointUpSys2);
  const hasRefPnLUpSys2 = refPnLPointUpSys2.trim() !== '' && !isNaN(parsedRefPnLUpSys2);
  const calculatedPnLResultUpSys2 = hasRefPnLUpSys2
    ? (parsedRefPnLUpSys2 - pyrResultSys2.finalAveragePrice) * pyrResultSys2.totalShares
    : null;

  // Four-batch transaction planning calculations
  // 若持有數量為 0，則此分批購入的紀錄歸零 (優先取 stats.totalQuantity，次取 tab.holdingQuantity)
  const effectiveHoldingAvgPrice = (stats?.averagePrice && stats.averagePrice > 0)
    ? stats.averagePrice
    : (typeof tab?.averageCost === 'number' && tab.averageCost > 0 ? tab.averageCost : (parseFloat(String(tab?.averageCost)) || 0));

  const effectiveHoldingQty = (stats?.totalQuantity !== undefined && stats.totalQuantity !== 0)
    ? stats.totalQuantity
    : (typeof tab?.holdingQuantity === 'number' && tab.holdingQuantity > 0 ? tab.holdingQuantity : (parseFloat(String(tab?.holdingQuantity)) || 0));

  const parsedPercent = parseFloat(plannedBuyPercentInput);
  const plannedPercent = (!isNaN(parsedPercent) && parsedPercent >= 0)
    ? parsedPercent
    : (tab?.plannedBuyPercent !== undefined && tab.plannedBuyPercent !== null ? tab.plannedBuyPercent : 0);

  // 可使用資金 = 最大策略風險池 * (百分比 / 100)
  const usableCapital = maxStrategyRiskPool60 * (plannedPercent / 100);

  // 當前股價
  const stockPrice = (tab?.currentPrice && tab.currentPrice > 0)
    ? tab.currentPrice
    : (parseFloat(currentPriceInput) || 0);

  // 可購買總數量與各批次規劃數值 (使用集中化 calculateBatchPlanning 確保與卡片視覺化完全一致)
  const batchPlanResult = calculateBatchPlanning({
    plannedBuyPercent: plannedPercent,
    currentPrice: stockPrice,
    holdingQty: effectiveHoldingQty,
    trades,
    averagingRowsSys2,
    plannedBuyQty: tab?.plannedBuyQty ? Number(tab.plannedBuyQty) : undefined,
    totalCapital,
    virtualCapital,
    tradeType: tab?.tradeType,
    maxStrategyRiskPool60,
  });

  const plannedQty = batchPlanResult.plannedQty;
  const b0 = batchPlanResult.batches[0];
  const b1 = batchPlanResult.batches[1];
  const b2 = batchPlanResult.batches[2];
  const b3 = batchPlanResult.batches[3];

  const size1 = b0.size;
  const size1_a = b0.split1.size;
  const size1_b = b0.split2.size;
  const bought1 = b0.bought;
  const remaining1 = b0.remaining;
  const bought1_a = b0.split1.bought;
  const remaining1_a = b0.split1.remaining;
  const bought1_b = b0.split2.bought;
  const remaining1_b = b0.split2.remaining;

  const size2 = b1.size;
  const size2_a = b1.split1.size;
  const size2_b = b1.split2.size;
  const bought2 = b1.bought;
  const remaining2 = b1.remaining;
  const bought2_a = b1.split1.bought;
  const remaining2_a = b1.split1.remaining;
  const bought2_b = b1.split2.bought;
  const remaining2_b = b1.split2.remaining;

  const size3 = b2.size;
  const size3_a = b2.split1.size;
  const size3_b = b2.split2.size;
  const bought3 = b2.bought;
  const remaining3 = b2.remaining;
  const bought3_a = b2.split1.bought;
  const remaining3_a = b2.split1.remaining;
  const bought3_b = b2.split2.bought;
  const remaining3_b = b2.split2.remaining;

  const size4 = b3.size;
  const size4_a = b3.split1.size;
  const size4_b = b3.split2.size;
  const bought4 = b3.bought;
  const remaining4 = b3.remaining;
  const bought4_a = b3.split1.bought;
  const remaining4_a = b3.split1.remaining;
  const bought4_b = b3.split2.bought;
  const remaining4_b = b3.split2.remaining;

  const totalBought = batchPlanResult.totalBought;
  const remainingToBuy = batchPlanResult.totalRemaining;

  let currentBatchText = "";
  let currentBatchOrderText = "";
  let currentBatchBought = 0;
  let currentBatchRemaining = 0;
  if (plannedQty <= 0) {
    currentBatchText = "未規劃預計購買";
    currentBatchOrderText = "無";
    currentBatchBought = 0;
    currentBatchRemaining = 0;
  } else if (totalBought < size1_a) {
    currentBatchText = "第 1 批 (7%) 進場中";
    currentBatchOrderText = "第一批(7%)";
    currentBatchBought = bought1_a;
    currentBatchRemaining = remaining1_a;
  } else if (totalBought < size1) {
    currentBatchText = "第 1 批 (8%) 進場中";
    currentBatchOrderText = "第一批(8%)";
    currentBatchBought = bought1_b;
    currentBatchRemaining = remaining1_b;
  } else if (totalBought < (size1 + size2_a)) {
    currentBatchText = "第 2 批 (10%) 進場中";
    currentBatchOrderText = "第二批(10%)";
    currentBatchBought = bought2_a;
    currentBatchRemaining = remaining2_a;
  } else if (totalBought < (size1 + size2)) {
    currentBatchText = "第 2 批 (15%) 進場中";
    currentBatchOrderText = "第二批(15%)";
    currentBatchBought = bought2_b;
    currentBatchRemaining = remaining2_b;
  } else if (totalBought < (size1 + size2 + size3_a)) {
    currentBatchText = "第 3 批 (15%) 進場中";
    currentBatchOrderText = "第三批(15%)";
    currentBatchBought = bought3_a;
    currentBatchRemaining = remaining3_a;
  } else if (totalBought < (size1 + size2 + size3)) {
    currentBatchText = "第 3 批 (20%) 進場中";
    currentBatchOrderText = "第三批(20%)";
    currentBatchBought = bought3_b;
    currentBatchRemaining = remaining3_b;
  } else if (totalBought < (size1 + size2 + size3 + size4_a)) {
    currentBatchText = "第 4 批 (10%) 進場中";
    currentBatchOrderText = "第四批(10%)";
    currentBatchBought = bought4_a;
    currentBatchRemaining = remaining4_a;
  } else if (totalBought < (size1 + size2 + size3 + size4)) {
    currentBatchText = "第 4 批 (15%) 進場中";
    currentBatchOrderText = "第四批(15%)";
    currentBatchBought = bought4_b;
    currentBatchRemaining = remaining4_b;
  } else {
    currentBatchText = "已滿批進場 (已完成)";
    currentBatchOrderText = "已滿批";
    currentBatchBought = size1 + size2 + size3 + size4;
    currentBatchRemaining = 0;
  }

  const batchConfigList = [
    {
      index: 0,
      name: "第一批 (15%)",
      size: size1,
      bought: bought1,
      remaining: remaining1,
      split1: {
        name: "第一批拆分交易(7%)",
        shortLabel: "拆分 7%",
        size: size1_a,
        bought: bought1_a,
        remaining: remaining1_a,
        percent: "7%",
      },
      split2: {
        name: "第一批拆分交易(8%)",
        shortLabel: "拆分 8%",
        size: size1_b,
        bought: bought1_b,
        remaining: remaining1_b,
        percent: "8%",
      },
    },
    {
      index: 1,
      name: "第二批 (25%)",
      size: size2,
      bought: bought2,
      remaining: remaining2,
      split1: {
        name: "第二批拆分交易(10%)",
        shortLabel: "拆分 10%",
        size: size2_a,
        bought: bought2_a,
        remaining: remaining2_a,
        percent: "10%",
      },
      split2: {
        name: "第二批拆分交易(15%)",
        shortLabel: "拆分 15%",
        size: size2_b,
        bought: bought2_b,
        remaining: remaining2_b,
        percent: "15%",
      },
    },
    {
      index: 2,
      name: "第三批 (35%)",
      size: size3,
      bought: bought3,
      remaining: remaining3,
      split1: {
        name: "第三批拆分交易(15%)",
        shortLabel: "拆分 15%",
        size: size3_a,
        bought: bought3_a,
        remaining: remaining3_a,
        percent: "15%",
      },
      split2: {
        name: "第三批拆分交易(20%)",
        shortLabel: "拆分 20%",
        size: size3_b,
        bought: bought3_b,
        remaining: remaining3_b,
        percent: "20%",
      },
    },
    {
      index: 3,
      name: "第四批 (25%)",
      size: size4,
      bought: bought4,
      remaining: remaining4,
      split1: {
        name: "第四批拆分交易(10%)",
        shortLabel: "拆分 10%",
        size: size4_a,
        bought: bought4_a,
        remaining: remaining4_a,
        percent: "10%",
      },
      split2: {
        name: "第四批拆分交易(15%)",
        shortLabel: "拆分 15%",
        size: size4_b,
        bought: bought4_b,
        remaining: remaining4_b,
        percent: "15%",
      },
    },
  ];

  // 視覺防線計算 (支撐、壓力、止損、止盈)
  const visualLevels = React.useMemo(() => {
    return getVisualPriceLevels(tab, strategy, plannedOrders);
  }, [tab, strategy, plannedOrders]);

  const handleBatchClick = (
    batchIndex: number,
    batchName: string,
    split1Qty: number,
    split2Qty: number,
    targetSplit?: 1 | 2
  ) => {
    if ((!split1Qty && !split2Qty) || (split1Qty <= 0 && split2Qty <= 0)) {
      toast.error('請先設定有效的預計購買佔比');
      return;
    }
    playClickSound();
    const basePrice = (stats?.averagePrice && stats.averagePrice > 0)
      ? stats.averagePrice
      : (tab?.currentPrice && tab.currentPrice > 0 ? tab.currentPrice : 0);

    // 系統一階梯比例:
    // 向下攤平: -2%, -4%, -6%, -8%
    const sys1RatiosDown = [0.98, 0.96, 0.94, 0.92];
    const sys1PercentTextsDown = ['-2%', '-4%', '-6%', '-8%'];
    // 向上加碼: +2%, +4%, +6%, +8%
    const sys1RatiosUp = [1.02, 1.04, 1.06, 1.08];
    const sys1PercentTextsUp = ['+2%', '+4%', '+6%', '+8%'];

    // 系統二階梯比例:
    // 向下攤平: -3%, -6%, -9%, -12%
    const sys2RatiosDown = [0.97, 0.94, 0.91, 0.88];
    const sys2PercentTextsDown = ['-3%', '-6%', '-9%', '-12%'];
    // 向上加碼: +3%, +6%, +9%, +12%
    const sys2RatiosUp = [1.03, 1.06, 1.09, 1.12];
    const sys2PercentTextsUp = ['+3%', '+6%', '+9%', '+12%'];

    if (batchIndex >= 0 && batchIndex < 4) {
      const priceSys1Down = basePrice > 0 ? (basePrice * sys1RatiosDown[batchIndex]).toFixed(2) : '';
      const priceSys2Down = basePrice > 0 ? (basePrice * sys2RatiosDown[batchIndex]).toFixed(2) : '';
      const priceSys1Up = basePrice > 0 ? (basePrice * sys1RatiosUp[batchIndex]).toFixed(2) : '';
      const priceSys2Up = basePrice > 0 ? (basePrice * sys2RatiosUp[batchIndex]).toFixed(2) : '';

      // 更新向下攤平系統一
      setAveragingRows(prev => {
        const next = [...prev];
        const currentRow = next[batchIndex] || { price: '', quantity: '', quantity2: '' };
        if (targetSplit === 1) {
          next[batchIndex] = {
            ...currentRow,
            price: currentRow.price || priceSys1Down,
            quantity: split1Qty.toString(),
          };
        } else if (targetSplit === 2) {
          next[batchIndex] = {
            ...currentRow,
            price: currentRow.price || priceSys1Down,
            quantity2: split2Qty.toString(),
          };
        } else {
          next[batchIndex] = {
            ...currentRow,
            price: currentRow.price || priceSys1Down,
            quantity: split1Qty.toString(),
            quantity2: split2Qty.toString(),
          };
        }
        return next;
      });

      // 更新向下攤平系統二
      setAveragingRowsSys2(prev => {
        const next = [...prev];
        const currentRow = next[batchIndex] || { price: '', quantity: '', quantity2: '' };
        if (targetSplit === 1) {
          next[batchIndex] = {
            ...currentRow,
            price: currentRow.price || priceSys2Down,
            quantity: split1Qty.toString(),
          };
        } else if (targetSplit === 2) {
          next[batchIndex] = {
            ...currentRow,
            price: currentRow.price || priceSys2Down,
            quantity2: split2Qty.toString(),
          };
        } else {
          next[batchIndex] = {
            ...currentRow,
            price: currentRow.price || priceSys2Down,
            quantity: split1Qty.toString(),
            quantity2: split2Qty.toString(),
          };
        }
        return next;
      });

      // 同步更新向上突破加碼系統一
      setPyramidRows(prev => {
        const next = [...prev];
        const currentRow = next[batchIndex] || { price: '', quantity: '', quantity2: '' };
        if (targetSplit === 1) {
          next[batchIndex] = {
            ...currentRow,
            price: currentRow.price || priceSys1Up,
            quantity: split1Qty.toString(),
          };
        } else if (targetSplit === 2) {
          next[batchIndex] = {
            ...currentRow,
            price: currentRow.price || priceSys1Up,
            quantity2: split2Qty.toString(),
          };
        } else {
          next[batchIndex] = {
            ...currentRow,
            price: currentRow.price || priceSys1Up,
            quantity: split1Qty.toString(),
            quantity2: split2Qty.toString(),
          };
        }
        return next;
      });

      // 同步更新向上突破加碼系統二
      setPyramidRowsSys2(prev => {
        const next = [...prev];
        const currentRow = next[batchIndex] || { price: '', quantity: '', quantity2: '' };
        if (targetSplit === 1) {
          next[batchIndex] = {
            ...currentRow,
            price: currentRow.price || priceSys2Up,
            quantity: split1Qty.toString(),
          };
        } else if (targetSplit === 2) {
          next[batchIndex] = {
            ...currentRow,
            price: currentRow.price || priceSys2Up,
            quantity2: split2Qty.toString(),
          };
        } else {
          next[batchIndex] = {
            ...currentRow,
            price: currentRow.price || priceSys2Up,
            quantity: split1Qty.toString(),
            quantity2: split2Qty.toString(),
          };
        }
        return next;
      });

      if (targetSplit === 1) {
        toast.success(`已將 ${batchName} (${split1Qty}股) 帶入第 ${batchIndex + 1} 組雙系統第一預計購入數量`);
      } else if (targetSplit === 2) {
        toast.success(`已將 ${batchName} (${split2Qty}股) 帶入第 ${batchIndex + 1} 組雙系統第二預計購入數量`);
      } else {
        toast.success(`已將 ${batchName} 拆分雙數量 (${split1Qty} + ${split2Qty} 股) 同步帶入第 ${batchIndex + 1} 組攤平與加碼雙系統試算！`);
      }
    }
  };

  const updatedAtMillis = getTimestampMillis(tab.updatedAt);
  const isStaleData = updatedAtMillis > 0
    ? (Date.now() - updatedAtMillis > 17 * 60 * 60 * 1000)
    : false;

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);
        let jsonArray = json;
        if (!Array.isArray(json)) {
          if (typeof json === 'object' && json !== null) {
            // Try to find if there is a nested array (e.g. { data: [...] })
            const possibleArray = Object.values(json).find(Array.isArray);
            if (possibleArray) {
              jsonArray = possibleArray;
            } else {
              // Assume it's a single object
              jsonArray = [json];
            }
          } else {
            throw new Error("無法解析的匯入資料格式");
          }
        }

        // Find the matching stock symbol
        const targetData = jsonArray.find((item: any) => {
          let foundSym = "";
          Object.entries(item).forEach(([key, value]) => {
            const normalizedKey = key.toUpperCase().replace(/[\s_\.\-]+/g, "");
            if (
              (normalizedKey === "SYM" ||
                normalizedKey === "SYMBOL" ||
                normalizedKey === "TICKER" ||
                normalizedKey === "代碼")
            ) {
              foundSym = String(value);
            }
          });
          return foundSym.toUpperCase() === tab.symbol.toUpperCase();
        });

        if (!targetData) {
          throw new Error(`找不到 ${tab.symbol} 的相關資料`);
        }

        const updates: any = {};
        
        Object.entries(targetData).forEach(([key, value]) => {
          const normalizedKey = key.toUpperCase().replace(/[\s_\.\-]+/g, "");
          if (normalizedKey.includes("QUALITY") && updates.qualityScore === undefined) {
            updates.qualityScore = Number(value);
          }
          if (normalizedKey.includes("VALUE") && updates.valueScore === undefined) {
            updates.valueScore = Number(value);
          }
          if ((normalizedKey.includes("CRASH") || normalizedKey.includes("崩盤")) && updates.crashSimilarity === undefined) {
             updates.crashSimilarity = Number(value);
          }
          if ((normalizedKey === "BUY" || normalizedKey === "BUYSCORE" || normalizedKey === "BUYRATE") && updates.buyRate === undefined) {
            updates.buyRate = Number(value);
          }
          if ((normalizedKey === "SELL" || normalizedKey === "SELLSCORE" || normalizedKey === "SELLRATE") && updates.sellRate === undefined) {
            updates.sellRate = Number(value);
          }
          if ((normalizedKey.includes("AISCORE") || normalizedKey.includes("AI分數") || normalizedKey.includes("AI評分") || normalizedKey === "RATING") && updates.rating === undefined) {
            updates.rating = Number(value);
          }
        });

        if (Object.keys(updates).length > 0) {
          updateTab(tab.id, updates);
          toast.success(`成功更新 ${tab.symbol} 的評分資料`);
        } else {
          toast.info("未能找到可更新的評分資料");
        }

      } catch (error: any) {
        toast.error(`匯入失敗: ${error.message}`);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    reader.readAsText(file);
  };

  const handleExportRatingJson = () => {
    try {
      const ratingData = {
        "代碼": tab.symbol,
        "rating": Number(tab.rating ?? 5),
        "qualityScore": Number(tab.qualityScore ?? 5),
        "valueScore": Number(tab.valueScore ?? 5),
        "crashSimilarity": Number(tab.crashSimilarity ?? 5),
        "buyRate": Number(tab.buyRate ?? 5),
        "sellRate": Number(tab.sellRate ?? 5)
      };

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(ratingData, null, 2)
      )}`;
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute("download", `${tab.symbol}_rating_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("評分數據已成功匯出為 JSON 檔案");
    } catch (error) {
      console.error(error);
      toast.error("匯出 JSON 失敗，請重試");
    }
  };

  const handleExportTradesJson = () => {
    try {
      const tradesToExport = trades.map(t => ({
        type: t.type,
        purpose: t.purpose,
        batch: t.batch || '',
        operator: t.operator || '人',
        price: t.price,
        quantity: t.quantity,
        tradeDate: getTimestampDate(t.tradeDate)?.toISOString() || new Date().toISOString(),
        fees: t.fees || 0,
        notes: t.notes || '',
        ...(t.isOptionTrade ? {
          isOptionTrade: true,
          optionType: t.optionType,
          positionSide: t.positionSide,
          strikePrice: t.strikePrice,
          dte: t.dte,
          entryOptionPrice: t.entryOptionPrice,
          entryStockPrice: t.entryStockPrice,
          targetStockPrice: t.targetStockPrice,
          contractAmount: t.contractAmount,
          totalHoldingCost: t.totalHoldingCost,
          contractsCount: t.contractsCount,
          contractMultiplier: t.contractMultiplier,
          delta: t.delta,
          theta: t.theta,
          gamma: t.gamma,
          vega: t.vega,
          ivPercent: t.ivPercent,
          interestRate: t.interestRate,
          purchaseDate: t.purchaseDate,
          manualCurrentOptionPrice: t.manualCurrentOptionPrice,
        } : {})
      }));

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(tradesToExport, null, 2)
      )}`;
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonString);
      const symbol = tab?.symbol || "trades";
      downloadAnchor.setAttribute("download", `${symbol}_trades_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("交易紀錄已成功匯出為 JSON 檔案");
    } catch (error) {
      console.error(error);
      toast.error("匯出 JSON 失敗，請重試");
    }
  };

  const handleImportTradesJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!id || !user) {
      toast.error("請確認已登入且頁面正常載入");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (!Array.isArray(parsed)) {
          toast.error("不正確的 JSON 格式，交易紀錄資料必須為 JSON 陣列");
          return;
        }

        const validTrades = parsed.filter((t: any) => {
          return t && typeof t.type === 'string' && (t.type === 'BUY' || t.type === 'SELL');
        });

        if (validTrades.length === 0) {
          toast.error("沒有找到有效的交易紀錄資料（必須包含交易方向 type 與其他數值）");
          return;
        }

        const batch = writeBatch(db);
        const tradesColRef = collection(db, `stockTabs/${id}/trades`);

        validTrades.forEach((item: any) => {
          const newDocRef = doc(tradesColRef);
          
          let dateVal: Date;
          if (item.tradeDate) {
            dateVal = new Date(item.tradeDate);
            if (isNaN(dateVal.getTime())) {
              dateVal = new Date();
            }
          } else {
            dateVal = new Date();
          }

          const payload: any = {
            type: item.type as 'BUY' | 'SELL',
            purpose: (item.purpose || '加碼') as '加碼' | '平倉',
            batch: item.batch || '',
            operator: (item.operator || '人') as '機器' | '人',
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 0,
            tradeDate: Timestamp.fromDate(dateVal),
            fees: Number(item.fees) || 0,
            notes: item.notes || '',
            createdAt: serverTimestamp()
          };

          if (item.isOptionTrade) {
            payload.isOptionTrade = true;
            if (item.optionType) payload.optionType = item.optionType;
            if (item.positionSide) payload.positionSide = item.positionSide;
            if (item.strikePrice !== undefined) payload.strikePrice = Number(item.strikePrice);
            if (item.dte !== undefined) payload.dte = Number(item.dte);
            if (item.entryOptionPrice !== undefined) payload.entryOptionPrice = Number(item.entryOptionPrice);
            if (item.entryStockPrice !== undefined) payload.entryStockPrice = Number(item.entryStockPrice);
            if (item.targetStockPrice !== undefined) payload.targetStockPrice = Number(item.targetStockPrice);
            if (item.contractAmount !== undefined) payload.contractAmount = Number(item.contractAmount);
            if (item.totalHoldingCost !== undefined) payload.totalHoldingCost = Number(item.totalHoldingCost);
            if (item.contractsCount !== undefined) payload.contractsCount = Number(item.contractsCount);
            if (item.contractMultiplier !== undefined) payload.contractMultiplier = Number(item.contractMultiplier);
            if (item.delta !== undefined) payload.delta = Number(item.delta);
            if (item.theta !== undefined) payload.theta = Number(item.theta);
            if (item.gamma !== undefined) payload.gamma = Number(item.gamma);
            if (item.vega !== undefined) payload.vega = Number(item.vega);
            if (item.ivPercent !== undefined) payload.ivPercent = Number(item.ivPercent);
            if (item.interestRate !== undefined) payload.interestRate = Number(item.interestRate);
            if (item.purchaseDate) payload.purchaseDate = String(item.purchaseDate);
            if (item.manualCurrentOptionPrice !== undefined) payload.manualCurrentOptionPrice = Number(item.manualCurrentOptionPrice);
          }

          batch.set(newDocRef, payload);
        });

        await batch.commit();
        toast.success(`成功匯入 ${validTrades.length} 筆交易紀錄！`);
      } catch (error) {
        console.error(error);
        toast.error("解析或儲存 JSON 檔案失敗，請確保檔案格式正確");
      } finally {
        if (tradesJsonFileInputRef.current) {
          tradesJsonFileInputRef.current.value = "";
        }
      }
    };
    reader.readAsText(file);
  };

  const handlePriceUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab && currentPriceInput && !isNaN(Number(currentPriceInput))) {
      updateCurrentPrice(tab.id, Number(currentPriceInput));
      playPriceImportSound();
    }
  };

  const handleFetchLivePrice = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!tab) return;
    const sym = tab.symbol || tab.companyName;
    if (!sym || !sym.trim()) {
      toast.error("此標的未設定股票代號");
      return;
    }
    setIsFetchingPrice(true);
    toast.loading("正在抓取最新現價...", { id: "fetchSinglePrice" });
    try {
      const res = await fetch(`/api/stock/${encodeURIComponent(sym.trim())}`);
      if (!res.ok) {
        toast.error("無法取得即時股票報價，請確認代號格式", { id: "fetchSinglePrice" });
        return;
      }
      const data = await res.json();
      const price =
        typeof data?.price === "number" && data.price > 0
          ? data.price
          : data?.chart?.result?.[0]?.meta?.regularMarketPrice;

      if (price && typeof price === "number" && price > 0) {
        await updateCurrentPrice(tab.id, price);
        playPriceImportSound();
        toast.success(`已成功更新現價為 $${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, {
          id: "fetchSinglePrice",
        });
      } else {
        toast.error("無法解析最新股票報價", { id: "fetchSinglePrice" });
      }
    } catch (err) {
      console.error(err);
      toast.error("抓取現價時發生錯誤", { id: "fetchSinglePrice" });
    } finally {
      setIsFetchingPrice(false);
    }
  };

  const handleTradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTrade({
      type: tradeForm.type as 'BUY' | 'SELL',
      purpose: tradeForm.purpose as '加碼' | '平倉',
      batch: tradeForm.batch || undefined,
      operator: tradeForm.operator as '機器' | '人',
      price: Number(tradeForm.price),
      quantity: Number(tradeForm.quantity),
      tradeDate: Timestamp.fromDate(new Date(tradeForm.tradeDate)),
      fees: Number(tradeForm.fees) || 0,
      notes: tradeForm.notes
    });
    playSuccessSound();
    setTradeForm({ ...tradeForm, price: '', quantity: '', fees: '', notes: '', batch: '' });
    setIsTradeOpen(false);
  };

  const handleCompleteAndClose = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!tab) return;
    const pnlVal = Number(finalPnLInput) || 0;
    try {
      setIsSubmittingComplete(true);
      await updateTabStatus(tab.id, 'COMPLETED', pnlVal);
      playSuccessSound();
      setIsCompleteOpen(false);
      toast.success('已完成交易結算，紀錄已移至「已完成」頁籤');
      navigate('/', { state: { returnStockId: tab.id } });
    } catch (err) {
      console.error(err);
      toast.error('完成交易失敗');
    } finally {
      setIsSubmittingComplete(false);
    }
  };

  const handleCompleteAndContinue = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!tab || !user) return;
    const pnlVal = Number(finalPnLInput) || 0;
    try {
      setIsSubmittingComplete(true);
      const { id: _, createdAt, updatedAt, ...restTab } = tab;

      // 1. Create snapshot record in stockTabs with status = 'COMPLETED'
      const newDocRef = await addDoc(collection(db, 'stockTabs'), {
        ...restTab,
        userId: user.uid,
        status: 'COMPLETED',
        finalPnL: pnlVal,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. Transfer current trades to the completed snapshot tab
      const tradesQuery = await getDocs(collection(db, `stockTabs/${tab.id}/trades`));
      if (!tradesQuery.empty) {
        for (const tradeDoc of tradesQuery.docs) {
          const tradeData = tradeDoc.data();
          await addDoc(collection(db, `stockTabs/${newDocRef.id}/trades`), tradeData);
        }
      }

      // 3. Copy strategy snapshot if exists
      try {
        const stratDoc = await getDoc(doc(db, `stockTabs/${tab.id}/strategy`, 'main'));
        if (stratDoc.exists()) {
          await setDoc(doc(db, `stockTabs/${newDocRef.id}/strategy`, 'main'), {
            ...stratDoc.data(),
            updatedAt: serverTimestamp()
          });
        }
      } catch (stratErr) {
        console.error('Error copying strategy to completed tab snapshot:', stratErr);
      }

      // 4. Delete current trades from active tab so that realized PnL, holdings, and trade count reset to 0
      if (!tradesQuery.empty) {
        const deletePromises = tradesQuery.docs.map((d) => deleteDoc(d.ref));
        await Promise.all(deletePromises);
      }

      // 5. Reset finalPnL on active tab
      await updateDoc(doc(db, 'stockTabs', tab.id), {
        finalPnL: 0,
        updatedAt: serverTimestamp()
      });

      // 6. Update user-scoped cached trades in sessionStorage
      try {
        const cachedTradesRaw = safeSessionStorage.getItem(`cached_tab_trades_v3_${user.uid}`);
        if (cachedTradesRaw) {
          const cachedTrades = JSON.parse(cachedTradesRaw);
          cachedTrades[tab.id] = [];
          safeSessionStorage.setItem(`cached_tab_trades_v3_${user.uid}`, JSON.stringify(cachedTrades));
        }
      } catch (e) {
        // Safe fail
      }

      playSuccessSound();
      setIsCompleteOpen(false);
      setFinalPnLInput('');
      toast.success(`已為 ${tab.symbol} 產生已完成交易紀錄（損益 $${pnlVal.toFixed(2)}），當前卡片籌碼與損益已歸零，可繼續記錄下一輪交易 🚀`);
    } catch (err) {
      console.error(err);
      toast.error('結算並繼續交易失敗');
    } finally {
      setIsSubmittingComplete(false);
    }
  };

  const handleReactivate = () => {
    updateTabStatus(tab.id, 'ACTIVE');
  };

  const handleDelete = () => {
    if (confirm(`確定要刪除 ${tab.symbol} 嗎？這將刪除所有相關的交易與計畫。`)) {
      deleteTab(tab.id);
      navigate('/');
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="h-[36px] flex items-center gap-2 bg-transparent select-none">
        <button
          onClick={() => navigate('/', { state: { autoFlipTabId: id, returnStockId: id } })}
          title="回到交易總覽 (Alt + Z)"
          className="flex items-center gap-1 text-[12px] font-bold transition-all hover:opacity-85 text-zinc-600 hover:text-zinc-900 cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>交易總覽</span>
          <span className="text-[10px] text-zinc-400 font-mono font-normal ml-0.5">(Alt+Z)</span>
        </button>
        <span className="text-[12px] text-zinc-300">/</span>
        <span className="text-[12px] font-bold text-zinc-800">{tab.symbol}</span>
      </div>
      <ScrollIn>
        <div className="space-y-2.5">
          {/* 正上方 區塊: AI 評分矩陣與核心操作工具列 (Rating Matrix & Action Controls) */}
          <div className="glass-panel border border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 p-2.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 lg:gap-4 overflow-visible relative">
            
            {/* 左側: AI 多維評分與多空動能模組 (評分, Quality, Value, Crash Sim, Buy Rate, Sell Rate, 波動性, POS/NEG VALUE) */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap overflow-x-auto scrollbar-hide py-0.5 shrink-0">
              {/* 核心 6 項分析評分 */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* 評分 */}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider leading-none">評分</span>
                  <Select value={String(tab.rating || 5)} onValueChange={(val) => updateTab(tab.id, { rating: Number(val) })}>
                    <SelectTrigger className="h-7 w-11 bg-white border border-zinc-200 text-zinc-800 font-extrabold text-xs ring-0 focus:ring-emerald-500/50 rounded-lg p-1 text-center justify-center shadow-2xs hover:border-zinc-300 transition-colors">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent className="glass-panel border-zinc-200 text-zinc-800 bg-white min-w-[50px]">
                      {[...Array(10)].map((_, i) => (
                        <SelectItem key={i+1} value={String(i+1)} className="text-xs text-zinc-700 focus:bg-zinc-100">{i+1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quality */}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider leading-none">Quality</span>
                  <Select value={String(tab.qualityScore || 5)} onValueChange={(val) => updateTab(tab.id, { qualityScore: Number(val) })}>
                    <SelectTrigger className="h-7 w-11 bg-white border border-zinc-200 text-zinc-800 font-extrabold text-xs ring-0 focus:ring-purple-500/50 rounded-lg p-1 text-center justify-center shadow-2xs hover:border-zinc-300 transition-colors">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent className="glass-panel border-zinc-200 text-zinc-800 bg-white min-w-[50px]">
                      {[...Array(10)].map((_, i) => (
                        <SelectItem key={i+1} value={String(i+1)} className="text-xs text-zinc-700 focus:bg-zinc-100">{i+1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Value */}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider leading-none">Value</span>
                  <Select value={String(tab.valueScore || 5)} onValueChange={(val) => updateTab(tab.id, { valueScore: Number(val) })}>
                    <SelectTrigger className="h-7 w-11 bg-white border border-zinc-200 text-zinc-800 font-extrabold text-xs ring-0 focus:ring-amber-500/50 rounded-lg p-1 text-center justify-center shadow-2xs hover:border-zinc-300 transition-colors">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent className="glass-panel border-zinc-200 text-zinc-800 bg-white min-w-[50px]">
                      {[...Array(10)].map((_, i) => (
                        <SelectItem key={i+1} value={String(i+1)} className="text-xs text-zinc-700 focus:bg-zinc-100">{i+1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Crash Sim */}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider leading-none whitespace-nowrap">Crash Sim</span>
                  <Select value={String(tab.crashSimilarity || 5)} onValueChange={(val) => updateTab(tab.id, { crashSimilarity: Number(val) })}>
                    <SelectTrigger className="h-7 w-11 bg-white border border-zinc-200 text-zinc-800 font-extrabold text-xs ring-0 focus:ring-rose-500/50 rounded-lg p-1 text-center justify-center shadow-2xs hover:border-zinc-300 transition-colors">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent className="glass-panel border-zinc-200 text-zinc-800 bg-white min-w-[50px]">
                      {[...Array(10)].map((_, i) => (
                        <SelectItem key={i+1} value={String(i+1)} className="text-xs text-zinc-700 focus:bg-zinc-100">{i+1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Buy Rate */}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider leading-none whitespace-nowrap">Buy Rate</span>
                  <Select value={String(tab.buyRate || 5)} onValueChange={(val) => updateTab(tab.id, { buyRate: Number(val) })}>
                    <SelectTrigger className="h-7 w-11 bg-white border border-zinc-200 text-zinc-800 font-extrabold text-xs ring-0 focus:ring-emerald-500/50 rounded-lg p-1 text-center justify-center shadow-2xs hover:border-zinc-300 transition-colors">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent className="glass-panel border-zinc-200 text-zinc-800 bg-white min-w-[50px]">
                      {[...Array(10)].map((_, i) => (
                        <SelectItem key={i+1} value={String(i+1)} className="text-xs text-zinc-700 focus:bg-zinc-100">{i+1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sell Rate */}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider leading-none whitespace-nowrap">Sell Rate</span>
                  <Select value={String(tab.sellRate || 5)} onValueChange={(val) => updateTab(tab.id, { sellRate: Number(val) })}>
                    <SelectTrigger className="h-7 w-11 bg-white border border-zinc-200 text-zinc-800 font-extrabold text-xs ring-0 focus:ring-red-500/50 rounded-lg p-1 text-center justify-center shadow-2xs hover:border-zinc-300 transition-colors">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent className="glass-panel border-zinc-200 text-zinc-800 bg-white min-w-[50px]">
                      {[...Array(10)].map((_, i) => (
                        <SelectItem key={i+1} value={String(i+1)} className="text-xs text-zinc-700 focus:bg-zinc-100">{i+1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Micro divider */}
              <div className="h-6 w-px bg-zinc-200/80 dark:bg-zinc-700 shrink-0 mx-0.5" />

              {/* 波動性與多空力道加總 */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* 波動性 */}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider leading-none">波動性</span>
                  <Select value={tab.volatility || '中等'} onValueChange={(val: any) => updateTab(tab.id, { volatility: val })}>
                    <SelectTrigger className="h-7 min-w-[66px] px-2 bg-white border border-zinc-200 text-zinc-800 font-bold text-xs ring-0 focus:ring-emerald-500/50 rounded-lg shadow-2xs hover:border-zinc-300 transition-colors">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent className="glass-panel border-zinc-200 text-zinc-800 bg-white">
                      <SelectItem value="低" className="text-xs text-blue-600 focus:bg-zinc-100 font-medium">低</SelectItem>
                      <SelectItem value="中等" className="text-xs text-amber-600 focus:bg-zinc-100 font-medium">中等</SelectItem>
                      <SelectItem value="高" className="text-xs text-rose-600 focus:bg-zinc-100 font-medium">高</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Pos Value */}
                <div className="flex flex-col items-center gap-0.5" title="Positive Score (多頭力道加總)">
                  <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider leading-none">POS VALUE</span>
                  <div className="h-7 min-w-[36px] px-2 bg-emerald-50 border border-emerald-500/25 text-emerald-700 font-black font-mono text-xs rounded-lg flex items-center justify-center tabular-nums shadow-2xs">
                    {Math.max(0, Number(tab.rating||5) - 5) + Math.max(0, Number(tab.qualityScore||5) - 5) + Math.max(0, Number(tab.valueScore||5) - 5) + Number(tab.buyRate||5)}
                  </div>
                </div>

                {/* Neg Value */}
                <div className="flex flex-col items-center gap-0.5" title="Negative Score (空頭力道加總)">
                  <span className="text-[9px] font-bold text-rose-600 uppercase tracking-wider leading-none">NEG VALUE</span>
                  <div className="h-7 min-w-[36px] px-2 bg-rose-50 border border-rose-500/25 text-rose-600 font-black font-mono text-xs rounded-lg flex items-center justify-center tabular-nums shadow-2xs">
                    {Math.max(0, 5 - Number(tab.rating||5)) + Math.max(0, 5 - Number(tab.qualityScore||5)) + Math.max(0, 5 - Number(tab.valueScore||5)) + Number(tab.sellRate||5)}
                  </div>
                </div>
              </div>
            </div>

            {/* 右側: 匯出 JSON、匯入 JSON 及操作按鈕群 */}
            <div className="flex items-center gap-2 shrink-0 overflow-x-auto scrollbar-hide py-0.5">
              <input
                type="file"
                accept=".json"
                className="hidden"
                ref={fileInputRef}
                onChange={handleJsonUpload}
              />
              <button 
                type="button"
                onClick={handleExportRatingJson}
                title="匯出此個股評分與設定 JSON"
                className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg flex items-center gap-1.5 border border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-900 transition-all text-xs font-semibold whitespace-nowrap shadow-2xs cursor-pointer group shrink-0"
              >
                <Download className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform text-zinc-500" />
                <span>匯出 JSON</span>
              </button>
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="匯入個股評分與設定 JSON"
                className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg flex items-center gap-1.5 border border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-900 transition-all text-xs font-semibold whitespace-nowrap shadow-2xs cursor-pointer group shrink-0"
              >
                <Upload className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform text-zinc-500" />
                <span>匯入 JSON</span>
              </button>

              {/* 交易模式切換器 (simulated / real) */}
              <Select value={tab.tradeType} onValueChange={(val: any) => updateTradeType(tab.id, val)}>
                <SelectTrigger className="h-7 sm:h-8 px-2.5 bg-white border border-zinc-200 text-zinc-800 text-xs font-bold focus:ring-emerald-500/50 rounded-lg shadow-2xs hover:border-zinc-300 transition-colors shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-panel border-zinc-200 text-zinc-800 bg-white min-w-[110px]">
                  <SelectItem value="simulated" className="text-xs font-semibold focus:bg-zinc-100">
                    <div className="flex items-center gap-1.5">
                      <Gamepad2 className="h-3.5 w-3.5 text-amber-600" />
                      <span>simulated</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="real" className="text-xs font-semibold focus:bg-zinc-100">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      <span>real</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* 完成交易 Dialog 按鈕 */}
              {tab.status === 'ACTIVE' ? (
                <Dialog open={isCompleteOpen} onOpenChange={setIsCompleteOpen}>
                  <DialogTrigger 
                    render={
                      <button className="h-7 sm:h-8 bg-sky-50 text-sky-700 border border-sky-200/90 hover:bg-sky-100 px-3 text-xs font-black rounded-lg whitespace-nowrap transition-colors flex items-center justify-center shrink-0 shadow-2xs cursor-pointer">
                        完成交易
                      </button>
                    } 
                  />
                  <DialogContent className="glass-panel border-zinc-250 shadow-2xl bg-white text-zinc-800 w-[92vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl sm:rounded-3xl">
                    <DialogHeader className="mb-1">
                      <DialogTitle className="font-extrabold text-xl text-zinc-900 flex items-center gap-2">
                        <span className="text-xl">🏆</span>
                        <span>結束交易並記錄最終損益</span>
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => e.preventDefault()} className="space-y-5 pt-1">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-zinc-700 font-bold text-xs">最終獲利或虧損金額 ($)</Label>
                          {stats && (
                            <button
                              type="button"
                              onClick={() => {
                                const calcPnL = (stats.realizedPnL + stats.unrealizedPnL);
                                setFinalPnLInput(calcPnL.toFixed(2));
                              }}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                            >
                              自動填入預估損益 (${(stats.realizedPnL + stats.unrealizedPnL).toFixed(2)})
                            </button>
                          )}
                        </div>
                        <Input 
                          type="number" 
                          step="0.01"
                          value={finalPnLInput}
                          onChange={e => setFinalPnLInput(e.target.value)}
                          placeholder="例如：500 或 -200"
                          className="bg-zinc-50/80 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus-visible:ring-emerald-500/50 font-mono font-black text-sm h-11 rounded-xl"
                          required 
                        />
                      </div>

                      <div className="space-y-2 pt-2">
                        <button
                          type="button"
                          onClick={handleCompleteAndClose}
                          disabled={isSubmittingComplete}
                          className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                        >
                          {isSubmittingComplete ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                          )}
                          <span>1. 輸入金額並關掉交易結算 (移至已完成)</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleCompleteAndContinue}
                          disabled={isSubmittingComplete}
                          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 disabled:opacity-50"
                        >
                          {isSubmittingComplete ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4 shrink-0" />
                          )}
                          <span>2. 輸入金額做交易結算並繼續交易 (保留卡片)</span>
                        </button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              ) : (
                <button onClick={handleReactivate} className="h-7 sm:h-8 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-3 sm:px-4 text-[11px] sm:text-xs font-bold rounded-lg whitespace-nowrap transition-all flex items-center justify-center shrink-0">
                  重新啟用
                </button>
              )}

              <button 
                onClick={handleDelete}
                className="h-7 sm:h-8 w-7 sm:w-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-650 hover:bg-red-50 border border-zinc-200 hover:border-red-200 transition-all shrink-0 shadow-2xs"
                title="刪除"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 下方 區塊: 個股識別與行情成本看板 (Symbol, Price, Average Cost, Shares, Option Portfolio) */}
          <div className="glass-panel border border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 p-3 sm:py-2.5 sm:px-4 rounded-xl sm:rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-3.5 sm:gap-5 overflow-visible relative">
            
            {/* Zone 1: 個股識別與行情成本 (股票代號、公司名稱、即時現價、平均成本、持股數、期權金額與當前損益) */}
            <div className="flex flex-wrap items-center gap-3.5 sm:gap-4 shrink-0">
            {/* Symbol & Company Name */}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <motion.h1 
                  layoutId="tab-title"
                  className="stock-symbol-title ps5-fluorescent-title text-2xl sm:text-2xl font-black tracking-tight text-black font-mono leading-none transition-all"
                >
                  {tab.symbol}
                </motion.h1>
                {tab.status === 'COMPLETED' && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20 font-bold text-[10px] px-2 py-0 rounded-full">
                    COMPLETED
                  </Badge>
                )}
              </div>
              {tab.companyName && (
                <span className="text-zinc-500 text-xs font-semibold tracking-wider truncate max-w-[170px] sm:max-w-[220px]" title={tab.companyName}>
                  {tab.companyName}
                </span>
              )}
            </div>

            {/* Hairline Divider */}
            <div className="h-7 w-px bg-zinc-200/80 hidden sm:block shrink-0" />

            {/* Price & Position Metrics Row */}
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
              {/* 現在價格 (可點擊修改，支援即時抓取更新) */}
              {isEditingPrice ? (
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-tight">現在價格</span>
                  <Input
                    type="number"
                    step="any"
                    autoFocus
                    className="h-6 w-20 text-xs font-bold text-zinc-800 bg-white border-emerald-500 p-1 mt-0.5"
                    value={tempPrice}
                    onChange={(e) => setTempPrice(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = parseFloat(tempPrice);
                        if (!isNaN(val) && val >= 0) {
                          updateCurrentPrice(tab.id, val);
                        }
                        setIsEditingPrice(false);
                      } else if (e.key === 'Escape') {
                        setIsEditingPrice(false);
                      }
                    }}
                    onBlur={() => {
                      const val = parseFloat(tempPrice);
                      if (!isNaN(val) && val >= 0) {
                        updateCurrentPrice(tab.id, val);
                      }
                      setIsEditingPrice(false);
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <div 
                    className="flex flex-col group cursor-pointer"
                    onClick={() => {
                      setTempPrice(tab.currentPrice?.toString() || '');
                      setIsEditingPrice(true);
                    }}
                    title="點擊手動修改現在價格"
                  >
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-tight flex items-center gap-1">
                      現在價格 <span className="opacity-0 group-hover:opacity-100 text-[8px] text-emerald-600 transition-opacity">✏️</span>
                    </span>
                    <span className="text-base sm:text-lg font-black text-emerald-700 tracking-tight leading-none mt-0.5 tabular-nums">
                      ${(tab.currentPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchLivePrice}
                    disabled={isFetchingPrice}
                    title="抓取最新即時現價"
                    className="p-1 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors disabled:opacity-50 mt-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetchingPrice ? 'animate-spin text-emerald-600' : ''}`} />
                  </button>
                </div>
              )}

              {/* Avg Cost */}
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-tight">AVG COST</span>
                <span className="text-base sm:text-lg font-black text-zinc-800 tracking-tight leading-none mt-0.5 tabular-nums">
                  ${stats.averagePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Total Shares */}
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-tight">TOTAL SHARES</span>
                <span className="text-base sm:text-lg font-black text-zinc-800 tracking-tight leading-none mt-0.5 tabular-nums">
                  {stats.totalQuantity} <span className="text-[10px] text-zinc-400 font-normal">股</span>
                </span>
              </div>

              {/* 期權合約與當前損益 (如有期權紀錄) */}
              {optionPortfolio.hasOptionRecords && (
                <>
                  <div
                    className="flex flex-col cursor-pointer group/opt"
                    onClick={() => {
                      setActiveTab('trades');
                      setChipsSubTab('calc');
                      setCalcComparisonTab('options');
                    }}
                    title="點擊查看期權計算器與期權交易紀錄"
                  >
                    <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest leading-tight">
                      期權合約金額
                    </span>
                    <span className="text-base sm:text-lg font-black font-mono text-emerald-800 tracking-tight leading-none mt-0.5 tabular-nums">
                      ${optionPortfolio.totalHoldingCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-[10px] font-bold text-emerald-600 ml-1">
                        ({optionPortfolio.totalContracts}張)
                      </span>
                    </span>
                  </div>
                  <div
                    className="flex flex-col cursor-pointer"
                    onClick={() => {
                      setActiveTab('trades');
                      setChipsSubTab('trades');
                    }}
                    title="隨現在股價與購買日經過天數自動計算之期權當前損益"
                  >
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-tight">
                      期權當前損益
                    </span>
                    <span
                      className={`text-base sm:text-lg font-black font-mono tracking-tight leading-none mt-0.5 tabular-nums ${
                        optionPortfolio.totalCurrentPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {optionPortfolio.totalCurrentPnL >= 0 ? '+' : '-'}$
                      {Math.abs(optionPortfolio.totalCurrentPnL).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>



        </div>
      </div>
    </ScrollIn>

      {/* Main Tabs Container */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* 毛玻璃膠囊式主 Tab 導航列 */}
        <div className="w-full overflow-x-auto whitespace-nowrap scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden mb-5">
          <div
            ref={mainTabListRef}
            role="tablist"
            aria-label="股票分析與紀錄主分頁導航"
            className="relative inline-flex items-center justify-start gap-1 p-1 bg-slate-200/80 dark:bg-zinc-800/80 backdrop-blur-md border border-slate-300/70 dark:border-zinc-700/70 rounded-full shadow-sm select-none min-w-max main-tabs-track"
          >
            {/* 單一白色滑動指示器 (250ms 緩動動畫，高度等於容器內高，絕不溢出) */}
            <div
              className="absolute top-1 bottom-1 bg-white dark:bg-zinc-900 rounded-full shadow-md pointer-events-none transition-all duration-[250ms] ease-out motion-reduce:transition-none z-0"
              style={{
                left: `${indicatorStyle.left}px`,
                width: `${indicatorStyle.width}px`,
              }}
            />

            {/* 1. 籌碼管理與交易紀錄 */}
            <button
              ref={(el) => { mainTabRefs.current['trades'] = el; }}
              role="tab"
              id="main-tab-trades"
              aria-selected={activeTab === 'trades'}
              aria-controls="main-panel-trades"
              tabIndex={activeTab === 'trades' ? 0 : -1}
              onClick={() => setActiveTab('trades')}
              onKeyDown={(e) => handleMainTabKeyDown(e, 'trades')}
              className={cn(
                "relative z-10 flex items-center gap-2 h-[40px] px-4 py-0 text-sm rounded-full transition-colors duration-150 cursor-pointer outline-none border-0 shrink-0 select-none",
                activeTab === 'trades'
                  ? "text-zinc-900 dark:text-zinc-100 font-bold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10 font-medium"
              )}
            >
              <Wallet className="h-[18px] w-[18px] shrink-0 text-current" strokeWidth={1.75} />
              <span className="text-sm whitespace-nowrap">籌碼管理與交易紀錄</span>
              <span
                className={cn(
                  "px-2 py-0.5 text-xs font-mono font-bold rounded-full min-w-[20px] inline-flex items-center justify-center leading-none transition-colors duration-150",
                  activeTab === 'trades'
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-300/80 dark:bg-zinc-700/80 text-slate-700 dark:text-zinc-300 main-tab-badge"
                )}
              >
                {trades.length}
              </span>
            </button>

            {/* 2. 策略計畫 */}
            <button
              ref={(el) => { mainTabRefs.current['strategy'] = el; }}
              role="tab"
              id="main-tab-strategy"
              aria-selected={activeTab === 'strategy'}
              aria-controls="main-panel-strategy"
              tabIndex={activeTab === 'strategy' ? 0 : -1}
              onClick={() => setActiveTab('strategy')}
              onKeyDown={(e) => handleMainTabKeyDown(e, 'strategy')}
              className={cn(
                "relative z-10 flex items-center gap-2 h-[40px] px-4 py-0 text-sm rounded-full transition-colors duration-150 cursor-pointer outline-none border-0 shrink-0 select-none",
                activeTab === 'strategy'
                  ? "text-zinc-900 dark:text-zinc-100 font-bold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10 font-medium"
              )}
            >
              <Target className="h-[18px] w-[18px] shrink-0 text-current" strokeWidth={1.75} />
              <span className="text-sm whitespace-nowrap">策略計畫</span>
              {plannedOrders.length > 0 && (
                <span
                  className={cn(
                    "px-2 py-0.5 text-xs font-mono font-bold rounded-full min-w-[20px] inline-flex items-center justify-center leading-none transition-colors duration-150",
                    activeTab === 'strategy'
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-300/80 dark:bg-zinc-700/80 text-slate-700 dark:text-zinc-300 main-tab-badge"
                  )}
                >
                  {plannedOrders.length}
                </span>
              )}
            </button>

            {/* 3. 主力與籌碼分析 */}
            <button
              ref={(el) => { mainTabRefs.current['chips'] = el; }}
              role="tab"
              id="main-tab-chips"
              aria-selected={activeTab === 'chips'}
              aria-controls="main-panel-chips"
              tabIndex={activeTab === 'chips' ? 0 : -1}
              onClick={() => setActiveTab('chips')}
              onKeyDown={(e) => handleMainTabKeyDown(e, 'chips')}
              className={cn(
                "relative z-10 flex items-center gap-2 h-[40px] px-4 py-0 text-sm rounded-full transition-colors duration-150 cursor-pointer outline-none border-0 shrink-0 select-none",
                activeTab === 'chips'
                  ? "text-zinc-900 dark:text-zinc-100 font-bold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10 font-medium"
              )}
            >
              <Activity className="h-[18px] w-[18px] shrink-0 text-current" strokeWidth={1.75} />
              <span className="text-sm whitespace-nowrap">主力與籌碼分析</span>
            </button>
          </div>
        </div>

        <TabsContent value="trades" id="main-panel-trades" className="space-y-4 pb-20 outline-none">
          {/* Stats Summary & Chips Management */}
          <ScrollIn delay={0.1}>
            <div className="w-full glass-panel bg-white/95 dark:bg-zinc-900/90 border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5.5 space-y-4 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.03)] chips-summary-panel">
          <div 
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group select-none"
            onClick={() => setIsStatsOpen(!isStatsOpen)}
          >
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2.5 text-zinc-800 dark:text-zinc-100 flex-wrap">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl shrink-0 flex items-center justify-center shadow-2xs">
                  <BarChart3 className="h-4.5 w-4.5" />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-base sm:text-lg tracking-tight text-zinc-900 dark:text-zinc-100">籌碼管理</h3>
                  {tab?.symbol && (
                    <span className="px-2.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/90 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-mono font-bold rounded-lg shadow-2xs">
                      {tab.symbol}
                    </span>
                  )}
                  {stats.totalQuantity > 0 ? (
                    <span className="px-2.5 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold rounded-full flex items-center gap-1.5 shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      持有中
                    </span>
                  ) : tab.status === 'COMPLETED' ? (
                    <span className="px-2.5 py-0.5 bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-[11px] font-bold rounded-full shadow-2xs">
                      已結算
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-[11px] font-semibold rounded-full shadow-2xs">
                      目前空倉
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAveragingHelpOpen(true);
                    }}
                    className="p-1 text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-full transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                    title="股價向下攤平試算與交易紀律說明"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/8 dark:bg-rose-500/15 border border-rose-500/20 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold flex-wrap">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="font-extrabold text-rose-800 dark:text-rose-200">交易紀律：</span>
                <span>分批進出場原則</span>
                <span className="opacity-40">·</span>
                <span>凱利公式資金控管</span>
                <span className="opacity-40">·</span>
                <span>強制浮動平倉價位</span>
                <span className="opacity-40">·</span>
                <span>單筆上限 40%</span>
                <span className="opacity-40">·</span>
                <span>總虧損上限為成本 6%</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 border border-zinc-200/80 dark:border-zinc-700/60 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-all shadow-2xs">
                <span>{isStatsOpen ? '收合指標' : '展開指標'}</span>
                <motion.div
                  animate={{ rotate: isStatsOpen ? 180 : 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="flex items-center justify-center text-zinc-500"
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
              </div>
            </div>
          </div>
          
          <AnimatePresence>
            {isStatsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="overflow-hidden"
              >
                <div className="pt-3 pb-1 border-t border-zinc-200/80 dark:border-zinc-800 mt-2">
                  {/* 6~7 大核心指標卡片區 (精緻比例與卡片化視覺，方案 B 獨立期權未實現損益卡片 ＋ 含期權 Toggle 開關) */}
                  {(() => {
                    const stockHoldingCost = (stats?.averagePrice || 0) * (stats?.totalQuantity || 0);
                    const optionHoldingCost = optionPortfolio.hasOptionRecords ? optionPortfolio.totalHoldingCost : 0;
                    const totalHoldingCost = includeOptionsInPnL && optionPortfolio.hasOptionRecords
                      ? stockHoldingCost + optionHoldingCost
                      : stockHoldingCost;

                    const stockUnrealizedPnL = stats?.unrealizedPnL || 0;
                    const optionCurrentPnL = optionPortfolio.hasOptionRecords ? optionPortfolio.totalCurrentPnL : 0;
                    const effectiveUnrealizedPnL = includeOptionsInPnL && optionPortfolio.hasOptionRecords
                      ? stockUnrealizedPnL + optionCurrentPnL
                      : stockUnrealizedPnL;

                    const unrealizedReturnPct = totalHoldingCost > 0
                      ? (effectiveUnrealizedPnL / totalHoldingCost) * 100
                      : 0;

                    const buyTradesCount = trades.filter((t) => t.type === 'BUY').length;
                    const sellTradesCount = trades.filter((t) => t.type === 'SELL').length;

                    return (
                      <div className={`grid grid-cols-2 sm:grid-cols-3 ${
                        optionPortfolio.hasOptionRecords ? 'lg:grid-cols-4 xl:grid-cols-7' : 'xl:grid-cols-6'
                      } gap-2.5 sm:gap-3.5 pt-1`}>
                        {/* 1. 持有數量 */}
                        <div className="flex flex-col justify-between bg-zinc-50/90 dark:bg-zinc-900/60 hover:bg-zinc-100/70 dark:hover:bg-zinc-850/70 border border-zinc-200/80 dark:border-zinc-800 p-3 sm:p-3.5 rounded-xl transition-all shadow-2xs group/card">
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">持有數量</span>
                            <div className="p-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              <Layers className="h-3.5 w-3.5" />
                            </div>
                          </div>
                          <div>
                            <div className="text-lg sm:text-xl font-black font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
                              {stats.totalQuantity.toLocaleString()} <span className="text-xs font-semibold text-zinc-400 font-sans">股</span>
                            </div>
                            <div className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
                              {stats.totalQuantity > 0 ? (trades.length > 0 ? '分批持倉中' : '現貨持倉') : '目前無持股'}
                            </div>
                          </div>
                        </div>

                        {/* 2. 平均成本 */}
                        <div className="flex flex-col justify-between bg-zinc-50/90 dark:bg-zinc-900/60 hover:bg-zinc-100/70 dark:hover:bg-zinc-850/70 border border-zinc-200/80 dark:border-zinc-800 p-3 sm:p-3.5 rounded-xl transition-all shadow-2xs group/card">
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">平均成本</span>
                            <div className="p-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                              <Target className="h-3.5 w-3.5" />
                            </div>
                          </div>
                          <div>
                            <div className="text-lg sm:text-xl font-black font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
                              ${stats.averagePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
                              {stats.totalQuantity > 0 && tab?.currentPrice ? (
                                tab.currentPrice >= stats.averagePrice ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">現價高於成本</span>
                                ) : (
                                  <span className="text-rose-600 dark:text-rose-400 font-bold">現價低於成本</span>
                                )
                              ) : '買入持股均價'}
                            </div>
                          </div>
                        </div>

                        {/* 3. 持有總成本 */}
                        <div className="flex flex-col justify-between bg-zinc-50/90 dark:bg-zinc-900/60 hover:bg-zinc-100/70 dark:hover:bg-zinc-850/70 border border-zinc-200/80 dark:border-zinc-800 p-3 sm:p-3.5 rounded-xl transition-all shadow-2xs group/card">
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                              {includeOptionsInPnL && optionPortfolio.hasOptionRecords ? '綜合總成本' : '持有總成本'}
                            </span>
                            <div className="p-1 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                              <Wallet className="h-3.5 w-3.5" />
                            </div>
                          </div>
                          <div>
                            <div className="text-lg sm:text-xl font-black font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
                              ${totalHoldingCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
                              {includeOptionsInPnL && optionPortfolio.hasOptionRecords ? (
                                <span>現股 ${stockHoldingCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} + 期權 ${optionHoldingCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                              ) : (
                                '累計投入現股資金'
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 4. 已實現損益 */}
                        <div className="flex flex-col justify-between bg-zinc-50/90 dark:bg-zinc-900/60 hover:bg-zinc-100/70 dark:hover:bg-zinc-850/70 border border-zinc-200/80 dark:border-zinc-800 p-3 sm:p-3.5 rounded-xl transition-all shadow-2xs group/card">
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">已實現損益</span>
                            <div className={`p-1 rounded-md ${stats.realizedPnL >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                              <DollarSign className="h-3.5 w-3.5" />
                            </div>
                          </div>
                          <div>
                            <div className={`text-lg sm:text-xl font-black font-mono tracking-tight ${stats.realizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {stats.realizedPnL >= 0 ? '+' : ''}${stats.realizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
                              {stats.realizedPnL > 0 ? '已獲利結算' : stats.realizedPnL < 0 ? '已停損結算' : '平倉累計損益'}
                            </div>
                          </div>
                        </div>

                        {/* 5. 未實現損益 / 最終損益 (核心重點卡，附「含期權」Toggle 開關) */}
                        <div className={`flex flex-col justify-between ${
                          (tab?.status === 'COMPLETED' ? (tab.finalPnL || 0) : effectiveUnrealizedPnL) >= 0
                            ? 'bg-emerald-500/6 dark:bg-emerald-500/12 border-emerald-500/35 shadow-[0_2px_12px_rgba(16,185,129,0.08)]'
                            : 'bg-rose-500/6 dark:bg-rose-500/12 border-rose-500/35 shadow-[0_2px_12px_rgba(244,63,94,0.08)]'
                        } p-3 sm:p-3.5 rounded-xl transition-all border group/card`}>
                          <div className="flex items-center justify-between gap-1 mb-1.5 flex-wrap">
                            <span className="text-[10px] sm:text-[11px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                              {tab?.status === 'COMPLETED'
                                ? '最終損益'
                                : includeOptionsInPnL && optionPortfolio.hasOptionRecords
                                ? '綜合未實現損益'
                                : '現股未實現損益'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {/* 方案 B 也提供「含期權」Toggle 開關 */}
                              {optionPortfolio.hasOptionRecords && tab?.status !== 'COMPLETED' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    playClickSound();
                                    setIncludeOptionsInPnL((prev) => {
                                      const next = !prev;
                                      toast.info(next ? '未實現損益：已切換為「含期權綜合損益」' : '未實現損益：已切換為「純現股損益」', {
                                        id: 'include-options-pnl-toggle',
                                        duration: 1500,
                                      });
                                      return next;
                                    });
                                  }}
                                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold transition-all cursor-pointer border select-none active:scale-95 ${
                                    includeOptionsInPnL
                                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-2xs'
                                      : 'bg-zinc-200/90 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-300'
                                  }`}
                                  title="切換未實現損益是否合併計入期權當前損益與合約成本"
                                >
                                  <span>含期權</span>
                                  <span className={`w-1.5 h-1.5 rounded-full ${includeOptionsInPnL ? 'bg-white shadow-[0_0_4px_#fff]' : 'bg-zinc-400'}`} />
                                </button>
                              )}
                              {tab?.status !== 'COMPLETED' && tab?.currentPrice ? (
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-white/80 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 shadow-2xs">
                                  現價 ${tab.currentPrice}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div>
                            {tab?.status === 'COMPLETED' ? (
                              <div className={`text-lg sm:text-xl font-black font-mono tracking-tight ${(tab.finalPnL || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {(tab.finalPnL || 0) >= 0 ? '+' : ''}${tab.finalPnL?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-baseline gap-1.5 flex-wrap">
                                  <span className={`text-lg sm:text-xl font-black font-mono tracking-tight ${effectiveUnrealizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {effectiveUnrealizedPnL >= 0 ? '+' : ''}${effectiveUnrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                  {totalHoldingCost > 0 && (
                                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                                      effectiveUnrealizedPnL >= 0 
                                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' 
                                        : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                                    }`}>
                                      {unrealizedReturnPct >= 0 ? '+' : ''}{unrealizedReturnPct.toFixed(2)}%
                                    </span>
                                  )}
                                </div>
                                {includeOptionsInPnL && optionPortfolio.hasOptionRecords ? (
                                  <div className="flex items-center gap-1 mt-1 text-[9px] font-mono font-bold flex-wrap">
                                    <span className="px-1 py-0.2 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                      現股: {stockUnrealizedPnL >= 0 ? '+' : ''}${stockUnrealizedPnL.toFixed(1)}
                                    </span>
                                    <span className={`px-1 py-0.2 rounded ${
                                      optionCurrentPnL >= 0 
                                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200' 
                                        : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200'
                                    }`}>
                                      期權: {optionCurrentPnL >= 0 ? '+' : ''}${optionCurrentPnL.toFixed(1)}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                                    現貨浮動部位即時試算
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 6. 方案 B: 期權未實現損益 (獨立並列卡片) */}
                        {optionPortfolio.hasOptionRecords && (
                          <div className={`flex flex-col justify-between ${
                            optionPortfolio.totalCurrentPnL >= 0
                              ? 'bg-emerald-500/6 dark:bg-emerald-500/12 border-emerald-500/35 shadow-[0_2px_12px_rgba(16,185,129,0.08)]'
                              : 'bg-rose-500/6 dark:bg-rose-500/12 border-rose-500/35 shadow-[0_2px_12px_rgba(244,63,94,0.08)]'
                          } p-3 sm:p-3.5 rounded-xl transition-all border group/card`}>
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <span className="text-[10px] sm:text-[11px] font-black text-emerald-900 dark:text-emerald-200 uppercase tracking-wider flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                期權未實現損益
                              </span>
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-white/90 dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 shadow-2xs">
                                {optionPortfolio.totalContracts} 張
                              </span>
                            </div>
                            <div>
                              <div className="flex items-baseline gap-1.5 flex-wrap">
                                <span className={`text-lg sm:text-xl font-black font-mono tracking-tight ${
                                  optionPortfolio.totalCurrentPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                }`}>
                                  {optionPortfolio.totalCurrentPnL >= 0 ? '+' : ''}${optionPortfolio.totalCurrentPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                {optionPortfolio.totalHoldingCost > 0 && (
                                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                                    optionPortfolio.totalCurrentPnL >= 0 
                                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' 
                                      : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                                  }`}>
                                    {optionPortfolio.totalRoiPct >= 0 ? '+' : ''}{optionPortfolio.totalRoiPct.toFixed(2)}%
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
                                成本 ${optionPortfolio.totalHoldingCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} · 市值 ${optionPortfolio.totalCurrentMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 7. 交易次數 */}
                        <div className="flex flex-col justify-between bg-zinc-50/90 dark:bg-zinc-900/60 hover:bg-zinc-100/70 dark:hover:bg-zinc-850/70 border border-zinc-200/80 dark:border-zinc-800 p-3 sm:p-3.5 rounded-xl transition-all shadow-2xs group/card">
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">交易筆數</span>
                            <div className="p-1 rounded-md bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                              <History className="h-3.5 w-3.5" />
                            </div>
                          </div>
                          <div>
                            <div className="text-lg sm:text-xl font-black font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
                              {trades.length} <span className="text-xs font-semibold text-zinc-400 font-sans">筆</span>
                            </div>
                            <div className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
                              買進 {buyTradesCount} · 賣出 {sellTradesCount}
                              {optionPortfolio.optionTradesCount > 0 ? ` · 期權 ${optionPortfolio.optionTradesCount} 筆` : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 期權交易紀錄 Dashboard 指標面板 (顯示合約金額、總持倉成本、Delta 與隨現價自動計算之期權當前損益) */}
                  {optionPortfolio.hasOptionRecords && (
                    <div className="mt-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-300/80 dark:border-emerald-800/60 rounded-xl p-3.5 sm:p-4 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-emerald-200/70 dark:border-emerald-800/50">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-800 text-white rounded-md">
                            期權 Dashboard
                          </span>
                          <span className="text-xs font-black text-emerald-950 dark:text-emerald-100">
                            {optionPortfolio.source === 'trades'
                              ? `期權交易紀錄持倉總覽 (${optionPortfolio.optionTradesCount} 筆紀錄 · 共 ${optionPortfolio.totalContracts} 張合約)`
                              : `已儲存期權試算持倉 (${optionPortfolio.totalContracts} 張合約)`}
                          </span>
                          {optionPortfolio.latestMetrics && (
                            <span className="text-[11px] font-mono font-bold text-emerald-800 bg-white/90 px-2 py-0.5 rounded border border-emerald-200">
                              {optionPortfolio.latestMetrics.positionSide === 'buy' ? '買入 Long' : '賣出 Short'}{' '}
                              {optionPortfolio.latestMetrics.optionType.toUpperCase()} @ $
                              {optionPortfolio.latestMetrics.strikePrice} · 購買日{' '}
                              {optionPortfolio.latestMetrics.purchaseDate || '今日'} (經過{' '}
                              {optionPortfolio.latestMetrics.daysElapsed} 天)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setChipsSubTab('calc');
                              setCalcComparisonTab('options');
                            }}
                            className="text-[11px] font-bold text-emerald-900 bg-white hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            開啟期權計算器
                          </button>
                          <button
                            type="button"
                            onClick={() => setChipsSubTab('trades')}
                            className="text-[11px] font-bold text-white bg-emerald-800 hover:bg-emerald-900 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            查看交易紀錄 ({optionPortfolio.optionTradesCount})
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                        {/* 1. 期權合約金額 (單張 × 100 股) */}
                        <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-emerald-200/90 shadow-2xs">
                          <span className="text-[10px] sm:text-[11px] font-bold text-zinc-500 block">
                            期權合約金額 (×100股)
                          </span>
                          <div className="text-base sm:text-lg font-black font-mono text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                            $
                            {optionPortfolio.latestContractAmount.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                            <span className="text-[11px] font-semibold text-zinc-400 ml-1">/ 張</span>
                          </div>
                          <span className="text-[10px] font-mono text-zinc-400 block mt-0.5">
                            開倉單價 ${optionPortfolio.latestMetrics?.entryOptionPrice.toFixed(2) || '0.00'}/股
                          </span>
                        </div>

                        {/* 2. 期權總持倉成本 */}
                        <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-emerald-200/90 shadow-2xs">
                          <span className="text-[10px] sm:text-[11px] font-bold text-zinc-500 block">
                            期權總持倉成本 ({optionPortfolio.totalContracts}張)
                          </span>
                          <div className="text-base sm:text-lg font-black font-mono text-emerald-900 dark:text-emerald-300 mt-0.5 tabular-nums">
                            $
                            {optionPortfolio.totalHoldingCost.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </div>
                          <span className="text-[10px] font-mono text-zinc-400 block mt-0.5">
                            當前總市值: $
                            {optionPortfolio.totalCurrentMarketValue.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </span>
                        </div>

                        {/* 3. 期權 Delta 與持有經過天數 */}
                        <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-emerald-200/90 shadow-2xs">
                          <span className="text-[10px] sm:text-[11px] font-bold text-zinc-500 block">
                            部位 Delta (Δ) 與經過天數
                          </span>
                          <div className="text-base sm:text-lg font-black font-mono text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                            Δ {optionPortfolio.netPositionDelta >= 0 ? '+' : ''}
                            {optionPortfolio.netPositionDelta.toFixed(4)}
                          </div>
                          <span className="text-[10px] font-mono text-amber-800 block mt-0.5">
                            持有經過 {optionPortfolio.latestMetrics?.daysElapsed ?? 0} 天 (Theta 衰減)
                          </span>
                        </div>

                        {/* 4. 期權當前損益 (隨現在股價自動計算) */}
                        <div
                          className={`p-3 rounded-xl border shadow-2xs ${
                            optionPortfolio.totalCurrentPnL >= 0
                              ? 'bg-emerald-500/10 border-emerald-400 text-emerald-950'
                              : 'bg-rose-500/10 border-rose-400 text-rose-950'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] sm:text-[11px] font-extrabold block">
                              期權當前損益 (隨現價)
                            </span>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-white/80">
                              {optionPortfolio.totalRoiPct >= 0 ? '+' : ''}
                              {optionPortfolio.totalRoiPct.toFixed(2)}%
                            </span>
                          </div>
                          <div
                            className={`text-base sm:text-lg font-black font-mono mt-0.5 tabular-nums ${
                              optionPortfolio.totalCurrentPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {optionPortfolio.totalCurrentPnL >= 0 ? '+' : '-'}$
                            {Math.abs(optionPortfolio.totalCurrentPnL).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </div>
                          <span className="text-[10px] font-mono opacity-80 block mt-0.5">
                            自動平倉價 ${optionPortfolio.latestMetrics?.autoCurrentOptionPrice.toFixed(2) || '0.00'} (現價 $
                            {(tab?.currentPrice || 0).toFixed(2)})
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 若此個股為「真實交易」，但包含期權紀錄或試算，顯示一鍵移轉或清除提示橫幅 */}
                  {tab?.tradeType === 'real' && (optionPortfolio.hasOptionRecords || trades.some(t => t.isOptionTrade)) && (
                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 mt-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-300 shrink-0 mt-0.5">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-sm font-black text-amber-950 dark:text-amber-100 flex items-center gap-2 flex-wrap">
                            <span>真實交易個股頁面出現期權紀錄</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200">
                              {trades.filter(t => t.isOptionTrade).length > 0
                                ? `${trades.filter(t => t.isOptionTrade).length} 筆期權紀錄`
                                : '含有期權試算設定'}
                            </span>
                          </div>
                          <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                            此頁面為「真實交易」，若您的期權交易僅在「虛擬交易」操作，可一鍵將此期權紀錄轉移至對應的虛擬交易個股，或直接從此處完全清除。
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center shrink-0 flex-wrap">
                        {simulatedSiblingTab && (
                          <button
                            type="button"
                            onClick={handleTransferOptionsToSimulated}
                            disabled={isTransferringOptions || isClearingRealOptions}
                            className="px-3.5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                            title={`將期權紀錄移轉至虛擬交易分頁 (${simulatedSiblingTab.symbol})`}
                          >
                            {isTransferringOptions ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            )}
                            <span>移轉至虛擬交易 ({simulatedSiblingTab.symbol})</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleClearRealOptions}
                          disabled={isClearingRealOptions || isTransferringOptions}
                          className="px-3.5 py-2 text-xs font-bold bg-white dark:bg-zinc-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800 rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                          title="一鍵清除真實個股中的期權交易紀錄與期權試算"
                        >
                          {isClearingRealOptions ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          )}
                          <span>清除此處期權紀錄</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* iOS 風格 Segmented Control 子分頁 (籌碼與攤平試算 vs 交易紀錄) */}
                  <Tabs value={chipsSubTab} onValueChange={(v) => setChipsSubTab(v as 'calc' | 'trades')} className="w-full mt-4">
                    <div className="w-full flex justify-start">
                      <div
                        ref={subTabListRef}
                        role="tablist"
                        aria-label="籌碼與交易紀錄子分頁"
                        className="relative inline-flex items-center justify-start bg-[#eceff3] dark:bg-zinc-800/90 p-[4px] rounded-[12px] gap-1 select-none w-fit border border-black/5 dark:border-white/5 chips-subtabs-track"
                      >
                        {/* 白色滑動選中塊 (200ms 滑動動畫，圓角 9px，輕微陰影) */}
                        <div
                          className="absolute top-[4px] bottom-[4px] bg-white dark:bg-zinc-900 rounded-[9px] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)] pointer-events-none transition-all duration-200 ease-out z-0"
                          style={{
                            left: `${subIndicatorStyle.left}px`,
                            width: `${subIndicatorStyle.width}px`,
                          }}
                        />

                        {/* 子選項 1: 籌碼與攤平試算 */}
                        <button
                          ref={(el) => { subTabRefs.current['calc'] = el; }}
                          type="button"
                          role="tab"
                          aria-selected={chipsSubTab === 'calc'}
                          onClick={() => setChipsSubTab('calc')}
                          className={cn(
                            "relative z-10 h-[32px] px-3.5 text-xs flex items-center justify-center gap-1.5 rounded-[9px] transition-colors duration-150 cursor-pointer outline-none border-0 shrink-0 select-none",
                            chipsSubTab === 'calc'
                              ? "text-zinc-900 dark:text-zinc-100 font-semibold"
                              : "text-[#475569] dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-normal"
                          )}
                        >
                          <Calculator className="h-3.5 w-3.5 shrink-0 text-current" strokeWidth={1.75} />
                          <span>籌碼與攤平試算</span>
                        </button>

                        {/* 子選項 2: 交易紀錄 */}
                        <button
                          ref={(el) => { subTabRefs.current['trades'] = el; }}
                          type="button"
                          role="tab"
                          aria-selected={chipsSubTab === 'trades'}
                          onClick={() => setChipsSubTab('trades')}
                          className={cn(
                            "relative z-10 h-[32px] px-3.5 text-xs flex items-center justify-center gap-1.5 rounded-[9px] transition-colors duration-150 cursor-pointer outline-none border-0 shrink-0 select-none",
                            chipsSubTab === 'trades'
                              ? "text-zinc-900 dark:text-zinc-100 font-semibold"
                              : "text-[#475569] dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-normal"
                          )}
                        >
                          <History className="h-3.5 w-3.5 shrink-0 text-current" strokeWidth={1.75} />
                          <span>交易紀錄</span>
                          <span className={cn(
                            "px-1.5 py-0.5 text-[11px] font-mono font-semibold rounded-md leading-none min-w-[18px] inline-flex items-center justify-center transition-colors",
                            chipsSubTab === 'trades'
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-black/5 dark:bg-white/10 text-[#475569] dark:text-zinc-400"
                          )}>
                            {trades.length}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* 子分頁 1: 籌碼試算與規劃 */}
                    <TabsContent value="calc" className="pt-2 space-y-3 outline-none">
                      {/* Primial 分批進場金字塔快捷功能工具列 (完全對齊 Primial 頁面上的功能按鈕) */}
                      <div 
                        className="w-[calc(100%+2rem)] sm:w-[calc(100%+2.75rem)] -mx-4 sm:-mx-5.5 bg-[#ABE2FF] border-y border-[#89d1f7] rounded-none px-4 sm:px-5.5 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-xs"
                        style={{ backgroundColor: "#ABE2FF" }}
                      >
                        {/* 左側：Primial 標籤與提示 */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-black text-zinc-950 tracking-tight flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-amber-600" />
                            <span>Primial</span>
                            <span className="hidden sm:inline text-xs font-bold text-zinc-800">分批進場金字塔動態互動圖表</span>
                          </span>
                          {tab?.symbol && (
                            <span className="px-2 py-0.5 bg-amber-400/25 border border-amber-500/40 text-amber-950 text-[11px] font-mono font-black rounded-full shadow-2xs">
                              {tab.symbol}
                            </span>
                          )}
                        </div>

                        {/* 右側：防線/分隔線快捷開關 + 攤平/突破價位 (同 Primial 頂部按鈕) */}
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
                          {/* 行權價 (新增) - 預設關閉 */}
                          <button
                            type="button"
                            onClick={handleTogglePyramidStrikePrices}
                            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer border active:scale-95 shrink-0 select-none ${
                              pyramidShowStrikePrices
                                ? "bg-zinc-950 text-white border-zinc-400 shadow-[0_0_8px_rgba(255,255,255,0.25)] ring-1 ring-zinc-400"
                                : "bg-[#E0F2FE] hover:bg-[#CFEBFC] text-black hover:text-black border-[#7BC4ED] shadow-2xs"
                            }`}
                            title="開啟/關閉期權行權價與合約金額黑色虛線 (預設關閉)"
                          >
                            <span className="w-2.5 h-0 border-t-2 border-dashed border-zinc-700 shrink-0" />
                            <span>行權價</span>
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                pyramidShowStrikePrices ? "bg-white shadow-[0_0_6px_#ffffff]" : "bg-zinc-400"
                              }`}
                            />
                          </button>

                          {/* 攤平 | 突破價位 (快捷按鍵: Alt+T / Alt+B) */}
                          <div className="flex items-center bg-[#E0F2FE] border border-[#7BC4ED] rounded-full p-0.5 shadow-2xs shrink-0 select-none">
                            <button
                              type="button"
                              onClick={() => handleTogglePyramidCalcMode("averaging")}
                              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer border active:scale-95 select-none ${
                                pyramidCalcMode === "averaging"
                                  ? "bg-emerald-600 text-white border-emerald-400/60 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                                  : "bg-transparent hover:bg-[#CFEBFC] text-black hover:text-black border-transparent"
                              }`}
                              title="向下分批攤平價位試算 (-3%, -6%, -9%, -12%) [快捷鍵 Alt + T]"
                            >
                              <span>攤平</span>
                              <span className={`text-[10px] font-mono font-normal ${pyramidCalcMode === "averaging" ? "opacity-80 text-white" : "text-zinc-600"}`}>Alt+T</span>
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  pyramidCalcMode === "averaging" ? "bg-emerald-300 shadow-[0_0_6px_#6ee7b7]" : "bg-zinc-400"
                                }`}
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleTogglePyramidCalcMode("breakout")}
                              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer border active:scale-95 select-none ${
                                pyramidCalcMode === "breakout"
                                  ? "bg-indigo-600 text-white border-indigo-400/60 shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                                  : "bg-transparent hover:bg-[#CFEBFC] text-black hover:text-black border-transparent"
                              }`}
                              title="向上突破加碼價位試算 (+2%, +4%, +6%, +8%) [快捷鍵 Alt + B]"
                            >
                              <span>突破價位</span>
                              <span className={`text-[10px] font-mono font-normal ${pyramidCalcMode === "breakout" ? "opacity-80 text-white" : "text-zinc-600"}`}>Alt+B</span>
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  pyramidCalcMode === "breakout" ? "bg-indigo-300 shadow-[0_0_6px_#a5b4fc]" : "bg-zinc-400"
                                }`}
                              />
                            </button>
                          </div>

                          <div className="h-4 w-[1px] bg-[#7BC4ED]/60 hidden sm:block" />

                          {/* 卡片分隔線 (Alt + D) */}
                          <button
                            type="button"
                            onClick={handleTogglePyramidCardDividers}
                            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer border active:scale-95 shrink-0 select-none ${
                              pyramidShowCardDividers
                                ? "bg-indigo-500/20 text-indigo-300 border-indigo-400/60 shadow-[0_0_8px_rgba(99,102,241,0.3)] ring-1 ring-indigo-400/50"
                                : "bg-[#E0F2FE] hover:bg-[#CFEBFC] text-black hover:text-black border-[#7BC4ED] shadow-2xs"
                            }`}
                            title="快速打開/關閉卡片分隔線 (Alt + D)"
                          >
                            <Split className={`w-3.5 h-3.5 ${pyramidShowCardDividers ? "text-indigo-400" : "text-zinc-700"}`} />
                            <span className="hidden sm:inline">分隔線</span>
                            <span className="sm:hidden">分</span>
                            <span className={`text-[10px] font-mono font-normal ${pyramidShowCardDividers ? "text-zinc-400" : "text-zinc-600"}`}>Alt+D</span>
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                pyramidShowCardDividers ? "bg-indigo-400 shadow-[0_0_6px_#818cf8]" : "bg-zinc-400"
                              }`}
                            />
                          </button>

                          {/* 支撐 (Alt + R) - 背景與其他按鈕保持一致 */}
                          <button
                            type="button"
                            onClick={handleTogglePyramidSupport}
                            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer border active:scale-95 shrink-0 select-none ${
                              pyramidLevelTypes.support
                                ? "bg-[#E0F2FE] text-amber-900 border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.25)] ring-1 ring-amber-400"
                                : "bg-[#E0F2FE] hover:bg-[#CFEBFC] text-black hover:text-black border-[#7BC4ED] shadow-2xs"
                            }`}
                            style={
                              pyramidLevelTypes.support
                                ? {
                                    textShadow: "0 0 1px #64748b, -0.5px 0 0.5px #64748b, 0.5px 0 0.5px #64748b, 0 -0.5px 0.5px #64748b, 0 0.5px 0.5px #64748b",
                                    WebkitTextStroke: "0.4px #64748b",
                                  }
                                : undefined
                            }
                            title="快速打開/關閉支撐防線 (Alt + R)"
                          >
                            <span className="w-2.5 h-0 border-t-2 border-dashed border-amber-500 shrink-0" />
                            <span style={pyramidLevelTypes.support ? { WebkitTextStroke: "0.35px #64748b" } : undefined}>支撐</span>
                            <span className={`text-[10px] font-mono font-bold ${pyramidLevelTypes.support ? "text-amber-800" : "text-zinc-600"}`}>Alt+R</span>
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                pyramidLevelTypes.support ? "bg-amber-500 shadow-[0_0_6px_#f59e0b]" : "bg-zinc-400"
                              }`}
                            />
                          </button>

                          {/* 壓力 (Alt + P) */}
                          <button
                            type="button"
                            onClick={handleTogglePyramidResistance}
                            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer border active:scale-95 shrink-0 select-none ${
                              pyramidLevelTypes.resistance
                                ? "bg-[#E0F2FE] text-rose-800 border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.25)] ring-1 ring-rose-400"
                                : "bg-[#E0F2FE] hover:bg-[#CFEBFC] text-black hover:text-black border-[#7BC4ED] shadow-2xs"
                            }`}
                            title="快速打開/關閉壓力防線 (Alt + P)"
                          >
                            <span className="w-2.5 h-0 border-t-2 border-dashed border-rose-500 shrink-0" />
                            <span>壓力</span>
                            <span className={`text-[10px] font-mono font-bold ${pyramidLevelTypes.resistance ? "text-rose-800" : "text-zinc-600"}`}>Alt+P</span>
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                pyramidLevelTypes.resistance ? "bg-rose-500 shadow-[0_0_6px_#fb7185]" : "bg-zinc-400"
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* 系統二 3% 階梯攤平與分批進場計畫動態互動圖表 (Chart.js) */}
                      <System2PlanningChart
                        compact={true}
                        symbol={tab?.symbol}
                        companyName={tab?.companyName}
                        currentPrice={tab?.currentPrice || 0}
                        holdingAvgPrice={effectiveHoldingAvgPrice}
                        holdingQty={effectiveHoldingQty}
                        batches={batchConfigList}
                        averagingRowsSys2={averagingRowsSys2}
                        pyramidRows={pyramidRowsSys2 && pyramidRowsSys2.length > 0 ? pyramidRowsSys2 : pyramidRows}
                        calcMode={pyramidCalcMode}
                        includeCurrentHolding={includeCurrentHolding}
                        refPnLPointSys2={refPnLPointSys2}
                        usableCapital={usableCapital}
                        plannedQty={plannedQty}
                        trades={trades}
                        optionsCalcData={tab?.optionsCalcData}
                        visualLevels={visualLevels}
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
                        onBatchClick={handleBatchClick}
                      />

                      {/* 預計購買數量、停損/止盈價位與分批規劃 (優化顯示比例與清晰排序架構) */}
                      <div className="pt-2 flex flex-col gap-4 w-full">
                        {/* 1. 頂部控制面板：資金佔比試算 + 關鍵防線設定列 + 當前批次狀態 */}
                        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 bg-zinc-50/90 dark:bg-zinc-900/60 p-3 rounded-2xl border border-zinc-200/90 shadow-2xs">
                          {/* 資金與佔比設定區 */}
                          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                            <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 border border-zinc-200/90 px-2.5 py-1.5 rounded-xl shadow-2xs">
                              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">預計佔比:</label>
                              <div className="relative flex items-center">
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="數值"
                                  className="w-16 sm:w-20 h-7 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 text-zinc-900 dark:text-zinc-100 font-mono font-bold text-center text-xs focus-visible:ring-emerald-500/55 rounded-lg pr-5 p-1 shadow-2xs"
                                  value={plannedBuyPercentInput}
                                  onChange={(e) => handlePlannedBuyPercentChange(e.target.value)}
                                />
                                <span className="absolute right-1.5 text-xs font-bold text-zinc-400 pointer-events-none">%</span>
                              </div>
                            </div>

                            {/* 即時計算顯示: 可使用資金 與 可購買總數量 */}
                            <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2 px-3 py-1.5 bg-emerald-50/90 dark:bg-emerald-950/30 border border-emerald-200/90 dark:border-emerald-800/50 rounded-xl text-xs shadow-2xs">
                              <span className="text-zinc-600 dark:text-zinc-400 font-medium whitespace-nowrap text-[11px] sm:text-xs">
                                可用資金: <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">${usableCapital.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                              </span>
                              <span className="h-3.5 w-[1px] bg-emerald-300 dark:bg-emerald-700 hidden sm:block" />
                              <span className="text-zinc-600 dark:text-zinc-400 font-medium whitespace-nowrap text-[11px] sm:text-xs">
                                可購總數: <span className="font-mono font-black text-emerald-800 dark:text-emerald-300">{plannedQty}</span> 股
                              </span>
                            </div>
                          </div>

                          {/* 關鍵防線設定列 (支撐/止損/壓力/止盈) */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap flex items-center gap-1 hidden sm:inline-flex">
                              <Layers className="w-3.5 h-3.5 text-amber-600" />
                              關鍵防線:
                            </span>

                            {/* 支撐 (琥珀黃 #d97706) */}
                            <div className="flex items-center gap-1 bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-800/50 rounded-xl px-2 py-1 shadow-2xs">
                              <span className="w-2 h-0 border-t-2 border-dashed border-amber-600 shrink-0" />
                              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-400 whitespace-nowrap">支撐:</span>
                              <Input
                                type="number"
                                step="any"
                                placeholder={tab?.currentPrice ? (tab.currentPrice * 0.95).toFixed(2) : "價格"}
                                className="w-14 sm:w-16 h-6 bg-white dark:bg-zinc-800 border border-amber-300 text-amber-950 dark:text-amber-200 font-mono font-bold text-center text-xs rounded-lg p-0.5 focus-visible:ring-amber-500/50"
                                value={supportInput}
                                onChange={(e) => handleSupportChange(e.target.value)}
                                title="關鍵支撐價位 (琥珀黃虛線)"
                              />
                            </div>

                            {/* 止損 (警示紅 #dc2626) */}
                            <div className="flex items-center gap-1 bg-red-50/90 dark:bg-red-950/30 border border-red-200/90 dark:border-red-800/50 rounded-xl px-2 py-1 shadow-2xs">
                              <span className="w-2 h-0 border-t-2 border-dashed border-red-600 shrink-0" />
                              <span className="text-[11px] font-bold text-red-700 dark:text-red-400 whitespace-nowrap">止損:</span>
                              <Input
                                type="number"
                                step="any"
                                placeholder={tab?.currentPrice ? (tab.currentPrice * 0.92).toFixed(2) : "價格"}
                                className="w-14 sm:w-16 h-6 bg-white dark:bg-zinc-800 border border-red-300 text-red-950 dark:text-red-200 font-mono font-bold text-center text-xs rounded-lg p-0.5 focus-visible:ring-red-500/50"
                                value={stopLossInput}
                                onChange={(e) => handleStopLossChange(e.target.value)}
                                title="關鍵止損價位 (警示紅虛線)"
                              />
                            </div>

                            {/* 壓力 (玫瑰粉 #e11d48) */}
                            <div className="flex items-center gap-1 bg-rose-50/90 dark:bg-rose-950/30 border border-rose-200/90 dark:border-rose-800/50 rounded-xl px-2 py-1 shadow-2xs">
                              <span className="w-2 h-0 border-t-2 border-dashed border-rose-600 shrink-0" />
                              <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 whitespace-nowrap">壓力:</span>
                              <Input
                                type="number"
                                step="any"
                                placeholder={tab?.currentPrice ? (tab.currentPrice * 1.05).toFixed(2) : "價格"}
                                className="w-14 sm:w-16 h-6 bg-white dark:bg-zinc-800 border border-rose-300 text-rose-950 dark:text-rose-200 font-mono font-bold text-center text-xs rounded-lg p-0.5 focus-visible:ring-rose-500/50"
                                value={resistanceInput}
                                onChange={(e) => handleResistanceChange(e.target.value)}
                                title="關鍵壓力價位 (玫瑰粉虛線)"
                              />
                            </div>

                            {/* 止盈 (翡翠綠 #059669) */}
                            <div className="flex items-center gap-1 bg-emerald-50/90 dark:bg-emerald-950/30 border border-emerald-200/90 dark:border-emerald-800/50 rounded-xl px-2 py-1 shadow-2xs">
                              <span className="w-2 h-0 border-t-2 border-dashed border-emerald-600 shrink-0" />
                              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">止盈:</span>
                              <Input
                                type="number"
                                step="any"
                                placeholder={tab?.currentPrice ? (tab.currentPrice * 1.12).toFixed(2) : "價格"}
                                className="w-14 sm:w-16 h-6 bg-white dark:bg-zinc-800 border border-emerald-300 text-emerald-950 dark:text-emerald-200 font-mono font-bold text-center text-xs rounded-lg p-0.5 focus-visible:ring-emerald-500/50"
                                value={takeProfitInput}
                                onChange={(e) => handleTakeProfitChange(e.target.value)}
                                title="關鍵止盈價位 (翡翠綠虛線)"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 2 & 3 & 4. 統一戰情容器：分批進場總體進度軌道與四批次詳細進度卡片 (支援完整動態載入、數字計數與互動回饋) */}
                        {plannedQty > 0 && (
                          <div className="w-full rounded-2xl bg-white/95 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/90 dark:border-zinc-800 p-4 sm:p-5 shadow-xs space-y-4">
                            {/* 頂部整合狀態條：當前進度狀態、全域進度統計與「重播動畫」按鈕 */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold bg-[#B1C28D]/25 dark:bg-[#556336]/30 text-[#49562c] dark:text-[#cde0a5] border border-[#B1C28D]/50 px-3 py-1.5 rounded-xl inline-flex flex-wrap items-center gap-2 shadow-2xs">
                                  <span 
                                    className="w-1.5 h-1.5 rounded-full bg-[#6F7D50] inline-block shrink-0" 
                                    style={{
                                      animation: prefersReducedMotion ? 'none' : 'batchPulseBreathe 1.6s ease-in-out infinite'
                                    }}
                                  />
                                  <span>
                                    剩餘預計購買: <strong className="font-mono font-black"><AnimatedNumber value={remainingToBuy} replayKey={batchAnimKey} disabled={prefersReducedMotion} /></strong> 股
                                  </span>
                                  <span className="opacity-30">|</span>
                                  <span>
                                    當前順序: <strong className="font-black text-zinc-900 dark:text-zinc-50">{currentBatchOrderText}</strong> ({currentBatchText}
                                    {currentBatchOrderText !== "無" && currentBatchOrderText !== "已滿批" && (
                                      <span className="ml-1 text-zinc-700 dark:text-zinc-300 font-medium">
                                        ‧ 已購: <strong className="font-mono font-black text-emerald-700 dark:text-emerald-400"><AnimatedNumber value={currentBatchBought} replayKey={batchAnimKey} disabled={prefersReducedMotion} /></strong> 股 / 餘額: <strong className="font-mono font-black text-zinc-800 dark:text-zinc-200"><AnimatedNumber value={currentBatchRemaining} replayKey={batchAnimKey} disabled={prefersReducedMotion} /></strong> 股
                                      </span>
                                    )}
                                    )
                                  </span>
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 dark:text-zinc-400">
                                  <span>全域進度:</span>
                                  <span className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-400">
                                    <AnimatedNumber value={totalBought} replayKey={batchAnimKey} disabled={prefersReducedMotion} />
                                  </span>
                                  <span className="text-zinc-400">/</span>
                                  <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">{plannedQty.toLocaleString()} 股</span>
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 tabular-nums">
                                    <AnimatedNumber value={Math.min(100, Math.round((totalBought / plannedQty) * 100))} replayKey={batchAnimKey} disabled={prefersReducedMotion} formatter={n => `${n}%`} />
                                  </span>
                                </div>

                                {/* 「重播動畫」按鈕 */}
                                <button
                                  type="button"
                                  onClick={handleReplayBatchAnimation}
                                  title="重新播放載入填滿與數字計數動畫"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:text-emerald-700 dark:hover:text-emerald-400 bg-zinc-100 hover:bg-emerald-50 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700 rounded-lg transition-all duration-200 active:scale-95 cursor-pointer shadow-2xs select-none"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>重播動畫</span>
                                </button>
                              </div>
                            </div>

                            {/* 中部：分批進場總體進度軌道 (15% ➔ 25% ➔ 35% ➔ 25%) */}
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="p-1 rounded-lg bg-emerald-100/90 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                                    <Layers className="w-3.5 h-3.5" />
                                  </span>
                                  <span className="text-xs font-black text-zinc-800 dark:text-zinc-100 tracking-tight">
                                    分批進場總體進度軌道
                                  </span>
                                  <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                                    (15% ➔ 25% ➔ 35% ➔ 25%)
                                  </span>
                                </div>
                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium hidden sm:block">
                                  點擊任一批次區段可快速帶入雙系統試算
                                </div>
                              </div>

                              {/* 4-Segment Connected Master Track */}
                              <div className="w-full h-4 bg-zinc-100 dark:bg-zinc-800 rounded-full p-0.5 flex gap-1 border border-zinc-200/80 dark:border-zinc-700 overflow-hidden shadow-inner">
                                {batchConfigList.map((b) => {
                                  const bPercent = b.size > 0 ? Math.min(100, Math.round((b.bought / b.size) * 100)) : 0;
                                  const isFinished = b.remaining === 0;
                                  const isCurrentActive = !isFinished && (b.index === 0 || batchConfigList[b.index - 1].remaining === 0);
                                  const widthStyles = ['w-[15%]', 'w-[25%]', 'w-[35%]', 'w-[25%]'];

                                  return (
                                    <div
                                      key={b.index}
                                      onClick={() => {
                                        triggerCardGlow(b.index);
                                        handleBatchClick(b.index, b.name, b.split1.size, b.split2.size);
                                      }}
                                      title={`${b.name}：${b.bought}/${b.size} 股 (${bPercent}%) - 點擊帶入`}
                                      className={`${widthStyles[b.index]} h-full bg-zinc-200/70 dark:bg-zinc-700/60 rounded-full overflow-hidden relative cursor-pointer group hover:opacity-90 transition-opacity ${
                                        isCurrentActive ? 'ring-1 ring-[#1BD0F7]/70' : ''
                                      }`}
                                    >
                                      {/* Animated Fill Bar with Staggered Delay (1s duration, cubic-bezier(.2,.7,.2,1)) */}
                                      <div
                                        style={{
                                          width: isBatchAnimActive || prefersReducedMotion ? `${bPercent}%` : '0%',
                                          transition: prefersReducedMotion ? 'none' : `width 1s cubic-bezier(0.2, 0.7, 0.2, 1) ${b.index * 0.15}s`,
                                          animation: isCurrentActive && !prefersReducedMotion ? 'cyanElectricPulse 1.8s ease-in-out infinite' : undefined
                                        }}
                                        className={`h-full relative overflow-hidden rounded-full ${
                                          isFinished
                                            ? 'bg-gradient-to-r from-emerald-600 to-teal-500'
                                            : isCurrentActive
                                            ? 'bg-gradient-to-r from-[#1BD0F7] via-[#38BDF8] to-[#0EA5E9] shadow-[0_0_12px_rgba(27,208,247,0.85)]'
                                            : bPercent > 0
                                            ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 animate-pulse'
                                            : 'bg-transparent'
                                        }`}
                                      >
                                        {/* Shimmer sweep for in-progress unfilled track (after fill finishes, 1.9s cycle) */}
                                        {!isFinished && bPercent > 0 && !prefersReducedMotion && (
                                          <div
                                            className={`absolute inset-y-0 w-1/2 bg-gradient-to-r pointer-events-none ${
                                              isCurrentActive ? 'from-transparent via-white/85 to-transparent' : 'from-transparent via-white/50 to-transparent'
                                            }`}
                                            style={{
                                              animation: isCurrentActive ? 'batchShimmerSweep 1.4s infinite ease-in-out' : 'batchShimmerSweep 1.9s infinite ease-in-out',
                                              animationDelay: `${b.index * 0.15 + 1}s`
                                            }}
                                          />
                                        )}
                                      </div>
                                      {/* Segment Divider & Completion indicator */}
                                      {isFinished && (
                                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow-xs pointer-events-none">
                                          ✓
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* 下部：四批次橫向動態進度條卡片 (4欄均勻展開，支援 Hover 上浮 2px、光暈與數字計數) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5 w-full pt-1">
                              {batchConfigList.map((b) => {
                                const isFinished = b.remaining === 0;
                                const percentCompleted = b.size > 0 ? Math.min(100, Math.round((b.bought / b.size) * 100)) : 0;
                                const isSplit1Finished = b.split1.remaining === 0;
                                const split1Percent = b.split1.size > 0 ? Math.min(100, Math.round((b.split1.bought / b.split1.size) * 100)) : 0;
                                const isSplit2Finished = b.split2.remaining === 0;
                                const split2Percent = b.split2.size > 0 ? Math.min(100, Math.round((b.split2.bought / b.split2.size) * 100)) : 0;
                                const isCurrentActive = !isFinished && (b.index === 0 || batchConfigList[b.index - 1].remaining === 0);
                                const isSplit1Active = isCurrentActive && !isSplit1Finished;
                                const isSplit2Active = isCurrentActive && isSplit1Finished && !isSplit2Finished;

                                return (
                                  <div 
                                    key={b.index} 
                                    style={{
                                      animation: glowingBatchCardIndex === b.index && !prefersReducedMotion 
                                        ? (isCurrentActive ? 'cyanHaloGlow 0.7s ease-out forwards' : 'batchHaloGlow 0.7s ease-out forwards')
                                        : undefined
                                    }}
                                    className={`p-3.5 border rounded-xl flex flex-col justify-between relative shadow-2xs hover:shadow-md transition-all duration-200 ${
                                      prefersReducedMotion ? '' : 'hover:-translate-y-[2px]'
                                    } ${
                                      isFinished 
                                        ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 ring-1 ring-emerald-400/30' 
                                        : isCurrentActive
                                        ? 'bg-white dark:bg-zinc-900 border-[#1BD0F7] shadow-[0_0_20px_rgba(27,208,247,0.18)] ring-2 ring-[#1BD0F7]/40'
                                        : 'bg-white dark:bg-zinc-900 border-zinc-200/90 dark:border-zinc-800 hover:border-emerald-300'
                                    }`}
                                  >
                                    {/* Card Header (批次名稱 + 進行中霓虹呼吸燈 + 帶入全部按鈕) */}
                                    <div className="flex flex-col gap-2 pb-2.5 border-b border-zinc-100 dark:border-zinc-800">
                                      <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-1.5">
                                          {isCurrentActive && (
                                            <span 
                                              className="w-2 h-2 rounded-full bg-[#1BD0F7] inline-block shrink-0 shadow-[0_0_8px_#1BD0F7]" 
                                              style={{
                                                animation: prefersReducedMotion ? 'none' : 'batchPulseBreathe 1.4s ease-in-out infinite'
                                              }}
                                            />
                                          )}
                                          <span className={`text-xs font-black tracking-tight ${
                                            isCurrentActive ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-800 dark:text-zinc-100'
                                          }`}>
                                            {b.name}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            triggerCardGlow(b.index);
                                            handleBatchClick(b.index, b.name, b.split1.size, b.split2.size);
                                          }}
                                          title="點擊將此批整組 (拆分一 + 拆分二) 同步帶入雙系統攤平試算"
                                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md active:scale-[0.96] transition-all duration-150 cursor-pointer shadow-2xs select-none ${
                                            isCurrentActive
                                              ? 'text-cyan-950 dark:text-cyan-100 bg-[#1BD0F7]/25 hover:bg-[#1BD0F7]/40 border border-[#1BD0F7]/70 shadow-[0_0_10px_rgba(27,208,247,0.35)]'
                                              : 'text-emerald-800 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-900/60 hover:bg-emerald-200 dark:hover:bg-emerald-900 border border-emerald-300/80 dark:border-emerald-700'
                                          }`}
                                        >
                                          帶入全部 ↵
                                        </button>
                                      </div>

                                      <div className="flex items-baseline justify-between">
                                        <div className="flex items-baseline gap-1">
                                          <span className="text-xl font-black font-mono text-zinc-900 dark:text-zinc-50 leading-tight">{b.size.toLocaleString()}</span>
                                          <span className="text-[11px] font-bold text-zinc-500">股 (總計)</span>
                                        </div>
                                        <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded-md tabular-nums transition-colors ${
                                          isFinished
                                            ? 'bg-emerald-200/80 dark:bg-emerald-900/80 text-emerald-900 dark:text-emerald-200'
                                            : isCurrentActive
                                              ? 'bg-[#1BD0F7]/20 text-cyan-950 dark:text-[#1BD0F7] border border-[#1BD0F7]/40 shadow-[0_0_8px_rgba(27,208,247,0.25)]'
                                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                        }`}>
                                          <AnimatedNumber value={percentCompleted} replayKey={batchAnimKey} disabled={prefersReducedMotion} formatter={n => `${n}%`} />
                                        </span>
                                      </div>

                                      {/* Dynamic Horizontal Progress Bar with Staggered Animation & Shimmer */}
                                      <div 
                                        onClick={() => {
                                          triggerCardGlow(b.index);
                                          handleBatchClick(b.index, b.name, b.split1.size, b.split2.size);
                                        }}
                                        className={`w-full h-3 rounded-full overflow-hidden relative cursor-pointer group shadow-inner transition-all ${
                                          isCurrentActive
                                            ? 'bg-cyan-950/20 dark:bg-cyan-950/40 border border-[#1BD0F7]/40 ring-1 ring-[#1BD0F7]/30'
                                            : 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700'
                                        }`}
                                        title={`目前已購買 ${b.bought} 股 / 規劃 ${b.size} 股 (${percentCompleted}%) - 點擊帶入`}
                                      >
                                        <div
                                          style={{
                                            width: isBatchAnimActive || prefersReducedMotion ? `${percentCompleted}%` : '0%',
                                            transition: prefersReducedMotion ? 'none' : `width 1s cubic-bezier(0.2, 0.7, 0.2, 1) ${b.index * 0.15}s`,
                                            animation: isCurrentActive && !isFinished && !prefersReducedMotion ? 'cyanElectricPulse 1.8s ease-in-out infinite' : undefined
                                          }}
                                          className={`h-full relative overflow-hidden rounded-full ${
                                            isFinished
                                              ? 'bg-gradient-to-r from-emerald-600 to-teal-500'
                                              : isCurrentActive
                                                ? 'bg-gradient-to-r from-[#1BD0F7] via-[#38BDF8] to-[#0EA5E9] shadow-[0_0_12px_rgba(27,208,247,0.85)]'
                                                : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 group-hover:brightness-110'
                                          }`}
                                        >
                                          {/* Shimmer sweep for in-progress batch bar */}
                                          {!isFinished && percentCompleted > 0 && !prefersReducedMotion && (
                                            <div
                                              className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/70 to-transparent pointer-events-none"
                                              style={{
                                                animation: isCurrentActive ? 'batchShimmerSweep 1.4s infinite ease-in-out' : 'batchShimmerSweep 1.9s infinite ease-in-out',
                                                animationDelay: `${b.index * 0.15 + 1}s`
                                              }}
                                            />
                                          )}
                                        </div>
                                      </div>

                                      {/* High-contrast Share Balance Metrics with Count-up */}
                                      <div className="flex items-center justify-between text-[11px] font-semibold w-full pt-0.5">
                                        <span className="text-zinc-600 dark:text-zinc-400">
                                          已購: <strong className={`font-mono font-black text-xs ${
                                            isFinished
                                              ? 'text-emerald-700 dark:text-emerald-400'
                                              : isCurrentActive
                                                ? 'text-cyan-700 dark:text-[#1BD0F7] drop-shadow-[0_0_4px_rgba(27,208,247,0.4)]'
                                                : 'text-zinc-700 dark:text-zinc-300'
                                          }`}><AnimatedNumber value={b.bought} replayKey={batchAnimKey} disabled={prefersReducedMotion} /></strong> 股
                                        </span>
                                        <span className="text-zinc-300 dark:text-zinc-700">|</span>
                                        <span className="text-zinc-500 dark:text-zinc-400">
                                          餘額: <strong className={`font-mono font-bold text-xs ${
                                            isCurrentActive
                                              ? 'text-zinc-900 dark:text-cyan-100 font-black'
                                              : 'text-zinc-800 dark:text-zinc-200'
                                          }`}><AnimatedNumber value={b.remaining} replayKey={batchAnimKey} disabled={prefersReducedMotion} /></strong> 股
                                        </span>
                                      </div>
                                    </div>

                                    {/* 扁平無框微型指標列 (消除卡中卡厚重感，保留獨立點擊帶入雙系統) */}
                                    <div className="grid grid-cols-2 gap-1.5 mt-2.5">
                                      {/* 拆分一 (延遲 = 0.3s + 批次序號*0.15s + 拆分序號0*0.1s) */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          triggerCardGlow(b.index);
                                          handleBatchClick(b.index, b.split1.name, b.split1.size, b.split2.size, 1);
                                        }}
                                        title={`點擊僅將 ${b.split1.name} (${b.split1.size}股) 帶入雙系統第 1 數量`}
                                        className={`px-2 py-1.5 rounded-lg text-left flex flex-col justify-between transition-all active:scale-[0.96] cursor-pointer select-none group/split ${
                                          isSplit1Finished
                                            ? 'bg-emerald-100/50 dark:bg-emerald-950/30'
                                            : isSplit1Active
                                              ? 'bg-cyan-500/10 dark:bg-cyan-950/40 border border-[#1BD0F7]/40 shadow-[0_0_8px_rgba(27,208,247,0.15)] hover:bg-[#1BD0F7]/15'
                                              : 'bg-zinc-50/80 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between w-full">
                                          <span className={`text-[10px] font-black group-hover/split:text-[#1BD0F7] transition-colors ${
                                            isSplit1Active ? 'text-cyan-950 dark:text-[#1BD0F7]' : 'text-zinc-700 dark:text-zinc-300'
                                          }`}>{b.split1.shortLabel}</span>
                                          {isSplit1Finished ? (
                                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-200/80 px-1 rounded">滿</span>
                                          ) : (
                                            <span className={`text-[9px] font-mono font-bold tabular-nums px-1 rounded ${
                                              isSplit1Active ? 'bg-[#1BD0F7]/20 text-cyan-900 dark:text-[#1BD0F7]' : 'text-zinc-500'
                                            }`}>
                                              <AnimatedNumber value={split1Percent} replayKey={batchAnimKey} disabled={prefersReducedMotion} formatter={n => `${n}%`} />
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-baseline justify-between w-full my-0.5">
                                          <span className="text-xs font-black font-mono text-zinc-900 dark:text-zinc-100">{b.split1.size.toLocaleString()} 股</span>
                                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium font-mono">
                                            已 <AnimatedNumber value={b.split1.bought} replayKey={batchAnimKey} disabled={prefersReducedMotion} />
                                          </span>
                                        </div>
                                        
                                        {/* Micro Progress Bar for Split 1 */}
                                        <div className={`w-full h-1.5 rounded-full overflow-hidden mt-0.5 relative ${
                                          isSplit1Active ? 'bg-cyan-950/30 border border-[#1BD0F7]/30' : 'bg-zinc-200/80 dark:bg-zinc-700'
                                        }`}>
                                          <div
                                            style={{
                                              width: isBatchAnimActive || prefersReducedMotion ? `${split1Percent}%` : '0%',
                                              transition: prefersReducedMotion ? 'none' : `width 1s cubic-bezier(0.2, 0.7, 0.2, 1) ${0.3 + b.index * 0.15 + 0 * 0.1}s`,
                                              animation: isSplit1Active && !isSplit1Finished && !prefersReducedMotion ? 'cyanElectricPulse 1.8s ease-in-out infinite' : undefined
                                            }}
                                            className={`h-full rounded-full relative overflow-hidden ${
                                              isSplit1Finished 
                                                ? 'bg-emerald-600' 
                                                : isSplit1Active
                                                  ? 'bg-gradient-to-r from-[#1BD0F7] to-[#0EA5E9] shadow-[0_0_8px_rgba(27,208,247,0.8)]'
                                                  : 'bg-emerald-500'
                                            }`}
                                          >
                                            {!isSplit1Finished && split1Percent > 0 && !prefersReducedMotion && (
                                              <div
                                                className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none"
                                                style={{
                                                  animation: isSplit1Active ? 'batchShimmerSweep 1.4s infinite ease-in-out' : 'batchShimmerSweep 1.9s infinite ease-in-out',
                                                  animationDelay: `${0.3 + b.index * 0.15 + 0 * 0.1 + 1}s`
                                                }}
                                              />
                                            )}
                                          </div>
                                        </div>
                                      </button>

                                      {/* 拆分二 (延遲 = 0.3s + 批次序號*0.15s + 拆分序號1*0.1s) */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          triggerCardGlow(b.index);
                                          handleBatchClick(b.index, b.split2.name, b.split1.size, b.split2.size, 2);
                                        }}
                                        title={`點擊僅將 ${b.split2.name} (${b.split2.size}股) 帶入雙系統第 2 數量`}
                                        className={`px-2 py-1.5 rounded-lg text-left flex flex-col justify-between transition-all active:scale-[0.96] cursor-pointer select-none group/split ${
                                          isSplit2Finished
                                            ? 'bg-emerald-100/50 dark:bg-emerald-950/30'
                                            : isSplit2Active
                                              ? 'bg-cyan-500/10 dark:bg-cyan-950/40 border border-[#1BD0F7]/40 shadow-[0_0_8px_rgba(27,208,247,0.15)] hover:bg-[#1BD0F7]/15'
                                              : 'bg-zinc-50/80 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between w-full">
                                          <span className={`text-[10px] font-black group-hover/split:text-[#1BD0F7] transition-colors ${
                                            isSplit2Active ? 'text-cyan-950 dark:text-[#1BD0F7]' : 'text-zinc-700 dark:text-zinc-300'
                                          }`}>{b.split2.shortLabel}</span>
                                          {isSplit2Finished ? (
                                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-200/80 px-1 rounded">滿</span>
                                          ) : (
                                            <span className={`text-[9px] font-mono font-bold tabular-nums px-1 rounded ${
                                              isSplit2Active ? 'bg-[#1BD0F7]/20 text-cyan-900 dark:text-[#1BD0F7]' : 'text-zinc-500'
                                            }`}>
                                              <AnimatedNumber value={split2Percent} replayKey={batchAnimKey} disabled={prefersReducedMotion} formatter={n => `${n}%`} />
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-baseline justify-between w-full my-0.5">
                                          <span className="text-xs font-black font-mono text-zinc-900 dark:text-zinc-100">{b.split2.size.toLocaleString()} 股</span>
                                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium font-mono">
                                            已 <AnimatedNumber value={b.split2.bought} replayKey={batchAnimKey} disabled={prefersReducedMotion} />
                                          </span>
                                        </div>
                                        
                                        {/* Micro Progress Bar for Split 2 */}
                                        <div className={`w-full h-1.5 rounded-full overflow-hidden mt-0.5 relative ${
                                          isSplit2Active ? 'bg-cyan-950/30 border border-[#1BD0F7]/30' : 'bg-zinc-200/80 dark:bg-zinc-700'
                                        }`}>
                                          <div
                                            style={{
                                              width: isBatchAnimActive || prefersReducedMotion ? `${split2Percent}%` : '0%',
                                              transition: prefersReducedMotion ? 'none' : `width 1s cubic-bezier(0.2, 0.7, 0.2, 1) ${0.3 + b.index * 0.15 + 1 * 0.1}s`,
                                              animation: isSplit2Active && !isSplit2Finished && !prefersReducedMotion ? 'cyanElectricPulse 1.8s ease-in-out infinite' : undefined
                                            }}
                                            className={`h-full rounded-full relative overflow-hidden ${
                                              isSplit2Finished 
                                                ? 'bg-emerald-600' 
                                                : isSplit2Active
                                                  ? 'bg-gradient-to-r from-[#1BD0F7] to-[#0EA5E9] shadow-[0_0_8px_rgba(27,208,247,0.8)]'
                                                  : 'bg-emerald-500'
                                            }`}
                                          >
                                            {!isSplit2Finished && split2Percent > 0 && !prefersReducedMotion && (
                                              <div
                                                className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none"
                                                style={{
                                                  animation: isSplit2Active ? 'batchShimmerSweep 1.4s infinite ease-in-out' : 'batchShimmerSweep 1.9s infinite ease-in-out',
                                                  animationDelay: `${0.3 + b.index * 0.15 + 1 * 0.1 + 1}s`
                                                }}
                                              />
                                            )}
                                          </div>
                                        </div>
                                      </button>
                                    </div>

                                    {isFinished && (
                                      <span className="absolute -top-1.5 -right-1.5 bg-emerald-600 text-white rounded-full text-[10px] px-1.5 py-0.5 font-bold shadow-md border border-white animate-pulse leading-none pointer-events-none">滿</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                  {/* 股價攤平 (雙系統) / 突破加碼 (雙系統) 與 比例計算工具 */}
                  <div className="mt-6 pt-6 border-t border-zinc-200/80 space-y-6">
                    {/* 頂部 Tab 切換列：股價向下攤平試算 (雙系統對比) | 股價向上突破加碼試算 (雙系統對比) | 期權計算器 (美式期權) */}
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 p-1.5 bg-zinc-100/90 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200/80 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => {
                          playClickSound();
                          setCalcComparisonTab('down');
                        }}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          calcComparisonTab === 'down'
                            ? 'bg-emerald-800 text-white shadow-sm ring-1 ring-emerald-700/50'
                            : 'bg-transparent text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
                        }`}
                      >
                        <TrendingDown className="w-4 h-4 shrink-0" />
                        <span className="truncate">股價向下攤平試算 (雙系統對比)</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold shrink-0 ${
                          calcComparisonTab === 'down' ? 'bg-emerald-700/80 text-emerald-100' : 'bg-zinc-200/80 text-zinc-500'
                        }`}>
                          -2% ~ -12%
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          playClickSound();
                          setCalcComparisonTab('up');
                        }}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          calcComparisonTab === 'up'
                            ? 'bg-emerald-800 text-white shadow-sm ring-1 ring-emerald-700/50'
                            : 'bg-transparent text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
                        }`}
                      >
                        <TrendingUp className="w-4 h-4 shrink-0" />
                        <span className="truncate">股價向上突破加碼試算 (雙系統對比)</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold shrink-0 ${
                          calcComparisonTab === 'up' ? 'bg-emerald-700/80 text-emerald-100' : 'bg-zinc-200/80 text-zinc-500'
                        }`}>
                          +2% ~ +12%
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          playClickSound();
                          setCalcComparisonTab('options');
                        }}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          calcComparisonTab === 'options'
                            ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-500/50'
                            : 'bg-transparent text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
                        }`}
                      >
                        <Calculator className="w-4 h-4 shrink-0" />
                        <span className="truncate">期權計算器</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold shrink-0 ${
                          calcComparisonTab === 'options' ? 'bg-amber-700/80 text-amber-100' : 'bg-zinc-200/80 text-zinc-500'
                        }`}>
                          美式期權
                        </span>
                      </button>
                    </div>

                    {/* Tab 1: 股價向下攤平試算 (雙系統對比) */}
                    {calcComparisonTab === 'down' && (
                      <div className="space-y-6">
                        {/* Header for 股價向下攤平試算區塊 */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-150">
                          <div>
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <div className="p-1 bg-emerald-50 text-emerald-700 rounded-md">
                                <span className="text-xs">📉</span>
                              </div>
                              <h4 className="font-bold text-base tracking-wide text-zinc-800">股價向下攤平試算 (雙系統對比)</h4>
                              {tab.status !== 'COMPLETED' && stats.totalQuantity > 0 && stats.averagePrice > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  已依平均成本 (${stats.averagePrice.toFixed(2)}) 自動試算組別 1~4 股價並儲存
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                              系統一採用 2% 遞減策略；系統二採用 3% 遞減策略。當有持有數量時，系統會自動隨平均成本變動計算並匯入組別 1~4 預計購入股價 ($) 且即時儲存。
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-zinc-700 font-semibold bg-zinc-100/80 hover:bg-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-200/60 transition-colors">
                              <input
                                type="checkbox"
                                checked={includeCurrentHolding}
                                onChange={(e) => setIncludeCurrentHolding(e.target.checked)}
                                className="rounded border-zinc-300 text-[#0F6E56] focus:ring-[#0F6E56] h-3.5 w-3.5"
                              />
                              <span>包含當前庫存 ({stats.totalQuantity} 股 @ ${stats.averagePrice.toFixed(2)})</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setAveragingRows([
                                  { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
                                  { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
                                  { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
                                  { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false }
                                ]);
                                setAveragingRowsSys2([
                                  { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
                                  { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
                                  { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
                                  { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false }
                                ]);
                                setRefPnLPoint('');
                                setRefPnLPointSys2('');
                              }}
                              className="text-xs font-bold text-zinc-400 hover:text-zinc-700 transition-colors px-2 py-1"
                              title="清除雙系統向下攤平所有輸入"
                            >
                              ✕ 清除攤平輸入
                            </button>
                          </div>
                        </div>

                        {/* Dual System Comparison Layout: Left = System 1 (-2%/-4%/-6%/-8%), Right = System 2 (-3%/-6%/-9%/-12%) */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                          {/* System 1 (Left: -2% / -4% / -6% / -8%) */}
                          <div className="bg-white/90 border border-emerald-200/70 rounded-2xl p-4 shadow-2xs space-y-3.5 flex flex-col justify-between">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between pb-2 border-b border-emerald-100/80">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-white bg-[#0F6E56] px-2.5 py-0.5 rounded-md shadow-2xs">
                                    系統一
                                  </span>
                                  <span className="text-xs font-bold text-zinc-700">2% 階梯攤平</span>
                                </div>
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                                  -2% / -4% / -6% / -8%
                                </span>
                              </div>

                              {/* 剩餘預計購買與當前順序資訊 (系統一) */}
                              {plannedQty > 0 && (
                                <div className="text-[11px] font-bold bg-[#B1C28D]/20 text-[#6F7D50] border border-[#B1C28D]/40 px-2.5 py-1 rounded-xl flex flex-wrap items-center justify-between gap-1.5 shadow-2xs">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#6F7D50] animate-pulse" />
                                    <span>剩餘預計購買: <span className="font-mono font-black">{remainingToBuy}</span> 股</span>
                                  </div>
                                  <div>
                                    <span>當前順序: <span className="font-bold text-zinc-800">{currentBatchOrderText}</span></span>
                                    {currentBatchOrderText !== "無" && currentBatchOrderText !== "已滿批" && (
                                      <span className="ml-1 text-zinc-700 font-medium">
                                        (已購 <span className="font-mono font-bold text-zinc-800">{currentBatchBought}</span> / 餘額 <span className="font-mono font-bold text-zinc-800">{currentBatchRemaining}</span> 股)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="space-y-2">
                                <div className="grid grid-cols-12 gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1 items-center">
                                  <span className="col-span-3 text-left">組別</span>
                                  <span className="col-span-3">預計購入股價 ($)</span>
                                  <span className="col-span-4">預計購入數量 (股)</span>
                                  <span className="col-span-2 text-right pr-1">狀態</span>
                                </div>

                                {averagingRows.map((row, idx) => {
                                  const discountLabels = ['-2%', '-4%', '-6%', '-8%'];
                                  const discountLabel = discountLabels[idx];
                                  const isBasePosition = idx === 2; // 系統一第三欄位 (-6%) 為基準倉位(下注終局)
                                  const isHighlightedRow = isBasePosition;
                                  const riskMessages: Record<number, string> = {
                                    1: '(進入觀察倉位)',
                                    2: '(進入基準倉位(下注終局))',
                                    3: '(進入強制關閉倉位)',
                                  };

                                  return (
                                    <div
                                      key={idx}
                                      className={`grid grid-cols-12 gap-1.5 items-center p-1 rounded-xl transition-all ${
                                        isHighlightedRow
                                          ? 'bg-rose-50/80 border border-rose-300/90 ring-1 ring-rose-200 shadow-2xs'
                                          : 'border border-transparent'
                                      }`}
                                    >
                                      {/* 組別 */}
                                      <div className="col-span-3 flex flex-col justify-center min-w-0">
                                        <div className="flex items-center gap-1 min-w-0 flex-wrap">
                                          <input
                                            type="checkbox"
                                            checked={!!row.bought}
                                            onChange={(e) => {
                                              const newRows = [...averagingRows];
                                              newRows[idx] = { ...newRows[idx], bought: e.target.checked };
                                              setAveragingRows(newRows);
                                            }}
                                            className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer shrink-0"
                                            title={row.bought ? "已購入" : "勾選標記為已購入"}
                                          />
                                          <span className={`text-xs font-bold shrink-0 ${isHighlightedRow ? 'text-rose-700 font-black' : 'text-zinc-500'}`}>
                                            #{idx + 1}
                                          </span>
                                          {discountLabel && (
                                            <span
                                              className={`text-[11px] font-black shrink-0 ${
                                                isHighlightedRow
                                                  ? 'text-rose-700 bg-rose-200/90 px-1 py-0.5 rounded border border-rose-300 shadow-2xs flex items-center gap-0.5'
                                                  : 'text-red-600'
                                              }`}
                                            >
                                              {discountLabel}
                                              {isBasePosition && <span className="text-[10px] font-bold text-rose-800">(基準倉位)</span>}
                                            </span>
                                          )}

                                          {idx >= 1 && (
                                            <label
                                              className="inline-flex items-center cursor-pointer ml-0.5 shrink-0"
                                              title="點擊勾選切換風險倉位提示"
                                            >
                                              <input
                                                type="checkbox"
                                                checked={row.riskFlag !== undefined ? !!row.riskFlag : isHighlightedRow}
                                                onChange={(e) => {
                                                  const newRows = [...averagingRows];
                                                  newRows[idx] = { ...newRows[idx], riskFlag: e.target.checked };
                                                  setAveragingRows(newRows);
                                                }}
                                                className="sr-only"
                                              />
                                              <div className={`p-0.5 rounded transition-all flex items-center justify-center ${
                                                (row.riskFlag ?? isHighlightedRow)
                                                  ? 'bg-rose-100 text-rose-600 ring-1 ring-rose-400'
                                                  : 'text-zinc-400 hover:text-rose-500 hover:bg-rose-50'
                                              }`}>
                                                <AlertTriangle className="h-3 w-3 fill-current" />
                                              </div>
                                            </label>
                                          )}
                                        </div>

                                        {/* 組別已購數量註明與拆分佔比 */}
                                        {batchConfigList[idx] && plannedQty > 0 && (
                                          <div className="text-[10px] text-zinc-600 font-medium mt-0.5 flex items-center gap-1 flex-wrap">
                                            <span className="text-zinc-500 font-bold">已購:</span>
                                            <span className="font-mono font-bold text-emerald-800">{batchConfigList[idx].bought}</span>
                                            <span className="text-zinc-400">/</span>
                                            <span className="font-mono text-zinc-700">{batchConfigList[idx].size}股</span>
                                            <span className="text-[9px] text-zinc-400 font-semibold">({batchConfigList[idx].split1.percent}+{batchConfigList[idx].split2.percent})</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* 預計購入股價 */}
                                      <div className="col-span-3 relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">$</span>
                                        <Input
                                          type="number"
                                          placeholder="股價"
                                          value={row.price}
                                          onChange={(e) => {
                                            const newRows = [...averagingRows];
                                            newRows[idx] = { ...newRows[idx], price: e.target.value };
                                            setAveragingRows(newRows);
                                          }}
                                          className={`h-8 pl-5 pr-1 text-xs font-medium text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500 ${
                                            isHighlightedRow ? 'border-rose-300 font-bold text-rose-900 bg-rose-50/30' : ''
                                          }`}
                                        />
                                      </div>

                                      {/* 預計購入數量 (拆分為兩個輸入框，分別為拆分一與拆分二預計購入數量) + 清除按鈕 */}
                                      <div className="col-span-4 flex flex-col justify-center">
                                        <div className="flex items-center gap-1">
                                          <div className="flex-1 flex items-center gap-0.5 min-w-0">
                                            <Input
                                              type="number"
                                              placeholder={batchConfigList[idx] ? `${batchConfigList[idx].split1.size}` : "股數"}
                                              value={row.quantity}
                                              onChange={(e) => {
                                                const newRows = [...averagingRows];
                                                newRows[idx] = { ...newRows[idx], quantity: e.target.value };
                                                setAveragingRows(newRows);
                                              }}
                                              className="h-8 px-1 text-center text-xs font-mono font-medium text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500 rounded-lg min-w-0"
                                              title={`第一拆分股數: ${batchConfigList[idx]?.split1.size || 0} 股 (${batchConfigList[idx]?.split1.percent || ''})`}
                                            />
                                            <span className="text-[10px] font-bold text-zinc-400 shrink-0 select-none">+</span>
                                            <Input
                                              type="number"
                                              placeholder={batchConfigList[idx] ? `${batchConfigList[idx].split2.size}` : "股數"}
                                              value={row.quantity2 ?? ''}
                                              onChange={(e) => {
                                                const newRows = [...averagingRows];
                                                newRows[idx] = { ...newRows[idx], quantity2: e.target.value };
                                                setAveragingRows(newRows);
                                              }}
                                              className="h-8 px-1 text-center text-xs font-mono font-medium text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500 rounded-lg min-w-0"
                                              title={`第二拆分股數: ${batchConfigList[idx]?.split2.size || 0} 股 (${batchConfigList[idx]?.split2.percent || ''})`}
                                            />
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newRows = [...averagingRows];
                                              newRows[idx] = { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false };
                                              setAveragingRows(newRows);
                                            }}
                                            className="h-8 w-5 text-zinc-400 hover:text-red-600 hover:bg-zinc-100 rounded-md shrink-0 transition-colors flex items-center justify-center font-bold text-xs cursor-pointer"
                                            title="清除這組"
                                          >
                                            ✕
                                          </button>
                                        </div>

                                        {/* 若有已購的數量順便反映在此下方註明 (綠色字體) */}
                                        {batchConfigList[idx] && plannedQty > 0 && (
                                          <div className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center justify-between px-1">
                                            <span className="flex items-center gap-1">
                                              <span className="text-emerald-700">已購:</span>
                                              <span className="font-mono text-emerald-800 font-black">{batchConfigList[idx].bought}</span>
                                              <span className="text-emerald-700">股</span>
                                            </span>
                                            <span className="text-zinc-400 font-medium text-[9px]">
                                              餘額: <span className="font-mono text-zinc-600 font-semibold">{batchConfigList[idx].remaining}</span> 股
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      {/* 狀態 */}
                                      <div className="col-span-2 text-right pr-0.5 flex flex-col items-end justify-center gap-0.5">
                                        <div>
                                          {row.bought ? (
                                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80 inline-block whitespace-nowrap">
                                              已購入
                                            </span>
                                          ) : (
                                            <span className="text-[11px] font-medium text-zinc-600 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-200/60 inline-block whitespace-nowrap">
                                              尚未購入
                                            </span>
                                          )}
                                        </div>
                                        {idx >= 1 && (row.riskFlag ?? isHighlightedRow) && riskMessages[idx] && (
                                          <span className="text-[9px] font-bold text-red-600 leading-tight whitespace-nowrap">
                                            {riskMessages[idx]}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* 系統一 參考損益點 */}
                              <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 mt-2">
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-zinc-700">系統一參考損益點 ($)</span>
                                  <span className="text-[10px] text-zinc-400">估算目標價格與攤平後成本之差額</span>
                                </div>
                                <div className="relative w-32 shrink-0">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">$</span>
                                  <Input
                                    type="number"
                                    placeholder="參考價"
                                    value={refPnLPoint}
                                    onChange={(e) => setRefPnLPoint(e.target.value)}
                                    className="h-8 pl-6 pr-2 text-xs font-bold text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500 rounded-lg"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* 系統一 計算結果卡片 */}
                            <div className="p-3.5 rounded-xl bg-zinc-50/80 border border-zinc-200/80 space-y-2">
                              <div className="flex justify-between text-xs text-zinc-500">
                                <span>加碼購入總股數:</span>
                                <span className="font-bold font-mono text-zinc-800">{avgResult.newSharesSum} 股</span>
                              </div>
                              <div className="flex justify-between text-xs text-zinc-500">
                                <span>加碼所需資金:</span>
                                <span className="font-bold font-mono text-zinc-800">${avgResult.newCostSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                              <div className="h-[0.5px] bg-zinc-200/80 my-1" />
                              <div className="flex justify-between items-baseline">
                                <span className="text-xs font-semibold text-zinc-600">攤平後總股數:</span>
                                <span className="text-sm font-bold font-mono text-zinc-800">{avgResult.totalShares} 股</span>
                              </div>
                              <div className="flex justify-between items-baseline">
                                <span className="text-xs font-semibold text-zinc-600">攤平後平均成本:</span>
                                <span className="text-base font-black font-mono text-[#0F6E56]">
                                  ${avgResult.finalAveragePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              {hasRefPnL && calculatedPnLResult !== null && (() => {
                                const isLoss = avgResult.finalAveragePrice > parsedRefPnL;
                                const isProfit = avgResult.finalAveragePrice < parsedRefPnL;
                                const absAmount = Math.abs(calculatedPnLResult);
                                const formattedAmount = absAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                                let textColor = "text-zinc-800";
                                let displayText = `$0.00`;

                                if (isLoss) {
                                  textColor = "text-rose-600 font-bold";
                                  displayText = `-$${formattedAmount}`;
                                } else if (isProfit) {
                                  textColor = "text-emerald-700 font-bold";
                                  displayText = `+$${formattedAmount}`;
                                }

                                return (
                                  <div className="flex justify-between items-baseline pt-2 border-t border-zinc-200/80 mt-1">
                                    <div className="flex flex-col">
                                      <span className="text-xs font-semibold text-zinc-600">試算結果:</span>
                                      <span className="text-[10px] text-zinc-400 font-normal">(攤平成本 - 參考損益點) × 總股數</span>
                                    </div>
                                    <span className={`text-base font-black font-mono ${textColor}`}>
                                      {displayText}
                                    </span>
                                  </div>
                                );
                              })()}
                              {includeCurrentHolding && avgResult.costReducedPercent > 0 && (
                                <div className="text-[11px] text-emerald-700 font-semibold text-center bg-emerald-50 py-1 px-2 rounded-lg border border-emerald-100 mt-1">
                                  📉 平均成本降低 {avgResult.costReducedPercent.toFixed(2)}%
                                </div>
                              )}
                            </div>
                          </div>

                          {/* System 2 (Right: -3% / -6% / -9% / -12%) */}
                          <div className="bg-white/90 border border-blue-200/70 rounded-2xl p-4 shadow-2xs space-y-3.5 flex flex-col justify-between">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between pb-2 border-b border-blue-100/80">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-white bg-blue-600 px-2.5 py-0.5 rounded-md shadow-2xs">
                                    系統二
                                  </span>
                                  <span className="text-xs font-bold text-zinc-700">3% 階梯攤平</span>
                                </div>
                                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                                  -3% / -6% / -9% / -12%
                                </span>
                              </div>

                              {/* 剩餘預計購買與當前順序資訊 (系統二) */}
                              {plannedQty > 0 && (
                                <div className="text-[11px] font-bold bg-[#B1C28D]/20 text-[#6F7D50] border border-[#B1C28D]/40 px-2.5 py-1 rounded-xl flex flex-wrap items-center justify-between gap-1.5 shadow-2xs">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#6F7D50] animate-pulse" />
                                    <span>剩餘預計購買: <span className="font-mono font-black">{remainingToBuy}</span> 股</span>
                                  </div>
                                  <div>
                                    <span>當前順序: <span className="font-bold text-zinc-800">{currentBatchOrderText}</span></span>
                                    {currentBatchOrderText !== "無" && currentBatchOrderText !== "已滿批" && (
                                      <span className="ml-1 text-zinc-700 font-medium">
                                        (已購 <span className="font-mono font-bold text-zinc-800">{currentBatchBought}</span> / 餘額 <span className="font-mono font-bold text-zinc-800">{currentBatchRemaining}</span> 股)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="space-y-2">
                                <div className="grid grid-cols-12 gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1 items-center">
                                  <span className="col-span-3 text-left">組別</span>
                                  <span className="col-span-3">預計購入股價 ($)</span>
                                  <span className="col-span-4">預計購入數量 (股)</span>
                                  <span className="col-span-2 text-right pr-1">狀態</span>
                                </div>

                                {averagingRowsSys2.map((row, idx) => {
                                  const discountLabels = ['-3%', '-6%', '-9%', '-12%'];
                                  const discountLabel = discountLabels[idx];
                                  const isBasePosition = idx === 1; // 系統二第二欄位 (-6%) 為基準倉位
                                  const isForceClosePosition = idx === 3; // 系統二第四欄位 (-12%) 為強制平倉
                                  const isHighlightedRow = isBasePosition || isForceClosePosition;
                                  const riskMessages: Record<number, string> = {
                                    1: '(進入基準倉位(下注終局))',
                                    2: '(進入負籌碼博弈倉位)',
                                    3: '(進入強制平倉)',
                                  };

                                  return (
                                    <div
                                      key={idx}
                                      className={`grid grid-cols-12 gap-1.5 items-center p-1 rounded-xl transition-all ${
                                        isHighlightedRow
                                          ? 'bg-rose-50/80 border border-rose-300/90 ring-1 ring-rose-200 shadow-2xs'
                                          : 'border border-transparent'
                                      }`}
                                    >
                                      {/* 組別 */}
                                      <div className="col-span-3 flex flex-col justify-center min-w-0">
                                        <div className="flex items-center gap-1 min-w-0 flex-wrap">
                                          <input
                                            type="checkbox"
                                            checked={!!row.bought}
                                            onChange={(e) => {
                                              const newRows = [...averagingRowsSys2];
                                              newRows[idx] = { ...newRows[idx], bought: e.target.checked };
                                              setAveragingRowsSys2(newRows);
                                            }}
                                            className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer shrink-0"
                                            title={row.bought ? "已購入" : "勾選標記為已購入"}
                                          />
                                          <span className={`text-xs font-bold shrink-0 ${isHighlightedRow ? 'text-rose-700 font-black' : 'text-zinc-500'}`}>
                                            #{idx + 1}
                                          </span>
                                          {discountLabel && (
                                            <span
                                              className={`text-[11px] font-black shrink-0 ${
                                                isHighlightedRow
                                                  ? 'text-rose-700 bg-rose-200/90 px-1 py-0.5 rounded border border-rose-300 shadow-2xs flex items-center gap-0.5'
                                                  : 'text-red-600'
                                              }`}
                                            >
                                              {discountLabel}
                                              {isBasePosition && <span className="text-[10px] font-bold text-rose-800">(基準倉位)</span>}
                                              {isForceClosePosition && <span className="text-[10px] font-bold text-rose-800">(強制平倉)</span>}
                                            </span>
                                          )}

                                          {idx >= 1 && (
                                            <label
                                              className="inline-flex items-center cursor-pointer ml-0.5 shrink-0"
                                              title="點擊勾選切換風險倉位提示"
                                            >
                                              <input
                                                type="checkbox"
                                                checked={row.riskFlag !== undefined ? !!row.riskFlag : isHighlightedRow}
                                                onChange={(e) => {
                                                  const newRows = [...averagingRowsSys2];
                                                  newRows[idx] = { ...newRows[idx], riskFlag: e.target.checked };
                                                  setAveragingRowsSys2(newRows);
                                                }}
                                                className="sr-only"
                                              />
                                              <div className={`p-0.5 rounded transition-all flex items-center justify-center ${
                                                (row.riskFlag ?? isHighlightedRow)
                                                  ? 'bg-rose-100 text-rose-600 ring-1 ring-rose-400'
                                                  : 'text-zinc-400 hover:text-rose-500 hover:bg-rose-50'
                                              }`}>
                                                <AlertTriangle className="h-3 w-3 fill-current" />
                                              </div>
                                            </label>
                                          )}
                                        </div>

                                        {/* 組別已購數量註明與拆分佔比 */}
                                        {batchConfigList[idx] && plannedQty > 0 && (
                                          <div className="text-[10px] text-zinc-600 font-medium mt-0.5 flex items-center gap-1 flex-wrap">
                                            <span className="text-zinc-500 font-bold">已購:</span>
                                            <span className="font-mono font-bold text-blue-800">{batchConfigList[idx].bought}</span>
                                            <span className="text-zinc-400">/</span>
                                            <span className="font-mono text-zinc-700">{batchConfigList[idx].size}股</span>
                                            <span className="text-[9px] text-zinc-400 font-semibold">({batchConfigList[idx].split1.percent}+{batchConfigList[idx].split2.percent})</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* 預計購入股價 */}
                                      <div className="col-span-3 relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">$</span>
                                        <Input
                                          type="number"
                                          placeholder="股價"
                                          value={row.price}
                                          onChange={(e) => {
                                            const newRows = [...averagingRowsSys2];
                                            newRows[idx] = { ...newRows[idx], price: e.target.value };
                                            setAveragingRowsSys2(newRows);
                                          }}
                                          className={`h-8 pl-5 pr-1 text-xs font-medium text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500 ${
                                            isHighlightedRow ? 'border-rose-300 font-bold text-rose-900 bg-rose-50/30' : ''
                                          }`}
                                        />
                                      </div>

                                      {/* 預計購入數量 (拆分為兩個輸入框，分別為拆分一與拆分二預計購入數量) + 清除按鈕 */}
                                      <div className="col-span-4 flex flex-col justify-center">
                                        <div className="flex items-center gap-1">
                                          <div className="flex-1 flex items-center gap-0.5 min-w-0">
                                            <Input
                                              type="number"
                                              placeholder={batchConfigList[idx] ? `${batchConfigList[idx].split1.size}` : "股數"}
                                              value={row.quantity}
                                              onChange={(e) => {
                                                const newRows = [...averagingRowsSys2];
                                                newRows[idx] = { ...newRows[idx], quantity: e.target.value };
                                                setAveragingRowsSys2(newRows);
                                              }}
                                              className="h-8 px-1 text-center text-xs font-mono font-medium text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500 rounded-lg min-w-0"
                                              title={`第一拆分股數: ${batchConfigList[idx]?.split1.size || 0} 股 (${batchConfigList[idx]?.split1.percent || ''})`}
                                            />
                                            <span className="text-[10px] font-bold text-zinc-400 shrink-0 select-none">+</span>
                                            <Input
                                              type="number"
                                              placeholder={batchConfigList[idx] ? `${batchConfigList[idx].split2.size}` : "股數"}
                                              value={row.quantity2 ?? ''}
                                              onChange={(e) => {
                                                const newRows = [...averagingRowsSys2];
                                                newRows[idx] = { ...newRows[idx], quantity2: e.target.value };
                                                setAveragingRowsSys2(newRows);
                                              }}
                                              className="h-8 px-1 text-center text-xs font-mono font-medium text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500 rounded-lg min-w-0"
                                              title={`第二拆分股數: ${batchConfigList[idx]?.split2.size || 0} 股 (${batchConfigList[idx]?.split2.percent || ''})`}
                                            />
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newRows = [...averagingRowsSys2];
                                              newRows[idx] = { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false };
                                              setAveragingRowsSys2(newRows);
                                            }}
                                            className="h-8 w-5 text-zinc-400 hover:text-red-600 hover:bg-zinc-100 rounded-md shrink-0 transition-colors flex items-center justify-center font-bold text-xs cursor-pointer"
                                            title="清除這組"
                                          >
                                            ✕
                                          </button>
                                        </div>

                                        {/* 若有已購的數量順便反映在此下方註明 (綠色字體) */}
                                        {batchConfigList[idx] && plannedQty > 0 && (
                                          <div className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center justify-between px-1">
                                            <span className="flex items-center gap-1">
                                              <span className="text-emerald-700">已購:</span>
                                              <span className="font-mono text-emerald-800 font-black">{batchConfigList[idx].bought}</span>
                                              <span className="text-emerald-700">股</span>
                                            </span>
                                            <span className="text-zinc-400 font-medium text-[9px]">
                                              餘額: <span className="font-mono text-zinc-600 font-semibold">{batchConfigList[idx].remaining}</span> 股
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      {/* 狀態 */}
                                      <div className="col-span-2 text-right pr-0.5 flex flex-col items-end justify-center gap-0.5">
                                        <div>
                                          {row.bought ? (
                                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80 inline-block whitespace-nowrap">
                                              已購入
                                            </span>
                                          ) : (
                                            <span className="text-[11px] font-medium text-zinc-600 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-200/60 inline-block whitespace-nowrap">
                                              尚未購入
                                            </span>
                                          )}
                                        </div>
                                        {idx >= 1 && (row.riskFlag ?? isHighlightedRow) && riskMessages[idx] && (
                                          <span className="text-[9px] font-bold text-red-600 leading-tight whitespace-nowrap">
                                            {riskMessages[idx]}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* 系統二 參考損益點 */}
                              <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 mt-2">
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-zinc-700">系統二參考損益點 ($)</span>
                                  <span className="text-[10px] text-zinc-400">估算目標價格與攤平後成本之差額</span>
                                </div>
                                <div className="relative w-32 shrink-0">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">$</span>
                                  <Input
                                    type="number"
                                    placeholder="參考價"
                                    value={refPnLPointSys2}
                                    onChange={(e) => setRefPnLPointSys2(e.target.value)}
                                    className="h-8 pl-6 pr-2 text-xs font-bold text-zinc-800 bg-white border-zinc-200 focus-visible:ring-blue-500 rounded-lg"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* 系統二 計算結果卡片 */}
                            <div className="p-3.5 rounded-xl bg-zinc-50/80 border border-zinc-200/80 space-y-2">
                              <div className="flex justify-between text-xs text-zinc-500">
                                <span>加碼購入總股數:</span>
                                <span className="font-bold font-mono text-zinc-800">{avgResultSys2.newSharesSum} 股</span>
                              </div>
                              <div className="flex justify-between text-xs text-zinc-500">
                                <span>加碼所需資金:</span>
                                <span className="font-bold font-mono text-zinc-800">${avgResultSys2.newCostSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                              <div className="h-[0.5px] bg-zinc-200/80 my-1" />
                              <div className="flex justify-between items-baseline">
                                <span className="text-xs font-semibold text-zinc-600">攤平後總股數:</span>
                                <span className="text-sm font-bold font-mono text-zinc-800">{avgResultSys2.totalShares} 股</span>
                              </div>
                              <div className="flex justify-between items-baseline">
                                <span className="text-xs font-semibold text-zinc-600">攤平後平均成本:</span>
                                <span className="text-base font-black font-mono text-blue-700">
                                  ${avgResultSys2.finalAveragePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              {hasRefPnLSys2 && calculatedPnLResultSys2 !== null && (() => {
                                const isLoss = avgResultSys2.finalAveragePrice > parsedRefPnLSys2;
                                const isProfit = avgResultSys2.finalAveragePrice < parsedRefPnLSys2;
                                const absAmount = Math.abs(calculatedPnLResultSys2);
                                const formattedAmount = absAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                                let textColor = "text-zinc-800";
                                let displayText = `$0.00`;

                                if (isLoss) {
                                  textColor = "text-rose-600 font-bold";
                                  displayText = `-$${formattedAmount}`;
                                } else if (isProfit) {
                                  textColor = "text-[#0F6E56] font-bold";
                                  displayText = `+$${formattedAmount}`;
                                }

                                return (
                                  <div className="flex justify-between items-baseline pt-2 border-t border-zinc-200/80 mt-1">
                                    <div className="flex flex-col">
                                      <span className="text-xs font-semibold text-zinc-600">試算結果:</span>
                                      <span className="text-[10px] text-zinc-400 font-normal">(攤平成本 - 參考損益點) × 總股數</span>
                                    </div>
                                    <span className={`text-base font-black font-mono ${textColor}`}>
                                      {displayText}
                                    </span>
                                  </div>
                                );
                              })()}
                              {includeCurrentHolding && avgResultSys2.costReducedPercent > 0 && (
                                <div className="text-[11px] text-blue-700 font-semibold text-center bg-blue-50 py-1 px-2 rounded-lg border border-blue-100 mt-1">
                                  📉 平均成本降低 {avgResultSys2.costReducedPercent.toFixed(2)}%
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tab 2: 股價向上突破加碼試算 (雙系統對比) */}
                    {calcComparisonTab === 'up' && (
                      <div className="space-y-6">
                        {/* Header for 股價向上突破加碼試算區塊 */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-150">
                          <div>
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <div className="p-1 bg-emerald-50 text-emerald-700 rounded-md">
                                <span className="text-xs">🚀</span>
                              </div>
                              <h4 className="font-bold text-base tracking-wide text-zinc-800">股價向上突破加碼試算 (雙系統對比)</h4>
                              {tab.status !== 'COMPLETED' && stats.totalQuantity > 0 && stats.averagePrice > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  已依平均成本 (${stats.averagePrice.toFixed(2)}) 自動試算加碼組別 1~4 股價並儲存
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                              其核心邏輯為股價突破後分批加碼。系統一採用 +2% 階梯遞增 (+2%/+4%/+6%/+8%)；系統二採用 +3% 階梯遞增 (+3%/+6%/+9%/+12%)。核心加碼邏輯一樣沿用分批進場百分比與詳細拆分交易。
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-zinc-700 font-semibold bg-zinc-100/80 hover:bg-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-200/60 transition-colors">
                              <input
                                type="checkbox"
                                checked={includeCurrentHoldingUp}
                                onChange={(e) => setIncludeCurrentHoldingUp(e.target.checked)}
                                className="rounded border-zinc-300 text-[#0F6E56] focus:ring-[#0F6E56] h-3.5 w-3.5"
                              />
                              <span>包含當前庫存 ({stats.totalQuantity} 股 @ ${stats.averagePrice.toFixed(2)})</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setPyramidRows([
                                  { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
                                  { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
                                  { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
                                  { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false }
                                ]);
                                setPyramidRowsSys2([
                                  { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
                                  { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
                                  { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false },
                                  { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false }
                                ]);
                                setRefPnLPointUp('');
                                setRefPnLPointUpSys2('');
                              }}
                              className="text-xs font-bold text-zinc-400 hover:text-zinc-700 transition-colors px-2 py-1"
                              title="清除雙系統向上加碼所有輸入"
                            >
                              ✕ 清除加碼輸入
                            </button>
                          </div>
                        </div>

                        {/* Dual System Comparison Layout: Left = System 1 (+2%/+4%/+6%/+8%), Right = System 2 (+3%/+6%/+9%/+12%) */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                          {/* System 1 (Left: +2% / +4% / +6% / +8%) */}
                          <div className="bg-white/90 border border-emerald-200/70 rounded-2xl p-4 shadow-2xs space-y-3.5 flex flex-col justify-between">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between pb-2 border-b border-emerald-100/80">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-white bg-[#0F6E56] px-2.5 py-0.5 rounded-md shadow-2xs">
                                    系統一
                                  </span>
                                  <span className="text-xs font-bold text-zinc-700">2% 突破加碼</span>
                                </div>
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                                  +2% / +4% / +6% / +8%
                                </span>
                              </div>

                              {/* 剩餘預計購買與當前順序資訊 (系統一) */}
                              {plannedQty > 0 && (
                                <div className="text-[11px] font-bold bg-[#B1C28D]/20 text-[#6F7D50] border border-[#B1C28D]/40 px-2.5 py-1 rounded-xl flex flex-wrap items-center justify-between gap-1.5 shadow-2xs">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#6F7D50] animate-pulse" />
                                    <span>剩餘預計加碼: <span className="font-mono font-black">{remainingToBuy}</span> 股</span>
                                  </div>
                                  <div>
                                    <span>當前順序: <span className="font-bold text-zinc-800">{currentBatchOrderText}</span></span>
                                    {currentBatchOrderText !== "無" && currentBatchOrderText !== "已滿批" && (
                                      <span className="ml-1 text-zinc-700 font-medium">
                                        (已購 <span className="font-mono font-bold text-zinc-800">{currentBatchBought}</span> / 餘額 <span className="font-mono font-bold text-zinc-800">{currentBatchRemaining}</span> 股)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="space-y-2">
                                <div className="grid grid-cols-12 gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1 items-center">
                                  <span className="col-span-3 text-left">組別</span>
                                  <span className="col-span-3">預計加碼股價 ($)</span>
                                  <span className="col-span-4">預計加碼數量 (股)</span>
                                  <span className="col-span-2 text-right pr-1">狀態</span>
                                </div>

                                {pyramidRows.map((row, idx) => {
                                  const discountLabels = ['+2%', '+4%', '+6%', '+8%'];
                                  const discountLabel = discountLabels[idx];
                                  const isKeyStage = idx === 2; // +6% 主升段加碼

                                  return (
                                    <div
                                      key={idx}
                                      className={`grid grid-cols-12 gap-1.5 items-center p-1 rounded-xl transition-all ${
                                        isKeyStage
                                          ? 'bg-emerald-50/80 border border-emerald-300/90 ring-1 ring-emerald-200 shadow-2xs'
                                          : 'border border-transparent'
                                      }`}
                                    >
                                      {/* 組別 */}
                                      <div className="col-span-3 flex flex-col justify-center min-w-0">
                                        <div className="flex items-center gap-1 min-w-0 flex-wrap">
                                          <input
                                            type="checkbox"
                                            checked={!!row.bought}
                                            onChange={(e) => {
                                              const newRows = [...pyramidRows];
                                              newRows[idx] = { ...newRows[idx], bought: e.target.checked };
                                              setPyramidRows(newRows);
                                            }}
                                            className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer shrink-0"
                                            title={row.bought ? "已購入" : "勾選標記為已購入"}
                                          />
                                          <span className={`text-xs font-bold shrink-0 ${isKeyStage ? 'text-emerald-800 font-black' : 'text-zinc-500'}`}>
                                            #{idx + 1}
                                          </span>
                                          {discountLabel && (
                                            <span
                                              className={`text-[11px] font-black shrink-0 ${
                                                isKeyStage
                                                  ? 'text-emerald-800 bg-emerald-100 px-1 py-0.5 rounded border border-emerald-300 shadow-2xs flex items-center gap-0.5'
                                                  : 'text-emerald-700'
                                              }`}
                                            >
                                              {discountLabel}
                                              {isKeyStage && <span className="text-[10px] font-bold text-emerald-900">(主升段)</span>}
                                            </span>
                                          )}
                                        </div>

                                        {/* 組別已購數量註明與拆分佔比 */}
                                        {batchConfigList[idx] && plannedQty > 0 && (
                                          <div className="text-[10px] text-zinc-600 font-medium mt-0.5 flex items-center gap-1 flex-wrap">
                                            <span className="text-zinc-500 font-bold">已購:</span>
                                            <span className="font-mono font-bold text-emerald-800">{batchConfigList[idx].bought}</span>
                                            <span className="text-zinc-400">/</span>
                                            <span className="font-mono text-zinc-700">{batchConfigList[idx].size}股</span>
                                            <span className="text-[9px] text-zinc-400 font-semibold">({batchConfigList[idx].split1.percent}+{batchConfigList[idx].split2.percent})</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* 預計購入股價 */}
                                      <div className="col-span-3 relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">$</span>
                                        <Input
                                          type="number"
                                          placeholder="股價"
                                          value={row.price}
                                          onChange={(e) => {
                                            const newRows = [...pyramidRows];
                                            newRows[idx] = { ...newRows[idx], price: e.target.value };
                                            setPyramidRows(newRows);
                                          }}
                                          className={`h-8 pl-5 pr-1 text-xs font-medium text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500 ${
                                            isKeyStage ? 'border-emerald-300 font-bold text-emerald-900 bg-emerald-50/30' : ''
                                          }`}
                                        />
                                      </div>

                                      {/* 預計購入數量 (拆分為兩個輸入框，分別為拆分一與拆分二預計購入數量) + 清除按鈕 */}
                                      <div className="col-span-4 flex flex-col justify-center">
                                        <div className="flex items-center gap-1">
                                          <div className="flex-1 flex items-center gap-0.5 min-w-0">
                                            <Input
                                              type="number"
                                              placeholder={batchConfigList[idx] ? `${batchConfigList[idx].split1.size}` : "股數"}
                                              value={row.quantity}
                                              onChange={(e) => {
                                                const newRows = [...pyramidRows];
                                                newRows[idx] = { ...newRows[idx], quantity: e.target.value };
                                                setPyramidRows(newRows);
                                              }}
                                              className="h-8 px-1 text-center text-xs font-mono font-medium text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500 rounded-lg min-w-0"
                                              title={`第一拆分股數: ${batchConfigList[idx]?.split1.size || 0} 股 (${batchConfigList[idx]?.split1.percent || ''})`}
                                            />
                                            <span className="text-[10px] font-bold text-zinc-400 shrink-0 select-none">+</span>
                                            <Input
                                              type="number"
                                              placeholder={batchConfigList[idx] ? `${batchConfigList[idx].split2.size}` : "股數"}
                                              value={row.quantity2 ?? ''}
                                              onChange={(e) => {
                                                const newRows = [...pyramidRows];
                                                newRows[idx] = { ...newRows[idx], quantity2: e.target.value };
                                                setPyramidRows(newRows);
                                              }}
                                              className="h-8 px-1 text-center text-xs font-mono font-medium text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500 rounded-lg min-w-0"
                                              title={`第二拆分股數: ${batchConfigList[idx]?.split2.size || 0} 股 (${batchConfigList[idx]?.split2.percent || ''})`}
                                            />
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newRows = [...pyramidRows];
                                              newRows[idx] = { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false };
                                              setPyramidRows(newRows);
                                            }}
                                            className="h-8 w-5 text-zinc-400 hover:text-red-600 hover:bg-zinc-100 rounded-md shrink-0 transition-colors flex items-center justify-center font-bold text-xs cursor-pointer"
                                            title="清除這組"
                                          >
                                            ✕
                                          </button>
                                        </div>

                                        {/* 若有已購的數量順便反映在此下方註明 (綠色字體) */}
                                        {batchConfigList[idx] && plannedQty > 0 && (
                                          <div className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center justify-between px-1">
                                            <span className="flex items-center gap-1">
                                              <span className="text-emerald-700">已購:</span>
                                              <span className="font-mono text-emerald-800 font-black">{batchConfigList[idx].bought}</span>
                                              <span className="text-emerald-700">股</span>
                                            </span>
                                            <span className="text-zinc-400 font-medium text-[9px]">
                                              餘額: <span className="font-mono text-zinc-600 font-semibold">{batchConfigList[idx].remaining}</span> 股
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      {/* 狀態 */}
                                      <div className="col-span-2 text-right pr-0.5 flex flex-col items-end justify-center gap-0.5">
                                        <div>
                                          {row.bought ? (
                                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80 inline-block whitespace-nowrap">
                                              已購入
                                            </span>
                                          ) : (
                                            <span className="text-[11px] font-medium text-zinc-600 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-200/60 inline-block whitespace-nowrap">
                                              尚未購入
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* 系統一 參考目標價 / 損益點 */}
                              <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 mt-2">
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-zinc-700">系統一目標/參考損益點 ($)</span>
                                  <span className="text-[10px] text-zinc-400">估算目標出場合理獲利與加碼後成本之差額</span>
                                </div>
                                <div className="relative w-32 shrink-0">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">$</span>
                                  <Input
                                    type="number"
                                    placeholder="目標價"
                                    value={refPnLPointUp}
                                    onChange={(e) => setRefPnLPointUp(e.target.value)}
                                    className="h-8 pl-6 pr-2 text-xs font-bold text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500 rounded-lg"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* 系統一 計算結果卡片 */}
                            <div className="p-3.5 rounded-xl bg-zinc-50/80 border border-zinc-200/80 space-y-2">
                              <div className="flex justify-between text-xs text-zinc-500">
                                <span>突破加碼總股數:</span>
                                <span className="font-bold font-mono text-zinc-800">{pyrResult.newSharesSum} 股</span>
                              </div>
                              <div className="flex justify-between text-xs text-zinc-500">
                                <span>加碼所需資金:</span>
                                <span className="font-bold font-mono text-zinc-800">${pyrResult.newCostSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                              <div className="h-[0.5px] bg-zinc-200/80 my-1" />
                              <div className="flex justify-between items-baseline">
                                <span className="text-xs font-semibold text-zinc-600">加碼後總股數:</span>
                                <span className="text-sm font-bold font-mono text-zinc-800">{pyrResult.totalShares} 股</span>
                              </div>
                              <div className="flex justify-between items-baseline">
                                <span className="text-xs font-semibold text-zinc-600">加碼後平均成本:</span>
                                <span className="text-base font-black font-mono text-[#0F6E56]">
                                  ${pyrResult.finalAveragePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              {hasRefPnLUp && calculatedPnLResultUp !== null && (() => {
                                const isLoss = pyrResult.finalAveragePrice > parsedRefPnLUp;
                                const isProfit = pyrResult.finalAveragePrice < parsedRefPnLUp;
                                const absAmount = Math.abs(calculatedPnLResultUp);
                                const formattedAmount = absAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                                let textColor = "text-zinc-800";
                                let displayText = `$0.00`;

                                if (isLoss) {
                                  textColor = "text-rose-600 font-bold";
                                  displayText = `-$${formattedAmount}`;
                                } else if (isProfit) {
                                  textColor = "text-emerald-700 font-bold";
                                  displayText = `+$${formattedAmount}`;
                                }

                                return (
                                  <div className="flex justify-between items-baseline pt-2 border-t border-zinc-200/80 mt-1">
                                    <div className="flex flex-col">
                                      <span className="text-xs font-semibold text-zinc-600">試算獲利結果:</span>
                                      <span className="text-[10px] text-zinc-400 font-normal">(參考目標價 - 加碼成本) × 總股數</span>
                                    </div>
                                    <span className={`text-base font-black font-mono ${textColor}`}>
                                      {displayText}
                                    </span>
                                  </div>
                                );
                              })()}
                              {includeCurrentHoldingUp && pyrResult.newSharesSum > 0 && stats.averagePrice > 0 && (
                                <div className="text-[11px] text-emerald-800 font-semibold text-center bg-emerald-50 py-1 px-2 rounded-lg border border-emerald-200 mt-1">
                                  🚀 突破加碼後平均成本變動: {pyrResult.costDiffPercent >= 0 ? `+${pyrResult.costDiffPercent.toFixed(2)}%` : `${pyrResult.costDiffPercent.toFixed(2)}%`}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* System 2 (Right: +3% / +6% / +9% / +12%) */}
                          <div className="bg-white/90 border border-blue-200/70 rounded-2xl p-4 shadow-2xs space-y-3.5 flex flex-col justify-between">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between pb-2 border-b border-blue-100/80">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-white bg-blue-600 px-2.5 py-0.5 rounded-md shadow-2xs">
                                    系統二
                                  </span>
                                  <span className="text-xs font-bold text-zinc-700">3% 突破加碼</span>
                                </div>
                                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                                  +3% / +6% / +9% / +12%
                                </span>
                              </div>

                              {/* 剩餘預計購買與當前順序資訊 (系統二) */}
                              {plannedQty > 0 && (
                                <div className="text-[11px] font-bold bg-[#B1C28D]/20 text-[#6F7D50] border border-[#B1C28D]/40 px-2.5 py-1 rounded-xl flex flex-wrap items-center justify-between gap-1.5 shadow-2xs">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#6F7D50] animate-pulse" />
                                    <span>剩餘預計加碼: <span className="font-mono font-black">{remainingToBuy}</span> 股</span>
                                  </div>
                                  <div>
                                    <span>當前順序: <span className="font-bold text-zinc-800">{currentBatchOrderText}</span></span>
                                    {currentBatchOrderText !== "無" && currentBatchOrderText !== "已滿批" && (
                                      <span className="ml-1 text-zinc-700 font-medium">
                                        (已購 <span className="font-mono font-bold text-zinc-800">{currentBatchBought}</span> / 餘額 <span className="font-mono font-bold text-zinc-800">{currentBatchRemaining}</span> 股)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="space-y-2">
                                <div className="grid grid-cols-12 gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1 items-center">
                                  <span className="col-span-3 text-left">組別</span>
                                  <span className="col-span-3">預計加碼股價 ($)</span>
                                  <span className="col-span-4">預計加碼數量 (股)</span>
                                  <span className="col-span-2 text-right pr-1">狀態</span>
                                </div>

                                {pyramidRowsSys2.map((row, idx) => {
                                  const discountLabels = ['+3%', '+6%', '+9%', '+12%'];
                                  const discountLabel = discountLabels[idx];
                                  const isKeyStage = idx === 1; // +6% 突破加碼

                                  return (
                                    <div
                                      key={idx}
                                      className={`grid grid-cols-12 gap-1.5 items-center p-1 rounded-xl transition-all ${
                                        isKeyStage
                                          ? 'bg-blue-50/80 border border-blue-300/90 ring-1 ring-blue-200 shadow-2xs'
                                          : 'border border-transparent'
                                      }`}
                                    >
                                      {/* 組別 */}
                                      <div className="col-span-3 flex flex-col justify-center min-w-0">
                                        <div className="flex items-center gap-1 min-w-0 flex-wrap">
                                          <input
                                            type="checkbox"
                                            checked={!!row.bought}
                                            onChange={(e) => {
                                              const newRows = [...pyramidRowsSys2];
                                              newRows[idx] = { ...newRows[idx], bought: e.target.checked };
                                              setPyramidRowsSys2(newRows);
                                            }}
                                            className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer shrink-0"
                                            title={row.bought ? "已購入" : "勾選標記為已購入"}
                                          />
                                          <span className={`text-xs font-bold shrink-0 ${isKeyStage ? 'text-blue-800 font-black' : 'text-zinc-500'}`}>
                                            #{idx + 1}
                                          </span>
                                          {discountLabel && (
                                            <span
                                              className={`text-[11px] font-black shrink-0 ${
                                                isKeyStage
                                                  ? 'text-blue-800 bg-blue-100 px-1 py-0.5 rounded border border-blue-300 shadow-2xs flex items-center gap-0.5'
                                                  : 'text-blue-700'
                                              }`}
                                            >
                                              {discountLabel}
                                              {isKeyStage && <span className="text-[10px] font-bold text-blue-900">(主升段)</span>}
                                            </span>
                                          )}
                                        </div>

                                        {/* 組別已購數量註明與拆分佔比 */}
                                        {batchConfigList[idx] && plannedQty > 0 && (
                                          <div className="text-[10px] text-zinc-600 font-medium mt-0.5 flex items-center gap-1 flex-wrap">
                                            <span className="text-zinc-500 font-bold">已購:</span>
                                            <span className="font-mono font-bold text-blue-800">{batchConfigList[idx].bought}</span>
                                            <span className="text-zinc-400">/</span>
                                            <span className="font-mono text-zinc-700">{batchConfigList[idx].size}股</span>
                                            <span className="text-[9px] text-zinc-400 font-semibold">({batchConfigList[idx].split1.percent}+{batchConfigList[idx].split2.percent})</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* 預計購入股價 */}
                                      <div className="col-span-3 relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">$</span>
                                        <Input
                                          type="number"
                                          placeholder="股價"
                                          value={row.price}
                                          onChange={(e) => {
                                            const newRows = [...pyramidRowsSys2];
                                            newRows[idx] = { ...newRows[idx], price: e.target.value };
                                            setPyramidRowsSys2(newRows);
                                          }}
                                          className={`h-8 pl-5 pr-1 text-xs font-medium text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500 ${
                                            isKeyStage ? 'border-blue-300 font-bold text-blue-900 bg-blue-50/30' : ''
                                          }`}
                                        />
                                      </div>

                                      {/* 預計購入數量 (拆分為兩個輸入框，分別為拆分一與拆分二預計購入數量) + 清除按鈕 */}
                                      <div className="col-span-4 flex flex-col justify-center">
                                        <div className="flex items-center gap-1">
                                          <div className="flex-1 flex items-center gap-0.5 min-w-0">
                                            <Input
                                              type="number"
                                              placeholder={batchConfigList[idx] ? `${batchConfigList[idx].split1.size}` : "股數"}
                                              value={row.quantity}
                                              onChange={(e) => {
                                                const newRows = [...pyramidRowsSys2];
                                                newRows[idx] = { ...newRows[idx], quantity: e.target.value };
                                                setPyramidRowsSys2(newRows);
                                              }}
                                              className="h-8 px-1 text-center text-xs font-mono font-medium text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500 rounded-lg min-w-0"
                                              title={`第一拆分股數: ${batchConfigList[idx]?.split1.size || 0} 股 (${batchConfigList[idx]?.split1.percent || ''})`}
                                            />
                                            <span className="text-[10px] font-bold text-zinc-400 shrink-0 select-none">+</span>
                                            <Input
                                              type="number"
                                              placeholder={batchConfigList[idx] ? `${batchConfigList[idx].split2.size}` : "股數"}
                                              value={row.quantity2 ?? ''}
                                              onChange={(e) => {
                                                const newRows = [...pyramidRowsSys2];
                                                newRows[idx] = { ...newRows[idx], quantity2: e.target.value };
                                                setPyramidRowsSys2(newRows);
                                              }}
                                              className="h-8 px-1 text-center text-xs font-mono font-medium text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500 rounded-lg min-w-0"
                                              title={`第二拆分股數: ${batchConfigList[idx]?.split2.size || 0} 股 (${batchConfigList[idx]?.split2.percent || ''})`}
                                            />
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newRows = [...pyramidRowsSys2];
                                              newRows[idx] = { price: '', quantity: '', quantity2: '', bought: false, riskFlag: false };
                                              setPyramidRowsSys2(newRows);
                                            }}
                                            className="h-8 w-5 text-zinc-400 hover:text-red-600 hover:bg-zinc-100 rounded-md shrink-0 transition-colors flex items-center justify-center font-bold text-xs cursor-pointer"
                                            title="清除這組"
                                          >
                                            ✕
                                          </button>
                                        </div>

                                        {/* 若有已購的數量順便反映在此下方註明 (綠色字體) */}
                                        {batchConfigList[idx] && plannedQty > 0 && (
                                          <div className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center justify-between px-1">
                                            <span className="flex items-center gap-1">
                                              <span className="text-emerald-700">已購:</span>
                                              <span className="font-mono text-emerald-800 font-black">{batchConfigList[idx].bought}</span>
                                              <span className="text-emerald-700">股</span>
                                            </span>
                                            <span className="text-zinc-400 font-medium text-[9px]">
                                              餘額: <span className="font-mono text-zinc-600 font-semibold">{batchConfigList[idx].remaining}</span> 股
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      {/* 狀態 */}
                                      <div className="col-span-2 text-right pr-0.5 flex flex-col items-end justify-center gap-0.5">
                                        <div>
                                          {row.bought ? (
                                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80 inline-block whitespace-nowrap">
                                              已購入
                                            </span>
                                          ) : (
                                            <span className="text-[11px] font-medium text-zinc-600 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-200/60 inline-block whitespace-nowrap">
                                              尚未購入
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* 系統二 參考目標價 / 損益點 */}
                              <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 mt-2">
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-zinc-700">系統二目標/參考損益點 ($)</span>
                                  <span className="text-[10px] text-zinc-400">估算目標出場合理獲利與加碼後成本之差額</span>
                                </div>
                                <div className="relative w-32 shrink-0">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">$</span>
                                  <Input
                                    type="number"
                                    placeholder="目標價"
                                    value={refPnLPointUpSys2}
                                    onChange={(e) => setRefPnLPointUpSys2(e.target.value)}
                                    className="h-8 pl-6 pr-2 text-xs font-bold text-zinc-800 bg-white border-zinc-200 focus-visible:ring-blue-500 rounded-lg"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* 系統二 計算結果卡片 */}
                            <div className="p-3.5 rounded-xl bg-zinc-50/80 border border-zinc-200/80 space-y-2">
                              <div className="flex justify-between text-xs text-zinc-500">
                                <span>突破加碼總股數:</span>
                                <span className="font-bold font-mono text-zinc-800">{pyrResultSys2.newSharesSum} 股</span>
                              </div>
                              <div className="flex justify-between text-xs text-zinc-500">
                                <span>加碼所需資金:</span>
                                <span className="font-bold font-mono text-zinc-800">${pyrResultSys2.newCostSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                              <div className="h-[0.5px] bg-zinc-200/80 my-1" />
                              <div className="flex justify-between items-baseline">
                                <span className="text-xs font-semibold text-zinc-600">加碼後總股數:</span>
                                <span className="text-sm font-bold font-mono text-zinc-800">{pyrResultSys2.totalShares} 股</span>
                              </div>
                              <div className="flex justify-between items-baseline">
                                <span className="text-xs font-semibold text-zinc-600">加碼後平均成本:</span>
                                <span className="text-base font-black font-mono text-blue-700">
                                  ${pyrResultSys2.finalAveragePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              {hasRefPnLUpSys2 && calculatedPnLResultUpSys2 !== null && (() => {
                                const isLoss = pyrResultSys2.finalAveragePrice > parsedRefPnLUpSys2;
                                const isProfit = pyrResultSys2.finalAveragePrice < parsedRefPnLUpSys2;
                                const absAmount = Math.abs(calculatedPnLResultUpSys2);
                                const formattedAmount = absAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                                let textColor = "text-zinc-800";
                                let displayText = `$0.00`;

                                if (isLoss) {
                                  textColor = "text-rose-600 font-bold";
                                  displayText = `-$${formattedAmount}`;
                                } else if (isProfit) {
                                  textColor = "text-blue-700 font-bold";
                                  displayText = `+$${formattedAmount}`;
                                }

                                return (
                                  <div className="flex justify-between items-baseline pt-2 border-t border-zinc-200/80 mt-1">
                                    <div className="flex flex-col">
                                      <span className="text-xs font-semibold text-zinc-600">試算獲利結果:</span>
                                      <span className="text-[10px] text-zinc-400 font-normal">(參考目標價 - 加碼成本) × 總股數</span>
                                    </div>
                                    <span className={`text-base font-black font-mono ${textColor}`}>
                                      {displayText}
                                    </span>
                                  </div>
                                );
                              })()}
                              {includeCurrentHoldingUp && pyrResultSys2.newSharesSum > 0 && stats.averagePrice > 0 && (
                                <div className="text-[11px] text-blue-700 font-semibold text-center bg-blue-50 py-1 px-2 rounded-lg border border-blue-100 mt-1">
                                  🚀 突破加碼後平均成本變動: {pyrResultSys2.costDiffPercent >= 0 ? `+${pyrResultSys2.costDiffPercent.toFixed(2)}%` : `${pyrResultSys2.costDiffPercent.toFixed(2)}%`}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Full-width Section: 比例股價變動計算器 */}
                    {(calcComparisonTab === 'down' || calcComparisonTab === 'up') && (
                      <div className="pt-4 border-t border-zinc-200/80 space-y-4 bg-zinc-50/70 p-4 sm:p-5 rounded-2xl border border-zinc-200/70 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-200/60">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                            <span className="text-sm">🧮</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-sm tracking-wide text-zinc-800 flex items-center gap-2">
                              比例股價變動計算器
                              <span className="text-[10px] font-normal text-zinc-500 bg-white px-2 py-0.5 rounded-full border border-zinc-200">
                                支援快速試算與雙系統階梯匯入
                              </span>
                            </h4>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                              依據百分比增減計算目標價（例如：設定停損限價、獲利目標、滿足點），並可一鍵匯入攤平試算表。
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 2-Column Responsive Layout */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                        {/* Left Column: 1. 算式計算 & 系統一 / 系統二 試算比例按鈕 (7 cols) */}
                        <div className="lg:col-span-7 space-y-3 bg-white p-3.5 sm:p-4 rounded-xl border border-zinc-200/70 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-zinc-700 tracking-wide flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              1. 算式計算（例: 56 - 7% 或 56 + 8%）
                            </Label>
                            {calcExpression && (
                              <button 
                                type="button"
                                onClick={() => {
                                  setCalcExpression('');
                                  setCalcBasePrice('');
                                  setCalcPercent('');
                                }}
                                className="text-[11px] text-zinc-400 hover:text-zinc-700 font-bold transition-colors cursor-pointer px-1"
                              >
                                ✕ 清除算式
                              </button>
                            )}
                          </div>

                          <div className="relative">
                            <Input
                              type="text"
                              placeholder="56 - 7% 或 56 + 8%"
                              value={calcExpression}
                              onChange={(e) => setCalcExpression(e.target.value)}
                              className="h-10 text-sm font-semibold tracking-wide text-zinc-800 bg-zinc-50/50 border-zinc-200 focus-visible:ring-emerald-500 rounded-xl pr-14"
                            />
                          </div>

                          {/* Preset Buttons for System 1 & System 2 */}
                          <div className="space-y-2.5 pt-1">
                            {/* System 1 Presets: -8% -6% -4% -2% 2% 4% 6% 8% */}
                            <div className="space-y-1.5 bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-[#0F6E56] flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-[#0F6E56] inline-block" />
                                  系統一試算:
                                </span>
                                <span className="text-[10px] text-zinc-400 font-medium">點擊快速代入</span>
                              </div>
                              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                                {['-8%', '-6%', '-4%', '-2%', '2%', '4%', '6%', '8%'].map((p) => {
                                  const isNeg = p.startsWith('-');
                                  return (
                                    <button
                                      key={`sys1-${p}`}
                                      type="button"
                                      onClick={() => handlePresetClick(p)}
                                      className={`text-xs font-black py-1.5 px-1 rounded-lg transition-all text-center cursor-pointer shadow-2xs ${
                                        isNeg 
                                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 hover:scale-105 border border-rose-200/60 active:scale-95' 
                                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:scale-105 border border-emerald-200/60 active:scale-95'
                                      }`}
                                    >
                                      {isNeg ? p : `+${p}`}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* System 2 Presets: -12% -9% -6% -3% 3% 6% 9% 12% */}
                            <div className="space-y-1.5 bg-blue-50/40 p-2.5 rounded-xl border border-blue-100">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                                  系統二試算:
                                </span>
                                <span className="text-[10px] text-zinc-400 font-medium">點擊快速代入</span>
                              </div>
                              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                                {['-12%', '-9%', '-6%', '-3%', '3%', '6%', '9%', '12%'].map((p) => {
                                  const isNeg = p.startsWith('-');
                                  return (
                                    <button
                                      key={`sys2-${p}`}
                                      type="button"
                                      onClick={() => handlePresetClick(p)}
                                      className={`text-xs font-black py-1.5 px-1 rounded-lg transition-all text-center cursor-pointer shadow-2xs ${
                                        isNeg 
                                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 hover:scale-105 border border-rose-200/60 active:scale-95' 
                                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100 hover:scale-105 border border-blue-200/60 active:scale-95'
                                      }`}
                                    >
                                      {isNeg ? p : `+${p}`}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Column: 2. 數值微調與計算結果 (5 cols) */}
                        <div className="lg:col-span-5 space-y-3 bg-white p-3.5 sm:p-4 rounded-xl border border-zinc-200/70 shadow-2xs flex flex-col justify-between h-full">
                          <div className="space-y-2.5">
                            <Label className="text-xs font-bold text-zinc-700 tracking-wide flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              2. 數值微調與計算結果
                            </Label>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] text-zinc-500 font-bold block">基準股價 ($)</span>
                                </div>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={calcBasePrice}
                                  onChange={(e) => {
                                    userHasModifiedCalcBasePriceRef.current = true;
                                    setCalcBasePrice(e.target.value);
                                  }}
                                  placeholder={
                                    ((stats?.totalQuantity ?? 0) !== 0 && (stats?.averagePrice ?? 0) > 0)
                                      ? stats.averagePrice.toFixed(2)
                                      : ((tab?.currentPrice && tab.currentPrice > 0) ? tab.currentPrice.toFixed(2) : '0.00')
                                  }
                                  className="h-8 text-xs font-mono font-bold text-zinc-800 bg-zinc-50/50 border-zinc-200 rounded-lg focus-visible:ring-emerald-500"
                                />
                              </div>
                              <div>
                                <span className="text-[10px] text-zinc-500 font-bold block mb-1">運算符</span>
                                <div className="flex h-8 border border-zinc-200 rounded-lg overflow-hidden bg-white">
                                  <button
                                    type="button"
                                    onClick={() => setCalcType('SUB')}
                                    className={`flex-1 text-[11px] font-bold transition-all cursor-pointer ${calcType === 'SUB' ? 'bg-rose-500 text-white font-black' : 'text-zinc-500 hover:bg-zinc-50'}`}
                                  >
                                    減 (-)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCalcType('ADD')}
                                    className={`flex-1 text-[11px] font-bold transition-all cursor-pointer ${calcType === 'ADD' ? 'bg-emerald-600 text-white font-black' : 'text-zinc-500 hover:bg-zinc-50'}`}
                                  >
                                    加 (+)
                                  </button>
                                </div>
                              </div>
                              <div>
                                <span className="text-[10px] text-zinc-500 font-bold block mb-1">百分比 (%)</span>
                                <Input
                                  type="number"
                                  value={calcPercent}
                                  placeholder="例 7"
                                  onChange={(e) => setCalcPercent(e.target.value)}
                                  className="h-8 text-xs font-mono font-bold text-zinc-800 bg-zinc-50/50 border-zinc-200 rounded-lg focus-visible:ring-emerald-500"
                                />
                              </div>
                            </div>

                            {/* Display Result Area */}
                            <div className={`p-3 rounded-xl border flex flex-col justify-center transition-all ${parsedCalc.success ? 'bg-emerald-50/50 border-emerald-300 shadow-2xs' : 'bg-zinc-50 border-zinc-200/80'} min-h-[72px]`}>
                              {parsedCalc.success && parsedCalc.result !== undefined ? (
                                <div className="text-center">
                                  <div className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase">計算結果</div>
                                  <div className="text-2xl font-black text-[#0F6E56] font-mono tracking-tight leading-tight">
                                    ${parsedCalc.result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                  {parsedCalc.percent !== 0 && (
                                    <div className="text-[11px] text-zinc-500 font-medium mt-0.5">
                                      以 <span className="font-semibold text-zinc-800">${parsedCalc.base?.toFixed(2)}</span> 為基準，{parsedCalc.isAdd ? '增加' : '減少'} <span className="font-black text-zinc-700">{parsedCalc.percent}%</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-center text-xs text-zinc-400 font-medium py-2">
                                  請於左方輸入算式（如 <span className="font-mono">56 - 7%</span>）或點選比例按鈕
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* One-Click Import Action Bar */}
                      <div className="bg-white p-3.5 rounded-xl border border-zinc-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center gap-2 text-xs text-zinc-600">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span>
                            依基準股價 <strong className="text-zinc-900 font-mono">${(parseFloat(calcBasePrice) || ((stats?.totalQuantity ?? 0) !== 0 && (stats?.averagePrice ?? 0) > 0 ? stats.averagePrice : tab?.currentPrice) || 0).toFixed(2)}</strong> 一鍵計算並匯入：
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleImportBaseToSys1}
                            className="flex-1 sm:flex-initial text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-[#0F6E56] border border-emerald-300/80 hover:border-emerald-400 px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
                            title="匯入至系統一 (-2%, -4%, -6%, -8%)"
                          >
                            <span className="w-2 h-2 rounded-full bg-[#0F6E56]" />
                            <span>匯入系統一 (-2%~-8%)</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleImportBaseToSys2}
                            className="flex-1 sm:flex-initial text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300/80 hover:border-blue-400 px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
                            title="匯入至系統二 (-3%, -6%, -9%, -12%)"
                          >
                            <span className="w-2 h-2 rounded-full bg-blue-600" />
                            <span>匯入系統二 (-3%~-12%)</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleImportBaseToBoth}
                            className="w-full sm:w-auto text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                            title="一鍵將計算結果依各自比例匯入系統一與系統二"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>一鍵匯入雙系統欄位</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                    {/* Tab 3: 期權計算器 (美式期權 Moomoo Style) */}
                    {calcComparisonTab === 'options' && (
                      <OptionsCalculatorTab
                        currentStockPrice={tab?.currentPrice && tab.currentPrice > 0 ? tab.currentPrice : (stats?.averagePrice && stats.averagePrice > 0 ? stats.averagePrice : 150)}
                        stockSymbol={tab?.symbol || 'STOCK'}
                        stockName={tab?.companyName || tab?.symbol || '標的股票'}
                        tabId={tab?.id}
                        tabTradeType={tab?.tradeType}
                        initialOptionsData={tab?.optionsCalcData}
                        onSaveOptionsData={async (data) => {
                          if (tab) {
                            await updateTab(tab.id, { optionsCalcData: data });
                          }
                        }}
                        onClearOptionsData={async () => {
                          if (tab) {
                            await updateTab(tab.id, { optionsCalcData: null });
                            if (typeof window !== 'undefined') {
                              try {
                                localStorage.removeItem(`options_calc_${tab.id}`);
                                localStorage.removeItem(`options_calc_${tab.symbol}_${tab.tradeType}`);
                                if (tab.tradeType === 'real') {
                                  localStorage.removeItem(`options_calc_${tab.symbol}`);
                                }
                              } catch (e) {}
                            }
                          }
                        }}
                        optionTrades={trades.filter(t => t.isOptionTrade)}
                        onAddOptionToTrades={async (tradePayload, savedData) => {
                          if (tab) {
                            await updateTab(tab.id, { optionsCalcData: savedData });
                          }
                          let pDate = new Date();
                          if (tradePayload.purchaseDate && /^\d{4}-\d{2}-\d{2}$/.test(tradePayload.purchaseDate)) {
                            const [y, m, d] = tradePayload.purchaseDate.split('-').map(Number);
                            pDate = new Date(y, m - 1, d, 12, 0, 0);
                          }
                          await addTrade({
                            ...tradePayload,
                            tradeDate: Timestamp.fromDate(pDate)
                          });
                        }}
                        onDeleteOptionTrade={async (tradeId) => {
                          await deleteTrade(tradeId);
                        }}
                        onNavigateToTradesTab={() => {
                          setChipsSubTab('trades');
                        }}
                      />
                    )}

                    {/* Bottom Save Action Bar (For stock averaging tabs) */}
                    {calcComparisonTab !== 'options' && (
                      <div className="pt-4 border-t border-zinc-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-50/60 p-3.5 rounded-xl border border-zinc-200/60 mt-2">
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span>儲存試算內容將會將本次設定（包含預計購入股價、數量與倉位狀態）記錄至雲端</span>
                        </div>
                        <Button
                          type="button"
                          onClick={handleSaveAveraging}
                          disabled={isSavingAveraging}
                          className="w-full sm:w-auto bg-[#0F6E56] hover:bg-[#0B5240] active:scale-95 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                        >
                          {isSavingAveraging ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>儲存中...</span>
                            </>
                          ) : (
                            <>
                              <Save className="w-3.5 h-3.5" />
                              <span>儲存攤平試算設定</span>
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* 子分頁 2: 交易紀錄 */}
                <TabsContent value="trades" className="pt-3 space-y-4 outline-none">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50 border border-zinc-200/80 p-3 rounded-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-bold tracking-tight text-zinc-800 mr-1">交易紀錄清單</h4>
                      <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap">
                        <span>已持有:</span>
                        <span className="font-mono font-black text-zinc-800">{stats.totalQuantity}</span>
                        <span>股</span>
                      </span>
                      <Badge className="bg-emerald-50 text-emerald-700 border border-zinc-150 text-[10px] py-1 px-2.5 font-bold whitespace-nowrap shadow-sm">{trades.length} 筆</Badge>
                      {optionPortfolio.optionTradesCount > 0 && (
                        <span className="text-xs font-bold bg-indigo-50 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap">
                          <span>期權紀錄: {optionPortfolio.optionTradesCount} 筆</span>
                          <span>·</span>
                          <span className="font-mono">總持倉成本 ${optionPortfolio.totalHoldingCost.toFixed(2)}</span>
                          <span>·</span>
                          <span className={`font-mono font-black ${optionPortfolio.totalCurrentPnL >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            當前損益 {optionPortfolio.totalCurrentPnL >= 0 ? `+$${optionPortfolio.totalCurrentPnL.toFixed(2)}` : `-$${Math.abs(optionPortfolio.totalCurrentPnL).toFixed(2)}`}
                          </span>
                        </span>
                      )}
                      
                      <input
                        type="file"
                        accept="application/json"
                        className="hidden"
                        ref={tradesJsonFileInputRef}
                        onChange={handleImportTradesJson}
                      />
                      <button
                        type="button"
                        onClick={handleExportTradesJson}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 transition-all text-[11px] font-bold ml-1 shadow-2xs"
                      >
                        <Download className="w-3 h-3" />
                        匯出Json
                      </button>
                      <button
                        type="button"
                        onClick={() => tradesJsonFileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-all text-[11px] font-bold shadow-2xs"
                      >
                        <Upload className="w-3 h-3" />
                        匯入Json
                      </button>
                    </div>
             <Dialog open={isTradeOpen} onOpenChange={setIsTradeOpen}>
               <DialogTrigger 
                  render={
                    <button 
                      disabled={tab.status === 'COMPLETED'} 
                      className="h-8 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-4 text-xs font-bold rounded-lg whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                    >
                      新增交易
                    </button>
                  } 
                />
               <DialogContent className="glass-panel border-zinc-200 shadow-2xl bg-white text-zinc-800 w-[92vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl sm:rounded-3xl">
                 <DialogHeader><DialogTitle className="font-bold text-xl sm:text-2xl tracking-tight text-zinc-800 mb-2">新增交易紀錄</DialogTitle></DialogHeader>
                 <form onSubmit={handleTradeSubmit} className="space-y-4 sm:space-y-6">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
                     <div className="space-y-2">
                       <Label className="font-bold text-zinc-500">交易方向</Label>
                       <div className="flex gap-3">
                         <Select value={tradeForm.type} onValueChange={(val) => setTradeForm({...tradeForm, type: val})}>
                           <SelectTrigger className="flex-1 bg-white border-zinc-200 text-zinc-800"><SelectValue/></SelectTrigger>
                           <SelectContent className="glass-panel border-zinc-200 text-zinc-800 bg-white shadow-lg">
                             <SelectItem value="BUY" className="font-bold text-emerald-700 focus:bg-zinc-100 focus:text-emerald-700">BUY</SelectItem>
                             <SelectItem value="SELL" className="font-bold text-rose-650 focus:bg-zinc-100 focus:text-rose-655">SELL</SelectItem>
                           </SelectContent>
                         </Select>
                         <Select value={tradeForm.purpose} onValueChange={(val) => setTradeForm({...tradeForm, purpose: val})}>
                           <SelectTrigger className="flex-1 bg-white border border-zinc-200 text-zinc-800"><SelectValue/></SelectTrigger>
                           <SelectContent className="glass-panel border border-zinc-200 text-zinc-800 bg-white shadow-lg">
                             <SelectItem value="加碼" className="font-medium focus:bg-zinc-100 focus:text-zinc-800">加碼</SelectItem>
                             <SelectItem value="平倉" className="font-medium focus:bg-zinc-100 focus:text-zinc-800">平倉</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                     </div>
                     <div className="space-y-2">
                        <Label className="font-bold text-zinc-500">交易批次 (可複選)</Label>
                        <BatchMultiSelect
                          variant="form"
                          value={tradeForm.batch}
                          onChange={(val) => setTradeForm({ ...tradeForm, batch: val })}
                          placeholder="請選擇交易批次 (可複選)"
                        />
                      </div>
                     <div className="space-y-2">
                       <Label className="font-bold text-zinc-500">日期</Label>
                       <Input type="date" className="bg-white border-zinc-200 text-zinc-800 focus-visible:ring-emerald-500/55" required value={tradeForm.tradeDate} onChange={e => setTradeForm({...tradeForm, tradeDate: e.target.value})} />
                     </div>
                     <div className="space-y-2">
                       <Label className="font-bold text-zinc-500">價格</Label>
                       <Input type="number" step="0.01" className="bg-white border-zinc-200 text-zinc-800 focus-visible:ring-emerald-500/55" required value={tradeForm.price} onChange={e => setTradeForm({...tradeForm, price: e.target.value})} />
                     </div>
                     <div className="space-y-2">
                       <Label className="font-bold text-zinc-500">數量</Label>
                       <Input type="number" step="0.01" className="bg-white border-zinc-200 text-zinc-800 focus-visible:ring-emerald-500/55" required value={tradeForm.quantity} onChange={e => setTradeForm({...tradeForm, quantity: e.target.value})} />
                     </div>
                     <div className="space-y-2">
                       <Label className="font-bold text-zinc-500">操作員</Label>
                       <Select value={tradeForm.operator} onValueChange={(val) => setTradeForm({...tradeForm, operator: val})}>
                         <SelectTrigger className="w-full bg-white border-zinc-200 text-zinc-800"><SelectValue/></SelectTrigger>
                         <SelectContent className="glass-panel border-zinc-200 text-zinc-800 bg-white shadow-lg border">
                           <SelectItem value="人" className="font-medium focus:bg-zinc-100 focus:text-zinc-800">人</SelectItem>
                           <SelectItem value="機器" className="font-bold text-rose-650 focus:bg-zinc-100 focus:text-rose-655">機器</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                     <div className="space-y-2">
                       <Label className="font-bold text-zinc-500">手續費 (選填)</Label>
                       <Input type="number" step="0.01" className="bg-white border-zinc-200 text-zinc-800" value={tradeForm.fees} onChange={e => setTradeForm({...tradeForm, fees: e.target.value})} />
                     </div>
                     <div className="space-y-2 col-span-2">
                       <Label className="font-bold text-zinc-500">備註 (選填)</Label>
                       <Input className="bg-white border-zinc-200 text-zinc-800 focus-visible:ring-emerald-500/50" value={tradeForm.notes} onChange={e => setTradeForm({...tradeForm, notes: e.target.value})} />
                     </div>
                   </div>
                   <DialogFooter className="pt-4">
                     <button type="submit" className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-8 py-2.5 font-bold rounded-xl w-full sm:w-auto transition-all shadow-sm">
                       儲存交易
                     </button>
                   </DialogFooter>
                 </form>
               </DialogContent>
             </Dialog>
           </div>

           <ScrollIn delay={0.2}>
              <div className="flex flex-col bg-white border border-zinc-200 rounded-2xl relative transition-all duration-300 hover:shadow-lg shadow-sm z-10 overflow-hidden">
                <div 
                   onClick={() => setIsTradeListOpen(!isTradeListOpen)}
                   className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors group"
                 >
                     <div className="flex items-center gap-4">
                      <Magnetic>
                       <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-500 group-hover:text-zinc-800 transition-colors">
                         <BarChart3 className="h-5 w-5" />
                       </div>
                      </Magnetic>
                      <div>
                        <h3 className="font-bold text-lg text-zinc-800">紀錄列表</h3>
                        <p className="text-xs font-semibold text-zinc-500 mt-1">
                          共有 {trades.length} 筆交易紀錄
                        </p>
                      </div>
                    </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-zinc-400 tracking-widest opacity-0 lg:group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {isTradeListOpen ? '收合明細' : '展開明細'}
                    </span>
                    <motion.div
                      animate={{ rotate: isTradeListOpen ? 180 : 0 }}
                      className="h-8 w-8 rounded-full border border-zinc-200 bg-zinc-50 flex items-center justify-center text-zinc-500 group-hover:bg-zinc-100 transition-colors"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </motion.div>
                  </div>
                </div>
                
                <AnimatePresence>
                 {isTradeListOpen && (
                   <motion.div
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: "auto", opacity: 1 }}
                     exit={{ height: 0, opacity: 0 }}
                     transition={{ type: "spring", stiffness: 300, damping: 30 }}
                     className="overflow-hidden border-t border-zinc-150 bg-zinc-50/20"
                   >
                     <div className="p-0 bg-transparent overflow-x-auto">
                       <table className="w-full text-sm text-left">
                          <thead className="text-[11px] sm:text-xs text-zinc-500 bg-zinc-100 uppercase tracking-wider sm:tracking-widest border-b border-zinc-200 font-bold">
                            <tr>
                              <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">日期 / 經過天數</th>
                              <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">方向 / 期權規格</th>
                              <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">交易批次 / Delta</th>
                              <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">價格 / 合約金額</th>
                              <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">數量 / 張數</th>
                              <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">總計 / 總持倉成本與損益</th>
                              <th className="px-3 sm:px-6 py-3 sm:py-4 text-right font-semibold">操作</th>
                            </tr>
                          </thead>
                          <motion.tbody layout>
                            {trades.length === 0 ? (
                              <tr><td colSpan={7} className="px-6 py-12 text-center text-zinc-400 font-medium bg-white">暫無交易紀錄</td></tr>
                            ) : (
                              trades.map(t => {
                                const isOpt = Boolean(t.isOptionTrade);
                                const optMetrics = isOpt
                                  ? calculateLiveOptionTradeMetrics(t, tab?.currentPrice)
                                  : null;

                                return (
                                  <motion.tr 
                                    key={t.id} 
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className={`border-b border-zinc-150 last:border-0 transition-colors text-zinc-800 font-semibold ${
                                      isOpt ? 'bg-emerald-50/35 hover:bg-emerald-50/70' : 'bg-white hover:bg-zinc-50/50'
                                    }`}
                                  >
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                      <div>{t.purchaseDate ? t.purchaseDate.replace(/-/g, '/') : formatTimestamp(t.tradeDate, 'yyyy/MM/dd')}</div>
                                      {isOpt && optMetrics && (
                                        <span className="inline-block mt-1 text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded">
                                          已過 {optMetrics.daysElapsed} 天 (Theta)
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                                      <div className="flex flex-col gap-1.5 items-start">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className={`px-2 py-0.5 text-[10px] tracking-wider rounded-md font-bold ${t.type === 'BUY' ? 'bg-blue-500/20 text-blue-600 border border-blue-500/30' : 'bg-red-500/20 text-red-600 border border-red-500/30'}`}>
                                            {t.type}
                                          </span>
                                          {isOpt && optMetrics ? (
                                            <span className={`px-2 py-0.5 text-[10px] font-mono font-black rounded-md border ${
                                              optMetrics.optionType === 'call'
                                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                                : 'bg-rose-100 text-rose-900 border-rose-300'
                                            }`}>
                                              期權 {optMetrics.optionType.toUpperCase()} @ ${optMetrics.strikePrice}
                                            </span>
                                          ) : null}
                                          {t.operator === '機器' && (
                                            <span className="text-[10px] font-bold text-red-500 px-1 py-0.5 rounded border border-red-500/20 bg-red-500/10">機器</span>
                                          )}
                                          {t.operator === '人' && (
                                            <span className="text-[10px] font-bold text-zinc-500 px-1 py-0.5 rounded border border-zinc-200 bg-zinc-50">人</span>
                                          )}
                                        </div>
                                        {isOpt && optMetrics ? (
                                          <span className="text-[10px] font-mono text-zinc-600">
                                            DTE {optMetrics.dte}天 · 開倉單價 ${optMetrics.entryOptionPrice.toFixed(2)}/股
                                          </span>
                                        ) : t.purpose ? (
                                          <span className="text-[10px] text-center font-semibold text-zinc-650 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded-sm">
                                            {t.purpose}
                                          </span>
                                        ) : null}
                                      </div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                      {isOpt && optMetrics ? (
                                        <div className="space-y-1">
                                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/90 border border-emerald-300 text-emerald-950 font-mono text-xs font-black">
                                            <span>Delta (Δ):</span>
                                            <span>{optMetrics.delta >= 0 ? '+' : ''}{optMetrics.delta.toFixed(4)}</span>
                                          </div>
                                          <div className="text-[10px] font-mono text-zinc-500">
                                            Θ {optMetrics.theta.toFixed(4)} · IV {optMetrics.ivPercent.toFixed(1)}%
                                          </div>
                                        </div>
                                      ) : (
                                        <BatchMultiSelect
                                          variant="table"
                                          value={t.batch}
                                          onChange={(newBatch) => {
                                            updateTrade(t.id, { batch: newBatch });
                                            toast.success(newBatch ? `交易批次已更新為「${newBatch}」` : '已清除交易批次');
                                          }}
                                          placeholder="選擇批次"
                                        />
                                      )}
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap font-mono">
                                      {isOpt && optMetrics ? (
                                        <div>
                                          <div className="font-black text-emerald-900">
                                            合約金額 ${optMetrics.contractAmount.toFixed(2)}
                                            <span className="text-[10px] font-normal text-zinc-500 ml-1">/張</span>
                                          </div>
                                          <div className="text-[10px] text-zinc-500">
                                            (${optMetrics.entryOptionPrice.toFixed(2)} × 100股)
                                          </div>
                                        </div>
                                      ) : (
                                        <span>${t.price}</span>
                                      )}
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap font-mono">
                                      {isOpt && optMetrics ? (
                                        <div>
                                          <span className="font-black text-zinc-900">{optMetrics.contractsCount} 張</span>
                                          <span className="text-[10px] text-zinc-500 block">
                                            ({optMetrics.contractsCount * optMetrics.contractMultiplier} 股)
                                          </span>
                                        </div>
                                      ) : (
                                        <span>{t.quantity}</span>
                                      )}
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap font-mono">
                                      {isOpt && optMetrics ? (
                                        <div className="space-y-0.5">
                                          <div className="font-black text-zinc-900">
                                            總持倉成本: ${optMetrics.totalHoldingCost.toFixed(2)}
                                          </div>
                                          <div className={`text-xs font-black ${optMetrics.currentPnL >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                            當前損益: {optMetrics.currentPnL >= 0 ? `+$${optMetrics.currentPnL.toFixed(2)}` : `-$${Math.abs(optMetrics.currentPnL).toFixed(2)}`} ({optMetrics.currentRoiPct >= 0 ? '+' : ''}{optMetrics.currentRoiPct.toFixed(1)}%)
                                          </div>
                                          <div className="text-[10px] text-zinc-500">
                                            隨現價自動平倉價: ${optMetrics.autoCurrentOptionPrice.toFixed(2)}/股
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-zinc-700">${(t.price * t.quantity).toFixed(2)}</span>
                                      )}
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                                      <button 
                                         onClick={() => deleteTrade(t.id)} 
                                         className="text-rose-650 hover:text-rose-700 py-1.5 px-3 font-semibold rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                                       >
                                        刪除
                                      </button>
                                    </td>
                                  </motion.tr>
                                );
                              })
                            )}
                          </motion.tbody>
                        </table>
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>
             </div>
            </ScrollIn>
          </TabsContent>
        </Tabs>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
</div>
</ScrollIn>
</TabsContent>

        <TabsContent value="strategy" id="main-panel-strategy" className="pt-4">
           {id && <StrategyTab tabId={id} readOnly={false} />}
        </TabsContent>



        <TabsContent value="chips" id="main-panel-chips" className="pt-4">
           {id && <ChipAnalysisTab tabId={id} symbol={tab?.symbol || ''} />}
        </TabsContent>
        


      </Tabs>

      {/* Averaging Calculation & Trading Discipline Help Dialog */}
      <Dialog open={isAveragingHelpOpen} onOpenChange={setIsAveragingHelpOpen}>
        <DialogContent className="w-[92vw] sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-5 sm:p-6 shadow-2xl border border-zinc-200">
          <DialogHeader className="border-b border-zinc-100 pb-3">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-zinc-900">
              <HelpCircle className="h-5 w-5 text-emerald-600 shrink-0" />
              股價向下攤平試算與交易紀律說明
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 my-2 text-sm text-zinc-700 leading-relaxed max-h-[75vh] overflow-y-auto pr-1">
            {/* Downward Averaging Logic */}
            <div className="bg-zinc-50 border border-zinc-200/90 rounded-xl p-4 space-y-2.5">
              <h4 className="font-bold text-zinc-900 flex items-center gap-1.5 text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                股價向下攤平試算運算邏輯
              </h4>
              <p className="text-xs text-zinc-600 leading-normal">
                點擊預計購買數量的規劃批次標籤（第一批 ~ 第四批）或個別拆分子批時，會將計算出的股數分別填入該組系統一與系統二「預計購入數量 (股)」的兩個輸入欄位：
              </p>
              
              <div className="space-y-2 text-xs pt-1">
                <div className="bg-white p-3 rounded-lg border border-zinc-200 shadow-sm space-y-1.5">
                  <span className="font-bold text-emerald-700 block">各批次拆分點擊對應規則：</span>
                  <div className="text-zinc-600 pl-1 space-y-1.5">
                    <div>• <strong>第一批 (15%)</strong>：可拆分為 <strong>第一批拆分交易(7%)</strong> + <strong>第一批交易(8%)</strong>，點擊分別帶入第 1 組系統一 (-2%) 與系統二 (-3%) 之預計購入數量</div>
                    <div>• <strong>第二批 (25%)</strong>：可拆分為 <strong>第二批拆分交易(10%)</strong> + <strong>第二批拆分交易(15%)</strong>，點擊分別帶入第 2 組系統一 (-4%) 與系統二 (-6%) 之預計購入數量</div>
                    <div>• <strong>第三批 (35%)</strong>：可拆分為 <strong>第三批拆分交易(15%)</strong> + <strong>第三批拆分交易(20%)</strong>，點擊分別帶入第 3 組系統一 (-6%) 與系統二 (-9%) 之預計購入數量</div>
                    <div>• <strong>第四批 (25%)</strong>：可拆分為 <strong>第四批拆分交易 (10%)</strong> + <strong>第四批拆分交易 (15%)</strong>，點擊分別帶入第 4 組系統一 (-8%) 與系統二 (-12%) 之預計購入數量</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Strict Trading Rules in Red Text */}
            <div className="bg-rose-50/90 border-2 border-rose-300 rounded-xl p-4 space-y-2.5 text-rose-700">
              <h4 className="font-black text-rose-800 flex items-center gap-1.5 text-sm border-b border-rose-200/80 pb-2">
                <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                特別註明：風控與交易紀律 (嚴格執行)
              </h4>
              <ul className="space-y-2 font-bold text-xs leading-relaxed text-rose-700">
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-600 shrink-0">•</span>
                  <span>單筆交易浮動攤平虧損最大為虧損金額達到 6%，請自動平倉與停止交易。</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-600 shrink-0">•</span>
                  <span>根據凱利公式，禁止全資產梭哈。</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-600 shrink-0">•</span>
                  <span>第一批與第二批的交易 40% 為單筆交易的最大資產使用量，第三批與第四批禁止使用。</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-600 shrink-0">•</span>
                  <span>評估本交易的勝率為 50% 則不能下注，唯有高於 60% ~ 80% 才可以下注，且使用最大資產額度仍為 40%。</span>
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-zinc-100">
            <Button 
              onClick={() => setIsAveragingHelpOpen(false)}
              className="w-full sm:w-auto bg-zinc-900 hover:bg-black text-white font-bold rounded-xl px-6 py-2 text-xs"
            >
              了解並遵守紀律
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
