import { useState, useEffect, useRef } from 'react';
import {
  Video,
  Upload,
  Search,
  Calendar,
  Clock,
  Users,
  FileText,
  Download,
  Trash2,
  Loader2,
  X,
  Sparkles,
  RefreshCw,
  MessageSquare,
  CheckCircle2,
  Lightbulb,
  Link,
  Unlink,
  Import,
  ExternalLink,
} from 'lucide-react';
import api from '../lib/api';

interface PlatformStatus {
  connected: boolean;
  user_email?: string;
  user_name?: string;
  connected_at?: string;
}

interface MeetingRecording {
  id: string;
  meeting_id: string;
  topic: string;
  start_time?: string;
  duration?: number;
  total_size?: number;
  recording_count?: number;
  has_transcript: boolean;
  transcript_url?: string;
}

interface Transcript {
  id: number;
  title: string;
  meeting_date: string | null;
  meeting_type: string;
  platform: string | null;
  file_format: string | null;
  duration_seconds: number | null;
  word_count: number | null;
  speaker_count: number | null;
  transcript_text?: string;
  summary: string | null;
  action_items: string[];
  key_points: string[];
  tags: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

const MEETING_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'investor', label: 'Investor' },
  { value: 'client', label: 'Client' },
  { value: 'team', label: 'Team' },
  { value: 'board', label: 'Board' },
  { value: 'sales', label: 'Sales' },
  { value: 'interview', label: 'Interview' },
];

const PLATFORMS = [
  { value: 'zoom', label: 'Zoom' },
  { value: 'meet', label: 'Google Meet' },
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'webex', label: 'Webex' },
  { value: 'other', label: 'Other' },
];

