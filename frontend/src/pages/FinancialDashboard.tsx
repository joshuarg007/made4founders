import { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  Clock,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Unlink,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import PlaidLinkButton from '../components/PlaidLink';
import {
  getPlaidItems,
  getCashPosition,
  getRunwayData,
  getPlaidTransactions,
  getTransactionSummary,
  syncPlaidItem,
  disconnectPlaidItem,
  type PlaidItem,
  type PlaidTransaction,
  type CashPosition,
  type RunwayData,
  type TransactionSummary,
} from '../lib/api';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatRunway(months: number): string {
  if (months >= 999) return 'Profitable';
  if (months >= 24) return `${Math.floor(months / 12)}+ years`;
  if (months >= 12) return `${Math.floor(months / 12)} year${months >= 24 ? 's' : ''} ${Math.round(months % 12)} mo`;
  return `${Math.round(months)} months`;
}

function getRunwayColor(months: number): string {
  if (months >= 999) return 'text-green-400';
  if (months >= 18) return 'text-green-400';
  if (months >= 12) return 'text-yellow-400';
  if (months >= 6) return 'text-orange-400';
  return 'text-red-400';
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="w-5 h-5 text-green-400" />;
    case 'declining':
      return <TrendingDown className="w-5 h-5 text-red-400" />;
    default:
      return <span className="w-5 h-5 text-gray-500">—</span>;
  }
}

