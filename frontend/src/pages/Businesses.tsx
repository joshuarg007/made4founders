import { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Archive,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Flame,
  X,
  Check,
  AlertTriangle,
  RotateCcw,
  Star,
} from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import EmojiPicker from '../components/EmojiPicker';
import type { Business } from '../lib/api';

interface BusinessNode extends Business {
  children?: BusinessNode[];
}

const BUSINESS_TYPES = [
  { value: 'corporation', label: 'Corporation' },
  { value: 'llc', label: 'LLC' },
  { value: 'product', label: 'Product' },
  { value: 'service', label: 'Service' },
  { value: 'project', label: 'Project' },
  { value: 'department', label: 'Department' },
  { value: 'brand', label: 'Brand' },
  { value: 'other', label: 'Other' },
];


const COLORS = [
  '#FF6B35', '#F7931E', '#FFD700', '#7CB342', '#00BCD4',
  '#2196F3', '#673AB7', '#E91E63', '#795548', '#607D8B',
];

const getLevelTitle = (level: number): string => {
  const titles: Record<number, string> = {
    1: 'Dreamer', 2: 'Builder', 3: 'Launcher', 4: 'Scaler',
    5: 'Unicorn Hunter', 6: 'Industry Leader', 7: 'Market Maker',
  };
  return titles[level] || 'Legend';
};

