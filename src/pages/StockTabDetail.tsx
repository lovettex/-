import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStockTabs } from '../hooks/useStockTabs';
import { playClickSound, playSuccessSound, playPriceImportSound } from '../lib/audio';
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
import { Timestamp, collection, writeBatch, doc, serverTimestamp, addDoc, getDocs } from 'firebase/firestore';
import { Trash2, BarChart3, ChevronDown, ChevronUp, Gamepad2, ShieldCheck, Upload, Download, ChevronLeft, CheckCircle2, RotateCcw, Loader2, HelpCircle, AlertTriangle, Save, Calculator, History } from 'lucide-react';
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
  const [isSubmittingComplete, setIsSubmittingComplete] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(true); 
  const [isAveragingHelpOpen, setIsAveragingHelpOpen] = useState(false);
  const [isTradeListOpen, setIsTradeListOpen] = useState(true);
  const [chipsSubTab, setChipsSubTab] = useState<'calc' | 'trades'>('calc');
  const [finalPnLInput, setFinalPnLInput] = useState('');
  const [activeTab, setActiveTab] = useState('trades');
  const isInitialActiveTabMount = React.useRef(true);
  React.useEffect(() => {
    if (isInitialActiveTabMount.current) {
      isInitialActiveTabMount.current = false;
    } else {
      playClickSound();
    }
  }, [activeTab]);
  const [currentPriceInput, setCurrentPriceInput] = useState('');
  const [plannedBuyQtyInput, setPlannedBuyQtyInput] = useState<string>('');
  const [stopLossInput, setStopLossInput] = useState<string>('');
  const [takeProfitInput, setTakeProfitInput] = useState<string>('');
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [tempPrice, setTempPrice] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const tradesJsonFileInputRef = React.useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  // 4 rows for stock averaging (System 1: -3%, -6%, -9%, -12%)
  const [averagingRows, setAveragingRows] = useState<{ price: string; quantity: string; bought?: boolean; riskFlag?: boolean }[]>([
    { price: '', quantity: '', bought: false, riskFlag: false },
    { price: '', quantity: '', bought: false, riskFlag: false },
    { price: '', quantity: '', bought: false, riskFlag: false },
    { price: '', quantity: '', bought: false, riskFlag: false }
  ]);
  // 4 rows for stock averaging (System 2: -2%, -4%, -6%, -8%)
  const [averagingRowsSys2, setAveragingRowsSys2] = useState<{ price: string; quantity: string; bought?: boolean; riskFlag?: boolean }[]>([
    { price: '', quantity: '', bought: false, riskFlag: false },
    { price: '', quantity: '', bought: false, riskFlag: false },
    { price: '', quantity: '', bought: false, riskFlag: false },
    { price: '', quantity: '', bought: false, riskFlag: false }
  ]);
  const [includeCurrentHolding, setIncludeCurrentHolding] = useState(true);
  const [refPnLPoint, setRefPnLPoint] = useState('');
  const [refPnLPointSys2, setRefPnLPointSys2] = useState('');

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

  // Update stopLossInput when tab data loads or changes
  React.useEffect(() => {
    if (tab?.stopLossPrice !== undefined && tab?.stopLossPrice !== null) {
      setStopLossInput(tab.stopLossPrice ? tab.stopLossPrice.toString() : '');
    } else {
      setStopLossInput('');
    }
  }, [tab?.id, tab?.stopLossPrice]);

  // Update takeProfitInput when tab data loads or changes
  React.useEffect(() => {
    if (tab?.takeProfitPrice !== undefined && tab?.takeProfitPrice !== null) {
      setTakeProfitInput(tab.takeProfitPrice ? tab.takeProfitPrice.toString() : '');
    } else {
      setTakeProfitInput('');
    }
  }, [tab?.id, tab?.takeProfitPrice]);

  // Update averaging rows & settings when tab loads
  React.useEffect(() => {
    if (tab) {
      if (tab.averagingRows && Array.isArray(tab.averagingRows)) {
        const normalized = [0, 1, 2, 3].map(i => {
          const row = tab.averagingRows?.[i];
          return {
            price: row?.price ?? '',
            quantity: row?.quantity ?? '',
            bought: !!row?.bought,
            riskFlag: !!row?.riskFlag
          };
        });
        setAveragingRows(normalized);
      }
      if (tab.averagingRowsSys2 && Array.isArray(tab.averagingRowsSys2)) {
        const normalized2 = [0, 1, 2, 3].map(i => {
          const row = tab.averagingRowsSys2?.[i];
          return {
            price: row?.price ?? '',
            quantity: row?.quantity ?? '',
            bought: !!row?.bought,
            riskFlag: !!row?.riskFlag
          };
        });
        setAveragingRowsSys2(normalized2);
      }
      if (tab.refPnLPoint !== undefined) {
        setRefPnLPoint(tab.refPnLPoint ? tab.refPnLPoint.toString() : '');
      }
      if (tab.refPnLPointSys2 !== undefined) {
        setRefPnLPointSys2(tab.refPnLPointSys2 ? tab.refPnLPointSys2.toString() : '');
      }
      if (tab.includeCurrentHolding !== undefined) {
        setIncludeCurrentHolding(tab.includeCurrentHolding);
      }
    }
  }, [tab?.id]);

  const [isSavingAveraging, setIsSavingAveraging] = useState(false);

  const handleSaveAveraging = async () => {
    if (!tab) return;
    setIsSavingAveraging(true);
    try {
      await updateTab(tab.id, {
        averagingRows,
        refPnLPoint,
        includeCurrentHolding,
        averagingRowsSys2,
        refPnLPointSys2,
      });
      playSuccessSound();
      toast.success('向下攤平試算內容（系統一與系統二）已成功儲存！');
    } catch (error) {
      toast.error('儲存失敗，請稍後再試');
    } finally {
      setIsSavingAveraging(false);
    }
  };

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

  const handleStopLossChange = async (val: string) => {
    setStopLossInput(val);
    const parsed = parseFloat(val);
    if (tab) {
      if (!isNaN(parsed) && parsed >= 0) {
        await updateTab(tab.id, { stopLossPrice: parsed });
      } else if (val === '') {
        await updateTab(tab.id, { stopLossPrice: 0 });
      }
    }
  };

  const handleTakeProfitChange = async (val: string) => {
    setTakeProfitInput(val);
    const parsed = parseFloat(val);
    if (tab) {
      if (!isNaN(parsed) && parsed >= 0) {
        await updateTab(tab.id, { takeProfitPrice: parsed });
      } else if (val === '') {
        await updateTab(tab.id, { takeProfitPrice: 0 });
      }
    }
  };

  // Update preferredHoldingSubTab when tab changes so dashboard goes back to the right tab
  React.useEffect(() => {
    if (id) {
      safeSessionStorage.setItem('lastViewedStockId', id);
    }
    if (tab?.holdingStatus) {
       const displayStatus = ['觀察中', '買進操作', '賣出操作', '平倉操作', '乖離名單'].includes(tab.holdingStatus) ? tab.holdingStatus : '候選名單';
       safeSessionStorage.setItem('preferredHoldingSubTab', displayStatus);
    }
  }, [id, tab?.holdingStatus]);

  // Keyboard shortcut handle (Shift + B) to go back to dashboard
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toUpperCase() === 'B' && !e.ctrlKey && !e.metaKey) {
        // Only trigger if not in an input/textarea
        const activeEl = document.activeElement;
        const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
        
        if (!isInput) {
          e.preventDefault();
          navigate('/', { state: { autoFlipTabId: id, returnStockId: id } });
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [navigate, id]);

  const stats = calculateStats(trades, tab?.currentPrice);
  const prevTabIdRef = React.useRef<string | null>(null);

  // Prefill percentage calculator base price & refPnLPoint when data loaded
  React.useEffect(() => {
    if (tab && stats) {
      const avgPrice = stats.averagePrice && stats.averagePrice > 0 ? stats.averagePrice : 0;
      const curPrice = tab.currentPrice && tab.currentPrice > 0 ? tab.currentPrice : 0;
      const baseVal = avgPrice > 0 ? avgPrice : curPrice;

      const isNewTab = prevTabIdRef.current !== tab.id;
      if (isNewTab) {
        prevTabIdRef.current = tab.id;
        if (baseVal > 0) {
          setCalcBasePrice(baseVal.toFixed(2));
          setCalcPercent('3');
          setCalcType('SUB');
        } else {
          setCalcBasePrice('');
          setCalcPercent('3');
          setCalcType('SUB');
        }
        if (curPrice > 0) {
          if (!tab.refPnLPoint) {
            setRefPnLPoint(curPrice.toFixed(2));
          }
          if (!tab.refPnLPointSys2) {
            setRefPnLPointSys2(curPrice.toFixed(2));
          }
        } else {
          if (!tab.refPnLPoint) setRefPnLPoint('');
          if (!tab.refPnLPointSys2) setRefPnLPointSys2('');
        }
      } else {
        if (baseVal > 0 && !calcBasePrice) {
          setCalcBasePrice(baseVal.toFixed(2));
          setCalcPercent('3');
          setCalcType('SUB');
        }
        if (curPrice > 0 && !refPnLPoint) {
          setRefPnLPoint(curPrice.toFixed(2));
        }
        if (curPrice > 0 && !refPnLPointSys2) {
          setRefPnLPointSys2(curPrice.toFixed(2));
        }
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

  const parsedCalc = parseAndCalculatePercentage(calcExpression);

  // Automatically fill calculation result into averagingRows[0].price and averagingRowsSys2[0].price
  React.useEffect(() => {
    if (parsedCalc.success && typeof parsedCalc.result === 'number' && !isNaN(parsedCalc.result) && parsedCalc.result > 0) {
      const formattedResult = parsedCalc.result.toFixed(2);
      setAveragingRows((prevRows) => {
        if (prevRows[0].price === formattedResult) return prevRows;
        const newRows = [...prevRows];
        newRows[0] = { ...newRows[0], price: formattedResult };
        return newRows;
      });
      setAveragingRowsSys2((prevRows) => {
        if (prevRows[0].price === formattedResult) return prevRows;
        const newRows = [...prevRows];
        newRows[0] = { ...newRows[0], price: formattedResult };
        return newRows;
      });
    }
  }, [parsedCalc.success, parsedCalc.result]);

  if (!tab) return <div className="text-slate-500">找不到該股票分頁，或已被刪除。</div>;

  const handlePresetClick = (p: string) => {
    const avgPrice = stats?.averagePrice && stats.averagePrice > 0 ? stats.averagePrice : 0;
    const curPrice = tab?.currentPrice && tab.currentPrice > 0 ? tab.currentPrice : 0;
    const base = parseFloat(calcBasePrice) || avgPrice || curPrice || 0;
    if (base > 0) {
      const isNeg = p.startsWith('-');
      const val = p.replace(/[\+\-%]/g, '');
      setCalcType(isNeg ? 'SUB' : 'ADD');
      setCalcPercent(val);
      setCalcBasePrice(base.toFixed(2));
    }
  };

  // Calculation of stock averaging for System 1 (-3%, -6%, -9%, -12%)
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

  // Calculation of stock averaging for System 2 (-2%, -4%, -6%, -8%)
  const calculateAveragingSys2 = () => {
    let newSharesSum = 0;
    let newCostSum = 0;

    averagingRowsSys2.forEach(row => {
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
  const parsedRefPnL = parseFloat(refPnLPoint);
  const hasRefPnL = refPnLPoint.trim() !== '' && !isNaN(parsedRefPnL);
  const calculatedPnLResult = hasRefPnL
    ? (avgResult.finalAveragePrice - parsedRefPnL) * avgResult.totalShares
    : null;

  const avgResultSys2 = calculateAveragingSys2();
  const parsedRefPnLSys2 = parseFloat(refPnLPointSys2);
  const hasRefPnLSys2 = refPnLPointSys2.trim() !== '' && !isNaN(parsedRefPnLSys2);
  const calculatedPnLResultSys2 = hasRefPnLSys2
    ? (avgResultSys2.finalAveragePrice - parsedRefPnLSys2) * avgResultSys2.totalShares
    : null;

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
  let currentBatchBought = 0;
  let currentBatchRemaining = 0;
  if (plannedQty <= 0) {
    currentBatchText = "未規劃預計購買";
    currentBatchOrderText = "無";
    currentBatchBought = 0;
    currentBatchRemaining = 0;
  } else if (totalBought < size1) {
    currentBatchText = "第 1 批進場中";
    currentBatchOrderText = "第一批";
    currentBatchBought = bought1;
    currentBatchRemaining = remaining1;
  } else if (totalBought < (size1 + size2)) {
    currentBatchText = "第 2 批進場中";
    currentBatchOrderText = "第二批";
    currentBatchBought = bought2;
    currentBatchRemaining = remaining2;
  } else if (totalBought < (size1 + size2 + size3)) {
    currentBatchText = "第 3 批進場中";
    currentBatchOrderText = "第三批";
    currentBatchBought = bought3;
    currentBatchRemaining = remaining3;
  } else if (totalBought < (size1 + size2 + size3 + size4)) {
    currentBatchText = "第 4 批進場中";
    currentBatchOrderText = "第四批";
    currentBatchBought = bought4;
    currentBatchRemaining = remaining4;
  } else {
    currentBatchText = "已滿批進場 (已完成)";
    currentBatchOrderText = "已滿批";
    currentBatchBought = size1 + size2 + size3 + size4;
    currentBatchRemaining = 0;
  }

  const handleBatchClick = (batchIndex: number, batchName: string, batchSize: number) => {
    if (!batchSize || batchSize <= 0) {
      toast.error('請先輸入有效的預計購買數量');
      return;
    }
    playClickSound();
    const halfQty = Math.ceil(batchSize / 2);
    const basePrice = (stats?.averagePrice && stats.averagePrice > 0)
      ? stats.averagePrice
      : (tab?.currentPrice && tab.currentPrice > 0 ? tab.currentPrice : 0);

    if (batchIndex === 0 || batchIndex === 1) {
      // 第一批 or 第二批 -> Fill System 1 Row #1 (-3%) & Row #2 (-6%), System 2 Row #1 (-2%) & Row #2 (-4%)
      const price3 = basePrice > 0 ? (basePrice * 0.97).toFixed(2) : '';
      const price6 = basePrice > 0 ? (basePrice * 0.94).toFixed(2) : '';
      setAveragingRows(prev => {
        const next = [...prev];
        next[0] = { ...next[0], price: price3, quantity: halfQty.toString() };
        next[1] = { ...next[1], price: price6, quantity: halfQty.toString() };
        return next;
      });

      const price2 = basePrice > 0 ? (basePrice * 0.98).toFixed(2) : '';
      const price4 = basePrice > 0 ? (basePrice * 0.96).toFixed(2) : '';
      setAveragingRowsSys2(prev => {
        const next = [...prev];
        next[0] = { ...next[0], price: price2, quantity: halfQty.toString() };
        next[1] = { ...next[1], price: price4, quantity: halfQty.toString() };
        return next;
      });

      toast.success(`已將 ${batchName} 股數 (${batchSize}股) 平分 (${halfQty}股) 帶入系統一 (-3%/-6%) 與系統二 (-2%/-4%)`);
    } else if (batchIndex === 2 || batchIndex === 3) {
      // 第三批 or 第四批 -> Fill System 1 Row #3 (-9%) & Row #4 (-12%), System 2 Row #3 (-6%) & Row #4 (-8%)
      const price9 = basePrice > 0 ? (basePrice * 0.91).toFixed(2) : '';
      const price12 = basePrice > 0 ? (basePrice * 0.88).toFixed(2) : '';
      setAveragingRows(prev => {
        const next = [...prev];
        next[2] = { ...next[2], price: price9, quantity: halfQty.toString() };
        next[3] = { ...next[3], price: price12, quantity: halfQty.toString() };
        return next;
      });

      const price6_2 = basePrice > 0 ? (basePrice * 0.94).toFixed(2) : '';
      const price8 = basePrice > 0 ? (basePrice * 0.92).toFixed(2) : '';
      setAveragingRowsSys2(prev => {
        const next = [...prev];
        next[2] = { ...next[2], price: price6_2, quantity: halfQty.toString() };
        next[3] = { ...next[3], price: price8, quantity: halfQty.toString() };
        return next;
      });

      toast.success(`已將 ${batchName} 股數 (${batchSize}股) 平分 (${halfQty}股) 帶入系統一 (-9%/-12%) 與系統二 (-6%/-8%)`);
    }
  };

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
      playPriceImportSound();
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
    playSuccessSound();
    setTradeForm({ ...tradeForm, price: '', quantity: '', fees: '', notes: '' });
    setIsTradeOpen(false);
  };

  const handleCompleteAndClose = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!tab) return;
    const pnlVal = Number(finalPnLInput) || 0;
    try {
      setIsSubmittingComplete(true);
      await updateTabStatus(tab.id, 'COMPLETED', pnlVal);
      playSuccessSound();
      setIsCompleteOpen(false);
      toast.success('已完成交易結算，紀錄已移至「已完成」頁籤');
    } catch (err) {
      console.error(err);
      toast.error('完成交易失敗');
    } finally {
      setIsSubmittingComplete(false);
    }
  };

  const handleCompleteAndContinue = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!tab || !user) return;
    const pnlVal = Number(finalPnLInput) || 0;
    try {
      setIsSubmittingComplete(true);
      const { id: _, createdAt, updatedAt, ...restTab } = tab;

      // 1. Create snapshot record in stockTabs with status = 'COMPLETED'
      const newDocRef = await addDoc(collection(db, 'stockTabs'), {
        ...restTab,
        userId: user.uid,
        status: 'COMPLETED',
        finalPnL: pnlVal,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. Copy current trades to the completed snapshot tab
      try {
        const tradesQuery = await getDocs(collection(db, `stockTabs/${tab.id}/trades`));
        for (const tradeDoc of tradesQuery.docs) {
          const tradeData = tradeDoc.data();
          await addDoc(collection(db, `stockTabs/${newDocRef.id}/trades`), tradeData);
        }
      } catch (tradeErr) {
        console.error('Error copying trades to completed tab snapshot:', tradeErr);
      }

      playSuccessSound();
      setIsCompleteOpen(false);
      setFinalPnLInput('');
      toast.success(`已為 ${tab.symbol} 產生一筆已完成交易紀錄，卡片保留在原區塊繼續交易 🚀`);
    } catch (err) {
      console.error(err);
      toast.error('結算並繼續交易失敗');
    } finally {
      setIsSubmittingComplete(false);
    }
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
          onClick={() => navigate('/', { state: { autoFlipTabId: id, returnStockId: id } })}
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

              {/* Mobile Only: Current Price, Avg Cost & Total Shares */}
              <div className="flex sm:hidden flex-row gap-3.5 shrink-0 text-right mt-0.5">
                {isEditingPrice ? (
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest leading-tight">現在價格</span>
                    <Input
                      type="number"
                      step="any"
                      autoFocus
                      className="h-6 w-20 text-xs font-bold text-zinc-800 bg-white border-emerald-500 p-1 mt-0.5 text-right"
                      value={tempPrice}
                      onChange={(e) => setTempPrice(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseFloat(tempPrice);
                          if (!isNaN(val) && val >= 0) {
                            updateCurrentPrice(tab.id, val);
                          }
                          setIsEditingPrice(false);
                        } else if (e.key === 'Escape') {
                          setIsEditingPrice(false);
                        }
                      }}
                      onBlur={() => {
                        const val = parseFloat(tempPrice);
                        if (!isNaN(val) && val >= 0) {
                          updateCurrentPrice(tab.id, val);
                        }
                        setIsEditingPrice(false);
                      }}
                    />
                  </div>
                ) : (
                  <div 
                    className="flex flex-col cursor-pointer"
                    onClick={() => {
                      setTempPrice(tab.currentPrice?.toString() || '');
                      setIsEditingPrice(true);
                    }}
                  >
                    <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest leading-tight">現在價格</span>
                    <span className="text-base font-bold text-emerald-700 tracking-tight leading-none mt-0.5">${(tab.currentPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
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
              <div className="hidden sm:flex flex-row gap-6 sm:gap-4 shrink-0 items-center">
                {isEditingPrice ? (
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest leading-tight">現在價格</span>
                    <Input
                      type="number"
                      step="any"
                      autoFocus
                      className="h-6 w-20 text-xs font-bold text-zinc-800 bg-white border-emerald-500 p-1 mt-0.5"
                      value={tempPrice}
                      onChange={(e) => setTempPrice(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseFloat(tempPrice);
                          if (!isNaN(val) && val >= 0) {
                            updateCurrentPrice(tab.id, val);
                          }
                          setIsEditingPrice(false);
                        } else if (e.key === 'Escape') {
                          setIsEditingPrice(false);
                        }
                      }}
                      onBlur={() => {
                        const val = parseFloat(tempPrice);
                        if (!isNaN(val) && val >= 0) {
                          updateCurrentPrice(tab.id, val);
                        }
                        setIsEditingPrice(false);
                      }}
                    />
                  </div>
                ) : (
                  <div 
                    className="flex flex-col group cursor-pointer"
                    onClick={() => {
                      setTempPrice(tab.currentPrice?.toString() || '');
                      setIsEditingPrice(true);
                    }}
                    title="點擊修改現在價格"
                  >
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest leading-tight flex items-center gap-1">
                      現在價格 <span className="opacity-0 group-hover:opacity-100 text-[9px] text-emerald-600 transition-opacity">✏️</span>
                    </span>
                    <span className="text-lg font-bold text-emerald-700 tracking-tight leading-none mt-0.5">${(tab.currentPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
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
                <DialogContent className="glass-panel border-zinc-250 shadow-2xl bg-white text-zinc-800 max-w-md p-6 rounded-3xl">
                  <DialogHeader className="mb-1">
                    <DialogTitle className="font-extrabold text-xl text-zinc-900 flex items-center gap-2">
                      <span className="text-xl">🏆</span>
                      <span>結束交易並記錄最終損益</span>
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={(e) => e.preventDefault()} className="space-y-5 pt-1">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-zinc-700 font-bold text-xs">最終獲利或虧損金額 ($)</Label>
                        {stats && (
                          <button
                            type="button"
                            onClick={() => {
                              const calcPnL = (stats.realizedPnL + stats.unrealizedPnL);
                              setFinalPnLInput(calcPnL.toFixed(2));
                            }}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                          >
                            自動填入預估損益 (${(stats.realizedPnL + stats.unrealizedPnL).toFixed(2)})
                          </button>
                        )}
                      </div>
                      <Input 
                        type="number" 
                        step="0.01"
                        value={finalPnLInput}
                        onChange={e => setFinalPnLInput(e.target.value)}
                        placeholder="例如：500 或 -200"
                        className="bg-zinc-50/80 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus-visible:ring-emerald-500/50 font-mono font-black text-sm h-11 rounded-xl"
                        required 
                      />
                    </div>

                    <div className="flex flex-col gap-3 pt-3 border-t border-zinc-200">
                      <button
                        type="button"
                        onClick={handleCompleteAndClose}
                        disabled={isSubmittingComplete}
                        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                      >
                        {isSubmittingComplete ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                        )}
                        <span>1. 輸入金額並關掉交易結算 (移至已完成)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCompleteAndContinue}
                        disabled={isSubmittingComplete}
                        className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 disabled:opacity-50"
                      >
                        {isSubmittingComplete ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4 shrink-0" />
                        )}
                        <span>2. 輸入金額做交易結算並繼續交易 (保留卡片)</span>
                      </button>
                    </div>
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

      {/* Main Tabs Container */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full bg-zinc-100 border border-zinc-200 p-1 rounded-xl gap-1 shadow-sm mb-4">
          <TabsTrigger value="trades" className="flex-1 py-2 text-[11px] sm:text-xs font-black rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-md text-zinc-700 hover:text-black transition-all cursor-pointer text-center px-1">
            <span className="hidden sm:inline">籌碼管理與交易紀錄</span>
            <span className="inline sm:hidden">籌碼與紀錄</span>
          </TabsTrigger>
          <TabsTrigger value="strategy" className="flex-1 py-2 text-[11px] sm:text-xs font-black rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-md text-zinc-700 hover:text-black transition-all cursor-pointer text-center px-1">
            <span>策略計畫</span>
          </TabsTrigger>
          <TabsTrigger value="chips" className="flex-1 py-2 text-[11px] sm:text-xs font-black rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-md text-zinc-700 hover:text-black transition-all cursor-pointer text-center px-1">
            <span className="hidden sm:inline">主力與籌碼分析</span>
            <span className="inline sm:hidden">主力與籌碼</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trades" className="space-y-4 pb-20 outline-none">
          {/* Stats Summary & Chips Management */}
          <ScrollIn delay={0.1}>
            <div className="w-full glass-panel bg-white/95 border border-zinc-200 rounded-2xl p-5 space-y-4 transition-all duration-300 hover:bg-zinc-50 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
          <div 
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer group"
            onClick={() => setIsStatsOpen(!isStatsOpen)}
          >
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-zinc-800">
                <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg shrink-0">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-base tracking-wide">籌碼管理</h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAveragingHelpOpen(true);
                  }}
                  className="p-1 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors flex items-center justify-center ml-0.5 shrink-0"
                  title="股價向下攤平試算與交易紀律說明"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[11px] font-semibold text-rose-600 bg-rose-50/80 border border-rose-200/80 px-2.5 py-1 rounded-lg inline-block">
                註：請遵守分批進出場原則 與 凱利公式。強制執行浮動平倉價位。單筆最大資產使用為40%。總虧損金額為平均成本的 6%
              </p>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-center">
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

                  {/* 籌碼管理內部子分頁 (籌碼與攤平試算 vs 交易紀錄) */}
                  <Tabs value={chipsSubTab} onValueChange={(v) => setChipsSubTab(v as 'calc' | 'trades')} className="w-full mt-4">
                    <TabsList className="flex w-full bg-zinc-100 border border-zinc-200 p-1 rounded-xl gap-1 shadow-2xs">
                      <TabsTrigger 
                        value="calc" 
                        className="flex-1 py-2 text-xs font-black rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm text-zinc-600 hover:text-zinc-900 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Calculator className="h-3.5 w-3.5" />
                        <span>籌碼與攤平試算</span>
                      </TabsTrigger>
                      <TabsTrigger 
                        value="trades" 
                        className="flex-1 py-2 text-xs font-black rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm text-zinc-600 hover:text-zinc-900 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <History className="h-3.5 w-3.5" />
                        <span>交易紀錄 ({trades.length} 筆)</span>
                      </TabsTrigger>
                    </TabsList>

                    {/* 子分頁 1: 籌碼試算與規劃 */}
                    <TabsContent value="calc" className="pt-3 space-y-4 outline-none">
                      {/* 預計購買數量、停損/止盈價位與分批規劃 */}
                      <div className="pt-2 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    {/* Left Column: Input box & Remaining Planned Buy Badge underneath */}
                    <div className="flex flex-col gap-2 w-full lg:w-auto">
                      {/* Input box for plannedBuyQty, stopLoss, takeProfit */}
                      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 bg-zinc-50 border border-zinc-200 px-3.5 py-2 rounded-2xl shadow-2xs w-full lg:w-auto">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-bold text-zinc-600 whitespace-nowrap">預計購買數量:</label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="請輸入數量"
                            className="w-20 sm:w-24 h-8 bg-white border border-zinc-250 text-zinc-800 font-mono font-bold text-center text-xs focus-visible:ring-emerald-500/55 rounded-xl p-1 shadow-inner"
                            value={plannedBuyQtyInput}
                            onChange={(e) => handlePlannedBuyQtyChange(e.target.value)}
                          />
                        </div>

                        <div className="h-4 w-[1px] bg-zinc-250 hidden sm:block" />

                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-bold text-rose-600 whitespace-nowrap">停損價位:</label>
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="停損價"
                            className="w-20 sm:w-24 h-8 bg-white border border-zinc-250 text-rose-700 font-mono font-bold text-center text-xs focus-visible:ring-rose-500/55 rounded-xl p-1 shadow-inner"
                            value={stopLossInput}
                            onChange={(e) => handleStopLossChange(e.target.value)}
                          />
                        </div>

                        <div className="h-4 w-[1px] bg-zinc-250 hidden sm:block" />

                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-bold text-emerald-600 whitespace-nowrap">止盈價位:</label>
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="止盈價"
                            className="w-20 sm:w-24 h-8 bg-white border border-zinc-250 text-emerald-700 font-mono font-bold text-center text-xs focus-visible:ring-emerald-500/55 rounded-xl p-1 shadow-inner"
                            value={takeProfitInput}
                            onChange={(e) => handleTakeProfitChange(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* 剩餘預計購買與當前順序提示標籤 (位在輸入欄位下方) */}
                      {plannedQty > 0 && (
                        <div className="pt-0.5">
                          <span className="text-xs font-bold bg-[#B1C28D]/20 text-[#6F7D50] border border-[#B1C28D]/40 px-3 py-1 rounded-full inline-flex flex-wrap items-center gap-2 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6F7D50] animate-pulse" />
                            剩餘預計購買: <span className="font-mono font-black">{remainingToBuy}</span> 股
                            <span className="opacity-40">|</span>
                            當前順序: <span className="font-semibold text-zinc-800">{currentBatchOrderText}</span> ({currentBatchText}
                            {currentBatchOrderText !== "無" && currentBatchOrderText !== "已滿批" && (
                              <span className="ml-1 text-zinc-700">
                                ‧ 已購: <span className="font-mono font-black">{currentBatchBought}</span> 股 / 餘額: <span className="font-mono font-black">{currentBatchRemaining}</span> 股
                              </span>
                            )})
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Batch Planning Cards */}
                    {plannedQty > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full lg:max-w-xl">
                        {[
                          { 
                            name: "第一批 (15%)", 
                            size: size1, 
                            bought: bought1, 
                            remaining: remaining1, 
                          },
                          { 
                            name: "第二批 (25%)", 
                            size: size2, 
                            bought: bought2, 
                            remaining: remaining2, 
                          },
                          { 
                            name: "第三批 (35%)", 
                            size: size3, 
                            bought: bought3, 
                            remaining: remaining3, 
                          },
                          { 
                            name: "第四批 (25%)", 
                            size: size4, 
                            bought: bought4, 
                            remaining: remaining4, 
                          },
                        ].map((b, idx) => {
                          const isFinished = b.remaining === 0;
                          return (
                            <div 
                              key={idx} 
                              onClick={() => handleBatchClick(idx, b.name, b.size)}
                              title="點擊將此批股數平分帶入雙系統攤平試算"
                              className={`p-2 border rounded-xl flex flex-col justify-between text-center relative transition-all duration-300 hover:scale-[1.03] active:scale-95 cursor-pointer select-none ${
                                isFinished 
                                  ? 'bg-emerald-100/90 border-emerald-300 hover:bg-emerald-200/80 text-black shadow-2xs' 
                                  : 'bg-zinc-100/90 border-zinc-200 hover:bg-zinc-200/80 text-black shadow-2xs'
                              }`}
                            >
                              <span className="text-[10px] font-bold text-black uppercase tracking-wider leading-none mb-1 whitespace-nowrap">{b.name}</span>
                              <span className="text-[13px] font-black font-mono text-black leading-tight my-0.5">{b.size} 股</span>
                              <div className="flex items-center justify-around text-[10px] mt-1 pt-1.5 border-t border-zinc-300/70 font-medium font-sans text-black">
                                <div className="flex flex-col items-center">
                                  <span className="text-black font-bold text-[10px] leading-none opacity-80">已購</span>
                                  <span className="font-mono font-bold mt-1 text-black text-[10px]">{b.bought}</span>
                                </div>
                                <div className="bg-zinc-400/50 w-[1px] h-4 self-center" />
                                <div className="flex flex-col items-center">
                                  <span className="text-black font-bold text-[10px] leading-none opacity-80">餘額</span>
                                  <span className="font-mono font-bold mt-1 text-black text-[10px]">{b.remaining}</span>
                                </div>
                              </div>
                              {isFinished && (
                                <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full text-[10px] px-1.5 py-0.5 font-bold shadow-md border border-white animate-pulse leading-none">滿</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 股價攤平 (雙系統) 與 比例計算工具 */}
                  <div className="mt-6 pt-6 border-t border-zinc-200/80 space-y-6">
                    {/* Header for 股價向下攤平試算區塊 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-150">
                      <div>
                        <div className="flex items-center space-x-2">
                          <div className="p-1 bg-emerald-50 text-emerald-700 rounded-md">
                            <span className="text-xs">📉</span>
                          </div>
                          <h4 className="font-bold text-base tracking-wide text-zinc-800">股價向下攤平試算 (雙系統對比)</h4>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          系統一採用標準 3% 遞減策略；系統二採用緊密 2% 遞減策略。輸入股價與數量可即時對比兩組攤平結果。
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-zinc-700 font-semibold bg-zinc-100/80 hover:bg-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-200/60 transition-colors">
                          <input
                            type="checkbox"
                            checked={includeCurrentHolding}
                            onChange={(e) => setIncludeCurrentHolding(e.target.checked)}
                            className="rounded border-zinc-300 text-[#0F6E56] focus:ring-[#0F6E56] h-3.5 w-3.5"
                          />
                          <span>包含當前庫存 ({stats.totalQuantity} 股 @ ${stats.averagePrice.toFixed(2)})</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setAveragingRows([
                              { price: '', quantity: '', bought: false, riskFlag: false },
                              { price: '', quantity: '', bought: false, riskFlag: false },
                              { price: '', quantity: '', bought: false, riskFlag: false },
                              { price: '', quantity: '', bought: false, riskFlag: false }
                            ]);
                            setAveragingRowsSys2([
                              { price: '', quantity: '', bought: false, riskFlag: false },
                              { price: '', quantity: '', bought: false, riskFlag: false },
                              { price: '', quantity: '', bought: false, riskFlag: false },
                              { price: '', quantity: '', bought: false, riskFlag: false }
                            ]);
                            setRefPnLPoint('');
                            setRefPnLPointSys2('');
                          }}
                          className="text-xs font-bold text-zinc-400 hover:text-zinc-700 transition-colors px-2 py-1"
                          title="清除雙系統所有輸入"
                        >
                          ✕ 清除全域輸入
                        </button>
                      </div>
                    </div>

                    {/* Dual System Comparison Layout: Left = System 1 (-3%/-6%/-9%/-12%), Right = System 2 (-2%/-4%/-6%/-8%) */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                      {/* System 1 (Left) */}
                      <div className="bg-white/90 border border-emerald-200/70 rounded-2xl p-4 shadow-2xs space-y-3.5 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-emerald-100/80">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-white bg-[#0F6E56] px-2.5 py-0.5 rounded-md shadow-2xs">
                                系統一
                              </span>
                              <span className="text-xs font-bold text-zinc-700">標準 3% 階梯攤平</span>
                            </div>
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                              -3% / -6% / -9% / -12%
                            </span>
                          </div>

                          {/* 剩餘預計購買與當前順序資訊 (系統一) */}
                          {plannedQty > 0 && (
                            <div className="text-[11px] font-bold bg-[#B1C28D]/20 text-[#6F7D50] border border-[#B1C28D]/40 px-2.5 py-1 rounded-xl flex flex-wrap items-center justify-between gap-1.5 shadow-2xs">
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#6F7D50] animate-pulse" />
                                <span>剩餘預計購買: <span className="font-mono font-black">{remainingToBuy}</span> 股</span>
                              </div>
                              <div>
                                <span>當前順序: <span className="font-bold text-zinc-800">{currentBatchOrderText}</span></span>
                                {currentBatchOrderText !== "無" && currentBatchOrderText !== "已滿批" && (
                                  <span className="ml-1 text-zinc-700 font-medium">
                                    (已購 <span className="font-mono font-bold text-zinc-800">{currentBatchBought}</span> / 餘額 <span className="font-mono font-bold text-zinc-800">{currentBatchRemaining}</span> 股)
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            <div className="grid grid-cols-12 gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1 items-center">
                              <span className="col-span-3 text-left">組別</span>
                              <span className="col-span-3">預計購入股價 ($)</span>
                              <span className="col-span-3">預計購入數量 (股)</span>
                              <span className="col-span-3 text-right pr-1">狀態</span>
                            </div>

                            {averagingRows.map((row, idx) => {
                              const discountLabels = ['-3%', '-6%', '-9%', '-12%'];
                              const discountLabel = discountLabels[idx];
                              const riskMessages: Record<number, string> = {
                                1: '(進入平倉籌碼倉位)',
                                2: '(進入負籌碼博弈倉位)',
                                3: '(進入強制關閉倉位)',
                              };

                              return (
                                <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                                  {/* 組別 */}
                                  <div className="col-span-3 flex items-center gap-1 min-w-0 flex-wrap">
                                    <input
                                      type="checkbox"
                                      checked={!!row.bought}
                                      onChange={(e) => {
                                        const newRows = [...averagingRows];
                                        newRows[idx] = { ...newRows[idx], bought: e.target.checked };
                                        setAveragingRows(newRows);
                                      }}
                                      className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer shrink-0"
                                      title={row.bought ? "已購入" : "勾選標記為已購入"}
                                    />
                                    <span className="text-xs text-zinc-500 font-bold shrink-0">#{idx + 1}</span>
                                    {discountLabel && (
                                      <span className="text-[11px] font-black text-red-600 shrink-0">{discountLabel}</span>
                                    )}

                                    {idx >= 1 && (
                                      <label
                                        className="inline-flex items-center cursor-pointer ml-0.5 shrink-0"
                                        title="點擊勾選切換風險倉位提示"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={!!row.riskFlag}
                                          onChange={(e) => {
                                            const newRows = [...averagingRows];
                                            newRows[idx] = { ...newRows[idx], riskFlag: e.target.checked };
                                            setAveragingRows(newRows);
                                          }}
                                          className="sr-only"
                                        />
                                        <div className={`p-0.5 rounded transition-all flex items-center justify-center ${
                                          row.riskFlag
                                            ? 'bg-rose-100 text-rose-600 ring-1 ring-rose-400'
                                            : 'text-zinc-400 hover:text-rose-500 hover:bg-rose-50'
                                        }`}>
                                          <AlertTriangle className="h-3 w-3 fill-current" />
                                        </div>
                                      </label>
                                    )}
                                  </div>

                                  {/* 預計購入股價 */}
                                  <div className="col-span-3 relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">$</span>
                                    <Input
                                      type="number"
                                      placeholder="股價"
                                      value={row.price}
                                      onChange={(e) => {
                                        const newRows = [...averagingRows];
                                        newRows[idx] = { ...newRows[idx], price: e.target.value };
                                        setAveragingRows(newRows);
                                      }}
                                      className="h-8 pl-5 pr-1 text-xs text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500"
                                    />
                                  </div>

                                  {/* 預計購入數量 + 清除按鈕 */}
                                  <div className="col-span-3 flex items-center gap-1">
                                    <Input
                                      type="number"
                                      placeholder="數量"
                                      value={row.quantity}
                                      onChange={(e) => {
                                        const newRows = [...averagingRows];
                                        newRows[idx] = { ...newRows[idx], quantity: e.target.value };
                                        setAveragingRows(newRows);
                                      }}
                                      className="h-8 px-1.5 text-xs text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newRows = [...averagingRows];
                                        newRows[idx] = { price: '', quantity: '', bought: false, riskFlag: false };
                                        setAveragingRows(newRows);
                                      }}
                                      className="h-8 w-5 text-zinc-400 hover:text-red-650 hover:bg-zinc-100 rounded-md shrink-0 transition-colors flex items-center justify-center font-bold text-xs"
                                      title="清除這組"
                                    >
                                      ✕
                                    </button>
                                  </div>

                                  {/* 狀態 */}
                                  <div className="col-span-3 text-right pr-0.5 flex flex-col items-end justify-center gap-0.5">
                                    <div>
                                      {row.bought ? (
                                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80 inline-block whitespace-nowrap">
                                          已購入
                                        </span>
                                      ) : (
                                        <span className="text-[11px] font-medium text-zinc-600 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-200/60 inline-block whitespace-nowrap">
                                          尚未購入
                                        </span>
                                      )}
                                    </div>
                                    {idx >= 1 && row.riskFlag && riskMessages[idx] && (
                                      <span className="text-[10px] font-bold text-red-600 leading-tight whitespace-nowrap">
                                        {riskMessages[idx]}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* 系統一 參考損益點 */}
                          <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 mt-2">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-zinc-700">系統一參考損益點 ($)</span>
                              <span className="text-[10px] text-zinc-400">估算目標價格與攤平後成本之差額</span>
                            </div>
                            <div className="relative w-32 shrink-0">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">$</span>
                              <Input
                                type="number"
                                placeholder="參考價"
                                value={refPnLPoint}
                                onChange={(e) => setRefPnLPoint(e.target.value)}
                                className="h-8 pl-6 pr-2 text-xs font-bold text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500 rounded-lg"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 系統一 計算結果卡片 */}
                        <div className="p-3.5 rounded-xl bg-zinc-50/80 border border-zinc-200/80 space-y-2">
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
                          {hasRefPnL && calculatedPnLResult !== null && (() => {
                            const isLoss = avgResult.finalAveragePrice > parsedRefPnL;
                            const isProfit = avgResult.finalAveragePrice < parsedRefPnL;
                            const absAmount = Math.abs(calculatedPnLResult);
                            const formattedAmount = absAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                            let textColor = "text-zinc-800";
                            let displayText = `$0.00`;

                            if (isLoss) {
                              textColor = "text-rose-600 font-bold";
                              displayText = `-$${formattedAmount}`;
                            } else if (isProfit) {
                              textColor = "text-emerald-700 font-bold";
                              displayText = `+$${formattedAmount}`;
                            }

                            return (
                              <div className="flex justify-between items-baseline pt-2 border-t border-zinc-200/80 mt-1">
                                <div className="flex flex-col">
                                  <span className="text-xs font-semibold text-zinc-600">試算結果:</span>
                                  <span className="text-[10px] text-zinc-400 font-normal">(攤平成本 - 參考損益點) × 總股數</span>
                                </div>
                                <span className={`text-base font-black font-mono ${textColor}`}>
                                  {displayText}
                                </span>
                              </div>
                            );
                          })()}
                          {includeCurrentHolding && avgResult.costReducedPercent > 0 && (
                            <div className="text-[11px] text-emerald-700 font-semibold text-center bg-emerald-50 py-1 px-2 rounded-lg border border-emerald-100 mt-1">
                              📉 平均成本降低 {avgResult.costReducedPercent.toFixed(2)}%
                            </div>
                          )}
                        </div>
                      </div>

                      {/* System 2 (Right) */}
                      <div className="bg-white/90 border border-blue-200/70 rounded-2xl p-4 shadow-2xs space-y-3.5 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-blue-100/80">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-white bg-blue-600 px-2.5 py-0.5 rounded-md shadow-2xs">
                                系統二
                              </span>
                              <span className="text-xs font-bold text-zinc-700">緊密 2% 階梯攤平</span>
                            </div>
                            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                              -2% / -4% / -6% / -8%
                            </span>
                          </div>

                          {/* 剩餘預計購買與當前順序資訊 (系統二) */}
                          {plannedQty > 0 && (
                            <div className="text-[11px] font-bold bg-[#B1C28D]/20 text-[#6F7D50] border border-[#B1C28D]/40 px-2.5 py-1 rounded-xl flex flex-wrap items-center justify-between gap-1.5 shadow-2xs">
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#6F7D50] animate-pulse" />
                                <span>剩餘預計購買: <span className="font-mono font-black">{remainingToBuy}</span> 股</span>
                              </div>
                              <div>
                                <span>當前順序: <span className="font-bold text-zinc-800">{currentBatchOrderText}</span></span>
                                {currentBatchOrderText !== "無" && currentBatchOrderText !== "已滿批" && (
                                  <span className="ml-1 text-zinc-700 font-medium">
                                    (已購 <span className="font-mono font-bold text-zinc-800">{currentBatchBought}</span> / 餘額 <span className="font-mono font-bold text-zinc-800">{currentBatchRemaining}</span> 股)
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            <div className="grid grid-cols-12 gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1 items-center">
                              <span className="col-span-3 text-left">組別</span>
                              <span className="col-span-3">預計購入股價 ($)</span>
                              <span className="col-span-3">預計購入數量 (股)</span>
                              <span className="col-span-3 text-right pr-1">狀態</span>
                            </div>

                            {averagingRowsSys2.map((row, idx) => {
                              const discountLabels = ['-2%', '-4%', '-6%', '-8%'];
                              const discountLabel = discountLabels[idx];
                              const riskMessages: Record<number, string> = {
                                1: '(進入平倉籌碼倉位)',
                                2: '(進入負籌碼博弈倉位)',
                                3: '(進入強制關閉倉位)',
                              };

                              return (
                                <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                                  {/* 組別 */}
                                  <div className="col-span-3 flex items-center gap-1 min-w-0 flex-wrap">
                                    <input
                                      type="checkbox"
                                      checked={!!row.bought}
                                      onChange={(e) => {
                                        const newRows = [...averagingRowsSys2];
                                        newRows[idx] = { ...newRows[idx], bought: e.target.checked };
                                        setAveragingRowsSys2(newRows);
                                      }}
                                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer shrink-0"
                                      title={row.bought ? "已購入" : "勾選標記為已購入"}
                                    />
                                    <span className="text-xs text-zinc-500 font-bold shrink-0">#{idx + 1}</span>
                                    {discountLabel && (
                                      <span className="text-[11px] font-black text-red-600 shrink-0">{discountLabel}</span>
                                    )}

                                    {idx >= 1 && (
                                      <label
                                        className="inline-flex items-center cursor-pointer ml-0.5 shrink-0"
                                        title="點擊勾選切換風險倉位提示"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={!!row.riskFlag}
                                          onChange={(e) => {
                                            const newRows = [...averagingRowsSys2];
                                            newRows[idx] = { ...newRows[idx], riskFlag: e.target.checked };
                                            setAveragingRowsSys2(newRows);
                                          }}
                                          className="sr-only"
                                        />
                                        <div className={`p-0.5 rounded transition-all flex items-center justify-center ${
                                          row.riskFlag
                                            ? 'bg-rose-100 text-rose-600 ring-1 ring-rose-400'
                                            : 'text-zinc-400 hover:text-rose-500 hover:bg-rose-50'
                                        }`}>
                                          <AlertTriangle className="h-3 w-3 fill-current" />
                                        </div>
                                      </label>
                                    )}
                                  </div>

                                  {/* 預計購入股價 */}
                                  <div className="col-span-3 relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">$</span>
                                    <Input
                                      type="number"
                                      placeholder="股價"
                                      value={row.price}
                                      onChange={(e) => {
                                        const newRows = [...averagingRowsSys2];
                                        newRows[idx] = { ...newRows[idx], price: e.target.value };
                                        setAveragingRowsSys2(newRows);
                                      }}
                                      className="h-8 pl-5 pr-1 text-xs text-zinc-800 bg-white border-zinc-200 focus-visible:ring-blue-500"
                                    />
                                  </div>

                                  {/* 預計購入數量 + 清除按鈕 */}
                                  <div className="col-span-3 flex items-center gap-1">
                                    <Input
                                      type="number"
                                      placeholder="數量"
                                      value={row.quantity}
                                      onChange={(e) => {
                                        const newRows = [...averagingRowsSys2];
                                        newRows[idx] = { ...newRows[idx], quantity: e.target.value };
                                        setAveragingRowsSys2(newRows);
                                      }}
                                      className="h-8 px-1.5 text-xs text-zinc-800 bg-white border-zinc-200 focus-visible:ring-blue-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newRows = [...averagingRowsSys2];
                                        newRows[idx] = { price: '', quantity: '', bought: false, riskFlag: false };
                                        setAveragingRowsSys2(newRows);
                                      }}
                                      className="h-8 w-5 text-zinc-400 hover:text-red-650 hover:bg-zinc-100 rounded-md shrink-0 transition-colors flex items-center justify-center font-bold text-xs"
                                      title="清除這組"
                                    >
                                      ✕
                                    </button>
                                  </div>

                                  {/* 狀態 */}
                                  <div className="col-span-3 text-right pr-0.5 flex flex-col items-end justify-center gap-0.5">
                                    <div>
                                      {row.bought ? (
                                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/80 inline-block whitespace-nowrap">
                                          已購入
                                        </span>
                                      ) : (
                                        <span className="text-[11px] font-medium text-zinc-600 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-200/60 inline-block whitespace-nowrap">
                                          尚未購入
                                        </span>
                                      )}
                                    </div>
                                    {idx >= 1 && row.riskFlag && riskMessages[idx] && (
                                      <span className="text-[10px] font-bold text-red-600 leading-tight whitespace-nowrap">
                                        {riskMessages[idx]}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* 系統二 參考損益點 */}
                          <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 mt-2">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-zinc-700">系統二參考損益點 ($)</span>
                              <span className="text-[10px] text-zinc-400">估算目標價格與攤平後成本之差額</span>
                            </div>
                            <div className="relative w-32 shrink-0">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold">$</span>
                              <Input
                                type="number"
                                placeholder="參考價"
                                value={refPnLPointSys2}
                                onChange={(e) => setRefPnLPointSys2(e.target.value)}
                                className="h-8 pl-6 pr-2 text-xs font-bold text-zinc-800 bg-white border-zinc-200 focus-visible:ring-blue-500 rounded-lg"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 系統二 計算結果卡片 */}
                        <div className="p-3.5 rounded-xl bg-zinc-50/80 border border-zinc-200/80 space-y-2">
                          <div className="flex justify-between text-xs text-zinc-500">
                            <span>加碼購入總股數:</span>
                            <span className="font-bold font-mono text-zinc-800">{avgResultSys2.newSharesSum} 股</span>
                          </div>
                          <div className="flex justify-between text-xs text-zinc-500">
                            <span>加碼所需資金:</span>
                            <span className="font-bold font-mono text-zinc-800">${avgResultSys2.newCostSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="h-[0.5px] bg-zinc-200/80 my-1" />
                          <div className="flex justify-between items-baseline">
                            <span className="text-xs font-semibold text-zinc-600">攤平後總股數:</span>
                            <span className="text-sm font-bold font-mono text-zinc-800">{avgResultSys2.totalShares} 股</span>
                          </div>
                          <div className="flex justify-between items-baseline">
                            <span className="text-xs font-semibold text-zinc-600">攤平後平均成本:</span>
                            <span className="text-base font-black font-mono text-blue-700">
                              ${avgResultSys2.finalAveragePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          {hasRefPnLSys2 && calculatedPnLResultSys2 !== null && (() => {
                            const isLoss = avgResultSys2.finalAveragePrice > parsedRefPnLSys2;
                            const isProfit = avgResultSys2.finalAveragePrice < parsedRefPnLSys2;
                            const absAmount = Math.abs(calculatedPnLResultSys2);
                            const formattedAmount = absAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                            let textColor = "text-zinc-800";
                            let displayText = `$0.00`;

                            if (isLoss) {
                              textColor = "text-rose-600 font-bold";
                              displayText = `-$${formattedAmount}`;
                            } else if (isProfit) {
                              textColor = "text-[#0F6E56] font-bold";
                              displayText = `+$${formattedAmount}`;
                            }

                            return (
                              <div className="flex justify-between items-baseline pt-2 border-t border-zinc-200/80 mt-1">
                                <div className="flex flex-col">
                                  <span className="text-xs font-semibold text-zinc-600">試算結果:</span>
                                  <span className="text-[10px] text-zinc-400 font-normal">(攤平成本 - 參考損益點) × 總股數</span>
                                </div>
                                <span className={`text-base font-black font-mono ${textColor}`}>
                                  {displayText}
                                </span>
                              </div>
                            );
                          })()}
                          {includeCurrentHolding && avgResultSys2.costReducedPercent > 0 && (
                            <div className="text-[11px] text-blue-700 font-semibold text-center bg-blue-50 py-1 px-2 rounded-lg border border-blue-100 mt-1">
                              📉 平均成本降低 {avgResultSys2.costReducedPercent.toFixed(2)}%
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Full-width Section: 比例股價變動計算器 */}
                    <div className="pt-4 border-t border-zinc-200/80 space-y-3 bg-zinc-50/50 p-4 rounded-2xl border border-zinc-200/60">
                      <div className="flex items-center space-x-2">
                        <div className="p-1 bg-emerald-50 text-emerald-700 rounded-md">
                          <span className="text-xs">🧮</span>
                        </div>
                        <h4 className="font-bold text-sm tracking-wide text-zinc-800">比例股價變動計算器</h4>
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        依據百分比增減計算目標價（例如：設定停損限價、獲利目標、滿足點）。
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        <div className="space-y-2">
                          <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">1. 算式計算（例: 56 - 7% 或 56 + 8%）</Label>
                          <div className="relative">
                            <Input
                              type="text"
                              placeholder="56 - 7% 或 56 + 8%"
                              value={calcExpression}
                              onChange={(e) => setCalcExpression(e.target.value)}
                              className="h-10 text-sm font-semibold tracking-wide text-zinc-800 bg-white border-zinc-200 focus-visible:ring-emerald-500 rounded-xl"
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
                                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
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

                        {/* Structured adjustment & Result Output */}
                        <div className="space-y-3">
                          <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">2. 數值微調與計算結果</Label>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <span className="text-[9px] text-zinc-400 font-bold block mb-1">基準股價 ($)</span>
                              <Input
                                type="number"
                                value={calcBasePrice}
                                onChange={(e) => setCalcBasePrice(e.target.value)}
                                className="h-8 text-xs text-zinc-800 bg-white border-zinc-200 rounded-lg"
                              />
                            </div>
                            <div>
                              <span className="text-[9px] text-zinc-400 font-bold block mb-1">運算符</span>
                              <div className="flex h-8 border border-zinc-200 rounded-lg overflow-hidden bg-white">
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
                                className="h-8 text-xs text-zinc-800 bg-white border-zinc-200 rounded-lg"
                              />
                            </div>
                          </div>

                          {/* Display Area */}
                          <div className={`p-3 rounded-xl border flex flex-col justify-center transition-all ${parsedCalc.success ? 'bg-emerald-50/40 border-emerald-200/80' : 'bg-white border-zinc-200/80'} min-h-[64px]`}>
                            {parsedCalc.success && parsedCalc.result !== undefined ? (
                              <div className="text-center">
                                <div className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase">計算結果</div>
                                <div className="text-xl font-black text-[#0F6E56] font-mono tracking-tight leading-tight">
                                  ${parsedCalc.result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                {parsedCalc.percent !== 0 && (
                                  <div className="text-[10px] text-zinc-500 font-medium">
                                    以 <span className="font-semibold text-zinc-800">${parsedCalc.base?.toFixed(2)}</span> 為基準，{parsedCalc.isAdd ? '增加' : '減少'} <span className="font-black text-zinc-700">{parsedCalc.percent}%</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center text-xs text-zinc-400 font-medium">
                                請於上方輸入算式（如 <span className="font-mono">56 - 7%</span>）或點選快捷鍵
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Save Action Bar */}
                    <div className="pt-4 border-t border-zinc-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-50/60 p-3.5 rounded-xl border border-zinc-200/60 mt-2">
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span>儲存試算內容將會將本次設定（包含預計購入股價、數量與倉位狀態）記錄至雲端</span>
                      </div>
                      <Button
                        type="button"
                        onClick={handleSaveAveraging}
                        disabled={isSavingAveraging}
                        className="w-full sm:w-auto bg-[#0F6E56] hover:bg-[#0B5240] active:scale-95 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                      >
                        {isSavingAveraging ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>儲存中...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            <span>儲存攤平試算設定</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* 子分頁 2: 交易紀錄 */}
                <TabsContent value="trades" className="pt-3 space-y-4 outline-none">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50 border border-zinc-200/80 p-3 rounded-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-bold tracking-tight text-zinc-800 mr-1">交易紀錄清單</h4>
                      <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap">
                        <span>已持有:</span>
                        <span className="font-mono font-black text-zinc-800">{stats.totalQuantity}</span>
                        <span>股</span>
                      </span>
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
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 transition-all text-[11px] font-bold ml-1 shadow-2xs"
                      >
                        <Download className="w-3 h-3" />
                        匯出Json
                      </button>
                      <button
                        type="button"
                        onClick={() => tradesJsonFileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-all text-[11px] font-bold shadow-2xs"
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
               <DialogContent className="glass-panel border-zinc-200 shadow-2xl bg-white text-zinc-800 w-[92vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl sm:rounded-3xl">
                 <DialogHeader><DialogTitle className="font-bold text-xl sm:text-2xl tracking-tight text-zinc-800 mb-2">新增交易紀錄</DialogTitle></DialogHeader>
                 <form onSubmit={handleTradeSubmit} className="space-y-4 sm:space-y-6">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
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

                  <div className="flex items-center gap-3">
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
                         <thead className="text-[11px] sm:text-xs text-zinc-500 bg-zinc-100 uppercase tracking-wider sm:tracking-widest border-b border-zinc-200 font-bold">
                           <tr>
                             <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">日期</th>
                             <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">方向</th>
                             <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">價格</th>
                             <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">數量</th>
                             <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">總計</th>
                             <th className="px-3 sm:px-6 py-3 sm:py-4 text-right font-semibold">操作</th>
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
                                 <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">{t.tradeDate?.toDate() ? format(t.tradeDate.toDate(), 'yyyy/MM/dd') : ''}</td>
                                 <td className="px-3 sm:px-6 py-3 sm:py-4">
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
                                 <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">${t.price}</td>
                                 <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">{t.quantity}</td>
                                 <td className="px-6 py-4 whitespace-nowrap text-zinc-700">${(t.price * t.quantity).toFixed(2)}</td>
                                 <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
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
        </Tabs>
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

      {/* Averaging Calculation & Trading Discipline Help Dialog */}
      <Dialog open={isAveragingHelpOpen} onOpenChange={setIsAveragingHelpOpen}>
        <DialogContent className="max-w-xl bg-white rounded-2xl p-6 shadow-2xl border border-zinc-200">
          <DialogHeader className="border-b border-zinc-100 pb-3">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-zinc-900">
              <HelpCircle className="h-5 w-5 text-emerald-600 shrink-0" />
              股價向下攤平試算與交易紀律說明
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 my-2 text-sm text-zinc-700 leading-relaxed max-h-[75vh] overflow-y-auto pr-1">
            {/* Downward Averaging Logic */}
            <div className="bg-zinc-50 border border-zinc-200/90 rounded-xl p-4 space-y-2.5">
              <h4 className="font-bold text-zinc-900 flex items-center gap-1.5 text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                股價向下攤平試算運算邏輯
              </h4>
              <p className="text-xs text-zinc-600 leading-normal">
                點擊預計購買數量的規劃批次標籤（第一批 ~ 第四批）時，會將該批次計算出的股數分成平均的 2 份數量（無條件進位 Roundup），並自動填入「股價向下攤平試算」相對應的欄位：
              </p>
              
              <div className="space-y-2 text-xs pt-1">
                <div className="bg-white p-3 rounded-lg border border-zinc-200 shadow-sm space-y-1">
                  <span className="font-bold text-emerald-700 block">第一批 (15%) / 第二批 (25%) 點擊後：</span>
                  <div className="text-zinc-600 pl-2 space-y-1">
                    <div>• <strong>第 1 欄位</strong>：預計購入股價為 <span className="text-zinc-800 font-semibold">平均成本 -3%</span> | 購入數量為 1 份數量 (roundup)</div>
                    <div>• <strong>第 2 欄位</strong>：預計購入股價為 <span className="text-zinc-800 font-semibold">平均成本 -6%</span> | 購入數量為 1 份數量 (roundup)</div>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-zinc-200 shadow-sm space-y-1">
                  <span className="font-bold text-emerald-700 block">第三批 (35%) / 第四批 (25%) 點擊後：</span>
                  <div className="text-zinc-600 pl-2 space-y-1">
                    <div>• <strong>第 3 欄位</strong>：預計購入股價為 <span className="text-zinc-800 font-semibold">平均成本 -9%</span> | 購入數量為 1 份數量 (roundup)</div>
                    <div>• <strong>第 4 欄位</strong>：預計購入股價為 <span className="text-zinc-800 font-semibold">平均成本 -12%</span> | 購入數量為 1 份數量 (roundup)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Strict Trading Rules in Red Text */}
            <div className="bg-rose-50/90 border-2 border-rose-300 rounded-xl p-4 space-y-2.5 text-rose-700">
              <h4 className="font-black text-rose-800 flex items-center gap-1.5 text-sm border-b border-rose-200/80 pb-2">
                <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                特別註明：風控與交易紀律 (嚴格執行)
              </h4>
              <ul className="space-y-2 font-bold text-xs leading-relaxed text-rose-700">
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-600 shrink-0">•</span>
                  <span>單筆交易浮動攤平虧損最大為虧損金額達到 6%，請自動平倉與停止交易。</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-600 shrink-0">•</span>
                  <span>根據凱利公式，禁止全資產梭哈。</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-600 shrink-0">•</span>
                  <span>第一批與第二批的交易 40% 為單筆交易的最大資產使用量，第三批與第四批禁止使用。</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-600 shrink-0">•</span>
                  <span>評估本交易的勝率為 50% 則不能下注，唯有高於 60% ~ 80% 才可以下注，且使用最大資產額度仍為 40%。</span>
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-zinc-100">
            <Button 
              onClick={() => setIsAveragingHelpOpen(false)}
              className="w-full sm:w-auto bg-zinc-900 hover:bg-black text-white font-bold rounded-xl px-6 py-2 text-xs"
            >
              了解並遵守紀律
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
