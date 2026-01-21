import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Plus,
  Video,
  Calendar,
  Clock,
  MapPin,
  Users,
  FileText,
  Mic,
  X,
  Search,
  ChevronDown,
  Pencil,
  Trash2,
  CheckSquare,
  ListTodo,
  ClipboardList,
} from 'lucide-react';
import { getMeetings, createMeeting, updateMeeting, deleteMeeting, getDocuments, type Meeting, type Document } from '../lib/api';

const meetingTypes = [
  { value: 'all', label: 'All Meetings', icon: '📋' },
  { value: 'general', label: 'General', icon: '💬' },
  { value: 'board', label: 'Board Meeting', icon: '🏛️' },
  { value: 'team', label: 'Team Meeting', icon: '👥' },
  { value: 'client', label: 'Client Meeting', icon: '🤝' },
  { value: 'investor', label: 'Investor Meeting', icon: '💰' },
  { value: 'standup', label: 'Standup', icon: '🚀' },
  { value: 'retrospective', label: 'Retrospective', icon: '🔄' },
  { value: 'planning', label: 'Planning', icon: '📅' },
  { value: 'interview', label: 'Interview', icon: '🎯' },
  { value: 'other', label: 'Other', icon: '📝' },
];

export default function Meetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [expandedMeeting, setExpandedMeeting] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    meeting_date: '',
    meeting_time: '',
    duration_minutes: '',
    location: '',
    meeting_type: 'general',
    attendees: '',
    agenda: '',
    minutes: '',
    decisions: '',
    audio_file_url: '',
    tags: '',
  });
  const [actionItems, setActionItems] = useState<{ task: string; assignee: string; due_date: string | null }[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [meetingsData, docsData] = await Promise.all([
        getMeetings(),
        getDocuments().catch(() => []),
      ]);
      setMeetings(meetingsData);
      setDocuments(docsData);
    } catch (err) {
      console.error('Failed to load meetings:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredMeetings = meetings
    .filter(m => selectedType === 'all' || m.meeting_type === selectedType)
    .filter(m =>
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.agenda?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.minutes?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const meetingDateTime = formData.meeting_date && formData.meeting_time
        ? `${formData.meeting_date}T${formData.meeting_time}:00`
        : formData.meeting_date;

      const submitData = {
        title: formData.title,
        meeting_date: meetingDateTime,
        duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
        location: formData.location || null,
        meeting_type: formData.meeting_type,
        attendees: formData.attendees ? formData.attendees.split(',').map(a => a.trim()).filter(Boolean) : [],
        agenda: formData.agenda || null,
        minutes: formData.minutes || null,
        decisions: formData.decisions || null,
        action_items: actionItems.filter(ai => ai.task.trim()),
        audio_file_url: formData.audio_file_url || null,
        document_ids: selectedDocIds,
        tags: formData.tags || null,
      };

      if (editingMeeting) {
        await updateMeeting(editingMeeting.id, submitData);
      } else {
        await createMeeting(submitData);
      }

      resetForm();
      setShowModal(false);
      loadData();
    } catch (err) {
      console.error('Failed to save meeting:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      meeting_date: '',
      meeting_time: '',
      duration_minutes: '',
      location: '',
      meeting_type: 'general',
      attendees: '',
      agenda: '',
      minutes: '',
      decisions: '',
      audio_file_url: '',
      tags: '',
    });
    setActionItems([]);
    setSelectedDocIds([]);
    setEditingMeeting(null);
  };

  const handleEdit = (meeting: Meeting) => {
    const date = meeting.meeting_date ? new Date(meeting.meeting_date) : null;
    setFormData({
      title: meeting.title,
      meeting_date: date ? format(date, 'yyyy-MM-dd') : '',
      meeting_time: date ? format(date, 'HH:mm') : '',
      duration_minutes: meeting.duration_minutes?.toString() || '',
      location: meeting.location || '',
      meeting_type: meeting.meeting_type,
      attendees: meeting.attendees?.join(', ') || '',
      agenda: meeting.agenda || '',
      minutes: meeting.minutes || '',
      decisions: meeting.decisions || '',
      audio_file_url: meeting.audio_file_url || '',
      tags: meeting.tags || '',
    });
    setActionItems(meeting.action_items || []);
    setSelectedDocIds(meeting.document_ids || []);
    setEditingMeeting(meeting);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this meeting?')) {
      await deleteMeeting(id);
      loadData();
    }
  };

  const addActionItem = () => {
    setActionItems([...actionItems, { task: '', assignee: '', due_date: null }]);
  };

  const updateActionItem = (idx: number, field: string, value: string | null) => {
    const updated = [...actionItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setActionItems(updated);
  };

  const removeActionItem = (idx: number) => {
    setActionItems(actionItems.filter((_, i) => i !== idx));
  };

  const getTypeIcon = (type: string) => {
    return meetingTypes.find(t => t.value === type)?.icon || '📋';
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Video className="w-8 h-8 text-blue-400" />
            Meetings
          </h1>
          <p className="text-gray-400 mt-1">Meeting notes, minutes, and action items</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" />
          New Meeting
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search meetings..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
        >
          {meetingTypes.map(type => (
            <option key={type.value} value={type.value} className="bg-[#1a1d24]">
              {type.icon} {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Meetings List */}
      {filteredMeetings.length === 0 ? (
        <div className="text-center py-16">
          <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No meetings yet</h3>
          <p className="text-gray-400 mb-6">Start tracking your meetings, minutes, and action items</p>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 text-white font-medium"
          >
            <Plus className="w-5 h-5" />
            Create First Meeting
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMeetings.map(meeting => {
            const isExpanded = expandedMeeting === meeting.id;
            const linkedDocs = documents.filter(d => meeting.document_ids?.includes(d.id));

            return (
              <div
                key={meeting.id}
                className="rounded-2xl bg-[#1a1d24] border border-white/10 overflow-hidden hover:border-blue-500/30 transition"
              >
                {/* Meeting Header */}
                <div
                  className="p-5 cursor-pointer"
                  onClick={() => setExpandedMeeting(isExpanded ? null : meeting.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-2xl flex-shrink-0">
                        {getTypeIcon(meeting.meeting_type)}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{meeting.title}</h3>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-400">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(meeting.meeting_date), 'MMM d, yyyy')}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            {format(new Date(meeting.meeting_date), 'h:mm a')}
                          </span>
                          {meeting.duration_minutes && (
                            <span className="text-gray-500">({meeting.duration_minutes} min)</span>
                          )}
                          {meeting.location && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-4 h-4" />
                              {meeting.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {meeting.action_items && meeting.action_items.length > 0 && (
                        <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs">
                          {meeting.action_items.length} action items
                        </span>
                      )}
                      <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-white/10 pt-4 space-y-4">
                    {/* Attendees */}
                    {meeting.attendees && meeting.attendees.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                          <Users className="w-4 h-4" /> Attendees
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {meeting.attendees.map((a, i) => (
                            <span key={i} className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 text-sm">
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Agenda */}
                    {meeting.agenda && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                          <ClipboardList className="w-4 h-4" /> Agenda
                        </h4>
                        <p className="text-gray-300 whitespace-pre-wrap text-sm bg-white/5 rounded-lg p-3">{meeting.agenda}</p>
                      </div>
                    )}

                    {/* Minutes */}
                    {meeting.minutes && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4" /> Meeting Minutes
                        </h4>
                        <p className="text-gray-300 whitespace-pre-wrap text-sm bg-white/5 rounded-lg p-3">{meeting.minutes}</p>
                      </div>
                    )}

                    {/* Decisions */}
                    {meeting.decisions && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                          <CheckSquare className="w-4 h-4" /> Key Decisions
                        </h4>
                        <p className="text-gray-300 whitespace-pre-wrap text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">{meeting.decisions}</p>
                      </div>
                    )}

                    {/* Action Items */}
                    {meeting.action_items && meeting.action_items.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                          <ListTodo className="w-4 h-4" /> Action Items
                        </h4>
                        <div className="space-y-2">
                          {meeting.action_items.map((ai, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                              <div>
                                <p className="text-white text-sm">{ai.task}</p>
                                {ai.assignee && <p className="text-amber-400 text-xs mt-1">Assigned to: {ai.assignee}</p>}
                              </div>
                              {ai.due_date && (
                                <span className="text-xs text-gray-400">Due: {format(new Date(ai.due_date), 'MMM d')}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Linked Documents */}
                    {linkedDocs.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4" /> Linked Documents
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {linkedDocs.map(doc => (
                            <span key={doc.id} className="px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-300 text-sm flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              {doc.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Audio Recording */}
                    {meeting.audio_file_url && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                          <Mic className="w-4 h-4" /> Audio Recording
                        </h4>
                        <a
                          href={meeting.audio_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition"
                        >
                          <Mic className="w-4 h-4" />
                          Listen to Recording
                        </a>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(meeting); }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(meeting.id); }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a1d24] rounded-2xl border border-white/10 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white">
                {editingMeeting ? 'Edit Meeting' : 'New Meeting'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Meeting Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Q1 Planning Session"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.meeting_date}
                    onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Time</label>
                  <input
                    type="time"
                    value={formData.meeting_time}
                    onChange={(e) => setFormData({ ...formData, meeting_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                    placeholder="60"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Meeting Type</label>
                  <select
                    value={formData.meeting_type}
                    onChange={(e) => setFormData({ ...formData, meeting_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                  >
                    {meetingTypes.slice(1).map(type => (
                      <option key={type.value} value={type.value} className="bg-[#1a1d24]">
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Location / Video Link</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Conference Room A or https://zoom.us/..."
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Attendees (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.attendees}
                    onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
                    placeholder="John, Sarah, Mike"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>

              {/* Content */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Agenda</label>
                  <textarea
                    value={formData.agenda}
                    onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                    rows={3}
                    placeholder="Meeting agenda items..."
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Meeting Minutes / Notes</label>
                  <textarea
                    value={formData.minutes}
                    onChange={(e) => setFormData({ ...formData, minutes: e.target.value })}
                    rows={5}
                    placeholder="Meeting notes and discussion points..."
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Key Decisions</label>
                  <textarea
                    value={formData.decisions}
                    onChange={(e) => setFormData({ ...formData, decisions: e.target.value })}
                    rows={2}
                    placeholder="Important decisions made during the meeting..."
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 resize-none"
                  />
                </div>
              </div>

              {/* Action Items */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-400">Action Items</label>
                  <button
                    type="button"
                    onClick={addActionItem}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    + Add Action Item
                  </button>
                </div>
                {actionItems.map((ai, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                    <input
                      type="text"
                      value={ai.task}
                      onChange={(e) => updateActionItem(idx, 'task', e.target.value)}
                      placeholder="Task description"
                      className="col-span-5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                    />
                    <input
                      type="text"
                      value={ai.assignee}
                      onChange={(e) => updateActionItem(idx, 'assignee', e.target.value)}
                      placeholder="Assignee"
                      className="col-span-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                    />
                    <input
                      type="date"
                      value={ai.due_date || ''}
                      onChange={(e) => updateActionItem(idx, 'due_date', e.target.value || null)}
                      className="col-span-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => removeActionItem(idx)}
                      className="col-span-1 p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Link Documents */}
              {documents.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <label className="text-sm text-gray-400">Link Documents</label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {documents.map(doc => (
                      <label
                        key={doc.id}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition ${
                          selectedDocIds.includes(doc.id)
                            ? 'bg-violet-500/20 border border-violet-500/30'
                            : 'bg-white/5 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDocIds.includes(doc.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDocIds([...selectedDocIds, doc.id]);
                            } else {
                              setSelectedDocIds(selectedDocIds.filter(id => id !== doc.id));
                            }
                          }}
                          className="sr-only"
                        />
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-white truncate">{doc.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Audio Recording URL */}
              <div className="pt-4 border-t border-white/10">
                <label className="block text-sm text-gray-400 mb-1">Audio Recording URL</label>
                <input
                  type="url"
                  value={formData.audio_file_url}
                  onChange={(e) => setFormData({ ...formData, audio_file_url: e.target.value })}
                  placeholder="https://drive.google.com/... or upload link"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tags</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="important, follow-up, quarterly"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-4 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
                >
                  {editingMeeting ? 'Save Changes' : 'Create Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