export default function Businesses() {
  const { businesses, refreshBusinesses, currentBusiness, switchBusiness } = useBusiness();
  const [showModal, setShowModal] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<Business | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    business_type: 'corporation',
    description: '',
    color: COLORS[0],
    emoji: '🚀',
    parent_id: null as number | null,
    gamification_enabled: true,
  });

  useEffect(() => {
    if (editingBusiness) {
      setFormData({
        name: editingBusiness.name,
        business_type: editingBusiness.business_type,
        description: editingBusiness.description || '',
        color: editingBusiness.color || COLORS[0],
        emoji: editingBusiness.emoji || '🚀',
        parent_id: editingBusiness.parent_id,
        gamification_enabled: editingBusiness.gamification_enabled,
      });
    } else {
      setFormData({
        name: '',
        business_type: 'corporation',
        description: '',
        color: COLORS[0],
        emoji: '🚀',
        parent_id: null,
        gamification_enabled: true,
      });
    }
  }, [editingBusiness]);

  const toggleExpanded = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = editingBusiness
        ? `/api/businesses/${editingBusiness.id}`
        : '/api/businesses';
      const method = editingBusiness ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save business');

      await refreshBusinesses();
      setShowModal(false);
      setEditingBusiness(null);
    } catch (err) {
      console.error('Failed to save business:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (business: BusinessNode) => {
    setDeleteTarget(business);
    setDeleteConfirmText('');
    setDeleteAcknowledged(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleteConfirmText !== deleteTarget.name || !deleteAcknowledged) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/businesses/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to delete business');

      await refreshBusinesses();
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete business:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (business: Business) => {
    try {
      const response = await fetch(`/api/businesses/${business.id}/restore`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to restore business');
      await refreshBusinesses();
    } catch (err) {
      console.error('Failed to restore business:', err);
    }
  };

  const handleArchiveToggle = async (business: Business) => {
    try {
      const response = await fetch(`/api/businesses/${business.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_archived: !business.is_archived }),
      });

      if (!response.ok) throw new Error('Failed to update business');

      await refreshBusinesses();
    } catch (err) {
      console.error('Failed to archive business:', err);
    }
  };

  const renderBusinessRow = (business: BusinessNode, depth = 0) => {
    const hasChildren = business.children && business.children.length > 0;
    const isExpanded = expandedIds.has(business.id);

    return (
      <div key={business.id}>
        <div
          className={`flex items-center gap-3 p-4 border-b border-white/5 hover:bg-[#1a1d24]/5 transition ${
            business.is_archived ? 'opacity-50' : ''
          }`}
          style={{ paddingLeft: `${16 + depth * 24}px` }}
        >
          {/* Expand/collapse */}
          <button
            onClick={() => hasChildren && toggleExpanded(business.id)}
            className={`w-5 h-5 flex items-center justify-center ${hasChildren ? 'cursor-pointer' : 'invisible'}`}
          >
            {hasChildren && (isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />)}
          </button>

          {/* Color bar */}
          {business.color && (
            <div className="w-1 h-8 rounded-full" style={{ backgroundColor: business.color }} />
          )}

          {/* Emoji & Name */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xl">{business.emoji || '🏢'}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white truncate">{business.name}</span>
                {currentBusiness?.id === business.id && (
                  <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" /> Default
                  </span>
                )}
                {business.is_archived && (
                  <span className="px-1.5 py-0.5 text-xs bg-white/50/20 text-gray-400 rounded">Archived</span>
                )}
              </div>
              <div className="text-xs text-gray-500 capitalize">{business.business_type}</div>
            </div>
          </div>

          {/* Level & XP */}
          {business.gamification_enabled && (
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1 text-violet-400">
                <Sparkles className="w-4 h-4" />
                <span>Lvl {business.level}</span>
                <span className="text-gray-500 text-xs">({getLevelTitle(business.level)})</span>
              </div>
              {business.current_streak > 0 && (
                <div className="flex items-center gap-1 text-orange-400">
                  <Flame className="w-4 h-4" />
                  <span>{business.current_streak}d</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1">
            {!business.is_archived && currentBusiness?.id !== business.id && (
              <button
                onClick={() => switchBusiness(business.id)}
                className="p-2 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition"
                title="Set as Default"
              >
                <Star className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => {
                setEditingBusiness(business);
                setShowModal(true);
              }}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1d24]/10 rounded-lg transition"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleArchiveToggle(business)}
              className="p-2 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition"
              title={business.is_archived ? 'Unarchive' : 'Archive'}
            >
              <Archive className="w-4 h-4" />
            </button>
            {business.is_archived ? (
              <button
                onClick={() => handleRestore(business)}
                className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition"
                title="Restore"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            ) : null}
            <button
              onClick={() => handleDeleteClick(business)}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
              title={business.is_archived ? "Permanently Delete" : "Delete"}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {business.children!.map(child => renderBusinessRow(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Build tree structure
  const buildTree = (items: Business[]): BusinessNode[] => {
    const map = new Map<number, BusinessNode>();
    const roots: BusinessNode[] = [];

    items.forEach(item => map.set(item.id, { ...item, children: [] }));

    items.forEach(item => {
      const node = map.get(item.id)!;
      if (item.parent_id && map.has(item.parent_id)) {
        map.get(item.parent_id)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const tree = buildTree(businesses);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Building2 className="w-7 h-7 text-blue-400" />
            Businesses
          </h1>
          <p className="text-gray-400 mt-1">Manage your businesses, products, and projects</p>
        </div>
        <button
          onClick={() => {
            setEditingBusiness(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:opacity-90 transition font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Business
        </button>
      </div>

      {/* Business List */}
      <div className="rounded-xl bg-[#1a1d24] border border-white/10 overflow-hidden">
        {tree.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No businesses yet. Create your first one!</p>
          </div>
        ) : (
          tree.map(business => renderBusinessRow(business))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] rounded-2xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">
                {editingBusiness ? 'Edit Business' : 'New Business'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingBusiness(null);
                }}
                className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1d24]/10 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Business Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
                  placeholder="My Awesome Business"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Business Type</label>
                <select
                  value={formData.business_type}
                  onChange={e => setFormData({ ...formData, business_type: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
                >
                  {BUSINESS_TYPES.map(type => (
                    <option key={type.value} value={type.value} className="bg-gray-800 text-white">{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition resize-none"
                  placeholder="What does this business do?"
                />
              </div>

              {/* Parent Business */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Parent Business (optional)</label>
                <select
                  value={formData.parent_id || ''}
                  onChange={e => setFormData({ ...formData, parent_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-4 py-3 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
                >
                  <option value="" className="bg-gray-800 text-white">None (Top-level)</option>
                  {businesses
                    .filter(b => b.id !== editingBusiness?.id)
                    .map(b => (
                      <option key={b.id} value={b.id} className="bg-gray-800 text-white">{b.emoji} {b.name}</option>
                    ))}
                </select>
              </div>

              {/* Emoji */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Icon</label>
                <EmojiPicker
                  value={formData.emoji}
                  onChange={(emoji) => setFormData({ ...formData, emoji })}
                  placeholder="🏢"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-10 h-10 rounded-lg border-2 transition ${
                        formData.color === color
                          ? 'border-white scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Gamification Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-[#1a1d24]/5 border border-white/10">
                <div>
                  <div className="text-white font-medium">Gamification</div>
                  <div className="text-sm text-gray-400">Track XP, levels, and streaks</div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gamification_enabled: !formData.gamification_enabled })}
                  className={`w-12 h-7 rounded-full transition-colors relative ${
                    formData.gamification_enabled ? 'bg-cyan-500' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-5 h-5 bg-[#1a1d24] rounded-full transition-transform ${
                      formData.gamification_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingBusiness(null);
                  }}
                  className="flex-1 px-4 py-3 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-[#1a1d24]/5 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    'Saving...'
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {editingBusiness ? 'Save Changes' : 'Create Business'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal with Legal Warning */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] rounded-2xl border border-red-500/30 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 p-6 border-b border-red-500/20 bg-red-500/5">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Permanently Delete Business</h2>
                <p className="text-sm text-red-400">This action cannot be undone</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-gray-300">
                You are about to permanently delete <strong className="text-white">"{deleteTarget.name}"</strong> and
                ALL associated business-specific data including:
              </p>

              <ul className="text-sm text-gray-400 space-y-1 pl-4">
                <li>• Cap table and shareholder records</li>
                <li>• Investor updates and data room files</li>
                <li>• Financial records and invoices</li>
                <li>• Business checklist progress</li>
                <li>• Web presence and SEO settings</li>
                <li>• Brand identity assets</li>
                <li>• All business associations with contacts, documents, etc.</li>
              </ul>

              {/* Legal Warning */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mt-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-amber-400 mb-2">Legal Notice</h4>
                    <p className="text-sm text-amber-200/80 leading-relaxed">
                      Many jurisdictions require businesses to retain financial records, tax documents,
                      and corporate records for <strong>3-7+ years</strong>. Deleting this data may:
                    </p>
                    <ul className="text-sm text-amber-200/80 mt-2 space-y-1">
                      <li>• Violate tax record retention requirements</li>
                      <li>• Compromise your ability to respond to audits</li>
                      <li>• Destroy evidence needed for legal proceedings</li>
                      <li>• Impact your liability protections</li>
                    </ul>
                    <p className="text-sm text-amber-300 mt-3 font-medium">
                      We strongly recommend ARCHIVING instead of deleting.
                    </p>
                  </div>
                </div>
              </div>

              {/* Confirmation Input */}
              <div className="mt-6">
                <label className="block text-sm text-gray-400 mb-2">
                  Type <strong className="text-white">"{deleteTarget.name}"</strong> to confirm deletion:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-red-500/50 transition"
                  placeholder={deleteTarget.name}
                />
              </div>

              {/* Acknowledgment Checkbox */}
              <label className="flex items-start gap-3 cursor-pointer mt-4">
                <input
                  type="checkbox"
                  checked={deleteAcknowledged}
                  onChange={e => setDeleteAcknowledged(e.target.checked)}
                  className="mt-1 rounded border-white/20 bg-[#1a1d24]/5 text-red-500 focus:ring-red-500/50"
                />
                <span className="text-sm text-gray-300">
                  I understand the legal implications and accept full responsibility for permanently
                  deleting this business and all associated data.
                </span>
              </label>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteConfirmText('');
                    setDeleteAcknowledged(false);
                  }}
                  className="flex-1 px-4 py-3 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-[#1a1d24]/5 transition font-medium"
                >
                  Cancel
                </button>
                {!deleteTarget.is_archived && (
                  <button
                    onClick={() => {
                      handleArchiveToggle(deleteTarget);
                      setDeleteTarget(null);
                    }}
                    className="flex-1 px-4 py-3 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 transition font-medium flex items-center justify-center gap-2"
                  >
                    <Archive className="w-4 h-4" />
                    Archive Instead
                  </button>
                )}
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteConfirmText !== deleteTarget.name || !deleteAcknowledged || deleting}
                  className="flex-1 px-4 py-3 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
