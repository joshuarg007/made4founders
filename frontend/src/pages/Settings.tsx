import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Loader2,
  Sparkles,
  Crown,
  Zap,
  Settings as SettingsIcon,
  Trophy,
  Gamepad2,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  Globe,
  Download,
  Trash2,
  Mail,
  Shield,
  User,
  Smartphone,
  Key,
  Copy,
  Eye,
  EyeOff,
  FileText,
  RefreshCw,
  Bot,
  Server,
  Cloud,
  DollarSign,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react';
import {
  getSubscriptionStatus,
  createCheckoutSession,
  createPortalSession,
  updateBusiness,
  getMFAStatus,
  setupMFA,
  verifyMFASetup,
  disableMFA,
  regenerateBackupCodes,
  changePassword,
  getAuditLogs,
  getAuditLogStats,
  exportAuditLogs,
  exportAllData,
  getAIStatus,
  setAIProvider,
  getAIUsage,
  type SubscriptionStatus,
  type AuditLogEntry,
  type AuditLogStats,
  type AIStatus,
  type AIUsageStats,
} from '../lib/api';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { isSoundMuted, setSoundMuted, getSoundVolume, setSoundVolume, playNotificationSound } from '../lib/sounds';

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 7,
    yearlyPrice: 70,
    priceKey: 'starter',
    features: ['1 user', '5GB storage', 'Full dashboard', 'Credential vault'],
    icon: Zap,
    color: 'cyan',
  },
  {
    id: 'growth',
    name: 'Growth',
    monthlyPrice: 29,
    yearlyPrice: 290,
    priceKey: 'growth',
    features: ['3 users', '25GB storage', 'Analytics', 'Email integration'],
    icon: Crown,
    color: 'purple',
  },
  {
    id: 'scale',
    name: 'Scale',
    monthlyPrice: 79,
    yearlyPrice: 790,
    priceKey: 'scale',
    features: ['10 users', '100GB storage', 'Marketing tools', 'Priority support'],
    icon: Sparkles,
    color: 'amber',
  },
];

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  active: { label: 'Active', color: 'text-green-400 bg-green-400/10', icon: CheckCircle },
  trialing: { label: 'Trial', color: 'text-cyan-400 bg-cyan-400/10', icon: Clock },
  past_due: { label: 'Past Due', color: 'text-yellow-400 bg-yellow-400/10', icon: AlertCircle },
  canceled: { label: 'Canceled', color: 'text-gray-400 bg-gray-400/10', icon: AlertCircle },
  unpaid: { label: 'Unpaid', color: 'text-red-400 bg-red-400/10', icon: AlertCircle },
};

