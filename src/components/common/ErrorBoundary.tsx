import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Sentinel ErrorBoundary] Uncaught error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('sentinel_repeater_tabs_backup');
      localStorage.removeItem('sentinel_httpql_query_history');
    } catch {}
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center w-screen h-screen bg-[#141517] text-[#dfdfdf] p-8 select-none">
          <div className="max-w-md w-full bg-[#1e1f22] border border-red-500/40 rounded-xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-red-200 mb-1 font-mono">Sentinel Interface Recovered</h2>
            <p className="text-xs text-text-muted mb-4 leading-relaxed font-sans">
              An unexpected render issue occurred. You can safely restore the application state below without losing captured traffic data.
            </p>
            {this.state.error && (
              <pre className="w-full bg-[#141517] border border-border-subtle rounded p-3 text-[11px] font-mono text-red-300 text-left overflow-auto max-h-36 mb-4 whitespace-pre-wrap">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-accent-cyan hover:bg-accent-cyan-hover text-white rounded font-mono text-xs font-semibold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload Interface</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
