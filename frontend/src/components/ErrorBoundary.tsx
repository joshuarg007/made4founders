import { Component, type ReactNode } from 'react';
import { RefreshCw, MessageCircle, Home, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Page load error:', error, errorInfo);
  }

  handleRefresh = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/app';
  };

  handleContactSupport = () => {
    window.location.href = 'mailto:support@made4founders.com?subject=App%20Error%20Report';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0d14] flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            {/* Friendly illustration */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/10 mb-4">
                <AlertTriangle className="w-10 h-10 text-amber-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Oops! Something went wrong
              </h1>
              <p className="text-gray-400">
                Don't worry, this happens sometimes. Let's get you back on track.
              </p>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <button
                onClick={this.handleRefresh}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-cyan-500 text-white font-semibold hover:bg-cyan-600 transition-all active:scale-[0.98]"
              >
                <RefreshCw className="w-5 h-5" />
                Refresh Page
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-all border border-white/10"
              >
                <Home className="w-5 h-5" />
                Go to Dashboard
              </button>

              <button
                onClick={this.handleContactSupport}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-transparent text-gray-400 font-medium hover:text-white hover:bg-white/5 transition-all"
              >
                <MessageCircle className="w-5 h-5" />
                Contact Support
              </button>
            </div>

            {/* Helpful tips */}
            <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-sm text-gray-400 text-center">
                <span className="text-gray-300 font-medium">Quick tips:</span> Try refreshing the page,
                clearing your browser cache, or using a different browser.
              </p>
            </div>

            {/* Error details (collapsed) */}
            {this.state.error && (
              <details className="mt-4 text-xs text-gray-500">
                <summary className="cursor-pointer hover:text-gray-400 transition">
                  Technical details
                </summary>
                <pre className="mt-2 p-3 rounded-lg bg-black/50 overflow-auto max-h-32 text-red-400/70">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
