import React, { useMemo, useState } from "react";
import { PlannedOrder } from "../types";

interface Props {
  plannedOrders: PlannedOrder[];
  currentPrice?: number;
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
}) => {
  const [hoveredLabel, setHoveredLabel] = useState<any>(null);

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

    const allPrices = [currentPrice, ...validOrders.map((o) => o.price)].filter(
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

    const rightItems =
      currentPrice > 0
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
        : [];

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

    const rawItems = [
      ...leftItems,
      ...slItems,
      ...rightItems,
      ...entryItems,
      ...tpItems,
    ];

    // Globally resolve collisions to strictly maintain vertical price order across all columns
    const allLabels = resolveCollisions(rawItems, 3.5);

    const leftLabels = allLabels.filter(
      (l) => !l.id.startsWith("sl-") && leftItems.some((x) => x.id === l.id),
    );
    const slLabels = allLabels.filter((l) => l.id.startsWith("sl-"));
    const entryLabels = allLabels.filter((l) => l.id.startsWith("en-"));
    const tpLabels = allLabels.filter((l) => l.id.startsWith("tp-"));
    const rightLabels = allLabels.filter((l) => l.id === "cp");

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
  }, [plannedOrders, currentPrice]);

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

  const renderLabel = (l: any, extraClass: string, style: any) => (
    <div
      key={l.id}
      className={`absolute whitespace-nowrap transition-all duration-300 font-bold px-1.5 py-0.5 rounded text-[11px] tracking-wide cursor-help ${extraClass} ${l.isAlert ? "ring-2 ring-[#c084fc] animate-pulse z-20 shadow-[0_0_15px_rgba(192,132,252,0.9)]" : "z-10"}`}
      style={{
        ...style,
        backgroundColor: l.isAlert ? "#f3e8ff" : l.color,
        color: l.isAlert
          ? "#7e22ce"
          : l.color === "#ef4444" || l.color === "#60a5fa"
            ? "#ffffff"
            : "#000000",
        textShadow: "none",
      }}
      onMouseEnter={() => setHoveredLabel(l)}
      onMouseLeave={() => setHoveredLabel(null)}
    >
      {l.text}
    </div>
  );

  return (
    <div
      className="w-full h-full p-2 relative flex flex-col rounded-xl pointer-events-auto"
      style={{ isolation: "isolate" }}
    >
      <p className="text-[10px] font-bold text-white/40 mb-1 uppercase tracking-widest text-center shadow-black drop-shadow-md shrink-0">
        數據圖視化
      </p>

      {/* Chart container */}
      <div className="relative flex-1 opacity-90 backdrop-blur-md bg-white/5 rounded-lg border border-white/10 overflow-hidden shadow-inner">
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
        </svg>

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
    </div>
  );
};
