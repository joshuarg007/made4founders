import { useEffect, useState } from 'react';
import {
  Plus,
  Star,
  ExternalLink,
  Pencil,
  Trash2,
  X,
  Search
} from 'lucide-react';
import { getServices, createService, updateService, deleteService, recordServiceVisit, type Service } from '../lib/api';

const categories = [
  { value: 'all', label: 'All', icon: '📋' },
  { value: 'banking', label: 'Banking', icon: '🏦' },
  { value: 'legal', label: 'Legal', icon: '⚖️' },
  { value: 'tax', label: 'Tax', icon: '📊' },
  { value: 'accounting', label: 'Accounting', icon: '🧮' },
  { value: 'government', label: 'Government', icon: '🏛️' },
  { value: 'insurance', label: 'Insurance', icon: '🛡️' },
  { value: 'vendors', label: 'Vendors', icon: '🤝' },
  { value: 'tools', label: 'Tools', icon: '🔧' },
  { value: 'other', label: 'Other', icon: '📎' },
];

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    category: 'other',
    description: '',
    username_hint: '',
    notes: '',
    icon: '',
    is_favorite: false
  });

  const loadServices = async () => {
    const data = await getServices(selectedCategory === 'all' ? undefined : selectedCategory);
    setServices(data);
    setLoading(false);
  };

  useEffect(() => {
    loadServices();
  }, [selectedCategory]);

  const filteredServices = services.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenService = async (service: Service) => {
    await recordServiceVisit(service.id);
    window.open(service.url, '_blank');
    loadServices();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Ensure URL has a protocol
    let url = formData.url.trim();
    if (url && !url.match(/^https?:\/\//i)) {
      url = 'https://' + url;
    }
    const dataToSubmit = { ...formData, url };

    try {
      if (editingService) {
        await updateService(editingService.id, dataToSubmit);
      } else {
        await createService(dataToSubmit);
      }
      setShowModal(false);
      setEditingService(null);
      setFormData({ name: '', url: '', category: 'other', description: '', username_hint: '', notes: '', icon: '', is_favorite: false });
      loadServices();
    } catch {
      // Error handled by GlobalErrorToast
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      url: service.url,
      category: service.category,
      description: service.description || '',
      username_hint: service.username_hint || '',
      notes: service.notes || '',
      icon: service.icon || '',
      is_favorite: service.is_favorite
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this service?')) {
      await deleteService(id);
      loadServices();
    }
  };

  const handleToggleFavorite = async (service: Service) => {
    await updateService(service.id, { is_favorite: !service.is_favorite });
    loadServices();
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Services</h1>
          <p className="text-gray-400 mt-1">All your business services in one place</p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingService(null); setFormData({ name: '', url: '', category: 'other', description: '', username_hint: '', notes: '', icon: '', is_favorite: false }); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" />
          Add Service
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search services..."
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

      {/* Services Grid */}
      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : filteredServices.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No services found</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-cyan-400 hover:text-cyan-300"
          >
            Add your first service
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="p-4 rounded-xl bg-[#1a1d24] border border-white/10 hover:border-white/20 transition group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{service.icon || '🔗'}</span>
                  <div>
                    <h3 className="font-semibold text-white">{service.name}</h3>
                    <span className="text-xs text-gray-500 capitalize">{service.category}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleFavorite(service)}
                  className={`p-1 rounded ${service.is_favorite ? 'text-amber-400' : 'text-gray-400 hover:text-gray-400'}`}
                >
                  <Star className="w-4 h-4" fill={service.is_favorite ? 'currentColor' : 'none'} />
                </button>
              </div>

              {service.description && (
                <p className="text-sm text-gray-400 mb-3 line-clamp-2">{service.description}</p>
              )}

              {service.username_hint && (
                <p className="text-xs text-gray-500 mb-3">Login: {service.username_hint}</p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(service)}
                    className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-[#1a1d24]/10 transition"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(service.id)}
                    className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-[#1a1d24]/10 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => handleOpenService(service)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1d24]/10 text-white text-sm hover:bg-[#1a1d24]/20 transition"
                >
                  Open
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                {editingService ? 'Edit Service' : 'Add Service'}
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
                  <label className="block text-sm text-gray-400 mb-1">Icon (emoji)</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="🔗"
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Login Hint</label>
                  <input
                    type="text"
                    value={formData.username_hint}
                    onChange={(e) => setFormData({ ...formData, username_hint: e.target.value })}
                    placeholder="e.g., company@email.com"
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
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
                  {editingService ? 'Save' : 'Add Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
