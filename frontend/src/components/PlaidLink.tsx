import { useState, useCallback, useEffect } from 'react';
import { usePlaidLink, type PlaidLinkOnSuccess, type PlaidLinkOptions } from 'react-plaid-link';
import { Building2, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { getPlaidStatus, createPlaidLinkToken, exchangePlaidPublicToken } from '../lib/api';

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export default function PlaidLinkButton({
  onSuccess,
  onError,
  className = '',
  children
}: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'success' | 'error' | 'not_configured'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [plaidConfigured, setPlaidConfigured] = useState<boolean | null>(null);

  // Check Plaid status and get link token on mount
  useEffect(() => {
    const init = async () => {
      try {
        // First check if Plaid is configured
        const statusResponse = await getPlaidStatus();
        setPlaidConfigured(statusResponse.configured);

        if (!statusResponse.configured) {
          setStatus('not_configured');
          return;
        }

        // If configured, get the link token
        const response = await createPlaidLinkToken();
        setLinkToken(response.link_token);
      } catch (err) {
        console.error('Failed to initialize Plaid:', err);
        // Don't show error to user if Plaid just isn't configured
        setPlaidConfigured(false);
        setStatus('not_configured');
      }
    };
    init();
  }, []);

  const handleSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, metadata) => {
      setLoading(true);
      setStatus('connecting');
      setStatusMessage('Connecting to your bank...');

      try {
        await exchangePlaidPublicToken({
          public_token: publicToken,
          institution_id: metadata.institution?.institution_id,
          institution_name: metadata.institution?.name,
        });

        setStatus('success');
        setStatusMessage(`Connected to ${metadata.institution?.name || 'your bank'}!`);
        onSuccess?.();

        // Reset after 3 seconds
        setTimeout(() => {
          setStatus('idle');
          setStatusMessage('');
        }, 3000);
      } catch (err) {
        setStatus('error');
        setStatusMessage('Failed to connect bank account');
        onError?.('Failed to connect bank account');

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

  const config: PlaidLinkOptions = {
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: (err) => {
      if (err) {
        console.warn('Plaid Link exited with error:', err);
      }
    },
  };

  const { open, ready } = usePlaidLink(config);

  const handleClick = () => {
    if (ready && !loading) {
      open();
    }
  };

  // Show "not configured" state
  if (status === 'not_configured' || plaidConfigured === false) {
    return (
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700/50 text-gray-400 ${className}`}>
        <AlertCircle className="w-5 h-5" />
        <span className="text-sm">Bank sync not configured</span>
      </div>
    );
  }

  // Still loading status check
  if (plaidConfigured === null) {
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
      disabled={!ready || loading}
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium
        transition-colors duration-200
        ${ready && !loading
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
