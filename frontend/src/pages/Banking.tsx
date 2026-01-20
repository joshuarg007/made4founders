import { useEffect, useState } from 'react';
import {
  Plus,
  Building2,
  Pencil,
  Trash2,
  Star,
  ExternalLink,
  Loader2,
  Calculator,
  Check,
  RefreshCw,
  X,
} from 'lucide-react';
import { getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount, type BankAccount } from '../lib/api';
import api from '../lib/api';
import ResizableModal from '../components/ResizableModal';

// Accounting Software Providers
const ACCOUNTING_PROVIDERS = [
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Most popular accounting software',
    color: 'bg-[#2CA01C]',
    hoverColor: 'hover:bg-[#238a15]',
    logo: '/logos/quickbooks.svg',
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Beautiful accounting software',
    color: 'bg-[#13B5EA]',
    hoverColor: 'hover:bg-[#0e9ac7]',
    logo: '/logos/xero.svg',
  },
  {
    id: 'freshbooks',
    name: 'FreshBooks',
    description: 'Invoicing and accounting',
    color: 'bg-[#0075DD]',
    hoverColor: 'hover:bg-[#0062ba]',
    logo: '/logos/freshbooks.svg',
  },
  {
    id: 'zoho',
    name: 'Zoho Books',
    description: 'Online accounting software',
    color: 'bg-[#E42527]',
    hoverColor: 'hover:bg-[#c11f21]',
    logo: '/logos/zoho.svg',
  },
];

interface AccountingAccount {
  id: number;
  provider: string;
  company_name: string | null;
  company_id: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
}

interface ConnectedAccounting {
  quickbooks: AccountingAccount | null;
  xero: AccountingAccount | null;
  freshbooks: AccountingAccount | null;
  zoho: AccountingAccount | null;
}

const accountTypes = [
  { value: 'checking', label: 'Checking Account', icon: '🏦' },
  { value: 'savings', label: 'Savings Account', icon: '💰' },
  { value: 'business', label: 'Business Account', icon: '🏢' },
  { value: 'coinbase', label: 'Coinbase', icon: '₿' },
  { value: 'paypal', label: 'PayPal', icon: '💳' },
  { value: 'stripe', label: 'Stripe', icon: '💸' },
  { value: 'venmo', label: 'Venmo', icon: '📱' },
  { value: 'wise', label: 'Wise', icon: '🌐' },
  { value: 'mercury', label: 'Mercury', icon: '🚀' },
  { value: 'brex', label: 'Brex', icon: '💎' },
  { value: 'other', label: 'Other', icon: '📄' },
];

const getTypeInfo = (type: string) => {
  return accountTypes.find(t => t.value === type) || accountTypes[accountTypes.length - 1];
};

