import { useEffect, useState, useRef } from 'react';
import {
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  X,
  Search,
  Wrench,
  DollarSign,
  Gift,
  LogIn,
  Mail,
  Link2,
  Puzzle,
  CheckCircle,
  Clock,
  XCircle,
  HelpCircle,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { getProductsUsed, createProductUsed, updateProductUsed, deleteProductUsed, type ProductUsed } from '../lib/api';
import { serviceTemplates, searchTemplates, type ServiceTemplate } from '../lib/serviceTemplates';
import EmojiPicker from '../components/EmojiPicker';

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

const licenseTypes = [
  { value: 'free', label: 'Free' },
  { value: 'freemium', label: 'Freemium' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'business', label: 'Business' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'custom', label: 'Custom' },
];

const statusOptions = [
  { value: 'active', label: 'Active', icon: CheckCircle, color: 'text-green-400' },
  { value: 'trial', label: 'Trial', icon: Clock, color: 'text-yellow-400' },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'text-red-400' },
  { value: 'considering', label: 'Considering', icon: HelpCircle, color: 'text-blue-400' },
];

const emptyFormData = {
  name: '',
  vendor: '',
  category: 'other',
  is_paid: false,
  monthly_cost: '',
  billing_cycle: '',
  url: '',
  icon: '',
  notes: '',
  renewal_date: '',
  description: '',
  use_case: '',
  features: '',
  integrations: '',
  login_url: '',
  account_email: '',
  license_type: '',
  status: 'active',
  contract_end_date: ''
};

