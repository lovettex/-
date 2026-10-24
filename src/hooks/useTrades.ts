import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Trade } from '../types';
import { toast } from 'sonner';
import { getTimestampMillis } from '../lib/dateUtils';
import { safeSessionStorage } from '../lib/utils';

const getCachedTabTrades = (userId?: string | null, tabId?: string): Trade[] => {
  if (!userId || !tabId) return [];
  try {
    const raw = safeSessionStorage.getItem(`cached_tab_trades_v3_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed[tabId])) {
        return parsed[tabId];
      }
    }
  } catch (e) {}
  return [];
};

const saveCachedTabTrades = (userId: string | undefined | null, tabId: string | undefined, sorted: Trade[]) => {
  if (!userId || !tabId) return;
  try {
    const cachedTradesRaw = safeSessionStorage.getItem(`cached_tab_trades_v3_${userId}`);
    const cachedTrades = cachedTradesRaw ? JSON.parse(cachedTradesRaw) : {};
    cachedTrades[tabId] = sorted;
    safeSessionStorage.setItem(`cached_tab_trades_v3_${userId}`, JSON.stringify(cachedTrades));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tab_trades_updated', { detail: { tabId, trades: sorted } }));
    }
  } catch (e) {}
};

export function useTrades(tabId: string | undefined) {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>(() => getCachedTabTrades(user?.uid, tabId));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tabId || !user) {
      setTrades([]);
      setLoading(false);
      return;
    }

    const cached = getCachedTabTrades(user.uid, tabId);
    if (cached.length > 0) {
      setTrades(cached);
    }

    const q = query(
      collection(db, `stockTabs/${tabId}/trades`)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Trade[];
      // sort by tradeDate desc
      const sorted = data.sort((a, b) => getTimestampMillis(b.tradeDate) - getTimestampMillis(a.tradeDate));
      setTrades(sorted);
      setLoading(false);
      saveCachedTabTrades(user?.uid, tabId, sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `stockTabs/${tabId}/trades`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tabId, user?.uid]);

  const addTrade = async (trade: Partial<Trade>) => {
    if (!tabId || !user) return;
    try {
      const sanitized: any = { ...trade };
      Object.keys(sanitized).forEach(k => {
        if (sanitized[k] === undefined) delete sanitized[k];
      });
      await addDoc(collection(db, `stockTabs/${tabId}/trades`), {
        ...sanitized,
        createdAt: serverTimestamp()
      });
      toast.success('交易紀錄已新增');
    } catch (error) {
      toast.error('新增失敗');
      handleFirestoreError(error, OperationType.CREATE, `stockTabs/${tabId}/trades`);
    }
  };

  const updateTrade = async (id: string, updates: Partial<Trade>) => {
    if (!tabId || !user) return;
    try {
      const sanitized: any = { ...updates };
      Object.keys(sanitized).forEach(k => {
        if (sanitized[k] === undefined) delete sanitized[k];
      });
      await updateDoc(doc(db, `stockTabs/${tabId}/trades`, id), sanitized);
    } catch (error) {
      toast.error('更新交易紀錄失敗');
      handleFirestoreError(error, OperationType.UPDATE, `stockTabs/${tabId}/trades/${id}`);
    }
  };

  const deleteTrade = async (id: string) => {
    if (!tabId || !user) return;
    try {
      await deleteDoc(doc(db, `stockTabs/${tabId}/trades`, id));
      toast.success('交易紀錄已刪除');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stockTabs/${tabId}/trades/${id}`);
    }
  };

  return { trades, loading, addTrade, updateTrade, deleteTrade };
}
