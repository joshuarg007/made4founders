import { useEffect, useState } from 'react';
import {
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  X,
  Search,
  Package,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { getProductsOffered, createProductOffered, updateProductOffered, deleteProductOffered, type ProductOffered } from '../lib/api';

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
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:bg-white/5'
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
          <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">No products found</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-cyan-400 hover:text-cyan-300"
          >
            Add your first product
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className={`p-4 rounded-xl bg-[#1a1d24] border transition group ${
                product.is_active ? 'border-white/10 hover:border-white/20' : 'border-white/5 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{product.icon || '📦'}</span>
                  <div>
                    <h3 className="font-semibold text-white">{product.name}</h3>
                    <span className="text-xs text-gray-500 capitalize">{product.category}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleActive(product)}
                  className={`p-1 rounded ${product.is_active ? 'text-green-400' : 'text-gray-600 hover:text-gray-400'}`}
                  title={product.is_active ? 'Active' : 'Inactive'}
                >
                  {product.is_active ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                </button>
              </div>

              {product.description && (
                <p className="text-sm text-gray-400 mb-3 line-clamp-2">{product.description}</p>
              )}

              <div className="flex flex-wrap gap-2 mb-3">
                {product.pricing_model && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-violet-500/20 text-violet-300">
                    {product.pricing_model}
                  </span>
                )}
                {product.price && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-500/20 text-cyan-300">
                    {product.price}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(product)}
                    className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-white/10 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {product.url && (
                  <a
                    href={product.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition"
                  >
                    View
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
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
                {editingProduct ? 'Edit Product' : 'Add Product'}
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
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    {categories.slice(1).map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Icon (emoji)</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="📦"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Pricing Model</label>
                  <select
                    value={formData.pricing_model}
                    onChange={(e) => setFormData({ ...formData, pricing_model: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="">Select...</option>
                    {pricingModels.map((pm) => (
                      <option key={pm.value} value={pm.value}>{pm.label}</option>
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
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Product URL</label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
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
