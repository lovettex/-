import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useAuth } from './lib/AuthContext';
import { Outlet } from 'react-router-dom';
import { ActivitySquare } from 'lucide-react';
import { Premium3DGrid } from './components/Premium3DGrid';
import { WhiteNoisePlayer } from './components/WhiteNoisePlayer';
import { whiteNoiseEngine, WhiteNoiseState } from './lib/whiteNoiseEngine';
import { PS5DynamicBackground } from './components/PS5DynamicBackground';
import { TopBackgroundSwitch } from './components/TopBackgroundSwitch';

const CrawlerSpider = lazy(() =>
  import('./components/CrawlerSpider').then((m) => ({ default: m.CrawlerSpider }))
);

export default function Layout() {
  const { user, login, loginAsGuest, loading: authLoading } = useAuth();
  const [ambientState, setAmbientState] = useState<WhiteNoiseState>(whiteNoiseEngine.getState());
  const [isCrawlerActive, setIsCrawlerActive] = useState(false);

  useEffect(() => {
    const handleToggle = () => setIsCrawlerActive((prev) => !prev);
    const handleSet = (e: Event) => {
      const ce = e as CustomEvent<boolean>;
      if (typeof ce.detail === 'boolean') {
        setIsCrawlerActive(ce.detail);
      }
    };
    window.addEventListener('toggle-crawler-spider', handleToggle);
    window.addEventListener('set-crawler-spider', handleSet);
    return () => {
      window.removeEventListener('toggle-crawler-spider', handleToggle);
      window.removeEventListener('set-crawler-spider', handleSet);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = whiteNoiseEngine.subscribe((s) => {
      setAmbientState(s);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (ambientState.bgEnabled) {
      document.body.classList.add('ps5-theme-active');
    } else {
      document.body.classList.remove('ps5-theme-active');
    }
    return () => {
      document.body.classList.remove('ps5-theme-active');
    };
  }, [ambientState.bgEnabled]);

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center py-10 text-zinc-800 relative bg-[#f5f5f7]">
        <Premium3DGrid />
        <div className="flex flex-col items-center space-y-4 relative z-10 p-8 bg-white/80 backdrop-blur-md rounded-2xl border border-zinc-200/50 shadow-lg">
          <div className="h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-bold tracking-wider text-zinc-600">系統載入中...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-10 relative text-zinc-800 bg-[#f5f5f7]">
        {ambientState.bgEnabled ? (
          <PS5DynamicBackground
            isActive={true}
            themeId={ambientState.bgThemeId}
            speedMultiplier={ambientState.bgSpeed}
          />
        ) : (
          <Premium3DGrid />
        )}

        <div
          className={`w-full max-w-[420px] p-8 sm:p-10 backdrop-blur-xl border border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.04)] rounded-[2.5rem] flex flex-col items-center text-center space-y-8 relative z-10 transition-colors duration-300 ${
            ambientState.bgEnabled ? 'bg-white/75' : 'bg-white/95'
          }`}
        >
          <div className="space-y-5 flex flex-col items-center">
            <div className="inline-flex justify-center items-center bg-zinc-100 p-4 border border-zinc-200/80 shadow-[0_10px_35px_rgba(16,185,129,0.12)] rounded-2xl backdrop-blur-xl hover:scale-105 transition-transform duration-300">
              <ActivitySquare className="h-12 w-12 text-emerald-600" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 uppercase">
                美股交易日誌
              </h1>
              <p className="text-[11px] text-zinc-500 font-extrabold tracking-widest uppercase bg-zinc-100 border border-zinc-200/60 px-3.5 py-1.5 rounded-full inline-block">
                Trading Log System
              </p>
            </div>
            <p className="text-zinc-600 text-sm font-semibold max-w-[280px] leading-relaxed">
              登入以管理您的個人交易策略、進度與操作日誌
            </p>
          </div>

          <button 
            onClick={login} 
            className="w-full py-4 px-6 text-sm sm:text-base font-extrabold flex items-center justify-center bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 rounded-2xl shadow-sm hover:shadow-md hover:border-zinc-300/80 transition-all duration-300 active:scale-[0.98] cursor-pointer gap-3"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
               <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
               <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
               <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
               <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span>使用 Google 帳號登入</span>
          </button>

          <div className="w-full flex items-center gap-3 my-1">
            <div className="flex-1 h-[1px] bg-zinc-200/80" />
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">或</span>
            <div className="flex-1 h-[1px] bg-zinc-200/80" />
          </div>

          <button
            type="button"
            onClick={loginAsGuest}
            className="w-full py-3.5 px-6 text-sm font-extrabold flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-2xl transition-all duration-200 active:scale-[0.98] cursor-pointer gap-2"
          >
            <span>以訪客體驗模式進入系統</span>
            <span className="text-emerald-600 font-bold">➔</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen text-zinc-800 relative w-full overflow-x-hidden">
      {ambientState.bgEnabled ? (
        <PS5DynamicBackground
          isActive={true}
          themeId={ambientState.bgThemeId}
          speedMultiplier={ambientState.bgSpeed}
        />
      ) : (
        <Premium3DGrid />
      )}

      {isCrawlerActive && (
        <div className="fixed top-3 right-3 sm:top-4 sm:right-6 z-[995] flex items-center gap-2">
          <Suspense fallback={null}>
            <CrawlerSpider
              isActive={isCrawlerActive}
              onToggle={() => setIsCrawlerActive((prev) => !prev)}
              hideButton={true}
            />
          </Suspense>
        </div>
      )}

      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[990]">
        <WhiteNoisePlayer />
      </div>

      <main className="flex-1 relative z-10 focus:outline-none w-full">
        {/* Switch Button on Top */}
        <div className="sticky top-0 z-40 w-full pointer-events-none">
          <div className="w-full max-w-[1920px] mx-auto px-2 sm:px-4 md:px-6 py-2 flex justify-end items-center pointer-events-auto">
            <TopBackgroundSwitch />
          </div>
        </div>

        <div className="w-full mx-auto px-2 sm:px-4 md:px-6 pb-20 md:pb-24 max-w-[1920px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
