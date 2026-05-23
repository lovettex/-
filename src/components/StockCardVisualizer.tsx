import React, { useMemo, useState, useRef } from "react";
import { PlannedOrder, ChartAnnotation } from "../types";
import { MousePointer, Minus, Square, Type, Trash2, Eraser, Undo2, ArrowUpRight, Move } from "lucide-react";

interface Props {
  plannedOrders: PlannedOrder[];
  currentPrice?: number;
  onToggleHighlight?: (orderId: string, currentStatus: boolean) => void;
  tabId?: string;
  annotations?: ChartAnnotation[];
  onUpdateAnnotations?: (annotations: ChartAnnotation[]) => void;
  averageCost?: number;
  stockName?: string;
  rating?: number;
  qualityScore?: number;
  valueScore?: number;
  crashSimilarity?: number;
  buyRate?: number;
  sellRate?: number;
  volatility?: "低" | "中等" | "高";
}

function resolveCollisions<T extends { rawY: number; isFixed?: boolean }>(

  items: T[],
  minDisp: number,
): (T & { y: number })[] {
  if (items.length === 0) return [];
  let sorted = [...items]
    .sort((a, b) => a.rawY - b.rawY)
    .map((item) => ({ ...item, y: item.rawY }));

  for (let iter = 0; iter < 50; iter++) {
    let changed = false;

    for (let i = 0; i < sorted.length; i++) {
      if (!sorted[i].isFixed) {
        if (sorted[i].y < 3) {
          sorted[i].y = 3;
          changed = true;
        }
        if (sorted[i].y > 97) {
          sorted[i].y = 97;
          changed = true;
        }
      }
    }

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
    if (!changed) break;
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const diff = sorted[i + 1].y - sorted[i].y;
    if (diff < minDisp * 0.9) {
      if (!sorted[i + 1].isFixed && !sorted[i].isFixed) {
        sorted[i + 1].y = sorted[i].y + minDisp * 0.9;
      } else if (!sorted[i + 1].isFixed && sorted[i].isFixed) {
        sorted[i + 1].y = sorted[i].y + minDisp * 0.9;
      } else if (sorted[i + 1].isFixed && !sorted[i].isFixed) {
        sorted[i].y = sorted[i + 1].y - minDisp * 0.9;
      }
    }
  }

  sorted.forEach((item) => {
    if (!item.isFixed) {
      item.y = Math.max(3, Math.min(97, item.y));
    }
  });
  return sorted;
}

