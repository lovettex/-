import React, { useState } from 'react';
import { usePlannedOrders } from '../hooks/usePlannedOrders';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';

export default function PlannedOrdersTab({ tabId, readOnly }: { tabId: string; readOnly: boolean }) {
  const { orders, addOrder, updateOrderStatus, deleteOrder } = usePlannedOrders(tabId);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ direction: 'BUY', purpose: '加碼', category: '未分類', price: '', quantity: '', conditions: '', plannedDate: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addOrder({
      direction: form.direction as 'BUY' | 'SELL',
      purpose: form.purpose as any,
      category: form.category as any,
      price: Number(form.price),
      quantity: Number(form.quantity),
      conditions: form.conditions,
      plannedDate: form.plannedDate ? new Date(form.plannedDate).toISOString() : undefined,
    });
    setIsOpen(false);
    setForm({ direction: 'BUY', purpose: '加碼', category: '未分類', price: '', quantity: '', conditions: '', plannedDate: '' });
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex justify-end">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button variant="outline">新增預定訂單</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>新增預定訂單</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>方向</Label><Select value={form.direction} onValueChange={v => setForm({...form, direction: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BUY">買入</SelectItem><SelectItem value="SELL">賣出</SelectItem></SelectContent></Select></div>
                  <div><Label>目的</Label><Select value={form.purpose} onValueChange={v => setForm({...form, purpose: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="加碼">加碼</SelectItem><SelectItem value="平倉">平倉</SelectItem></SelectContent></Select></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>價格</Label><Input type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required /></div>
                  <div><Label>數量</Label><Input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} required /></div>
                </div>
                <div><Label>條件</Label><Input value={form.conditions} onChange={e => setForm({...form, conditions: e.target.value})} placeholder="選擇條件" /></div>
                <div><Label>計畫日期</Label><Input type="date" value={form.plannedDate} onChange={e => setForm({...form, plannedDate: e.target.value})} /></div>
                <DialogFooter><Button type="submit">儲存</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <div className="space-y-2">
        {orders.length === 0 ? <p className="text-sm text-zinc-500 text-center py-8">尚無預定訂單</p> : orders.map(order => (
          <div key={order.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-200">
            <div className="flex items-center gap-3">
              <span className={`font-bold text-sm px-2 py-1 rounded ${order.direction === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{order.direction === 'BUY' ? '買' : '賣'}</span>
              <div>
                <div className="font-semibold text-sm">${order.price} × {order.quantity} 股</div>
                <div className="text-xs text-zinc-500 flex items-center gap-2">
                  {order.purpose && <span>{order.purpose}</span>}
                  {order.category && <span>· {order.category}</span>}
                  {order.plannedDate && <><Clock className="h-3 w-3" /><span>{format(new Date(order.plannedDate), 'yyyy/MM/dd')}</span></>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {order.status === 'PENDING' && <>
                <Button size="sm" variant="ghost" className="text-emerald-600" onClick={() => updateOrderStatus(order.id, 'COMPLETED')}>完成</Button>
                <Button size="sm" variant="ghost" className="text-zinc-500" onClick={() => updateOrderStatus(order.id, 'CANCELLED')}>取消</Button>
                {!readOnly && <Button size="sm" variant="ghost" className="text-rose-500" onClick={() => deleteOrder(order.id)}>刪除</Button>}
              </>}
              {order.status === 'COMPLETED' && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-semibold">已完成</span>}
              {order.status === 'CANCELLED' && <span className="text-xs bg-zinc-200 text-zinc-500 px-2 py-0.5 rounded font-semibold">已取消</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
