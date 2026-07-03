import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { subscribeTabs, createTab as dbCreateTab, updateTab as dbUpdateTab, deleteTab as dbDeleteTab } from '../lib/supabase-helpers';
import type { StockTab } from '../types';
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

    const unsubscribe = subscribeTabs(user.id, (data) => {
      const sorted = [...data].sort((a, b) => {
        const orderA = a.sortOrder !== undefined ? a.sortOrder : 999999;
        const orderB = b.sortOrder !== undefined ? b.sortOrder : 999999;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
      setTabs(sorted);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const addTab = async (symbol: string, companyName: string, tradeType: 'simulated' | 'real' = 'simulated') => {
    if (!user) return;
    const { error } = await dbCreateTab({ symbol: symbol.toUpperCase(), companyName, tradeType, userId: user.id } as any);
    if (error) { toast.error('新增失敗'); console.error(error); }
    else { toast.success('股票分頁已新增'); }
  };

  const updateTradeType = async (id: string, tradeType: 'simulated' | 'real') => {
    const { error } = await dbUpdateTab(id, { trade_type: tradeType });
    if (error) { toast.error('更新失敗'); console.error(error); }
    else { toast.success('交易模式已更新'); }
  };

  const updateTabStatus = async (id: string, status: 'ACTIVE' | 'COMPLETED', finalPnL?: number) => {
    const updates: Record<string, unknown> = { status };
    if (finalPnL !== undefined) updates.final_pnl = finalPnL;
    const { error } = await dbUpdateTab(id, updates);
    if (error) { toast.error('狀態更新失敗'); console.error(error); }
    else { toast.success('狀態已更新'); }
  };

  const updateCurrentPrice = async (id: string, price: number) => {
    const { error } = await dbUpdateTab(id, { current_price: price });
    if (error) { toast.error('價格更新失敗'); console.error(error); }
  };

  const updateTabHidden = async (id: string, isHidden: boolean) => {
    const { error } = await dbUpdateTab(id, { is_hidden: isHidden });
    if (error) { toast.error(isHidden ? '隱藏失敗' : '取消隱藏失敗'); console.error(error); }
    else { toast.success(isHidden ? '股票已隱藏' : '股票已取消隱藏'); }
  };

  const updateTabOrder = async (updates: { id: string; sortOrder: number }[]) => {
    try {
      await Promise.all(updates.map(u => dbUpdateTab(u.id, { sort_order: u.sortOrder })));
    } catch (error) { toast.error('排序更新失敗'); console.error(error); }
  };

  const updateTab = async (id: string, data: Partial<StockTab>) => {
    const dbUpdate: Record<string, unknown> = {};
    if (data.holdingStatus !== undefined) dbUpdate.holding_status = data.holdingStatus;
    if (data.currentPrice !== undefined) dbUpdate.current_price = data.currentPrice;
    if (data.rating !== undefined) dbUpdate.rating = data.rating;
    if (data.qualityScore !== undefined) dbUpdate.quality_score = data.qualityScore;
    if (data.valueScore !== undefined) dbUpdate.value_score = data.valueScore;
    if (data.buyRate !== undefined) dbUpdate.buy_rate = data.buyRate;
    if (data.sellRate !== undefined) dbUpdate.sell_rate = data.sellRate;
    if (data.crashSimilarity !== undefined) dbUpdate.crash_similarity = data.crashSimilarity;
    if (data.volatility !== undefined) dbUpdate.volatility = data.volatility;
    if (data.shortTermImpact !== undefined) dbUpdate.short_term_impact = data.shortTermImpact;
    if (data.longTermOutlook !== undefined) dbUpdate.long_term_outlook = data.longTermOutlook;
    if (data.isOperationConfirmed !== undefined) dbUpdate.is_operation_confirmed = data.isOperationConfirmed;
    if (data.isFavoriteHighlight !== undefined) dbUpdate.is_favorite_highlight = data.isFavoriteHighlight;
    if (data.isDeviationConfirmed !== undefined) dbUpdate.is_deviation_confirmed = data.isDeviationConfirmed;
    if (data.isNew !== undefined) dbUpdate.is_new = data.isNew;
    if (data.isHidden !== undefined) dbUpdate.is_hidden = data.isHidden;
    if (data.sortOrder !== undefined) dbUpdate.sort_order = data.sortOrder;
    if (data.tradeDirection !== undefined) dbUpdate.trade_direction = data.tradeDirection;
    if (data.status !== undefined) dbUpdate.status = data.status;
    if (data.tradeType !== undefined) dbUpdate.trade_type = data.tradeType;
    if (data.companyName !== undefined) dbUpdate.company_name = data.companyName;
    if (data.groupId !== undefined) dbUpdate.group_id = data.groupId;
    if (data.tags !== undefined) dbUpdate.tags = data.tags;

    const { error } = await dbUpdateTab(id, dbUpdate);
    if (error) { toast.error('更新失敗'); console.error(error); }
  };

  const deleteTab = async (id: string) => {
    const { error } = await dbDeleteTab(id);
    if (error) { toast.error('刪除失敗'); console.error(error); }
    else { toast.success('股票分頁已刪除'); }
  };

  return { tabs, loading, addTab, updateTabStatus, updateCurrentPrice, updateTradeType, updateTabHidden, updateTabOrder, updateTab, deleteTab };
}
