import { Trade } from '../types';
import { getTimestampMillis } from './dateUtils';

export function calculateStats(trades: Trade[] = [], currentPrice?: number) {
  let positionQty = 0;
  let costBasis = 0; 
  let realizedPnL = 0;

  if (!Array.isArray(trades) || trades.length === 0) {
    return {
      totalQuantity: 0,
      totalCostBasis: 0,
      averagePrice: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      totalPnL: 0,
      returnPercentage: 0,
    };
  }

  const validTrades = trades.filter((t) => t && typeof t === 'object');
  if (validTrades.length === 0) {
    return {
      totalQuantity: 0,
      totalCostBasis: 0,
      averagePrice: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      totalPnL: 0,
      returnPercentage: 0,
    };
  }

  // Ensure trades are sorted sequentially from oldest to newest for average cost calculation
  const sorted = [...validTrades].sort((a, b) => {
    const timeA = getTimestampMillis(a.tradeDate);
    const timeB = getTimestampMillis(b.tradeDate);
    if (timeA === timeB) {
      return getTimestampMillis(a.createdAt) - getTimestampMillis(b.createdAt);
    }
    return timeA - timeB;
  });

  for (const t of sorted) {
    const tradeQty = t.quantity;
    const tradePrice = t.price;
    const tradeFees = t.fees || 0;
    const tradeValue = tradeQty * tradePrice;

    if (t.type === 'BUY') {
      if (positionQty >= 0) {
        // Adding to Long position
        positionQty += tradeQty;
        costBasis += tradeValue + tradeFees;
      } else {
        // Covering a Short position
        const coverQty = Math.min(tradeQty, Math.abs(positionQty));
        const remainQty = tradeQty - coverQty;

        const avgShortPrice = costBasis / Math.abs(positionQty);
        const coveredCostBasis = coverQty * avgShortPrice;

        const tradeFeeForCover = tradeFees * (coverQty / tradeQty);
        // Short PnL = (Avg Sell Price - Buy Price) * Qty - Fees
        realizedPnL += (avgShortPrice - tradePrice) * coverQty - tradeFeeForCover;

        positionQty += coverQty; // Moves towards 0
        costBasis -= coveredCostBasis;

        if (remainQty > 0) {
          // Flipped to Long position
          positionQty += remainQty;
          const tradeFeeForRemain = tradeFees * (remainQty / tradeQty);
          costBasis += (remainQty * tradePrice) + tradeFeeForRemain;
        }
      }
    } else if (t.type === 'SELL') {
      if (positionQty <= 0) {
        // Adding to Short position
        positionQty -= tradeQty; 
        costBasis += tradeValue + tradeFees;
      } else {
        // Selling a Long position
        const sellQty = Math.min(tradeQty, positionQty);
        const remainQty = tradeQty - sellQty;

        const avgLongPrice = costBasis / positionQty;
        const soldCostBasis = sellQty * avgLongPrice;

        const tradeFeeForSell = tradeFees * (sellQty / tradeQty);
        // Long PnL = (Sell Price - Avg Buy Price) * Qty - Fees
        realizedPnL += (tradePrice - avgLongPrice) * sellQty - tradeFeeForSell;

        positionQty -= sellQty;
        costBasis -= soldCostBasis;

        if (remainQty > 0) {
          // Flipped to Short position
          positionQty -= remainQty;
          const tradeFeeForRemain = tradeFees * (remainQty / tradeQty);
          costBasis += (remainQty * tradePrice) + tradeFeeForRemain;
        }
      }
    }
    
    // Prevent floating point anomalies near zero
    if (Math.abs(positionQty) < 0.000001) {
      positionQty = 0;
      costBasis = 0;
    }
  }

  const averagePrice = Math.abs(positionQty) > 0 ? costBasis / Math.abs(positionQty) : 0;
  
  let unrealizedPnL = 0;
  if (currentPrice !== undefined && currentPrice > 0 && Math.abs(positionQty) > 0) {
    if (positionQty > 0) {
        // Long position unrealized PnL = (Current Price - Avg Cost) * Qty
        unrealizedPnL = (currentPrice - averagePrice) * positionQty;
    } else {
        // Short position unrealized PnL = (Avg Cost - Current Price) * |Qty|
        unrealizedPnL = (averagePrice - currentPrice) * Math.abs(positionQty);
    }
  }

  return {
    totalQuantity: positionQty,
    averagePrice: averagePrice,
    realizedPnL,
    unrealizedPnL
  };
}

