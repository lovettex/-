import { supabase } from './supabase';
import type { StockTab, Trade, PlannedOrder, StrategyConfig, DailyReport } from '../types';

// ─── Stock Tabs ───────────────────────────────────────────

export async function fetchTabs(userId: string) {
  const { data, error } = await supabase
    .from('stock_tabs')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });
  return { data: data as unknown as StockTab[], error };
}

export function subscribeTabs(
  userId: string,
  callback: (tabs: StockTab[]) => void
) {
  // Initial fetch
  fetchTabs(userId).then(({ data }) => {
    if (data) callback(data);
  });

  const channel = supabase
    .channel('stock_tabs_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'stock_tabs',
        filter: `user_id=eq.${userId}`,
      },
      async () => {
        const { data } = await fetchTabs(userId);
        if (data) callback(data);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function createTab(tab: Partial<StockTab> & { symbol: string; tradeType: 'simulated' | 'real' }) {
  const { data, error } = await supabase
    .from('stock_tabs')
    .insert({
      symbol: tab.symbol.toUpperCase(),
      company_name: tab.companyName || '',
      trade_type: tab.tradeType,
      status: 'ACTIVE',
      user_id: tab.userId,
    })
    .select()
    .single();
  return { data: data as unknown as StockTab, error };
}

export async function updateTab(id: string, updates: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('stock_tabs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return { data: data as unknown as StockTab, error };
}

export async function deleteTab(id: string) {
  const { error } = await supabase.from('stock_tabs').delete().eq('id', id);
  return { error };
}

// ─── Trades ───────────────────────────────────────────────

export async function fetchTrades(stockTabId: string) {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('stock_tab_id', stockTabId)
    .order('trade_date', { ascending: false });
  return { data: data as unknown as Trade[], error };
}

export function subscribeTrades(
  stockTabId: string,
  callback: (trades: Trade[]) => void
) {
  fetchTrades(stockTabId).then(({ data }) => {
    if (data) callback(data);
  });

  const channel = supabase
    .channel(`trades_${stockTabId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'trades',
        filter: `stock_tab_id=eq.${stockTabId}`,
      },
      async () => {
        const { data } = await fetchTrades(stockTabId);
        if (data) callback(data);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export async function createTrade(stockTabId: string, trade: Partial<Trade>) {
  const { data, error } = await supabase
    .from('trades')
    .insert({
      stock_tab_id: stockTabId,
      type: trade.type,
      purpose: trade.purpose || '加碼',
      operator: trade.operator || '人',
      price: trade.price,
      quantity: trade.quantity,
      trade_date: trade.tradeDate || new Date().toISOString(),
      fees: trade.fees || 0,
      notes: trade.notes || '',
    })
    .select()
    .single();
  return { data: data as unknown as Trade, error };
}

export async function deleteTrade(id: string) {
  const { error } = await supabase.from('trades').delete().eq('id', id);
  return { error };
}

// ─── Planned Orders ──────────────────────────────────────

export async function fetchPlannedOrders(stockTabId: string) {
  const { data, error } = await supabase
    .from('planned_orders')
    .select('*')
    .eq('stock_tab_id', stockTabId)
    .order('created_at', { ascending: false });
  return { data: data as unknown as PlannedOrder[], error };
}

export function subscribePlannedOrders(
  stockTabId: string,
  callback: (orders: PlannedOrder[]) => void
) {
  fetchPlannedOrders(stockTabId).then(({ data }) => {
    if (data) callback(data);
  });

  const channel = supabase
    .channel(`planned_orders_${stockTabId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'planned_orders',
        filter: `stock_tab_id=eq.${stockTabId}`,
      },
      async () => {
        const { data } = await fetchPlannedOrders(stockTabId);
        if (data) callback(data);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export async function createPlannedOrder(stockTabId: string, order: Partial<PlannedOrder>) {
  const { data, error } = await supabase
    .from('planned_orders')
    .insert({
      stock_tab_id: stockTabId,
      direction: order.direction,
      purpose: order.purpose || '加碼',
      price: order.price,
      quantity: order.quantity,
      conditions: order.conditions || '',
      notes: order.notes || '',
      status: order.status || 'PENDING',
      category: order.category || '分批進出場規劃',
      planned_date: order.plannedDate || null,
    })
    .select()
    .single();
  return { data: data as unknown as PlannedOrder, error };
}

export async function updatePlannedOrderStatus(id: string, status: PlannedOrder['status']) {
  const { error } = await supabase
    .from('planned_orders')
    .update({ status })
    .eq('id', id);
  return { error };
}

export async function deletePlannedOrder(id: string) {
  const { error } = await supabase.from('planned_orders').delete().eq('id', id);
  return { error };
}

// ─── Strategies ───────────────────────────────────────────

export async function fetchStrategy(stockTabId: string) {
  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .eq('stock_tab_id', stockTabId)
    .maybeSingle();
  return { data: data as unknown as StrategyConfig | null, error };
}

export function subscribeStrategy(
  stockTabId: string,
  callback: (strategy: StrategyConfig | null) => void
) {
  fetchStrategy(stockTabId).then(({ data }) => callback(data));

  const channel = supabase
    .channel(`strategy_${stockTabId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'strategies',
        filter: `stock_tab_id=eq.${stockTabId}`,
      },
      async () => {
        const { data } = await fetchStrategy(stockTabId);
        callback(data);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export async function upsertStrategy(stockTabId: string, data: Partial<StrategyConfig>) {
  const { entries, tpTargets, slTargets, resistanceZones, supportZones, ...rest } = data;

  const payload: Record<string, unknown> = {
    ...rest,
    updated_at: new Date().toISOString(),
  };

  if (entries !== undefined) payload.entries = entries as never;
  if (tpTargets !== undefined) payload.tp_targets = tpTargets as never;
  if (slTargets !== undefined) payload.sl_targets = slTargets as never;
  if (resistanceZones !== undefined) payload.resistance_zones = resistanceZones as never;
  if (supportZones !== undefined) payload.support_zones = supportZones as never;
  if (rest.notesHighlighted !== undefined) payload.notes_highlighted = rest.notesHighlighted;
  if (rest.tpChecked !== undefined) payload.tp_checked = rest.tpChecked;
  if (rest.slChecked !== undefined) payload.sl_checked = rest.slChecked;
  if (rest.addChecked !== undefined) payload.add_checked = rest.addChecked;
  if (rest.closeChecked !== undefined) payload.close_checked = rest.closeChecked;
  if (rest.observeChecked !== undefined) payload.observe_checked = rest.observeChecked;
  if (rest.operationFocus !== undefined) payload.operation_focus = rest.operationFocus;
  if (rest.operationNote !== undefined) payload.operation_note = rest.operationNote;
  if (rest.strategyNotes !== undefined) payload.strategy_notes = rest.strategyNotes;
  if (rest.slConditions !== undefined) payload.sl_conditions = rest.slConditions;

  const { error } = await supabase.from('strategies').upsert(
    { stock_tab_id: stockTabId, id: 'main', ...payload },
    { onConflict: 'stock_tab_id' }
  );
  return { error };
}

// ─── Daily Reports ────────────────────────────────────────

export async function fetchDailyReports(stockTabId: string) {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('stock_tab_id', stockTabId)
    .order('date', { ascending: false });
  return { data: data as unknown as DailyReport[], error };
}

// ─── Socrates Data ────────────────────────────────────────

export async function fetchSocratesData(userId: string) {
  const { data, error } = await supabase
    .from('socrates_data')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  return { data: data?.data as unknown, error };
}

export async function upsertSocratesData(userId: string, data: unknown) {
  const { error } = await supabase
    .from('socrates_data')
    .upsert({ user_id: userId, id: userId, data }, { onConflict: 'id' });
  return { error };
}
