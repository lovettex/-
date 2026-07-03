-- StockFlow Pro Supabase Migration
-- 可重複執行（已加 DROP IF EXISTS）

-- stock_tabs 主表
CREATE TABLE IF NOT EXISTS stock_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  symbol TEXT NOT NULL,
  company_name TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  trade_type TEXT NOT NULL DEFAULT 'simulated',
  holding_status TEXT NOT NULL DEFAULT '觀察中',
  current_price NUMERIC,
  rating INTEGER DEFAULT 8,
  quality_score INTEGER DEFAULT 5,
  value_score INTEGER DEFAULT 5,
  buy_rate INTEGER DEFAULT 5,
  sell_rate INTEGER DEFAULT 5,
  volatility TEXT DEFAULT '中等',
  crash_similarity INTEGER DEFAULT 5,
  short_term_impact TEXT DEFAULT '觀察',
  long_term_outlook TEXT DEFAULT '觀察',
  is_hidden BOOLEAN DEFAULT FALSE,
  is_favorite_highlight BOOLEAN DEFAULT FALSE,
  is_operation_confirmed BOOLEAN DEFAULT FALSE,
  is_deviation_confirmed BOOLEAN DEFAULT FALSE,
  is_new BOOLEAN DEFAULT FALSE,
  group_id TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 999999,
  trade_direction TEXT DEFAULT '看漲',
  final_pnl NUMERIC DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  chart_annotations JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_tabs_user ON stock_tabs(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_tabs_user_status ON stock_tabs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_tabs_symbol ON stock_tabs(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_tabs_group ON stock_tabs(group_id) WHERE group_id != '';

-- trades
CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  stock_tab_id UUID NOT NULL REFERENCES stock_tabs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  purpose TEXT DEFAULT '加碼',
  operator TEXT DEFAULT '人',
  price NUMERIC,
  quantity INTEGER,
  trade_date TIMESTAMPTZ,
  fees NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trades_tab ON trades(stock_tab_id);

-- planned_orders
CREATE TABLE IF NOT EXISTS planned_orders (
  id TEXT PRIMARY KEY,
  stock_tab_id UUID NOT NULL REFERENCES stock_tabs(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  purpose TEXT DEFAULT '加碼',
  price NUMERIC,
  quantity INTEGER,
  conditions TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'PENDING',
  category TEXT DEFAULT '分批進出場規劃',
  planned_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_planned_orders_tab ON planned_orders(stock_tab_id);

-- strategies
CREATE TABLE IF NOT EXISTS strategies (
  id TEXT PRIMARY KEY DEFAULT 'main',
  stock_tab_id UUID NOT NULL REFERENCES stock_tabs(id) ON DELETE CASCADE UNIQUE,
  notes_highlighted BOOLEAN DEFAULT FALSE,
  tp_checked BOOLEAN DEFAULT FALSE,
  sl_checked BOOLEAN DEFAULT FALSE,
  add_checked BOOLEAN DEFAULT FALSE,
  close_checked BOOLEAN DEFAULT FALSE,
  observe_checked BOOLEAN DEFAULT FALSE,
  operation_focus TEXT DEFAULT '',
  operation_note TEXT DEFAULT '',
  entries JSONB DEFAULT '[]'::jsonb,
  tp_targets JSONB DEFAULT '[]'::jsonb,
  sl_targets JSONB DEFAULT '[]'::jsonb,
  sl_conditions TEXT DEFAULT '',
  strategy_notes TEXT DEFAULT '',
  resistance_zones JSONB DEFAULT '[]'::jsonb,
  support_zones JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_strategies_tab ON strategies(stock_tab_id);

-- daily_reports
CREATE TABLE IF NOT EXISTS daily_reports (
  id TEXT PRIMARY KEY,
  stock_tab_id UUID NOT NULL REFERENCES stock_tabs(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  summary TEXT DEFAULT '',
  score INTEGER DEFAULT 5,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_daily_reports_tab ON daily_reports(stock_tab_id);

-- social_data
CREATE TABLE IF NOT EXISTS social_data (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_social_user ON social_data(user_id);

-- 啟用 RLS
ALTER TABLE stock_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_data ENABLE ROW LEVEL SECURITY;

-- 刪除舊 policy（避免重複執行錯誤）
DROP POLICY IF EXISTS "Users can view own stock tabs" ON stock_tabs;
DROP POLICY IF EXISTS "Users can insert own stock tabs" ON stock_tabs;
DROP POLICY IF EXISTS "Users can update own stock tabs" ON stock_tabs;
DROP POLICY IF EXISTS "Users can delete own stock tabs" ON stock_tabs;
DROP POLICY IF EXISTS "trades_select" ON trades;
DROP POLICY IF EXISTS "trades_insert" ON trades;
DROP POLICY IF EXISTS "trades_update" ON trades;
DROP POLICY IF EXISTS "trades_delete" ON trades;
DROP POLICY IF EXISTS "planned_orders_select" ON planned_orders;
DROP POLICY IF EXISTS "planned_orders_insert" ON planned_orders;
DROP POLICY IF EXISTS "planned_orders_update" ON planned_orders;
DROP POLICY IF EXISTS "planned_orders_delete" ON planned_orders;
DROP POLICY IF EXISTS "strategies_all" ON strategies;
DROP POLICY IF EXISTS "daily_reports_select" ON daily_reports;
DROP POLICY IF EXISTS "daily_reports_insert" ON daily_reports;
DROP POLICY IF EXISTS "daily_reports_update" ON daily_reports;
DROP POLICY IF EXISTS "daily_reports_delete" ON daily_reports;
DROP POLICY IF EXISTS "social_data_all" ON social_data;

-- 重新建立 policy
CREATE POLICY "Users can view own stock tabs" ON stock_tabs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stock tabs" ON stock_tabs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stock tabs" ON stock_tabs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own stock tabs" ON stock_tabs FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "trades_select" ON trades FOR SELECT USING (
  EXISTS (SELECT 1 FROM stock_tabs WHERE stock_tabs.id = trades.stock_tab_id AND stock_tabs.user_id = auth.uid())
);
CREATE POLICY "trades_insert" ON trades FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM stock_tabs WHERE stock_tabs.id = trades.stock_tab_id AND stock_tabs.user_id = auth.uid())
);
CREATE POLICY "trades_update" ON trades FOR UPDATE USING (
  EXISTS (SELECT 1 FROM stock_tabs WHERE stock_tabs.id = trades.stock_tab_id AND stock_tabs.user_id = auth.uid())
);
CREATE POLICY "trades_delete" ON trades FOR DELETE USING (
  EXISTS (SELECT 1 FROM stock_tabs WHERE stock_tabs.id = trades.stock_tab_id AND stock_tabs.user_id = auth.uid())
);

CREATE POLICY "planned_orders_select" ON planned_orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM stock_tabs WHERE stock_tabs.id = planned_orders.stock_tab_id AND stock_tabs.user_id = auth.uid())
);
CREATE POLICY "planned_orders_insert" ON planned_orders FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM stock_tabs WHERE stock_tabs.id = planned_orders.stock_tab_id AND stock_tabs.user_id = auth.uid())
);
CREATE POLICY "planned_orders_update" ON planned_orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM stock_tabs WHERE stock_tabs.id = planned_orders.stock_tab_id AND stock_tabs.user_id = auth.uid())
);
CREATE POLICY "planned_orders_delete" ON planned_orders FOR DELETE USING (
  EXISTS (SELECT 1 FROM stock_tabs WHERE stock_tabs.id = planned_orders.stock_tab_id AND stock_tabs.user_id = auth.uid())
);

