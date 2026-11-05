import React, { useState, useEffect } from 'react';
import { whiteNoiseEngine, WhiteNoiseState } from '../lib/whiteNoiseEngine';
import { PS5_THEMES } from '../types/ps5Themes';
import { Sparkles, Video, Film, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export function TopBackgroundSwitch() {
  const [state, setState] = useState<WhiteNoiseState>(whiteNoiseEngine.getState());

  useEffect(() => {
    const unsub = whiteNoiseEngine.subscribe((s) => {
      setState(s);
    });
    return () => unsub();
  }, []);

  const handleSelect = (themeId: string) => {
    if (!state.bgEnabled) {
      whiteNoiseEngine.toggleBgEnabled();
    }
    whiteNoiseEngine.setBgTheme(themeId);
    const themeObj = PS5_THEMES.find((t) => t.id === themeId);
    toast.success(`已切換動態背景：${themeObj?.name || themeId}`, {
      description: themeObj?.nameEn || 'Dynamic background theme active',
      duration: 2000,
    });
  };

  const handleToggleBg = () => {
    whiteNoiseEngine.toggleBgEnabled();
    toast.info(!state.bgEnabled ? '已啟用動態背景' : '已關閉動態背景', {
      duration: 1800,
    });
  };

  const isTheme1 = state.bgThemeId === 'texture-overlay-video';
  const isTheme2 = state.bgThemeId === 'anton-cinematic-video';

  return (
    <div
      role="region"
      aria-label="動態背景切換控制"
      className="inline-flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 rounded-full bg-black/60 hover:bg-black/75 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all select-none"
    >
      {/* On/Off Toggle Button */}
      <button
        type="button"
        onClick={handleToggleBg}
        className={`px-2 sm:px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
          state.bgEnabled
            ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
            : 'bg-white/10 text-zinc-400 hover:text-white border border-white/10'
        }`}
        title={state.bgEnabled ? '點擊關閉動態背景' : '點擊啟用動態背景'}
      >
        <Sparkles className={`w-3 h-3 ${state.bgEnabled ? 'text-emerald-400 animate-pulse' : 'text-zinc-400'}`} />
        <span className="hidden xs:inline">動態背景</span>
        <span className="text-[10px] font-mono opacity-80">{state.bgEnabled ? 'ON' : 'OFF'}</span>
      </button>

      <span className="w-[1px] h-3.5 bg-white/20 mx-0.5" />

      {/* Theme 1 Switch Button */}
      <button
        type="button"
        onClick={() => handleSelect('texture-overlay-video')}
        className={`px-2.5 sm:px-3 py-1 rounded-full text-[11.5px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
          isTheme1 && state.bgEnabled
            ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-zinc-950 font-black shadow-[0_2px_12px_rgba(16,185,129,0.5),inset_0_1px_0_rgba(255,255,255,0.7)] scale-[1.02]'
            : 'text-zinc-300 hover:text-white hover:bg-white/12'
        }`}
        title="切換至 主題 1：質感紋理覆蓋 (Texture Overlay Video)"
      >
        <Film className="w-3 h-3 shrink-0" />
        <span className="hidden sm:inline">主題 1 (紋理覆蓋)</span>
        <span className="sm:hidden">主題 1</span>
      </button>

      {/* Theme 2 Switch Button */}
      <button
        type="button"
        onClick={() => handleSelect('anton-cinematic-video')}
        className={`px-2.5 sm:px-3 py-1 rounded-full text-[11.5px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
          isTheme2 && state.bgEnabled
            ? 'bg-gradient-to-r from-sky-400 to-blue-500 text-zinc-950 font-black shadow-[0_2px_12px_rgba(56,189,248,0.5),inset_0_1px_0_rgba(255,255,255,0.7)] scale-[1.02]'
            : 'text-zinc-300 hover:text-white hover:bg-white/12'
        }`}
        title="切換至 主題 2：Anton 劇院視效 (Anton Cinematic Video)"
      >
        <Video className="w-3 h-3 shrink-0" />
        <span className="hidden sm:inline font-['Anton',sans-serif] tracking-wide">主題 2 (ANTON 劇院)</span>
        <span className="sm:hidden">主題 2</span>
      </button>
    </div>
  );
}

export default TopBackgroundSwitch;
