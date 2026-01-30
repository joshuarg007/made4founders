import { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, X, Check } from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';

interface BusinessFilterProps {
  value: number[] | 'all' | 'none';
  onChange: (value: number[] | 'all' | 'none') => void;
  className?: string;
  showNoBusiness?: boolean; // Whether to show "No Business" option
  label?: string;
}

export default function BusinessFilter({
  value,
  onChange,
  className = '',
  showNoBusiness = true,
  label = 'Business',
}: BusinessFilterProps) {
  const { businesses } = useBusiness();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter out archived businesses
  const activeBusinesses = businesses.filter(b => !b.is_archived);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAll = value === 'all';
  const isNone = value === 'none';
  const selectedIds = Array.isArray(value) ? value : [];

  const handleToggleAll = () => {
    onChange('all');
    setIsOpen(false);
  };

  const handleToggleNone = () => {
    onChange('none');
    setIsOpen(false);
  };

  const handleToggleBusiness = (businessId: number) => {
    if (isAll || isNone) {
      // Switching from all/none to specific selection
      onChange([businessId]);
    } else if (selectedIds.includes(businessId)) {
      // Remove this business
      const newIds = selectedIds.filter(id => id !== businessId);
      if (newIds.length === 0) {
        onChange('all'); // Default to all if nothing selected
      } else {
        onChange(newIds);
      }
    } else {
      // Add this business
      onChange([...selectedIds, businessId]);
    }
  };

  const getDisplayText = () => {
    if (isAll) return 'All Businesses';
    if (isNone) return 'No Business';
    if (selectedIds.length === 1) {
      const business = activeBusinesses.find(b => b.id === selectedIds[0]);
      return business ? `${business.emoji || '🏢'} ${business.name}` : 'Select...';
    }
    return `${selectedIds.length} businesses`;
  };

  const getSelectedBusinesses = () => {
    if (!Array.isArray(value)) return [];
    return activeBusinesses.filter(b => value.includes(b.id));
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#1a1d24]/50 border border-white/10 text-white hover:border-white/20 transition text-sm"
      >
        <div className="flex items-center gap-2 truncate">
          <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="truncate">{getDisplayText()}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-[#1a1d24] border border-white/10 rounded-lg shadow-xl overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {/* All option */}
            <button
              type="button"
              onClick={handleToggleAll}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-white/5 transition ${
                isAll ? 'bg-cyan-500/10 text-cyan-400' : 'text-gray-300'
              }`}
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                isAll ? 'bg-cyan-500 border-cyan-500' : 'border-white/20'
              }`}>
                {isAll && <Check className="w-3 h-3 text-white" />}
              </div>
              <span>All Businesses</span>
            </button>

            {/* Divider */}
            <div className="border-t border-white/5 my-1" />

            {/* Business list */}
            {activeBusinesses.map(business => {
              const isSelected = selectedIds.includes(business.id);
              return (
                <button
                  key={business.id}
                  type="button"
                  onClick={() => handleToggleBusiness(business.id)}
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
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: business.color }}
                    />
                  )}
                </button>
              );
            })}

            {/* No Business option */}
            {showNoBusiness && (
              <>
                <div className="border-t border-white/5 my-1" />
                <button
                  type="button"
                  onClick={handleToggleNone}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-white/5 transition ${
                    isNone ? 'bg-gray-500/10 text-gray-400' : 'text-gray-400'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                    isNone ? 'bg-gray-500 border-gray-500' : 'border-white/20'
                  }`}>
                    {isNone && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span>No Business</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Selected Pills (when multiple selected) */}
      {Array.isArray(value) && value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {getSelectedBusinesses().map(business => (
            <span
              key={business.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs"
            >
              {business.emoji && <span>{business.emoji}</span>}
              {business.name}
              <button
                type="button"
                onClick={() => handleToggleBusiness(business.id)}
                className="hover:text-white transition"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
