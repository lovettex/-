import React, { useState } from 'react';
import { usePlannedOrders } from '../hooks/usePlannedOrders';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { Clock } from 'lucide-react';

export default function PlannedOrdersTab({ tabId, readOnly }: { tabId: string, readOnly: boolean }) {
  const { orders, addOrder, updateOrderStatus, deleteOrder, toggleHighlight } = usePlannedOrders(tabId);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    direction: 'BUY',
    purpose: '加碼',
    category: '未分類',
    price: '',
    quantity: '',
    conditions: '',
    plannedDate: ''
  });

  const [isOrderListOpen, setIsOrderListOpen] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addOrder({
      direction: form.direction as 'BUY' | 'SELL',
      purpose: form.purpose as '加碼' | '平倉',
      category: form.category as any,
      price: Number(form.price),
      quantity: Number(form.quantity),
      conditions: form.conditions,
      plannedDate: form.plannedDate ? Timestamp.fromDate(new Date(form.plannedDate)) : undefined,
    });
    setIsOpen(false);
    setForm({ direction: 'BUY', purpose: '加碼', category: '未分類', price: '', quantity: '', conditions: '', plannedDate: '' });
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-4">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-white/30 uppercase">Planned Orders</p>
          <h2 className="text-xl font-bold tracking-tight text-white/90">預定操作訂單</h2>
        </div>
        {!readOnly && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger 
              render={
                <button className="h-8 bg-white/10 hover:bg-white/20 text-white px-4 rounded-lg transition-all border border-white/10 font-bold text-xs">
                  新增訂單
                </button>
              } 
            />
            <DialogContent className="border border-white/10 bg-[#121212]/95 backdrop-blur-xl rounded-2xl shadow-2xl">
              <DialogHeader><DialogTitle className="font-semibold text-xl text-white/90">新增預定操作</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-medium text-white/70">類別</Label>
                    <Select value={form.category} onValueChange={(val) => setForm({...form, category: val})}>
                      <SelectTrigger className="w-full border border-white/10 bg-white/5 rounded-md font-medium text-white/90 focus:ring-emerald-500/50"><SelectValue/></SelectTrigger>
                      <SelectContent className="border border-white/10 bg-[#121212]/90 backdrop-blur-md">
                        <SelectItem value="止損設定" className="font-medium text-[#D6B2AB]">止損設定</SelectItem>
                        <SelectItem value="止盈設定" className="font-medium text-emerald-400">止盈設定</SelectItem>
                        <SelectItem value="分批進出場規劃" className="font-medium text-blue-400">分批進出場規劃</SelectItem>
                        <SelectItem value="支撐門檻" className="font-medium text-blue-400">支撐門檻 (Support)</SelectItem>
                        <SelectItem value="壓力門檻" className="font-medium text-amber-400">壓力門檻 (Resistance)</SelectItem>
                        <SelectItem value="未分類" className="font-medium text-white/60">未分類</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium text-white/70">方向 & 目的</Label>
                    <div className="flex gap-2">
                      <Select value={form.direction} onValueChange={(val) => setForm({...form, direction: val})}>
                        <SelectTrigger className="flex-1 border border-white/10 bg-white/5 rounded-md font-medium text-white/90"><SelectValue/></SelectTrigger>
                        <SelectContent className="border border-white/10 bg-[#121212]/90 backdrop-blur-md">
                          <SelectItem value="BUY" className="font-medium text-white/90">買入</SelectItem>
                          <SelectItem value="SELL" className="font-medium text-white/90">賣出</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={form.purpose} onValueChange={(val) => setForm({...form, purpose: val})}>
                        <SelectTrigger className="flex-1 border border-white/10 bg-white/5 rounded-md font-medium text-white/90"><SelectValue/></SelectTrigger>
                        <SelectContent className="border border-white/10 bg-[#121212]/90 backdrop-blur-md">
                          <SelectItem value="加碼" className="font-medium text-white/90">加碼</SelectItem>
                          <SelectItem value="平倉" className="font-medium text-white/90">平倉</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium text-white/70">價格目標 (選填)</Label>
                    <Input type="number" step="0.01" className="border border-white/10 bg-white/5 rounded-md font-medium text-white/90" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium text-white/70">數量</Label>
                    <Input type="number" step="0.01" className="border border-white/10 bg-white/5 rounded-md font-medium text-white/90" required value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium text-white/70">預定日期 (選填)</Label>
                    <Input type="date" className="border border-white/10 bg-white/5 rounded-md font-medium text-white/90" value={form.plannedDate} onChange={e => setForm({...form, plannedDate: e.target.value})} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label className="font-medium text-white/70">觸發條件 / 備註</Label>
                    <Input className="border border-white/10 bg-white/5 rounded-md font-medium text-white/90" value={form.conditions} onChange={e => setForm({...form, conditions: e.target.value})} placeholder="例如：若開盤跳空則取消..." />
                  </div>
                </div>
                <DialogFooter><Button type="submit" className="bg-white/10 hover:bg-white/20 text-white border border-white/10 font-medium rounded-xl">儲存</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Integrated Order Display Card */}
      <div className="flex flex-col border border-white/10 rounded-2xl bg-white/5 backdrop-blur-xl relative transition-all duration-300 z-10 overflow-hidden shadow-lg shadow-black/20">
        <div 
          onClick={() => setIsOrderListOpen(!isOrderListOpen)}
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors border-b border-white/10"
        >
          <div className="flex items-center gap-3">
             <div className="bg-purple-500/20 p-2 rounded-lg border border-purple-500/30">
               <Clock className="h-5 w-5 text-purple-400" />
             </div>
             <div>
               <h3 className="font-bold text-lg text-white/90 tracking-tight">預定訂單 ({orders.length})</h3>
               <p className="text-xs font-medium text-white/40">
                 待執行 {orders.filter(o => o.status === 'PENDING').length} 筆
               </p>
             </div>
          </div>
          <span className="text-xs font-bold text-white/30 whitespace-nowrap bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
            {isOrderListOpen ? '收合 ↑' : '展開 ↓'}
          </span>
        </div>
        
        <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${isOrderListOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="p-5 space-y-8">
              {orders.length === 0 ? (
                <div className="py-12 text-center text-white/20 italic font-medium">暫無任何預定操作訂單</div>
              ) : (
                ['止損設定', '止盈設定', '分批進出場規劃', '支撐門檻', '壓力門檻', '未分類'].map(category => {
                  const categoryOrders = orders.filter(o => (o.category || '未分類') === category);
                  if (categoryOrders.length === 0) return null;
                  
                  const categoryColors = {
                    '止損設定': 'text-[#D6B2AB]',
                    '止盈設定': 'text-emerald-400',
                    '分批進出場規劃': 'text-blue-400',
                    '支撐門檻': 'text-blue-400',
                    '壓力門檻': 'text-amber-400',
                    '未分類': 'text-white/40'
                  };
                  
                  const categoryDisplayNames = {
                    '止損設定': '止損設定',
                    '止盈設定': '止盈設定',
                    '分批進出場規劃': '分批進出場規劃',
                    '支撐門檻': '支撐門檻',
                    '壓力門檻': '壓力門檻',
                    '未分類': '未分類'
                  };
                  
                  return (
                    <div key={category} className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-1 h-3 rounded-full ${
                          category === '止損設定' ? 'bg-[#D6B2AB]' :
                          category === '止盈設定' ? 'bg-emerald-500' :
                          category === '分批進出場規劃' ? 'bg-blue-500' :
                          category === '支撐門檻' ? 'bg-blue-500' :
                          category === '壓力門檻' ? 'bg-amber-500' : 'bg-white/20'
                        }`} />
                        <h4 className={`text-sm font-black tracking-widest ${categoryColors[category as keyof typeof categoryColors] || 'text-white/60'}`}>
                          • [{categoryDisplayNames[category as keyof typeof categoryDisplayNames] || category}]
                        </h4>
                      </div>
                      
                      <div className="flex flex-wrap gap-3">
                        {categoryOrders.map(o => {
                          const isHighlighted = o.isManualHighlight;
                          return (
                          <div 
                            key={o.id} 
                            onDoubleClick={() => !readOnly && toggleHighlight(o.id, o.isManualHighlight)}
                            className={`group relative flex items-stretch border border-white/10 rounded-xl overflow-hidden transition-all min-w-[240px] max-w-[320px] shrink-0 select-none cursor-pointer ${
                              isHighlighted 
                                ? 'bg-[#ED8900] border-transparent shadow-[0_0_20px_rgba(237,137,0,0.3)]' 
                                : 'bg-white/[0.02] hover:bg-white/[0.05]'
                            } ${o.status !== 'PENDING' ? 'opacity-40 grayscale-[0.5]' : ''}`}
                          >
                            {/* Direction Indicator Column */}
                            <div className={`w-12 sm:w-16 flex flex-col items-center justify-center border-r border-white/10 ${
                              isHighlighted 
                                ? 'bg-black/5'
                                : (o.category === '支撐門檻' 
                                    ? 'bg-blue-500/20' 
                                    : o.category === '壓力門檻'
                                      ? 'bg-amber-500/20'
                                      : o.category === '止損設定' ? 'bg-[#D6B2AB]/10' : o.direction === 'BUY' ? 'bg-blue-500/10' : 'bg-rose-500/10')
                            }`}>
                              <span className={`text-[11px] font-black tracking-tighter ${
                                isHighlighted 
                                  ? 'text-[#0F0F0F]'
                                  : (o.category === '支撐門檻'
                                      ? 'text-blue-400'
                                      : o.category === '壓力門檻'
                                        ? 'text-amber-400'
                                        : o.category === '止損設定' ? 'text-[#D6B2AB]' : o.direction === 'BUY' ? 'text-blue-400' : 'text-rose-400')
                              }`}>
                                {o.category === '支撐門檻' 
                                  ? '支撐'
                                  : o.category === '壓力門檻'
                                    ? '壓力'
                                    : (o.direction === 'BUY' ? '買入' : '賣出')}
                              </span>
                              <span className={`text-[9px] font-bold truncate px-1 uppercase ${isHighlighted ? 'text-[#0F0F0F]/60' : 'text-white/30'}`}>
                                {(o.category === '支撐門檻' || o.category === '壓力門檻') ? '門檻' : (o.purpose || '操作')}
                              </span>
                            </div>

                            {/* Content Column */}
                            <div className="flex-1 p-3 flex flex-col justify-center gap-0.5">
                              <div className="flex items-baseline justify-between gap-4">
                                <span className={`text-xl font-black tracking-tighter tabular-nums ${isHighlighted ? 'text-[#0F0F0F]' : 'text-white/90'}`}>
                                  ${o.price?.toLocaleString()}
                                </span>
                                <span className={`text-xs font-bold ${isHighlighted ? 'text-[#0F0F0F]/60' : 'text-white/40'}`}>
                                  {o.quantity}股
                                </span>
                              </div>
                              
                              {o.conditions ? (
                                <div className={`text-[10px] font-bold italic line-clamp-1 group-hover:line-clamp-none transition-all ${isHighlighted ? 'text-[#0F0F0F]/80' : 'text-emerald-400/80'}`}>
                                  [{o.conditions}]
                                </div>
                              ) : (
                                <div className="h-4" />
                              )}

                              {o.plannedDate && (
                                <div className={`text-[9px] font-medium flex items-center gap-1 mt-1 ${isHighlighted ? 'text-[#0F0F0F]/40' : 'text-white/20'}`}>
                                  <Clock className="w-2.5 h-2.5" />
                                  {format(o.plannedDate.toDate(), 'yyyy/MM/dd')}
                                </div>
                              )}
                            </div>

                            {/* Actions Overlay */}
                            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!readOnly && (
                                <>
                                  <Select 
                                    value={o.status} 
                                    onValueChange={(val: any) => updateOrderStatus(o.id, val)}
                                  >
                                    <SelectTrigger className="h-6 w-16 text-[9px] font-bold bg-[#121212]/80 border-white/10 rounded px-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#121212] border-white/10 text-[10px]">
                                      <SelectItem value="PENDING">待執行</SelectItem>
                                      <SelectItem value="COMPLETED">已完成</SelectItem>
                                      <SelectItem value="CANCELLED">取消</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <button 
                                    onClick={() => deleteOrder(o.id)}
                                    className="h-6 px-1.5 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 text-[9px] font-black border border-rose-500/20 transition-all"
                                  >
                                    刪除
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )})}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
