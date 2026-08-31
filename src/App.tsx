import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import { Toaster } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAutoFullscreen } from './hooks/useAutoFullscreen';

import Layout from './Layout';
import Dashboard from './pages/Dashboard';
import StockTabDetail from './pages/StockTabDetail';

export default function App() {
  useAutoFullscreen();

  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="stock/:id" element={<StockTabDetail />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
