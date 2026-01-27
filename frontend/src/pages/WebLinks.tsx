import { useEffect, useState } from 'react';
import {
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  X,
  Search,
  Link2,
  Star
} from 'lucide-react';
import { getWebLinks, createWebLink, updateWebLink, deleteWebLink, recordWebLinkVisit, type WebLink } from '../lib/api';
import EmojiPicker from '../components/EmojiPicker';

const categories = [
  { value: 'all', label: 'All', icon: '🔗' },
  { value: 'business', label: 'Business', icon: '💼' },
  { value: 'government', label: 'Government', icon: '🏛️' },
  { value: 'financial', label: 'Financial', icon: '💰' },
  { value: 'legal', label: 'Legal', icon: '⚖️' },
  { value: 'research', label: 'Research', icon: '🔬' },
  { value: 'news', label: 'News', icon: '📰' },
  { value: 'tools', label: 'Tools', icon: '🔧' },
  { value: 'reference', label: 'Reference', icon: '📚' },
  { value: 'other', label: 'Other', icon: '📎' },
];

export default function WebLinks() {
  const [links, setLinks] = useState<WebLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingLink, setEditingLink] = useState<WebLink | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    category: 'other',
    description: '',
    icon: '',
    is_favorite: false
  });

  const loadLinks = async () => {
    const data = await getWebLinks(selectedCategory === 'all' ? undefined : selectedCategory);
    setLinks(data);
    setLoading(false);
  };

  useEffect(() => {
    loadLinks();
  }, [selectedCategory]);

  const filteredLinks = links.filter(l =>
    l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenLink = async (link: WebLink) => {
    await recordWebLinkVisit(link.id);
    window.open(link.url, '_blank');
    loadLinks();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLink) {
      await updateWebLink(editingLink.id, formData);
    } else {
      await createWebLink(formData);
    }
    setShowModal(false);
    setEditingLink(null);
    setFormData({ title: '', url: '', category: 'other', description: '', icon: '', is_favorite: false });
    loadLinks();
  };

  const handleEdit = (link: WebLink) => {
    setEditingLink(link);
    setFormData({
      title: link.title,
      url: link.url,
      category: link.category,
      description: link.description || '',
      icon: link.icon || '',
      is_favorite: link.is_favorite
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this link?')) {
      await deleteWebLink(id);
      loadLinks();
    }
  };

  const handleToggleFavorite = async (link: WebLink) => {
    await updateWebLink(link.id, { is_favorite: !link.is_favorite });
    loadLinks();
  };

  const favoriteLinks = filteredLinks.filter(l => l.is_favorite);
  const otherLinks = filteredLinks.filter(l => !l.is_favorite);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Web Links</h1>
          <p className="text-gray-400 mt-1">Important bookmarks and resources</p>
        </div>
        <button
          onClick={() => { setEditingLink(null); setFormData({ title: '', url: '', category: 'other', description: '', icon: '', is_favorite: false }); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" />
          Add Link
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search links..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#1a1d24] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap transition ${
                selectedCategory === cat.value
                  ? 'bg-[#1a1d24]/10 text-white'
                  : 'text-gray-400 hover:bg-[#1a1d24]/5'
              }`}
            >
              <span className="mr-1">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Links */}
      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : filteredLinks.length === 0 ? (
        <div className="text-center py-12">
          <Link2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No links found</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-cyan-400 hover:text-cyan-300"
          >
            Add your first link
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Favorites Section */}
          {favoriteLinks.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" fill="currentColor" />
                Favorites
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {favoriteLinks.map((link) => (
                  <LinkCard
                    key={link.id}
                    link={link}
                    onOpen={handleOpenLink}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Links */}
          {otherLinks.length > 0 && (
            <div>
              {favoriteLinks.length > 0 && (
                <h2 className="text-lg font-semibold text-white mb-3">All Links</h2>
              )}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {otherLinks.map((link) => (
                  <LinkCard
                    key={link.id}
                    link={link}
                    onOpen={handleOpenLink}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleFavorite={handleToggleFavorite}
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
                {editingLink ? 'Edit Link' : 'Add Link'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., D&B Business Directory"
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">URL *</label>
                  <input
                    type="url"
                    required
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    {categories.slice(1).map((cat) => (
                      <option key={cat.value} value={cat.value} className="bg-[#1a1d24] text-white">{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Icon</label>
                  <EmojiPicker
                    value={formData.icon}
                    onChange={(emoji) => setFormData({ ...formData, icon: emoji })}
                    placeholder="🔗"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    placeholder="What is this link for?"
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 text-sm text-gray-400">
                    <input
                      type="checkbox"
                      checked={formData.is_favorite}
                      onChange={(e) => setFormData({ ...formData, is_favorite: e.target.checked })}
                      className="rounded bg-[#1a1d24]/5 border-white/10"
                    />
                    Add to favorites
                  </label>
                </div>
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
                  {editingLink ? 'Save' : 'Add Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function LinkCard({
  link,
  onOpen,
  onEdit,
  onDelete,
  onToggleFavorite
}: {
  link: WebLink;
  onOpen: (link: WebLink) => void;
  onEdit: (link: WebLink) => void;
  onDelete: (id: number) => void;
  onToggleFavorite: (link: WebLink) => void;
}) {
  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  return (
    <div
      onClick={() => onOpen(link)}
      className="group relative p-3 rounded-lg bg-[#13151a] border border-white/5 hover:border-white/10 hover:bg-[#1a1d24] transition-all cursor-pointer"
    >
      {/* Favorite indicator */}
      {link.is_favorite && (
        <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
      )}

      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="w-9 h-9 rounded-lg bg-[#1a1d24]/5 flex items-center justify-center text-lg shrink-0 group-hover:bg-[#1a1d24]/10 transition">
          {link.icon || '🔗'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-white text-sm truncate">{link.title}</h3>
            <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition shrink-0" />
          </div>
          <p className="text-xs text-gray-500 truncate">{getDomain(link.url)}</p>
        </div>

        {/* Actions - show on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(link); }}
            className={`p-1.5 rounded-md transition ${link.is_favorite ? 'text-amber-400 hover:bg-amber-400/10' : 'text-gray-500 hover:text-amber-400 hover:bg-[#1a1d24]/5'}`}
          >
            <Star className="w-3.5 h-3.5" fill={link.is_favorite ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(link); }}
            className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-[#1a1d24]/5 transition"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(link.id); }}
            className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Description - only if exists */}
      {link.description && (
        <p className="mt-2 ml-12 text-xs text-gray-500 line-clamp-1">{link.description}</p>
      )}
    </div>
  );
}
