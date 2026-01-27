import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Users,
  Target,
  BarChart3,
  PieChart,
  Activity,
  Plus,
  X,
  Check,
  Trash2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type {
  AnalyticsDashboard,
  GrowthMetric,
  MetricGoal,
  MultiChartData,
} from '../lib/api';
import {
  METRIC_TYPES,
  getAnalyticsDashboard,
  getMultiMetricChart,
  createMetricGoal,
  updateMetricGoal,
  deleteMetricGoal,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';

type Period = '7d' | '30d' | '90d' | '1y' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  '7d': '7 Days',
  '30d': '30 Days',
  '90d': '90 Days',
  '1y': '1 Year',
  'all': 'All Time',
};

// SVG Line Chart Component
function LineChart({
  data,
  width = 400,
  height = 200,
  color = '#06b6d4',
  showArea = true,
  formatValue = (v: number) => v.toLocaleString(),
}: {
  data: { date: string; value: number }[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
  formatValue?: (v: number) => string;
}) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Not enough data points
      </div>
    );
  }

  const padding = { top: 20, right: 20, bottom: 30, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const values = data.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartWidth,
    y: padding.top + chartHeight - ((d.value - minValue) / range) * chartHeight,
    value: d.value,
    date: d.date,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
    value: minValue + pct * range,
    y: padding.top + chartHeight - pct * chartHeight,
  }));

  // X-axis ticks (show ~5 dates)
  const xTickIndices = [0, Math.floor(data.length / 4), Math.floor(data.length / 2), Math.floor(3 * data.length / 4), data.length - 1];
  const xTicks = xTickIndices.filter((v, i, a) => a.indexOf(v) === i).map(i => ({
    label: new Date(data[i].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    x: points[i].x,
  }));

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Grid lines */}
      {yTicks.map((tick, i) => (
        <line
          key={i}
          x1={padding.left}
          y1={tick.y}
          x2={width - padding.right}
          y2={tick.y}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
        />
      ))}

      {/* Area fill */}
      {showArea && (
        <path
          d={areaPath}
          fill={`url(#gradient-${color.replace('#', '')})`}
          opacity="0.3"
        />
      )}

      {/* Gradient definition */}
      <defs>
        <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="4"
          fill={color}
          stroke="#1a1d24"
          strokeWidth="2"
          className="opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
        >
          <title>{`${new Date(p.date).toLocaleDateString()}: ${formatValue(p.value)}`}</title>
        </circle>
      ))}

      {/* Y-axis labels */}
      {yTicks.map((tick, i) => (
        <text
          key={i}
          x={padding.left - 8}
          y={tick.y + 4}
          textAnchor="end"
          className="fill-gray-500 text-xs"
        >
          {formatValue(tick.value)}
        </text>
      ))}

      {/* X-axis labels */}
      {xTicks.map((tick, i) => (
        <text
          key={i}
          x={tick.x}
          y={height - 8}
          textAnchor="middle"
          className="fill-gray-500 text-xs"
        >
          {tick.label}
        </text>
      ))}
    </svg>
  );
}

