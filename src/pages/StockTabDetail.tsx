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
import { Trash2, BarChart3, ChevronDown, ChevronUp, Gamepad2, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ScrollIn, InteractiveButton, Magnetic } from '../components/MotionWrappers';
import StrategyTab from '../components/StrategyTab';
import PlannedOrdersTab from '../components/PlannedOrdersTab';
import ReportsTab from '../components/ReportsTab';

export default function StockTabDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tabs, updateTabStatus, updateCurrentPrice, updateTradeType, updateTab, deleteTab } = useStockTabs();
  const { trades, addTrade, deleteTrade } = useTrades(id);

  const tab = tabs.find(t => t.id === id);

  const [tradeForm, setTradeForm] = useState({
    type: 'BUY',
    purpose: '加碼',
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

  // Update currentPriceInput when tab data loads or changes
  React.useEffect(() => {
    if (tab?.currentPrice !== undefined) {
      setCurrentPriceInput(tab.currentPrice.toString());
    }
  }, [tab?.id, tab?.currentPrice]);

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
        <div className="glass-panel border border-white/10 bg-white/5 p-4 rounded-2xl shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 md:gap-8">
            <div>
              <div className="flex items-center gap-2">
                <motion.h1 
                  layoutId="tab-title"
                  className="text-2xl font-bold tracking-tight text-white"
                >
                  {tab.symbol}
                </motion.h1>
                {tab.status === 'ACTIVE' ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold text-[10px] px-2 py-0 rounded-full">ACTIVE</Badge>
                ) : (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-bold text-[10px] px-2 py-0 rounded-full">COMPLETED</Badge>
                )}
              </div>
              <p className="text-white/40 text-[10px] tracking-wider truncate max-w-[120px]">{tab.companyName}</p>
            </div>

            <div className="h-8 w-px bg-white/10 hidden md:block" />

            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest leading-tight">Avg Cost</span>
                <span className="text-lg font-bold text-white tracking-tight">${stats.averagePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest leading-tight">Total Shares</span>
                <span className="text-lg font-bold text-white tracking-tight">{stats.totalQuantity} <span className="text-[10px] text-white/40 font-normal">股</span></span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest leading-tight">評分</span>
                <Select value={String(tab.rating || 5)} onValueChange={(val) => updateTab(tab.id, { rating: Number(val) })}>
                  <SelectTrigger className="h-7 w-12 bg-white/5 border-white/10 text-white font-bold text-[11px] ring-0 focus:ring-emerald-500/50 rounded-md p-1">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/10 text-white min-w-[50px]">
                    {[...Array(10)].map((_, i) => (
                      <SelectItem key={i+1} value={String(i+1)} className="text-xs focus:bg-white/10">{i+1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest leading-tight">Quality</span>
                <Select value={String(tab.qualityScore || 5)} onValueChange={(val) => updateTab(tab.id, { qualityScore: Number(val) })}>
                  <SelectTrigger className="h-7 w-12 bg-white/5 border-white/10 text-white font-bold text-[11px] ring-0 focus:ring-purple-500/50 rounded-md p-1">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/10 text-white min-w-[50px]">
                    {[...Array(10)].map((_, i) => (
                      <SelectItem key={i+1} value={String(i+1)} className="text-xs focus:bg-white/10">{i+1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest leading-tight">Value</span>
                <Select value={String(tab.valueScore || 5)} onValueChange={(val) => updateTab(tab.id, { valueScore: Number(val) })}>
                  <SelectTrigger className="h-7 w-12 bg-white/5 border-white/10 text-white font-bold text-[11px] ring-0 focus:ring-amber-500/50 rounded-md p-1">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/10 text-white min-w-[50px]">
                    {[...Array(10)].map((_, i) => (
                      <SelectItem key={i+1} value={String(i+1)} className="text-xs focus:bg-white/10">{i+1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest leading-tight">Buy Rate</span>
                <Select value={String(tab.buyRate || 5)} onValueChange={(val) => updateTab(tab.id, { buyRate: Number(val) })}>
                  <SelectTrigger className="h-7 w-12 bg-white/5 border-white/10 text-white font-bold text-[11px] ring-0 focus:ring-emerald-500/50 rounded-md p-1">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/10 text-white min-w-[50px]">
                    {[...Array(10)].map((_, i) => (
                      <SelectItem key={i+1} value={String(i+1)} className="text-xs focus:bg-white/10">{i+1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest leading-tight">Sell Rate</span>
                <Select value={String(tab.sellRate || 5)} onValueChange={(val) => updateTab(tab.id, { sellRate: Number(val) })}>
                  <SelectTrigger className="h-7 w-12 bg-white/5 border-white/10 text-white font-bold text-[11px] ring-0 focus:ring-red-500/50 rounded-md p-1">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/10 text-white min-w-[50px]">
                    {[...Array(10)].map((_, i) => (
                      <SelectItem key={i+1} value={String(i+1)} className="text-xs focus:bg-white/10">{i+1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest leading-tight">波動性</span>
                <Select value={tab.volatility || '中等'} onValueChange={(val: any) => updateTab(tab.id, { volatility: val })}>
                  <SelectTrigger className="h-7 w-14 bg-white/5 border-white/10 text-white font-bold text-[10px] ring-0 focus:ring-emerald-500/50 rounded-md p-1">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/10 text-white">
                    <SelectItem value="低" className="text-xs text-blue-400 focus:bg-white/10">低</SelectItem>
                    <SelectItem value="中等" className="text-xs text-amber-400 focus:bg-white/10">中等</SelectItem>
                    <SelectItem value="高" className="text-xs text-red-400 focus:bg-white/10">高</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest leading-tight">短期影響</span>
                <Select value={tab.shortTermImpact || '觀察'} onValueChange={(val: any) => updateTab(tab.id, { shortTermImpact: val })}>
                  <SelectTrigger className="h-7 w-14 bg-white/5 border-white/10 text-white font-bold text-[10px] ring-0 focus:ring-emerald-500/50 rounded-md p-1">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/10 text-white">
                    <SelectItem value="看多" className="text-xs text-emerald-400 focus:bg-white/10">看多</SelectItem>
                    <SelectItem value="觀察" className="text-xs text-amber-400 focus:bg-white/10">觀察</SelectItem>
                    <SelectItem value="看空" className="text-xs text-red-400 focus:bg-white/10">看空</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest leading-tight">長期展望</span>
                <Select value={tab.longTermOutlook || '觀察'} onValueChange={(val: any) => updateTab(tab.id, { longTermOutlook: val })}>
                  <SelectTrigger className="h-7 w-14 bg-white/5 border-white/10 text-white font-bold text-[10px] ring-0 focus:ring-emerald-500/50 rounded-md p-1">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/10 text-white">
                    <SelectItem value="看多" className="text-xs text-emerald-400 focus:bg-white/10">看多</SelectItem>
                    <SelectItem value="觀察" className="text-xs text-amber-400 focus:bg-white/10">觀察</SelectItem>
                    <SelectItem value="看空" className="text-xs text-red-400 focus:bg-white/10">看空</SelectItem>
                  </SelectContent>
                </Select>
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
          <TabsList className="flex w-full bg-white/5 border border-white/10 p-1 rounded-xl glass-panel gap-1">
            <TabsTrigger value="trades" className="flex-1 py-1.5 text-xs font-bold rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/30 transition-all">交易紀錄</TabsTrigger>
            <TabsTrigger value="strategy" className="flex-1 py-1.5 text-xs font-bold rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/30 transition-all">策略計畫</TabsTrigger>
            <TabsTrigger value="orders" className="flex-1 py-1.5 text-xs font-bold rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/30 transition-all">預定訂單</TabsTrigger>
            <TabsTrigger value="reports" className="flex-1 py-1.5 text-xs font-bold rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/30 transition-all">技術與關鍵報告</TabsTrigger>
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
                     <div className="space-y-2 col-span-2">
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
                                     <span className={`px-2 py-0.5 text-[10px] tracking-wider rounded-md font-bold ${t.type === 'BUY' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                       {t.type}
                                     </span>
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
           {id && <StrategyTab tabId={id} readOnly={tab.status === 'COMPLETED'} />}
        </TabsContent>

        <TabsContent value="orders" className="pt-4">
           {id && <PlannedOrdersTab tabId={id} readOnly={tab.status === 'COMPLETED'} />}
        </TabsContent>
        
        <TabsContent value="reports" className="pt-4">
           {id && <ReportsTab tabId={id} />}
        </TabsContent>

      </Tabs>
    </div>
  );
}
