import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  Zap,
  BarChart2,
  DollarSign,
  RefreshCw,
  Edit3,
  Target,
  ArrowRight,
  Sparkles,
  Lock,
  CheckCircle2,
  Save,
  BookmarkCheck,
  Loader2,
  Calendar,
  PlusCircle,
  History,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { playSuccessSound } from '../lib/audio';
import { Trade } from '../types';
import {
  calculateElapsedDaysFromDate,
  calculateLiveOptionTradeMetrics
} from '../lib/calculations';

export interface OptionsCalcSavedData {
  optionType: 'call' | 'put';
  positionSide: 'buy' | 'sell';
  targetStockPrice: string;
  strikePrice: string;
  entryOptionPrice: string; // 開倉期權單價 (成本 $)
  entryStockPrice?: string; // 開倉時基準股價 ($)
  purchaseDate?: string; // 紀錄購買日 (YYYY-MM-DD)
  costPerContract100: number; // 直接換算乘與100股的金額 (開倉單價 * 100)
  totalCost: number; // 合約張數總成本 (開倉單價 * 100 * contractsCount)
  manualCurrentOptionPrice: string;
  dte: string;
  contractsCount: string;
  contractMultiplier: string;
  holdingDays: string;
  ivPercent: string;
  interestRate: string;
  delta?: string;
  theta?: string;
  gamma?: string;
  vega?: string;
  targetIvPercent?: string;
  targetDelta?: string;
  targetTheta?: string;
  targetGamma?: string;
  targetVega?: string;
  savedAt: string;
}

interface OptionsCalculatorTabProps {
  currentStockPrice?: number;
  stockSymbol?: string;
  stockName?: string;
  tabId?: string;
  tabTradeType?: 'simulated' | 'real';
  initialOptionsData?: OptionsCalcSavedData;
  onSaveOptionsData?: (data: OptionsCalcSavedData) => Promise<void> | void;
  onClearOptionsData?: () => Promise<void> | void;
  optionTrades?: Trade[];
  onAddOptionToTrades?: (
    tradePayload: Partial<Trade>,
    savedData: OptionsCalcSavedData
  ) => Promise<void> | void;
  onDeleteOptionTrade?: (tradeId: string) => Promise<void> | void;
  onNavigateToTradesTab?: () => void;
}

// BSM & Greeks helper functions for theoretical baseline
function cumulativeStdNormal(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2.0);

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

