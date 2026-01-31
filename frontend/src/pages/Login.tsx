import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { getGoogleLoginUrl, getGitHubLoginUrl, getLinkedInLoginUrl, getTwitterLoginUrl } from '../lib/api';
import { validators, validationMessages } from '../lib/validation';

// SVG Icons for OAuth providers
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const GitHubIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
  </svg>
);

const LinkedInIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const TwitterIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

/* Facebook login temporarily disabled
const FacebookIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);
*/

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | 'linkedin' | 'twitter' | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const { login, register, mfaPending, verifyMfa, clearMfaPending } = useAuth();

  const validateEmail = (value: string): boolean => {
    if (!value || !validators.email(value)) {
      setEmailError(validationMessages.email);
      return false;
    }
    setEmailError(null);
    return true;
  };
  const navigate = useNavigate();

  // Always redirect to dashboard after login
  const redirectTo = '/app';

  const handleOAuthLogin = async (provider: 'google' | 'github' | 'linkedin' | 'twitter') => {
    setError('');
    setOauthLoading(provider);
    try {
      let response;
      switch (provider) {
        case 'google':
          response = await getGoogleLoginUrl();
          break;
        case 'github':
          response = await getGitHubLoginUrl();
          break;
        case 'linkedin':
          response = await getLinkedInLoginUrl();
          break;
        case 'twitter':
          response = await getTwitterLoginUrl();
          break;
        // Facebook login temporarily disabled
        // case 'facebook':
        //   response = await getFacebookLoginUrl();
        //   break;
      }
      window.location.href = response.url;
    } catch (err) {
      setError(`Failed to initiate ${provider} login. Please try again.`);
      setOauthLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate email before submitting
    if (!validateEmail(email)) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (isRegister) {
        await register(email, password, name || undefined);
        // After registration, navigate to app (they'll be redirected to MFA setup if required)
        navigate(redirectTo, { replace: true });
      } else {
        const result = await login(email, password);

        // If MFA is required, the login function handles state updates
        // The UI will show the MFA verification form
        if (result.mfaRequired) {
          setIsSubmitting(false);
          return;
        }

        // If MFA setup is required, redirect to setup page
        if (result.mfaSetupRequired) {
          navigate('/setup-mfa', { replace: true });
          return;
        }

        // Use Credential Management API to prompt browser to save password
        if (window.PasswordCredential) {
          try {
            const credential = new window.PasswordCredential({
              id: email,
              password: password,
              name: name || email,
            });
            await navigator.credentials.store(credential);
          } catch {
            // Credential storage failed, but login succeeded - continue
          }
        }

        // Navigate to app
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await verifyMfa(mfaCode);

      // Use Credential Management API to prompt browser to save password
      if (window.PasswordCredential) {
        try {
          const credential = new window.PasswordCredential({
            id: email,
            password: password,
            name: name || email,
          });
          await navigator.credentials.store(credential);
        } catch {
          // Credential storage failed, but login succeeded - continue
        }
      }

      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    clearMfaPending();
    setMfaCode('');
    setError('');
    setEmail('');
    setPassword('');
  };

  // MFA Verification Screen
  if (mfaPending) {
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
              <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
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

          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
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
              disabled={isSubmitting || mfaCode.length < 6}
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

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center p-4 relative">
      {/* Back to Home */}
      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-white transition text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>

      {/* Logo */}
      <div className="mb-8">
        <img src="/made4founders-logo-horizontal.png" alt="Made4Founders" className="h-20 w-auto" />
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-[#1a1d24] rounded-2xl border border-white/10 p-8">
        <h2 className="text-xl font-semibold text-white text-center mb-6">
          {isRegister ? 'Create your account' : 'Welcome back'}
        </h2>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Email/Password Form First */}
        <form
          onSubmit={handleSubmit}
          method="post"
          action="/login"
          className="space-y-4"
        >
          {isRegister && (
            <div>
              <label htmlFor="name" className="block text-sm text-gray-400 mb-1">Name</label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition"
                placeholder="Your name"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm text-gray-400 mb-1">Email</label>
            <div className="relative">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete={isRegister ? "email" : "username"}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) validateEmail(e.target.value);
                }}
                onBlur={(e) => e.target.value && validateEmail(e.target.value)}
                required
                className={`w-full px-4 py-3 rounded-lg bg-[#1a1d24]/5 border text-white placeholder-gray-500 focus:outline-none transition ${
                  emailError
                    ? 'border-red-500/50 focus:border-red-500'
                    : 'border-white/10 focus:border-cyan-500/50'
                }`}
                placeholder="you@company.com"
              />
              {emailError && (
                <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
              )}
            </div>
            {emailError && (
              <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {emailError}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-sm text-gray-400">Password</label>
              {!isRegister && (
                <Link to="/forgot-password" className="text-sm text-cyan-400 hover:text-cyan-300 transition">
                  Forgot password?
                </Link>
              )}
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isRegister ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 pr-12 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition"
                placeholder="At least 6 characters"
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
            className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:scale-[1.02] hover:shadow-lg hover:shadow-cyan-500/25 active:scale-[0.98]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isRegister ? 'Creating account...' : 'Signing in...'}
              </>
            ) : (
              <>{isRegister ? 'Create account' : 'Sign in'}</>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-[#1a1d24] text-gray-500">or continue with</span>
          </div>
        </div>

        {/* OAuth Buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleOAuthLogin('google')}
            disabled={oauthLoading !== null}
            className="w-full py-3 px-4 rounded-lg bg-white text-gray-800 font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-3 hover:bg-gray-100 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] border border-gray-200"
          >
            {oauthLoading === 'google' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => handleOAuthLogin('github')}
            disabled={oauthLoading !== null}
            className="w-full py-3 px-4 rounded-lg bg-[#24292e] text-white font-medium hover:bg-[#2f363d] transition disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {oauthLoading === 'github' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <GitHubIcon />
            )}
            Continue with GitHub
          </button>

          <button
            type="button"
            onClick={() => handleOAuthLogin('linkedin')}
            disabled={oauthLoading !== null}
            className="w-full py-3 px-4 rounded-lg bg-[#0A66C2] text-white font-medium hover:bg-[#004182] transition disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {oauthLoading === 'linkedin' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <LinkedInIcon />
            )}
            Continue with LinkedIn
          </button>

          <button
            type="button"
            onClick={() => handleOAuthLogin('twitter')}
            disabled={oauthLoading !== null}
            className="w-full py-3 px-4 rounded-lg bg-black text-white font-medium hover:bg-gray-900 transition disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {oauthLoading === 'twitter' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <TwitterIcon />
            )}
            Continue with X
          </button>

          {/* Facebook login temporarily disabled
          <button
            type="button"
            onClick={() => handleOAuthLogin('facebook')}
            disabled={oauthLoading !== null}
            className="w-full py-3 px-4 rounded-lg bg-[#1877F2] text-white font-medium hover:bg-[#0d65d9] transition disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {oauthLoading === 'facebook' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <FacebookIcon />
            )}
            Continue with Facebook
          </button>
          */}
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            className="text-sm text-gray-400 transition group"
          >
            {isRegister
              ? 'Already have an account? Sign in'
              : (<>Don't have an account? <span className="shine-button inline-block px-3 py-1 ml-1 rounded-full bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium">Create one</span></>)}
          </button>
        </div>
      </div>

      <p className="mt-8 text-xs text-gray-500">
        Made4Founders — Built by founders, for founders
      </p>
    </div>
  );
}
