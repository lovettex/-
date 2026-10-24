import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootEl = document.getElementById('root');

// Catch any unhandled script errors during initial module evaluation
window.addEventListener('error', (event) => {
  console.warn("Global runtime notice:", event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.warn("Unhandled promise rejection notice:", event.reason);
});

if (rootEl) {
  try {
    const root = createRoot(rootEl);
    root.render(<App />);
  } catch (error: any) {
    console.error("Fatal startup error in React root mount:", error);
    rootEl.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; box-sizing: border-box;">
        <div style="max-width: 480px; width: 100%; background: #ffffff; border-radius: 24px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); text-align: center; border: 1px solid #e4e4e7;">
          <h2 style="font-size: 20px; font-weight: 800; color: #18181b; margin: 0 0 12px 0;">系統啟動時發生狀況</h2>
          <p style="font-size: 13px; color: #71717a; margin: 0 0 20px 0; line-height: 1.6;">已捕捉到初始化異常，請點擊下方按鈕重新載入畫面。</p>
          <pre style="background: #fafafa; border: 1px solid #f4f4f5; padding: 12px; border-radius: 12px; font-size: 11px; color: #ef4444; text-align: left; overflow-x: auto; max-height: 140px; margin-bottom: 24px;">${error?.message || String(error)}</pre>
          <button onclick="window.location.reload()" style="width: 100%; height: 48px; background: #059669; color: #ffffff; border: none; border-radius: 14px; font-weight: 700; font-size: 14px; cursor: pointer;">
            重新整理頁面
          </button>
        </div>
      </div>
    `;
  }
}