export default function FinancialDashboard() {
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [cashPosition, setCashPosition] = useState<CashPosition | null>(null);
  const [runway, setRunway] = useState<RunwayData | null>(null);
  const [transactions, setTransactions] = useState<PlaidTransaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [itemsData, cashData, runwayData, txnData, summaryData] = await Promise.all([
        getPlaidItems(),
        getCashPosition(),
        getRunwayData(3),
        getPlaidTransactions({ days: 30, limit: 20 }),
        getTransactionSummary(30),
      ]);

      setItems(itemsData);
      setCashPosition(cashData);
      setRunway(runwayData);
      setTransactions(txnData);
      setSummary(summaryData);
    } catch (err) {
      console.error('Failed to load financial data:', err);
      setError('Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSync = async (itemId: number) => {
    setSyncing(itemId);
    try {
      await syncPlaidItem(itemId);
      // Wait a bit for sync to complete
      setTimeout(() => {
        loadData();
        setSyncing(null);
      }, 2000);
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncing(null);
    }
  };

  const handleDisconnect = async (itemId: number) => {
    if (!confirm('Are you sure you want to disconnect this bank? All transaction history will be removed.')) {
      return;
    }

    try {
      await disconnectPlaidItem(itemId);
      loadData();
    } catch (err) {
      console.error('Disconnect failed:', err);
    }
  };

  const hasLinkedAccounts = items.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cash & Runway</h1>
          <p className="text-gray-400">Real-time visibility into your cash position and runway</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-[#1a1d24]/5 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <PlaidLinkButton onSuccess={loadData}>
            <Building2 className="w-5 h-5" />
            <span>Link Bank</span>
          </PlaidLinkButton>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {!hasLinkedAccounts ? (
        /* Empty State */
        <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-12 text-center">
          <Building2 className="w-16 h-16 mx-auto text-gray-500 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            Connect Your Bank Accounts
          </h2>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Link your bank accounts to see real-time cash position, calculate runway,
            and automatically track expenses.
          </p>
          <PlaidLinkButton onSuccess={loadData} className="mx-auto" />
          <p className="mt-4 text-sm text-gray-500">
            Secured by Plaid. Bank-level encryption.
          </p>
        </div>
      ) : (
        <>
          {/* Key Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Cash Position */}
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-400">Total Cash</span>
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(cashPosition?.total_cash || 0)}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Across {cashPosition?.accounts.length || 0} accounts
              </div>
            </div>

            {/* Runway */}
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-400">Runway</span>
                <Clock className="w-5 h-5 text-cyan-400" />
              </div>
              <div className={`text-2xl font-bold ${getRunwayColor(runway?.runway_months || 0)}`}>
                {formatRunway(runway?.runway_months || 0)}
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                {getTrendIcon(runway?.trend || 'stable')}
                <span>
                  {runway?.trend === 'improving' ? 'Burn decreasing' :
                   runway?.trend === 'declining' ? 'Burn increasing' : 'Stable burn'}
                </span>
              </div>
            </div>

            {/* Monthly Burn */}
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-400">Monthly Burn</span>
                <TrendingDown className="w-5 h-5 text-orange-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(runway?.monthly_burn_rate || 0)}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                3-month average
              </div>
            </div>

            {/* 30-Day Net */}
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-400">30-Day Net</span>
                {(summary?.net || 0) >= 0 ? (
                  <ArrowUpRight className="w-5 h-5 text-green-400" />
                ) : (
                  <ArrowDownRight className="w-5 h-5 text-red-400" />
                )}
              </div>
              <div className={`text-2xl font-bold ${(summary?.net || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(summary?.net || 0) >= 0 ? '+' : ''}{formatCurrency(summary?.net || 0)}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Income - Expenses
              </div>
            </div>
          </div>

          {/* Runway Alert */}
          {runway && runway.runway_months < 6 && runway.runway_months < 999 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-400">Low Runway Warning</h3>
                <p className="text-red-300">
                  Your current runway is less than 6 months. Consider reducing burn rate or raising additional capital.
                </p>
              </div>
            </div>
          )}

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Accounts & Transactions */}
            <div className="lg:col-span-2 space-y-6">
              {/* Linked Accounts */}
              <div className="bg-[#1a1d24] rounded-xl border border-white/10">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <h2 className="font-semibold text-white">Linked Accounts</h2>
                  <PlaidLinkButton onSuccess={loadData} className="text-sm py-1.5 px-3">
                    <Building2 className="w-4 h-4" />
                    <span>Add</span>
                  </PlaidLinkButton>
                </div>
                <div className="divide-y divide-white/5">
                  {items.map((item) => (
                    <div key={item.id} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-cyan-400" />
                          </div>
                          <div>
                            <h3 className="font-medium text-white">
                              {item.institution_name || 'Bank Account'}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              {item.sync_status === 'synced' ? (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                              ) : item.sync_status === 'error' ? (
                                <AlertTriangle className="w-4 h-4 text-red-400" />
                              ) : (
                                <Clock className="w-4 h-4 text-yellow-400" />
                              )}
                              <span>
                                {item.last_sync_at
                                  ? `Synced ${new Date(item.last_sync_at).toLocaleDateString()}`
                                  : 'Pending sync'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSync(item.id)}
                            disabled={syncing === item.id}
                            className="p-2 text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
                            title="Sync now"
                          >
                            <RefreshCw className={`w-4 h-4 ${syncing === item.id ? 'animate-spin' : ''}`} />
                          </button>
                          <button
                            onClick={() => handleDisconnect(item.id)}
                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Disconnect"
                          >
                            <Unlink className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Account list */}
                      <div className="space-y-2 ml-13">
                        {item.accounts.map((account) => (
                          <div
                            key={account.id}
                            className="flex items-center justify-between py-2 px-3 bg-[#1a1d24]/5 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-300">
                                {account.name || account.official_name}
                              </span>
                              <span className="text-xs text-gray-500">
                                ••••{account.mask}
                              </span>
                              <span className="text-xs px-2 py-0.5 bg-[#1a1d24]/10 rounded text-gray-400 capitalize">
                                {account.account_subtype || account.account_type}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-white">
                                {formatCurrency(account.balance_current || 0)}
                              </div>
                              {account.balance_available !== null && account.balance_available !== account.balance_current && (
                                <div className="text-xs text-gray-500">
                                  {formatCurrency(account.balance_available)} available
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="bg-[#1a1d24] rounded-xl border border-white/10">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <h2 className="font-semibold text-white">Recent Transactions</h2>
                  <span className="text-sm text-gray-500">Last 30 days</span>
                </div>
                <div className="divide-y divide-white/5">
                  {transactions.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No transactions yet. Sync your accounts to see transactions.
                    </div>
                  ) : (
                    transactions.slice(0, 10).map((txn) => (
                      <div key={txn.id} className="px-5 py-3 flex items-center justify-between hover:bg-[#1a1d24]/5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            txn.amount < 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                          }`}>
                            {txn.amount < 0 ? (
                              <ArrowDownRight className="w-4 h-4 text-green-400" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-white">
                              {txn.merchant_name || txn.name}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center gap-2">
                              <span>{txn.category}</span>
                              {txn.pending && (
                                <span className="text-xs px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 rounded">
                                  Pending
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-medium ${txn.amount < 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {txn.amount < 0 ? '+' : '-'}{formatCurrency(Math.abs(txn.amount))}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(txn.date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {transactions.length > 10 && (
                  <div className="px-5 py-3 border-t border-white/10">
                    <button className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                      View all transactions
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Summary */}
            <div className="space-y-6">
              {/* Income vs Expenses */}
              <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-5">
                <h2 className="font-semibold text-white mb-4">30-Day Summary</h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-400">Income</span>
                      <span className="font-medium text-green-400">
                        +{formatCurrency(summary?.total_income || 0)}
                      </span>
                    </div>
                    <div className="h-2 bg-[#1a1d24]/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{
                          width: `${Math.min(100, ((summary?.total_income || 0) / ((summary?.total_income || 0) + (summary?.total_expenses || 1))) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-400">Expenses</span>
                      <span className="font-medium text-red-400">
                        -{formatCurrency(summary?.total_expenses || 0)}
                      </span>
                    </div>
                    <div className="h-2 bg-[#1a1d24]/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{
                          width: `${Math.min(100, ((summary?.total_expenses || 0) / ((summary?.total_income || 0) + (summary?.total_expenses || 1))) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Expense Categories */}
              <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-5">
                <h2 className="font-semibold text-white mb-4">Top Expense Categories</h2>
                <div className="space-y-3">
                  {Object.entries(summary?.by_category || {})
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([category, amount]) => (
                      <div key={category} className="flex items-center justify-between">
                        <span className="text-sm text-gray-400 truncate max-w-[60%]">
                          {category}
                        </span>
                        <span className="font-medium text-white">
                          {formatCurrency(amount)}
                        </span>
                      </div>
                    ))}
                  {Object.keys(summary?.by_category || {}).length === 0 && (
                    <p className="text-sm text-gray-500">No expense data yet</p>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-gradient-to-br from-cyan-500/20 to-violet-500/20 rounded-xl border border-cyan-500/30 p-5">
                <h2 className="font-semibold text-white mb-4">Runway Details</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg Monthly Income</span>
                    <span className="font-medium text-white">{formatCurrency(runway?.avg_monthly_income || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg Monthly Expenses</span>
                    <span className="font-medium text-white">{formatCurrency(runway?.avg_monthly_expenses || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Net Burn Rate</span>
                    <span className="font-medium text-white">{formatCurrency(runway?.monthly_burn_rate || 0)}</span>
                  </div>
                  <div className="border-t border-white/10 pt-3 flex justify-between">
                    <span className="text-gray-400">Runway at Current Burn</span>
                    <span className="font-bold text-lg text-cyan-400">{formatRunway(runway?.runway_months || 0)}</span>
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
