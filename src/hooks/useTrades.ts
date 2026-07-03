import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { subscribeTrades, createTrade as dbCreateTrade, deleteTrade as dbDeleteTrade } from '../lib/supabase-helpers';
import type { Trade } from '../types';
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

    const unsubscribe = subscribeTrades(tabId, (data) => {
      const sorted = [...data].sort((a, b) => new Date(b.tradeDate || 0).getTime() - new Date(a.tradeDate || 0).getTime());
      setTrades(sorted);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tabId, user]);

  const addTrade = async (trade: Partial<Trade>) => {
    if (!tabId || !user) return;
    const { error } = await dbCreateTrade(tabId, trade);
    if (error) { toast.error('新增失敗'); console.error(error); }
    else { toast.success('交易紀錄已新增'); }
  };

  const deleteTradeById = async (id: string) => {
    if (!tabId || !user) return;
    const { error } = await dbDeleteTrade(id);
    if (error) { toast.error('刪除失敗'); console.error(error); }
    else { toast.success('交易紀錄已刪除'); }
  };

  return { trades, loading, addTrade, deleteTrade: deleteTradeById };
}
