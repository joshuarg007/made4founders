import { useState, useEffect, useRef } from 'react';
import {
  Palette,
  Type,
  Image,
  FileText,
  Plus,
  Trash2,
  Edit3,
  Download,
  Upload,
  Check,
  Loader2,
  Copy,
  Star,
  ExternalLink,
} from 'lucide-react';
import api from '../lib/api';

// Types
interface BrandColor {
  id: number;
  organization_id: number;
  color_type: string;
  hex_value: string;
  name: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface BrandFont {
  id: number;
  organization_id: number;
  font_family: string;
  usage: string;
  font_weight: string | null;
  google_font_url: string | null;
  fallback_fonts: string | null;
  created_at: string;
  updated_at: string;
}

interface BrandAsset {
  id: number;
  organization_id: number;
  asset_type: string;
  name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  description: string | null;
  tags: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

interface BrandGuideline {
  id: number;
  organization_id: number;
  title: string;
  category: string;
  content: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

const COLOR_TYPES = [
  { value: 'primary', label: 'Primary', description: 'Main brand color' },
  { value: 'secondary', label: 'Secondary', description: 'Supporting color' },
  { value: 'accent', label: 'Accent', description: 'Highlight color' },
  { value: 'background', label: 'Background', description: 'Page background' },
  { value: 'text', label: 'Text', description: 'Default text color' },
  { value: 'success', label: 'Success', description: 'Success states' },
  { value: 'warning', label: 'Warning', description: 'Warning states' },
  { value: 'error', label: 'Error', description: 'Error states' },
  { value: 'neutral', label: 'Neutral', description: 'Gray tones' },
];

const FONT_USAGES = [
  { value: 'heading', label: 'Headings' },
  { value: 'body', label: 'Body Text' },
  { value: 'accent', label: 'Accent/Display' },
  { value: 'monospace', label: 'Monospace/Code' },
];

const ASSET_TYPES = [
  { value: 'logo_primary', label: 'Primary Logo' },
  { value: 'logo_secondary', label: 'Secondary Logo' },
  { value: 'logo_icon', label: 'Icon/Favicon' },
  { value: 'logo_dark', label: 'Logo (Dark Mode)' },
  { value: 'logo_light', label: 'Logo (Light Mode)' },
  { value: 'pattern', label: 'Brand Pattern' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'other', label: 'Other' },
];

const GUIDELINE_CATEGORIES = [
  'Logo Usage',
  'Color Guidelines',
  'Typography',
  'Spacing & Layout',
  'Imagery',
  'Voice & Tone',
  'Do\'s and Don\'ts',
  'Other',
];

type Tab = 'colors' | 'fonts' | 'assets' | 'guidelines';

export default function Branding() {
  const [activeTab, setActiveTab] = useState<Tab>('colors');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data
  const [colors, setColors] = useState<BrandColor[]>([]);
  const [fonts, setFonts] = useState<BrandFont[]>([]);
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [guidelines, setGuidelines] = useState<BrandGuideline[]>([]);

  // Modals
  const [showColorModal, setShowColorModal] = useState(false);
  const [showFontModal, setShowFontModal] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showGuidelineModal, setShowGuidelineModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [colorsRes, fontsRes, assetsRes, guidelinesRes] = await Promise.all([
        api.get('/api/branding/colors'),
        api.get('/api/branding/fonts'),
        api.get('/api/branding/assets'),
        api.get('/api/branding/guidelines'),
      ]);
      setColors(colorsRes.data);
      setFonts(fontsRes.data);
      setAssets(assetsRes.data);
      setGuidelines(guidelinesRes.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load branding data');
    } finally {
      setLoading(false);
    }
  };

  const exportBrandKit = async () => {
    try {
      const response = await api.get('/api/branding/kit/export', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'brand-kit.json');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to export brand kit');
    }
  };

