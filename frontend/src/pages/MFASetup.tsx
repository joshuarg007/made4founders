import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { setupMFA, verifyMFASetup } from '../lib/api';
import { Loader2, AlertCircle, ArrowLeft, Shield, Copy, Check, Eye, EyeOff } from 'lucide-react';

export default function MFASetup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { mfaSetupRequired, clearMfaSetupRequired, refreshUser, isAuthenticated } = useAuth();

  // Check if coming from OAuth flow (has token in URL)
  const oauthToken = searchParams.get('token');

  const [step, setStep] = useState<'loading' | 'setup' | 'verify' | 'backup'>('loading');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [savedBackupCodes, setSavedBackupCodes] = useState(false);

  useEffect(() => {
    // If coming from OAuth flow with token, allow MFA setup even if already authenticated
    if (oauthToken && isAuthenticated) {
      initSetup();
      return;
    }

    // If user is already authenticated and doesn't need MFA setup, redirect to app
    if (isAuthenticated && !mfaSetupRequired) {
      navigate('/app', { replace: true });
      return;
    }

    // If not authenticated and no setup required state and no OAuth token, redirect to login
    if (!isAuthenticated && !mfaSetupRequired && !oauthToken) {
      navigate('/login', { replace: true });
      return;
    }

    // Initialize MFA setup
    initSetup();
  }, [isAuthenticated, mfaSetupRequired, oauthToken, navigate]);

  const initSetup = async () => {
    try {
      const response = await setupMFA();
      setQrCode(response.qr_code);
      setSecret(response.secret);
      setBackupCodes(response.backup_codes);
      setStep('setup');
    } catch (err) {
      setError('Failed to initialize MFA setup. Please try again.');
      setStep('setup');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await verifyMFASetup(verificationCode);
      setStep('backup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!savedBackupCodes) {
      setError('Please confirm you have saved your backup codes');
      return;
    }

    clearMfaSetupRequired();
    await refreshUser();

    // For OAuth flows, do a full page reload to ensure auth state is properly refreshed
    if (oauthToken) {
      window.location.href = '/app';
    } else {
      navigate('/app', { replace: true });
    }
  };

  const copyToClipboard = async (text: string, type: 'secret' | 'backup') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'secret') {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
      } else {
        setCopiedBackup(true);
        setTimeout(() => setCopiedBackup(false), 2000);
      }
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  const handleBackToLogin = () => {
    clearMfaSetupRequired();
    navigate('/login', { replace: true });
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        <p className="text-gray-400 mt-4">Setting up two-factor authentication...</p>
      </div>
    );
  }

  if (step === 'backup') {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center p-4 relative">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <img src="/logo.webp" alt="Made4Founders" className="h-20 w-auto" width={68} height={83} />
          <div>
            <h1 className="text-2xl font-bold text-white">Made4Founders</h1>
            <p className="text-sm text-gray-400">By Founders, For Founders</p>
          </div>
        </div>

        <div className="w-full max-w-md bg-[#1a1d24] rounded-2xl border border-white/10 p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Save Your Backup Codes</h2>
            <p className="text-gray-400 text-sm mt-2">
              Store these codes in a safe place. You can use them to access your account if you lose your authenticator.
            </p>
          </div>

          <div className="bg-[#0f1117] rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {backupCodes.map((code, i) => (
                <div key={i} className="text-gray-300 bg-white/5 rounded px-2 py-1 text-center">
                  {code}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => copyToClipboard(backupCodes.join('\n'), 'backup')}
            className="w-full py-2 px-4 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition flex items-center justify-center gap-2 mb-4"
          >
            {copiedBackup ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Backup Codes
              </>
            )}
          </button>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <label className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={savedBackupCodes}
              onChange={(e) => setSavedBackupCodes(e.target.checked)}
              className="w-4 h-4 rounded border-amber-500 bg-transparent text-amber-500 focus:ring-amber-500"
            />
            <span className="text-amber-300 text-sm">
              I have saved my backup codes in a safe place
            </span>
          </label>

          <button
            onClick={handleComplete}
            disabled={!savedBackupCodes}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            Complete Setup
          </button>
        </div>

        <p className="mt-8 text-xs text-gray-500">
          Made4Founders — Built by founders, for founders
        </p>
      </div>
    );
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
      <div className="flex items-center gap-3 mb-8">
        <img src="/logo.webp" alt="Made4Founders" className="h-20 w-auto" width={68} height={83} />
        <div>
          <h1 className="text-2xl font-bold text-white">Made4Founders</h1>
          <p className="text-sm text-gray-400">By Founders, For Founders</p>
        </div>
      </div>

      <div className="w-full max-w-md bg-[#1a1d24] rounded-2xl border border-white/10 p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-violet-400" />
          </div>
          <h2 className="text-xl font-semibold text-white">Set Up Two-Factor Authentication</h2>
          <p className="text-gray-400 text-sm mt-2">
            Two-factor authentication is required to secure your account
          </p>
        </div>

        {/* QR Code */}
        {qrCode && (
          <div className="bg-white rounded-lg p-4 mb-4 flex items-center justify-center">
            <img
              src={`data:image/png;base64,${qrCode}`}
              alt="QR Code for authenticator app"
              className="w-48 h-48"
            />
          </div>
        )}

        {/* Manual entry option */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2 text-center">
            Can't scan? Enter this code manually in your authenticator app:
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#0f1117] rounded-lg px-3 py-2 font-mono text-sm text-gray-300 overflow-hidden">
              {showSecret ? secret : '••••••••••••••••••••••••••••••••'}
            </div>
            <button
              onClick={() => setShowSecret(!showSecret)}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition"
              title={showSecret ? 'Hide secret' : 'Show secret'}
            >
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={() => copyToClipboard(secret, 'secret')}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition"
              title="Copy secret"
            >
              {copiedSecret ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Enter the 6-digit code from your authenticator
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-4 py-3 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition text-center text-2xl tracking-widest font-mono"
              placeholder="000000"
              autoComplete="one-time-code"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || verificationCode.length !== 6}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify & Continue'
            )}
          </button>
        </form>

        <div className="mt-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
          <p className="text-cyan-300 text-xs">
            <strong>Recommended apps:</strong> Google Authenticator, Authy, 1Password, or any TOTP-compatible app.
          </p>
        </div>
      </div>

      <p className="mt-8 text-xs text-gray-500">
        Made4Founders — Built by founders, for founders
      </p>
    </div>
  );
}
