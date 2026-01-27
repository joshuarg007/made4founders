/**
 * ActivityFeed - Organization-wide activity stream
 *
 * Shows all recent activity across the organization including
 * comments, task updates, document uploads, etc.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Activity,
  MessageCircle,
  CheckCircle,
  FileText,
  Upload,
  UserPlus,
  Calendar,
  Pencil,
  Trash2,
  RefreshCw,
  Filter,
  Clock,
} from 'lucide-react';
import { getActivityFeed, type Activity as ActivityType } from '../lib/api';

// Activity type icons
const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  comment_created: MessageCircle,
  task_completed: CheckCircle,
  task_created: CheckCircle,
  document_uploaded: Upload,
  document_shared: FileText,
  deadline_created: Calendar,
  deadline_completed: Calendar,
  contact_created: UserPlus,
  investor_update_sent: FileText,
  metric_recorded: Activity,
  entity_updated: Pencil,
  entity_deleted: Trash2,
};

// Activity type colors
const ACTIVITY_COLORS: Record<string, string> = {
  comment_created: 'bg-blue-500/20 text-blue-400',
  task_completed: 'bg-green-500/20 text-green-400',
  task_created: 'bg-cyan-500/20 text-cyan-400',
  document_uploaded: 'bg-violet-500/20 text-violet-400',
  document_shared: 'bg-purple-500/20 text-purple-400',
  deadline_created: 'bg-yellow-500/20 text-yellow-400',
  deadline_completed: 'bg-green-500/20 text-green-400',
  contact_created: 'bg-emerald-500/20 text-emerald-400',
  investor_update_sent: 'bg-pink-500/20 text-pink-400',
  metric_recorded: 'bg-orange-500/20 text-orange-400',
  entity_updated: 'bg-white/50/20 text-gray-400',
  entity_deleted: 'bg-red-500/20 text-red-400',
};

// Entity type routes for navigation
const ENTITY_ROUTES: Record<string, string> = {
  task: '/app/tasks',
  deadline: '/app/deadlines',
  document: '/app/documents',
  contact: '/app/contacts',
  metric: '/app/analytics',
  investor_update: '/app/investor-updates',
  data_room_document: '/app/data-room',
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  comment_created: 'Comment',
  task_completed: 'Task Complete',
  task_created: 'Task',
  document_uploaded: 'Upload',
  document_shared: 'Share',
  deadline_created: 'Deadline',
  deadline_completed: 'Deadline Complete',
  contact_created: 'Contact',
  investor_update_sent: 'Investor Update',
  metric_recorded: 'Metric',
  entity_updated: 'Update',
  entity_deleted: 'Delete',
};

export default function ActivityFeed() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const loadActivities = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
      }
      const newOffset = reset ? 0 : offset;
      const params: { limit: number; offset: number; activity_type?: string } = {
        limit: 50,
        offset: newOffset,
      };
      if (filter !== 'all') {
        params.activity_type = filter;
      }
      const data = await getActivityFeed(params);
      if (reset) {
        setActivities(data.items);
      } else {
        setActivities((prev) => [...prev, ...data.items]);
      }
      setHasMore(data.items.length === 50);
      setOffset(newOffset + data.items.length);
    } catch {
      // Error handled by global handler
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, offset]);

  useEffect(() => {
    loadActivities(true);
  }, [filter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadActivities(true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadActivities(false);
    }
  };

  const handleActivityClick = (activity: ActivityType) => {
    if (activity.entity_type && activity.entity_id) {
      const route = ENTITY_ROUTES[activity.entity_type];
      if (route) {
        navigate(`${route}?id=${activity.entity_id}`);
      }
    }
  };

  const getIcon = (type: string) => {
    return ACTIVITY_ICONS[type] || Activity;
  };

  const getColor = (type: string) => {
    return ACTIVITY_COLORS[type] || 'bg-white/50/20 text-gray-400';
  };

  // Group activities by date
  const groupedActivities = activities.reduce((groups, activity) => {
    const date = format(new Date(activity.created_at), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, ActivityType[]>);

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
      return 'Today';
    } else if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) {
      return 'Yesterday';
    }
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  const activityTypes = [
    { value: 'all', label: 'All Activity' },
    { value: 'comment_created', label: 'Comments' },
    { value: 'task_completed', label: 'Tasks Completed' },
    { value: 'task_created', label: 'Tasks Created' },
    { value: 'document_uploaded', label: 'Documents Uploaded' },
    { value: 'deadline_created', label: 'Deadlines' },
    { value: 'contact_created', label: 'Contacts' },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Activity Feed</h1>
          <p className="text-gray-400">See what's happening across your organization</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#1a1d24]/10 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
        {activityTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => setFilter(type.value)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition ${
              filter === type.value
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-gray-400 hover:bg-[#1a1d24]/5 border border-transparent'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Activity List */}
      {loading && activities.length === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse flex gap-4 p-4 bg-[#1a1d24]/5 rounded-lg">
              <div className="w-10 h-10 bg-[#1a1d24]/10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[#1a1d24]/10 rounded w-3/4" />
                <div className="h-3 bg-[#1a1d24]/10 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No activity yet</h3>
          <p className="text-gray-400">
            Activity will appear here as you and your team work on tasks, documents, and more.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedActivities).map(([date, dateActivities]) => (
            <div key={date}>
              {/* Date Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="text-sm font-medium text-gray-400">{getDateLabel(date)}</div>
                <div className="flex-1 h-px bg-[#1a1d24]/10" />
              </div>

              {/* Activities for this date */}
              <div className="space-y-2">
                {dateActivities.map((activity) => {
                  const Icon = getIcon(activity.activity_type);
                  const colorClass = getColor(activity.activity_type);

                  return (
                    <button
                      key={activity.id}
                      onClick={() => handleActivityClick(activity)}
                      className="w-full flex items-start gap-4 p-4 rounded-lg bg-[#1a1d24] border border-white/10 hover:border-white/20 transition text-left"
                    >
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}>
                        <Icon className="w-5 h-5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-sm text-white">{activity.description}</span>
                            {activity.entity_title && (
                              <span className="text-sm text-cyan-400 ml-1">
                                "{activity.entity_title}"
                              </span>
                            )}
                          </div>
                          <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs ${colorClass}`}>
                            {ACTIVITY_TYPE_LABELS[activity.activity_type] || activity.activity_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          {activity.user && (
                            <span className="text-xs text-gray-500">
                              {activity.user.name || activity.user.email}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Load More */}
          {hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-4 py-2 bg-[#1a1d24]/10 text-white rounded-lg hover:bg-[#1a1d24]/20 transition disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
