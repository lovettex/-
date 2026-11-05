import React, { useState, useEffect } from 'react';
import { whiteNoiseEngine, WhiteNoiseState } from '../lib/whiteNoiseEngine';
import { PS5_THEMES } from '../types/ps5Themes';
import { Video, Film, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

/**
 * TopBackgroundSwitch
 * Exclusively displays switch buttons for Theme 1 and Theme 2.
 * Hidden whenever PS5 dynamic background is OFF.
 */
export function TopBackgroundSwitch() {
  const [state, setState] = useState<WhiteNoiseState>(whiteNoiseEngine.getState());

  useEffect(() => {
    const unsub = whiteNoiseEngine.subscribe((s) => {
      setState(s);
    });
    return () => unsub();
  }, []);

  // Hide completely when PS5 dynamic background is OFF
  if (!state.bgEnabled) {
    return null;
  }

  const handleSelect = (themeId: 'texture-overlay-video' | 'anton-cinematic-video') => {
    whiteNoiseEngine.setBgTheme(themeId);
    const themeObj = PS5_THEMES.find((t) => t.id === themeId);
    toast.success(`已切換動態背景：${themeObj?.name || themeId}`, {
      description: themeObj?.nameEn || 'Dynamic background theme active',
      duration: 2000,
    });
  };

  const isTheme1 = state.bgThemeId === 'texture-overlay-video';
  const isTheme2 = state.bgThemeId === 'anton-cinematic-video';

  return (
    <div
      role="region"
      aria-label="動態背景主題切換 (主題 1 與 主題 2)"
      className="inline-flex items-center gap-1 p-1 rounded-full bg-zinc-950/85 hover:bg-zinc-950/95 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all select-none animate-fadeIn pointer-events-auto"
    >
      <div className="flex items-center gap-1 pl-2.5 pr-1 text-emerald-400">
        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
        <span className="text-[10px] font-black tracking-wider uppercase text-emerald-300 hidden md:inline">
          PS5 背景
        </span>
      </div>

      <span className="w-[1px] h-3.5 bg-white/20 mx-0.5" />

      {/* Theme 1 Switch Button */}
      <button
        type="button"
        onClick={() => handleSelect('texture-overlay-video')}
        className={`px-3 py-1 rounded-full text-[11.5px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
          isTheme1
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
        className={`px-3 py-1 rounded-full text-[11.5px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
          isTheme2
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
