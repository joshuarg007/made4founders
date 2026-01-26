import { useEffect, useState } from 'react';
import {
  Mail,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Users,
  TrendingUp,
  DollarSign,
  Loader2,
  X,
  BarChart3,
} from 'lucide-react';
import {
  getInvestorUpdates,
  createInvestorUpdate,
  updateInvestorUpdate,
  deleteInvestorUpdate,
  previewInvestorUpdate,
  sendInvestorUpdate,
  getInvestorUpdateMetrics,
  getInvestorUpdateRecipients,
  type InvestorUpdate,
  type InvestorUpdateMetrics,
  type InvestorUpdateRecipient,
} from '../lib/api';

const metricOptions = [
  { id: 'mrr', label: 'Monthly Recurring Revenue', icon: DollarSign },
  { id: 'arr', label: 'Annual Recurring Revenue', icon: DollarSign },
  { id: 'runway', label: 'Runway (months)', icon: Clock },
  { id: 'cash', label: 'Cash on Hand', icon: DollarSign },
  { id: 'burn_rate', label: 'Monthly Burn Rate', icon: TrendingUp },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'revenue', label: 'Total Revenue', icon: BarChart3 },
];

const recipientTypeOptions = [
  { id: 'investor', label: 'Investors' },
  { id: 'board_member', label: 'Board Members' },
  { id: 'advisor', label: 'Advisors' },
];

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'sent':
      return 'bg-green-100 text-green-800';
    case 'scheduled':
      return 'bg-blue-100 text-blue-800';
    case 'sending':
      return 'bg-yellow-100 text-yellow-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'sent':
      return CheckCircle;
    case 'scheduled':
      return Clock;
    case 'sending':
      return Loader2;
    case 'failed':
      return AlertCircle;
    default:
      return Mail;
  }
}

