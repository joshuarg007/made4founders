import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Loader2, CheckCircle, XCircle, Settings } from 'lucide-react';
import { getTellerStatus, createTellerEnrollment } from '../lib/api';

// Declare Teller global type
declare global {
  interface Window {
    TellerConnect?: {
      setup: (config: TellerConnectConfig) => TellerConnectInstance;
    };
  }
}

interface TellerConnectConfig {
  applicationId: string;
  products?: string[];
  onSuccess: (enrollment: TellerEnrollmentResult) => void;
  onInit?: () => void;
  onExit?: () => void;
  environment?: 'sandbox' | 'development' | 'production';
}

interface TellerConnectInstance {
  open: () => void;
}

interface TellerEnrollmentResult {
  accessToken: string;
  enrollment: {
    id: string;
    institution: {
      id: string;
      name: string;
    };
  };
}

interface TellerConnectButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export default function TellerConnectButton({
  onSuccess,
  onError,
  className = '',
  children
}: TellerConnectButtonProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'success' | 'error' | 'not_configured' | 'loading'>('loading');
  const [statusMessage, setStatusMessage] = useState('');
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<'sandbox' | 'development' | 'production'>('sandbox');
  const tellerInstance = useRef<TellerConnectInstance | null>(null);
  const scriptLoaded = useRef(false);

  // Load Teller Connect script
  useEffect(() => {
    if (scriptLoaded.current) return;

    const existingScript = document.querySelector('script[src="https://cdn.teller.io/connect/connect.js"]');
    if (existingScript) {
      scriptLoaded.current = true;
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.teller.io/connect/connect.js';
    script.async = true;
    script.onload = () => {
      scriptLoaded.current = true;
    };
    document.body.appendChild(script);

    return () => {
      // Don't remove script on cleanup - keep it loaded
    };
  }, []);

  // Check Teller status on mount
  useEffect(() => {
    const init = async () => {
      try {
        const statusResponse = await getTellerStatus();

        if (!statusResponse.configured || !statusResponse.application_id) {
          setStatus('not_configured');
          return;
        }

        setApplicationId(statusResponse.application_id);
        setEnvironment((statusResponse.environment || 'sandbox') as 'development' | 'sandbox' | 'production');
        setStatus('idle');
      } catch (err) {
        console.error('Failed to get Teller status:', err);
        setStatus('not_configured');
      }
    };
    init();
  }, []);

  const handleSuccess = useCallback(
    async (enrollment: TellerEnrollmentResult) => {
      setLoading(true);
      setStatus('connecting');
      setStatusMessage('Saving bank connection...');

      try {
        await createTellerEnrollment({
          access_token: enrollment.accessToken,
          enrollment_id: enrollment.enrollment.id,
          institution_id: enrollment.enrollment.institution.id,
          institution_name: enrollment.enrollment.institution.name,
        });

        setStatus('success');
        setStatusMessage(`Connected to ${enrollment.enrollment.institution.name}!`);
        onSuccess?.();

        // Reset after 3 seconds
        setTimeout(() => {
          setStatus('idle');
          setStatusMessage('');
        }, 3000);
      } catch (err) {
        setStatus('error');
        setStatusMessage('Failed to save bank connection');
        onError?.('Failed to save bank connection');

        setTimeout(() => {
          setStatus('idle');
          setStatusMessage('');
        }, 3000);
      } finally {
        setLoading(false);
      }
    },
    [onSuccess, onError]
  );

  const handleClick = useCallback(() => {
    if (!window.TellerConnect || !applicationId || loading) {
      console.warn('Teller Connect not ready');
      return;
    }

    // Create new instance each time (Teller recommends this)
    tellerInstance.current = window.TellerConnect.setup({
      applicationId,
      products: ['balance', 'transactions'],
      environment,
      onSuccess: handleSuccess,
      onInit: () => {
        console.log('Teller Connect initialized');
      },
      onExit: () => {
        console.log('Teller Connect closed');
      },
    });

    tellerInstance.current.open();
  }, [applicationId, environment, handleSuccess, loading]);

  // Show "not configured" state - link to integrations page
  if (status === 'not_configured') {
    return (
      <Link
        to="/app/integrations"
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition ${className}`}
      >
        <Settings className="w-5 h-5" />
        <span className="text-sm">Configure Bank Sync</span>
      </Link>
    );
  }

  // Still loading status check
  if (status === 'loading') {
    return (
      <button
        disabled
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-300 text-gray-500 cursor-not-allowed ${className}`}
      >
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Loading...</span>
      </button>
    );
  }

  const isReady = scriptLoaded.current && applicationId && !loading;

  const getButtonContent = () => {
    if (loading) {
      return (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Connecting...</span>
        </>
      );
    }

    if (status === 'success') {
      return (
        <>
          <CheckCircle className="w-5 h-5 text-green-500" />
          <span>{statusMessage}</span>
        </>
      );
    }

    if (status === 'error') {
      return (
        <>
          <XCircle className="w-5 h-5 text-red-500" />
          <span>{statusMessage}</span>
        </>
      );
    }

    return children || (
      <>
        <Building2 className="w-5 h-5" />
        <span>Connect Bank Account</span>
      </>
    );
  };

  return (
    <button
      onClick={handleClick}
      disabled={!isReady}
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium
        transition-colors duration-200
        ${isReady
          ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }
        ${className}
      `}
    >
      {getButtonContent()}
    </button>
  );
}
