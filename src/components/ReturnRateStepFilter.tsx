import React, { useState } from "react";
import { playClickSound } from "../lib/audio";
import { safeLocalStorage } from "../lib/utils";
import { CheckCircle2 } from "lucide-react";

export interface ReturnRateStepFilterProps {
  direction: "gain" | "loss";
  onDirectionChange: (dir: "gain" | "loss") => void;
  selectedBracket: number | null; // null 代表「全部」，或者 2, 3, 5, 8, 10, 15
  onBracketChange: (bracket: number | null) => void;
  totalCount: number;
  matchedCount: number;
  bracketCounts?: Record<string, number>;
  selectedCardCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export const PNL_STEP_TICKS = [
  { label: "全部", value: null },
  { label: "2%", value: 2 },
  { label: "3%", value: 3 },
  { label: "5%", value: 5 },
  { label: "8%", value: 8 },
  { label: "10%", value: 10 },
  { label: "15%", value: 15 },
] as const;

export function getStepBracketBounds(bracket: number | null): { min: number; max: number } | null {
  if (bracket === null) return null;
  switch (bracket) {
    case 2:
      return { min: 2, max: 3 };
    case 3:
      return { min: 3, max: 5 };
    case 5:
      return { min: 5, max: 8 };
    case 8:
      return { min: 8, max: 10 };
    case 10:
      return { min: 10, max: 15 };
    case 15:
      return { min: 15, max: Infinity };
    default:
      return { min: bracket, max: Infinity };
  }
}

export function getStepBracketLabel(bracket: number | null, direction: "gain" | "loss"): string {
  if (bracket === null) return "全部";
  const bounds = getStepBracketBounds(bracket);
  if (!bounds) return "全部";
  const sign = direction === "gain" ? "+" : "-";
  if (bounds.max === Infinity) {
    return direction === "gain" ? `≥ +${bounds.min}%` : `≤ -${bounds.min}%`;
  }
  return `${sign}${bounds.min}% ~ ${sign}${bounds.max}%`;
}

export function ReturnRateStepFilter({
  direction,
  onDirectionChange,
  selectedBracket,
  onBracketChange,
  totalCount,
  matchedCount,
  bracketCounts = {},
  selectedCardCount,
  onSelectAll,
  onDeselectAll,
}: ReturnRateStepFilterProps) {
  // 台股慣例對調設定：預設 false (美股慣例：綠獲利 #2fbf71、紅虧損 #ef5350；台股慣例：紅獲利 #ef5350、綠虧損 #2fbf71)
  const [isTwConvention, setIsTwConvention] = useState<boolean>(() => {
    try {
      return safeLocalStorage.getItem("tw_stock_color_convention") === "true";
    } catch {
      return false;
    }
  });

  const toggleColorConvention = () => {
    playClickSound();
    setIsTwConvention((prev) => {
      const next = !prev;
      safeLocalStorage.setItem("tw_stock_color_convention", String(next));
      return next;
    });
  };

  // 方向色設定
  const upColor = isTwConvention ? "#ef5350" : "#2fbf71";
  const dnColor = isTwConvention ? "#2fbf71" : "#ef5350";

  // 目前選中刻度之 index (0 ~ 6)
  const selectedIndex = PNL_STEP_TICKS.findIndex((t) => t.value === selectedBracket);
  const activeIdx = selectedIndex !== -1 ? selectedIndex : 3; // 預設 5% 為 index 3

  // 第一行右側灰字狀態文字：級距範圍與符合檔數
  const conditionLabel = getStepBracketLabel(selectedBracket, direction);
  const statusConditionText = `${conditionLabel} · ${matchedCount} 檔`;

  return (
    <div
      className="w-full py-2.5 px-3 sm:px-6 max-w-6xl mx-auto flex flex-col gap-2 select-none border-t border-zinc-200/80 sm:border-t-0"
      style={
        {
          "--up": upColor,
          "--dn": dnColor,
        } as React.CSSProperties
      }
    >
      <style>{`
        @keyframes limeBreathing {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(178, 237, 69, 0.8), 0 0 8px rgba(178, 237, 69, 0.7);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 5px rgba(178, 237, 69, 0), 0 0 14px rgba(178, 237, 69, 0.95);
            transform: scale(1.25);
          }
        }
        .dot-lime-pulse {
          background-color: #B2ED45 !important;
          border-color: #B2ED45 !important;
          animation: limeBreathing 1.8s infinite ease-in-out;
        }
      `}</style>

      {/* 第一行：方向單選與右側狀態及全選工具 */}
      <div className="flex items-center justify-between w-full flex-wrap gap-2">
        {/* 左側：單選「▲ 獲利」與「▼ 虧損」，加 1px 底線 */}
        <div className="flex items-center gap-3.5">
          {/* ▲ 獲利 */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              onDirectionChange("gain");
            }}
            style={{
              color: direction === "gain" ? upColor : "#71717a",
              borderBottom:
                direction === "gain" ? `1px solid ${upColor}` : "1px solid transparent",
            }}
            className="pb-0.5 text-xs font-black transition-colors cursor-pointer select-none leading-none tracking-tight"
            title="僅篩選獲利個股"
          >
            ▲ 獲利
          </button>

          {/* ▼ 虧損 */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              onDirectionChange("loss");
            }}
            style={{
              color: direction === "loss" ? dnColor : "#71717a",
              borderBottom:
                direction === "loss" ? `1px solid ${dnColor}` : "1px solid transparent",
            }}
            className="pb-0.5 text-xs font-black transition-colors cursor-pointer select-none leading-none tracking-tight"
            title="僅篩選虧損個股"
          >
            ▼ 虧損
          </button>

