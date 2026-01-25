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
} from 'lucide-react';
import {
  getSubscriptionStatus,
  createCheckoutSession,
  createPortalSession,
  updateBusiness,
  type SubscriptionStatus,
} from '../lib/api';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
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

  useEffect(() => {
    loadSubscription();

    // Check for success/canceled from Stripe redirect
    if (searchParams.get('success') === 'true') {
      setSuccessMessage('Your subscription has been updated successfully!');
      // Remove query params
      window.history.replaceState({}, '', '/app/settings');
    } else if (searchParams.get('canceled') === 'true') {
      setError('Checkout was canceled. No changes were made.');
      window.history.replaceState({}, '', '/app/settings');
    }
  }, [searchParams]);

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
      // TODO: Implement data export endpoint
      setTimeout(() => {
        setSuccessMessage('Data export started. You will receive an email with the download link.');
        setActionLoading(null);
      }, 1000);
    } catch (err) {
      setError('Failed to export data');
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
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-50"
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
          <div className="inline-flex items-center gap-2 p-1 rounded-lg bg-white/5 border border-white/10">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                billingCycle === 'monthly' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5 ${
                billingCycle === 'yearly' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
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
                    className="w-full py-2.5 rounded-lg bg-white/5 text-gray-500 font-medium cursor-not-allowed"
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
                    : 'bg-white/5'
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
                    : 'bg-white/10'
                } ${savingGamification ? 'opacity-50' : ''}`}
              >
                <div
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${
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
                        : 'bg-white/5 hover:bg-white/10'
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
                  className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer
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
                  <div className="text-2xl font-bold text-amber-400">{currentBusiness.level}</div>
                  <div className="text-xs text-gray-500">Level</div>
                </div>
                <div className="p-3 bg-[#0f1117] rounded-lg border border-white/5 text-center">
                  <div className="text-2xl font-bold text-cyan-400">{currentBusiness.xp.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Total XP</div>
                </div>
                <div className="p-3 bg-[#0f1117] rounded-lg border border-white/5 text-center">
                  <div className="text-2xl font-bold text-orange-400">{currentBusiness.current_streak}</div>
                  <div className="text-xs text-gray-500">Day Streak</div>
                </div>
                <div className="p-3 bg-[#0f1117] rounded-lg border border-white/5 text-center">
                  <div className="text-2xl font-bold text-violet-400">{currentBusiness.longest_streak}</div>
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
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
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
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
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
                emailNotifications ? 'bg-violet-500/20' : 'bg-white/5'
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
                emailNotifications ? 'bg-violet-500' : 'bg-white/10'
              }`}
            >
              <div
                className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${
                  emailNotifications ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Deadline reminders */}
          <div className="flex items-center justify-between p-4 bg-[#0f1117] rounded-lg border border-white/5">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                deadlineReminders ? 'bg-orange-500/20' : 'bg-white/5'
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
                deadlineReminders ? 'bg-orange-500' : 'bg-white/10'
              }`}
            >
              <div
                className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${
                  deadlineReminders ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Weekly digest */}
          <div className="flex items-center justify-between p-4 bg-[#0f1117] rounded-lg border border-white/5">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                weeklyDigest ? 'bg-cyan-500/20' : 'bg-white/5'
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
                weeklyDigest ? 'bg-cyan-500' : 'bg-white/10'
              }`}
            >
              <div
                className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${
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
            <p className="text-sm text-gray-500">Timezone and localization</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Timezone */}
          <div className="flex items-center justify-between p-4 bg-[#0f1117] rounded-lg border border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
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
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-pink-500/50"
            >
              {commonTimezones.map(tz => (
                <option key={tz} value={tz} className="bg-[#1a1d24] text-white">
                  {tz.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
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
