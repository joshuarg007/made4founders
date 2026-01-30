import { useEffect, useState } from 'react';
import { Search, Save, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { getWebPresence, updateWebPresence, type WebPresence } from '../lib/api';
import { useBusiness } from '../context/BusinessContext';
import BusinessFilter from '../components/BusinessFilter';
import SEOSettings from '../components/SEOSettings';

export default function SEO() {
  const { businesses, currentBusiness } = useBusiness();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [formData, setFormData] = useState<Partial<WebPresence>>({});
  const [selectedBusinessIds, setSelectedBusinessIds] = useState<number[] | 'all' | 'none'>('all');

  // Get the first selected business for loading data
  const selectedBusiness = Array.isArray(selectedBusinessIds) && selectedBusinessIds.length > 0
    ? businesses.find(b => b.id === selectedBusinessIds[0])
    : currentBusiness;

  const loadPresence = async () => {
    setLoading(true);
    try {
      // TODO: Load web presence for specific business when API supports it
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
  }, [selectedBusiness?.id]);

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

  // Quick stats
  const checklistProgress = formData.seo_checklist_progress || {};
  const completedCount = Object.values(checklistProgress).filter((t: any) => t?.completed).length;
  const totalTasks = 19; // Total SEO tasks in checklist
  const completionRate = Math.round((completedCount / totalTasks) * 100);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center">
              <Search className="w-5 h-5 text-white" />
            </div>
            SEO
          </h1>
          <p className="text-gray-400 mt-1">Optimize your search engine visibility</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Business Filter */}
          <BusinessFilter
            value={selectedBusinessIds}
            onChange={setSelectedBusinessIds}
            showNoBusiness={false}
            className="w-48"
          />

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
              hasChanges
                ? 'bg-gradient-to-r from-cyan-500 to-emerald-600 text-white hover:opacity-90'
                : 'bg-[#1a1d24]/50 text-gray-500 cursor-not-allowed'
            }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-4">
          <div className="text-2xl font-bold text-white">{completionRate}%</div>
          <div className="text-xs text-gray-500">SEO Score</div>
          <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-4">
          <div className="text-2xl font-bold text-white">{completedCount}/{totalTasks}</div>
          <div className="text-xs text-gray-500">Tasks Complete</div>
        </div>

        <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-4">
          <div className="text-2xl font-bold text-white">{(formData.primary_keywords || []).length}</div>
          <div className="text-xs text-gray-500">Primary Keywords</div>
        </div>

        <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-4">
          <div className="text-2xl font-bold text-white">
            {formData.ssl_enabled ? (
              <span className="text-emerald-400">Secure</span>
            ) : (
              <span className="text-amber-400">Check</span>
            )}
          </div>
          <div className="text-xs text-gray-500">SSL Status</div>
        </div>
      </div>

      {/* Website Link */}
      {formData.website_url && (
        <div className="bg-[#1a1d24]/50 rounded-lg border border-white/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            Managing SEO for:
            <span className="text-white font-medium">{formData.website_url}</span>
          </div>
          <a
            href={formData.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-cyan-400 text-sm hover:underline"
          >
            Visit Site
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* SEO Settings Component */}
      <SEOSettings formData={formData} onChange={handleChange} />

      {/* Quick Links */}
      <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">SEO Tools</h2>
        <div className="grid md:grid-cols-4 gap-3">
          {[
            { label: 'Google Search Console', url: 'https://search.google.com/search-console', desc: 'Monitor search performance' },
            { label: 'PageSpeed Insights', url: 'https://pagespeed.web.dev/', desc: 'Test Core Web Vitals' },
            { label: 'Rich Results Test', url: 'https://search.google.com/test/rich-results', desc: 'Validate structured data' },
            { label: 'Mobile-Friendly Test', url: 'https://search.google.com/test/mobile-friendly', desc: 'Check mobile usability' },
            { label: 'Bing Webmaster', url: 'https://www.bing.com/webmasters', desc: 'Bing search performance' },
            { label: 'Schema.org', url: 'https://schema.org/', desc: 'Structured data reference' },
            { label: 'Open Graph Debugger', url: 'https://developers.facebook.com/tools/debug/', desc: 'Debug social shares' },
            { label: 'Twitter Card Validator', url: 'https://cards-dev.twitter.com/validator', desc: 'Test Twitter cards' },
          ].map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-lg bg-[#1a1d24]/50 hover:bg-[#1a1d24] border border-white/5 hover:border-white/10 transition group"
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

      {/* Floating Save Button */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-600 text-white font-medium shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-105 transition-all"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}