export type AveragingRow = {
  price: string;
  quantity: string;
  quantity2?: string;
  bought?: boolean;
  riskFlag?: boolean;
};

/**
 * 依據平均成本自動計算向下攤平試算的預計購入股價 ($)
 * 系統一 (2% 階梯遞減):
 *   組別 1: -2% (avg * 0.98)
 *   組別 2: -4% (avg * 0.96)
 *   組別 3: -6% (avg * 0.94)
 *   組別 4: -8% (avg * 0.92)
 * 系統二 (3% 階梯遞減):
 *   組別 1: -3% (avg * 0.97)
 *   組別 2: -6% (avg * 0.94)
 *   組別 3: -9% (avg * 0.91)
 *   組別 4: -12% (avg * 0.88)
 */
export function generateAveragingDownRows(
  averagePrice: number,
  prevRowsSys1?: AveragingRow[],
  prevRowsSys2?: AveragingRow[]
): { sys1: AveragingRow[]; sys2: AveragingRow[] } {
  const sys1Ratios = [0.98, 0.96, 0.94, 0.92];
  const sys2Ratios = [0.97, 0.94, 0.91, 0.88];

  const sys1: AveragingRow[] = [0, 1, 2, 3].map((i) => {
    const prev = prevRowsSys1?.[i];
    const calcPrice = averagePrice > 0 ? (averagePrice * sys1Ratios[i]).toFixed(2) : (prev?.price ?? '');
    return {
      price: calcPrice,
      quantity: prev?.quantity ?? '',
      quantity2: prev?.quantity2 ?? '',
      bought: !!prev?.bought,
      riskFlag: !!prev?.riskFlag,
    };
  });

  const sys2: AveragingRow[] = [0, 1, 2, 3].map((i) => {
    const prev = prevRowsSys2?.[i];
    const calcPrice = averagePrice > 0 ? (averagePrice * sys2Ratios[i]).toFixed(2) : (prev?.price ?? '');
    return {
      price: calcPrice,
      quantity: prev?.quantity ?? '',
      quantity2: prev?.quantity2 ?? '',
      bought: !!prev?.bought,
      riskFlag: !!prev?.riskFlag,
    };
  });

  return { sys1, sys2 };
}

/**
 * 判斷是否需要自動更新並儲存向下攤平試算設定
 * 條件：非已完成 tab，且籌碼管理區塊有持有數量 (totalQuantity > 0 且 averagePrice > 0)
 */
export function shouldUpdateAveragingRows(
  tab: { status?: string; holdingStatus?: string; averagingRows?: AveragingRow[]; averagingRowsSys2?: AveragingRow[] },
  stats: { totalQuantity?: number; averagePrice?: number }
): { needsUpdate: boolean; sys1: AveragingRow[]; sys2: AveragingRow[] } {
  if (tab.status === 'COMPLETED') {
    return { needsUpdate: false, sys1: [], sys2: [] };
  }
  const qty = stats.totalQuantity ?? 0;
  const avg = stats.averagePrice ?? 0;
  if (qty === 0 || avg <= 0) {
    return { needsUpdate: false, sys1: [], sys2: [] };
  }

  const { sys1, sys2 } = generateAveragingDownRows(avg, tab.averagingRows, tab.averagingRowsSys2);

  const sys1Changed = sys1.some((r, i) => r.price !== (tab.averagingRows?.[i]?.price ?? ''));
  const sys2Changed = sys2.some((r, i) => r.price !== (tab.averagingRowsSys2?.[i]?.price ?? ''));

  return {
    needsUpdate: sys1Changed || sys2Changed,
    sys1,
    sys2,
  };
}

export interface BatchPlanSplit {
  name: string;
  shortLabel: string;
  size: number;
  bought: number;
  remaining: number;
  percent: string;
}

export interface BatchPlanItem {
  index: number;
  name: string;
  size: number;
  bought: number;
  remaining: number;
  split1: BatchPlanSplit;
  split2: BatchPlanSplit;
}

export interface BatchPlanningParams {
  plannedQty?: number;
  usableCapital?: number;
  currentPrice?: number;
  holdingQty?: number;
  trades?: any[];
  averagingRowsSys2?: AveragingRow[];
  plannedBuyPercent?: number;
  plannedBuyQty?: number;
}

