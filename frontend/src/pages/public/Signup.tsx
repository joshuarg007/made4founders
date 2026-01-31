import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import SEO, { pageSEO } from '../../components/SEO';
import { validators, validationMessages } from '../../lib/validation';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

export default function Signup() {
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan') || 'free';
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string[] }>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Clear validation error when user types
    if (e.target.name === 'email' && validationErrors.email) {
      validateEmail(e.target.value);
    }
    if (e.target.name === 'password' && validationErrors.password) {
      validatePassword(e.target.value);
    }
  };

  const validateEmail = (value: string): boolean => {
    if (!value || !validators.email(value)) {
      setValidationErrors(prev => ({ ...prev, email: validationMessages.email }));
      return false;
    }
    setValidationErrors(prev => ({ ...prev, email: undefined }));
    return true;
  };

  const validatePassword = (value: string): boolean => {
    const result = validators.password(value);
    if (!result.valid) {
      setValidationErrors(prev => ({ ...prev, password: result.errors }));
      return false;
    }
    setValidationErrors(prev => ({ ...prev, password: undefined }));
    return true;
  };

  const validateForm = (): boolean => {
    const emailValid = validateEmail(formData.email);
    const passwordValid = validatePassword(formData.password);
    return emailValid && passwordValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate form before submitting
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Registration failed');
      }

      // Small delay to allow browser to detect successful signup and prompt to save password
      await new Promise(resolve => setTimeout(resolve, 100));
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setOauthLoading(provider);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/auth/${provider}/login`);
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Failed to get OAuth URL');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OAuth initialization failed');
      setOauthLoading(null);
    }
  };

  const benefits = [
    '14-day free trial',
    'No charge until day 15',
    'Cancel anytime',
    '96-item compliance checklist',
    'Encrypted credential vault',
  ];

  return (
    <div className="min-h-screen bg-[#0f1117] flex">
      <SEO {...pageSEO.signup} />

      {/* Left side - Form */}
      <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
        {/* Back to Home */}
        <Link
          to="/"
          className="absolute top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-white transition text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Logo */}
        <Link to="/" className="mb-8 hover:opacity-80 transition-opacity">
          <img src="/made4founders-logo-horizontal.png" alt="Made4Founders" className="h-20 w-auto" />
        </Link>

        {/* Card */}
        <div className="w-full max-w-md bg-[#1a1d24] rounded-2xl border border-white/10 p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-white mb-2">Start your free trial</h2>
            <p className="text-gray-400 text-sm">
              {plan !== 'free'
                ? `You selected the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan`
                : 'Get started with Made4Founders today'}
            </p>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleOAuth('google')}
              disabled={oauthLoading !== null}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-white text-gray-900 font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {oauthLoading === 'google' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Continue with Google
            </button>

            <button
              onClick={() => handleOAuth('github')}
              disabled={oauthLoading !== null}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-[#24292e] text-white font-medium hover:bg-[#2f363d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {oauthLoading === 'github' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              )}
              Continue with GitHub
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#0a0d14] text-gray-500">or sign up with email</span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} method="post" action="/signup" className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                autoComplete="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-colors"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  id="email"
                  name="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={(e) => e.target.value && validateEmail(e.target.value)}
                  required
                  className={`w-full px-4 py-3 rounded-lg bg-white/5 border text-white placeholder-gray-500 focus:outline-none focus:ring-1 transition-colors ${
                    validationErrors.email
                      ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/50'
                      : 'border-white/10 focus:border-cyan-500/50 focus:ring-cyan-500/50'
                  }`}
                  placeholder="you@company.com"
                />
                {validationErrors.email && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                )}
              </div>
              {validationErrors.email && (
                <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {validationErrors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={(e) => e.target.value && validatePassword(e.target.value)}
                  required
                  minLength={8}
                  className={`w-full px-4 py-3 rounded-lg bg-white/5 border text-white placeholder-gray-500 focus:outline-none focus:ring-1 transition-colors pr-12 ${
                    validationErrors.password
                      ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/50'
                      : 'border-white/10 focus:border-cyan-500/50 focus:ring-cyan-500/50'
                  }`}
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {validationErrors.password && validationErrors.password.length > 0 && (
                <div className="mt-2 text-xs text-red-400">
                  <p className="flex items-center gap-1 mb-1">
                    <AlertCircle className="w-3 h-3" />
                    Password must include:
                  </p>
                  <ul className="ml-4 space-y-0.5">
                    {validationErrors.password.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-cyan-400 hover:text-cyan-300 transition-colors">
              Sign in
            </Link>
          </p>

          <p className="mt-4 text-center text-xs text-gray-500">
            By signing up, you agree to our{' '}
            <Link to="/terms" className="text-gray-400 hover:text-white transition">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" className="text-gray-400 hover:text-white transition">Privacy Policy</Link>
          </p>
        </div>

        <p className="mt-8 text-xs text-gray-500">
          Made4Founders — Built by founders, for founders
        </p>
      </div>

      {/* Right side - Benefits (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-cyan-500/10 to-violet-600/10 border-l border-white/10 px-8">
        <div className="max-w-md">
          <h2 className="text-2xl font-bold text-white mb-6">
            Why founders choose Made4Founders
          </h2>
          <ul className="space-y-4">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-3 text-gray-300">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                {benefit}
              </li>
            ))}
          </ul>

          <div className="mt-12 p-6 rounded-xl bg-white/5 border border-white/10">
            <p className="text-gray-400 italic mb-4">
              "Made4Founders saved me 10+ hours a week. I can finally focus on building instead of managing spreadsheets."
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-white font-medium">
                SC
              </div>
              <div>
                <div className="text-white font-medium">Sarah Chen</div>
                <div className="text-gray-500 text-sm">Founder, TechVenture</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
