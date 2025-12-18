import { useEffect, useState } from 'react';
import {
  Globe,
  Mail,
  Monitor,
  Share2,
  MapPin,
  ExternalLink,
  CheckCircle2,
  Save,
  Loader2,
  Shield,
  RefreshCw,
  Linkedin,
  Github,
  Instagram,
  Youtube,
  Facebook,
  Plus,
  Trash2
} from 'lucide-react';
import { getWebPresence, updateWebPresence, type WebPresence, type AdditionalEmail, type AdditionalWebsite, type AdditionalSocial } from '../lib/api';

const registrars = ['Namecheap', 'Cloudflare', 'GoDaddy', 'Google Domains', 'Porkbun', 'Other'];
const emailProviders = ['Google Workspace', 'Microsoft 365', 'Zoho Mail', 'Fastmail', 'ProtonMail', 'Other'];
const websitePlatforms = ['Webflow', 'Framer', 'WordPress', 'Squarespace', 'Wix', 'Carrd', 'Custom', 'Other'];
const hostingProviders = ['Vercel', 'Netlify', 'AWS', 'Cloudflare Pages', 'DigitalOcean', 'Heroku', 'Other'];

const socialPlatforms = [
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'twitter', label: 'Twitter / X', icon: null },
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'facebook', label: 'Facebook', icon: Facebook },
  { value: 'youtube', label: 'YouTube', icon: Youtube },
  { value: 'github', label: 'GitHub', icon: Github },
  { value: 'tiktok', label: 'TikTok', icon: null },
  { value: 'pinterest', label: 'Pinterest', icon: null },
  { value: 'threads', label: 'Threads', icon: null },
  { value: 'discord', label: 'Discord', icon: null },
  { value: 'slack', label: 'Slack', icon: null },
  { value: 'mastodon', label: 'Mastodon', icon: null },
  { value: 'bluesky', label: 'Bluesky', icon: null },
  { value: 'reddit', label: 'Reddit', icon: null },
  { value: 'twitch', label: 'Twitch', icon: null },
  { value: 'snapchat', label: 'Snapchat', icon: null },
  { value: 'whatsapp', label: 'WhatsApp Business', icon: null },
  { value: 'telegram', label: 'Telegram', icon: null },
  { value: 'other', label: 'Other', icon: null },
];