  const tabs = [
    { id: 'colors', label: 'Colors', icon: Palette, count: colors.length },
    { id: 'fonts', label: 'Fonts', icon: Type, count: fonts.length },
    { id: 'assets', label: 'Assets', icon: Image, count: assets.length },
    { id: 'guidelines', label: 'Guidelines', icon: FileText, count: guidelines.length },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Brand Assets</h1>
          <p className="text-gray-400 mt-1">Manage your brand colors, fonts, logos, and guidelines</p>
        </div>
        <button
          onClick={exportBrandKit}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white transition"
        >
          <Download className="w-4 h-4" />
          Export Brand Kit
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-white/10 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === tab.id
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'colors' && (
        <ColorsTab
          colors={colors}
          onAdd={() => { setEditingItem(null); setShowColorModal(true); }}
          onEdit={(c) => { setEditingItem(c); setShowColorModal(true); }}
          onRefresh={loadData}
        />
      )}

      {activeTab === 'fonts' && (
        <FontsTab
          fonts={fonts}
          onAdd={() => { setEditingItem(null); setShowFontModal(true); }}
          onEdit={(f) => { setEditingItem(f); setShowFontModal(true); }}
          onRefresh={loadData}
        />
      )}

      {activeTab === 'assets' && (
        <AssetsTab
          assets={assets}
          onAdd={() => { setEditingItem(null); setShowAssetModal(true); }}
          onEdit={(a) => { setEditingItem(a); setShowAssetModal(true); }}
          onRefresh={loadData}
        />
      )}

      {activeTab === 'guidelines' && (
        <GuidelinesTab
          guidelines={guidelines}
          onAdd={() => { setEditingItem(null); setShowGuidelineModal(true); }}
          onEdit={(g) => { setEditingItem(g); setShowGuidelineModal(true); }}
          onRefresh={loadData}
        />
      )}

      {/* Modals */}
      {showColorModal && (
        <ColorModal
          color={editingItem}
          onClose={() => setShowColorModal(false)}
          onSave={loadData}
        />
      )}

      {showFontModal && (
        <FontModal
          font={editingItem}
          onClose={() => setShowFontModal(false)}
          onSave={loadData}
        />
      )}

      {showAssetModal && (
        <AssetModal
          asset={editingItem}
          onClose={() => setShowAssetModal(false)}
          onSave={loadData}
        />
      )}

