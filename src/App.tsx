import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import { Toaster } from 'sonner';

import Layout from './Layout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const StockTabDetail = lazy(() => import('./pages/StockTabDetail'));

function PageFallback() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 space-y-4">
      <div className="w-9 h-9 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <span className="text-xs font-bold tracking-wider text-zinc-400 animate-pulse">
        頁面加速載入中...
      </span>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="stock/:id" element={<StockTabDetail />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
