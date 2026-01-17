import { useState } from 'react';
import { Landmark, Shield } from 'lucide-react';

// Import the content from existing pages
import Banking from './Banking';
import Vault from './Vault';

type Tab = 'banking' | 'vault';

const tabs = [
  { id: 'banking' as Tab, label: 'Banking', icon: Landmark, description: 'Bank accounts and transactions' },
  { id: 'vault' as Tab, label: 'Credential Vault', icon: Shield, description: 'Secure password storage' },
];

export default function Finance() {
  const [activeTab, setActiveTab] = useState<Tab>('banking');

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Finance</h1>
        <p className="text-gray-400 mt-1">Manage banking and secure credentials</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-8 border-b border-white/10 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="-m-8">
        {activeTab === 'banking' && <Banking />}
        {activeTab === 'vault' && <Vault />}
      </div>
    </div>
  );
}
