import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { PlannedOrder } from '../types';
import { toast } from 'sonner';

export function usePlannedOrders(tabId: string | undefined) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PlannedOrder[]>([]);

  useEffect(() => {
    if (!tabId || !user) {
      setOrders([]);
      return;
    }

    const q = query(
      collection(db, `stockTabs/${tabId}/plannedOrders`)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as PlannedOrder[];
      const sorted = data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setOrders(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `stockTabs/${tabId}/plannedOrders`);
    });

    return () => unsubscribe();
  }, [tabId, user]);

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
