import React, { useMemo, useState, useRef } from "react";
import { PlannedOrder, ChartAnnotation } from "../types";
import { MousePointer, Minus, Square, Type, Trash2, Eraser, Undo2, ArrowUpRight, Move, Download, Share2, Camera, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import { toast } from "sonner";

interface Props {
  plannedOrders: PlannedOrder[];
  currentPrice?: number;
  onToggleHighlight?: (orderId: string, currentStatus: boolean) => void;
  tabId?: string;
  annotations?: ChartAnnotation[];
  onUpdateAnnotations?: (annotations: ChartAnnotation[]) => void;
  averageCost?: number;
  averageCostQuantity?: number;
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
}

function resolveCollisions<T extends { rawY: number; isFixed?: boolean }>(
  items: T[],
  minDisp: number,
): (T & { y: number })[] {
  if (items.length === 0) return [];
  
  let sorted = [...items]
    .sort((a, b) => a.rawY - b.rawY)
    .map((item) => ({ ...item, y: item.rawY }));

  const minY = 14;
  const maxY = 97;

  // 100 rounds of relaxation
  for (let iter = 0; iter < 100; iter++) {
    let changed = false;

    // Standard push-apart
    for (let i = 0; i < sorted.length - 1; i++) {
      const diff = sorted[i + 1].y - sorted[i].y;
      if (diff < minDisp) {
        const overlap = minDisp - diff;
        if (sorted[i].isFixed && !sorted[i + 1].isFixed) {
          sorted[i + 1].y += overlap;
          changed = true;
        } else if (!sorted[i].isFixed && sorted[i + 1].isFixed) {
          sorted[i].y -= overlap;
          changed = true;
        } else if (!sorted[i].isFixed && !sorted[i + 1].isFixed) {
          sorted[i].y -= overlap / 2;
          sorted[i + 1].y += overlap / 2;
          changed = true;
        }
      }
    }

    // Dynamic, cooperative bounds clamping (pushes the entire stack if standard clamping squeezes it)
    if (sorted[0].y < minY && !sorted[0].isFixed) {
      const push = minY - sorted[0].y;
      for (let j = 0; j < sorted.length; j++) {
        if (!sorted[j].isFixed) sorted[j].y += push;
      }
      changed = true;
    }

    const lastIdx = sorted.length - 1;
    if (sorted[lastIdx].y > maxY && !sorted[lastIdx].isFixed) {
      const push = sorted[lastIdx].y - maxY;
      for (let j = 0; j <= lastIdx; j++) {
        if (!sorted[j].isFixed) sorted[j].y -= push;
      }
      changed = true;
    }

    if (!changed) break;
  }

  // Final strict clamps and guarantee passes
  for (let i = 0; i < sorted.length; i++) {
    if (!sorted[i].isFixed) {
      sorted[i].y = Math.max(minY, Math.min(maxY, sorted[i].y));
    }
  }

  // Forward sweep guarantee
  for (let i = 0; i < sorted.length - 1; i++) {
    const diff = sorted[i + 1].y - sorted[i].y;
    if (diff < minDisp * 0.95) {
      if (!sorted[i + 1].isFixed) {
        sorted[i + 1].y = Math.min(maxY, sorted[i].y + minDisp * 0.95);
      }
    }
  }

  // Backward sweep guarantee to balance space distribution
  for (let i = sorted.length - 1; i > 0; i--) {
    const diff = sorted[i].y - sorted[i - 1].y;
    if (diff < minDisp * 0.95) {
      if (!sorted[i - 1].isFixed) {
        sorted[i - 1].y = Math.max(minY, sorted[i].y - minDisp * 0.95);
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

export const StockCardVisualizer: React.FC<Props> = ({
  plannedOrders,
  currentPrice = 0,
  onToggleHighlight,
  tabId,
  annotations = [],
  onUpdateAnnotations,
  averageCost,
  averageCostQuantity,
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
}) => {
  const { price: dynamicPrice, isLoading: isCardLoading } = useStockPrice(stockName, currentPrice);

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

  // Annotations State
  const [mode, setMode] = useState<'cursor' | 'line' | 'box' | 'text' | 'eraser' | 'arrow' | 'move'>('cursor');
  const [activeColor, setActiveColor] = useState<string>('#ffffff');
  const [isMobileColorOpen, setIsMobileColorOpen] = useState<boolean>(false);
  const [openSubField, setOpenSubField] = useState<string | null>(null);
  const [activeThickness, setActiveThickness] = useState<number>(2);
  const [activeFontSize, setActiveFontSize] = useState<number>(12);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);
  const [activePoint, setActivePoint] = useState<{ x: number, y: number } | null>(null);
  const [inputCoords, setInputCoords] = useState<{ x: number, y: number } | null>(null);
  const [inputText, setInputText] = useState<string>('');

  // Export states
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportLoading, setExportLoading] = useState<boolean>(false);

  // Local undo history for visual annotations
  const [history, setHistory] = useState<ChartAnnotation[][]>([]);

  const pushToHistoryAndSave = (nextAnnotations: ChartAnnotation[]) => {
    setHistory((prev) => [...prev, annotations]);
    onUpdateAnnotations?.(nextAnnotations);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prevState = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    onUpdateAnnotations?.(prevState);
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

  const annotationsRef = useRef(annotations);
  const onUpdateAnnotationsRef = useRef(onUpdateAnnotations);
  React.useEffect(() => {
    annotationsRef.current = annotations;
    onUpdateAnnotationsRef.current = onUpdateAnnotations;
  }, [annotations, onUpdateAnnotations]);

  const canvasRef = useRef<HTMLDivElement>(null);

  const getRelativeCoords = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  };

  const handleDragStart = (ann: ChartAnnotation, clientX: number, clientY: number) => {
    // 1. Push current states to undo history before starting the drag
    setHistory((prev) => [...prev, annotationsRef.current]);

    // 2. Set coordinate offsets
    const coords = getRelativeCoords(clientX, clientY);
    dragStartCoords.current = coords;
    dragInitialAnn.current = ann;
    setDraggingId(ann.id);
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!draggingId || !dragStartCoords.current || !dragInitialAnn.current) return;
    const currCoords = getRelativeCoords(clientX, clientY);
    const dx = currCoords.x - dragStartCoords.current.x;
    const dy = currCoords.y - dragStartCoords.current.y;

    const nextAnns = annotationsRef.current.map((ann) => {
      if (ann.id !== draggingId) return ann;
      const initial = dragInitialAnn.current!;
      if (initial.type === 'text' || initial.type === 'box') {
        return {
          ...ann,
          x: Math.max(0, Math.min(100, (initial.x ?? 0) + dx)),
          y: Math.max(0, Math.min(100, (initial.y ?? 0) + dy)),
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

    onUpdateAnnotationsRef.current?.(nextAnns);
  };

  const handleDragEnd = () => {
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
      if (prev === 2) return 4;
      if (prev === 4) return 6;
      return 2;
    });
  };

  const handleClearAll = () => {
    if (window.confirm("確定要清除所有繪圖備註與標記嗎？")) {
      pushToHistoryAndSave([]);
    }
  };

  const handleDeleteAnnotation = (idToDelete: string) => {
    pushToHistoryAndSave(annotations.filter((ann) => ann.id !== idToDelete));
  };

  const getCenterCoords = (ann: ChartAnnotation) => {
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
        id: Date.now().toString(),
        type: 'text',
        color: activeColor,
        strokeWidth: activeThickness,
        fontSize: activeFontSize,
        x: inputCoords.x,
        y: inputCoords.y,
        text: inputText,
      };
      pushToHistoryAndSave([...annotations, newAnn]);
    }
    setInputCoords(null);
    setInputText('');
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const coords = getRelativeCoords(e.clientX, e.clientY);
    if (mode === 'text') {
      setInputCoords(coords);
      setInputText('');
    } else if (mode === 'line' || mode === 'box' || mode === 'arrow') {
      setIsDrawing(true);
      setStartPoint(coords);
      setActivePoint(coords);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPoint) return;
    const coords = getRelativeCoords(e.clientX, e.clientY);
    setActivePoint(coords);
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPoint || !activePoint) return;
    setIsDrawing(false);
    
    const dx = Math.abs(activePoint.x - startPoint.x);
    const dy = Math.abs(activePoint.y - startPoint.y);
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 1) { 
      let newAnn: ChartAnnotation | null = null;
      if (mode === 'line') {
        newAnn = {
          id: Date.now().toString(),
          type: 'line',
          color: activeColor,
          strokeWidth: activeThickness,
          x1: startPoint.x,
          y1: startPoint.y,
          x2: activePoint.x,
          y2: activePoint.y,
        };
      } else if (mode === 'arrow') {
        newAnn = {
          id: Date.now().toString(),
          type: 'arrow',
          color: activeColor,
          strokeWidth: activeThickness,
          x1: startPoint.x,
          y1: startPoint.y,
          x2: activePoint.x,
          y2: activePoint.y,
        };
      } else if (mode === 'box') {
        newAnn = {
          id: Date.now().toString(),
          type: 'box',
          color: activeColor,
          strokeWidth: activeThickness,
          x: Math.min(startPoint.x, activePoint.x),
          y: Math.min(startPoint.y, activePoint.y),
          width: Math.abs(activePoint.x - startPoint.x),
          height: Math.abs(activePoint.y - startPoint.y),
        };
      }
      if (newAnn) {
        pushToHistoryAndSave([...annotations, newAnn]);
      }
    }
    setStartPoint(null);
    setActivePoint(null);
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const coords = getRelativeCoords(touch.clientX, touch.clientY);
    if (mode === 'text') {
      setInputCoords(coords);
      setInputText('');
    } else if (mode === 'line' || mode === 'box' || mode === 'arrow') {
      setIsDrawing(true);
      setStartPoint(coords);
      setActivePoint(coords);
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPoint) return;
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const coords = getRelativeCoords(touch.clientX, touch.clientY);
    setActivePoint(coords);
  };

  const handleCanvasTouchEnd = () => {
    if (!isDrawing || !startPoint || !activePoint) return;
    setIsDrawing(false);
    const dx = Math.abs(activePoint.x - startPoint.x);
    const dy = Math.abs(activePoint.y - startPoint.y);
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 1) {
      let newAnn: ChartAnnotation | null = null;
      if (mode === 'line') {
        newAnn = {
          id: Date.now().toString(),
          type: 'line',
          color: activeColor,
          strokeWidth: activeThickness,
          x1: startPoint.x,
          y1: startPoint.y,
          x2: activePoint.x,
          y2: activePoint.y,
        };
      } else if (mode === 'arrow') {
        newAnn = {
          id: Date.now().toString(),
          type: 'arrow',
          color: activeColor,
          strokeWidth: activeThickness,
          x1: startPoint.x,
          y1: startPoint.y,
          x2: activePoint.x,
          y2: activePoint.y,
        };
      } else if (mode === 'box') {
        newAnn = {
          id: Date.now().toString(),
          type: 'box',
          color: activeColor,
          strokeWidth: activeThickness,
          x: Math.min(startPoint.x, activePoint.x),
          y: Math.min(startPoint.y, activePoint.y),
          width: Math.abs(activePoint.x - startPoint.x),
          height: Math.abs(activePoint.y - startPoint.y),
        };
      }
      if (newAnn) {
        pushToHistoryAndSave([...annotations, newAnn]);
      }
    }
    setStartPoint(null);
    setActivePoint(null);
  };

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

    const allPrices = [
      dynamicPrice,
      ...(averageCost && averageCost > 0 ? [averageCost] : []),
      ...validOrders.map((o) => o.price)
    ].filter(
      (p) => p > 0,
    );

    if (allPrices.length === 0) return null;

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

    const getYPct = (p: number) => {
      const pct = ((p - minP) / (maxP - minP)) * 78;
      return 96 - pct;
    };

    const isAlert = (p: number) => {
      return false;
    };

    const leftItems = [
      ...supports.map((s, i) => ({
        id: `s-${i}`,
        text: `支撐 $${s.price}`,
        rawY: getYPct(s.price),
        color: "#facc15",
        isAlert: isAlert(s.price),
        data: s,
      })),
    ];

    const slItems = sls.map((sl, i) => ({
      id: `sl-${i}`,
      text: `止損 $${sl.price}`,
      rawY: getYPct(sl.price),
      color: "#ef4444",
      isAlert: isAlert(sl.price),
      data: sl,
    }));

    const rightItems = [
      ...(dynamicPrice > 0 || isCardLoading
        ? [
            {
              id: "cp",
              text: isCardLoading ? "Loading..." : `現價 $${dynamicPrice}`,
              rawY: getYPct(dynamicPrice > 0 ? dynamicPrice : minP + (maxP - minP) / 2),
              color: "#60a5fa",
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
              text: `均本 $${averageCost.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}${averageCostQuantity && averageCostQuantity !== 0 ? ` (${Math.abs(averageCostQuantity).toLocaleString(undefined, { maximumFractionDigits: 4 })}股)` : ""}`,
              rawY: getYPct(averageCost),
              color: "#f97316",
              isBold: true,
              isAlert: false,
              isAverageCost: true,
              isFixed: false,
            },
          ]
        : [])
    ];

    const entryItems = entries.map((en, i) => ({
      id: `en-${i}`,
      text: `進場 $${en.price}`,
      rawY: getYPct(en.price),
      color: "#57C1D4",
      isAlert: isAlert(en.price),
      data: en,
    }));

    const tpItems = [
      ...tps.map((tp, i) => ({
        id: `tp-${i}`,
        text: `止盈 $${tp.price}`,
        rawY: getYPct(tp.price),
        color: "#10b981",
        isAlert: isAlert(tp.price),
        data: tp,
      })),
      ...resistances.map((r, i) => ({
        id: `r-${i}`,
        text: `壓力 $${r.price}`,
        rawY: getYPct(r.price),
        color: "#f87171",
        isAlert: isAlert(r.price),
        data: r,
      })),
    ];

    const leftLabels = resolveCollisions(leftItems, 4.8);
    const slLabels = resolveCollisions(slItems, 4.8);
    const entryLabels = resolveCollisions(entryItems, 4.8);
    const tpLabels = resolveCollisions(tpItems, 4.8);
    const rightLabels = resolveCollisions(rightItems, 4.8);

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
  }, [plannedOrders, dynamicPrice, averageCost]);

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
    const finalBgColor = isHighlighted ? "#F28D35" : (l.isAlert ? "#f3e8ff" : l.color);
    const finalTextColor = isHighlighted 
      ? "#ffffff"
      : l.isAlert
        ? "#7e22ce"
        : (l.color === "#ef4444" || l.color === "#60a5fa" || l.color === "#f97316" ? "#ffffff" : "#000000");

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

    return (
      <div
        key={l.id}
        className={`absolute whitespace-nowrap transition-all duration-300 font-extrabold px-1 py-0.5 rounded-sm text-[9.5px] sm:text-[10px] md:text-[10.5px] tracking-tight cursor-help select-none hover:scale-105 hover:z-40 active:scale-95 shadow-sm border border-black/10 leading-none ${extraClass} ${blinkClass} ${alertClass}`}
        style={{
          ...style,
          backgroundColor: finalBgColor,
          color: finalTextColor,
          textShadow: "none",
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
        }}
      >
        {l.text}
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
      {/* Absolute Share/Export Button in the Top-Right Corner */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowExportModal(true);
        }}
        className="absolute top-1.5 right-1.5 z-40 flex items-center justify-center rounded-full bg-zinc-100/90 hover:bg-zinc-200 hover:scale-105 active:scale-95 border border-zinc-200 text-zinc-650 hover:text-zinc-900 transition-all cursor-pointer shadow-sm h-5 w-5 sm:h-7 sm:w-7"
        title="匯出圖表模式..."
      >
        <Share2 className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
      </button>

      <div 
        className={`flex flex-wrap sm:flex-wrap items-center justify-center sm:justify-center gap-1 sm:gap-1.5 mb-2 shrink-0 select-none cursor-pointer w-full ${hasActiveStrategy ? "pl-[36px] sm:pl-[54px]" : ""}`}
        onDoubleClick={onRatingBarDoubleClick}
        onTouchEnd={(e) => {
          const now = Date.now();
          const lastTap = (e.currentTarget as any).dataset.lastTap || 0;
          if (now - lastTap < 300) {
            onRatingBarDoubleClick?.(e);
          }
          (e.currentTarget as any).dataset.lastTap = now;
        }}
      >
        <div className="flex items-center border border-zinc-200 rounded overflow-hidden h-4 sm:h-5 bg-zinc-50/80 shrink-0">
          <div className="px-1 sm:px-1.5 h-full flex items-center border-r border-zinc-200">
            <span className="text-[9px] sm:text-[10px] font-black text-zinc-600">
              ★ {ratingVal}
            </span>
          </div>
          <div className="px-1 sm:px-1.5 h-full flex items-center border-r border-zinc-200">
            <span className="text-[9px] sm:text-[10px] font-black text-zinc-600">
              Q {qualityVal}
            </span>
          </div>
          <div className="px-1 sm:px-1.5 h-full flex items-center border-r border-zinc-200">
            <span className="text-[9px] sm:text-[10px] font-black text-zinc-600">
              V {valueVal}
            </span>
          </div>
          <div className="px-1 sm:px-1.5 h-full flex items-center border-r border-zinc-200">
            <span className="text-[9px] sm:text-[10px] font-black text-zinc-600">
              B {buyVal}
            </span>
          </div>
          <div className="px-1 sm:px-1.5 h-full flex items-center border-r border-zinc-200">
            <span className="text-[9px] sm:text-[10px] font-black text-zinc-600">
              S {sellVal}
            </span>
          </div>
          <div className="px-1 sm:px-1.5 h-full flex items-center border-none">
            <span className="text-[9px] sm:text-[10px] font-black text-zinc-600">
              C {crashVal}
            </span>
          </div>
        </div>

        <div className="flex items-center border border-zinc-200 rounded overflow-hidden h-4 sm:h-5 bg-zinc-50/80 shrink-0">
          <div className="px-1 sm:px-1.5 h-full flex items-center border-r border-zinc-200 text-zinc-600">
            <span className="text-[9px] sm:text-[10px] font-black">
              {volatility || "中等"}
            </span>
          </div>
          <div className="px-1 sm:px-1.5 h-full flex items-center border-r border-zinc-200 text-zinc-600" title="Positive Value">
            <span className="text-[9px] sm:text-[10px] font-black">
              P+ {posValue}
            </span>
          </div>
          <div className="px-1 sm:px-1.5 h-full flex items-center text-zinc-600" title="Negative Value">
            <span className="text-[9px] sm:text-[10px] font-black">
              N- {negValue}
            </span>
          </div>
        </div>
      </div>

      {/* Chart container */}
      <div
        ref={canvasRef}
        className="relative flex-1 bg-transparent rounded-lg overflow-hidden flex flex-col"
      >
        <div className="absolute top-2 left-2.5 right-2 flex items-center justify-between z-20 pointer-events-none select-none">
          {stockName && (
            <div className="font-extrabold text-base sm:text-2xl tracking-tighter leading-none text-zinc-900 shrink-0">
              {stockName}
            </div>
          )}
          
          <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
            {/* Strategy Checkboxes */}
            {strategy && (
              <div className="flex items-center gap-0.5 sm:gap-2.5 bg-zinc-100 hover:bg-zinc-200/90 backdrop-blur-md px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full border border-zinc-200 transition-all duration-300 scale-[0.82] sm:scale-100 origin-top-right">
                <label className="flex items-center gap-0.5 sm:gap-1 cursor-pointer group whitespace-nowrap flex-nowrap shrink-0">
                  <input
                    type="checkbox"
                    checked={!!strategy.notesHighlighted}
                    onChange={(e) => onUpdateNotesHighlighted?.(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded border border-zinc-300 bg-white checked:bg-amber-500 checked:border-amber-500 text-amber-600 focus:ring-0 cursor-pointer accent-amber-500 transition-all shrink-0"
                  />
                  <span className={`text-[8.5px] font-bold sm:font-black sm:text-[10px] select-none transition-colors ${strategy.notesHighlighted ? "text-amber-600" : "text-zinc-500 hover:text-zinc-800"}`}>
                    選取
                  </span>
                </label>
                
                <label className="flex items-center gap-0.5 sm:gap-1 cursor-pointer group whitespace-nowrap flex-nowrap shrink-0">
                  <input
                    type="checkbox"
                    checked={!!strategy.tpChecked}
                    onChange={(e) => onUpdateTPChecked?.(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded border border-zinc-300 bg-white checked:bg-emerald-500 checked:border-emerald-500 text-emerald-600 focus:ring-0 cursor-pointer accent-emerald-500 transition-all shrink-0"
                  />
                  <span className={`text-[8.5px] font-bold sm:font-black sm:text-[10px] select-none transition-colors ${strategy.tpChecked ? "text-emerald-600" : "text-zinc-500 hover:text-zinc-800"}`}>
                    止盈
                  </span>
                </label>
                
                <label className="flex items-center gap-0.5 sm:gap-1 cursor-pointer group whitespace-nowrap flex-nowrap shrink-0">
                  <input
                    type="checkbox"
                    checked={!!strategy.slChecked}
                    onChange={(e) => onUpdateSLChecked?.(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded border border-zinc-300 bg-white checked:bg-rose-500 checked:border-rose-500 text-rose-600 focus:ring-0 cursor-pointer accent-rose-500 transition-all shrink-0"
                  />
                  <span className={`text-[8.5px] font-bold sm:font-black sm:text-[10px] select-none transition-colors ${strategy.slChecked ? "text-rose-600" : "text-zinc-500 hover:text-zinc-800"}`}>
                    止損
                  </span>
                </label>
                
                <label className="flex items-center gap-0.5 sm:gap-1 cursor-pointer group whitespace-nowrap flex-nowrap shrink-0">
                  <input
                    type="checkbox"
                    checked={!!strategy.addChecked}
                    onChange={(e) => onUpdateAddChecked?.(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded border border-zinc-300 bg-white checked:bg-sky-500 checked:border-sky-500 text-sky-600 focus:ring-0 cursor-pointer accent-sky-500 transition-all shrink-0"
                  />
                  <span className={`text-[8.5px] font-bold sm:font-black sm:text-[10px] select-none transition-colors ${strategy.addChecked ? "text-sky-600" : "text-zinc-500 hover:text-zinc-800"}`}>
                    加碼
                  </span>
                </label>
                
                <label className="flex items-center gap-0.5 sm:gap-1 cursor-pointer group whitespace-nowrap flex-nowrap shrink-0">
                  <input
                    type="checkbox"
                    checked={!!strategy.closeChecked}
                    onChange={(e) => onUpdateCloseChecked?.(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded border border-zinc-300 bg-white checked:bg-violet-500 checked:border-violet-500 text-violet-600 focus:ring-0 cursor-pointer accent-violet-500 transition-all shrink-0"
                  />
                  <span className={`text-[8.5px] font-bold sm:font-black sm:text-[10px] select-none transition-colors ${strategy.closeChecked ? "text-violet-600" : "text-zinc-500 hover:text-zinc-800"}`}>
                    平倉
                  </span>
                </label>
                
                <label className="flex items-center gap-0.5 sm:gap-1 cursor-pointer group whitespace-nowrap flex-nowrap shrink-0" id="tickbox-observe-label">
                  <input
                    id="tickbox-observe-input"
                    type="checkbox"
                    checked={!!strategy.observeChecked}
                    onChange={(e) => onUpdateObserveChecked?.(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded border border-zinc-300 bg-white checked:bg-[#929292] checked:border-[#929292] text-[#929292] focus:ring-0 cursor-pointer accent-[#929292] transition-all shrink-0"
                  />
                  <span className={`text-[8.5px] font-bold sm:font-black sm:text-[10px] select-none transition-colors ${strategy.observeChecked ? "text-zinc-650" : "text-zinc-500 hover:text-zinc-800"}`}>
                    觀察
                  </span>
                </label>
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
            {[
              { hex: '#ef4444', id: 'arrow-ef4444' },
              { hex: '#10b981', id: 'arrow-10b981' },
              { hex: '#facc15', id: 'arrow-facc15' },
              { hex: '#3b82f6', id: 'arrow-3b82f6' },
              { hex: '#ffffff', id: 'arrow-ffffff' }
            ].map((m) => (
              <marker
                key={m.id}
                id={m.id}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill={m.hex} />
              </marker>
            ))}
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
              stroke="#60a5fa"
              strokeWidth="1.5"
              strokeDasharray="2 2"
              opacity="0.5"
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

          {entries.length > 0 && (
            <g>
              {tps.length > 0 && (
                <path
                  d={`M 42 ${getYPct(dynamicPrice > 0 ? dynamicPrice : entries[entries.length - 1]?.price || 0)} C 52.5 ${getYPct(dynamicPrice > 0 ? dynamicPrice : entries[entries.length - 1]?.price || 0)} 52.5 ${getYPct(tps[0]?.price || 0)} 63 ${getYPct(tps[0]?.price || 0)} ${tps.length > 1 ? `L 63 ${getYPct(tps[tps.length - 1].price)}` : ""}`}
                  stroke="#10b981"
                  fill="none"
                  strokeDasharray="5 5"
                  opacity="0.8"
                  vectorEffect="non-scaling-stroke"
                  strokeWidth="3"
                  filter="url(#glowGreen)"
                />
              )}
              {sls.length > 0 && (
                <path
                  d={`M 42 ${getYPct(dynamicPrice > 0 ? dynamicPrice : entries[0]?.price || 0)} C 31.5 ${getYPct(dynamicPrice > 0 ? dynamicPrice : entries[0]?.price || 0)} 31.5 ${getYPct(sls[0]?.price || 0)} 21 ${getYPct(sls[0]?.price || 0)} ${sls.length > 1 ? `L 21 ${getYPct(sls[sls.length - 1].price)}` : ""}`}
                  stroke="#ef4444"
                  fill="none"
                  strokeDasharray="5 5"
                  opacity="0.8"
                  vectorEffect="non-scaling-stroke"
                  strokeWidth="3"
                  filter="url(#glowRed)"
                />
              )}
            </g>
          )}

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
                x1="42"
                y1={l.rawY}
                x2="44"
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
                x1="63"
                y1={l.rawY}
                x2="65"
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
          {annotations.map((ann) => {
            if (ann.type === 'line' || ann.type === 'arrow') {
              const markerId = ann.type === 'arrow' ? `arrow-${ann.color.replace('#', '')}` : undefined;
              return (
                <line
                  key={ann.id}
                  x1={ann.x1}
                  y1={ann.y1}
                  x2={ann.x2}
                  y2={ann.y2}
                  stroke={ann.color}
                  strokeWidth={ann.strokeWidth}
                  markerEnd={markerId ? `url(#${markerId})` : undefined}
                  vectorEffect="non-scaling-stroke"
                  opacity={mode === 'eraser' || mode === 'move' ? "0.75" : "0.85"}
                  className={`pointer-events-auto transition-all ${
                    mode === 'eraser'
                      ? 'cursor-pointer hover:stroke-red-500 hover:opacity-100 transition-all duration-150 [stroke-dasharray:none]'
                      : mode === 'move'
                      ? 'cursor-move hover:stroke-amber-400 hover:opacity-100 transition-all duration-150'
                      : ''
                  }`}
                  style={
                    mode === 'eraser' || mode === 'move'
                      ? { strokeWidth: Math.max(ann.strokeWidth * 3, 12), cursor: mode === 'move' ? 'move' : 'pointer' }
                      : undefined
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
                      const touch = e.touches[0];
                      handleDragStart(ann, touch.clientX, touch.clientY);
                    }
                  }}
                />
              );
            }
            if (ann.type === 'box') {
              return (
                <rect
                  key={ann.id}
                  x={ann.x}
                  y={ann.y}
                  width={ann.width}
                  height={ann.height}
                  stroke={ann.color}
                  strokeWidth={ann.strokeWidth}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                  opacity={mode === 'eraser' || mode === 'move' ? "0.75" : "0.85"}
                  className={`pointer-events-auto transition-all ${
                    mode === 'eraser'
                      ? 'cursor-pointer hover:stroke-red-500 hover:opacity-100 transition-all duration-150'
                      : mode === 'move'
                      ? 'cursor-move hover:stroke-amber-400 hover:opacity-100 transition-all duration-150'
                      : ''
                  }`}
                  style={
                    mode === 'eraser' || mode === 'move'
                      ? { strokeWidth: Math.max(ann.strokeWidth * 3, 12), cursor: mode === 'move' ? 'move' : 'pointer' }
                      : undefined
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
                      const touch = e.touches[0];
                      handleDragStart(ann, touch.clientX, touch.clientY);
                    }
                  }}
                />
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
              markerEnd={`url(#arrow-${activeColor.replace('#', '')})`}
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
        </svg>

        {/* Floating Drawing interaction canvas handler overlay */}
        {mode !== 'cursor' && mode !== 'eraser' && mode !== 'move' && (
          <div
            className="absolute inset-0 z-30 touch-none select-none cursor-crosshair pb-8"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
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
              left: `${inputCoords.x}%`,
              top: `${inputCoords.y}%`,
            }}
            className="absolute z-50 -translate-y-1/2 flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onBlur={() => handleTextSubmit()}
              placeholder="輸入備註文字..."
              className="bg-black/95 border border-white/20 text-white rounded px-2 py-1 outline-none shadow-2xl min-w-[120px] focus:ring-1 focus:ring-blue-500 font-black leading-none"
              style={{ color: activeColor, fontSize: `${activeFontSize}px` }}
            />
          </form>
        )}

        {/* Clean, Non-scaled HTML Overlay for Dots & Text Layer */}
        <div
          className="absolute inset-0 pointer-events-none text-[10px] leading-none"
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
          {entries.map((en, i) => (
            <div
              key={`en-dot-${i}`}
              className="absolute w-2 h-2 rounded-full bg-[#57C1D4]"
              style={{
                left: "42%",
                top: `${getYPct(en.price)}%`,
                transform: "translate(-50%, -50%)",
                opacity: 0.8,
                boxShadow: "0 0 5px #57C1D4",
              }}
            />
          ))}
          {tps.map((tp, i) => (
            <div
              key={`tp-dot-${i}`}
              className="absolute w-2 h-2 rounded-full bg-[#10b981]"
              style={{
                left: "63%",
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
                left: "63%",
                top: `${getYPct(r.price)}%`,
                transform: "translate(-50%, -50%)",
                opacity: 0.8,
                boxShadow: "0 0 5px #f87171",
              }}
            />
          ))}

          {/* Left Labels (S/R) */}
          <div className="pointer-events-auto">
            {leftLabels.map((l) =>
              renderLabel(l, "left-1", {
                top: `${l.y}%`,
                transform: "translateY(-50%)",
              }),
            )}
          </div>

          {/* Current Price */}
          <div className="pointer-events-auto">
            {rightLabels.map((l) =>
              renderLabel(l, "right-1", {
                top: `${l.y}%`,
                transform: "translateY(-50%)",
              }),
            )}
          </div>

          {/* SL Labels */}
          <div className="pointer-events-auto">
            {slLabels.map((l) =>
              renderLabel(l, "left-[23%]", {
                top: `${l.y}%`,
                transform: "translateY(-50%)",
              }),
            )}
          </div>

          {/* Entry Labels */}
          <div className="pointer-events-auto">
            {entryLabels.map((l) =>
              renderLabel(l, "left-[44%]", {
                top: `${l.y}%`,
                transform: "translateY(-50%)",
              }),
            )}
          </div>

          {/* TP Labels */}
          <div className="pointer-events-auto">
            {tpLabels.map((l) =>
              renderLabel(l, "left-[65%]", {
                top: `${l.y}%`,
                transform: "translateY(-50%)",
              }),
            )}
          </div>

          {/* Render Vector-Correct Text Annotations in HTML Space */}
          {annotations.map((ann) => {
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
                  }}
                  className={`absolute z-40 font-black tracking-wide whitespace-nowrap drop-shadow-[0_1.5px_2px_rgba(0,0,0,1)] select-none pointer-events-auto transition-all ${
                    mode === 'eraser'
                      ? 'cursor-pointer hover:text-red-500 hover:scale-110 active:scale-90 bg-red-500/10 px-1 rounded border border-dashed border-red-500/30'
                      : mode === 'move'
                      ? 'cursor-move hover:text-amber-400 hover:scale-105 bg-amber-500/10 px-1 rounded border border-dashed border-amber-500/30'
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
                      const touch = e.touches[0];
                      handleDragStart(ann, touch.clientX, touch.clientY);
                    }
                  }}
                >
                  {ann.text}
                </div>
              );
            }
            return null;
          })}

          {/* Visual indicator deletion dots & close icons during Interactive cursor mode */}
          {mode === 'cursor' && annotations.map((ann) => {
            const center = getCenterCoords(ann);
            return (
              <div
                key={`del-${ann.id}`}
                style={{
                  left: `${center.x}%`,
                  top: `${center.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute z-[45] pointer-events-auto group/del"
              >
                {/* Micro circle representing annotation target anchor, colored according to style */}
                <div 
                  className="w-1.5 h-1.5 rounded-full border border-black/50 shadow shadow-black flex items-center justify-center transition-all duration-200 cursor-pointer group-hover/del:scale-125 bg-white/20" 
                  style={{ backgroundColor: ann.color }}
                />
                
                {/* Deletion handle triggers on hover */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAnnotation(ann.id);
                  }}
                  className="hidden group-hover/del:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4.5 h-4.5 items-center justify-center bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg border border-white/25 text-[8px] font-black transition-colors"
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
          </div>
        )}
      </div>

      {/* COMPACT BAR AT THE BOTTOM OF CARD (Signal checkboxes in first row, Drawing toolbar in second row) */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col gap-1.5 mt-1 shrink-0 z-50 pointer-events-auto select-none w-full px-1 animate-fadeIn"
      >
        {/* Row 1: Main Path (主力路徑) Phase Tickboxes with Dynamic Stage Selection (前期, 中期, 後期) */}
        <div className="flex justify-center w-full my-1">
          <div className="flex flex-row flex-wrap sm:flex-nowrap items-center justify-center gap-1 sm:gap-1.5 p-1 px-1.5 sm:px-2.5 bg-white/40 backdrop-blur-md border border-zinc-200/80 rounded-2xl sm:rounded-full shadow-none shrink-0 overflow-visible max-w-full select-none">
            {/* Permanent Label "主力路徑" */}
            <div className="flex items-center justify-center bg-zinc-900/10 px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">
              <span className="text-[8px] sm:text-[9px] font-black text-zinc-900 select-none tracking-wider whitespace-nowrap">
                主力路徑
              </span>
            </div>

            {[
              {
                key: "accumulation",
                label: "吸籌",
                checkedKey: "pathAccumulationChecked",
                stageKey: "pathAccumulationStage",
                theme: {
                  activeBg: "rgba(217, 119, 6, 0.15)",
                  activeBorder: "#D97706",
                  activeText: "#000000",
                }
              },
              {
                key: "wash",
                label: "洗盤",
                checkedKey: "pathWashChecked",
                stageKey: "pathWashStage",
                theme: {
                  activeBg: "rgba(217, 119, 6, 0.15)",
                  activeBorder: "#D97706",
                  activeText: "#000000",
                }
              },
              {
                key: "test",
                label: "試升",
                checkedKey: "pathTestChecked",
                stageKey: "pathTestStage",
                theme: {
                  activeBg: "rgba(217, 119, 6, 0.15)",
                  activeBorder: "#D97706",
                  activeText: "#000000",
                }
              },
              {
                key: "rally",
                label: "拉升",
                checkedKey: "pathRallyChecked",
                stageKey: "pathRallyStage",
                theme: {
                  activeBg: "rgba(22, 163, 74, 0.15)",
                  activeBorder: "#16A34A",
                  activeText: "#000000",
                }
              },
              {
                key: "distribution",
                label: "出貨",
                checkedKey: "pathDistributionChecked",
                stageKey: "pathDistributionStage",
                theme: {
                  activeBg: "rgba(220, 38, 38, 0.15)",
                  activeBorder: "#DC2626",
                  activeText: "#000000",
                }
              }
            ].map((phase) => {
              const isChecked = !!strategy?.[phase.checkedKey as keyof typeof strategy];
              const currentStage = (strategy?.[phase.stageKey as keyof typeof strategy] as string) || "前期";
              
              const activeBg = isChecked ? phase.theme.activeBg : "transparent";
              const activeBorder = isChecked ? phase.theme.activeBorder : "rgba(9, 9, 11, 0.12)";
              const activeText = isChecked ? "#000000" : "#4b5563";

              const handleDotClick = (e: React.MouseEvent) => {
                e.stopPropagation();
                const nextChecked = !isChecked;
                onUpdateStrategyField?.(phase.checkedKey, nextChecked);
                if (nextChecked) {
                  if (!strategy?.[phase.stageKey as keyof typeof strategy]) {
                    onUpdateStrategyField?.(phase.stageKey, "前期");
                  }
                  setOpenSubField(phase.key);
                } else {
                  if (openSubField === phase.key) {
                    setOpenSubField(null);
                  }
                }
              };

              const handleLabelClick = (e: React.MouseEvent) => {
                e.stopPropagation();
                if (isChecked) {
                  setOpenSubField(openSubField === phase.key ? null : phase.key);
                } else {
                  onUpdateStrategyField?.(phase.checkedKey, true);
                  if (!strategy?.[phase.stageKey as keyof typeof strategy]) {
                    onUpdateStrategyField?.(phase.stageKey, "前期");
                  }
                  setOpenSubField(phase.key);
                }
              };

              return (
                <div key={phase.key} className="relative flex items-center shrink-0">
                  <div
                    onClick={handleLabelClick}
                    style={{
                      backgroundColor: activeBg,
                      borderColor: activeBorder,
                    }}
                    className="flex items-center px-1 sm:px-2 py-0.5 border rounded-full transition-all duration-300 select-none shrink-0 cursor-pointer hover:brightness-110"
                  >
                    {/* Circle Dot Zone */}
                    {isChecked ? (
                      <span
                        onClick={handleDotClick}
                        className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full mr-1 sm:mr-1.5 flex-shrink-0 cursor-pointer transition-transform hover:scale-125 bg-black"
                      />
                    ) : (
                      <span
                        onClick={handleDotClick}
                        className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full border border-zinc-400 mr-1 sm:mr-1.5 flex-shrink-0 cursor-pointer hover:border-zinc-800 transition-colors"
                      />
                    )}

                    {/* Text / Dropdown Zone */}
                    <div
                      style={{ color: activeText }}
                      className="flex items-center gap-0.5 text-[7.5px] sm:text-[8.5px] font-black whitespace-nowrap select-none"
                    >
                      <span>{phase.label}</span>
                      {isChecked && (
                        <span className="text-[6.8px] sm:text-[7.5px] font-black opacity-90">
                          ({currentStage})
                        </span>
                      )}
                      {isChecked && (
                        <span className="text-[6.8px] sm:text-[7.5px] ml-0.5 opacity-90 select-none">▾</span>
                      )}
                    </div>
                  </div>

                  {/* Dropdown Popover */}
                  {openSubField === phase.key && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-0.5 bg-white border border-zinc-200 rounded-full shadow-lg flex flex-row items-center gap-0.5 z-[100] animate-fadeIn whitespace-nowrap"
                    >
                      {/* Triangle Pointer */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-white" />
                      {["前期", "中期", "後期"].map((stg) => {
                        const isActive = currentStage === stg;
                        return (
                          <button
                            key={stg}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateStrategyField?.(phase.stageKey, stg);
                              setOpenSubField(null);
                            }}
                            className={`px-3 py-1 text-[8px] sm:text-[8.5px] font-black rounded-full transition-all cursor-pointer whitespace-nowrap ${
                              isActive
                                ? "bg-zinc-900 text-white shadow-md font-black"
                                : "text-zinc-500 hover:text-zinc-900 bg-transparent"
                            }`}
                          >
                            {stg}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Row 2: Drawing Toolbar */}
        <div className="flex justify-center w-full mt-0.5">
          <div className="flex items-center gap-0 sm:gap-0.5 p-[2px] px-0.5 sm:px-1 bg-white/40 border border-zinc-200/80 backdrop-blur-md rounded-md shadow-none shrink-0">
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

            {/* Rich Color Selection */}
            <div className="flex items-center gap-[3px] px-0.5 shrink-0 relative">
              {/* PC version (always visible) */}
              <div className="hidden sm:flex items-center gap-[3px]">
                {[
                  { hex: '#ef4444', name: '止損紅' },
                  { hex: '#10b981', name: '止盈綠' },
                  { hex: '#facc15', name: '關鍵黃' },
                  { hex: '#3b82f6', name: '系統藍' },
                  { hex: '#000000', name: '亮色黑' }
                ].map((col) => (
                  <button
                    key={col.hex}
                    type="button"
                    title={col.name}
                    onClick={() => setActiveColor(col.hex)}
                    style={{ backgroundColor: col.hex }}
                    className={`w-2 h-2 rounded-full border border-black/30 transition-transform ${activeColor === col.hex ? 'scale-110 ring-1 ring-zinc-400' : 'opacity-65 hover:opacity-100 hover:scale-105'}`}
                  />
                ))}
              </div>

              {/* Mobile version (compact, click to expand) */}
              <div className="flex sm:hidden items-center relative">
                <button
                  type="button"
                  className="w-2.5 h-2.5 rounded-full border border-zinc-400 shadow-sm"
                  style={{ backgroundColor: activeColor }}
                  onClick={() => setIsMobileColorOpen(!isMobileColorOpen)}
                />
                
                {isMobileColorOpen && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white border border-zinc-200 rounded-lg p-1.5 shadow-2xl flex flex-col gap-2 z-[100]">
                    {[
                      { hex: '#ef4444', name: '止損紅' },
                      { hex: '#10b981', name: '止盈綠' },
                      { hex: '#facc15', name: '關鍵黃' },
                      { hex: '#3b82f6', name: '系統藍' },
                      { hex: '#000000', name: '亮色黑' }
                    ].map((col) => (
                      <button
                        key={col.hex}
                        type="button"
                        title={col.name}
                        onClick={() => {
                          setActiveColor(col.hex);
                          setIsMobileColorOpen(false);
                        }}
                        style={{ backgroundColor: col.hex }}
                        className={`w-4 h-4 rounded-full border border-black/30 transition-transform ${activeColor === col.hex ? 'scale-110 ring-2 ring-zinc-400' : 'opacity-85 hover:opacity-100'}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {annotations.length > 0 && (
              <>
                <div className="w-[1px] h-2.5 bg-zinc-300/80 mx-0.5 shrink-0" />
                {/* Clear All Button */}
                <button
                  type="button"
                  title="清除此圖表所有備註"
                  onClick={handleClearAll}
                  className="p-0.5 rounded text-red-600 hover:text-red-800 hover:bg-red-500/10 transition-colors shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showExportModal && (
        <div 
          className="absolute inset-0 bg-white/60 backdrop-blur-md border border-zinc-200/80 z-[200] flex flex-col items-center justify-center p-4 rounded-xl animate-fadeIn pointer-events-auto select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button in top right */}
          <button 
            onClick={() => setShowExportModal(false)}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-zinc-950/5 hover:bg-zinc-950/10 text-zinc-650 hover:text-zinc-900 transition-all cursor-pointer z-50 text-xs w-6 h-6 flex items-center justify-center font-bold border border-zinc-200/80"
          >
            ✕
          </button>
          
          <div className="w-full max-w-sm flex flex-col text-center">
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
