import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Save,
  SlidersHorizontal,
  Info,
  Loader2,
  ArrowUpDown,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { playClickSound, playSuccessSound } from "../lib/audio";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { VISUAL_LINES, VISUAL_BANDS, HOLDING_CONFIG, PositionMap, hexToRgba, isColorLight } from "./DynamicVisualLinesModal";
import { formatTagDate } from "../utils/visualLinesSync";

interface MiniVisualLinesModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockName: string;
  currentPrice?: number;
  holdingStatus?: string;
  tradeType?: string;
  userId?: string;
}

export const MiniVisualLinesModal: React.FC<MiniVisualLinesModalProps> = ({
  isOpen,
  onClose,
  stockName,
  currentPrice,
  holdingStatus = "候選名單",
  tradeType = "active",
  userId,
}) => {
  const cleanSymbol = (stockName || "").trim().toUpperCase();

  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 50, y: 44 });
  const [allPositions, setAllPositions] = useState<PositionMap>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showLineLabels, setShowLineLabels] = useState<boolean>(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragOffsetRef = useRef<{ offsetX: number; offsetY: number }>({ offsetX: 0, offsetY: 0 });

  const conf = HOLDING_CONFIG[holdingStatus] || HOLDING_CONFIG["候選名單"];

  // 1. 載入既有位置 (localStorage & Firestore)
  const loadInitialPosition = useCallback(async () => {
    if (!cleanSymbol) return;
    setIsLoading(true);

    const storageKey = `visual_lines_board_positions_${userId || "guest"}`;
    let loadedPosMap: PositionMap = {};
    let loadedFromFirestore = false;

    // 1. 優先由 Firestore 載入權威資料
    if (userId) {
      try {
        const docRef = doc(db, "users", userId, "visualLinesBoard", "positions");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const remotePos = docSnap.data()?.positions as PositionMap;
          if (remotePos && typeof remotePos === "object") {
            loadedPosMap = remotePos;
            loadedFromFirestore = true;
            try {
              localStorage.setItem(storageKey, JSON.stringify(remotePos));
            } catch (e) {}
          }
        }
      } catch (err) {
        console.warn("Failed to load Firestore positions in mini modal:", err);
      }
    }

    // 2. 若未從 Firestore 取得，則由 LocalStorage 回退讀取
    if (!loadedFromFirestore) {
      try {
        const localData = localStorage.getItem(storageKey);
        if (localData) {
          loadedPosMap = JSON.parse(localData);
        }
      } catch (e) {
        console.warn("Failed to load local positions in mini modal:", e);
      }
    }

    setAllPositions(loadedPosMap);

    // 若已有儲存該股票位置，採用之；否則預設為基準中軸 Y=44%, X=50%
    if (loadedPosMap[cleanSymbol]) {
      setPosition({
        x: loadedPosMap[cleanSymbol].x ?? 50,
        y: loadedPosMap[cleanSymbol].y ?? 44,
      });
    } else {
      let defaultY = 44;
      if (holdingStatus === "賣出操作" || holdingStatus === "平倉操作") {
        defaultY = 16;
      } else if (holdingStatus === "買進操作") {
        defaultY = 74;
      } else if (holdingStatus === "觀察中") {
        defaultY = 58;
      } else if (holdingStatus === "乖離名單") {
        defaultY = 88;
      }
      setPosition({ x: 50, y: defaultY });
    }

    setHasUnsavedChanges(false);
    setIsLoading(false);
  }, [cleanSymbol, userId, holdingStatus]);

  useEffect(() => {
    if (isOpen) {
      loadInitialPosition();
    }
  }, [isOpen, loadInitialPosition]);

  // 2. 拖曳定位處理 (Pointer Move & Up)
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (isSaving) return;

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    // 記錄點擊相對標籤中心的偏差
    const tagPixelX = rect.left + (position.x / 100) * rect.width;
    const tagPixelY = rect.top + (position.y / 100) * rect.height;

    dragOffsetRef.current = {
      offsetX: clientX - tagPixelX,
      offsetY: clientY - tagPixelY,
    };
    isDraggingRef.current = true;

    const handlePointerMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current || !canvasRef.current) return;

      const curX = "touches" in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = "touches" in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const currentRect = canvasRef.current.getBoundingClientRect();

      const rawTargetX = curX - dragOffsetRef.current.offsetX;
      const rawTargetY = curY - dragOffsetRef.current.offsetY;

      // 換算成百分比並限制於畫布安全邊界內
      const clampedX = Math.min(88, Math.max(12, ((rawTargetX - currentRect.left) / currentRect.width) * 100));
      const clampedY = Math.min(94, Math.max(6, ((rawTargetY - currentRect.top) / currentRect.height) * 100));

      setPosition({
        x: parseFloat(clampedX.toFixed(2)),
        y: parseFloat(clampedY.toFixed(2)),
      });
      setHasUnsavedChanges(true);
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove, { passive: false });
    window.addEventListener("touchend", handlePointerUp);
  };

  // 3. 儲存位置 (Save to localStorage & Firestore & dispatch event)
  const handleSave = useCallback(async () => {
    if (!cleanSymbol) return;
    setIsSaving(true);
    playSuccessSound();

    const storageKey = `visual_lines_board_positions_${userId || "guest"}`;
    const prevConfig = allPositions[cleanSymbol];
    const newEntry: {
      x: number;
      y: number;
      shape: "circle";
      sizeOffset?: number;
      color?: string;
      hidden?: boolean;
      updatedAt?: string;
    } = {
      x: position.x,
      y: position.y,
      shape: "circle",
      sizeOffset: typeof prevConfig?.sizeOffset === "number" ? prevConfig.sizeOffset : 0,
      hidden: Boolean(prevConfig?.hidden),
      updatedAt: new Date().toISOString(),
    };
    if (prevConfig?.color && typeof prevConfig.color === "string" && prevConfig.color.trim() !== "" && prevConfig.color !== "#09090b") {
      newEntry.color = prevConfig.color;
    }

    const updatedPositions: PositionMap = {};
    Object.entries(allPositions).forEach(([sym, pos]) => {
      const entry: {
        x: number;
        y: number;
        shape?: "circle";
        sizeOffset?: number;
        color?: string;
        hidden?: boolean;
        updatedAt?: string;
      } = {
        x: typeof pos.x === "number" ? pos.x : 50,
        y: typeof pos.y === "number" ? pos.y : 50,
        shape: "circle",
        sizeOffset: typeof pos.sizeOffset === "number" ? pos.sizeOffset : 0,
        updatedAt: pos.updatedAt || new Date().toISOString(),
      };
      if (pos.color && typeof pos.color === "string" && pos.color.trim() !== "" && pos.color !== "#09090b") {
        entry.color = pos.color;
      }
      if (pos.hidden) {
        entry.hidden = true;
      }
      updatedPositions[sym] = entry;
    });
    updatedPositions[cleanSymbol] = newEntry;

    try {
      // 1. LocalStorage
      localStorage.setItem(storageKey, JSON.stringify(updatedPositions));
      setAllPositions(updatedPositions);

      // 2. Firestore
      if (userId) {
        const docRef = doc(db, "users", userId, "visualLinesBoard", "positions");
        try {
          await setDoc(
            docRef,
            {
              positions: updatedPositions,
              updatedAt: new Date().toISOString(),
            }
          );
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.WRITE, `users/${userId}/visualLinesBoard/positions`);
        }
      }

      // 3. 發送全域自訂廣播事件，讓其他開啟中的畫布組件即時同步
      window.dispatchEvent(
        new CustomEvent("visual_lines_positions_updated", {
          detail: {
            symbol: cleanSymbol,
            position,
            allPositions: updatedPositions,
          },
        })
      );

      setHasUnsavedChanges(false);
      toast.success(`已成功儲存 ${cleanSymbol} 於動態視覺線位置！`, {
        id: `mini-save-${cleanSymbol}`,
        duration: 2500,
      });
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("儲存失敗：" + (err?.message || "請稍後再試"));
    } finally {
      setIsSaving(false);
    }
  }, [cleanSymbol, position, allPositions, userId]);

  // 4. 快速吸附 / 切換至指定視覺線位置
  const handleSnapToLine = (yPercent: number) => {
    playClickSound();
    setPosition((prev) => ({
      x: prev.x,
      y: yPercent,
    }));
    setHasUnsavedChanges(true);
  };

  // 5. 鍵盤快速鍵 (Shift+S 儲存 / Esc 關閉 / Enter 儲存)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        playClickSound();
        onClose();
      } else if ((e.shiftKey && e.key.toLowerCase() === "s") || e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, handleSave]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[1000000] bg-black/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in duration-200"
      onClick={() => {
        playClickSound();
        onClose();
      }}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)] border border-zinc-200 overflow-hidden flex flex-col relative max-h-[95vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <header className="w-full bg-zinc-900 text-white px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 shadow-md shrink-0">
          {/* Title & Current Stock Badge */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-white rounded-lg shrink-0">
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              <span className="font-extrabold text-sm sm:text-base tracking-wide">
                動態視覺線標籤定位
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/90 border border-zinc-700 text-zinc-200 text-xs sm:text-sm">
              <span className={`w-2.5 h-2.5 rounded-full ${conf?.dot || "bg-emerald-500"} shrink-0 shadow-xs`} />
              <span className="font-black font-sans text-white tracking-wide">
                {cleanSymbol}
              </span>
              {currentPrice !== undefined && currentPrice > 0 && (
                <span className="text-xs font-mono font-bold text-zinc-400 ml-1">
                  ${currentPrice.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle Line Labels */}
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setShowLineLabels(!showLineLabels);
              }}
              title="切換線條文字說明"
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                showLineLabels
                  ? "bg-zinc-800 border-zinc-600 text-zinc-100"
                  : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">標示</span>
            </button>

            {/* Top Primary Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md ${
                hasUnsavedChanges
                  ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/30 animate-pulse"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30"
              }`}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>儲存位置</span>
              <span className="hidden md:inline-block px-1 py-0.2 bg-black/25 text-white text-[10px] rounded font-mono font-bold">
                Shift+S
              </span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                playClickSound();
                onClose();
              }}
              title="關閉 (Esc)"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Quick Snap Toolbar (快速吸附至六大視覺線) */}
        <div className="w-full bg-zinc-50 border-b border-zinc-200 px-3 sm:px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto scrollbar-hide text-xs shrink-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-zinc-600 font-bold shrink-0 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
              快速定位吸附：
            </span>
            {VISUAL_LINES.map((line) => {
              const isNear = Math.abs(position.y - line.yPercent) <= 3;
              return (
                <button
                  key={line.id}
                  type="button"
                  onClick={() => handleSnapToLine(line.yPercent)}
                  className={`px-2.5 py-1 rounded-md border font-extrabold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 text-xs ${
                    isNear
                      ? "bg-white border-zinc-400 text-zinc-950 shadow-xs ring-1 ring-zinc-400"
                      : "bg-white/90 border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: line.color }}
                  />
                  <span>{line.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => handleSnapToLine(44)}
            title="重設至基準中軸 (44%)"
            className="px-2 py-1 rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 text-xs font-bold shrink-0 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>重設中軸</span>
          </button>
        </div>

        {/* Main Canvas Area (嚴格對應動態視覺線畫布) */}
        <main
          ref={canvasRef}
          className="w-full h-[400px] sm:h-[480px] bg-[#F4F5F8] relative select-none overflow-hidden cursor-default border-y border-zinc-200"
        >
          {/* Optical Depth of Field Ambient Lighting Layer */}
          <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              background:
                "radial-gradient(ellipse 95% 85% at 50% 48%, rgba(255, 255, 255, 0.45) 0%, rgba(238, 242, 248, 0.45) 55%, rgba(208, 216, 228, 0.65) 100%)",
            }}
          />

          {isLoading && (
            <div className="absolute inset-0 bg-white/80 z-30 flex items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
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

          {/* 6 Visual Lines */}
          {VISUAL_LINES.map((line) => (
            <div
              key={line.id}
              className="absolute left-0 right-0 pointer-events-none flex items-center z-10"
              style={{ top: `${line.yPercent}%` }}
            >
              {/* Continuous horizontal colored line */}
              <div
                className="w-full transition-all"
                style={{
                  height: line.color === "#000000" ? "4px" : "3.5px",
                  backgroundColor: line.color,
                  boxShadow:
                    line.color === "#000000"
                      ? "0 0 10px rgba(0,0,0,0.22)"
                      : `0 0 10px ${line.color}55`,
                }}
              />

              {/* Line Label tag on the right side */}
              {showLineLabels && (
                <div
                  className="absolute right-3 sm:right-4 -top-5 px-3 py-1 rounded-full text-[11px] font-black pointer-events-none tracking-wide flex items-center gap-2 shadow-lg border border-black/10 backdrop-blur-md"
                  style={{
                    color: "#000000",
                    backgroundColor: "rgba(255, 255, 255, 0.96)",
                  }}
                >
                  <span className="text-black font-black uppercase">{line.label}</span>
                  <span className="text-[9.5px] text-zinc-500 font-mono font-bold hidden sm:inline">[{line.desc}]</span>
                </div>
              )}
            </div>
          ))}

          {/* Draggable Stock Tag (立體運動球體標籤: 預設背景 #F7F5F5, 文字 #4F4F4F, 含最新現價, 下方顯示更新時間與日期) */}
          <div
            onMouseDown={handlePointerDown}
            onTouchStart={handlePointerDown}
            className="absolute z-20 cursor-grab active:cursor-grabbing transform -translate-x-1/2 -translate-y-1/2 group touch-none flex flex-col items-center select-none"
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
            }}
          >
            {/* Tag Badge (運動球體標籤: 內部純白 #FFFFFF, 依設定顯示 6px 套用純色或 1px 預設黑, 內部文字 #000000, 含最新現價) */}
            {(() => {
              const symColor = allPositions[cleanSymbol]?.color;
              const hasAppliedColor = Boolean(symColor && symColor !== "#000000");
              const tagBorderColor = hasAppliedColor ? symColor! : "#000000";
              const borderThickness = hasAppliedColor ? "6px" : "1px";

              const formattedPrice = currentPrice !== undefined && currentPrice > 0
                ? `$${currentPrice >= 100 ? currentPrice.toFixed(1) : currentPrice.toFixed(2)}`
                : null;

              return (
                <>
                  <div
                    className="relative flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full transition-all select-none shadow-md hover:shadow-lg hover:scale-105 bg-white text-black"
                    style={{
                      backgroundColor: "#FFFFFF",
                      border: `${borderThickness} solid ${tagBorderColor}`,
                      boxShadow: "0 2px 6px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)",
                    }}
                  >
                    {/* Status Dot */}
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${conf?.dot || "bg-emerald-500"} shrink-0 ring-1 ring-black/15 mb-0.5 z-10`}
                    />

                    {/* Stock Symbol - 內部文字極致黑 #000000 */}
                    <span
                      className="font-black font-sans text-sm sm:text-base tracking-tight leading-none text-center uppercase z-10 select-none text-black"
                      style={{
                        color: "#000000",
                      }}
                    >
                      {cleanSymbol}
                    </span>

                    {/* Current Price - 最新現價 (內部文字極致黑 #000000) */}
                    {formattedPrice ? (
                      <span
                        className="text-[10px] sm:text-xs font-mono font-black tracking-tight leading-none text-center mt-0.5 z-10 select-none text-black"
                        style={{
                          color: "#000000",
                        }}
                      >
                        {formattedPrice}
                      </span>
                    ) : (
                      <span
                        className="text-[10px] sm:text-xs font-mono font-bold leading-none text-center mt-0.5 z-10 opacity-30 select-none text-black"
                        style={{
                          color: "#000000",
                        }}
                      >
                        $--
                      </span>
                    )}
                  </div>

                  {/* 更新時間與日期顯示在標籤下方 (Android Flat Pill) */}
                  {allPositions[cleanSymbol]?.updatedAt ? (
                    <div
                      className="mt-1 px-1.5 py-0.5 rounded-full bg-white border border-zinc-200 pointer-events-none flex items-center justify-center gap-0.5 select-none transition-all shadow-xs"
                      title={`更新時間與日期: ${new Date(allPositions[cleanSymbol].updatedAt!).toLocaleString()}`}
                    >
                      <span className="text-[7.5px] sm:text-[8.5px] font-mono font-bold text-black tracking-tight leading-none whitespace-nowrap" style={{ color: "#000000" }}>
                        {formatTagDate(allPositions[cleanSymbol].updatedAt)}
                      </span>
                    </div>
                  ) : (
                    <div
                      className="mt-1 px-1.5 py-0.5 rounded-full bg-white border border-zinc-200 pointer-events-none flex items-center justify-center gap-0.5 select-none transition-all shadow-xs"
                    >
                      <span className="text-[7.5px] sm:text-[8.5px] font-mono font-bold text-black tracking-tight leading-none whitespace-nowrap" style={{ color: "#000000" }}>
                        {formatTagDate(new Date().toISOString())}
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </main>

        {/* Footer Bar with Prominent Save Button */}
        <footer className="w-full bg-zinc-50 border-t border-zinc-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-zinc-600 min-w-0">
            <span className="text-amber-500 text-sm shrink-0">💡</span>
            <span className="truncate">
              按住標籤可自由拖曳調整高低位置，確認後請點擊「儲存位置」即可即時同步至動態視覺線看板。
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden sm:inline text-xs font-mono font-bold text-zinc-400">
              Y: {position.y.toFixed(1)}% | X: {position.x.toFixed(1)}%
            </span>

            <button
              type="button"
              onClick={() => {
                playClickSound();
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 text-xs font-bold transition-all cursor-pointer"
            >
              取消
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 shadow-lg ${
                hasUnsavedChanges
                  ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/30"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30"
              }`}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : hasUnsavedChanges ? (
                <Save className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>儲存位置</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
