import { useEffect, useState, useRef } from 'react';
import {
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  X,
  Search,
  Package,
  CheckCircle,
  XCircle,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { getProductsOffered, createProductOffered, updateProductOffered, deleteProductOffered, type ProductOffered } from '../lib/api';
import { offeredProductTemplates, searchOfferedTemplates, type OfferedProductTemplate } from '../lib/offeredProductTemplates';
import EmojiPicker from '../components/EmojiPicker';

const categories = [
  { value: 'all', label: 'All', icon: '📦' },
  { value: 'software', label: 'Software', icon: '💻' },
  { value: 'saas', label: 'SaaS', icon: '☁️' },
  { value: 'hardware', label: 'Hardware', icon: '🔌' },
  { value: 'consulting', label: 'Consulting', icon: '💼' },
  { value: 'service', label: 'Service', icon: '🛠️' },
  { value: 'subscription', label: 'Subscription', icon: '🔄' },
  { value: 'license', label: 'License', icon: '📜' },
  { value: 'other', label: 'Other', icon: '📎' },
];

const pricingModels = [
  { value: 'one-time', label: 'One-time' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'project', label: 'Per Project' },
  { value: 'usage', label: 'Usage-based' },
  { value: 'freemium', label: 'Freemium' },
  { value: 'custom', label: 'Custom' },
];

export default function ProductsOffered() {
  const [products, setProducts] = useState<ProductOffered[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductOffered | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'other',
    pricing_model: '',
    price: '',
    url: '',
    icon: '',
    is_active: true,
    notes: ''
  });

  // Template selector state
  const [templateSearch, setTemplateSearch] = useState('');
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [filteredTemplates, setFilteredTemplates] = useState<OfferedProductTemplate[]>([]);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

  // Filter templates when search changes
  useEffect(() => {
    if (templateSearch.length > 0) {
      setFilteredTemplates(searchOfferedTemplates(templateSearch).slice(0, 10));
      setShowTemplateDropdown(true);
    } else {
      setFilteredTemplates(offeredProductTemplates.slice(0, 10));
    }
  }, [templateSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(event.target as Node)) {
        setShowTemplateDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Apply template to form
  const applyTemplate = (template: OfferedProductTemplate) => {
    setFormData({
      ...formData,
      name: template.name,
      description: template.description,
      category: template.category,
      icon: template.icon,
      pricing_model: template.pricing_model,
      price: template.price_example,
    });
    setTemplateSearch('');
    setShowTemplateDropdown(false);
  };

  const loadProducts = async () => {
    const data = await getProductsOffered(selectedCategory === 'all' ? undefined : selectedCategory);
    setProducts(data);
    setLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, [selectedCategory]);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      await updateProductOffered(editingProduct.id, formData);
    } else {
      await createProductOffered(formData);
    }
    setShowModal(false);
    setEditingProduct(null);
    setFormData({ name: '', description: '', category: 'other', pricing_model: '', price: '', url: '', icon: '', is_active: true, notes: '' });
    loadProducts();
  };

  const handleEdit = (product: ProductOffered) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      category: product.category,
      pricing_model: product.pricing_model || '',
      price: product.price || '',
      url: product.url || '',
      icon: product.icon || '',
      is_active: product.is_active,
      notes: product.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this product?')) {
      await deleteProductOffered(id);
      loadProducts();
    }
  };

  const handleToggleActive = async (product: ProductOffered) => {
    await updateProductOffered(product.id, { is_active: !product.is_active });
    loadProducts();
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Products & Services Offered</h1>
          <p className="text-gray-400 mt-1">What your business sells or provides</p>
        </div>
        <button
          onClick={() => { setEditingProduct(null); setFormData({ name: '', description: '', category: 'other', pricing_model: '', price: '', url: '', icon: '', is_active: true, notes: '' }); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search products..."
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

      {/* Products Grid */}
      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No products found</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-cyan-400 hover:text-cyan-300"
          >
            Add your first product
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              onClick={() => handleEdit(product)}
              className={`group relative p-3 rounded-lg bg-[#13151a] border transition-all cursor-pointer ${
                product.is_active ? 'border-white/5 hover:border-white/10 hover:bg-[#1a1d24]' : 'border-white/5 opacity-50'
              }`}
            >
              {/* Active indicator */}
              {product.is_active && (
                <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
              )}

              <div className="flex items-center gap-3">
                {/* Icon */}
                <div className="w-9 h-9 rounded-lg bg-[#1a1d24]/5 flex items-center justify-center text-lg shrink-0 group-hover:bg-[#1a1d24]/10 transition">
                  {product.icon || '📦'}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white text-sm truncate">{product.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {product.price && (
                      <span className="text-xs text-cyan-400">{product.price}</span>
                    )}
                    {product.pricing_model && (
                      <span className="text-xs text-gray-500">· {product.pricing_model}</span>
                    )}
                  </div>
                </div>

                {/* Actions - show on hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleActive(product); }}
                    className={`p-1.5 rounded-md transition ${product.is_active ? 'text-emerald-400 hover:bg-emerald-400/10' : 'text-gray-500 hover:text-emerald-400 hover:bg-[#1a1d24]/5'}`}
                    title={product.is_active ? 'Active' : 'Inactive'}
                  >
                    {product.is_active ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(product); }}
                    className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-[#1a1d24]/5 transition"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}
                    className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {product.url && (
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-[#1a1d24]/5 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Description - only if exists */}
              {product.description && (
                <p className="mt-2 ml-12 text-xs text-gray-500 line-clamp-1">{product.description}</p>
              )}
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
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Template Selector - Only show when adding new product */}
              {!editingProduct && (
                <div className="relative" ref={templateDropdownRef}>
                  <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                    Quick Fill from Template
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      onFocus={() => setShowTemplateDropdown(true)}
                      placeholder="Search SaaS, Consulting, API..."
                      className="w-full pl-10 pr-10 py-2 rounded-lg bg-gradient-to-r from-yellow-500/10 to-cyan-500/10 border border-yellow-500/30 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500/50"
                    />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  </div>

                  {showTemplateDropdown && (
                    <div className="absolute z-10 w-full mt-1 max-h-64 overflow-y-auto rounded-lg bg-[#1a1d24] border border-white/20 shadow-xl">
                      {filteredTemplates.length === 0 ? (
                        <div className="p-3 text-gray-500 text-sm">No templates found</div>
                      ) : (
                        filteredTemplates.map((template, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => applyTemplate(template)}
                            className="w-full px-3 py-2 flex items-center gap-3 hover:bg-[#1a1d24]/10 transition text-left"
                          >
                            <span className="text-xl">{template.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-white font-medium truncate">{template.name}</div>
                              <div className="text-xs text-gray-500 truncate">{template.category} · {template.pricing_model}</div>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                              {template.price_example}
                            </span>
                          </button>
                        ))
                      )}
                      <div className="p-2 border-t border-white/10 text-xs text-gray-500 text-center">
                        {offeredProductTemplates.length} templates available · Type to search
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                    placeholder="📦"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Pricing Model</label>
                  <select
                    value={formData.pricing_model}
                    onChange={(e) => setFormData({ ...formData, pricing_model: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="" className="bg-[#1a1d24] text-white">Select...</option>
                    {pricingModels.map((pm) => (
                      <option key={pm.value} value={pm.value} className="bg-[#1a1d24] text-white">{pm.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Price</label>
                  <input
                    type="text"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="e.g., $99/mo"
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Product URL</label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://..."
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
                  <label className="block text-sm text-gray-400 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 text-sm text-gray-400">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded bg-[#1a1d24]/5 border-white/10"
                    />
                    Active (currently offered)
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
                  {editingProduct ? 'Save' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
