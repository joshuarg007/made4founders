import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyLoginMFA } from '../lib/api';
import { Loader2, AlertCircle, ArrowLeft, Shield } from 'lucide-react';

export default function MFAVerify() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mfaToken = searchParams.get('token');

  useEffect(() => {
    // If no token, redirect to login
    if (!mfaToken) {
      navigate('/login', { replace: true });
    }
  }, [mfaToken, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await verifyLoginMFA(mfaToken!, code);
      // Success - redirect to app (cookies are set by backend)
      window.location.href = '/app';  // Full reload to pick up auth cookies
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login', { replace: true });
  };

  if (!mfaToken) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center p-4 relative">
      {/* Back button */}
      <button
        onClick={handleBackToLogin}
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-white transition text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Login
      </button>

      {/* Logo */}
      <div className="mb-8">
        <img src="/made4founders-logo-horizontal.png" alt="Made4Founders" className="h-20 w-auto" />
      </div>

      {/* MFA Card */}
      <div className="w-full max-w-md bg-[#1a1d24] rounded-2xl border border-white/10 p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-violet-400" />
          </div>
          <h2 className="text-xl font-semibold text-white">Two-Factor Authentication</h2>
          <p className="text-gray-400 text-sm mt-2">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="w-full px-4 py-3 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition text-center text-2xl tracking-widest font-mono"
              placeholder="000000"
              autoComplete="one-time-code"
              autoFocus
              required
            />
            <p className="text-xs text-gray-500 mt-2 text-center">
              Or enter a backup code if you've lost access to your authenticator
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || code.length < 6}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify'
            )}
          </button>
        </form>
      </div>

      <p className="mt-8 text-xs text-gray-500">
        Made4Founders — Built by founders, for founders
      </p>
    </div>
  );
}