export default function InvestorUpdates() {
  const [updates, setUpdates] = useState<InvestorUpdate[]>([]);
  const [metrics, setMetrics] = useState<InvestorUpdateMetrics | null>(null);
  const [recipients, setRecipients] = useState<InvestorUpdateRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<InvestorUpdate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewRecipients, setPreviewRecipients] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    subject_line: '',
    greeting: '',
    highlights: [''],
    body_content: '',
    closing: '',
    signature_name: '',
    signature_title: '',
    included_metrics: [] as string[],
    recipient_types: ['investor', 'board_member'] as string[],
    recipient_ids: null as number[] | null,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [updatesData, metricsData, recipientsData] = await Promise.all([
        getInvestorUpdates(),
        getInvestorUpdateMetrics(),
        getInvestorUpdateRecipients(),
      ]);

      setUpdates(updatesData);
      setMetrics(metricsData);
      setRecipients(recipientsData);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load investor updates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewUpdate = () => {
    setEditingUpdate(null);
    setFormData({
      title: `${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Update`,
      subject_line: '',
      greeting: 'Hi everyone,',
      highlights: [''],
      body_content: '',
      closing: "Thank you for your continued support. Please don't hesitate to reach out if you have any questions.",
      signature_name: '',
      signature_title: '',
      included_metrics: ['mrr', 'runway', 'cash'],
      recipient_types: ['investor', 'board_member'],
      recipient_ids: null,
    });
    setShowModal(true);
  };

  const openEditUpdate = (update: InvestorUpdate) => {
    setEditingUpdate(update);
    setFormData({
      title: update.title,
      subject_line: update.subject_line || '',
      greeting: update.greeting || '',
      highlights: update.highlights || [''],
      body_content: update.body_content || '',
      closing: update.closing || '',
      signature_name: update.signature_name || '',
      signature_title: update.signature_title || '',
      included_metrics: update.included_metrics || [],
      recipient_types: update.recipient_types || ['investor', 'board_member'],
      recipient_ids: update.recipient_ids || null,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        ...formData,
        highlights: formData.highlights.filter(h => h.trim() !== ''),
      };

      if (editingUpdate) {
        await updateInvestorUpdate(editingUpdate.id, data);
      } else {
        await createInvestorUpdate(data);
      }

      loadData();
      setShowModal(false);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async (updateId: number) => {
    try {
      const preview = await previewInvestorUpdate(updateId);
      setPreviewHtml(preview.html_content);
      setPreviewRecipients(preview.recipients);
      setShowPreview(true);
    } catch (err) {
      console.error('Failed to preview:', err);
    }
  };

  const handleSend = async (updateId: number) => {
    if (!confirm('Send this update to all recipients? This cannot be undone.')) {
      return;
    }

    setSending(true);
    try {
      await sendInvestorUpdate(updateId);
      loadData();
    } catch (err) {
      console.error('Failed to send:', err);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (updateId: number) => {
    if (!confirm('Delete this draft?')) {
      return;
    }

    try {
      await deleteInvestorUpdate(updateId);
      loadData();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const addHighlight = () => {
    setFormData({
      ...formData,
      highlights: [...formData.highlights, ''],
    });
  };

  const updateHighlight = (index: number, value: string) => {
    const newHighlights = [...formData.highlights];
    newHighlights[index] = value;
    setFormData({ ...formData, highlights: newHighlights });
  };

  const removeHighlight = (index: number) => {
    setFormData({
      ...formData,
      highlights: formData.highlights.filter((_, i) => i !== index),
    });
  };

  const toggleMetric = (metricId: string) => {
    if (formData.included_metrics.includes(metricId)) {
      setFormData({
        ...formData,
        included_metrics: formData.included_metrics.filter(m => m !== metricId),
      });
    } else {
      setFormData({
        ...formData,
        included_metrics: [...formData.included_metrics, metricId],
      });
    }
  };

  const toggleRecipientType = (typeId: string) => {
    if (formData.recipient_types.includes(typeId)) {
      setFormData({
        ...formData,
        recipient_types: formData.recipient_types.filter(t => t !== typeId),
      });
    } else {
      setFormData({
        ...formData,
        recipient_types: [...formData.recipient_types, typeId],
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const drafts = updates.filter(u => u.status === 'draft');
  void updates.filter(u => u.status === 'scheduled'); // scheduled - reserved for future use
  const sent = updates.filter(u => u.status === 'sent');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Investor Updates</h1>
          <p className="text-gray-600">Send professional updates to your investors</p>
        </div>
        <button
          onClick={openNewUpdate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Update
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      )}

      {/* Metrics Summary */}
      {metrics && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Current Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.mrr && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">MRR</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(metrics.mrr)}</p>
              </div>
            )}
            {metrics.runway_months && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Runway</p>
                <p className="text-lg font-bold text-gray-900">{metrics.runway_months.toFixed(1)} months</p>
              </div>
            )}
            {metrics.cash_on_hand && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Cash</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(metrics.cash_on_hand)}</p>
              </div>
            )}
            {metrics.customers && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Customers</p>
                <p className="text-lg font-bold text-gray-900">{metrics.customers.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drafts */}
      {drafts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Drafts</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {drafts.map((update) => (
              <div key={update.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Mail className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{update.title}</p>
                    <p className="text-sm text-gray-500">
                      Created {formatDate(update.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePreview(update.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEditUpdate(update)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleSend(update.id)}
                    disabled={sending}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                  <button
                    onClick={() => handleDelete(update.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sent Updates */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Sent Updates</h3>
        </div>
        {sent.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-5">Update</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-5">Sent</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-5">Recipients</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-5">Delivered</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase py-3 px-5">Status</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {sent.map((update) => {
                const StatusIcon = getStatusIcon(update.status);
                return (
                  <tr key={update.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-5">
                      <p className="font-medium text-gray-900">{update.title}</p>
                      <p className="text-sm text-gray-500">{update.subject_line}</p>
                    </td>
                    <td className="py-3 px-5 text-gray-600">
                      {formatDate(update.sent_at)}
                    </td>
                    <td className="py-3 px-5 text-center text-gray-600">
                      {update.recipient_count}
                    </td>
                    <td className="py-3 px-5 text-center">
                      <span className="text-green-600 font-medium">{update.sent_count}</span>
                      {update.failed_count > 0 && (
                        <span className="text-red-600 ml-2">({update.failed_count} failed)</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(update.status)}`}>
                        <StatusIcon className="w-3 h-3" />
                        {update.status}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <button
                        onClick={() => handlePreview(update.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="py-12 text-center text-gray-500">
            <Mail className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p>No updates sent yet</p>
            <p className="text-sm mt-1">Create your first investor update to get started</p>
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-8">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingUpdate ? 'Edit Update' : 'New Investor Update'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Q4 2025 Update"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Subject Line */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Subject</label>
                  <input
                    type="text"
                    value={formData.subject_line}
                    onChange={(e) => setFormData({ ...formData, subject_line: e.target.value })}
                    placeholder="Defaults to: [Title] - Investor Update"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Recipients */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Recipients</label>
                  <div className="flex flex-wrap gap-2">
                    {recipientTypeOptions.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => toggleRecipientType(type.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          formData.recipient_types.includes(type.id)
                            ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                            : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {recipients.filter(r => formData.recipient_types.includes(r.type)).length} recipients selected
                  </p>
                </div>

                {/* Metrics to Include */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Include Metrics</label>
                  <div className="grid grid-cols-2 gap-2">
                    {metricOptions.map((metric) => (
                      <label
                        key={metric.id}
                        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                          formData.included_metrics.includes(metric.id)
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.included_metrics.includes(metric.id)}
                          onChange={() => toggleMetric(metric.id)}
                          className="sr-only"
                        />
                        <metric.icon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700">{metric.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Greeting */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Greeting</label>
                  <input
                    type="text"
                    value={formData.greeting}
                    onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
                    placeholder="Hi everyone,"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Highlights */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Key Highlights</label>
                  <div className="space-y-2">
                    {formData.highlights.map((highlight, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={highlight}
                          onChange={(e) => updateHighlight(index, e.target.value)}
                          placeholder="Enter a key highlight..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        {formData.highlights.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeHighlight(index)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addHighlight}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      + Add highlight
                    </button>
                  </div>
                </div>

                {/* Body Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Additional Content</label>
                  <textarea
                    value={formData.body_content}
                    onChange={(e) => setFormData({ ...formData, body_content: e.target.value })}
                    placeholder="Any additional details you want to share..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Closing */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Closing</label>
                  <textarea
                    value={formData.closing}
                    onChange={(e) => setFormData({ ...formData, closing: e.target.value })}
                    placeholder="Thank you for your continued support..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Signature */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                    <input
                      type="text"
                      value={formData.signature_name}
                      onChange={(e) => setFormData({ ...formData, signature_name: e.target.value })}
                      placeholder="John Smith"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your Title</label>
                    <input
                      type="text"
                      value={formData.signature_title}
                      onChange={(e) => setFormData({ ...formData, signature_title: e.target.value })}
                      placeholder="CEO & Co-Founder"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formData.title}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-8">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowPreview(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
              <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Email Preview</h2>
                  <p className="text-sm text-gray-500">{previewRecipients.length} recipients</p>
                </div>
                <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
