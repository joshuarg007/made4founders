import { useState } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';

// Import the content from existing pages
import Metrics from './Metrics';
import Analytics from './Analytics';

type Tab = 'metrics' | 'insights';

const tabs = [
  { id: 'metrics' as Tab, label: 'Metrics', icon: BarChart3, description: 'Track KPIs and business metrics' },
  { id: 'insights' as Tab, label: 'Insights', icon: TrendingUp, description: 'Growth trends and forecasts' },
];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('metrics');

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400 mt-1">Track your business metrics and analyze growth trends</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-8 border-b border-white/10 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all ${
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
      <div className="-m-8">
        {activeTab === 'metrics' && <Metrics />}
        {activeTab === 'insights' && <Analytics />}
      </div>
    </div>
  );
}