          {/* 色彩慣例對調設定 */}
          <button
            type="button"
            onClick={toggleColorConvention}
            title={
              isTwConvention
                ? "目前為台股慣例（紅漲綠跌），點擊切換為美股慣例"
                : "目前為美股慣例（綠漲紅跌），點擊切換為台股慣例"
            }
            className="text-[10px] sm:text-[11px] text-zinc-500 hover:text-zinc-850 border-b border-dashed border-zinc-400 hover:border-zinc-700 transition-colors cursor-pointer select-none ml-1 tracking-tight"
          >
            {isTwConvention ? "台股色彩" : "美股色彩"}
          </button>
        </div>

        {/* 右側：灰字顯示目前級距條件與命中檔數 + 批次勾選工具 */}
        <div className="flex items-center gap-3 ml-auto shrink-0">
          <span className="text-xs font-bold text-zinc-500 tabular-nums">
            {statusConditionText}
          </span>

          {selectedCardCount > 0 && (
            <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1 select-none">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              已選 {selectedCardCount}
            </span>
          )}

          <button
            type="button"
            onClick={onSelectAll}
            className="text-xs font-bold text-zinc-600 hover:text-zinc-950 underline cursor-pointer"
            title="全選目前篩選後之個股"
          >
            全選
          </button>

          <button
            type="button"
            onClick={onDeselectAll}
            disabled={selectedCardCount === 0}
            className={`text-xs font-bold underline cursor-pointer ${
              selectedCardCount === 0
                ? "text-zinc-400 opacity-40 cursor-not-allowed"
                : "text-zinc-600 hover:text-rose-600"
            }`}
            title="取消所有勾選"
          >
            取消全選
          </button>
        </div>
      </div>

      {/* 第二行：階梯軸 */}
      <div className="relative w-full pt-1.5 pb-2 select-none">
        {/* 水平細線 (1.5px)，底部的線條為 #D3E3BC 顏色 */}
        <div
          className="absolute h-[1.5px] pointer-events-none"
          style={{
            top: "12.25px", // 精確對齊 10px 圓點垂直中心 (pt-1.5 6px + py-0.5 2px + 5px - 0.75px)
            left: "calc(100% / 14)",
            right: "calc(100% / 14)",
            backgroundColor: "#D3E3BC", // 依用戶要求: 底部的線條為 D3E3BC 顏色
          }}
        >
          {/* 從第一個刻度到選中刻度之高亮連線 */}
          <div
            className="h-full transition-all duration-200"
            style={{
              width: `${(activeIdx / (PNL_STEP_TICKS.length - 1)) * 100}%`,
              backgroundColor: "#B2ED45",
            }}
          />
        </div>

        {/* 7 個等距刻度（等分整行，手機不換行，點擊區高於 32px） */}
        <div className="relative w-full flex items-start justify-between">
          {PNL_STEP_TICKS.map((tick, idx) => {
            const isSelected = idx === activeIdx;
            const isLeft = idx < activeIdx;

            // 圓點狀態：
            // - 選中點：原點為 #B2ED45 顏色，並有動態呼吸效果提醒 (dot-lime-pulse)
            // - 選中點左側：空心圓，邊框為 #B2ED45
            // - 選中點右側：空心圓，邊框為 #D3E3BC
            let dotBorderColor = "#D3E3BC";
            let dotBgColor = "var(--background, #F5F5F5)";
            let isPulse = false;

            if (isSelected) {
              dotBorderColor = "#B2ED45";
              dotBgColor = "#B2ED45";
              isPulse = true;
            } else if (isLeft) {
              dotBorderColor = "#B2ED45";
              dotBgColor = "var(--background, #F5F5F5)";
            } else {
              dotBorderColor = "#CBD5E1";
              dotBgColor = "var(--background, #F5F5F5)";
            }

            // 標籤文字
            const labelColor = isSelected ? "#000000" : "#71717a";
            const displayLabel =
              tick.value === null
                ? "全部"
                : direction === "loss"
                ? `-${tick.value}%`
                : `${tick.value}%`;

            // 各層級符合的標的數量
            const count =
              tick.value === null
                ? (bracketCounts.all ?? totalCount)
                : (bracketCounts[String(tick.value)] ?? 0);

            return (
              <button
                key={tick.label}
                type="button"
                onClick={() => {
                  playClickSound();
                  onBracketChange(tick.value);
                }}
                className="flex-1 flex flex-col items-center justify-start min-h-[44px] cursor-pointer group py-0.5"
                style={{ width: "calc(100% / 7)" }}
              >
                {/* 刻度小圓點：選中點為 #B2ED45 顏色且具有動態呼吸提醒 */}
                <div
                  className={`w-2.5 h-2.5 rounded-full border transition-all duration-150 z-10 shrink-0 ${
                    isPulse ? "dot-lime-pulse" : ""
                  }`}
                  style={{
                    borderColor: dotBorderColor,
                    backgroundColor: dotBgColor,
                  }}
                />

                {/* 下方 6px 處顯示文字標籤 (+2.5px) */}
                <span
                  className="mt-[6px] text-[13.5px] sm:text-[14.5px] leading-none whitespace-nowrap transition-colors select-none font-mono"
                  style={{
                    color: labelColor,
                    fontWeight: isSelected ? 900 : 600,
                  }}
                >
                  {displayLabel}
                </span>

                {/* 各層級符合的卡片張數額外資訊 (+2.5px) */}
                <span
                  className={`text-[12px] sm:text-[12.5px] leading-tight font-mono whitespace-nowrap mt-1 ${
                    isSelected ? "text-zinc-950 font-black" : "text-zinc-400 font-semibold"
                  }`}
                >
                  {count} 檔
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
