import { safeLocalStorage } from '../lib/utils';

export interface SimulatedPreOrder {
  id: string;
  price: number;
  quantity: number;
  direction?: 'BUY' | 'SELL';
  notes?: string;
  isSimulated?: boolean;
  category?: string;
  createdAt?: number;
}

const cleanSymbolKey = (symbol: string): string => {
  if (!symbol) return '';
  return symbol.trim().split(/[\s(/]/)[0].toUpperCase();
};

const getDeletedTombstones = (cleanSym: string): Set<string> => {
  if (!cleanSym) return new Set();
  try {
    const raw = safeLocalStorage.getItem(`simulated_preorders_deleted_${cleanSym}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed.map(String));
    }
  } catch (e) {}
  return new Set();
};

const addDeletedTombstone = (cleanSym: string, idOrPriceKey: string) => {
  if (!cleanSym || !idOrPriceKey) return;
  try {
    const set = getDeletedTombstones(cleanSym);
    set.add(String(idOrPriceKey));
    safeLocalStorage.setItem(
      `simulated_preorders_deleted_${cleanSym}`,
      JSON.stringify(Array.from(set))
    );
  } catch (e) {}
};

const removeDeletedTombstoneByPrice = (cleanSym: string, price: number) => {
  if (!cleanSym || !(price > 0)) return;
  try {
    const set = getDeletedTombstones(cleanSym);
    set.delete(`price:${Number(price).toFixed(2)}`);
    safeLocalStorage.setItem(
      `simulated_preorders_deleted_${cleanSym}`,
      JSON.stringify(Array.from(set))
    );
  } catch (e) {}
};

const syncToBackend = (cleanSym: string, orders: SimulatedPreOrder[]) => {
  if (typeof window === 'undefined' || !cleanSym) return;
  fetch('/api/simulated-preorders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: cleanSym, orders }),
  }).catch(() => {});
};

let hasHydratedFromBackend = false;
export function hydrateSimulatedPreOrdersFromBackend() {
  if (typeof window === 'undefined' || hasHydratedFromBackend) return;
  hasHydratedFromBackend = true;
  fetch('/api/simulated-preorders')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data && data.success && data.preOrdersBySymbol && typeof data.preOrdersBySymbol === 'object') {
        let changed = false;
        Object.entries(data.preOrdersBySymbol).forEach(([sym, serverOrders]) => {
          const cleanSym = cleanSymbolKey(sym);
          if (!cleanSym || !Array.isArray(serverOrders)) return;
          const localOrders = getSimulatedPreOrders(cleanSym);
          if (localOrders.length === 0 && serverOrders.length > 0) {
            const tombstones = getDeletedTombstones(cleanSym);
            const filtered = (serverOrders as SimulatedPreOrder[]).filter(
              (o) =>
                o &&
                typeof o.price === 'number' &&
                o.price > 0 &&
                !tombstones.has(String(o.id)) &&
                !tombstones.has(`price:${Number(o.price).toFixed(2)}`)
            );
            if (filtered.length > 0) {
              safeLocalStorage.setItem(`simulated_preorders_${cleanSym}`, JSON.stringify(filtered));
              changed = true;
            }
          }
        });
        if (changed) {
          window.dispatchEvent(new CustomEvent('simulated-preorders-updated', { detail: { hydrated: true } }));
        }
      }
    })
    .catch(() => {});
}

export function isSimulatedPreOrderLike(o: any): boolean {
  if (!o || isNaN(Number(o.price)) || Number(o.price) <= 0) return false;
  if (o.status && o.status !== 'PENDING') return false;
  const cat = String(o.category || '');
  const notes = String(o.notes || '');
  const cond = String(o.conditions || '');
  return (
    cat === '模擬預購單' ||
    cat.includes('模擬') ||
    cat.includes('預購') ||
    notes.includes('模擬預購單') ||
    notes.includes('[模擬') ||
    notes.includes('預購單') ||
    cond.includes('模擬預購') ||
    Boolean(o.isSimulated) ||
    Boolean(o.isPreOrder)
  );
}

export function getSimulatedPreOrders(symbol: string): SimulatedPreOrder[] {
  const cleanSym = cleanSymbolKey(symbol);
  if (!cleanSym) return [];
  hydrateSimulatedPreOrdersFromBackend();
  const tombstones = getDeletedTombstones(cleanSym);
  try {
    const raw = safeLocalStorage.getItem(`simulated_preorders_${cleanSym}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter(
            (p) =>
              p &&
              typeof p.price === 'number' &&
              !isNaN(p.price) &&
              p.price > 0 &&
              !tombstones.has(String(p.id)) &&
              !tombstones.has(`price:${Number(p.price).toFixed(2)}`)
          )
          .sort((a, b) => b.price - a.price);
      }
    }
  } catch (e) {}
  return [];
}

