import { Trade } from '../types';
import { getTimestampMillis } from './dateUtils';

export function calculateStats(trades: Trade[], currentPrice?: number) {
  let positionQty = 0;
  let costBasis = 0; 
  let realizedPnL = 0;

  // Ensure trades are sorted sequentially from oldest to newest for average cost calculation
  const sorted = [...trades].sort((a, b) => {
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
