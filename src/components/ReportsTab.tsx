import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DailyReport } from '../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, FileText, Link as LinkIcon, Info, X, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from './ui/dialog';

interface ReportsTabProps { tabId: string; }

export default function ReportsTab({ tabId }: ReportsTabProps) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
  const [url1, setUrl1] = useState('');
  const [url2, setUrl2] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase.from('daily_reports').select('*').eq('stock_tab_id', tabId);
      if (!cancelled) {
        if (error) console.error(error);
        setReports((data as unknown as DailyReport[]) || []);
        setLoading(false);
      }
    }
    load();
    const channel = supabase.channel(`reports_${tabId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_reports', filter: `stock_tab_id=eq.${tabId}` }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [tabId]);

  useEffect(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const existing = reports.find(r => r.id === dateStr);
    setUrl1(existing?.notes?.split('\n')[0] || '');
    setUrl2(existing?.notes?.split('\n')[1] || '');
  }, [selectedDate, reports]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const { error } = await supabase.from('daily_reports').upsert(
      { stock_tab_id: tabId, id: dateStr, date: dateStr, notes: [url1, url2].filter(Boolean).join('\n') },
      { onConflict: 'id' }
    );
    if (error) { toast.error('儲存失敗'); console.error(error); }
    else { toast.success('報告連結已儲存'); }
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
      if (url.includes('/view')) return url.replace('/view', '/preview').split('?')[0];
      if (url.includes('/file/d/')) {
        const parts = url.split('/file/d/');
        return `https://drive.google.com/file/d/${parts[1].split('/')[0]}/preview`;
      }
    }
    return url;
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
  const hasReport = (date: Date) => reports.some(r => r.id === format(date, 'yyyy-MM-dd') && r.notes);

  return (
    <div className="space-y-6">
      <Dialog open={!!fullscreenUrl} onOpenChange={(o) => !o && setFullscreenUrl(null)}>
        <DialogContent className="max-w-screen w-screen h-screen md:max-w-[98vw] md:w-[98vw] md:h-[98vh] p-0 border-white/10 rounded-2xl bg-[#121212] shadow-2xl flex flex-col overflow-hidden z-[200]">
          <div className="flex justify-between p-4 border-b border-white/10"><span className="text-white"><FileText className="inline h-4 w-4 mr-2" />報告</span><button onClick={() => setFullscreenUrl(null)} className="text-white/60 hover:text-white"><X className="h-5 w-5" /></button></div>
          {fullscreenUrl && <iframe src={getEmbedUrl(fullscreenUrl)} className="w-full h-full flex-1" title="PDF" />}
        </DialogContent>
      </Dialog>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-[400px] shrink-0">
          <div className="border border-white/10 bg-white/5 backdrop-blur-xl rounded-2xl shadow-lg overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center text-white/90">
              <h3 className="font-semibold"><CalendarIcon className="inline h-5 w-5 mr-2 text-blue-400" />{format(currentMonth, 'yyyy年 MM月')}</h3>
              <div className="flex gap-2"><button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-white/10 rounded"><ChevronLeft className="h-5 w-5" /></button><button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-white/10 rounded"><ChevronRight className="h-5 w-5" /></button></div>
            </div>
            <div className="grid grid-cols-7 border-b border-white/10 p-2 gap-1">
              {['日','一','二','三','四','五','六'].map(d => <div key={d} className="text-center text-[11px] font-medium text-white/40 py-2">{d}</div>)}
              {calendarDays.map((day, i) => {
                const sel = isSameDay(day, selectedDate);
                const cur = isSameMonth(day, monthStart);
                const has = hasReport(day);
                return <button key={i} onClick={() => setSelectedDate(day)} className={`h-12 rounded-xl flex flex-col items-center justify-center transition-all ${!cur ? 'text-white/20' : 'text-white/80'} ${sel ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'hover:bg-white/10 border-transparent'}`}><span className="text-sm">{format(day, 'd')}</span>{has && <div className={`w-1.5 h-1.5 rounded-full ${sel ? 'bg-blue-400' : 'bg-white/40'}`} />}</button>;
              })}
            </div>
          </div>
          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl"><p className="text-xs text-blue-200"><Info className="inline h-4 w-4 mr-1" />請輸入 Google Drive 分享連結</p></div>
        </div>

        <div className="flex-1">
          <div className="border border-white/10 bg-white/5 backdrop-blur-xl rounded-2xl p-6">
            <h3 className="text-xl font-semibold mb-6 text-white/90"><FileText className="inline h-6 w-6 mr-2 text-blue-400" />報告 - {format(selectedDate, 'yyyy/MM/dd')}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-white/70">連結 1</Label><Input value={url1} onChange={e => setUrl1(e.target.value)} placeholder="Google Drive 連結..." className="border-white/10 bg-white/5 text-white/90 rounded-xl" /></div>
                <div><Label className="text-white/70">連結 2</Label><Input value={url2} onChange={e => setUrl2(e.target.value)} placeholder="Google Drive 連結..." className="border-white/10 bg-white/5 text-white/90 rounded-xl" /></div>
              </div>
              <div className="flex justify-end"><Button type="submit" className="bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl">儲存</Button></div>
            </form>
          </div>
        </div>
      </div>

      {(url1 || url2) ? (
        <div className="space-y-8">{url1 && <PreviewBlock url={url1} index={1} onFullscreen={setFullscreenUrl} />}{url2 && <PreviewBlock url={url2} index={2} onFullscreen={setFullscreenUrl} />}</div>
      ) : (
        <div className="h-[400px] border border-dashed border-white/20 bg-white/5 rounded-2xl flex items-center justify-center text-white/40"><FileText className="h-12 w-12 mr-3 opacity-30" /><span className="font-medium tracking-widest text-sm">此日期尚無報告連結</span></div>
      )}
    </div>
  );
}

function PreviewBlock({ url, index, onFullscreen }: { url: string; index: number; onFullscreen: (url: string) => void }) {
  return (
    <div className="group relative flex flex-col border border-white/10 rounded-2xl overflow-hidden bg-white/5 backdrop-blur-md h-[800px] lg:h-[900px]">
      <div className="p-4 border-b border-white/10 text-xs font-semibold flex justify-between text-white/90">
        <span><FileText className="inline h-4 w-4 mr-2 text-blue-400" />預覽 {index}</span>
        <button onClick={() => onFullscreen(url)} className="text-white/50 hover:text-white/90"><Maximize2 className="h-4 w-4" /></button>
      </div>
      <iframe src={url.includes('drive') ? url.replace('/view','/preview').replace('/file/d/','/file/d/').split('?')[0] : url} className="w-full h-full pointer-events-none opacity-[0.95]" title={`Preview ${index}`} />
    </div>
  );
}
