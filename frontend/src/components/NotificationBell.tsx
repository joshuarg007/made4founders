/**
 * NotificationBell - Header notification indicator with dropdown
 *
 * Displays unread notification count badge and dropdown list.
 * Polls for new notifications every 30 seconds.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
  X,
} from 'lucide-react';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
  type Notification,
} from '../lib/api';

const POLL_INTERVAL = 30000; // 30 seconds

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

export default function NotificationBell() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { count } = await getUnreadNotificationCount();
      setUnreadCount(count);
    } catch {
      // Silently fail - don't disrupt UX for polling errors
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getNotifications({ limit: 10 });
      setNotifications(data.items);
      setUnreadCount(data.unread_count);
    } catch {
      // Error handled by global handler
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and polling
  useEffect(() => {
    fetchUnreadCount();

    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Load full notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      await markNotificationsRead([notification.id]);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    // Navigate to entity if available
    if (notification.entity_type && notification.entity_id) {
      const route = ENTITY_ROUTES[notification.entity_type];
      if (route) {
        navigate(`${route}?id=${notification.entity_id}`);
        setIsOpen(false);
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Error handled by global handler
    }
  };

  const getIcon = (type: string) => {
    const Icon = NOTIFICATION_ICONS[type] || Bell;
    return Icon;
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-cyan-500 text-white text-xs font-bold rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {notifications.map((notification) => {
                  const Icon = getIcon(notification.notification_type);
                  return (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`w-full p-3 text-left hover:bg-white/5 transition-colors flex gap-3 ${
                        !notification.is_read ? 'bg-cyan-900/10' : ''
                      }`}
                    >
                      {/* Icon */}
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          !notification.is_read
                            ? 'bg-cyan-600/20 text-cyan-400'
                            : 'bg-white/5 text-gray-500'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm ${
                            !notification.is_read ? 'text-white' : 'text-gray-400'
                          }`}
                        >
                          {notification.title}
                        </p>
                        {notification.message && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {notification.message}
                          </p>
                        )}
                        <p className="text-xs text-gray-600 mt-1">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>

                      {/* Unread indicator */}
                      {!notification.is_read && (
                        <div className="flex-shrink-0 w-2 h-2 bg-cyan-500 rounded-full self-center" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2 border-t border-white/10">
              <button
                onClick={() => {
                  navigate('/app/notifications');
                  setIsOpen(false);
                }}
                className="w-full py-2 text-center text-sm text-cyan-400 hover:text-cyan-300 hover:bg-white/5 rounded-lg transition-colors"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
