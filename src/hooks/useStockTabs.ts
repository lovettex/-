import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { StockTab } from '../types';
import { toast } from 'sonner';

export function useStockTabs() {
  const { user } = useAuth();
  const [tabs, setTabs] = useState<StockTab[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTabs([]);
      setLoading(false);
      return;
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
        return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
      });
      setTabs(sorted);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'stockTabs');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const addTab = async (symbol: string, companyName: string, tradeType: 'simulated' | 'real' = 'simulated') => {
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
  };

  const updateTradeType = async (id: string, tradeType: 'simulated' | 'real') => {
    try {
      await updateDoc(doc(db, 'stockTabs', id), {
        tradeType,
        updatedAt: serverTimestamp()
      });
      toast.success('交易模式已更新');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stockTabs/${id}`);
    }
  };

  const updateTabStatus = async (id: string, status: 'ACTIVE' | 'COMPLETED', finalPnL?: number) => {
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
  };

  const updateCurrentPrice = async (id: string, price: number) => {
    try {
      await updateDoc(doc(db, 'stockTabs', id), {
        currentPrice: price,
        updatedAt: serverTimestamp()
      });
      toast.success('現價已更新');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stockTabs/${id}`);
    }
  };

  const updateTabHidden = async (id: string, isHidden: boolean) => {
    try {
      await updateDoc(doc(db, 'stockTabs', id), {
        isHidden,
        updatedAt: serverTimestamp()
      });
      toast.success(isHidden ? '股票已隱藏' : '股票已取消隱藏');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stockTabs/${id}`);
    }
  };

  const updateTabOrder = async (updates: { id: string, sortOrder: number }[]) => {
    try {
      const promises = updates.map(update => 
        updateDoc(doc(db, 'stockTabs', update.id), {
          sortOrder: update.sortOrder,
          updatedAt: serverTimestamp()
        })
      );
      await Promise.all(promises);
    } catch (error) {
      toast.error('排序更新失敗');
      handleFirestoreError(error, OperationType.UPDATE, 'stockTabs/sortOrder');
    }
  };

  const updateTab = async (id: string, data: Partial<StockTab>) => {
    try {
      await updateDoc(doc(db, 'stockTabs', id), {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stockTabs/${id}`);
    }
  };

  const deleteTab = async (id: string) => {
    // Note: Due to limitations of client SDK, we cannot easily recursively delete all subcollections.
    // In a prod app, we'd use a Cloud Function. As a functional workaround here, we delete the parent.
    // The subdocuments will be "orphaned" but secure since master gate prevents them from being read
    // or they aren't queries without tabId anyway. 
    // Ideally we query them and delete them first.
    try {
      await deleteDoc(doc(db, 'stockTabs', id));
      toast.success('股票分頁已刪除');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stockTabs/${id}`);
    }
  };

  return { tabs, loading, addTab, updateTabStatus, updateCurrentPrice, updateTradeType, updateTabHidden, updateTabOrder, updateTab, deleteTab };
}
