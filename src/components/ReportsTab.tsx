import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, doc, onSnapshot, setDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { DailyReport } from '../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, FileText, Link as LinkIcon, Info, X, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

import { Dialog, DialogContent } from './ui/dialog';

interface ReportsTabProps {
  tabId: string;
}

export default function ReportsTab({ tabId }: ReportsTabProps) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);

  const [url1, setUrl1] = useState('');
  const [url2, setUrl2] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'stockTabs', tabId, 'dailyReports'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyReport));
      setReports(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `stockTabs/${tabId}/dailyReports`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tabId]);

  useEffect(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const existing = reports.find(r => r.id === dateStr);
    if (existing) {
      setUrl1(existing.pdfUrl1 || '');
      setUrl2(existing.pdfUrl2 || '');
    } else {
      setUrl1('');
      setUrl2('');
    }
  }, [selectedDate, reports]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    try {
      const path = `stockTabs/${tabId}/dailyReports/${dateStr}`;
      await setDoc(doc(db, 'stockTabs', tabId, 'dailyReports', dateStr), {
        pdfUrl1: url1,
        pdfUrl2: url2,
        updatedAt: serverTimestamp()
      });
      toast.success('報告連結已儲存');
    } catch (err) {
      console.warn(err);
      toast.error('儲存失敗');
      handleFirestoreError(err, OperationType.WRITE, `stockTabs/${tabId}/dailyReports/${dateStr}`);
    }
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    try {
      if (url.includes('drive.google.com')) {
        if (url.includes('/view')) {
          return url.replace('/view', '/preview').split('?')[0];
        }
        if (url.includes('/file/d/')) {
          const parts = url.split('/file/d/');
          const id = parts[1].split('/')[0];
          return `https://drive.google.com/file/d/${id}/preview`;
        }
      }
      return url;
    } catch (e) {
      return url;
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const hasReport = (date: Date) => {
    const dStr = format(date, 'yyyy-MM-dd');
    return reports.some(r => r.id === dStr && (r.pdfUrl1 || r.pdfUrl2));
  };

  return (
    <div className="space-y-6">
      <Dialog open={!!fullscreenUrl} onOpenChange={(open) => !open && setFullscreenUrl(null)}>
        <DialogContent className="max-w-[100vw] w-screen h-screen md:max-w-[98vw] md:w-[98vw] md:h-[98vh] p-0 border border-white/10 rounded-2xl bg-[#121212]/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden z-[200] sm:max-w-none">
          <div className="flex items-center justify-between p-4 bg-white/5 border-b border-white/10">
            <span className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2 text-white/90">
              <FileText className="h-4 w-4 text-blue-400" /> 報告沉浸式閱讀
            </span>
            <button onClick={() => setFullscreenUrl(null)} className="text-white/50 hover:text-white/90 transition-colors">
               <X className="h-5 w-5" />
            </button>
          </div>
          {fullscreenUrl && (
            <iframe 
              src={getEmbedUrl(fullscreenUrl)} 
              className="w-full h-full flex-1"
              title="Fullscreen PDF Preview"
              allow="autoplay"
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="flex flex-col lg:flex-row gap-8 items-start relative z-10">
        {/* Left: Calendar */}
        <div className="w-full lg:w-[400px] shrink-0">
          <div className="border border-white/10 bg-white/5 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/20 overflow-hidden">
            <div className="bg-white/5 border-b border-white/10 text-white/90 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-blue-400" />
                <h3 className="font-semibold tracking-tight">{format(currentMonth, 'yyyy年 MM月')}</h3>
              </div>
              <div className="flex gap-2 text-white/60">
                <button onClick={prevMonth} className="p-1 hover:bg-white/10 hover:text-white/90 rounded-lg transition-colors"><ChevronLeft className="h-5 w-5" /></button>
                <button onClick={nextMonth} className="p-1 hover:bg-white/10 hover:text-white/90 rounded-lg transition-colors"><ChevronRight className="h-5 w-5" /></button>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-white/10 bg-white/5">
              {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                <div key={d} className="text-center py-3 text-[11px] font-medium text-white/40">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 bg-transparent p-2 gap-1 relative z-10">
              {calendarDays.map((day, i) => {
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, monthStart);
                const hasData = hasReport(day);

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(day)}
                    className={`
                      h-12 w-full rounded-xl flex flex-col items-center justify-center relative transition-all duration-300
                      ${!isCurrentMonth ? 'text-white/20' : 'text-white/80'}
                      ${isSelected ? 'bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'hover:bg-white/10 border border-transparent'}
                    `}
                  >
                    <span className="text-sm">{format(day, 'd')}</span>
                    {hasData && (
                      <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-blue-400' : 'bg-white/40'}`}></div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl backdrop-blur-md">
             <div className="flex gap-3 items-start">
               <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
               <p className="text-xs font-medium text-blue-200/80 leading-relaxed">
                 請輸入 Google Drive 分享連結。系統會自動轉為預覽模式顯示。請確保連結權限為「任何知道連結的使用者」。
               </p>
             </div>
          </div>
        </div>

        {/* Right: Form */}
        <div className="flex-1 w-full h-full">
          <div className="border border-white/10 bg-white/5 backdrop-blur-xl rounded-2xl p-6 shadow-lg shadow-black/20 h-full flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-semibold mb-6 flex items-center gap-2 text-white/90">
                <FileText className="h-6 w-6 text-blue-400" />
                報告詳情 - <span className="text-white/60">{format(selectedDate, 'yyyy/MM/dd')}</span>
              </h3>

              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="font-medium text-sm flex items-center gap-2 text-white/70">
                      <LinkIcon className="h-4 w-4 opacity-70" /> 關鍵報告 1 (PDF)
                    </Label>
                    <Input 
                      value={url1}
                      onChange={e => setUrl1(e.target.value)}
                      placeholder="貼上 Google Drive 連結..."
                      className="border border-white/10 bg-white/5 rounded-xl font-medium focus-visible:ring-0 focus-visible:border-white/30 transition-colors text-white/90"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="font-medium text-sm flex items-center gap-2 text-white/70">
                      <LinkIcon className="h-4 w-4 opacity-70" /> 關鍵報告 2 (PDF)
                    </Label>
                    <Input 
                      value={url2}
                      onChange={e => setUrl2(e.target.value)}
                      placeholder="貼上 Google Drive 連結..."
                      className="border border-white/10 bg-white/5 rounded-xl font-medium focus-visible:ring-0 focus-visible:border-white/30 transition-colors text-white/90"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-6 mt-auto">
                  <Button type="submit" className="font-medium bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-xl transition-all px-8 py-2 h-auto text-sm">更新連結並儲存</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Previews Bottom Section */}
      {(url1 || url2) ? (
        <div className="mt-8 space-y-8 relative z-10">
          {url1 && (
            <div className="group relative flex flex-col border border-white/10 rounded-2xl overflow-hidden shadow-lg shadow-black/20 bg-white/5 backdrop-blur-md h-[800px] lg:h-[900px]">
              <div className="bg-white/5 p-4 border-b border-white/10 text-xs font-semibold flex justify-between items-center text-white/90">
                <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-blue-400" /> 報告預覽 1</span>
                <button onClick={() => setFullscreenUrl(url1)} className="text-white/50 hover:text-white/90 transition-colors flex items-center gap-1">
                  <Maximize2 className="h-4 w-4" /> 全螢幕
                </button>
              </div>
              <div className="relative flex-1 overflow-hidden">
                <iframe 
                  src={getEmbedUrl(url1)} 
                  className="w-full h-full pointer-events-none opacity-[0.95]"
                  title="PDF Preview 1"
                />
                <div 
                  className="absolute inset-0 bg-transparent hover:bg-white/5 transition-all duration-500 cursor-pointer flex flex-col items-center justify-center opacity-0 group-hover:opacity-100"
                  onClick={() => setFullscreenUrl(url1)}
                >
                  <Button className="scale-95 group-hover:scale-100 transition-all font-medium bg-[#121212]/80 text-white border border-white/10 backdrop-blur-md rounded-xl shadow-2xl px-6 py-3">
                    點擊開啟沉浸式模式
                  </Button>
                </div>
              </div>
            </div>
          )}
          {url2 && (
            <div className="group relative flex flex-col border border-white/10 rounded-2xl overflow-hidden shadow-lg shadow-black/20 bg-white/5 backdrop-blur-md h-[800px] lg:h-[900px]">
              <div className="bg-white/5 p-4 border-b border-white/10 text-xs font-semibold flex justify-between items-center text-white/90">
                <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-blue-400" /> 報告預覽 2</span>
                <button onClick={() => setFullscreenUrl(url2)} className="text-white/50 hover:text-white/90 transition-colors flex items-center gap-1">
                  <Maximize2 className="h-4 w-4" /> 全螢幕
                </button>
              </div>
              <div className="relative flex-1 overflow-hidden">
                <iframe 
                  src={getEmbedUrl(url2)} 
                  className="w-full h-full pointer-events-none opacity-[0.95]"
                  title="PDF Preview 2"
                />
                <div 
                  className="absolute inset-0 bg-transparent hover:bg-white/5 transition-all duration-500 cursor-pointer flex flex-col items-center justify-center opacity-0 group-hover:opacity-100"
                  onClick={() => setFullscreenUrl(url2)}
                >
                  <Button className="scale-95 group-hover:scale-100 transition-all font-medium bg-[#121212]/80 text-white border border-white/10 backdrop-blur-md rounded-xl shadow-2xl px-6 py-3">
                    點擊開啟沉浸式模式
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="h-[400px] border border-dashed border-white/20 bg-white/5 rounded-2xl flex flex-col items-center justify-center space-y-4 text-white/40 mt-8 relative z-10 backdrop-blur-sm">
           <FileText className="h-12 w-12 opacity-30" />
           <p className="font-medium uppercase tracking-widest text-sm opacity-60">此日期尚無報告連結</p>
        </div>
      )}
    </div>
  );
}
