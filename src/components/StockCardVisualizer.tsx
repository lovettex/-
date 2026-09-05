import React, { useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { PlannedOrder, ChartAnnotation } from "../types";
import { MousePointer, Minus, Square, Type, Trash2, Eraser, Undo2, ArrowUpRight, Move, Download, Share2, Camera, Loader2, SeparatorHorizontal, Check } from "lucide-react";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { getAxisLetterForColor } from "../utils/visualLinesSync";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Props {
  plannedOrders: PlannedOrder[];
  currentPrice?: number;
  onToggleHighlight?: (orderId: string, currentStatus: boolean) => void;
  tabId?: string;
  annotations?: ChartAnnotation[];
  onUpdateAnnotations?: (annotations: ChartAnnotation[]) => void;
  averageCost?: number;
  averageCostQuantity?: number;
  averagingRows?: { price: string; quantity: string; quantity2?: string; bought?: boolean; riskFlag?: boolean }[];
  averagingRowsSys2?: { price: string; quantity: string; quantity2?: string; bought?: boolean; riskFlag?: boolean }[];
  plannedBuyQty?: number;
  plannedBuyPercent?: number;
  holdingQuantity?: number;
  stockName?: string;
  rating?: number;
  qualityScore?: number;
  valueScore?: number;
  buyRate?: number;
  sellRate?: number;
  volatility?: string;
  crashSimilarity?: number;
  onRatingBarDoubleClick?: (e: React.MouseEvent | React.TouchEvent) => void;
  strategy?: {
    notesHighlighted?: boolean;
    tpChecked?: boolean;
    slChecked?: boolean;
    addChecked?: boolean;
    closeChecked?: boolean;
    observeChecked?: boolean;
    breakoutResistanceChecked?: boolean;
    closeToResistanceChecked?: boolean;
    closeToSupportChecked?: boolean;
    breakdownSupportChecked?: boolean;
    closeToSLChecked?: boolean;
    breakdownSLChecked?: boolean;
    pathAccumulationChecked?: boolean;
    pathAccumulationStage?: string;
    pathWashChecked?: boolean;
    pathWashStage?: string;
    pathTestChecked?: boolean;
    pathTestStage?: string;
    pathRallyChecked?: boolean;
    pathRallyStage?: string;
    pathDistributionChecked?: boolean;
    pathDistributionStage?: string;
  };
  tradeDirection?: string;
  onUpdateStrategyField?: (field: string, checked: any) => void;
  onUpdateTPChecked?: (checked: boolean) => void;
  onUpdateSLChecked?: (checked: boolean) => void;
  onUpdateAddChecked?: (checked: boolean) => void;
  onUpdateCloseChecked?: (checked: boolean) => void;
  onUpdateObserveChecked?: (checked: boolean) => void;
  onUpdateNotesHighlighted?: (checked: boolean) => void;
  onOpenActionSettings?: () => void;
  userId?: string;
  holdingStatus?: string;
  tradeType?: string;
  isSelected?: boolean;
  onToggleSelected?: () => void;
  onOpenMiniVisualLinesModal?: (info: {
    stockName: string;
    currentPrice?: number;
    holdingStatus?: string;
    tradeType?: string;
  }) => void;
}

function resolveCollisions<T extends { rawY: number; isFixed?: boolean }>(
  items: T[],
  minDisp: number,
): (T & { y: number })[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{ ...items[0], y: items[0].isFixed ? items[0].rawY : Math.max(7, Math.min(93, items[0].rawY)) }];
  }

  const sorted = [...items]
    .sort((a, b) => a.rawY - b.rawY)
    .map((item) => ({ ...item, y: item.isFixed ? item.rawY : Math.max(7, Math.min(93, item.rawY)) }));

  const minY = 7;
  const maxY = 93;
  const n = sorted.length;
  // Adaptive minDisp so large numbers of targets don't push beyond container bounds
  const effectiveMinDisp = Math.min(minDisp, (maxY - minY) / Math.max(1, n - 1));

  // 80 rounds of gentle iterative spring relaxation and collision resolution
  for (let iter = 0; iter < 80; iter++) {
    // 1. Gentle spring attraction to raw position (keeps labels as faithful to actual price line as possible)
    for (let i = 0; i < n; i++) {
      if (!sorted[i].isFixed) {
        sorted[i].y += (sorted[i].rawY - sorted[i].y) * 0.08;
      }
    }

    // 2. Pairwise collision separation
    for (let i = 0; i < n - 1; i++) {
      const diff = sorted[i + 1].y - sorted[i].y;
      if (diff < effectiveMinDisp) {
        const overlap = effectiveMinDisp - diff;
        const iFixed = !!sorted[i].isFixed;
        const nextFixed = !!sorted[i + 1].isFixed;
        if (iFixed && !nextFixed) {
          sorted[i + 1].y += overlap;
        } else if (!iFixed && nextFixed) {
          sorted[i].y -= overlap;
        } else if (!iFixed && !nextFixed) {
          sorted[i].y -= overlap / 2;
          sorted[i + 1].y += overlap / 2;
        }
      }
    }

    // 3. Individual boundary constraints (clamp strictly to boundaries without falsely pushing unrelated items)
    for (let i = 0; i < n; i++) {
      if (!sorted[i].isFixed) {
        sorted[i].y = Math.max(minY, Math.min(maxY, sorted[i].y));
      }
    }
  }

  // 4. Final monotonic ordering and minimum spacing pass
  for (let i = 0; i < n - 1; i++) {
    if (!sorted[i + 1].isFixed) {
      if (sorted[i + 1].y < sorted[i].y + effectiveMinDisp * 0.85) {
        sorted[i + 1].y = Math.min(maxY, sorted[i].y + effectiveMinDisp * 0.85);
      }
    }
  }

  // Final hard clamping to keep within safe physical boundaries
  sorted.forEach((item) => {
    if (!item.isFixed) {
      item.y = Math.max(minY, Math.min(maxY, item.y));
    }
  });

  return sorted;
}

export const priceCache = new Map<string, { price: number; timestamp: number }>();

export const prefetchStockPrice = (symbol: string) => {
  if (!symbol) return;
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < 30000) return;
  
  fetch(`/api/stock/${symbol}`).then(res => res.json()).then(data => {
    const fetchedPrice = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (fetchedPrice && typeof fetchedPrice === 'number') {
       priceCache.set(symbol, { price: fetchedPrice, timestamp: Date.now() });
    }
  }).catch(() => {});
};

export const useStockPrice = (symbol?: string, initialPrice: number = 0) => {
  const [price, setPrice] = React.useState<number>(initialPrice);
  const [isLoading, setIsLoading] = React.useState<boolean>(!initialPrice || initialPrice <= 0);

  React.useEffect(() => {
    if (!symbol) return;
    
    const cached = priceCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < 30000) {
       setPrice(cached.price);
       setIsLoading(false);
       // We still want to refresh in background but not show loading state
    } else if (initialPrice > 0) {
       setPrice(initialPrice);
       setIsLoading(false);
    } else {
       setIsLoading(true);
    }

    let isMounted = true;
    const fetchPrice = async () => {
      try {
        const res = await fetch(`/api/stock/${symbol}`);
        if (!res.ok) return;
        const data = await res.json();
        const fetchedPrice = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (fetchedPrice && isMounted && typeof fetchedPrice === 'number') {
           setPrice(fetchedPrice);
           priceCache.set(symbol, { price: fetchedPrice, timestamp: Date.now() });
           setIsLoading(false);
        }
      } catch (e) {
         if (isMounted) setIsLoading(false);
      }
    };
    
    fetchPrice();
    return () => { isMounted = false; };
  }, [symbol, initialPrice]);

  return { price, isLoading };
};

interface StockBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const computeMA = (bars: StockBar[], period: number): (number | null)[] => {
  const ma: (number | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < period - 1) {
      ma.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += bars[i - j].close;
      }
      ma.push(sum / period);
    }
  }
  return ma;
};

const computeRSI = (bars: StockBar[], period: number = 14): (number | null)[] => {
  const rsi: (number | null)[] = [];
  if (bars.length < period + 1) {
    return Array(bars.length).fill(null);
  }
  
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const diff = bars[i].close - bars[i - 1].close;
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }
  
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;
  
  for (let i = 0; i <= period; i++) {
    rsi.push(null);
  }
  
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    
    const rs = avgLoss === 0 ? 999999 : avgGain / avgLoss;
    const rsiVal = 100 - 100 / (1 + rs);
    rsi.push(rsiVal);
  }
  
  return rsi;
};

const computeEMA = (values: number[], period: number): number[] => {
  const ema: number[] = [];
  if (values.length === 0) return ema;
  
  const k = 2 / (period + 1);
  ema[0] = values[0];
  for (let i = 1; i < values.length; i++) {
    ema[i] = values[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
};

const computeMACD = (bars: StockBar[]) => {
  const closes = bars.map(b => b.close);
  const ema12 = computeEMA(closes, 12);
  const ema26 = computeEMA(closes, 26);
  
  const dif: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    dif.push(ema12[i] - ema26[i]);
  }
  
  const dea = computeEMA(dif, 9);
  const histogram: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    histogram.push(dif[i] - dea[i]);
  }
  
  return { dif, dea, histogram };
};

const DRAWING_COLORS = [
  { hex: '#ef4444', name: '止損紅' },
  { hex: '#f97316', name: '強勢橘' },
  { hex: '#eab308', name: '關鍵黃' },
  { hex: '#10b981', name: '止盈綠' },
  { hex: '#14b8a6', name: '薄荷綠' },
  { hex: '#06b6d4', name: '天空青' },
  { hex: '#3b82f6', name: '系統藍' },
  { hex: '#6366f1', name: '靛青藍' },
  { hex: '#a855f7', name: '神秘紫' },
  { hex: '#ec4899', name: '玫瑰粉' },
  { hex: '#64748b', name: '質感灰' },
  { hex: '#000000', name: '經典黑' },
  { hex: '#ffffff', name: '純白色' },
];

const EMPTY_ANNOTATIONS: ChartAnnotation[] = [];

