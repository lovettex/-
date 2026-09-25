import React, { useState, useEffect, useRef } from 'react';
import {
  whiteNoiseEngine,
  AMBIENT_TRACKS,
  WhiteNoiseState,
  AmbientTrack,
} from '../lib/whiteNoiseEngine';
import { PS5_THEMES, PS5Theme } from './PS5DynamicBackground';
import { playClickSound } from '../lib/audio';
import {
  Volume2,
  VolumeX,
  Shuffle,
  Play,
  Pause,
  ChevronDown,
  Sparkles,
  CloudRain,
  CloudLightning,
  Waves,
  Droplets,
  Moon,
  Trees,
  Flame,
  Wind,
  Bell,
  Zap,
  Compass,
  Disc,
  Coffee,
  Clock,
  BookOpen,
  Fish,
  Eye,
  SunDim,
  Radio,
  Activity,
  CircleDot,
  X,
  ListMusic,
  Tv,
  Palette,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

// Icon mapper for soundscapes
const getTrackIcon = (iconName: string, className: string = 'w-3.5 h-3.5') => {
  switch (iconName) {
    case 'CloudRain':
      return <CloudRain className={className} />;
    case 'CloudLightning':
      return <CloudLightning className={className} />;
    case 'Waves':
      return <Waves className={className} />;
    case 'Droplets':
      return <Droplets className={className} />;
    case 'Moon':
      return <Moon className={className} />;
    case 'Trees':
      return <Trees className={className} />;
    case 'Flame':
      return <Flame className={className} />;
    case 'Wind':
      return <Wind className={className} />;
    case 'Bell':
      return <Bell className={className} />;
    case 'Zap':
      return <Zap className={className} />;
    case 'Compass':
      return <Compass className={className} />;
    case 'Disc':
      return <Disc className={className} />;
    case 'Coffee':
      return <Coffee className={className} />;
    case 'Clock':
      return <Clock className={className} />;
    case 'BookOpen':
      return <BookOpen className={className} />;
    case 'SunDim':
      return <SunDim className={className} />;
    case 'CircleDot':
      return <CircleDot className={className} />;
    case 'Eye':
      return <Eye className={className} />;
    case 'Fish':
      return <Fish className={className} />;
    case 'Radio':
      return <Radio className={className} />;
    case 'Activity':
      return <Activity className={className} />;
    default:
      return <Sparkles className={className} />;
  }
};

export function WhiteNoisePlayer() {
  const [state, setState] = useState<WhiteNoiseState>(whiteNoiseEngine.getState());
  const [isOpenMenu, setIsOpenMenu] = useState(false);
  const [mainTab, setMainTab] = useState<'sounds' | 'themes'>('sounds');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = whiteNoiseEngine.subscribe((newState) => {
      setState(newState);
    });
    return () => unsubscribe();
  }, []);

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpenMenu(false);
        setShowVolumeSlider(false);
      }
    }
    if (isOpenMenu || showVolumeSlider) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpenMenu, showVolumeSlider]);

  const currentTrack: AmbientTrack = AMBIENT_TRACKS[state.currentTrackIndex] || AMBIENT_TRACKS[0];
  const currentTheme: PS5Theme =
    PS5_THEMES.find((t) => t.id === state.bgThemeId) || PS5_THEMES[0];

  const handleTogglePlay = async () => {
    playClickSound();
    await whiteNoiseEngine.togglePlay();
    if (!state.isPlaying) {
      toast.success(`已開啟白噪音：${currentTrack.name}`, {
        description: `動態 PS5 背景已啟用 (${currentTheme.name})`,
        duration: 2500,
      });
    }
  };

  const handleShuffleRandom = () => {
    playClickSound();
    whiteNoiseEngine.shuffleRandom();
    const newTrack = whiteNoiseEngine.getCurrentTrack();
    toast.info(`隨機切換至：${newTrack.name}`, {
      description: newTrack.description,
      duration: 2000,
    });
  };

  const handleSelectTrack = (idx: number) => {
    playClickSound();
    whiteNoiseEngine.selectTrack(idx);
    setIsOpenMenu(false);
  };

  const handleSelectTheme = (themeId: string) => {
    playClickSound();
    whiteNoiseEngine.setBgTheme(themeId);
    const selected = PS5_THEMES.find((t) => t.id === themeId);
    if (selected) {
      toast.success(`已切換 PS5 背景：${selected.name}`, {
        description: selected.nameEn,
        duration: 2000,
      });
    }
  };

  const handleToggleBg = () => {
    playClickSound();
    whiteNoiseEngine.toggleBgEnabled();
    toast.info(state.bgEnabled ? '已停用動態背景' : '已啟用動態背景');
  };

  const filteredTracks = AMBIENT_TRACKS.filter((t) => {
    if (activeCategory === 'all') return true;
    return t.category === activeCategory;
  });

  return (
    <div className="relative inline-flex items-center select-none" ref={menuRef}>
      {/* Main Top-Left Control Bar */}
      <div className="flex items-center gap-1.5 p-1 bg-white/95 backdrop-blur-md border border-zinc-250/90 shadow-[0_4px_16px_rgba(0,0,0,0.08)] rounded-full transition-all duration-300">
        {/* Play / Pause / Power Master Toggle */}
        <button
          type="button"
          onClick={handleTogglePlay}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black transition-all duration-300 cursor-pointer shadow-xs ${
            state.isPlaying
              ? 'bg-emerald-600 text-white shadow-emerald-500/20 shadow-md ring-2 ring-emerald-400/40'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/90 hover:text-zinc-900 border border-zinc-200'
          }`}
          title={state.isPlaying ? '點擊關閉白噪音與動態背景' : '點擊開啟白噪音 (預設關閉)'}
        >
          {state.isPlaying ? (
            <>
              {/* Animated Soundwave Equalizer */}
              <div className="flex items-end gap-0.5 h-3.5 w-3.5 pb-0.5">
                <span className="w-0.5 bg-white rounded-full animate-bounce [animation-duration:600ms] h-full" />
                <span className="w-0.5 bg-white rounded-full animate-bounce [animation-duration:900ms] [animation-delay:150ms] h-2/3" />
                <span className="w-0.5 bg-white rounded-full animate-bounce [animation-duration:750ms] [animation-delay:300ms] h-4/5" />
              </div>
              <span className="text-[11px] tracking-tight whitespace-nowrap hidden min-[400px]:inline">
                {currentTrack.name}
              </span>
              <span className="text-[11px] tracking-tight whitespace-nowrap min-[400px]:hidden">
                撥放中
              </span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 text-zinc-500 fill-zinc-500" />
              <span className="text-[11px] tracking-tight whitespace-nowrap">白噪音</span>
              <span className="text-[9px] px-1 py-0.2 bg-zinc-200/80 text-zinc-500 rounded font-bold">
                關
              </span>
            </>
          )}
        </button>

        {/* Random Shuffle Button (隨機切換音樂按鈕) */}
        <button
          type="button"
          onClick={handleShuffleRandom}
          className="p-1.5 rounded-full text-zinc-600 hover:text-emerald-700 hover:bg-emerald-50 active:scale-95 transition-all cursor-pointer border border-transparent hover:border-emerald-200"
          title="隨機切換音樂 (24種音景隨機輪播)"
        >
          <Shuffle className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>

        {/* Dynamic PS5 Background Theme Quick Swatch / Selector */}
        <button
          type="button"
          onClick={() => {
            playClickSound();
            setMainTab('themes');
            setIsOpenMenu(true);
          }}
          className={`flex items-center gap-1 px-1.5 py-1 rounded-full text-xs transition-all cursor-pointer border ${
            state.isPlaying && state.bgEnabled
              ? 'border-emerald-200 bg-emerald-50/90 text-emerald-800 font-bold'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'
          }`}
          title={`PS5 動態背景：${currentTheme.name} (點擊更換主題)`}
        >
          <div
            className="w-2.5 h-2.5 rounded-full shadow-xs ring-1 ring-white"
            style={{ backgroundColor: currentTheme.iconColor }}
          />
          <Tv className="w-3 h-3" />
        </button>

        {/* Track / Menu Toggle Button */}
        <button
          type="button"
          onClick={() => {
            playClickSound();
            setMainTab('sounds');
            setIsOpenMenu((prev) => !prev);
          }}
          className={`flex items-center gap-0.5 px-1.5 py-1 rounded-full text-xs transition-all cursor-pointer ${
            isOpenMenu
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-black'
              : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'
          }`}
          title="白噪音與動態背景設定"
        >
          <ListMusic className="w-3.5 h-3.5" />
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-200 ${
              isOpenMenu ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Volume & Mute Popover Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setShowVolumeSlider((prev) => !prev);
            }}
            className="p-1.5 rounded-full text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
            title={`音量: ${Math.round(state.volume * 100)}%`}
          >
            {state.isMuted || state.volume === 0 ? (
              <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Quick Volume Slider Dropdown */}
          <AnimatePresence>
            {showVolumeSlider && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 5 }}
                transition={{ duration: 0.15 }}
                className="absolute left-1/2 -translate-x-1/2 top-full mt-2 bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-zinc-250 shadow-xl z-[1000] w-48 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between text-[11px] font-black text-zinc-700">
                  <span className="flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5 text-emerald-600" /> 音量調節
                  </span>
                  <span className="text-emerald-700 font-mono">
                    {Math.round(state.volume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={state.volume}
                  onChange={(e) => {
                    whiteNoiseEngine.setVolume(parseFloat(e.target.value));
                  }}
                  className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-zinc-200 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    whiteNoiseEngine.toggleMute();
                  }}
                  className="w-full py-1 text-[11px] font-bold rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  {state.isMuted ? (
                    <>
                      <Volume2 className="w-3 h-3 text-emerald-600" /> 取消靜音
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-3 h-3 text-rose-500" /> 一鍵靜音
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Dropdown Modal (Sounds & PS5 Dynamic Themes) */}
      <AnimatePresence>
        {isOpenMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 w-[340px] sm:w-[390px] bg-white/95 backdrop-blur-xl border border-zinc-250 shadow-[0_20px_60px_rgba(0,0,0,0.18)] rounded-3xl p-4 z-[1001] max-h-[80vh] flex flex-col text-zinc-800"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              {/* Main Mode Tabs: 白噪音音景 vs PS5 動態背景 */}
              <div className="flex bg-zinc-100 p-0.5 rounded-xl border border-zinc-200">
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setMainTab('sounds');
                  }}
                  className={`px-3 py-1 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    mainTab === 'sounds'
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  <ListMusic className="w-3.5 h-3.5 text-emerald-600" />
                  <span>音景 (24種)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setMainTab('themes');
                  }}
                  className={`px-3 py-1 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    mainTab === 'themes'
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5 text-indigo-600" />
                  <span>PS5 背景 (10種)</span>
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleShuffleRandom}
                  className="px-2.5 py-1 text-[11px] font-black rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors flex items-center gap-1 cursor-pointer"
                  title="隨機挑選音景"
                >
                  <Shuffle className="w-3 h-3" />
                  隨機切換
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpenMenu(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* TAB 1: Soundscapes Catalog */}
            {mainTab === 'sounds' && (
              <>
                {/* Category Filter Tabs */}
                <div className="flex items-center gap-1 py-2.5 overflow-x-auto scrollbar-hide border-b border-zinc-150">
                  {[
                    { id: 'all', label: '全部' },
                    { id: 'nature', label: '自然雨聲' },
                    { id: 'noise', label: '頻譜噪音' },
                    { id: 'meditation', label: '冥想腦波' },
                    { id: 'ambience', label: '環境生活' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-black shrink-0 transition-all cursor-pointer ${
                        activeCategory === cat.id
                          ? 'bg-zinc-900 text-white shadow-xs'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Tracks List */}
                <div className="overflow-y-auto space-y-1.5 py-2.5 pr-1 flex-1 max-h-[360px]">
                  {filteredTracks.map((track) => {
                    const globalIndex = AMBIENT_TRACKS.findIndex((t) => t.id === track.id);
                    const isSelected = globalIndex === state.currentTrackIndex;

                    return (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => handleSelectTrack(globalIndex)}
                        className={`w-full text-left p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-3 group cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-400/40 shadow-xs'
                            : 'bg-zinc-50/70 hover:bg-zinc-100/80 border-zinc-200/70 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white text-zinc-600 border border-zinc-200 shadow-2xs'
                            }`}
                          >
                            {getTrackIcon(track.icon, 'w-4 h-4')}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-black text-xs leading-none truncate ${
                                  isSelected ? 'text-emerald-950' : 'text-zinc-800'
                                }`}
                              >
                                {track.name}
                              </span>
                              <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">
                                {track.nameEn}
                              </span>
                            </div>
                            <span className="text-[10px] text-zinc-500 truncate mt-0.5">
                              {track.description}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5">
                          {isSelected ? (
                            state.isPlaying ? (
                              <div className="flex items-end gap-0.5 h-3.5 w-3.5 pb-0.5">
                                <span className="w-0.5 bg-emerald-600 rounded-full animate-bounce [animation-duration:600ms] h-full" />
                                <span className="w-0.5 bg-emerald-600 rounded-full animate-bounce [animation-duration:900ms] [animation-delay:150ms] h-2/3" />
                                <span className="w-0.5 bg-emerald-600 rounded-full animate-bounce [animation-duration:750ms] [animation-delay:300ms] h-4/5" />
                              </div>
                            ) : (
                              <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                已選
                              </span>
                            )
                          ) : (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-zinc-200 text-zinc-500">
                              <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* TAB 2: PS5 Dynamic Background Themes */}
            {mainTab === 'themes' && (
              <div className="py-2.5 flex-1 flex flex-col gap-3">
                {/* Background On/Off Switch Banner */}
                <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-2xl border border-zinc-200">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600">
                      <Tv className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black text-xs text-zinc-900">
                        PS5 動態背景 & Galaxy 銀河系列
                      </span>
                      <span className="text-[10px] text-zinc-500 font-medium">
                        螺旋星系、創生星雲、超新星脈衝、流星風暴與黑洞透鏡
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleBg}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      state.bgEnabled
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                    }`}
                  >
                    {state.bgEnabled ? '已啟用' : '已關閉'}
                  </button>
                </div>

                {/* Theme Cards Grid */}
                <div className="overflow-y-auto space-y-2 pr-1 max-h-[360px]">
                  {/* Galaxy Series Group Heading */}
                  <div className="flex items-center justify-between pt-1 pb-0.5 px-1">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="text-[11px] font-black text-indigo-900 uppercase tracking-wider">
                        🌌 Galaxy 科學天文動態背景 (5款)
                      </span>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                      無波浪 · 全天體物理模擬
                    </span>
                  </div>

                  {PS5_THEMES.map((th) => {
                    const isSelected = th.id === state.bgThemeId;
                    return (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => handleSelectTheme(th.id)}
                        className={`w-full p-2.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 group cursor-pointer ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50/80 ring-2 ring-indigo-400/30 shadow-xs'
                            : 'border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Theme Color Preview Swatch */}
                          <div
                            className="w-10 h-10 rounded-xl shadow-xs flex items-center justify-center relative overflow-hidden border border-white/20 shrink-0"
                            style={{
                              background: `linear-gradient(135deg, ${th.bgGradient[1]} 0%, ${th.bgGradient[0]} 100%)`,
                            }}
                          >
                            <div
                              className="w-4 h-4 rounded-full blur-[2px] opacity-90"
                              style={{ backgroundColor: th.iconColor }}
                            />
                            {isSelected && (
                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                <Check className="w-4 h-4 text-white stroke-[3]" />
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-xs font-black truncate ${
                                  isSelected ? 'text-indigo-950' : 'text-zinc-800'
                                }`}
                              >
                                {th.name}
                              </span>
                              <span className="text-[9px] text-zinc-400 font-mono hidden sm:inline truncate">
                                {th.nameEn}
                              </span>
                            </div>

                            {/* Sci Concept & Formula Pill */}
                            <div className="flex flex-col mt-0.5">
                              <span className="text-[10px] text-indigo-700 font-bold truncate">
                                ✦ {th.sciConcept}
                              </span>
                              <span className="text-[9px] text-zinc-500 font-mono truncate">
                                {th.sciFormula}
                              </span>
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="shrink-0 text-[10px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                            目前套用
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bottom Quick Random Action Footer */}
            <div className="pt-2.5 border-t border-zinc-200 flex items-center justify-between text-xs">
              <span className="text-[11px] text-zinc-400 font-bold">
                {state.isPlaying ? `正在撥放：${currentTrack.name}` : '目前處於關閉狀態'}
              </span>
              <button
                type="button"
                onClick={handleShuffleRandom}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <Shuffle className="w-3.5 h-3.5" />
                隨機換下一首
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