      {showGuidelineModal && (
        <GuidelineModal
          guideline={editingItem}
          onClose={() => setShowGuidelineModal(false)}
          onSave={loadData}
        />
      )}
    </div>
  );
}

// ============ Colors Tab ============
function ColorsTab({ colors, onAdd, onEdit, onRefresh }: {
  colors: BrandColor[];
  onAdd: () => void;
  onEdit: (c: BrandColor) => void;
  onRefresh: () => void;
}) {
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const copyToClipboard = (hex: string, id: number) => {
    navigator.clipboard.writeText(hex);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this color?')) return;
    try {
      await api.delete(`/api/branding/colors/${id}`);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete color');
    }
  };

  // Group colors by type
  const colorsByType = colors.reduce((acc, color) => {
    if (!acc[color.color_type]) acc[color.color_type] = [];
    acc[color.color_type].push(color);
    return acc;
  }, {} as Record<string, BrandColor[]>);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-white">Brand Colors</h2>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 transition"
        >
          <Plus className="w-4 h-4" />
          Add Color
        </button>
      </div>

      {colors.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Palette className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No colors defined yet</p>
          <p className="text-sm mt-1">Add your brand colors to get started</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {COLOR_TYPES.map((type) => {
            const typeColors = colorsByType[type.value] || [];
            if (typeColors.length === 0) return null;

            return (
              <div key={type.value} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10">
                  <h3 className="font-medium text-white">{type.label}</h3>
                  <p className="text-xs text-gray-500">{type.description}</p>
                </div>
                <div className="p-4 space-y-3">
                  {typeColors.map((color) => (
                    <div key={color.id} className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg border border-white/20"
                        style={{ backgroundColor: color.hex_value }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {color.name || color.hex_value}
                        </div>
                        <div className="text-xs text-gray-500">{color.hex_value}</div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => copyToClipboard(color.hex_value, color.id)}
                          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition"
                          title="Copy hex"
                        >
                          {copiedId === color.id ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => onEdit(color)}
                          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(color.id)}
                          className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ Fonts Tab ============
function FontsTab({ fonts, onAdd, onEdit, onRefresh }: {
  fonts: BrandFont[];
  onAdd: () => void;
  onEdit: (f: BrandFont) => void;
  onRefresh: () => void;
}) {
  const handleDelete = async (id: number) => {
    if (!confirm('Delete this font?')) return;
    try {
      await api.delete(`/api/branding/fonts/${id}`);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete font');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-white">Brand Fonts</h2>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 transition"
        >
          <Plus className="w-4 h-4" />
          Add Font
        </button>
      </div>

      {fonts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Type className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No fonts defined yet</p>
          <p className="text-sm mt-1">Add your brand typography to get started</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {fonts.map((font) => {
            const usage = FONT_USAGES.find(u => u.value === font.usage);
            return (
              <div key={font.id} className="bg-white/5 rounded-xl border border-white/10 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-medium text-cyan-400 uppercase tracking-wider">
                      {usage?.label || font.usage}
                    </span>
                    <h3 className="text-xl font-semibold text-white mt-1" style={{ fontFamily: font.font_family }}>
                      {font.font_family}
                    </h3>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onEdit(font)}
                      className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(font.id)}
                      className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {font.font_weight && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Weight</span>
                      <span className="text-gray-300">{font.font_weight}</span>
                    </div>
                  )}
                  {font.fallback_fonts && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Fallbacks</span>
                      <span className="text-gray-300 text-right truncate max-w-[200px]">
                        {font.fallback_fonts}
                      </span>
                    </div>
                  )}
                  {font.google_font_url && (
                    <a
                      href={font.google_font_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Google Fonts
                    </a>
                  )}
                </div>

                <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10">
                  <p style={{ fontFamily: font.font_family, fontWeight: font.font_weight || 400 }} className="text-gray-300">
                    The quick brown fox jumps over the lazy dog. 0123456789
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ Assets Tab ============
function AssetsTab({ assets, onAdd, onEdit, onRefresh }: {
  assets: BrandAsset[];
  onAdd: () => void;
  onEdit: (a: BrandAsset) => void;
  onRefresh: () => void;
}) {
  const handleDelete = async (id: number) => {
    if (!confirm('Delete this asset?')) return;
    try {
      await api.delete(`/api/branding/assets/${id}`);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete asset');
    }
  };

  const handleDownload = async (asset: BrandAsset) => {
    try {
      const response = await api.get(`/api/branding/assets/${asset.id}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', asset.name + (asset.file_path.includes('.') ? asset.file_path.substring(asset.file_path.lastIndexOf('.')) : ''));
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download asset');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Group assets by type
  const assetsByType = assets.reduce((acc, asset) => {
    if (!acc[asset.asset_type]) acc[asset.asset_type] = [];
    acc[asset.asset_type].push(asset);
    return acc;
  }, {} as Record<string, BrandAsset[]>);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-white">Brand Assets</h2>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 transition"
        >
          <Upload className="w-4 h-4" />
          Upload Asset
        </button>
      </div>

      {assets.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Image className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No assets uploaded yet</p>
          <p className="text-sm mt-1">Upload logos, icons, and other brand imagery</p>
        </div>
      ) : (
        <div className="space-y-8">
          {ASSET_TYPES.map((type) => {
            const typeAssets = assetsByType[type.value] || [];
            if (typeAssets.length === 0) return null;

            return (
              <div key={type.value}>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
                  {type.label}
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {typeAssets.map((asset) => (
                    <div key={asset.id} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden group">
                      <div className="aspect-square bg-[#0a0d14] flex items-center justify-center p-4 relative">
                        {asset.mime_type?.startsWith('image/') ? (
                          <img
                            src={`/api/branding/assets/${asset.id}/download`}
                            alt={asset.name}
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <FileText className="w-16 h-16 text-gray-600" />
                        )}
                        {asset.is_primary && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-xs flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            Primary
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleDownload(asset)}
                            className="p-2 rounded-lg bg-white/20 text-white hover:bg-white/30 transition"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => onEdit(asset)}
                            className="p-2 rounded-lg bg-white/20 text-white hover:bg-white/30 transition"
                          >
                            <Edit3 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(asset.id)}
                            className="p-2 rounded-lg bg-red-500/50 text-white hover:bg-red-500/70 transition"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <div className="p-3">
                        <h4 className="font-medium text-white truncate">{asset.name}</h4>
                        <p className="text-xs text-gray-500">{formatFileSize(asset.file_size)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ Guidelines Tab ============
function GuidelinesTab({ guidelines, onAdd, onEdit, onRefresh }: {
  guidelines: BrandGuideline[];
  onAdd: () => void;
  onEdit: (g: BrandGuideline) => void;
  onRefresh: () => void;
}) {
  const handleDelete = async (id: number) => {
    if (!confirm('Delete this guideline?')) return;
    try {
      await api.delete(`/api/branding/guidelines/${id}`);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete guideline');
    }
  };

  // Group guidelines by category
  const guidelinesByCategory = guidelines.reduce((acc, g) => {
    if (!acc[g.category]) acc[g.category] = [];
    acc[g.category].push(g);
    return acc;
  }, {} as Record<string, BrandGuideline[]>);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-white">Brand Guidelines</h2>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 transition"
        >
          <Plus className="w-4 h-4" />
          Add Guideline
        </button>
      </div>

      {guidelines.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No guidelines defined yet</p>
          <p className="text-sm mt-1">Document your brand rules and standards</p>
        </div>
      ) : (
        <div className="space-y-8">
          {GUIDELINE_CATEGORIES.map((category) => {
            const categoryGuidelines = guidelinesByCategory[category] || [];
            if (categoryGuidelines.length === 0) return null;

            return (
              <div key={category}>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
                  {category}
                </h3>
                <div className="space-y-4">
                  {categoryGuidelines.map((guideline) => (
                    <div key={guideline.id} className="bg-white/5 rounded-xl border border-white/10 p-6">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="text-lg font-medium text-white">{guideline.title}</h4>
                        <div className="flex gap-1">
                          <button
                            onClick={() => onEdit(guideline)}
                            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(guideline.id)}
                            className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="prose prose-invert prose-sm max-w-none">
                        <div className="text-gray-300 whitespace-pre-wrap">{guideline.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ Modals ============

function ColorModal({ color, onClose, onSave }: {
  color: BrandColor | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    color_type: color?.color_type || 'primary',
    hex_value: color?.hex_value || '#000000',
    name: color?.name || '',
    description: color?.description || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (color) {
        await api.put(`/api/branding/colors/${color.id}`, formData);
      } else {
        await api.post('/api/branding/colors', formData);
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Failed to save color');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1d24] rounded-2xl border border-white/10 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-semibold text-white mb-6">
          {color ? 'Edit Color' : 'Add Color'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Color Type</label>
            <select
              value={formData.color_type}
              onChange={(e) => setFormData({ ...formData, color_type: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
            >
              {COLOR_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Hex Value</label>
            <div className="flex gap-3">
              <input
                type="color"
                value={formData.hex_value}
                onChange={(e) => setFormData({ ...formData, hex_value: e.target.value })}
                className="h-12 w-16 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={formData.hex_value}
                onChange={(e) => setFormData({ ...formData, hex_value: e.target.value })}
                className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
                placeholder="#000000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Name (optional)</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
              placeholder="e.g., Ocean Blue"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description (optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition resize-none"
              placeholder="When to use this color..."
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
              {color ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FontModal({ font, onClose, onSave }: {
  font: BrandFont | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    font_family: font?.font_family || '',
    usage: font?.usage || 'body',
    font_weight: font?.font_weight || '400',
    google_font_url: font?.google_font_url || '',
    fallback_fonts: font?.fallback_fonts || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (font) {
        await api.put(`/api/branding/fonts/${font.id}`, formData);
      } else {
        await api.post('/api/branding/fonts', formData);
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Failed to save font');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1d24] rounded-2xl border border-white/10 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-semibold text-white mb-6">
          {font ? 'Edit Font' : 'Add Font'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Font Family</label>
            <input
              type="text"
              value={formData.font_family}
              onChange={(e) => setFormData({ ...formData, font_family: e.target.value })}
              required
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
              placeholder="e.g., Inter, Roboto"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Usage</label>
            <select
              value={formData.usage}
              onChange={(e) => setFormData({ ...formData, usage: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
            >
              {FONT_USAGES.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Font Weight</label>
            <select
              value={formData.font_weight}
              onChange={(e) => setFormData({ ...formData, font_weight: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
            >
              <option value="100">100 - Thin</option>
              <option value="200">200 - Extra Light</option>
              <option value="300">300 - Light</option>
              <option value="400">400 - Regular</option>
              <option value="500">500 - Medium</option>
              <option value="600">600 - Semi Bold</option>
              <option value="700">700 - Bold</option>
              <option value="800">800 - Extra Bold</option>
              <option value="900">900 - Black</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Google Fonts URL (optional)</label>
            <input
              type="url"
              value={formData.google_font_url}
              onChange={(e) => setFormData({ ...formData, google_font_url: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
              placeholder="https://fonts.google.com/specimen/..."
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Fallback Fonts (optional)</label>
            <input
              type="text"
              value={formData.fallback_fonts}
              onChange={(e) => setFormData({ ...formData, fallback_fonts: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
              placeholder="e.g., system-ui, sans-serif"
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
              {font ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssetModal({ asset, onClose, onSave }: {
  asset: BrandAsset | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    asset_type: asset?.asset_type || 'logo_primary',
    name: asset?.name || '',
    description: asset?.description || '',
    tags: asset?.tags || '',
    is_primary: asset?.is_primary || false,
  });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (asset) {
        // Update existing asset metadata
        const form = new FormData();
        if (formData.name) form.append('name', formData.name);
        if (formData.description) form.append('description', formData.description);
        if (formData.tags) form.append('tags', formData.tags);
        form.append('is_primary', String(formData.is_primary));

        await api.put(`/api/branding/assets/${asset.id}`, form);
      } else {
        // Upload new asset
        if (!file) {
          alert('Please select a file');
          setLoading(false);
          return;
        }

        const form = new FormData();
        form.append('file', file);
        form.append('asset_type', formData.asset_type);
        form.append('name', formData.name || file.name);
        if (formData.description) form.append('description', formData.description);
        if (formData.tags) form.append('tags', formData.tags);
        form.append('is_primary', String(formData.is_primary));

        await api.post('/api/branding/assets', form);
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Failed to save asset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1d24] rounded-2xl border border-white/10 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-semibold text-white mb-6">
          {asset ? 'Edit Asset' : 'Upload Asset'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!asset && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">File</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.svg,.webp,.gif,.ico,.pdf"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) {
                    setFile(selectedFile);
                    if (!formData.name) {
                      setFormData({ ...formData, name: selectedFile.name.replace(/\.[^/.]+$/, '') });
                    }
                  }
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-6 rounded-lg border-2 border-dashed border-white/20 hover:border-white/40 transition text-center"
              >
                {file ? (
                  <div>
                    <p className="text-white font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                    <p className="text-gray-400">Click to select file</p>
                    <p className="text-xs text-gray-600 mt-1">PNG, JPG, SVG, WebP, GIF, ICO, PDF</p>
                  </div>
                )}
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Asset Type</label>
            <select
              value={formData.asset_type}
              onChange={(e) => setFormData({ ...formData, asset_type: e.target.value })}
              disabled={!!asset}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition disabled:opacity-50"
            >
              {ASSET_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
              placeholder="Asset name"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description (optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition resize-none"
              placeholder="Usage notes..."
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Tags (optional)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
              placeholder="dark, square, marketing"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_primary}
              onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
              className="w-5 h-5 rounded bg-white/5 border border-white/20 text-cyan-500 focus:ring-cyan-500/50"
            />
            <span className="text-gray-300">Set as primary asset for this type</span>
          </label>

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
              disabled={loading || (!asset && !file)}
              className="flex-1 py-3 rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {asset ? 'Update' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GuidelineModal({ guideline, onClose, onSave }: {
  guideline: BrandGuideline | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    title: guideline?.title || '',
    category: guideline?.category || 'Other',
    content: guideline?.content || '',
    order_index: guideline?.order_index || 0,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (guideline) {
        await api.put(`/api/branding/guidelines/${guideline.id}`, formData);
      } else {
        await api.post('/api/branding/guidelines', formData);
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Failed to save guideline');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1d24] rounded-2xl border border-white/10 w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-semibold text-white mb-6">
          {guideline ? 'Edit Guideline' : 'Add Guideline'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
              placeholder="e.g., Minimum Logo Size"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition"
            >
              {GUIDELINE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Content</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              required
              rows={6}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 transition resize-none"
              placeholder="Describe the guideline in detail..."
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
              {guideline ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