export const StockCardVisualizer: React.FC<Props> = ({
  plannedOrders,
  currentPrice = 0,
  onToggleHighlight,
  tabId,
  annotations = EMPTY_ANNOTATIONS,
  onUpdateAnnotations,
  averageCost,
  averageCostQuantity,
  averagingRows,
  averagingRowsSys2,
  plannedBuyQty,
  plannedBuyPercent,
  holdingQuantity,
  stockName,
  rating,
  qualityScore,
  valueScore,
  buyRate,
  sellRate,
  volatility,
  crashSimilarity,
  onRatingBarDoubleClick,
  strategy,
  tradeDirection,
  onUpdateStrategyField,
  onUpdateTPChecked,
  onUpdateSLChecked,
  onUpdateAddChecked,
  onUpdateCloseChecked,
  onUpdateObserveChecked,
  onUpdateNotesHighlighted,
  onOpenActionSettings,
  userId,
  holdingStatus,
  tradeType,
  isSelected,
  onToggleSelected,
  onOpenMiniVisualLinesModal,
}) => {
  const { price: dynamicPrice, isLoading: isCardLoading } = useStockPrice(stockName, currentPrice);

  const lastCpTapTime = useRef<number>(0);

  const ratingVal = rating !== undefined ? rating : 5;
  const qualityVal = qualityScore !== undefined ? qualityScore : 5;
  const valueVal = valueScore !== undefined ? valueScore : 5;
  const buyVal = buyRate !== undefined ? buyRate : 5;
  const sellVal = sellRate !== undefined ? sellRate : 5;
  const crashVal = crashSimilarity !== undefined ? crashSimilarity : 5;

  const posValue = Math.max(0, ratingVal - 5) + Math.max(0, qualityVal - 5) + Math.max(0, valueVal - 5) + buyVal;
  const negValue = Math.max(0, 5 - ratingVal) + Math.max(0, 5 - qualityVal) + Math.max(0, 5 - valueVal) + sellVal;

  const [hoveredLabel, setHoveredLabel] = useState<any>(null);
  const longPressTimers = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Local optimistic annotations state for instant (0ms) canvas response
  const [localAnnotations, setLocalAnnotations] = useState<ChartAnnotation[]>(annotations || EMPTY_ANNOTATIONS);
  const localAnnotationsRef = useRef<ChartAnnotation[]>(localAnnotations);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const draggingIdRef = useRef<string | null>(null);

  React.useEffect(() => {
    // Only synchronize from props if we do not have an active pending debounce or active user interaction
    if (!saveTimeoutRef.current && !isDrawingRef.current && !isErasingRef.current && !draggingIdRef.current) {
      const incoming = annotations || EMPTY_ANNOTATIONS;
      const current = localAnnotationsRef.current || EMPTY_ANNOTATIONS;

      // Avoid infinite update loop: check if incoming equals current
      if (incoming === current) return;
      if (incoming.length === 0 && current.length === 0) return;
      if (incoming.length === current.length && JSON.stringify(incoming) === JSON.stringify(current)) {
        return;
      }

      setLocalAnnotations(incoming);
      localAnnotationsRef.current = incoming;
    }
  }, [annotations]);

  React.useEffect(() => {
    return () => {
      // Flush any pending debounced annotation save when the component unmounts
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        onUpdateAnnotationsRef.current?.(localAnnotationsRef.current);
      }
    };
  }, []);

  // Annotations State
  const [mode, setMode] = useState<'cursor' | 'line' | 'box' | 'text' | 'eraser' | 'arrow' | 'move' | 'divider'>('cursor');
  const [activeColor, setActiveColor] = useState<string>('#000000');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState<boolean>(false);
  const colorButtonRef = useRef<HTMLButtonElement | null>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [openSubField, setOpenSubField] = useState<string | null>(null);
  const [activeThickness, setActiveThickness] = useState<number>(8);
  const [activeFontSize, setActiveFontSize] = useState<number>(24);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);
  const [activePoint, setActivePoint] = useState<{ x: number, y: number } | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number, y: number } | null>(null);
  const [eraserHoverPoint, setEraserHoverPoint] = useState<{ x: number, y: number } | null>(null);
  const isErasingRef = useRef<boolean>(false);
  const [inputCoords, setInputCoords] = useState<{ x: number, y: number } | null>(null);
  const [inputText, setInputText] = useState<string>('');

  const modeRef = useRef(mode);
  const activeColorRef = useRef(activeColor);
  const activeThicknessRef = useRef(activeThickness);
  const activeFontSizeRef = useRef(activeFontSize);
  const isDrawingRef = useRef(isDrawing);
  const startPointRef = useRef<{ x: number, y: number } | null>(null);
  const activePointRef = useRef<{ x: number, y: number } | null>(null);
  const lastTouchTimeRef = useRef<number>(0);
  const activeNewDividerIdRef = useRef<string | null>(null);

  // Synchronously update current values to avoid race conditions when switching tools
  modeRef.current = mode;
  activeColorRef.current = activeColor;
  activeThicknessRef.current = activeThickness;
  activeFontSizeRef.current = activeFontSize;
  isDrawingRef.current = isDrawing;

  React.useEffect(() => {
    modeRef.current = mode;
    activeColorRef.current = activeColor;
    activeThicknessRef.current = activeThickness;
    activeFontSizeRef.current = activeFontSize;
    isDrawingRef.current = isDrawing;
  }, [mode, activeColor, activeThickness, activeFontSize, isDrawing]);

  const updatePickerPosition = () => {
    if (!colorButtonRef.current) return;
    const rect = colorButtonRef.current.getBoundingClientRect();
    const pickerWidth = 240;
    const pickerHeight = 265;

    let left = rect.left + rect.width / 2 - pickerWidth / 2;
    if (left + pickerWidth > window.innerWidth - 12) {
      left = window.innerWidth - pickerWidth - 12;
    }
    if (left < 12) left = 12;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    let top: number;
    if (spaceBelow < pickerHeight && spaceAbove >= pickerHeight) {
      top = rect.top - pickerHeight - 8;
    } else {
      top = rect.bottom + 8;
    }
    setPickerPos({ top, left });
  };

  const toggleColorPicker = () => {
    if (isColorPickerOpen) {
      setIsColorPickerOpen(false);
    } else {
      updatePickerPosition();
      setIsColorPickerOpen(true);
    }
  };

  const handleSelectColor = (hex: string) => {
    setActiveColor(hex);
    activeColorRef.current = hex;
    setIsColorPickerOpen(false);
  };

  const arrowColorList = useMemo(() => {
    const map = new Map<string, string>();
    DRAWING_COLORS.forEach((m) => {
      const hex = m.hex.startsWith('#') ? m.hex : `#${m.hex}`;
      map.set(hex.replace('#', '').toLowerCase(), hex);
    });
    if (activeColor) {
      const hex = activeColor.startsWith('#') ? activeColor : `#${activeColor}`;
      map.set(hex.replace('#', '').toLowerCase(), hex);
    }
    localAnnotations.forEach((ann) => {
      if (ann.color) {
        const hex = ann.color.startsWith('#') ? ann.color : `#${ann.color}`;
        map.set(hex.replace('#', '').toLowerCase(), hex);
      }
    });
    return Array.from(map.entries());
  }, [activeColor, localAnnotations]);

  React.useEffect(() => {
    if (!isColorPickerOpen) return;
    const handleReposition = () => {
      updatePickerPosition();
    };
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isColorPickerOpen]);

  // Export states
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportLoading, setExportLoading] = useState<boolean>(false);

  // Dynamic Chart.js Dataset & Options for Interactive Background Curve
  const chartJsData = useMemo(() => {
    const baseP = dynamicPrice > 0 ? dynamicPrice : 100;
    const labels = Array.from({ length: 24 }, (_, i) => `${i + 9}:00`);
    const dataPoints = labels.map((_, i) => {
      const offset = (Math.sin(i * 0.6) * 0.012 + Math.cos(i * 0.35) * 0.008) * baseP;
      return +(baseP + offset).toFixed(2);
    });
    if (dataPoints.length > 0 && dynamicPrice > 0) {
      dataPoints[dataPoints.length - 1] = dynamicPrice;
    }

    return {
      labels,
      datasets: [
        {
          label: stockName || "股價趨勢",
          data: dataPoints,
          borderColor: "rgba(59, 130, 246, 0.45)",
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: "#3b82f6",
          pointHoverBorderColor: "#ffffff",
          pointHoverBorderWidth: 2,
          tension: 0.38,
          fill: true,
          backgroundColor: (context: any) => {
            const ctx = context.chart?.ctx;
            if (!ctx) return "rgba(59, 130, 246, 0.05)";
            const gradient = ctx.createLinearGradient(0, 0, 0, 160);
            gradient.addColorStop(0, "rgba(59, 130, 246, 0.12)");
            gradient.addColorStop(1, "rgba(59, 130, 246, 0.0)");
            return gradient;
          },
        },
      ],
    };
  }, [dynamicPrice, stockName]);

  const chartJsOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 600,
      easing: "easeOutQuart" as const,
    },
    scales: {
      x: { display: false },
      y: { display: false },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: mode === 'cursor',
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(9, 9, 11, 0.9)',
        titleFont: { size: 10, weight: 'bold' as const },
        bodyFont: { size: 10 },
        padding: 6,
        cornerRadius: 6,
        displayColors: false,
        callbacks: {
          label: (item: any) => `動態價: $${item.raw}`,
        },
      },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
  }), [mode]);

  // Local undo history for visual annotations
  const [history, setHistory] = useState<ChartAnnotation[][]>([]);

  const commitAnnotations = (nextAnnotations: ChartAnnotation[], immediate = false) => {
    setLocalAnnotations(nextAnnotations);
    localAnnotationsRef.current = nextAnnotations;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    if (immediate) {
      onUpdateAnnotationsRef.current?.(nextAnnotations);
    } else {
      saveTimeoutRef.current = setTimeout(() => {
        onUpdateAnnotationsRef.current?.(localAnnotationsRef.current);
        saveTimeoutRef.current = null;
      }, 250);
    }
  };

  const pushToHistoryAndSave = (nextAnnotations: ChartAnnotation[], immediate = true) => {
    setHistory((prev) => [...prev, localAnnotationsRef.current]);
    commitAnnotations(nextAnnotations, immediate);
  };

  const flushPendingSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      onUpdateAnnotationsRef.current?.(localAnnotationsRef.current);
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prevState = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    commitAnnotations(prevState, true);
  };

  // 1. Export Screenshot of the current Visualizer
  // 1. Export Screenshot of the current Visualizer - updated to capture Card Front
  const handleExportVisualizer = async () => {
    if (!canvasRef.current) return;

    // Helper to replace CSS Color 4 functions in strings (handles nested parens safely)
    const sanitizeColorString = (val: string): string => {
      if (!val) return val;
      const targets = ["oklch(", "oklab(", "color-mix(", "light-dark("];
      let res = val;
      
      while (true) {
        let earliestIdx = -1;
        let foundTarget = "";
        for (const target of targets) {
          const idx = res.toLowerCase().indexOf(target);
          if (idx !== -1) {
            if (earliestIdx === -1 || idx < earliestIdx) {
              earliestIdx = idx;
              foundTarget = target;
            }
          }
        }
        
        if (earliestIdx === -1) {
          break; // No more targets found
        }
        
        // Find the matching close parenthesis for foundTarget
        let openCount = 1;
        let endIdx = -1;
        for (let i = earliestIdx + foundTarget.length; i < res.length; i++) {
          if (res[i] === "(") {
            openCount++;
          } else if (res[i] === ")") {
            openCount--;
            if (openCount === 0) {
              endIdx = i;
              break;
            }
          }
        }
        
        if (endIdx !== -1) {
          res = res.substring(0, earliestIdx) + "rgba(100, 100, 100, 0.8)" + res.substring(endIdx + 1);
        } else {
          res = res.substring(0, earliestIdx) + "rgba(100, 100, 100, 0.8)" + res.substring(earliestIdx + foundTarget.length);
        }
      }
      return res;
    };

    // Override window.getComputedStyle to intercept oklch/oklab/color-mix computed colors during screenshot
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = function (elt, pseudoElt) {
      const style = originalGetComputedStyle(elt, pseudoElt);
      return new Proxy(style, {
        get(target, prop, receiver) {
          if (prop === "getPropertyValue") {
            return function (propertyName: string) {
              const val = target.getPropertyValue(propertyName);
              if (typeof val === "string") {
                if (
                  val.includes("oklch") ||
                  val.includes("oklab") ||
                  val.includes("color-mix") ||
                  val.includes("light-dark")
                ) {
                  return sanitizeColorString(val);
                }
              }
              return val;
            };
          }
          
          // Safeguard native prototype getters to avoid Illegal invocation error on host object proxies
          try {
            let currentProto = Object.getPrototypeOf(target);
            while (currentProto) {
              const desc = Object.getOwnPropertyDescriptor(currentProto, prop);
              if (desc) {
                if (desc.get) {
                  // Bind getter 'this' to actual native element instead of the proxy
                  return desc.get.call(target);
                }
                if (desc.value !== undefined) {
                  const val = desc.value;
                  if (typeof val === "function") {
                    return val.bind(target);
                  }
                  return val;
                }
              }
              currentProto = Object.getPrototypeOf(currentProto);
            }
          } catch (protoErr) {
            // Ignore prototype lookup issues and fallback
          }

          const val = Reflect.get(target, prop);
          if (typeof val === "function") {
            return val.bind(target);
          }
          if (typeof val === "string") {
            if (
              val.includes("oklch") ||
              val.includes("oklab") ||
              val.includes("color-mix") ||
              val.includes("light-dark")
            ) {
              return sanitizeColorString(val);
            }
          }
          return val;
        }
      });
    };

    // Find the front of the card (.card-front) relative to this visualizer's canvasRef
    const parentContainer = canvasRef.current.closest(".slide-drawer-inner");
    const cardFront = parentContainer?.querySelector(".card-front") as HTMLElement | null;
    const targetElement = cardFront || canvasRef.current;

    let originalTransform = "";
    let originalTransition = "";

    if (cardFront) {
      originalTransform = cardFront.style.transform;
      originalTransition = cardFront.style.transition;
      
      // Temporarily override the transform with high !important priority to place it in active view for screenshotting
      cardFront.style.setProperty("transform", "translateY(0)", "important");
      cardFront.style.setProperty("transition", "none", "important");
    }

    // Temporarily sanitize style rules with oklch, oklab, and color-mix to prevent html2canvas crashing
    const restoredRules: { sheet: CSSStyleSheet; ruleText: string; index: number }[] = [];
    const cssStyleSheets = Array.from(document.styleSheets) as CSSStyleSheet[];
    
    for (const sheet of cssStyleSheets) {
      try {
        if (!sheet.cssRules) continue;
        // Go backwards to safely delete rules by index without affecting outer rules
        for (let j = sheet.cssRules.length - 1; j >= 0; j--) {
          const rule = sheet.cssRules[j];
          if (rule && rule.cssText) {
            const cssText = rule.cssText;
            if (
              cssText.includes("oklch") || 
              cssText.includes("oklab") || 
              cssText.includes("color-mix") ||
              cssText.includes("light-dark")
            ) {
              // Store original rule to restore after screenshot
              restoredRules.push({
                sheet,
                ruleText: cssText,
                index: j
              });
              
              // Remove the problematic rule
              sheet.deleteRule(j);
              
              // Rewrite rule to replace unsupported CSS Color 4 functions with safe RGB/RGBA fallback
              const sanitizedText = sanitizeColorString(cssText);
              
              try {
                sheet.insertRule(sanitizedText, j);
              } catch (insErr) {
                // If the rewritten version can't be inserted, leave it removed
              }
            }
          }
        }
      } catch (e) {
        // Ignore CORS-restricted stylesheets
      }
    }

    try {
      const canvas = await html2canvas(targetElement, {
        backgroundColor: "#16161a",
        scale: 2.5, // Ultra sharp high-res export
        logging: false,
        useCORS: true,
        allowTaint: true,
      });
      const link = document.createElement("a");
      link.download = `${stockName || "stock"}_card_front_${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error: any) {
      console.error("Export card front failed:", error);
      toast.error("截圖個股卡片正面失敗，請再試一次。");
    } finally {
      // Restore getComputedStyle
      window.getComputedStyle = originalGetComputedStyle;

      // Restore card front's original transforms
      if (cardFront) {
        if (originalTransform) {
          cardFront.style.setProperty("transform", originalTransform, "important");
        } else {
          cardFront.style.removeProperty("transform");
        }
        if (originalTransition) {
          cardFront.style.setProperty("transition", originalTransition, "important");
        } else {
          cardFront.style.removeProperty("transition");
        }
      }

      // Restore original rules in ascending index order so they align perfectly
      restoredRules.sort((a, b) => a.index - b.index);
      for (const item of restoredRules) {
        try {
          item.sheet.deleteRule(item.index);
          item.sheet.insertRule(item.ruleText, item.index);
        } catch (restoreErr) {
          console.warn("Failed to restore original CSS rule:", restoreErr);
        }
      }
    }
  };

  // 2. Export K-Line Chart (incorporating Volume, MA5, MA10, MA20, MACD, RSI indicators)
  const handleGenerateKLineChart = async () => {
    if (!stockName) return;
    try {
      // Fetch 6 months history from Yahoo Finance via proxy
      const res = await fetch(`/api/stock/${stockName}?range=6mo`);
      if (!res.ok) throw new Error("無法取得走勢數據，請檢查個股名稱或網路。");
      const data = await res.json();
      
      const result = data?.chart?.result?.[0];
      if (!result) throw new Error("走勢數據結構解析異常。");
      
      const timestamps = result.timestamp || [];
      const quote = result.indicators?.quote?.[0] || {};
      const opens = quote.open || [];
      const highs = quote.high || [];
      const lows = quote.low || [];
      const closes = quote.close || [];
      const volumes = quote.volume || [];
      
      const bars: StockBar[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (
          opens[i] !== null && opens[i] !== undefined &&
          highs[i] !== null && highs[i] !== undefined &&
          lows[i] !== null && lows[i] !== undefined &&
          closes[i] !== null && closes[i] !== undefined &&
          volumes[i] !== null && volumes[i] !== undefined
        ) {
          bars.push({
            time: timestamps[i],
            open: opens[i],
            high: highs[i],
            low: lows[i],
            close: closes[i],
            volume: volumes[i]
          });
        }
      }
      
      if (bars.length < 30) {
        throw new Error(`走勢 K 線數據不足以計算技術指標 (僅有 ${bars.length} 筆天數，至少需要 30 天)。`);
      }
      
      // Calculate indicators
      const ma5 = computeMA(bars, 5);
      const ma10 = computeMA(bars, 10);
      const ma20 = computeMA(bars, 20);
      const rsi14 = computeRSI(bars, 14);
      const macdResult = computeMACD(bars);
      
      // Canvas sizing parameters
      const width = 1200;
      const height = 950;
      
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("建置 Canvas Context2D 失敗。");
      
      // 1. Dark background (TradingView style `#131722`)
      ctx.fillStyle = "#131722";
      ctx.fillRect(0, 0, width, height);
      
      const displayCount = Math.min(65, bars.length);
      const startIndex = bars.length - displayCount;
      const endIndex = bars.length;
      
      const visibleBars = bars.slice(startIndex, endIndex);
      const visibleMa5 = ma5.slice(startIndex, endIndex);
      const visibleMa10 = ma10.slice(startIndex, endIndex);
      const visibleMa20 = ma20.slice(startIndex, endIndex);
      const visibleRsi = rsi14.slice(startIndex, endIndex);
      const visibleMacdDif = macdResult.dif.slice(startIndex, endIndex);
      const visibleMacdDea = macdResult.dea.slice(startIndex, endIndex);
      const visibleMacdHist = macdResult.histogram.slice(startIndex, endIndex);
      
      // Grid dimensions and partitions
      const headerHeight = 70;
      const mainChartTop = headerHeight;
      const mainChartHeight = 440;
      const mainChartBottom = mainChartTop + mainChartHeight; // 510
      
      const volChartTop = 525;
      const volChartHeight = 100;
      const volChartBottom = volChartTop + volChartHeight; // 625
      
      const macdChartTop = 640;
      const macdChartHeight = 110;
      const macdChartBottom = macdChartTop + macdChartHeight; // 750
      
      const rsiChartTop = 765;
      const rsiChartHeight = 110;
      const rsiChartBottom = rsiChartTop + rsiChartHeight; // 875
      
      const paddingLeft = 45;
      const paddingRight = 95;
      const activeWidth = width - paddingLeft - paddingRight; // 1060
      
      const getX = (idx: number) => {
        const step = activeWidth / (displayCount - 1);
        return paddingLeft + idx * step;
      };
      
      const drawGridLines = (top: number, bottom: number, count: number = 4) => {
        ctx.strokeStyle = "rgba(42, 46, 57, 0.4)";
        ctx.lineWidth = 1;
        const subHeight = bottom - top;
        for (let j = 0; j <= count; j++) {
          const y = top + (j * subHeight) / count;
          ctx.beginPath();
          ctx.moveTo(paddingLeft, y);
          ctx.lineTo(width - paddingRight, y);
          ctx.stroke();
        }
      };
      
      const drawVerticalGridLines = () => {
        ctx.strokeStyle = "rgba(42, 46, 57, 0.25)";
        ctx.lineWidth = 1;
        const interval = Math.max(1, Math.floor(displayCount / 8));
        for (let j = 0; j < displayCount; j += interval) {
          const x = getX(j);
          ctx.beginPath();
          ctx.moveTo(x, mainChartTop);
          ctx.lineTo(x, rsiChartBottom);
          ctx.stroke();
        }
      };
      
      drawVerticalGridLines();
      
      // ==========================================
      // DRAW CANVAS HEADER Text
      // ==========================================
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px 'Inter', sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`${stockName} / Daily`, paddingLeft, 35);
      
      const lastBar = visibleBars[visibleBars.length - 1];
      const prevBar = visibleBars[visibleBars.length - 2] || lastBar;
      const priceDiff = lastBar.close - prevBar.close;
      const pctDiff = (priceDiff / prevBar.close) * 100;
      const changeText = `${priceDiff >= 0 ? "+" : ""}${priceDiff.toFixed(2)} (${priceDiff >= 0 ? "+" : ""}${pctDiff.toFixed(2)}%)`;
      const changeColor = priceDiff >= 0 ? "#26a69a" : "#ef5350";
      
      ctx.font = "bold 18px 'Inter', sans-serif";
      ctx.fillStyle = changeColor;
      ctx.fillText(`$${lastBar.close.toFixed(2)}`, paddingLeft + 150, 35);
      
      ctx.font = "13px 'Inter', sans-serif";
      ctx.fillText(changeText, paddingLeft + 300, 35);
      
      ctx.font = "12px 'Inter', sans-serif";
      ctx.fillStyle = "#ffb119";
      ctx.fillText("MA(5)", paddingLeft + 520, 35);
      ctx.fillStyle = "#965cf4";
      ctx.fillText("MA(10)", paddingLeft + 575, 35);
      ctx.fillStyle = "#13c2c2";
      ctx.fillText("MA(20)", paddingLeft + 635, 35);
      ctx.fillStyle = "#9e9eb4";
      ctx.fillText("Volume", paddingLeft + 695, 35);
      ctx.fillStyle = "#2962ff";
      ctx.fillText("MACD(12,26,9)", paddingLeft + 760, 35);
      ctx.fillStyle = "#c299ff";
      ctx.fillText("RSI(14)", paddingLeft + 870, 35);
      
      const formatBarDate = (timestamp: number) => {
        const d = new Date(timestamp * 1000);
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
      };
      
      ctx.fillStyle = "rgba(158, 158, 180, 0.6)";
      ctx.font = "12px 'Inter', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(
        `${formatBarDate(visibleBars[0].time)} - ${formatBarDate(lastBar.time)}`,
        width - paddingRight,
        35
      );
      
      // ==========================================
      // DRAW MAIN PRICE CHART (Candlesticks & MA)
      // ==========================================
      drawGridLines(mainChartTop, mainChartBottom, 5);
      
      let maxP = -Infinity;
      let minP = Infinity;
      for (let j = 0; j < displayCount; j++) {
        const b = visibleBars[j];
        if (b.high > maxP) maxP = b.high;
        if (b.low < minP) minP = b.low;
        
        const m5 = visibleMa5[j];
        if (m5 !== null && m5 !== undefined) {
          if (m5 > maxP) maxP = m5;
          if (m5 < minP) minP = m5;
        }
        
        const m10 = visibleMa10[j];
        if (m10 !== null && m10 !== undefined) {
          if (m10 > maxP) maxP = m10;
          if (m10 < minP) minP = m10;
        }
        
        const m20 = visibleMa20[j];
        if (m20 !== null && m20 !== undefined) {
          if (m20 > maxP) maxP = m20;
          if (m20 < minP) minP = m20;
        }
      }
      
      const priceRange = maxP - minP;
      const priceBuffer = priceRange * 0.05 || 1.0;
      const scaleMaxPrice = maxP + priceBuffer;
      const scaleMinPrice = Math.max(0, minP - priceBuffer);
      
      const getPriceY = (price: number) => {
        return mainChartBottom - ((price - scaleMinPrice) / (scaleMaxPrice - scaleMinPrice)) * mainChartHeight;
      };
      
      const barWidthRatio = 0.65;
      const maxBarWidth = activeWidth / (displayCount - 1);
      const candleWidth = maxBarWidth * barWidthRatio;
      
      for (let j = 0; j < displayCount; j++) {
        const b = visibleBars[j];
        const x = getX(j);
        
        const isUp = b.close >= b.open;
        const color = isUp ? "#26a69a" : "#ef5350";
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.moveTo(x, getPriceY(b.high));
        ctx.lineTo(x, getPriceY(b.low));
        ctx.stroke();
        
        ctx.fillStyle = color;
        const bodyY = getPriceY(Math.max(b.open, b.close));
        const bodyH = Math.max(1, Math.abs(getPriceY(b.open) - getPriceY(b.close)));
        ctx.fillRect(x - candleWidth / 2, bodyY, candleWidth, bodyH);
      }
      
      const drawMALine = (maArray: (number | null)[], color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        let started = false;
        for (let j = 0; j < displayCount; j++) {
          const val = maArray[j];
          if (val !== null && val !== undefined) {
            const x = getX(j);
            const y = getPriceY(val);
            if (!started) {
              ctx.moveTo(x, y);
              started = true;
            } else {
              ctx.lineTo(x, y);
            }
          }
        }
        ctx.stroke();
      };
      
      drawMALine(visibleMa5, "#ffb119");
      drawMALine(visibleMa10, "#965cf4");
      drawMALine(visibleMa20, "#13c2c2");
      
      ctx.fillStyle = "rgba(158, 158, 180, 0.7)";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = "11px 'Inter', sans-serif";
      
      for (let j = 0; j <= 5; j++) {
        const priceVal = scaleMinPrice + (j / 5) * (scaleMaxPrice - scaleMinPrice);
        const y = getPriceY(priceVal);
        ctx.fillText(`$${priceVal.toFixed(2)}`, width - paddingRight + 10, y);
      }
      
      // ==========================================
      // DRAW VOLUME CHART
      // ==========================================
      drawGridLines(volChartTop, volChartBottom, 2);
      
      let maxVol = 0;
      for (let j = 0; j < displayCount; j++) {
        if (visibleBars[j].volume > maxVol) maxVol = visibleBars[j].volume;
      }
      maxVol = maxVol || 100000;
      
      const getVolY = (vol: number) => {
        return volChartBottom - (vol / maxVol) * volChartHeight;
      };
      
      for (let j = 0; j < displayCount; j++) {
        const b = visibleBars[j];
        const x = getX(j);
        const isUp = b.close >= b.open;
        ctx.fillStyle = isUp ? "rgba(38, 166, 154, 0.45)" : "rgba(239, 83, 80, 0.45)";
        
        const y = getVolY(b.volume);
        const h = Math.max(1, volChartBottom - y);
        ctx.fillRect(x - candleWidth / 2, y, candleWidth, h);
      }
      
      ctx.fillStyle = "rgba(158, 158, 180, 0.7)";
      ctx.font = "10px 'Inter', sans-serif";
      ctx.fillText(`${(maxVol / 1000).toFixed(0)}K`, width - paddingRight + 10, volChartTop);
      ctx.fillText("0", width - paddingRight + 10, volChartBottom);
      
      // ==========================================
      // DRAW MACD CHART
      // ==========================================
      drawGridLines(macdChartTop, macdChartBottom, 2);
      
      let maxM = -Infinity;
      let minM = Infinity;
      for (let j = 0; j < displayCount; j++) {
        const d = visibleMacdDif[j];
        const de = visibleMacdDea[j];
        const hi = visibleMacdHist[j];
        
        [d, de, hi].forEach(val => {
          if (val !== null && val !== undefined) {
            if (val > maxM) maxM = val;
            if (val < minM) minM = val;
          }
        });
      }
      
      const macdBound = Math.max(Math.abs(maxM), Math.abs(minM)) || 1.0;
      const getMacdY = (val: number) => {
        const center = macdChartTop + macdChartHeight / 2;
        return center - (val / macdBound) * (macdChartHeight / 2);
      };
      
      ctx.strokeStyle = "rgba(158, 158, 180, 0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, getMacdY(0));
      ctx.lineTo(width - paddingRight, getMacdY(0));
      ctx.stroke();
      
      for (let j = 0; j < displayCount; j++) {
        const hist = visibleMacdHist[j];
        if (hist !== null && hist !== undefined) {
          const x = getX(j);
          const y = getMacdY(hist);
          const y0 = getMacdY(0);
          
          const isPositive = hist > 0;
          const color = isPositive ? "rgba(38, 166, 154, 0.7)" : "rgba(239, 83, 80, 0.7)";
          
          ctx.fillStyle = color;
          ctx.fillRect(x - candleWidth / 3, Math.min(y, y0), candleWidth * 0.67, Math.max(1, Math.abs(y0 - y)));
        }
      }
      
      ctx.strokeStyle = "#2962ff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let macdStarted = false;
      for (let j = 0; j < displayCount; j++) {
        const val = visibleMacdDif[j];
        if (val !== null && val !== undefined) {
          const x = getX(j);
          const y = getMacdY(val);
          if (!macdStarted) {
            ctx.moveTo(x, y);
            macdStarted = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
      
      ctx.strokeStyle = "#ef6d00";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      macdStarted = false;
      for (let j = 0; j < displayCount; j++) {
        const val = visibleMacdDea[j];
        if (val !== null && val !== undefined) {
          const x = getX(j);
          const y = getMacdY(val);
          if (!macdStarted) {
            ctx.moveTo(x, y);
            macdStarted = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
      
      ctx.fillStyle = "rgba(158, 158, 180, 0.7)";
      ctx.font = "10px 'Inter', sans-serif";
      ctx.fillText(`+${macdBound.toFixed(2)}`, width - paddingRight + 10, macdChartTop);
      ctx.fillText("0.00", width - paddingRight + 10, getMacdY(0));
      ctx.fillText(`-${macdBound.toFixed(2)}`, width - paddingRight + 10, macdChartBottom);
      
      // ==========================================
      // DRAW RSI CHART
      // ==========================================
      const getRsiY = (rsiVal: number) => {
        return rsiChartBottom - (rsiVal / 100) * rsiChartHeight;
      };
      
      const rsi30y = getRsiY(30);
      const rsi70y = getRsiY(70);
      ctx.fillStyle = "rgba(124, 58, 237, 0.05)";
      ctx.fillRect(paddingLeft, rsi70y, activeWidth, rsi30y - rsi70y);
      
      ctx.strokeStyle = "rgba(124, 58, 237, 0.25)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      
      [30, 50, 70].forEach(level => {
        ctx.beginPath();
        ctx.moveTo(paddingLeft, getRsiY(level));
        ctx.lineTo(width - paddingRight, getRsiY(level));
        ctx.stroke();
      });
      ctx.setLineDash([]);
      
      ctx.strokeStyle = "#c299ff";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      let rsiStarted = false;
      for (let j = 0; j < displayCount; j++) {
        const val = visibleRsi[j];
        if (val !== null && val !== undefined) {
          const x = getX(j);
          const y = getRsiY(val);
          if (!rsiStarted) {
            ctx.moveTo(x, y);
            rsiStarted = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
      
      ctx.fillStyle = "rgba(158, 158, 180, 0.7)";
      ctx.font = "10px 'Inter', sans-serif";
      ctx.fillText("70", width - paddingRight + 10, rsi70y);
      ctx.fillText("50", width - paddingRight + 10, getRsiY(50));
      ctx.fillText("30", width - paddingRight + 10, rsi30y);
      
      // ==========================================
      // DRAW DATES X-AXIS LABELS
      // ==========================================
      ctx.strokeStyle = "rgba(42, 46, 57, 0.3)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, rsiChartBottom);
      ctx.lineTo(width - paddingRight, rsiChartBottom);
      ctx.stroke();
      
      ctx.fillStyle = "rgba(158, 158, 180, 0.6)";
      ctx.font = "11px 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      
      const dateInterval = Math.max(1, Math.floor(displayCount / 6));
      for (let j = 0; j < displayCount; j += dateInterval) {
        const x = getX(j);
        const b = visibleBars[j];
        const d = new Date(b.time * 1000);
        const labelStr = `${d.getMonth() + 1}/${d.getDate()}`;
        ctx.fillText(labelStr, x, rsiChartBottom + 10);
      }
      
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(158, 158, 180, 0.25)";
      ctx.font = "italic bold 11px 'Inter', sans-serif";
      ctx.fillText("TradingView Premium Auto-Generated Chart", width - 20, height - 20);
      
      const link = document.createElement("a");
      link.download = `${stockName}_kline_indicators_${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      
    } catch (error: any) {
      console.error("Generate historical chart failed:", error);
      toast.error(`繪製 K 線指標圖敗：${error.message || error}`);
    }
  };

  // Drag move state/refs
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartCoords = useRef<{ x: number; y: number } | null>(null);
  const dragInitialAnn = useRef<ChartAnnotation | null>(null);

  const onUpdateAnnotationsRef = useRef(onUpdateAnnotations);
  React.useEffect(() => {
    onUpdateAnnotationsRef.current = onUpdateAnnotations;
  }, [onUpdateAnnotations]);

  const canvasRef = useRef<HTMLDivElement>(null);

  const getRelativeCoords = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    const rawX = ((clientX - rect.left) / rect.width) * 100;
    const rawY = ((clientY - rect.top) / rect.height) * 100;
    const x = Number.isFinite(rawX) ? Math.max(0, Math.min(100, rawX)) : 0;
    const y = Number.isFinite(rawY) ? Math.max(0, Math.min(100, rawY)) : 0;
    return { x, y };
  };

  const handleDragStart = (ann: ChartAnnotation, clientX: number, clientY: number) => {
    // 1. Push current states to undo history before starting the drag
    setHistory((prev) => [...prev, localAnnotationsRef.current]);

    // 2. Set coordinate offsets
    const coords = getRelativeCoords(clientX, clientY);
    dragStartCoords.current = coords;
    dragInitialAnn.current = ann;
    draggingIdRef.current = ann.id;
    setDraggingId(ann.id);
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!draggingId || !dragStartCoords.current || !dragInitialAnn.current) return;
    const currCoords = getRelativeCoords(clientX, clientY);
    const dx = currCoords.x - dragStartCoords.current.x;
    const dy = currCoords.y - dragStartCoords.current.y;

    const nextAnns = localAnnotationsRef.current.map((ann) => {
      if (ann.id !== draggingId) return ann;
      const initial = dragInitialAnn.current!;
      if (initial.type === 'text' || initial.type === 'box') {
        return {
          ...ann,
          x: Math.max(0, Math.min(100, (initial.x ?? 0) + dx)),
          y: Math.max(0, Math.min(100, (initial.y ?? 0) + dy)),
        };
      } else if (initial.type === 'divider') {
        const newY = Math.max(0, Math.min(100, (initial.y ?? initial.y1 ?? 0) + dy));
        const roundedY = Math.round(newY * 100) / 100;
        return {
          ...ann,
          y: roundedY,
          y1: roundedY,
          y2: roundedY,
          x1: 0,
          x2: 100,
        };
      } else if (initial.type === 'line' || initial.type === 'arrow') {
        return {
          ...ann,
          x1: Math.max(0, Math.min(100, (initial.x1 ?? 0) + dx)),
          y1: Math.max(0, Math.min(100, (initial.y1 ?? 0) + dy)),
          x2: Math.max(0, Math.min(100, (initial.x2 ?? 0) + dx)),
          y2: Math.max(0, Math.min(100, (initial.y2 ?? 0) + dy)),
        };
      }
      return ann;
    });

    setLocalAnnotations(nextAnns);
    localAnnotationsRef.current = nextAnns;
  };

  const handleDragEnd = () => {
    if (draggingId) {
      onUpdateAnnotationsRef.current?.(localAnnotationsRef.current);
    }
    draggingIdRef.current = null;
    setDraggingId(null);
    dragStartCoords.current = null;
    dragInitialAnn.current = null;
  };

  React.useEffect(() => {
    if (!draggingId) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY);
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      if (e.cancelable) e.preventDefault();
      handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handleWindowMouseUp = () => {
      handleDragEnd();
    };

    const handleWindowTouchEnd = () => {
      handleDragEnd();
    };

    window.addEventListener('mousemove', handleWindowMouseMove, { passive: false });
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
    window.addEventListener('touchend', handleWindowTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
    };
  }, [draggingId]);

  const cycleThickness = () => {
    setActiveThickness((prev) => {
      const thicknesses = [2, 4, 6, 8, 10];
      const idx = thicknesses.indexOf(prev);
      if (idx === -1) return 8;
      return thicknesses[(idx + 1) % thicknesses.length];
    });
  };

  const isPointNearAnnotation = (coords: { x: number; y: number }, ann: ChartAnnotation): boolean => {
    if (ann.type === 'divider') {
      const dy = Math.abs(coords.y - (ann.y ?? ann.y1 ?? 0));
      return dy <= 4.0;
    }
    if (ann.type === 'line' || ann.type === 'arrow') {
      const x1 = ann.x1 ?? 0;
      const y1 = ann.y1 ?? 0;
      const x2 = ann.x2 ?? 0;
      const y2 = ann.y2 ?? 0;
      const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
      if (l2 === 0) {
        return Math.hypot(coords.x - x1, coords.y - y1) <= 5.0;
      }
      let t = ((coords.x - x1) * (x2 - x1) + (coords.y - y1) * (y2 - y1)) / l2;
      t = Math.max(0, Math.min(1, t));
      const projX = x1 + t * (x2 - x1);
      const projY = y1 + t * (y2 - y1);
      return Math.hypot(coords.x - projX, coords.y - projY) <= 5.0;
    }
    if (ann.type === 'box') {
      const bx = ann.x ?? 0;
      const by = ann.y ?? 0;
      const bw = ann.width ?? 0;
      const bh = ann.height ?? 0;
      const minX = Math.min(bx, bx + bw) - 3.5;
      const maxX = Math.max(bx, bx + bw) + 3.5;
      const minY = Math.min(by, by + bh) - 3.5;
      const maxY = Math.max(by, by + bh) + 3.5;
      return coords.x >= minX && coords.x <= maxX && coords.y >= minY && coords.y <= maxY;
    }
    if (ann.type === 'text') {
      const tx = ann.x ?? 0;
      const ty = ann.y ?? 0;
      return Math.hypot(coords.x - tx, coords.y - ty) <= 7.0;
    }
    return false;
  };

  const eraseAnnotationsAt = (coords: { x: number; y: number }, isContinuous = false) => {
    const currentList = localAnnotationsRef.current;
    if (!currentList || currentList.length === 0) return false;
    const remaining = currentList.filter(ann => !isPointNearAnnotation(coords, ann));
    if (remaining.length !== currentList.length) {
      pushToHistoryAndSave(remaining, !isContinuous);
      return true;
    }
    return false;
  };

  const handleClearAll = () => {
    if (!localAnnotationsRef.current || localAnnotationsRef.current.length === 0) {
      toast("目前尚無任何繪圖標記", { icon: 'ℹ️' });
      return;
    }
    pushToHistoryAndSave([], true);
    toast.success("已一鍵刪除所有繪圖標記 (可點選上一步還原)");
  };

  const handleDeleteAnnotation = (idToDelete: string) => {
    pushToHistoryAndSave(localAnnotationsRef.current.filter((ann) => ann.id !== idToDelete), true);
    toast.success("已刪除該繪圖標記", { duration: 1200 });
  };

  const getCenterCoords = (ann: ChartAnnotation) => {
    if (ann.type === 'divider') {
      return {
        x: 50,
        y: ann.y ?? ann.y1 ?? 0,
      };
    }
    if (ann.type === 'line' || ann.type === 'arrow') {
      return {
        x: ((ann.x1 ?? 0) + (ann.x2 ?? 0)) / 2,
        y: ((ann.y1 ?? 0) + (ann.y2 ?? 0)) / 2,
      };
    }
    if (ann.type === 'box') {
      return {
        x: (ann.x ?? 0) + (ann.width ?? 0) / 2,
        y: (ann.y ?? 0) + (ann.height ?? 0) / 2,
      };
    }
    return {
      x: ann.x ?? 0,
      y: ann.y ?? 0,
    };
  };

  const handleTextSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (inputText.trim() && inputCoords) {
      const newAnn: ChartAnnotation = {
        id: `ann-text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'text',
        color: activeColorRef.current,
        strokeWidth: activeThicknessRef.current,
        fontSize: activeFontSizeRef.current,
        x: inputCoords.x,
        y: inputCoords.y,
        text: inputText,
      };
      pushToHistoryAndSave([...localAnnotationsRef.current, newAnn], true);
    }
    setInputCoords(null);
    setInputText('');
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Avoid double trigger on hybrid touch devices that fire simulated mouse events
    if (Date.now() - lastTouchTimeRef.current < 500) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    const coords = getRelativeCoords(e.clientX, e.clientY);
    const currentMode = modeRef.current;

    if (currentMode === 'eraser') {
      isErasingRef.current = true;
      setEraserHoverPoint(coords);
      eraseAnnotationsAt(coords, false);
    } else if (currentMode === 'divider') {
      const fixedY = Math.max(0, Math.min(100, Math.round(coords.y * 100) / 100));
      const newId = `div-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      activeNewDividerIdRef.current = null;
      const newAnn: ChartAnnotation = {
        id: newId,
        type: 'divider',
        color: activeColorRef.current,
        strokeWidth: activeThicknessRef.current,
        x1: 0,
        x2: 100,
        y1: fixedY,
        y2: fixedY,
        y: fixedY,
      };
      pushToHistoryAndSave([...localAnnotationsRef.current, newAnn], true);
      toast.success("已新增水平分隔線，位置已固定 (如需移動請切換至「拖曳」模式)", { duration: 1500 });
      setMode('cursor');
      modeRef.current = 'cursor';
      setHoverPoint(null);
    } else if (currentMode === 'text') {
      setInputCoords(coords);
      setInputText('');
    } else if (currentMode === 'line' || currentMode === 'box' || currentMode === 'arrow') {
      setIsDrawing(true);
      isDrawingRef.current = true;
      setStartPoint(coords);
      startPointRef.current = coords;
      setActivePoint(coords);
      activePointRef.current = coords;
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const coords = getRelativeCoords(e.clientX, e.clientY);
    const currentMode = modeRef.current;

    if (currentMode === 'eraser') {
      setEraserHoverPoint(coords);
      if (isErasingRef.current) {
        eraseAnnotationsAt(coords, true);
      }
    } else if (currentMode === 'divider') {
      setHoverPoint(coords);
    }

    if (!isDrawingRef.current || !startPointRef.current) return;
    setActivePoint(coords);
    activePointRef.current = coords;
  };

  const finishDrawing = () => {
    if (activeNewDividerIdRef.current) {
      activeNewDividerIdRef.current = null;
    }

    if (!isDrawingRef.current || !startPointRef.current || !activePointRef.current) {
      setIsDrawing(false);
      isDrawingRef.current = false;
      setStartPoint(null);
      startPointRef.current = null;
      setActivePoint(null);
      activePointRef.current = null;
      return;
    }

    const currentMode = modeRef.current;
    const sp = startPointRef.current;
    const ap = activePointRef.current;
    const color = activeColorRef.current;
    const thickness = activeThicknessRef.current;

    setIsDrawing(false);
    isDrawingRef.current = false;

    const dx = Math.abs(ap.x - sp.x);
    const dy = Math.abs(ap.y - sp.y);
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
      let newAnn: ChartAnnotation | null = null;
      if (currentMode === 'line') {
        newAnn = {
          id: `ann-line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: 'line',
          color,
          strokeWidth: thickness,
          x1: sp.x,
          y1: sp.y,
          x2: ap.x,
          y2: ap.y,
        };
      } else if (currentMode === 'arrow') {
        newAnn = {
          id: `ann-arrow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: 'arrow',
          color,
          strokeWidth: thickness,
          x1: sp.x,
          y1: sp.y,
          x2: ap.x,
          y2: ap.y,
        };
      } else if (currentMode === 'box') {
        newAnn = {
          id: `ann-box-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: 'box',
          color,
          strokeWidth: thickness,
          x: Math.min(sp.x, ap.x),
          y: Math.min(sp.y, ap.y),
          width: Math.abs(ap.x - sp.x),
          height: Math.abs(ap.y - sp.y),
        };
      }
      if (newAnn) {
        pushToHistoryAndSave([...localAnnotationsRef.current, newAnn], true);
      }
    }

    setStartPoint(null);
    startPointRef.current = null;
    setActivePoint(null);
    activePointRef.current = null;
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (modeRef.current === 'eraser') {
      isErasingRef.current = false;
      flushPendingSave();
    }
    finishDrawing();
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    lastTouchTimeRef.current = Date.now();
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const coords = getRelativeCoords(touch.clientX, touch.clientY);
    const currentMode = modeRef.current;

    if (currentMode === 'eraser') {
      isErasingRef.current = true;
      setEraserHoverPoint(coords);
      eraseAnnotationsAt(coords, false);
    } else if (currentMode === 'divider') {
      const fixedY = Math.max(0, Math.min(100, Math.round(coords.y * 100) / 100));
      const newId = `div-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      activeNewDividerIdRef.current = null;
      const newAnn: ChartAnnotation = {
        id: newId,
        type: 'divider',
        color: activeColorRef.current,
        strokeWidth: activeThicknessRef.current,
        x1: 0,
        x2: 100,
        y1: fixedY,
        y2: fixedY,
        y: fixedY,
      };
      pushToHistoryAndSave([...localAnnotationsRef.current, newAnn], true);
      toast.success("已新增水平分隔線，位置已固定 (如需移動請切換至「拖曳」模式)", { duration: 1500 });
      setMode('cursor');
      modeRef.current = 'cursor';
      setHoverPoint(null);
    } else if (currentMode === 'text') {
      setInputCoords(coords);
      setInputText('');
    } else if (currentMode === 'line' || currentMode === 'box' || currentMode === 'arrow') {
      setIsDrawing(true);
      isDrawingRef.current = true;
      setStartPoint(coords);
      startPointRef.current = coords;
      setActivePoint(coords);
      activePointRef.current = coords;
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const coords = getRelativeCoords(touch.clientX, touch.clientY);
    const currentMode = modeRef.current;

    if (currentMode === 'eraser') {
      setEraserHoverPoint(coords);
      if (isErasingRef.current) {
        eraseAnnotationsAt(coords, true);
      }
    } else if (currentMode === 'divider') {
      setHoverPoint(coords);
    }

    if (!isDrawingRef.current || !startPointRef.current) return;
    setActivePoint(coords);
    activePointRef.current = coords;
  };

  const handleCanvasTouchEnd = (e?: React.TouchEvent<HTMLDivElement>) => {
    if (e) {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
    }
    if (modeRef.current === 'eraser') {
      isErasingRef.current = false;
      flushPendingSave();
    }
    finishDrawing();
  };

  React.useEffect(() => {
    if (!isDrawing && mode !== 'eraser') return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (modeRef.current === 'eraser') {
        if (isErasingRef.current) {
          const coords = getRelativeCoords(e.clientX, e.clientY);
          setEraserHoverPoint(coords);
          eraseAnnotationsAt(coords, true);
        }
        return;
      }
      if (!startPointRef.current) return;
      const coords = getRelativeCoords(e.clientX, e.clientY);
      setActivePoint(coords);
      activePointRef.current = coords;
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const touch = e.touches[0];
      const coords = getRelativeCoords(touch.clientX, touch.clientY);
      if (modeRef.current === 'eraser') {
        if (isErasingRef.current) {
          if (e.cancelable) e.preventDefault();
          setEraserHoverPoint(coords);
          eraseAnnotationsAt(coords, true);
        }
        return;
      }
      if (!startPointRef.current) return;
      if (e.cancelable) e.preventDefault();
      setActivePoint(coords);
      activePointRef.current = coords;
    };

    const handleWindowMouseUp = () => {
      if (modeRef.current === 'eraser') {
        isErasingRef.current = false;
        flushPendingSave();
      }
      finishDrawing();
    };

    const handleWindowTouchEnd = () => {
      if (modeRef.current === 'eraser') {
        isErasingRef.current = false;
        flushPendingSave();
      }
      finishDrawing();
    };

    window.addEventListener('mousemove', handleWindowMouseMove, { passive: false });
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
    window.addEventListener('touchend', handleWindowTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
    };
  }, [isDrawing, mode]);

  const data = useMemo(() => {
    const validOrders = plannedOrders
      .map((order) => {
        const fullText =
          `${order.notes || ""} ${order.conditions || ""}`.trim();
        let category = order.category || "其他";

        if (
          category === "其他" ||
          !order.category ||
          category === "關鍵價格門檻"
        ) {
          if (fullText.includes("[支撐") || fullText.includes("支撐門檻"))
            category = "支撐門檻";
          else if (fullText.includes("[壓力") || fullText.includes("壓力門檻"))
            category = "壓力門檻";
          else if (fullText.includes("止損設定") || fullText.includes("[止損"))
            category = "止損設定";
          else if (fullText.includes("止盈設定") || fullText.includes("[止盈"))
            category = "止盈設定";
          else if (
            fullText.includes("分批進出場") ||
            fullText.includes("[分批")
          )
            category = "分批進出場規劃";
          // Fallbacks
          else if (fullText.includes("支撐")) category = "支撐門檻";
          else if (fullText.includes("壓力")) category = "壓力門檻";
          else if (fullText.includes("止損")) category = "止損設定";
          else if (fullText.includes("止盈")) category = "止盈設定";
          else if (fullText.includes("分批")) category = "分批進出場規劃";
        }
        return { ...order, category };
      })
      .filter((o) => !isNaN(o.price) && o.price > 0);

    const supports = validOrders.filter((o) => o.category?.includes("支撐"));
    const resistances = validOrders.filter((o) => o.category?.includes("壓力"));
    const tps = validOrders
      .filter((o) => o.category?.includes("止盈"))
      .sort((a, b) => a.price - b.price);
    const sls = validOrders
      .filter((o) => o.category?.includes("止損"))
      .sort((a, b) => b.price - a.price);
    const entries = validOrders
      .filter((o) => o.category?.includes("進出"))
      .sort((a, b) => a.price - b.price);

    // 提取系統二 股價向下攤平試算 組別 1~4 的預計購入股價 (持有數量 > 0 時)
    const validAvgSys2Items: any[] = [];
    const avgSys2Prices: number[] = [];
    const hasHoldings = (holdingQuantity !== undefined ? holdingQuantity > 0 : (averageCostQuantity !== undefined && averageCostQuantity > 0));
    const totalBought = holdingQuantity !== undefined ? holdingQuantity : (averageCostQuantity || 0);

    if (hasHoldings && averagingRowsSys2 && averagingRowsSys2.length > 0) {
      const batchPlannedSizes: number[] = [0, 1, 2, 3].map(i => {
        const row = averagingRowsSys2[i];
        const q1 = parseFloat(row?.quantity || '') || 0;
        const q2 = parseFloat(row?.quantity2 || '') || 0;
        if (q1 + q2 > 0) return q1 + q2;
        if (plannedBuyQty && plannedBuyQty > 0) {
          const pcts = [0.15, 0.25, 0.35, 0.25];
          return Math.ceil(plannedBuyQty * pcts[i]);
        }
        return 0;
      });

      averagingRowsSys2.slice(0, 4).forEach((row, idx) => {
        const parsedPrice = parseFloat(row.price);
        if (!isNaN(parsedPrice) && parsedPrice > 0) {
          avgSys2Prices.push(parsedPrice);
          const discountPct = (idx + 1) * 3; // -3%, -6%, -9%, -12%
          const isBasePosition = discountPct === 6; // 系統二第 2 欄位 6% 為基準倉位
          const isForceClosePosition = discountPct === 12; // 系統二第 4 欄位 12% 為強制平倉
          const isSpecialPosition = isBasePosition || isForceClosePosition;
          const formattedPrice = parsedPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          
          const rowPlannedQty = batchPlannedSizes[idx];
          const priorBatchesSum = batchPlannedSizes.slice(0, idx).reduce((a, b) => a + b, 0);
          const rowBoughtQty = rowPlannedQty > 0 ? Math.max(0, Math.min(rowPlannedQty, totalBought - priorBatchesSum)) : 0;

          let noteText = "";
          if (isBasePosition) {
            noteText = " (基準倉位)";
          } else if (isForceClosePosition) {
            noteText = " (強制平倉)";
          }

          let qtyText = "";
          if (rowPlannedQty > 0 || rowBoughtQty > 0) {
            qtyText = ` (預計 ${rowPlannedQty}股 · 已購 ${rowBoughtQty}股)`;
          }

          validAvgSys2Items.push({
            id: `avg2-${idx + 1}`,
            price: parsedPrice,
            text: `攤平#${idx + 1} $${formattedPrice} (-${discountPct}%)${noteText}${qtyText}`,
            color: isSpecialPosition ? "#F7554D" : "#3b82f6",
            isBold: true,
            isAlert: false,
            isAveragingSys2: true,
            isBasePosition,
            isForceClosePosition,
            isSpecialPosition,
            isClosePosition: isBasePosition,
            groupIndex: idx + 1,
            discountPct,
            isFixed: false,
            plannedQty: rowPlannedQty,
            boughtQty: rowBoughtQty,
          });
        }
      });
    }

    const allPrices = [
      dynamicPrice,
      ...(averageCost && averageCost > 0 ? [averageCost] : []),
      ...validOrders.map((o) => o.price),
      ...avgSys2Prices,
    ].filter((p) => typeof p === "number" && !isNaN(p) && p > 0);

    if (allPrices.length === 0) return null;

    const uniqueSortedPrices = Array.from(new Set(allPrices)).sort((a, b) => a - b);

    const topY = 7;
    const bottomY = 93;

    const getYPct = (p: number) => {
      if (uniqueSortedPrices.length <= 1) return 50;
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

    const isAlert = (p: number) => {
      return false;
    };

    const leftItems = [
      ...supports.map((s, i) => ({
        id: `s-${i}`,
        text: `支撐 $${s.price}`,
        price: s.price,
        rawY: getYPct(s.price),
        color: "#facc15",
        isAlert: isAlert(s.price),
        data: s,
      })),
    ].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));

    const slItems = sls.map((sl, i) => ({
      id: `sl-${i}`,
      text: `止損 $${sl.price}`,
      price: sl.price,
      rawY: getYPct(sl.price),
      color: "#ef4444",
      isAlert: isAlert(sl.price),
      data: sl,
    })).sort((a, b) => (b.price ?? 0) - (a.price ?? 0));

    const rightItemsRaw = [
      ...(dynamicPrice > 0 || isCardLoading
        ? [
            {
              id: "cp",
              price: dynamicPrice > 0 ? dynamicPrice : uniqueSortedPrices[Math.floor(uniqueSortedPrices.length / 2)],
              text: isCardLoading ? "Loading..." : `現價 $${dynamicPrice}`,
              rawY: getYPct(dynamicPrice > 0 ? dynamicPrice : uniqueSortedPrices[Math.floor(uniqueSortedPrices.length / 2)]),
              color: "#c084fc",
              isBold: true,
              isAlert: false,
              isCurrentPrice: true,
              isFixed: true,
            },
          ]
        : []),
      ...(averageCost && averageCost > 0
        ? [
            {
              id: "ac",
              price: averageCost,
              text: `均本 $${averageCost.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}${((averageCostQuantity && averageCostQuantity !== 0) || (holdingQuantity && holdingQuantity > 0)) ? ` (${Math.abs(averageCostQuantity || holdingQuantity || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}股)` : ""}`,
              rawY: getYPct(averageCost),
              color: "#f97316",
              isBold: true,
              isAlert: false,
              isAverageCost: true,
              isFixed: false,
            },
          ]
        : []),
      ...validAvgSys2Items.map((item) => ({
        ...item,
        rawY: getYPct(item.price),
      })),
    ];

    // 右側所有標籤無論種類，一律依照數字 (價格) 從大排到小
    const rightItems = rightItemsRaw.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));

    // 取消顯示進場價格標籤
    const entryItems: any[] = [];

    const tpItems = [
      ...tps.map((tp, i) => ({
        id: `tp-${i}`,
        text: `止盈 $${tp.price}`,
        price: tp.price,
        rawY: getYPct(tp.price),
        color: "#10b981",
        isAlert: isAlert(tp.price),
        data: tp,
      })),
      ...resistances.map((r, i) => ({
        id: `r-${i}`,
        text: `壓力 $${r.price}`,
        price: r.price,
        rawY: getYPct(r.price),
        color: "#f87171",
        isAlert: isAlert(r.price),
        data: r,
      })),
    ].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));

    const leftLabels = resolveCollisions(leftItems, 4.8);
    const slLabels = resolveCollisions(slItems, 4.8);
    const entryLabels = resolveCollisions(entryItems, 4.8);
    const tpLabels = resolveCollisions(tpItems, 5.0);
    const rightLabels = resolveCollisions(rightItems, 5.0);

    return {
      supports,
      resistances,
      tps,
      sls,
      entries,
      getYPct,
      leftLabels,
      rightLabels,
      entryLabels,
      slLabels,
      tpLabels,
    };
  }, [plannedOrders, dynamicPrice, averageCost, averageCostQuantity, averagingRows, averagingRowsSys2, plannedBuyQty, holdingQuantity]);

  if (!data)
    return (
      <div className="text-zinc-500 font-medium text-[10.5px] flex items-center justify-center h-full">
        無目標價設定資料
      </div>
    );

  const {
    supports,
    resistances,
    tps,
    sls,
    entries,
    getYPct,
    leftLabels,
    rightLabels,
    entryLabels,
    slLabels,
    tpLabels,
  } = data;

  const renderLabel = (l: any, extraClass: string, style: any) => {
    const isHighlighted = l.data?.isManualHighlight || false;
    const blinkClass = isHighlighted ? "animate-pulse ring-2 ring-[#F28D35] shadow-[0_0_15px_rgba(242,141,53,0.9)] z-30" : "";
    const alertClass = l.isAlert && !isHighlighted ? "ring-2 ring-[#c084fc] animate-pulse z-20 shadow-[0_0_15px_rgba(192,132,252,0.9)]" : (!isHighlighted ? "z-10" : "");
    const isCp = l.isCurrentPrice || l.id === "cp";
    const isSpecialPos = l.isSpecialPosition || l.isBasePosition || l.isForceClosePosition || l.discountPct === 6 || l.discountPct === 12;
    const isClosePos = isSpecialPos;
    const finalBgColor = isHighlighted
      ? "#F28D35"
      : isSpecialPos
        ? "#F7554D"
        : (l.isAlert ? "#f3e8ff" : l.color);
    const finalTextColor = isHighlighted 
      ? "#ffffff"
      : isCp
        ? "#ffffff"
        : isSpecialPos
          ? "#ffffff"
          : l.isAlert
            ? "#7e22ce"
            : (l.color === "#ef4444" || l.color === "#F7554D" || l.color === "#f97316" || l.color === "#3b82f6" || l.color === "#10b981" || l.color === "#c084fc" ? "#ffffff" : "#451a03");

    if (isCardLoading && l.id === "cp") {
      return (
         <div
           key={l.id}
           className={`absolute px-2.5 py-1 ${extraClass} z-10`}
           style={style}
         >
           <div 
             className="skeleton-box h-4 rounded-full" 
             style={{ width: `${Math.max(60, (l.text?.length || 10) * 6)}px`, backgroundColor: `${l.color}20` }}
           />
         </div>
      );
    }

    const renderLabelContent = () => {
      if (isSpecialPos) {
        return (
          <span className="inline-flex items-center gap-1 font-black text-white">
            <span className="font-bold text-white">攤平#{l.groupIndex}</span>
            <span className="bg-white text-[#F7554D] px-1 py-0.5 rounded font-mono font-black shadow-2xs leading-none">
              ${l.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="font-mono font-black text-white">(-{l.discountPct}%)</span>
            <span className="font-black text-white/95">
              {l.discountPct === 6 || l.isBasePosition ? "(基準倉位)" : "(強制平倉)"}
            </span>
            {(l.plannedQty > 0 || (l.boughtQty !== undefined && l.boughtQty > 0)) && (
              <span className="font-mono text-[10.5px] font-bold text-white/95 bg-black/25 px-1.5 py-0.5 rounded ml-0.5 inline-flex items-center gap-1 leading-none shadow-2xs">
                {l.plannedQty > 0 && <span>預計 {l.plannedQty}股</span>}
                {l.plannedQty > 0 && <span>·</span>}
                <span className="text-emerald-300 font-black">已購 {l.boughtQty || 0}股</span>
              </span>
            )}
          </span>
        );
      }

      if (l.isAveragingSys2) {
        return (
          <span className="inline-flex items-center gap-1 font-black text-white">
            <span className="font-bold text-white">攤平#{l.groupIndex}</span>
            <span className="bg-white text-blue-700 px-1 py-0.5 rounded font-mono font-black shadow-2xs leading-none">
              ${l.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="font-mono font-black text-white">(-{l.discountPct}%)</span>
            {(l.plannedQty > 0 || (l.boughtQty !== undefined && l.boughtQty > 0)) && (
              <span className="font-mono text-[10.5px] font-bold text-white/95 bg-black/25 px-1.5 py-0.5 rounded ml-0.5 inline-flex items-center gap-1 leading-none shadow-2xs">
                {l.plannedQty > 0 && <span>預計 {l.plannedQty}股</span>}
                {l.plannedQty > 0 && <span>·</span>}
                <span className="text-emerald-300 font-black">已購 {l.boughtQty || 0}股</span>
              </span>
            )}
          </span>
        );
      }

      if (isCp) {
        return (
          <span className="inline-flex items-center gap-1 font-black text-white">
            <span className="font-bold text-white">現價</span>
            <span className="bg-white text-purple-900 px-1 py-0.5 rounded font-mono font-black shadow-2xs leading-none">
              ${typeof l.price === "number" ? l.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : l.price}
            </span>
          </span>
        );
      }

      if (l.isAverageCost || l.id === "ac") {
        return (
          <span className="inline-flex items-center gap-1 font-black text-white">
            <span className="font-bold text-white">均本</span>
            <span className="bg-white text-orange-700 px-1 py-0.5 rounded font-mono font-black shadow-2xs leading-none">
              ${typeof l.price === "number" ? l.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : l.price}
            </span>
            {((averageCostQuantity && averageCostQuantity !== 0) || (holdingQuantity && holdingQuantity > 0)) && (
              <span className="font-mono font-bold text-white/95">
                ({Math.abs(averageCostQuantity || holdingQuantity || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}股)
              </span>
            )}
          </span>
        );
      }

      // Check text prefixes for 支撐, 壓力, 止盈, 止損
      if (typeof l.text === "string") {
        const prefixes = ["支撐", "壓力", "止盈", "止損"];
        for (const prefix of prefixes) {
          if (l.text.startsWith(prefix)) {
            let numColor = "text-zinc-900";
            if (prefix === "支撐") numColor = "text-amber-950";
            else if (prefix === "壓力" || prefix === "止損") numColor = "text-red-700";
            else if (prefix === "止盈") numColor = "text-emerald-800";

            const priceFormatted = l.price !== undefined && !isNaN(l.price)
              ? `$${typeof l.price === "number" ? l.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : l.price}`
              : l.text.replace(prefix, "").trim();

            return (
              <span className="inline-flex items-center gap-1 font-black">
                <span className="font-bold">{prefix}</span>
                <span className={`bg-white ${numColor} px-1 py-0.5 rounded font-mono font-black shadow-2xs leading-none`}>
                  {priceFormatted}
                </span>
              </span>
            );
          }
        }
      }

      return l.text;
    };

    return (
      <div
        key={l.id}
        title={isCp ? "現價標籤 - 雙擊開啟動態視覺線定位" : undefined}
        className={`absolute whitespace-nowrap transition-all duration-300 font-extrabold px-1 py-0.5 rounded-sm ${
          isSpecialPos ? "text-[10.5px] sm:text-[11.0px] md:text-[11.5px]" : "text-[10.2px] sm:text-[10.7px] md:text-[11.2px]"
        } tracking-tight ${
          isCp ? "cursor-pointer hover:ring-2 hover:ring-blue-400" : "cursor-help"
        } select-none hover:scale-105 hover:z-40 active:scale-95 shadow-sm border border-black/10 leading-none ${extraClass} ${blinkClass} ${alertClass}`}
        style={{
          ...style,
          backgroundColor: finalBgColor,
          color: finalTextColor,
          textShadow: "none",
        }}
        onDoubleClick={(e) => {
          if (isCp) {
            e.stopPropagation();
            onOpenMiniVisualLinesModal?.({
              stockName: stockName || "",
              currentPrice: dynamicPrice > 0 ? dynamicPrice : currentPrice,
              holdingStatus,
              tradeType,
            });
          }
        }}
        onMouseEnter={() => setHoveredLabel(l)}
        onMouseLeave={() => {
          setHoveredLabel(null);
          if (longPressTimers.current[l.id]) {
            clearTimeout(longPressTimers.current[l.id]);
            delete longPressTimers.current[l.id];
          }
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (onToggleHighlight && l.data?.id) {
            const timer = setTimeout(() => {
              onToggleHighlight(l.data.id, l.data.isManualHighlight);
            }, 2000);
            longPressTimers.current[l.id] = timer;
          }
        }}
        onMouseUp={(e) => {
          e.stopPropagation();
          if (longPressTimers.current[l.id]) {
            clearTimeout(longPressTimers.current[l.id]);
            delete longPressTimers.current[l.id];
          }
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          if (onToggleHighlight && l.data?.id) {
            const timer = setTimeout(() => {
              onToggleHighlight(l.data.id, l.data.isManualHighlight);
            }, 2000);
            longPressTimers.current[l.id] = timer;
          }
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          if (longPressTimers.current[l.id]) {
            clearTimeout(longPressTimers.current[l.id]);
            delete longPressTimers.current[l.id];
          }
          if (isCp) {
            const now = Date.now();
            if (now - lastCpTapTime.current < 350) {
              onOpenMiniVisualLinesModal?.({
                stockName: stockName || "",
                currentPrice: dynamicPrice > 0 ? dynamicPrice : currentPrice,
                holdingStatus,
                tradeType,
              });
            }
            lastCpTapTime.current = now;
          }
        }}
      >
        {renderLabelContent()}
      </div>
    );
  };

  const hasActiveStrategy = !!(strategy?.addChecked || strategy?.slChecked || strategy?.closeChecked || strategy?.tpChecked || strategy?.observeChecked);

  return (
    <div
      className="w-full h-full p-2 relative flex flex-col rounded-xl pointer-events-auto"
      style={{ isolation: "isolate" }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Chart container */}
      <div
        ref={canvasRef}
        className="relative flex-1 bg-transparent rounded-lg overflow-hidden flex flex-col"
      >
        <div className="absolute top-2 left-2.5 right-2 flex items-center justify-between z-20 pointer-events-none select-none">
          <div className="flex items-center gap-2.5 pointer-events-auto shrink-0 min-w-0">
            {onToggleSelected && (
              <label
                className="flex items-center justify-center cursor-pointer select-none p-1 rounded-full hover:bg-zinc-200/80 transition-colors z-30 shrink-0"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                title={isSelected ? "取消勾選此個股" : "勾選此個股 (用於一鍵同步)"}
              >
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelected();
                  }}
                  className={`w-4 h-4 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? "bg-emerald-600 border border-emerald-600 text-white shadow-xs scale-105"
                      : "border-2 border-zinc-400 hover:border-emerald-600 bg-white"
                  }`}
                >
                  {isSelected && (
                    <Check className="w-2.5 h-2.5 text-white stroke-[3.5]" />
                  )}
                </div>
              </label>
            )}
            {stockName && (
              <div 
                className="font-extrabold text-base sm:text-2xl tracking-tighter leading-none text-zinc-900 shrink-0 cursor-pointer hover:opacity-80 transition-opacity flex items-baseline gap-1.5"
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenActionSettings?.();
                }}
                title="開啟操作設定對話窗"
              >
                <span>{stockName}</span>
                {(!plannedBuyPercent || plannedBuyPercent <= 0) && (
                  <span className="text-[11px] sm:text-xs font-semibold text-zinc-400 select-none tracking-normal font-sans">
                    (Not ready)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SVG layer for lines and curves - viewport scales 0-100 to full w/h */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full overflow-visible"
        >
          <defs>
            <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            {/* Color-Specific Arrowhead Markers */}
            {arrowColorList.map(([cleanHex, fullHex]) => (
              <marker
                key={`arrow-${cleanHex}`}
                id={`arrow-${cleanHex}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill={fullHex} />
              </marker>
            ))}
            {/* Fallback arrow marker in case of any custom color */}
            <marker
              id="arrow-default"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#000000" />
            </marker>
          </defs>

          {supports.map((s, i) => (
            <g key={`sup-line-${i}`}>
              <line
                x1="0"
                y1={getYPct(s.price)}
                x2="100"
                y2={getYPct(s.price)}
                vectorEffect="non-scaling-stroke"
                stroke="#d4d4d8"
                strokeWidth="1.5"
                strokeDasharray="6 4"
                opacity="0.8"
              />
            </g>
          ))}

          {resistances.map((r, i) => (
            <g key={`res-line-${i}`}>
              <line
                x1="0"
                y1={getYPct(r.price)}
                x2="100"
                y2={getYPct(r.price)}
                vectorEffect="non-scaling-stroke"
                stroke="#d4d4d8"
                strokeWidth="1.5"
                strokeDasharray="6 4"
                opacity="0.8"
              />
            </g>
          ))}

          {dynamicPrice > 0 && (
            <line
              x1="0"
              y1={getYPct(dynamicPrice)}
              x2="100"
              y2={getYPct(dynamicPrice)}
              vectorEffect="non-scaling-stroke"
              stroke="#c084fc"
              strokeWidth="1.5"
              strokeDasharray="2 2"
              opacity="0.6"
            />
          )}

          {averageCost && averageCost > 0 && (
            <line
              x1="0"
              y1={getYPct(averageCost)}
              x2="100"
              y2={getYPct(averageCost)}
              vectorEffect="non-scaling-stroke"
              stroke="#f97316"
              strokeWidth="3.5"
              opacity="0.95"
            />
          )}

          {/* Optional trade paths omitted to maintain clear visualization without curve clutter */}

          {/* Connector lines for collision-adjusted labels */}
          {slLabels.map((l, i) =>
            Math.abs(l.y - l.rawY) > 0.5 ? (
              <line
                key={`sl-conn-${i}`}
                x1="21"
                y1={l.rawY}
                x2="23"
                y2={l.y}
                stroke={l.color}
                strokeWidth="1"
                strokeDasharray="1 2"
                opacity="0.6"
                vectorEffect="non-scaling-stroke"
              />
            ) : null,
          )}
          {entryLabels.map((l, i) =>
            Math.abs(l.y - l.rawY) > 0.5 ? (
              <line
                key={`en-conn-${i}`}
                x1="50"
                y1={l.rawY}
                x2="50"
                y2={l.y}
                stroke={l.color}
                strokeWidth="1"
                strokeDasharray="1 2"
                opacity="0.6"
                vectorEffect="non-scaling-stroke"
              />
            ) : null,
          )}
          {tpLabels.map((l, i) =>
            Math.abs(l.y - l.rawY) > 0.5 ? (
              <line
                key={`tp-conn-${i}`}
                x1="50"
                y1={l.rawY}
                x2="50"
                y2={l.y}
                stroke={l.color}
                strokeWidth="1"
                strokeDasharray="1 2"
                opacity="0.6"
                vectorEffect="non-scaling-stroke"
              />
            ) : null,
          )}
          {rightLabels.map((l, i) =>
            Math.abs(l.y - l.rawY) > 0.5 ? (
              <line
                key={`rt-conn-${i}`}
                x1="100"
                y1={l.rawY}
                x2="95"
                y2={l.y}
                stroke={l.color}
                strokeWidth="1"
                strokeDasharray="1 2"
                opacity="0.6"
                vectorEffect="non-scaling-stroke"
              />
            ) : null,
          )}
          {leftLabels.map((l, i) =>
            Math.abs(l.y - l.rawY) > 0.5 ? (
              <line
                key={`left-conn-${i}`}
                x1="0"
                y1={l.rawY}
                x2="5"
                y2={l.y}
                stroke={l.color}
                strokeWidth="1"
                strokeDasharray="1 2"
                opacity="0.6"
                vectorEffect="non-scaling-stroke"
              />
            ) : null,
          )}

          {/* Render Vector-Scalable Drawing Annotations */}
          {localAnnotations.map((ann) => {
            if (ann.type === 'line' || ann.type === 'arrow') {
              const hexClean = (ann.color || '#000000').replace('#', '').toLowerCase();
              const markerId = ann.type === 'arrow' ? `arrow-${hexClean}` : undefined;
              const isHorizontal = ann.type === 'line' && Math.abs((ann.y2 ?? ann.y1 ?? 0) - (ann.y1 ?? 0)) < 8 && Math.abs((ann.x2 ?? 100) - (ann.x1 ?? 0)) >= 10;
              const axisLetter = isHorizontal ? getAxisLetterForColor(ann.color) : "";
              return (
                <g key={ann.id} className="pointer-events-auto">
                  {/* Invisible wide hit target for easier touch/click in eraser or move mode */}
                  {(mode === 'eraser' || mode === 'move') && (
                    <line
                      x1={ann.x1}
                      y1={ann.y1}
                      x2={ann.x2}
                      y2={ann.y2}
                      stroke="transparent"
                      strokeWidth="24"
                      vectorEffect="non-scaling-stroke"
                      className={mode === 'move' ? 'cursor-move' : 'cursor-pointer'}
                      style={{ touchAction: 'none' }}
                      onClick={(e) => {
                        if (mode === 'eraser') {
                          e.stopPropagation();
                          handleDeleteAnnotation(ann.id);
                        }
                      }}
                      onMouseDown={(e) => {
                        if (mode === 'move') {
                          e.stopPropagation();
                          handleDragStart(ann, e.clientX, e.clientY);
                        }
                      }}
                      onTouchStart={(e) => {
                        if (mode === 'move') {
                          e.stopPropagation();
                          if (e.cancelable) e.preventDefault();
                          const touch = e.touches[0];
                          handleDragStart(ann, touch.clientX, touch.clientY);
                        } else if (mode === 'eraser') {
                          e.stopPropagation();
                          if (e.cancelable) e.preventDefault();
                          handleDeleteAnnotation(ann.id);
                        }
                      }}
                    />
                  )}
                  <line
                    x1={ann.x1}
                    y1={ann.y1}
                    x2={ann.x2}
                    y2={ann.y2}
                    stroke={ann.color}
                    strokeWidth={ann.strokeWidth}
                    markerEnd={markerId ? `url(#${markerId})` : undefined}
                    vectorEffect="non-scaling-stroke"
                    opacity={mode === 'eraser' || mode === 'move' ? "0.75" : "0.85"}
                    className={`transition-all ${
                      mode === 'eraser'
                        ? 'cursor-pointer hover:stroke-red-500 hover:opacity-100 transition-all duration-150 [stroke-dasharray:none]'
                        : mode === 'move'
                        ? 'cursor-move hover:stroke-amber-400 hover:opacity-100 transition-all duration-150'
                        : ''
                    }`}
                    style={
                      mode === 'eraser' || mode === 'move'
                        ? { cursor: mode === 'move' ? 'move' : 'pointer', touchAction: 'none' }
                        : { touchAction: 'none' }
                    }
                    onClick={(e) => {
                      if (mode === 'eraser') {
                        e.stopPropagation();
                        handleDeleteAnnotation(ann.id);
                      }
                    }}
                    onMouseDown={(e) => {
                      if (mode === 'move') {
                        e.stopPropagation();
                        handleDragStart(ann, e.clientX, e.clientY);
                      }
                    }}
                    onTouchStart={(e) => {
                      if (mode === 'move') {
                        e.stopPropagation();
                        if (e.cancelable) e.preventDefault();
                        const touch = e.touches[0];
                        handleDragStart(ann, touch.clientX, touch.clientY);
                      } else if (mode === 'eraser') {
                        e.stopPropagation();
                        if (e.cancelable) e.preventDefault();
                        handleDeleteAnnotation(ann.id);
                      }
                    }}
                  />
                  {axisLetter && (
                    <text
                      x={Math.max(ann.x1, ann.x2) - 1.5}
                      y={((ann.y1 + ann.y2) / 2) - 1.2}
                      textAnchor="end"
                      fill="#9ca3af"
                      fontSize="3.8"
                      fontWeight="800"
                      className="select-none pointer-events-none font-mono tracking-wider opacity-85"
                    >
                      {axisLetter}
                    </text>
                  )}
                </g>
              );
            }
            if (ann.type === 'divider') {
              const dividerY = ann.y ?? ann.y1 ?? 0;
              const axisLetter = getAxisLetterForColor(ann.color);
              return (
                <g key={ann.id} className="pointer-events-auto">
                  {/* Invisible wide hit target for divider */}
                  {(mode === 'eraser' || mode === 'move') && (
                    <line
                      x1="0"
                      y1={dividerY}
                      x2="100"
                      y2={dividerY}
                      stroke="transparent"
                      strokeWidth="24"
                      vectorEffect="non-scaling-stroke"
                      className={mode === 'move' ? 'cursor-move' : 'cursor-pointer'}
                      style={{ touchAction: 'none' }}
                      onClick={(e) => {
                        if (mode === 'eraser') {
                          e.stopPropagation();
                          handleDeleteAnnotation(ann.id);
                        }
                      }}
                      onMouseDown={(e) => {
                        if (mode === 'move') {
                          e.stopPropagation();
                          handleDragStart(ann, e.clientX, e.clientY);
                        }
                      }}
                      onTouchStart={(e) => {
                        if (mode === 'move') {
                          e.stopPropagation();
                          if (e.cancelable) e.preventDefault();
                          const touch = e.touches[0];
                          handleDragStart(ann, touch.clientX, touch.clientY);
                        } else if (mode === 'eraser') {
                          e.stopPropagation();
                          if (e.cancelable) e.preventDefault();
                          handleDeleteAnnotation(ann.id);
                        }
                      }}
                    />
                  )}
                  <line
                    x1="0"
                    y1={dividerY}
                    x2="100"
                    y2={dividerY}
                    stroke={ann.color}
                    strokeWidth={ann.strokeWidth}
                    vectorEffect="non-scaling-stroke"
                    opacity={mode === 'eraser' || mode === 'move' ? "0.75" : "0.85"}
                    className={`transition-all ${
                      mode === 'eraser'
                        ? 'cursor-pointer hover:stroke-red-500 hover:opacity-100 transition-all duration-150 [stroke-dasharray:none]'
                        : mode === 'move'
                        ? 'cursor-move hover:stroke-amber-400 hover:opacity-100 transition-all duration-150'
                        : ''
                    }`}
                    style={
                      mode === 'eraser' || mode === 'move'
                        ? { cursor: mode === 'move' ? 'move' : 'pointer', touchAction: 'none' }
                        : { touchAction: 'none' }
                    }
                    onClick={(e) => {
                      if (mode === 'eraser') {
                        e.stopPropagation();
                        handleDeleteAnnotation(ann.id);
                      }
                    }}
                    onMouseDown={(e) => {
                      if (mode === 'move') {
                        e.stopPropagation();
                        handleDragStart(ann, e.clientX, e.clientY);
                      }
                    }}
                    onTouchStart={(e) => {
                      if (mode === 'move') {
                        e.stopPropagation();
                        if (e.cancelable) e.preventDefault();
                        const touch = e.touches[0];
                        handleDragStart(ann, touch.clientX, touch.clientY);
                      } else if (mode === 'eraser') {
                        e.stopPropagation();
                        if (e.cancelable) e.preventDefault();
                        handleDeleteAnnotation(ann.id);
                      }
                    }}
                  />
                  {axisLetter && (
                    <text
                      x="98.5"
                      y={dividerY - 1.2}
                      textAnchor="end"
                      fill="#9ca3af"
                      fontSize="3.8"
                      fontWeight="800"
                      className="select-none pointer-events-none font-mono tracking-wider opacity-85"
                    >
                      {axisLetter}
                    </text>
                  )}
                </g>
              );
            }
            if (ann.type === 'box') {
              return (
                <g key={ann.id} className="pointer-events-auto">
                  {/* Invisible wide hit target for box border and interior */}
                  {(mode === 'eraser' || mode === 'move') && (
                    <rect
                      x={ann.x}
                      y={ann.y}
                      width={ann.width}
                      height={ann.height}
                      stroke="transparent"
                      strokeWidth="20"
                      fill="rgba(0,0,0,0.01)"
                      vectorEffect="non-scaling-stroke"
                      className={mode === 'move' ? 'cursor-move' : 'cursor-pointer'}
                      style={{ touchAction: 'none' }}
                      onClick={(e) => {
                        if (mode === 'eraser') {
                          e.stopPropagation();
                          handleDeleteAnnotation(ann.id);
                        }
                      }}
                      onMouseDown={(e) => {
                        if (mode === 'move') {
                          e.stopPropagation();
                          handleDragStart(ann, e.clientX, e.clientY);
                        }
                      }}
                      onTouchStart={(e) => {
                        if (mode === 'move') {
                          e.stopPropagation();
                          if (e.cancelable) e.preventDefault();
                          const touch = e.touches[0];
                          handleDragStart(ann, touch.clientX, touch.clientY);
                        } else if (mode === 'eraser') {
                          e.stopPropagation();
                          if (e.cancelable) e.preventDefault();
                          handleDeleteAnnotation(ann.id);
                        }
                      }}
                    />
                  )}
                  <rect
                    x={ann.x}
                    y={ann.y}
                    width={ann.width}
                    height={ann.height}
                    stroke={ann.color}
                    strokeWidth={ann.strokeWidth}
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                    opacity={mode === 'eraser' || mode === 'move' ? "0.75" : "0.85"}
                    className={`transition-all ${
                      mode === 'eraser'
                        ? 'cursor-pointer hover:stroke-red-500 hover:opacity-100 transition-all duration-150'
                        : mode === 'move'
                        ? 'cursor-move hover:stroke-amber-400 hover:opacity-100 transition-all duration-150'
                        : ''
                    }`}
                    style={
                      mode === 'eraser' || mode === 'move'
                        ? { cursor: mode === 'move' ? 'move' : 'pointer', touchAction: 'none' }
                        : { touchAction: 'none' }
                    }
                    onClick={(e) => {
                      if (mode === 'eraser') {
                        e.stopPropagation();
                        handleDeleteAnnotation(ann.id);
                      }
                    }}
                    onMouseDown={(e) => {
                      if (mode === 'move') {
                        e.stopPropagation();
                        handleDragStart(ann, e.clientX, e.clientY);
                      }
                    }}
                    onTouchStart={(e) => {
                      if (mode === 'move') {
                        e.stopPropagation();
                        if (e.cancelable) e.preventDefault();
                        const touch = e.touches[0];
                        handleDragStart(ann, touch.clientX, touch.clientY);
                      } else if (mode === 'eraser') {
                        e.stopPropagation();
                        if (e.cancelable) e.preventDefault();
                        handleDeleteAnnotation(ann.id);
                      }
                    }}
                  />
                </g>
              );
            }
            return null;
          })}

          {/* Render Live Drawing Preview Feedback */}
          {isDrawing && startPoint && activePoint && mode === 'line' && (
            <line
              x1={startPoint.x}
              y1={startPoint.y}
              x2={activePoint.x}
              y2={activePoint.y}
              stroke={activeColor}
              strokeWidth={activeThickness}
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
              opacity="0.9"
            />
          )}

          {isDrawing && startPoint && activePoint && mode === 'arrow' && (
            <line
              x1={startPoint.x}
              y1={startPoint.y}
              x2={activePoint.x}
              y2={activePoint.y}
              stroke={activeColor}
              strokeWidth={activeThickness}
              markerEnd={`url(#arrow-${(activeColor || '#000000').replace('#', '').toLowerCase()})`}
              vectorEffect="non-scaling-stroke"
              opacity="0.9"
            />
          )}

          {isDrawing && startPoint && activePoint && mode === 'box' && (
            <rect
              x={Math.min(startPoint.x, activePoint.x)}
              y={Math.min(startPoint.y, activePoint.y)}
              width={Math.abs(activePoint.x - startPoint.x)}
              height={Math.abs(activePoint.y - startPoint.y)}
              stroke={activeColor}
              strokeWidth={activeThickness}
              fill="none"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
              opacity="0.9"
            />
          )}

          {mode === 'divider' && hoverPoint && (
            <g className="pointer-events-none">
              <line
                x1="0"
                y1={hoverPoint.y}
                x2="100"
                y2={hoverPoint.y}
                stroke={activeColor}
                strokeWidth={activeThickness}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
                opacity="0.8"
              />
              {getAxisLetterForColor(activeColor) && (
                <text
                  x="98.5"
                  y={hoverPoint.y - 1.2}
                  textAnchor="end"
                  fill="#9ca3af"
                  fontSize="3.8"
                  fontWeight="800"
                  className="select-none pointer-events-none font-mono tracking-wider opacity-85"
                >
                  {getAxisLetterForColor(activeColor)}
                </text>
              )}
            </g>
          )}

          {/* Visual eraser pointer indicator */}
          {mode === 'eraser' && eraserHoverPoint && (
            <g className="pointer-events-none">
              <circle
                cx={eraserHoverPoint.x}
                cy={eraserHoverPoint.y}
                r="3.5"
                fill="rgba(239, 68, 68, 0.25)"
                stroke="#ef4444"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={eraserHoverPoint.x - 2}
                y1={eraserHoverPoint.y - 2}
                x2={eraserHoverPoint.x + 2}
                y2={eraserHoverPoint.y + 2}
                stroke="#ef4444"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={eraserHoverPoint.x + 2}
                y1={eraserHoverPoint.y - 2}
                x2={eraserHoverPoint.x - 2}
                y2={eraserHoverPoint.y + 2}
                stroke="#ef4444"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )}
        </svg>

        {/* Floating Drawing & Eraser interaction canvas handler overlay */}
        {mode !== 'cursor' && mode !== 'move' && (
          <div
            className="absolute inset-0 z-40 touch-none select-none cursor-crosshair"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={() => {
              setHoverPoint(null);
              setEraserHoverPoint(null);
              isErasingRef.current = false;
            }}
            onTouchStart={handleCanvasTouchStart}
            onTouchMove={handleCanvasTouchMove}
            onTouchEnd={handleCanvasTouchEnd}
          />
        )}

        {/* Overlay Inline text form editor when active */}
        {inputCoords && (
          <form
            onSubmit={handleTextSubmit}
            style={{
              left: `${Math.min(75, Math.max(10, inputCoords.x))}%`,
              top: `${Math.min(85, Math.max(12, inputCoords.y))}%`,
            }}
            className="absolute z-50 -translate-y-1/2 flex items-center gap-1.5 max-w-[92%]"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onBlur={() => handleTextSubmit()}
              placeholder="輸入備註文字..."
              className="bg-black/95 border border-white/30 text-white rounded-lg px-2.5 py-1.5 outline-none shadow-2xl min-w-[120px] max-w-[190px] sm:max-w-[280px] focus:ring-2 focus:ring-blue-500 font-black leading-none text-xs sm:text-sm"
              style={{ color: activeColor }}
            />
            <button
              type="submit"
              className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] sm:text-xs rounded-lg shadow-md shrink-0 cursor-pointer"
            >
              確定
            </button>
          </form>
        )}

        {/* Clean, Non-scaled HTML Overlay for Dots & Text Layer */}
        <div
          className="absolute inset-0 pointer-events-none text-[10px] leading-none z-20"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
        >
          {/* Decorative Dots strictly at RAW positions */}
          {sls.map((sl, i) => (
            <div
              key={`sl-dot-${i}`}
              className="absolute w-2 h-2 rounded-full bg-[#ef4444]"
              style={{
                left: "21%",
                top: `${getYPct(sl.price)}%`,
                transform: "translate(-50%, -50%)",
                opacity: 0.8,
                boxShadow: "0 0 5px #ef4444",
              }}
            />
          ))}
          {tps.map((tp, i) => (
            <div
              key={`tp-dot-${i}`}
              className="absolute w-2 h-2 rounded-full bg-[#10b981]"
              style={{
                left: "50%",
                top: `${getYPct(tp.price)}%`,
                transform: "translate(-50%, -50%)",
                opacity: 0.8,
                boxShadow: "0 0 5px #10b981",
              }}
            />
          ))}
          {resistances.map((r, i) => (
            <div
              key={`res-dot-${i}`}
              className="absolute w-2 h-2 rounded-full bg-[#f87171]"
              style={{
                left: "50%",
                top: `${getYPct(r.price)}%`,
                transform: "translate(-50%, -50%)",
                opacity: 0.8,
                boxShadow: "0 0 5px #f87171",
              }}
            />
          ))}

          {/* Left Labels (S/R) */}
          <div className={mode === 'cursor' ? "pointer-events-auto" : "pointer-events-none"}>
            {leftLabels.map((l) =>
              renderLabel(l, "left-1", {
                top: `${l.y}%`,
                transform: "translateY(-50%)",
              }),
            )}
          </div>

          {/* Current Price */}
          <div className={mode === 'cursor' ? "pointer-events-auto" : "pointer-events-none"}>
            {rightLabels.map((l) =>
              renderLabel(l, "right-1", {
                top: `${l.y}%`,
                transform: "translateY(-50%)",
              }),
            )}
          </div>

          {/* SL Labels */}
          <div className={mode === 'cursor' ? "pointer-events-auto" : "pointer-events-none"}>
            {slLabels.map((l) =>
              renderLabel(l, "left-[23%]", {
                top: `${l.y}%`,
                transform: "translateY(-50%)",
              }),
            )}
          </div>

          {/* Entry Labels */}
          <div className={mode === 'cursor' ? "pointer-events-auto" : "pointer-events-none"}>
            {entryLabels.map((l) =>
              renderLabel(l, "left-1/2", {
                top: `${l.y}%`,
                transform: "translate(-50%, -50%)",
              }),
            )}
          </div>

          {/* TP & Resistance Labels (Centered) */}
          <div className={mode === 'cursor' ? "pointer-events-auto" : "pointer-events-none"}>
            {tpLabels.map((l) =>
              renderLabel(l, "left-1/2", {
                top: `${l.y}%`,
                transform: "translate(-50%, -50%)",
              }),
            )}
          </div>

          {/* Render Vector-Correct Text Annotations in HTML Space */}
          {localAnnotations.map((ann) => {
            if (ann.type === 'text') {
              return (
                <div
                  key={ann.id}
                  style={{
                    left: `${ann.x}%`,
                    top: `${ann.y}%`,
                    color: ann.color,
                    transform: "translate(-50%, -50%)",
                    fontSize: `${ann.fontSize || 12}px`,
                    touchAction: 'none',
                  }}
                  className={`absolute z-40 font-black tracking-wide whitespace-nowrap drop-shadow-[0_1.5px_2px_rgba(0,0,0,1)] select-none pointer-events-auto transition-all ${
                    mode === 'eraser'
                      ? 'cursor-pointer hover:text-red-500 hover:scale-110 active:scale-90 bg-red-500/10 px-1.5 py-0.5 rounded border border-dashed border-red-500/40'
                      : mode === 'move'
                      ? 'cursor-move hover:text-amber-400 hover:scale-105 bg-amber-500/10 px-1.5 py-0.5 rounded border border-dashed border-amber-500/40'
                      : ''
                  }`}
                  onClick={(e) => {
                    if (mode === 'eraser') {
                      e.stopPropagation();
                      handleDeleteAnnotation(ann.id);
                    }
                  }}
                  onMouseDown={(e) => {
                    if (mode === 'move') {
                      e.stopPropagation();
                      handleDragStart(ann, e.clientX, e.clientY);
                    }
                  }}
                  onTouchStart={(e) => {
                    if (mode === 'move') {
                      e.stopPropagation();
                      if (e.cancelable) e.preventDefault();
                      const touch = e.touches[0];
                      handleDragStart(ann, touch.clientX, touch.clientY);
                    } else if (mode === 'eraser') {
                      e.stopPropagation();
                      if (e.cancelable) e.preventDefault();
                      handleDeleteAnnotation(ann.id);
                    }
                  }}
                >
                  {ann.text}
                </div>
              );
            }
            if (ann.type === 'divider') {
              const dividerY = ann.y ?? ann.y1 ?? 0;
              const axisLetter = getAxisLetterForColor(ann.color);
              if (!axisLetter) return null;
              return (
                <div
                  key={`axis-lbl-${ann.id}`}
                  style={{
                    right: '6px',
                    top: `${dividerY}%`,
                    transform: 'translateY(-50%)',
                  }}
                  className="absolute z-30 pointer-events-none select-none text-[11px] sm:text-[12px] font-black font-mono text-zinc-400 tracking-wider leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                  title={`${axisLetter}軸 (${ann.color})`}
                >
                  {axisLetter}
                </div>
              );
            }
            if (ann.type === 'line') {
              const isDivider =
                Math.abs((ann.y2 ?? ann.y1 ?? 0) - (ann.y1 ?? 0)) < 8 &&
                Math.abs((ann.x2 ?? 100) - (ann.x1 ?? 0)) >= 10;
              if (isDivider) {
                const dividerY = (ann.y1 + ann.y2) / 2;
                const axisLetter = getAxisLetterForColor(ann.color);
                if (!axisLetter) return null;
                const rightX = Math.max(ann.x1, ann.x2);
                return (
                  <div
                    key={`axis-lbl-${ann.id}`}
                    style={{
                      left: `${Math.min(96, rightX)}%`,
                      top: `${dividerY}%`,
                      transform: 'translate(-100%, -50%)',
                    }}
                    className="absolute z-30 pointer-events-none select-none text-[11px] sm:text-[12px] font-black font-mono text-zinc-400 tracking-wider leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                    title={`${axisLetter}軸 (${ann.color})`}
                  >
                    {axisLetter}
                  </div>
                );
              }
            }
            return null;
          })}

          {/* Visual indicator deletion dots & close icons during Interactive cursor mode */}
          {mode === 'cursor' && localAnnotations.filter(ann => ann.type !== 'divider').map((ann) => {
            const center = getCenterCoords(ann);
            return (
              <div
                key={`del-${ann.id}`}
                style={{
                  left: `${center.x}%`,
                  top: `${center.y}%`,
                  transform: 'translate(-50%, -50%)',
                  touchAction: 'none',
                }}
                className="absolute z-[45] pointer-events-auto group/del p-1"
              >
                {/* Micro circle representing annotation target anchor */}
                <div 
                  className="w-2.5 h-2.5 sm:w-1.5 sm:h-1.5 rounded-full border border-black/50 shadow shadow-black flex items-center justify-center transition-all duration-200 group-hover/del:scale-125 bg-white/30" 
                  style={{ backgroundColor: ann.color }}
                />
                
                {/* Deletion handle triggers ONLY on deliberate click of the close button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAnnotation(ann.id);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    if (e.cancelable) e.preventDefault();
                    handleDeleteAnnotation(ann.id);
                  }}
                  className="hidden group-hover/del:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4.5 h-4.5 items-center justify-center bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg border border-white/25 text-[8px] font-black transition-colors cursor-pointer"
                  title="刪除此備註"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        {/* Global Tooltip */}
        {hoveredLabel && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-2 bg-black/80 backdrop-blur-md rounded-lg border border-white/20 text-white z-50 shadow-2xl flex flex-col items-center min-w-[120px] pointer-events-none">
            <span
              className="font-bold text-xs"
              style={{ color: hoveredLabel.color }}
            >
              {hoveredLabel.text}
            </span>
            {hoveredLabel.isAlert && (
              <span className="text-[10px] text-amber-400 font-bold mt-1">
                進入提醒區間
              </span>
            )}
            {hoveredLabel.data?.notes && (
              <span className="text-[10px] text-white/70 mt-1 max-w-[150px] text-center truncate">
                {hoveredLabel.data.notes}
              </span>
            )}
            {hoveredLabel.data?.conditions && (
              <span className="text-[10px] text-white/50 mt-1 max-w-[150px] text-center truncate">
                {hoveredLabel.data.conditions}
              </span>
            )}
            {hoveredLabel.isCurrentPrice && (
              <span className="text-[10px] text-blue-300 mt-1">最新報價</span>
            )}
            {hoveredLabel.isAveragingSys2 && (
              <span className="text-[10px] text-blue-300 mt-1">
                系統二向下攤平 (組別 #{hoveredLabel.groupIndex}, -{hoveredLabel.discountPct}%)
                {hoveredLabel.discountPct === 6 || hoveredLabel.isBasePosition
                  ? " - (基準倉位(下注終局))"
                  : hoveredLabel.discountPct === 12 || hoveredLabel.isForceClosePosition
                    ? " - (強制平倉)"
                    : ""}
              </span>
            )}
          </div>
        )}
      </div>

      {/* COMPACT BAR AT THE BOTTOM OF CARD (Drawing toolbar) */}
      <div 
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        className="flex flex-col gap-1 mt-0.5 shrink-0 z-50 pointer-events-auto select-none w-full px-1 animate-fadeIn"
      >
        {/* Drawing Toolbar */}
        <div className="flex justify-start sm:justify-center w-full mt-0.5 overflow-x-auto max-w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] py-0.5 px-0.5">
          <div className="flex items-center gap-0 sm:gap-0.5 p-[2px] px-1 sm:px-1 bg-white/60 border border-zinc-200/90 backdrop-blur-md rounded-lg sm:rounded-md shadow-none shrink-0">
            {/* Cursor Interactive Mode Button */}
            <button
              type="button"
              title="互動標籤"
              onClick={() => { setMode('cursor'); setInputCoords(null); }}
              className={`p-1 sm:p-0.5 rounded transition-colors shrink-0 ${mode === 'cursor' ? 'bg-zinc-900/15 text-zinc-950 font-bold ring-1 ring-zinc-200' : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-900/5'}`}
            >
              <MousePointer className="w-3 h-3 sm:w-3 sm:h-3" />
            </button>

            {/* Move Annotation Mode Button */}
            <button
              type="button"
              title="拖曳移動標記"
              onClick={() => { setMode('move'); setInputCoords(null); }}
              className={`p-1 sm:p-0.5 rounded transition-colors shrink-0 ${mode === 'move' ? 'bg-zinc-900/15 text-zinc-950 font-bold ring-1 ring-zinc-200' : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-900/5'}`}
            >
              <Move className="w-3 h-3 sm:w-3 sm:h-3" />
            </button>
            
            <div className="w-[1px] h-2.5 bg-zinc-300/80 mx-0 sm:mx-0.5 shrink-0" />
            
            {/* Rectangle Mode Button */}
            <button
              type="button"
              title="畫方框"
              onClick={() => { setMode('box'); setInputCoords(null); }}
              className={`p-1 sm:p-0.5 rounded transition-colors shrink-0 ${mode === 'box' ? 'bg-zinc-900/15 text-zinc-950 font-bold ring-1 ring-zinc-200' : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-900/5'}`}
            >
              <Square className="w-3 h-3 sm:w-3 sm:h-3" />
            </button>
            
            {/* Line Mode Button */}
            <button
              type="button"
              title="畫線"
              onClick={() => { setMode('line'); setInputCoords(null); }}
              className={`p-1 sm:p-0.5 rounded transition-colors shrink-0 ${mode === 'line' ? 'bg-zinc-900/15 text-zinc-950 font-bold ring-1 ring-zinc-200' : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-900/5'}`}
            >
              <Minus className="w-3 h-3 sm:w-3 sm:h-3" />
            </button>

            {/* Divider Horizontal Line Mode Button */}
            <button
              type="button"
              title="水平線 Divider (黑色: D軸, 藍色: B軸, 綠色: G軸, 黃色: Y軸, 紅色: R軸)"
              onClick={() => { setMode('divider'); setInputCoords(null); }}
              className={`p-1 sm:p-0.5 rounded transition-colors shrink-0 ${mode === 'divider' ? 'bg-zinc-900/15 text-zinc-950 font-bold ring-1 ring-zinc-200' : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-900/5'}`}
            >
              <SeparatorHorizontal className="w-3 h-3 sm:w-3 sm:h-3" />
            </button>

            {/* Arrow Mode Button */}
            <button
              type="button"
              title="箭頭指向"
              onClick={() => { setMode('arrow'); setInputCoords(null); }}
              className={`p-1 sm:p-0.5 rounded transition-colors shrink-0 ${mode === 'arrow' ? 'bg-zinc-900/15 text-zinc-950 font-bold ring-1 ring-zinc-200' : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-900/5'}`}
            >
              <ArrowUpRight className="w-3 h-3 sm:w-3 sm:h-3" />
            </button>
            
            {/* Text Annotation Mode Button */}
            <button
              type="button"
              title="打文字"
              onClick={() => { setMode('text'); }}
              className={`p-1 sm:p-0.5 rounded transition-colors shrink-0 ${mode === 'text' ? 'bg-zinc-900/15 text-zinc-950 font-bold ring-1 ring-zinc-200' : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-900/5'}`}
            >
              <Type className="w-3 h-3 sm:w-3 sm:h-3" />
            </button>

            {/* Eraser Mode Button */}
            <button
              type="button"
              title="橡皮擦工具"
              onClick={() => { setMode('eraser'); setInputCoords(null); }}
              className={`p-1 sm:p-0.5 rounded transition-colors shrink-0 ${mode === 'eraser' ? 'bg-rose-500/15 text-rose-800 font-bold' : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-900/5'}`}
            >
              <Eraser className="w-3 h-3 sm:w-3 sm:h-3" />
            </button>
            
            <div className="w-[1px] h-2.5 bg-zinc-300/80 mx-0 sm:mx-0.5 shrink-0" />

            {/* Undo Button */}
            <button
              type="button"
              title="上一步"
              onClick={handleUndo}
              disabled={history.length === 0}
              className={`p-1 sm:p-0.5 rounded transition-colors shrink-0 ${history.length > 0 ? 'text-amber-800 hover:text-amber-950 hover:bg-zinc-900/5' : 'text-zinc-400/50 cursor-not-allowed'}`}
            >
              <Undo2 className="w-3 h-3 sm:w-3 sm:h-3" />
            </button>
            
            <div className="w-[1px] h-2.5 bg-zinc-300/80 mx-0 sm:mx-0.5 shrink-0" />

            {/* Stroke Width Cycle Control */}
            <button
              type="button"
              title={`粗細: ${activeThickness}px`}
              onClick={cycleThickness}
              className="p-0.5 px-0.5 sm:px-1 rounded hover:bg-zinc-900/5 transition-colors flex items-center gap-0.5 shrink-0"
            >
              <span className="text-[8px] font-medium text-zinc-600 tracking-tighter">粗</span>
              <span className="bg-zinc-900/10 rounded px-1 py-0.25 text-zinc-900 font-bold text-[8px]">{activeThickness}px</span>
            </button>
            
            <div className="w-[1px] h-2.5 bg-zinc-300/80 mx-0 sm:mx-0.5 shrink-0" />

            {/* Font Size Cycle Control */}
            <button
              type="button"
              title={`字級: ${activeFontSize}px`}
              onClick={() => {
                setActiveFontSize((prev) => {
                  const sizes = [10, 12, 14, 16, 20, 24, 28];
                  const idx = sizes.indexOf(prev);
                  return sizes[(idx + 1) % sizes.length];
                });
              }}
              className="p-0.5 px-0.5 sm:px-1 rounded hover:bg-zinc-900/5 transition-colors flex items-center gap-0.5 shrink-0"
            >
              <span className="text-[8px] font-medium text-zinc-600 tracking-tighter">字</span>
              <span className="bg-zinc-900/10 rounded px-1 py-0.25 text-zinc-900 font-bold text-[8px]">{activeFontSize}px</span>
            </button>
            
            <div className="w-[1px] h-2.5 bg-zinc-300/80 mx-0 sm:mx-0.5 shrink-0" />

            {/* Dynamic Color Selection Popover */}
            <div className="flex items-center relative shrink-0">
              <button
                ref={colorButtonRef}
                type="button"
                title="選擇繪圖與備註顏色"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleColorPicker();
                }}
                className={`p-0.5 px-1 rounded flex items-center gap-1 hover:bg-zinc-900/5 transition-colors cursor-pointer ${
                  isColorPickerOpen ? 'bg-zinc-900/15 ring-1 ring-zinc-400 font-bold' : ''
                }`}
              >
                <div
                  className="w-3.5 h-3.5 rounded-full border border-black/30 shadow-xs shrink-0 transition-transform hover:scale-105"
                  style={{ backgroundColor: activeColor }}
                />
                <span className="text-[7.5px] text-zinc-500 font-bold leading-none select-none">▾</span>
              </button>

              {isColorPickerOpen && pickerPos && createPortal(
                <div
                  className="fixed inset-0 z-[999999] pointer-events-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsColorPickerOpen(false);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    setIsColorPickerOpen(false);
                  }}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    style={{
                      position: 'fixed',
                      top: `${pickerPos.top}px`,
                      left: `${pickerPos.left}px`,
                      width: '240px',
                    }}
                    className="bg-white/98 backdrop-blur-xl border border-zinc-300/80 rounded-xl p-2.5 shadow-2xl z-[1000000] flex flex-col gap-2 pointer-events-auto select-none animate-in fade-in zoom-in-95 duration-100"
                  >
                    <div className="flex items-center justify-between px-0.5 pb-1 border-b border-zinc-100">
                      <span className="text-[10px] font-black text-zinc-700 tracking-wider">選擇顏色</span>
                      <div className="flex items-center gap-1">
                        <span
                          className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                          style={{ backgroundColor: activeColor }}
                        />
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 font-mono">
                          {DRAWING_COLORS.find(c => c.hex.toLowerCase() === activeColor.toLowerCase())?.name || activeColor}
                        </span>
                      </div>
                    </div>

                    {/* Preset color swatches */}
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 p-0.5 max-h-[160px] overflow-y-auto">
                      {DRAWING_COLORS.map((col) => {
                        const isSelected = activeColor.toLowerCase() === col.hex.toLowerCase();
                        return (
                          <button
                            key={col.hex}
                            type="button"
                            title={`${col.name} (${col.hex})`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectColor(col.hex);
                            }}
                            className={`group relative flex flex-col items-center justify-center p-1 rounded-lg hover:bg-zinc-100 transition-all cursor-pointer ${
                              isSelected ? 'bg-zinc-100 ring-2 ring-blue-500' : 'border border-transparent'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full border border-black/25 shadow-xs transition-transform group-hover:scale-110 ${
                                isSelected ? 'scale-105 ring-2 ring-offset-1 ring-blue-500' : ''
                              }`}
                              style={{ backgroundColor: col.hex }}
                            />
                            <span className="text-[7.5px] text-zinc-600 font-medium mt-0.5 truncate max-w-full text-center">
                              {col.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Color Input */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-zinc-100 px-0.5 gap-2">
                      <label className="text-[9px] font-bold text-zinc-500 shrink-0">自訂色票</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={activeColor.startsWith('#') && activeColor.length === 7 ? activeColor : '#000000'}
                          onChange={(e) => {
                            const newCol = e.target.value;
                            setActiveColor(newCol);
                            activeColorRef.current = newCol;
                          }}
                          className="w-5 h-5 rounded border border-zinc-300 cursor-pointer p-0 bg-transparent shrink-0"
                          title="點選自訂色盤"
                        />
                        <input
                          type="text"
                          value={activeColor}
                          onChange={(e) => {
                            const val = e.target.value;
                            setActiveColor(val);
                            if (/^#[0-9A-Fa-f]{6}$/.test(val) || /^#[0-9A-Fa-f]{3}$/.test(val)) {
                              activeColorRef.current = val;
                            }
                          }}
                          className="w-16 text-[9px] font-mono px-1.5 py-0.5 border border-zinc-200 rounded text-zinc-800 uppercase focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                  </div>
                </div>,
                document.body
              )}
            </div>

            <div className="w-[1px] h-2.5 bg-zinc-300/80 mx-0.5 shrink-0" />
            
            {/* 一鍵刪除視覺圖示化的所有繪圖按鈕 */}
            <button
              type="button"
              title={localAnnotations.length > 0 ? `一鍵刪除所有繪圖 (${localAnnotations.length} 個標記)` : "一鍵刪除所有繪圖 (目前無繪圖)"}
              onClick={handleClearAll}
              className={`p-1 sm:p-0.5 rounded transition-all shrink-0 flex items-center gap-0.5 cursor-pointer ${
                localAnnotations.length > 0
                  ? 'text-red-600 hover:text-red-800 hover:bg-red-500/15 active:scale-90 font-bold'
                  : 'text-zinc-400 hover:text-red-500 hover:bg-zinc-100 opacity-60'
              }`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {showExportModal && (
        <div 
          className="absolute inset-0 bg-white/70 backdrop-blur-md border border-zinc-200/80 z-[200] flex flex-col items-center justify-center p-4 rounded-xl animate-fadeIn pointer-events-auto select-none overflow-y-auto max-h-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button in top right */}
          <button 
            onClick={() => setShowExportModal(false)}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-zinc-950/5 hover:bg-zinc-950/10 text-zinc-650 hover:text-zinc-900 transition-all cursor-pointer z-50 text-xs w-6 h-6 flex items-center justify-center font-bold border border-zinc-200/80"
          >
            ✕
          </button>
          
          <div className="w-full max-w-sm flex flex-col text-center my-auto py-2">
            {/* Title */}
            <div className="flex justify-center items-center gap-2 mb-1">
              <Share2 className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm sm:text-base font-black text-zinc-900 tracking-wide">
                匯出個股分析圖表 - {stockName}
              </h3>
            </div>
            <p className="text-[10px] sm:text-xs text-zinc-550 mb-5 leading-normal">
              請選擇您想要產生的圖表類型
            </p>
            
            {/* Options container */}
            <div className="flex flex-col gap-3">
              {/* Option 2: TradingView style historical chart */}
              <button
                disabled={exportLoading}
                onClick={async () => {
                  setExportLoading(true);
                  await handleGenerateKLineChart();
                  setExportLoading(false);
                  setShowExportModal(false);
                }}
                className="group flex flex-col items-start p-3 bg-zinc-50 hover:bg-zinc-100 active:bg-zinc-50 border border-zinc-200 hover:border-indigo-500 rounded-xl transition-all text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <div className="flex items-center gap-2 w-full">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 group-hover:scale-105 transition-transform">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] sm:text-xs font-black text-zinc-900 group-hover:text-indigo-650 transition-colors">
                      輸出 TradingView K線走勢圖 (PNG)
                    </span>
                    <span className="block text-[9px] sm:text-[10px] text-zinc-500 font-medium mt-0.5 leading-tight">
                      包含 5/10/20日均線、MACD、RSI 及成交量技術指標
                    </span>
                  </div>
                </div>
              </button>
            </div>
            
            {/* Loading Feedback */}
            {exportLoading && (
              <div className="mt-5 flex items-center justify-center gap-2 text-indigo-600 text-[10px] sm:text-xs font-black animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>圖表產生中，請稍候...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
