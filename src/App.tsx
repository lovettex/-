import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import { Toaster } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAutoFullscreen } from './hooks/useAutoFullscreen';

import Layout from './Layout';
import Dashboard from './pages/Dashboard';

const StockTabDetail = lazy(() => import('./pages/StockTabDetail'));

function AppContent() {
  useAutoFullscreen();

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <Suspense
        fallback={
          <div className="min-h-screen w-full flex items-center justify-center bg-[#f5f5f7] text-zinc-700 text-sm font-bold">
            正在載入標的詳情與圖表...
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="stock/:id" element={<StockTabDetail />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
