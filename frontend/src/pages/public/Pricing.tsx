import { useNavigate } from 'react-router-dom';
import { Check, X, Sparkles, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { createCheckoutSession } from '../../lib/api';
import SEO, { pageSEO } from '../../components/SEO';

type PriceKey = 'starter_monthly' | 'starter_yearly' | 'growth_monthly' | 'growth_yearly' | 'scale_monthly' | 'scale_yearly';

const plans = [
  {
    name: 'Starter',
    slug: 'starter',
    description: 'For solo founders getting organized',
    monthlyPrice: 7,
    yearlyPrice: 70,
    monthlyPriceKey: 'starter_monthly' as PriceKey,
    yearlyPriceKey: 'starter_yearly' as PriceKey,
    features: [
      { name: '1 user', included: true },
      { name: 'Business checklist (98 items)', included: true },
      { name: 'Document storage (5GB)', included: true },
      { name: 'Full dashboard', included: true },
      { name: 'Credential vault', included: true },
      { name: 'Contacts & deadlines', included: true },
      { name: 'Basic analytics', included: false },
      { name: 'Email integrations', included: false },
      { name: 'Marketing tools', included: false },
      { name: 'Priority support', included: false },
    ],
    cta: 'Start 14-Day Free Trial',
    popular: false,
  },
  {
    name: 'Growth',
    slug: 'growth',
    description: 'For growing startups with more needs',
    monthlyPrice: 29,
    yearlyPrice: 290,
    monthlyPriceKey: 'growth_monthly' as PriceKey,
    yearlyPriceKey: 'growth_yearly' as PriceKey,
    features: [
      { name: '3 users', included: true },
      { name: 'Business checklist (98 items)', included: true },
      { name: 'Document storage (25GB)', included: true },
      { name: 'Full dashboard', included: true },
      { name: 'Credential vault', included: true },
      { name: 'Contacts & deadlines', included: true },
      { name: 'Advanced analytics', included: true },
      { name: 'Email integration (1)', included: true },
      { name: 'Marketing tools', included: false },
      { name: 'Priority support', included: false },
    ],
    cta: 'Start 14-Day Free Trial',
    popular: true,
  },
  {
    name: 'Scale',
    slug: 'scale',
    description: 'For teams ready to scale',
    monthlyPrice: 79,
    yearlyPrice: 790,
    monthlyPriceKey: 'scale_monthly' as PriceKey,
    yearlyPriceKey: 'scale_yearly' as PriceKey,
    features: [
      { name: '10 users', included: true },
      { name: 'Business checklist (98 items)', included: true },
      { name: 'Document storage (100GB)', included: true },
      { name: 'Full dashboard', included: true },
      { name: 'Credential vault', included: true },
      { name: 'Contacts & deadlines', included: true },
      { name: 'Advanced analytics', included: true },
      { name: 'Unlimited email integrations', included: true },
      { name: 'Marketing tools', included: true },
      { name: 'Priority support', included: true },
    ],
    cta: 'Start 14-Day Free Trial',
    popular: false,
  },
];

const faqs = [
  {
    question: 'How does the free trial work?',
    answer: "Every plan includes a 14-day free trial. Enter your card to start — you won't be charged until day 15. Cancel anytime during the trial at no cost.",
  },
  {
    question: 'What happens after my trial ends?',
    answer: "After 14 days, you'll be automatically charged for your selected plan. We'll send a reminder email before your trial ends so there are no surprises.",
  },
  {
    question: 'Can I change plans later?',
    answer: "Yes! You can upgrade or downgrade at any time. When upgrading, you'll get immediate access to new features. When downgrading, changes take effect at your next billing cycle.",
  },
  {
    question: 'Is my data secure?',
    answer: 'Absolutely. We use AES-256-GCM encryption for sensitive data, the same standard used by banks. Your credentials are encrypted with a key only you control.',
  },
  {
    question: 'Do you offer refunds?',
    answer: "Yes, we offer a 30-day money-back guarantee. If you're not satisfied, contact support for a full refund.",
  },
  {
    question: 'Can I cancel anytime?',
    answer: "Yes, you can cancel your subscription at any time from your account settings. You'll continue to have access until the end of your billing period.",
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePlanSelect = async (plan: typeof plans[0]) => {
    setError(null);

    const priceKey = billingCycle === 'monthly' ? plan.monthlyPriceKey : plan.yearlyPriceKey;
    if (!priceKey) {
      navigate(`/signup?plan=${plan.slug}`);
      return;
    }

    // Try to create checkout session (user must be logged in)
    setLoadingPlan(plan.slug);
    try {
      const session = await createCheckoutSession(priceKey);
      window.location.href = session.checkout_url;
    } catch (err: unknown) {
      // If not logged in (401), redirect to signup with plan
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 401) {
        navigate(`/signup?plan=${plan.slug}&billing=${billingCycle}`);
      } else {
        setError('Failed to start checkout. Please try again.');
      }
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="py-20 px-4 sm:px-6 lg:px-8">
      <SEO {...pageSEO.pricing} />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-2">
            14-day free trial on all plans. No charge until day 15.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Credit card required to start trial. Cancel anytime.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-4 p-1 rounded-xl bg-white/5 border border-white/10">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                billingCycle === 'yearly'
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Yearly
              <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
                Save 17%
              </span>
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm inline-block">
              {error}
            </div>
          )}
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-16 sm:mb-24">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative p-8 rounded-2xl border transition-all ${
                plan.popular
                  ? 'bg-gradient-to-b from-cyan-500/10 to-blue-600/10 border-cyan-500/30'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-medium">
                    <Sparkles className="w-3 h-3" />
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">{plan.name}</h3>
                <p className="text-sm text-gray-400">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">
                    ${billingCycle === 'monthly' ? plan.monthlyPrice : Math.round(plan.yearlyPrice / 12)}
                  </span>
                  <span className="text-gray-400">/month</span>
                </div>
                {billingCycle === 'yearly' && plan.yearlyPrice > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    ${plan.yearlyPrice} billed yearly
                  </p>
                )}
              </div>

              <button
                onClick={() => handlePlanSelect(plan)}
                disabled={loadingPlan !== null}
                className={`w-full py-3 px-4 rounded-lg text-center font-medium transition-all mb-8 flex items-center justify-center gap-2 disabled:opacity-50 ${
                  plan.popular
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/25'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {loadingPlan === plan.slug ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  plan.cta
                )}
              </button>

              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature.name} className="flex items-center gap-3">
                    {feature.included ? (
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <X className="w-5 h-5 text-gray-600 flex-shrink-0" />
                    )}
                    <span className={feature.included ? 'text-gray-300' : 'text-gray-500'}>
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Enterprise */}
        <div className="mb-24 p-8 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">Enterprise</h3>
              <p className="text-gray-400 max-w-xl">
                Need unlimited users, dedicated support, SLA guarantees, or custom features?
                Let's talk about a plan that fits your organization.
              </p>
            </div>
            <a
              href="mailto:enterprise@made4founders.com"
              className="flex-shrink-0 px-6 py-3 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition-all"
            >
              Contact Sales
            </a>
          </div>
        </div>

        {/* FAQs */}
        <div>
          <h2 className="text-2xl font-bold text-white text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <h3 className="text-lg font-semibold text-white mb-2">{faq.question}</h3>
                <p className="text-gray-400">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
