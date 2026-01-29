import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertCircle, ArrowLeft, Mail } from 'lucide-react';
import { validators, validationMessages } from '../lib/validation';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validateEmail = (value: string): boolean => {
    if (!value || !validators.email(value)) {
      setEmailError(validationMessages.email);
      return false;
    }
    setEmailError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to send reset email');
      }

      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center p-4 relative">
        <Link
          to="/login"
          className="absolute top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-white transition text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <img src="/logo.webp" alt="Made4Founders" className="h-20 w-auto" width={68} height={83} />
          <div>
            <h1 className="text-2xl font-bold text-white">Made4Founders</h1>
            <p className="text-sm text-gray-400">By Founders, For Founders</p>
          </div>
        </div>

        <div className="w-full max-w-md bg-[#1a1d24] rounded-2xl border border-white/10 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Check your email</h2>
          <p className="text-gray-400 mb-6">
            If an account exists with <span className="text-white">{email}</span>, we've sent a password reset link.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            The link will expire in 1 hour. Check your spam folder if you don't see it.
          </p>
          <Link
            to="/login"
            className="inline-block w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
          >
            Return to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center p-4 relative">
      <Link
        to="/login"
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-white transition text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Login
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <img src="/logo.webp" alt="Made4Founders" className="h-20 w-auto" width={68} height={83} />
        <div>
          <h1 className="text-2xl font-bold text-white">Made4Founders</h1>
          <p className="text-sm text-gray-400">By Founders, For Founders</p>
        </div>
      </div>

      <div className="w-full max-w-md bg-[#1a1d24] rounded-2xl border border-white/10 p-8">
        <h2 className="text-xl font-semibold text-white text-center mb-2">Forgot your password?</h2>
        <p className="text-gray-400 text-center text-sm mb-6">
          Enter your email and we'll send you a reset link.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-gray-400 mb-1">Email</label>
            <div className="relative">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Reset Link'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="text-sm text-gray-400 hover:text-white transition"
          >
            Remember your password? Sign in
          </Link>
        </div>
      </div>

      <p className="mt-8 text-xs text-gray-500">
        Made4Founders — Built by founders, for founders
      </p>
    </div>
  );
}
