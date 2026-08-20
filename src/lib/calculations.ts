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
