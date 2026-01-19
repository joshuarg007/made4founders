import { useEffect, useState } from 'react';
import {
  Plus,
  ExternalLink,
  Trash2,
  X,
  Search,
  Store,
  CheckCircle,
  XCircle,
  ShoppingCart,
  Monitor,
  Smartphone,
  Building2,
  Briefcase,
  Share2,
  Globe
} from 'lucide-react';
import { getMarketplaces, createMarketplace, updateMarketplace, deleteMarketplace, type Marketplace } from '../lib/api';
import EmojiPicker from '../components/EmojiPicker';

const categories = [
  { value: 'all', label: 'All', icon: Store },
  { value: 'ecommerce', label: 'E-commerce', icon: ShoppingCart },
  { value: 'software', label: 'Software', icon: Monitor },
  { value: 'appstore', label: 'App Stores', icon: Smartphone },
  { value: 'b2b', label: 'B2B', icon: Building2 },
  { value: 'freelance', label: 'Freelance', icon: Briefcase },
  { value: 'social', label: 'Social', icon: Share2 },
  { value: 'other', label: 'Other', icon: Globe },
];

const statuses = [
  { value: 'active', label: 'Active', color: 'text-emerald-400' },
  { value: 'pending', label: 'Pending', color: 'text-yellow-400' },
  { value: 'suspended', label: 'Suspended', color: 'text-red-400' },
];

// Brand colors for known marketplaces
const brandColors: Record<string, string> = {
  'amazon': '#FF9900',
  'ebay': '#E53238',
  'etsy': '#F56400',
  'capterra': '#FF6B35',
  'g2': '#FF492C',
  'shopify': '#7AB55C',
  'app store': '#0D96F6',
  'google play': '#01875F',
  'walmart': '#0071CE',
  'alibaba': '#FF6A00',
  'upwork': '#14A800',
  'fiverr': '#1DBF73',
};

// Default icons for categories
const categoryIcons: Record<string, string> = {
  'ecommerce': '🛒',
  'software': '💻',
  'appstore': '📱',
  'b2b': '🏢',
  'freelance': '💼',
  'social': '📣',
  'other': '🌐',
};

