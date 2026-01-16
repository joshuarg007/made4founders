import { useEffect, useState } from 'react';
import { AlertCircle, X, ExternalLink } from 'lucide-react';
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

      // Auto-dismiss after 8 seconds
      setTimeout(() => {
        setErrors(prev => prev.filter(e => e.id !== notification.id));
      }, 8000);
    };

    apiErrorEvent.addEventListener('api-error', handleError);
    return () => apiErrorEvent.removeEventListener('api-error', handleError);
  }, []);

  const dismiss = (id: number) => {
    setErrors(prev => prev.filter(e => e.id !== id));
  };

  if (errors.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] space-y-3 max-w-md">
      {errors.map((error) => (
        <div
          key={error.id}
          className="bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm animate-in slide-in-from-bottom-4 fade-in duration-300"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-100">Something went wrong</p>
              <p className="text-sm text-red-200/80 mt-1">{error.message}</p>
              <div className="flex items-center gap-4 mt-3 text-xs">
                <a
                  href="https://github.com/joshuarg007/made4founders/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-red-300 hover:text-red-100 transition"
                >
                  Report issue
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => window.location.reload()}
                  className="text-red-300 hover:text-red-100 transition"
                >
                  Refresh page
                </button>
              </div>
            </div>
            <button
              onClick={() => dismiss(error.id)}
              className="text-red-400 hover:text-red-200 transition flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
