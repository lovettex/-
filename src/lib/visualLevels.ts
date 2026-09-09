import { VisualPriceLevel } from '../components/System2PlanningChart';
import { extractCardPricePoints } from '../utils/visualLinesSync';

export function getVisualPriceLevels(
  tab?: any | null,
  strategy?: any | null,
  plannedOrders?: any[] | null
): VisualPriceLevel[] {
  const list: VisualPriceLevel[] = [];
  const seen = new Set<string>();

  const addLevel = (lvl: VisualPriceLevel) => {
    if (!lvl.price || isNaN(lvl.price) || lvl.price <= 0 || !isFinite(lvl.price)) return;
    // Normalize price to 2 decimal digits for deduplication
    const key = `${lvl.type}-${lvl.price.toFixed(2)}`;
    if (!seen.has(key)) {
      seen.add(key);
      list.push(lvl);
    }
  };

  // 1. Tab direct properties: stopLossPrice, takeProfitPrice, supportPrice, resistancePrice
  if (tab) {
    const slVal = typeof tab.stopLossPrice === 'number' ? tab.stopLossPrice : parseFloat(String(tab.stopLossPrice));
    if (!isNaN(slVal) && slVal > 0) {
      addLevel({
        id: 'tab-stoploss',
        type: 'stopLoss',
        label: '止損',
        price: slVal,
        color: '#dc2626',
        note: '設定停損價',
      });
    }

    const tpVal = typeof tab.takeProfitPrice === 'number' ? tab.takeProfitPrice : parseFloat(String(tab.takeProfitPrice));
    if (!isNaN(tpVal) && tpVal > 0) {
      addLevel({
        id: 'tab-takeprofit',
        type: 'takeProfit',
        label: '止盈',
        price: tpVal,
        color: '#059669',
        note: '設定止盈目標價',
      });
    }

    const suppVal = typeof tab.supportPrice === 'number' ? tab.supportPrice : parseFloat(String(tab.supportPrice));
    if (!isNaN(suppVal) && suppVal > 0) {
      addLevel({
        id: 'tab-support',
        type: 'support',
        label: '支撐',
        price: suppVal,
        color: '#d97706',
        note: '關鍵支撐價',
      });
    }

    const resVal = typeof tab.resistancePrice === 'number' ? tab.resistancePrice : parseFloat(String(tab.resistancePrice));
    if (!isNaN(resVal) && resVal > 0) {
      addLevel({
        id: 'tab-resistance',
        type: 'resistance',
        label: '壓力',
        price: resVal,
        color: '#e11d48',
        note: '關鍵壓力價',
      });
    }

    // Tab chartAnnotations (Dividers / Lines placed on chart or card)
    if (Array.isArray(tab.chartAnnotations)) {
      tab.chartAnnotations.forEach((ann: any, idx: number) => {
        let p = typeof ann.price === 'number' ? ann.price : parseFloat(String(ann.price));
        if (isNaN(p) || p <= 0) {
          const annY = ann.y !== undefined ? ann.y : (ann.y1 !== undefined && ann.y2 !== undefined ? (ann.y1 + ann.y2) / 2 : ann.y1);
          if (typeof annY === 'number' && !isNaN(annY)) {
            const { uniqueSortedPrices } = extractCardPricePoints(tab, strategy);
            if (uniqueSortedPrices.length >= 2) {
              const topY = 7;
              const bottomY = 93;
              const clampedY = Math.max(topY, Math.min(bottomY, annY));
              const ratio = (bottomY - clampedY) / (bottomY - topY);
              const n = uniqueSortedPrices.length;
              const idxFloat = ratio * (n - 1);
              const lowIdx = Math.floor(idxFloat);
              const highIdx = Math.min(n - 1, lowIdx + 1);
              const frac = idxFloat - lowIdx;
              p = uniqueSortedPrices[lowIdx] + frac * (uniqueSortedPrices[highIdx] - uniqueSortedPrices[lowIdx]);
            }
          }
        }
        if (!isNaN(p) && p > 0) {
          const text = (ann.text || '').trim();
          const isExplicitDivider =
            ann.type === 'divider' ||
            Boolean(ann.isDivider) ||
            (ann.type === 'line' && Math.abs((ann.y2 ?? ann.y1 ?? 0) - (ann.y1 ?? 0)) < 8 && Math.abs((ann.x2 ?? 100) - (ann.x1 ?? 0)) >= 10) ||
            text.includes('分隔線') ||
            text.includes('基準');

          let type: VisualPriceLevel['type'] = 'support';
          let label = '支撐';
          let color = '#d97706';
          let isCardDivider = false;

          if (isExplicitDivider) {
            type = 'divider';
            label = text || '卡片分隔線';
            color = ann.color || '#6366f1';
            isCardDivider = true;
          } else if (text.includes('止損')) {
            type = 'stopLoss';
            label = '止損';
            color = '#dc2626';
          } else if (text.includes('止盈')) {
            type = 'takeProfit';
            label = '止盈';
            color = '#059669';
          } else if (text.includes('壓力')) {
            type = 'resistance';
            label = '壓力';
            color = '#e11d48';
          } else if (text.includes('支撐')) {
            type = 'support';
            label = '支撐';
            color = '#d97706';
          } else if (ann.color === '#ef4444' || ann.color === '#dc2626' || ann.color === '#f87171') {
            type = 'resistance';
            label = '壓力';
            color = '#e11d48';
          } else if (ann.color === '#10b981' || ann.color === '#059669') {
            type = 'takeProfit';
            label = '止盈';
            color = '#059669';
          } else if (ann.color === '#facc15' || ann.color === '#d97706') {
            type = 'support';
            label = '支撐';
            color = '#d97706';
          } else {
            // 自訂顏色或其他線條，預設歸類為卡片分隔線
            type = 'divider';
            label = text || '卡片分隔線';
            color = ann.color || '#6366f1';
            isCardDivider = true;
          }

          addLevel({
            id: `tab-ann-${ann.id || idx}`,
            type,
            label,
            price: p,
            color,
            isCardDivider,
            note: text || (isCardDivider ? `卡片分隔線 $${p.toFixed(2)}` : `防線 $${p.toFixed(2)}`),
          });
        }
      });
    }
  }

  // 2. Strategy (from useStrategy hook or tab.strategy fallback)
  const strat = strategy || (tab && tab.strategy);
  if (strat) {
    // 2.1 Support zones
    if (Array.isArray(strat.supportZones)) {
      strat.supportZones.forEach((sz: any, idx: number) => {
        const p = typeof sz.price === 'number' ? sz.price : parseFloat(String(sz.price));
        if (!isNaN(p) && p > 0) {
          addLevel({
            id: `strat-supp-${idx}`,
            type: 'support',
            label: '支撐',
            price: p,
            color: '#d97706',
            note: sz.notes || sz.description || `策略支撐區 #${idx + 1}`,
          });
        }
      });
    }

    // 2.2 Resistance zones
    if (Array.isArray(strat.resistanceZones)) {
      strat.resistanceZones.forEach((rz: any, idx: number) => {
        const p = typeof rz.price === 'number' ? rz.price : parseFloat(String(rz.price));
        if (!isNaN(p) && p > 0) {
          addLevel({
            id: `strat-res-${idx}`,
            type: 'resistance',
            label: '壓力',
            price: p,
            color: '#e11d48',
            note: rz.notes || rz.description || `策略壓力區 #${idx + 1}`,
          });
        }
      });
    }

    // 2.3 Stop loss targets (slTargets & legacy sl)
    if (Array.isArray(strat.slTargets)) {
      strat.slTargets.forEach((st: any, idx: number) => {
        const p = typeof st.price === 'number' ? st.price : parseFloat(String(st.price));
        if (!isNaN(p) && p > 0) {
          addLevel({
            id: `strat-sl-${idx}`,
            type: 'stopLoss',
            label: '止損',
            price: p,
            color: '#dc2626',
            note: st.notes || st.label || (st.quantity ? `停損 ${st.quantity}股` : '策略止損目標'),
          });
        }
      });
    }
    if (strat.sl) {
      const slLegacy = typeof strat.sl === 'number' ? strat.sl : parseFloat(String(strat.sl));
      if (!isNaN(slLegacy) && slLegacy > 0) {
        addLevel({
          id: 'strat-sl-legacy',
          type: 'stopLoss',
          label: '止損',
          price: slLegacy,
          color: '#dc2626',
          note: '策略停損價',
        });
      }
    }

    // 2.4 Take profit targets (tpTargets & legacy tp1, tp2, tp3)
    if (Array.isArray(strat.tpTargets)) {
      strat.tpTargets.forEach((tt: any, idx: number) => {
        const p = typeof tt.price === 'number' ? tt.price : parseFloat(String(tt.price));
        if (!isNaN(p) && p > 0) {
          addLevel({
            id: `strat-tp-${idx}`,
            type: 'takeProfit',
            label: '止盈',
            price: p,
            color: '#059669',
            note: tt.notes || tt.label || (tt.quantity ? `目標 ${tt.quantity}股` : `止盈目標 #${idx + 1}`),
          });
        }
      });
    }
    [strat.tp1, strat.tp2, strat.tp3].forEach((tp, idx) => {
      if (tp) {
        const tpNum = typeof tp === 'number' ? tp : parseFloat(String(tp));
        if (!isNaN(tpNum) && tpNum > 0) {
          addLevel({
            id: `strat-tp-legacy-${idx + 1}`,
            type: 'takeProfit',
            label: '止盈',
            price: tpNum,
            color: '#059669',
            note: `止盈目標 TP${idx + 1}`,
          });
        }
      }
    });

    // 2.5 Planned entries (entries in strategy)
    if (Array.isArray(strat.entries)) {
      strat.entries.forEach((entry: any, idx: number) => {
        const p = typeof entry.price === 'number' ? entry.price : parseFloat(String(entry.priceStr || entry.price));
        if (!isNaN(p) && p > 0) {
          const notes = (entry.notes || '').trim();
          let type: VisualPriceLevel['type'] = 'support';
          let label = '支撐';
          let color = '#d97706';

          if (notes.includes('止損')) {
            type = 'stopLoss';
            label = '止損';
            color = '#dc2626';
          } else if (notes.includes('止盈')) {
            type = 'takeProfit';
            label = '止盈';
            color = '#059669';
          } else if (notes.includes('壓力')) {
            type = 'resistance';
            label = '壓力';
            color = '#e11d48';
          } else if (notes.includes('支撐') || entry.type === 'BUY') {
            type = 'support';
            label = '支撐';
            color = '#d97706';
          }

          addLevel({
            id: `strat-entry-${idx}`,
            type,
            label,
            price: p,
            color,
            note: notes || `進出場規劃 #${idx + 1}`,
          });
        }
      });
    }
  }

  // 3. Planned Orders (from subcollection or parent list)
  if (Array.isArray(plannedOrders)) {
    plannedOrders.forEach((order, idx) => {
      const p = typeof order.price === 'number' ? order.price : parseFloat(String(order.price));
      if (isNaN(p) || p <= 0) return;

      const fullText = `${order.category || ''} ${order.categoryType || ''} ${order.notes || ''} ${order.conditions || ''}`.trim();
      let type: VisualPriceLevel['type'] | null = null;
      let label = '';
      let color = '';

      if (order.category === '支撐門檻' || order.categoryType === '支撐門檻' || fullText.includes('支撐')) {
        type = 'support';
        label = '支撐';
        color = '#d97706';
      } else if (order.category === '止損設定' || order.categoryType === '止損設定' || fullText.includes('止損')) {
        type = 'stopLoss';
        label = '止損';
        color = '#dc2626';
      } else if (order.category === '壓力門檻' || order.categoryType === '壓力門檻' || fullText.includes('壓力')) {
        type = 'resistance';
        label = '壓力';
        color = '#e11d48';
      } else if (order.category === '止盈設定' || order.categoryType === '止盈設定' || fullText.includes('止盈')) {
        type = 'takeProfit';
        label = '止盈';
        color = '#059669';
      }

      if (type) {
        addLevel({
          id: `planned-${order.id || idx}`,
          type,
          label,
          price: p,
          color,
          note: order.conditions || order.notes || undefined,
        });
      }
    });
  }

  return list.sort((a, b) => a.price - b.price);
}
