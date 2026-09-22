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
  plannedPercent?: number;
  plannedBuyQty?: number;
  totalCapital?: number;
  virtualCapital?: number;
  tradeType?: string;
  maxStrategyRiskPool60?: number;
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
 * 嚴格參照個股頁面 (StockTabDetail) 的計算準則作為全域唯一真理，保證圖示卡片與個股頁面數值 100% 同步
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
    plannedBuyPercent,
    plannedPercent,
    totalCapital,
    virtualCapital,
    tradeType,
    maxStrategyRiskPool60,
  } = safeParams;

  // 1. 資金池與可用資金推算 (完全對齊個股頁面 StockTabDetail 核心邏輯)
  const effectiveCapital = (tradeType === 'simulated' ? virtualCapital : totalCapital) || totalCapital || 1000000;
  const riskPool = (typeof maxStrategyRiskPool60 === 'number' && maxStrategyRiskPool60 > 0)
    ? maxStrategyRiskPool60
    : (effectiveCapital * 2) * 0.6;

  const pct = (plannedBuyPercent !== undefined && plannedBuyPercent !== null && !isNaN(Number(plannedBuyPercent)))
    ? Number(plannedBuyPercent)
    : (plannedPercent !== undefined && plannedPercent !== null && !isNaN(Number(plannedPercent)) ? Number(plannedPercent) : 0);

  const effectiveUsableCapital = pct > 0 ? riskPool * (pct / 100) : (usableCapital || 0);

  // 2. 推算預計購買總股數 plannedQty (以個股頁面規則為主: 優先由 usableCapital / currentPrice 換算)
  let effPlanned = 0;
  if (currentPrice > 0 && effectiveUsableCapital > 0) {
    effPlanned = Math.floor(effectiveUsableCapital / currentPrice);
  } else if (safeParams.plannedQty && safeParams.plannedQty > 0) {
    effPlanned = safeParams.plannedQty;
  } else if (plannedBuyQty && Number(plannedBuyQty) > 0) {
    effPlanned = Number(plannedBuyQty);
  } else if (averagingRowsSys2 && averagingRowsSys2.length > 0) {
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

  // 3. 各批預定股數與拆分階梯 (嚴格參照個股頁面 15%、25%、35%、25% 之 Math.ceil 及拆分百分比)
  // 第一批 (15%) -> 拆分 7% + 拆分 8%
  const size1 = Math.ceil(effPlanned * 0.15);
  const size1_a = Math.round(effPlanned * 0.07);
  const size1_b = Math.max(0, size1 - size1_a);

  // 第二批 (25%) -> 拆分 10% + 拆分 15%
  const size2 = Math.ceil(effPlanned * 0.25);
  const size2_a = Math.round(effPlanned * 0.10);
  const size2_b = Math.max(0, size2 - size2_a);

  // 第三批 (35%) -> 拆分 15% + 拆分 20%
  const size3 = Math.ceil(effPlanned * 0.35);
  const size3_a = Math.round(effPlanned * 0.15);
  const size3_b = Math.max(0, size3 - size3_a);

  // 第四批 (25%) -> 拆分 10% + 拆分 15%
  const size4 = Math.ceil(effPlanned * 0.25);
  const size4_a = Math.round(effPlanned * 0.10);
  const size4_b = Math.max(0, size4 - size4_a);

  // 4. 解析 trades 交易記錄中指定批次與拆分交易的已購數量
  const tradeBatchSharesSys2 = [0, 0, 0, 0];
  const tradeSplitShares: number[][] = [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ];

  if (Array.isArray(trades)) {
    trades.forEach((t) => {
      if (t.type === 'BUY') {
        const q = typeof t.quantity === 'number' ? t.quantity : parseFloat(String(t.quantity)) || 0;
        if (q > 0) {
          const b = (t.batch || '').replace(/\s+/g, '');
          if (b.includes('第一批') || b.includes('第1批') || b.includes('#1') || b.includes('7%') || b.includes('8%')) {
            tradeBatchSharesSys2[0] += q;
            if (b.includes('7%')) tradeSplitShares[0][0] += q;
            else if (b.includes('8%')) tradeSplitShares[0][1] += q;
          } else if (b.includes('第二批') || b.includes('第2批') || b.includes('#2') || b.includes('10%') || b.includes('25%')) {
            tradeBatchSharesSys2[1] += q;
            if (b.includes('10%')) tradeSplitShares[1][0] += q;
            else if (b.includes('15%')) tradeSplitShares[1][1] += q;
          } else if (b.includes('第三批') || b.includes('第3批') || b.includes('#3') || b.includes('20%') || b.includes('35%')) {
            tradeBatchSharesSys2[2] += q;
            if (b.includes('15%')) tradeSplitShares[2][0] += q;
            else if (b.includes('20%')) tradeSplitShares[2][1] += q;
          } else if (b.includes('第四批') || b.includes('第4批') || b.includes('#4')) {
            tradeBatchSharesSys2[3] += q;
            if (b.includes('10%')) tradeSplitShares[3][0] += q;
            else if (b.includes('15%')) tradeSplitShares[3][1] += q;
          }
        }
      }
    });
  }

  // 5. 檢查 averagingRowsSys2 是否有被勾選為已購入的批次
  const checkedRowsBoughtSys2 = (averagingRowsSys2 || []).reduce((sum, r, idx) => {
    if (!r?.bought) return sum;
    const q1 = r?.quantity ? parseFloat(r.quantity) : 0;
    const q2 = r?.quantity2 ? parseFloat(r.quantity2) : 0;
    const target = q1 + q2 > 0 ? q1 + q2 : [size1, size2, size3, size4][idx] || 0;
    return sum + target;
  }, 0);

  const totalBought = Math.max(0, holdingQty, checkedRowsBoughtSys2);

  // 6. 計算各批與拆分子批已購與餘額 (累進階梯級聯計算，與個股頁面完全相同)
  // 第一批
  const cascade1_a = Math.min(totalBought, size1_a);
  const remAfter1_a = Math.max(0, totalBought - size1_a);
  const cascade1_b = Math.min(remAfter1_a, size1_b);
  const isRow0Bought = Boolean(averagingRowsSys2?.[0]?.bought);
  const bought1 = Math.max(isRow0Bought ? size1 : (cascade1_a + cascade1_b), tradeBatchSharesSys2[0]);
  const remaining1 = Math.max(0, size1 - bought1);
  const bought1_a = Math.max(cascade1_a, tradeSplitShares[0][0], Math.min(bought1, size1_a));
  const remaining1_a = Math.max(0, size1_a - bought1_a);
  const bought1_b = Math.max(cascade1_b, tradeSplitShares[0][1], Math.min(Math.max(0, bought1 - size1_a), size1_b));
  const remaining1_b = Math.max(0, size1_b - bought1_b);

  // 第二批
  const remAfter1 = Math.max(0, totalBought - size1);
  const cascade2_a = Math.min(remAfter1, size2_a);
  const remAfter2_a = Math.max(0, remAfter1 - size2_a);
  const cascade2_b = Math.min(remAfter2_a, size2_b);
  const isRow1Bought = Boolean(averagingRowsSys2?.[1]?.bought);
  const bought2 = Math.max(isRow1Bought ? size2 : (cascade2_a + cascade2_b), tradeBatchSharesSys2[1]);
  const remaining2 = Math.max(0, size2 - bought2);
  const bought2_a = Math.max(cascade2_a, tradeSplitShares[1][0], Math.min(bought2, size2_a));
  const remaining2_a = Math.max(0, size2_a - bought2_a);
  const bought2_b = Math.max(cascade2_b, tradeSplitShares[1][1], Math.min(Math.max(0, bought2 - size2_a), size2_b));
  const remaining2_b = Math.max(0, size2_b - bought2_b);

  // 第三批
  const remAfter2 = Math.max(0, totalBought - size1 - size2);
  const cascade3_a = Math.min(remAfter2, size3_a);
  const remAfter3_a = Math.max(0, remAfter2 - size3_a);
  const cascade3_b = Math.min(remAfter3_a, size3_b);
  const isRow2Bought = Boolean(averagingRowsSys2?.[2]?.bought);
  const bought3 = Math.max(isRow2Bought ? size3 : (cascade3_a + cascade3_b), tradeBatchSharesSys2[2]);
  const remaining3 = Math.max(0, size3 - bought3);
  const bought3_a = Math.max(cascade3_a, tradeSplitShares[2][0], Math.min(bought3, size3_a));
  const remaining3_a = Math.max(0, size3_a - bought3_a);
  const bought3_b = Math.max(cascade3_b, tradeSplitShares[2][1], Math.min(Math.max(0, bought3 - size3_a), size3_b));
  const remaining3_b = Math.max(0, size3_b - bought3_b);

  // 第四批
  const remAfter3 = Math.max(0, totalBought - size1 - size2 - size3);
  const cascade4_a = Math.min(remAfter3, size4_a);
  const remAfter4_a = Math.max(0, remAfter3 - size4_a);
  const cascade4_b = Math.min(remAfter4_a, size4_b);
  const isRow3Bought = Boolean(averagingRowsSys2?.[3]?.bought);
  const bought4 = Math.max(isRow3Bought ? size4 : (cascade4_a + cascade4_b), tradeBatchSharesSys2[3]);
  const remaining4 = Math.max(0, size4 - bought4);
  const bought4_a = Math.max(cascade4_a, tradeSplitShares[3][0], Math.min(bought4, size4_a));
  const remaining4_a = Math.max(0, size4_a - bought4_a);
  const bought4_b = Math.max(cascade4_b, tradeSplitShares[3][1], Math.min(Math.max(0, bought4 - size4_a), size4_b));
  const remaining4_b = Math.max(0, size4_b - bought4_b);

  // 7. 組合輸出最終的批次與拆分交易物件陣列
  const batches: BatchPlanItem[] = [
    {
      index: 0,
      name: '第一批 (15%)',
      size: size1,
      bought: bought1,
      remaining: remaining1,
      split1: {
        name: '第一批拆分交易(7%)',
        shortLabel: '拆分 7%',
        size: size1_a,
        bought: bought1_a,
        remaining: remaining1_a,
        percent: '7%',
      },
      split2: {
        name: '第一批拆分交易(8%)',
        shortLabel: '拆分 8%',
        size: size1_b,
        bought: bought1_b,
        remaining: remaining1_b,
        percent: '8%',
      },
    },
    {
      index: 1,
      name: '第二批 (25%)',
      size: size2,
      bought: bought2,
      remaining: remaining2,
      split1: {
        name: '第二批拆分交易(10%)',
        shortLabel: '拆分 10%',
        size: size2_a,
        bought: bought2_a,
        remaining: remaining2_a,
        percent: '10%',
      },
      split2: {
        name: '第二批拆分交易(15%)',
        shortLabel: '拆分 15%',
        size: size2_b,
        bought: bought2_b,
        remaining: remaining2_b,
        percent: '15%',
      },
    },
    {
      index: 2,
      name: '第三批 (35%)',
      size: size3,
      bought: bought3,
      remaining: remaining3,
      split1: {
        name: '第三批拆分交易(15%)',
        shortLabel: '拆分 15%',
        size: size3_a,
        bought: bought3_a,
        remaining: remaining3_a,
        percent: '15%',
      },
      split2: {
        name: '第三批拆分交易(20%)',
        shortLabel: '拆分 20%',
        size: size3_b,
        bought: bought3_b,
        remaining: remaining3_b,
        percent: '20%',
      },
    },
    {
      index: 3,
      name: '第四批 (25%)',
      size: size4,
      bought: bought4,
      remaining: remaining4,
      split1: {
        name: '第四批拆分交易(10%)',
        shortLabel: '拆分 10%',
        size: size4_a,
        bought: bought4_a,
        remaining: remaining4_a,
        percent: '10%',
      },
      split2: {
        name: '第四批拆分交易(15%)',
        shortLabel: '拆分 15%',
        size: size4_b,
        bought: bought4_b,
        remaining: remaining4_b,
        percent: '15%',
      },
    },
  ];

  return {
    plannedQty: effPlanned,
    batches,
    totalBought,
    totalRemaining: Math.max(0, effPlanned - totalBought),
  };
}
