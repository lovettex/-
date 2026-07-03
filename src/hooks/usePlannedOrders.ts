import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { subscribePlannedOrders, createPlannedOrder as dbCreateOrder, updatePlannedOrderStatus as dbUpdateStatus, deletePlannedOrder as dbDeleteOrder } from '../lib/supabase-helpers';
import type { PlannedOrder } from '../types';
import { toast } from 'sonner';

export function usePlannedOrders(tabId: string | undefined) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PlannedOrder[]>([]);

  useEffect(() => {
    if (!tabId || !user) { setOrders([]); return; }
    const unsubscribe = subscribePlannedOrders(tabId, (data) => {
      const sorted = [...data].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setOrders(sorted);
    });
    return () => unsubscribe();
  }, [tabId, user]);

  const addOrder = async (order: Partial<PlannedOrder>) => {
    if (!tabId || !user) return;
    const { error } = await dbCreateOrder(tabId, order);
    if (error) { toast.error('新增失敗'); console.error(error); }
    else { toast.success('預定訂單已新增'); }
  };

  const updateOrderStatus = async (id: string, status: PlannedOrder['status']) => {
    if (!tabId || !user) return;
    const { error } = await dbUpdateStatus(id, status);
    if (error) { toast.error('狀態更新失敗'); console.error(error); }
    else { toast.success('狀態已更新'); }
  };

  const deleteOrder = async (id: string) => {
    if (!tabId || !user) return;
    const { error } = await dbDeleteOrder(id);
    if (error) { toast.error('刪除失敗'); console.error(error); }
    else { toast.success('訂單已刪除'); }
  };

  const toggleHighlight = async (_id: string, _currentStatus: boolean | undefined) => {
    // Not implemented for Supabase yet
    console.warn('toggleHighlight not yet implemented');
  };

  return { orders, addOrder, updateOrderStatus, deleteOrder, toggleHighlight };
}
