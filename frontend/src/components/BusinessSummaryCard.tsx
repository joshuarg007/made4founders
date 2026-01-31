import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Users,
  Calendar,
  CheckSquare,
  TrendingUp,
  ChevronRight,
} from 'lucide-react';
import type { Business } from '../lib/api';

interface BusinessStats {
  documents_count: number;
  contacts_count: number;
  deadlines_count: number;
  deadlines_overdue: number;
  tasks_count: number;
  tasks_in_progress: number;
  checklist_progress: number;
}

interface BusinessSummaryCardProps {
  business: Business;
}

export default function BusinessSummaryCard({ business }: BusinessSummaryCardProps) {
  const [stats, setStats] = useState<BusinessStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/businesses/${business.id}/stats`, {
          credentials: 'include',
        });
        if (response.ok) {
          setStats(await response.json());
        }
      } catch (err) {
        console.error('Failed to fetch business stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [business.id]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-[#1a1d24] border border-white/10 p-6 animate-pulse">
        <div className="h-6 w-32 bg-white/5 rounded mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const statItems = [
    {
      label: 'Documents',
      value: stats?.documents_count || 0,
      icon: FileText,
      color: 'cyan',
      link: '/app/documents',
    },
    {
      label: 'Contacts',
      value: stats?.contacts_count || 0,
      icon: Users,
      color: 'violet',
      link: '/app/contacts',
    },
    {
      label: 'Deadlines',
      value: stats?.deadlines_count || 0,
      subtext: stats?.deadlines_overdue ? `${stats.deadlines_overdue} overdue` : undefined,
      icon: Calendar,
      color: stats?.deadlines_overdue ? 'red' : 'amber',
      link: '/app/tasks',
    },
    {
      label: 'Tasks',
      value: stats?.tasks_count || 0,
      subtext: stats?.tasks_in_progress ? `${stats.tasks_in_progress} in progress` : undefined,
      icon: CheckSquare,
      color: 'emerald',
      link: '/app/tasks',
    },
  ];

  return (
    <div
      className="rounded-2xl border p-6 transition-all"
      style={{
        backgroundColor: '#1a1d24',
        borderColor: business.color ? `${business.color}30` : 'rgba(255,255,255,0.1)',
        borderLeftWidth: '4px',
        borderLeftColor: business.color || 'rgba(255,255,255,0.1)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{business.emoji || '🏢'}</span>
          <div>
            <h3 className="font-semibold text-white">{business.name}</h3>
            <p className="text-xs text-gray-500 capitalize">{business.business_type}</p>
          </div>
        </div>
        {stats?.checklist_progress !== undefined && stats.checklist_progress > 0 && (
          <div className="text-right">
            <div className="text-sm font-medium" style={{ color: business.color || '#22d3ee' }}>
              {stats.checklist_progress}%
            </div>
            <div className="text-xs text-gray-500">Checklist</div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {statItems.map(item => (
          <Link
            key={item.label}
            to={item.link}
            className="group p-3 rounded-xl bg-[#0f1117]/50 hover:bg-[#0f1117] border border-white/5 hover:border-white/10 transition"
          >
            <div className="flex items-center gap-2 mb-1">
              <item.icon className={`w-4 h-4 text-${item.color}-400`} />
              <span className="text-xs text-gray-500">{item.label}</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-xl font-bold text-white">{item.value}</span>
              {item.subtext && (
                <span className={`text-xs text-${item.color}-400`}>{item.subtext}</span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
        <Link
          to="/app/checklist"
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition"
        >
          <TrendingUp className="w-4 h-4" />
          <span>View Checklist</span>
        </Link>
        <Link
          to="/app/businesses"
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition group"
        >
          <span>Manage</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
        </Link>
      </div>
    </div>
  );
}
