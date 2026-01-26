/**
 * NotificationsPage - Full notifications management page
 *
 * Lists all notifications with filtering, bulk actions, and
 * ability to navigate to related entities.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  MessageCircle,
  UserPlus,
  CheckCircle,
  AlertCircle,
  Calendar,
  FileText,
  AtSign,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  Inbox,
} from 'lucide-react';
import {
  getNotifications,
  markNotificationsRead,
  deleteNotification,
  type Notification,
} from '../lib/api';

// Notification type to icon mapping
const NOTIFICATION_ICONS: Record<string, React.ElementType> = {
  mention: AtSign,
  comment_reply: MessageCircle,
  task_assigned: UserPlus,
  task_completed: CheckCircle,
  deadline_reminder: Calendar,
  document_shared: FileText,
  investor_update_sent: AlertCircle,
  guest_access_granted: UserPlus,
};

// Notification type colors
const NOTIFICATION_COLORS: Record<string, string> = {
  mention: 'bg-cyan-500/20 text-cyan-400',
  comment_reply: 'bg-blue-500/20 text-blue-400',
  task_assigned: 'bg-violet-500/20 text-violet-400',
  task_completed: 'bg-green-500/20 text-green-400',
  deadline_reminder: 'bg-yellow-500/20 text-yellow-400',
  document_shared: 'bg-purple-500/20 text-purple-400',
  investor_update_sent: 'bg-pink-500/20 text-pink-400',
  guest_access_granted: 'bg-emerald-500/20 text-emerald-400',
};

// Entity type to route mapping
const ENTITY_ROUTES: Record<string, string> = {
  task: '/app/tasks',
  deadline: '/app/deadlines',
  document: '/app/documents',
  contact: '/app/contacts',
  metric: '/app/insights',
  meeting: '/app/meetings',
  investor_update: '/app/investor-updates',
  data_room_document: '/app/data-room',
};

type FilterType = 'all' | 'unread' | 'mention' | 'comment_reply' | 'task_assigned' | 'deadline_reminder';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const loadNotifications = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
      }
      const newOffset = reset ? 0 : offset;
      const params: { limit: number; offset: number; unread_only?: boolean; notification_type?: string } = {
        limit: 50,
        offset: newOffset,
      };
      if (filter === 'unread') {
        params.unread_only = true;
      } else if (filter !== 'all') {
        params.notification_type = filter;
      }
      const data = await getNotifications(params);
      if (reset) {
        setNotifications(data.items);
      } else {
        setNotifications((prev) => [...prev, ...data.items]);
      }
      setHasMore(data.items.length === 50);
      setOffset(newOffset + data.items.length);
    } catch {
      // Error handled by global handler
    } finally {
      setLoading(false);
    }
  }, [filter, offset]);

  useEffect(() => {
    loadNotifications(true);
  }, [filter]);

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      await markNotificationsRead([notification.id]);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
    }

    // Navigate to entity if available
    if (notification.entity_type && notification.entity_id) {
      const route = ENTITY_ROUTES[notification.entity_type];
      if (route) {
        navigate(`${route}?id=${notification.entity_id}`);
      }
    }
  };

  const handleMarkSelectedRead = async () => {
    if (selectedIds.size === 0) return;
    try {
      await markNotificationsRead(Array.from(selectedIds));
      setNotifications((prev) =>
        prev.map((n) => (selectedIds.has(n.id) ? { ...n, is_read: true } : n))
      );
      setSelectedIds(new Set());
    } catch {
      // Error handled by global handler
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // Error handled by global handler
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} notification(s)?`)) return;
    try {
      await Promise.all(Array.from(selectedIds).map((id) => deleteNotification(id)));
      setNotifications((prev) => prev.filter((n) => !selectedIds.has(n.id)));
      setSelectedIds(new Set());
    } catch {
      // Error handled by global handler
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map((n) => n.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadNotifications(false);
    }
  };

  const getIcon = (type: string) => {
    return NOTIFICATION_ICONS[type] || Bell;
  };

  const getColor = (type: string) => {
    return NOTIFICATION_COLORS[type] || 'bg-gray-500/20 text-gray-400';
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filters: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'unread', label: `Unread (${unreadCount})` },
    { value: 'mention', label: 'Mentions' },
    { value: 'comment_reply', label: 'Replies' },
    { value: 'task_assigned', label: 'Assigned' },
    { value: 'deadline_reminder', label: 'Deadlines' },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Notifications</h1>
          <p className="text-gray-400">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : 'You\'re all caught up!'}
          </p>
        </div>
        <button
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCheck className="w-4 h-4" />
          Mark all read
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition ${
              filter === f.value
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-gray-400 hover:bg-white/5 border border-transparent'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
          <span className="text-sm text-gray-400">
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleMarkSelectedRead}
            className="flex items-center gap-1 px-3 py-1 text-sm text-cyan-400 hover:bg-cyan-500/10 rounded transition"
          >
            <Check className="w-4 h-4" />
            Mark read
          </button>
          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-1 px-3 py-1 text-sm text-red-400 hover:bg-red-500/10 rounded transition"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-sm text-gray-400 hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Notifications List */}
      {loading && notifications.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse flex gap-4 p-4 bg-white/5 rounded-lg">
              <div className="w-10 h-10 bg-white/10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/10 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12">
          <Inbox className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No notifications</h3>
          <p className="text-gray-400">
            {filter !== 'all'
              ? 'No notifications match your filter.'
              : 'You\'ll see notifications here when someone mentions you or assigns you tasks.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Select All */}
          <div className="flex items-center gap-3 px-4 py-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.size === notifications.length && notifications.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/20"
              />
              <span className="text-sm text-gray-400">Select all</span>
            </label>
          </div>

          {/* Notification Items */}
          {notifications.map((notification) => {
            const Icon = getIcon(notification.notification_type);
            const colorClass = getColor(notification.notification_type);
            const isSelected = selectedIds.has(notification.id);

            return (
              <div
                key={notification.id}
                className={`flex items-start gap-4 p-4 rounded-lg border transition ${
                  notification.is_read
                    ? 'bg-[#1a1d24] border-white/10 hover:border-white/20'
                    : 'bg-cyan-900/10 border-cyan-500/20 hover:border-cyan-500/30'
                } ${isSelected ? 'ring-1 ring-cyan-500/50' : ''}`}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(notification.id)}
                  className="mt-3 w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/20"
                  onClick={(e) => e.stopPropagation()}
                />

                {/* Main content - clickable */}
                <button
                  onClick={() => handleNotificationClick(notification)}
                  className="flex-1 flex items-start gap-4 text-left min-w-0"
                >
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${notification.is_read ? 'text-gray-300' : 'text-white font-medium'}`}>
                      {notification.title}
                    </p>
                    {notification.message && (
                      <p className="text-sm text-gray-500 truncate mt-0.5">
                        {notification.message}
                      </p>
                    )}
                    <p className="text-xs text-gray-600 mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>

                  {/* Unread indicator */}
                  {!notification.is_read && (
                    <div className="flex-shrink-0 w-2 h-2 bg-cyan-500 rounded-full self-center" />
                  )}
                </button>
              </div>
            );
          })}

          {/* Load More */}
          {hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition disabled:opacity-50"
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