/**
 * 精準識別交易記錄中填寫的批次與拆分選項
 */
export function matchTradeBatch(rawBatch: string | undefined | null): {
  batchIndex: number; // 0, 1, 2, 3, or -1
  splitIndex: number; // 0 (split1), 1 (split2), or -1 (non-split whole batch)
} {
  if (!rawBatch) return { batchIndex: -1, splitIndex: -1 };
  const b = String(rawBatch).replace(/\s+/g, '');

  // 1. 第一批拆分及整批
  if (b.includes('第一批拆分交易(7%)') || (b.includes('第一批') && b.includes('7%')) || (b.includes('第1批') && b.includes('7%'))) {
    return { batchIndex: 0, splitIndex: 0 };
  }
  if (b.includes('第一批拆分交易(8%)') || (b.includes('第一批') && b.includes('8%')) || (b.includes('第1批') && b.includes('8%'))) {
    return { batchIndex: 0, splitIndex: 1 };
  }
  if (b.includes('第一批交易') || b.includes('第一批(15%)') || ((b.includes('第一批') || b.includes('第1批') || b.includes('#1')) && !b.includes('7%') && !b.includes('8%'))) {
    return { batchIndex: 0, splitIndex: -1 };
  }

  // 2. 第二批拆分及整批
  if (b.includes('第二批拆分交易(10%)') || (b.includes('第二批') && b.includes('10%')) || (b.includes('第2批') && b.includes('10%'))) {
    return { batchIndex: 1, splitIndex: 0 };
  }
  if (b.includes('第二批拆分交易(15%)') || (b.includes('第二批') && b.includes('15%')) || (b.includes('第2批') && b.includes('15%'))) {
    return { batchIndex: 1, splitIndex: 1 };
  }
  if (b.includes('第二批交易') || b.includes('第二批(25%)') || ((b.includes('第二批') || b.includes('第2批') || b.includes('#2')) && !b.includes('10%') && !b.includes('15%'))) {
    return { batchIndex: 1, splitIndex: -1 };
  }

  // 3. 第三批拆分及整批
  if (b.includes('第三批拆分交易(15%)') || (b.includes('第三批') && b.includes('15%')) || (b.includes('第3批') && b.includes('15%'))) {
    return { batchIndex: 2, splitIndex: 0 };
  }
  if (b.includes('第三批拆分交易(20%)') || (b.includes('第三批') && b.includes('20%')) || (b.includes('第3批') && b.includes('20%'))) {
    return { batchIndex: 2, splitIndex: 1 };
  }
  if (b.includes('第三批交易') || b.includes('第三批(35%)') || ((b.includes('第三批') || b.includes('第3批') || b.includes('#3')) && !b.includes('15%') && !b.includes('20%'))) {
    return { batchIndex: 2, splitIndex: -1 };
  }

  // 4. 第四批拆分及整批 (避免 10%/15%/25% 誤配給第二批或第三批)
  if (b.includes('第四批拆分交易(10%)') || (b.includes('第四批') && b.includes('10%')) || (b.includes('第4批') && b.includes('10%'))) {
    return { batchIndex: 3, splitIndex: 0 };
  }
  if (b.includes('第四批拆分交易(15%)') || (b.includes('第四批') && b.includes('15%')) || (b.includes('第4批') && b.includes('15%'))) {
    return { batchIndex: 3, splitIndex: 1 };
  }
  if (b.includes('第四批交易') || b.includes('第四批(25%)') || ((b.includes('第四批') || b.includes('第4批') || b.includes('#4')) && !b.includes('10%') && !b.includes('15%'))) {
    return { batchIndex: 3, splitIndex: -1 };
  }

  return { batchIndex: -1, splitIndex: -1 };
}

/**
 * 統一計算 4 批進場金字塔與 8 項拆分交易的所有數值 (所處階段所需個別股數 | 已購買 數量 | 預購買數量)
 * 徹底解決各分頁 (StockTabDetail、DynamicVisualLinesModal、System2PlanningChart) 間股數分配不一致之問題
 */
