import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Save,
  Check,
  CheckCircle2,
  Loader2,
  Layers,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
  Compass,
  ArrowDownCircle,
  Gem,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { playClickSound, playSuccessSound } from "../lib/audio";
import { HOLDING_CONFIG, PositionMap } from "./DynamicVisualLinesModal";
import {
  getVisualLinesDataSync,
  revalidateVisualLinesDataAsync,
  saveVisualLinesDataOptimistic,
} from "../utils/visualLinesStorage";

interface MiniVisualLinesModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockName: string;
  currentPrice?: number;
  holdingStatus?: string;
  tradeType?: string;
  userId?: string;
}

interface AxisOption {
  id: string;
  type: "line" | "zone";
  axisLetter: string;
  title: string;
  subtitle: string;
  yPercent: number;
  color: string;
  bgColor: string;
  borderColor: string;
  tagColor: string;
  rangeText?: string;
}

// 1. 分隔線上項目定義 (On Divider Lines)
const AXIS_LINES: AxisOption[] = [
  {
    id: "line-d",
    type: "line",
    axisLetter: "D",
    title: "黑色分隔線：D 軸（基準中軸）",
    subtitle: "Base / 成本平衡基準線",
    yPercent: 44,
    color: "#000000",
    bgColor: "bg-zinc-100",
    borderColor: "border-zinc-900",
    tagColor: "bg-zinc-900 text-white",
  },
  {
    id: "line-b",
    type: "line",
    axisLetter: "B",
    title: "藍色分隔線：B 軸（回檔加碼支撐）",
    subtitle: "Support / 回檔支撐加碼線",
    yPercent: 60,
    color: "#2563EB",
    bgColor: "bg-blue-50/60",
    borderColor: "border-blue-500",
    tagColor: "bg-blue-600 text-white",
  },
  {
    id: "line-g",
    type: "line",
    axisLetter: "G",
    title: "綠色分隔線：G 軸（底部強力買進）",
    subtitle: "Floor / 底部強力買進線",
    yPercent: 76,
    color: "#16A34A",
    bgColor: "bg-emerald-50/60",
    borderColor: "border-emerald-500",
    tagColor: "bg-emerald-600 text-white",
  },
  {
    id: "line-y-top",
    type: "line",
    axisLetter: "Y",
    title: "黃色分隔線：Y 軸（頂部獲利）",
    subtitle: "Take Profit / 極限超買出脫線",
    yPercent: 12,
    color: "#EAB308",
    bgColor: "bg-amber-50/60",
    borderColor: "border-amber-500",
    tagColor: "bg-amber-500 text-zinc-950",
  },
  {
    id: "line-y-bottom",
    type: "line",
    axisLetter: "Y",
    title: "黃色分隔線：Y 軸（深幅價值）",
    subtitle: "Deep Value / 極限超跌超賣線",
    yPercent: 90,
    color: "#EAB308",
    bgColor: "bg-amber-50/60",
    borderColor: "border-amber-500",
    tagColor: "bg-amber-500 text-zinc-950",
  },
  {
    id: "line-r",
    type: "line",
    axisLetter: "R",
    title: "紅色分隔線：R 軸（停損警戒阻力）",
    subtitle: "Stop Loss / 阻力警戒停損線",
    yPercent: 28,
    color: "#EF4444",
    bgColor: "bg-rose-50/60",
    borderColor: "border-rose-500",
    tagColor: "bg-rose-600 text-white",
  },
];

