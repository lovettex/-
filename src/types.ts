import { Timestamp } from 'firebase/firestore';

export interface StockTab {
  id: string; // The firestore doc ID
  userId: string;
  symbol: string;
  companyName?: string;
  status: 'ACTIVE' | 'COMPLETED';
  isHidden?: boolean;
  groupId?: string; // For grouping multiple tabs
  sortOrder?: number; // Added sortOrder
  tradeDirection?: '看漲' | '看跌';
  holdingStatus?: '觀察中' | '候選名單' | '買進操作' | '賣出操作' | '平倉操作' | '乖離名單';
  finalPnL?: number;
  currentPrice?: number;
  tags?: string[];
  tradeType: 'simulated' | 'real';
  buyRate?: number; // 1-10
  sellRate?: number; // 1-10
  rating?: number; // 1-10
  qualityScore?: number; // 1-10
  valueScore?: number; // 1-10
  crashSimilarity?: number; // 1-10
  isOperationConfirmed?: boolean;
  volatility?: '低' | '中等' | '高';
  shortTermImpact?: '看多' | '觀察' | '看空';
  longTermOutlook?: '看多' | '觀察' | '看空';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isFavoriteHighlight?: boolean;
  isDeviationConfirmed?: boolean;
  isNew?: boolean;
  chartAnnotations?: ChartAnnotation[];
  plannedBuyQty?: number;
  plannedBuyPercent?: number;
  holdingQuantity?: number;
  averageCost?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  supportPrice?: number;
  resistancePrice?: number;
  averagingRows?: { price: string; quantity: string; quantity2?: string; bought?: boolean; riskFlag?: boolean }[];
  refPnLPoint?: number | string;
  includeCurrentHolding?: boolean;
  averagingRowsSys2?: { price: string; quantity: string; quantity2?: string; bought?: boolean; riskFlag?: boolean }[];
  refPnLPointSys2?: number | string;
  pyramidRows?: { price: string; quantity: string; quantity2?: string; bought?: boolean; riskFlag?: boolean }[];
  refPnLPointUp?: number | string;
  pyramidRowsSys2?: { price: string; quantity: string; quantity2?: string; bought?: boolean; riskFlag?: boolean }[];
  refPnLPointUpSys2?: number | string;
  selectedSplitTrade?: string;
}

export interface ChartAnnotation {
  id: string;
  type: 'box' | 'text' | 'line' | 'arrow' | 'divider';
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
  price?: number;
  isLocked?: boolean;
}

export interface Trade {
  id: string;
  type: 'BUY' | 'SELL';
  purpose?: '加碼' | '平倉';
  batch?: string;
  operator?: '機器' | '人';
  price: number;
  quantity: number;
  tradeDate: Timestamp;
  fees?: number;
  tags?: string[];
  notes?: string;
  createdAt: Timestamp;
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
  plannedDate?: Timestamp;
  createdAt: Timestamp;
  isManualHighlight?: boolean;
}

export interface StrategyEntry {
  priceStr: string; // can be range so string
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
  id: string; // usually 'main'
  entries?: StrategyEntry[];
  tp1?: number; // legacy
  tp2?: number; // legacy
  tp3?: number; // legacy
  tpTargets?: TPTarget[];
  sl?: number; // legacy
  slPercentage?: number; // legacy
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
  selectedSplitTrade?: string;
  tags?: string[];
  resistanceZones?: KeyPriceThreshold[];
  supportZones?: KeyPriceThreshold[];
  updatedAt: Timestamp;
}

export interface DailyReport {
  id: string; // date string yyyy-MM-dd
  pdfUrl1?: string;
  pdfUrl2?: string;
  updatedAt: Timestamp;
}

// Calculated stats purely in frontend
export interface StockStats {
  totalQuantity: number;
  averagePrice: number;
  totalCost: number;
  realizedPnL: number;
  unrealizedPnL?: number;
}
