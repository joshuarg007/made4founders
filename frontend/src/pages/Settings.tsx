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
} from 'lucide-react';
import {
  getSubscriptionStatus,
  createCheckoutSession,
  createPortalSession,
  type SubscriptionStatus,
} from '../lib/api';

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
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

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
                  {currentPlan?.name || subscription?.tier?.charAt(0).toUpperCase() + subscription?.tier?.slice(1) || 'Free'}
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
