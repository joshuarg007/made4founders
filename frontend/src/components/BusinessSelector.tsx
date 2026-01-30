import { Building2, Check, Info } from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';

interface BusinessSelectorProps {
  value: number[];
  onChange: (value: number[]) => void;
  required?: boolean; // If true, at least one business must be selected
  label?: string;
  helpText?: string;
  className?: string;
}

export default function BusinessSelector({
  value,
  onChange,
  required = false,
  label = 'Businesses',
  helpText,
  className = '',
}: BusinessSelectorProps) {
  const { businesses } = useBusiness();

  // Filter out archived businesses
  const activeBusinesses = businesses.filter(b => !b.is_archived);

  const handleToggle = (businessId: number) => {
    if (value.includes(businessId)) {
      // Don't allow removing if required and this is the last one
      if (required && value.length === 1) return;
      onChange(value.filter(id => id !== businessId));
    } else {
      onChange([...value, businessId]);
    }
  };

  const handleSelectAll = () => {
    onChange(activeBusinesses.map(b => b.id));
  };

  const handleClearAll = () => {
    if (!required) {
      onChange([]);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm text-gray-400">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-xs text-cyan-400 hover:text-cyan-300 transition"
          >
            Select all
          </button>
          {!required && (
            <>
              <span className="text-gray-600">|</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs text-gray-400 hover:text-gray-300 transition"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Business List */}
      <div className="space-y-1 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-[#1a1d24]/30 p-2">
        {activeBusinesses.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">
            <Building2 className="w-5 h-5 mx-auto mb-1 opacity-50" />
            No businesses created yet
          </div>
        ) : (
          activeBusinesses.map(business => {
            const isSelected = value.includes(business.id);
            return (
              <label
                key={business.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition ${
                  isSelected
                    ? 'bg-cyan-500/10 border border-cyan-500/30'
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(business.id)}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                    isSelected
                      ? 'bg-cyan-500 border-cyan-500'
                      : 'border-white/20 hover:border-white/40'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {business.emoji && <span className="text-lg">{business.emoji}</span>}
                  <span className={`truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                    {business.name}
                  </span>
                </div>
                {business.color && (
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: business.color }}
                  />
                )}
              </label>
            );
          })
        )}
      </div>

      {/* Help Text */}
      {helpText && (
        <p className="flex items-start gap-1.5 mt-2 text-xs text-gray-500">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          {helpText}
        </p>
      )}

      {/* No Business Info */}
      {!required && value.length === 0 && (
        <p className="mt-2 text-xs text-gray-500 italic">
          No business selected - this item will appear under "No Business" filter
        </p>
      )}
    </div>
  );
}
