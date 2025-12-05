import { useEffect, useState } from 'react';
import {
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  X,
  Search,
  Wrench,
  DollarSign,
  Gift
} from 'lucide-react';
import { getProductsUsed, createProductUsed, updateProductUsed, deleteProductUsed, type ProductUsed } from '../lib/api';

const categories = [
  { value: 'all', label: 'All', icon: '🔧' },
  { value: 'development', label: 'Development', icon: '💻' },
  { value: 'infrastructure', label: 'Infrastructure', icon: '🏗️' },
  { value: 'productivity', label: 'Productivity', icon: '📊' },
  { value: 'communication', label: 'Communication', icon: '💬' },
  { value: 'marketing', label: 'Marketing', icon: '📢' },
  { value: 'finance', label: 'Finance', icon: '💰' },
  { value: 'hr', label: 'HR', icon: '👥' },
  { value: 'analytics', label: 'Analytics', icon: '📈' },
  { value: 'security', label: 'Security', icon: '🔒' },
  { value: 'design', label: 'Design', icon: '🎨' },
  { value: 'other', label: 'Other', icon: '📎' },
];

const billingCycles = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annually', label: 'Annually' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'one-time', label: 'One-time' },
  { value: 'usage', label: 'Usage-based' },
];

export default function ProductsUsed() {
  const [products, setProducts] = useState<ProductUsed[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filterPaid, setFilterPaid] = useState<boolean | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductUsed | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    vendor: '',
    category: 'other',
    is_paid: false,
    monthly_cost: '',
    billing_cycle: '',
    url: '',
    icon: '',
    notes: '',
    renewal_date: ''
  });

  const loadProducts = async () => {
    const data = await getProductsUsed(
      selectedCategory === 'all' ? undefined : selectedCategory,
      filterPaid
    );
    setProducts(data);
    setLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, [selectedCategory, filterPaid]);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.vendor?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      renewal_date: formData.renewal_date || null
    };
    if (editingProduct) {
      await updateProductUsed(editingProduct.id, submitData);
    } else {
      await createProductUsed(submitData);
    }
    setShowModal(false);
    setEditingProduct(null);
    setFormData({ name: '', vendor: '', category: 'other', is_paid: false, monthly_cost: '', billing_cycle: '', url: '', icon: '', notes: '', renewal_date: '' });
    loadProducts();
  };

  const handleEdit = (product: ProductUsed) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      vendor: product.vendor || '',
      category: product.category,
      is_paid: product.is_paid,
      monthly_cost: product.monthly_cost || '',
      billing_cycle: product.billing_cycle || '',
      url: product.url || '',
      icon: product.icon || '',
      notes: product.notes || '',
      renewal_date: product.renewal_date ? product.renewal_date.split('T')[0] : ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this tool?')) {
      await deleteProductUsed(id);
      loadProducts();
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Tools & Services Used</h1>
          <p className="text-gray-400 mt-1">Software and services your business relies on</p>
        </div>
        <button
          onClick={() => { setEditingProduct(null); setFormData({ name: '', vendor: '', category: 'other', is_paid: false, monthly_cost: '', billing_cycle: '', url: '', icon: '', notes: '', renewal_date: '' }); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" />
          Add Tool
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#1a1d24] border border-white/10">
          <div className="text-2xl font-bold text-white">{products.length}</div>
          <div className="text-sm text-gray-400">Total Tools</div>
        </div>
        <div className="p-4 rounded-xl bg-[#1a1d24] border border-white/10">
          <div className="text-2xl font-bold text-green-400">{products.filter(p => !p.is_paid).length}</div>
          <div className="text-sm text-gray-400">Free</div>
        </div>
        <div className="p-4 rounded-xl bg-[#1a1d24] border border-white/10">
          <div className="text-2xl font-bold text-violet-400">{products.filter(p => p.is_paid).length}</div>
          <div className="text-sm text-gray-400">Paid</div>
        </div>
        <div className="p-4 rounded-xl bg-[#1a1d24] border border-white/10">
          <div className="text-2xl font-bold text-cyan-400">
            {new Set(products.map(p => p.category)).size}
          </div>
          <div className="text-sm text-gray-400">Categories</div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#1a1d24] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterPaid(undefined)}
            className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap transition ${
              filterPaid === undefined ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterPaid(true)}
            className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap transition flex items-center gap-1 ${
              filterPaid === true ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'
            }`}
          >
            <DollarSign className="w-3 h-3" /> Paid
          </button>
          <button
            onClick={() => setFilterPaid(false)}
            className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap transition flex items-center gap-1 ${
              filterPaid === false ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'
            }`}
          >
            <Gift className="w-3 h-3" /> Free
          </button>
        </div>
      </div>

      {/* Category Filter */}
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

      {/* Products Grid */}
      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <Wrench className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">No tools found</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-cyan-400 hover:text-cyan-300"
          >
            Add your first tool
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="p-4 rounded-xl bg-[#1a1d24] border border-white/10 hover:border-white/20 transition group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{product.icon || '🔧'}</span>
                  <div>
                    <h3 className="font-semibold text-white">{product.name}</h3>
                    {product.vendor && (
                      <span className="text-xs text-gray-500">by {product.vendor}</span>
                    )}
                  </div>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  product.is_paid
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'bg-green-500/20 text-green-300'
                }`}>
                  {product.is_paid ? 'Paid' : 'Free'}
                </span>
              </div>

              <div className="text-xs text-gray-500 capitalize mb-2">{product.category}</div>

              {(product.monthly_cost || product.billing_cycle) && (
                <div className="flex gap-2 mb-3">
                  {product.monthly_cost && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-500/20 text-cyan-300">
                      {product.monthly_cost}
                    </span>
                  )}
                  {product.billing_cycle && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-gray-300">
                      {product.billing_cycle}
                    </span>
                  )}
                </div>
              )}

              {product.notes && (
                <p className="text-sm text-gray-400 mb-3 line-clamp-2">{product.notes}</p>
              )}

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
                    Open
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
                {editingProduct ? 'Edit Tool' : 'Add Tool'}
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
                  <label className="block text-sm text-gray-400 mb-1">Vendor</label>
                  <input
                    type="text"
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    placeholder="e.g., Google, AWS"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Icon (emoji)</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="🔧"
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
                <div className="flex items-center">
                  <label className="flex items-center gap-2 text-sm text-gray-400 mt-6">
                    <input
                      type="checkbox"
                      checked={formData.is_paid}
                      onChange={(e) => setFormData({ ...formData, is_paid: e.target.checked })}
                      className="rounded bg-white/5 border-white/10"
                    />
                    Paid subscription
                  </label>
                </div>
                {formData.is_paid && (
                  <>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Cost</label>
                      <input
                        type="text"
                        value={formData.monthly_cost}
                        onChange={(e) => setFormData({ ...formData, monthly_cost: e.target.value })}
                        placeholder="e.g., $50/mo"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Billing Cycle</label>
                      <select
                        value={formData.billing_cycle}
                        onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                      >
                        <option value="">Select...</option>
                        {billingCycles.map((bc) => (
                          <option key={bc.value} value={bc.value}>{bc.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm text-gray-400 mb-1">Renewal Date</label>
                      <input
                        type="date"
                        value={formData.renewal_date}
                        onChange={(e) => setFormData({ ...formData, renewal_date: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                  </>
                )}
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">URL</label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://..."
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
                  {editingProduct ? 'Save' : 'Add Tool'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
