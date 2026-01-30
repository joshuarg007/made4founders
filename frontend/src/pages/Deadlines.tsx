import { useEffect, useState } from 'react';
import {
  Plus,
  Check,
  Pencil,
  Trash2,
  X,
  Search,
  RefreshCw,
  AlertTriangle,
  MessageCircle,
  Calendar
} from 'lucide-react';
import { getDeadlines, createDeadline, updateDeadline, deleteDeadline, completeDeadline, type Deadline } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import CommentsSection from '../components/CommentsSection';
import BusinessFilter from '../components/BusinessFilter';
import { format, isBefore, isAfter, addDays } from 'date-fns';

const deadlineTypes = [
  { value: 'all', label: 'All', icon: '📋' },
  { value: 'filing', label: 'Filing', icon: '📄' },
  { value: 'renewal', label: 'Renewal', icon: '🔄' },
  { value: 'payment', label: 'Payment', icon: '💰' },
  { value: 'report', label: 'Report', icon: '📊' },
  { value: 'meeting', label: 'Meeting', icon: '👥' },
  { value: 'other', label: 'Other', icon: '📎' },
];

export default function Deadlines() {
  const { canEdit } = useAuth();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [businessFilter, setBusinessFilter] = useState<number[] | 'all' | 'none'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);
  const [selectedDeadline, setSelectedDeadline] = useState<Deadline | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    deadline_type: 'other',
    due_date: '',
    reminder_days: 7,
    is_recurring: false,
    recurrence_months: 12
  });

  const loadDeadlines = async () => {
    const businessesParam = businessFilter === 'all'
      ? undefined
      : businessFilter === 'none'
        ? undefined
        : businessFilter.join(',');

    const data = await getDeadlines({
      deadlineType: selectedType === 'all' ? undefined : selectedType,
      includeCompleted: showCompleted,
      businesses: businessesParam,
      unassigned_only: businessFilter === 'none'
    });
    setDeadlines(data);
    setLoading(false);
  };

  useEffect(() => {
    loadDeadlines();
  }, [selectedType, showCompleted, businessFilter]);

  const filteredDeadlines = deadlines.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      due_date: new Date(formData.due_date).toISOString(),
      recurrence_months: formData.is_recurring ? formData.recurrence_months : null
    };

    if (editingDeadline) {
      await updateDeadline(editingDeadline.id, payload);
    } else {
      await createDeadline(payload);
    }
    setShowModal(false);
    setEditingDeadline(null);
    setFormData({ title: '', description: '', deadline_type: 'other', due_date: '', reminder_days: 7, is_recurring: false, recurrence_months: 12 });
    loadDeadlines();
  };

  const handleEdit = (deadline: Deadline) => {
    setEditingDeadline(deadline);
    setFormData({
      title: deadline.title,
      description: deadline.description || '',
      deadline_type: deadline.deadline_type,
      due_date: deadline.due_date.split('T')[0],
      reminder_days: deadline.reminder_days,
      is_recurring: deadline.is_recurring,
      recurrence_months: deadline.recurrence_months || 12
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this deadline?')) {
      await deleteDeadline(id);
      loadDeadlines();
    }
  };

  const handleComplete = async (id: number) => {
    await completeDeadline(id);
    loadDeadlines();
  };

  const getTypeIcon = (type: string) => {
    return deadlineTypes.find(t => t.value === type)?.icon || '📎';
  };

  const isOverdue = (date: string) => isBefore(new Date(date), new Date());
  const isSoon = (date: string) => isAfter(new Date(date), new Date()) && isBefore(new Date(date), addDays(new Date(), 7));

  // Group deadlines
  const overdueDeadlines = filteredDeadlines.filter(d => !d.is_completed && isOverdue(d.due_date));
  const upcomingDeadlines = filteredDeadlines.filter(d => !d.is_completed && !isOverdue(d.due_date));
  const completedDeadlines = filteredDeadlines.filter(d => d.is_completed);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Deadlines</h1>
          <p className="text-gray-400 mt-1">Track important dates and renewals</p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setEditingDeadline(null); setFormData({ title: '', description: '', deadline_type: 'other', due_date: '', reminder_days: 7, is_recurring: false, recurrence_months: 12 }); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" />
            Add Deadline
          </button>
        )}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search deadlines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#1a1d24] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <BusinessFilter
          value={businessFilter}
          onChange={setBusinessFilter}
          showNoBusiness
        />
        <div className="flex gap-2 overflow-x-auto pb-2">
          {deadlineTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setSelectedType(type.value)}
              className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap transition ${
                selectedType === type.value
                  ? 'bg-[#1a1d24]/10 text-white'
                  : 'text-gray-400 hover:bg-[#1a1d24]/5'
              }`}
            >
              <span className="mr-1">{type.icon}</span>
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Show Completed Toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="showCompleted"
          checked={showCompleted}
          onChange={(e) => setShowCompleted(e.target.checked)}
          className="rounded bg-[#1a1d24]/5 border-white/20"
        />
        <label htmlFor="showCompleted" className="text-sm text-gray-400">Show completed</label>
      </div>

      {/* Deadlines List */}
      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : filteredDeadlines.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No deadlines found</p>
          {canEdit && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 text-cyan-400 hover:text-cyan-300"
            >
              Add your first deadline
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue */}
          {overdueDeadlines.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-red-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Overdue ({overdueDeadlines.length})
              </h2>
              <div className="space-y-2">
                {overdueDeadlines.map((deadline) => (
                  <DeadlineCard
                    key={deadline.id}
                    deadline={deadline}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onComplete={handleComplete}
                    onSelect={setSelectedDeadline}
                    getTypeIcon={getTypeIcon}
                    status="overdue"
                    canEdit={canEdit}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {upcomingDeadlines.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-3">
                Upcoming ({upcomingDeadlines.length})
              </h2>
              <div className="space-y-2">
                {upcomingDeadlines.map((deadline) => (
                  <DeadlineCard
                    key={deadline.id}
                    deadline={deadline}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onComplete={handleComplete}
                    onSelect={setSelectedDeadline}
                    getTypeIcon={getTypeIcon}
                    status={isSoon(deadline.due_date) ? 'soon' : 'normal'}
                    canEdit={canEdit}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {showCompleted && completedDeadlines.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-500 mb-3">
                Completed ({completedDeadlines.length})
              </h2>
              <div className="space-y-2">
                {completedDeadlines.map((deadline) => (
                  <DeadlineCard
                    key={deadline.id}
                    deadline={deadline}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onComplete={handleComplete}
                    onSelect={setSelectedDeadline}
                    getTypeIcon={getTypeIcon}
                    status="completed"
                    canEdit={canEdit}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                {editingDeadline ? 'Edit Deadline' : 'Add Deadline'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Annual Report Filing"
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Type</label>
                  <select
                    value={formData.deadline_type}
                    onChange={(e) => setFormData({ ...formData, deadline_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    {deadlineTypes.slice(1).map((type) => (
                      <option key={type.value} value={type.value} className="bg-[#1a1d24] text-white">{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Remind me (days before)</label>
                <input
                  type="number"
                  min="1"
                  value={formData.reminder_days}
                  onChange={(e) => setFormData({ ...formData, reminder_days: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_recurring}
                    onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                    className="rounded bg-[#1a1d24]/5 border-white/20"
                  />
                  <span className="text-sm text-gray-400">Recurring</span>
                </label>
                {formData.is_recurring && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Every</span>
                    <input
                      type="number"
                      min="1"
                      value={formData.recurrence_months}
                      onChange={(e) => setFormData({ ...formData, recurrence_months: parseInt(e.target.value) })}
                      className="w-16 px-2 py-1 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 text-sm"
                    />
                    <span className="text-sm text-gray-400">months</span>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
                >
                  {editingDeadline ? 'Save' : 'Add Deadline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal with Comments */}
      {selectedDeadline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1a1d24] rounded-2xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getTypeIcon(selectedDeadline.deadline_type)}</span>
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedDeadline.title}</h2>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span>{format(new Date(selectedDeadline.due_date), 'MMMM d, yyyy')}</span>
                    <span className="capitalize px-2 py-0.5 bg-[#1a1d24]/10 rounded text-xs">
                      {selectedDeadline.deadline_type}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedDeadline(null)}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a1d24]/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedDeadline.description && (
                <div className="bg-[#1a1d24]/5 rounded-lg p-3 border border-white/10">
                  <h3 className="text-sm font-medium text-gray-400 mb-1">Description</h3>
                  <p className="text-white">{selectedDeadline.description}</p>
                </div>
              )}

              {selectedDeadline.is_recurring && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <RefreshCw className="w-4 h-4" />
                  <span>Recurring every {selectedDeadline.recurrence_months} month(s)</span>
                </div>
              )}

              {/* Comments Section */}
              <CommentsSection
                entityType="deadline"
                entityId={selectedDeadline.id}
                maxHeight="300px"
              />
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 flex justify-end gap-2">
              {canEdit && (
                <button
                  onClick={() => {
                    handleEdit(selectedDeadline);
                    setSelectedDeadline(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#1a1d24]/10 text-white hover:bg-[#1a1d24]/20 transition flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
              )}
              <button
                onClick={() => setSelectedDeadline(null)}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Deadline Card Component
function DeadlineCard({
  deadline,
  onEdit,
  onDelete,
  onComplete,
  onSelect,
  getTypeIcon,
  status,
  canEdit
}: {
  deadline: Deadline;
  onEdit: (d: Deadline) => void;
  onDelete: (id: number) => void;
  onComplete: (id: number) => void;
  onSelect: (d: Deadline) => void;
  getTypeIcon: (type: string) => string;
  status: 'overdue' | 'soon' | 'normal' | 'completed';
  canEdit: boolean;
}) {
  const borderColor = {
    overdue: 'border-red-500/30',
    soon: 'border-amber-500/30',
    normal: 'border-white/10',
    completed: 'border-white/5'
  }[status];

  const bgColor = {
    overdue: 'bg-red-500/5',
    soon: 'bg-amber-500/5',
    normal: 'bg-[#1a1d24]',
    completed: 'bg-[#1a1d24]/[0.02]'
  }[status];

  return (
    <div className={`p-4 rounded-xl border ${borderColor} ${bgColor} ${status === 'completed' ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {!deadline.is_completed && (
            <button
              onClick={() => canEdit && onComplete(deadline.id)}
              disabled={!canEdit}
              className={`w-6 h-6 rounded-full border-2 transition flex items-center justify-center ${
                canEdit
                  ? 'border-gray-600 hover:border-green-500 hover:bg-green-500/20 cursor-pointer'
                  : 'border-gray-700 cursor-not-allowed opacity-50'
              }`}
            >
              <Check className={`w-3 h-3 ${canEdit ? 'text-transparent hover:text-green-500' : 'text-transparent'}`} />
            </button>
          )}
          {deadline.is_completed && (
            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-3 h-3 text-green-500" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">{getTypeIcon(deadline.deadline_type)}</span>
              <span className={`font-medium ${status === 'completed' ? 'text-gray-500 line-through' : 'text-white'}`}>
                {deadline.title}
              </span>
              {deadline.is_recurring && (
                <RefreshCw className="w-3 h-3 text-gray-500" />
              )}
            </div>
            {deadline.description && (
              <p className="text-sm text-gray-500 mt-1">{deadline.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className={`text-sm font-medium ${
              status === 'overdue' ? 'text-red-400' :
              status === 'soon' ? 'text-amber-400' :
              status === 'completed' ? 'text-gray-500' :
              'text-gray-300'
            }`}>
              {format(new Date(deadline.due_date), 'MMM d, yyyy')}
            </div>
            <div className="text-xs text-gray-500 capitalize">{deadline.deadline_type}</div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => onSelect(deadline)}
              className="p-2 rounded-lg text-gray-500 hover:text-cyan-400 hover:bg-[#1a1d24]/10 transition"
              title="View details & comments"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
            {canEdit && (
              <>
                <button
                  onClick={() => onEdit(deadline)}
                  className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-[#1a1d24]/10 transition"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(deadline.id)}
                  className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-[#1a1d24]/10 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