// 2. 區間項目定義 (Axis Zones / Intervals)
const AXIS_ZONES: AxisOption[] = [
  {
    id: "zone-y-r",
    type: "zone",
    axisLetter: "Y-R",
    title: "Y - R 區間（頂部獲利 ~ 停損警戒）",
    subtitle: "極限超買與獲利出脫區間",
    yPercent: 20,
    rangeText: "12% ~ 28%",
    color: "#F59E0B",
    bgColor: "bg-amber-50/40",
    borderColor: "border-amber-300",
    tagColor: "bg-gradient-to-r from-amber-500 to-rose-500 text-white",
  },
  {
    id: "zone-r-d",
    type: "zone",
    axisLetter: "R-D",
    title: "R - D 區間（停損警戒 ~ 基準中軸）",
    subtitle: "阻力警戒與中軸整理區間",
    yPercent: 36,
    rangeText: "28% ~ 44%",
    color: "#EF4444",
    bgColor: "bg-rose-50/40",
    borderColor: "border-rose-300",
    tagColor: "bg-gradient-to-r from-rose-500 to-zinc-800 text-white",
  },
  {
    id: "zone-d-b",
    type: "zone",
    axisLetter: "D-B",
    title: "D - B 區間（基準中軸 ~ 回檔加碼）",
    subtitle: "中軸強勢整理與回檔加碼區間",
    yPercent: 52,
    rangeText: "44% ~ 60%",
    color: "#2563EB",
    bgColor: "bg-blue-50/40",
    borderColor: "border-blue-300",
    tagColor: "bg-gradient-to-r from-zinc-800 to-blue-600 text-white",
  },
  {
    id: "zone-b-g",
    type: "zone",
    axisLetter: "B-G",
    title: "B - G 區間（回檔加碼 ~ 底部買進）",
    subtitle: "支撐回檔與底部佈局買進區間",
    yPercent: 68,
    rangeText: "60% ~ 76%",
    color: "#16A34A",
    bgColor: "bg-emerald-50/40",
    borderColor: "border-emerald-300",
    tagColor: "bg-gradient-to-r from-blue-600 to-emerald-600 text-white",
  },
  {
    id: "zone-g-y",
    type: "zone",
    axisLetter: "G-Y",
    title: "G - Y 區間（底部買進 ~ 深幅價值）",
    subtitle: "底部強力買進與深幅超跌價值區間",
    yPercent: 83,
    rangeText: "76% ~ 90%",
    color: "#EAB308",
    bgColor: "bg-yellow-50/40",
    borderColor: "border-yellow-300",
    tagColor: "bg-gradient-to-r from-emerald-600 to-amber-500 text-white",
  },
];

