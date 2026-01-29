import { useEffect, useState } from 'react';
import { AlertTriangle, X, RefreshCw, MessageCircle } from 'lucide-react';
import { apiErrorEvent, ApiError } from '../lib/api';

interface ErrorNotification {
  id: number;
  message: string;
  status: number;
}

export default function GlobalErrorToast() {
  const [errors, setErrors] = useState<ErrorNotification[]>([]);

  useEffect(() => {
    const handleError = (event: Event) => {
      const customEvent = event as CustomEvent<ApiError>;
      const error = customEvent.detail;

      // Don't show toast for 401 (handled by auth redirect)
      if (error.status === 401) return;

      const notification: ErrorNotification = {
        id: Date.now(),
        message: error.userMessage,
        status: error.status,
      };

      setErrors(prev => [...prev, notification]);

      // Auto-dismiss after 10 seconds
      setTimeout(() => {
        setErrors(prev => prev.filter(e => e.id !== notification.id));
      }, 10000);
    };

    apiErrorEvent.addEventListener('api-error', handleError);
    return () => apiErrorEvent.removeEventListener('api-error', handleError);
  }, []);

  const dismiss = (id: number) => {
    setErrors(prev => prev.filter(e => e.id !== id));
  };

  if (errors.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] space-y-3 max-w-sm">
      {errors.map((error) => (
        <div
          key={error.id}
          className="bg-[#1a1d24] border border-amber-500/30 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-amber-500/10 border-b border-amber-500/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <span className="font-semibold text-white">Oops!</span>
            </div>
            <button
              onClick={() => dismiss(error.id)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="px-4 py-3">
            <p className="text-sm text-gray-300 leading-relaxed">
              {error.message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-t border-white/10">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <a
              href="mailto:support@made4founders.com?subject=Error%20Report"
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition text-sm font-medium"
            >
              <MessageCircle className="w-4 h-4" />
              Support
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