export default function Banking() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState({
    account_type: 'checking',
    institution_name: '',
    account_name: '',
    account_number_last4: '',
    routing_number: '',
    account_holder: '',
    is_primary: false,
    url: '',
    icon: '',
    notes: ''
  });

  // Accounting integrations state
  const [accountingConnections, setAccountingConnections] = useState<ConnectedAccounting>({
    quickbooks: null,
    xero: null,
    freshbooks: null,
    zoho: null,
  });
  const [accountingLoading, setAccountingLoading] = useState<string | null>(null);
  const [accountingSuccess, setAccountingSuccess] = useState<string | null>(null);
  const [accountingError, setAccountingError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  const loadAccounts = async () => {
    try {
      const data = await getBankAccounts();
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAccountingConnections = async () => {
    try {
      const res = await api.get('/api/accounting/accounts');
      setAccountingConnections(res.data);
    } catch (err) {
      console.error('Failed to load accounting connections:', err);
    }
  };

  useEffect(() => {
    loadAccounts();
    loadAccountingConnections();

    // Check for OAuth callback params
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');

    if (connected) {
      setAccountingSuccess(`Successfully connected ${connected}!`);
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setAccountingSuccess(null), 5000);
      loadAccountingConnections();
    }
    if (error) {
      setAccountingError(decodeURIComponent(error));
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setAccountingError(null), 5000);
    }
  }, []);

  const handleAccountingConnect = async (provider: string) => {
    setAccountingLoading(provider);
    setAccountingError(null);
    try {
      const res = await api.get(`/api/accounting/${provider}/connect`);
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      setAccountingError(err.response?.data?.detail || `Failed to connect ${provider}`);
      setAccountingLoading(null);
    }
  };

  const handleAccountingDisconnect = async (provider: string) => {
    if (!confirm(`Disconnect ${provider}?`)) return;
    setAccountingLoading(provider);
    try {
      await api.delete(`/api/accounting/accounts/${provider}`);
      await loadAccountingConnections();
    } catch (err: any) {
      setAccountingError(err.response?.data?.detail || `Failed to disconnect ${provider}`);
    } finally {
      setAccountingLoading(null);
    }
  };

  const handleSync = async (provider: string) => {
    setSyncing(provider);
    try {
      await api.get(`/api/accounting/sync/${provider}`);
      await loadAccountingConnections();
      setAccountingSuccess(`${provider} synced successfully!`);
      setTimeout(() => setAccountingSuccess(null), 3000);
    } catch (err: any) {
      setAccountingError(err.response?.data?.detail || `Failed to sync ${provider}`);
    } finally {
      setSyncing(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAccount) {
        await updateBankAccount(editingAccount.id, formData);
      } else {
        await createBankAccount(formData);
      }
      setShowModal(false);
      setEditingAccount(null);
      resetForm();
      loadAccounts();
    } catch (err) {
      console.error('Failed to save account:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      account_type: 'checking',
      institution_name: '',
      account_name: '',
      account_number_last4: '',
      routing_number: '',
      account_holder: '',
      is_primary: false,
      url: '',
      icon: '',
      notes: ''
    });
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData({
      account_type: account.account_type,
      institution_name: account.institution_name,
      account_name: account.account_name || '',
      account_number_last4: account.account_number_last4 || '',
      routing_number: account.routing_number || '',
      account_holder: account.account_holder || '',
      is_primary: account.is_primary,
      url: account.url || '',
      icon: account.icon || '',
      notes: account.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this account?')) return;
    try {
      await deleteBankAccount(id);
      loadAccounts();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleSetPrimary = async (account: BankAccount) => {
    await updateBankAccount(account.id, { is_primary: true });
    loadAccounts();
  };

  // Group accounts by type
  const bankAccounts = accounts.filter(a => ['checking', 'savings', 'business', 'mercury', 'brex'].includes(a.account_type));
  const paymentProcessors = accounts.filter(a => ['stripe', 'paypal', 'venmo', 'wise'].includes(a.account_type));
  const cryptoAccounts = accounts.filter(a => a.account_type === 'coinbase');
  const otherAccounts = accounts.filter(a => a.account_type === 'other');

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Banking & Finance</h1>
          <p className="text-gray-400 mt-1">Manage your accounting software, financial accounts, and payment processors</p>
        </div>
      </div>

      {/* Accounting Software Integrations */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-emerald-400" />
          Accounting Software
        </h2>
        <p className="text-gray-400 text-sm mb-4">
          Connect your accounting software to sync invoices, expenses, and financial data.
        </p>

        {/* Success/Error messages */}
        {accountingSuccess && (
          <div className="mb-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 flex items-center gap-2">
            <Check className="w-5 h-5" />
            {accountingSuccess}
          </div>
        )}
        {accountingError && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
            <X className="w-5 h-5" />
            {accountingError}
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {ACCOUNTING_PROVIDERS.map((provider) => {
            const connection = accountingConnections[provider.id as keyof ConnectedAccounting];
            const isConnected = connection?.is_active;
            const isLoading = accountingLoading === provider.id;
            const isSyncing = syncing === provider.id;

            return (
              <div
                key={provider.id}
                className={`rounded-xl border p-4 transition ${
                  isConnected
                    ? `${provider.color} border-white/20 shadow-lg`
                    : 'bg-[#1a1d24] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl font-bold ${
                    isConnected ? 'bg-white/20 text-white' : `${provider.color} text-white`
                  }`}>
                    {provider.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-white block">{provider.name}</span>
                    {isConnected && connection?.company_name && (
                      <p className="text-xs text-white/70 truncate">{connection.company_name}</p>
                    )}
                    {!isConnected && (
                      <p className="text-xs text-gray-500 truncate">{provider.description}</p>
                    )}
                  </div>
                </div>

                {isConnected && connection?.last_sync_at && (
                  <p className="text-xs text-white/60 mb-3">
                    Last sync: {new Date(connection.last_sync_at).toLocaleDateString()}
                  </p>
                )}

                <div className="flex gap-2">
                  {isConnected ? (
                    <>
                      <button
                        onClick={() => handleSync(provider.id)}
                        disabled={isSyncing}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition text-sm disabled:opacity-50"
                      >
                        {isSyncing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        Sync
                      </button>
                      <button
                        onClick={() => handleAccountingDisconnect(provider.id)}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition text-sm disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleAccountingConnect(provider.id)}
                      disabled={isLoading}
                      className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg ${provider.color} ${provider.hoverColor} text-white transition text-sm font-medium disabled:opacity-50`}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bank Accounts Section Header */}
      <div className="border-t border-white/10 pt-8 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-400" />
            Bank Accounts & Payment Processors
          </h2>
          <button
            onClick={() => { setEditingAccount(null); resetForm(); setShowModal(true); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        </div>
      </div>

      {/* Empty State */}
      {accounts.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">No accounts added yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-cyan-400 hover:text-cyan-300"
          >
            Add your first account
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Bank Accounts */}
          {bankAccounts.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Bank Accounts</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bankAccounts.map(account => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onSetPrimary={handleSetPrimary}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Payment Processors */}
          {paymentProcessors.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Payment Processors</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paymentProcessors.map(account => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onSetPrimary={handleSetPrimary}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Crypto */}
          {cryptoAccounts.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Cryptocurrency</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cryptoAccounts.map(account => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onSetPrimary={handleSetPrimary}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Other */}
          {otherAccounts.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Other Accounts</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherAccounts.map(account => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onSetPrimary={handleSetPrimary}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Modal */}
      <ResizableModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingAccount ? 'Edit Account' : 'Add Account'}
        initialWidth={520}
        initialHeight={650}
        minWidth={400}
        minHeight={400}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Account Type *</label>
                <select
                  value={formData.account_type}
                  onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                >
                  {accountTypes.map(type => (
                    <option key={type.value} value={type.value} className="bg-[#1a1d24] text-white">
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Institution Name *</label>
                <input
                  type="text"
                  required
                  value={formData.institution_name}
                  onChange={(e) => setFormData({ ...formData, institution_name: e.target.value })}
                  placeholder="e.g., Chase, Bank of America, Coinbase"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Account Nickname</label>
                <input
                  type="text"
                  value={formData.account_name}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  placeholder="e.g., Main Operating Account"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Account # (Last 4)</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={formData.account_number_last4}
                    onChange={(e) => setFormData({ ...formData, account_number_last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    placeholder="1234"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Routing Number</label>
                  <input
                    type="text"
                    maxLength={9}
                    value={formData.routing_number}
                    onChange={(e) => setFormData({ ...formData, routing_number: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                    placeholder="123456789"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Account Holder</label>
                <input
                  type="text"
                  value={formData.account_holder}
                  onChange={(e) => setFormData({ ...formData, account_holder: e.target.value })}
                  placeholder="Company Name or Individual"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Login URL</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  placeholder="Additional notes..."
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 resize-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_primary}
                    onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                    className="rounded bg-white/5 border-white/10"
                  />
                  <Star className="w-4 h-4" />
                  Primary Account
                </label>
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
                  {editingAccount ? 'Save' : 'Add Account'}
                </button>
              </div>
            </form>
      </ResizableModal>
    </div>
  );
}

function AccountCard({
  account,
  onEdit,
  onDelete,
  onSetPrimary
}: {
  account: BankAccount;
  onEdit: (account: BankAccount) => void;
  onDelete: (id: number) => void;
  onSetPrimary: (account: BankAccount) => void;
}) {
  const typeInfo = getTypeInfo(account.account_type);

  return (
    <div className="p-4 rounded-xl bg-[#1a1d24] border border-white/10 hover:border-white/20 transition">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{account.icon || typeInfo.icon}</span>
          <div>
            <h3 className="font-semibold text-white">{account.institution_name}</h3>
            {account.account_name && (
              <span className="text-xs text-gray-500">{account.account_name}</span>
            )}
          </div>
        </div>
        {account.is_primary && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-xs">
            <Star className="w-3 h-3" fill="currentColor" />
            Primary
          </div>
        )}
      </div>

      <div className="space-y-1 mb-3">
        <div className="text-xs text-gray-500 capitalize">{typeInfo.label}</div>
        {account.account_number_last4 && (
          <div className="text-sm text-gray-400">
            Account: ••••{account.account_number_last4}
          </div>
        )}
        {account.routing_number && (
          <div className="text-sm text-gray-400">
            Routing: {account.routing_number}
          </div>
        )}
        {account.account_holder && (
          <div className="text-sm text-gray-400">
            Holder: {account.account_holder}
          </div>
        )}
      </div>

      {account.notes && (
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{account.notes}</p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(account)}
            className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(account.id)}
            className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-white/10 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {!account.is_primary && (
            <button
              onClick={() => onSetPrimary(account)}
              className="p-2 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-white/10 transition"
              title="Set as primary"
            >
              <Star className="w-4 h-4" />
            </button>
          )}
        </div>
        {account.url && (
          <a
            href={account.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition"
          >
            Login
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}
