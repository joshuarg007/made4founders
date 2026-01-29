import { useState, useEffect } from 'react';
import {
  Plug,
  Video,
  Mail,
  Share2,
  Calculator,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Link,
  Unlink,
  X,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Shield,
  Key,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import api from '../lib/api';
import CalendarSync from '../components/CalendarSync';
import SlackIntegration from '../components/SlackIntegration';

// Integration logos
import zoomLogo from '../assets/integrations/zoom.svg';
import googleMeetLogo from '../assets/integrations/google-meet.svg';
import teamsLogo from '../assets/integrations/microsoft-teams.svg';
import twitterLogo from '../assets/integrations/twitter-x.svg';
import linkedinLogo from '../assets/integrations/linkedin.svg';
import facebookLogo from '../assets/integrations/facebook.svg';
import instagramLogo from '../assets/integrations/instagram.svg';
import quickbooksLogo from '../assets/integrations/quickbooks.svg';
import xeroLogo from '../assets/integrations/xero.svg';
import freshbooksLogo from '../assets/integrations/freshbooks.svg';
import zohoLogo from '../assets/integrations/zoho.svg';
import mailchimpLogo from '../assets/integrations/mailchimp.png';
import googleLogo from '../assets/integrations/google.svg';
import githubLogo from '../assets/integrations/github.svg';

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
  logo: string;
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
    logo: zoomLogo,
    color: 'blue',
    categories: ['meetings'],
    connectEndpoint: '/api/zoom/login',
    statusEndpoint: '/api/zoom/status',
    disconnectEndpoint: '/api/zoom/disconnect',
  },
  {
    id: 'google-meet',
    name: 'Google Meet',
    description: 'Import meeting recordings and transcripts from Google Meet',
    logo: googleMeetLogo,
    color: 'green',
    categories: ['meetings'],
    connectEndpoint: '/api/google-meet/login',
    statusEndpoint: '/api/google-meet/status',
    disconnectEndpoint: '/api/google-meet/disconnect',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Import meeting recordings and transcripts from Teams',
    logo: teamsLogo,
    color: 'purple',
    categories: ['meetings'],
    connectEndpoint: '/api/teams/login',
    statusEndpoint: '/api/teams/status',
    disconnectEndpoint: '/api/teams/disconnect',
  },

  // Social
  {
    id: 'twitter',
    name: 'Twitter / X',
    description: 'Post updates and engage with your audience',
    logo: twitterLogo,
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
    logo: linkedinLogo,
    color: 'blue',
    categories: ['social', 'auth'],
    connectEndpoint: '/api/social/linkedin/connect',
    statusEndpoint: '/api/social/accounts',
    disconnectEndpoint: '/api/social/accounts/linkedin',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    description: 'Post to your business page and manage content',
    logo: facebookLogo,
    color: 'blue',
    categories: ['social', 'auth'],
    connectEndpoint: '/api/social/facebook/connect',
    statusEndpoint: '/api/social/accounts',
    disconnectEndpoint: '/api/social/accounts/facebook',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Share visual content with your followers',
    logo: instagramLogo,
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
    logo: quickbooksLogo,
    color: 'green',
    categories: ['accounting'],
    connectEndpoint: '/api/accounting/quickbooks/login',
    statusEndpoint: '/api/accounting/connections',
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Connect your Xero accounting',
    logo: xeroLogo,
    color: 'cyan',
    categories: ['accounting'],
    connectEndpoint: '/api/accounting/xero/login',
    statusEndpoint: '/api/accounting/connections',
  },
  {
    id: 'freshbooks',
    name: 'FreshBooks',
    description: 'Sync invoices and expenses',
    logo: freshbooksLogo,
    color: 'green',
    categories: ['accounting'],
    connectEndpoint: '/api/accounting/freshbooks/login',
    statusEndpoint: '/api/accounting/connections',
  },
  {
    id: 'zoho',
    name: 'Zoho Books',
    description: 'Connect Zoho accounting suite',
    logo: zohoLogo,
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
    logo: mailchimpLogo,
    color: 'yellow',
    categories: ['email'],
    statusEndpoint: '/api/mailchimp/status',
  },

  // Authentication
  {
    id: 'google',
    name: 'Google',
    description: 'Sign in with Google, access Calendar & Meet',
    logo: googleLogo,
    color: 'red',
    categories: ['auth', 'meetings'],
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Sign in with GitHub',
    logo: githubLogo,
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
  gray: { bg: 'bg-white/50/20', border: 'border-gray-500/30', glow: 'shadow-gray-500/50' },
};

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>(INTEGRATIONS);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    loadAllStatuses();
  }, []);

  const loadAllStatuses = async () => {
    setLoading(true);
    try {
      // Load meeting platform statuses
      const zoomStatus = await loadStatus('/api/zoom/status');
      const googleMeetStatus = await loadStatus('/api/google-meet/status');
      const teamsStatus = await loadStatus('/api/teams/status');

      // Load social accounts
      const socialAccounts = await loadSocialAccounts();

      // Load accounting connections
      const accountingConnections = await loadAccountingConnections();

      // Update integrations with statuses
      setIntegrations(prev => prev.map(integration => {
        if (integration.id === 'zoom') {
          return { ...integration, status: zoomStatus };
        }
        if (integration.id === 'google-meet') {
          return { ...integration, status: googleMeetStatus };
        }
        if (integration.id === 'teams') {
          return { ...integration, status: teamsStatus };
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
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1d24]/10 text-white hover:bg-[#1a1d24]/20 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Featured Integrations */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <CalendarSync />
        <SlackIntegration />
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
                : 'bg-[#1a1d24]/5 text-gray-400 border border-white/10 hover:bg-[#1a1d24]/10 hover:text-white'
            }`}
          >
            <category.icon className="w-4 h-4" />
            {category.label}
          </button>
        ))}
      </div>

      {/* Integration Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredIntegrations.map(integration => {
          const colors = COLOR_CLASSES[integration.color] || COLOR_CLASSES.gray;
          const isConnected = integration.status?.connected;
          const isComingSoon = !integration.connectEndpoint && !isConnected;

          return (
            <div
              key={integration.id}
              className={`relative p-5 rounded-2xl border-2 transition-all duration-200 hover:scale-[1.02] ${
                isConnected
                  ? `${colors.bg} ${colors.border} shadow-lg ${colors.glow}`
                  : 'bg-[#12151a] border-white/10 hover:border-white/20 hover:bg-[#1a1d24]'
              } ${isComingSoon ? 'opacity-50 hover:scale-100' : ''}`}
            >
              {/* Status Indicator */}
              <div className="absolute top-4 right-4">
                <div
                  className={`w-3 h-3 rounded-full transition-all ${
                    isConnected
                      ? 'bg-green-500 shadow-lg shadow-green-500/50 animate-pulse'
                      : 'bg-gray-600'
                  }`}
                  title={isConnected ? 'Connected' : 'Not connected'}
                />
              </div>

              {/* Icon and Name */}
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isConnected ? 'bg-white/10' : 'bg-white/5'
                } ${isComingSoon ? 'grayscale opacity-50' : ''}`}>
                  <img src={integration.logo} alt={integration.name} className="w-7 h-7 object-contain" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg">{integration.name}</h3>
                  {isConnected && integration.status?.user_name && (
                    <p className="text-xs text-green-400 font-medium">{integration.status.user_name}</p>
                  )}
                  {isConnected && integration.status?.account_name && (
                    <p className="text-xs text-green-400 font-medium">{integration.status.account_name}</p>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-400 mb-4 leading-relaxed">{integration.description}</p>

              {/* Categories */}
              <div className="flex flex-wrap gap-2 mb-5">
                {integration.categories.map(cat => (
                  <span
                    key={cat}
                    className="px-2.5 py-1 rounded-lg text-xs bg-white/5 text-gray-400 capitalize font-medium"
                  >
                    {cat}
                  </span>
                ))}
              </div>

              {/* Actions */}
              {isComingSoon ? (
                <div className="pt-3 border-t border-white/5">
                  <span className="text-xs text-gray-500 font-medium">Coming soon</span>
                </div>
              ) : isConnected ? (
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <span className="text-sm text-green-400 flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Connected
                  </span>
                  {integration.disconnectEndpoint && (
                    <button
                      onClick={() => handleDisconnect(integration)}
                      disabled={integration.loading}
                      className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1.5 transition px-3 py-1.5 rounded-lg hover:bg-red-500/10"
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
                  className="w-full py-2.5 rounded-xl bg-white/5 text-white hover:bg-white/10 transition flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50 border border-white/10 hover:border-white/20"
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
      <div className="mt-12 p-6 rounded-xl bg-[#1a1d24]/5 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-2">Need help with integrations?</h3>
        <p className="text-gray-400 text-sm mb-4">
          Each integration requires you to authorize Made4Founders to access your account.
          Your credentials are securely stored and you can disconnect at any time.
        </p>
        <button
          onClick={() => setShowHelpModal(true)}
          className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1 transition"
        >
          <HelpCircle className="w-4 h-4" />
          View integration documentation & FAQ
        </button>
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <IntegrationHelpModal onClose={() => setShowHelpModal(false)} />
      )}
    </div>
  );
}

// ============ Integration Help Modal ============
function IntegrationHelpModal({ onClose }: { onClose: () => void }) {
  const [openSection, setOpenSection] = useState<string | null>('getting-started');

  const toggleSection = (id: string) => {
    setOpenSection(openSection === id ? null : id);
  };

  const sections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: Plug,
      content: (
        <div className="space-y-3 text-sm text-gray-300">
          <p>To connect an integration:</p>
          <ol className="list-decimal list-inside space-y-2 ml-2">
            <li>Click the <strong className="text-white">Connect</strong> button on any integration card</li>
            <li>You'll be redirected to the service's authorization page</li>
            <li>Sign in and grant Made4Founders the requested permissions</li>
            <li>You'll be redirected back and see the integration as "Connected"</li>
          </ol>
          <p className="text-gray-400 mt-4">
            You can disconnect any integration at any time by clicking the Disconnect button.
          </p>
        </div>
      ),
    },
    {
      id: 'security',
      title: 'Security & Privacy',
      icon: Shield,
      content: (
        <div className="space-y-3 text-sm text-gray-300">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-400">Your data is secure</p>
              <p className="text-gray-400 text-xs mt-1">All credentials are encrypted with AES-256-GCM</p>
            </div>
          </div>
          <ul className="space-y-2 ml-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <span>We use OAuth 2.0 - we never see your passwords</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <span>Access tokens are encrypted at rest</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <span>You can revoke access anytime from here or the provider's settings</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <span>We only request permissions needed for the integration to work</span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'permissions',
      title: 'Permissions Explained',
      icon: Key,
      content: (
        <div className="space-y-4 text-sm text-gray-300">
          <div className="space-y-3">
            <h4 className="font-medium text-white">Social Media (Twitter, LinkedIn, Facebook, Instagram)</h4>
            <ul className="space-y-1 ml-4 text-gray-400">
              <li>• <strong className="text-gray-300">Post on your behalf</strong> - Create posts from Made4Founders</li>
              <li>• <strong className="text-gray-300">Read profile</strong> - Display your username and avatar</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium text-white">Meeting Platforms (Zoom, Google Meet, Teams)</h4>
            <ul className="space-y-1 ml-4 text-gray-400">
              <li>• <strong className="text-gray-300">Read recordings</strong> - Import meeting transcripts</li>
              <li>• <strong className="text-gray-300">Read meeting info</strong> - Show meeting details</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium text-white">Accounting (QuickBooks, Xero, FreshBooks)</h4>
            <ul className="space-y-1 ml-4 text-gray-400">
              <li>• <strong className="text-gray-300">Read financials</strong> - Sync invoices and expenses</li>
              <li>• <strong className="text-gray-300">Read company info</strong> - Display company name</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: AlertTriangle,
      content: (
        <div className="space-y-4 text-sm text-gray-300">
          <div className="space-y-2">
            <h4 className="font-medium text-white">"Connection failed" error</h4>
            <p className="text-gray-400 ml-4">Make sure you're logged into the correct account on the service. Try logging out and back in, then reconnect.</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-white">"Permission denied" error</h4>
            <p className="text-gray-400 ml-4">You may have declined a required permission. Disconnect and reconnect, making sure to accept all permissions.</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-white">Integration shows connected but isn't working</h4>
            <p className="text-gray-400 ml-4">The access token may have expired. Disconnect and reconnect to refresh it.</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-white">Can't find my account after connecting</h4>
            <p className="text-gray-400 ml-4">For Facebook/Instagram, make sure you have a Business account linked. For accounting apps, ensure you selected the correct company.</p>
          </div>
        </div>
      ),
    },
    {
      id: 'token-expiry',
      title: 'Token Expiration',
      icon: Clock,
      content: (
        <div className="space-y-3 text-sm text-gray-300">
          <p>Most integrations use tokens that expire after a period of time:</p>
          <div className="grid gap-2 mt-3">
            <div className="flex justify-between p-2 rounded bg-white/5">
              <span className="text-gray-400">Twitter/X</span>
              <span className="text-white">2 hours (auto-refreshes)</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-white/5">
              <span className="text-gray-400">LinkedIn</span>
              <span className="text-white">60 days</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-white/5">
              <span className="text-gray-400">Facebook/Instagram</span>
              <span className="text-white">60 days</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-white/5">
              <span className="text-gray-400">Google (Meet, Calendar)</span>
              <span className="text-white">Auto-refreshes</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-white/5">
              <span className="text-gray-400">Zoom</span>
              <span className="text-white">Auto-refreshes</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-white/5">
              <span className="text-gray-400">Accounting apps</span>
              <span className="text-white">Varies (usually 60 days)</span>
            </div>
          </div>
          <p className="text-gray-400 mt-3">
            If a token expires, simply reconnect the integration to get a fresh token.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[#12151a] rounded-2xl border border-white/10 w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Integration Help</h2>
              <p className="text-sm text-gray-400">Documentation & FAQ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)]">
          <div className="space-y-3">
            {sections.map(section => (
              <div key={section.id} className="rounded-xl border border-white/10 overflow-hidden">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
                >
                  <div className="flex items-center gap-3">
                    <section.icon className="w-5 h-5 text-cyan-400" />
                    <span className="font-medium text-white">{section.title}</span>
                  </div>
                  {openSection === section.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                {openSection === section.id && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="pl-8">
                      {section.content}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Still need help?{' '}
              <a
                href="mailto:support@made4founders.com?subject=Integration%20Help"
                className="text-cyan-400 hover:text-cyan-300 transition"
              >
                Contact support
              </a>
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