export const MiniVisualLinesModal: React.FC<MiniVisualLinesModalProps> = ({
  isOpen,
  onClose,
  stockName,
  currentPrice,
  holdingStatus = "候選名單",
  userId,
}) => {
  const cleanSymbol = (stockName || "").trim().toUpperCase();

  const conf = HOLDING_CONFIG[holdingStatus] || HOLDING_CONFIG["候選名單"];

  // 根據 yPercent 找到最貼近的項目 ID
  const findClosestOptionId = useCallback((y: number): string => {
    let closestId = "line-d";
    let minDiff = Infinity;
    const allOptions = [...AXIS_LINES, ...AXIS_ZONES];
    for (const opt of allOptions) {
      const diff = Math.abs(opt.yPercent - y);
      if (diff < minDiff) {
        minDiff = diff;
        closestId = opt.id;
      }
    }
    return closestId;
  }, []);

  // 1. 同步即時讀取記憶體/本地快取（0ms 零延遲秒開）
  const getComputedInitialState = useCallback(() => {
    const { positions } = getVisualLinesDataSync(userId);
    let initialY = 44;
    if (cleanSymbol && positions[cleanSymbol] && typeof positions[cleanSymbol].y === "number") {
      initialY = positions[cleanSymbol].y;
    } else {
      if (holdingStatus === "賣出操作" || holdingStatus === "平倉操作") {
        initialY = 16;
      } else if (holdingStatus === "買進操作") {
        initialY = 74;
      } else if (holdingStatus === "觀察中") {
        initialY = 58;
      } else if (holdingStatus === "乖離名單") {
        initialY = 88;
      }
    }
    return {
      positions,
      initialY,
      optionId: findClosestOptionId(initialY),
    };
  }, [cleanSymbol, userId, holdingStatus, findClosestOptionId]);

  const [allPositions, setAllPositions] = useState<PositionMap>(() => getComputedInitialState().positions);
  const [selectedYPercent, setSelectedYPercent] = useState<number>(() => getComputedInitialState().initialY);
  const [selectedOptionId, setSelectedOptionId] = useState<string>(() => getComputedInitialState().optionId);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 當視窗開啟或股票切換時，立即同步狀態並在背景執行靜默非同步複驗
  useEffect(() => {
    if (isOpen) {
      const init = getComputedInitialState();
      setAllPositions(init.positions);
      setSelectedYPercent(init.initialY);
      setSelectedOptionId(init.optionId);

      // 背景靜默非同步複驗（不阻塞使用者互動與介面渲染）
      revalidateVisualLinesDataAsync(userId, (fresh) => {
        setAllPositions(fresh.positions);
        if (cleanSymbol && fresh.positions[cleanSymbol]?.y !== undefined) {
          const freshY = fresh.positions[cleanSymbol].y;
          setSelectedYPercent(freshY);
          setSelectedOptionId(findClosestOptionId(freshY));
        }
      });
    }
  }, [isOpen, cleanSymbol, getComputedInitialState, findClosestOptionId, userId]);

  // 2. 秒速儲存指定位置 (樂觀更新 + 記憶體快取 + 廣播事件 + 背景非同步 Firestore 寫入)
  const savePosition = useCallback(
    (yPercent: number, customOptionTitle?: string) => {
      if (!cleanSymbol) return;
      playSuccessSound();

      const prevConfig = allPositions[cleanSymbol];
      const newEntry: {
        x: number;
        y: number;
        shape: "circle";
        sizeOffset?: number;
        color?: string;
        hidden?: boolean;
        dcaProgress?: string;
        updatedAt?: string;
      } = {
        x: prevConfig && typeof prevConfig.x === "number" ? prevConfig.x : 50,
        y: yPercent,
        shape: "circle",
        sizeOffset: typeof prevConfig?.sizeOffset === "number" ? prevConfig.sizeOffset : 0,
        hidden: Boolean(prevConfig?.hidden),
        updatedAt: new Date().toISOString(),
      };
      if (
        prevConfig?.color &&
        typeof prevConfig.color === "string" &&
        prevConfig.color.trim() !== "" &&
        prevConfig.color !== "#000000" &&
        prevConfig.color !== "#09090b"
      ) {
        newEntry.color = prevConfig.color;
      }
      if (prevConfig?.dcaProgress) {
        newEntry.dcaProgress = prevConfig.dcaProgress;
      }

      const updatedPositions: PositionMap = {
        ...allPositions,
        [cleanSymbol]: newEntry,
      };

      setAllPositions(updatedPositions);

      // 極速樂觀寫入（0ms 完成本地與記憶體寫入，背景安全同步 Firestore）
      saveVisualLinesDataOptimistic(userId, updatedPositions);

      toast.success(
        `已成功設定 ${cleanSymbol} 於「${customOptionTitle || "指定視覺線/區間"}」！`,
        {
          id: `mini-save-${cleanSymbol}`,
          duration: 2500,
        }
      );
      onClose();
    },
    [cleanSymbol, allPositions, userId, onClose]
  );

  // 點選項目處理
  const handleSelectOption = (opt: AxisOption) => {
    playClickSound();
    setSelectedOptionId(opt.id);
    setSelectedYPercent(opt.yPercent);
    // 直接快速儲存並關閉（零等待）
    savePosition(opt.yPercent, opt.title);
  };

  // 當前選取的項目資訊
  const currentSelectedOption = useMemo(() => {
    return (
      [...AXIS_LINES, ...AXIS_ZONES].find((opt) => opt.id === selectedOptionId) ||
      AXIS_LINES[0]
    );
  }, [selectedOptionId]);

  // 鍵盤快速鍵 (Esc 關閉, Enter 儲存)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        playClickSound();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (currentSelectedOption) {
          savePosition(currentSelectedOption.yPercent, currentSelectedOption.title);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, currentSelectedOption, savePosition]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[1000000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 select-none animate-in fade-in duration-150"
      onClick={() => {
        playClickSound();
        onClose();
      }}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col relative max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <header className="w-full bg-zinc-950 text-white px-4 sm:px-6 py-4 flex items-center justify-between gap-3 shadow-md shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white shrink-0">
              <span
                className={`w-2.5 h-2.5 rounded-full ${conf?.dot || "bg-emerald-500"} shrink-0 shadow-xs`}
              />
              <span className="font-black font-sans text-base tracking-wide text-white">
                {cleanSymbol}
              </span>
              {currentPrice !== undefined && currentPrice > 0 && (
                <span className="text-xs font-mono font-extrabold text-emerald-400 ml-1">
                  ${currentPrice.toFixed(2)}
                </span>
              )}
            </div>

            <div>
              <h2 className="text-sm sm:text-base font-black text-zinc-100 tracking-tight flex items-center gap-1.5">
                <span>設定視覺線位置</span>
                <span className="text-xs font-normal text-zinc-400 hidden sm:inline">
                  (點選直接套用)
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-400 font-medium truncate">
                選擇現價所對應的分隔軸線或所屬區間
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playClickSound();
              onClose();
            }}
            title="關閉 (Esc)"
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5 bg-zinc-50/50">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-400">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
              <span className="text-xs font-bold">載入視覺線資料中...</span>
            </div>
          )}

          {!isLoading && (
            <>
              {/* Category 1: 分隔線上 (On Divider Lines) */}
              <section className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-black text-zinc-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-zinc-900" />
                    <span>落在分隔線上：</span>
                  </h3>
                  <span className="text-[11px] text-zinc-600 font-bold">
                    精準對齊基準軸
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {AXIS_LINES.map((opt) => {
                    const isSelected = selectedOptionId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectOption(opt)}
                        disabled={isSaving}
                        className={`group relative p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 select-none ${
                          isSelected
                            ? "bg-white border-zinc-900 shadow-md ring-2 ring-zinc-900/10"
                            : "bg-white/95 border-zinc-200/90 hover:border-zinc-400 hover:bg-white hover:shadow-xs"
                        }`}
                      >
                        {/* Left Color Indicator Bar & Axis Badge */}
                        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                          <span
                            className={`w-7 h-7 rounded-lg font-mono font-black text-xs flex items-center justify-center shadow-xs ${opt.tagColor}`}
                            style={{
                              backgroundColor: opt.color,
                            }}
                          >
                            {opt.axisLetter}
                          </span>
                          <span
                            className="w-1.5 h-4 rounded-full"
                            style={{ backgroundColor: opt.color }}
                          />
                        </div>

                        {/* Title & Subtitle */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="text-xs sm:text-[13px] font-black text-zinc-900 tracking-tight truncate">
                              {opt.title}
                            </h4>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-600 font-medium mt-0.5 truncate">
                            {opt.subtitle}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                              Y軸 {opt.yPercent}%
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Category 2: 或是區間 (Axis Intervals / Bands) */}
              <section className="space-y-2.5 pt-2 border-t border-zinc-200/80">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-black text-zinc-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>或是區間（兩軸之間）：</span>
                  </h3>
                  <span className="text-[11px] text-zinc-600 font-bold">
                    區間動態定位
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {AXIS_ZONES.map((opt) => {
                    const isSelected = selectedOptionId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectOption(opt)}
                        disabled={isSaving}
                        className={`group relative p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 select-none ${
                          isSelected
                            ? "bg-white border-indigo-600 shadow-md ring-2 ring-indigo-500/15"
                            : "bg-white/95 border-zinc-200/90 hover:border-zinc-400 hover:bg-white hover:shadow-xs"
                        }`}
                      >
                        {/* Left Zone Badge */}
                        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                          <span className="px-2 py-1 rounded-lg font-mono font-black text-[11px] bg-zinc-900 text-white shadow-xs">
                            {opt.axisLetter}
                          </span>
                          <span
                            className="w-1.5 h-4 rounded-full"
                            style={{ backgroundColor: opt.color }}
                          />
                        </div>

                        {/* Title & Subtitle */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="text-xs sm:text-[13px] font-black text-zinc-900 tracking-tight truncate">
                              {opt.title}
                            </h4>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-600 font-medium mt-0.5 truncate">
                            {opt.subtitle}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              範圍 {opt.rangeText}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer Bar */}
        <footer className="w-full bg-white border-t border-zinc-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-zinc-600 truncate">
            <span className="font-bold text-zinc-800 shrink-0">目前選擇：</span>
            <span className="font-extrabold text-zinc-950 truncate">
              {currentSelectedOption?.title}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                playClickSound();
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 text-xs font-bold transition-all cursor-pointer"
            >
              取消
            </button>

            <button
              type="button"
              onClick={() =>
                savePosition(
                  currentSelectedOption.yPercent,
                  currentSelectedOption.title
                )
              }
              disabled={isSaving}
              className="px-4 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4 text-emerald-400" />
              )}
              <span>確認套用</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
