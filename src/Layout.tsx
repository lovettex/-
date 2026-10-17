import React, { useState, useEffect } from 'react';
import { useAuth } from './lib/AuthContext';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, ActivitySquare, ExternalLink, HelpCircle } from 'lucide-react';
import { Premium3DGrid } from './components/Premium3DGrid';
import { WhiteNoisePlayer } from './components/WhiteNoisePlayer';
import { PS5DynamicBackground } from './components/PS5DynamicBackground';
import { CrawlerSpider } from './components/CrawlerSpider';
import { whiteNoiseEngine, WhiteNoiseState } from './lib/whiteNoiseEngine';

export default function Layout() {
  const { user, login, logout, loading: authLoading } = useAuth();
  const location = useLocation();
  const match = location.pathname.match(/\/stock\/(.+)/);
  const stockId = match ? match[1] : null;

  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [ambientState, setAmbientState] = useState<WhiteNoiseState>(whiteNoiseEngine.getState());
  const [isCrawlerActive, setIsCrawlerActive] = useState(false);

  useEffect(() => {
    const unsubscribe = whiteNoiseEngine.subscribe((s) => {
      setAmbientState(s);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (authLoading) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 7000);
      return () => clearTimeout(timer);
    } else {
      setLoadingTimeout(false);
    }
  }, [authLoading]);

  if (authLoading) {
    if (loadingTimeout) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-10 relative text-zinc-800">
          {/* Nike Premium 3D Grid Background with depth-of-field effect */}
          <Premium3DGrid />

          <div className="w-full max-w-[440px] p-8 sm:p-10 bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.04)] rounded-[2.5rem] flex flex-col items-center text-center space-y-6 relative z-10">
            <div className="inline-flex justify-center items-center bg-zinc-100 p-4 border border-zinc-200/80 shadow-inner rounded-2xl">
              <HelpCircle className="h-10 w-10 text-emerald-600 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-zinc-900">
                網頁載入時間較長
              </h2>
              <p className="text-[11px] text-zinc-500 font-extrabold tracking-widest uppercase bg-zinc-100 border border-zinc-200/60 px-3.5 py-1 rounded-full inline-block">
                Connection Check
              </p>
            </div>

            <div className="text-zinc-600 text-sm font-semibold text-left space-y-2.5 leading-relaxed bg-zinc-50 border border-zinc-200/50 p-4 rounded-xl">
              <p className="text-[13px] font-bold text-zinc-700">這通常是因為您目前的瀏覽器：</p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-zinc-500">
                <li>在行動裝置（如 iPhone Chrome 或 Safari）中開啟，且限制了第三方 Cookie。</li>
                <li>啟用了「防止跨網站追蹤」或是處於無痕模式（Private Mode），阻擋了資料庫與登入驗證連線。</li>
              </ul>
            </div>

            <div className="w-full space-y-3 pt-2">
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 px-6 text-sm sm:text-base font-extrabold flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 active:scale-[0.98] cursor-pointer gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>在獨立新分頁中開啟</span>
              </a>

              <p className="text-[11px] text-zinc-400 font-medium">
                💡 iOS 用戶可至「設定」&gt;「Chrome」或「Safari」&gt; 啟用「允許跨網站追蹤」
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center py-10 text-zinc-800 relative">
        <Premium3DGrid />
        <div className="flex flex-col items-center space-y-4 relative z-10 p-8 bg-white/80 backdrop-blur-md rounded-2xl border border-zinc-200/50 shadow-lg">
          <div className="h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-bold tracking-wider text-zinc-500">系統載入中，請稍候...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-10 relative text-zinc-800">
        {/* Nike Premium 3D Grid Background with depth-of-field effect */}
        <Premium3DGrid />

        {/* Elegant Frosted Container Card */}
        <div className="w-full max-w-[420px] p-8 sm:p-10 bg-white/75 backdrop-blur-xl border border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.04)] rounded-[2.5rem] flex flex-col items-center text-center space-y-8 relative z-10">
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
        </div>

        {window.self !== window.top && (
          <div className="flex flex-col items-center space-y-3 relative z-10 max-w-sm w-full mt-4">
            <p className="text-xs font-bold text-zinc-500 text-center leading-relaxed bg-white/50 border border-zinc-200/40 px-5 py-2.5 rounded-2xl backdrop-blur-sm shadow-xs">
              如遇到無法登入的情況，請點擊下方按鈕以獨立新分頁開啟本站。
            </p>
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-black text-emerald-700 hover:text-emerald-800 transition-colors px-4 py-2 rounded-xl bg-emerald-150 hover:bg-emerald-200 border border-emerald-250/50 shadow-xs active:scale-95 duration-150"
            >
              開啟獨立新分頁
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen text-zinc-800 relative w-full overflow-x-hidden">
      {/* Default Clean Grid Background */}
      <Premium3DGrid />
      
      {/* PS5 Console Dashboard Dynamic Animated Background (Active when White Noise is playing) */}
      <PS5DynamicBackground
        isActive={ambientState.isPlaying && ambientState.bgEnabled}
        themeId={ambientState.bgThemeId}
        speedMultiplier={ambientState.bgSpeed}
      />

      {/* Top Right Floating Toolbar for 3D Crawler Spider */}
      <div className="fixed top-3 right-3 sm:top-4 sm:right-6 z-[995] flex items-center gap-2">
        <CrawlerSpider
          isActive={isCrawlerActive}
          onToggle={() => setIsCrawlerActive((prev) => !prev)}
        />
      </div>

      {/* Bottom Right WhiteNoise Floating Player & PS5 Dynamic Background Controls */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[990]">
        <WhiteNoisePlayer />
      </div>

      {/* Main Content */}
      <main className="flex-1 relative z-10 focus:outline-none w-full">
        <div className="w-full mx-auto px-2 sm:px-4 md:px-6 pt-3 sm:pt-4 pb-20 md:pb-24 max-w-[1920px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
