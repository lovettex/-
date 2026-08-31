import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean, doublePrecision, jsonb } from 'drizzle-orm/pg-core';

// Define the 'users' table.
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define the 'stock_tabs' table.
export const stockTabs = pgTable('stock_tabs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  symbol: text('symbol').notNull(),
  companyName: text('company_name'),
  status: text('status').notNull().default('ACTIVE'), // 'ACTIVE' | 'COMPLETED'
  isHidden: boolean('is_hidden').default(false),
  groupId: text('group_id'),
  sortOrder: integer('sort_order'),
  tradeDirection: text('trade_direction'), // '看漲' | '看跌'
  holdingStatus: text('holding_status'), // '觀察中' | '候選名單' | ...
  finalPnL: doublePrecision('final_pnl'),
  currentPrice: doublePrecision('current_price'),
  tags: jsonb('tags'), // array of strings
  tradeType: text('trade_type').notNull().default('simulated'), // 'simulated' | 'real'
  buyRate: integer('buy_rate'),
  sellRate: integer('sell_rate'),
  rating: integer('rating'),
  qualityScore: integer('quality_score'),
  valueScore: integer('value_score'),
  crashSimilarity: integer('crash_similarity'),
  isOperationConfirmed: boolean('is_operation_confirmed').default(false),
  volatility: text('volatility'), // '低' | '中等' | '高'
  shortTermImpact: text('short_term_impact'), // '看多' | '觀察' | '看空'
  longTermOutlook: text('long_term_outlook'), // '看多' | '觀察' | '看空'
  isFavoriteHighlight: boolean('is_favorite_highlight').default(false),
  isDeviationConfirmed: boolean('is_deviation_confirmed').default(false),
  isNew: boolean('is_new').default(true),
  chartAnnotations: jsonb('chart_annotations'), // JSON array of annotations
  plannedBuyQty: doublePrecision('planned_buy_qty'),
  plannedBuyPercent: doublePrecision('planned_buy_percent'),
  stopLossPrice: doublePrecision('stop_loss_price'),
  takeProfitPrice: doublePrecision('take_profit_price'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Define the 'trades' table.
export const trades = pgTable('trades', {
  id: serial('id').primaryKey(),
  tabId: integer('tab_id').references(() => stockTabs.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(), // 'BUY' | 'SELL'
  purpose: text('purpose'), // '加碼' | '平倉'
  operator: text('operator'), // '機器' | '人'
  price: doublePrecision('price').notNull(),
  quantity: doublePrecision('quantity').notNull(),
  fees: doublePrecision('fees'),
  tags: jsonb('tags'),
  notes: text('notes'),
  tradeDate: timestamp('trade_date').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Define the 'planned_orders' table.
export const plannedOrders = pgTable('planned_orders', {
  id: serial('id').primaryKey(),
  tabId: integer('tab_id').references(() => stockTabs.id, { onDelete: 'cascade' }).notNull(),
  direction: text('direction').notNull(), // 'BUY' | 'SELL'
  purpose: text('purpose'), // '加碼' | '平倉'
  price: doublePrecision('price').notNull(),
  quantity: doublePrecision('quantity').notNull(),
  conditions: text('conditions'),
  notes: text('notes'),
  status: text('status').notNull().default('PENDING'), // 'PENDING' | 'CANCELLED' | 'COMPLETED'
  category: text('category'), // '分批進出場規劃' | '止盈設定' | '止損設定' | '關鍵價格門檻' | '支撐門檻' | '壓力門檻'
  isManualHighlight: boolean('is_manual_highlight').default(false),
  plannedDate: timestamp('planned_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Define the 'strategies' table.
export const strategies = pgTable('strategies', {
  id: serial('id').primaryKey(),
  tabId: integer('tab_id').references(() => stockTabs.id, { onDelete: 'cascade' }).notNull().unique(),
  entries: jsonb('entries'), // StrategyEntry[]
  tpTargets: jsonb('tp_targets'), // TPTarget[]
  slTargets: jsonb('sl_targets'), // SLTarget[]
  slConditions: text('sl_conditions'),
  strategyNotes: text('strategy_notes'),
  operationNote: text('operation_note'),
  operationFocus: text('operation_focus'),
  tpChecked: boolean('tp_checked').default(false),
  slChecked: boolean('sl_checked').default(false),
  addChecked: boolean('add_checked').default(false),
  closeChecked: boolean('close_checked').default(false),
  observeChecked: boolean('observe_checked').default(false),
  notesHighlighted: boolean('notes_highlighted').default(false),
  tags: jsonb('tags'),
  resistanceZones: jsonb('resistance_zones'), // KeyPriceThreshold[]
  supportZones: jsonb('support_zones'), // KeyPriceThreshold[]
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Define the 'daily_reports' table.
export const dailyReports = pgTable('daily_reports', {
  id: serial('id').primaryKey(),
  tabId: integer('tab_id').references(() => stockTabs.id, { onDelete: 'cascade' }).notNull(),
  reportDate: text('report_date').notNull(), // date string yyyy-MM-dd
  pdfUrl1: text('pdf_url1'),
  pdfUrl2: text('pdf_url2'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Define the 'socrates_data' table.
export const socratesData = pgTable('socrates_data', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Define relations.
export const usersRelations = relations(users, ({ many }) => ({
  stockTabs: many(stockTabs),
  socratesData: many(socratesData),
}));

export const stockTabsRelations = relations(stockTabs, ({ one, many }) => ({
  user: one(users, {
    fields: [stockTabs.userId],
    references: [users.id],
  }),
  trades: many(trades),
  plannedOrders: many(plannedOrders),
  strategy: one(strategies, {
    fields: [stockTabs.id],
    references: [strategies.tabId],
  }),
  dailyReports: many(dailyReports),
}));

export const tradesRelations = relations(trades, ({ one }) => ({
  tab: one(stockTabs, {
    fields: [trades.tabId],
    references: [stockTabs.id],
  }),
}));

export const plannedOrdersRelations = relations(plannedOrders, ({ one }) => ({
  tab: one(stockTabs, {
    fields: [plannedOrders.tabId],
    references: [stockTabs.id],
  }),
}));

export const strategiesRelations = relations(strategies, ({ one }) => ({
  tab: one(stockTabs, {
    fields: [strategies.tabId],
    references: [stockTabs.id],
  }),
}));

export const dailyReportsRelations = relations(dailyReports, ({ one }) => ({
  tab: one(stockTabs, {
    fields: [dailyReports.tabId],
    references: [stockTabs.id],
  }),
}));

export const socratesDataRelations = relations(socratesData, ({ one }) => ({
  user: one(users, {
    fields: [socratesData.userId],
    references: [users.id],
  }),
}));

// Define the 'uploaded_html_files' table.
export const uploadedHtmlFiles = pgTable('uploaded_html_files', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  symbol: text('symbol').notNull(),
  filename: text('filename').notNull(),
  htmlContent: text('html_content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

