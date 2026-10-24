import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { PlannedOrder } from '../types';
import { toast } from 'sonner';
import { getTimestampMillis } from '../lib/dateUtils';
import { safeSessionStorage } from '../lib/utils';

const getCachedTabOrders = (userId?: string | null, tabId?: string): PlannedOrder[] => {
  if (!userId || !tabId) return [];
  try {
    const raw = safeSessionStorage.getItem(`cached_tab_orders_v3_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed[tabId])) {
        return parsed[tabId];
      }
    }
  } catch (e) {}
  return [];
};

const saveCachedTabOrders = (userId: string | undefined | null, tabId: string | undefined, sorted: PlannedOrder[]) => {
  if (!userId || !tabId) return;
  try {
    const raw = safeSessionStorage.getItem(`cached_tab_orders_v3_${userId}`);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[tabId] = sorted;
    safeSessionStorage.setItem(`cached_tab_orders_v3_${userId}`, JSON.stringify(parsed));
  } catch (e) {}
};

export function usePlannedOrders(tabId: string | undefined) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PlannedOrder[]>(() => getCachedTabOrders(user?.uid, tabId));

  useEffect(() => {
    if (!tabId || !user) {
      setOrders([]);
      return;
    }

    const cached = getCachedTabOrders(user.uid, tabId);
    if (cached.length > 0) {
      setOrders(cached);
    }

    const q = query(
      collection(db, `stockTabs/${tabId}/plannedOrders`)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as PlannedOrder[];
      const sorted = data.sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
      setOrders(sorted);
      saveCachedTabOrders(user?.uid, tabId, sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `stockTabs/${tabId}/plannedOrders`);
    });

    return () => unsubscribe();
  }, [tabId, user?.uid]);

  const addOrder = async (order: Partial<PlannedOrder>) => {
    if (!tabId || !user) return;
    try {
      const sanitized: any = { ...order };
      Object.keys(sanitized).forEach(k => {
        if (sanitized[k] === undefined) delete sanitized[k];
      });
      await addDoc(collection(db, `stockTabs/${tabId}/plannedOrders`), {
        ...sanitized,
        status: order.status || 'PENDING',
        createdAt: serverTimestamp()
      });
      toast.success('預定訂單已新增');
    } catch (error) {
      toast.error('新增失敗');
      handleFirestoreError(error, OperationType.CREATE, `stockTabs/${tabId}/plannedOrders`);
    }
  };

  const updateOrderStatus = async (id: string, status: PlannedOrder['status']) => {
    if (!tabId || !user) return;
    try {
      await updateDoc(doc(db, `stockTabs/${tabId}/plannedOrders`, id), {
        status
      });
      toast.success('狀態已更新');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stockTabs/${tabId}/plannedOrders/${id}`);
    }
  };

  const deleteOrder = async (id: string) => {
    if (!tabId || !user) return;
    try {
      await deleteDoc(doc(db, `stockTabs/${tabId}/plannedOrders`, id));
      toast.success('訂單已刪除');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stockTabs/${tabId}/plannedOrders/${id}`);
    }
  };

  const toggleHighlight = async (id: string, currentStatus: boolean | undefined) => {
    if (!tabId || !user) return;
    try {
      await updateDoc(doc(db, `stockTabs/${tabId}/plannedOrders`, id), {
        isManualHighlight: !currentStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stockTabs/${tabId}/plannedOrders/${id}`);
    }
  };

  return { orders, addOrder, updateOrderStatus, deleteOrder, toggleHighlight };
}
