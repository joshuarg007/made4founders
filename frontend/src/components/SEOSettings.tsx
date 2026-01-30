import { useState } from 'react';
import {
  Search, Plus, Trash2, ChevronDown, ChevronRight, CheckCircle2,
  FileText, Zap, Users, Target, Globe, MapPin, Tag, Layers, Eye, X
} from 'lucide-react';
import type { WebPresence } from '../lib/api';

interface SEOSettingsProps {
  formData: Partial<WebPresence>;
  onChange: (key: keyof WebPresence, value: unknown) => void;
}

// SEO Checklist Data
const SEO_TASKS = [
  { id: 'meta-titles', title: 'Optimize Meta Titles', category: 'On-Page SEO', importance: 'critical' as const, description: 'Meta titles should be unique, descriptive, and under 60 characters.' },
  { id: 'meta-descriptions', title: 'Write Meta Descriptions', category: 'On-Page SEO', importance: 'critical' as const, description: 'Meta descriptions impact click-through rates. Keep under 160 characters.' },
  { id: 'h1-headings', title: 'Optimize H1 Headings', category: 'On-Page SEO', importance: 'high' as const, description: 'Each page should have one unique H1 heading.' },
  { id: 'image-optimization', title: 'Optimize Images', category: 'On-Page SEO', importance: 'high' as const, description: 'Add alt text, compress images, use WebP format.' },
  { id: 'xml-sitemap', title: 'Create XML Sitemap', category: 'Technical SEO', importance: 'critical' as const, description: 'Submit to Google Search Console and Bing.' },
  { id: 'robots-txt', title: 'Configure robots.txt', category: 'Technical SEO', importance: 'high' as const, description: 'Control which pages search engines can crawl.' },
  { id: 'ssl-https', title: 'Enable SSL/HTTPS', category: 'Technical SEO', importance: 'critical' as const, description: 'HTTPS is a ranking factor and essential for security.' },
  { id: 'mobile-responsive', title: 'Mobile Responsiveness', category: 'Technical SEO', importance: 'critical' as const, description: 'Google uses mobile-first indexing.' },
  { id: 'page-speed', title: 'Optimize Page Speed', category: 'Technical SEO', importance: 'high' as const, description: 'Test with PageSpeed Insights, optimize Core Web Vitals.' },
  { id: 'structured-data', title: 'Add Structured Data', category: 'Technical SEO', importance: 'medium' as const, description: 'Enable rich snippets with Schema.org markup.' },
  { id: 'open-graph', title: 'Set Up Open Graph Tags', category: 'Social SEO', importance: 'high' as const, description: 'Control how content appears when shared on social.' },
  { id: 'twitter-cards', title: 'Configure Twitter Cards', category: 'Social SEO', importance: 'medium' as const, description: 'Enhance Twitter/X sharing appearance.' },
  { id: 'search-console', title: 'Set Up Google Search Console', category: 'Analytics', importance: 'critical' as const, description: 'Monitor how Google sees your site.' },
  { id: 'google-analytics', title: 'Set Up Google Analytics', category: 'Analytics', importance: 'critical' as const, description: 'Track user behavior and measure SEO success.' },
  { id: 'backlink-audit', title: 'Audit Backlinks', category: 'Off-Page SEO', importance: 'high' as const, description: 'Identify and disavow toxic links.' },
  { id: 'local-seo', title: 'Optimize Local SEO', category: 'Off-Page SEO', importance: 'high' as const, description: 'Google Business Profile, local citations, reviews.' },
  { id: 'content-quality', title: 'Create Quality Content', category: 'Content', importance: 'critical' as const, description: 'High-quality content is the foundation of SEO.' },
  { id: 'keyword-research', title: 'Conduct Keyword Research', category: 'Content', importance: 'critical' as const, description: 'Understand what your audience searches for.' },
  { id: 'internal-linking', title: 'Optimize Internal Linking', category: 'Content', importance: 'high' as const, description: 'Help search engines understand site structure.' },
];

