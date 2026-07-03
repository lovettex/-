export interface StockTab {
  id: string;
  userId: string;
  symbol: string;
  companyName?: string;
  status: 'ACTIVE' | 'COMPLETED';
  isHidden?: boolean;
  groupId?: string;
  sortOrder?: number;
  tradeDirection?: '看漲' | '看跌';
  holdingStatus?: '觀察中' | '候選名單' | '買進操作' | '賣出操作' | '平倉操作' | '乖離名單';
  finalPnL?: number;
  currentPrice?: number;
  tags?: string[];
  tradeType: 'simulated' | 'real';
  buyRate?: number;
  sellRate?: number;
  rating?: number;
  qualityScore?: number;
  valueScore?: number;
  crashSimilarity?: number;
  isOperationConfirmed?: boolean;
  volatility?: '低' | '中等' | '高';
  shortTermImpact?: '看多' | '觀察' | '看空';
  longTermOutlook?: '看多' | '觀察' | '看空';
  createdAt: string;
  updatedAt: string;
  isFavoriteHighlight?: boolean;
  isDeviationConfirmed?: boolean;
  isNew?: boolean;
  chartAnnotations?: ChartAnnotation[];
  plannedBuyQty?: number;
}

export interface ChartAnnotation {
  id: string;
  type: 'box' | 'text' | 'line' | 'arrow';
  color: string;
  strokeWidth: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
}

export interface Trade {
  id: string;
  type: 'BUY' | 'SELL';
  purpose?: '加碼' | '平倉';
  operator?: '機器' | '人';
  price: number;
  quantity: number;
  tradeDate: string;
  fees?: number;
  tags?: string[];
  notes?: string;
  createdAt: string;
}

export interface PlannedOrder {
  id: string;
  direction: 'BUY' | 'SELL';
  purpose?: '加碼' | '平倉';
  price: number;
  quantity: number;
  conditions?: string;
  notes?: string;
  status: 'PENDING' | 'CANCELLED' | 'COMPLETED';
  category?: '分批進出場規劃' | '止盈設定' | '止損設定' | '關鍵價格門檻' | '支撐門檻' | '壓力門檻';
  plannedDate?: string;
  createdAt: string;
  isManualHighlight?: boolean;
}

export interface StrategyEntry {
  priceStr: string;
  type: 'BUY' | 'SELL';
  quantityStr: string;
  notes: string;
}

export interface TPTarget {
  price: number;
  quantity: number;
}

export interface SLTarget {
  price: number;
  quantity: number;
  percentage?: number;
}

export interface KeyPriceThreshold {
  price: number;
  notes: string;
}

export interface StrategyConfig {
  id: string;
  entries?: StrategyEntry[];
  tp1?: number;
  tp2?: number;
  tp3?: number;
  tpTargets?: TPTarget[];
  sl?: number;
  slPercentage?: number;
  slTargets?: SLTarget[];
  slConditions?: string;
  strategyNotes?: string;
  operationNote?: string;
  operationFocus?: string;
  tpChecked?: boolean;
  slChecked?: boolean;
  addChecked?: boolean;
  closeChecked?: boolean;
  observeChecked?: boolean;
  notesHighlighted?: boolean;
  tags?: string[];
  resistanceZones?: KeyPriceThreshold[];
  supportZones?: KeyPriceThreshold[];
  updatedAt: string;
}

export interface DailyReport {
  id: string;
  date: string;
  summary?: string;
  score?: number;
  notes?: string;
  createdAt: string;
}

export interface StockStats {
  totalQuantity: number;
  averagePrice: number;
  totalCost: number;
  realizedPnL: number;
  unrealizedPnL?: number;
}
