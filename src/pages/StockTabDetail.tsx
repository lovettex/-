import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStockTabs } from '../hooks/useStockTabs';
import { useTrades } from '../hooks/useTrades';
import { calculateStats } from '../lib/calculations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { format } from 'date-fns';
import { Timestamp, collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { Trash2, BarChart3, ChevronDown, ChevronUp, Gamepad2, ShieldCheck, Upload, Download, ChevronLeft } from 'lucide-react';
import { toast } from "sonner";
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { safeSessionStorage } from '../lib/utils';
import { ScrollIn, InteractiveButton, Magnetic } from '../components/MotionWrappers';
import StrategyTab from '../components/StrategyTab';
import ChipAnalysisTab from '../components/ChipAnalysisTab';

export default function StockTabDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tabs, updateTabStatus, updateCurrentPrice, updateTradeType, updateTab, deleteTab } = useStockTabs();
  const { trades, addTrade, deleteTrade } = useTrades(id);

  const tab = tabs.find(t => t.id === id);

  const [tradeForm, setTradeForm] = useState({
    type: 'BUY',
    purpose: '加碼',
    operator: '人',
    price: '',
    quantity: '',
    tradeDate: format(new Date(), 'yyyy-MM-dd'),
    fees: '',
    notes: ''
  });
  const [isTradeOpen, setIsTradeOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false); 
  const [isTradeListOpen, setIsTradeListOpen] = useState(false);
  const [finalPnLInput, setFinalPnLInput] = useState('');
  const [activeTab, setActiveTab] = useState('trades');
  const [currentPriceInput, setCurrentPriceInput] = useState('');
  const [plannedBuyQtyInput, setPlannedBuyQtyInput] = useState<string>('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const tradesJsonFileInputRef = React.useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  // 5 rows for stock averaging
  const [averagingRows, setAveragingRows] = useState([
    { price: '', quantity: '' },
    { price: '', quantity: '' },
    { price: '', quantity: '' },
    { price: '', quantity: '' },
    { price: '', quantity: '' }
  ]);
  const [includeCurrentHolding, setIncludeCurrentHolding] = useState(true);

  // Percentage calculator states
  const [calcExpression, setCalcExpression] = useState('');
  const [calcBasePrice, setCalcBasePrice] = useState('');
  const [calcPercent, setCalcPercent] = useState('');
  const [calcType, setCalcType] = useState('SUB'); // 'ADD' or 'SUB'

  // Update currentPriceInput when tab data loads or changes
  React.useEffect(() => {
    if (tab?.currentPrice !== undefined) {
      setCurrentPriceInput(tab.currentPrice.toString());
    }
  }, [tab?.id, tab?.currentPrice]);

  // Update plannedBuyQtyInput when tab data loads or changes
  React.useEffect(() => {
    if (tab?.plannedBuyQty !== undefined) {
      setPlannedBuyQtyInput(tab.plannedBuyQty.toString());
    } else {
      setPlannedBuyQtyInput('');
    }
  }, [tab?.id, tab?.plannedBuyQty]);

  const handlePlannedBuyQtyChange = async (val: string) => {
    setPlannedBuyQtyInput(val);
    const parsed = parseFloat(val);
    if (tab) {
      if (!isNaN(parsed) && parsed >= 0) {
        await updateTab(tab.id, { plannedBuyQty: parsed });
      } else if (val === '') {
        await updateTab(tab.id, { plannedBuyQty: 0 });
      }
    }
  };

  // Update preferredHoldingSubTab when tab changes so dashboard goes back to the right tab
  React.useEffect(() => {
    if (tab?.holdingStatus) {
       const displayStatus = ['觀察中', '買進操作', '賣出操作', '平倉操作', '乖離名單'].includes(tab.holdingStatus) ? tab.holdingStatus : '候選名單';
       safeSessionStorage.setItem('preferredHoldingSubTab', displayStatus);
    }
  }, [tab?.holdingStatus]);

  // Keyboard shortcut handle (Shift + B) to go back to dashboard
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toUpperCase() === 'B' && !e.ctrlKey && !e.metaKey) {
        // Only trigger if not in an input/textarea
        const activeEl = document.activeElement;
        const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
        
        if (!isInput) {
          e.preventDefault();
          navigate('/');
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [navigate]);

  const stats = calculateStats(trades, tab?.currentPrice);

  // Prefill percentage calculator base price when data loaded
  React.useEffect(() => {
    if (tab && stats) {
      const baseVal = tab.currentPrice || stats.averagePrice || 0;
      if (baseVal > 0 && !calcBasePrice) {
        setCalcBasePrice(baseVal.toFixed(2));
        setCalcPercent('7');
        setCalcType('SUB');
      }
    }
  }, [tab?.id, tab?.currentPrice, stats?.averagePrice]);

  // Keep expression in sync with manual inputs (section 2 -> section 1)
  React.useEffect(() => {
    const base = parseFloat(calcBasePrice) || 0;
    const op = calcType === 'ADD' ? '+' : '-';
    const pctStr = calcPercent === '' ? '' : calcPercent;
    
    if (base > 0) {
      if (pctStr !== '') {
        setCalcExpression(`${base.toFixed(2)} ${op} ${pctStr}%`);
      } else {
        setCalcExpression(`${base.toFixed(2)} ${op} 0%`);
      }
    }
  }, [calcBasePrice, calcType, calcPercent]);

  if (!tab) return <div className="text-slate-500">找不到該股票分頁，或已被刪除。</div>;

  // Helper to parse and calculate: e.g. "56 - 7%" or "56 + 8%"
  const parseAndCalculatePercentage = (expr: string) => {
    if (!expr) return { success: false };
    
    // Clean string: remove leading/trailing spaces, remove leading $, and remove all spaces
    const clean = expr.trim().replace(/^\$/, '').replace(/\s+/g, '');
    
    // Regex matches:
    // Group 1: Base price (can have commas, digits, dots)
    // Group 2: Operator (+ or -)
    // Group 3: Percentage value (can have commas, digits, dots)
    // Optional trailing %
    const regex = /^([\d\.,]+)([\+\-])([\d\.,]+)%?$/;
    const match = clean.match(regex);
    
    if (match) {
      const baseStr = match[1].replace(/,/g, '');
      const op = match[2];
      const percentStr = match[3].replace(/,/g, '');
      
      const base = parseFloat(baseStr);
      const percent = parseFloat(percentStr);
      
      if (!isNaN(base) && !isNaN(percent)) {
        const isAdd = op === '+';
        const factor = isAdd ? (1 + percent / 100) : (1 - percent / 100);
        const result = base * factor;
        return { success: true, result, base, percent, isAdd };
      }
    }
    
    // If it's just a simple number (without operator)
    const simpleNumStr = clean.replace(/,/g, '');
    const simpleNum = parseFloat(simpleNumStr);
    if (!isNaN(simpleNum) && !clean.includes('+') && !clean.includes('-')) {
      return { success: true, result: simpleNum, base: simpleNum, percent: 0, isAdd: true };
    }
    
    return { success: false };
  };

  const handlePresetClick = (p: string) => {
    const base = parseFloat(calcBasePrice) || tab?.currentPrice || stats?.averagePrice || 0;
    if (base > 0) {
      const isNeg = p.startsWith('-');
      const val = p.replace(/[\+\-%]/g, '');
      setCalcType(isNeg ? 'SUB' : 'ADD');
      setCalcPercent(val);
      setCalcBasePrice(base.toFixed(2));
    }
  };

  // Calculation of stock averaging
  const calculateAveraging = () => {
    let newSharesSum = 0;
    let newCostSum = 0;

    averagingRows.forEach(row => {
      const p = parseFloat(row.price);
      const q = parseFloat(row.quantity);
      if (!isNaN(p) && p > 0 && !isNaN(q) && q > 0) {
        newSharesSum += q;
        newCostSum += p * q;
      }
    });

    const currentShares = includeCurrentHolding ? stats.totalQuantity : 0;
    const currentPrice = includeCurrentHolding ? stats.averagePrice : 0;
    const currentCost = currentShares * currentPrice;

    const totalShares = currentShares + newSharesSum;
    const totalCost = currentCost + newCostSum;
    const finalAveragePrice = totalShares > 0 ? (totalCost / totalShares) : 0;

    let costReducedPercent = 0;
    if (stats.averagePrice > 0 && finalAveragePrice < stats.averagePrice) {
      costReducedPercent = ((stats.averagePrice - finalAveragePrice) / stats.averagePrice) * 100;
    }

    return {
      newSharesSum,
      newCostSum,
      totalShares,
      totalCost,
      finalAveragePrice,
      costReducedPercent
    };
  };

  const avgResult = calculateAveraging();
  const parsedCalc = parseAndCalculatePercentage(calcExpression);

  // Four-batch transaction planning calculations
  const totalBought = trades
    .filter(t => t.type === 'BUY')
    .reduce((acc, t) => acc + (t.quantity || 0), 0);

  const plannedQty = parseFloat(plannedBuyQtyInput) || tab?.plannedBuyQty || 0;
  const size1 = Math.ceil(plannedQty * 0.15);
  const size2 = Math.ceil(plannedQty * 0.25);
  const size3 = Math.ceil(plannedQty * 0.35);
  const size4 = Math.ceil(plannedQty * 0.25);

  const bought1 = Math.min(totalBought, size1);
  const remaining1 = Math.max(0, size1 - bought1);

  const temp2 = Math.max(0, totalBought - size1);
  const bought2 = Math.min(temp2, size2);
  const remaining2 = Math.max(0, size2 - bought2);

  const temp3 = Math.max(0, temp2 - size2);
  const bought3 = Math.min(temp3, size3);
  const remaining3 = Math.max(0, size3 - bought3);

  const temp4 = Math.max(0, temp3 - size3);
  const bought4 = Math.min(temp4, size4);
  const remaining4 = Math.max(0, size4 - bought4);

  const remainingToBuy = Math.max(0, plannedQty - totalBought);

  let currentBatchText = "";
  let currentBatchOrderText = "";
  if (plannedQty <= 0) {
    currentBatchText = "未規劃預計購買";
    currentBatchOrderText = "無";
  } else if (totalBought < size1) {
    currentBatchText = "第 1 批進場中";
    currentBatchOrderText = "第一批";
  } else if (totalBought < (size1 + size2)) {
    currentBatchText = "第 2 批進場中";
    currentBatchOrderText = "第二批";
  } else if (totalBought < (size1 + size2 + size3)) {
    currentBatchText = "第 3 批進場中";
    currentBatchOrderText = "第三批";
  } else if (totalBought < (size1 + size2 + size3 + size4)) {
    currentBatchText = "第 4 批進場中";
    currentBatchOrderText = "第四批";
  } else {
    currentBatchText = "已滿批進場 (已完成)";
    currentBatchOrderText = "已滿批";
  }

  const isStaleData = tab.updatedAt && typeof tab.updatedAt.toDate === 'function' 
    ? (new Date().getTime() - tab.updatedAt.toDate().getTime() > 17 * 60 * 60 * 1000)
    : false;

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);
        let jsonArray = json;
        if (!Array.isArray(json)) {
          if (typeof json === 'object' && json !== null) {
            // Try to find if there is a nested array (e.g. { data: [...] })
            const possibleArray = Object.values(json).find(Array.isArray);
            if (possibleArray) {
              jsonArray = possibleArray;
            } else {
              // Assume it's a single object
              jsonArray = [json];
            }
          } else {
            throw new Error("無法解析的匯入資料格式");
          }
        }

        // Find the matching stock symbol
        const targetData = jsonArray.find((item: any) => {
          let foundSym = "";
          Object.entries(item).forEach(([key, value]) => {
            const normalizedKey = key.toUpperCase().replace(/[\s_\.\-]+/g, "");
            if (
              (normalizedKey === "SYM" ||
                normalizedKey === "SYMBOL" ||
                normalizedKey === "TICKER" ||
                normalizedKey === "代碼")
            ) {
              foundSym = String(value);
            }
          });
          return foundSym.toUpperCase() === tab.symbol.toUpperCase();
        });

        if (!targetData) {
          throw new Error(`找不到 ${tab.symbol} 的相關資料`);
        }

        const updates: any = {};
        
        Object.entries(targetData).forEach(([key, value]) => {
          const normalizedKey = key.toUpperCase().replace(/[\s_\.\-]+/g, "");
          if (normalizedKey.includes("QUALITY") && updates.qualityScore === undefined) {
            updates.qualityScore = Number(value);
          }
          if (normalizedKey.includes("VALUE") && updates.valueScore === undefined) {
            updates.valueScore = Number(value);
          }
          if ((normalizedKey.includes("CRASH") || normalizedKey.includes("崩盤")) && updates.crashSimilarity === undefined) {
             updates.crashSimilarity = Number(value);
          }
          if ((normalizedKey === "BUY" || normalizedKey === "BUYSCORE" || normalizedKey === "BUYRATE") && updates.buyRate === undefined) {
            updates.buyRate = Number(value);
          }
          if ((normalizedKey === "SELL" || normalizedKey === "SELLSCORE" || normalizedKey === "SELLRATE") && updates.sellRate === undefined) {
            updates.sellRate = Number(value);
          }
          if ((normalizedKey.includes("AISCORE") || normalizedKey.includes("AI分數") || normalizedKey.includes("AI評分") || normalizedKey === "RATING") && updates.rating === undefined) {
            updates.rating = Number(value);
          }
        });

        if (Object.keys(updates).length > 0) {
          updateTab(tab.id, updates);
          toast.success(`成功更新 ${tab.symbol} 的評分資料`);
        } else {
          toast.info("未能找到可更新的評分資料");
        }

      } catch (error: any) {
        toast.error(`匯入失敗: ${error.message}`);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    reader.readAsText(file);
  };

  const handleExportRatingJson = () => {
    try {
      const ratingData = {
        "代碼": tab.symbol,
        "rating": Number(tab.rating ?? 5),
        "qualityScore": Number(tab.qualityScore ?? 5),
        "valueScore": Number(tab.valueScore ?? 5),
        "crashSimilarity": Number(tab.crashSimilarity ?? 5),
        "buyRate": Number(tab.buyRate ?? 5),
        "sellRate": Number(tab.sellRate ?? 5)
      };

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(ratingData, null, 2)
      )}`;
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute("download", `${tab.symbol}_rating_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("評分數據已成功匯出為 JSON 檔案");
    } catch (error) {
      console.error(error);
      toast.error("匯出 JSON 失敗，請重試");
    }
  };

  const handleExportTradesJson = () => {
    try {
      const tradesToExport = trades.map(t => ({
        type: t.type,
        purpose: t.purpose,
        operator: t.operator || '人',
        price: t.price,
        quantity: t.quantity,
        tradeDate: t.tradeDate instanceof Timestamp 
          ? t.tradeDate.toDate().toISOString() 
          : (t.tradeDate && (t.tradeDate as any).seconds 
             ? new Date((t.tradeDate as any).seconds * 1000).toISOString() 
             : new Date().toISOString()),
        fees: t.fees || 0,
        notes: t.notes || ''
      }));

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(tradesToExport, null, 2)
      )}`;
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonString);
      const symbol = tab?.symbol || "trades";
      downloadAnchor.setAttribute("download", `${symbol}_trades_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("交易紀錄已成功匯出為 JSON 檔案");
    } catch (error) {
      console.error(error);
      toast.error("匯出 JSON 失敗，請重試");
    }
  };

  const handleImportTradesJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!id || !user) {
      toast.error("請確認已登入且頁面正常載入");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (!Array.isArray(parsed)) {
          toast.error("不正確的 JSON 格式，交易紀錄資料必須為 JSON 陣列");
          return;
        }

        const validTrades = parsed.filter((t: any) => {
          return t && typeof t.type === 'string' && (t.type === 'BUY' || t.type === 'SELL');
        });

        if (validTrades.length === 0) {
          toast.error("沒有找到有效的交易紀錄資料（必須包含交易方向 type 與其他數值）");
          return;
        }

        const batch = writeBatch(db);
        const tradesColRef = collection(db, `stockTabs/${id}/trades`);

        validTrades.forEach((item: any) => {
          const newDocRef = doc(tradesColRef);
          
          let dateVal: Date;
          if (item.tradeDate) {
            dateVal = new Date(item.tradeDate);
            if (isNaN(dateVal.getTime())) {
              dateVal = new Date();
            }
          } else {
            dateVal = new Date();
          }

          batch.set(newDocRef, {
            type: item.type as 'BUY' | 'SELL',
            purpose: (item.purpose || '加碼') as '加碼' | '平倉',
            operator: (item.operator || '人') as '機器' | '人',
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 0,
            tradeDate: Timestamp.fromDate(dateVal),
            fees: Number(item.fees) || 0,
            notes: item.notes || '',
            createdAt: serverTimestamp()
          });
        });

        await batch.commit();
        toast.success(`成功匯入 ${validTrades.length} 筆交易紀錄！`);
      } catch (error) {
        console.error(error);
        toast.error("解析或儲存 JSON 檔案失敗，請確保檔案格式正確");
      } finally {
        if (tradesJsonFileInputRef.current) {
          tradesJsonFileInputRef.current.value = "";
        }
      }
    };
    reader.readAsText(file);
  };

  const handlePriceUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPriceInput && !isNaN(Number(currentPriceInput))) {
      updateCurrentPrice(tab.id, Number(currentPriceInput));
    }
  };

  const handleTradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTrade({
      type: tradeForm.type as 'BUY' | 'SELL',
      purpose: tradeForm.purpose as '加碼' | '平倉',
      operator: tradeForm.operator as '機器' | '人',
      price: Number(tradeForm.price),
      quantity: Number(tradeForm.quantity),
      tradeDate: Timestamp.fromDate(new Date(tradeForm.tradeDate)),
      fees: Number(tradeForm.fees) || 0,
      notes: tradeForm.notes
    });
    setTradeForm({ ...tradeForm, price: '', quantity: '', fees: '', notes: '' });
    setIsTradeOpen(false);
  };

  const handleCompleteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateTabStatus(tab.id, 'COMPLETED', Number(finalPnLInput));
    setIsCompleteOpen(false);
  };

  const handleReactivate = () => {
    updateTabStatus(tab.id, 'ACTIVE');
  };

  const handleDelete = () => {
    if (confirm(`確定要刪除 ${tab.symbol} 嗎？這將刪除所有相關的交易與計畫。`)) {
      deleteTab(tab.id);
      navigate('/');
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="h-[36px] flex items-center gap-2 bg-transparent select-none">
        <button
          onClick={() => navigate('/', { state: { autoFlipTabId: id } })}
          className="flex items-center gap-1 text-[12px] font-bold transition-all hover:opacity-85 text-zinc-600 hover:text-zinc-900 cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>交易總覽</span>
        </button>
        <span className="text-[12px] text-zinc-300">/</span>
        <span className="text-[12px] font-bold text-zinc-800">{tab.symbol}</span>
      </div>
      <ScrollIn>
        <div className="glass-panel border border-zinc-200 bg-white/90 p-4 sm:py-3 sm:px-4 rounded-2xl shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4 md:gap-4 overflow-visible relative">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 w-full xl:w-auto relative z-10">
            <div className="w-full md:w-auto flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <motion.h1 
                    layoutId="tab-title"
                    className="text-2xl sm:text-2xl font-bold tracking-tight text-black"
                  >
                    {tab.symbol}
                  </motion.h1>
                  {tab.status === 'COMPLETED' && (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20 font-bold text-[10px] px-2 py-0 rounded-full">COMPLETED</Badge>
                  )}
                </div>
                <div className="flex flex-col mt-0.5 sm:mt-0">
                  <p className="text-zinc-500 text-[10px] tracking-wider truncate max-w-[200px] sm:max-w-[120px]">{tab.companyName}</p>
                </div>
              </div>

              {/* Mobile Only: Avg Cost & Total Shares */}
              <div className="flex sm:hidden flex-row gap-4 shrink-0 text-right mt-0.5">
                <div className="flex flex-col">
                  <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest leading-tight">Avg Cost</span>
                  <span className="text-base font-bold text-zinc-800 tracking-tight leading-none mt-0.5">${stats.averagePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest leading-tight">Total Shares</span>
                  <span className="text-base font-bold text-zinc-800 tracking-tight leading-none mt-0.5">{stats.totalQuantity} <span className="text-[10px] text-zinc-500 font-normal ml-0.5">股</span></span>
                </div>
              </div>
            </div>

            <div className="h-8 w-px bg-zinc-200 hidden md:block" />

            <div className="flex flex-col md:flex-row md:items-center gap-5 sm:gap-4 lg:gap-5 w-full md:w-auto mt-2 md:mt-0">
              <div className="hidden sm:flex flex-row gap-6 sm:gap-4 shrink-0">
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest leading-tight">Avg Cost</span>
                  <span className="text-lg font-bold text-zinc-800 tracking-tight leading-none mt-0.5">${stats.averagePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest leading-tight">Total Shares</span>
                  <span className="text-lg font-bold text-zinc-800 tracking-tight leading-none mt-0.5">{stats.totalQuantity} <span className="text-[10px] text-zinc-400 font-normal ml-0.5">股</span></span>
                </div>
              </div>
              <div className="h-6 w-px bg-zinc-200 hidden md:block shrink-0" />
              <div className="grid grid-cols-3 sm:flex sm:flex-wrap sm:items-center gap-x-2 gap-y-2.5 sm:gap-x-2 sm:gap-y-1.5 w-full sm:w-auto">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest pl-0.5 text-center sm:text-left">評分</span>
                <Select value={String(tab.rating || 5)} onValueChange={(val) => updateTab(tab.id, { rating: Number(val) })}>
                  <SelectTrigger className="h-8 sm:h-6 w-full sm:w-11 bg-white border border-zinc-200 text-zinc-800 font-bold text-[12px] sm:text-[11px] ring-0 focus:ring-emerald-500/55 rounded p-1 mx-auto sm:mx-0">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-zinc-200 text-zinc-800 bg-white min-w-[50px]">
                    {[...Array(10)].map((_, i) => (
                      <SelectItem key={i+1} value={String(i+1)} className="text-xs text-zinc-700 focus:bg-zinc-100">{i+1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest pl-0.5 text-center sm:text-left">Quality</span>
                <Select value={String(tab.qualityScore || 5)} onValueChange={(val) => updateTab(tab.id, { qualityScore: Number(val) })}>
                  <SelectTrigger className="h-8 sm:h-6 w-full sm:w-11 bg-white border-zinc-200 text-zinc-800 font-bold text-[12px] sm:text-[11px] ring-0 focus:ring-purple-500/50 rounded p-1 mx-auto sm:mx-0">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-zinc-200 text-zinc-800 bg-white min-w-[50px]">
                    {[...Array(10)].map((_, i) => (
                      <SelectItem key={i+1} value={String(i+1)} className="text-xs text-zinc-700 focus:bg-zinc-100">{i+1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest pl-0.5 text-center sm:text-left">Value</span>
                <Select value={String(tab.valueScore || 5)} onValueChange={(val) => updateTab(tab.id, { valueScore: Number(val) })}>
                  <SelectTrigger className="h-8 sm:h-6 w-full sm:w-11 bg-white border border-zinc-200 text-zinc-800 font-bold text-[12px] sm:text-[11px] ring-0 focus:ring-amber-500/50 rounded p-1 mx-auto sm:mx-0">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-zinc-200 text-zinc-800 bg-white min-w-[50px]">
                    {[...Array(10)].map((_, i) => (
                      <SelectItem key={i+1} value={String(i+1)} className="text-xs text-zinc-700 focus:bg-zinc-100">{i+1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest pl-0.5 whitespace-nowrap text-center sm:text-left">Crash Sim</span>
                <Select value={String(tab.crashSimilarity || 5)} onValueChange={(val) => updateTab(tab.id, { crashSimilarity: Number(val) })}>
                  <SelectTrigger className="h-8 sm:h-6 w-full sm:w-11 bg-white border-zinc-200 text-zinc-800 font-bold text-[12px] sm:text-[11px] ring-0 focus:ring-rose-500/50 rounded p-1 mx-auto sm:mx-0">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-zinc-200 text-zinc-800 bg-white min-w-[50px]">
                    {[...Array(10)].map((_, i) => (
                      <SelectItem key={i+1} value={String(i+1)} className="text-xs text-zinc-700 focus:bg-zinc-100">{i+1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest pl-0.5 text-center sm:text-left">Buy Rate</span>
                <Select value={String(tab.buyRate || 5)} onValueChange={(val) => updateTab(tab.id, { buyRate: Number(val) })}>
                  <SelectTrigger className="h-8 sm:h-6 w-full sm:w-11 bg-white border-zinc-200 text-zinc-800 font-bold text-[12px] sm:text-[11px] ring-0 focus:ring-emerald-500/50 rounded p-1 mx-auto sm:mx-0">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-zinc-200 text-zinc-800 bg-white min-w-[50px]">
                    {[...Array(10)].map((_, i) => (
                      <SelectItem key={i+1} value={String(i+1)} className="text-xs text-zinc-700 focus:bg-zinc-100">{i+1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest pl-0.5 text-center sm:text-left">Sell Rate</span>
                <Select value={String(tab.sellRate || 5)} onValueChange={(val) => updateTab(tab.id, { sellRate: Number(val) })}>
                  <SelectTrigger className="h-8 sm:h-6 w-full sm:w-11 bg-white border-zinc-200 text-zinc-800 font-bold text-[12px] sm:text-[11px] ring-0 focus:ring-red-500/50 rounded p-1 mx-auto sm:mx-0">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-zinc-200 text-zinc-800 bg-white min-w-[50px]">
                    {[...Array(10)].map((_, i) => (
                      <SelectItem key={i+1} value={String(i+1)} className="text-xs text-zinc-700 focus:bg-zinc-100">{i+1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest pl-0.5 text-center sm:text-left">波動性</span>
                <Select value={tab.volatility || '中等'} onValueChange={(val: any) => updateTab(tab.id, { volatility: val })}>
                  <SelectTrigger className="h-8 sm:h-6 w-full sm:w-12 bg-white border-zinc-200 text-zinc-800 font-bold text-[12px] sm:text-[10px] ring-0 focus:ring-emerald-500/50 rounded p-1 mx-auto sm:mx-0">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-zinc-200 text-zinc-800 bg-white">
                    <SelectItem value="低" className="text-xs text-blue-600 focus:bg-zinc-100">低</SelectItem>
                    <SelectItem value="中等" className="text-xs text-amber-600 focus:bg-zinc-100">中等</SelectItem>
                    <SelectItem value="高" className="text-xs text-rose-600 focus:bg-zinc-100">高</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-0.5 ml-0 sm:ml-1">
                <span className="text-[9px] font-bold text-emerald-650 uppercase tracking-widest text-center">Pos Value</span>
                <div className="h-8 sm:h-6 w-full sm:w-11 bg-emerald-50 border border-emerald-500/20 text-emerald-700 font-bold text-[12px] sm:text-[11px] rounded flex items-center justify-center mx-auto sm:mx-0">
                  {Math.max(0, Number(tab.rating||5) - 5) + Math.max(0, Number(tab.qualityScore||5) - 5) + Math.max(0, Number(tab.valueScore||5) - 5) + Number(tab.buyRate||5)}
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold text-rose-650 uppercase tracking-widest text-center">Neg Value</span>
                <div className="h-8 sm:h-6 w-full sm:w-11 bg-rose-50 border border-red-500/20 text-red-500 font-bold text-[12px] sm:text-[11px] rounded flex items-center justify-center mx-auto sm:mx-0">
                  {Math.max(0, 5 - Number(tab.rating||5)) + Math.max(0, 5 - Number(tab.qualityScore||5)) + Math.max(0, 5 - Number(tab.valueScore||5)) + Number(tab.sellRate||5)}
                </div>
              </div>


            </div>
          </div>
        </div>

        <div className="flex flex-row items-center justify-start sm:justify-start gap-1.5 sm:gap-3 w-full xl:w-auto relative z-20 pt-3 sm:pt-0 border-t border-zinc-100 xl:border-t-0 mt-3 sm:mt-1 xl:mt-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] py-1 sm:py-0">
            <div className="flex flex-row items-center gap-1.5 shrink-0">
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleJsonUpload}
                />
                <button 
                  onClick={handleExportRatingJson}
                  className="h-8 px-3 rounded-full sm:rounded-lg flex items-center gap-1.5 border border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-900 transition-all text-[11px] sm:text-xs tracking-wider font-semibold whitespace-nowrap group shrink-0 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 sm:w-3 sm:h-3 group-hover:-translate-y-0.5 transition-transform text-zinc-500" />
                  <span className="hidden sm:inline">匯出 JSON</span>
                  <span className="inline sm:hidden">匯出</span>
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 px-3 rounded-full sm:rounded-lg flex items-center gap-1.5 border border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-900 transition-all text-[11px] sm:text-xs tracking-wider font-semibold whitespace-nowrap group shrink-0 shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5 sm:w-3 sm:h-3 group-hover:-translate-y-0.5 transition-transform text-zinc-500" />
                  <span className="hidden sm:inline">匯入 JSON</span>
                  <span className="inline sm:hidden">匯入</span>
                </button>
            </div>

            <div className="shrink-0">
              <Select value={tab.tradeType} onValueChange={(val: any) => updateTradeType(tab.id, val)}>
                <SelectTrigger className="h-8 px-2.5 sm:px-3 bg-white border border-zinc-200 text-zinc-800 text-[11px] font-medium focus:ring-emerald-500/50 rounded-full sm:rounded-lg shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-panel border-zinc-200 text-zinc-800 bg-white min-w-[100px]">
                  <SelectItem value="simulated" className="text-xs font-medium focus:bg-zinc-150">
                    <div className="flex items-center gap-1.5">
                      <Gamepad2 className="h-3 w-3 text-amber-650" />
                      <span className="hidden sm:inline">模擬交易</span>
                      <span className="inline sm:hidden">模擬</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="real" className="text-xs font-medium focus:bg-zinc-150">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3 w-3 text-emerald-650" />
                      <span className="hidden sm:inline">真實交易</span>
                      <span className="inline sm:hidden">真實</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tab.status === 'ACTIVE' ? (
              <Dialog open={isCompleteOpen} onOpenChange={setIsCompleteOpen}>
                <DialogTrigger 
                  render={
                    <button className="h-8 bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 px-3 sm:px-4 text-[11px] sm:text-xs font-bold rounded-full sm:rounded-lg whitespace-nowrap transition-all flex items-center justify-center shrink-0">
                      完成交易
                    </button>
                  } 
                />
                <DialogContent className="glass-panel border-zinc-250 shadow-2xl bg-white text-zinc-800 max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="font-bold text-xl text-zinc-800">結束交易並記錄最終損益</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCompleteSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-zinc-600">最終獲利或虧損金額 ($)</Label>
                      <Input 
                        type="number" 
                        step="0.01"
                        value={finalPnLInput}
                        onChange={e => setFinalPnLInput(e.target.value)}
                        placeholder="例如：500 或 -200"
                        className="bg-white border-zinc-200 text-zinc-800 placeholder-zinc-400 focus-visible:ring-emerald-500/50"
                        required 
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 py-2 px-6 rounded-full">確認完成</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            ) : (
              <button onClick={handleReactivate} className="h-8 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-3 sm:px-4 text-[11px] sm:text-xs font-bold rounded-full sm:rounded-lg whitespace-nowrap transition-all flex items-center justify-center shrink-0">
                重新啟用
              </button>
            )}

            <button 
              onClick={handleDelete}
              className="h-8 w-8 flex items-center justify-center rounded-full sm:rounded-lg text-zinc-400 hover:text-red-650 hover:bg-red-50 border border-zinc-200 hover:border-red-200 transition-all shrink-0 ml-auto sm:ml-0 shadow-sm"
              title="刪除"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </ScrollIn>

      {/* Stats Summary */}
      <ScrollIn delay={0.1}>
        <div className="w-full glass-panel bg-white/95 border border-zinc-200 rounded-2xl p-5 space-y-4 transition-all duration-300 hover:bg-zinc-50 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
          <div 
            className="flex items-center justify-between cursor-pointer group"
            onClick={() => setIsStatsOpen(!isStatsOpen)}
          >
            <div className="flex items-center space-x-2 text-zinc-800">
              <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                <BarChart3 className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-base tracking-wide">庫存摘要</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-zinc-400 tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                {isStatsOpen ? '點擊收合' : '點擊展開'}
              </span>
              <div className="inline-flex items-center justify-center rounded-full h-8 w-8 bg-zinc-105 border border-zinc-200 text-zinc-500 group-hover:bg-zinc-100 transition-colors">
                <motion.div
                  animate={{ rotate: isStatsOpen ? 180 : 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
              </div>
            </div>
          </div>
          
          <AnimatePresence>
            {isStatsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="overflow-hidden"
              >
                <div className="pt-4 pb-1 border-t border-zinc-200/80 mt-2">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-1">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">持有數量</span>
                      <span className="text-xl font-bold text-zinc-800 tracking-tight">{stats.totalQuantity} <span className="text-[10px] font-normal text-zinc-400">股</span></span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">平均成本</span>
                      <span className="text-xl font-bold text-zinc-800 tracking-tight">${stats.averagePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">持有總成本</span>
                      <span className="text-xl font-bold text-zinc-800 tracking-tight">${(stats.averagePrice * stats.totalQuantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">已實現損益</span>
                      <span className={`text-xl font-bold tracking-tight ${stats.realizedPnL >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}`}>
                        ${stats.realizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {tab.status === 'COMPLETED' ? (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">最終損益</span>
                        <span className={`text-xl font-bold tracking-tight ${(tab.finalPnL || 0) >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}`}>
                          ${tab.finalPnL?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">未實現 {tab.currentPrice ? `(${tab.currentPrice})` : ''}</span>
                        <span className={`text-xl font-bold tracking-tight ${stats.unrealizedPnL >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}`}>
                          {stats.unrealizedPnL >= 0 ? '+' : ''}{stats.unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">交易次數</span>
                      <span className="text-xl font-bold text-zinc-800 tracking-tight">{trades.length} <span className="text-[10px] font-normal text-zinc-400">筆</span></span>
                    </div>
                  </div>

                  {/* 股價攤平與比例計算工具 */}
                  <div className="mt-6 pt-6 border-t border-zinc-200/80 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: 股價向下攤平試算 */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <div className="p-1 bg-emerald-50 text-emerald-700 rounded-md">
                          <span className="text-xs">📉</span>
                        </div>
                        <h4 className="font-bold text-sm tracking-wide text-zinc-800">股價向下攤平試算</h4>
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        輸入預計加碼的股價與數量，系統會實時估算攤平後的平均持有成本。
                      </p>

                      <div className="space-y-2 mt-2">
                        <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">
                          <span className="col-span-2 text-center">組別</span>
                          <span className="col-span-5">預計購入股價 ($)</span>
                          <span className="col-span-5">預計購入數量 (股)</span>
                        </div>

                        {averagingRows.map((row, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                            <span className="col-span-2 text-center text-xs text-zinc-400 font-bold">#{idx + 1}</span>
                            <div className="col-span-5 relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">$</span>
                              <Input
                                type="number"
                                placeholder="股價"
                                value={row.price}
                                onChange={(e) => {
                                  const newRows = [...averagingRows];
                                  newRows[idx].price = e.target.value;
                                  setAveragingRows(newRows);
                                }}
                                className="h-8 pl-6 pr-1 text-xs text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500"
                              />
                            </div>
                            <div className="col-span-5 flex items-center gap-1">
                              <Input
                                type="number"
                                placeholder="數量"
                                value={row.quantity}
                                onChange={(e) => {
                                  const newRows = [...averagingRows];
                                  newRows[idx].quantity = e.target.value;
                                  setAveragingRows(newRows);
                                }}
                                className="h-8 px-2 text-xs text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500"
                              />
                              <button
                                onClick={() => {
                                  const newRows = [...averagingRows];
                                  newRows[idx] = { price: '', quantity: '' };
                                  setAveragingRows(newRows);
                                }}
                                className="h-8 w-8 text-zinc-400 hover:text-red-650 hover:bg-zinc-100 rounded-md shrink-0 transition-colors flex items-center justify-center font-bold text-xs"
                                title="清除這組"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-zinc-600 font-medium">
                          <input
                            type="checkbox"
                            checked={includeCurrentHolding}
                            onChange={(e) => setIncludeCurrentHolding(e.target.checked)}
                            className="rounded border-zinc-300 text-[#0F6E56] focus:ring-[#0F6E56] h-3.5 w-3.5"
                          />
                          <span>包含當前庫存 ({stats.totalQuantity} 股 @ ${stats.averagePrice.toFixed(2)})</span>
                        </label>
                        <button
                          onClick={() => {
                            setAveragingRows([
                              { price: '', quantity: '' },
                              { price: '', quantity: '' },
                              { price: '', quantity: '' },
                              { price: '', quantity: '' },
                              { price: '', quantity: '' }
                            ]);
                          }}
                          className="text-[10px] font-bold text-zinc-400 hover:text-zinc-600 transition-colors self-end sm:self-auto"
                        >
                          ✕ 清除所有輸入
                        </button>
                      </div>

                      <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 space-y-2.5">
                        <div className="flex justify-between text-xs text-zinc-500">
                          <span>加碼購入總股數:</span>
                          <span className="font-bold font-mono text-zinc-800">{avgResult.newSharesSum} 股</span>
                        </div>
                        <div className="flex justify-between text-xs text-zinc-500">
                          <span>加碼所需資金:</span>
                          <span className="font-bold font-mono text-zinc-800">${avgResult.newCostSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="h-[0.5px] bg-zinc-200/80 my-1" />
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs font-semibold text-zinc-600">攤平後總股數:</span>
                          <span className="text-sm font-bold font-mono text-zinc-800">{avgResult.totalShares} 股</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs font-semibold text-zinc-600">攤平後平均成本:</span>
                          <span className="text-base font-black font-mono text-[#0F6E56]">
                            ${avgResult.finalAveragePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        {includeCurrentHolding && avgResult.costReducedPercent > 0 && (
                          <div className="text-[11px] text-emerald-700 font-semibold text-center bg-emerald-50/50 py-1.5 px-2.5 rounded-lg border border-emerald-100/50 mt-1">
                            📉 平均成本較原先降低了 {avgResult.costReducedPercent.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: 比例股價變動計算器 */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <div className="p-1 bg-emerald-50 text-emerald-700 rounded-md">
                          <span className="text-xs">🧮</span>
                        </div>
                        <h4 className="font-bold text-sm tracking-wide text-zinc-800">比例股價變動計算器</h4>
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        依據百分比增減計算目標價（例如：設定停損限價、獲利目標、滿足點）。
                      </p>

                      <div className="space-y-3.5">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">1. 算式計算（例: 56 - 7% 或 56 + 8%）</Label>
                          <div className="relative">
                            <Input
                              type="text"
                              placeholder="56 - 7% 或 56 + 8%"
                              value={calcExpression}
                              onChange={(e) => setCalcExpression(e.target.value)}
                              className="h-10 text-sm font-semibold tracking-wide text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500"
                            />
                            {calcExpression && (
                              <button 
                                onClick={() => {
                                  setCalcExpression('');
                                  setCalcBasePrice('');
                                  setCalcPercent('');
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-600 font-bold"
                              >
                                清除
                              </button>
                            )}
                          </div>

                          {/* Preset Buttons */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {['-10%', '-7%', '-5%', '-3%', '+3%', '+5%', '+8%', '+10%'].map((p) => {
                              const isNeg = p.startsWith('-');
                              return (
                                <button
                                  key={p}
                                  onClick={() => handlePresetClick(p)}
                                  className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all cursor-pointer ${
                                    isNeg 
                                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100/80 border border-rose-200/50' 
                                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 border border-emerald-200/50'
                                  }`}
                                >
                                  {p}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Structured adjustment */}
                        <div className="space-y-2 pt-3 border-t border-zinc-200/60">
                          <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">2. 數值微調與輔助設定</Label>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <span className="text-[9px] text-zinc-400 font-bold block mb-1">基準股價 ($)</span>
                              <Input
                                type="number"
                                value={calcBasePrice}
                                onChange={(e) => setCalcBasePrice(e.target.value)}
                                className="h-8 text-xs text-zinc-800 bg-white border-zinc-200"
                              />
                            </div>
                            <div>
                              <span className="text-[9px] text-zinc-400 font-bold block mb-1">運算符</span>
                              <div className="flex h-8 border border-zinc-200 rounded-md overflow-hidden bg-white">
                                <button
                                  onClick={() => setCalcType('SUB')}
                                  className={`flex-1 text-[10px] font-bold transition-all cursor-pointer ${calcType === 'SUB' ? 'bg-rose-500 text-white font-black' : 'text-zinc-500 hover:bg-zinc-50'}`}
                                >
                                  減 (-)
                                </button>
                                <button
                                  onClick={() => setCalcType('ADD')}
                                  className={`flex-1 text-[10px] font-bold transition-all cursor-pointer ${calcType === 'ADD' ? 'bg-emerald-600 text-white font-black' : 'text-zinc-500 hover:bg-zinc-50'}`}
                                >
                                  加 (+)
                                </button>
                              </div>
                            </div>
                            <div>
                              <span className="text-[9px] text-zinc-400 font-bold block mb-1">百分比 (%)</span>
                              <Input
                                type="number"
                                value={calcPercent}
                                placeholder="例 7"
                                onChange={(e) => setCalcPercent(e.target.value)}
                                className="h-8 text-xs text-zinc-800 bg-white border-zinc-200"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Display Area */}
                        <div className={`p-4 rounded-xl border flex flex-col justify-center transition-all ${parsedCalc.success ? 'bg-emerald-50/30 border-emerald-100/60' : 'bg-zinc-50 border-zinc-150'} min-h-[78px]`}>
                          {parsedCalc.success && parsedCalc.result !== undefined ? (
                            <div className="text-center">
                              <div className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase mb-0.5">計算結果</div>
                              <div className="text-2xl font-black text-[#0F6E56] font-mono tracking-tight leading-none py-1">
                                ${parsedCalc.result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              {parsedCalc.percent !== 0 && (
                                <div className="text-[10px] text-zinc-500 font-medium mt-1">
                                  以 <span className="font-semibold text-zinc-800">${parsedCalc.base?.toFixed(2)}</span> 為基準，{parsedCalc.isAdd ? '增加' : '減少'} <span className="font-black text-zinc-700">{parsedCalc.percent}%</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center text-xs text-zinc-400 font-medium leading-relaxed">
                              請於上方直接輸入（如 <span className="font-mono">56 - 7%</span> 或 <span className="font-mono">56 + 8%</span>）<br/>或點擊快捷按鈕。
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollIn>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full bg-zinc-100 border border-zinc-200 p-1 rounded-xl gap-1 shadow-sm">
            <TabsTrigger value="trades" className="flex-1 py-2 text-xs font-black rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-md text-zinc-700 hover:text-black transition-all cursor-pointer">交易紀錄</TabsTrigger>
            <TabsTrigger value="strategy" className="flex-1 py-2 text-xs font-black rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-md text-zinc-700 hover:text-black transition-all cursor-pointer">策略計畫</TabsTrigger>
            <TabsTrigger value="chips" className="flex-1 py-2 text-xs font-black rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-md text-zinc-700 hover:text-black transition-all cursor-pointer">主力與籌碼分析</TabsTrigger>
          </TabsList>

        <TabsContent value="trades" className="pt-4 space-y-4 pb-20 outline-none">
           {/* Trades Content */}
           <div className="flex justify-between items-center border-b border-zinc-200 pb-2 mb-4">
             <div className="flex flex-wrap items-center gap-2">
               <div className="flex items-center gap-3 flex-wrap">
                 <div className="flex items-center gap-2 flex-wrap">
                   <h2 className="text-xl font-bold tracking-tight text-zinc-800">交易紀錄</h2>
                   <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap">
                     <span>已持有:</span>
                     <span className="font-mono font-black text-zinc-800">{stats.totalQuantity}</span>
                     <span>股</span>
                   </span>
                 </div>
                 {plannedQty > 0 && (
                   <span className="text-xs font-bold bg-[#B1C28D]/20 text-[#6F7D50] border border-[#B1C28D]/40 px-2.5 py-1 rounded-full flex items-center gap-2 shadow-sm">
                     <span className="w-1.5 h-1.5 rounded-full bg-[#6F7D50] animate-pulse" />
                     剩餘預計購買: <span className="font-mono font-black">{remainingToBuy}</span> 股
                     <span className="opacity-40">|</span>
                     當前順序: <span className="font-semibold text-zinc-800">{currentBatchOrderText}</span> ({currentBatchText})
                   </span>
                 )}
               </div>
               <Badge className="bg-emerald-50 text-emerald-700 border border-zinc-150 text-[10px] py-1 px-2.5 font-bold whitespace-nowrap shadow-sm">{trades.length} 筆</Badge>
               
               <input
                 type="file"
                 accept="application/json"
                 className="hidden"
                 ref={tradesJsonFileInputRef}
                 onChange={handleImportTradesJson}
               />
               <button
                 type="button"
                 onClick={handleExportTradesJson}
                 className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 transition-all text-[10px] font-bold ml-1 border shadow-xs"
               >
                 <Download className="w-3 h-3" />
                 匯出Json
               </button>
               <button
                 type="button"
                 onClick={() => tradesJsonFileInputRef.current?.click()}
                 className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-all text-[10px] font-bold border shadow-xs"
               >
                 <Upload className="w-3 h-3" />
                 匯入Json
               </button>
             </div>
             <Dialog open={isTradeOpen} onOpenChange={setIsTradeOpen}>
               <DialogTrigger 
                  render={
                    <button 
                      disabled={tab.status === 'COMPLETED'} 
                      className="h-8 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-4 text-xs font-bold rounded-lg whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                    >
                      新增交易
                    </button>
                  } 
                />
               <DialogContent className="glass-panel border-zinc-200 shadow-2xl bg-white text-zinc-800">
                 <DialogHeader><DialogTitle className="font-bold text-2xl tracking-tight text-zinc-800 mb-2">新增交易紀錄</DialogTitle></DialogHeader>
                 <form onSubmit={handleTradeSubmit} className="space-y-6">
                   <div className="grid grid-cols-2 gap-5">
                     <div className="space-y-2">
                       <Label className="font-bold text-zinc-500">交易方向</Label>
                       <div className="flex gap-3">
                         <Select value={tradeForm.type} onValueChange={(val) => setTradeForm({...tradeForm, type: val})}>
                           <SelectTrigger className="flex-1 bg-white border-zinc-200 text-zinc-800"><SelectValue/></SelectTrigger>
                           <SelectContent className="glass-panel border-zinc-200 text-zinc-800 bg-white shadow-lg">
                             <SelectItem value="BUY" className="font-bold text-emerald-700 focus:bg-zinc-100 focus:text-emerald-700">BUY</SelectItem>
                             <SelectItem value="SELL" className="font-bold text-rose-650 focus:bg-zinc-100 focus:text-rose-655">SELL</SelectItem>
                           </SelectContent>
                         </Select>
                         <Select value={tradeForm.purpose} onValueChange={(val) => setTradeForm({...tradeForm, purpose: val})}>
                           <SelectTrigger className="flex-1 bg-white border border-zinc-200 text-zinc-800"><SelectValue/></SelectTrigger>
                           <SelectContent className="glass-panel border border-zinc-200 text-zinc-800 bg-white shadow-lg">
                             <SelectItem value="加碼" className="font-medium focus:bg-zinc-100 focus:text-zinc-800">加碼</SelectItem>
                             <SelectItem value="平倉" className="font-medium focus:bg-zinc-100 focus:text-zinc-800">平倉</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                     </div>
                     <div className="space-y-2">
                       <Label className="font-bold text-zinc-500">日期</Label>
                       <Input type="date" className="bg-white border-zinc-200 text-zinc-800 focus-visible:ring-emerald-500/55" required value={tradeForm.tradeDate} onChange={e => setTradeForm({...tradeForm, tradeDate: e.target.value})} />
                     </div>
                     <div className="space-y-2">
                       <Label className="font-bold text-zinc-500">價格</Label>
                       <Input type="number" step="0.01" className="bg-white border-zinc-200 text-zinc-800 focus-visible:ring-emerald-500/55" required value={tradeForm.price} onChange={e => setTradeForm({...tradeForm, price: e.target.value})} />
                     </div>
                     <div className="space-y-2">
                       <Label className="font-bold text-zinc-500">數量</Label>
                       <Input type="number" step="0.01" className="bg-white border-zinc-200 text-zinc-800 focus-visible:ring-emerald-500/55" required value={tradeForm.quantity} onChange={e => setTradeForm({...tradeForm, quantity: e.target.value})} />
                     </div>
                     <div className="space-y-2">
                       <Label className="font-bold text-zinc-500">操作員</Label>
                       <Select value={tradeForm.operator} onValueChange={(val) => setTradeForm({...tradeForm, operator: val})}>
                         <SelectTrigger className="w-full bg-white border-zinc-200 text-zinc-800"><SelectValue/></SelectTrigger>
                         <SelectContent className="glass-panel border-zinc-200 text-zinc-800 bg-white shadow-lg border">
                           <SelectItem value="人" className="font-medium focus:bg-zinc-100 focus:text-zinc-800">人</SelectItem>
                           <SelectItem value="機器" className="font-bold text-rose-650 focus:bg-zinc-100 focus:text-rose-655">機器</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                     <div className="space-y-2">
                       <Label className="font-bold text-zinc-500">手續費 (選填)</Label>
                       <Input type="number" step="0.01" className="bg-white border-zinc-200 text-zinc-800" value={tradeForm.fees} onChange={e => setTradeForm({...tradeForm, fees: e.target.value})} />
                     </div>
                     <div className="space-y-2 col-span-2">
                       <Label className="font-bold text-zinc-500">備註 (選填)</Label>
                       <Input className="bg-white border-zinc-200 text-zinc-800 focus-visible:ring-emerald-500/50" value={tradeForm.notes} onChange={e => setTradeForm({...tradeForm, notes: e.target.value})} />
                     </div>
                   </div>
                   <DialogFooter className="pt-4">
                     <button type="submit" className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-8 py-2.5 font-bold rounded-xl w-full sm:w-auto transition-all shadow-sm">
                       儲存交易
                     </button>
                   </DialogFooter>
                 </form>
               </DialogContent>
             </Dialog>
           </div>

           <ScrollIn delay={0.2}>
              <div className="flex flex-col bg-white border border-zinc-200 rounded-2xl relative transition-all duration-300 hover:shadow-lg shadow-sm z-10 overflow-hidden">
                <div 
                   onClick={() => setIsTradeListOpen(!isTradeListOpen)}
                   className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors group"
                 >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
                    <div className="flex items-center gap-4">
                      <Magnetic>
                       <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-500 group-hover:text-zinc-800 transition-colors">
                         <BarChart3 className="h-5 w-5" />
                       </div>
                      </Magnetic>
                      <div>
                        <h3 className="font-bold text-lg text-zinc-800">紀錄列表</h3>
                        <p className="text-xs font-semibold text-zinc-500 mt-1">
                          共有 {trades.length} 筆交易紀錄
                        </p>
                      </div>
                    </div>

                    {/* Input box for plannedBuyQty */}
                    <div 
                      className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-xl self-start sm:self-auto shadow-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="text-xs font-bold text-zinc-500 whitespace-nowrap">預計購買數量:</label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="請輸入數量"
                        className="w-24 h-8 bg-white border border-zinc-250 text-zinc-800 font-mono font-bold text-center text-xs focus-visible:ring-emerald-500/55 rounded-lg p-1 shadow-inner"
                        value={plannedBuyQtyInput}
                        onChange={(e) => handlePlannedBuyQtyChange(e.target.value)}
                      />
                    </div>
                  </div>

                  {plannedQty > 0 && (
                    <div 
                      className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 flex-1 max-w-lg w-full lg:ml-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {[
                        { 
                          name: "第一批 (15%)", 
                          size: size1, 
                          bought: bought1, 
                          remaining: remaining1, 
                          color: "border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:bg-emerald-100/70",
                          numColor: "text-emerald-700"
                        },
                        { 
                          name: "第二批 (25%)", 
                          size: size2, 
                          bought: bought2, 
                          remaining: remaining2, 
                          color: "border-sky-200 bg-sky-50 hover:border-sky-300 hover:bg-sky-100/70",
                          numColor: "text-sky-700"
                        },
                        { 
                          name: "第三批 (35%)", 
                          size: size3, 
                          bought: bought3, 
                          remaining: remaining3, 
                          color: "border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-amber-100/70",
                          numColor: "text-amber-700"
                        },
                        { 
                          name: "第四批 (25%)", 
                          size: size4, 
                          bought: bought4, 
                          remaining: remaining4, 
                          color: "border-fuchsia-200 bg-fuchsia-50 hover:border-fuchsia-300 hover:bg-fuchsia-100/70",
                          numColor: "text-fuchsia-700"
                        },
                      ].map((b, idx) => {
                        const isFinished = b.remaining === 0;
                        return (
                          <div 
                            key={idx} 
                            className={`p-1.5 border rounded-lg flex flex-col justify-between text-center relative transition-all duration-300 hover:scale-[1.02] ${b.color} ${isFinished ? 'opacity-70' : 'opacity-100 font-bold'}`}
                          >
                            <span className="text-[9px] font-bold text-zinc-650 uppercase tracking-wider leading-none mb-0.5">{b.name}</span>
                            <span className="text-xs font-black font-mono text-zinc-800 leading-tight">{b.size} 股</span>
                            <div className="flex items-center justify-around text-[9px] mt-1 pt-1 border-t border-zinc-200/60 opacity-90 font-medium font-sans">
                              <div className="flex flex-col items-center">
                                <span className="text-zinc-500 font-bold text-[7.5px] scale-90 leading-none">已購</span>
                                <span className="font-mono font-bold mt-0.5 text-zinc-400">{b.bought}</span>
                              </div>
                              <div className="bg-zinc-200/70 w-[1px] h-3.5 self-center" />
                              <div className="flex flex-col items-center">
                                <span className="text-zinc-500 font-bold text-[7.5px] scale-90 leading-none">餘額</span>
                                <span className={`font-mono font-bold mt-0.5 ${b.numColor}`}>{b.remaining}</span>
                              </div>
                            </div>
                            {isFinished && (
                              <span className="absolute -top-1 -right-1 bg-emerald-600 text-white rounded-full text-[8px] px-1 py-0.5 font-bold shadow-md border border-white animate-pulse leading-none">滿</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-3 justify-end self-end lg:self-auto">
                    <span className="text-xs font-semibold text-zinc-400 tracking-widest opacity-0 lg:group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {isTradeListOpen ? '收合明細' : '展開明細'}
                    </span>
                    <motion.div
                      animate={{ rotate: isTradeListOpen ? 180 : 0 }}
                      className="h-8 w-8 rounded-full border border-zinc-200 bg-zinc-50 flex items-center justify-center text-zinc-500 group-hover:bg-zinc-100 transition-colors"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </motion.div>
                  </div>
                </div>
                
                <AnimatePresence>
                 {isTradeListOpen && (
                   <motion.div
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: "auto", opacity: 1 }}
                     exit={{ height: 0, opacity: 0 }}
                     transition={{ type: "spring", stiffness: 300, damping: 30 }}
                     className="overflow-hidden border-t border-zinc-150 bg-zinc-50/20"
                   >
                     <div className="p-0 bg-transparent overflow-x-auto">
                       <table className="w-full text-sm text-left">
                         <thead className="text-xs text-zinc-500 bg-zinc-100 uppercase tracking-widest border-b border-zinc-200 font-bold">
                           <tr>
                             <th className="px-6 py-4 font-semibold">日期</th>
                             <th className="px-6 py-4 font-semibold">方向</th>
                             <th className="px-6 py-4 font-semibold">價格</th>
                             <th className="px-6 py-4 font-semibold">數量</th>
                             <th className="px-6 py-4 font-semibold">總計</th>
                             <th className="px-6 py-4 text-right font-semibold">操作</th>
                           </tr>
                         </thead>
                         <motion.tbody layout>
                           {trades.length === 0 ? (
                             <tr><td colSpan={6} className="px-6 py-12 text-center text-zinc-400 font-medium bg-white">暫無交易紀錄</td></tr>
                           ) : (
                             trades.map(t => (
                               <motion.tr 
                                 key={t.id} 
                                 layout
                                 initial={{ opacity: 0 }}
                                 animate={{ opacity: 1 }}
                                 exit={{ opacity: 0 }}
                                 className="border-b border-zinc-150 last:border-0 hover:bg-zinc-50/50 transition-colors text-zinc-800 font-semibold bg-white"
                               >
                                 <td className="px-6 py-4 whitespace-nowrap">{t.tradeDate?.toDate() ? format(t.tradeDate.toDate(), 'yyyy/MM/dd') : ''}</td>
                                 <td className="px-6 py-4">
                                   <div className="flex flex-col gap-1.5 items-start">
                                     <div className="flex items-center gap-1.5">
                                       <span className={`px-2 py-0.5 text-[10px] tracking-wider rounded-md font-bold ${t.type === 'BUY' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                         {t.type}
                                       </span>
                                       {t.operator === '機器' && (
                                         <span className="text-[10px] font-bold text-red-500 px-1 py-0.5 rounded border border-red-500/20 bg-red-500/10">機器</span>
                                       )}
                                       {t.operator === '人' && (
                                         <span className="text-[10px] font-bold text-zinc-500 px-1 py-0.5 rounded border border-zinc-200 bg-zinc-50">人</span>
                                       )}
                                     </div>
                                     {t.purpose && (
                                       <span className="text-[10px] text-center font-semibold text-zinc-650 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded-sm">
                                         {t.purpose}
                                       </span>
                                     )}
                                   </div>
                                 </td>
                                 <td className="px-6 py-4 whitespace-nowrap">${t.price}</td>
                                 <td className="px-6 py-4 whitespace-nowrap">{t.quantity}</td>
                                 <td className="px-6 py-4 whitespace-nowrap text-zinc-700">${(t.price * t.quantity).toFixed(2)}</td>
                                 <td className="px-6 py-4 text-right">
                                   <button 
                                      onClick={() => deleteTrade(t.id)} 
                                      className="text-rose-650 hover:text-rose-700 py-1.5 px-3 font-semibold rounded-lg hover:bg-rose-500/10 transition-colors"
                                    >
                                     刪除
                                   </button>
                                 </td>
                               </motion.tr>
                             ))
                           )}
                         </motion.tbody>
                       </table>
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>
             </div>
           </ScrollIn>
        </TabsContent>

        <TabsContent value="strategy" className="pt-4">
           {id && <StrategyTab tabId={id} readOnly={false} />}
        </TabsContent>



        <TabsContent value="chips" className="pt-4">
           {id && <ChipAnalysisTab tabId={id} symbol={tab?.symbol || ''} />}
        </TabsContent>
        


      </Tabs>
    </div>
  );
}
