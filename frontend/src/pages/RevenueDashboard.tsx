import { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  RefreshCw,
  Loader2,
  Link2,
  Unlink,
  AlertTriangle,
  CheckCircle,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
} from 'lucide-react';
import {
  getStripeConnection,
  getStripeConnectUrl,
  disconnectStripe,
  syncStripeData,
  getRevenueDashboard,
  type StripeConnection,
  type RevenueDashboard as RevenueDashboardType,
} from '../lib/api';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export default function RevenueDashboard() {
  const [connection, setConnection] = useState<StripeConnection | null>(null);
  const [dashboard, setDashboard] = useState<RevenueDashboardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const conn = await getStripeConnection();
      setConnection(conn);

      if (conn?.is_active) {
        const dashboardData = await getRevenueDashboard();
        setDashboard(dashboardData);
      }
    } catch (err) {
      console.error('Failed to load revenue data:', err);
      setError('Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const { url } = await getStripeConnectUrl();
      window.location.href = url;
    } catch (err) {
      console.error('Failed to get connect URL:', err);
      setError('Failed to connect Stripe');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Stripe? Revenue data will no longer be synced.')) {
      return;
    }

    try {
      await disconnectStripe();
      setConnection(null);
      setDashboard(null);
    } catch (err) {
      console.error('Disconnect failed:', err);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncStripeData();
      // Wait a bit for sync to complete
      setTimeout(() => {
        loadData();
        setSyncing(false);
      }, 3000);
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const metrics = dashboard?.metrics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue Dashboard</h1>
          <p className="text-gray-600">MRR, ARR, and subscription metrics from Stripe</p>
        </div>
        <div className="flex items-center gap-3">
          {connection?.is_active && (
            <>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync'}
              </button>
              <button
                onClick={handleDisconnect}
                className="inline-flex items-center gap-2 px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
              >
                <Unlink className="w-4 h-4" />
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {!connection?.is_active ? (
        /* Empty State */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <CreditCard className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Connect Your Stripe Account
          </h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Connect your Stripe account to automatically track MRR, ARR, churn rate,
            and other subscription metrics.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#635bff] hover:bg-[#5850e6] text-white font-medium rounded-lg transition-colors"
          >
            {connecting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Link2 className="w-5 h-5" />
            )}
            Connect with Stripe
          </button>
          <p className="mt-4 text-sm text-gray-500">
            Read-only access. We never touch your payouts or customers.
          </p>
        </div>
      ) : (
        <>
          {/* Connection Status */}
          <div className="bg-gradient-to-r from-[#635bff] to-[#7c3aed] rounded-xl p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <div className="font-medium">{connection.account_name || 'Stripe Account'}</div>
                <div className="text-sm text-white/80 flex items-center gap-2">
                  {connection.sync_status === 'synced' ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Last synced: {connection.last_sync_at
                        ? new Date(connection.last_sync_at).toLocaleString()
                        : 'Never'}
                    </>
                  ) : connection.sync_status === 'syncing' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4" />
                      {connection.sync_status}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* MRR */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500">MRR</span>
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(metrics.mrr)}
                </div>
                <div className={`text-sm mt-1 flex items-center gap-1 ${
                  metrics.growth_rate_mom >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {metrics.growth_rate_mom >= 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  {formatPercent(metrics.growth_rate_mom)} MoM
                </div>
              </div>

              {/* ARR */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500">ARR</span>
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(metrics.arr)}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Annual run rate
                </div>
              </div>

              {/* Active Subscriptions */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500">Subscriptions</span>
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {metrics.active_subscriptions}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {metrics.total_customers} total customers
                </div>
              </div>

              {/* Churn Rate */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500">Churn Rate</span>
                  <TrendingDown className={`w-5 h-5 ${metrics.churn_rate > 5 ? 'text-red-500' : 'text-gray-400'}`} />
                </div>
                <div className={`text-2xl font-bold ${metrics.churn_rate > 5 ? 'text-red-600' : 'text-gray-900'}`}>
                  {metrics.churn_rate.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {metrics.churned_subscriptions_30d} churned (30d)
                </div>
              </div>
            </div>
          )}

          {/* Charts and Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Chart */}
            <div className="lg:col-span-2">
              {/* MRR Chart */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-900 mb-4">MRR Trend</h2>
                {dashboard?.chart_data && (
                  <div className="h-64 flex items-end gap-2">
                    {dashboard.chart_data.mrr.map((value, i) => {
                      const maxValue = Math.max(...dashboard.chart_data.mrr, 1);
                      const height = (value / maxValue) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full bg-blue-500 rounded-t transition-all"
                            style={{ height: `${height}%`, minHeight: value > 0 ? '4px' : '0' }}
                          />
                          <span className="text-xs text-gray-500 truncate w-full text-center">
                            {dashboard.chart_data.labels[i]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Plan Breakdown */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mt-6">
                <h2 className="font-semibold text-gray-900 mb-4">Plan Breakdown</h2>
                <div className="space-y-3">
                  {dashboard?.subscription_breakdown.map((plan) => (
                    <div key={plan.plan_name} className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">{plan.plan_name}</span>
                          <span className="text-sm text-gray-500">
                            {plan.count} subs ({plan.percentage.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${plan.percentage}%` }}
                          />
                        </div>
                      </div>
                      <span className="font-medium text-gray-900 w-24 text-right">
                        {formatCurrency(plan.mrr)}/mo
                      </span>
                    </div>
                  ))}
                  {(!dashboard?.subscription_breakdown || dashboard.subscription_breakdown.length === 0) && (
                    <p className="text-sm text-gray-500">No subscription data available</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Additional Metrics */}
              {metrics && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <h2 className="font-semibold text-gray-900 mb-4">Key Metrics</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">ARPC</span>
                      <span className="font-medium">{formatCurrency(metrics.average_revenue_per_customer)}/mo</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">New Customers (30d)</span>
                      <span className="font-medium text-green-600">+{metrics.new_customers_30d}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Churned (30d)</span>
                      <span className="font-medium text-red-600">-{metrics.churned_subscriptions_30d}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Net Growth (30d)</span>
                      <span className={`font-medium ${metrics.new_customers_30d - metrics.churned_subscriptions_30d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {metrics.new_customers_30d - metrics.churned_subscriptions_30d >= 0 ? '+' : ''}
                        {metrics.new_customers_30d - metrics.churned_subscriptions_30d}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Top Customers */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-900 mb-4">Top Customers</h2>
                <div className="space-y-3">
                  {dashboard?.top_customers.map((customer, i) => (
                    <div key={customer.customer_id} className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {customer.name || customer.email || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {customer.subscription_count} subscription{customer.subscription_count !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(customer.total_revenue)}
                      </span>
                    </div>
                  ))}
                  {(!dashboard?.top_customers || dashboard.top_customers.length === 0) && (
                    <p className="text-sm text-gray-500">No customer data available</p>
                  )}
                </div>
              </div>

              {/* Quick Stats Card */}
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-sm p-5 text-white">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5" />
                  <h2 className="font-semibold">Revenue Summary</h2>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-purple-100">Monthly Revenue</span>
                    <span className="font-medium">{formatCurrency(metrics?.mrr || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-100">Annual Projection</span>
                    <span className="font-medium">{formatCurrency(metrics?.arr || 0)}</span>
                  </div>
                  <div className="border-t border-purple-400 pt-3 flex justify-between">
                    <span className="text-purple-100">Growth Rate</span>
                    <span className="font-bold text-lg">
                      {formatPercent(metrics?.growth_rate_mom || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
