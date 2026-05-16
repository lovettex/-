import React from 'react';
import { useAuth } from './lib/AuthContext';
import { NavLink, Outlet } from 'react-router-dom';
import { LogOut, ActivitySquare } from 'lucide-react';

export default function Layout() {
  const { user, login, logout, loading: authLoading } = useAuth();

  if (authLoading) return <div className="h-screen w-full flex items-center justify-center">載入中...</div>;

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center space-y-8 px-4 relative overflow-hidden bg-[#0A0A0A] text-white">
        {/* Background ambient lighting effects */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[10%] w-[50%] h-[50%] rounded-full bg-emerald-500/20 blur-[120px] mix-blend-screen opacity-50 animate-pulse" style={{ animationDuration: '8s' }}></div>
          <div className="absolute bottom-[-10%] right-[10%] w-[40%] h-[40%] rounded-full bg-blue-500/20 blur-[120px] mix-blend-screen opacity-40 animate-pulse" style={{ animationDuration: '10s' }}></div>
        </div>
        <div className="text-center space-y-6 mb-2 relative z-10">
          <div className="inline-flex justify-center items-center bg-white/5 p-5 border border-white/10 shadow-[0_0_30px_rgba(16,185,129,0.2)] rounded-2xl mb-4 backdrop-blur-xl">
            <ActivitySquare className="h-14 w-14 text-emerald-400" />
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 drop-shadow-sm uppercase">美股交易日誌</h1>
          <p className="text-white/60 font-medium tracking-widest text-sm uppercase bg-white/5 border border-white/10 px-4 py-2 rounded-full inline-block backdrop-blur-sm">登入以管理您的個人交易策略與日誌</p>
        </div>
        <button 
          onClick={login} 
          className="relative z-10 glass-button py-4 px-10 text-lg font-semibold flex items-center justify-center min-w-[280px] hover:scale-105"
        >
          <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
             <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
             <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
             <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
             <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span className="text-white/90">Google 登入</span>
        </button>
        {window.self !== window.top && (
          <p className="text-xs font-medium text-white/40 mt-6 text-center max-w-sm relative z-10 tracking-wider">
            如遇到無法登入的情況，請使用下方按鈕以獨立新分頁開啟本站。
          </p>
        )}
        {window.self !== window.top && (
          <a
            href={window.location.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors relative z-10 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20"
          >
            以新視窗開啟
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0A0A0A] text-white relative">
      {/* Background ambient lighting effects (organic fluid shapes) */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Glow 1 */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/10 blur-[120px] mix-blend-screen opacity-50 animate-pulse" style={{ animationDuration: '8s' }}></div>
        {/* Glow 2 */}
        <div className="absolute top-[20%] right-[-5%] w-[35%] h-[35%] rounded-full bg-blue-500/10 blur-[120px] mix-blend-screen opacity-40 animate-pulse" style={{ animationDuration: '10s' }}></div>
        {/* Glow 3 */}
        <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[40%] rounded-full bg-purple-500/10 blur-[140px] mix-blend-screen opacity-30 animate-pulse" style={{ animationDuration: '12s' }}></div>
      </div>
      
      {/* Top right auth corner */}
      <div className="fixed top-4 right-6 z-[100] flex items-center gap-3">
        <div className="hidden sm:block text-right">
          <p className="text-xs font-bold text-white/50 uppercase tracking-widest">{user.displayName}</p>
        </div>
        <button 
          className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-all shadow-lg backdrop-blur-md" 
          onClick={logout} 
          title="登出"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {/* Floating Dashboard Dot */}
      <NavLink
        to="/"
        title="交易總覽"
        className={({ isActive }) =>
          `fixed right-6 top-1/2 -translate-y-1/2 z-[100] flex items-center justify-center w-12 h-12 rounded-full backdrop-blur-xl transition-all duration-300 shadow-2xl group ${
            isActive 
              ? 'opacity-0 pointer-events-none' 
              : 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/30'
          }`
        }
      >
        <div className="relative flex items-center justify-center w-full h-full">
          <div className="w-3 h-3 rounded-full bg-emerald-400 group-hover:scale-150 group-hover:shadow-[0_0_15px_rgba(52,211,153,0.8)] transition-all duration-300"></div>
          <span className="absolute right-14 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 px-3 py-1.5 rounded-lg text-xs font-bold text-white border border-white/10">交易總覽</span>
        </div>
      </NavLink>

      {/* Main Content */}
      <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
        <div className="w-full mx-auto px-2 sm:px-4 md:px-6 pt-2 pb-10 md:pt-4 md:pb-16 max-w-[1920px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
