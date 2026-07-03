import React, { useState, useEffect } from 'react';
import { useAuth } from './lib/AuthContext';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, ActivitySquare, ExternalLink, HelpCircle } from 'lucide-react';
import { Premium3DGrid } from './components/Premium3DGrid';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './components/ui/dialog';
import { toast } from 'sonner';

export default function Layout() {
  const { user, login, signup, logout, loading: authLoading } = useAuth();
  const location = useLocation();
  const match = location.pathname.match(/\/stock\/(.+)/);
  const stockId = match ? match[1] : null;

  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) { toast.error('請輸入信箱和密碼'); return; }
    setLoginLoading(true);
    try { await login(loginEmail, loginPassword); }
    finally { setLoginLoading(false); }
  };

  const handleSignup = async () => {
    if (!signupEmail || !signupPassword) { toast.error('請輸入信箱和密碼'); return; }
    if (signupPassword.length < 6) { toast.error('密碼至少需要 6 個字元'); return; }
    setSignupLoading(true);
    try {
      await signup(signupEmail, signupPassword);
      setShowSignup(false);
    } finally { setSignupLoading(false); }
  };

  useEffect(() => {
    if (authLoading) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 3500);
      return () => clearTimeout(timer);
    } else {
      setLoadingTimeout(false);
    }
  }, [authLoading]);

  if (authLoading) {
    if (loadingTimeout) {
      return (
        <div className="h-screen w-full flex flex-col items-center justify-center px-4 relative overflow-hidden text-zinc-800">
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
      <div className="h-screen w-full flex flex-col items-center justify-center text-zinc-800 relative overflow-hidden">
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
      <div className="h-screen w-full flex flex-col items-center justify-center px-4 relative overflow-hidden text-zinc-800">
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

          <div className="space-y-4 w-full">
            <div className="space-y-3">
              <Input
                type="email"
                placeholder="電子郵件"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                className="w-full py-3 px-4 text-sm border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <Input
                type="password"
                placeholder="密碼"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                className="w-full py-3 px-4 text-sm border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>

            <button 
              onClick={handleLogin}
              disabled={loginLoading}
              className="w-full py-4 px-6 text-sm sm:text-base font-extrabold flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 active:scale-[0.98] cursor-pointer gap-3 disabled:opacity-50"
            >
              {loginLoading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : null}
              <span>{loginLoading ? '登入中...' : '登入'}</span>
            </button>

            <p className="text-xs text-zinc-500 text-center">
              還沒有帳號？{' '}
              <button onClick={() => { setShowSignup(true); setLoginEmail(''); setLoginPassword(''); }} className="text-emerald-600 font-bold hover:underline">
                註冊
              </button>
            </p>

            <Dialog open={showSignup} onOpenChange={setShowSignup}>
              <DialogContent className="max-w-[400px] rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black">註冊新帳號</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <Input
                    type="email"
                    placeholder="電子郵件"
                    value={signupEmail}
                    onChange={e => setSignupEmail(e.target.value)}
                    className="w-full py-3 px-4 text-sm border border-zinc-200 rounded-xl"
                  />
                  <Input
                    type="password"
                    placeholder="密碼（至少 6 碼）"
                    value={signupPassword}
                    onChange={e => setSignupPassword(e.target.value)}
                    className="w-full py-3 px-4 text-sm border border-zinc-200 rounded-xl"
                  />
                  <Button
                    onClick={handleSignup}
                    disabled={signupLoading}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl"
                  >
                    {signupLoading ? '註冊中...' : '註冊'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {window.self !== window.top && (
          <div className="flex flex-col items-center space-y-3 relative z-10 max-w-sm w-full">
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
    <div className="flex h-screen overflow-hidden text-zinc-800 relative">
      {/* Nike Premium 3D Grid Background with depth-of-field effect */}
      <Premium3DGrid />
      
      {/* Top right auth corner */}
      <div className="fixed top-4 right-6 z-[100] flex items-center gap-3">
        <div className="hidden sm:block text-right">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{user.displayName}</p>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
        <div className="w-full mx-auto px-2 sm:px-4 md:px-6 pt-16 sm:pt-16 md:pt-4 pb-10 md:pb-16 max-w-[1920px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
