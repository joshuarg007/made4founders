import { useEffect, useState } from 'react';
import {
  MessageSquare,
  Loader2,
  Link2,
  Unlink,
  CheckCircle,
  Settings,
  Send,
  Bell,
  Calendar,
  ListTodo,
  TrendingUp,
  Clock,
  Hash,
} from 'lucide-react';
import {
  getSlackConnection,
  getSlackConnectUrl,
  disconnectSlack,
  updateSlackSettings,
  getSlackChannels,
  sendSlackTestMessage,
  type SlackConnection,
  type SlackChannel,
} from '../lib/api';

export default function SlackIntegration() {
  const [connection, setConnection] = useState<SlackConnection | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Settings form state
  const [selectedChannel, setSelectedChannel] = useState('');
  const [notifyDeadlines, setNotifyDeadlines] = useState(true);
  const [notifyTasks, setNotifyTasks] = useState(true);
  const [notifyMetrics, setNotifyMetrics] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(true);
  const [digestTime, setDigestTime] = useState('09:00');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const conn = await getSlackConnection();
      setConnection(conn);

      if (conn?.is_active) {
        setSelectedChannel(conn.channel_id || '');
        setNotifyDeadlines(conn.notify_deadlines);
        setNotifyTasks(conn.notify_tasks);
        setNotifyMetrics(conn.notify_metrics);
        setDailyDigest(conn.daily_digest);
        setDigestTime(conn.daily_digest_time || '09:00');

        const channelList = await getSlackChannels();
        setChannels(channelList);
      }
    } catch (err) {
      console.error('Failed to load Slack data:', err);
      setError('Failed to load Slack data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const { url } = await getSlackConnectUrl();
      window.location.href = url;
    } catch (err) {
      console.error('Failed to get connect URL:', err);
      setError('Failed to connect Slack');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Slack? You will stop receiving notifications.')) {
      return;
    }

    try {
      await disconnectSlack();
      setConnection(null);
      setChannels([]);
    } catch (err) {
      console.error('Disconnect failed:', err);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateSlackSettings({
        channel_id: selectedChannel,
        notify_deadlines: notifyDeadlines,
        notify_tasks: notifyTasks,
        notify_metrics: notifyMetrics,
        daily_digest: dailyDigest,
        daily_digest_time: digestTime,
      });
      setSuccess('Settings saved!');
      setTimeout(() => setSuccess(null), 3000);
      loadData();
      setShowSettings(false);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings');
    }
  };

  const handleSendTest = async () => {
    setSendingTest(true);
    try {
      await sendSlackTestMessage();
      setSuccess('Test message sent!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to send test:', err);
      setError('Failed to send test message');
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#4A154B] rounded-lg flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Slack</h2>
            <p className="text-sm text-gray-500">
              Get notifications and daily digests
            </p>
          </div>
        </div>
        {connection?.is_active ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSendTest}
              disabled={sendingTest}
              className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <Send className={`w-4 h-4 ${sendingTest ? 'animate-pulse' : ''}`} />
              Test
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={handleDisconnect}
              className="inline-flex items-center gap-2 px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
            >
              <Unlink className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#4A154B] hover:bg-[#3e1140] text-white font-medium rounded-lg"
          >
            {connecting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Link2 className="w-5 h-5" />
            )}
            Add to Slack
          </button>
        )}
      </div>

      {error && (
        <div className="px-5 py-3 bg-red-50 text-red-700 text-sm border-b border-red-100">
          {error}
        </div>
      )}

      {success && (
        <div className="px-5 py-3 bg-green-50 text-green-700 text-sm border-b border-green-100 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      {connection?.is_active && (
        <>
          {/* Connection Status */}
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="font-medium text-gray-900">{connection.team_name}</span>
              {connection.channel_name && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-600 flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {connection.channel_name}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-medium text-gray-900 mb-4">Notification Settings</h3>

              {/* Channel Selection */}
              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-1">Channel</label>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Select a channel</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name} {channel.is_private && '(private)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notification Types */}
              <div className="space-y-3 mb-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={notifyDeadlines}
                    onChange={(e) => setNotifyDeadlines(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">Deadline reminders</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={notifyTasks}
                    onChange={(e) => setNotifyTasks(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
                  <ListTodo className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">Task updates</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={notifyMetrics}
                    onChange={(e) => setNotifyMetrics(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
                  <TrendingUp className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">Metric alerts</span>
                </label>
              </div>

              {/* Daily Digest */}
              <div className="border-t border-gray-200 pt-4 mb-4">
                <label className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    checked={dailyDigest}
                    onChange={(e) => setDailyDigest(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
                  <Bell className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">Daily digest</span>
                </label>
                {dailyDigest && (
                  <div className="ml-7 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Send at</span>
                    <input
                      type="time"
                      value={digestTime}
                      onChange={(e) => setDigestTime(e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <span className="text-sm text-gray-500">(your local time)</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
              >
                Save Settings
              </button>
            </div>
          )}

          {/* Notification Summary */}
          <div className="p-5">
            <h3 className="font-medium text-gray-900 mb-3">Active Notifications</h3>
            <div className="flex flex-wrap gap-2">
              {connection.notify_deadlines && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-sm rounded-full">
                  <Calendar className="w-3.5 h-3.5" />
                  Deadlines
                </span>
              )}
              {connection.notify_tasks && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 text-sm rounded-full">
                  <ListTodo className="w-3.5 h-3.5" />
                  Tasks
                </span>
              )}
              {connection.notify_metrics && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-sm rounded-full">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Metrics
                </span>
              )}
              {connection.daily_digest && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 text-sm rounded-full">
                  <Bell className="w-3.5 h-3.5" />
                  Daily Digest @ {connection.daily_digest_time}
                </span>
              )}
              {!connection.notify_deadlines && !connection.notify_tasks && !connection.notify_metrics && !connection.daily_digest && (
                <span className="text-sm text-gray-500">No notifications enabled</span>
              )}
            </div>
          </div>
        </>
      )}

      {!connection?.is_active && (
        <div className="p-8 text-center">
          <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 mb-2">
            Connect Slack to receive notifications
          </p>
          <p className="text-sm text-gray-500">
            Get deadline reminders, task updates, and daily digests
          </p>
        </div>
      )}
    </div>
  );
}
