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
import { Timestamp } from 'firebase/firestore';
import { Trash2, BarChart3, ChevronDown, ChevronUp, Gamepad2, ShieldCheck, Upload, Bell, Mail, Plus, AlertCircle } from 'lucide-react';
import { toast } from "sonner";
import { motion, AnimatePresence } from 'motion/react';
import { ScrollIn, InteractiveButton, Magnetic } from '../components/MotionWrappers';
import { useAuth } from '../lib/AuthContext';
import StrategyTab from '../components/StrategyTab';
import PlannedOrdersTab from '../components/PlannedOrdersTab';
import ReportsTab from '../components/ReportsTab';

export default function StockTabDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tabs, updateTabStatus, updateCurrentPrice, updateTradeType, updateTab, deleteTab } = useStockTabs();
  const { trades, addTrade, deleteTrade } = useTrades(id);
  const { user } = useAuth();

  const tab = tabs.find(t => t.id === id);

  const [alertForm, setAlertForm] = useState({
    targetPrice: '',
    condition: 'above_or_equal',
    notifyBrowser: true,
    notifyEmail: true,
    emailAddress: ''
  });

  React.useEffect(() => {
    if (user?.email) {
      setAlertForm(prev => ({ ...prev, emailAddress: user.email }));
    }
  }, [user]);

  const [alertHistory, setAlertHistory] = useState<any[]>([]);
  React.useEffect(() => {
    if (user) {
      const historyStr = localStorage.getItem(`price_alerts_history_${user.uid}`);
      if (historyStr) {
        try {
          setAlertHistory(JSON.parse(historyStr));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [user]);

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tab) return;
    const priceStr = alertForm.targetPrice.trim();
    if (!priceStr || isNaN(Number(priceStr))) {
      toast.error("請輸入有效的目標價格");
      return;
    }
    const target = Number(priceStr);
    const newAlert = {
      id: `alert_${Date.now()}`,
      targetPrice: target,
      condition: alertForm.condition as 'above_or_equal' | 'below_or_equal',
      notifyBrowser: alertForm.notifyBrowser,
      notifyEmail: alertForm.notifyEmail,
      emailAddress: alertForm.notifyEmail ? alertForm.emailAddress : '',
      isEnabled: true,
      createdAt: new Date().toISOString()
    };
    const currentAlerts = tab.priceAlerts || [];
    const updatedAlerts = [...currentAlerts, newAlert];
    await updateTab(tab.id, { priceAlerts: updatedAlerts });
    toast.success("價格警報設定成功！");
    setAlertForm(prev => ({ ...prev, targetPrice: '' }));
  };

  const handleToggleAlert = async (alertId: string, currentVal: boolean) => {
    if (!tab) return;
    const updatedAlerts = (tab.priceAlerts || []).map(al => 
      al.id === alertId ? { ...al, isEnabled: !currentVal } : al
    );
    await updateTab(tab.id, { priceAlerts: updatedAlerts });
    toast.success(!currentVal ? "警報已啟用" : "警報已停用");
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (!tab) return;
    const updatedAlerts = (tab.priceAlerts || []).filter(al => al.id !== alertId);
    await updateTab(tab.id, { priceAlerts: updatedAlerts });
    toast.success("警報已刪除");
  };

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
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Update currentPriceInput when tab data loads or changes
  React.useEffect(() => {
    if (tab?.currentPrice !== undefined) {
      setCurrentPriceInput(tab.currentPrice.toString());
    }
  }, [tab?.id, tab?.currentPrice]);

  // Update preferredHoldingSubTab when tab changes so dashboard goes back to the right tab
  React.useEffect(() => {
    if (tab?.holdingStatus) {
       const displayStatus = ['觀察中', '買進操作', '賣出操作', '平倉操作', '乖離名單'].includes(tab.holdingStatus) ? tab.holdingStatus : '候選名單';
       sessionStorage.setItem('preferredHoldingSubTab', displayStatus);
    }
  }, [tab?.holdingStatus]);

  // Keyboard shortcut handle (Shift + B) to go back to dashboard
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'B' && !e.ctrlKey && !e.metaKey) {
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

  if (!tab) return <div className="text-slate-500">找不到該股票分頁，或已被刪除。</div>;

  const stats = calculateStats(trades, tab.currentPrice);

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
      <ScrollIn>
        <div className="glass-panel border border-white/10 bg-white/5 py-3 px-4 rounded-2xl shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-3 md:gap-4">
          <div className="flex flex-wrap items-center gap-4 md:gap-6">
            <div>
              <div className="flex items-center gap-2">
                <motion.h1 
                  layoutId="tab-title"
                  className={`text-2xl font-bold tracking-tight ${isStaleData ? 'text-red-500 animate-pulse' : 'text-white'}`}
                >
                  {tab.symbol}
                </motion.h1>
                {tab.status === 'COMPLETED' && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-bold text-[10px] px-2 py-0 rounded-full">COMPLETED</Badge>
                )}
              </div>
              <div className="flex flex-col">
                <p className="text-white/40 text-[10px] tracking-wider truncate max-w-[120px]">{tab.companyName}</p>
                {tab.updatedAt && (
                  <p className={`text-[8px] mt-0.5 tracking-widest ${isStaleData ? 'text-red-500 font-bold animate-pulse' : 'text-white/20'}`}>
                    UPD: {typeof tab.updatedAt.toDate === 'function' ? format(tab.updatedAt.toDate(), 'yyyy/MM/dd HH:mm') : ''}
                  </p>
                )}
              </div>
            </div>

            <div className="h-8 w-px bg-white/10 hidden md:block" />

            <div className="flex items-center gap-4 lg:gap-5">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest leading-tight">Avg Cost</span>
                <span className="text-lg font-bold text-white tracking-tight leading-none mt-0.5">${stats.averagePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest leading-tight">Total Shares</span>
                <span className="text-lg font-bold text-white tracking-tight leading-none mt-0.5">{stats.totalQuantity} <span className="text-[10px] text-white/40 font-normal">股</span></span>
              </div>
              <div className="h-6 w-px bg-white/10 hidden md:block" />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold text-white/30 uppercase tracking-widest pl-0.5">評分</span>
                <Select value={String(tab.rating || 5)} onValueChange={(val) => updateTab(tab.id, { rating: Number(val) })}>
                  <SelectTrigger className="h-6 w-11 bg-white/5 border-white/10 text-white font-bold text-[11px] ring-0 focus:ring-emerald-500/50 rounded p-1">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/10 text-white min-w-[50px]">
                    {[...Array(10)].map((_, i) => (
                      <SelectItem key={i+1} value={String(i+1)} className="text-xs focus:bg-white/10">{i+1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold text-white/30 uppercase tracking-widest pl-0.5">Quality</span>
                <Select value={String(tab.qualityScore || 5)} onValueChange={(val) => updateTab(tab.id, { qualityScore: Number(val) })}>
                  <SelectTrigger className="h-6 w-11 bg-white/5 border-white/10 text-white font-bold text-[11px] ring-0 focus:ring-purple-500/50 rounded p-1">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/10 text-white min-w-[50px]">
                    {[...Array(10)].map((_, i) => (
                      <SelectItem key={i+1} value={String(i+1)} className="text-xs focus:bg-white/10">{i+1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold text-white/30 uppercase tracking-widest pl-0.5">Value</span>
                <Select value={String(tab.valueScore || 5)} onValueChange={(val) => updateTab(tab.id, { valueScore: Number(val) })}>
                  <SelectTrigger className="h-6 w-11 bg-white/5 border-white/10 text-white font-bold text-[11px] ring-0 focus:ring-amber-500/50 rounded p-1">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/10 text-white min-w-[50px]">
                    {[...Array(10)].map((_, i) => (
                      <SelectItem key={i+1} value={String(i+1)} className="text-xs focus:bg-white/10">{i+1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold text-white/30 uppercase tracking-widest pl-0.5 whitespace-nowrap">Crash Sim</span>
                <Select value={String(tab.crashSimilarity || 5)} onValueChange={(val) => updateTab(tab.id, { crashSimilarity: Number(val) })}>
                  <SelectTrigger className="h-6 w-11 bg-white/5 border-white/10 text-white font-bold text-[11px] ring-0 focus:ring-rose-500/50 rounded p-1 mx-auto">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/10 text-white min-w-[50px]">
                    {[...Array(10)].map((_, i) => (
                      <SelectItem key={i+1} value={String(i+1)} className="text-xs focus:bg-white/10">{i+1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold text-white/30 uppercase tracking-widest pl-0.5">Buy Rate</span>
                <Select value={String(tab.buyRate || 5)} onValueChange={(val) => updateTab(tab.id, { buyRate: Number(val) })}>
                  <SelectTrigger className="h-6 w-11 bg-white/5 border-white/10 text-white font-bold text-[11px] ring-0 focus:ring-emerald-500/50 rounded p-1">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/10 text-white min-w-[50px]">
                    {[...Array(10)].map((_, i) => (
                      <SelectItem key={i+1} value={String(i+1)} className="text-xs focus:bg-white/10">{i+1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold text-white/30 uppercase tracking-widest pl-0.5">Sell Rate</span>
                <Select value={String(tab.sellRate || 5)} onValueChange={(val) => updateTab(tab.id, { sellRate: Number(val) })}>
                  <SelectTrigger className="h-6 w-11 bg-white/5 border-white/10 text-white font-bold text-[11px] ring-0 focus:ring-red-500/50 rounded p-1">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/10 text-white min-w-[50px]">
                    {[...Array(10)].map((_, i) => (
                      <SelectItem key={i+1} value={String(i+1)} className="text-xs focus:bg-white/10">{i+1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold text-white/30 uppercase tracking-widest pl-0.5">交易方向</span>
                <Select value={tab.tradeDirection || ''} onValueChange={(val: any) => updateTab(tab.id, { tradeDirection: val === 'none' ? undefined : val })}>
                  <SelectTrigger className={`h-6 w-[60px] bg-white/5 border-white/10 font-bold text-[10px] ring-0 focus:ring-emerald-500/50 rounded p-1 ${tab.tradeDirection === '看跌' ? 'text-red-400' : tab.tradeDirection === '看漲' ? 'text-emerald-400' : 'text-white'}`}>
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/10 text-white">
                    <SelectItem value="none" className="text-xs text-white/50 focus:bg-white/10">-</SelectItem>
                    <SelectItem value="看漲" className="text-xs text-emerald-400 focus:bg-white/10">看漲</SelectItem>
                    <SelectItem value="看跌" className="text-xs text-red-400 focus:bg-white/10">看跌</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold text-white/30 uppercase tracking-widest pl-0.5">波動性</span>
                <Select value={tab.volatility || '中等'} onValueChange={(val: any) => updateTab(tab.id, { volatility: val })}>
                  <SelectTrigger className="h-6 w-12 bg-white/5 border-white/10 text-white font-bold text-[10px] ring-0 focus:ring-emerald-500/50 rounded p-1">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/10 text-white">
                    <SelectItem value="低" className="text-xs text-blue-400 focus:bg-white/10">低</SelectItem>
                    <SelectItem value="中等" className="text-xs text-amber-400 focus:bg-white/10">中等</SelectItem>
                    <SelectItem value="高" className="text-xs text-red-400 focus:bg-white/10">高</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-0.5 ml-1">
                <span className="text-[9px] font-semibold text-emerald-400/50 uppercase tracking-widest text-center">Pos Value</span>
                <div className="h-6 w-11 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[11px] rounded flex items-center justify-center mx-auto">
                  {Math.max(0, Number(tab.rating||5) - 5) + Math.max(0, Number(tab.qualityScore||5) - 5) + Math.max(0, Number(tab.valueScore||5) - 5) + Number(tab.buyRate||5)}
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold text-red-400/50 uppercase tracking-widest text-center">Neg Value</span>
                <div className="h-6 w-11 bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-[11px] rounded flex items-center justify-center mx-auto">
                  {Math.max(0, 5 - Number(tab.rating||5)) + Math.max(0, 5 - Number(tab.qualityScore||5)) + Math.max(0, 5 - Number(tab.valueScore||5)) + Number(tab.sellRate||5)}
                </div>
              </div>

              <div className="flex items-end mb-0.5 ml-1">
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleJsonUpload}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="h-6 px-2.5 rounded flex items-center gap-1.5 border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all text-[10px] tracking-wider font-bold whitespace-nowrap group"
                >
                  <Upload className="w-3 h-3 group-hover:-translate-y-0.5 transition-transform" />
                  匯入 JSON
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end xl:self-center">
            <Select value={tab.tradeType} onValueChange={(val: any) => updateTradeType(tab.id, val)}>
              <SelectTrigger className="h-8 px-3 bg-white/5 border border-white/10 text-white text-[11px] font-medium focus:ring-emerald-500/50 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-panel border-white/10 text-white">
                <SelectItem value="simulated" className="text-xs font-medium focus:bg-white/10">
                  <div className="flex items-center gap-1.5">
                    <Gamepad2 className="h-3 w-3 text-amber-400" />
                    模擬交易
                  </div>
                </SelectItem>
                <SelectItem value="real" className="text-xs font-medium focus:bg-white/10">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3 text-emerald-400" />
                    真實交易
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {tab.status === 'ACTIVE' ? (
              <Dialog open={isCompleteOpen} onOpenChange={setIsCompleteOpen}>
                <DialogTrigger 
                  render={
                    <button className="h-8 bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 px-4 text-xs font-bold rounded-lg whitespace-nowrap transition-all">
                      完成交易
                    </button>
                  } 
                />
                <DialogContent className="glass-panel border-white/10 shadow-2xl bg-slate-900/90 backdrop-blur-3xl text-white">
                  <DialogHeader>
                    <DialogTitle className="font-bold text-xl text-white">結束交易並記錄最終損益</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCompleteSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-white/70">最終獲利或虧損金額 ($)</Label>
                      <Input 
                        type="number" 
                        step="0.01"
                        value={finalPnLInput}
                        onChange={e => setFinalPnLInput(e.target.value)}
                        placeholder="例如：500 或 -200"
                        className="bg-white/5 border-white/10 text-white placeholder-white/30 focus-visible:ring-emerald-500/50"
                        required 
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" className="glass-button bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-emerald-500/30 py-2 px-6">確認完成</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            ) : (
              <button onClick={handleReactivate} className="h-8 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 px-4 text-xs font-bold rounded-lg whitespace-nowrap transition-all">
                重新啟用
              </button>
            )}

            <button 
              onClick={handleDelete}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 transition-all"
              title="刪除"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </ScrollIn>

      {/* Stats Summary */}
      <ScrollIn delay={0.1}>
        <div className="w-full glass-panel bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 transition-all duration-300 hover:bg-white/10 shadow-[0_0_20px_rgba(0,0,0,0.2)]">
          <div 
            className="flex items-center justify-between cursor-pointer group"
            onClick={() => setIsStatsOpen(!isStatsOpen)}
          >
            <div className="flex items-center space-x-2 text-white">
              <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                <BarChart3 className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-base tracking-wide">庫存摘要</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-white/30 tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                {isStatsOpen ? '點擊收合' : '點擊展開'}
              </span>
              <div className="inline-flex items-center justify-center rounded-full h-8 w-8 bg-white/5 border border-white/10 text-white/50 group-hover:bg-white/10 transition-colors">
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
                <div className="grid md:grid-cols-12 gap-6 pt-4 pb-1 border-t border-white/10 mt-2">
                  <div className="md:col-span-8 grid grid-cols-2 lg:grid-cols-5 gap-4 pt-1">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">持有數量</span>
                      <span className="text-xl font-bold text-white tracking-tight">{stats.totalQuantity} <span className="text-[10px] font-normal text-white/40">股</span></span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">平均成本</span>
                      <span className="text-xl font-bold text-white tracking-tight">${stats.averagePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">已實現損益</span>
                      <span className={`text-xl font-bold tracking-tight ${stats.realizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        ${stats.realizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {tab.status === 'COMPLETED' ? (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">最終損益</span>
                        <span className={`text-xl font-bold tracking-tight ${(tab.finalPnL || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          ${tab.finalPnL?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">未實現 {tab.currentPrice ? `(${tab.currentPrice})` : ''}</span>
                        <span className={`text-xl font-bold tracking-tight ${stats.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {stats.unrealizedPnL >= 0 ? '+' : ''}{stats.unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">交易次數</span>
                      <span className="text-xl font-bold text-white tracking-tight">{trades.length} <span className="text-[10px] font-normal text-white/40">筆</span></span>
                    </div>
                  </div>

                  <div className="md:col-span-4 border-t md:border-t-0 md:border-l border-white/10 md:pl-6 pt-4 md:pt-0">
                    <form onSubmit={handlePriceUpdate} className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <Label className="text-[10px] font-medium text-white/40 pl-1">現價 $</Label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            className="bg-white/5 border-white/10 text-white font-bold text-sm h-8 focus-visible:ring-emerald-500/50 rounded-lg" 
                            placeholder="目前市價" 
                            value={currentPriceInput}
                            onChange={e => setCurrentPriceInput(e.target.value)}
                          />
                        </div>
                        <button type="submit" className="h-8 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 font-bold px-4 rounded-lg text-xs transition-all">
                          更新
                        </button>
                    </form>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollIn>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full bg-white/5 border border-white/10 p-1 rounded-xl glass-panel gap-1 overflow-x-auto scrollbar-hide">
            <TabsTrigger value="trades" className="flex-1 py-1.5 text-xs font-bold rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/30 transition-all">交易紀錄</TabsTrigger>
            <TabsTrigger value="strategy" className="flex-1 py-1.5 text-xs font-bold rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/30 transition-all">策略計畫</TabsTrigger>
            <TabsTrigger value="orders" className="flex-1 py-1.5 text-xs font-bold rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/30 transition-all">預定訂單</TabsTrigger>
            <TabsTrigger value="reports" className="flex-1 py-1.5 text-xs font-bold rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/30 transition-all">技術與關鍵報告</TabsTrigger>
            <TabsTrigger value="alerts" className="flex-1 py-1.5 text-xs font-bold rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/30 transition-all">價格警報</TabsTrigger>
          </TabsList>

        <TabsContent value="trades" className="pt-4 space-y-4 pb-20 outline-none">
           {/* Trades Content */}
           <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-4">
             <div className="flex items-center gap-2">
               <h2 className="text-xl font-bold tracking-tight text-white drop-shadow-sm">交易紀錄</h2>
               <Badge className="bg-emerald-500/10 text-emerald-400 border-none text-[10px] py-0 px-2 font-bold">{trades.length} 筆</Badge>
             </div>
             <Dialog open={isTradeOpen} onOpenChange={setIsTradeOpen}>
               <DialogTrigger 
                  render={
                    <button 
                      disabled={tab.status === 'COMPLETED'} 
                      className="h-8 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 px-4 text-xs font-bold rounded-lg whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      新增交易
                    </button>
                  } 
                />
               <DialogContent className="glass-panel border-white/10 shadow-2xl bg-slate-900/90 backdrop-blur-3xl text-white">
                 <DialogHeader><DialogTitle className="font-bold text-2xl tracking-tight text-white mb-2">新增交易紀錄</DialogTitle></DialogHeader>
                 <form onSubmit={handleTradeSubmit} className="space-y-6">
                   <div className="grid grid-cols-2 gap-5">
                     <div className="space-y-2">
                       <Label className="font-medium text-white/70">交易方向</Label>
                       <div className="flex gap-3">
                         <Select value={tradeForm.type} onValueChange={(val) => setTradeForm({...tradeForm, type: val})}>
                           <SelectTrigger className="flex-1 bg-white/5 border-white/10 text-white"><SelectValue/></SelectTrigger>
                           <SelectContent className="glass-panel border-white/10 text-white">
                             <SelectItem value="BUY" className="font-medium text-emerald-400 focus:bg-white/10 focus:text-emerald-300">BUY</SelectItem>
                             <SelectItem value="SELL" className="font-medium text-red-400 focus:bg-white/10 focus:text-red-300">SELL</SelectItem>
                           </SelectContent>
                         </Select>
                         <Select value={tradeForm.purpose} onValueChange={(val) => setTradeForm({...tradeForm, purpose: val})}>
                           <SelectTrigger className="flex-1 bg-white/5 border-white/10 text-white"><SelectValue/></SelectTrigger>
                           <SelectContent className="glass-panel border-white/10 text-white">
                             <SelectItem value="加碼" className="font-medium focus:bg-white/10 focus:text-white">加碼</SelectItem>
                             <SelectItem value="平倉" className="font-medium focus:bg-white/10 focus:text-white">平倉</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                     </div>
                     <div className="space-y-2">
                       <Label className="font-medium text-white/70">日期</Label>
                       <Input type="date" className="bg-white/5 border-white/10 text-white focus-visible:ring-emerald-500/50" required value={tradeForm.tradeDate} onChange={e => setTradeForm({...tradeForm, tradeDate: e.target.value})} />
                     </div>
                     <div className="space-y-2">
                       <Label className="font-medium text-white/70">價格</Label>
                       <Input type="number" step="0.01" className="bg-white/5 border-white/10 text-white focus-visible:ring-emerald-500/50" required value={tradeForm.price} onChange={e => setTradeForm({...tradeForm, price: e.target.value})} />
                     </div>
                     <div className="space-y-2">
                       <Label className="font-medium text-white/70">數量</Label>
                       <Input type="number" step="0.01" className="bg-white/5 border-white/10 text-white focus-visible:ring-emerald-500/50" required value={tradeForm.quantity} onChange={e => setTradeForm({...tradeForm, quantity: e.target.value})} />
                     </div>
                     <div className="space-y-2">
                       <Label className="font-medium text-white/70">操作員</Label>
                       <Select value={tradeForm.operator} onValueChange={(val) => setTradeForm({...tradeForm, operator: val})}>
                         <SelectTrigger className="w-full bg-white/5 border-white/10 text-white"><SelectValue/></SelectTrigger>
                         <SelectContent className="glass-panel border-white/10 text-white">
                           <SelectItem value="人" className="font-medium focus:bg-white/10 focus:text-white">人</SelectItem>
                           <SelectItem value="機器" className="font-medium text-red-500 focus:bg-white/10 focus:text-red-400">機器</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                     <div className="space-y-2">
                       <Label className="font-medium text-white/70">手續費 (選填)</Label>
                       <Input type="number" step="0.01" className="bg-white/5 border-white/10 text-white focus-visible:ring-emerald-500/50" value={tradeForm.fees} onChange={e => setTradeForm({...tradeForm, fees: e.target.value})} />
                     </div>
                     <div className="space-y-2 col-span-2">
                       <Label className="font-medium text-white/70">備註 (選填)</Label>
                       <Input className="bg-white/5 border-white/10 text-white focus-visible:ring-emerald-500/50" value={tradeForm.notes} onChange={e => setTradeForm({...tradeForm, notes: e.target.value})} />
                     </div>
                   </div>
                   <DialogFooter className="pt-4">
                     <button type="submit" className="glass-button bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30 px-8 py-2.5 font-bold rounded-xl w-full sm:w-auto">
                       儲存交易
                     </button>
                   </DialogFooter>
                 </form>
               </DialogContent>
             </Dialog>
           </div>

           <ScrollIn delay={0.2}>
             <div className="flex flex-col glass-panel bg-white/5 border border-white/10 rounded-2xl relative transition-all duration-300 hover:bg-white/10 hover:shadow-[0_0_20px_rgba(0,0,0,0.3)] shadow-[0_0_10px_rgba(0,0,0,0.2)] z-10 overflow-hidden">
               <div 
                  onClick={() => setIsTradeListOpen(!isTradeListOpen)}
                  className="p-5 flex items-center justify-between cursor-pointer border-b border-transparent hover:border-white/10 transition-colors group"
                >
                 <div className="flex items-center gap-4">
                   <Magnetic>
                    <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-white/70 group-hover:text-white transition-colors">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                   </Magnetic>
                   <div>
                     <h3 className="font-bold text-lg text-white">紀錄列表</h3>
                     <p className="text-xs font-medium text-white/50 mt-1">
                       共有 {trades.length} 筆交易紀錄
                     </p>
                   </div>
                 </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-white/30 tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                      {isTradeListOpen ? '收合明細' : '展開明細'}
                    </span>
                    <motion.div
                      animate={{ rotate: isTradeListOpen ? 180 : 0 }}
                      className="h-8 w-8 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/50 group-hover:bg-white/10 transition-colors"
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
                     className="overflow-hidden border-t border-white/10"
                   >
                     <div className="p-0 bg-transparent overflow-x-auto">
                       <table className="w-full text-sm text-left">
                         <thead className="text-xs text-white/60 bg-black/20 uppercase tracking-widest border-b border-white/10 font-bold">
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
                             <tr><td colSpan={6} className="px-6 py-12 text-center text-white/40 font-medium">暫無交易紀錄</td></tr>
                           ) : (
                             trades.map(t => (
                               <motion.tr 
                                 key={t.id} 
                                 layout
                                 initial={{ opacity: 0 }}
                                 animate={{ opacity: 1 }}
                                 exit={{ opacity: 0 }}
                                 className="border-b border-white/10 last:border-0 hover:bg-white/5 transition-colors text-white font-medium"
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
                                         <span className="text-[10px] font-bold text-white/40 px-1 py-0.5 rounded border border-white/10 bg-white/5">人</span>
                                       )}
                                     </div>
                                     {t.purpose && (
                                       <span className="text-[10px] text-center font-medium text-white/50 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-sm">
                                         {t.purpose}
                                       </span>
                                     )}
                                   </div>
                                 </td>
                                 <td className="px-6 py-4 whitespace-nowrap">${t.price}</td>
                                 <td className="px-6 py-4 whitespace-nowrap">{t.quantity}</td>
                                 <td className="px-6 py-4 whitespace-nowrap text-white/80">${(t.price * t.quantity).toFixed(2)}</td>
                                 <td className="px-6 py-4 text-right">
                                   <button 
                                      onClick={() => deleteTrade(t.id)} 
                                      className="text-red-400 hover:text-red-300 py-1.5 px-3 font-semibold rounded-lg hover:bg-red-500/10 transition-colors"
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

        <TabsContent value="orders" className="pt-4">
           {id && <PlannedOrdersTab tabId={id} readOnly={false} />}
        </TabsContent>
        
        <TabsContent value="reports" className="pt-4">
           {id && <ReportsTab tabId={id} />}
        </TabsContent>

        <TabsContent value="alerts" className="pt-4 space-y-6 pb-20 outline-none">
          <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-4">
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-purple-400" />
              設定價格警報 {(tab?.priceAlerts || []).filter((al: any) => al.isEnabled).length > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
              )}
            </h2>
            {tab?.currentPrice && (
              <div className="text-xs text-white/50 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                目前現價: <span className="font-bold text-emerald-400 font-mono">${tab.currentPrice}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Form to set alert */}
            <div className="lg:col-span-4 rounded-2xl bg-white/5 border border-white/10 p-5 glass-panel">
              <h3 className="font-bold text-sm text-white flex items-center gap-2 mb-4">
                <Plus className="w-4 h-4 text-purple-400" />
                新增警報條件
              </h3>
              <form onSubmit={handleAddAlert} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-white/60">觸發條件</Label>
                  <Select 
                    value={alertForm.condition} 
                    onValueChange={(val: any) => setAlertForm(prev => ({ ...prev, condition: val }))}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-lg h-9">
                      <SelectValue placeholder="選擇條件" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950 border-white/15 text-white">
                      <SelectItem value="above_or_equal">{"當價格高於或等於 (>=)"}</SelectItem>
                      <SelectItem value="below_or_equal">{"當價格低於或等於 (<=)"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-white/60">目標價格 $</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="bg-white/5 border-white/10 text-white h-9 rounded-lg"
                    placeholder={tab?.currentPrice ? `例如: ${(tab.currentPrice * 1.05).toFixed(2)}` : "輸入目標價格"}
                    value={alertForm.targetPrice}
                    onChange={(e) => setAlertForm(prev => ({ ...prev, targetPrice: e.target.value }))}
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <Label className="text-xs font-medium text-white/60">警報管道</Label>
                  
                  <div className="flex items-center justify-between rounded-lg bg-white/5 p-2.5 border border-white/5">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-purple-400" />
                        瀏覽器桌面通知
                      </span>
                      <span className="text-[10px] text-white/50">網頁開啟時發出通知與音效</span>
                    </div>
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-white/10 bg-white/5 accent-purple-500 cursor-pointer"
                      checked={alertForm.notifyBrowser}
                      onChange={(e) => setAlertForm(prev => ({ ...prev, notifyBrowser: e.target.checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-white/5 p-2.5 border border-white/5">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-blue-400" />
                        電子信箱警報
                      </span>
                      <span className="text-[10px] text-white/50">發送警報郵件至指定信箱</span>
                    </div>
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-white/10 bg-white/5 accent-purple-500 cursor-pointer"
                      checked={alertForm.notifyEmail}
                      onChange={(e) => setAlertForm(prev => ({ ...prev, notifyEmail: e.target.checked }))}
                    />
                  </div>
                </div>

                {alertForm.notifyEmail && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <Label className="text-xs font-medium text-white/60">電子信箱位址</Label>
                    <Input
                      type="email"
                      className="bg-white/5 border-white/10 text-white h-9 rounded-lg text-xs"
                      placeholder="請輸入 Email"
                      value={alertForm.emailAddress}
                      onChange={(e) => setAlertForm(prev => ({ ...prev, emailAddress: e.target.value }))}
                    />
                  </div>
                )}

                <Button 
                  type="submit"
                  className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold h-9 text-xs rounded-lg mt-2 cursor-pointer"
                >
                  設定警報
                </Button>
              </form>
            </div>

            {/* Right Column: Alert list & history */}
            <div className="lg:col-span-8 space-y-6">
              {/* Active Alerts */}
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5 glass-panel">
                <h3 className="font-bold text-sm text-white flex items-center justify-between gap-2 mb-4">
                  <span className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-purple-400 animate-pulse" />
                    目前警報清單
                  </span>
                  <Badge className="bg-purple-500/10 text-purple-400 border-none text-[10px] py-0.5 px-2 font-bold select-none">
                    {(tab?.priceAlerts || []).length} 項
                  </Badge>
                </h3>

                {(tab?.priceAlerts || []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center rounded-xl border border-dashed border-white/5">
                    <Bell className="w-8 h-8 text-white/10 mb-2" />
                    <p className="text-xs font-bold text-white/40">此個股尚未設定任何價格警報</p>
                    <p className="text-[10px] text-white/30 max-w-xs mt-1">您可以使用左側表單設定股票價格的達標提醒</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {(tab?.priceAlerts || []).map((alert: any) => (
                      <div 
                        key={alert.id}
                        className={`flex items-center justify-between rounded-xl p-3 border border-white/5 transition-all ${
                          alert.isEnabled 
                            ? 'bg-white/5' 
                            : 'bg-white/[0.01] border-dashed border-white/5 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${alert.isEnabled ? 'bg-purple-500/10 text-purple-400' : 'bg-white/5 text-white/30'}`}>
                            <Bell className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white">
                                觸發：股價 {alert.condition === "above_or_equal" ? "≥" : "≤"} <span className="text-purple-400 font-mono text-base font-black">${alert.targetPrice}</span>
                              </span>
                              {!alert.isEnabled && (
                                <Badge className="bg-white/5 text-white/40 border-none text-[9px] py-0 px-1 font-bold">
                                  {alert.triggeredAt ? "已觸發" : "已停用"}
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-white/45 flex items-center gap-3 mt-1 font-mono">
                              <span>設於: {new Date(alert.createdAt).toLocaleString()}</span>
                              <span className="flex items-center gap-1 text-white/35">
                                [
                                {alert.notifyBrowser && <span className="text-purple-400/80">Browser</span>}
                                {alert.notifyBrowser && alert.notifyEmail && <span>|</span>}
                                {alert.notifyEmail && <span className="text-blue-400/80">Email</span>}
                                ]
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleAlert(alert.id, alert.isEnabled)}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                              alert.isEnabled
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20'
                                : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10'
                            }`}
                          >
                            {alert.isEnabled ? '已啟用' : '已停用'}
                          </button>
                          <button
                            onClick={() => handleDeleteAlert(alert.id)}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-1.5 rounded-lg border border-red-500/20 transition-all cursor-pointer"
                            title="刪除警報"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Symbol Trigger History */}
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5 glass-panel">
                <h3 className="font-bold text-sm text-white flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-emerald-400" />
                  此個股警報觸發記錄
                </h3>

                {alertHistory.filter((h: any) => h.symbol === tab?.symbol).length === 0 ? (
                  <div className="py-5 text-center text-xs text-white/30 rounded-xl border border-dashed border-white/5">
                    尚無觸發紀錄。當股價跨越設定門檻時，觸發紀錄將呈現於此。
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {alertHistory
                      .filter((h: any) => h.symbol === tab?.symbol)
                      .map((log: any) => (
                        <div key={log.id} className="bg-emerald-500/[0.02] border border-emerald-500/10 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                              <span className="text-emerald-400">● 已觸發</span>
                              價格門檻: 股價 {log.condition === "above_or_equal" ? "≥" : "≤"} ${log.targetPrice.toFixed(2)}
                            </p>
                            <p className="text-[10px] text-white/50">
                              觸發當時現價: <span className="font-bold text-white">${log.triggeredPrice.toFixed(2)}</span>
                            </p>
                            <p className="text-[10px] text-white/40 font-mono">
                              時間: {new Date(log.triggeredAt).toLocaleString()}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-1 flex-wrap sm:flex-nowrap">
                            {log.channels?.browser && (
                              <Badge className="bg-purple-500/10 text-purple-400 border-none text-[9px] font-semibold py-0.5 px-1.5 select-none rounded">
                                Browser 通知
                              </Badge>
                            )}
                            {log.channels?.email && (
                              <Badge className="bg-blue-500/10 text-blue-400 border-none text-[9px] font-semibold py-0.5 px-1.5 select-none rounded" title={`已發信至 ${log.channels?.emailAddr}`}>
                                Email 警報
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
