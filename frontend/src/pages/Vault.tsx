import { useEffect, useState } from 'react';
import {
  Shield,
  Lock,
  Unlock,
  Plus,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  Edit3,
  X,
  Key,
  User,
  FileText,
  Search,
  AlertTriangle,
  Star,
  List,
  LayoutGrid,
} from 'lucide-react';
import {
  getVaultStatus,
  setupVault,
  unlockVault,
  lockVault,
  getCredentials,
  getCredential,
  createCredential,
  updateCredential,
  deleteCredential,
  copyCredentialField,
  type VaultStatus,
  type CredentialMasked,
  type CredentialDecrypted,
  type CredentialCreate,
  type CustomField,
} from '../lib/api';

const categories = [
  { value: 'banking', label: 'Banking', icon: '🏦', color: 'emerald', border: 'border-l-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  { value: 'tax', label: 'Tax', icon: '📋', color: 'amber', border: 'border-l-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  { value: 'legal', label: 'Legal', icon: '⚖️', color: 'blue', border: 'border-l-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  { value: 'government', label: 'Government', icon: '🏛️', color: 'red', border: 'border-l-red-500', bg: 'bg-red-500/10', text: 'text-red-400' },
  { value: 'accounting', label: 'Accounting', icon: '📊', color: 'cyan', border: 'border-l-cyan-500', bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
  { value: 'insurance', label: 'Insurance', icon: '🛡️', color: 'purple', border: 'border-l-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-400' },
  { value: 'vendors', label: 'Vendors', icon: '🤝', color: 'pink', border: 'border-l-pink-500', bg: 'bg-pink-500/10', text: 'text-pink-400' },
  { value: 'tools', label: 'Tools', icon: '🔧', color: 'violet', border: 'border-l-violet-500', bg: 'bg-violet-500/10', text: 'text-violet-400' },
  { value: 'other', label: 'Other', icon: '📁', color: 'gray', border: 'border-l-gray-500', bg: 'bg-gray-500/10', text: 'text-gray-400' },
];

// Predefined field types for quick adding
const predefinedFieldTypes = [
  { value: 'api_key', label: 'API Key', type: 'secret' as const },
  { value: 'client_id', label: 'Client ID', type: 'text' as const },
  { value: 'client_secret', label: 'Client Secret', type: 'secret' as const },
  { value: 'access_key', label: 'Access Key', type: 'secret' as const },
  { value: 'secret_key', label: 'Secret Access Key', type: 'secret' as const },
  { value: 'bearer_token', label: 'Bearer Token', type: 'secret' as const },
  { value: 'oauth_token', label: 'OAuth Token', type: 'secret' as const },
  { value: 'refresh_token', label: 'Refresh Token', type: 'secret' as const },
  { value: 'ssh_key', label: 'SSH Private Key', type: 'secret' as const },
  { value: 'ssh_public', label: 'SSH Public Key', type: 'text' as const },
  { value: 'webhook_secret', label: 'Webhook Secret', type: 'secret' as const },
  { value: 'encryption_key', label: 'Encryption Key', type: 'secret' as const },
  { value: 'signing_key', label: 'Signing Key', type: 'secret' as const },
  { value: 'private_key', label: 'Private Key', type: 'secret' as const },
  { value: 'public_key', label: 'Public Key', type: 'text' as const },
  { value: 'account_id', label: 'Account ID', type: 'text' as const },
  { value: 'tenant_id', label: 'Tenant ID', type: 'text' as const },
  { value: 'project_id', label: 'Project ID', type: 'text' as const },
  { value: 'app_id', label: 'App ID', type: 'text' as const },
  { value: 'merchant_id', label: 'Merchant ID', type: 'text' as const },
  { value: 'publishable_key', label: 'Publishable Key', type: 'text' as const },
  { value: 'secret_api_key', label: 'Secret API Key', type: 'secret' as const },
  { value: 'test_key', label: 'Test Key', type: 'secret' as const },
  { value: 'live_key', label: 'Live Key', type: 'secret' as const },
  { value: 'pin', label: 'PIN', type: 'secret' as const },
  { value: 'security_question', label: 'Security Question', type: 'text' as const },
  { value: 'security_answer', label: 'Security Answer', type: 'secret' as const },
  { value: 'recovery_code', label: 'Recovery Code', type: 'secret' as const },
  { value: 'backup_code', label: 'Backup Code', type: 'secret' as const },
  { value: 'custom', label: 'Custom Field', type: 'text' as const },
];

export default function Vault() {
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);
  const [credentials, setCredentials] = useState<CredentialMasked[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Master password states
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingCredential, setEditingCredential] = useState<CredentialDecrypted | null>(null);
  const [viewingCredential, setViewingCredential] = useState<CredentialDecrypted | null>(null);

  // Form state
  const [formData, setFormData] = useState<CredentialCreate>({
    name: '',
    service_url: '',
    category: 'other',
    username: '',
    password: '',
    notes: '',
    purpose: '',
    custom_fields: [],
  });

  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // View mode and favorites (persisted in localStorage)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    const saved = localStorage.getItem('vault-view-mode');
    return (saved as 'list' | 'grid') || 'list';
  });
  const [favorites, setFavorites] = useState<number[]>(() => {
    const saved = localStorage.getItem('vault-favorites');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    loadVaultStatus();
  }, []);

  useEffect(() => {
    if (vaultStatus?.is_unlocked) {
      loadCredentials();
    }
  }, [vaultStatus?.is_unlocked]);

  // Persist view mode and favorites
  useEffect(() => {
    localStorage.setItem('vault-view-mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('vault-favorites', JSON.stringify(favorites));
  }, [favorites]);

  const loadVaultStatus = async () => {
    try {
      const status = await getVaultStatus();
      setVaultStatus(status);
      setLoading(false);
    } catch (err) {
      setError('Failed to load vault status');
      setLoading(false);
    }
  };

  const loadCredentials = async () => {
    try {
      const creds = await getCredentials();
      setCredentials(creds);
    } catch (err) {
      setError('Failed to load credentials');
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (masterPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    if (masterPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    try {
      const status = await setupVault(masterPassword);
      setVaultStatus(status);
      setMasterPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError('Failed to set up vault');
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    try {
      const status = await unlockVault(masterPassword);
      setVaultStatus(status);
      setMasterPassword('');
    } catch (err) {
      setPasswordError('Invalid master password');
    }
  };

  const handleLock = async () => {
    try {
      const status = await lockVault();
      setVaultStatus(status);
      setCredentials([]);
      setViewingCredential(null);
    } catch (err) {
      setError('Failed to lock vault');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingCredential) {
        await updateCredential(editingCredential.id, formData);
      } else {
        await createCredential(formData);
      }

      await loadCredentials();
      closeModal();
    } catch (err) {
      setError('Failed to save credential');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCredential(id);
      await loadCredentials();
      if (viewingCredential?.id === id) {
        setViewingCredential(null);
      }
    } catch (err) {
      setError('Failed to delete credential');
    }
  };

  const handleView = async (id: number) => {
    try {
      const credential = await getCredential(id);
      setViewingCredential(credential);
    } catch (err) {
      setError('Failed to load credential details');
    }
  };

  const handleEdit = async (id: number) => {
    try {
      const credential = await getCredential(id);
      setEditingCredential(credential);
      setFormData({
        name: credential.name,
        service_url: credential.service_url || '',
        category: credential.category,
        username: credential.username || '',
        password: credential.password || '',
        notes: credential.notes || '',
        purpose: credential.purpose || '',
        custom_fields: credential.custom_fields || [],
      });
      setShowModal(true);
    } catch (err) {
      setError('Failed to load credential for editing');
    }
  };

  const handleCopy = async (id: number, field: 'username' | 'password') => {
    try {
      const result = await copyCredentialField(id, field);
      if (result.value) {
        await navigator.clipboard.writeText(result.value);
        setCopiedField(`${id}-${field}`);
        setTimeout(() => setCopiedField(null), 2000);
      }
    } catch (err) {
      setError('Failed to copy');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCredential(null);
    setFormData({
      name: '',
      service_url: '',
      category: 'other',
      username: '',
      password: '',
      notes: '',
      purpose: '',
      custom_fields: [],
    });
    setShowFormPassword(false);
  };

  const filteredCredentials = credentials.filter(cred => {
    const matchesSearch = !searchQuery ||
      cred.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cred.service_url?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !selectedCategory || cred.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryInfo = (category: string) => {
    return categories.find(c => c.value === category) || categories[categories.length - 1];
  };

  const getCategoryIcon = (category: string) => {
    return getCategoryInfo(category).icon;
  };

  const toggleFavorite = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFavorites(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const isFavorite = (id: number) => favorites.includes(id);

  // Separate favorites and regular credentials
  const favoriteCredentials = filteredCredentials.filter(c => favorites.includes(c.id));
  const regularCredentials = filteredCredentials.filter(c => !favorites.includes(c.id));

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-gray-400">Loading vault...</div>
      </div>
    );
  }

  // Setup screen
  if (!vaultStatus?.is_setup) {
    return (
      <div className="p-8 max-w-md mx-auto mt-20">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Set Up Your Vault</h1>
          <p className="text-gray-400">Create a master password to secure your credentials</p>
        </div>

        <form onSubmit={handleSetup} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Master Password</label>
            <input
              type="password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[#1a1d24] border border-white/10 text-white focus:outline-none focus:border-violet-500"
              placeholder="At least 8 characters"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[#1a1d24] border border-white/10 text-white focus:outline-none focus:border-violet-500"
              placeholder="Confirm your password"
              required
            />
          </div>

          {passwordError && (
            <div className="text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {passwordError}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-medium hover:opacity-90 transition"
          >
            Create Vault
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center mt-6">
          Your master password encrypts all credentials locally. If you forget it, credentials cannot be recovered.
        </p>
      </div>
    );
  }

  // Locked screen
  if (!vaultStatus?.is_unlocked) {
    return (
      <div className="p-8 max-w-md mx-auto mt-20">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-amber-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Vault Locked</h1>
          <p className="text-gray-400">Enter your master password to unlock</p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <input
              type="password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[#1a1d24] border border-white/10 text-white focus:outline-none focus:border-violet-500"
              placeholder="Master password"
              required
              autoFocus
            />
          </div>

          {passwordError && (
            <div className="text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {passwordError}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-medium hover:opacity-90 transition flex items-center justify-center gap-2"
          >
            <Unlock className="w-5 h-5" />
            Unlock Vault
          </button>
        </form>
      </div>
    );
  }

  // Unlocked - main interface
  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Unlock className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Credential Vault</h1>
            <p className="text-gray-400 text-sm">{credentials.length} credentials stored</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-[#1a1d24] rounded-lg border border-white/10 p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition ${
                viewMode === 'list' ? 'bg-violet-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition ${
                viewMode === 'grid' ? 'bg-violet-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-600 transition flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
          <button
            onClick={handleLock}
            className="px-4 py-2 rounded-lg bg-[#1a1d24] border border-white/10 text-gray-300 hover:text-white hover:border-amber-500/50 transition flex items-center gap-2"
          >
            <Lock className="w-5 h-5" />
            Lock
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search credentials..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#1a1d24] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              !selectedCategory ? 'bg-violet-500 text-white' : 'bg-[#1a1d24] text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1 ${
                selectedCategory === cat.value ? 'bg-violet-500 text-white' : 'bg-[#1a1d24] text-gray-400 hover:text-white'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Credentials List/Grid */}
      <div className="space-y-6">
        {/* Favorites Section */}
        {favoriteCredentials.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wide">Favorites</h2>
              <span className="text-xs text-gray-500">({favoriteCredentials.length})</span>
            </div>
            {viewMode === 'list' ? (
              <div className="space-y-1">
                {favoriteCredentials.map(cred => {
                  const cat = getCategoryInfo(cred.category);
                  return (
                    <div
                      key={cred.id}
                      onClick={() => handleView(cred.id)}
                      className={`flex items-center gap-4 px-4 py-3 rounded-lg bg-[#1a1d24] border-l-4 ${cat.border} border border-white/5 hover:border-white/20 cursor-pointer transition group`}
                    >
                      <span className="text-xl">{cat.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white truncate">{cred.name}</h3>
                        {cred.service_url && (
                          <span className="text-xs text-gray-500 truncate block">
                            {new URL(cred.service_url).hostname}
                          </span>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${cat.bg} ${cat.text}`}>
                        {cat.label}
                      </span>
                      {/* Indicators */}
                      <div className="flex items-center gap-1.5">
                        {cred.has_totp && <span title="2FA"><Shield className="w-3.5 h-3.5 text-violet-400" /></span>}
                        {cred.has_custom_fields && <span title={`${cred.custom_field_count} fields`}><Key className="w-3.5 h-3.5 text-cyan-400" /></span>}
                        {cred.has_notes && <span title="Has notes"><FileText className="w-3.5 h-3.5 text-gray-500" /></span>}
                      </div>
                      {/* Hover Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopy(cred.id, 'username'); }}
                          className={`p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 ${copiedField === `${cred.id}-username` ? 'text-emerald-400' : ''}`}
                          title="Copy username"
                        >
                          <User className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopy(cred.id, 'password'); }}
                          className={`p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 ${copiedField === `${cred.id}-password` ? 'text-emerald-400' : ''}`}
                          title="Copy password"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => toggleFavorite(cred.id, e)}
                          className="p-1.5 rounded text-amber-400 hover:bg-white/10"
                          title="Remove from favorites"
                        >
                          <Star className="w-4 h-4 fill-amber-400" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(cred.id); }}
                          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {favoriteCredentials.map(cred => {
                  const cat = getCategoryInfo(cred.category);
                  return (
                    <div
                      key={cred.id}
                      onClick={() => handleView(cred.id)}
                      className={`p-4 rounded-xl bg-[#1a1d24] border-l-4 ${cat.border} border border-white/5 hover:border-white/20 cursor-pointer transition group text-center`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-2xl">{cat.icon}</span>
                        <button
                          onClick={(e) => toggleFavorite(cred.id, e)}
                          className="p-1 rounded text-amber-400 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition"
                        >
                          <Star className="w-4 h-4 fill-amber-400" />
                        </button>
                      </div>
                      <h3 className="font-medium text-white text-sm truncate">{cred.name}</h3>
                      <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs ${cat.bg} ${cat.text}`}>
                        {cat.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* All Credentials Section */}
        {regularCredentials.length > 0 && (
          <div>
            {favoriteCredentials.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">All Credentials</h2>
                <span className="text-xs text-gray-500">({regularCredentials.length})</span>
              </div>
            )}
            {viewMode === 'list' ? (
              <div className="space-y-1">
                {regularCredentials.map(cred => {
                  const cat = getCategoryInfo(cred.category);
                  return (
                    <div
                      key={cred.id}
                      onClick={() => handleView(cred.id)}
                      className={`flex items-center gap-4 px-4 py-3 rounded-lg bg-[#1a1d24] border-l-4 ${cat.border} border border-white/5 hover:border-white/20 cursor-pointer transition group`}
                    >
                      <span className="text-xl">{cat.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white truncate">{cred.name}</h3>
                        {cred.service_url && (
                          <span className="text-xs text-gray-500 truncate block">
                            {new URL(cred.service_url).hostname}
                          </span>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${cat.bg} ${cat.text}`}>
                        {cat.label}
                      </span>
                      {/* Indicators */}
                      <div className="flex items-center gap-1.5">
                        {cred.has_totp && <span title="2FA"><Shield className="w-3.5 h-3.5 text-violet-400" /></span>}
                        {cred.has_custom_fields && <span title={`${cred.custom_field_count} fields`}><Key className="w-3.5 h-3.5 text-cyan-400" /></span>}
                        {cred.has_notes && <span title="Has notes"><FileText className="w-3.5 h-3.5 text-gray-500" /></span>}
                      </div>
                      {/* Hover Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopy(cred.id, 'username'); }}
                          className={`p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 ${copiedField === `${cred.id}-username` ? 'text-emerald-400' : ''}`}
                          title="Copy username"
                        >
                          <User className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopy(cred.id, 'password'); }}
                          className={`p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 ${copiedField === `${cred.id}-password` ? 'text-emerald-400' : ''}`}
                          title="Copy password"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => toggleFavorite(cred.id, e)}
                          className="p-1.5 rounded text-gray-400 hover:text-amber-400 hover:bg-white/10"
                          title="Add to favorites"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(cred.id); }}
                          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {regularCredentials.map(cred => {
                  const cat = getCategoryInfo(cred.category);
                  return (
                    <div
                      key={cred.id}
                      onClick={() => handleView(cred.id)}
                      className={`p-4 rounded-xl bg-[#1a1d24] border-l-4 ${cat.border} border border-white/5 hover:border-white/20 cursor-pointer transition group text-center`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-2xl">{cat.icon}</span>
                        <button
                          onClick={(e) => toggleFavorite(cred.id, e)}
                          className="p-1 rounded text-gray-400 hover:text-amber-400 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      </div>
                      <h3 className="font-medium text-white text-sm truncate">{cred.name}</h3>
                      <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs ${cat.bg} ${cat.text}`}>
                        {cat.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {filteredCredentials.length === 0 && (
          <div className="py-20 text-center">
            <Shield className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-400 mb-2">
              {searchQuery || selectedCategory ? 'No matching credentials' : 'No credentials yet'}
            </h3>
            <p className="text-gray-500 text-sm">
              {searchQuery || selectedCategory ? 'Try adjusting your search or filters' : 'Add your first credential to get started'}
            </p>
          </div>
        )}
      </div>

      {/* View Credential Sidebar */}
      {viewingCredential && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
          <div
            className="absolute inset-0"
            onClick={() => setViewingCredential(null)}
          />
          <div className="relative w-full max-w-md bg-[#1a1d24] border-l border-white/10 h-full overflow-y-auto">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Credential Details</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleFavorite(viewingCredential.id)}
                  className={`p-2 rounded-lg transition ${
                    isFavorite(viewingCredential.id)
                      ? 'text-amber-400 hover:bg-amber-500/10'
                      : 'text-gray-400 hover:text-amber-400 hover:bg-white/10'
                  }`}
                  title={isFavorite(viewingCredential.id) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star className={`w-5 h-5 ${isFavorite(viewingCredential.id) ? 'fill-amber-400' : ''}`} />
                </button>
                <button
                  onClick={() => setViewingCredential(null)}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <span className="text-4xl">{getCategoryIcon(viewingCredential.category)}</span>
                <div>
                  <h3 className="text-xl font-bold text-white">{viewingCredential.name}</h3>
                  <span className="text-sm text-gray-500 capitalize">{viewingCredential.category}</span>
                </div>
              </div>

              {viewingCredential.service_url && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">URL</label>
                  <a
                    href={viewingCredential.service_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline"
                  >
                    {viewingCredential.service_url}
                  </a>
                </div>
              )}

              {viewingCredential.username && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Username</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-white font-mono">
                      {viewingCredential.username}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(viewingCredential.username!);
                        setCopiedField('view-username');
                        setTimeout(() => setCopiedField(null), 2000);
                      }}
                      className={`p-2 rounded-lg ${
                        copiedField === 'view-username' ? 'text-emerald-400' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {viewingCredential.password && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Password</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-white font-mono">
                      {showPassword ? viewingCredential.password : '••••••••••••'}
                    </code>
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-2 rounded-lg text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(viewingCredential.password!);
                        setCopiedField('view-password');
                        setTimeout(() => setCopiedField(null), 2000);
                      }}
                      className={`p-2 rounded-lg ${
                        copiedField === 'view-password' ? 'text-emerald-400' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {viewingCredential.notes && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Notes</label>
                  <div className="px-3 py-2 rounded-lg bg-white/5 text-gray-300 whitespace-pre-wrap">
                    {viewingCredential.notes}
                  </div>
                </div>
              )}

              {viewingCredential.totp_secret && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">2FA Secret</label>
                  <code className="block px-3 py-2 rounded-lg bg-white/5 text-violet-400 font-mono text-sm break-all">
                    {viewingCredential.totp_secret}
                  </code>
                </div>
              )}

              {/* Custom Fields Display */}
              {viewingCredential.custom_fields && viewingCredential.custom_fields.length > 0 && (
                <div className="pt-4 border-t border-white/10">
                  <label className="block text-xs text-gray-500 mb-3">Additional Fields</label>
                  <div className="space-y-3">
                    {viewingCredential.custom_fields.map((field, index) => (
                      <div key={index}>
                        <label className="block text-xs text-gray-500 mb-1">{field.name}</label>
                        <div className="flex items-center gap-2">
                          {field.type === 'secret' ? (
                            <>
                              <code className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-white font-mono text-sm break-all">
                                {showPassword ? field.value : '••••••••••••'}
                              </code>
                              <button
                                onClick={() => setShowPassword(!showPassword)}
                                className="p-2 rounded-lg text-gray-400 hover:text-white"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </>
                          ) : field.type === 'url' ? (
                            <a
                              href={field.value}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-cyan-400 hover:underline break-all"
                            >
                              {field.value}
                            </a>
                          ) : (
                            <code className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-white font-mono text-sm break-all">
                              {field.value}
                            </code>
                          )}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(field.value);
                              setCopiedField(`view-custom-${index}`);
                              setTimeout(() => setCopiedField(null), 2000);
                            }}
                            className={`p-2 rounded-lg ${
                              copiedField === `view-custom-${index}` ? 'text-emerald-400' : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-white/10 flex items-center gap-3">
                <button
                  onClick={() => {
                    handleEdit(viewingCredential.id);
                    setViewingCredential(null);
                  }}
                  className="flex-1 py-2 rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-600 transition flex items-center justify-center gap-2"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    handleDelete(viewingCredential.id);
                    setViewingCredential(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 font-medium hover:bg-red-500/20 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1d24] rounded-2xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {editingCredential ? 'Edit Credential' : 'Add Credential'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                  placeholder="e.g., Bank of America"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">URL</label>
                <input
                  type="url"
                  value={formData.service_url || ''}
                  onChange={(e) => setFormData({ ...formData, service_url: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value} className="bg-[#1a1d24] text-white">
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Username</label>
                <input
                  type="text"
                  value={formData.username || ''}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                  placeholder="Username or email"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showFormPassword ? 'text' : 'password'}
                    value={formData.password || ''}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 pr-10 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword(!showFormPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Notes</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500 resize-none"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Purpose</label>
                <input
                  type="text"
                  value={formData.purpose || ''}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                  placeholder="What is this credential for?"
                />
              </div>

              {/* Custom Fields */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400">Additional Fields</label>
                  <div className="relative">
                    <select
                      className="text-xs px-2 py-1.5 pr-6 rounded bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 appearance-none cursor-pointer border-none focus:outline-none focus:ring-1 focus:ring-violet-500"
                      value=""
                      onChange={(e) => {
                        const fieldType = predefinedFieldTypes.find(f => f.value === e.target.value);
                        if (fieldType) {
                          const newField: CustomField = {
                            name: fieldType.value === 'custom' ? '' : fieldType.label,
                            value: '',
                            type: fieldType.type
                          };
                          setFormData({
                            ...formData,
                            custom_fields: [...(formData.custom_fields || []), newField]
                          });
                        }
                      }}
                    >
                      <option value="" className="bg-[#1a1d24] text-white">+ Add Field</option>
                      <optgroup label="API & Authentication" className="bg-[#1a1d24] text-gray-400">
                        <option value="api_key" className="bg-[#1a1d24] text-white">API Key</option>
                        <option value="client_id" className="bg-[#1a1d24] text-white">Client ID</option>
                        <option value="client_secret" className="bg-[#1a1d24] text-white">Client Secret</option>
                        <option value="bearer_token" className="bg-[#1a1d24] text-white">Bearer Token</option>
                        <option value="oauth_token" className="bg-[#1a1d24] text-white">OAuth Token</option>
                        <option value="refresh_token" className="bg-[#1a1d24] text-white">Refresh Token</option>
                      </optgroup>
                      <optgroup label="AWS / Cloud" className="bg-[#1a1d24] text-gray-400">
                        <option value="access_key" className="bg-[#1a1d24] text-white">Access Key</option>
                        <option value="secret_key" className="bg-[#1a1d24] text-white">Secret Access Key</option>
                        <option value="account_id" className="bg-[#1a1d24] text-white">Account ID</option>
                        <option value="tenant_id" className="bg-[#1a1d24] text-white">Tenant ID</option>
                        <option value="project_id" className="bg-[#1a1d24] text-white">Project ID</option>
                      </optgroup>
                      <optgroup label="Keys & Encryption" className="bg-[#1a1d24] text-gray-400">
                        <option value="ssh_key" className="bg-[#1a1d24] text-white">SSH Private Key</option>
                        <option value="ssh_public" className="bg-[#1a1d24] text-white">SSH Public Key</option>
                        <option value="private_key" className="bg-[#1a1d24] text-white">Private Key</option>
                        <option value="public_key" className="bg-[#1a1d24] text-white">Public Key</option>
                        <option value="encryption_key" className="bg-[#1a1d24] text-white">Encryption Key</option>
                        <option value="signing_key" className="bg-[#1a1d24] text-white">Signing Key</option>
                      </optgroup>
                      <optgroup label="Payment / Stripe" className="bg-[#1a1d24] text-gray-400">
                        <option value="publishable_key" className="bg-[#1a1d24] text-white">Publishable Key</option>
                        <option value="secret_api_key" className="bg-[#1a1d24] text-white">Secret API Key</option>
                        <option value="test_key" className="bg-[#1a1d24] text-white">Test Key</option>
                        <option value="live_key" className="bg-[#1a1d24] text-white">Live Key</option>
                        <option value="merchant_id" className="bg-[#1a1d24] text-white">Merchant ID</option>
                        <option value="webhook_secret" className="bg-[#1a1d24] text-white">Webhook Secret</option>
                      </optgroup>
                      <optgroup label="Security / Recovery" className="bg-[#1a1d24] text-gray-400">
                        <option value="pin" className="bg-[#1a1d24] text-white">PIN</option>
                        <option value="security_question" className="bg-[#1a1d24] text-white">Security Question</option>
                        <option value="security_answer" className="bg-[#1a1d24] text-white">Security Answer</option>
                        <option value="recovery_code" className="bg-[#1a1d24] text-white">Recovery Code</option>
                        <option value="backup_code" className="bg-[#1a1d24] text-white">Backup Code</option>
                      </optgroup>
                      <optgroup label="Other" className="bg-[#1a1d24] text-gray-400">
                        <option value="app_id" className="bg-[#1a1d24] text-white">App ID</option>
                        <option value="custom" className="bg-[#1a1d24] text-white">Custom Field...</option>
                      </optgroup>
                    </select>
                    <Plus className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-violet-300 pointer-events-none" />
                  </div>
                </div>

                {formData.custom_fields && formData.custom_fields.length > 0 && (
                  <div className="space-y-3">
                    {formData.custom_fields.map((field, index) => (
                      <div key={index} className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={field.name}
                            onChange={(e) => {
                              const updated = [...(formData.custom_fields || [])];
                              updated[index] = { ...updated[index], name: e.target.value };
                              setFormData({ ...formData, custom_fields: updated });
                            }}
                            className="flex-1 px-3 py-1.5 text-sm rounded bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                            placeholder="Field name"
                          />
                          <select
                            value={field.type}
                            onChange={(e) => {
                              const updated = [...(formData.custom_fields || [])];
                              updated[index] = { ...updated[index], type: e.target.value as CustomField['type'] };
                              setFormData({ ...formData, custom_fields: updated });
                            }}
                            className="px-2 py-1.5 text-sm rounded bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                          >
                            <option value="text" className="bg-[#1a1d24] text-white">Text</option>
                            <option value="secret" className="bg-[#1a1d24] text-white">Secret</option>
                            <option value="url" className="bg-[#1a1d24] text-white">URL</option>
                            <option value="date" className="bg-[#1a1d24] text-white">Date</option>
                            <option value="dropdown" className="bg-[#1a1d24] text-white">Dropdown</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = formData.custom_fields?.filter((_, i) => i !== index) || [];
                              setFormData({ ...formData, custom_fields: updated });
                            }}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {field.type === 'secret' ? (
                          <input
                            type="password"
                            value={field.value}
                            onChange={(e) => {
                              const updated = [...(formData.custom_fields || [])];
                              updated[index] = { ...updated[index], value: e.target.value };
                              setFormData({ ...formData, custom_fields: updated });
                            }}
                            className="w-full px-3 py-1.5 text-sm rounded bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                            placeholder="Secret value"
                          />
                        ) : field.type === 'date' ? (
                          <input
                            type="date"
                            value={field.value}
                            onChange={(e) => {
                              const updated = [...(formData.custom_fields || [])];
                              updated[index] = { ...updated[index], value: e.target.value };
                              setFormData({ ...formData, custom_fields: updated });
                            }}
                            className="w-full px-3 py-1.5 text-sm rounded bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                          />
                        ) : field.type === 'dropdown' ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={field.options?.join(', ') || ''}
                              onChange={(e) => {
                                const updated = [...(formData.custom_fields || [])];
                                updated[index] = {
                                  ...updated[index],
                                  options: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                                };
                                setFormData({ ...formData, custom_fields: updated });
                              }}
                              className="w-full px-3 py-1.5 text-sm rounded bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                              placeholder="Options (comma-separated)"
                            />
                            {field.options && field.options.length > 0 && (
                              <select
                                value={field.value}
                                onChange={(e) => {
                                  const updated = [...(formData.custom_fields || [])];
                                  updated[index] = { ...updated[index], value: e.target.value };
                                  setFormData({ ...formData, custom_fields: updated });
                                }}
                                className="w-full px-3 py-1.5 text-sm rounded bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                              >
                                <option value="" className="bg-[#1a1d24] text-white">Select...</option>
                                {field.options.map((opt, i) => (
                                  <option key={i} value={opt} className="bg-[#1a1d24] text-white">{opt}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        ) : (
                          <input
                            type={field.type === 'url' ? 'url' : 'text'}
                            value={field.value}
                            onChange={(e) => {
                              const updated = [...(formData.custom_fields || [])];
                              updated[index] = { ...updated[index], value: e.target.value };
                              setFormData({ ...formData, custom_fields: updated });
                            }}
                            className="w-full px-3 py-1.5 text-sm rounded bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                            placeholder={field.type === 'url' ? 'https://...' : 'Value'}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2 rounded-lg bg-white/5 text-gray-300 font-medium hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-600 transition"
                >
                  {editingCredential ? 'Save Changes' : 'Add Credential'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 px-4 py-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-300 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
