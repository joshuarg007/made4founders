import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  X,
  DollarSign,
  Users,
  Percent,
  BarChart3,
  Trash2,
  Edit2,
} from 'lucide-react';
import type { Metric, MetricSummary, MetricType } from '../lib/api';
import {
  METRIC_TYPES,
  getMetrics,
  getMetricsSummary,
  getMetricChartData,
  createMetric,
  updateMetric,
  deleteMetric,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';

// Simple sparkline chart component
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const height = 40;
  const width = 120;

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

// Metric card component
function MetricCard({
  summary,
  chartData,
  onEdit,
}: {
  summary: MetricSummary;
  chartData?: number[];
  onEdit: () => void;
}) {
  const metricInfo = METRIC_TYPES[summary.metric_type as MetricType] || METRIC_TYPES.custom;

  const getTrendIcon = () => {
    if (summary.trend === 'up') {
      return <TrendingUp className="w-4 h-4 text-green-400" />;
    } else if (summary.trend === 'down') {
      return <TrendingDown className="w-4 h-4 text-red-400" />;
    }
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getTrendColor = () => {
    // For metrics like burn_rate and churn, down is good
    const invertedMetrics = ['burn_rate', 'churn', 'cac'];
    const isInverted = invertedMetrics.includes(summary.metric_type);

    if (summary.trend === 'up') {
      return isInverted ? 'text-red-400' : 'text-green-400';
    } else if (summary.trend === 'down') {
      return isInverted ? 'text-green-400' : 'text-red-400';
    }
    return 'text-gray-400';
  };

  const getIcon = () => {
    const type = summary.metric_type;
    if (['mrr', 'arr', 'revenue', 'burn_rate', 'cash', 'cac', 'ltv'].includes(type)) {
      return <DollarSign className="w-5 h-5" />;
    } else if (['customers', 'users'].includes(type)) {
      return <Users className="w-5 h-5" />;
    } else if (['churn', 'nps'].includes(type)) {
      return <Percent className="w-5 h-5" />;
    }
    return <BarChart3 className="w-5 h-5" />;
  };

  const sparklineColor = summary.trend === 'up' ? '#4ade80' : summary.trend === 'down' ? '#f87171' : '#9ca3af';

  return (
    <div
      className="bg-[#1a1d24] rounded-xl p-6 border border-white/10 hover:border-white/20 transition cursor-pointer"
      onClick={onEdit}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1a1d24]/5 flex items-center justify-center text-gray-400">
            {getIcon()}
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-400">{summary.name}</h3>
            <p className="text-xs text-gray-500">{metricInfo.description}</p>
          </div>
        </div>
        {getTrendIcon()}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-white">
            {metricInfo.unit === '$' && '$'}
            {summary.current_value}
            {metricInfo.unit === '%' && '%'}
            {metricInfo.unit === 'months' && ' mo'}
          </p>
          {summary.change_percent !== null && (
            <p className={`text-sm ${getTrendColor()}`}>
              {summary.change_percent > 0 ? '+' : ''}
              {summary.change_percent.toFixed(1)}% from previous
            </p>
          )}
        </div>
        {chartData && chartData.length > 1 && (
          <Sparkline data={chartData} color={sparklineColor} />
        )}
      </div>
    </div>
  );
}

export default function Metrics() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'editor';

  const [summaries, setSummaries] = useState<MetricSummary[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [chartDataMap, setChartDataMap] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingMetric, setEditingMetric] = useState<Metric | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    metric_type: 'mrr' as string,
    name: '',
    value: '',
    unit: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [summaryData, metricsData] = await Promise.all([
        getMetricsSummary(),
        getMetrics(),
      ]);
      setSummaries(summaryData);
      setMetrics(metricsData);

      // Load chart data for each metric type
      const uniqueTypes = [...new Set(metricsData.map(m => m.metric_type))];
      const chartPromises = uniqueTypes.map(type => getMetricChartData(type, 12));
      const chartResults = await Promise.all(chartPromises);

      const chartMap: Record<string, number[]> = {};
      chartResults.forEach((result, i) => {
        chartMap[uniqueTypes[i]] = result.data.map(d => {
          const num = parseFloat(d.value.replace(/[,$%]/g, ''));
          return isNaN(num) ? 0 : num;
        });
      });
      setChartDataMap(chartMap);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (metricType?: string) => {
    if (metricType) {
      setSelectedType(metricType);
      const typeInfo = METRIC_TYPES[metricType as MetricType] || METRIC_TYPES.custom;
      setFormData({
        metric_type: metricType,
        name: typeInfo.label,
        value: '',
        unit: typeInfo.unit,
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
    } else {
      setSelectedType(null);
      setFormData({
        metric_type: 'mrr',
        name: METRIC_TYPES.mrr.label,
        value: '',
        unit: METRIC_TYPES.mrr.unit,
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
    }
    setEditingMetric(null);
    setShowModal(true);
  };

  const handleEditMetric = (metric: Metric) => {
    setEditingMetric(metric);
    setSelectedType(metric.metric_type);
    setFormData({
      metric_type: metric.metric_type,
      name: metric.name,
      value: metric.value,
      unit: metric.unit || '',
      date: metric.date.split('T')[0],
      notes: metric.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        date: new Date(formData.date).toISOString(),
      };

      if (editingMetric) {
        await updateMetric(editingMetric.id, payload);
      } else {
        await createMetric(payload);
      }

      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Failed to save metric:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this metric?')) return;
    try {
      await deleteMetric(id);
      loadData();
    } catch (error) {
      console.error('Failed to delete metric:', error);
    }
  };

  const handleTypeChange = (type: string) => {
    const typeInfo = METRIC_TYPES[type as MetricType] || METRIC_TYPES.custom;
    setFormData(prev => ({
      ...prev,
      metric_type: type,
      name: typeInfo.label,
      unit: typeInfo.unit,
    }));
  };

  // Get metrics for selected type
  const filteredMetrics = selectedType
    ? metrics.filter(m => m.metric_type === selectedType)
    : [];

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-[#1a1d24]/10 rounded w-48 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-40 bg-[#1a1d24]/5 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Metrics</h1>
          <p className="text-gray-400">Track your key business metrics over time</p>
        </div>
        {canEdit && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white rounded-lg hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" />
            Add Metric
          </button>
        )}
      </div>

      {/* Metric Cards */}
      {summaries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {summaries.map(summary => (
            <MetricCard
              key={summary.metric_type}
              summary={summary}
              chartData={chartDataMap[summary.metric_type]}
              onEdit={() => handleOpenModal(summary.metric_type)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-[#1a1d24] rounded-xl p-12 text-center border border-white/10 mb-8">
          <BarChart3 className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No metrics yet</h3>
          <p className="text-gray-400 mb-4">Start tracking your business metrics to see trends over time.</p>
          {canEdit && (
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-[#1a1d24]/10 text-white rounded-lg hover:bg-[#1a1d24]/20 transition"
            >
              Add your first metric
            </button>
          )}
        </div>
      )}

      {/* Quick Add Buttons */}
      {canEdit && summaries.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Quick Add</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(METRIC_TYPES).map(([type, info]) => (
              <button
                key={type}
                onClick={() => handleOpenModal(type)}
                className="px-3 py-1.5 bg-[#1a1d24]/5 text-gray-300 rounded-lg hover:bg-[#1a1d24]/10 transition text-sm"
              >
                + {info.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Entries Table */}
      {metrics.length > 0 && (
        <div className="bg-[#1a1d24] rounded-xl border border-white/10">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-lg font-medium text-white">Recent Entries</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#1a1d24]/5">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Metric</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Notes</th>
                  {canEdit && (
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {metrics.slice(0, 20).map(metric => {
                  const typeInfo = METRIC_TYPES[metric.metric_type as MetricType] || METRIC_TYPES.custom;
                  return (
                    <tr key={metric.id} className="hover:bg-[#1a1d24]/5">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                        {new Date(metric.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-white">{metric.name}</span>
                        <span className="text-xs text-gray-500 ml-2">({typeInfo.description})</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">
                        {typeInfo.unit === '$' && '$'}
                        {metric.value}
                        {typeInfo.unit === '%' && '%'}
                        {typeInfo.unit === 'months' && ' mo'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate">
                        {metric.notes || '-'}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <button
                            onClick={() => handleEditMetric(metric)}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#1a1d24]/10 rounded transition mr-1"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(metric.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#1a1d24]/10 rounded transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] rounded-xl w-full max-w-md border border-white/10">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                {editingMetric ? 'Edit Metric' : selectedType ? `Add ${METRIC_TYPES[selectedType as MetricType]?.label || 'Metric'}` : 'Add Metric'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {!selectedType && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Metric Type
                  </label>
                  <select
                    value={formData.metric_type}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  >
                    {Object.entries(METRIC_TYPES).map(([type, info]) => (
                      <option key={type} value={type} className="bg-[#1a1d24] text-white">
                        {info.label} - {info.description}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Value
                  </label>
                  <div className="relative">
                    {formData.unit === '$' && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    )}
                    <input
                      type="number"
                      inputMode="numeric"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      onKeyDown={(e) => {
                        // Block non-numeric keys except backspace, delete, arrows, tab
                        if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      className={`w-full px-3 py-2 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500 ${formData.unit === '$' ? 'pl-7' : ''} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                      placeholder="0"
                      min="0"
                      required
                    />
                    {formData.unit === '%' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                    )}
                    {formData.unit === 'months' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">mo</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1d24]/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500 resize-none"
                  rows={2}
                  placeholder="Add any context or notes..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-[#1a1d24]/5 text-gray-300 rounded-lg hover:bg-[#1a1d24]/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white rounded-lg hover:opacity-90 transition"
                >
                  {editingMetric ? 'Save Changes' : 'Add Metric'}
                </button>
              </div>
            </form>

            {/* History for selected type */}
            {selectedType && filteredMetrics.length > 0 && (
              <div className="p-4 border-t border-white/10">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Recent History</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {filteredMetrics.slice(0, 5).map(m => (
                    <div key={m.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">{new Date(m.date).toLocaleDateString()}</span>
                      <span className="text-white font-medium">{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
