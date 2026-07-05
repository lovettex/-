import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Trade } from '../types';
import { toast } from 'sonner';

export function useTrades(tabId: string | undefined) {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tabId || !user) {
      setTrades([]);
      setLoading(false);
      return;
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
      const sorted = data.sort((a, b) => (b.tradeDate?.toMillis() || 0) - (a.tradeDate?.toMillis() || 0));
      setTrades(sorted);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `stockTabs/${tabId}/trades`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tabId, user]);

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

  const deleteTrade = async (id: string) => {
    if (!tabId || !user) return;
    try {
      await deleteDoc(doc(db, `stockTabs/${tabId}/trades`, id));
      toast.success('交易紀錄已刪除');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stockTabs/${tabId}/trades/${id}`);
    }
  };

  return { trades, loading, addTrade, deleteTrade };
}
