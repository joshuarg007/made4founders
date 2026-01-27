import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Loader2, AlertCircle, ArrowLeft, Eye, EyeOff, UserPlus, Link2 } from 'lucide-react';
import { getPendingOAuth, linkOAuthToAccount, createAccountFromOAuth } from '../lib/api';
import type { PendingOAuthInfo } from '../lib/api';

// Provider icons
const LinkedInIcon = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const TwitterIcon = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const GoogleIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const GitHubIcon = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
  </svg>
);

const getProviderIcon = (provider: string) => {
  switch (provider) {
    case 'linkedin': return <LinkedInIcon />;
    case 'twitter': return <TwitterIcon />;
    case 'facebook': return <FacebookIcon />;
    case 'google': return <GoogleIcon />;
    case 'github': return <GitHubIcon />;
    default: return null;
  }
};

const getProviderColor = (provider: string) => {
  switch (provider) {
    case 'linkedin': return 'bg-[#0A66C2]';
    case 'twitter': return 'bg-black';
    case 'facebook': return 'bg-[#1877F2]';
    case 'google': return 'bg-[#1a1d24] text-white';
    case 'github': return 'bg-[#24292e]';
    default: return 'bg-gray-600';
  }
};

const getProviderName = (provider: string) => {
  switch (provider) {
    case 'linkedin': return 'LinkedIn';
    case 'twitter': return 'X (Twitter)';
    case 'facebook': return 'Facebook';
    case 'google': return 'Google';
    case 'github': return 'GitHub';
    default: return provider;
  }
};

export default function LinkAccount() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [pendingOAuth, setPendingOAuth] = useState<PendingOAuthInfo | null>(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'choose' | 'link' | 'create'>('choose');

  // Link form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/login?error=invalid_link');
      return;
    }

    const fetchPendingOAuth = async () => {
      try {
        const data = await getPendingOAuth(token);
        setPendingOAuth(data);
      } catch (err) {
        setError('This link has expired or is invalid. Please try logging in again.');
      } finally {
        setLoading(false);
      }
    };

    fetchPendingOAuth();
  }, [token, navigate]);

  const handleCreateAccount = async () => {
    if (!token) return;
    setIsSubmitting(true);
    setError('');

    try {
      await createAccountFromOAuth({ token });
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmitting(true);
    setError('');

    try {
      await linkOAuthToAccount({ token, email, password });
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!pendingOAuth) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#1a1d24] rounded-2xl border border-white/10 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Link Expired</h2>
          <p className="text-gray-400 mb-6">{error || 'This link has expired. Please try logging in again.'}</p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center p-4 relative">
      {/* Back to Login */}
      <Link
        to="/login"
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-white transition text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Login
      </Link>

      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <img src="/logo.webp" alt="Made4Founders" className="h-16 w-auto" />
        <div>
          <h1 className="text-xl font-bold text-white">Made4Founders</h1>
          <p className="text-sm text-gray-400">Account Setup</p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-[#1a1d24] rounded-2xl border border-white/10 p-8">
        {/* OAuth Provider Info */}
        <div className="flex items-center gap-4 mb-6 p-4 rounded-lg bg-[#1a1d24]/5 border border-white/10">
          <div className={`p-3 rounded-lg ${getProviderColor(pendingOAuth.provider)}`}>
            {getProviderIcon(pendingOAuth.provider)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-400">Signing in with</p>
            <p className="text-white font-medium">{getProviderName(pendingOAuth.provider)}</p>
            {pendingOAuth.name && (
              <p className="text-sm text-gray-400 truncate">{pendingOAuth.name}</p>
            )}
          </div>
          {pendingOAuth.avatar && (
            <img
              src={pendingOAuth.avatar}
              alt=""
              className="w-12 h-12 rounded-full"
            />
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {mode === 'choose' && (
          <>
            <h2 className="text-lg font-semibold text-white text-center mb-2">
              Welcome! Choose an option
            </h2>
            <p className="text-gray-400 text-sm text-center mb-6">
              This is your first time signing in with {getProviderName(pendingOAuth.provider)}.
            </p>

            <div className="space-y-3">
              <button
                onClick={handleCreateAccount}
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <UserPlus className="w-5 h-5" />
                )}
                Create New Account
              </button>

              <button
                onClick={() => setMode('link')}
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white font-medium hover:bg-[#1a1d24]/10 transition disabled:opacity-50 flex items-center justify-center gap-3"
              >
                <Link2 className="w-5 h-5" />
                Link to Existing Account
              </button>
            </div>

            <p className="mt-6 text-xs text-gray-500 text-center">
              If you already have an account, link this {getProviderName(pendingOAuth.provider)} login to it.
            </p>
          </>
        )}

        {mode === 'link' && (
          <>
            <button
              onClick={() => setMode('choose')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <h2 className="text-lg font-semibold text-white mb-2">
              Link to Existing Account
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Enter your existing account credentials to link {getProviderName(pendingOAuth.provider)}.
            </p>

            <form onSubmit={handleLinkAccount} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm text-gray-400 mb-1">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 pr-12 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition"
                    placeholder="Your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Linking...
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4" />
                    Link Account
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>

      <p className="mt-8 text-xs text-gray-500">
        Made4Founders - Built by founders, for founders
      </p>
    </div>
  );
}