export const StockCardVisualizer: React.FC<Props> = ({
  plannedOrders,
  currentPrice = 0,
  onToggleHighlight,
  tabId,
  annotations = [],
  onUpdateAnnotations,
  averageCost,
  stockName,
  rating,
  qualityScore,
  valueScore,
  crashSimilarity,
  buyRate,
  sellRate,
  volatility,
}) => {
  const [hoveredLabel, setHoveredLabel] = useState<any>(null);
  const longPressTimers = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Annotations State
  const [mode, setMode] = useState<'cursor' | 'line' | 'box' | 'text' | 'eraser' | 'arrow' | 'move'>('cursor');
  const [activeColor, setActiveColor] = useState<string>('#ffffff');
  const [activeThickness, setActiveThickness] = useState<number>(2);
  const [activeFontSize, setActiveFontSize] = useState<number>(12);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);
  const [activePoint, setActivePoint] = useState<{ x: number, y: number } | null>(null);
  const [inputCoords, setInputCoords] = useState<{ x: number, y: number } | null>(null);
  const [inputText, setInputText] = useState<string>('');

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
      currentPrice,
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
      const pct = ((p - minP) / (maxP - minP)) * 100;
      return 100 - pct;
    };

    const isAlert = (p: number) => {
      const cp = Number(currentPrice);
      const targetP = Number(p);
      if (isNaN(cp) || isNaN(targetP) || cp <= 0 || targetP <= 0) return false;
      return Math.abs(cp - targetP) / targetP <= 0.021;
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
      ...resistances.map((r, i) => ({
        id: `r-${i}`,
        text: `壓力 $${r.price}`,
        rawY: getYPct(r.price),
        color: "#f87171",
        isAlert: isAlert(r.price),
        data: r,
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
      ...(currentPrice > 0
        ? [
            {
              id: "cp",
              text: `現價 $${currentPrice}`,
              rawY: getYPct(currentPrice),
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
              })}`,
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

    const tpItems = tps.map((tp, i) => ({
      id: `tp-${i}`,
      text: `止盈 $${tp.price}`,
      rawY: getYPct(tp.price),
      color: "#10b981",
      isAlert: isAlert(tp.price),
      data: tp,
    }));

    const leftLabels = resolveCollisions(leftItems, 3.5);
    const slLabels = resolveCollisions(slItems, 3.5);
    const entryLabels = resolveCollisions(entryItems, 3.5);
    const tpLabels = resolveCollisions(tpItems, 3.5);
    const rightLabels = resolveCollisions(rightItems, 3.5);

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
  }, [plannedOrders, currentPrice, averageCost]);

  if (!data)
    return (
      <div className="text-white/40 text-[10px] flex items-center justify-center h-full">
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

    return (
      <div
        key={l.id}
        className={`absolute whitespace-nowrap transition-all duration-300 font-bold px-1.5 py-0.5 rounded text-[11px] tracking-wide cursor-help select-none ${extraClass} ${blinkClass} ${alertClass}`}
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

  const posValue = Math.max(0, Number(rating||5) - 5) + Math.max(0, Number(qualityScore||5) - 5) + Math.max(0, Number(valueScore||5) - 5) + Number(buyRate||5);
  const negValue = Math.max(0, 5 - Number(rating||5)) + Math.max(0, 5 - Number(qualityScore||5)) + Math.max(0, 5 - Number(valueScore||5)) + Number(sellRate||5);

  return (
    <div
      className="w-full h-full p-2 relative flex flex-col rounded-xl pointer-events-auto"
      style={{ isolation: "isolate" }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Score Header */}
      <div className="flex flex-wrap justify-center items-center gap-2 mb-1 shrink-0">
        <div className="flex items-center border rounded-md overflow-hidden h-[18px] border-white/10 bg-white/5">
          <div className="px-1.5 h-full flex items-center border-r border-white/10">
            <span className="text-[9px] font-black text-yellow-500">★ {rating || 5}</span>
          </div>
          <div className="px-1.5 h-full flex items-center border-r border-white/10">
            <span className="text-[9px] font-black text-purple-400">Q {qualityScore || 5}</span>
          </div>
          <div className="px-1.5 h-full flex items-center border-r border-white/10">
            <span className="text-[9px] font-black text-amber-500">V {valueScore || 5}</span>
          </div>
          <div className="px-1.5 h-full flex items-center border-r border-white/10">
            <span className="text-[9px] font-black text-cyan-400">C {crashSimilarity !== undefined ? crashSimilarity : 5}</span>
          </div>
          <div className="px-1.5 h-full flex items-center bg-emerald-500/10 text-emerald-600 border-r border-white/10">
            <span className="text-[9px] font-black">B {buyRate || 5}</span>
          </div>
          <div className="px-1.5 h-full flex items-center bg-rose-500/10 text-rose-600">
            <span className="text-[9px] font-black">S {sellRate || 5}</span>
          </div>
        </div>

        <div className="flex items-center border rounded-md overflow-hidden h-[18px] border-white/10 bg-white/5">
          <div className="px-1.5 h-full flex items-center border-r border-white/10">
            <span className="text-[9px] font-black text-indigo-400">🌊 {volatility || "中"}</span>
          </div>
          <div className="px-1.5 h-full flex items-center border-r border-white/10">
            <span className="text-[9px] font-black text-emerald-400">P +{posValue}</span>
          </div>
          <div className="px-1.5 h-full flex items-center">
            <span className="text-[9px] font-black text-rose-400">N -{negValue}</span>
          </div>
        </div>
      </div>

      {/* Chart container */}
      <div
        ref={canvasRef}
        className="relative flex-1 opacity-90 backdrop-blur-md bg-white/5 rounded-lg border border-white/10 overflow-hidden shadow-inner flex flex-col"
      >
        {stockName && (
          <div className="absolute top-2 left-2.5 z-20 font-black text-2xl tracking-tighter leading-none text-white pointer-events-none select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
            {stockName}
          </div>
        )}

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
                stroke="#facc15"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                opacity="0.4"
              />
              <rect
                x="0"
                y={getYPct(s.price)}
                width="100"
                height={100 - getYPct(s.price)}
                fill="#facc15"
                opacity="0.08"
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
                stroke="#f87171"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                opacity="0.4"
              />
              <rect
                x="0"
                y="0"
                width="100"
                height={getYPct(r.price)}
                fill="#f87171"
                opacity="0.08"
              />
            </g>
          ))}

          {currentPrice > 0 && (
            <line
              x1="0"
              y1={getYPct(currentPrice)}
              x2="100"
              y2={getYPct(currentPrice)}
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
                  d={`M 48 ${getYPct(currentPrice > 0 ? currentPrice : entries[entries.length - 1]?.price || 0)} C 60 ${getYPct(currentPrice > 0 ? currentPrice : entries[entries.length - 1]?.price || 0)} 60 ${getYPct(tps[0]?.price || 0)} 72 ${getYPct(tps[0]?.price || 0)} ${tps.length > 1 ? `L 72 ${getYPct(tps[tps.length - 1].price)}` : ""}`}
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
                  d={`M 48 ${getYPct(currentPrice > 0 ? currentPrice : entries[0]?.price || 0)} C 36 ${getYPct(currentPrice > 0 ? currentPrice : entries[0]?.price || 0)} 36 ${getYPct(sls[0]?.price || 0)} 24 ${getYPct(sls[0]?.price || 0)} ${sls.length > 1 ? `L 24 ${getYPct(sls[sls.length - 1].price)}` : ""}`}
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
                x1="24"
                y1={l.rawY}
                x2="26"
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
                x1="48"
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
                x1="72"
                y1={l.rawY}
                x2="74"
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
                left: "24%",
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
                left: "48%",
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
                left: "72%",
                top: `${getYPct(tp.price)}%`,
                transform: "translate(-50%, -50%)",
                opacity: 0.8,
                boxShadow: "0 0 5px #10b981",
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
              renderLabel(l, "left-[26%]", {
                top: `${l.y}%`,
                transform: "translateY(-50%)",
              }),
            )}
          </div>

          {/* Entry Labels */}
          <div className="pointer-events-auto">
            {entryLabels.map((l) =>
              renderLabel(l, "left-[50%]", {
                top: `${l.y}%`,
                transform: "translateY(-50%)",
              }),
            )}
          </div>

          {/* TP Labels */}
          <div className="pointer-events-auto">
            {tpLabels.map((l) =>
              renderLabel(l, "left-[74%]", {
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

      {/* COMPACT TOOLBAR AT THE BOTTOM OF CARD (Sits nicely underneath the chart within outer card flex flow) */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="flex justify-center mt-1 shrink-0 z-50 pointer-events-auto select-none"
      >
        <div className="flex items-center gap-0.5 p-[2px] px-1 bg-black/95 border border-white/10 backdrop-blur-md rounded-md shadow-2xl max-w-full overflow-x-auto">
          {/* Cursor Interactive Mode Button */}
          <button
            type="button"
            title="互動標籤"
            onClick={() => { setMode('cursor'); setInputCoords(null); }}
            className={`p-0.5 rounded transition-colors shrink-0 ${mode === 'cursor' ? 'bg-blue-500/20 text-blue-400' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <MousePointer className="w-3 h-3" />
          </button>

          {/* Move Annotation Mode Button */}
          <button
            type="button"
            title="拖曳移動標記"
            onClick={() => { setMode('move'); setInputCoords(null); }}
            className={`p-0.5 rounded transition-colors shrink-0 ${mode === 'move' ? 'bg-blue-500/20 text-blue-400' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <Move className="w-3 h-3" />
          </button>
          
          <div className="w-[1px] h-2.5 bg-white/10 mx-0.5 shrink-0" />
          
          {/* Rectangle Mode Button */}
          <button
            type="button"
            title="畫方框"
            onClick={() => { setMode('box'); setInputCoords(null); }}
            className={`p-0.5 rounded transition-colors shrink-0 ${mode === 'box' ? 'bg-blue-500/20 text-blue-400' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <Square className="w-3 h-3" />
          </button>
          
          {/* Line Mode Button */}
          <button
            type="button"
            title="畫線"
            onClick={() => { setMode('line'); setInputCoords(null); }}
            className={`p-0.5 rounded transition-colors shrink-0 ${mode === 'line' ? 'bg-blue-500/20 text-blue-400' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <Minus className="w-3 h-3" />
          </button>

          {/* Arrow Mode Button */}
          <button
            type="button"
            title="箭頭指向"
            onClick={() => { setMode('arrow'); setInputCoords(null); }}
            className={`p-0.5 rounded transition-colors shrink-0 ${mode === 'arrow' ? 'bg-blue-500/20 text-blue-400' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <ArrowUpRight className="w-3 h-3" />
          </button>
          
          {/* Text Annotation Mode Button */}
          <button
            type="button"
            title="打文字"
            onClick={() => { setMode('text'); }}
            className={`p-0.5 rounded transition-colors shrink-0 ${mode === 'text' ? 'bg-blue-500/20 text-blue-400' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <Type className="w-3 h-3" />
          </button>

          {/* Eraser Mode Button */}
          <button
            type="button"
            title="橡皮擦工具"
            onClick={() => { setMode('eraser'); setInputCoords(null); }}
            className={`p-0.5 rounded transition-colors shrink-0 ${mode === 'eraser' ? 'bg-red-500/20 text-red-400' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <Eraser className="w-3 h-3" />
          </button>
          
          <div className="w-[1px] h-2.5 bg-white/10 mx-0.5 shrink-0" />

          {/* Undo Button */}
          <button
            type="button"
            title="上一步"
            onClick={handleUndo}
            disabled={history.length === 0}
            className={`p-0.5 rounded transition-colors shrink-0 ${history.length > 0 ? 'text-amber-400 hover:text-amber-300 hover:bg-white/5' : 'text-white/20 cursor-not-allowed'}`}
          >
            <Undo2 className="w-3 h-3" />
          </button>
          
          <div className="w-[1px] h-2.5 bg-white/10 mx-0.5 shrink-0" />

          {/* Stroke Width Cycle Control */}
          <button
            type="button"
            title={`粗細: ${activeThickness}px`}
            onClick={cycleThickness}
            className="p-0.5 px-1 rounded hover:bg-white/5 transition-colors flex items-center gap-0.5 shrink-0"
          >
            <span className="text-[8px] font-medium text-white/50 tracking-tighter">粗</span>
            <span className="bg-white/10 rounded px-1 py-0.25 text-white font-bold text-[8px]">{activeThickness}px</span>
          </button>
          
          <div className="w-[1px] h-2.5 bg-white/10 mx-0.5 shrink-0" />

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
            className="p-0.5 px-1 rounded hover:bg-white/5 transition-colors flex items-center gap-0.5 shrink-0"
          >
            <span className="text-[8px] font-medium text-white/50 tracking-tighter">字</span>
            <span className="bg-white/10 rounded px-1 py-0.25 text-white font-bold text-[8px]">{activeFontSize}px</span>
          </button>
          
          <div className="w-[1px] h-2.5 bg-white/10 mx-0.5 shrink-0" />

          {/* Rich Color Selection */}
          <div className="flex items-center gap-[3px] px-0.5 shrink-0">
            {[
              { hex: '#ef4444', name: '止損紅' },
              { hex: '#10b981', name: '止盈綠' },
              { hex: '#facc15', name: '關鍵黃' },
              { hex: '#3b82f6', name: '系統藍' },
              { hex: '#ffffff', name: '亮色白' }
            ].map((col) => (
              <button
                key={col.hex}
                type="button"
                title={col.name}
                onClick={() => setActiveColor(col.hex)}
                style={{ backgroundColor: col.hex }}
                className={`w-2 h-2 rounded-full border border-black/30 transition-transform ${activeColor === col.hex ? 'scale-110 ring-1 ring-white/50' : 'opacity-60 hover:opacity-100 hover:scale-105'}`}
              />
            ))}
          </div>

          {annotations.length > 0 && (
            <>
              <div className="w-[1px] h-2.5 bg-white/10 mx-0.5 shrink-0" />
              {/* Clear All Button */}
              <button
                type="button"
                title="清除此圖表所有備註"
                onClick={handleClearAll}
                className="p-0.5 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
