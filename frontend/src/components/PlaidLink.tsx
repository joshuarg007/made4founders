import { useState, useCallback, useEffect } from 'react';
import { usePlaidLink, type PlaidLinkOnSuccess, type PlaidLinkOptions } from 'react-plaid-link';
import { Building2, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { createPlaidLinkToken, exchangePlaidPublicToken } from '../lib/api';

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
  const [status, setStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // Get link token on mount
  useEffect(() => {
    const getToken = async () => {
      try {
        const response = await createPlaidLinkToken();
        setLinkToken(response.link_token);
      } catch (err) {
        console.error('Failed to create link token:', err);
        onError?.('Failed to initialize bank connection');
      }
    };
    getToken();
  }, [onError]);

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
