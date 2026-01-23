import { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Share2,
  Settings,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Eye,
  Loader2,
  Check,
  X,
  Twitter,
  Linkedin,
  Facebook,
  Instagram,
  Sparkles,
  ImageIcon,
  AlertCircle,
  Palette,
  Globe,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { SocialMockups } from '../components/SocialPostMockups';
import Branding from './Branding';
import Website from './Website';

// Types
interface EmailTemplate {
  id: number;
  name: string;
  template_type: string;
  subject: string;
  html_content: string;
  text_content: string | null;
  variables: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Campaign {
  id: number;
  name: string;
  campaign_type: string;
  status: string;
  description: string | null;
  created_at: string;
  scheduled_at: string | null;
  sent_at: string | null;
}

interface EmailIntegration {
  id: number;
  provider: string;
  is_active: boolean;
  from_email: string | null;
  from_name: string | null;
}

const TEMPLATE_TYPES = [
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'welcome', label: 'Welcome' },
  { value: 'transactional', label: 'Transactional' },
  { value: 'other', label: 'Other' },
];

const PLATFORMS = [
  { id: 'twitter', label: 'Twitter/X', icon: Twitter, color: 'bg-black', hoverColor: 'hover:bg-neutral-900', borderColor: 'border-neutral-700', charLimit: 280, supportsImages: true, imageNote: 'Up to 4 images, JPG/PNG/GIF' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'bg-[#0A66C2]', hoverColor: 'hover:bg-[#004182]', borderColor: 'border-[#0A66C2]', charLimit: 3000, supportsImages: true, imageNote: 'Single image or document' },
  { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'bg-[#1877F2]', hoverColor: 'hover:bg-[#0d65d9]', borderColor: 'border-[#1877F2]', charLimit: 63206, supportsImages: true, imageNote: 'Multiple images supported' },
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F77737]', hoverColor: 'hover:opacity-90', borderColor: 'border-[#E1306C]', charLimit: 2200, supportsImages: true, imageNote: 'Image required, square recommended' },
];

type Tab = 'social' | 'email' | 'brand' | 'web';

export default function SocialHub() {
  const [activeTab, setActiveTab] = useState<Tab>('social');
  const [emailSubTab, setEmailSubTab] = useState<'templates' | 'campaigns' | 'integrations'>('templates');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [integrations, setIntegrations] = useState<EmailIntegration[]>([]);

  // Modals
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [templatesRes, campaignsRes, integrationsRes] = await Promise.all([
        api.get('/api/marketing/templates'),
        api.get('/api/marketing/campaigns'),
        api.get('/api/marketing/integrations'),
      ]);
      setTemplates(templatesRes.data);
      setCampaigns(campaignsRes.data);
      setIntegrations(integrationsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load marketing data');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'social' as Tab, label: 'Social', icon: Share2 },
    { id: 'email' as Tab, label: 'Email', icon: Mail },
    { id: 'brand' as Tab, label: 'Brand', icon: Palette },
    { id: 'web' as Tab, label: 'Web', icon: Globe },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Marketing Hub</h1>
        <p className="text-gray-400 mt-1">Manage social media, email campaigns, branding, and web presence</p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/10 pb-4 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400 border border-purple-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'social' && (
        <SocialPublisherTab />
      )}

      {activeTab === 'email' && (
        <div>
          {/* Email Sub-tabs */}
          <div className="flex gap-2 mb-6">
            {[
              { id: 'templates' as const, label: 'Templates', icon: Mail },
              { id: 'campaigns' as const, label: 'Campaigns', icon: Send },
              { id: 'integrations' as const, label: 'Integrations', icon: Settings },
            ].map((subTab) => (
              <button
                key={subTab.id}
                onClick={() => setEmailSubTab(subTab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${
                  emailSubTab === subTab.id
                    ? 'bg-white/10 text-white'
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <subTab.icon className="w-4 h-4" />
                {subTab.label}
              </button>
            ))}
          </div>

          {emailSubTab === 'templates' && (
            <TemplatesTab
              templates={templates}
              onAdd={() => { setEditingItem(null); setShowTemplateModal(true); }}
              onEdit={(t) => { setEditingItem(t); setShowTemplateModal(true); }}
              onPreview={(t) => { setPreviewTemplate(t); setShowPreviewModal(true); }}
              onRefresh={loadData}
            />
          )}

          {emailSubTab === 'campaigns' && (
            <CampaignsTab
              campaigns={campaigns}
              onAdd={() => { setEditingItem(null); setShowCampaignModal(true); }}
              onEdit={(c) => { setEditingItem(c); setShowCampaignModal(true); }}
              onRefresh={loadData}
            />
          )}

          {emailSubTab === 'integrations' && (
            <IntegrationsTab
              integrations={integrations}
              onRefresh={loadData}
            />
          )}
        </div>
      )}

      {activeTab === 'brand' && (
        <div className="-m-8">
          <Branding />
        </div>
      )}

      {activeTab === 'web' && (
        <div className="-m-8">
          <Website />
        </div>
      )}

      {/* Modals */}
      {showTemplateModal && (
        <TemplateModal
          template={editingItem}
          onClose={() => setShowTemplateModal(false)}
          onSave={loadData}
        />
      )}

      {showCampaignModal && (
        <CampaignModal
          campaign={editingItem}
          onClose={() => setShowCampaignModal(false)}
          onSave={loadData}
        />
      )}

      {showPreviewModal && previewTemplate && (
        <PreviewModal
          template={previewTemplate}
          onClose={() => { setShowPreviewModal(false); setPreviewTemplate(null); }}
        />
      )}
    </div>
  );
}

// ============ Templates Tab ============
function TemplatesTab({ templates, onAdd, onEdit, onPreview, onRefresh }: {
  templates: EmailTemplate[];
  onAdd: () => void;
  onEdit: (t: EmailTemplate) => void;
  onPreview: (t: EmailTemplate) => void;
  onRefresh: () => void;
}) {
  const [prebuiltTemplates, setPrebuiltTemplates] = useState<any[]>([]);
  const [showPrebuilt, setShowPrebuilt] = useState(false);

  useEffect(() => {
    api.get('/api/marketing/templates/prebuilt').then(res => {
      setPrebuiltTemplates(res.data);
    }).catch(() => {});
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this template?')) return;
    try {
      await api.delete(`/api/marketing/templates/${id}`);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete template');
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      await api.post(`/api/marketing/templates/${id}/duplicate`);
      onRefresh();
    } catch (err) {
      console.error('Failed to duplicate template');
    }
  };

  const handleUsePrebuilt = async (name: string) => {
    try {
      await api.post(`/api/marketing/templates/prebuilt/${encodeURIComponent(name)}`);
      onRefresh();
      setShowPrebuilt(false);
    } catch (err) {
      console.error('Failed to use prebuilt template');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-white">Email Templates</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowPrebuilt(!showPrebuilt)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white transition"
          >
            <Sparkles className="w-4 h-4" />
            Pre-built Templates
          </button>
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 transition"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </button>
        </div>
      </div>

      {showPrebuilt && (
        <div className="mb-8 p-6 rounded-xl bg-white/5 border border-white/10">
          <h3 className="font-medium text-white mb-4">Pre-built Templates</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {prebuiltTemplates.map((t) => (
              <div key={t.name} className="p-4 rounded-lg bg-white/5 border border-white/10">
                <h4 className="font-medium text-white">{t.name}</h4>
                <p className="text-sm text-gray-500 mt-1 capitalize">{t.template_type}</p>
                <button
                  onClick={() => handleUsePrebuilt(t.name)}
                  className="mt-3 text-sm text-cyan-400 hover:text-cyan-300 transition"
                >
                  Use this template
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No email templates yet</p>
          <p className="text-sm mt-1">Create your first email template or use a pre-built one</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div key={template.id} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden group">
              <div className="p-4 border-b border-white/10">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-white">{template.name}</h3>
                    <p className="text-xs text-gray-500 mt-1 capitalize">{template.template_type}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    template.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {template.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-2 line-clamp-1">{template.subject}</p>
              </div>
              <div className="p-4 flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  {new Date(template.updated_at).toLocaleDateString()}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => onPreview(template)}
                    className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition"
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDuplicate(template.id)}
                    className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition"
                    title="Duplicate"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onEdit(template)}
                    className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition"
                    title="Edit"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Campaigns Tab ============
function CampaignsTab({ campaigns, onAdd, onEdit, onRefresh }: {
  campaigns: Campaign[];
  onAdd: () => void;
  onEdit: (c: Campaign) => void;
  onRefresh: () => void;
}) {
  const handleDelete = async (id: number) => {
    if (!confirm('Delete this campaign?')) return;
    try {
      await api.delete(`/api/marketing/campaigns/${id}`);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete campaign');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-500/20 text-gray-400';
      case 'scheduled': return 'bg-yellow-500/20 text-yellow-400';
      case 'sent': return 'bg-green-500/20 text-green-400';
      case 'cancelled': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-white">Marketing Campaigns</h2>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 transition"
        >
          <Plus className="w-4 h-4" />
          Create Campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Send className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No campaigns yet</p>
          <p className="text-sm mt-1">Create your first marketing campaign</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="bg-white/5 rounded-xl border border-white/10 p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-white text-lg">{campaign.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs capitalize ${getStatusColor(campaign.status)}`}>
                      {campaign.status}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/10 text-gray-400 text-xs capitalize">
                      {campaign.campaign_type}
                    </span>
                  </div>
                  {campaign.description && (
                    <p className="text-gray-400 text-sm mt-2">{campaign.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    <span>Created {new Date(campaign.created_at).toLocaleDateString()}</span>
                    {campaign.scheduled_at && (
                      <span>Scheduled for {new Date(campaign.scheduled_at).toLocaleDateString()}</span>
                    )}
                    {campaign.sent_at && (
                      <span>Sent {new Date(campaign.sent_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(campaign)}
                    className="p-2 rounded hover:bg-white/10 text-gray-400 hover:text-white transition"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(campaign.id)}
                    className="p-2 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Social Publisher Tab ============
interface PlatformPost {
  content: string;
  enabled: boolean;
}

function SocialPublisherTab() {
  const { user } = useAuth();
  const [baseContent, setBaseContent] = useState('');
  const [platformPosts, setPlatformPosts] = useState<Record<string, PlatformPost>>({
    twitter: { content: '', enabled: true },
    linkedin: { content: '', enabled: true },
    facebook: { content: '', enabled: false },
    instagram: { content: '', enabled: false },
  });
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<Record<string, boolean>>({});
  const [adapting, setAdapting] = useState(false);
  const [posting, setPosting] = useState<string | null>(null);
  const [postSuccess, setPostSuccess] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('twitter');

  // Load connected accounts
  useEffect(() => {
    api.get('/api/social/accounts').then(res => {
      const connected: Record<string, boolean> = {};
      PLATFORMS.forEach(p => {
        connected[p.id] = res.data[p.id]?.is_active || false;
      });
      setConnectedAccounts(connected);
    }).catch(() => {});
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
  };

  const handleAdaptAll = async () => {
    if (!baseContent.trim()) return;
    setAdapting(true);
    try {
      const enabledPlatforms = PLATFORMS.filter(p => platformPosts[p.id]?.enabled).map(p => p.id);
      const res = await api.post('/api/marketing/adapt-content', {
        content: baseContent,
        platforms: enabledPlatforms
      });

      // Update platform posts with adapted content
      const newPosts = { ...platformPosts };
      Object.keys(res.data).forEach(platformId => {
        if (newPosts[platformId]) {
          newPosts[platformId].content = res.data[platformId].content;
        }
      });
      setPlatformPosts(newPosts);
    } catch (err) {
      console.error('Failed to adapt content');
    } finally {
      setAdapting(false);
    }
  };

  const togglePlatform = (id: string) => {
    setPlatformPosts(prev => ({
      ...prev,
      [id]: { ...prev[id], enabled: !prev[id].enabled }
    }));
  };

  const updatePlatformContent = (id: string, content: string) => {
    setPlatformPosts(prev => ({
      ...prev,
      [id]: { ...prev[id], content }
    }));
  };

  const handlePost = async (platformId: string) => {
    const post = platformPosts[platformId];
    if (!post?.content.trim()) return;

    setPosting(platformId);
    setPostError(null);
    setPostSuccess(null);

    try {
      const formData = new FormData();
      formData.append('content', post.content);
      formData.append('platform', platformId);
      if (image) {
        formData.append('image', image);
      }

      await api.post('/api/social/post', formData);
      setPostSuccess(`Posted to ${PLATFORMS.find(p => p.id === platformId)?.label}!`);
      setTimeout(() => setPostSuccess(null), 3000);
    } catch (err: any) {
      setPostError(err.response?.data?.detail || `Failed to post to ${platformId}`);
    } finally {
      setPosting(null);
    }
  };

  const handlePostAll = async () => {
    const enabledPlatforms = PLATFORMS.filter(p =>
      platformPosts[p.id]?.enabled &&
      platformPosts[p.id]?.content.trim() &&
      connectedAccounts[p.id]
    );

    for (const platform of enabledPlatforms) {
      await handlePost(platform.id);
    }
  };

  const getCharCount = (platformId: string) => {
    return platformPosts[platformId]?.content.length || 0;
  };

  const isOverLimit = (platformId: string) => {
    const platform = PLATFORMS.find(p => p.id === platformId);
    return platform ? getCharCount(platformId) > platform.charLimit : false;
  };

  return (
    <div>
      <div className="mb-8">
        {/* Hero Header */}
        <div className="relative mb-8 p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-white/10 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 opacity-20">
            <img src="/src/assets/marketing-icon.webp" alt="" className="w-full h-full object-contain" />
          </div>
          <div className="relative">
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                <Share2 className="w-5 h-5 text-white" />
              </div>
              Social Publisher
            </h2>
            <p className="text-gray-400 text-sm max-w-xl">
              Create once, publish everywhere. AI adapts your content for each platform's unique style and character limits.
            </p>
          </div>
        </div>

        {/* Success/Error Messages */}
        {postSuccess && (
          <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 flex items-center gap-2">
            <Check className="w-5 h-5" />
            {postSuccess}
          </div>
        )}
        {postError && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {postError}
          </div>
        )}

        {/* Platform Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
            Select Platforms
          </label>
          <div className="flex flex-wrap gap-3">
            {PLATFORMS.map((platform) => {
              const isConnected = connectedAccounts[platform.id];
              const isEnabled = platformPosts[platform.id]?.enabled;
              return (
                <button
                  key={platform.id}
                  onClick={() => togglePlatform(platform.id)}
                  className={`group flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-200 relative ${
                    isEnabled
                      ? `${platform.color} border-transparent text-white shadow-lg scale-[1.02]`
                      : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                    isEnabled ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/10'
                  }`}>
                    <platform.icon className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-sm block">{platform.label}</span>
                    <span className={`text-xs ${isEnabled ? 'text-white/70' : 'text-gray-500'}`}>
                      {platform.charLimit.toLocaleString()} chars
                    </span>
                  </div>
                  {/* Connection Status Badge */}
                  <div className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center ${
                    isConnected ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-600'
                  }`}>
                    {isConnected ? (
                      <Check className="w-2.5 h-2.5 text-white" />
                    ) : (
                      <X className="w-2.5 h-2.5 text-gray-400" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Base Content Input */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Edit3 className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-white">Your Message</label>
              <span className="text-xs text-gray-500">Write once, we'll adapt for each platform</span>
            </div>
          </div>
          <textarea
            value={baseContent}
            onChange={(e) => setBaseContent(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-[#0a0c10] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition resize-none text-sm"
            placeholder="Write your main message here. We'll adapt it for each platform's best practices..."
          />

          {/* Image Upload */}
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-400">Attach Image</span>
              <span className="text-xs text-gray-600">(optional)</span>
            </div>
            {imagePreview ? (
              <div className="relative inline-block group">
                <img src={imagePreview} alt="Preview" className="max-w-sm max-h-56 rounded-xl border-2 border-white/10 shadow-lg" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-xl flex items-center justify-center">
                  <button
                    onClick={removeImage}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-400 transition flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-white/10 hover:border-cyan-500/50 hover:bg-cyan-500/5 cursor-pointer transition group">
                <div className="w-12 h-12 rounded-full bg-white/5 group-hover:bg-cyan-500/10 flex items-center justify-center transition">
                  <ImageIcon className="w-6 h-6 text-gray-500 group-hover:text-cyan-400 transition" />
                </div>
                <div className="text-center">
                  <span className="text-gray-400 text-sm font-medium group-hover:text-white transition">Click to upload</span>
                  <span className="block text-gray-600 text-xs mt-1">JPG, PNG, GIF up to 10MB</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Adapt Button */}
          <div className="mt-6 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {baseContent.length > 0 && `${baseContent.length} characters`}
            </span>
            <button
              onClick={handleAdaptAll}
              disabled={!baseContent.trim() || adapting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:from-cyan-400 hover:to-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/25"
            >
              {adapting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Auto-Adapt for All Platforms
            </button>
          </div>
        </div>

        {/* Platform Tabs */}
        {PLATFORMS.filter(p => platformPosts[p.id]?.enabled).length > 0 && (
          <div className="mb-8">
            {/* Tab Navigation */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {PLATFORMS.filter(p => platformPosts[p.id]?.enabled).map((platform) => {
                const isActive = activeTab === platform.id;
                const isConnected = connectedAccounts[platform.id];
                return (
                  <button
                    key={platform.id}
                    onClick={() => setActiveTab(platform.id)}
                    className={`flex items-center gap-3 px-5 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
                      isActive
                        ? `${platform.color} text-white shadow-lg`
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                    }`}
                  >
                    <platform.icon className="w-5 h-5" />
                    <span>{platform.label}</span>
                    {isConnected && (
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Platform Panel */}
            {PLATFORMS.filter(p => platformPosts[p.id]?.enabled).map((platform) => {
              if (activeTab !== platform.id) return null;

              const post = platformPosts[platform.id];
              const charCount = getCharCount(platform.id);
              const overLimit = isOverLimit(platform.id);
              const isConnected = connectedAccounts[platform.id];
              const MockupComponent = SocialMockups[platform.id as keyof typeof SocialMockups];
              const charPercent = Math.min((charCount / platform.charLimit) * 100, 100);

              return (
                <div key={platform.id} className="bg-gradient-to-br from-white/5 to-transparent rounded-2xl border border-white/10 overflow-hidden">
                  {/* Platform Header */}
                  <div className={`${platform.color} px-6 py-4 flex items-center justify-between`}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                        <platform.icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <span className="font-bold text-white text-lg block">{platform.label}</span>
                        <span className="text-sm text-white/70">
                          {isConnected ? 'Connected & Ready' : 'Not connected'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-sm font-mono px-3 py-1 rounded-lg ${
                        overLimit ? 'bg-red-500/30 text-red-200' : 'bg-white/20 text-white'
                      }`}>
                        {charCount.toLocaleString()} / {platform.charLimit.toLocaleString()}
                      </span>
                      {isConnected ? (
                        <button
                          onClick={() => handlePost(platform.id)}
                          disabled={!post.content.trim() || overLimit || posting === platform.id}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-gray-900 font-semibold hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {posting === platform.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          Post Now
                        </button>
                      ) : (
                        <span className="text-sm text-white/60 bg-white/10 px-4 py-2 rounded-lg">
                          Connect to post
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Character Progress Bar */}
                  <div className="h-1.5 bg-black/30">
                    <div
                      className={`h-full transition-all duration-300 ${
                        charPercent > 90 ? 'bg-red-500' : charPercent > 70 ? 'bg-amber-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${charPercent}%` }}
                    />
                  </div>

                  {/* Content Area - Two Column Layout */}
                  <div className="grid lg:grid-cols-2 gap-0 divide-x divide-white/10">
                    {/* Left: Preview Mockup */}
                    <div className="p-6 bg-gradient-to-br from-gray-900/50 to-transparent">
                      <div className="flex items-center gap-2 mb-4">
                        <Eye className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-400">Live Preview</span>
                      </div>
                      <div className="flex justify-center">
                        <div className="w-full max-w-md">
                          <MockupComponent
                            content={post.content}
                            imageUrl={imagePreview}
                            userName={user?.name || user?.email || 'User'}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right: Editor */}
                    <div className="p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Edit3 className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-400">Edit Content</span>
                      </div>

                      <textarea
                        value={post.content}
                        onChange={(e) => updatePlatformContent(platform.id, e.target.value)}
                        maxLength={platform.charLimit}
                        rows={8}
                        className={`w-full px-4 py-3 rounded-xl bg-[#0a0c10] border-2 text-white placeholder-gray-600 focus:outline-none transition resize-none text-sm leading-relaxed ${
                          overLimit ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-cyan-500/50'
                        }`}
                        placeholder={`Write your ${platform.label} post...`}
                      />

                      {/* Image Preview */}
                      {imagePreview && (
                        <div className="mt-4 rounded-xl overflow-hidden border border-white/10">
                          <img src={imagePreview} alt="Attached" className="w-full max-h-48 object-cover" />
                        </div>
                      )}

                      {/* Platform Tips */}
                      <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 bg-white/5 rounded-lg px-3 py-2">
                        <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
                        <span>{platform.imageNote}</span>
                      </div>

                      {overLimit && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Content exceeds {platform.label}'s character limit</span>
                        </div>
                      )}

                      {/* Copy Button */}
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <button
                          onClick={() => navigator.clipboard.writeText(post.content)}
                          className="text-sm text-gray-400 hover:text-white transition flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/5"
                        >
                          <Copy className="w-4 h-4" />
                          Copy to clipboard
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Post All Button */}
        {PLATFORMS.some(p => platformPosts[p.id]?.enabled && connectedAccounts[p.id]) && (
          <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-white/10">
            <p className="text-sm text-gray-400">Ready to publish your content?</p>
            <button
              onClick={handlePostAll}
              disabled={posting !== null || !PLATFORMS.some(p =>
                platformPosts[p.id]?.enabled &&
                platformPosts[p.id]?.content.trim() &&
                connectedAccounts[p.id] &&
                !isOverLimit(p.id)
              )}
              className="flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-lg hover:from-cyan-400 hover:to-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-cyan-500/30 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Send className="w-5 h-5" />
              Post to All Platforms
            </button>
            <p className="text-xs text-gray-500">
              {PLATFORMS.filter(p => platformPosts[p.id]?.enabled && connectedAccounts[p.id]).length} platform(s) ready
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Integrations Tab ============
interface SocialAccountData {
  id: number;
  provider: string;
  provider_username: string | null;
  page_name: string | null;
  is_active: boolean;
  created_at: string;
}

interface ConnectedAccounts {
  twitter: SocialAccountData | null;
  facebook: SocialAccountData | null;
  instagram: SocialAccountData | null;
  linkedin: SocialAccountData | null;
}

function IntegrationsTab({ integrations, onRefresh }: {
  integrations: EmailIntegration[];
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    provider: 'mailchimp',
    api_key: '',
    list_id: '',
    from_email: '',
    from_name: ''
  });
  const [loading, setLoading] = useState(false);
  const [socialAccounts, setSocialAccounts] = useState<ConnectedAccounts>({
    twitter: null,
    facebook: null,
    instagram: null,
    linkedin: null,
  });
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [socialSuccess, setSocialSuccess] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);

  // Load social accounts on mount
  useEffect(() => {
    loadSocialAccounts();

    // Check for success/error in URL params (from OAuth callback)
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');

    if (connected) {
      setSocialSuccess(`Successfully connected ${connected}!`);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setSocialSuccess(null), 5000);
    }
    if (error) {
      setSocialError(decodeURIComponent(error));
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setSocialError(null), 5000);
    }
  }, []);

  const loadSocialAccounts = async () => {
    try {
      const res = await api.get('/api/social/accounts');
      setSocialAccounts(res.data);
    } catch (err) {
      console.error('Failed to load social accounts');
    }
  };

  const handleSocialConnect = async (provider: string) => {
    setSocialLoading(provider);
    setSocialError(null);
    try {
      const res = await api.get(`/api/social/${provider}/connect`);
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      setSocialError(err.response?.data?.detail || `Failed to connect ${provider}`);
      setSocialLoading(null);
    }
  };

  const handleSocialDisconnect = async (provider: string) => {
    if (!confirm(`Disconnect ${provider}?`)) return;
    setSocialLoading(provider);
    try {
      await api.delete(`/api/social/accounts/${provider}`);
      await loadSocialAccounts();
    } catch (err: any) {
      setSocialError(err.response?.data?.detail || `Failed to disconnect ${provider}`);
    } finally {
      setSocialLoading(null);
    }
  };

  const getSocialAccount = (provider: string): SocialAccountData | null => {
    return socialAccounts[provider as keyof ConnectedAccounts] || null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/marketing/integrations', formData);
      onRefresh();
      setShowForm(false);
      setFormData({ provider: 'mailchimp', api_key: '', list_id: '', from_email: '', from_name: '' });
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to add integration');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this integration?')) return;
    try {
      await api.delete(`/api/marketing/integrations/${id}`);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete integration');
    }
  };

  const providers = [
    { id: 'mailchimp', name: 'Mailchimp', description: 'Email marketing and automation' },
    { id: 'sendgrid', name: 'SendGrid', description: 'Transactional and marketing email' },
    { id: 'resend', name: 'Resend', description: 'Email API for developers' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-white">Email Integrations</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 transition"
        >
          <Plus className="w-4 h-4" />
          Add Integration
        </button>
      </div>

      {showForm && (
        <div className="mb-8 p-6 rounded-xl bg-white/5 border border-white/10">
          <h3 className="font-medium text-white mb-4">Add Email Integration</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Provider</label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">API Key</label>
              <input
                type="password"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                required
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
                placeholder="Your API key"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">From Email</label>
                <input
                  type="email"
                  value={formData.from_email}
                  onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
                  placeholder="noreply@company.com"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">From Name</label>
                <input
                  type="text"
                  value={formData.from_name}
                  onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
                  placeholder="Your Company"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 transition disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Integration
              </button>
            </div>
          </form>
        </div>
      )}

      {integrations.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No integrations configured</p>
          <p className="text-sm mt-1">Connect your email service to send campaigns</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((integration) => {
            const provider = providers.find(p => p.id === integration.provider);
            return (
              <div key={integration.id} className="bg-white/5 rounded-xl border border-white/10 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-medium text-white">{provider?.name || integration.provider}</h3>
                    <p className="text-xs text-gray-500 mt-1">{provider?.description}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    integration.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {integration.is_active ? 'Connected' : 'Inactive'}
                  </span>
                </div>
                {integration.from_email && (
                  <p className="text-sm text-gray-400">From: {integration.from_name || integration.from_email}</p>
                )}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => handleDelete(integration.id)}
                    className="text-red-400 hover:text-red-300 text-sm transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Social Media Connections */}
      <div className="mt-12">
        <h2 className="text-lg font-semibold text-white mb-4">Social Media Connections</h2>
        <p className="text-gray-400 text-sm mb-6">
          Connect your social media accounts to publish posts directly from Made4Founders.
        </p>

        {/* Success/Error messages */}
        {socialSuccess && (
          <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 flex items-center gap-2">
            <Check className="w-5 h-5" />
            {socialSuccess}
          </div>
        )}
        {socialError && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
            <X className="w-5 h-5" />
            {socialError}
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLATFORMS.map((platform) => {
            const account = getSocialAccount(platform.id);
            const isConnected = account?.is_active;
            const isLoading = socialLoading === platform.id;
            const displayName = account?.provider_username || account?.page_name;

            return (
              <div key={platform.id} className={`rounded-xl border p-4 transition ${
                isConnected
                  ? `${platform.color} ${platform.borderColor} shadow-lg`
                  : 'bg-white/5 border-white/10'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isConnected ? 'bg-white/20' : platform.color
                  }`}>
                    <platform.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-white">{platform.label}</span>
                    {isConnected && displayName && (
                      <p className="text-xs text-white/70 truncate">@{displayName}</p>
                    )}
                  </div>
                  {isConnected && (
                    <span className="px-2 py-0.5 rounded text-xs bg-white/20 text-white font-medium">
                      Connected
                    </span>
                  )}
                </div>

                {isConnected ? (
                  <button
                    onClick={() => handleSocialDisconnect(platform.id)}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white/90 hover:bg-white/20 transition text-sm disabled:opacity-50 border border-white/20"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => handleSocialConnect(platform.id)}
                    disabled={isLoading}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg ${platform.color} ${platform.hoverColor} text-white transition text-sm font-medium disabled:opacity-50`}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Connect {platform.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Note: Some platforms require additional setup. Make sure you have configured the OAuth credentials in your environment.
        </p>
      </div>
    </div>
  );
}

// ============ Modals ============

function TemplateModal({ template, onClose, onSave }: {
  template: EmailTemplate | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    template_type: template?.template_type || 'newsletter',
    subject: template?.subject || '',
    html_content: template?.html_content || '',
    text_content: template?.text_content || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (template) {
        await api.put(`/api/marketing/templates/${template.id}`, formData);
      } else {
        await api.post('/api/marketing/templates', formData);
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1d24] rounded-2xl border border-white/10 w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-semibold text-white mb-6">
          {template ? 'Edit Template' : 'Create Template'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
                placeholder="Template name"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type</label>
              <select
                value={formData.template_type}
                onChange={(e) => setFormData({ ...formData, template_type: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
              >
                {TEMPLATE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Subject Line</label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
              placeholder="Email subject line (use {{variable}} for dynamic content)"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">HTML Content</label>
            <textarea
              value={formData.html_content}
              onChange={(e) => setFormData({ ...formData, html_content: e.target.value })}
              required
              rows={12}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-cyan-500/50 transition resize-none"
              placeholder="<html>...</html>"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Plain Text (optional)</label>
            <textarea
              value={formData.text_content}
              onChange={(e) => setFormData({ ...formData, text_content: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition resize-none"
              placeholder="Plain text version of the email..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {template ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CampaignModal({ campaign, onClose, onSave }: {
  campaign: Campaign | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: campaign?.name || '',
    campaign_type: campaign?.campaign_type || 'email',
    description: campaign?.description || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (campaign) {
        await api.put(`/api/marketing/campaigns/${campaign.id}`, formData);
      } else {
        await api.post('/api/marketing/campaigns', formData);
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Failed to save campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1d24] rounded-2xl border border-white/10 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-semibold text-white mb-6">
          {campaign ? 'Edit Campaign' : 'Create Campaign'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Campaign Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
              placeholder="e.g., Q1 Product Launch"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Type</label>
            <select
              value={formData.campaign_type}
              onChange={(e) => setFormData({ ...formData, campaign_type: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
            >
              <option value="email">Email Only</option>
              <option value="social">Social Only</option>
              <option value="both">Email + Social</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description (optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition resize-none"
              placeholder="Campaign goals and notes..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {campaign ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PreviewModal({ template, onClose }: {
  template: EmailTemplate;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1d24] rounded-2xl border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-white">{template.name}</h2>
            <p className="text-sm text-gray-400">{template.subject}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-white/10 text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 bg-gray-100 overflow-auto max-h-[calc(90vh-100px)]">
          <div
            className="bg-white mx-auto max-w-[600px] shadow-lg"
            dangerouslySetInnerHTML={{ __html: template.html_content }}
          />
        </div>
      </div>
    </div>
  );
}
