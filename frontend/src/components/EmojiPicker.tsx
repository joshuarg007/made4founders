/**
 * EmojiPicker - A sophisticated emoji picker for business entities
 *
 * Organized by category with search functionality for selecting
 * the perfect icon for businesses, products, and projects.
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

// Sophisticated business-focused emoji categories
const emojiCategories = {
  popular: {
    icon: '⭐',
    name: 'Popular',
    emojis: ['🚀', '💼', '🏢', '💡', '⚡', '🎯', '💎', '🔥', '✨', '🌟', '📈', '🏆', '🔮', '🧠', '⚙️', '🛡️'],
  },
  business: {
    icon: '💼',
    name: 'Business',
    emojis: ['💼', '🏢', '🏛️', '📈', '📊', '💰', '💵', '🏦', '📋', '📄', '💡', '🎯', '🏆', '🥇', '🎖️', '⭐'],
  },
  tech: {
    icon: '💻',
    name: 'Technology',
    emojis: ['💻', '🖥️', '📱', '⌨️', '🖱️', '🔌', '💾', '💿', '🔧', '⚙️', '🛠️', '🔩', '🔗', '📡', '🛰️', '🤖'],
  },
  ai: {
    icon: '🧠',
    name: 'AI & Data',
    emojis: ['🧠', '🤖', '🔮', '📊', '📉', '📈', '🔬', '🧪', '🧬', '💡', '⚡', '🌐', '🔗', '📱', '💾', '☁️'],
  },
  finance: {
    icon: '💰',
    name: 'Finance',
    emojis: ['💰', '💵', '💴', '💶', '💷', '💳', '💎', '📈', '📉', '📊', '🧾', '💹', '🏦', '🪙', '💸', '🤑'],
  },
  commerce: {
    icon: '🛒',
    name: 'Commerce',
    emojis: ['🛒', '🏪', '🛍️', '🏬', '💎', '👔', '👗', '👟', '👜', '🎁', '📦', '🏷️', '🛎️', '🧾', '📮', '🔖'],
  },
  creative: {
    icon: '🎨',
    name: 'Creative',
    emojis: ['🎨', '🎬', '📸', '📹', '🎵', '🎹', '🎤', '🎧', '✏️', '🖊️', '📐', '🎭', '🖼️', '📖', '📚', '🎞️'],
  },
  marketing: {
    icon: '📢',
    name: 'Marketing',
    emojis: ['📢', '📣', '📰', '🎯', '🎪', '🎨', '🎬', '📸', '📷', '🎥', '📹', '🎙️', '🎧', '📻', '📺', '🗞️'],
  },
  health: {
    icon: '🏥',
    name: 'Health',
    emojis: ['🏥', '💊', '💉', '🩺', '🩹', '🧬', '🔬', '🧪', '⚕️', '🧘', '💪', '🏃', '🚴', '❤️', '🫀', '🧠'],
  },
  food: {
    icon: '🍽️',
    name: 'Food & Drink',
    emojis: ['🍔', '🍕', '🍣', '🍜', '🍲', '🥗', '🍰', '🎂', '☕', '🍷', '🍺', '🧃', '🥤', '🍴', '👨‍🍳', '🍳'],
  },
  travel: {
    icon: '✈️',
    name: 'Travel',
    emojis: ['✈️', '🚀', '🚁', '🚂', '🚗', '🚙', '🚌', '🚢', '⛵', '🛳️', '🏖️', '🏔️', '🗺️', '🧭', '🎒', '🌍'],
  },
  realestate: {
    icon: '🏠',
    name: 'Real Estate',
    emojis: ['🏠', '🏡', '🏘️', '🏗️', '🏚️', '🏛️', '🏰', '🏯', '⛪', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏭'],
  },
  education: {
    icon: '📚',
    name: 'Education',
    emojis: ['📚', '📖', '📝', '✏️', '🎓', '🏫', '🔬', '🔭', '🧮', '📐', '📏', '🗃️', '📰', '🏅', '📜', '🎒'],
  },
  sustainability: {
    icon: '♻️',
    name: 'Sustainability',
    emojis: ['♻️', '🌍', '🌎', '🌏', '🌱', '💧', '☀️', '💨', '⚡', '🔋', '🌊', '🏕️', '🌲', '🐝', '🦋', '🌻'],
  },
  sports: {
    icon: '⚽',
    name: 'Sports',
    emojis: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '🥋', '⛳', '🎿', '🏋️', '🏊'],
  },
  entertainment: {
    icon: '🎮',
    name: 'Entertainment',
    emojis: ['🎮', '🕹️', '🎲', '♠️', '♣️', '🎰', '🎳', '🎪', '🎭', '🎬', '🎤', '🎧', '🎼', '🎹', '🎷', '🎸'],
  },
  symbols: {
    icon: '✨',
    name: 'Symbols',
    emojis: ['⭐', '🌟', '✨', '💫', '🔥', '⚡', '💥', '💢', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💯'],
  },
  animals: {
    icon: '🦁',
    name: 'Animals',
    emojis: ['🦁', '🐯', '🦊', '🐺', '🦅', '🦉', '🐝', '🦋', '🐬', '🦈', '🐙', '🦑', '🦀', '🐢', '🐍', '🐘'],
  },
};

// Flatten all emojis for search
const allEmojis = Object.values(emojiCategories).flatMap(cat => cat.emojis);
const uniqueEmojis = [...new Set(allEmojis)];

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  placeholder?: string;
}

export default function EmojiPicker({ value, onChange, placeholder = '🏢' }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<keyof typeof emojiCategories>('popular');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (emoji: string) => {
    onChange(emoji);
    setIsOpen(false);
    setSearch('');
  };

  // Get emojis to display
  const displayEmojis = search
    ? uniqueEmojis
    : emojiCategories[activeCategory].emojis;

  const categoryKeys = Object.keys(emojiCategories) as (keyof typeof emojiCategories)[];

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1d24]/50 border border-white/10 hover:border-white/20 transition group"
      >
        <span className="text-2xl">{value || placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 group-hover:text-gray-300 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full mt-2 left-0 w-80 bg-[#1a1d24] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search emojis..."
                className="w-full pl-9 pr-8 py-2 text-sm rounded-lg bg-[#12141a] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Category Tabs - Emoji icons instead of text */}
          {!search && (
            <div className="flex items-center gap-1 p-2 border-b border-white/10 overflow-x-auto scrollbar-thin">
              {categoryKeys.map((key) => {
                const cat = emojiCategories[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveCategory(key)}
                    className={`flex-shrink-0 w-8 h-8 rounded-lg text-lg flex items-center justify-center transition ${
                      activeCategory === key
                        ? 'bg-cyan-500/20 border border-cyan-500/30'
                        : 'hover:bg-white/5'
                    }`}
                    title={cat.name}
                  >
                    {cat.icon}
                  </button>
                );
              })}
            </div>
          )}

          {/* Category Label */}
          {!search && (
            <div className="px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
              {emojiCategories[activeCategory].name}
            </div>
          )}

          {/* Emoji Grid */}
          <div className="p-2 max-h-48 overflow-y-auto">
            {displayEmojis.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-6">No emojis found</p>
            ) : (
              <div className="grid grid-cols-8 gap-1">
                {displayEmojis.map((emoji, i) => (
                  <button
                    key={`${emoji}-${i}`}
                    type="button"
                    onClick={() => handleSelect(emoji)}
                    className={`w-8 h-8 flex items-center justify-center text-lg rounded-lg transition ${
                      value === emoji
                        ? 'bg-cyan-500/30 border border-cyan-500/50'
                        : 'hover:bg-white/10'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Input - paste any emoji */}
          <div className="p-2 border-t border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Custom:</span>
              <input
                type="text"
                value={value}
                onChange={(e) => {
                  // Only keep the last character if it's an emoji
                  const input = e.target.value;
                  if (input) {
                    const lastChar = [...input].pop();
                    if (lastChar) onChange(lastChar);
                  }
                }}
                placeholder="Paste emoji"
                className="flex-1 px-2 py-1 text-sm rounded bg-[#12141a] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                maxLength={2}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