// KPI Card Component
function KPICard({
  label,
  value,
  change,
  icon: Icon,
  format = 'number',
  invertChange = false,
}: {
  label: string;
  value: number | null;
  change?: number | null;
  icon: typeof DollarSign;
  format?: 'currency' | 'number' | 'percent' | 'months';
  invertChange?: boolean;
}) {
  const formatValue = (v: number | null) => {
    if (v === null) return '—';
    switch (format) {
      case 'currency':
        return `$${v.toLocaleString()}`;
      case 'percent':
        return `${v.toFixed(1)}%`;
      case 'months':
        return `${v.toFixed(1)} mo`;
      default:
        return v.toLocaleString();
    }
  };

  const changeColor = change
    ? (invertChange ? change < 0 : change > 0)
      ? 'text-green-400'
      : 'text-red-400'
    : 'text-gray-400';

  return (
    <div className="bg-[#1a1d24] rounded-xl p-5 border border-white/10">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-[#1a1d24]/5 flex items-center justify-center text-gray-400">
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold text-white">{formatValue(value)}</span>
        {change !== undefined && change !== null && (
          <span className={`flex items-center gap-1 text-sm ${changeColor}`}>
            {change > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

// Progress Bar Component
function ProgressBar({
  progress,
  color = 'cyan',
}: {
  progress: number;
  color?: 'cyan' | 'violet' | 'green' | 'yellow' | 'red';
}) {
  const colorClasses = {
    cyan: 'bg-cyan-500',
    violet: 'bg-violet-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className="h-2 bg-[#1a1d24]/10 rounded-full overflow-hidden">
      <div
        className={`h-full ${colorClasses[color]} transition-all duration-500`}
        style={{ width: `${clampedProgress}%` }}
      />
    </div>
  );
}

// Growth Metric Row Component
function GrowthMetricRow({ metric }: { metric: GrowthMetric }) {
  const isPositive = metric.percent_change > 0;
  const isNegative = metric.percent_change < 0;
  const invertedMetrics = ['burn_rate', 'churn', 'cac'];
  const isInverted = invertedMetrics.includes(metric.metric_type);

  const trendColor = isInverted
    ? isNegative ? 'text-green-400' : isPositive ? 'text-red-400' : 'text-gray-400'
    : isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-gray-400';

  const formatValue = (v: number) => {
    if (metric.unit === '$') return `$${v.toLocaleString()}`;
    if (metric.unit === '%') return `${v.toFixed(1)}%`;
    if (metric.unit === 'months') return `${v.toFixed(1)} mo`;
    return v.toLocaleString();
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div>
        <p className="text-white font-medium">{metric.name}</p>
        <p className="text-xs text-gray-500">{metric.metric_type}</p>
      </div>
      <div className="text-right">
        <p className="text-white font-medium">{formatValue(metric.current_value)}</p>
        <p className={`text-sm ${trendColor} flex items-center gap-1 justify-end`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          {metric.percent_change > 0 ? '+' : ''}{metric.percent_change.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}

export default function Analytics() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'editor';

  const [period, setPeriod] = useState<Period>('30d');
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [chartData, setChartData] = useState<MultiChartData>({});
  const [loading, setLoading] = useState(true);
  const [selectedChart, setSelectedChart] = useState<string>('mrr');

  // Goal modal
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalForm, setGoalForm] = useState({
    metric_type: 'mrr',
    target_value: '',
    target_date: '',
    name: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dashboardData, chartResponse] = await Promise.all([
        getAnalyticsDashboard(period),
        getMultiMetricChart(['mrr', 'arr', 'customers', 'revenue', 'churn'], period),
      ]);
      setDashboard(dashboardData);
      setChartData(chartResponse);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMetricGoal({
        metric_type: goalForm.metric_type,
        target_value: parseFloat(goalForm.target_value),
        target_date: goalForm.target_date || undefined,
        name: goalForm.name || undefined,
        notes: goalForm.notes || undefined,
      });
      setShowGoalModal(false);
      setGoalForm({ metric_type: 'mrr', target_value: '', target_date: '', name: '', notes: '' });
      loadData();
    } catch (error) {
      console.error('Failed to create goal:', error);
    }
  };

  const handleMarkAchieved = async (goal: MetricGoal) => {
    try {
      await updateMetricGoal(goal.id, { is_achieved: true });
      loadData();
    } catch (error) {
      console.error('Failed to update goal:', error);
    }
  };

  const handleDeleteGoal = async (goal: MetricGoal) => {
    if (!confirm('Delete this goal?')) return;
    try {
      await deleteMetricGoal(goal.id);
      loadData();
    } catch (error) {
      console.error('Failed to delete goal:', error);
    }
  };

  // Available chart options based on what has data
  const chartOptions = useMemo(() => {
    return Object.entries(chartData)
      .filter(([_, data]) => data.length > 0)
      .map(([type]) => ({
        value: type,
        label: METRIC_TYPES[type as keyof typeof METRIC_TYPES]?.label || type,
      }));
  }, [chartData]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-[#1a1d24]/10 rounded w-48 mb-8"></div>
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-[#1a1d24]/5 rounded-xl"></div>
            ))}
          </div>
          <div className="h-64 bg-[#1a1d24]/5 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="p-8">
        <div className="bg-[#1a1d24] rounded-xl p-12 text-center border border-white/10">
          <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No analytics data</h3>
          <p className="text-gray-400">Start tracking metrics to see analytics.</p>
        </div>
      </div>
    );
  }

  const { overview, financial, customer, growth_metrics, goals } = dashboard;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Analytics</h1>
          <p className="text-gray-400">Business performance insights</p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2 bg-[#1a1d24]/5 rounded-lg p-1">
          {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([p, label]) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                period === p
                  ? 'bg-[#1a1d24]/10 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-[#1a1d24]/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <div className="bg-[#1a1d24] rounded-xl p-5 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-400">Metrics Tracked</span>
          </div>
          <p className="text-2xl font-bold text-white">{overview.total_metrics}</p>
        </div>
        <div className="bg-[#1a1d24] rounded-xl p-5 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <span className="text-sm text-gray-400">Improving</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{overview.improving_metrics}</p>
        </div>
        <div className="bg-[#1a1d24] rounded-xl p-5 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-red-400" />
            <span className="text-sm text-gray-400">Declining</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{overview.declining_metrics}</p>
        </div>
        <div className="bg-[#1a1d24] rounded-xl p-5 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Minus className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-400">Stable</span>
          </div>
          <p className="text-2xl font-bold text-gray-400">{overview.flat_metrics}</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Chart Section */}
        <div className="lg:col-span-2 bg-[#1a1d24] rounded-xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Trend Analysis</h2>
            {chartOptions.length > 0 && (
              <select
                value={selectedChart}
                onChange={(e) => setSelectedChart(e.target.value)}
                className="px-3 py-1.5 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              >
                {chartOptions.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-[#1a1d24]">
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="h-64">
            {chartData[selectedChart] && chartData[selectedChart].length > 1 ? (
              <LineChart
                data={chartData[selectedChart]}
                width={600}
                height={240}
                color="#06b6d4"
                formatValue={(v) => {
                  const info = METRIC_TYPES[selectedChart as keyof typeof METRIC_TYPES];
                  if (info?.unit === '$') return `$${v.toLocaleString()}`;
                  if (info?.unit === '%') return `${v.toFixed(1)}%`;
                  return v.toLocaleString();
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No data available for this metric
              </div>
            )}
          </div>
        </div>

        {/* Goals Section */}
        <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Goals</h2>
            {canEdit && (
              <button
                onClick={() => setShowGoalModal(true)}
                className="p-2 bg-[#1a1d24]/5 rounded-lg hover:bg-[#1a1d24]/10 transition"
              >
                <Plus className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
          {goals.length > 0 ? (
            <div className="space-y-4">
              {goals.map(goal => {
                const info = METRIC_TYPES[goal.metric_type as keyof typeof METRIC_TYPES];
                const progressColor = (goal.progress_percent || 0) >= 100 ? 'green' : (goal.progress_percent || 0) >= 50 ? 'cyan' : 'yellow';
                return (
                  <div key={goal.id} className="p-4 bg-[#1a1d24]/5 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-white font-medium">{goal.name || info?.label || goal.metric_type}</p>
                        <p className="text-xs text-gray-500">
                          Target: {info?.unit === '$' ? '$' : ''}{goal.target_value.toLocaleString()}{info?.unit === '%' ? '%' : ''}
                          {goal.target_date && ` by ${new Date(goal.target_date).toLocaleDateString()}`}
                        </p>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMarkAchieved(goal)}
                            className="p-1 text-gray-400 hover:text-green-400 transition"
                            title="Mark achieved"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteGoal(goal)}
                            className="p-1 text-gray-400 hover:text-red-400 transition"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <ProgressBar progress={goal.progress_percent || 0} color={progressColor} />
                    <p className="text-xs text-gray-400 mt-1">
                      {goal.progress_percent?.toFixed(1) || 0}% complete
                      {goal.current_value !== null && (
                        <span> • Current: {info?.unit === '$' ? '$' : ''}{goal.current_value.toLocaleString()}</span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No active goals</p>
              {canEdit && (
                <button
                  onClick={() => setShowGoalModal(true)}
                  className="mt-2 text-cyan-400 hover:text-cyan-300 text-sm"
                >
                  Set your first goal
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Financial & Customer Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Financial Health */}
        <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-6">
          <div className="flex items-center gap-2 mb-6">
            <DollarSign className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">Financial Health</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <KPICard label="MRR" value={financial.mrr} change={financial.mrr_growth} icon={DollarSign} format="currency" />
            <KPICard label="ARR" value={financial.arr} icon={DollarSign} format="currency" />
            <KPICard label="Burn Rate" value={financial.burn_rate} icon={Activity} format="currency" invertChange />
            <KPICard label="Runway" value={financial.runway_months} icon={BarChart3} format="months" />
            <KPICard label="Cash" value={financial.cash} icon={DollarSign} format="currency" />
            <KPICard label="Revenue" value={financial.revenue} icon={DollarSign} format="currency" />
          </div>
        </div>

        {/* Customer Health */}
        <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-semibold text-white">Customer Health</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <KPICard label="Customers" value={customer.total_customers} change={customer.customer_growth} icon={Users} />
            <KPICard label="Churn Rate" value={customer.churn_rate} icon={PieChart} format="percent" invertChange />
            <KPICard label="LTV" value={customer.ltv} icon={DollarSign} format="currency" />
            <KPICard label="CAC" value={customer.cac} icon={DollarSign} format="currency" invertChange />
            <KPICard label="LTV:CAC Ratio" value={customer.ltv_cac_ratio} icon={Target} />
            <KPICard label="NPS" value={customer.nps} icon={Activity} />
          </div>
        </div>
      </div>

      {/* Growth Metrics Table */}
      {growth_metrics.length > 0 && (
        <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Period Comparison</h2>
          <p className="text-sm text-gray-400 mb-4">
            Comparing current {PERIOD_LABELS[period].toLowerCase()} vs. previous {PERIOD_LABELS[period].toLowerCase()}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8">
            {growth_metrics.map(metric => (
              <GrowthMetricRow key={metric.metric_type} metric={metric} />
            ))}
          </div>
        </div>
      )}

      {/* Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] rounded-xl w-full max-w-md border border-white/10">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Set Goal</h2>
              <button onClick={() => setShowGoalModal(false)} className="p-1 text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateGoal} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Metric Type</label>
                <select
                  value={goalForm.metric_type}
                  onChange={(e) => setGoalForm({ ...goalForm, metric_type: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                >
                  {Object.entries(METRIC_TYPES).map(([type, info]) => (
                    <option key={type} value={type} className="bg-[#1a1d24]">
                      {info.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Goal Name (optional)</label>
                <input
                  type="text"
                  value={goalForm.name}
                  onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  placeholder="e.g., Q1 Revenue Target"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Target Value</label>
                  <input
                    type="number"
                    value={goalForm.target_value}
                    onChange={(e) => setGoalForm({ ...goalForm, target_value: e.target.value })}
                    className="w-full px-3 py-2 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    placeholder="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Target Date</label>
                  <input
                    type="date"
                    value={goalForm.target_date}
                    onChange={(e) => setGoalForm({ ...goalForm, target_date: e.target.value })}
                    className="w-full px-3 py-2 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Notes (optional)</label>
                <textarea
                  value={goalForm.notes}
                  onChange={(e) => setGoalForm({ ...goalForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500 resize-none"
                  rows={2}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="flex-1 px-4 py-2 bg-[#1a1d24]/5 text-gray-300 rounded-lg hover:bg-[#1a1d24]/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white rounded-lg hover:opacity-90 transition"
                >
                  Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
