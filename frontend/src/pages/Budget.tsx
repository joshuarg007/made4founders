import { useState, useEffect } from 'react'
import {
  Plus,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Loader2,
  Settings,
  RefreshCw,
  Target,
  X
} from 'lucide-react'
import {
  getBudgetCategories,
  getBudgetPeriods,
  createBudgetPeriod,
  createBudgetCategory,
  getBudgetVarianceReport,
  getBudgetForecast,
  getBudgetSummary,
  initializeDefaultCategories,
  calculateBudgetActuals,
  addBudgetLineItem,
} from '../lib/api'
import type {
  BudgetCategory,
  BudgetPeriod,
  BudgetVarianceReport,
  BudgetForecast,
  BudgetSummary
} from '../lib/api'

export default function Budget() {
  const [activeTab, setActiveTab] = useState<'overview' | 'variance' | 'forecast' | 'categories'>('overview')
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [_periods, setPeriods] = useState<BudgetPeriod[]>([])
  const [currentPeriod, setCurrentPeriod] = useState<BudgetPeriod | null>(null)
  const [summary, setSummary] = useState<BudgetSummary | null>(null)
  const [varianceReport, setVarianceReport] = useState<BudgetVarianceReport | null>(null)
  const [forecast, setForecast] = useState<BudgetForecast | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [calculating, setCalculating] = useState(false)

  // Modals
  const [showNewPeriod, setShowNewPeriod] = useState(false)
  const [showAddLineItem, setShowAddLineItem] = useState(false)
  const [showNewCategory, setShowNewCategory] = useState(false)

  // Form state
  const [newPeriodType, setNewPeriodType] = useState('monthly')
  const [newPeriodStart, setNewPeriodStart] = useState('')
  const [newPeriodEnd, setNewPeriodEnd] = useState('')
  const [newPeriodName, setNewPeriodName] = useState('')
  const [lineItemCategoryId, setLineItemCategoryId] = useState<number | null>(null)
  const [lineItemAmount, setLineItemAmount] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [catsData, periodsData, summaryData] = await Promise.all([
        getBudgetCategories(),
        getBudgetPeriods(),
        getBudgetSummary()
      ])
      setCategories(catsData)
      setPeriods(periodsData)
      setSummary(summaryData)

      // If there's a current period, load variance and forecast
      if (summaryData.current_period) {
        setCurrentPeriod(summaryData.current_period)
        const [varData, foreData] = await Promise.all([
          getBudgetVarianceReport(summaryData.current_period.id),
          getBudgetForecast(summaryData.current_period.id)
        ])
        setVarianceReport(varData)
        setForecast(foreData)
      }
    } catch (err) {
      setError('Failed to load budget data')
    } finally {
      setLoading(false)
    }
  }

  const handleInitializeCategories = async () => {
    try {
      await initializeDefaultCategories()
      loadData()
    } catch (err) {
      setError('Failed to initialize categories')
    }
  }

  const handleCalculateActuals = async () => {
    if (!currentPeriod) return
    try {
      setCalculating(true)
      await calculateBudgetActuals(currentPeriod.id)
      loadData()
    } catch (err) {
      setError('Failed to calculate actuals')
    } finally {
      setCalculating(false)
    }
  }

  const handleCreatePeriod = async () => {
    if (!newPeriodStart || !newPeriodEnd) return
    try {
      await createBudgetPeriod({
        period_type: newPeriodType,
        start_date: newPeriodStart,
        end_date: newPeriodEnd,
        name: newPeriodName || undefined,
        line_items: []
      })
      setShowNewPeriod(false)
      setNewPeriodType('monthly')
      setNewPeriodStart('')
      setNewPeriodEnd('')
      setNewPeriodName('')
      loadData()
    } catch (err) {
      setError('Failed to create budget period')
    }
  }

  const handleAddLineItem = async () => {
    if (!currentPeriod || !lineItemCategoryId || !lineItemAmount) return
    try {
      await addBudgetLineItem(currentPeriod.id, {
        category_id: lineItemCategoryId,
        budgeted_amount: parseFloat(lineItemAmount)
      })
      setShowAddLineItem(false)
      setLineItemCategoryId(null)
      setLineItemAmount('')
      loadData()
    } catch (err) {
      setError('Failed to add budget line')
    }
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName) return
    try {
      await createBudgetCategory({
        name: newCategoryName,
        color: newCategoryColor
      })
      setShowNewCategory(false)
      setNewCategoryName('')
      setNewCategoryColor('#3b82f6')
      loadData()
    } catch (err) {
      setError('Failed to create category')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on_track':
        return 'text-emerald-400 bg-emerald-500/20'
      case 'warning':
        return 'text-yellow-400 bg-yellow-500/20'
      case 'over':
        return 'text-red-400 bg-red-500/20'
      default:
        return 'text-gray-400 bg-white/50/20'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'on_track':
        return <CheckCircle className="w-4 h-4" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />
      case 'over':
        return <TrendingUp className="w-4 h-4" />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Budget vs. Actuals</h1>
          <p className="text-gray-400 mt-1">Track spending against your budget</p>
        </div>
        <div className="flex gap-3">
          {currentPeriod && (
            <button
              onClick={handleCalculateActuals}
              disabled={calculating}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-white hover:bg-[#1a1d24]/10 transition disabled:opacity-50"
            >
              {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync Actuals
            </button>
          )}
          <button
            onClick={() => setShowNewPeriod(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            New Budget
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex justify-between items-center">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Initialize categories if none exist */}
      {categories.length === 0 && (
        <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-8 text-center">
          <Settings className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Set Up Budget Categories</h3>
          <p className="text-gray-400 mb-4">Initialize default spending categories to get started</p>
          <button
            onClick={handleInitializeCategories}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition"
          >
            Initialize Default Categories
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {summary && summary.current_period && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{formatCurrency(summary.total_budgeted)}</p>
                <p className="text-xs text-gray-400">Total Budget</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{formatCurrency(summary.total_spent)}</p>
                <p className="text-xs text-gray-400">Spent ({summary.percent_spent.toFixed(0)}%)</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${summary.remaining >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                {summary.remaining >= 0 ? (
                  <TrendingDown className="w-5 h-5 text-emerald-400" />
                ) : (
                  <TrendingUp className="w-5 h-5 text-red-400" />
                )}
              </div>
              <div>
                <p className={`text-2xl font-bold ${summary.remaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(Math.abs(summary.remaining))}
                </p>
                <p className="text-xs text-gray-400">{summary.remaining >= 0 ? 'Remaining' : 'Over Budget'}</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{summary.days_remaining}</p>
                <p className="text-xs text-gray-400">Days Remaining</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {(['overview', 'variance', 'forecast', 'categories'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-cyan-400 border-cyan-400'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            {tab === 'overview' && 'Overview'}
            {tab === 'variance' && 'Variance Report'}
            {tab === 'forecast' && 'Forecast'}
            {tab === 'categories' && 'Categories'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {!currentPeriod ? (
            <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No Active Budget Period</h3>
              <p className="text-gray-400 mb-4">Create a budget period to start tracking spending</p>
              <button
                onClick={() => setShowNewPeriod(true)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition"
              >
                Create Budget Period
              </button>
            </div>
          ) : (
            <>
              {/* Budget Period Info */}
              <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-white">
                      {currentPeriod.name || `${currentPeriod.period_type.charAt(0).toUpperCase() + currentPeriod.period_type.slice(1)} Budget`}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {new Date(currentPeriod.start_date).toLocaleDateString()} - {new Date(currentPeriod.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddLineItem(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition"
                  >
                    <Plus className="w-4 h-4" />
                    Add Line Item
                  </button>
                </div>

                {/* Progress bar */}
                {summary && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Budget Progress</span>
                      <span className="text-white">{summary.percent_spent.toFixed(0)}% spent</span>
                    </div>
                    <div className="h-3 bg-[#1a1d24]/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          summary.percent_spent > 100 ? 'bg-red-500' :
                          summary.percent_spent > 80 ? 'bg-yellow-500' : 'bg-cyan-500'
                        }`}
                        style={{ width: `${Math.min(summary.percent_spent, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Top spending categories */}
              {summary && summary.top_categories.length > 0 && (
                <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-4">Top Spending Categories</h3>
                  <div className="space-y-3">
                    {summary.top_categories.map((cat, idx) => (
                      <div key={idx} className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-white">{cat.name}</span>
                            <span className="text-gray-400">
                              {formatCurrency(cat.spent)} / {formatCurrency(cat.budget)}
                            </span>
                          </div>
                          <div className="h-2 bg-[#1a1d24]/5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                cat.percent > 100 ? 'bg-red-500' :
                                cat.percent > 80 ? 'bg-yellow-500' : 'bg-cyan-500'
                              }`}
                              style={{ width: `${Math.min(cat.percent, 100)}%` }}
                            />
                          </div>
                        </div>
                        <span className={`text-sm ${cat.percent > 100 ? 'text-red-400' : 'text-gray-400'}`}>
                          {cat.percent.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Variance Tab */}
      {activeTab === 'variance' && varianceReport && (
        <div className="bg-[#1a1d24] border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Category</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-400 uppercase">Budget</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-400 uppercase">Actual</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-400 uppercase">Variance</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-400 uppercase">% Var</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {varianceReport.line_items.map(item => (
                <tr key={item.id} className="hover:bg-[#1a1d24]/5">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.category_color || '#6b7280' }}
                      />
                      <span className="text-white">{item.category_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-300">
                    {formatCurrency(item.budgeted_amount)}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-300">
                    {formatCurrency(item.actual_amount)}
                  </td>
                  <td className={`px-6 py-4 text-right ${
                    (item.variance_amount || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {formatCurrency(Math.abs(item.variance_amount || 0))}
                    {(item.variance_amount || 0) < 0 && ' over'}
                  </td>
                  <td className={`px-6 py-4 text-right ${
                    (item.variance_percent || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {Math.abs(item.variance_percent || 0).toFixed(1)}%
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${getStatusColor(item.status)}`}>
                        {getStatusIcon(item.status)}
                        {item.status === 'on_track' ? 'On Track' : item.status === 'warning' ? 'Warning' : 'Over'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-[#1a1d24]/5 font-medium">
                <td className="px-6 py-4 text-white">Total</td>
                <td className="px-6 py-4 text-right text-white">{formatCurrency(varianceReport.total_budgeted)}</td>
                <td className="px-6 py-4 text-right text-white">{formatCurrency(varianceReport.total_actual)}</td>
                <td className={`px-6 py-4 text-right ${varianceReport.total_variance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(Math.abs(varianceReport.total_variance))}
                  {varianceReport.total_variance < 0 && ' over'}
                </td>
                <td className={`px-6 py-4 text-right ${varianceReport.variance_percent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {Math.abs(varianceReport.variance_percent).toFixed(1)}%
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${getStatusColor(varianceReport.status)}`}>
                      {getStatusIcon(varianceReport.status)}
                      {varianceReport.status === 'on_track' ? 'On Track' : varianceReport.status === 'warning' ? 'Warning' : 'Over'}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Forecast Tab */}
      {activeTab === 'forecast' && forecast && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-4">
              <h3 className="text-sm text-gray-400 mb-2">Daily Burn Rate</h3>
              <p className="text-2xl font-bold text-white">{formatCurrency(forecast.daily_burn_rate)}</p>
              <p className="text-xs text-gray-500 mt-1">per day</p>
            </div>
            <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-4">
              <h3 className="text-sm text-gray-400 mb-2">Projected Total</h3>
              <p className={`text-2xl font-bold ${forecast.projected_variance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(forecast.projected_total)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {forecast.projected_variance >= 0 ? 'Under budget' : 'Over budget'} by {formatCurrency(Math.abs(forecast.projected_variance))}
              </p>
            </div>
            <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-4">
              <h3 className="text-sm text-gray-400 mb-2">Risk Level</h3>
              <p className={`text-2xl font-bold ${
                forecast.risk_level === 'safe' ? 'text-emerald-400' :
                forecast.risk_level === 'warning' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {forecast.risk_level === 'safe' ? 'Safe' :
                 forecast.risk_level === 'warning' ? 'Warning' : 'Critical'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {forecast.percent_through.toFixed(0)}% through period
              </p>
            </div>
          </div>

          {forecast.at_risk_categories.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <h3 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                At-Risk Categories
              </h3>
              <p className="text-gray-300">
                The following categories are projected to exceed their budget:
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {forecast.at_risk_categories.map((cat, idx) => (
                  <span key={idx} className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-sm">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewCategory(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
          </div>
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Category</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Bank Categories</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Keywords</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {categories.map(cat => (
                  <tr key={cat.id} className="hover:bg-[#1a1d24]/5">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: cat.color || '#6b7280' }}
                        />
                        <span className="text-white">{cat.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {cat.plaid_categories?.join(', ') || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {cat.merchant_keywords?.join(', ') || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Period Modal */}
      {showNewPeriod && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Create Budget Period</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Period Type</label>
                <select
                  value={newPeriodType}
                  onChange={(e) => setNewPeriodType(e.target.value)}
                  className="w-full bg-[#1a1d24]/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newPeriodStart}
                    onChange={(e) => setNewPeriodStart(e.target.value)}
                    className="w-full bg-[#1a1d24]/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={newPeriodEnd}
                    onChange={(e) => setNewPeriodEnd(e.target.value)}
                    className="w-full bg-[#1a1d24]/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name (Optional)</label>
                <input
                  type="text"
                  value={newPeriodName}
                  onChange={(e) => setNewPeriodName(e.target.value)}
                  placeholder="e.g., Q1 2025 Budget"
                  className="w-full bg-[#1a1d24]/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewPeriod(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePeriod}
                disabled={!newPeriodStart || !newPeriodEnd}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition disabled:opacity-50"
              >
                Create Period
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Line Item Modal */}
      {showAddLineItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Add Budget Line Item</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <select
                  value={lineItemCategoryId || ''}
                  onChange={(e) => setLineItemCategoryId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full bg-[#1a1d24]/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">Select category...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Budget Amount</label>
                <input
                  type="number"
                  value={lineItemAmount}
                  onChange={(e) => setLineItemAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full bg-[#1a1d24]/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddLineItem(false)
                  setLineItemCategoryId(null)
                  setLineItemAmount('')
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddLineItem}
                disabled={!lineItemCategoryId || !lineItemAmount}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition disabled:opacity-50"
              >
                Add Line Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Category Modal */}
      {showNewCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1d24] border border-white/10 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Add Budget Category</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Category Name</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., Cloud Infrastructure"
                  className="w-full bg-[#1a1d24]/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Color</label>
                <input
                  type="color"
                  value={newCategoryColor}
                  onChange={(e) => setNewCategoryColor(e.target.value)}
                  className="w-full h-10 bg-[#1a1d24]/5 border border-white/10 rounded-lg cursor-pointer"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowNewCategory(false)
                  setNewCategoryName('')
                  setNewCategoryColor('#3b82f6')
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCategory}
                disabled={!newCategoryName}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition disabled:opacity-50"
              >
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
