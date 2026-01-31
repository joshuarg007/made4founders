import { useState, useEffect } from 'react';
import {
  Building2,
  Key,
  FileText,
  Eye,
  EyeOff,
  Copy,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Shield,
  Hash,
  Lock,
} from 'lucide-react';
import CountrySelect from '../components/CountrySelect';
import StateSelect from '../components/StateSelect';
import AddressAutocomplete from '../components/AddressAutocomplete';
import { getCountryByName } from '../lib/countries';
import BusinessFilter from '../components/BusinessFilter';
import { useBusiness } from '../context/BusinessContext';

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:8001'}/api`;

interface BusinessInfo {
  id: number;
  legal_name: string | null;
  dba_name: string | null;
  entity_type: string | null;
  formation_state: string | null;
  formation_date: string | null;
  fiscal_year_end: string | null;
  industry: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string;
}

interface BusinessIdentifier {
  id: number;
  identifier_type: string;
  label: string;
  masked_value: string;
  business_id: number | null;
  issuing_authority: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  notes: string | null;
}

interface Document {
  id: number;
  name: string;
  category: string;
  file_path: string | null;
  external_url: string | null;
  description: string | null;
}

const ENTITY_TYPES = ['LLC', 'C-Corp', 'S-Corp', 'Sole Proprietorship', 'Partnership', 'Non-Profit'];
const IDENTIFIER_TYPES = [
  { value: 'ein', label: 'EIN (Federal Tax ID)' },
  { value: 'duns', label: 'D-U-N-S Number' },
  { value: 'state_id', label: 'State Tax ID' },
  { value: 'business_license', label: 'Business License #' },
  { value: 'other', label: 'Other' }
];