function stdNormalPdf(x: number): number {
  return (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

// BSM Theoretical Option Price calculation
function calculateBsmPrice(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  type: 'call' | 'put'
): number {
  if (T <= 0.0001) {
    return type === 'call' ? Math.max(0, S - K) : Math.max(0, K - S);
  }
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  if (type === 'call') {
    return S * cumulativeStdNormal(d1) - K * Math.exp(-r * T) * cumulativeStdNormal(d2);
  } else {
    return K * Math.exp(-r * T) * cumulativeStdNormal(-d2) - S * cumulativeStdNormal(-d1);
  }
}

// Newton-Raphson + Bisection robust Implied Volatility (IV) solver
function solveImpliedVolatility(
  S: number,
  K: number,
  T: number,
  r: number,
  marketPrice: number,
  type: 'call' | 'put'
): number {
  if (marketPrice <= 0.001 || S <= 0.01 || K <= 0.01 || T <= 0.0001) {
    return 35.0; // Fallback default 35%
  }

  // Intrinsic lower bound
  const intrinsic = type === 'call' ? Math.max(0, S - K) : Math.max(0, K - S);
  if (marketPrice <= intrinsic) {
    return 5.0; // Min bound
  }

  let sigma = 0.35; // Initial guess 35%
  const maxIterations = 35;
  const tolerance = 1e-4;

  for (let i = 0; i < maxIterations; i++) {
    const price = calculateBsmPrice(S, K, T, r, sigma, type);
    const diff = price - marketPrice;

    if (Math.abs(diff) < tolerance) {
      return Math.min(300, Math.max(2, sigma * 100));
    }

    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const vega = S * Math.sqrt(T) * stdNormalPdf(d1);

    if (vega > 1e-5) {
      const nextSigma = sigma - diff / vega;
      if (nextSigma > 0.01 && nextSigma < 4.0) {
        sigma = nextSigma;
        continue;
      }
    }

    // Fallback to Bisection step if Newton shoots out of bounds
    if (diff > 0) {
      sigma *= 0.75;
    } else {
      sigma *= 1.35;
    }
  }

  return Math.min(300, Math.max(5, sigma * 100));
}

function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export const OptionsCalculatorTab: React.FC<OptionsCalculatorTabProps> = ({
  currentStockPrice = 150,
  stockSymbol = 'STOCK',
  stockName = '標的股票',
  tabId,
  tabTradeType,
  initialOptionsData,
  onSaveOptionsData,
  onClearOptionsData,
  optionTrades = [],
  onAddOptionToTrades,
  onDeleteOptionTrade,
  onNavigateToTradesTab
}) => {
  // 1. 現在股價：直接套入該個股股票的現價（鎖定綁定，自動隨個股更新）
  const liveStockPrice = currentStockPrice > 0 ? currentStockPrice : 150;
  const S_now = liveStockPrice;

  // 取得該個股獨立的 LocalStorage 快取 Key（依 tabId 或 tradeType 隔離，避免真實股票讀取虛擬交易之快取）
  const getStorageKey = useCallback(() => {
    if (tabId) return `options_calc_${tabId}`;
    if (stockSymbol && tabTradeType) return `options_calc_${stockSymbol}_${tabTradeType}`;
    return `options_calc_${stockSymbol}`;
  }, [tabId, stockSymbol, tabTradeType]);

  // 儲存狀態與加入交易紀錄狀態
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isAddingTrade, setIsAddingTrade] = useState<boolean>(false);
  const [lastSavedData, setLastSavedData] = useState<OptionsCalcSavedData | null>(() => {
    if (initialOptionsData) return initialOptionsData;
    if (typeof window !== 'undefined') {
      try {
        if (tabId) {
          const cached = localStorage.getItem(`options_calc_${tabId}`);
          if (cached) return JSON.parse(cached);
        }
        if (stockSymbol && tabTradeType) {
          const cached = localStorage.getItem(`options_calc_${stockSymbol}_${tabTradeType}`);
          if (cached) return JSON.parse(cached);
        }
        // 嚴格隔離：若為真實交易 (real)，絕不回退載入未隔離的 options_calc_${stockSymbol}，避免讀到虛擬交易快取
        if (tabTradeType !== 'real' && stockSymbol) {
          const cached = localStorage.getItem(`options_calc_${stockSymbol}`);
          if (cached) return JSON.parse(cached);
        }
      } catch (e) {}
    }
    return null;
  });

  // 2. 只有行權價 / 距離到期天數 (DTE) 是手動輸入
  const [strikePrice, setStrikePrice] = useState<string>(
    () => initialOptionsData?.strikePrice || lastSavedData?.strikePrice || liveStockPrice.toFixed(2)
  );
  const [dte, setDte] = useState<string>(
    () => initialOptionsData?.dte || lastSavedData?.dte || '30'
  );

  // 3. 期權方向 & 買賣方向
  const [optionType, setOptionType] = useState<'call' | 'put'>(
    () => initialOptionsData?.optionType || lastSavedData?.optionType || 'call'
  );
  const [positionSide, setPositionSide] = useState<'buy' | 'sell'>(
    () => initialOptionsData?.positionSide || lastSavedData?.positionSide || 'buy'
  );

  // 4. 目標價格（或股價變動差值 目標 - 現在）
  const [targetStockPrice, setTargetStockPrice] = useState<string>(
    () =>
      initialOptionsData?.targetStockPrice ||
      lastSavedData?.targetStockPrice ||
      (liveStockPrice * 1.05).toFixed(2)
  );

  // 5. 開倉基準股價 (用來隨現在股價變動自動計算模式 A 之當前/平倉期權價)
  const [entryStockPrice, setEntryStockPrice] = useState<string>(
    () =>
      initialOptionsData?.entryStockPrice ||
      lastSavedData?.entryStockPrice ||
      liveStockPrice.toFixed(2)
  );

  // 6. 購買日 (Purchase Date) & 隨著紀錄的購買日自動計算持有/經過天數 (Theta 衰減)
  const [purchaseDate, setPurchaseDate] = useState<string>(
    () =>
      initialOptionsData?.purchaseDate ||
      lastSavedData?.purchaseDate ||
      getTodayDateString()
  );

  const elapsedDaysFromPurchase = useMemo(
    () => calculateElapsedDaysFromDate(purchaseDate),
    [purchaseDate]
  );

  const [holdingDays, setHoldingDays] = useState<string>(() => {
    const initPurchase =
      initialOptionsData?.purchaseDate || lastSavedData?.purchaseDate;
    if (initPurchase) {
      return String(calculateElapsedDaysFromDate(initPurchase));
    }
    return initialOptionsData?.holdingDays || lastSavedData?.holdingDays || '0';
  });

  // 當購買日變更時，自動根據購買日計算經過天數並填入持有/經過天數 (Theta 衰減)
  const handlePurchaseDateChange = (newDate: string) => {
    setPurchaseDate(newDate);
    const calculatedDays = calculateElapsedDaysFromDate(newDate);
    setHoldingDays(String(calculatedDays));
  };

  // 當外部傳入或雲端同步 initialOptionsData 時更新，並依購買日自動刷新經過天數
  useEffect(() => {
    if (initialOptionsData) {
      setLastSavedData(initialOptionsData);
      if (initialOptionsData.purchaseDate) {
        setPurchaseDate(initialOptionsData.purchaseDate);
        setHoldingDays(String(calculateElapsedDaysFromDate(initialOptionsData.purchaseDate)));
      }
      if (initialOptionsData.entryStockPrice) {
        setEntryStockPrice(initialOptionsData.entryStockPrice);
      }
    }
  }, [initialOptionsData]);

  // 7. 期權單價 (開倉成本 & 當前平倉價格)
  const [entryOptionPrice, setEntryOptionPrice] = useState<string>(
    () => initialOptionsData?.entryOptionPrice || lastSavedData?.entryOptionPrice || '5.00'
  );
  const [manualCurrentOptionPrice, setManualCurrentOptionPrice] = useState<string>(
    () =>
      initialOptionsData?.manualCurrentOptionPrice ||
      lastSavedData?.manualCurrentOptionPrice ||
      '5.00'
  );
  // 模式 A 是否隨現在股價自動計算當前/平倉期權價 (預設開啟自動聯動)
  const [isAutoCurrentOptionPrice, setIsAutoCurrentOptionPrice] = useState<boolean>(true);

  const [contractsCount, setContractsCount] = useState<string>(
    () => initialOptionsData?.contractsCount || lastSavedData?.contractsCount || '1'
  );
  const [contractMultiplier, setContractMultiplier] = useState<string>(
    () => initialOptionsData?.contractMultiplier || lastSavedData?.contractMultiplier || '100'
  );

  // 8. Section 3 Tab 切換：'current' (現在股價聯動) vs 'target' (期權目標價格聯動)
  const [greeksTab, setGreeksTab] = useState<'current' | 'target'>('current');

  // 9. 自動依相關數據填入的數據（現在股價之隱含波動率 IV、無風險利率、Delta、Theta、Gamma、Vega）
  const [ivPercent, setIvPercent] = useState<string>(
    () => initialOptionsData?.ivPercent || lastSavedData?.ivPercent || '35.0'
  );
  const [interestRate, setInterestRate] = useState<string>(
    () => initialOptionsData?.interestRate || lastSavedData?.interestRate || '4.35'
  );
  const [ivChangePts, setIvChangePts] = useState<string>('0'); // 預期 IV 變動百分點 (%)

  // 現在股價 Greeks 自動計算並填入
  const [manualDelta, setManualDelta] = useState<string>(
    () => initialOptionsData?.delta || lastSavedData?.delta || '0.5500'
  );
  const [manualGamma, setManualGamma] = useState<string>(
    () => initialOptionsData?.gamma || lastSavedData?.gamma || '0.0350'
  );
  const [manualTheta, setManualTheta] = useState<string>(
    () => initialOptionsData?.theta || lastSavedData?.theta || '-0.1200'
  );
  const [manualVega, setManualVega] = useState<string>(
    () => initialOptionsData?.vega || lastSavedData?.vega || '0.1800'
  );

  // 期權目標價格聯動之 IV 與 Greeks (新增 Tab 顯示)
  const [targetIvPercent, setTargetIvPercent] = useState<string>('35.0');
  const [targetDelta, setTargetDelta] = useState<string>('0.6200');
  const [targetGamma, setTargetGamma] = useState<string>('0.0320');
  const [targetTheta, setTargetTheta] = useState<string>('-0.1350');
  const [targetVega, setTargetVega] = useState<string>('0.1650');

  // 解析數值
  const S_target = Math.max(0.01, parseFloat(targetStockPrice) || liveStockPrice * 1.05);
  const S_entry = Math.max(0.01, parseFloat(entryStockPrice) || S_now);
  const K = Math.max(0.01, parseFloat(strikePrice) || liveStockPrice);
  const P_entry = Math.max(0.001, parseFloat(entryOptionPrice) || 5.0);
  const P_manualCurrent = Math.max(0, parseFloat(manualCurrentOptionPrice) || 0);
  const N = Math.max(1, parseInt(contractsCount) || 1);
  const mult = Math.max(1, parseInt(contractMultiplier) || 100);

  const deltaVal = parseFloat(manualDelta) || 0;
  const gammaVal = parseFloat(manualGamma) || 0;
  const thetaVal = parseFloat(manualTheta) || 0;
  const vegaVal = parseFloat(manualVega) || 0;
  const daysHeld = Math.max(0, parseFloat(holdingDays) || 0);
  const totalDte = Math.max(1, parseFloat(dte) || 30);
  const dIv = parseFloat(ivChangePts) || 0;
  const rVal = Math.max(0, (parseFloat(interestRate) || 4.35) / 100);

  // 股價變動: 目標價格 - 現在價格 (Target - Current)
  const stockPriceDiff = S_target - S_now;
  const stockPriceDiffPct = S_now > 0 ? (stockPriceDiff / S_now) * 100 : 0;

  // 現在股價相較於開倉基準股價之變動 (Current - Entry)
  const currentVsEntryStockDiff = S_now - S_entry;

  // 當使用者修改「股價變動」時，雙向推動目標價格
  const handleStockDiffChange = (diffStr: string) => {
    const diffNum = parseFloat(diffStr);
    if (!isNaN(diffNum)) {
      const newTarget = Math.max(0.01, S_now + diffNum);
      setTargetStockPrice(newTarget.toFixed(2));
    }
  };

  // ============================================================================
  // 核心自動填入邏輯 (現在股價聯動 & 期權目標價格聯動)：
  // 1. 無風險利率：自動依據美國國債基準 (US 3-Month T-Bill) 自動填入 4.35%
  // 2. 現在股價隱含波動率 IV 與 Greeks：依「現在股價、行權價、DTE、開倉期權單價」牛頓法反推
  // 3. 期權目標價格隱含波動率 IV 與 Greeks：依「目標股價、推算目標期權價、剩餘到期天數 (DTE - 經過天數)」自動反推聯動
  // ============================================================================
  const runAutoFillCalculations = useCallback(() => {
    const T_now = Math.max(0.0001, totalDte / 365.0);
    const standardRiskFreeRate = 4.35; // 美國 3 個月國債基準利率
    const rDecimal = standardRiskFreeRate / 100;
    setInterestRate(standardRiskFreeRate.toFixed(2));

    // A. 現在股價基準：自動反推計算真實 IV (%) 與 Greeks
    const solvedIvNow = solveImpliedVolatility(S_now, K, T_now, rDecimal, P_entry, optionType);
    setIvPercent(solvedIvNow.toFixed(1));
    const effectiveSigmaNow = solvedIvNow / 100;

    const d1_now =
      (Math.log(S_now / K) + (rDecimal + 0.5 * effectiveSigmaNow * effectiveSigmaNow) * T_now) /
      (effectiveSigmaNow * Math.sqrt(T_now));
    const d2_now = d1_now - effectiveSigmaNow * Math.sqrt(T_now);

    const calcDeltaNow =
      optionType === 'call' ? cumulativeStdNormal(d1_now) : cumulativeStdNormal(d1_now) - 1;
    const calcGammaNow = stdNormalPdf(d1_now) / (S_now * effectiveSigmaNow * Math.sqrt(T_now));

    let thetaYearlyNow = 0;
    if (optionType === 'call') {
      thetaYearlyNow =
        -(S_now * stdNormalPdf(d1_now) * effectiveSigmaNow) / (2 * Math.sqrt(T_now)) -
        rDecimal * K * Math.exp(-rDecimal * T_now) * cumulativeStdNormal(d2_now);
    } else {
      thetaYearlyNow =
        -(S_now * stdNormalPdf(d1_now) * effectiveSigmaNow) / (2 * Math.sqrt(T_now)) +
        rDecimal * K * Math.exp(-rDecimal * T_now) * cumulativeStdNormal(-d2_now);
    }
    const calcThetaDailyNow = thetaYearlyNow / 365.0;
    const calcVegaNow = S_now * Math.sqrt(T_now) * stdNormalPdf(d1_now) * 0.01;

    setManualDelta(calcDeltaNow.toFixed(4));
    setManualGamma(calcGammaNow.toFixed(4));
    setManualTheta(calcThetaDailyNow.toFixed(4));
    setManualVega(calcVegaNow.toFixed(4));

    // B. 期權目標價格聯動：依目標股價 S_target、推算目標期權價與剩餘天數 (DTE - 經過天數) 自動反推聯動 IV 與目標 Greeks
    const remainingDte = Math.max(0.5, totalDte - daysHeld);
    const T_target = Math.max(0.0001, remainingDte / 365.0);
    const dS_target = S_target - S_now;
    const estTargetOptionPrice = Math.max(
      0.01,
      P_entry +
        calcDeltaNow * dS_target +
        0.5 * calcGammaNow * dS_target * dS_target +
        calcThetaDailyNow * daysHeld +
        calcVegaNow * dIv
    );

    const solvedIvTarget = solveImpliedVolatility(
      S_target,
      K,
      T_target,
      rDecimal,
      estTargetOptionPrice,
      optionType
    );
    const effectiveTargetIv = Math.max(2, Math.min(300, solvedIvTarget + dIv));
    setTargetIvPercent(effectiveTargetIv.toFixed(1));
    const effectiveSigmaTarget = effectiveTargetIv / 100;

    const d1_target =
      (Math.log(S_target / K) +
        (rDecimal + 0.5 * effectiveSigmaTarget * effectiveSigmaTarget) * T_target) /
      (effectiveSigmaTarget * Math.sqrt(T_target));
    const d2_target = d1_target - effectiveSigmaTarget * Math.sqrt(T_target);

    const calcDeltaTarget =
      optionType === 'call'
        ? cumulativeStdNormal(d1_target)
        : cumulativeStdNormal(d1_target) - 1;
    const calcGammaTarget =
      stdNormalPdf(d1_target) / (S_target * effectiveSigmaTarget * Math.sqrt(T_target));

    let thetaYearlyTarget = 0;
    if (optionType === 'call') {
      thetaYearlyTarget =
        -(S_target * stdNormalPdf(d1_target) * effectiveSigmaTarget) / (2 * Math.sqrt(T_target)) -
        rDecimal * K * Math.exp(-rDecimal * T_target) * cumulativeStdNormal(d2_target);
    } else {
      thetaYearlyTarget =
        -(S_target * stdNormalPdf(d1_target) * effectiveSigmaTarget) / (2 * Math.sqrt(T_target)) +
        rDecimal * K * Math.exp(-rDecimal * T_target) * cumulativeStdNormal(-d2_target);
    }
    const calcThetaDailyTarget = thetaYearlyTarget / 365.0;
    const calcVegaTarget = S_target * Math.sqrt(T_target) * stdNormalPdf(d1_target) * 0.01;

    setTargetDelta(calcDeltaTarget.toFixed(4));
    setTargetGamma(calcGammaTarget.toFixed(4));
    setTargetTheta(calcThetaDailyTarget.toFixed(4));
    setTargetVega(calcVegaTarget.toFixed(4));
  }, [S_now, S_target, K, totalDte, daysHeld, P_entry, optionType, dIv]);

  // 當個股現價、目標價格、行權價、DTE、經過天數、期權開倉單價、期權類型變動時，自動聯動更新
  useEffect(() => {
    runAutoFillCalculations();
  }, [runAutoFillCalculations]);

  // ============================================================================
  // 模式 A 自動聯動：隨著現在股價 (S_now) 與經過天數 (daysHeld) 自動計算「當前/平倉期權價」
  // ============================================================================
  const autoCalculatedCurrentOptionPrice = useMemo(() => {
    const dS_now = S_now - S_entry;
    const changeFromNowAndTheta =
      deltaVal * dS_now +
      0.5 * gammaVal * dS_now * dS_now +
      thetaVal * daysHeld +
      vegaVal * dIv;
    return Math.max(0, P_entry + changeFromNowAndTheta);
  }, [S_now, S_entry, P_entry, deltaVal, gammaVal, thetaVal, vegaVal, daysHeld, dIv]);

  useEffect(() => {
    if (isAutoCurrentOptionPrice) {
      setManualCurrentOptionPrice(autoCalculatedCurrentOptionPrice.toFixed(2));
    }
  }, [autoCalculatedCurrentOptionPrice, isAutoCurrentOptionPrice]);

  // Moneyness 狀態 (價內 / 價平 / 價外) - 現在股價 vs 目標股價
  const moneyness = useMemo(() => {
    const diff = S_now - K;
    if (Math.abs(diff) < 0.005 * S_now) {
      return { label: '價平 (ATM)', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    }
    if (optionType === 'call') {
      return diff > 0
        ? { label: '價內 (ITM)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
        : { label: '價外 (OTM)', color: 'bg-zinc-100 text-zinc-700 border-zinc-300' };
    } else {
      return diff < 0
        ? { label: '價內 (ITM)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
        : { label: '價外 (OTM)', color: 'bg-zinc-100 text-zinc-700 border-zinc-300' };
    }
  }, [S_now, K, optionType]);

  const targetMoneyness = useMemo(() => {
    const diff = S_target - K;
    if (Math.abs(diff) < 0.005 * S_target) {
      return { label: '目標價平 (ATM)', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    }
    if (optionType === 'call') {
      return diff > 0
        ? { label: '目標價內 (ITM)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
        : { label: '目標價外 (OTM)', color: 'bg-zinc-100 text-zinc-700 border-zinc-300' };
    } else {
      return diff < 0
        ? { label: '目標價內 (ITM)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
        : { label: '目標價外 (OTM)', color: 'bg-zinc-100 text-zinc-700 border-zinc-300' };
    }
  }, [S_target, K, optionType]);

  // 內在價值 vs 時間價值
  const intrinsicValueNow = useMemo(() => {
    if (optionType === 'call') return Math.max(0, S_now - K);
    return Math.max(0, K - S_now);
  }, [S_now, K, optionType]);

  const timeValueNow = useMemo(() => {
    return Math.max(0, P_entry - intrinsicValueNow);
  }, [P_entry, intrinsicValueNow]);

  // ============================================================================
  // A. 當前損益 (隨現在股價自動計算之當前/平倉期權價 或 手動微調報價)
  // ============================================================================
  const manualPnLAnalysis = useMemo(() => {
    const entryTotalCost = P_entry * mult * N;
    const currentTotalValue = P_manualCurrent * mult * N;

    // 每股價差
    const diffPerShare =
      positionSide === 'buy' ? P_manualCurrent - P_entry : P_entry - P_manualCurrent;

    // 當前總損益
    const totalPnL = diffPerShare * mult * N;

    // ROI %
    const roiPct = entryTotalCost > 0 ? (totalPnL / entryTotalCost) * 100 : 0;

    return {
      entryTotalCost,
      currentTotalValue,
      diffPerShare,
      totalPnL,
      roiPct
    };
  }, [P_entry, P_manualCurrent, mult, N, positionSide]);

  // 組裝儲存資料結構
  const buildCurrentSavedData = useCallback((): OptionsCalcSavedData => {
    const calculatedCost100 = Number((P_entry * 100).toFixed(2));
    const calculatedTotal = Number((P_entry * mult * N).toFixed(2));
    const nowStr = new Date().toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    return {
      optionType,
      positionSide,
      targetStockPrice,
      strikePrice,
      entryOptionPrice,
      entryStockPrice: S_entry.toFixed(2),
      purchaseDate,
      costPerContract100: calculatedCost100,
      totalCost: calculatedTotal,
      manualCurrentOptionPrice,
      dte,
      contractsCount,
      contractMultiplier,
      holdingDays,
      ivPercent,
      interestRate,
      delta: manualDelta,
      theta: manualTheta,
      gamma: manualGamma,
      vega: manualVega,
      targetIvPercent,
      targetDelta,
      targetTheta,
      targetGamma,
      targetVega,
      savedAt: nowStr
    };
  }, [
    P_entry,
    mult,
    N,
    optionType,
    positionSide,
    targetStockPrice,
    strikePrice,
    S_entry,
    purchaseDate,
    manualCurrentOptionPrice,
    dte,
    contractsCount,
    contractMultiplier,
    holdingDays,
    ivPercent,
    interestRate,
    manualDelta,
    manualTheta,
    manualGamma,
    manualVega,
    targetIvPercent,
    targetDelta,
    targetTheta,
    targetGamma,
    targetVega
  ]);

  // 清除期權試算設定
  const handleClearOptions = async () => {
    try {
      if (onClearOptionsData) {
        await onClearOptionsData();
      }
      setLastSavedData(null);
      if (typeof window !== 'undefined') {
        try {
          const key = getStorageKey();
          localStorage.removeItem(key);
          if (tabId) localStorage.removeItem(`options_calc_${tabId}`);
          if (stockSymbol && tabTradeType) localStorage.removeItem(`options_calc_${stockSymbol}_${tabTradeType}`);
          if (tabTradeType === 'real' && stockSymbol) {
            localStorage.removeItem(`options_calc_${stockSymbol}`);
          }
        } catch (e) {}
      }
      toast.success('已清除此個股的期權試算設定');
    } catch (err) {
      toast.error('清除期權試算設定失敗');
    }
  };

  // 儲存期權計算器設定
  const handleSaveOptions = async () => {
    setIsSaving(true);
    try {
      const dataToSave = buildCurrentSavedData();
      const storageKey = getStorageKey();

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(storageKey, JSON.stringify(dataToSave));
          if (stockSymbol && tabTradeType) {
            localStorage.setItem(`options_calc_${stockSymbol}_${tabTradeType}`, JSON.stringify(dataToSave));
          }
          // 僅在非真實交易時更新共用未加前綴的 key
          if (tabTradeType !== 'real' && stockSymbol) {
            localStorage.setItem(`options_calc_${stockSymbol}`, JSON.stringify(dataToSave));
          }
        } catch (e) {}
      }

      if (onSaveOptionsData) {
        await onSaveOptionsData(dataToSave);
      }

      setLastSavedData(dataToSave);
      try {
        playSuccessSound();
      } catch (e) {}

      toast.success(
        `期權試算已儲存！開倉單價 $${P_entry.toFixed(2)} 換算 100 股合約金額為 $${dataToSave.costPerContract100.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (購買日 ${purchaseDate})`,
        { duration: 4000 }
      );
    } catch (err) {
      toast.error('儲存期權試算失敗，請稍後再試');
    } finally {
      setIsSaving(false);
    }
  };

  // 將期權儲存的紀錄加入到交易紀錄裡 (含 合約金額 / 總持倉成本 / Delta)
  const handleAddOptionRecordToTrades = async (sourceData?: OptionsCalcSavedData) => {
    if (!onAddOptionToTrades) {
      toast.error('目前無法連接交易紀錄模組');
      return;
    }
    setIsAddingTrade(true);
    try {
      const dataToUse = sourceData || buildCurrentSavedData();
      const storageKey = getStorageKey();
      // 先同步儲存最新期權設定
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(storageKey, JSON.stringify(dataToUse));
          if (stockSymbol && tabTradeType) {
            localStorage.setItem(`options_calc_${stockSymbol}_${tabTradeType}`, JSON.stringify(dataToUse));
          }
          if (tabTradeType !== 'real' && stockSymbol) {
            localStorage.setItem(`options_calc_${stockSymbol}`, JSON.stringify(dataToUse));
          }
        } catch (e) {}
      }
      if (onSaveOptionsData) {
        await onSaveOptionsData(dataToUse);
      }
      setLastSavedData(dataToUse);

      const entryOpt = Math.max(0.001, parseFloat(dataToUse.entryOptionPrice) || P_entry);
      const contracts = Math.max(1, parseInt(dataToUse.contractsCount) || N);
      const multiplier = Math.max(1, parseInt(dataToUse.contractMultiplier) || mult);
      const contractAmt = Number((entryOpt * 100).toFixed(2));
      const totalHoldCost = Number((entryOpt * multiplier * contracts).toFixed(2));
      const deltaNum = Number(parseFloat(dataToUse.delta || manualDelta).toFixed(4));
      const thetaNum = Number(parseFloat(dataToUse.theta || manualTheta).toFixed(4));
      const gammaNum = Number(parseFloat(dataToUse.gamma || manualGamma).toFixed(4));
      const vegaNum = Number(parseFloat(dataToUse.vega || manualVega).toFixed(4));
      const strikeNum = Number(parseFloat(dataToUse.strikePrice) || K);
      const dteNum = Number(parseFloat(dataToUse.dte) || totalDte);
      const ivNum = Number(parseFloat(dataToUse.ivPercent) || 35);
      const rateNum = Number(parseFloat(dataToUse.interestRate) || 4.35);
      const pDate = dataToUse.purchaseDate || purchaseDate || getTodayDateString();
      const sEntry = Number(parseFloat(dataToUse.entryStockPrice || String(S_entry)) || S_now);
      const sTarget = Number(parseFloat(dataToUse.targetStockPrice) || S_target);
      const curOptPrice = Number(parseFloat(dataToUse.manualCurrentOptionPrice) || P_manualCurrent);

      const sideLabel = dataToUse.positionSide === 'buy' ? '買入 Long' : '賣出 Short';
      const typeLabel = dataToUse.optionType.toUpperCase();

      const tradePayload: Partial<Trade> = {
        type: dataToUse.positionSide === 'buy' ? 'BUY' : 'SELL',
        purpose: '加碼',
        operator: '人',
        batch: `期權 ${typeLabel} $${strikeNum}`,
        // price 設為單張合約金額 ($/張)，quantity 為張數，使 price * quantity = 總持倉成本
        price: contractAmt,
        quantity: contracts,
        fees: 0,
        isOptionTrade: true,
        optionType: dataToUse.optionType,
        positionSide: dataToUse.positionSide,
        strikePrice: strikeNum,
        dte: dteNum,
        entryOptionPrice: entryOpt,
        entryStockPrice: sEntry,
        targetStockPrice: sTarget,
        contractAmount: contractAmt,
        totalHoldingCost: totalHoldCost,
        contractsCount: contracts,
        contractMultiplier: multiplier,
        delta: deltaNum,
        theta: thetaNum,
        gamma: gammaNum,
        vega: vegaNum,
        ivPercent: ivNum,
        interestRate: rateNum,
        purchaseDate: pDate,
        manualCurrentOptionPrice: curOptPrice,
        notes: `[期權紀錄] ${sideLabel} ${typeLabel} @ 行權價 $${strikeNum} | 合約金額 $${contractAmt.toFixed(2)}/張 | 總持倉成本 $${totalHoldCost.toFixed(2)} (${contracts}張) | Delta ${deltaNum >= 0 ? '+' : ''}${deltaNum.toFixed(4)} | 購買日 ${pDate}`
      };

      await onAddOptionToTrades(tradePayload, dataToUse);
      try {
        playSuccessSound();
      } catch (e) {}

      toast.success(
        `已加入交易紀錄！合約金額 $${contractAmt.toFixed(2)} · 總持倉成本 $${totalHoldCost.toFixed(2)} · Delta ${deltaNum.toFixed(4)}`,
        { duration: 4500 }
      );
    } catch (err) {
      toast.error('加入交易紀錄失敗，請稍後再試');
    } finally {
      setIsAddingTrade(false);
    }
  };

  // 從交易紀錄載入某筆期權至計算器
  const handleLoadOptionTradeIntoCalc = (t: Trade) => {
    if (t.optionType) setOptionType(t.optionType);
    if (t.positionSide) setPositionSide(t.positionSide);
    if (t.strikePrice) setStrikePrice(String(t.strikePrice));
    if (t.dte) setDte(String(t.dte));
    if (t.entryOptionPrice) setEntryOptionPrice(Number(t.entryOptionPrice).toFixed(2));
    if (t.entryStockPrice) setEntryStockPrice(Number(t.entryStockPrice).toFixed(2));
    if (t.targetStockPrice) setTargetStockPrice(Number(t.targetStockPrice).toFixed(2));
    if (t.contractsCount) setContractsCount(String(t.contractsCount));
    if (t.contractMultiplier) setContractMultiplier(String(t.contractMultiplier));
    if (t.purchaseDate) {
      setPurchaseDate(t.purchaseDate);
      setHoldingDays(String(calculateElapsedDaysFromDate(t.purchaseDate)));
    }
    setIsAutoCurrentOptionPrice(true);
    toast.success(`已載入期權紀錄：${(t.optionType || 'call').toUpperCase()} @ $${t.strikePrice}`);
  };

  // ============================================================================
  // B. Moomoo Greeks 推算損益 (依自動填入的 Delta/Theta/Gamma/Vega 與 股價變動 = 目標價 - 現在價)
  // ============================================================================
  const greeksEstimatedAnalysis = useMemo(() => {
    // 1. Delta 效應: Delta * dS
    const deltaEffectPerShare = deltaVal * stockPriceDiff;

    // 2. Gamma 效應: 0.5 * Gamma * (dS)^2
    const gammaEffectPerShare = 0.5 * gammaVal * stockPriceDiff * stockPriceDiff;

    // 3. Theta 效應: Theta * daysHeld (隨購買日經過天數衰減)
    const thetaEffectPerShare = thetaVal * daysHeld;

    // 4. Vega 效應: Vega * dIV
    const vegaEffectPerShare = vegaVal * dIv;

    // 每股預估總變動
    const totalOptionChangePerShare =
      deltaEffectPerShare + gammaEffectPerShare + thetaEffectPerShare + vegaEffectPerShare;

    // 推算之目標期權單價
    const estimatedOptionPrice = Math.max(0, P_entry + totalOptionChangePerShare);

    const actualChangeExecuted = estimatedOptionPrice - P_entry;
    const positionPnLPerShare =
      positionSide === 'buy' ? actualChangeExecuted : -actualChangeExecuted;

    const totalEstimatedPnL = positionPnLPerShare * mult * N;
    const entryTotalCost = P_entry * mult * N;
    const estimatedRoiPct = entryTotalCost > 0 ? (totalEstimatedPnL / entryTotalCost) * 100 : 0;

    // 到期日結算
    const expirationIntrinsicPerShare =
      optionType === 'call' ? Math.max(0, S_target - K) : Math.max(0, K - S_target);
    const expirationPnLPerShare =
      positionSide === 'buy'
        ? expirationIntrinsicPerShare - P_entry
        : P_entry - expirationIntrinsicPerShare;
    const expirationTotalPnL = expirationPnLPerShare * mult * N;
    const expirationRoiPct = entryTotalCost > 0 ? (expirationTotalPnL / entryTotalCost) * 100 : 0;

    return {
      deltaEffectPerShare,
      deltaEffectTotal: (positionSide === 'buy' ? 1 : -1) * deltaEffectPerShare * mult * N,
      gammaEffectPerShare,
      gammaEffectTotal: (positionSide === 'buy' ? 1 : -1) * gammaEffectPerShare * mult * N,
      thetaEffectPerShare,
      thetaEffectTotal: (positionSide === 'buy' ? 1 : -1) * thetaEffectPerShare * mult * N,
      vegaEffectPerShare,
      vegaEffectTotal: (positionSide === 'buy' ? 1 : -1) * vegaEffectPerShare * mult * N,
      estimatedOptionPrice,
      positionPnLPerShare,
      totalEstimatedPnL,
      estimatedRoiPct,
      expirationIntrinsicPerShare,
      expirationTotalPnL,
      expirationRoiPct
    };
  }, [
    deltaVal,
    gammaVal,
    thetaVal,
    vegaVal,
    stockPriceDiff,
    daysHeld,
    dIv,
    P_entry,
    positionSide,
    mult,
    N,
    optionType,
    S_target,
    K
  ]);

  // 損益平衡點
  const breakevenPrice = useMemo(() => {
    return optionType === 'call' ? K + P_entry : Math.max(0, K - P_entry);
  }, [K, P_entry, optionType]);

  // 股價變動多情境矩陣
  const scenarioSteps = [-15, -10, -5, -2.5, 0, 2.5, 5, 10, 15];
  const scenarioMatrix = useMemo(() => {
    const entryCost = P_entry * mult * N;
    return scenarioSteps.map((pct) => {
      const simStock = S_now * (1 + pct / 100);
      const dS = simStock - S_now;

      const estChange =
        deltaVal * dS +
        0.5 * gammaVal * dS * dS +
        thetaVal * daysHeld +
        vegaVal * dIv;
      const estOptPrice = Math.max(0, P_entry + estChange);
      const estPnLPerShare = positionSide === 'buy' ? estOptPrice - P_entry : P_entry - estOptPrice;
      const estTotalPnL = estPnLPerShare * mult * N;
      const estRoi = entryCost > 0 ? (estTotalPnL / entryCost) * 100 : 0;

      const expOptPrice =
        optionType === 'call' ? Math.max(0, simStock - K) : Math.max(0, K - simStock);
      const expPnLPerShare = positionSide === 'buy' ? expOptPrice - P_entry : P_entry - expOptPrice;
      const expTotalPnL = expPnLPerShare * mult * N;
      const expRoi = entryCost > 0 ? (expTotalPnL / entryCost) * 100 : 0;

      return {
        pct,
        simStock,
        dS,
        estOptPrice,
        estTotalPnL,
        estRoi,
        expOptPrice,
        expTotalPnL,
        expRoi
      };
    });
  }, [S_now, P_entry, mult, N, deltaVal, gammaVal, thetaVal, vegaVal, daysHeld, dIv, positionSide, optionType, K]);

  // 過濾出交易紀錄中之期權交易
  const savedOptionTrades = useMemo(
    () => (Array.isArray(optionTrades) ? optionTrades.filter((t) => t && t.isOptionTrade) : []),
    [optionTrades]
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Stock Context Bar */}
      <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-2 bg-emerald-800 text-white rounded-xl shadow-xs">
                <Calculator className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-neutral-900 tracking-tight">
                  Moomoo 美式期權計算器
                </h3>
                <span className="text-xs font-mono font-bold text-neutral-500">
                  {stockSymbol} · {stockName}
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-semibold">
                <span>股票現價直接套入:</span>
                <span className="font-mono font-black tabular-nums">${S_now.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 pt-0.5 flex-wrap">
              <span>現價與目標價雙 Tab 反推 Greeks</span>
              <span aria-hidden="true">·</span>
              <span>依購買日自動計算經過天數 (Theta)</span>
              <span aria-hidden="true">·</span>
              <span>模式 A 隨現價自動計算平倉期權價</span>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={runAutoFillCalculations}
              className="px-3 py-2 text-xs font-bold text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
              title="依現價、目標價、行權價與 DTE 重新自動計算 IV 與 Greeks"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
              <span>重新運算填入</span>
            </button>

            <button
              type="button"
              onClick={handleSaveOptions}
              disabled={isSaving}
              className="px-3.5 py-2 text-xs font-bold text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95 disabled:opacity-50"
              title="儲存此期權試算設定，將開倉期權單價直接換算為 100 股標準合約金額"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 text-emerald-800" />
              )}
              <span>儲存期權設定</span>
            </button>

            {onAddOptionToTrades && (
              <button
                type="button"
                onClick={() => handleAddOptionRecordToTrades()}
                disabled={isAddingTrade}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 border border-emerald-900 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95 disabled:opacity-50"
                title="將此期權紀錄加入至交易紀錄 (包含合約金額、總持倉成本與 Delta)"
              >
                {isAddingTrade ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <PlusCircle className="w-3.5 h-3.5" />
                )}
                <span>加入交易紀錄</span>
              </button>
            )}

            {(lastSavedData || initialOptionsData) && (
              <button
                type="button"
                onClick={handleClearOptions}
                className="px-3 py-2 text-xs font-bold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
                title="清除此個股的期權試算設定與快取"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>清除期權試算</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 儲存後狀態與換算結果展示卡片 (含加入交易紀錄：合約金額 / 總持倉成本 / Delta) */}
      {lastSavedData && (
        <div className="bg-emerald-50/70 border border-emerald-300 rounded-2xl p-4 sm:p-5 shadow-xs transition-all space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 bg-emerald-800 text-white rounded-lg shadow-xs">
                <BookmarkCheck className="w-4 h-4" />
              </span>
              <div>
                <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-2 flex-wrap">
                  已儲存期權試算 · 開倉合約成本換算
                  <span className="text-[10px] font-bold bg-white text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                    標準 100 股換算
                  </span>
                  {lastSavedData.purchaseDate && (
                    <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                      購買日 {lastSavedData.purchaseDate} · 已過{' '}
                      {calculateElapsedDaysFromDate(lastSavedData.purchaseDate)} 天
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-neutral-500 font-mono block mt-0.5">
                  存檔時間：{lastSavedData.savedAt}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleSaveOptions}
                disabled={isSaving}
                className="text-xs font-bold text-emerald-900 bg-white hover:bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-xl shadow-2xs active:scale-95 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 text-emerald-800" />
                )}
                <span>更新儲存設定</span>
              </button>

              {onAddOptionToTrades && (
                <button
                  type="button"
                  onClick={() => handleAddOptionRecordToTrades(lastSavedData)}
                  disabled={isAddingTrade}
                  className="text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 border border-emerald-900 px-3.5 py-1.5 rounded-xl shadow-xs active:scale-95 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="將已儲存的期權紀錄加入到交易紀錄裡 (合約金額 / 總持倉成本 / Delta)"
                >
                  {isAddingTrade ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <PlusCircle className="w-3.5 h-3.5" />
                  )}
                  <span>將此紀錄加入交易紀錄 (合約金額/總成本/Delta)</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleClearOptions}
                className="text-xs font-bold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl shadow-2xs active:scale-95 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="清除此個股的期權試算設定"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>清除試算</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {/* 1. 開倉期權單價 (成本 $) */}
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs">
              <span className="text-[11px] font-medium text-neutral-500 block mb-1">
                開倉期權單價 (成本 $)
              </span>
              <div className="text-lg font-mono font-black text-neutral-900 tabular-nums">
                ${parseFloat(lastSavedData.entryOptionPrice).toFixed(2)}
                <span className="text-xs font-normal text-neutral-400 ml-1">/ 股</span>
              </div>
              <span className="text-[10px] font-mono text-neutral-400 block mt-0.5">
                開倉股價 ${parseFloat(lastSavedData.entryStockPrice || String(S_entry)).toFixed(2)}
              </span>
            </div>

            {/* 2. 直接換算乘與 100 股之合約金額 */}
            <div className="bg-white p-3.5 rounded-xl border-2 border-emerald-600 shadow-2xs ring-1 ring-emerald-600/20">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-emerald-950 block">
                  合約金額 (×100股)
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded font-mono">
                  1張合約
                </span>
              </div>
              <div className="text-xl font-mono font-black text-emerald-900 tabular-nums">
                $
                {lastSavedData.costPerContract100.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
                <span className="text-xs font-bold text-emerald-800 ml-1">/ 張</span>
              </div>
            </div>

            {/* 3. 合約張數總持倉成本 */}
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs">
              <span className="text-[11px] font-medium text-neutral-500 block mb-1">
                總持倉成本 (共 {lastSavedData.contractsCount} 張)
              </span>
              <div className="text-lg font-mono font-black text-emerald-800 tabular-nums">
                $
                {lastSavedData.totalCost.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </div>
              <span className="text-[10px] font-mono text-neutral-400 block mt-0.5">
                {lastSavedData.contractsCount} 張 × 100 股
              </span>
            </div>

            {/* 4. Delta 與 Greeks 摘要 */}
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs">
              <span className="text-[11px] font-medium text-neutral-500 block mb-1">
                儲存 Delta (Δ) 與參數
              </span>
              <div className="text-lg font-mono font-black text-neutral-900 tabular-nums">
                Δ {parseFloat(lastSavedData.delta || manualDelta).toFixed(4)}
              </div>
              <span className="text-[10px] font-mono text-neutral-500 block mt-0.5">
                Θ {parseFloat(lastSavedData.theta || manualTheta).toFixed(4)} · IV{' '}
                {lastSavedData.ivPercent}%
              </span>
            </div>

            {/* 5. 合約標的設定摘要 & 隨現價當前損益 */}
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs text-xs flex flex-col justify-between col-span-2 lg:col-span-1">
              {(() => {
                const liveSavedMetrics = calculateLiveOptionTradeMetrics(lastSavedData, S_now);
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-neutral-500">隨現價當前損益</span>
                      <span className="text-[10px] font-mono font-bold text-neutral-600">
                        {lastSavedData.positionSide === 'buy' ? 'Long' : 'Short'}{' '}
                        {lastSavedData.optionType.toUpperCase()} @ ${lastSavedData.strikePrice}
                      </span>
                    </div>
                    <div
                      className={`text-base font-mono font-black tabular-nums mt-0.5 ${
                        liveSavedMetrics.currentPnL > 0
                          ? 'text-emerald-700'
                          : liveSavedMetrics.currentPnL < 0
                          ? 'text-rose-700'
                          : 'text-neutral-800'
                      }`}
                    >
                      {liveSavedMetrics.currentPnL >= 0
                        ? `+$${liveSavedMetrics.currentPnL.toFixed(2)}`
                        : `-$${Math.abs(liveSavedMetrics.currentPnL).toFixed(2)}`}{' '}
                      <span className="text-[11px] font-bold">
                        ({liveSavedMetrics.currentRoiPct >= 0 ? '+' : ''}
                        {liveSavedMetrics.currentRoiPct.toFixed(1)}%)
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-500 font-mono block mt-0.5">
                      當前期權價 ${liveSavedMetrics.autoCurrentOptionPrice.toFixed(2)} (DTE{' '}
                      {lastSavedData.dte}天)
                    </span>
                  </>
                );
              })()}
            </div>
          </div>

          {/* 若已有加入至交易紀錄之期權清單，直接顯示並同步 */}
          {savedOptionTrades.length > 0 && (
            <div className="pt-3 border-t border-emerald-200/80 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-emerald-800" />
                  已加入交易紀錄之期權部位 ({savedOptionTrades.length} 筆)
                </span>
                {onNavigateToTradesTab && (
                  <button
                    type="button"
                    onClick={onNavigateToTradesTab}
                    className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>前往「交易紀錄」分頁查看</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {savedOptionTrades.map((t) => {
                  const m = calculateLiveOptionTradeMetrics(t, S_now);
                  return (
                    <div
                      key={t.id}
                      className="bg-white/95 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs shadow-2xs hover:border-emerald-400 transition-colors"
                    >
                      <div
                        className="space-y-0.5 cursor-pointer flex-1"
                        onClick={() => handleLoadOptionTradeIntoCalc(t)}
                        title="點擊將此筆期權交易紀錄載入至計算器"
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                              m.optionType === 'call'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {m.positionSide === 'buy' ? '買入' : '賣出'} {m.optionType.toUpperCase()}{' '}
                            @${m.strikePrice}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-neutral-700">
                            合約金額: ${m.contractAmount.toFixed(2)}
                          </span>
                          <span className="font-mono text-[11px] font-black text-emerald-900">
                            總持倉成本: ${m.totalHoldingCost.toFixed(2)} ({m.contractsCount}張)
                          </span>
                          <span className="font-mono text-[10px] font-bold bg-neutral-100 text-neutral-700 px-1.5 py-0.5 rounded">
                            Δ {m.delta.toFixed(4)}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 font-mono flex items-center gap-2 flex-wrap">
                          <span>購買日: {m.purchaseDate || '今日'} (經過 {m.daysElapsed} 天)</span>
                          <span>·</span>
                          <span>自動平倉價: ${m.autoCurrentOptionPrice.toFixed(2)}</span>
                          <span>·</span>
                          <span
                            className={`font-black ${
                              m.currentPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            當前損益:{' '}
                            {m.currentPnL >= 0
                              ? `+$${m.currentPnL.toFixed(2)}`
                              : `-$${Math.abs(m.currentPnL).toFixed(2)}`}{' '}
                            ({m.currentRoiPct >= 0 ? '+' : ''}
                            {m.currentRoiPct.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                      {onDeleteOptionTrade && (
                        <button
                          type="button"
                          onClick={() => onDeleteOptionTrade(t.id)}
                          className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="刪除此筆期權交易紀錄"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main 12-Column Responsive Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (6 Cols): Inputs & Parameters */}
        <div className="xl:col-span-6 space-y-5">
          {/* Section 1: 方向、行權價與股價目標 */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h4 className="font-bold text-xs text-neutral-900 tracking-wide flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-700" />
                1. 方向、行權價與股價變動
              </h4>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${moneyness.color}`}>
                {moneyness.label}
              </span>
            </div>

            {/* Call / Put & Long / Short Toggles */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-neutral-600 block mb-1.5">期權類型</label>
                <div className="grid grid-cols-2 p-1 bg-neutral-100 rounded-xl border border-neutral-200">
                  <button
                    type="button"
                    onClick={() => setOptionType('call')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                      optionType === 'call'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Call 看漲</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOptionType('put')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                      optionType === 'put'
                        ? 'bg-rose-700 text-white shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Put 看跌</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-600 block mb-1.5">買賣方向</label>
                <div className="grid grid-cols-2 p-1 bg-neutral-100 rounded-xl border border-neutral-200">
                  <button
                    type="button"
                    onClick={() => setPositionSide('buy')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                      positionSide === 'buy'
                        ? 'bg-neutral-900 text-white shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <span>買入 (Long)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPositionSide('sell')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                      positionSide === 'sell'
                        ? 'bg-amber-700 text-white shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <span>賣出 (Short)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Core Manual Inputs: Strike & DTE */}
            <div className="grid grid-cols-2 gap-3">
              {/* 行權價 Strike (手動輸入核心欄位) */}
              <div className="p-3 rounded-xl border-2 border-amber-300 bg-amber-50/30">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-extrabold text-amber-950 block">
                    行權價 (Strike $)
                  </label>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                    手動輸入
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs font-bold">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    value={strikePrice}
                    onChange={(e) => setStrikePrice(e.target.value)}
                    className="w-full pl-6 pr-2.5 py-1.5 text-xs font-mono font-black tabular-nums bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* 距離到期天數 (DTE) - 手動輸入核心欄位 */}
              <div className="p-3 rounded-xl border-2 border-amber-300 bg-amber-50/30">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-extrabold text-amber-950 block">
                    到期天數 DTE (天)
                  </label>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                    手動輸入
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={dte}
                    onChange={(e) => setDte(e.target.value)}
                    className="w-full pl-2.5 pr-8 py-1.5 text-xs font-mono font-black tabular-nums bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-800 text-[10px] font-bold">
                    天
                  </span>
                </div>
              </div>
            </div>

            {/* Stock Price Movement Box: 現在價格(套入) -> 目標價格 = 股價變動 */}
            <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
                  股價變動試算 (目標價格 - 現在價格)
                </span>
                <span
                  className={`text-xs font-mono font-black tabular-nums px-2.5 py-0.5 rounded-md ${
                    stockPriceDiff > 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : stockPriceDiff < 0
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-neutral-200 text-neutral-800'
                  }`}
                >
                  {stockPriceDiff >= 0
                    ? `+$${stockPriceDiff.toFixed(2)}`
                    : `-$${Math.abs(stockPriceDiff).toFixed(2)}`}{' '}
                  ({stockPriceDiffPct >= 0 ? `+${stockPriceDiffPct.toFixed(2)}%` : `${stockPriceDiffPct.toFixed(2)}%`})
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* 現在股價 (直接套入個股現價，鎖定防呆) */}
                <div>
                  <label className="text-[11px] font-semibold text-neutral-600 flex items-center gap-1 mb-1">
                    <Lock className="w-3 h-3 text-emerald-700" />
                    現在股價 (已套入現價)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-800 text-xs font-black">
                      $
                    </span>
                    <input
                      type="text"
                      readOnly
                      value={S_now.toFixed(2)}
                      className="w-full pl-6 pr-2 py-1.5 text-xs font-mono font-black tabular-nums bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-lg cursor-not-allowed select-none"
                      title="此欄位已直接套入該個股當前最新股票現價，維持系統真實聯動"
                    />
                  </div>
                </div>

                {/* 目標價格 (手動輸入) */}
                <div>
                  <label className="text-[11px] font-semibold text-emerald-900 block mb-1">
                    目標價格 (Target $)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-700 text-xs font-bold">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.5"
                      value={targetStockPrice}
                      onChange={(e) => setTargetStockPrice(e.target.value)}
                      className="w-full pl-6 pr-2 py-1.5 text-xs font-mono font-black tabular-nums bg-white border border-emerald-300 text-emerald-950 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 股價變動 (雙向手動輸入：目標 - 現在) */}
                <div>
                  <label className="text-[11px] font-semibold text-amber-900 block mb-1">
                    股價變動 (目標-現在 $)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-700 text-xs font-bold">
                      Δ$
                    </span>
                    <input
                      type="number"
                      step="0.5"
                      value={Number(stockPriceDiff.toFixed(2))}
                      onChange={(e) => handleStockDiffChange(e.target.value)}
                      className="w-full pl-7 pr-2 py-1.5 text-xs font-mono font-black tabular-nums bg-white border border-amber-300 text-amber-950 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Quick % Target Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] font-bold text-neutral-400 mr-1">快速目標價:</span>
                {[-10, -5, -2, 0, 2, 5, 10].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setTargetStockPrice((S_now * (1 + pct / 100)).toFixed(2))}
                    className={`text-[10px] font-mono font-bold tabular-nums px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                      pct > 0
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        : pct < 0
                        ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                        : 'bg-neutral-100 text-neutral-800 border-neutral-200 hover:bg-neutral-200'
                    }`}
                  >
                    {pct > 0 ? `+${pct}%` : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: 期權合約定價、購買日自動計算經過天數與隨現價自動計算平倉價 */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs space-y-4">
            <h4 className="font-bold text-xs text-neutral-900 tracking-wide flex items-center gap-2 border-b border-neutral-100 pb-3">
              <DollarSign className="w-4 h-4 text-emerald-700" />
              2. 開倉權利金、購買日 (Theta 經過天數) 與自動平倉價
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* 開倉/買入期權單價 (換算100股) + 開倉基準股價 */}
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/30 flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-extrabold text-neutral-900 block">
                      開倉期權單價 (成本 $)
                    </label>
                    <button
                      type="button"
                      onClick={handleSaveOptions}
                      disabled={isSaving}
                      className="text-[10px] font-bold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded shadow-2xs cursor-pointer flex items-center gap-1 active:scale-95"
                      title="儲存並將此單價直接換算為 100 股合約金額"
                    >
                      <Save className="w-2.5 h-2.5" />
                      <span>儲存</span>
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs font-bold">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.05"
                      value={entryOptionPrice}
                      onChange={(e) => setEntryOptionPrice(e.target.value)}
                      className="w-full pl-6 pr-2.5 py-1.5 text-xs font-mono font-bold tabular-nums bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 開倉時基準股價 (供模式 A 隨現在股價變動自動推算當前/平倉期權價) */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-emerald-200/70">
                  <span className="text-[11px] text-neutral-600 font-semibold whitespace-nowrap">
                    開倉時股價($):
                  </span>
                  <div className="flex items-center gap-1 flex-1 max-w-[140px]">
                    <input
                      type="number"
                      step="0.1"
                      value={entryStockPrice}
                      onChange={(e) => setEntryStockPrice(e.target.value)}
                      className="w-full px-2 py-0.5 text-[11px] font-mono font-bold tabular-nums bg-white border border-emerald-300 rounded text-right"
                      title="開倉當時的標的股價，用來與現在股價比對並自動計算模式 A 的當前/平倉期權價"
                    />
                    <button
                      type="button"
                      onClick={() => setEntryStockPrice(S_now.toFixed(2))}
                      className="text-[10px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-1.5 py-0.5 rounded whitespace-nowrap cursor-pointer"
                      title="將開倉股價設為目前最新現價"
                    >
                      設現價
                    </button>
                  </div>
                </div>

                {/* 直接換算乘與 100 股金額即時提示 */}
                <div className="pt-1.5 border-t border-emerald-200 flex items-center justify-between text-xs">
                  <span className="text-neutral-500 font-medium">換算 100 股合約金額:</span>
                  <span className="font-mono font-black tabular-nums text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                    ${(P_entry * 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / 張
                  </span>
                </div>
              </div>

              {/* 隨現在股價自動計算之 當前/平倉期權價格 */}
              <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/30 flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1.5 gap-1">
                    <label className="text-xs font-extrabold text-blue-950 block">
                      當前/平倉期權價 ($)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAutoCurrentOptionPrice(true);
                        setManualCurrentOptionPrice(autoCalculatedCurrentOptionPrice.toFixed(2));
                      }}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors cursor-pointer flex items-center gap-1 ${
                        isAutoCurrentOptionPrice
                          ? 'bg-blue-700 text-white border-blue-800'
                          : 'bg-white text-blue-800 border-blue-300 hover:bg-blue-100'
                      }`}
                      title="開啟後，當前/平倉期權價會隨著現在股價與經過天數自動計算"
                    >
                      <Zap className="w-2.5 h-2.5" />
                      <span>{isAutoCurrentOptionPrice ? '隨現價自動計算中' : '點此恢復隨現價自動算'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-700 text-xs font-bold">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.05"
                      value={manualCurrentOptionPrice}
                      onChange={(e) => {
                        setIsAutoCurrentOptionPrice(false);
                        setManualCurrentOptionPrice(e.target.value);
                      }}
                      className="w-full pl-6 pr-2.5 py-1.5 text-xs font-mono font-black tabular-nums bg-white border border-blue-300 text-blue-950 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="text-[10px] text-blue-900 font-mono flex items-center justify-between pt-1 border-t border-blue-200/70">
                  <span>
                    現價較開倉:{' '}
                    {currentVsEntryStockDiff >= 0
                      ? `+$${currentVsEntryStockDiff.toFixed(2)}`
                      : `-$${Math.abs(currentVsEntryStockDiff).toFixed(2)}`}
                  </span>
                  <span>自動推算價: ${autoCalculatedCurrentOptionPrice.toFixed(2)}</span>
                </div>

                <div className="pt-1.5 border-t border-blue-200 flex items-center justify-between text-xs">
                  <span className="text-neutral-500 font-medium">當前總市值 ({N}張):</span>
                  <span className="font-mono font-black tabular-nums text-blue-950 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                    ${(P_manualCurrent * mult * N).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* 合約張數 */}
              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1">
                  合約張數 (Contracts)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={contractsCount}
                    onChange={(e) => setContractsCount(e.target.value)}
                    className="w-full pl-3 pr-8 py-1.5 text-xs font-mono font-bold tabular-nums bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs font-medium">
                    張
                  </span>
                </div>
              </div>

              {/* 紀錄購買日 + 持有/經過天數 (Theta 衰減) 隨著購買日自動計算 */}
              <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-extrabold text-amber-950 flex items-center gap-1 mb-1">
                      <Calendar className="w-3 h-3 text-amber-700" />
                      購買日 (計算天數)
                    </label>
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => handlePurchaseDateChange(e.target.value)}
                      className="w-full px-2 py-1 text-[11px] font-mono font-bold bg-white border border-amber-300 text-amber-950 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-extrabold text-amber-950 block">
                        持有/經過天數 (Theta)
                      </label>
                      {holdingDays !== String(elapsedDaysFromPurchase) && (
                        <button
                          type="button"
                          onClick={() => setHoldingDays(String(elapsedDaysFromPurchase))}
                          className="text-[9px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-1 rounded cursor-pointer"
                          title="同步為購買日至今之實際經過天數"
                        >
                          同步{elapsedDaysFromPurchase}天
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={holdingDays}
                        onChange={(e) => setHoldingDays(e.target.value)}
                        className="w-full pl-2.5 pr-7 py-1 text-xs font-mono font-black tabular-nums bg-white border border-amber-300 text-amber-950 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-700 text-[10px] font-bold">
                        天
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-amber-900 flex items-center justify-between font-mono">
                  <span>購買日 {purchaseDate} 至今自動累計:</span>
                  <span className="font-bold">
                    經過 {elapsedDaysFromPurchase} 天 · Theta 累計{' '}
                    {(thetaVal * daysHeld >= 0 ? '+' : '') + (thetaVal * daysHeld).toFixed(2)}/股
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: 自動反推聯動之 IV、利率與 Greeks (新增 Tab 切換：現在股價聯動 vs 期權目標價格聯動) */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-neutral-100 pb-3">
              <h4 className="font-bold text-xs text-neutral-900 tracking-wide flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-700" />
                3. 自動反推聯動之 IV、利率與 Greeks
              </h4>

              {/* 新增 Tab 切換：現在股價聯動 vs 期權目標價格聯動 */}
              <div className="inline-flex p-1 bg-neutral-100 rounded-xl border border-neutral-200 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setGreeksTab('current')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    greeksTab === 'current'
                      ? 'bg-emerald-800 text-white shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <span>現在股價聯動 (${S_now.toFixed(2)})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGreeksTab('target')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    greeksTab === 'target'
                      ? 'bg-indigo-700 text-white shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Target className="w-3 h-3" />
                  <span>期權目標價格聯動 (${S_target.toFixed(2)})</span>
                </button>
              </div>
            </div>

            {greeksTab === 'current' ? (
              /* TAB 1: 現在股價基準之自動反推 IV、利率與 Greeks */
              <div className="space-y-3.5">
                <div className="flex items-center justify-between bg-emerald-50/60 border border-emerald-200 px-3 py-2 rounded-xl text-xs">
                  <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    現在股價 ${S_now.toFixed(2)} · 開倉單價 ${P_entry.toFixed(2)} · DTE {totalDte} 天
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${moneyness.color}`}>
                    {moneyness.label}
                  </span>
                </div>

                {/* Greeks 4-Box Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Delta 自動填入 */}
                  <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-200">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-black text-emerald-950 block">Delta (Δ)</label>
                      <span className="text-[10px] text-emerald-800 font-bold">現價反推</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={manualDelta}
                      onChange={(e) => setManualDelta(e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono font-black tabular-nums bg-white border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-emerald-800 mt-1 block leading-tight">
                      股價動 $1 期權變動
                    </span>
                  </div>

                  {/* Theta 自動填入 */}
                  <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-200">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-black text-amber-950 block">Theta (Θ)</label>
                      <span className="text-[10px] text-amber-800 font-bold">現價反推</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={manualTheta}
                      onChange={(e) => setManualTheta(e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono font-black tabular-nums bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-amber-800 mt-1 block leading-tight">
                      每日時間衰減 ($)
                    </span>
                  </div>

                  {/* Gamma 自動填入 */}
                  <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-neutral-800 block">Gamma (Γ)</label>
                      <span className="text-[10px] text-neutral-500 font-bold">現價反推</span>
                    </div>
                    <input
                      type="number"
                      step="0.005"
                      value={manualGamma}
                      onChange={(e) => setManualGamma(e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono font-bold tabular-nums bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-neutral-500 mt-1 block leading-tight">
                      Delta 加速度
                    </span>
                  </div>

                  {/* Vega 自動填入 */}
                  <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-200">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-blue-950 block">Vega (ν)</label>
                      <span className="text-[10px] text-blue-700 font-bold">現價反推</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={manualVega}
                      onChange={(e) => setManualVega(e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono font-bold tabular-nums bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-blue-700 mt-1 block leading-tight">
                      IV動 1% 期權變動
                    </span>
                  </div>
                </div>

                {/* 隱含波動率 IV & 無風險利率 自動填入欄位 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-neutral-100">
                  <div className="bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-200">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-extrabold text-emerald-950 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-emerald-700" />
                        隱含波動率 (反推 IV %)
                      </label>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1 rounded">
                        牛頓法
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        value={ivPercent}
                        onChange={(e) => setIvPercent(e.target.value)}
                        className="w-full pl-2.5 pr-6 py-1 text-xs font-mono font-black tabular-nums bg-white border border-emerald-300 text-emerald-950 rounded-lg"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-800 text-xs font-black">
                        %
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-700 mt-1 block">
                      依現價/行權/開倉價自動推算
                    </span>
                  </div>

                  <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-neutral-700 block">
                        無風險利率 (T-Bill %)
                      </label>
                      <span className="text-[10px] font-bold text-neutral-600 bg-neutral-200 px-1 rounded">
                        3M 美債
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                        className="w-full pl-2.5 pr-6 py-1 text-xs font-mono font-bold tabular-nums bg-white border border-neutral-300 text-neutral-800 rounded-lg"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 text-xs font-bold">
                        %
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-500 mt-1 block">
                      美國 3 個月國債殖利率
                    </span>
                  </div>

                  <div className="bg-blue-50/40 p-2.5 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-blue-900 block">
                        預期 IV 變動 (±%)
                      </label>
                      <span className="text-[10px] font-bold text-blue-700">情境模擬</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="1"
                        value={ivChangePts}
                        onChange={(e) => setIvChangePts(e.target.value)}
                        className="w-full pl-2.5 pr-6 py-1 text-xs font-mono font-bold tabular-nums bg-white border border-blue-200 rounded-lg"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 text-xs font-bold">
                        %
                      </span>
                    </div>
                    <span className="text-[10px] text-blue-700 mt-1 block">
                      模擬財報後 IV Crush 變化
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* TAB 2: 期權目標價格聯動之自動反推 IV、利率與 Greeks */
              <div className="space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-indigo-50/70 border border-indigo-200 px-3 py-2 rounded-xl text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-indigo-950 flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-indigo-700" />
                      目標股價 ${S_target.toFixed(2)} ({stockPriceDiff >= 0 ? '+' : ''}
                      {stockPriceDiffPct.toFixed(2)}%)
                    </span>
                    <span className="text-indigo-800 font-mono font-bold">
                      · 推算目標期權價 ${greeksEstimatedAnalysis.estimatedOptionPrice.toFixed(2)}
                    </span>
                    <span className="text-indigo-700 font-mono">
                      · 剩餘 DTE {Math.max(0, totalDte - daysHeld)} 天
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${targetMoneyness.color}`}>
                    {targetMoneyness.label}
                  </span>
                </div>

                {/* Target Greeks 4-Box Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* 目標價 Delta */}
                  <div className="bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-200">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-black text-indigo-950 block">目標 Delta (Δ)</label>
                      <span className="text-[10px] text-indigo-700 font-bold">目標聯動</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={targetDelta}
                      onChange={(e) => setTargetDelta(e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono font-black tabular-nums bg-white border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="text-[10px] font-mono text-indigo-800 mt-1 block leading-tight">
                      較現價:{' '}
                      {(parseFloat(targetDelta) - deltaVal >= 0 ? '+' : '') +
                        (parseFloat(targetDelta) - deltaVal).toFixed(4)}
                    </span>
                  </div>

                  {/* 目標價 Theta */}
                  <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-200">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-black text-amber-950 block">目標 Theta (Θ)</label>
                      <span className="text-[10px] text-amber-800 font-bold">目標聯動</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={targetTheta}
                      onChange={(e) => setTargetTheta(e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono font-black tabular-nums bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <span className="text-[10px] font-mono text-amber-800 mt-1 block leading-tight">
                      較現價:{' '}
                      {(parseFloat(targetTheta) - thetaVal >= 0 ? '+' : '') +
                        (parseFloat(targetTheta) - thetaVal).toFixed(4)}
                    </span>
                  </div>

                  {/* 目標價 Gamma */}
                  <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-neutral-800 block">目標 Gamma (Γ)</label>
                      <span className="text-[10px] text-neutral-500 font-bold">目標聯動</span>
                    </div>
                    <input
                      type="number"
                      step="0.005"
                      value={targetGamma}
                      onChange={(e) => setTargetGamma(e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono font-bold tabular-nums bg-white border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="text-[10px] font-mono text-neutral-500 mt-1 block leading-tight">
                      較現價:{' '}
                      {(parseFloat(targetGamma) - gammaVal >= 0 ? '+' : '') +
                        (parseFloat(targetGamma) - gammaVal).toFixed(4)}
                    </span>
                  </div>

                  {/* 目標價 Vega */}
                  <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-200">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-blue-950 block">目標 Vega (ν)</label>
                      <span className="text-[10px] text-blue-700 font-bold">目標聯動</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={targetVega}
                      onChange={(e) => setTargetVega(e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono font-bold tabular-nums bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <span className="text-[10px] font-mono text-blue-700 mt-1 block leading-tight">
                      較現價:{' '}
                      {(parseFloat(targetVega) - vegaVal >= 0 ? '+' : '') +
                        (parseFloat(targetVega) - vegaVal).toFixed(4)}
                    </span>
                  </div>
                </div>

                {/* 目標價反推 IV、無風險利率與目標期權合約價值 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-neutral-100">
                  <div className="bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-200">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-extrabold text-indigo-950 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-700" />
                        目標價反推 IV (%)
                      </label>
                      <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100 px-1 rounded">
                        目標價反推
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        value={targetIvPercent}
                        onChange={(e) => setTargetIvPercent(e.target.value)}
                        className="w-full pl-2.5 pr-6 py-1 text-xs font-mono font-black tabular-nums bg-white border border-indigo-300 text-indigo-950 rounded-lg"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-800 text-xs font-black">
                        %
                      </span>
                    </div>
                    <span className="text-[10px] text-indigo-700 mt-1 block">
                      依目標價 ${S_target.toFixed(2)} 自動反推
                    </span>
                  </div>

                  <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-neutral-700 block">
                        無風險利率 (T-Bill %)
                      </label>
                      <span className="text-[10px] font-bold text-neutral-600 bg-neutral-200 px-1 rounded">
                        3M 美債
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                        className="w-full pl-2.5 pr-6 py-1 text-xs font-mono font-bold tabular-nums bg-white border border-neutral-300 text-neutral-800 rounded-lg"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 text-xs font-bold">
                        %
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-500 mt-1 block">
                      基準利率同步聯動
                    </span>
                  </div>

                  <div className="bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-200 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-emerald-950">
                        目標期權合約市值
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-800">
                        × 100 股
                      </span>
                    </div>
                    <div className="text-sm font-mono font-black text-emerald-900 tabular-nums mt-1">
                      ${(greeksEstimatedAnalysis.estimatedOptionPrice * 100).toFixed(2)} / 張
                    </div>
                    <span className="text-[10px] text-emerald-700 block mt-0.5">
                      單價 ${greeksEstimatedAnalysis.estimatedOptionPrice.toFixed(2)} · 共 {N} 張
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (6 Cols): Analytics & Dual-Mode PnL Comparison */}
        <div className="xl:col-span-6 space-y-5">
          {/* Mode A: 當前損益 (隨現在股價自動計算當前/平倉期權價) */}
          <div className="bg-white p-5 rounded-2xl border-2 border-blue-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-blue-100 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-700 text-white rounded">
                  模式 A
                </span>
                <h4 className="font-extrabold text-sm text-neutral-900">
                  當前損益 (當前/平倉期權價 ${P_manualCurrent.toFixed(2)})
                </h4>
                <span className="text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md">
                  {isAutoCurrentOptionPrice
                    ? `隨現在股價 $${S_now.toFixed(2)} 自動計算`
                    : '手動微調報價模式'}
                </span>
              </div>
              <span className="text-xs font-mono font-bold tabular-nums text-blue-900">
                {N} 張 × {mult} 股
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 總當前損益 ($) */}
              <div
                className={`p-3.5 rounded-xl border ${
                  manualPnLAnalysis.totalPnL > 0
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : manualPnLAnalysis.totalPnL < 0
                    ? 'bg-rose-50 border-rose-300 text-rose-950'
                    : 'bg-neutral-50 border-neutral-300 text-neutral-800'
                }`}
              >
                <span className="text-[11px] font-bold opacity-80 block">
                  當前總損益 (隨現價連動)
                </span>
                <div className="text-xl font-mono font-black tabular-nums mt-1">
                  {manualPnLAnalysis.totalPnL >= 0
                    ? `+$${manualPnLAnalysis.totalPnL.toFixed(2)}`
                    : `-$${Math.abs(manualPnLAnalysis.totalPnL).toFixed(2)}`}
                </div>
                <span className="text-[11px] font-mono tabular-nums block mt-1">
                  每股價差:{' '}
                  {manualPnLAnalysis.diffPerShare >= 0
                    ? `+$${manualPnLAnalysis.diffPerShare.toFixed(2)}`
                    : `-$${Math.abs(manualPnLAnalysis.diffPerShare).toFixed(2)}`}
                </span>
              </div>

              {/* 報酬率 ROI (%) */}
              <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200 flex flex-col justify-between">
                <span className="text-[11px] font-medium text-neutral-500 block">當前報酬率 (ROI)</span>
                <div
                  className={`text-xl font-mono font-black tabular-nums ${
                    manualPnLAnalysis.roiPct > 0
                      ? 'text-emerald-700'
                      : manualPnLAnalysis.roiPct < 0
                      ? 'text-rose-700'
                      : 'text-neutral-800'
                  }`}
                >
                  {manualPnLAnalysis.roiPct >= 0
                    ? `+${manualPnLAnalysis.roiPct.toFixed(2)}%`
                    : `${manualPnLAnalysis.roiPct.toFixed(2)}%`}
                </div>
                <span className="text-[11px] text-neutral-500 font-mono">
                  經過 {daysHeld} 天 · 現價 ${S_now.toFixed(2)}
                </span>
              </div>

              {/* 持倉成本 vs 當前總市值 */}
              <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200 flex flex-col justify-between text-xs">
                <div>
                  <div className="flex justify-between text-neutral-600">
                    <span>開倉總成本:</span>
                    <span className="font-mono font-bold tabular-nums text-neutral-900">
                      ${manualPnLAnalysis.entryTotalCost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-blue-900 mt-1.5 font-semibold">
                    <span>當前總市值:</span>
                    <span className="font-mono font-black tabular-nums text-blue-950">
                      ${manualPnLAnalysis.currentTotalValue.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-neutral-400 pt-1.5 border-t border-neutral-200 mt-1.5 font-mono">
                  公式: ({positionSide === 'buy' ? '當前價 - 開倉價' : '開倉價 - 當前價'}) × {mult} × {N}
                </div>
              </div>
            </div>
          </div>

          {/* Mode B: Moomoo Greeks 推算目標損益 (依目標價與 Greeks 公式聯動) */}
          <div className="bg-white p-5 rounded-2xl border-2 border-emerald-300 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-800 text-white rounded">
                  模式 B
                </span>
                <h4 className="font-extrabold text-sm text-neutral-900">
                  Moomoo Greeks 預估目標價 ${S_target.toFixed(2)} 損益
                </h4>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsAutoCurrentOptionPrice(false);
                  setManualCurrentOptionPrice(greeksEstimatedAnalysis.estimatedOptionPrice.toFixed(2));
                }}
                className="text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 active:scale-95"
                title="將目標價推算出的期權價格帶入模式 A 平倉欄位"
              >
                <span>帶入目標推算價 ${greeksEstimatedAnalysis.estimatedOptionPrice.toFixed(2)}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Primary Greeks Estimated Numbers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 推算期權理論單價 */}
              <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200">
                <span className="text-[11px] font-medium text-neutral-500 block">
                  推算目標期權價 (Est. Price)
                </span>
                <div className="text-xl font-mono font-black tabular-nums text-neutral-900 mt-1">
                  ${greeksEstimatedAnalysis.estimatedOptionPrice.toFixed(2)}
                </div>
                <span className="text-[11px] text-neutral-500 font-mono tabular-nums block mt-1">
                  開倉價 ${P_entry.toFixed(2)} (
                  {greeksEstimatedAnalysis.estimatedOptionPrice - P_entry >= 0
                    ? `+$${(greeksEstimatedAnalysis.estimatedOptionPrice - P_entry).toFixed(2)}`
                    : `-$${Math.abs(greeksEstimatedAnalysis.estimatedOptionPrice - P_entry).toFixed(2)}`}
                  )
                </span>
              </div>

              {/* Greeks 推算總損益 */}
              <div
                className={`p-3.5 rounded-xl border ${
                  greeksEstimatedAnalysis.totalEstimatedPnL > 0
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : greeksEstimatedAnalysis.totalEstimatedPnL < 0
                    ? 'bg-rose-50 border-rose-300 text-rose-950'
                    : 'bg-neutral-50 border-neutral-300 text-neutral-800'
                }`}
              >
                <span className="text-[11px] font-bold opacity-80 block">
                  Greeks 預估總損益 (經過 {daysHeld} 天)
                </span>
                <div className="text-xl font-mono font-black tabular-nums mt-1">
                  {greeksEstimatedAnalysis.totalEstimatedPnL >= 0
                    ? `+$${greeksEstimatedAnalysis.totalEstimatedPnL.toFixed(2)}`
                    : `-$${Math.abs(greeksEstimatedAnalysis.totalEstimatedPnL).toFixed(2)}`}
                </div>
                <span className="text-[11px] font-mono tabular-nums block mt-1">
                  預估 ROI:{' '}
                  {greeksEstimatedAnalysis.estimatedRoiPct >= 0
                    ? `+${greeksEstimatedAnalysis.estimatedRoiPct.toFixed(2)}%`
                    : `${greeksEstimatedAnalysis.estimatedRoiPct.toFixed(2)}%`}
                </span>
              </div>

              {/* 若持有至到期日 (Expiration) 損益 */}
              <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200">
                <span className="text-[11px] font-medium text-neutral-500 block">
                  到期日結算損益 (Expiration)
                </span>
                <div
                  className={`text-lg font-mono font-black tabular-nums mt-1 ${
                    greeksEstimatedAnalysis.expirationTotalPnL > 0
                      ? 'text-emerald-700'
                      : greeksEstimatedAnalysis.expirationTotalPnL < 0
                      ? 'text-rose-700'
                      : 'text-neutral-800'
                  }`}
                >
                  {greeksEstimatedAnalysis.expirationTotalPnL >= 0
                    ? `+$${greeksEstimatedAnalysis.expirationTotalPnL.toFixed(2)}`
                    : `-$${Math.abs(greeksEstimatedAnalysis.expirationTotalPnL).toFixed(2)}`}
                </div>
                <span className="text-[11px] text-neutral-400 font-mono tabular-nums block mt-1">
                  到期內在價值: ${greeksEstimatedAnalysis.expirationIntrinsicPerShare.toFixed(2)}/股
                </span>
              </div>
            </div>

            {/* Breakdown of Delta / Theta / Gamma / Vega Contributions */}
            <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200 space-y-2.5">
              <div className="text-xs font-bold text-neutral-800 flex items-center justify-between">
                <span>損益因子拆解 (Greeks Contribution Breakdown):</span>
                <span className="text-[11px] font-mono tabular-nums text-neutral-500">
                  損益平衡價: ${breakevenPrice.toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                {/* Delta 貢獻 */}
                <div className="p-2.5 rounded-lg bg-white border border-neutral-200">
                  <span className="text-[10px] text-neutral-500 font-sans font-semibold block">
                    Delta 股價效應
                  </span>
                  <span
                    className={`font-black tabular-nums block mt-0.5 ${
                      greeksEstimatedAnalysis.deltaEffectTotal >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {greeksEstimatedAnalysis.deltaEffectTotal >= 0
                      ? `+$${greeksEstimatedAnalysis.deltaEffectTotal.toFixed(2)}`
                      : `-$${Math.abs(greeksEstimatedAnalysis.deltaEffectTotal).toFixed(2)}`}
                  </span>
                  <span className="text-[10px] text-neutral-400 tabular-nums block">
                    ({greeksEstimatedAnalysis.deltaEffectPerShare >= 0 ? '+' : ''}
                    {greeksEstimatedAnalysis.deltaEffectPerShare.toFixed(2)}/股)
                  </span>
                </div>

                {/* Theta 貢獻 */}
                <div className="p-2.5 rounded-lg bg-white border border-neutral-200">
                  <span className="text-[10px] text-amber-900 font-sans font-semibold block">
                    Theta 衰減 ({daysHeld}天)
                  </span>
                  <span
                    className={`font-black tabular-nums block mt-0.5 ${
                      greeksEstimatedAnalysis.thetaEffectTotal >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {greeksEstimatedAnalysis.thetaEffectTotal >= 0
                      ? `+$${greeksEstimatedAnalysis.thetaEffectTotal.toFixed(2)}`
                      : `-$${Math.abs(greeksEstimatedAnalysis.thetaEffectTotal).toFixed(2)}`}
                  </span>
                  <span className="text-[10px] text-amber-800 tabular-nums block">
                    ({greeksEstimatedAnalysis.thetaEffectPerShare >= 0 ? '+' : ''}
                    {greeksEstimatedAnalysis.thetaEffectPerShare.toFixed(2)}/股)
                  </span>
                </div>

                {/* Gamma 貢獻 */}
                <div className="p-2.5 rounded-lg bg-white border border-neutral-200">
                  <span className="text-[10px] text-neutral-500 font-sans font-semibold block">
                    Gamma 二階加速
                  </span>
                  <span
                    className={`font-black tabular-nums block mt-0.5 ${
                      greeksEstimatedAnalysis.gammaEffectTotal >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {greeksEstimatedAnalysis.gammaEffectTotal >= 0
                      ? `+$${greeksEstimatedAnalysis.gammaEffectTotal.toFixed(2)}`
                      : `-$${Math.abs(greeksEstimatedAnalysis.gammaEffectTotal).toFixed(2)}`}
                  </span>
                  <span className="text-[10px] text-neutral-400 tabular-nums block">
                    ({greeksEstimatedAnalysis.gammaEffectPerShare >= 0 ? '+' : ''}
                    {greeksEstimatedAnalysis.gammaEffectPerShare.toFixed(2)}/股)
                  </span>
                </div>

                {/* Vega 貢獻 */}
                <div className="p-2.5 rounded-lg bg-white border border-neutral-200">
                  <span className="text-[10px] text-blue-900 font-sans font-semibold block">
                    Vega 波動率 ({dIv >= 0 ? `+${dIv}%` : `${dIv}%`})
                  </span>
                  <span
                    className={`font-black tabular-nums block mt-0.5 ${
                      greeksEstimatedAnalysis.vegaEffectTotal >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {greeksEstimatedAnalysis.vegaEffectTotal >= 0
                      ? `+$${greeksEstimatedAnalysis.vegaEffectTotal.toFixed(2)}`
                      : `-$${Math.abs(greeksEstimatedAnalysis.vegaEffectTotal).toFixed(2)}`}
                  </span>
                  <span className="text-[10px] text-blue-700 tabular-nums block">
                    ({greeksEstimatedAnalysis.vegaEffectPerShare >= 0 ? '+' : ''}
                    {greeksEstimatedAnalysis.vegaEffectPerShare.toFixed(2)}/股)
                  </span>
                </div>
              </div>
            </div>

            {/* Intrinsic vs Time Value Breakdown */}
            <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200 space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-neutral-700">開倉期權金 (${P_entry.toFixed(2)}) 價值構成:</span>
                <span className="font-mono tabular-nums text-emerald-900">
                  損益平衡點: ${breakevenPrice.toFixed(2)}
                </span>
              </div>
              <div className="h-2 w-full bg-neutral-200 rounded-full overflow-hidden flex">
                <div
                  style={{
                    width: `${P_entry > 0 ? Math.min(100, (intrinsicValueNow / P_entry) * 100) : 0}%`
                  }}
                  className="bg-emerald-700 h-full transition-all duration-300"
                />
                <div
                  style={{
                    width: `${P_entry > 0 ? Math.min(100, (timeValueNow / P_entry) * 100) : 0}%`
                  }}
                  className="bg-amber-600 h-full transition-all duration-300"
                />
              </div>
              <div className="flex justify-between text-[11px] text-neutral-600 font-mono tabular-nums">
                <span className="text-emerald-800 font-semibold">
                  內在價值: ${intrinsicValueNow.toFixed(2)} (
                  {P_entry > 0 ? ((intrinsicValueNow / P_entry) * 100).toFixed(0) : 0}%)
                </span>
                <span className="text-amber-800 font-semibold">
                  時間價值: ${timeValueNow.toFixed(2)} (
                  {P_entry > 0 ? ((timeValueNow / P_entry) * 100).toFixed(0) : 0}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Table: Moomoo 股價變動多情境損益對照表 */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
          <div>
            <h4 className="font-bold text-xs text-neutral-900 tracking-wide flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-700" />
              Moomoo 股價變動多情境損益表
            </h4>
            <p className="text-xs text-neutral-500 mt-0.5">
              依據即時 Greeks 對比「持有 {daysHeld} 天後 Greeks 推算損益」與「到期日結算損益」。點擊任一列即可直接套入目標價與試算。
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-neutral-100 text-neutral-700 font-bold border-b border-neutral-200">
                <th className="py-2.5 px-3 text-center">股價變動 (%)</th>
                <th className="py-2.5 px-3 text-right">目標股價 ($)</th>
                <th className="py-2.5 px-3 text-right">股價價差 (Δ$)</th>
                <th className="py-2.5 px-3 text-right bg-emerald-50/70 text-emerald-950">推算期權單價 ($)</th>
                <th className="py-2.5 px-3 text-right bg-emerald-50/70 text-emerald-950">Greeks 推算損益 ($)</th>
                <th className="py-2.5 px-3 text-right bg-emerald-50/70 text-emerald-950">推算 ROI (%)</th>
                <th className="py-2.5 px-3 text-right">到期結算損益 ($)</th>
                <th className="py-2.5 px-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-mono tabular-nums">
              {scenarioMatrix.map((row, idx) => {
                const isEstWin = row.estTotalPnL > 0;
                const isExpWin = row.expTotalPnL > 0;
                const isZero = row.pct === 0;

                return (
                  <tr
                    key={idx}
                    onClick={() => {
                      setTargetStockPrice(row.simStock.toFixed(2));
                      setGreeksTab('target');
                    }}
                    className={`transition-colors hover:bg-emerald-50/40 cursor-pointer ${
                      isZero ? 'bg-amber-50/60 font-bold' : ''
                    }`}
                  >
                    <td className="py-2 px-3 text-center font-bold">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                          row.pct > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : row.pct < 0
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-neutral-200 text-neutral-800'
                        }`}
                      >
                        {row.pct > 0 ? `+${row.pct}%` : `${row.pct}%`}
                        {isZero ? ' (現價)' : ''}
                      </span>
                    </td>

                    <td className="py-2 px-3 text-right font-bold text-neutral-900">
                      ${row.simStock.toFixed(2)}
                    </td>

                    <td
                      className={`py-2 px-3 text-right font-semibold ${
                        row.dS > 0 ? 'text-emerald-700' : row.dS < 0 ? 'text-rose-700' : 'text-neutral-500'
                      }`}
                    >
                      {row.dS >= 0 ? `+$${row.dS.toFixed(2)}` : `-$${Math.abs(row.dS).toFixed(2)}`}
                    </td>

                    <td className="py-2 px-3 text-right font-black bg-emerald-50/30 text-neutral-900">
                      ${row.estOptPrice.toFixed(2)}
                    </td>

                    <td
                      className={`py-2 px-3 text-right font-black bg-emerald-50/30 ${
                        isEstWin ? 'text-emerald-700' : row.estTotalPnL < 0 ? 'text-rose-700' : 'text-neutral-600'
                      }`}
                    >
                      {row.estTotalPnL >= 0
                        ? `+$${row.estTotalPnL.toFixed(2)}`
                        : `-$${Math.abs(row.estTotalPnL).toFixed(2)}`}
                    </td>

                    <td
                      className={`py-2 px-3 text-right font-bold bg-emerald-50/30 ${
                        isEstWin ? 'text-emerald-700' : row.estTotalPnL < 0 ? 'text-rose-700' : 'text-neutral-600'
                      }`}
                    >
                      {row.estRoi >= 0 ? `+${row.estRoi.toFixed(1)}%` : `${row.estRoi.toFixed(1)}%`}
                    </td>

                    <td
                      className={`py-2 px-3 text-right font-semibold ${
                        isExpWin ? 'text-emerald-700' : row.expTotalPnL < 0 ? 'text-rose-700' : 'text-neutral-500'
                      }`}
                    >
                      {row.expTotalPnL >= 0
                        ? `+$${row.expTotalPnL.toFixed(2)}`
                        : `-$${Math.abs(row.expTotalPnL).toFixed(2)}`}
                    </td>

                    <td className="py-2 px-3 text-center">
                      <span className="text-[11px] font-sans font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded hover:bg-blue-100">
                        帶入目標價
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Save & Add to Trades Action Bar */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-neutral-900 text-white p-4 sm:p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-neutral-300">
              合約金額 (${P_entry.toFixed(2)} × 100 股) ＝
            </span>
            <span className="font-mono font-black tabular-nums text-emerald-400 text-base bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-700/60">
              ${(P_entry * 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-neutral-400 font-medium">/ 張</span>
            <span className="text-neutral-300 ml-1">
              · 總持倉成本 ({N}張)：
              <span className="font-mono font-black tabular-nums text-emerald-300 ml-1">
                ${(P_entry * mult * N).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </span>
            <span className="text-neutral-300 ml-1">
              · Delta：
              <span className="font-mono font-black tabular-nums text-amber-300 ml-1">
                {deltaVal.toFixed(4)}
              </span>
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full lg:w-auto shrink-0">
          <button
            type="button"
            onClick={handleSaveOptions}
            disabled={isSaving}
            className="w-full sm:w-auto bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 active:scale-95 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>儲存中...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-emerald-400" />
                <span>儲存期權試算設定</span>
              </>
            )}
          </button>

          {onAddOptionToTrades && (
            <button
              type="button"
              onClick={() => handleAddOptionRecordToTrades()}
              disabled={isAddingTrade}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isAddingTrade ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>加入交易紀錄中...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>加入至交易紀錄 (合約金額 / 總成本 / Delta)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