export function saveSimulatedPreOrders(symbol: string, orders: SimulatedPreOrder[], silent = false) {
  const cleanSym = cleanSymbolKey(symbol);
  if (!cleanSym) return;
  try {
    const dedupMap = new Map<string, SimulatedPreOrder>();
    orders.forEach((p) => {
      if (!p || typeof p.price !== 'number' || isNaN(p.price) || p.price <= 0) return;
      const priceKey = `${Number(p.price).toFixed(2)}_${Number(p.quantity) || 0}`;
      if (!dedupMap.has(priceKey)) {
        dedupMap.set(priceKey, {
          id: p.id || `pre-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          price: Number(p.price),
          quantity: Number(p.quantity) || 100,
          direction: p.direction || 'BUY',
          notes: p.notes || '[模擬預購單]',
          isSimulated: true,
          category: '模擬預購單',
        });
      }
    });
    const valid = Array.from(dedupMap.values()).sort((a, b) => b.price - a.price);
    safeLocalStorage.setItem(`simulated_preorders_${cleanSym}`, JSON.stringify(valid));
    syncToBackend(cleanSym, valid);
    if (!silent && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('simulated-preorders-updated', {
          detail: { symbol: cleanSym, orders: valid },
        })
      );
    }
  } catch (e) {}
}

/**
 * 合併 Firestore plannedOrders 中的模擬預購單與本機儲存，並自動將 Firestore 預購單同步寫入本機快取，
 * 同時過濾掉已被使用者刪除的預購單 (Tombstones)。
 */
export function mergeAndSyncPreOrders(symbol: string, externalOrders?: any[]): SimulatedPreOrder[] {
  const cleanSym = cleanSymbolKey(symbol);
  if (!cleanSym) return [];
  const tombstones = getDeletedTombstones(cleanSym);
  const localOrders = getSimulatedPreOrders(cleanSym);

  const fromExternal: SimulatedPreOrder[] = (externalOrders || [])
    .filter((o) => isSimulatedPreOrderLike(o))
    .filter(
      (o) =>
        !tombstones.has(String(o.id)) &&
        !tombstones.has(`price:${Number(o.price).toFixed(2)}`)
    )
    .map((o, idx) => ({
      id: String(o.id || `ext-${idx}-${Number(o.price).toFixed(2)}`),
      price: Number(o.price),
      quantity: Number(o.quantity) || 100,
      direction: (o.direction as 'BUY' | 'SELL') || 'BUY',
      notes: o.notes || '[模擬預購單]',
      isSimulated: true,
      category: '模擬預購單',
    }));

  if (fromExternal.length === 0) {
    return localOrders;
  }

  // 以價格作為去重基準（避免同一筆預購單在 localStorage 與 Firestore 產生兩個不同 ID 而重複顯示）
  const byPrice = new Map<string, SimulatedPreOrder>();
  localOrders.forEach((po) => {
    const key = Number(po.price).toFixed(2);
    byPrice.set(key, po);
  });
  let addedFromExternal = false;
  fromExternal.forEach((ext) => {
    const key = Number(ext.price).toFixed(2);
    if (!byPrice.has(key)) {
      byPrice.set(key, ext);
      addedFromExternal = true;
    } else {
      // 保留 Firestore 的真實 document ID 以便後續刪除同步
      const existing = byPrice.get(key)!;
      if (String(existing.id).startsWith('pre-') && !String(ext.id).startsWith('pre-') && !String(ext.id).startsWith('ext-')) {
        byPrice.set(key, { ...existing, id: ext.id });
        addedFromExternal = true;
      }
    }
  });

  const merged = Array.from(byPrice.values()).sort((a, b) => b.price - a.price);
  if (addedFromExternal) {
    saveSimulatedPreOrders(cleanSym, merged, true);
  }
  return merged;
}

export function addSimulatedPreOrder(
  symbol: string,
  order: { id?: string; price: number; quantity?: number; direction?: 'BUY' | 'SELL'; notes?: string }
): SimulatedPreOrder {
  const cleanSym = cleanSymbolKey(symbol);
  removeDeletedTombstoneByPrice(cleanSym, Number(order.price));
  const existing = getSimulatedPreOrders(cleanSym);
  const newOrder: SimulatedPreOrder = {
    id: order.id || `pre-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    price: Number(order.price),
    quantity: Number(order.quantity) || 100,
    direction: order.direction || 'BUY',
    notes: order.notes || '[模擬預購單]',
    isSimulated: true,
    category: '模擬預購單',
    createdAt: Date.now(),
  };
  const filteredExisting = existing.filter(
    (o) => Math.abs(Number(o.price) - Number(newOrder.price)) > 0.001
  );
  const updated = [...filteredExisting, newOrder].sort((a, b) => b.price - a.price);
  saveSimulatedPreOrders(cleanSym, updated);
  return newOrder;
}

export function deleteSimulatedPreOrder(symbol: string, id: string, price?: number): SimulatedPreOrder[] {
  const cleanSym = cleanSymbolKey(symbol);
  const existing = getSimulatedPreOrders(cleanSym);
  const target = existing.find((o) => o.id === id || (price !== undefined && Math.abs(o.price - price) < 0.005));
  if (id) addDeletedTombstone(cleanSym, id);
  const targetPrice = price !== undefined ? price : target?.price;
  if (targetPrice !== undefined && targetPrice > 0) {
    addDeletedTombstone(cleanSym, `price:${Number(targetPrice).toFixed(2)}`);
  }
  const updated = existing.filter(
    (o) =>
      o.id !== id &&
      (targetPrice === undefined || Math.abs(Number(o.price) - Number(targetPrice)) >= 0.005)
  );
  saveSimulatedPreOrders(cleanSym, updated);
  return updated;
}

export function clearAllSimulatedPreOrders(symbol: string, currentOrders?: SimulatedPreOrder[]): SimulatedPreOrder[] {
  const cleanSym = cleanSymbolKey(symbol);
  const list = currentOrders || getSimulatedPreOrders(cleanSym);
  list.forEach((o) => {
    if (o.id) addDeletedTombstone(cleanSym, o.id);
    if (o.price > 0) addDeletedTombstone(cleanSym, `price:${Number(o.price).toFixed(2)}`);
  });
  saveSimulatedPreOrders(cleanSym, []);
  return [];
}