export default function Website() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [formData, setFormData] = useState<Partial<WebPresence>>({});

  const loadPresence = async () => {
    try {
      const data = await getWebPresence();
      setFormData(data);
    } catch (err) {
      console.error('Failed to load web presence:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPresence();
  }, []);

  const handleChange = (field: keyof WebPresence, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateWebPresence(formData);
      setFormData(updated);
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const getDaysUntil = (dateStr: string | null) => {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Additional emails helpers
  const addEmail = () => {
    const emails = formData.additional_emails || [];
    handleChange('additional_emails', [...emails, { provider: '', domain: '', email: '', notes: '' }]);
  };

  const updateEmail = (index: number, field: keyof AdditionalEmail, value: string) => {
    const emails = [...(formData.additional_emails || [])];
    emails[index] = { ...emails[index], [field]: value };
    handleChange('additional_emails', emails);
  };

  const removeEmail = (index: number) => {
    const emails = (formData.additional_emails || []).filter((_, i) => i !== index);
    handleChange('additional_emails', emails.length > 0 ? emails : null);
  };

  // Additional websites helpers
  const addWebsite = () => {
    const websites = formData.additional_websites || [];
    handleChange('additional_websites', [...websites, { name: '', url: '', platform: '', hosting: '', ssl_enabled: false }]);
  };

  const updateWebsite = (index: number, field: keyof AdditionalWebsite, value: string | boolean) => {
    const websites = [...(formData.additional_websites || [])];
    websites[index] = { ...websites[index], [field]: value };
    handleChange('additional_websites', websites);
  };

  const removeWebsite = (index: number) => {
    const websites = (formData.additional_websites || []).filter((_, i) => i !== index);
    handleChange('additional_websites', websites.length > 0 ? websites : null);
  };

  // Additional socials helpers
  const addSocial = () => {
    const socials = formData.additional_socials || [];
    handleChange('additional_socials', [...socials, { platform: 'other', url: '', handle: '' }]);
  };

  const updateSocial = (index: number, field: keyof AdditionalSocial, value: string) => {
    const socials = [...(formData.additional_socials || [])];
    socials[index] = { ...socials[index], [field]: value };
    handleChange('additional_socials', socials);
  };

  const removeSocial = (index: number) => {
    const socials = (formData.additional_socials || []).filter((_, i) => i !== index);
    handleChange('additional_socials', socials.length > 0 ? socials : null);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  const domainDaysLeft = getDaysUntil(formData.domain_expiration as string);

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Web Presence</h1>
          <p className="text-gray-400 mt-1">Manage your online presence and digital assets</p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
            hasChanges
              ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white hover:opacity-90'
              : 'bg-white/5 text-gray-500 cursor-not-allowed'
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* Current Status Overview */}
      {(formData.domain_name || formData.website_url) && (
        <div className="bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-cyan-500/20 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Current Status</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {formData.domain_name && (
              <div className="bg-black/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <Globe className="w-4 h-4" />
                  Domain
                </div>
                <div className="text-white font-medium">{formData.domain_name}</div>
                {domainDaysLeft !== null && (
                  <div className={`text-xs mt-1 ${domainDaysLeft < 30 ? 'text-amber-400' : 'text-gray-500'}`}>
                    {domainDaysLeft > 0 ? `Expires in ${domainDaysLeft} days` : 'Expired!'}
                  </div>
                )}
              </div>
            )}
            {formData.email_domain && (
              <div className="bg-black/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <Mail className="w-4 h-4" />
                  Email
                </div>
                <div className="text-white font-medium">@{formData.email_domain}</div>
                {formData.email_provider && (
                  <div className="text-xs text-gray-500 mt-1">{formData.email_provider}</div>
                )}
              </div>
            )}
            {formData.website_url && (
              <div className="bg-black/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <Monitor className="w-4 h-4" />
                  Website
                </div>
                <a
                  href={formData.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 font-medium hover:underline flex items-center gap-1"
                >
                  Visit Site
                  <ExternalLink className="w-3 h-3" />
                </a>
                {formData.ssl_enabled && (
                  <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> SSL Enabled
                  </div>
                )}
              </div>
            )}
            {formData.google_business_url && (
              <div className="bg-black/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <MapPin className="w-4 h-4" />
                  Google Business
                </div>
                <a
                  href={formData.google_business_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 font-medium hover:underline flex items-center gap-1"
                >
                  View Profile
                  <ExternalLink className="w-3 h-3" />
                </a>
                {formData.google_business_verified && (
                  <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Domain Section */}
      <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <Globe className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Domain Name</h2>
            <p className="text-sm text-gray-400">Your business address on the internet</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Domain Name</label>
            <input
              type="text"
              value={formData.domain_name || ''}
              onChange={(e) => handleChange('domain_name', e.target.value)}
              placeholder="yourcompany.com"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Registrar</label>
            <select
              value={formData.domain_registrar || ''}
              onChange={(e) => handleChange('domain_registrar', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            >
              <option value="" className="bg-[#1a1d24] text-white">Select registrar...</option>
              {registrars.map(r => (
                <option key={r} value={r} className="bg-[#1a1d24] text-white">{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Expiration Date</label>
            <input
              type="date"
              value={formData.domain_expiration?.split('T')[0] || ''}
              onChange={(e) => handleChange('domain_expiration', e.target.value ? new Date(e.target.value).toISOString() : null)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div className="flex items-center gap-6 pt-6">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.domain_privacy || false}
                onChange={(e) => handleChange('domain_privacy', e.target.checked)}
                className="rounded bg-white/5 border-white/10 text-cyan-500"
              />
              <Shield className="w-4 h-4" />
              Privacy Protection
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.domain_auto_renew || false}
                onChange={(e) => handleChange('domain_auto_renew', e.target.checked)}
                className="rounded bg-white/5 border-white/10 text-cyan-500"
              />
              <RefreshCw className="w-4 h-4" />
              Auto-Renew
            </label>
          </div>
        </div>
      </div>

      {/* Email Section */}
      <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Mail className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Professional Email</h2>
              <p className="text-sm text-gray-400">you@yourcompany.com for credibility</p>
            </div>
          </div>
          <button
            onClick={addEmail}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Email
          </button>
        </div>

        {/* Primary Email */}
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email Provider</label>
            <select
              value={formData.email_provider || ''}
              onChange={(e) => handleChange('email_provider', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            >
              <option value="" className="bg-[#1a1d24] text-white">Select provider...</option>
              {emailProviders.map(p => (
                <option key={p} value={p} className="bg-[#1a1d24] text-white">{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email Domain</label>
            <input
              type="text"
              value={formData.email_domain || ''}
              onChange={(e) => handleChange('email_domain', e.target.value)}
              placeholder="yourcompany.com"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Admin Email</label>
            <input
              type="email"
              value={formData.email_admin || ''}
              onChange={(e) => handleChange('email_admin', e.target.value)}
              placeholder="admin@yourcompany.com"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>

        {/* Additional Emails */}
        {formData.additional_emails && formData.additional_emails.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="text-sm text-gray-400">Additional Email Accounts</div>
            {formData.additional_emails.map((email, index) => (
              <div key={index} className="grid md:grid-cols-4 gap-3 p-3 rounded-lg bg-white/5">
                <select
                  value={email.provider || ''}
                  onChange={(e) => updateEmail(index, 'provider', e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="" className="bg-[#1a1d24] text-white">Provider...</option>
                  {emailProviders.map(p => (
                    <option key={p} value={p} className="bg-[#1a1d24] text-white">{p}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={email.domain || ''}
                  onChange={(e) => updateEmail(index, 'domain', e.target.value)}
                  placeholder="Domain"
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                />
                <input
                  type="email"
                  value={email.email || ''}
                  onChange={(e) => updateEmail(index, 'email', e.target.value)}
                  placeholder="Email address"
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={email.notes || ''}
                    onChange={(e) => updateEmail(index, 'notes', e.target.value)}
                    placeholder="Notes"
                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                  />
                  <button
                    onClick={() => removeEmail(index)}
                    className="p-2 text-gray-500 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Website Section */}
      <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Website</h2>
              <p className="text-sm text-gray-400">Your digital storefront and brand hub</p>
            </div>
          </div>
          <button
            onClick={addWebsite}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Website
          </button>
        </div>

        {/* Primary Website */}
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-400 mb-1">Website URL</label>
            <input
              type="url"
              value={formData.website_url || ''}
              onChange={(e) => handleChange('website_url', e.target.value)}
              placeholder="https://yourcompany.com"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Platform</label>
            <select
              value={formData.website_platform || ''}
              onChange={(e) => handleChange('website_platform', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            >
              <option value="" className="bg-[#1a1d24] text-white">Select platform...</option>
              {websitePlatforms.map(p => (
                <option key={p} value={p} className="bg-[#1a1d24] text-white">{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Hosting Provider</label>
            <select
              value={formData.website_hosting || ''}
              onChange={(e) => handleChange('website_hosting', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            >
              <option value="" className="bg-[#1a1d24] text-white">Select hosting...</option>
              {hostingProviders.map(h => (
                <option key={h} value={h} className="bg-[#1a1d24] text-white">{h}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.ssl_enabled || false}
                onChange={(e) => handleChange('ssl_enabled', e.target.checked)}
                className="rounded bg-white/5 border-white/10 text-cyan-500"
              />
              <Shield className="w-4 h-4" />
              SSL/HTTPS Enabled
            </label>
          </div>
        </div>

        {/* Additional Websites */}
        {formData.additional_websites && formData.additional_websites.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="text-sm text-gray-400">Additional Websites</div>
            {formData.additional_websites.map((site, index) => (
              <div key={index} className="p-3 rounded-lg bg-white/5">
                <div className="grid md:grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    value={site.name || ''}
                    onChange={(e) => updateWebsite(index, 'name', e.target.value)}
                    placeholder="Site name (e.g., Blog, Documentation)"
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                  />
                  <input
                    type="url"
                    value={site.url || ''}
                    onChange={(e) => updateWebsite(index, 'url', e.target.value)}
                    placeholder="https://..."
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div className="grid md:grid-cols-4 gap-3">
                  <select
                    value={site.platform || ''}
                    onChange={(e) => updateWebsite(index, 'platform', e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="" className="bg-[#1a1d24] text-white">Platform...</option>
                    {websitePlatforms.map(p => (
                      <option key={p} value={p} className="bg-[#1a1d24] text-white">{p}</option>
                    ))}
                  </select>
                  <select
                    value={site.hosting || ''}
                    onChange={(e) => updateWebsite(index, 'hosting', e.target.value)}
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="" className="bg-[#1a1d24] text-white">Hosting...</option>
                    {hostingProviders.map(h => (
                      <option key={h} value={h} className="bg-[#1a1d24] text-white">{h}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={site.ssl_enabled || false}
                      onChange={(e) => updateWebsite(index, 'ssl_enabled', e.target.checked)}
                      className="rounded bg-white/5 border-white/10 text-cyan-500"
                    />
                    SSL
                  </label>
                  <div className="flex justify-end">
                    <button
                      onClick={() => removeWebsite(index)}
                      className="p-2 text-gray-500 hover:text-red-400 transition"
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

      {/* Social Media Section */}
      <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Social Media</h2>
              <p className="text-sm text-gray-400">Connect with your audience</p>
            </div>
          </div>
          <button
            onClick={addSocial}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Social
          </button>
        </div>

        {/* Built-in Social Media Fields */}
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <Linkedin className="w-4 h-4" /> LinkedIn
            </label>
            <input
              type="url"
              value={formData.linkedin_url || ''}
              onChange={(e) => handleChange('linkedin_url', e.target.value)}
              placeholder="https://linkedin.com/company/..."
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              Twitter / X
            </label>
            <input
              type="url"
              value={formData.twitter_url || ''}
              onChange={(e) => handleChange('twitter_url', e.target.value)}
              placeholder="https://twitter.com/..."
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <Instagram className="w-4 h-4" /> Instagram
            </label>
            <input
              type="url"
              value={formData.instagram_url || ''}
              onChange={(e) => handleChange('instagram_url', e.target.value)}
              placeholder="https://instagram.com/..."
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <Facebook className="w-4 h-4" /> Facebook
            </label>
            <input
              type="url"
              value={formData.facebook_url || ''}
              onChange={(e) => handleChange('facebook_url', e.target.value)}
              placeholder="https://facebook.com/..."
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <Youtube className="w-4 h-4" /> YouTube
            </label>
            <input
              type="url"
              value={formData.youtube_url || ''}
              onChange={(e) => handleChange('youtube_url', e.target.value)}
              placeholder="https://youtube.com/@..."
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <Github className="w-4 h-4" /> GitHub
            </label>
            <input
              type="url"
              value={formData.github_url || ''}
              onChange={(e) => handleChange('github_url', e.target.value)}
              placeholder="https://github.com/..."
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
              TikTok
            </label>
            <input
              type="url"
              value={formData.tiktok_url || ''}
              onChange={(e) => handleChange('tiktok_url', e.target.value)}
              placeholder="https://tiktok.com/@..."
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>

        {/* Additional Social Media */}
        {formData.additional_socials && formData.additional_socials.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="text-sm text-gray-400">Additional Social Media</div>
            {formData.additional_socials.map((social, index) => (
              <div key={index} className="grid md:grid-cols-4 gap-3 p-3 rounded-lg bg-white/5">
                <select
                  value={social.platform}
                  onChange={(e) => updateSocial(index, 'platform', e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                >
                  {socialPlatforms.map(p => (
                    <option key={p.value} value={p.value} className="bg-[#1a1d24] text-white">{p.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={social.handle || ''}
                  onChange={(e) => updateSocial(index, 'handle', e.target.value)}
                  placeholder="@handle"
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                />
                <input
                  type="url"
                  value={social.url || ''}
                  onChange={(e) => updateSocial(index, 'url', e.target.value)}
                  placeholder="https://..."
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => removeSocial(index)}
                    className="p-2 text-gray-500 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Google Business Section */}
      <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Google Business Profile</h2>
            <p className="text-sm text-gray-400">Local search visibility</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Google Business URL</label>
            <input
              type="url"
              value={formData.google_business_url || ''}
              onChange={(e) => handleChange('google_business_url', e.target.value)}
              placeholder="https://business.google.com/..."
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.google_business_verified || false}
                onChange={(e) => handleChange('google_business_verified', e.target.checked)}
                className="rounded bg-white/5 border-white/10 text-cyan-500"
              />
              <CheckCircle2 className="w-4 h-4" />
              Verified
            </label>
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Notes</h2>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={4}
          placeholder="Additional notes about your web presence..."
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 resize-none"
        />
      </div>

      {/* Quick Links */}
      <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Tools</h2>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { label: 'Domain Search', url: 'https://www.namecheap.com/domains/', desc: 'Find available domains' },
            { label: 'SSL Checker', url: 'https://www.sslshopper.com/ssl-checker.html', desc: 'Verify SSL certificate' },
            { label: 'PageSpeed', url: 'https://pagespeed.web.dev/', desc: 'Test website speed' },
            { label: 'DNS Checker', url: 'https://dnschecker.org/', desc: 'Check DNS propagation' },
            { label: 'DMARC Check', url: 'https://mxtoolbox.com/dmarc.aspx', desc: 'Email deliverability' },
            { label: 'Accessibility', url: 'https://wave.webaim.org/', desc: 'Test accessibility' }
          ].map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition group"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-white font-medium">{link.label}</span>
                <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-gray-300" />
              </div>
              <p className="text-xs text-gray-500 mt-1">{link.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
