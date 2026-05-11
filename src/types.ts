import { Timestamp } from 'firebase/firestore';

export interface StockTab {
  id: string; // The firestore doc ID
  userId: string;
  symbol: string;
  companyName?: string;
  status: 'ACTIVE' | 'COMPLETED';
  isHidden?: boolean;
  sortOrder?: number; // Added sortOrder
  holdingStatus?: '持有中' | '觀察中' | '候選名單';
  finalPnL?: number;
  currentPrice?: number;
  tags?: string[];
  tradeType: 'simulated' | 'real';
  recommendation?: '推薦買進' | '保持觀望' | '推薦看跌';
  rating?: number; // 1-10
  qualityScore?: number; // 1-10
  valueScore?: number; // 1-10
  isOperationConfirmed?: boolean;
  sentiment?: number; // 10-100
  volatility?: '低' | '中等' | '高';
  shortTermImpact?: '看多' | '觀察' | '看空';
  longTermOutlook?: '看多' | '觀察' | '看空';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isFavoriteHighlight?: boolean;
}

export interface Trade {
  id: string;
  type: 'BUY' | 'SELL';
  purpose?: '加碼' | '平倉';
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
