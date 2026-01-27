import { useState } from 'react';
import { Package, Link2, Wrench, Bookmark } from 'lucide-react';

// Import the content from existing pages
import ProductsOffered from './ProductsOffered';
import Services from './Services';
import ProductsUsed from './ProductsUsed';
import WebLinks from './WebLinks';

type Tab = 'products' | 'services' | 'tools' | 'bookmarks';

const tabs = [
  { id: 'products' as Tab, label: 'Products', icon: Package, description: 'Products you sell' },
  { id: 'services' as Tab, label: 'Services', icon: Link2, description: 'Services you offer' },
  { id: 'tools' as Tab, label: 'Tools', icon: Wrench, description: 'Software and tools you use' },
  { id: 'bookmarks' as Tab, label: 'Bookmarks', icon: Bookmark, description: 'Important web links' },
];

export default function Offerings() {
  const [activeTab, setActiveTab] = useState<Tab>('products');

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Offerings</h1>
        <p className="text-gray-400 mt-1">Manage your products, services, tools, and resources</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-8 border-b border-white/10 pb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1d24]/5 border border-transparent'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="-m-8">
        {activeTab === 'products' && <ProductsOffered />}
        {activeTab === 'services' && <Services />}
        {activeTab === 'tools' && <ProductsUsed />}
        {activeTab === 'bookmarks' && <WebLinks />}
      </div>
    </div>
  );
}
