import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Building2, Plus, Check, Flame, Trophy, ChevronRight } from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import type { BusinessWithChildren } from '../lib/api';

// Level titles based on XP progression
const LEVEL_TITLES: Record<number, string> = {
  1: 'Dreamer',
  2: 'Builder',
  3: 'Launcher',
  4: 'Scaler',
  5: 'Unicorn Hunter',
  6: 'Industry Leader',
  7: 'Market Maker',
  8: 'Legend',
};

function getLevelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level, 8)] || 'Legend';
}

// XP required for next level (scaling formula)
function xpForLevel(level: number): number {
  return Math.floor(500 * Math.pow(level, 1.5));
}

interface BusinessTreeItemProps {
  business: BusinessWithChildren;
  depth: number;
  currentBusinessId: number | null;
  onSelect: (id: number) => void;
}

function BusinessTreeItem({ business, depth, currentBusinessId, onSelect }: BusinessTreeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = business.children && business.children.length > 0;
  const isSelected = business.id === currentBusinessId;

  return (
    <div>
      <button
        onClick={() => onSelect(business.id)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition text-left ${
          isSelected
            ? 'bg-cyan-500/20 text-cyan-400'
            : 'hover:bg-white/5 text-gray-300'
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-0.5 hover:bg-white/10 rounded"
          >
            <ChevronRight
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </button>
        )}
        {!hasChildren && <span className="w-4" />}

        {/* Emoji or default icon */}
        <span className="text-lg">{business.emoji || '📦'}</span>

        {/* Name and level */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{business.name}</span>
            {isSelected && <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Lvl {business.level}</span>
            {business.current_streak > 0 && (
              <span className="flex items-center gap-0.5 text-orange-400">
                <Flame className="w-3 h-3" />
                {business.current_streak}
              </span>
            )}
          </div>
        </div>

        {/* Color indicator */}
        {business.color && (
          <div
            className="w-2 h-8 rounded-full flex-shrink-0"
            style={{ backgroundColor: business.color }}
          />
        )}
      </button>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {business.children.map((child) => (
            <BusinessTreeItem
              key={child.id}
              business={child}
              depth={depth + 1}
              currentBusinessId={currentBusinessId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function BusinessSwitcher() {
  const { currentBusiness, businessTree, isOrgWide, switchBusiness, isLoading } = useBusiness();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (businessId: number | null) => {
    await switchBusiness(businessId);
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 animate-pulse">
        <div className="w-6 h-6 rounded bg-white/10" />
        <div className="w-24 h-4 rounded bg-white/10" />
      </div>
    );
  }

  // Calculate XP progress for current business
  const currentXP = currentBusiness?.xp || 0;
  const currentLevel = currentBusiness?.level || 1;
  const xpNeeded = xpForLevel(currentLevel);
  const prevLevelXP = currentLevel > 1 ? xpForLevel(currentLevel - 1) : 0;
  const progressPercent = Math.min(100, ((currentXP - prevLevelXP) / (xpNeeded - prevLevelXP)) * 100);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition border border-white/10"
      >
        {/* Icon/Emoji */}
        <span className="text-xl">
          {isOrgWide ? '🏛️' : currentBusiness?.emoji || '📦'}
        </span>

        {/* Business info */}
        <div className="text-left min-w-0">
          <div className="font-medium text-white truncate max-w-[140px]">
            {isOrgWide ? 'All Businesses' : currentBusiness?.name}
          </div>
          {currentBusiness && !isOrgWide && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">
                Lvl {currentLevel} {getLevelTitle(currentLevel)}
              </span>
              {currentBusiness.current_streak > 0 && (
                <span className="flex items-center gap-0.5 text-orange-400">
                  <Flame className="w-3 h-3" />
                  {currentBusiness.current_streak}
                </span>
              )}
            </div>
          )}
        </div>

        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* XP Progress Bar (shown when business selected) */}
      {currentBusiness && !isOrgWide && (
        <div className="absolute -bottom-1 left-3 right-3 h-0.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-[#1a1d24] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10 bg-white/5">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Switch Business
            </div>
          </div>

          {/* Org-Wide Option */}
          <div className="p-2">
            <button
              onClick={() => handleSelect(null)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                isOrgWide
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'hover:bg-white/5 text-gray-300'
              }`}
            >
              <Building2 className="w-5 h-5" />
              <span className="font-medium">All Businesses (Org-Wide)</span>
              {isOrgWide && <Check className="w-4 h-4 ml-auto" />}
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10" />

          {/* Business Tree */}
          <div className="p-2 max-h-80 overflow-y-auto">
            {businessTree.length === 0 ? (
              <div className="px-3 py-4 text-center text-gray-500 text-sm">
                No businesses yet
              </div>
            ) : (
              businessTree.map((business) => (
                <BusinessTreeItem
                  key={business.id}
                  business={business}
                  depth={0}
                  currentBusinessId={currentBusiness?.id || null}
                  onSelect={handleSelect}
                />
              ))
            )}
          </div>

          {/* Add Business */}
          <div className="border-t border-white/10 p-2">
            <button
              onClick={() => {
                setIsOpen(false);
                // TODO: Open create business modal
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add New Business</span>
            </button>
          </div>

          {/* Gamification Stats (if business selected) */}
          {currentBusiness && !isOrgWide && (
            <>
              <div className="border-t border-white/10" />
              <div className="px-4 py-3 bg-gradient-to-r from-cyan-500/5 to-violet-500/5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="text-gray-400">
                      {currentBusiness.xp.toLocaleString()} XP
                    </span>
                  </div>
                  <div className="text-gray-500">
                    {(xpNeeded - currentXP).toLocaleString()} to next level
                  </div>
                </div>
                <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