export default function Settings() {
  const [searchParams] = useSearchParams();
  const { currentBusiness, refreshBusinesses } = useBusiness();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  // Business settings state
  const [savingGamification, setSavingGamification] = useState(false);
  const [soundMuted, setSoundMutedState] = useState(() => isSoundMuted());
  const [soundVolume, setSoundVolumeState] = useState(() => Math.round(getSoundVolume() * 100));

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [deadlineReminders, setDeadlineReminders] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);

  // Display preferences
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaQrCode, setMfaQrCode] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaBackupCodes, setMfaBackupCodes] = useState<string[]>([]);
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [showMfaDisable, setShowMfaDisable] = useState(false);
  const [mfaDisablePassword, setMfaDisablePassword] = useState('');
  const [mfaDisableCode, setMfaDisableCode] = useState('');
  const [showMfaPassword, setShowMfaPassword] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordChanging, setPasswordChanging] = useState(false);

  // Audit logs state (admin only)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditStats, setAuditStats] = useState<AuditLogStats | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // AI Provider settings state
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [aiUsage, setAiUsage] = useState<AIUsageStats | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiSaving, setAiSaving] = useState(false);

  useEffect(() => {
    loadSubscription();
    loadMfaStatus();
    loadAIData();

    // Load audit logs for admins
    if (user?.role === 'admin') {
      loadAuditData();
    }

    // Check for success/canceled from Stripe redirect
    if (searchParams.get('success') === 'true') {
      setSuccessMessage('Your subscription has been updated successfully!');
      // Remove query params
      window.history.replaceState({}, '', '/app/settings');
    } else if (searchParams.get('canceled') === 'true') {
      setError('Checkout was canceled. No changes were made.');
      window.history.replaceState({}, '', '/app/settings');
    }
  }, [searchParams, user?.role]);

  const loadSubscription = async () => {
    try {
      const data = await getSubscriptionStatus();
      setSubscription(data);
    } catch (err) {
      setError('Failed to load subscription status');
    } finally {
      setLoading(false);
    }
  };

  const loadMfaStatus = async () => {
    try {
      const data = await getMFAStatus();
      setMfaEnabled(data.mfa_enabled);
    } catch (err) {
      console.error('Failed to load MFA status:', err);
    } finally {
      setMfaLoading(false);
    }
  };

  const loadAuditData = async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const [logs, stats] = await Promise.all([
        getAuditLogs({ limit: 50 }),
        getAuditLogStats()
      ]);
      setAuditLogs(logs);
      setAuditStats(stats);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      setAuditError('Failed to load audit logs');
    } finally {
      setAuditLoading(false);
    }
  };

  const loadAIData = async () => {
    setAiLoading(true);
    try {
      const [status, usage] = await Promise.all([
        getAIStatus(),
        getAIUsage(30)
      ]);
      setAiStatus(status);
      setAiUsage(usage);
    } catch (err) {
      console.error('Failed to load AI status:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSetAIProvider = async (provider: string) => {
    setAiSaving(true);
    try {
      await setAIProvider(provider);
      setSuccessMessage(`AI provider preference set to ${provider}`);
      await loadAIData();
    } catch (err) {
      setError('Failed to update AI provider preference');
    } finally {
      setAiSaving(false);
    }
  };

  const handleExportAuditLogs = async () => {
    setActionLoading('export-audit');
    try {
      await exportAuditLogs();
    } catch (err) {
      setError('Failed to export audit logs');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMfaSetup = async () => {
    setActionLoading('mfa-setup');
    setError(null);
    try {
      const data = await setupMFA();
      setMfaQrCode(data.qr_code);
      setMfaSecret(data.secret);
      setMfaBackupCodes(data.backup_codes);
      setShowMfaSetup(true);
    } catch (err) {
      setError('Failed to initialize MFA setup. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMfaVerify = async () => {
    if (!mfaVerifyCode || mfaVerifyCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }
    setActionLoading('mfa-verify');
    setError(null);
    try {
      await verifyMFASetup(mfaVerifyCode);
      setMfaEnabled(true);
      setShowMfaSetup(false);
      setShowBackupCodes(true);
      setSuccessMessage('Two-factor authentication enabled successfully!');
      setMfaVerifyCode('');
    } catch (err) {
      setError('Invalid verification code. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMfaDisable = async () => {
    if (!mfaDisablePassword || !mfaDisableCode) {
      setError('Please enter both your password and MFA code');
      return;
    }
    setActionLoading('mfa-disable');
    setError(null);
    try {
      await disableMFA(mfaDisablePassword, mfaDisableCode);
      setMfaEnabled(false);
      setShowMfaDisable(false);
      setSuccessMessage('Two-factor authentication has been disabled.');
      setMfaDisablePassword('');
      setMfaDisableCode('');
    } catch (err) {
      setError('Invalid password or MFA code. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    const code = prompt('Enter your current MFA code to generate new backup codes:');
    if (!code) return;
    setActionLoading('mfa-backup');
    setError(null);
    try {
      const data = await regenerateBackupCodes(code);
      setMfaBackupCodes(data.backup_codes);
      setShowBackupCodes(true);
      setSuccessMessage('New backup codes generated. Please save them securely.');
    } catch (err) {
      setError('Invalid MFA code. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all password fields');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    setPasswordChanging(true);
    setError(null);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccessMessage('Password changed successfully!');
      setShowPasswordChange(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to change password';
      setError(errorMessage);
    } finally {
      setPasswordChanging(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccessMessage('Copied to clipboard!');
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  const handleUpgrade = async (priceKey: string) => {
    setActionLoading(priceKey);
    setError(null);
    try {
      const fullPriceKey = `${priceKey}_${billingCycle}`;
      const session = await createCheckoutSession(fullPriceKey);
      window.location.href = session.checkout_url;
    } catch (err) {
      setError('Failed to start checkout. Please try again.');
      setActionLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setActionLoading('portal');
    setError(null);
    try {
      const session = await createPortalSession();
      window.location.href = session.portal_url;
    } catch (err) {
      setError('Failed to open billing portal. Please try again.');
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDaysRemaining = (dateStr: string | null) => {
    if (!dateStr) return null;
    const end = new Date(dateStr);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  // Gamification toggle
  const toggleGamification = async () => {
    if (!currentBusiness) return;
    setSavingGamification(true);
    try {
      await updateBusiness(currentBusiness.id, {
        gamification_enabled: !currentBusiness.gamification_enabled
      });
      await refreshBusinesses();
    } catch (error) {
      console.error('Failed to toggle gamification:', error);
    } finally {
      setSavingGamification(false);
    }
  };

  // Sound settings
  const toggleSoundMute = () => {
    const newMuted = !soundMuted;
    setSoundMuted(newMuted);
    setSoundMutedState(newMuted);
    if (!newMuted) {
      setTimeout(() => playNotificationSound(), 100);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setSoundVolumeState(newVolume);
    setSoundVolume(newVolume / 100);
    if (soundMuted && newVolume > 0) {
      setSoundMuted(false);
      setSoundMutedState(false);
    }
  };

  const handleVolumeChangeEnd = () => {
    if (!soundMuted && soundVolume > 0) {
      playNotificationSound();
    }
  };

  // Export data handler
  const handleExportData = async () => {
    setActionLoading('export');
    try {
      await exportAllData();
      setSuccessMessage('Data exported successfully! Check your downloads folder.');
    } catch (err) {
      setError('Failed to export data');
    } finally {
      setActionLoading(null);
    }
  };

  // Common timezones for dropdown
  const commonTimezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Singapore',
    'Australia/Sydney',
    'Pacific/Auckland',
  ];

  const currentPlan = plans.find(p => p.id === subscription?.tier);
  const status = subscription?.status ? statusConfig[subscription.status] : null;
  const trialDaysLeft = subscription?.trial_ends_at ? getDaysRemaining(subscription.trial_ends_at) : null;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your subscription and billing</p>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          {successMessage}
        </div>
      )}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Current Plan */}
      <div className="p-6 rounded-2xl bg-[#13151a] border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-4">Current Plan</h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              currentPlan?.color === 'purple' ? 'bg-purple-500/20' : 'bg-cyan-500/20'
            }`}>
              {currentPlan ? (
                <currentPlan.icon className={`w-6 h-6 ${
                  currentPlan.color === 'purple' ? 'text-purple-400' : 'text-cyan-400'
                }`} />
              ) : (
                <Sparkles className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xl font-semibold text-white">
                  {currentPlan?.name || (subscription?.tier ? subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1) : 'Free')}
                </span>
                {status && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${status.color}`}>
                    <status.icon className="w-3.5 h-3.5" />
                    {status.label}
                  </span>
                )}
              </div>
              {subscription?.status === 'trialing' && trialDaysLeft !== null && (
                <p className="text-sm text-gray-400 mt-1">
                  {trialDaysLeft > 0
                    ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left in trial`
                    : 'Trial ends today'}
                </p>
              )}
              {subscription?.subscription_ends_at && subscription.status !== 'trialing' && (
                <p className="text-sm text-gray-400 mt-1">
                  Renews {formatDate(subscription.subscription_ends_at)}
                </p>
              )}
            </div>
          </div>

          {subscription?.stripe_customer_id && (
            <button
              onClick={handleManageBilling}
              disabled={actionLoading === 'portal'}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1d24]/10 text-white hover:bg-[#1a1d24]/20 transition disabled:opacity-50"
            >
              {actionLoading === 'portal' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4" />
              )}
              Manage Billing
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Trial warning */}
        {subscription?.status === 'trialing' && trialDaysLeft !== null && trialDaysLeft <= 3 && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
            <strong>Trial ending soon!</strong> Add a payment method to continue using Made4Founders after your trial.
          </div>
        )}
      </div>

      {/* Upgrade/Change Plan */}
      <div className="p-6 rounded-2xl bg-[#13151a] border border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-white">
            {subscription?.tier === 'pro' ? 'Your Plan' : 'Upgrade Plan'}
          </h2>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-2 p-1 rounded-lg bg-[#1a1d24]/5 border border-white/10">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                billingCycle === 'monthly' ? 'bg-[#1a1d24]/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5 ${
                billingCycle === 'yearly' ? 'bg-[#1a1d24]/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Yearly
              <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-xs">-17%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const isCurrentPlan = subscription?.tier === plan.id;
            const price = billingCycle === 'monthly' ? plan.monthlyPrice : Math.round(plan.yearlyPrice / 12);
            const PlanIcon = plan.icon;

            return (
              <div
                key={plan.id}
                className={`p-5 rounded-xl border transition ${
                  isCurrentPlan
                    ? 'border-cyan-500/30 bg-cyan-500/5'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      plan.color === 'purple' ? 'bg-purple-500/20' : plan.color === 'amber' ? 'bg-amber-500/20' : 'bg-cyan-500/20'
                    }`}>
                      <PlanIcon className={`w-5 h-5 ${
                        plan.color === 'purple' ? 'text-purple-400' : plan.color === 'amber' ? 'text-amber-400' : 'text-cyan-400'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{plan.name}</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-white">${price}</span>
                        <span className="text-gray-400 text-sm">/mo</span>
                      </div>
                    </div>
                  </div>
                  {isCurrentPlan && (
                    <span className="px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-medium">
                      Current
                    </span>
                  )}
                </div>

                <ul className="space-y-2 mb-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <button
                    disabled
                    className="w-full py-2.5 rounded-lg bg-[#1a1d24]/5 text-gray-500 font-medium cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.priceKey)}
                    disabled={actionLoading !== null}
                    className={`w-full py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 ${
                      plan.color === 'purple'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:opacity-90'
                        : plan.color === 'amber'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:opacity-90'
                        : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90'
                    }`}
                  >
                    {actionLoading === plan.priceKey ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : subscription?.tier === 'pro' ? (
                      'Switch to Starter'
                    ) : (
                      `Upgrade to ${plan.name}`
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {billingCycle === 'yearly' && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Billed annually. Starter: $70/year, Pro: $290/year
          </p>
        )}
      </div>

      {/* Business Settings */}
      {currentBusiness && (
        <div className="p-6 rounded-2xl bg-[#13151a] border border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Business Settings</h2>
              <p className="text-sm text-gray-500">Preferences for {currentBusiness.name}</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Gamification Toggle */}
            <div className="flex items-center justify-between p-4 bg-[#0f1117] rounded-lg border border-white/5">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  currentBusiness.gamification_enabled
                    ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20'
                    : 'bg-[#1a1d24]/5'
                }`}>
                  {currentBusiness.gamification_enabled ? (
                    <Trophy className="w-5 h-5 text-amber-400" />
                  ) : (
                    <Gamepad2 className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                <div>
                  <div className="font-medium text-white">Gamification</div>
                  <div className="text-sm text-gray-400">
                    {currentBusiness.gamification_enabled
                      ? 'XP, levels, streaks, and quests are enabled'
                      : 'Gamification features are disabled'}
                  </div>
                </div>
              </div>
              <button
                onClick={toggleGamification}
                disabled={savingGamification}
                className={`relative w-14 h-8 rounded-full transition-colors ${
                  currentBusiness.gamification_enabled
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                    : 'bg-[#1a1d24]/10'
                } ${savingGamification ? 'opacity-50' : ''}`}
              >
                <div
                  className={`absolute top-1 w-6 h-6 bg-[#1a1d24] rounded-full shadow-lg transition-transform ${
                    currentBusiness.gamification_enabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Sound Effects with Volume Control */}
            <div className="p-4 bg-[#0f1117] rounded-lg border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={toggleSoundMute}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                      !soundMuted && soundVolume > 0
                        ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30'
                        : 'bg-[#1a1d24]/5 hover:bg-[#1a1d24]/10'
                    }`}
                  >
                    {!soundMuted && soundVolume > 0 ? (
                      <Volume2 className="w-5 h-5 text-cyan-400" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                  <div>
                    <div className="font-medium text-white">Sound Effects</div>
                    <div className="text-sm text-gray-400">
                      {soundMuted || soundVolume === 0
                        ? 'Muted'
                        : `Volume: ${soundVolume}%`}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Max 45%
                </div>
              </div>

              {/* Volume Slider */}
              <div className="flex items-center gap-3">
                <VolumeX className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <input
                  type="range"
                  min="0"
                  max="45"
                  value={soundMuted ? 0 : soundVolume}
                  onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                  onMouseUp={handleVolumeChangeEnd}
                  onTouchEnd={handleVolumeChangeEnd}
                  className="flex-1 h-2 bg-[#1a1d24]/10 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-4
                    [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-gradient-to-r
                    [&::-webkit-slider-thumb]:from-cyan-400
                    [&::-webkit-slider-thumb]:to-blue-400
                    [&::-webkit-slider-thumb]:shadow-lg
                    [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-moz-range-thumb]:w-4
                    [&::-moz-range-thumb]:h-4
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-gradient-to-r
                    [&::-moz-range-thumb]:from-cyan-400
                    [&::-moz-range-thumb]:to-blue-400
                    [&::-moz-range-thumb]:border-0
                    [&::-moz-range-thumb]:cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, rgb(34, 211, 238) 0%, rgb(59, 130, 246) ${((soundMuted ? 0 : soundVolume) / 45) * 100}%, rgba(255,255,255,0.1) ${((soundMuted ? 0 : soundVolume) / 45) * 100}%)`
                  }}
                />
                <Volume2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              </div>

              <p className="text-xs text-gray-500">
                Non-intrusive sounds for victories, achievements, level-ups, and task completions
              </p>
            </div>

            {/* Current Gamification Stats (when enabled) */}
            {currentBusiness.gamification_enabled && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-[#0f1117] rounded-lg border border-white/5 text-center">
                  <div className="text-2xl font-bold text-amber-400">{currentBusiness.level ?? 1}</div>
                  <div className="text-xs text-gray-500">Level</div>
                </div>
                <div className="p-3 bg-[#0f1117] rounded-lg border border-white/5 text-center">
                  <div className="text-2xl font-bold text-cyan-400">{(currentBusiness.xp ?? 0).toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Total XP</div>
                </div>
                <div className="p-3 bg-[#0f1117] rounded-lg border border-white/5 text-center">
                  <div className="text-2xl font-bold text-orange-400">{currentBusiness.current_streak ?? 0}</div>
                  <div className="text-xs text-gray-500">Day Streak</div>
                </div>
                <div className="p-3 bg-[#0f1117] rounded-lg border border-white/5 text-center">
                  <div className="text-2xl font-bold text-violet-400">{currentBusiness.longest_streak ?? 0}</div>
                  <div className="text-xs text-gray-500">Best Streak</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Account Settings */}
      <div className="p-6 rounded-2xl bg-[#13151a] border border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center">
            <User className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Account</h2>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Email display */}
          <div className="flex items-center justify-between p-4 bg-[#0f1117] rounded-lg border border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#1a1d24]/5 flex items-center justify-center">
                <Mail className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <div className="font-medium text-white">Email Address</div>
                <div className="text-sm text-gray-400">{user?.email}</div>
              </div>
            </div>
            <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded">Verified</span>
          </div>

          {/* Role */}
          <div className="flex items-center justify-between p-4 bg-[#0f1117] rounded-lg border border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#1a1d24]/5 flex items-center justify-center">
                <Shield className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <div className="font-medium text-white">Role</div>
                <div className="text-sm text-gray-400 capitalize">{user?.role || 'User'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="p-6 rounded-2xl bg-[#13151a] border border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/10 flex items-center justify-center">
            <Key className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Change Password</h2>
            <p className="text-sm text-gray-500">Update your account password</p>
          </div>
        </div>

        {showPasswordChange ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-4 py-2.5 rounded-lg bg-[#0f1117] border border-white/10 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 8 characters)"
                  className="w-full px-4 py-2.5 rounded-lg bg-[#0f1117] border border-white/10 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-4 py-2.5 rounded-lg bg-[#0f1117] border border-white/10 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleChangePassword}
                disabled={passwordChanging}
                className="flex-1 py-2.5 px-4 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-medium transition disabled:opacity-50"
              >
                {passwordChanging ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Changing...
                  </span>
                ) : (
                  'Update Password'
                )}
              </button>
              <button
                onClick={() => {
                  setShowPasswordChange(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="px-4 py-2.5 rounded-lg bg-[#0f1117] border border-white/10 text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowPasswordChange(true)}
            className="w-full py-3 px-4 rounded-lg bg-[#0f1117] border border-white/10 hover:border-amber-500/50 text-white font-medium transition flex items-center justify-center gap-2"
          >
            <Key className="w-5 h-5" />
            Change Password
          </button>
        )}
      </div>

      {/* Two-Factor Authentication */}
      <div className="p-6 rounded-2xl bg-[#13151a] border border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500/20 to-green-500/10 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Two-Factor Authentication</h2>
            <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
          </div>
        </div>

        {mfaLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : showMfaSetup ? (
          /* MFA Setup Flow */
          <div className="space-y-6">
            <div className="p-4 bg-[#0f1117] rounded-lg border border-white/5">
              <h3 className="font-medium text-white mb-4">Step 1: Scan QR Code</h3>
              <p className="text-sm text-gray-400 mb-4">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </p>
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-[#1a1d24] rounded-lg">
                  <img
                    src={`data:image/png;base64,${mfaQrCode}`}
                    alt="MFA QR Code"
                    className="w-48 h-48"
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-2">Can't scan? Enter this code manually:</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="px-3 py-1.5 bg-[#1a1d24]/5 rounded text-sm text-cyan-400 font-mono">
                    {mfaSecret}
                  </code>
                  <button
                    onClick={() => copyToClipboard(mfaSecret)}
                    className="p-1.5 hover:bg-[#1a1d24]/10 rounded transition"
                  >
                    <Copy className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#0f1117] rounded-lg border border-white/5">
              <h3 className="font-medium text-white mb-4">Step 2: Enter Verification Code</h3>
              <p className="text-sm text-gray-400 mb-4">
                Enter the 6-digit code from your authenticator app to verify setup.
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={mfaVerifyCode}
                  onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="flex-1 px-4 py-3 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-white text-center text-lg font-mono tracking-widest focus:outline-none focus:border-green-500/50"
                  maxLength={6}
                />
                <button
                  onClick={handleMfaVerify}
                  disabled={actionLoading === 'mfa-verify' || mfaVerifyCode.length !== 6}
                  className="px-6 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading === 'mfa-verify' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Verify
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setShowMfaSetup(false);
                setMfaVerifyCode('');
              }}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Cancel setup
            </button>
          </div>
        ) : showMfaDisable ? (
          /* MFA Disable Flow */
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
              <p className="text-sm text-red-400">
                Disabling two-factor authentication will make your account less secure. Are you sure?
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showMfaPassword ? 'text' : 'password'}
                    value={mfaDisablePassword}
                    onChange={(e) => setMfaDisablePassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 pr-12 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-red-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMfaPassword(!showMfaPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showMfaPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">MFA Code</label>
                <input
                  type="text"
                  value={mfaDisableCode}
                  onChange={(e) => setMfaDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  className="w-full px-4 py-3 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-white font-mono focus:outline-none focus:border-red-500/50"
                  maxLength={6}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowMfaDisable(false);
                  setMfaDisablePassword('');
                  setMfaDisableCode('');
                }}
                className="flex-1 px-4 py-3 bg-[#1a1d24]/10 text-white rounded-lg font-medium hover:bg-[#1a1d24]/20 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleMfaDisable}
                disabled={actionLoading === 'mfa-disable'}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading === 'mfa-disable' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                Disable MFA
              </button>
            </div>
          </div>
        ) : showBackupCodes ? (
          /* Backup Codes Display */
          <div className="space-y-4">
            <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <div className="flex items-start gap-3">
                <Key className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-400 font-medium">Save your backup codes</p>
                  <p className="text-sm text-gray-400 mt-1">
                    These codes can be used to access your account if you lose your authenticator device.
                    Each code can only be used once. Store them securely.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 p-4 bg-[#0f1117] rounded-lg border border-white/5">
              {mfaBackupCodes.map((code, i) => (
                <div key={i} className="px-3 py-2 bg-[#1a1d24]/5 rounded font-mono text-sm text-center text-white">
                  {code}
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => copyToClipboard(mfaBackupCodes.join('\n'))}
                className="flex-1 px-4 py-3 bg-[#1a1d24]/10 text-white rounded-lg font-medium hover:bg-[#1a1d24]/20 transition flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy All
              </button>
              <button
                onClick={() => setShowBackupCodes(false)}
                className="flex-1 px-4 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* MFA Status Display */
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-[#0f1117] rounded-lg border border-white/5">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  mfaEnabled ? 'bg-green-500/20' : 'bg-[#1a1d24]/5'
                }`}>
                  <Shield className={`w-5 h-5 ${mfaEnabled ? 'text-green-400' : 'text-gray-500'}`} />
                </div>
                <div>
                  <div className="font-medium text-white">Authenticator App</div>
                  <div className="text-sm text-gray-400">
                    {mfaEnabled ? 'Two-factor authentication is enabled' : 'Not configured'}
                  </div>
                </div>
              </div>
              {mfaEnabled ? (
                <span className="px-2.5 py-1 text-xs bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Enabled
                </span>
              ) : (
                <span className="px-2.5 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                  Not enabled
                </span>
              )}
            </div>

            {mfaEnabled ? (
              <div className="flex gap-3">
                <button
                  onClick={handleRegenerateBackupCodes}
                  disabled={actionLoading === 'mfa-backup'}
                  className="flex-1 px-4 py-3 bg-[#1a1d24]/10 text-white rounded-lg font-medium hover:bg-[#1a1d24]/20 transition flex items-center justify-center gap-2"
                >
                  {actionLoading === 'mfa-backup' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Key className="w-4 h-4" />
                  )}
                  Regenerate Backup Codes
                </button>
                <button
                  onClick={() => setShowMfaDisable(true)}
                  className="px-4 py-3 border border-red-500/30 text-red-400 rounded-lg font-medium hover:bg-red-500/10 transition"
                >
                  Disable
                </button>
              </div>
            ) : (
              <button
                onClick={handleMfaSetup}
                disabled={actionLoading === 'mfa-setup'}
                className="w-full px-4 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition flex items-center justify-center gap-2"
              >
                {actionLoading === 'mfa-setup' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Smartphone className="w-4 h-4" />
                )}
                Enable Two-Factor Authentication
              </button>
            )}
          </div>
        )}
      </div>

      {/* Notification Settings */}
      <div className="p-6 rounded-2xl bg-[#13151a] border border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-500/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
            <p className="text-sm text-gray-500">Manage email and push notifications</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Email notifications */}
          <div className="flex items-center justify-between p-4 bg-[#0f1117] rounded-lg border border-white/5">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                emailNotifications ? 'bg-violet-500/20' : 'bg-[#1a1d24]/5'
              }`}>
                {emailNotifications ? (
                  <Bell className="w-5 h-5 text-violet-400" />
                ) : (
                  <BellOff className="w-5 h-5 text-gray-500" />
                )}
              </div>
              <div>
                <div className="font-medium text-white">Email Notifications</div>
                <div className="text-sm text-gray-400">Receive email updates and alerts</div>
              </div>
            </div>
            <button
              onClick={() => setEmailNotifications(!emailNotifications)}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                emailNotifications ? 'bg-violet-500' : 'bg-[#1a1d24]/10'
              }`}
            >
              <div
                className={`absolute top-1 w-6 h-6 bg-[#1a1d24] rounded-full shadow-lg transition-transform ${
                  emailNotifications ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Deadline reminders */}
          <div className="flex items-center justify-between p-4 bg-[#0f1117] rounded-lg border border-white/5">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                deadlineReminders ? 'bg-orange-500/20' : 'bg-[#1a1d24]/5'
              }`}>
                <Clock className={`w-5 h-5 ${deadlineReminders ? 'text-orange-400' : 'text-gray-500'}`} />
              </div>
              <div>
                <div className="font-medium text-white">Deadline Reminders</div>
                <div className="text-sm text-gray-400">Get reminded before deadlines</div>
              </div>
            </div>
            <button
              onClick={() => setDeadlineReminders(!deadlineReminders)}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                deadlineReminders ? 'bg-orange-500' : 'bg-[#1a1d24]/10'
              }`}
            >
              <div
                className={`absolute top-1 w-6 h-6 bg-[#1a1d24] rounded-full shadow-lg transition-transform ${
                  deadlineReminders ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Weekly digest */}
          <div className="flex items-center justify-between p-4 bg-[#0f1117] rounded-lg border border-white/5">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                weeklyDigest ? 'bg-cyan-500/20' : 'bg-[#1a1d24]/5'
              }`}>
                <Mail className={`w-5 h-5 ${weeklyDigest ? 'text-cyan-400' : 'text-gray-500'}`} />
              </div>
              <div>
                <div className="font-medium text-white">Weekly Digest</div>
                <div className="text-sm text-gray-400">Summary of your week every Monday</div>
              </div>
            </div>
            <button
              onClick={() => setWeeklyDigest(!weeklyDigest)}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                weeklyDigest ? 'bg-cyan-500' : 'bg-[#1a1d24]/10'
              }`}
            >
              <div
                className={`absolute top-1 w-6 h-6 bg-[#1a1d24] rounded-full shadow-lg transition-transform ${
                  weeklyDigest ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Display Settings */}
      <div className="p-6 rounded-2xl bg-[#13151a] border border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500/20 to-pink-500/10 flex items-center justify-center">
            <Globe className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Display</h2>
            <p className="text-sm text-gray-500">Theme, timezone, and localization</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Timezone */}
          <div className="flex items-center justify-between p-4 bg-[#0f1117] rounded-lg border border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#1a1d24]/5 flex items-center justify-center">
                <Globe className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <div className="font-medium text-white">Timezone</div>
                <div className="text-sm text-gray-400">Used for deadlines and scheduling</div>
              </div>
            </div>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="px-3 py-2 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-pink-500/50"
            >
              {commonTimezones.map(tz => (
                <option key={tz} value={tz} className="bg-[#1a1d24] text-white">
                  {tz.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Theme */}
          <div className="p-4 bg-[#0f1117] rounded-lg border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  theme === 'dark' ? 'bg-violet-500/20' :
                  theme === 'light' ? 'bg-amber-500/20' : 'bg-blue-500/20'
                }`}>
                  {theme === 'dark' ? (
                    <Moon className="w-5 h-5 text-violet-400" />
                  ) : theme === 'light' ? (
                    <Sun className="w-5 h-5 text-amber-400" />
                  ) : (
                    <Monitor className="w-5 h-5 text-blue-400" />
                  )}
                </div>
                <div>
                  <div className="font-medium text-white">Theme</div>
                  <div className="text-sm text-gray-400">
                    {theme === 'dark' ? 'Dark mode' :
                     theme === 'light' ? 'Light mode' : 'Follows system preference'}
                  </div>
                </div>
              </div>
            </div>

            {/* Three-way toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setTheme('dark')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition ${
                  theme === 'dark'
                    ? 'bg-violet-500/20 border-violet-500/30 text-violet-400'
                    : 'border-white/10 text-gray-400 hover:bg-[#1a1d24]/50 hover:text-white'
                }`}
              >
                <Moon className="w-4 h-4" />
                Dark
              </button>
              <button
                onClick={() => setTheme('light')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition ${
                  theme === 'light'
                    ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                    : 'border-white/10 text-gray-400 hover:bg-[#1a1d24]/50 hover:text-white'
                }`}
              >
                <Sun className="w-4 h-4" />
                Light
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition ${
                  theme === 'system'
                    ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                    : 'border-white/10 text-gray-400 hover:bg-[#1a1d24]/50 hover:text-white'
                }`}
              >
                <Monitor className="w-4 h-4" />
                System
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Provider Settings */}
      <div className="p-6 rounded-2xl bg-[#13151a] border border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center">
            <Bot className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">AI Provider</h2>
            <p className="text-sm text-gray-500">Configure AI assistant providers</p>
          </div>
        </div>

        {aiLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : aiStatus ? (
          <div className="space-y-6">
            {/* Provider Status */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-400">Available Providers</h3>
              <div className="grid gap-3">
                {/* Ollama (Local) */}
                <div className="flex items-center justify-between p-4 bg-[#0f1117] rounded-lg border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      aiStatus.providers?.ollama?.available ? 'bg-green-500/20' : 'bg-[#1a1d24]/5'
                    }`}>
                      <Server className={`w-5 h-5 ${
                        aiStatus.providers?.ollama?.available ? 'text-green-400' : 'text-gray-500'
                      }`} />
                    </div>
                    <div>
                      <div className="font-medium text-white flex items-center gap-2">
                        Ollama (Local)
                        {aiStatus.preferred_provider === 'ollama' && (
                          <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">Preferred</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        {aiStatus.providers?.ollama?.model || 'qwen2.5:7b'} - Free, runs locally
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {aiStatus.providers?.ollama?.available ? (
                      <span className="px-2.5 py-1 text-xs bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Running
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                        Not available
                      </span>
                    )}
                    {aiStatus.preferred_provider !== 'ollama' && (
                      <button
                        onClick={() => handleSetAIProvider('ollama')}
                        disabled={aiSaving}
                        className="px-3 py-1.5 text-xs bg-[#1a1d24]/5 text-gray-300 rounded hover:bg-[#1a1d24]/10 transition"
                      >
                        Set Preferred
                      </button>
                    )}
                  </div>
                </div>

                {/* Cloudflare Workers AI */}
                <div className="flex items-center justify-between p-4 bg-[#0f1117] rounded-lg border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      aiStatus.providers?.cloudflare?.configured ? 'bg-orange-500/20' : 'bg-[#1a1d24]/5'
                    }`}>
                      <Cloud className={`w-5 h-5 ${
                        aiStatus.providers?.cloudflare?.configured ? 'text-orange-400' : 'text-gray-500'
                      }`} />
                    </div>
                    <div>
                      <div className="font-medium text-white flex items-center gap-2">
                        Cloudflare Workers AI
                        {aiStatus.preferred_provider === 'cloudflare' && (
                          <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">Preferred</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        {aiStatus.providers?.cloudflare?.model || 'llama-3.2-3b'} - Free (10k/day)
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {aiStatus.providers?.cloudflare?.configured ? (
                      <span className="px-2.5 py-1 text-xs bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Configured
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs bg-white/50/20 text-gray-400 rounded-full">
                        Not configured
                      </span>
                    )}
                    {aiStatus.providers?.cloudflare?.configured && aiStatus.preferred_provider !== 'cloudflare' && (
                      <button
                        onClick={() => handleSetAIProvider('cloudflare')}
                        disabled={aiSaving}
                        className="px-3 py-1.5 text-xs bg-[#1a1d24]/5 text-gray-300 rounded hover:bg-[#1a1d24]/10 transition"
                      >
                        Set Preferred
                      </button>
                    )}
                  </div>
                </div>

                {/* OpenAI */}
                <div className="flex items-center justify-between p-4 bg-[#0f1117] rounded-lg border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      aiStatus.providers?.openai?.configured ? 'bg-cyan-500/20' : 'bg-[#1a1d24]/5'
                    }`}>
                      <Cloud className={`w-5 h-5 ${
                        aiStatus.providers?.openai?.configured ? 'text-cyan-400' : 'text-gray-500'
                      }`} />
                    </div>
                    <div>
                      <div className="font-medium text-white flex items-center gap-2">
                        OpenAI
                        {aiStatus.preferred_provider === 'openai' && (
                          <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">Preferred</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        {aiStatus.providers?.openai?.model || 'gpt-4o-mini'} - Cloud API (paid)
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {aiStatus.providers?.openai?.configured ? (
                      <span className="px-2.5 py-1 text-xs bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Configured
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs bg-white/50/20 text-gray-400 rounded-full">
                        Not configured
                      </span>
                    )}
                    {aiStatus.providers?.openai?.configured && aiStatus.preferred_provider !== 'openai' && (
                      <button
                        onClick={() => handleSetAIProvider('openai')}
                        disabled={aiSaving}
                        className="px-3 py-1.5 text-xs bg-[#1a1d24]/5 text-gray-300 rounded hover:bg-[#1a1d24]/10 transition"
                      >
                        Set Preferred
                      </button>
                    )}
                  </div>
                </div>

                {/* Anthropic */}
                <div className="flex items-center justify-between p-4 bg-[#0f1117] rounded-lg border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      aiStatus.providers?.anthropic?.configured ? 'bg-orange-500/20' : 'bg-[#1a1d24]/5'
                    }`}>
                      <Cloud className={`w-5 h-5 ${
                        aiStatus.providers?.anthropic?.configured ? 'text-orange-400' : 'text-gray-500'
                      }`} />
                    </div>
                    <div>
                      <div className="font-medium text-white flex items-center gap-2">
                        Anthropic
                        {aiStatus.preferred_provider === 'anthropic' && (
                          <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">Preferred</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        {aiStatus.providers?.anthropic?.model || 'claude-3-5-haiku'} - Cloud API
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {aiStatus.providers?.anthropic?.configured ? (
                      <span className="px-2.5 py-1 text-xs bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Configured
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs bg-white/50/20 text-gray-400 rounded-full">
                        Not configured
                      </span>
                    )}
                    {aiStatus.providers?.anthropic?.configured && aiStatus.preferred_provider !== 'anthropic' && (
                      <button
                        onClick={() => handleSetAIProvider('anthropic')}
                        disabled={aiSaving}
                        className="px-3 py-1.5 text-xs bg-[#1a1d24]/5 text-gray-300 rounded hover:bg-[#1a1d24]/10 transition"
                      >
                        Set Preferred
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Fallback Status */}
            <div className="p-4 bg-[#0f1117] rounded-lg border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    aiStatus.fallback_enabled ? 'bg-blue-500/20' : 'bg-[#1a1d24]/5'
                  }`}>
                    <RefreshCw className={`w-5 h-5 ${
                      aiStatus.fallback_enabled ? 'text-blue-400' : 'text-gray-500'
                    }`} />
                  </div>
                  <div>
                    <div className="font-medium text-white">Automatic Fallback</div>
                    <div className="text-sm text-gray-400">
                      {aiStatus.fallback_enabled
                        ? 'Will try other providers if preferred is unavailable'
                        : 'Fallback disabled - only preferred provider used'}
                    </div>
                  </div>
                </div>
                <span className={`px-2.5 py-1 text-xs rounded-full ${
                  aiStatus.fallback_enabled
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-white/50/20 text-gray-400'
                }`}>
                  {aiStatus.fallback_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            {/* Usage Stats */}
            {aiUsage && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-400">Usage This Month</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 bg-[#0f1117] rounded-lg border border-white/5 text-center">
                    <div className="text-2xl font-bold text-white">{aiUsage.total.total_requests}</div>
                    <div className="text-xs text-gray-500">Requests</div>
                  </div>
                  <div className="p-4 bg-[#0f1117] rounded-lg border border-white/5 text-center">
                    <div className="text-2xl font-bold text-cyan-400">
                      {((aiUsage.total.total_tokens_input + aiUsage.total.total_tokens_output) / 1000).toFixed(1)}k
                    </div>
                    <div className="text-xs text-gray-500">Total Tokens</div>
                  </div>
                  <div className="p-4 bg-[#0f1117] rounded-lg border border-white/5 text-center">
                    <div className="text-2xl font-bold text-green-400">
                      {aiUsage.total.successful_requests}
                    </div>
                    <div className="text-xs text-gray-500">Successful</div>
                  </div>
                  <div className="p-4 bg-[#0f1117] rounded-lg border border-white/5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <DollarSign className="w-4 h-4 text-amber-400" />
                      <span className="text-2xl font-bold text-amber-400">
                        {aiUsage.total.total_estimated_cost.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">Est. Cost</div>
                  </div>
                </div>

                {/* By Provider Breakdown */}
                {Object.keys(aiUsage.by_provider).length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-medium text-gray-500 mb-2">By Provider</h4>
                    <div className="space-y-2">
                      {Object.entries(aiUsage.by_provider).map(([provider, usage]) => (
                        <div key={provider} className="flex items-center justify-between p-2 bg-[#0f1117] rounded border border-white/5">
                          <span className="text-sm text-gray-300 capitalize">{provider}</span>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>{usage.total_requests} requests</span>
                            <span>{((usage.total_tokens_input + usage.total_tokens_output) / 1000).toFixed(1)}k tokens</span>
                            <span className="text-amber-400">${usage.total_estimated_cost.toFixed(3)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Failed to load AI provider status
          </div>
        )}
      </div>

      {/* Data Management */}
      <div className="p-6 rounded-2xl bg-[#13151a] border border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500/20 to-red-500/10 flex items-center justify-center">
            <Download className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Data Management</h2>
            <p className="text-sm text-gray-500">Export or delete your data</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Export data */}
          <div className="flex items-center justify-between p-4 bg-[#0f1117] rounded-lg border border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Download className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="font-medium text-white">Export Data</div>
                <div className="text-sm text-gray-400">Download all your data as JSON/CSV</div>
              </div>
            </div>
            <button
              onClick={handleExportData}
              disabled={actionLoading === 'export'}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition disabled:opacity-50"
            >
              {actionLoading === 'export' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export
            </button>
          </div>

          {/* Delete account warning */}
          <div className="flex items-center justify-between p-4 bg-red-500/5 rounded-lg border border-red-500/20">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <div className="font-medium text-red-400">Delete Account</div>
                <div className="text-sm text-gray-400">Permanently delete your account and all data</div>
              </div>
            </div>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                  alert('Please contact support@made4founders.com to delete your account.');
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Audit Logs (Admin Only) */}
      {user?.role === 'admin' && (
        <div className="p-6 rounded-2xl bg-[#13151a] border border-white/10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500/20 to-red-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Security Audit Logs</h2>
                <p className="text-sm text-gray-500">Monitor security events and login activity</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadAuditData}
                disabled={auditLoading}
                className="p-2 rounded-lg bg-[#1a1d24]/5 text-gray-400 hover:bg-[#1a1d24]/10 hover:text-white transition"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${auditLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleExportAuditLogs}
                disabled={actionLoading === 'export-audit'}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>

          {auditError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {auditError}
            </div>
          )}

          {/* Stats Cards */}
          {auditStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-[#0f1117] border border-white/5">
                <div className="text-2xl font-bold text-white">{auditStats.events_today}</div>
                <div className="text-sm text-gray-500">Events Today</div>
              </div>
              <div className="p-4 rounded-lg bg-[#0f1117] border border-white/5">
                <div className="text-2xl font-bold text-white">{auditStats.events_this_week}</div>
                <div className="text-sm text-gray-500">This Week</div>
              </div>
              <div className="p-4 rounded-lg bg-[#0f1117] border border-white/5">
                <div className={`text-2xl font-bold ${auditStats.failed_logins_today > 0 ? 'text-red-400' : 'text-white'}`}>
                  {auditStats.failed_logins_today}
                </div>
                <div className="text-sm text-gray-500">Failed Logins Today</div>
              </div>
              <div className="p-4 rounded-lg bg-[#0f1117] border border-white/5">
                <div className="text-2xl font-bold text-white">{auditStats.unique_ips_today}</div>
                <div className="text-sm text-gray-500">Unique IPs Today</div>
              </div>
            </div>
          )}

          {/* Recent Logs */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Activity</h3>
            {auditLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No audit logs found</div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2">
                {auditLogs.slice(0, 20).map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-lg border ${
                      log.success
                        ? 'bg-[#0f1117] border-white/5'
                        : 'bg-red-500/5 border-red-500/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${log.success ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className="font-medium text-white">{log.event_type}</span>
                        <span className="text-gray-500 text-sm">{log.action}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        {log.user_email && <span>{log.user_email}</span>}
                        {log.ip_address && <span className="font-mono">{log.ip_address}</span>}
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Help */}
      <div className="p-6 rounded-2xl bg-[#13151a] border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-2">Need Help?</h2>
        <p className="text-gray-400 text-sm mb-4">
          Questions about billing or your subscription? We're here to help.
        </p>
        <a
          href="mailto:support@made4founders.com"
          className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm"
        >
          Contact Support
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