const IMPORTANCE_CONFIG = {
  critical: { label: 'Critical', color: 'text-red-400 border-red-400/30 bg-red-400/10' },
  high: { label: 'High', color: 'text-orange-400 border-orange-400/30 bg-orange-400/10' },
  medium: { label: 'Medium', color: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' },
  low: { label: 'Low', color: 'text-gray-400 border-gray-400/30 bg-gray-400/10' },
};

type TabType = 'keywords' | 'meta' | 'technical' | 'social' | 'local' | 'strategy' | 'checklist';

export default function SEOSettings({ formData, onChange }: SEOSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('keywords');
  const [filterCategory, setFilterCategory] = useState('all');
  const [newKeyword, setNewKeyword] = useState('');
  const [newSecondaryKeyword, setNewSecondaryKeyword] = useState('');
  const [newContentPillar, setNewContentPillar] = useState({ topic: '', description: '' });
  const [newCompetitor, setNewCompetitor] = useState({ domain: '', name: '' });
  const [newServiceArea, setNewServiceArea] = useState('');

  const checklistProgress = formData.seo_checklist_progress || {};
  const completedCount = Object.values(checklistProgress).filter(t => t.completed).length;
  const completionRate = Math.round((completedCount / SEO_TASKS.length) * 100);

  const toggleTask = (taskId: string) => {
    const newProgress = { ...checklistProgress };
    if (newProgress[taskId]?.completed) {
      delete newProgress[taskId];
    } else {
      newProgress[taskId] = { completed: true, completed_at: new Date().toISOString() };
    }
    onChange('seo_checklist_progress', newProgress);
  };

  const primaryKeywords = formData.primary_keywords || [];
  const secondaryKeywords = formData.secondary_keywords || [];
  const contentPillars = formData.content_pillars || [];
  const competitors = formData.competitors || [];
  const serviceAreas = formData.service_areas || [];

  const addPrimaryKeyword = () => {
    if (!newKeyword.trim()) return;
    onChange('primary_keywords', [...primaryKeywords, { keyword: newKeyword.trim(), priority: 5 }]);
    setNewKeyword('');
  };

  const addSecondaryKeyword = () => {
    if (!newSecondaryKeyword.trim()) return;
    onChange('secondary_keywords', [...secondaryKeywords, { keyword: newSecondaryKeyword.trim() }]);
    setNewSecondaryKeyword('');
  };

  const addContentPillar = () => {
    if (!newContentPillar.topic.trim()) return;
    onChange('content_pillars', [...contentPillars, { ...newContentPillar }]);
    setNewContentPillar({ topic: '', description: '' });
  };

  const addCompetitor = () => {
    if (!newCompetitor.domain.trim()) return;
    onChange('competitors', [...competitors, { ...newCompetitor }]);
    setNewCompetitor({ domain: '', name: '' });
  };

  const addServiceArea = () => {
    if (!newServiceArea.trim()) return;
    onChange('service_areas', [...serviceAreas, newServiceArea.trim()]);
    setNewServiceArea('');
  };

  const categories = ['all', ...Array.from(new Set(SEO_TASKS.map(t => t.category)))];
  const filteredTasks = filterCategory === 'all' ? SEO_TASKS : SEO_TASKS.filter(t => t.category === filterCategory);

  const tabs: { id: TabType; label: string; icon: typeof Search }[] = [
    { id: 'keywords', label: 'Keywords', icon: Tag },
    { id: 'meta', label: 'Meta', icon: FileText },
    { id: 'technical', label: 'Technical', icon: Zap },
    { id: 'social', label: 'Social', icon: Users },
    { id: 'local', label: 'Local', icon: MapPin },
    { id: 'strategy', label: 'Strategy', icon: Target },
    { id: 'checklist', label: 'Checklist', icon: CheckCircle2 },
  ];

  return (
    <div className="bg-[#1a1d24] rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Search className="w-6 h-6 text-white" />
          </div>
          <div className="text-left">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              SEO
              <span className="text-sm font-normal text-gray-500">({completedCount}/{SEO_TASKS.length} tasks)</span>
            </h2>
            <p className="text-sm text-gray-400">Keywords, meta tags, and optimization</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3">
            <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all" style={{ width: `${completionRate}%` }} />
            </div>
            <span className="text-sm font-medium text-white">{completionRate}%</span>
          </div>
          {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-white/10">
          {/* Tabs */}
          <div className="flex gap-1 p-2 border-b border-white/10 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  activeTab === tab.id ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Keywords Tab */}
            {activeTab === 'keywords' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-cyan-400" />
                    Primary Keywords
                  </h3>
                  <div className="space-y-2 mb-3">
                    {primaryKeywords.map((kw, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-[#1a1d24]/50 border border-white/5">
                        <span className="flex-1 text-sm text-white">{kw.keyword}</span>
                        <select
                          value={kw.priority || 5}
                          onChange={(e) => {
                            const updated = [...primaryKeywords];
                            updated[i] = { ...updated[i], priority: parseInt(e.target.value) };
                            onChange('primary_keywords', updated);
                          }}
                          className="px-2 py-1 rounded bg-[#1a1d24] border border-white/10 text-xs text-gray-300"
                        >
                          {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>Priority {n}</option>)}
                        </select>
                        <button onClick={() => onChange('primary_keywords', primaryKeywords.filter((_, idx) => idx !== i))} className="p-1 text-gray-500 hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addPrimaryKeyword()}
                      placeholder="Add primary keyword..."
                      className="flex-1 px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50"
                    />
                    <button onClick={addPrimaryKeyword} className="px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-violet-400" />
                    Secondary / Long-tail Keywords
                  </h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {secondaryKeywords.map((kw, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-sm text-violet-300">
                        {kw.keyword}
                        <button onClick={() => onChange('secondary_keywords', secondaryKeywords.filter((_, idx) => idx !== i))} className="ml-1 hover:text-red-400">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSecondaryKeyword}
                      onChange={(e) => setNewSecondaryKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addSecondaryKeyword()}
                      placeholder="Add secondary keyword..."
                      className="flex-1 px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50"
                    />
                    <button onClick={addSecondaryKeyword} className="px-3 py-2 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Meta Tab */}
            {activeTab === 'meta' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Brand Name</label>
                  <input type="text" value={formData.brand_name || ''} onChange={(e) => onChange('brand_name', e.target.value)} placeholder="Your Brand Name" className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tagline</label>
                  <input type="text" value={formData.tagline || ''} onChange={(e) => onChange('tagline', e.target.value)} placeholder="Your brand tagline" className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Meta Title Template</label>
                  <input type="text" value={formData.meta_title_template || ''} onChange={(e) => onChange('meta_title_template', e.target.value)} placeholder="{Page Title} | {Brand Name}" maxLength={70} className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50" />
                  <p className="text-xs text-gray-500 mt-1">{(formData.meta_title_template || '').length}/70 characters</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Default Meta Description</label>
                  <textarea value={formData.meta_description || ''} onChange={(e) => onChange('meta_description', e.target.value)} placeholder="A compelling description for search results..." maxLength={160} rows={3} className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50 resize-none" />
                  <p className="text-xs text-gray-500 mt-1">{(formData.meta_description || '').length}/160 characters</p>
                </div>
              </div>
            )}

            {/* Technical Tab */}
            {activeTab === 'technical' && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Canonical URL</label>
                    <input type="url" value={formData.canonical_url || ''} onChange={(e) => onChange('canonical_url', e.target.value)} placeholder="https://www.example.com" className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Sitemap URL</label>
                    <input type="url" value={formData.sitemap_url || ''} onChange={(e) => onChange('sitemap_url', e.target.value)} placeholder="https://www.example.com/sitemap.xml" className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Robots Directives</label>
                  <select value={formData.robots_directives || 'index, follow'} onChange={(e) => onChange('robots_directives', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50">
                    <option value="index, follow">index, follow (default)</option>
                    <option value="noindex, follow">noindex, follow</option>
                    <option value="index, nofollow">index, nofollow</option>
                    <option value="noindex, nofollow">noindex, nofollow</option>
                  </select>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Google Search Console ID</label>
                    <input type="text" value={formData.google_search_console_id || ''} onChange={(e) => onChange('google_search_console_id', e.target.value)} placeholder="Verification code" className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Google Analytics ID</label>
                    <input type="text" value={formData.google_analytics_id || ''} onChange={(e) => onChange('google_analytics_id', e.target.value)} placeholder="G-XXXXXXXXXX" className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Bing Webmaster ID</label>
                    <input type="text" value={formData.bing_webmaster_id || ''} onChange={(e) => onChange('bing_webmaster_id', e.target.value)} placeholder="Verification code" className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50" />
                  </div>
                </div>
              </div>
            )}

            {/* Social Tab */}
            {activeTab === 'social' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Default OG Image URL</label>
                  <input type="url" value={formData.og_image_url || ''} onChange={(e) => onChange('og_image_url', e.target.value)} placeholder="https://www.example.com/og-image.png" className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50" />
                  <p className="text-xs text-gray-500 mt-1">Recommended: 1200x630px</p>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">OG Type</label>
                    <select value={formData.og_type || 'website'} onChange={(e) => onChange('og_type', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50">
                      <option value="website">website</option>
                      <option value="article">article</option>
                      <option value="product">product</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Twitter Card Type</label>
                    <select value={formData.twitter_card_type || 'summary_large_image'} onChange={(e) => onChange('twitter_card_type', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50">
                      <option value="summary">summary</option>
                      <option value="summary_large_image">summary_large_image</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Twitter Handle</label>
                  <input type="text" value={formData.twitter_handle || ''} onChange={(e) => onChange('twitter_handle', e.target.value)} placeholder="@yourhandle" className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50" />
                </div>
              </div>
            )}

            {/* Local Tab */}
            {activeTab === 'local' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Business Name (NAP)</label>
                  <input type="text" value={formData.business_name || ''} onChange={(e) => onChange('business_name', e.target.value)} placeholder="Your Business Name" className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Business Address</label>
                  <textarea value={formData.business_address || ''} onChange={(e) => onChange('business_address', e.target.value)} placeholder="123 Main St, City, State ZIP" rows={2} className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50 resize-none" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Business Phone</label>
                  <input type="tel" value={formData.business_phone || ''} onChange={(e) => onChange('business_phone', e.target.value)} placeholder="(555) 123-4567" className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Service Areas</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {serviceAreas.map((area, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300">
                        <MapPin className="w-3 h-3" />{area}
                        <button onClick={() => onChange('service_areas', serviceAreas.filter((_, idx) => idx !== i))} className="ml-1 hover:text-red-400"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={newServiceArea} onChange={(e) => setNewServiceArea(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addServiceArea()} placeholder="Add service area..." className="flex-1 px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50" />
                    <button onClick={addServiceArea} className="px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            )}

            {/* Strategy Tab */}
            {activeTab === 'strategy' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Target Audience</label>
                  <textarea value={formData.target_audience || ''} onChange={(e) => onChange('target_audience', e.target.value)} placeholder="Describe your ideal customers..." rows={3} className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50 resize-none" />
                </div>

                <div>
                  <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2"><Layers className="w-4 h-4 text-amber-400" />Content Pillars</h3>
                  <div className="space-y-2 mb-3">
                    {contentPillars.map((p, i) => (
                      <div key={i} className="p-3 rounded-lg bg-[#1a1d24]/50 border border-white/5 flex items-start justify-between">
                        <div><div className="font-medium text-white text-sm">{p.topic}</div>{p.description && <div className="text-xs text-gray-500 mt-1">{p.description}</div>}</div>
                        <button onClick={() => onChange('content_pillars', contentPillars.filter((_, idx) => idx !== i))} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <input type="text" value={newContentPillar.topic} onChange={(e) => setNewContentPillar({ ...newContentPillar, topic: e.target.value })} placeholder="Topic name..." className="w-full px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50" />
                    <div className="flex gap-2">
                      <input type="text" value={newContentPillar.description} onChange={(e) => setNewContentPillar({ ...newContentPillar, description: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addContentPillar()} placeholder="Description (optional)..." className="flex-1 px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50" />
                      <button onClick={addContentPillar} className="px-3 py-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"><Plus className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2"><Eye className="w-4 h-4 text-red-400" />Competitors to Track</h3>
                  <div className="space-y-2 mb-3">
                    {competitors.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1d24]/50 border border-white/5">
                        <Globe className="w-4 h-4 text-gray-500" />
                        <div className="flex-1"><div className="text-sm text-white">{c.domain}</div>{c.name && <div className="text-xs text-gray-500">{c.name}</div>}</div>
                        <button onClick={() => onChange('competitors', competitors.filter((_, idx) => idx !== i))} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="grid md:grid-cols-2 gap-2">
                    <input type="text" value={newCompetitor.domain} onChange={(e) => setNewCompetitor({ ...newCompetitor, domain: e.target.value })} placeholder="competitor.com" className="px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50" />
                    <div className="flex gap-2">
                      <input type="text" value={newCompetitor.name} onChange={(e) => setNewCompetitor({ ...newCompetitor, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addCompetitor()} placeholder="Company name" className="flex-1 px-3 py-2 rounded-lg bg-[#1a1d24]/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50" />
                      <button onClick={addCompetitor} className="px-3 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"><Plus className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Checklist Tab */}
            {activeTab === 'checklist' && (
              <div>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-[#1a1d24]/50 rounded-lg border border-white/5 p-4">
                    <div className="text-2xl font-bold text-white">{completionRate}%</div>
                    <div className="text-xs text-gray-500">Progress</div>
                  </div>
                  <div className="bg-[#1a1d24]/50 rounded-lg border border-white/5 p-4">
                    <div className="text-2xl font-bold text-red-400">{SEO_TASKS.filter(t => t.importance === 'critical' && checklistProgress[t.id]?.completed).length}/{SEO_TASKS.filter(t => t.importance === 'critical').length}</div>
                    <div className="text-xs text-gray-500">Critical</div>
                  </div>
                  <div className="bg-[#1a1d24]/50 rounded-lg border border-white/5 p-4">
                    <div className="text-2xl font-bold text-white">{completionRate >= 80 ? 'Good' : completionRate >= 50 ? 'Fair' : 'Needs Work'}</div>
                    <div className="text-xs text-gray-500">Health</div>
                  </div>
                </div>

                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                  {categories.map((cat) => (
                    <button key={cat} onClick={() => setFilterCategory(cat)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${filterCategory === cat ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-[#1a1d24]/50 text-gray-400 border border-white/5 hover:text-white'}`}>
                      {cat === 'all' ? 'All' : cat}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {filteredTasks.map((task) => {
                    const isCompleted = checklistProgress[task.id]?.completed;
                    const config = IMPORTANCE_CONFIG[task.importance];
                    return (
                      <div key={task.id} className={`flex items-center gap-3 p-3 rounded-lg border transition ${isCompleted ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-[#1a1d24]/30 border-white/5 hover:border-white/10'}`}>
                        <button onClick={() => toggleTask(task.id)} className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition ${isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/20 hover:border-emerald-500/50'}`}>
                          {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${isCompleted ? 'text-gray-400 line-through' : 'text-white'}`}>{task.title}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] border ${config.color}`}>{config.label}</span>
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5">{task.category}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
