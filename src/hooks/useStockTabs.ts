import { useState, useEffect, useCallback } from 'react';
import { collection, query, onSnapshot, getDocs, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { StockTab } from '../types';
import { toast } from 'sonner';
import { getTimestampMillis } from '../lib/dateUtils';
import { safeLocalStorage } from '../lib/utils';
import initialStockTabs from '../data/initialStockTabs.json';

const sortTabs = (data: StockTab[]): StockTab[] => {
  return [...data].sort((a, b) => {
    const orderA = a.sortOrder !== undefined ? a.sortOrder : 999999;
    const orderB = b.sortOrder !== undefined ? b.sortOrder : 999999;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
  });
};

const getCachedTabs = (userId?: string | null): StockTab[] => {
  try {
    if (userId) {
      const raw = safeLocalStorage.getItem(`cached_stock_tabs_v3_${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return sortTabs(parsed as StockTab[]);
        }
      }
    }
    const shared = safeLocalStorage.getItem('cached_stock_tabs_v3_shared');
    if (shared) {
      const parsed = JSON.parse(shared);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return sortTabs(parsed as StockTab[]);
      }
    }
  } catch (e) {
    // ignore json parse error
  }
  // Fall back to pre-bundled stock tabs (99 items) to eliminate any blank loading state on first visit
  if (Array.isArray(initialStockTabs) && initialStockTabs.length > 0) {
    return sortTabs(initialStockTabs as unknown as StockTab[]);
  }
  return [];
};

const saveCachedTabs = (userId: string | undefined | null, nextTabs: StockTab[]) => {
  try {
    if (userId) {
      safeLocalStorage.setItem(`cached_stock_tabs_v3_${userId}`, JSON.stringify(nextTabs));
    }
    safeLocalStorage.setItem('cached_stock_tabs_v3_shared', JSON.stringify(nextTabs));
  } catch (e) {
    // ignore storage quota error
  }
};

export function useStockTabs() {
  const { user } = useAuth();
  const [tabs, setTabs] = useState<StockTab[]>(() => getCachedTabs(user?.uid));
  const [loading, setLoading] = useState(() => getCachedTabs(user?.uid).length === 0);

  useEffect(() => {
    // Clean legacy un-scoped cache if present
    safeLocalStorage.removeItem('cached_stock_tabs_v2');

    if (!user) {
      setTabs([]);
      setLoading(false);
      return;
    }

    // Initialize with cached tabs
    const userCached = getCachedTabs(user.uid);
    if (userCached.length > 0) {
      setTabs(userCached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // Ensure loading skeleton never blocks the UI for more than 800ms on slow networks
    const fallbackTimer = setTimeout(() => {
      setLoading(false);
    }, 800);

    // Query all stock tabs in the shared workspace
    const q = query(collection(db, 'stockTabs'));

    // Dual-track fast fetch: execute direct getDocs in parallel with onSnapshot
    getDocs(q).then((snapshot) => {
      if (!snapshot.empty) {
        clearTimeout(fallbackTimer);
        const data = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as StockTab[];
        const sorted = sortTabs(data);
        setTabs(sorted);
        setLoading(false);
        saveCachedTabs(user.uid, sorted);
      }
    }).catch((err) => {
      console.warn("Fast getDocs notice:", err);
    });

    const unsubscribe = onSnapshot(q, (snapshot) => {
      clearTimeout(fallbackTimer);
      const data = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as StockTab[];
      const sorted = sortTabs(data);
      setTabs(sorted);
      setLoading(false);
      saveCachedTabs(user.uid, sorted);
    }, (error) => {
      clearTimeout(fallbackTimer);
      handleFirestoreError(error, OperationType.LIST, 'stockTabs');
      setLoading(false);
    });

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, [user?.uid]);

  const addTab = useCallback(async (
    symbol: string,
    companyName: string,
    tradeType: 'simulated' | 'real' = 'simulated',
    holdingStatus: '觀察中' | '候選名單' | '買進操作' | '賣出操作' | '平倉操作' | '乖離名單' = '候選名單'
  ) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'stockTabs'), {
        userId: user.uid,
        symbol: symbol.toUpperCase(),
        companyName,
        status: 'ACTIVE',
        tradeType,
        holdingStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success('股票分頁已新增');
    } catch (error) {
      toast.error('新增失敗');
      handleFirestoreError(error, OperationType.CREATE, 'stockTabs');
    }
  }, [user]);

  const updateTradeType = useCallback(async (id: string, tradeType: 'simulated' | 'real') => {
    setTabs(prev => {
      const next = prev.map(t => (t.id === id ? { ...t, tradeType } : t));
      saveCachedTabs(user?.uid, next);
      return next;
    });
    try {
      await updateDoc(doc(db, 'stockTabs', id), {
        tradeType,
        updatedAt: serverTimestamp()
      });
      toast.success('交易模式已更新');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stockTabs/${id}`);
    }
  }, [user?.uid]);

  const updateTabStatus = useCallback(async (id: string, status: 'ACTIVE' | 'COMPLETED', finalPnL?: number) => {
    setTabs(prev => {
      const next = prev.map(t => (t.id === id ? { ...t, status, ...(finalPnL !== undefined ? { finalPnL } : {}) } : t));
      saveCachedTabs(user?.uid, next);
      return next;
    });
    try {
      const data: any = {
        status,
        updatedAt: serverTimestamp()
      };
      if (finalPnL !== undefined) {
        data.finalPnL = finalPnL;
      }
      await updateDoc(doc(db, 'stockTabs', id), data);
      toast.success('狀態已更新');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stockTabs/${id}`);
    }
  }, [user?.uid]);

  const updateCurrentPrice = useCallback(async (id: string, price: number) => {
    setTabs(prev => {
      const next = prev.map(t => (t.id === id ? { ...t, currentPrice: price } : t));
      saveCachedTabs(user?.uid, next);
      return next;
    });
    try {
      await updateDoc(doc(db, 'stockTabs', id), {
        currentPrice: price
      });
      toast.success('現價已更新');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stockTabs/${id}`);
    }
  }, [user?.uid]);

  const updateTabHidden = useCallback(async (id: string, isHidden: boolean) => {
    setTabs(prev => {
      const next = prev.map(t => (t.id === id ? { ...t, isHidden } : t));
      saveCachedTabs(user?.uid, next);
      return next;
    });
    try {
      await updateDoc(doc(db, 'stockTabs', id), {
        isHidden,
        updatedAt: serverTimestamp()
      });
      toast.success(isHidden ? '股票已隱藏' : '股票已取消隱藏');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stockTabs/${id}`);
    }
  }, [user?.uid]);

  const updateTabOrder = useCallback(async (updates: { id: string, sortOrder: number }[]) => {
    const orderMap = new Map(updates.map(u => [u.id, u.sortOrder]));
    setTabs(prev => {
      const next = prev
        .map(t => (orderMap.has(t.id) ? { ...t, sortOrder: orderMap.get(t.id) } : t))
        .sort((a, b) => (a.sortOrder ?? 999999) - (b.sortOrder ?? 999999));
      saveCachedTabs(user?.uid, next);
      return next;
    });
    try {
      const promises = updates.map(update => 
        updateDoc(doc(db, 'stockTabs', update.id), {
          sortOrder: update.sortOrder
        })
      );
      await Promise.all(promises);
    } catch (error) {
      toast.error('排序更新失敗');
      handleFirestoreError(error, OperationType.UPDATE, 'stockTabs/sortOrder');
    }
  }, [user?.uid]);

  const updateTab = useCallback(async (id: string, data: Partial<StockTab>) => {
    // Optimistically update local tabs state and persistent cache immediately for zero-latency response
    setTabs(prev => {
      const next = prev.map(t => (t.id === id ? { ...t, ...data } : t));
      saveCachedTabs(user?.uid, next);
      return next;
    });
    try {
      await updateDoc(doc(db, 'stockTabs', id), {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stockTabs/${id}`);
    }
  }, [user?.uid]);

  const deleteTab = useCallback(async (id: string) => {
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id);
      saveCachedTabs(user?.uid, next);
      return next;
    });
    try {
      await deleteDoc(doc(db, 'stockTabs', id));
      toast.success('股票分頁已刪除');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stockTabs/${id}`);
    }
  }, [user?.uid]);

  return { tabs, loading, addTab, updateTabStatus, updateCurrentPrice, updateTradeType, updateTabHidden, updateTabOrder, updateTab, deleteTab };
}
