import { useState, useEffect } from 'react';
import {
  Plug,
  Video,
  Mail,
  Share2,
  Calculator,
  Loader2,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  Link,
  Unlink,
} from 'lucide-react';
import api from '../lib/api';

interface IntegrationStatus {
  connected: boolean;
  user_email?: string;
  user_name?: string;
  account_name?: string;
  connected_at?: string;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  categories: string[];
  connectEndpoint?: string;
  statusEndpoint?: string;
  disconnectEndpoint?: string;
  configUrl?: string;
  status?: IntegrationStatus;
  loading?: boolean;
}

const INTEGRATIONS: Integration[] = [
  // Meetings
  {
    id: 'zoom',
    name: 'Zoom',
    description: 'Import meeting transcripts from cloud recordings',
    icon: '📹',
    color: 'blue',
    categories: ['meetings'],
    connectEndpoint: '/api/zoom/login',
    statusEndpoint: '/api/zoom/status',
    disconnectEndpoint: '/api/zoom/disconnect',
  },
  {
    id: 'google-meet',
    name: 'Google Meet',
    description: 'Coming soon - Import transcripts from Google Meet',
    icon: '🎥',
    color: 'green',
    categories: ['meetings'],
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Coming soon - Import transcripts from Teams meetings',
    icon: '💼',
    color: 'purple',
    categories: ['meetings'],
  },

  // Social
  {
    id: 'twitter',
    name: 'Twitter / X',
    description: 'Post updates and engage with your audience',
    icon: '𝕏',
    color: 'gray',
    categories: ['social', 'auth'],
    connectEndpoint: '/api/social/twitter/connect',
    statusEndpoint: '/api/social/accounts',
    disconnectEndpoint: '/api/social/accounts/twitter',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Share professional updates and articles',
    icon: '💼',
    color: 'blue',
    categories: ['social', 'auth'],
    connectEndpoint: '/api/social/linkedin/connect',
    statusEndpoint: '/api/social/accounts',
    disconnectEndpoint: '/api/social/accounts/linkedin',
  },
  // Facebook temporarily disabled
  // {
  //   id: 'facebook',
  //   name: 'Facebook',
  //   description: 'Post to your business page',
  //   icon: '📘',
  //   color: 'blue',
  //   categories: ['social', 'auth'],
  //   connectEndpoint: '/api/social/facebook/connect',
  //   statusEndpoint: '/api/social/accounts',
  //   disconnectEndpoint: '/api/social/accounts/facebook',
  // },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Share visual content with your followers',
    icon: '📷',
    color: 'pink',
    categories: ['social'],
    connectEndpoint: '/api/social/instagram/connect',
    statusEndpoint: '/api/social/accounts',
    disconnectEndpoint: '/api/social/accounts/instagram',
  },

  // Accounting
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Sync financial data and invoices',
    icon: '📊',
    color: 'green',
    categories: ['accounting'],
    connectEndpoint: '/api/accounting/quickbooks/login',
    statusEndpoint: '/api/accounting/connections',
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Connect your Xero accounting',
    icon: '📈',
    color: 'cyan',
    categories: ['accounting'],
    connectEndpoint: '/api/accounting/xero/login',
    statusEndpoint: '/api/accounting/connections',
  },
  {
    id: 'freshbooks',
    name: 'FreshBooks',
    description: 'Sync invoices and expenses',
    icon: '📒',
    color: 'green',
    categories: ['accounting'],
    connectEndpoint: '/api/accounting/freshbooks/login',
    statusEndpoint: '/api/accounting/connections',
  },
  {
    id: 'zoho',
    name: 'Zoho Books',
    description: 'Connect Zoho accounting suite',
    icon: '📚',
    color: 'yellow',
    categories: ['accounting'],
    connectEndpoint: '/api/accounting/zoho/login',
    statusEndpoint: '/api/accounting/connections',
  },

  // Email Marketing
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Sync email campaigns and subscribers',
    icon: '🐵',
    color: 'yellow',
    categories: ['email'],
    statusEndpoint: '/api/mailchimp/status',
  },

  // Authentication
  {
    id: 'google',
    name: 'Google',
    description: 'Sign in with Google, access Calendar & Meet',
    icon: '🔍',
    color: 'red',
    categories: ['auth', 'meetings'],
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Sign in with GitHub',
    icon: '🐙',
    color: 'gray',
    categories: ['auth'],
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Plug },
  { id: 'meetings', label: 'Meetings', icon: Video },
  { id: 'social', label: 'Social', icon: Share2 },
  { id: 'accounting', label: 'Accounting', icon: Calculator },
  { id: 'email', label: 'Email', icon: Mail },
];