CREATE POLICY "strategies_all" ON strategies FOR ALL USING (
  EXISTS (SELECT 1 FROM stock_tabs WHERE stock_tabs.id = strategies.stock_tab_id AND stock_tabs.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM stock_tabs WHERE stock_tabs.id = strategies.stock_tab_id AND stock_tabs.user_id = auth.uid())
);

CREATE POLICY "daily_reports_select" ON daily_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM stock_tabs WHERE stock_tabs.id = daily_reports.stock_tab_id AND stock_tabs.user_id = auth.uid())
);
CREATE POLICY "daily_reports_insert" ON daily_reports FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM stock_tabs WHERE stock_tabs.id = daily_reports.stock_tab_id AND stock_tabs.user_id = auth.uid())
);
CREATE POLICY "daily_reports_update" ON daily_reports FOR UPDATE USING (
  EXISTS (SELECT 1 FROM stock_tabs WHERE stock_tabs.id = daily_reports.stock_tab_id AND stock_tabs.user_id = auth.uid())
);
CREATE POLICY "daily_reports_delete" ON daily_reports FOR DELETE USING (
  EXISTS (SELECT 1 FROM stock_tabs WHERE stock_tabs.id = daily_reports.stock_tab_id AND stock_tabs.user_id = auth.uid())
);

CREATE POLICY "social_data_all" ON social_data FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
