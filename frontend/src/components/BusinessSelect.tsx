import { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, X, Check, Plus } from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { createBusiness } from '../lib/api';

interface BusinessSelectProps {
  value: number | null;
  onChange: (value: number | null) => void;
  className?: string;
  label?: string;
  showLabel?: boolean;
}

const EMOJI_OPTIONS = ['🏢', '🚀', '💼', '🎯', '⚡', '🌟', '💡', '🔥', '📈', '🛠️', '🎨', '🌐'];
const COLOR_OPTIONS = ['#06b6d4', '#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#3b82f6', '#eab308', '#ef4444'];

export default function BusinessSelect({
  value,
  onChange,
  className = '',
  label = 'Business',
  showLabel = true,
}: BusinessSelectProps) {
  const { businesses, refreshBusinesses } = useBusiness();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newBusiness, setNewBusiness] = useState({
    name: '',
    emoji: '🏢',
    color: '#06b6d4',
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeBusinesses = businesses.filter(b => !b.is_archived);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectBusiness = (businessId: number | null) => {
    onChange(businessId);
    setIsOpen(false);
  };

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBusiness.name.trim()) return;

    setCreating(true);
    try {
      const created = await createBusiness({
        name: newBusiness.name,
        emoji: newBusiness.emoji,
        color: newBusiness.color,
      });
      await refreshBusinesses();
      onChange(created.id);
      setShowCreateModal(false);
      setIsOpen(false);
      setNewBusiness({ name: '', emoji: '🏢', color: '#06b6d4' });
    } catch (err) {
      console.error('Failed to create business:', err);
      alert('Failed to create business');
    } finally {
      setCreating(false);
    }
  };

  const getDisplayText = () => {
    if (value === null) return 'No business (org-level)';
    const business = activeBusinesses.find(b => b.id === value);
    return business ? `${business.emoji || '🏢'} ${business.name}` : 'Select business...';
  };

  const getAccentColor = () => {
    if (value !== null) {
      const business = activeBusinesses.find(b => b.id === value);
      return business?.color || null;
    }
    return null;
  };

  const accentColor = getAccentColor();

  return (
    <>
      <div className={`relative ${className}`} ref={dropdownRef}>
        {showLabel && <label className="block text-sm text-gray-400 mb-1">{label}</label>}

        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#1a1d24]/50 border text-white hover:border-white/20 transition text-sm"
          style={{
            borderColor: accentColor ? `${accentColor}50` : 'rgba(255,255,255,0.1)',
            borderLeftWidth: accentColor ? '3px' : '1px',
            borderLeftColor: accentColor || 'rgba(255,255,255,0.1)',
          }}
        >
          <div className="flex items-center gap-2 truncate">
            {accentColor ? (
              <div className="w-4 h-4 rounded flex-shrink-0" style={{ backgroundColor: accentColor }} />
            ) : (
              <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
            <span className="truncate">{getDisplayText()}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-[60] mt-1 w-full min-w-[200px] bg-[#1a1d24] border border-white/10 rounded-lg shadow-xl overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              {/* New Business option - at top for visibility */}
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(true);
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-cyan-400 hover:bg-cyan-500/10 transition"
              >
                <div className="w-4 h-4 rounded border border-cyan-500 flex items-center justify-center">
                  <Plus className="w-3 h-3" />
                </div>
                <span>+ New Business</span>
              </button>

              <div className="border-t border-white/5 my-1" />

              {/* No Business option */}
              <button
                type="button"
                onClick={() => handleSelectBusiness(null)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-white/5 transition ${
                  value === null ? 'bg-gray-500/10 text-gray-400' : 'text-gray-400'
                }`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                  value === null ? 'bg-gray-500 border-gray-500' : 'border-white/20'
                }`}>
                  {value === null && <Check className="w-3 h-3 text-white" />}
                </div>
                <span>No business (org-level)</span>
              </button>

              {/* Divider */}
              {activeBusinesses.length > 0 && <div className="border-t border-white/5 my-1" />}

              {/* Business list */}
              {activeBusinesses.map(business => {
                const isSelected = value === business.id;
                return (
                  <button
                    key={business.id}
                    type="button"
                    onClick={() => handleSelectBusiness(business.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-white/5 transition ${
                      isSelected ? 'bg-cyan-500/10 text-cyan-400' : 'text-gray-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isSelected ? 'bg-cyan-500 border-cyan-500' : 'border-white/20'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="flex items-center gap-2 truncate">
                      {business.emoji && <span>{business.emoji}</span>}
                      <span className="truncate">{business.name}</span>
                    </span>
                    {business.color && (
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0 ml-auto"
                        style={{ backgroundColor: business.color }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Create Business Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Create New Business</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateBusiness} className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Business Name *</label>
                <input
                  type="text"
                  required
                  value={newBusiness.name}
                  onChange={(e) => setNewBusiness({ ...newBusiness, name: e.target.value })}
                  placeholder="My Awesome Business"
                  className="w-full px-3 py-2 rounded-lg bg-[#12141a] border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Emoji</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewBusiness({ ...newBusiness, emoji })}
                      className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition ${
                        newBusiness.emoji === emoji
                          ? 'bg-cyan-500/20 ring-2 ring-cyan-500'
                          : 'bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewBusiness({ ...newBusiness, color })}
                      className={`w-8 h-8 rounded-full transition ${
                        newBusiness.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1a1d24]' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newBusiness.name.trim()}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Business'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
