import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

// Common emoji categories for business apps
const emojiCategories = {
  'Recent': ['📦', '🔧', '💼', '📊', '🎯', '🚀', '💡', '⭐'],
  'Business': ['💼', '📊', '📈', '📉', '💰', '💵', '💳', '🏦', '🏢', '🏛️', '📋', '📝', '✍️', '📄', '📑'],
  'Tech': ['💻', '🖥️', '📱', '⌨️', '🖱️', '💾', '🔌', '🔋', '📡', '🛰️', '🤖', '⚙️', '🔧', '🔩', '🧰'],
  'Cloud & Dev': ['☁️', '🌐', '🔗', '🔐', '🔑', '🛡️', '🔒', '🔓', '🧪', '🧬', '⚡', '🚀', '📦', '📂', '📁'],
  'Communication': ['📧', '📨', '📩', '✉️', '📬', '📭', '📮', '💬', '💭', '🗨️', '📞', '📱', '📲', '☎️', '📠'],
  'Marketing': ['📢', '📣', '📰', '🎯', '🎪', '🎨', '🎬', '📸', '📷', '🎥', '📹', '🎙️', '🎧', '📻', '📺'],
  'Finance': ['💰', '💵', '💴', '💶', '💷', '💳', '💎', '📈', '📉', '📊', '🧾', '💹', '🏦', '🪙', '💸'],
  'People': ['👤', '👥', '🧑‍💼', '👨‍💼', '👩‍💼', '🧑‍💻', '👨‍💻', '👩‍💻', '🤝', '👋', '✋', '🙋', '🙌', '👏', '🎉'],
  'Objects': ['📦', '📮', '📪', '📫', '📬', '📭', '🗳️', '✏️', '📌', '📍', '📎', '🖇️', '📏', '📐', '✂️'],
  'Symbols': ['✅', '❌', '⭕', '❗', '❓', '💯', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤'],
  'Nature': ['🌱', '🌿', '🍀', '🌳', '🌲', '🌴', '🌵', '🌸', '🌺', '🌻', '🌼', '🌷', '🌹', '🥀', '💐'],
  'Food': ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅'],
};

// Flatten all emojis for search
const allEmojis = Object.values(emojiCategories).flat();

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  placeholder?: string;
}

export default function EmojiPicker({ value, onChange, placeholder = '📦' }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Recent');
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleSelect = (emoji: string) => {
    onChange(emoji);
    setIsOpen(false);
    setSearch('');
  };

  // Get emojis to display
  const displayEmojis = search
    ? allEmojis.filter(e => e.includes(search))
    : emojiCategories[activeCategory as keyof typeof emojiCategories] || [];

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 flex items-center justify-between gap-2 hover:bg-[#1a1d24]/10 transition"
      >
        <span className="text-xl">{value || placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full mt-1 left-0 w-72 bg-[#1a1d24] border border-white/10 rounded-lg shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search emoji..."
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                autoFocus
              />
            </div>
          </div>

          {/* Category Tabs (only show when not searching) */}
          {!search && (
            <div className="flex gap-1 p-2 border-b border-white/10 overflow-x-auto">
              {Object.keys(emojiCategories).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2 py-1 text-xs rounded whitespace-nowrap transition ${
                    activeCategory === cat
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-gray-400 hover:bg-[#1a1d24]/5'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Emoji Grid */}
          <div className="p-2 max-h-48 overflow-y-auto">
            {displayEmojis.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-4">No emojis found</p>
            ) : (
              <div className="grid grid-cols-8 gap-1">
                {displayEmojis.map((emoji, i) => (
                  <button
                    key={`${emoji}-${i}`}
                    type="button"
                    onClick={() => handleSelect(emoji)}
                    className="w-8 h-8 flex items-center justify-center text-lg rounded hover:bg-[#1a1d24]/10 transition"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Input */}
          <div className="p-2 border-t border-white/10">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Or type/paste emoji"
              className="w-full px-2 py-1 text-sm rounded bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>
      )}
    </div>
  );
}