export default function Meetings() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showZoomModal, setShowZoomModal] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState<Transcript | null>(null);

  const [uploading, setUploading] = useState(false);

  // Meeting platform integration state
  const [zoomStatus, setZoomStatus] = useState<PlatformStatus | null>(null);
  const [googleMeetStatus, setGoogleMeetStatus] = useState<PlatformStatus | null>(null);
  const [teamsStatus, setTeamsStatus] = useState<PlatformStatus | null>(null);

  const [zoomRecordings, setZoomRecordings] = useState<MeetingRecording[]>([]);
  const [googleMeetRecordings, setGoogleMeetRecordings] = useState<MeetingRecording[]>([]);
  const [teamsRecordings, setTeamsRecordings] = useState<MeetingRecording[]>([]);

  const [loadingZoom, setLoadingZoom] = useState(false);
  const [loadingGoogleMeet, setLoadingGoogleMeet] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);

  const [showGoogleMeetModal, setShowGoogleMeetModal] = useState(false);
  const [showTeamsModal, setShowTeamsModal] = useState(false);

  const [importingRecording, setImportingRecording] = useState<string | null>(null);

  useEffect(() => {
    loadTranscripts();
    loadAllPlatformStatuses();

    // Check for callback results
    const params = new URLSearchParams(window.location.search);
    if (params.get('zoom') === 'connected') {
      loadZoomStatus();
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('google-meet') === 'connected') {
      loadGoogleMeetStatus();
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('teams') === 'connected') {
      loadTeamsStatus();
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('error')) {
      setError(`Connection failed: ${params.get('error')}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [filterType]);

  const loadAllPlatformStatuses = () => {
    loadZoomStatus();
    loadGoogleMeetStatus();
    loadTeamsStatus();
  };

  const loadTranscripts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.append('meeting_type', filterType);
      if (searchTerm) params.append('search', searchTerm);

      const res = await api.get(`/api/transcripts?${params.toString()}`);
      setTranscripts(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load transcripts');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadTranscripts();
  };

  // Zoom functions
  const loadZoomStatus = async () => {
    try {
      const res = await api.get('/api/zoom/status');
      setZoomStatus(res.data);
    } catch {
      setZoomStatus({ connected: false });
    }
  };

  const connectZoom = async () => {
    try {
      const res = await api.get('/api/zoom/login');
      window.location.href = res.data.auth_url;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to connect Zoom');
    }
  };

  const disconnectZoom = async () => {
    if (!confirm('Disconnect Zoom account?')) return;
    try {
      await api.delete('/api/zoom/disconnect');
      setZoomStatus({ connected: false });
      setZoomRecordings([]);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to disconnect Zoom');
    }
  };

  const loadZoomRecordings = async () => {
    setLoadingZoom(true);
    try {
      const res = await api.get('/api/zoom/recordings');
      setZoomRecordings(res.data.recordings || []);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load Zoom recordings');
    } finally {
      setLoadingZoom(false);
    }
  };

  const importZoomRecording = async (recording: MeetingRecording) => {
    setImportingRecording(recording.id);
    try {
      await api.post(`/api/zoom/recordings/${encodeURIComponent(recording.id)}/import?generate_summary=true`);
      setShowZoomModal(false);
      loadTranscripts();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to import transcript');
    } finally {
      setImportingRecording(null);
    }
  };

  const openZoomModal = () => {
    setShowZoomModal(true);
    loadZoomRecordings();
  };

  // Google Meet functions
  const loadGoogleMeetStatus = async () => {
    try {
      const res = await api.get('/api/google-meet/status');
      setGoogleMeetStatus(res.data);
    } catch {
      setGoogleMeetStatus({ connected: false });
    }
  };

  const connectGoogleMeet = async () => {
    try {
      const res = await api.get('/api/google-meet/login');
      window.location.href = res.data.auth_url;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to connect Google Meet');
    }
  };

  const disconnectGoogleMeet = async () => {
    if (!confirm('Disconnect Google Meet account?')) return;
    try {
      await api.delete('/api/google-meet/disconnect');
      setGoogleMeetStatus({ connected: false });
      setGoogleMeetRecordings([]);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to disconnect Google Meet');
    }
  };

  const loadGoogleMeetRecordings = async () => {
    setLoadingGoogleMeet(true);
    try {
      const res = await api.get('/api/google-meet/recordings');
      setGoogleMeetRecordings(res.data.recordings || []);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load Google Meet recordings');
    } finally {
      setLoadingGoogleMeet(false);
    }
  };

  const importGoogleMeetRecording = async (recording: MeetingRecording) => {
    setImportingRecording(recording.id);
    try {
      await api.post(`/api/google-meet/recordings/${encodeURIComponent(recording.id)}/import?generate_summary=true`);
      setShowGoogleMeetModal(false);
      loadTranscripts();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to import transcript');
    } finally {
      setImportingRecording(null);
    }
  };

  const openGoogleMeetModal = () => {
    setShowGoogleMeetModal(true);
    loadGoogleMeetRecordings();
  };

  // Microsoft Teams functions
  const loadTeamsStatus = async () => {
    try {
      const res = await api.get('/api/teams/status');
      setTeamsStatus(res.data);
    } catch {
      setTeamsStatus({ connected: false });
    }
  };

  const connectTeams = async () => {
    try {
      const res = await api.get('/api/teams/login');
      window.location.href = res.data.auth_url;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to connect Microsoft Teams');
    }
  };

  const disconnectTeams = async () => {
    if (!confirm('Disconnect Microsoft Teams account?')) return;
    try {
      await api.delete('/api/teams/disconnect');
      setTeamsStatus({ connected: false });
      setTeamsRecordings([]);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to disconnect Microsoft Teams');
    }
  };

  const loadTeamsRecordings = async () => {
    setLoadingTeams(true);
    try {
      const res = await api.get('/api/teams/recordings');
      setTeamsRecordings(res.data.recordings || []);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load Teams recordings');
    } finally {
      setLoadingTeams(false);
    }
  };

  const importTeamsRecording = async (recording: MeetingRecording) => {
    setImportingRecording(recording.id);
    try {
      await api.post(`/api/teams/recordings/${encodeURIComponent(recording.id)}/import?generate_summary=true`);
      setShowTeamsModal(false);
      loadTranscripts();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to import transcript');
    } finally {
      setImportingRecording(null);
    }
  };

  const openTeamsModal = () => {
    setShowTeamsModal(true);
    loadTeamsRecordings();
  };

  const handleUpload = async (file: File, formData: any) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      if (formData.title) form.append('title', formData.title);
      if (formData.meeting_date) form.append('meeting_date', formData.meeting_date);
      if (formData.meeting_type) form.append('meeting_type', formData.meeting_type);
      if (formData.platform) form.append('platform', formData.platform);
      if (formData.tags) form.append('tags', formData.tags);
      if (formData.notes) form.append('notes', formData.notes);
      form.append('generate_summary', formData.generate_summary ? 'true' : 'false');

      await api.post('/api/transcripts/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setShowUploadModal(false);
      loadTranscripts();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload transcript');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this transcript?')) return;
    try {
      await api.delete(`/api/transcripts/${id}`);
      loadTranscripts();
      if (selectedTranscript?.id === id) {
        setShowDetailModal(false);
        setSelectedTranscript(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete transcript');
    }
  };

  const handleViewDetail = async (transcript: Transcript) => {
    try {
      const res = await api.get(`/api/transcripts/${transcript.id}`);
      setSelectedTranscript(res.data);
      setShowDetailModal(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load transcript');
    }
  };

  const handleDownload = async (transcript: Transcript) => {
    try {
      const res = await api.get(`/api/transcripts/${transcript.id}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${transcript.title}.${transcript.file_format || 'txt'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to download file');
    }
  };

  const handleRegenerateSummary = async (id: number) => {
    try {
      const res = await api.post(`/api/transcripts/${id}/regenerate-summary`);
      if (selectedTranscript?.id === id) {
        setSelectedTranscript({
          ...selectedTranscript,
          summary: res.data.summary,
          action_items: res.data.action_items,
          key_points: res.data.key_points,
        });
      }
      loadTranscripts();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to regenerate summary');
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return `${hrs}h ${remainMins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading && transcripts.length === 0) {
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
          <h1 className="text-2xl font-bold text-white">Meetings</h1>
          <p className="text-gray-400 mt-1">Upload and analyze meeting transcripts</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Zoom */}
          {zoomStatus?.connected ? (
            <div className="flex items-center gap-1">
              <button
                onClick={openZoomModal}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition text-sm"
              >
                <Import className="w-4 h-4" />
                Zoom
              </button>
              <button
                onClick={disconnectZoom}
                className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition"
                title={`Connected as ${zoomStatus.user_email}`}
              >
                <Unlink className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={connectZoom}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition text-sm"
            >
              <Link className="w-4 h-4" />
              Zoom
            </button>
          )}

          {/* Google Meet */}
          {googleMeetStatus?.connected ? (
            <div className="flex items-center gap-1">
              <button
                onClick={openGoogleMeetModal}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 transition text-sm"
              >
                <Import className="w-4 h-4" />
                Meet
              </button>
              <button
                onClick={disconnectGoogleMeet}
                className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition"
                title={`Connected as ${googleMeetStatus.user_email}`}
              >
                <Unlink className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={connectGoogleMeet}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition text-sm"
            >
              <Link className="w-4 h-4" />
              Meet
            </button>
          )}

          {/* Microsoft Teams */}
          {teamsStatus?.connected ? (
            <div className="flex items-center gap-1">
              <button
                onClick={openTeamsModal}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition text-sm"
              >
                <Import className="w-4 h-4" />
                Teams
              </button>
              <button
                onClick={disconnectTeams}
                className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition"
                title={`Connected as ${teamsStatus.user_email}`}
              >
                <Unlink className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={connectTeams}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition text-sm"
            >
              <Link className="w-4 h-4" />
              Teams
            </button>
          )}

          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 transition"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search transcripts..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
        >
          <option value="">All Types</option>
          {MEETING_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
        <button
          onClick={handleSearch}
          className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
        >
          Search
        </button>
      </div>

      {/* Transcripts Grid */}
      {transcripts.length === 0 ? (
        <div className="text-center py-16">
          <Video className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-xl font-medium text-white mb-2">No transcripts yet</h3>
          <p className="text-gray-400 mb-6">Upload a meeting transcript to get started</p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 transition"
          >
            <Upload className="w-5 h-5" />
            Upload Your First Transcript
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {transcripts.map((transcript) => (
            <div
              key={transcript.id}
              className="bg-white/5 rounded-xl border border-white/10 overflow-hidden hover:border-cyan-500/30 transition cursor-pointer group"
              onClick={() => handleViewDetail(transcript)}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white truncate group-hover:text-cyan-400 transition">
                      {transcript.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded bg-white/10 text-xs text-gray-400 capitalize">
                        {transcript.meeting_type}
                      </span>
                      {transcript.platform && (
                        <span className="text-xs text-gray-500">{transcript.platform}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDownload(transcript)}
                      className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(transcript.id)}
                      className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                  {transcript.meeting_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(transcript.meeting_date)}
                    </span>
                  )}
                  {transcript.duration_seconds && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDuration(transcript.duration_seconds)}
                    </span>
                  )}
                  {transcript.speaker_count && transcript.speaker_count > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {transcript.speaker_count}
                    </span>
                  )}
                </div>

                {/* Summary Preview */}
                {transcript.summary && (
                  <p className="text-sm text-gray-400 line-clamp-2 mb-3">
                    {transcript.summary}
                  </p>
                )}

                {/* Action Items Badge */}
                {transcript.action_items && transcript.action_items.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-amber-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {transcript.action_items.length} action item{transcript.action_items.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUpload}
          uploading={uploading}
        />
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedTranscript && (
        <DetailModal
          transcript={selectedTranscript}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedTranscript(null);
          }}
          onDownload={handleDownload}
          onDelete={handleDelete}
          onRegenerateSummary={handleRegenerateSummary}
        />
      )}

      {/* Zoom Recordings Modal */}
      {showZoomModal && (
        <RecordingsModal
          platform="zoom"
          platformName="Zoom"
          platformColor="blue"
          recordings={zoomRecordings}
          loading={loadingZoom}
          importingId={importingRecording}
          onClose={() => setShowZoomModal(false)}
          onImport={importZoomRecording}
          onRefresh={loadZoomRecordings}
        />
      )}

      {/* Google Meet Recordings Modal */}
      {showGoogleMeetModal && (
        <RecordingsModal
          platform="google-meet"
          platformName="Google Meet"
          platformColor="green"
          recordings={googleMeetRecordings}
          loading={loadingGoogleMeet}
          importingId={importingRecording}
          onClose={() => setShowGoogleMeetModal(false)}
          onImport={importGoogleMeetRecording}
          onRefresh={loadGoogleMeetRecordings}
        />
      )}

      {/* Teams Recordings Modal */}
      {showTeamsModal && (
        <RecordingsModal
          platform="teams"
          platformName="Microsoft Teams"
          platformColor="purple"
          recordings={teamsRecordings}
          loading={loadingTeams}
          importingId={importingRecording}
          onClose={() => setShowTeamsModal(false)}
          onImport={importTeamsRecording}
          onRefresh={loadTeamsRecordings}
        />
      )}
    </div>
  );
}

// Upload Modal Component
function UploadModal({
  onClose,
  onUpload,
  uploading,
}: {
  onClose: () => void;
  onUpload: (file: File, formData: any) => void;
  uploading: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    meeting_date: '',
    meeting_type: 'general',
    platform: '',
    tags: '',
    notes: '',
    generate_summary: true,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && isValidFile(droppedFile)) {
      setFile(droppedFile);
      if (!formData.title) {
        setFormData({ ...formData, title: droppedFile.name.replace(/\.[^/.]+$/, '') });
      }
    }
  };

  const isValidFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ['vtt', 'srt', 'txt'].includes(ext || '');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && isValidFile(selectedFile)) {
      setFile(selectedFile);
      if (!formData.title) {
        setFormData({ ...formData, title: selectedFile.name.replace(/\.[^/.]+$/, '') });
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (file) {
      onUpload(file, formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1d24] rounded-2xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Upload Transcript</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer ${
              dragOver ? 'border-cyan-500 bg-cyan-500/10' : 'border-white/20 hover:border-white/40'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".vtt,.srt,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
            {file ? (
              <div>
                <FileText className="w-10 h-10 mx-auto mb-2 text-cyan-400" />
                <p className="text-white font-medium">{file.name}</p>
                <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <Upload className="w-10 h-10 mx-auto mb-2 text-gray-500" />
                <p className="text-gray-400">Drop transcript file here or click to browse</p>
                <p className="text-sm text-gray-600 mt-1">Supports VTT, SRT, TXT</p>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
              placeholder="Meeting title"
            />
          </div>

          {/* Date and Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Meeting Date</label>
              <input
                type="datetime-local"
                value={formData.meeting_date}
                onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type</label>
              <select
                value={formData.meeting_type}
                onChange={(e) => setFormData({ ...formData, meeting_type: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
              >
                {MEETING_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Platform */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Platform</label>
            <select
              value={formData.platform}
              onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">Select platform</option>
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* AI Summary Toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.generate_summary}
              onChange={(e) => setFormData({ ...formData, generate_summary: e.target.checked })}
              className="w-5 h-5 rounded bg-white/5 border border-white/20 text-cyan-500 focus:ring-cyan-500/50"
            />
            <div>
              <span className="text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Generate AI Summary
              </span>
              <span className="text-xs text-gray-500">Extract key points and action items</span>
            </div>
          </label>

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 resize-none"
              placeholder="Add any notes about this meeting..."
            />
          </div>

          {/* Submit */}
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
              disabled={!file || uploading}
              className="flex-1 py-3 rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Detail Modal Component
function DetailModal({
  transcript,
  onClose,
  onDownload,
  onDelete,
  onRegenerateSummary,
}: {
  transcript: Transcript;
  onClose: () => void;
  onDownload: (t: Transcript) => void;
  onDelete: (id: number) => void;
  onRegenerateSummary: (id: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript'>('summary');
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerate = async () => {
    setRegenerating(true);
    await onRegenerateSummary(transcript.id);
    setRegenerating(false);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return `${hrs}h ${remainMins}m`;
    }
    return `${mins} minutes`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1d24] rounded-2xl border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">{transcript.title}</h2>
              <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
                <span className="px-2 py-0.5 rounded bg-white/10 capitalize">{transcript.meeting_type}</span>
                {transcript.platform && <span>{transcript.platform}</span>}
                {transcript.meeting_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(transcript.meeting_date).toLocaleDateString()}
                  </span>
                )}
                {transcript.duration_seconds && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDuration(transcript.duration_seconds)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onDownload(transcript)}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={() => onDelete(transcript.id)}
                className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition"
                title="Delete"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'summary'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-4 h-4 inline mr-2" />
              Summary
            </button>
            <button
              onClick={() => setActiveTab('transcript')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'transcript'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <MessageSquare className="w-4 h-4 inline mr-2" />
              Full Transcript
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'summary' ? (
            <div className="space-y-6">
              {/* Summary */}
              {transcript.summary ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Summary</h3>
                    <button
                      onClick={handleRegenerate}
                      disabled={regenerating}
                      className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      {regenerating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Regenerate
                    </button>
                  </div>
                  <p className="text-gray-300 leading-relaxed">{transcript.summary}</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Sparkles className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-400 mb-4">No summary generated</p>
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="px-4 py-2 rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 transition disabled:opacity-50 flex items-center gap-2 mx-auto"
                  >
                    {regenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Generate Summary
                  </button>
                </div>
              )}

              {/* Action Items */}
              {transcript.action_items && transcript.action_items.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400" />
                    Action Items
                  </h3>
                  <ul className="space-y-2">
                    {transcript.action_items.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                        <div className="w-5 h-5 rounded border border-amber-500/50 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key Points */}
              {transcript.key_points && transcript.key_points.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-cyan-400" />
                    Key Points
                  </h3>
                  <ul className="space-y-2">
                    {transcript.key_points.map((point, i) => (
                      <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                        <span className="text-cyan-400">•</span>
                        <span className="text-gray-300">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{transcript.word_count?.toLocaleString() || '—'}</div>
                  <div className="text-sm text-gray-500">Words</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{formatDuration(transcript.duration_seconds)}</div>
                  <div className="text-sm text-gray-500">Duration</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{transcript.speaker_count || '—'}</div>
                  <div className="text-sm text-gray-500">Speakers</div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {transcript.transcript_text ? (
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-300 leading-relaxed">
                  {transcript.transcript_text}
                </pre>
              ) : (
                <p className="text-gray-500 text-center py-8">No transcript text available</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Generic Recordings Modal Component
function RecordingsModal({
  platform,
  platformName,
  platformColor,
  recordings,
  loading,
  importingId,
  onClose,
  onImport,
  onRefresh,
}: {
  platform: string;
  platformName: string;
  platformColor: 'blue' | 'green' | 'purple';
  recordings: MeetingRecording[];
  loading: boolean;
  importingId: string | null;
  onClose: () => void;
  onImport: (recording: MeetingRecording) => void;
  onRefresh: () => void;
}) {
  const colorClasses = {
    blue: { bg: 'bg-blue-600', hover: 'hover:bg-blue-500', text: 'text-blue-400', border: 'hover:border-blue-500/30' },
    green: { bg: 'bg-green-600', hover: 'hover:bg-green-500', text: 'text-green-400', border: 'hover:border-green-500/30' },
    purple: { bg: 'bg-purple-600', hover: 'hover:bg-purple-500', text: 'text-purple-400', border: 'hover:border-purple-500/30' },
  };
  const colors = colorClasses[platformColor];
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown date';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '';
    if (minutes >= 60) {
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hrs}h ${mins}m`;
    }
    return `${minutes}m`;
  };

  const recordingsWithTranscript = recordings.filter(r => r.has_transcript);
  const recordingsWithoutTranscript = recordings.filter(r => !r.has_transcript);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1d24] rounded-2xl border border-white/10 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Video className={`w-5 h-5 ${colors.text}`} />
              Import from {platformName}
            </h2>
            <p className="text-sm text-gray-400 mt-1">Select a recording to import its transcript</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className={`w-8 h-8 animate-spin ${colors.text}`} />
            </div>
          ) : recordings.length === 0 ? (
            <div className="text-center py-12">
              <Video className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-gray-400">No recordings found in the last 30 days</p>
              <p className="text-sm text-gray-500 mt-1">Make sure cloud recording is enabled in your {platformName} settings</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Recordings with transcripts */}
              {recordingsWithTranscript.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    With Transcript ({recordingsWithTranscript.length})
                  </h3>
                  <div className="space-y-2">
                    {recordingsWithTranscript.map((recording) => (
                      <div
                        key={recording.id}
                        className={`p-4 rounded-lg bg-white/5 border border-white/10 ${colors.border} transition`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-white truncate">{recording.topic}</h4>
                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatDate(recording.start_time)}
                              </span>
                              {recording.duration && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  {formatDuration(recording.duration)}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => onImport(recording)}
                            disabled={importingId !== null}
                            className={`px-4 py-2 rounded-lg ${colors.bg} text-white ${colors.hover} transition disabled:opacity-50 flex items-center gap-2 text-sm`}
                          >
                            {importingId === recording.id ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Importing...
                              </>
                            ) : (
                              <>
                                <Import className="w-4 h-4" />
                                Import
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recordings without transcripts */}
              {recordingsWithoutTranscript.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Without Transcript ({recordingsWithoutTranscript.length})
                  </h3>
                  <div className="space-y-2">
                    {recordingsWithoutTranscript.map((recording) => (
                      <div
                        key={recording.id}
                        className="p-4 rounded-lg bg-white/5 border border-white/5 opacity-60"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-white truncate">{recording.topic}</h4>
                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatDate(recording.start_time)}
                              </span>
                              {recording.duration && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  {formatDuration(recording.duration)}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-gray-500 px-2 py-1 rounded bg-white/5">
                            No transcript
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 text-center text-sm text-gray-500">
          {platform === 'zoom' && (
            <a
              href="https://support.zoom.us/hc/en-us/articles/115004794983-Automatically-transcribe-cloud-recordings"
              target="_blank"
              rel="noopener noreferrer"
              className={`${colors.text} hover:opacity-80 inline-flex items-center gap-1`}
            >
              Learn how to enable automatic transcription
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {platform === 'google-meet' && (
            <a
              href="https://support.google.com/meet/answer/10090371"
              target="_blank"
              rel="noopener noreferrer"
              className={`${colors.text} hover:opacity-80 inline-flex items-center gap-1`}
            >
              Learn how to enable Meet recording &amp; transcription
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {platform === 'teams' && (
            <a
              href="https://support.microsoft.com/en-us/office/record-a-meeting-in-teams-34dfbe7f-b07d-4a27-b4c6-de62f1348c24"
              target="_blank"
              rel="noopener noreferrer"
              className={`${colors.text} hover:opacity-80 inline-flex items-center gap-1`}
            >
              Learn how to record Teams meetings
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
