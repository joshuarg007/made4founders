import { useEffect, useState } from 'react';
import {
  Calendar,
  RefreshCw,
  Loader2,
  Link2,
  Unlink,
  CheckCircle,
  AlertTriangle,
  Clock,
  Settings,
  ExternalLink,
} from 'lucide-react';
import {
  getGoogleCalendarConnection,
  getGoogleCalendarConnectUrl,
  disconnectGoogleCalendar,
  syncGoogleCalendar,
  updateCalendarSettings,
  getCalendarList,
  getCalendarEvents,
  type GoogleCalendarConnection,
  type CalendarEvent,
  type CalendarListItem,
} from '../lib/api';

export default function CalendarSync() {
  const [connection, setConnection] = useState<GoogleCalendarConnection | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<CalendarListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings form state
  const [syncDeadlines, setSyncDeadlines] = useState(true);
  const [syncMeetings, setSyncMeetings] = useState(true);
  const [selectedCalendar, setSelectedCalendar] = useState('primary');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const conn = await getGoogleCalendarConnection();
      setConnection(conn);

      if (conn?.is_active) {
        setSyncDeadlines(conn.sync_deadlines);
        setSyncMeetings(conn.sync_meetings);
        setSelectedCalendar(conn.calendar_id);

        const [eventsData, calendarsData] = await Promise.all([
          getCalendarEvents(14),
          getCalendarList(),
        ]);
        setEvents(eventsData);
        setCalendars(calendarsData);
      }
    } catch (err) {
      console.error('Failed to load calendar data:', err);
      setError('Failed to load calendar data');
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
      const { url } = await getGoogleCalendarConnectUrl();
      window.location.href = url;
    } catch (err) {
      console.error('Failed to get connect URL:', err);
      setError('Failed to connect Google Calendar');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar?')) {
      return;
    }

    try {
      await disconnectGoogleCalendar();
      setConnection(null);
      setEvents([]);
    } catch (err) {
      console.error('Disconnect failed:', err);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncGoogleCalendar();
      setTimeout(() => {
        loadData();
        setSyncing(false);
      }, 2000);
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncing(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateCalendarSettings({
        sync_deadlines: syncDeadlines,
        sync_meetings: syncMeetings,
        calendar_id: selectedCalendar,
      });
      loadData();
      setShowSettings(false);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#1a1d24] rounded-xl  border border-white/10 p-6">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1d24] rounded-xl  border border-white/10">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Google Calendar</h2>
            <p className="text-sm text-gray-500">
              Sync deadlines and meetings with your calendar
            </p>
          </div>
        </div>
        {connection?.is_active ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-400 hover:text-gray-400 hover:bg-white/5 rounded-lg"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync'}
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
          >
            {connecting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Link2 className="w-5 h-5" />
            )}
            Connect
          </button>
        )}
      </div>

      {error && (
        <div className="px-5 py-3 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {connection?.is_active && (
        <>
          {/* Connection Status */}
          <div className="px-5 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              {connection.sync_status === 'synced' ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : connection.sync_status === 'syncing' ? (
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              ) : connection.sync_status === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-red-500" />
              ) : (
                <Clock className="w-4 h-4 text-yellow-500" />
              )}
              <span className="text-gray-400">
                {connection.calendar_name || 'Primary Calendar'}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-500">
                {connection.last_sync_at
                  ? `Last synced ${new Date(connection.last_sync_at).toLocaleString()}`
                  : 'Never synced'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              {connection.sync_deadlines && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Deadlines</span>
              )}
              {connection.sync_meetings && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">Meetings</span>
              )}
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="px-5 py-4 bg-white/5 border-b border-white/10">
              <h3 className="font-medium text-white mb-3">Sync Settings</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={syncDeadlines}
                    onChange={(e) => setSyncDeadlines(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-300">Sync deadlines to calendar</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={syncMeetings}
                    onChange={(e) => setSyncMeetings(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-300">Sync meetings to calendar</span>
                </label>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Calendar</label>
                  <select
                    value={selectedCalendar}
                    onChange={(e) => setSelectedCalendar(e.target.value)}
                    className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {calendars.map((cal) => (
                      <option key={cal.id} value={cal.id}>
                        {cal.summary} {cal.primary && '(Primary)'}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleSaveSettings}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
                >
                  Save Settings
                </button>
              </div>
            </div>
          )}

          {/* Upcoming Events */}
          <div className="p-5">
            <h3 className="font-medium text-white mb-3">Upcoming Events (14 days)</h3>
            {events.length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming events</p>
            ) : (
              <div className="space-y-2">
                {events.slice(0, 5).map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        event.source === 'm4f'
                          ? event.m4f_type === 'deadline'
                            ? 'bg-red-500'
                            : 'bg-purple-500'
                          : 'bg-blue-500'
                      }`} />
                      <div>
                        <div className="text-sm font-medium text-white">{event.title}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(event.start).toLocaleDateString()} at{' '}
                          {new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {event.source === 'm4f' && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          event.m4f_type === 'deadline'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {event.m4f_type}
                        </span>
                      )}
                      {event.location && (
                        <a
                          href={event.location.startsWith('http') ? event.location : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-gray-400"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {events.length > 5 && (
                  <p className="text-sm text-gray-500 text-center pt-2">
                    +{events.length - 5} more events
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {!connection?.is_active && (
        <div className="p-8 text-center">
          <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 mb-2">
            Connect Google Calendar to sync your deadlines and meetings
          </p>
          <p className="text-sm text-gray-500">
            Two-way sync keeps everything in one place
          </p>
        </div>
      )}
    </div>
  );
}