export default function Library() {
  const { businesses } = useBusiness();
  const [businessFilter, setBusinessFilter] = useState<number[] | 'all' | 'none'>('all');
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [identifiers, setIdentifiers] = useState<BusinessIdentifier[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState<Partial<BusinessInfo>>({});
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set());
  const [revealedValues, setRevealedValues] = useState<Record<number, string>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showAddIdentifier, setShowAddIdentifier] = useState(false);
  const [newIdentifier, setNewIdentifier] = useState({
    identifier_type: 'ein',
    label: '',
    value: '',
    business_id: null as number | null,
    issuing_authority: '',
    notes: ''
  });

  // Password verification for viewing identifiers
  const [isIdentifiersUnlocked, setIsIdentifiersUnlocked] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [pendingRevealId, setPendingRevealId] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [infoRes, identifiersRes, docsRes] = await Promise.all([
        fetch(`${API_BASE}/business-info`, { credentials: 'include' }),
        fetch(`${API_BASE}/business-identifiers`, { credentials: 'include' }),
        fetch(`${API_BASE}/documents?category=formation`, { credentials: 'include' })
      ]);

      if (infoRes.ok) {
        const info = await infoRes.json();
        setBusinessInfo(info);
        setInfoForm(info);
      }

      if (identifiersRes.ok) {
        setIdentifiers(await identifiersRes.json());
      }

      if (docsRes.ok) {
        setDocuments(await docsRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveBusinessInfo = async () => {
    try {
      // Convert date string to ISO datetime format for backend
      const payload = {
        ...infoForm,
        formation_date: infoForm.formation_date
          ? `${infoForm.formation_date}T00:00:00`
          : null
      };
      const res = await fetch(`${API_BASE}/business-info`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setBusinessInfo(await res.json());
        setEditingInfo(false);
      }
    } catch (error) {
      console.error('Failed to save business info:', error);
    }
  };

  const revealIdentifier = async (id: number) => {
    if (revealedIds.has(id)) {
      setRevealedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }

    // Require password verification if not unlocked
    if (!isIdentifiersUnlocked) {
      setPendingRevealId(id);
      setShowPasswordModal(true);
      setPasswordInput('');
      setPasswordError('');
      return;
    }

    await fetchIdentifierValue(id);
  };

  const fetchIdentifierValue = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/business-identifiers/${id}/value`, { credentials: 'include' });
      if (res.ok) {
        const { value } = await res.json();
        setRevealedValues(prev => ({ ...prev, [id]: value }));
        setRevealedIds(prev => new Set([...prev, id]));
      }
    } catch (error) {
      console.error('Failed to reveal identifier:', error);
    }
  };

  const handlePasswordVerify = async () => {
    if (!passwordInput.trim()) {
      setPasswordError('Please enter your password');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: passwordInput })
      });

      if (res.ok) {
        setIsIdentifiersUnlocked(true);
        setShowPasswordModal(false);
        setPasswordInput('');
        setPasswordError('');

        // Auto-reveal the pending identifier
        if (pendingRevealId !== null) {
          await fetchIdentifierValue(pendingRevealId);
          setPendingRevealId(null);
        }
      } else {
        setPasswordError('Incorrect password');
      }
    } catch (error) {
      console.error('Failed to verify password:', error);
      setPasswordError('Verification failed. Please try again.');
    }
  };

  const copyIdentifier = async (id: number) => {
    try {
      let value = revealedValues[id];
      if (!value) {
        const res = await fetch(`${API_BASE}/business-identifiers/${id}/value`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          value = data.value;
        }
      }
      if (value) {
        await navigator.clipboard.writeText(value);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch (error) {
      console.error('Failed to copy identifier:', error);
    }
  };

  const addIdentifier = async () => {
    try {
      const res = await fetch(`${API_BASE}/business-identifiers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newIdentifier)
      });
      if (res.ok) {
        setShowAddIdentifier(false);
        setNewIdentifier({
          identifier_type: 'ein',
          label: '',
          value: '',
          business_id: null,
          issuing_authority: '',
          notes: ''
        });
        fetchData();
      }
    } catch (error) {
      console.error('Failed to add identifier:', error);
    }
  };

  const deleteIdentifier = async (id: number) => {
    if (!confirm('Are you sure you want to delete this identifier?')) return;
    try {
      const res = await fetch(`${API_BASE}/business-identifiers/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to delete identifier:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  // Filter identifiers based on business filter
  const filteredIdentifiers = identifiers.filter(ident => {
    if (businessFilter === 'all') return true;
    if (businessFilter === 'none') return ident.business_id === null;
    if (Array.isArray(businessFilter)) {
      return ident.business_id !== null && businessFilter.includes(ident.business_id);
    }
    return true;
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Business Library</h1>
          <p className="text-gray-400">Manage your business information, identifiers, and formation documents</p>
        </div>
        {businesses.length > 0 && (
          <BusinessFilter
            value={businessFilter}
            onChange={setBusinessFilter}
            showNoBusiness
          />
        )}
      </div>

      {/* Business Information Card */}
      <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-cyan-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Business Information</h2>
          </div>
          {!editingInfo ? (
            <button
              onClick={() => setEditingInfo(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingInfo(false);
                  setInfoForm(businessInfo || {});
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={saveBusinessInfo}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
              >
                <Check className="w-4 h-4" />
                Save
              </button>
            </div>
          )}
        </div>

        {editingInfo ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Legal Name</label>
              <input
                type="text"
                value={infoForm.legal_name || ''}
                onChange={(e) => setInfoForm({ ...infoForm, legal_name: e.target.value })}
                className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">DBA (Doing Business As)</label>
              <input
                type="text"
                value={infoForm.dba_name || ''}
                onChange={(e) => setInfoForm({ ...infoForm, dba_name: e.target.value })}
                className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Entity Type</label>
              <select
                value={infoForm.entity_type || ''}
                onChange={(e) => setInfoForm({ ...infoForm, entity_type: e.target.value })}
                className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
              >
                <option value="" className="bg-[#1a1d24] text-white">Select...</option>
                {ENTITY_TYPES.map(type => (
                  <option key={type} value={type} className="bg-[#1a1d24] text-white">{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Formation State</label>
              <StateSelect
                value={infoForm.formation_state || ''}
                countryCode="US"
                onChange={(_code, name) => setInfoForm({ ...infoForm, formation_state: name })}
                placeholder="Select state..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Formation Date</label>
              <input
                type="date"
                value={infoForm.formation_date?.split('T')[0] || ''}
                onChange={(e) => setInfoForm({ ...infoForm, formation_date: e.target.value })}
                className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Industry</label>
              <input
                type="text"
                value={infoForm.industry || ''}
                onChange={(e) => setInfoForm({ ...infoForm, industry: e.target.value })}
                className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Address</label>
              <AddressAutocomplete
                value={infoForm.address_line1 || ''}
                onChange={(value) => setInfoForm({ ...infoForm, address_line1: value })}
                onAddressSelect={(parsed) => {
                  setInfoForm({
                    ...infoForm,
                    address_line1: parsed.address,
                    city: parsed.city,
                    state: parsed.state,
                    zip_code: parsed.postalCode,
                    country: parsed.country,
                  });
                }}
                placeholder="Start typing an address..."
                className="mb-2"
              />
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="text"
                  value={infoForm.city || ''}
                  onChange={(e) => setInfoForm({ ...infoForm, city: e.target.value })}
                  placeholder="City"
                  className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
                />
                <input
                  type="text"
                  value={infoForm.zip_code || ''}
                  onChange={(e) => setInfoForm({ ...infoForm, zip_code: e.target.value })}
                  placeholder="ZIP / Postal Code"
                  className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <CountrySelect
                  value={infoForm.country || 'United States'}
                  onChange={(_code, name) => setInfoForm({ ...infoForm, country: name, state: '' })}
                  placeholder="Select country..."
                />
                <StateSelect
                  value={infoForm.state || ''}
                  countryCode={getCountryByName(infoForm.country || 'United States')?.code || 'US'}
                  onChange={(_code, name) => setInfoForm({ ...infoForm, state: name })}
                  placeholder="State/Province"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-gray-500 mb-1">Legal Name</div>
              <div className="text-white">{businessInfo?.legal_name || '—'}</div>
            </div>
            {businessInfo?.dba_name && (
              <div>
                <div className="text-sm text-gray-500 mb-1">DBA</div>
                <div className="text-white">{businessInfo.dba_name}</div>
              </div>
            )}
            <div>
              <div className="text-sm text-gray-500 mb-1">Entity Type</div>
              <div className="text-white">{businessInfo?.entity_type || '—'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Formation</div>
              <div className="text-white">
                {businessInfo?.formation_state || businessInfo?.formation_date ? (
                  <>
                    {businessInfo?.formation_state}
                    {businessInfo?.formation_date && (
                      <span className={businessInfo?.formation_state ? "text-gray-400 ml-2" : ""}>
                        {businessInfo?.formation_state ? '(' : ''}{new Date(businessInfo.formation_date).toLocaleDateString()}{businessInfo?.formation_state ? ')' : ''}
                      </span>
                    )}
                  </>
                ) : '—'}
              </div>
            </div>
            {businessInfo?.industry && (
              <div>
                <div className="text-sm text-gray-500 mb-1">Industry</div>
                <div className="text-white">{businessInfo.industry}</div>
              </div>
            )}
            {businessInfo?.address_line1 && (
              <div className="md:col-span-2">
                <div className="text-sm text-gray-500 mb-1">Address</div>
                <div className="text-white">
                  {businessInfo.address_line1}
                  {businessInfo.city && `, ${businessInfo.city}`}
                  {businessInfo.state && `, ${businessInfo.state}`}
                  {businessInfo.zip_code && ` ${businessInfo.zip_code}`}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Business Identifiers Card */}
      <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-500/10 flex items-center justify-center">
              <Key className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Business Identifiers</h2>
              <p className="text-sm text-gray-500">EIN, D-U-N-S, State IDs, and other numbers</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddIdentifier(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-violet-500/20 text-violet-400 rounded-lg hover:bg-violet-500/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        {/* Add Identifier Form */}
        {showAddIdentifier && (
          <div className="bg-[#0f1117] rounded-lg p-4 mb-4 border border-white/10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Type</label>
                <select
                  value={newIdentifier.identifier_type}
                  onChange={(e) => setNewIdentifier({ ...newIdentifier, identifier_type: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1d24] border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-500/50"
                >
                  {IDENTIFIER_TYPES.map(type => (
                    <option key={type.value} value={type.value} className="bg-[#1a1d24] text-white">{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Label</label>
                <input
                  type="text"
                  value={newIdentifier.label}
                  onChange={(e) => setNewIdentifier({ ...newIdentifier, label: e.target.value })}
                  placeholder="e.g., Federal EIN"
                  className="w-full px-3 py-2 bg-[#1a1d24] border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Value</label>
                <input
                  type="text"
                  value={newIdentifier.value}
                  onChange={(e) => setNewIdentifier({ ...newIdentifier, value: e.target.value })}
                  placeholder="e.g., 12-3456789"
                  className="w-full px-3 py-2 bg-[#1a1d24] border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Issuing Authority</label>
                <input
                  type="text"
                  value={newIdentifier.issuing_authority}
                  onChange={(e) => setNewIdentifier({ ...newIdentifier, issuing_authority: e.target.value })}
                  placeholder="e.g., IRS, State of Delaware"
                  className="w-full px-3 py-2 bg-[#1a1d24] border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-500/50"
                />
              </div>
              {businesses.length > 0 && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Business</label>
                  <select
                    value={newIdentifier.business_id ?? ''}
                    onChange={(e) => setNewIdentifier({ ...newIdentifier, business_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-3 py-2 bg-[#1a1d24] border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-500/50"
                  >
                    <option value="" className="bg-[#1a1d24] text-white">No business</option>
                    {businesses.filter(b => !b.is_archived).map(b => (
                      <option key={b.id} value={b.id} className="bg-[#1a1d24] text-white">
                        {b.emoji ? `${b.emoji} ` : ''}{b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddIdentifier(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addIdentifier}
                disabled={!newIdentifier.label || !newIdentifier.value}
                className="px-4 py-2 text-sm bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Identifier
              </button>
            </div>
          </div>
        )}

        {/* Identifiers List */}
        {filteredIdentifiers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{identifiers.length === 0 ? 'No identifiers added yet' : 'No identifiers match the current filter'}</p>
            <p className="text-sm">{identifiers.length === 0 ? 'Add your EIN, D-U-N-S number, and other business IDs' : 'Try changing the business filter'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredIdentifiers.map((ident) => (
              <div
                key={ident.id}
                className="flex items-center justify-between p-4 bg-[#0f1117] rounded-lg border border-white/5"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#1a1d24]/5 flex items-center justify-center">
                    <Hash className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white">{ident.label}</span>
                      <span className="px-2 py-0.5 text-xs bg-[#1a1d24]/10 text-gray-400 rounded">
                        {IDENTIFIER_TYPES.find(t => t.value === ident.identifier_type)?.label || ident.identifier_type}
                      </span>
                      {ident.business_id && businesses.find(b => b.id === ident.business_id) && (
                        <span
                          className="px-2 py-0.5 text-xs rounded"
                          style={{
                            backgroundColor: `${businesses.find(b => b.id === ident.business_id)?.color || '#6366f1'}20`,
                            color: businesses.find(b => b.id === ident.business_id)?.color || '#6366f1',
                          }}
                        >
                          {businesses.find(b => b.id === ident.business_id)?.emoji}{' '}
                          {businesses.find(b => b.id === ident.business_id)?.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-lg font-mono text-cyan-400">
                        {revealedIds.has(ident.id) ? revealedValues[ident.id] : ident.masked_value}
                      </code>
                    </div>
                    {ident.issuing_authority && (
                      <div className="text-sm text-gray-500 mt-1">
                        Issued by: {ident.issuing_authority}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => revealIdentifier(ident.id)}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                    title={revealedIds.has(ident.id) ? 'Hide' : 'Reveal'}
                  >
                    {revealedIds.has(ident.id) ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => copyIdentifier(ident.id)}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                    title="Copy"
                  >
                    {copiedId === ident.id ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteIdentifier(ident.id)}
                    className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formation Documents */}
      <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Formation Documents</h2>
              <p className="text-sm text-gray-500">Articles of incorporation, operating agreements, etc.</p>
            </div>
          </div>
          <a
            href="/documents"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            View all documents →
          </a>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No formation documents yet</p>
            <p className="text-sm">Upload your articles of incorporation and other formation documents</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <a
                key={doc.id}
                href={doc.external_url || doc.file_path || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-[#0f1117] rounded-lg border border-white/5 hover:border-white/20 transition-colors"
              >
                <FileText className="w-5 h-5 text-amber-400" />
                <div className="flex-1">
                  <div className="text-white">{doc.name}</div>
                  {doc.description && (
                    <div className="text-sm text-gray-500">{doc.description}</div>
                  )}
                </div>
                {doc.external_url && (
                  <span className="text-xs text-gray-500">External link</span>
                )}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Password Verification Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPasswordModal(false)}>
          <div
            className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-500/10 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Verify Identity</h2>
                  <p className="text-sm text-gray-500">Enter your password to view sensitive data</p>
                </div>
              </div>
              <button onClick={() => setShowPasswordModal(false)}>
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Password</label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handlePasswordVerify()}
                  placeholder="Enter your account password"
                  className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-500/50"
                  autoFocus
                />
                {passwordError && (
                  <p className="mt-2 text-sm text-red-400">{passwordError}</p>
                )}
              </div>
              <p className="text-xs text-gray-500">
                For security, you need to verify your identity before viewing business identifiers like EIN, D-U-N-S, etc.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordVerify}
                  className="px-4 py-2 text-sm bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition"
                >
                  Verify & View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
