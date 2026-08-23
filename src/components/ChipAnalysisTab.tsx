import React, { useState, useEffect } from 'react';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { 
  Sparkles, 
  Upload, 
  TrendingUp, 
  TrendingDown, 
  HelpCircle, 
  AlertTriangle, 
  CheckCircle, 
  CheckCircle2, 
  Loader2, 
  FileText,
  AlertOctagon,
  Gauge,
  UserCheck
} from 'lucide-react';

interface ChipAnalysisData {
  stage: {
    accumulation: boolean;
    shakeout: boolean;
    markup: boolean;
    consolidation: boolean;
    distribution: boolean;
  };
  patternExplanation: string;
  actionSuggestions: string;
  warnings: {
    hasWarning: boolean;
    type: string;
    details: string;
  };
  candlestickSupport: {
    hasSupport: boolean;
    type: string;
    details: string;
  };
  signalType: string;
  signalExplanation: string;
  previewImage?: string; // Cache base64 preview of chart
  scannedAt?: string;
}

export default function ChipAnalysisTab({ tabId, symbol }: { tabId: string; symbol: string }) {
  const [data, setData] = useState<ChipAnalysisData>({
    stage: {
      accumulation: false,
      shakeout: false,
      markup: false,
      consolidation: false,
      distribution: false
    },
    patternExplanation: '',
    actionSuggestions: '',
    warnings: {
      hasWarning: false,
      type: '無',
      details: ''
    },
    candlestickSupport: {
      hasSupport: false,
      type: '無',
      details: ''
    },
    signalType: '等待',
    signalExplanation: ''
  });

  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isDragActive, setIsDragActive] = useState(false);

  // Load existing analysis from Firestore on mount
  useEffect(() => {
    async function loadAnalysis() {
      const pathForGet = `stockTabs/${tabId}/chipAnalysis/main`;
      try {
        const docRef = doc(db, `stockTabs/${tabId}/chipAnalysis`, 'main');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setData(docSnap.data() as ChipAnalysisData);
          if (docSnap.data().previewImage) {
            setPreviewUrl(docSnap.data().previewImage);
          }
        }
      } catch (error) {
        console.error('Error loading card chip analysis:', error);
        handleFirestoreError(error, OperationType.GET, pathForGet);
      } finally {
        setLoading(false);
      }
    }
    loadAnalysis();
  }, [tabId]);

  // Handle Drag Events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  // Process File and convert to base64
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('僅支援圖片檔案格式（jpeg/png 等）');
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Handle Input File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Post base64 data to backend for scanning
  const handleScan = async () => {
    if (!previewUrl) {
      toast.error('請先拖曳或上傳股票圖檔！');
      return;
    }

    setScanning(true);
    toast.loading("AI 主力籌碼模型正全力解構 K 線與主力階段...", { id: "scanning-chips" });

    try {
      const response = await fetch('/api/analyze-chips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageBase64: previewUrl,
          symbol: symbol
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '掃描請求失敗');
      }

      const result = await response.json() as ChipAnalysisData;
      
      const updatedData: ChipAnalysisData = {
        ...result,
        previewImage: previewUrl,
        scannedAt: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
      };

      setData(updatedData);

      // 1. Save to main /chipAnalysis collection in Firestore
      const pathForWrite = `stockTabs/${tabId}/chipAnalysis/main`;
      try {
        await setDoc(doc(db, `stockTabs/${tabId}/chipAnalysis`, 'main'), updatedData);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, pathForWrite);
      }

      // 2. Synchronize to StrategTab operationNote (交易計畫與策略區塊的執行細節備註)
      // We write to /stockTabs/${tabId}/strategy/main operationNote
      const strategyDocRef = doc(db, `stockTabs/${tabId}/strategy`, 'main');
      const strategyPath = `stockTabs/${tabId}/strategy/main`;
      let strategyDocSnap;
      try {
        strategyDocSnap = await getDoc(strategyDocRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, strategyPath);
      }
      
      const syncNote = `【AI 主力與籌碼分析結論】
[ 交易型態 ]：${result.signalType} 訊號
[ 主力操作階段 ]：${
        Object.entries(result.stage)
          .filter(([_, active]) => active)
          .map(([key]) => {
            if (key === 'accumulation') return '吸籌';
            if (key === 'shakeout') return '洗盤';
            if (key === 'markup') return '拉升';
            if (key === 'consolidation') return '整理(換手)';
            if (key === 'distribution') return '出貨';
            return '';
          })
          .filter(Boolean)
          .join(', ') || '無明確階段'
      }
[ K線型態分析 ]：${result.patternExplanation}
[ 散戶應對策略 ]：${result.actionSuggestions}
[ 微觀K線支撐 ]：${result.candlestickSupport.details}
[ 買賣警戒狀態 ]：${result.warnings.details}`;

      try {
        if (strategyDocSnap.exists()) {
          await updateDoc(strategyDocRef, {
            operationNote: syncNote
          });
        } else {
          await setDoc(strategyDocRef, {
            operationNote: syncNote
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, strategyPath);
      }

      toast.success("籌碼分析成功！已同步至交易策略之執行細節備註。", { id: "scanning-chips" });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || '晶片模型分析出錯，請確認 Gemini 密鑰並重試。', { id: "scanning-chips" });
    } finally {
      setScanning(false);
    }
  };

  // Toggle stage handler manually
  const handleStageToggle = async (stageKey: keyof typeof data.stage) => {
    const updatedStage = {
      ...data.stage,
      [stageKey]: !data.stage[stageKey]
    };
    const updatedData = {
      ...data,
      stage: updatedStage
    };
    setData(updatedData);
    const pathForWrite = `stockTabs/${tabId}/chipAnalysis/main`;
    try {
      await setDoc(doc(db, `stockTabs/${tabId}/chipAnalysis`, 'main'), updatedData);
    } catch (e) {
      console.error('Save failed:', e);
      handleFirestoreError(e, OperationType.WRITE, pathForWrite);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-500 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-705 font-bold" />
        <p className="text-xs">主力籌碼頁面載入中...</p>
      </div>
    );
  }

  // Helper color logic based on signals
  const getSignalColor = (sig: string) => {
    if (sig === '買入') return 'bg-emerald-500/10 text-emerald-705 font-bold border-emerald-500/30';
    if (sig === '賣出') return 'bg-red-500/10 text-rose-700 font-bold border-red-500/30';
    return 'bg-amber-500/10 text-amber-705 font-bold border-amber-500/30';
  };

  const getWarningBadgeColor = (type: string) => {
    if (type === '買入警告') return 'bg-emerald-500/10 text-emerald-705 font-bold border-emerald-500/30';
    if (type === '賣出警告') return 'bg-red-500/10 text-rose-700 font-bold border-red-500/30';
    return 'bg-zinc-50 text-zinc-400 font-semibold border-zinc-205';
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-205 pb-4">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-[#10B981] uppercase font-mono">Market Maker & Chips</p>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 font-bold flex items-center gap-2">
            主力與籌碼分析
            <span className="text-xs font-normal text-zinc-400 font-semibold font-mono ml-1">({symbol})</span>
          </h2>
        </div>
        {data.scannedAt && (
          <span className="text-[11px] text-zinc-400 font-semibold font-mono mt-1 md:mt-0">
            上次分析時間：{data.scannedAt}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Image Area & Scan Button */}
        <div id="image-upload-card" className="lg:col-span-5 space-y-4">
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 transition-all relative flex flex-col items-center justify-center min-h-[260px] cursor-pointer ${
              isDragActive 
                ? 'border-emerald-500 bg-emerald-500/5' 
                : previewUrl 
                  ? 'border-zinc-205 bg-zinc-50/90' 
                  : 'border-zinc-205 hover:border-emerald-500/50 bg-zinc-50/50'
            }`}
            onClick={() => document.getElementById('chip-file-uploader')?.click()}
          >
            <input 
              id="chip-file-uploader"
              type="file" 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange}
            />

            {previewUrl ? (
              <div className="w-full h-full flex flex-col items-center space-y-3 relative group">
                <img 
                  src={previewUrl} 
                  alt="K-line preview image" 
                  className="max-h-[220px] object-contain rounded-xl border border-zinc-205 shadow-2xl transition-all"
                />
                <div className="absolute inset-0 bg-[#000]/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                  <div className="text-center text-xs text-zinc-650 font-medium space-y-1">
                    <Upload className="w-5 h-5 mx-auto text-emerald-705 font-bold" />
                    <p>重置/拖曳上傳新圖檔</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-zinc-50 border border-zinc-205 flex items-center justify-center mx-auto text-zinc-400 font-semibold">
                  <Upload className="w-6 h-6 text-emerald-705 font-bold animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-sm text-zinc-750 font-medium">拖曳或點選上傳走走勢截圖</p>
                  <p className="text-xs text-zinc-400 font-semibold max-w-[200px] mx-auto">支援 png, jpeg, webp 等格式</p>
                </div>
              </div>
            )}
          </div>

          <button
            id="scan-chips-btn"
            disabled={scanning || !previewUrl}
            onClick={handleScan}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-50 disabled:text-zinc-400 text-black font-extrabold rounded-xl transition-all text-sm shadow-lg shadow-emerald-500/10 disabled:shadow-none"
          >
            {scanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>AI 主力籌碼分析中...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-black" />
                <span>立即掃描分析</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Tickboxes & Diagnostic Indicators */}
        <div id="diagnostics-panel" className="lg:col-span-7 space-y-6">
          {/* Main tickbox stage indicator */}
          <div id="institutional-stages-box" className="p-5 rounded-2xl bg-zinc-50/80 border border-zinc-205 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200/50 pb-2">
              <span className="text-xs font-extrabold tracking-wider text-zinc-500 flex items-center gap-1.5 uppercase font-mono">
                <Gauge className="w-3.5 h-3.5 text-emerald-705 font-bold" /> 主力資金操作所處階段
              </span>
              <span className="text-[10px] text-zinc-400">點按微調狀態</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {[
                { key: 'accumulation', label: '1. 吸籌' },
                { key: 'shakeout', label: '2. 洗盤' },
                { key: 'markup', label: '3. 拉升' },
                { key: 'consolidation', label: '4. 整理(換手)' },
                { key: 'distribution', label: '5. 出貨' }
              ].map((stg) => {
                const isChecked = data.stage[stg.key as keyof typeof data.stage];
                return (
                  <button
                    key={stg.key}
                    id={`checkbox-${stg.key}`}
                    onClick={() => handleStageToggle(stg.key as keyof typeof data.stage)}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-bold transition-all ${
                      isChecked 
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 shadow-md' 
                        : 'bg-zinc-50 border-zinc-200/50 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
                    }`}
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 transition-all ${isChecked ? 'scale-100 text-emerald-600' : 'scale-0 text-transparent opacity-0 w-0'}`} />
                    <span>{stg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick analysis details badges */}
          <div id="analysis-badges-grid" className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Signal Badge Card */}
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2 flex flex-col justify-between shadow-xs">
              <span className="text-[11px] font-bold text-zinc-500 flex items-center gap-1">K線技術型態信號</span>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 text-xs font-black rounded-lg border ${getSignalColor(data.signalType)}`}>
                  {data.signalType}
                </span>
                <span className="text-[11px] text-zinc-600 line-clamp-2 leading-tight">
                  {data.signalExplanation || '尚未掃描'}
                </span>
              </div>
            </div>

            {/* Warnings Badge Card */}
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2 flex flex-col justify-between shadow-xs">
              <span className="text-[11px] font-bold text-zinc-500 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" /> 趨勢偏離/暴跌警告
              </span>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-[10px] font-black rounded border whitespace-nowrap ${getWarningBadgeColor(data.warnings.type)}`}>
                  {data.warnings.type || '無'}
                </span>
                <span className="text-[11px] text-zinc-600 line-clamp-2 leading-tight">
                  {data.warnings.details || '安全無虞。'}
                </span>
              </div>
            </div>

            {/* Micro Candlestick Badge Card */}
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2 flex flex-col justify-between shadow-xs">
              <span className="text-[11px] font-bold text-zinc-500 flex items-center gap-1">
                十字星 / 影線強力支撐
              </span>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-[10px] font-black rounded border whitespace-nowrap ${
                  data.candlestickSupport.hasSupport 
                    ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 font-bold' 
                    : 'bg-zinc-50 text-zinc-400 font-semibold border-zinc-200'
                }`}>
                  {data.candlestickSupport.type || '無'}
                </span>
                <span className="text-[11px] text-zinc-600 line-clamp-2 leading-tight">
                  {data.candlestickSupport.details || '無。'}
                </span>
              </div>
            </div>
          </div>

          {/* Technical pattern and layout details text areas */}
          <div id="narrative-analysis-box" className="space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50/80 border border-zinc-200 space-y-3 shadow-xs">
              <h3 className="text-zinc-900 font-bold text-sm leading-none flex items-center gap-1.5 border-b border-zinc-200/60 pb-2">
                <FileText className="w-4 h-4 text-emerald-600 shrink-0" /> 技術與籌碼型態說明
              </h3>
              <div id="pattern-explanation-details" className="text-xs text-zinc-700 leading-relaxed max-h-[160px] overflow-y-auto whitespace-pre-wrap pr-1">
                {data.patternExplanation || '尚未分析。請上傳並掃描股票主產圖或走勢圖。'}
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-3 shadow-xs">
              <h3 className="text-emerald-800 font-bold text-sm leading-none flex items-center gap-1.5 border-b border-emerald-200 pb-2">
                <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" /> 散戶應對策略與操作建議
              </h3>
              <div id="retail-action-details" className="text-xs text-emerald-950 font-medium leading-relaxed max-h-[160px] overflow-y-auto whitespace-pre-wrap pr-1">
                {data.actionSuggestions || '尚未提供。掃描成功後，此處將顯示專業級防守建倉操作策略。'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