const COLOR_CLASSES: Record<string, { bg: string; border: string; glow: string }> = {
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', glow: 'shadow-blue-500/50' },
  green: { bg: 'bg-green-500/20', border: 'border-green-500/30', glow: 'shadow-green-500/50' },
  purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', glow: 'shadow-purple-500/50' },
  pink: { bg: 'bg-pink-500/20', border: 'border-pink-500/30', glow: 'shadow-pink-500/50' },
  cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/50' },
  yellow: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', glow: 'shadow-yellow-500/50' },
  red: { bg: 'bg-red-500/20', border: 'border-red-500/30', glow: 'shadow-red-500/50' },
  gray: { bg: 'bg-gray-500/20', border: 'border-gray-500/30', glow: 'shadow-gray-500/50' },
};

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>(INTEGRATIONS);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAllStatuses();
  }, []);

  const loadAllStatuses = async () => {
    setLoading(true);
    try {
      // Load Zoom status
      const zoomStatus = await loadStatus('/api/zoom/status');

      // Load social accounts
      const socialAccounts = await loadSocialAccounts();

      // Load accounting connections
      const accountingConnections = await loadAccountingConnections();

      // Update integrations with statuses
      setIntegrations(prev => prev.map(integration => {
        if (integration.id === 'zoom') {
          return { ...integration, status: zoomStatus };
        }
        if (['twitter', 'linkedin', 'facebook', 'instagram'].includes(integration.id)) {
          const account = socialAccounts.find((a: any) => a.provider === integration.id);
          return {
            ...integration,
            status: account ? {
              connected: true,
              user_name: account.username || account.page_name,
              connected_at: account.connected_at,
            } : { connected: false },
          };
        }
        if (['quickbooks', 'xero', 'freshbooks', 'zoho'].includes(integration.id)) {
          const conn = accountingConnections.find((c: any) => c.provider === integration.id);
          return {
            ...integration,
            status: conn ? {
              connected: true,
              account_name: conn.company_name,
              connected_at: conn.connected_at,
            } : { connected: false },
          };
        }
        return integration;
      }));
    } catch (err) {
      console.error('Failed to load integration statuses:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStatus = async (endpoint: string): Promise<IntegrationStatus> => {
    try {
      const res = await api.get(endpoint);
      return res.data;
    } catch {
      return { connected: false };
    }
  };

  const loadSocialAccounts = async () => {
    try {
      const res = await api.get('/api/social/accounts');
      // Transform the response to match the expected format (convert object to array)
      const accounts = res.data || {};
      const accountsList: any[] = [];
      for (const [provider, account] of Object.entries(accounts)) {
        if (account && typeof account === 'object') {
          accountsList.push({
            provider,
            username: (account as any).provider_username,
            page_name: (account as any).page_name,
            connected_at: (account as any).created_at,
            is_active: (account as any).is_active,
          });
        }
      }
      return accountsList.filter(a => a.is_active);
    } catch {
      return [];
    }
  };

  const loadAccountingConnections = async () => {
    try {
      const res = await api.get('/api/accounting/accounts');
      // Transform the response to match the expected format
      const accounts = res.data || {};
      const connections: any[] = [];
      for (const [provider, account] of Object.entries(accounts)) {
        if (account && typeof account === 'object' && (account as any).is_active) {
          connections.push({
            provider,
            company_name: (account as any).company_name,
            connected_at: (account as any).created_at,
          });
        }
      }
      return connections;
    } catch {
      return [];
    }
  };

  const handleConnect = async (integration: Integration) => {
    if (!integration.connectEndpoint) return;

    setIntegrations(prev => prev.map(i =>
      i.id === integration.id ? { ...i, loading: true } : i
    ));

    try {
      const res = await api.get(integration.connectEndpoint);
      // Different integrations return auth URL in different fields
      const authUrl = res.data.auth_url || res.data.url;
      if (authUrl) {
        window.location.href = authUrl;
      }
    } catch (err: any) {
      console.error('Failed to connect:', err);
    } finally {
      setIntegrations(prev => prev.map(i =>
        i.id === integration.id ? { ...i, loading: false } : i
      ));
    }
  };

  const handleDisconnect = async (integration: Integration) => {
    if (!integration.disconnectEndpoint) return;
    if (!confirm(`Disconnect ${integration.name}?`)) return;

    setIntegrations(prev => prev.map(i =>
      i.id === integration.id ? { ...i, loading: true } : i
    ));

    try {
      await api.delete(integration.disconnectEndpoint);
      setIntegrations(prev => prev.map(i =>
        i.id === integration.id ? { ...i, status: { connected: false }, loading: false } : i
      ));
    } catch (err: any) {
      console.error('Failed to disconnect:', err);
      setIntegrations(prev => prev.map(i =>
        i.id === integration.id ? { ...i, loading: false } : i
      ));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllStatuses();
    setRefreshing(false);
  };

  const filteredIntegrations = activeCategory === 'all'
    ? integrations
    : integrations.filter(i => i.categories.includes(activeCategory));

  const connectedCount = integrations.filter(i => i.status?.connected).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Plug className="w-7 h-7 text-cyan-400" />
            Integrations
          </h1>
          <p className="text-gray-400 mt-1">
            Connect your tools and services • {connectedCount} connected
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {CATEGORIES.map(category => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              activeCategory === category.id
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            <category.icon className="w-4 h-4" />
            {category.label}
          </button>
        ))}
      </div>

      {/* Integration Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredIntegrations.map(integration => {
          const colors = COLOR_CLASSES[integration.color] || COLOR_CLASSES.gray;
          const isConnected = integration.status?.connected;
          const isComingSoon = !integration.connectEndpoint && !isConnected;

          return (
            <div
              key={integration.id}
              className={`relative p-5 rounded-xl border transition ${
                isConnected
                  ? `${colors.bg} ${colors.border}`
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              } ${isComingSoon ? 'opacity-60' : ''}`}
            >
              {/* Status Indicator */}
              <div className="absolute top-4 right-4">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isConnected
                      ? 'bg-green-500 shadow-lg shadow-green-500/50'
                      : 'bg-gray-600'
                  }`}
                  title={isConnected ? 'Connected' : 'Not connected'}
                />
              </div>

              {/* Icon and Name */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`text-2xl ${isComingSoon ? 'grayscale' : ''}`}>
                  {integration.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{integration.name}</h3>
                  {isConnected && integration.status?.user_name && (
                    <p className="text-xs text-gray-400">{integration.status.user_name}</p>
                  )}
                  {isConnected && integration.status?.account_name && (
                    <p className="text-xs text-gray-400">{integration.status.account_name}</p>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-400 mb-4">{integration.description}</p>

              {/* Categories */}
              <div className="flex flex-wrap gap-1 mb-4">
                {integration.categories.map(cat => (
                  <span
                    key={cat}
                    className="px-2 py-0.5 rounded text-xs bg-white/10 text-gray-400 capitalize"
                  >
                    {cat}
                  </span>
                ))}
              </div>

              {/* Actions */}
              {isComingSoon ? (
                <span className="text-xs text-gray-500">Coming soon</span>
              ) : isConnected ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Connected
                  </span>
                  {integration.disconnectEndpoint && (
                    <button
                      onClick={() => handleDisconnect(integration)}
                      disabled={integration.loading}
                      className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1 transition"
                    >
                      {integration.loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Unlink className="w-3.5 h-3.5" />
                      )}
                      Disconnect
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => handleConnect(integration)}
                  disabled={integration.loading}
                  className="w-full py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {integration.loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link className="w-4 h-4" />
                  )}
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Help Section */}
      <div className="mt-12 p-6 rounded-xl bg-white/5 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-2">Need help with integrations?</h3>
        <p className="text-gray-400 text-sm mb-4">
          Each integration requires you to authorize Made4Founders to access your account.
          Your credentials are securely stored and you can disconnect at any time.
        </p>
        <a
          href="https://made4founders.com/docs/integrations"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1"
        >
          View integration documentation
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