export default function Marketplaces() {
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMarketplace, setEditingMarketplace] = useState<Marketplace | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'other',
    url: '',
    store_url: '',
    account_id: '',
    status: 'active',
    commission_rate: '',
    monthly_fee: '',
    icon: '',
    notes: '',
    is_active: true
  });

  const loadMarketplaces = async () => {
    const data = await getMarketplaces(selectedCategory === 'all' ? undefined : selectedCategory);
    setMarketplaces(data);
    setLoading(false);
  };

  useEffect(() => {
    loadMarketplaces();
  }, [selectedCategory]);

  const filteredMarketplaces = marketplaces.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMarketplace) {
      await updateMarketplace(editingMarketplace.id, formData);
    } else {
      await createMarketplace(formData);
    }
    setShowModal(false);
    setEditingMarketplace(null);
    resetForm();
    loadMarketplaces();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'other',
      url: '',
      store_url: '',
      account_id: '',
      status: 'active',
      commission_rate: '',
      monthly_fee: '',
      icon: '',
      notes: '',
      is_active: true
    });
  };

  const handleEdit = (marketplace: Marketplace) => {
    setEditingMarketplace(marketplace);
    setFormData({
      name: marketplace.name,
      category: marketplace.category,
      url: marketplace.url || '',
      store_url: marketplace.store_url || '',
      account_id: marketplace.account_id || '',
      status: marketplace.status,
      commission_rate: marketplace.commission_rate || '',
      monthly_fee: marketplace.monthly_fee || '',
      icon: marketplace.icon || '',
      notes: marketplace.notes || '',
      is_active: marketplace.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this marketplace?')) {
      await deleteMarketplace(id);
      loadMarketplaces();
    }
  };

  const handleToggleActive = async (marketplace: Marketplace) => {
    await updateMarketplace(marketplace.id, { is_active: !marketplace.is_active });
    loadMarketplaces();
  };

  const getCategoryIcon = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat ? cat.icon : Globe;
  };

  const getStatusColor = (status: string) => {
    const s = statuses.find(st => st.value === status);
    return s ? s.color : 'text-gray-400';
  };

  const getBrandColor = (name: string) => {
    const lowerName = name.toLowerCase();
    for (const [brand, color] of Object.entries(brandColors)) {
      if (lowerName.includes(brand)) {
        return color;
      }
    }
    return null;
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Marketplaces</h1>
          <p className="text-gray-400 mt-1">Where you sell products and services</p>
        </div>
        <button
          onClick={() => { setEditingMarketplace(null); resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600 text-white font-medium hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" />
          Add Marketplace
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search marketplaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#1a1d24] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition ${
                  selectedCategory === cat.value
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'text-gray-400 hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Marketplaces Grid */}
      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : filteredMarketplaces.length === 0 ? (
        <div className="text-center py-12">
          <Store className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">No marketplaces found</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-purple-400 hover:text-purple-300"
          >
            Add your first marketplace
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredMarketplaces.map((marketplace) => {
            const brandColor = getBrandColor(marketplace.name);
            const CategoryIcon = getCategoryIcon(marketplace.category);

            return (
              <div
                key={marketplace.id}
                onClick={() => handleEdit(marketplace)}
                className={`group relative p-4 rounded-xl bg-[#13151a] border transition-all cursor-pointer ${
                  marketplace.is_active ? 'border-white/5 hover:border-white/10 hover:bg-[#1a1d24]' : 'border-white/5 opacity-50'
                }`}
                style={brandColor ? { borderColor: `${brandColor}20` } : undefined}
              >
                {/* Active indicator */}
                {marketplace.is_active && (
                  <div
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: brandColor || '#10b981' }}
                  />
                )}

                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition"
                    style={{
                      backgroundColor: brandColor ? `${brandColor}20` : 'rgba(255,255,255,0.05)',
                    }}
                  >
                    {marketplace.icon || categoryIcons[marketplace.category] || '🏪'}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{marketplace.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs ${getStatusColor(marketplace.status)}`}>
                        {marketplace.status}
                      </span>
                      {marketplace.commission_rate && (
                        <span className="text-xs text-gray-500">· {marketplace.commission_rate}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleActive(marketplace); }}
                      className={`p-1.5 rounded-md transition ${marketplace.is_active ? 'text-emerald-400 hover:bg-emerald-400/10' : 'text-gray-500 hover:text-emerald-400 hover:bg-white/5'}`}
                      title={marketplace.is_active ? 'Active' : 'Inactive'}
                    >
                      {marketplace.is_active ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(marketplace.id); }}
                      className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {marketplace.store_url && (
                      <a
                        href={marketplace.store_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/5 transition"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Additional Info */}
                <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <CategoryIcon className="w-3.5 h-3.5" />
                    <span className="capitalize">{marketplace.category}</span>
                  </div>
                  {marketplace.monthly_fee && (
                    <span>· {marketplace.monthly_fee}/mo</span>
                  )}
                </div>

                {/* Account ID if exists */}
                {marketplace.account_id && (
                  <div className="mt-2 text-xs text-gray-500 truncate">
                    ID: {marketplace.account_id}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                {editingMarketplace ? 'Edit Marketplace' : 'Add Marketplace'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Amazon, Capterra, G2"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50"
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
                    placeholder="🏪"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50"
                  >
                    {statuses.map((s) => (
                      <option key={s.value} value={s.value} className="bg-[#1a1d24] text-white">{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Account/Seller ID</label>
                  <input
                    type="text"
                    value={formData.account_id}
                    onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                    placeholder="Your seller ID or username"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Marketplace URL</label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://amazon.com"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Your Store/Listing URL</label>
                  <input
                    type="url"
                    value={formData.store_url}
                    onChange={(e) => setFormData({ ...formData, store_url: e.target.value })}
                    placeholder="https://amazon.com/your-store"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Commission Rate</label>
                  <input
                    type="text"
                    value={formData.commission_rate}
                    onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                    placeholder="e.g., 15% or $0.99/sale"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Monthly Fee</label>
                  <input
                    type="text"
                    value={formData.monthly_fee}
                    onChange={(e) => setFormData({ ...formData, monthly_fee: e.target.value })}
                    placeholder="e.g., $39.99"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 text-sm text-gray-400">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded bg-white/5 border-white/10"
                    />
                    Active (currently selling on this marketplace)
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
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600 text-white font-medium hover:opacity-90 transition"
                >
                  {editingMarketplace ? 'Save' : 'Add Marketplace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
