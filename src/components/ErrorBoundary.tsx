import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-zinc-200 shadow-xl rounded-2xl p-6 sm:p-8 text-center">
            <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-600">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-black text-zinc-900 mb-2">畫面載入時發生狀況</h2>
            <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
              部分模組腳本載入暫時中斷或快取更新，請嘗試重新整理畫面以套用最新程式碼。
            </p>
            {this.state.error && (
              <div className="text-left bg-zinc-50 border border-zinc-200 rounded-xl p-3 mb-6 font-mono text-[11px] text-zinc-600 overflow-x-auto max-h-32">
                {this.state.error.message || 'Unknown error'}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                重試呈現
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                重新整理頁面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
