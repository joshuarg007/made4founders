import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, Mail } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001/api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'no-token'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('no-token');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.detail || 'Verification failed');
        }

        setStatus('success');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Verification failed');
        setStatus('error');
      }
    };

    verifyEmail();
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;

    setIsResending(true);
    try {
      const response = await fetch(`${API_BASE}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });

      if (response.ok) {
        setResendSuccess(true);
      }
    } catch {
      // Silently handle - we show success regardless for security
      setResendSuccess(true);
    } finally {
      setIsResending(false);
    }
  };

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center p-4">
        <div className="mb-8">
          <img src="/made4founders-logo-horizontal.png" alt="Made4Founders" className="h-20 w-auto" />
        </div>

        <div className="w-full max-w-md bg-[#1a1d24] rounded-2xl border border-white/10 p-8 text-center">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Verifying your email...</h2>
          <p className="text-gray-400">Please wait while we confirm your email address.</p>
        </div>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center p-4">
        <div className="mb-8">
          <img src="/made4founders-logo-horizontal.png" alt="Made4Founders" className="h-20 w-auto" />
        </div>

        <div className="w-full max-w-md bg-[#1a1d24] rounded-2xl border border-white/10 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Email Verified!</h2>
          <p className="text-gray-400 mb-6">
            Your email has been successfully verified. You can now access all features of your account.
          </p>
          <Link
            to="/login"
            className="inline-block w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  // No token state
  if (status === 'no-token') {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center p-4">
        <div className="mb-8">
          <img src="/made4founders-logo-horizontal.png" alt="Made4Founders" className="h-20 w-auto" />
        </div>

        <div className="w-full max-w-md bg-[#1a1d24] rounded-2xl border border-white/10 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-yellow-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Verify Your Email</h2>
          <p className="text-gray-400 mb-6">
            Check your inbox for a verification link. Click the link in the email to verify your account.
          </p>

          {resendSuccess ? (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm mb-4">
              If an account exists with this email, we've sent a new verification link.
            </div>
          ) : (
            <form onSubmit={handleResend} className="space-y-4">
              <p className="text-sm text-gray-500">Didn't receive the email? Enter your email to resend.</p>
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-4 py-3 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition"
              />
              <button
                type="submit"
                disabled={isResending || !resendEmail}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isResending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Resend Verification Email'
                )}
              </button>
            </form>
          )}

          <Link
            to="/login"
            className="inline-block mt-4 text-sm text-gray-400 hover:text-white transition"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center p-4">
      <div className="mb-8">
        <img src="/made4founders-logo-horizontal.png" alt="Made4Founders" className="h-20 w-auto" />
      </div>

      <div className="w-full max-w-md bg-[#1a1d24] rounded-2xl border border-white/10 p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Verification Failed</h2>
        <p className="text-gray-400 mb-6">
          {errorMessage || 'The verification link is invalid or has expired.'}
        </p>

        {resendSuccess ? (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm mb-4">
            If an account exists with this email, we've sent a new verification link.
          </div>
        ) : (
          <form onSubmit={handleResend} className="space-y-4">
            <p className="text-sm text-gray-500">Enter your email to get a new verification link.</p>
            <input
              type="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-3 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition"
            />
            <button
              type="submit"
              disabled={isResending || !resendEmail}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isResending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Resend Verification Email'
              )}
            </button>
          </form>
        )}

        <Link
          to="/login"
          className="inline-block mt-4 text-sm text-gray-400 hover:text-white transition"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