export function calculateBatchPlanning(params: BatchPlanningParams): {
  plannedQty: number;
  batches: BatchPlanItem[];
  totalBought: number;
  totalRemaining: number;
} {
  const safeParams = params || ({} as BatchPlanningParams);
  const {
    currentPrice = 0,
    usableCapital = 0,
    holdingQty = 0,
    trades = [],
    averagingRowsSys2 = [],
    plannedBuyQty,
  } = safeParams;

  // 1. 推算預計購買總股數 plannedQty
  let effPlanned = safeParams.plannedQty && safeParams.plannedQty > 0 ? safeParams.plannedQty : 0;
  if (effPlanned <= 0 && currentPrice > 0 && usableCapital > 0) {
    effPlanned = Math.floor(usableCapital / currentPrice);
  }
  if (effPlanned <= 0 && plannedBuyQty && Number(plannedBuyQty) > 0) {
    effPlanned = Number(plannedBuyQty);
  }
  if (effPlanned <= 0 && averagingRowsSys2 && averagingRowsSys2.length > 0) {
    const rowsSum = averagingRowsSys2.reduce((acc, r) => {
      const q1 = r?.quantity ? parseFloat(r.quantity) : 0;
      const q2 = r?.quantity2 ? parseFloat(r.quantity2) : 0;
      return acc + (isNaN(q1) ? 0 : q1) + (isNaN(q2) ? 0 : q2);
    }, 0);
    if (rowsSum > 0) effPlanned = rowsSum;
  }
  if (effPlanned <= 0 && holdingQty > 0) {
    effPlanned = Math.max(holdingQty, Math.ceil(holdingQty / 0.15));
  }

  // 2. 預設 4 批與 8 個拆分階梯規格
  const splitConfigs = [
    { name: '第一批 (15%)', totalPct: 15, s1Name: '第一批拆分交易(7%)', s1Short: '拆分 7%', s1Pct: 7, s2Name: '第一批拆分交易(8%)', s2Short: '拆分 8%', s2Pct: 8 },
    { name: '第二批 (25%)', totalPct: 25, s1Name: '第二批拆分交易(10%)', s1Short: '拆分 10%', s1Pct: 10, s2Name: '第二批拆分交易(15%)', s2Short: '拆分 15%', s2Pct: 15 },
    { name: '第三批 (35%)', totalPct: 35, s1Name: '第三批拆分交易(15%)', s1Short: '拆分 15%', s1Pct: 15, s2Name: '第三批拆分交易(20%)', s2Short: '拆分 20%', s2Pct: 20 },
    { name: '第四批 (25%)', totalPct: 25, s1Name: '第四批拆分交易(10%)', s1Short: '拆分 10%', s1Pct: 10, s2Name: '第四批拆分交易(15%)', s2Short: '拆分 15%', s2Pct: 15 },
  ];

  // 3. 計算各批預定股數 (優先採納 averagingRowsSys2 自訂股數，否則按百分比計算)
  const sizes = splitConfigs.map((cfg, idx) => {
    const row = averagingRowsSys2?.[idx];
    const rowQ1 = row?.quantity ? parseFloat(row.quantity) : 0;
    const rowQ2 = row?.quantity2 ? parseFloat(row.quantity2) : 0;
    let s1 = !isNaN(rowQ1) && rowQ1 > 0 ? rowQ1 : 0;
    let s2 = !isNaN(rowQ2) && rowQ2 > 0 ? rowQ2 : 0;

    if (s1 === 0 && s2 === 0 && effPlanned > 0) {
      const totalBatch = Math.ceil(effPlanned * (cfg.totalPct / 100));
      s1 = Math.round(effPlanned * (cfg.s1Pct / 100));
      s2 = Math.max(0, totalBatch - s1);
    }
    return {
      size: s1 + s2,
      s1Size: s1,
      s2Size: s2,
    };
  });

  // 4. 解析 trades 交易記錄中精確指定的拆分及批次股數
  const tradeSplitShares: number[][] = [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ];
  const tradeBatchShares: number[] = [0, 0, 0, 0];
  let netTradeQty = 0;

  if (Array.isArray(trades)) {
    trades.forEach((t) => {
      const q = typeof t.quantity === 'number' ? t.quantity : parseFloat(String(t.quantity)) || 0;
      if (t.type === 'BUY') {
        netTradeQty += q;
        const { batchIndex, splitIndex } = matchTradeBatch(t.batch);
        if (batchIndex >= 0 && batchIndex <= 3) {
          if (splitIndex === 0 || splitIndex === 1) {
            tradeSplitShares[batchIndex][splitIndex] += q;
          } else {
            tradeBatchShares[batchIndex] += q;
          }
        }
      } else if (t.type === 'SELL') {
        netTradeQty = Math.max(0, netTradeQty - q);
      }
    });
  }

  // 5. 初始化各拆分已購買數量 (先填入明確指定拆分的交易股數)
  const splitBought: number[][] = [
    [tradeSplitShares[0][0], tradeSplitShares[0][1]],
    [tradeSplitShares[1][0], tradeSplitShares[1][1]],
    [tradeSplitShares[2][0], tradeSplitShares[2][1]],
    [tradeSplitShares[3][0], tradeSplitShares[3][1]],
  ];

  // 將未指定細分拆分的整批交易股數依序分配入 split1 與 split2
  for (let i = 0; i < 4; i++) {
    let unassignedBatchShares = tradeBatchShares[i];
    if (unassignedBatchShares > 0) {
      const s1Need = Math.max(0, sizes[i].s1Size - splitBought[i][0]);
      const add1 = Math.min(unassignedBatchShares, s1Need);
      splitBought[i][0] += add1;
      unassignedBatchShares -= add1;

      if (unassignedBatchShares > 0) {
        splitBought[i][1] += unassignedBatchShares;
      }
    }
  }

  // 檢查 averagingRowsSys2 勾選標記為「已購入」的行
  for (let i = 0; i < 4; i++) {
    if (averagingRowsSys2?.[i]?.bought) {
      splitBought[i][0] = Math.max(splitBought[i][0], sizes[i].s1Size);
      splitBought[i][1] = Math.max(splitBought[i][1], sizes[i].s2Size);
    }
  }

  // 6. 處理整體持股數 (holdingQty 或 netTradeQty) 尚未被明確標註之餘額，進行階梯級聯分配
  const totalAccountedFor = splitBought.reduce((acc, sp) => acc + sp[0] + sp[1], 0);
  const effectiveHoldingPool = Math.max(0, holdingQty, netTradeQty);
  let unallocatedHolding = Math.max(0, effectiveHoldingPool - totalAccountedFor);

  if (unallocatedHolding > 0) {
    for (let i = 0; i < 4; i++) {
      if (unallocatedHolding <= 0) break;
      const s1Need = Math.max(0, sizes[i].s1Size - splitBought[i][0]);
      if (s1Need > 0) {
        const add = Math.min(unallocatedHolding, s1Need);
        splitBought[i][0] += add;
        unallocatedHolding -= add;
      }

      if (unallocatedHolding <= 0) break;
      const s2Need = Math.max(0, sizes[i].s2Size - splitBought[i][1]);
      if (s2Need > 0) {
        const add = Math.min(unallocatedHolding, s2Need);
        splitBought[i][1] += add;
        unallocatedHolding -= add;
      }
    }

    // 若全部填滿仍有持股，累積計入最後一組 (第四批拆分2)
    if (unallocatedHolding > 0) {
      splitBought[3][1] += unallocatedHolding;
    }
  }

  // 7. 組合輸出最終的批次與拆分交易物件陣列
  const batches: BatchPlanItem[] = splitConfigs.map((cfg, idx) => {
    const s1Size = sizes[idx].s1Size;
    const s2Size = sizes[idx].s2Size;
    const s1Bought = splitBought[idx][0];
    const s2Bought = splitBought[idx][1];
    const batchSize = sizes[idx].size;
    const batchBought = s1Bought + s2Bought;

    return {
      index: idx,
      name: cfg.name,
      size: batchSize,
      bought: batchBought,
      remaining: Math.max(0, batchSize - batchBought),
      split1: {
        name: cfg.s1Name,
        shortLabel: cfg.s1Short,
        size: s1Size,
        bought: s1Bought,
        remaining: Math.max(0, s1Size - s1Bought),
        percent: `${cfg.s1Pct}%`,
      },
      split2: {
        name: cfg.s2Name,
        shortLabel: cfg.s2Short,
        size: s2Size,
        bought: s2Bought,
        remaining: Math.max(0, s2Size - s2Bought),
        percent: `${cfg.s2Pct}%`,
      },
    };
  });

  const totalBought = batches.reduce((sum, b) => sum + b.bought, 0);
  const totalPlannedSize = batches.reduce((sum, b) => sum + b.size, 0);
  const totalRemaining = Math.max(0, totalPlannedSize - totalBought);

  return {
    plannedQty: effPlanned,
    batches,
    totalBought,
    totalRemaining,
  };
}
