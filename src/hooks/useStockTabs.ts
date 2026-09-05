import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { StockTab } from '../types';
import { toast } from 'sonner';
import { getTimestampMillis } from '../lib/dateUtils';
import { safeLocalStorage } from '../lib/utils';

const getCachedTabs = (userId?: string | null): StockTab[] => {
  if (!userId) return [];
  try {
    const raw = safeLocalStorage.getItem(`cached_stock_tabs_v3_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(t => !t.userId || t.userId === userId) as StockTab[];
      }
    }
  } catch (e) {
    // ignore json parse error
  }
  return [];
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

    // Initialize with this specific user's cached tabs
    const userCached = getCachedTabs(user.uid);
    if (userCached.length > 0) {
      setTabs(userCached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const q = query(
      collection(db, 'stockTabs'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as StockTab[];
      const sorted = data.sort((a, b) => {
        const orderA = a.sortOrder !== undefined ? a.sortOrder : 999999;
        const orderB = b.sortOrder !== undefined ? b.sortOrder : 999999;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
      });
      setTabs(sorted);
      setLoading(false);
      try {
        safeLocalStorage.setItem(`cached_stock_tabs_v3_${user.uid}`, JSON.stringify(sorted));
      } catch (e) {
        // ignore storage quota error
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'stockTabs');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const addTab = useCallback(async (symbol: string, companyName: string, tradeType: 'simulated' | 'real' = 'simulated') => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'stockTabs'), {
        userId: user.uid,
        symbol: symbol.toUpperCase(),
        companyName,
        status: 'ACTIVE',
        tradeType,
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
      if (user?.uid) {
        try {
          safeLocalStorage.setItem(`cached_stock_tabs_v3_${user.uid}`, JSON.stringify(next));
        } catch (e) {}
      }
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
      if (user?.uid) {
        try {
          safeLocalStorage.setItem(`cached_stock_tabs_v3_${user.uid}`, JSON.stringify(next));
        } catch (e) {}
      }
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
      if (user?.uid) {
        try {
          safeLocalStorage.setItem(`cached_stock_tabs_v3_${user.uid}`, JSON.stringify(next));
        } catch (e) {}
      }
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
      if (user?.uid) {
        try {
          safeLocalStorage.setItem(`cached_stock_tabs_v3_${user.uid}`, JSON.stringify(next));
        } catch (e) {}
      }
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
  }, []);

  const updateTab = useCallback(async (id: string, data: Partial<StockTab>) => {
    // Optimistically update local tabs state and persistent cache immediately for zero-latency response
    setTabs(prev => {
      const next = prev.map(t => (t.id === id ? { ...t, ...data } : t));
      if (user?.uid) {
        try {
          safeLocalStorage.setItem(`cached_stock_tabs_v3_${user.uid}`, JSON.stringify(next));
        } catch (e) {
          // ignore
        }
      }
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
      if (user?.uid) {
        try {
          safeLocalStorage.setItem(`cached_stock_tabs_v3_${user.uid}`, JSON.stringify(next));
        } catch (e) {}
      }
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