export default function ProductsUsed() {
  const [products, setProducts] = useState<ProductUsed[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filterPaid, setFilterPaid] = useState<boolean | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductUsed | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductUsed | null>(null);
  const [formData, setFormData] = useState(emptyFormData);

  // Template selector state
  const [templateSearch, setTemplateSearch] = useState('');
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [filteredTemplates, setFilteredTemplates] = useState<ServiceTemplate[]>([]);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

  // Filter templates when search changes
  useEffect(() => {
    if (templateSearch.length > 0) {
      setFilteredTemplates(searchTemplates(templateSearch).slice(0, 10));
      setShowTemplateDropdown(true);
    } else {
      setFilteredTemplates(serviceTemplates.slice(0, 10));
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
  const applyTemplate = (template: ServiceTemplate) => {
    setFormData({
      ...formData,
      name: template.name,
      vendor: template.vendor,
      category: template.category,
      icon: template.icon,
      description: template.description,
      features: template.features,
      url: template.url,
      login_url: template.login_url,
      is_paid: template.is_paid,
      billing_cycle: template.billing_cycle || '',
      license_type: template.license_type || '',
    });
    setTemplateSearch('');
    setShowTemplateDropdown(false);
  };

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
    p.vendor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      renewal_date: formData.renewal_date ? new Date(formData.renewal_date).toISOString() : null,
      contract_end_date: formData.contract_end_date ? new Date(formData.contract_end_date).toISOString() : null
    };
    if (editingProduct) {
      await updateProductUsed(editingProduct.id, submitData);
    } else {
      await createProductUsed(submitData);
    }
    setShowModal(false);
    setEditingProduct(null);
    setFormData(emptyFormData);
    loadProducts();
  };

  const handleEdit = (product: ProductUsed, e?: React.MouseEvent) => {
    e?.stopPropagation();
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
      renewal_date: product.renewal_date ? product.renewal_date.split('T')[0] : '',
      description: product.description || '',
      use_case: product.use_case || '',
      features: product.features || '',
      integrations: product.integrations || '',
      login_url: product.login_url || '',
      account_email: product.account_email || '',
      license_type: product.license_type || '',
      status: product.status || 'active',
      contract_end_date: product.contract_end_date ? product.contract_end_date.split('T')[0] : ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirm('Delete this tool?')) {
      await deleteProductUsed(id);
      loadProducts();
    }
  };

  const handleCardClick = (product: ProductUsed) => {
    setSelectedProduct(product);
    setShowDetailModal(true);
  };

  const getStatusInfo = (status: string) => {
    return statusOptions.find(s => s.value === status) || statusOptions[0];
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
          onClick={() => { setEditingProduct(null); setFormData(emptyFormData); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" />
          Add Tool
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl bg-[#1a1d24] border border-white/10">
          <div className="text-2xl font-bold text-white">{products.length}</div>
          <div className="text-sm text-gray-400">Total Tools</div>
        </div>
        <div className="p-4 rounded-xl bg-[#1a1d24] border border-white/10">
          <div className="text-2xl font-bold text-green-400">{products.filter(p => p.status === 'active').length}</div>
          <div className="text-sm text-gray-400">Active</div>
        </div>
        <div className="p-4 rounded-xl bg-[#1a1d24] border border-white/10">
          <div className="text-2xl font-bold text-yellow-400">{products.filter(p => p.status === 'trial').length}</div>
          <div className="text-sm text-gray-400">On Trial</div>
        </div>
        <div className="p-4 rounded-xl bg-[#1a1d24] border border-white/10">
          <div className="text-2xl font-bold text-violet-400">{products.filter(p => p.is_paid).length}</div>
          <div className="text-sm text-gray-400">Paid</div>
        </div>
        <div className="p-4 rounded-xl bg-[#1a1d24] border border-white/10">
          <div className="text-2xl font-bold text-cyan-400">{products.filter(p => !p.is_paid).length}</div>
          <div className="text-sm text-gray-400">Free</div>
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
              filterPaid === undefined ? 'bg-[#1a1d24]/10 text-white' : 'text-gray-400 hover:bg-[#1a1d24]/5'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterPaid(true)}
            className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap transition flex items-center gap-1 ${
              filterPaid === true ? 'bg-[#1a1d24]/10 text-white' : 'text-gray-400 hover:bg-[#1a1d24]/5'
            }`}
          >
            <DollarSign className="w-3 h-3" /> Paid
          </button>
          <button
            onClick={() => setFilterPaid(false)}
            className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap transition flex items-center gap-1 ${
              filterPaid === false ? 'bg-[#1a1d24]/10 text-white' : 'text-gray-400 hover:bg-[#1a1d24]/5'
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
                ? 'bg-[#1a1d24]/10 text-white'
                : 'text-gray-400 hover:bg-[#1a1d24]/5'
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
          <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No tools found</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-cyan-400 hover:text-cyan-300"
          >
            Add your first tool
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {filteredProducts.map((product) => {
            return (
              <div
                key={product.id}
                onClick={() => handleCardClick(product)}
                className="group relative p-3 rounded-lg bg-[#13151a] border border-white/5 hover:border-white/10 hover:bg-[#1a1d24] transition-all cursor-pointer"
              >
                {/* Status indicator dot */}
                <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                  product.status === 'active' ? 'bg-emerald-400' :
                  product.status === 'trial' ? 'bg-yellow-400' :
                  product.status === 'paused' ? 'bg-orange-400' :
                  product.status === 'cancelled' ? 'bg-red-400' : 'bg-gray-400'
                }`} />

                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-lg bg-[#1a1d24]/5 flex items-center justify-center text-lg shrink-0 group-hover:bg-[#1a1d24]/10 transition">
                    {product.icon || '🔧'}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white text-sm truncate group-hover:text-cyan-400 transition">{product.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {product.monthly_cost && (
                        <span className="text-xs text-cyan-400">{product.monthly_cost}</span>
                      )}
                      {product.vendor && (
                        <span className="text-xs text-gray-500 truncate">· {product.vendor}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions - show on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                      product.is_paid ? 'bg-violet-500/20 text-violet-300' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {product.is_paid ? 'Paid' : 'Free'}
                    </span>
                    <button
                      onClick={(e) => handleEdit(product, e)}
                      className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-[#1a1d24]/5 transition"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(product.id, e)}
                      className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Description - only if exists */}
                {product.description && (
                  <p className="mt-2 ml-12 text-xs text-gray-500 line-clamp-1">{product.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedProduct.icon || '🔧'}</span>
                <div>
                  <h2 className="text-xl font-semibold text-white">{selectedProduct.name}</h2>
                  {selectedProduct.vendor && (
                    <span className="text-sm text-gray-400">by {selectedProduct.vendor}</span>
                  )}
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Status & Badges */}
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const statusInfo = getStatusInfo(selectedProduct.status);
                  const StatusIcon = statusInfo.icon;
                  return (
                    <span className={`flex items-center gap-1 px-3 py-1 rounded-full bg-[#1a1d24]/10 ${statusInfo.color}`}>
                      <StatusIcon className="w-4 h-4" />
                      {statusInfo.label}
                    </span>
                  );
                })()}
                <span className={`px-3 py-1 rounded-full ${
                  selectedProduct.is_paid
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'bg-green-500/20 text-green-300'
                }`}>
                  {selectedProduct.is_paid ? 'Paid' : 'Free'}
                </span>
                <span className="px-3 py-1 rounded-full bg-[#1a1d24]/10 text-gray-300 capitalize">
                  {selectedProduct.category}
                </span>
                {selectedProduct.license_type && (
                  <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 capitalize">
                    {selectedProduct.license_type}
                  </span>
                )}
              </div>

              {/* Description */}
              {selectedProduct.description && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">What is it?</h3>
                  <p className="text-white">{selectedProduct.description}</p>
                </div>
              )}

              {/* Use Case */}
              {selectedProduct.use_case && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">How we use it</h3>
                  <p className="text-white">{selectedProduct.use_case}</p>
                </div>
              )}

              {/* Features */}
              {selectedProduct.features && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Key Features</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.features.split(',').map((feature, i) => (
                      <span key={i} className="px-2 py-1 rounded bg-[#1a1d24]/5 text-gray-300 text-sm">
                        {feature.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Integrations */}
              {selectedProduct.integrations && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                    <Puzzle className="w-4 h-4" /> Integrates with
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.integrations.split(',').map((integration, i) => (
                      <span key={i} className="px-2 py-1 rounded bg-violet-500/20 text-violet-300 text-sm">
                        {integration.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Billing Info */}
              {(selectedProduct.monthly_cost || selectedProduct.billing_cycle || selectedProduct.renewal_date || selectedProduct.contract_end_date) && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Billing
                  </h3>
                  <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-[#1a1d24]/5">
                    {selectedProduct.monthly_cost && (
                      <div>
                        <span className="text-xs text-gray-500">Cost</span>
                        <p className="text-white">{selectedProduct.monthly_cost}</p>
                      </div>
                    )}
                    {selectedProduct.billing_cycle && (
                      <div>
                        <span className="text-xs text-gray-500">Billing Cycle</span>
                        <p className="text-white capitalize">{selectedProduct.billing_cycle}</p>
                      </div>
                    )}
                    {selectedProduct.renewal_date && (
                      <div>
                        <span className="text-xs text-gray-500">Renewal Date</span>
                        <p className="text-white">{formatDate(selectedProduct.renewal_date)}</p>
                      </div>
                    )}
                    {selectedProduct.contract_end_date && (
                      <div>
                        <span className="text-xs text-gray-500">Contract Ends</span>
                        <p className="text-white">{formatDate(selectedProduct.contract_end_date)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Account Info */}
              {selectedProduct.account_email && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Account Email
                  </h3>
                  <p className="text-white">{selectedProduct.account_email}</p>
                </div>
              )}

              {/* Notes */}
              {selectedProduct.notes && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Notes</h3>
                  <p className="text-gray-300 whitespace-pre-wrap">{selectedProduct.notes}</p>
                </div>
              )}

              {/* Links */}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-white/10">
                {selectedProduct.url && (
                  <a
                    href={selectedProduct.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1d24]/10 text-white hover:bg-[#1a1d24]/20 transition"
                  >
                    <Link2 className="w-4 h-4" />
                    Website
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {selectedProduct.login_url && (
                  <a
                    href={selectedProduct.login_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition"
                  >
                    <LogIn className="w-4 h-4" />
                    Login
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button
                  onClick={() => { setShowDetailModal(false); handleEdit(selectedProduct); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition ml-auto"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                {editingProduct ? 'Edit Tool' : 'Add Tool'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-6">
              {/* Template Selector - Only show when adding new tool */}
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
                      placeholder="Search AWS, Stripe, Slack, GitHub..."
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
                              <div className="text-xs text-gray-500 truncate">{template.vendor} · {template.category}</div>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded ${template.is_paid ? 'bg-violet-500/20 text-violet-300' : 'bg-green-500/20 text-green-300'}`}>
                              {template.is_paid ? 'Paid' : 'Free'}
                            </span>
                          </button>
                        ))
                      )}
                      <div className="p-2 border-t border-white/10 text-xs text-gray-500 text-center">
                        {serviceTemplates.length} templates available · Type to search
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Basic Info Section */}
              <div>
                <h3 className="text-sm font-medium text-cyan-400 mb-3">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm text-gray-400 mb-1">Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Slack, AWS, Figma"
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm text-gray-400 mb-1">Vendor</label>
                    <input
                      type="text"
                      value={formData.vendor}
                      onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                      placeholder="e.g., Google, Microsoft, Atlassian"
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
                    <label className="block text-sm text-gray-400 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                    >
                      {statusOptions.map((status) => (
                        <option key={status.value} value={status.value} className="bg-[#1a1d24] text-white">{status.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Icon</label>
                    <EmojiPicker
                      value={formData.icon}
                      onChange={(emoji) => setFormData({ ...formData, icon: emoji })}
                      placeholder="🔧"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">License Type</label>
                    <select
                      value={formData.license_type}
                      onChange={(e) => setFormData({ ...formData, license_type: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                    >
                      <option value="" className="bg-[#1a1d24] text-white">Select...</option>
                      {licenseTypes.map((lt) => (
                        <option key={lt.value} value={lt.value} className="bg-[#1a1d24] text-white">{lt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Description Section */}
              <div>
                <h3 className="text-sm font-medium text-cyan-400 mb-3">Description & Usage</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">What is this tool?</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                      placeholder="Brief description of what this tool/service is..."
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">How do we use it?</label>
                    <textarea
                      value={formData.use_case}
                      onChange={(e) => setFormData({ ...formData, use_case: e.target.value })}
                      rows={2}
                      placeholder="Describe how your business uses this tool..."
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Key Features (comma-separated)</label>
                    <input
                      type="text"
                      value={formData.features}
                      onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                      placeholder="e.g., Real-time sync, API access, SSO"
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Integrates with (comma-separated)</label>
                    <input
                      type="text"
                      value={formData.integrations}
                      onChange={(e) => setFormData({ ...formData, integrations: e.target.value })}
                      placeholder="e.g., Slack, GitHub, Jira"
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Billing Section */}
              <div>
                <h3 className="text-sm font-medium text-cyan-400 mb-3">Billing & Cost</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="flex items-center gap-2 text-sm text-gray-400">
                      <input
                        type="checkbox"
                        checked={formData.is_paid}
                        onChange={(e) => setFormData({ ...formData, is_paid: e.target.checked })}
                        className="rounded bg-[#1a1d24]/5 border-white/10"
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
                          placeholder="e.g., $50/mo, $500/yr"
                          className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Billing Cycle</label>
                        <select
                          value={formData.billing_cycle}
                          onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                        >
                          <option value="" className="bg-[#1a1d24] text-white">Select...</option>
                          {billingCycles.map((bc) => (
                            <option key={bc.value} value={bc.value} className="bg-[#1a1d24] text-white">{bc.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Renewal Date</label>
                        <input
                          type="date"
                          value={formData.renewal_date}
                          onChange={(e) => setFormData({ ...formData, renewal_date: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Contract End Date</label>
                        <input
                          type="date"
                          value={formData.contract_end_date}
                          onChange={(e) => setFormData({ ...formData, contract_end_date: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Access & Links Section */}
              <div>
                <h3 className="text-sm font-medium text-cyan-400 mb-3">Access & Links</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Website URL</label>
                    <input
                      type="url"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Login URL</label>
                    <input
                      type="url"
                      value={formData.login_url}
                      onChange={(e) => setFormData({ ...formData, login_url: e.target.value })}
                      placeholder="https://app.example.com/login"
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-gray-400 mb-1">Account Email</label>
                    <input
                      type="email"
                      value={formData.account_email}
                      onChange={(e) => setFormData({ ...formData, account_email: e.target.value })}
                      placeholder="Which email is this account registered with?"
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div>
                <h3 className="text-sm font-medium text-cyan-400 mb-3">Additional Notes</h3>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Any other notes, tips, or important information..."
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
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
                  {editingProduct ? 'Save Changes' : 'Add Tool'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
