import { useEffect, useState } from 'react';
import {
  Plus,
  Check,
  Pencil,
  Trash2,
  X,
  Search,
  RefreshCw,
  AlertTriangle,
  MessageCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  List,
  Grid3X3,
  CalendarDays
} from 'lucide-react';
import { getDeadlines, createDeadline, updateDeadline, deleteDeadline, completeDeadline, type Deadline } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import CommentsSection from '../components/CommentsSection';
import BusinessFilter from '../components/BusinessFilter';
import { useBusiness } from '../context/BusinessContext';
import {
  format,
  isBefore,
  isAfter,
  addDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  isToday
} from 'date-fns';
import { Building2 } from 'lucide-react';

const deadlineTypes = [
  { value: 'all', label: 'All', icon: '📋', color: 'gray' },
  { value: 'filing', label: 'Filing', icon: '📄', color: 'blue' },
  { value: 'renewal', label: 'Renewal', icon: '🔄', color: 'purple' },
  { value: 'payment', label: 'Payment', icon: '💰', color: 'green' },
  { value: 'report', label: 'Report', icon: '📊', color: 'cyan' },
  { value: 'meeting', label: 'Meeting', icon: '👥', color: 'amber' },
  { value: 'other', label: 'Other', icon: '📎', color: 'gray' },
];

type ViewMode = 'calendar' | 'week' | 'list';

export default function Deadlines() {
  const { canEdit } = useAuth();
  const { businesses, currentBusiness } = useBusiness();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [businessFilter, setBusinessFilter] = useState<number[] | 'all' | 'none'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);
  const [selectedDeadline, setSelectedDeadline] = useState<Deadline | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    deadline_type: 'other',
    due_date: '',
    reminder_days: 7,
    is_recurring: false,
    recurrence_months: 12,
    business_id: null as number | null
  });

  const loadDeadlines = async () => {
    const businessesParam = businessFilter === 'all'
      ? undefined
      : businessFilter === 'none'
        ? undefined
        : businessFilter.join(',');

    const data = await getDeadlines({
      deadlineType: selectedType === 'all' ? undefined : selectedType,
      includeCompleted: showCompleted,
      businesses: businessesParam,
      unassigned_only: businessFilter === 'none'
    });
    setDeadlines(data);
    setLoading(false);
  };

  useEffect(() => {
    loadDeadlines();
  }, [selectedType, showCompleted, businessFilter]);

  const filteredDeadlines = deadlines.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      due_date: new Date(formData.due_date).toISOString(),
      recurrence_months: formData.is_recurring ? formData.recurrence_months : null
    };

    if (editingDeadline) {
      await updateDeadline(editingDeadline.id, payload);
    } else {
      await createDeadline(payload);
    }
    setShowModal(false);
    setEditingDeadline(null);
    setSelectedDate(null);
    setFormData({ title: '', description: '', deadline_type: 'other', due_date: '', reminder_days: 7, is_recurring: false, recurrence_months: 12, business_id: currentBusiness?.id || null });
    loadDeadlines();
  };

  const handleEdit = (deadline: Deadline) => {
    setEditingDeadline(deadline);
    setFormData({
      title: deadline.title,
      description: deadline.description || '',
      deadline_type: deadline.deadline_type,
      due_date: deadline.due_date.split('T')[0],
      reminder_days: deadline.reminder_days,
      is_recurring: deadline.is_recurring,
      recurrence_months: deadline.recurrence_months || 12,
      business_id: deadline.business_id || null
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this deadline?')) {
      await deleteDeadline(id);
      loadDeadlines();
    }
  };

  const handleComplete = async (id: number) => {
    await completeDeadline(id);
    loadDeadlines();
  };

  const getTypeInfo = (type: string) => {
    return deadlineTypes.find(t => t.value === type) || deadlineTypes[6];
  };

  const isOverdue = (date: string) => isBefore(new Date(date), new Date());
  const isSoon = (date: string) => isAfter(new Date(date), new Date()) && isBefore(new Date(date), addDays(new Date(), 7));

  // Group deadlines for list view
  const overdueDeadlines = filteredDeadlines.filter(d => !d.is_completed && isOverdue(d.due_date));
  const upcomingDeadlines = filteredDeadlines.filter(d => !d.is_completed && !isOverdue(d.due_date));
  const completedDeadlines = filteredDeadlines.filter(d => d.is_completed);

  // Calendar helpers
  const getDeadlinesForDate = (date: Date) => {
    return filteredDeadlines.filter(d => isSameDay(new Date(d.due_date), date));
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleAddDeadlineOnDate = (date: Date) => {
    setEditingDeadline(null);
    setFormData({
      title: '',
      description: '',
      deadline_type: 'other',
      due_date: format(date, 'yyyy-MM-dd'),
      reminder_days: 7,
      is_recurring: false,
      recurrence_months: 12,
      business_id: currentBusiness?.id || null
    });
    setShowModal(true);
  };

  // Navigation
  const navigatePrev = () => {
    if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // Generate calendar days
  const getCalendarDays = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  const getWeekDays = () => {
    const weekStart = startOfWeek(currentDate);
    const weekEnd = endOfWeek(currentDate);
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Calendar</h1>
          <p className="text-gray-400 mt-1">Track important dates and renewals</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-[#1a1d24] rounded-lg p-1 border border-white/10">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5 ${
                viewMode === 'calendar'
                  ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5 ${
                viewMode === 'week'
                  ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              Week
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5 ${
                viewMode === 'list'
                  ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
          </div>

          {canEdit && (
            <button
              onClick={() => {
                setEditingDeadline(null);
                setFormData({
                  title: '',
                  description: '',
                  deadline_type: 'other',
                  due_date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '',
                  reminder_days: 7,
                  is_recurring: false,
                  recurrence_months: 12,
                  business_id: currentBusiness?.id || null
                });
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
            >
              <Plus className="w-4 h-4" />
              Add Deadline
            </button>
          )}
        </div>
      </div>

      {/* Calendar Navigation - only for calendar/week views */}
      {viewMode !== 'list' && (
        <div className="flex items-center justify-between bg-[#1a1d24] rounded-xl p-4 border border-white/10">
          <button
            onClick={navigatePrev}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white">
              {viewMode === 'week'
                ? `${format(startOfWeek(currentDate), 'MMM d')} - ${format(endOfWeek(currentDate), 'MMM d, yyyy')}`
                : format(currentDate, 'MMMM yyyy')
              }
            </h2>
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm rounded-lg bg-white/10 text-gray-300 hover:text-white hover:bg-white/20 transition"
            >
              Today
            </button>
          </div>

          <button
            onClick={navigateNext}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search deadlines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#1a1d24] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <BusinessFilter
          value={businessFilter}
          onChange={setBusinessFilter}
          showNoBusiness
        />
        <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0">
          {deadlineTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setSelectedType(type.value)}
              className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap transition ${
                selectedType === type.value
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              <span className="mr-1">{type.icon}</span>
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Show Completed Toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="showCompleted"
          checked={showCompleted}
          onChange={(e) => setShowCompleted(e.target.checked)}
          className="rounded bg-[#1a1d24] border-white/20 text-cyan-500 focus:ring-cyan-500/50"
        />
        <label htmlFor="showCompleted" className="text-sm text-gray-400">Show completed</label>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          <p className="text-gray-400 mt-4">Loading deadlines...</p>
        </div>
      ) : viewMode === 'list' ? (
        /* List View */
        <ListView
          overdueDeadlines={overdueDeadlines}
          upcomingDeadlines={upcomingDeadlines}
          completedDeadlines={completedDeadlines}
          showCompleted={showCompleted}
          canEdit={canEdit}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onComplete={handleComplete}
          onSelect={setSelectedDeadline}
          getTypeInfo={getTypeInfo}
          isSoon={isSoon}
          setShowModal={setShowModal}
        />
      ) : viewMode === 'calendar' ? (
        /* Month Calendar View */
        <MonthCalendarView
          days={getCalendarDays()}
          currentDate={currentDate}
          selectedDate={selectedDate}
          getDeadlinesForDate={getDeadlinesForDate}
          getTypeInfo={getTypeInfo}
          onDateClick={handleDateClick}
          onAddDeadline={handleAddDeadlineOnDate}
          onSelectDeadline={setSelectedDeadline}
          canEdit={canEdit}
        />
      ) : (
        /* Week View */
        <WeekCalendarView
          days={getWeekDays()}
          selectedDate={selectedDate}
          getDeadlinesForDate={getDeadlinesForDate}
          getTypeInfo={getTypeInfo}
          onDateClick={handleDateClick}
          onAddDeadline={handleAddDeadlineOnDate}
          onSelectDeadline={setSelectedDeadline}
          canEdit={canEdit}
        />
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <DeadlineModal
          editingDeadline={editingDeadline}
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowModal(false);
            setSelectedDate(null);
          }}
          businesses={businesses.map(b => ({ id: b.id, name: b.name, emoji: b.emoji || '📁', is_archived: b.is_archived }))}
        />
      )}

      {/* Detail Modal with Comments */}
      {selectedDeadline && (
        <DeadlineDetailModal
          deadline={selectedDeadline}
          getTypeInfo={getTypeInfo}
          canEdit={canEdit}
          onEdit={handleEdit}
          onClose={() => setSelectedDeadline(null)}
        />
      )}
    </div>
  );
}

// Month Calendar View Component
function MonthCalendarView({
  days,
  currentDate,
  selectedDate,
  getDeadlinesForDate,
  getTypeInfo,
  onDateClick,
  onAddDeadline,
  onSelectDeadline,
  canEdit
}: {
  days: Date[];
  currentDate: Date;
  selectedDate: Date | null;
  getDeadlinesForDate: (date: Date) => Deadline[];
  getTypeInfo: (type: string) => { icon: string; color: string };
  onDateClick: (date: Date) => void;
  onAddDeadline: (date: Date) => void;
  onSelectDeadline: (d: Deadline) => void;
  canEdit: boolean;
}) {
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-[#1a1d24] rounded-xl border border-white/10 overflow-hidden">
      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b border-white/10">
        {weekDays.map((day) => (
          <div key={day} className="px-2 py-3 text-center text-sm font-medium text-gray-400">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayDeadlines = getDeadlinesForDate(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const today = isToday(day);

          return (
            <div
              key={idx}
              onClick={() => onDateClick(day)}
              className={`min-h-[120px] p-2 border-b border-r border-white/5 cursor-pointer transition group ${
                isCurrentMonth ? 'bg-[#1a1d24]' : 'bg-[#12141a]'
              } ${isSelected ? 'bg-cyan-500/10 ring-1 ring-cyan-500/50' : 'hover:bg-white/5'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                    today
                      ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white'
                      : isCurrentMonth
                        ? 'text-white'
                        : 'text-gray-600'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                {canEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddDeadline(day);
                    }}
                    className="w-6 h-6 rounded-full bg-white/10 text-gray-400 hover:text-white hover:bg-cyan-500/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Deadline indicators */}
              <div className="space-y-1">
                {dayDeadlines.slice(0, 3).map((deadline) => {
                  const typeInfo = getTypeInfo(deadline.deadline_type);
                  const deadlineIsOverdue = !deadline.is_completed && isBefore(new Date(deadline.due_date), new Date());

                  return (
                    <div
                      key={deadline.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDeadline(deadline);
                      }}
                      className={`px-2 py-1 rounded text-xs truncate cursor-pointer transition ${
                        deadline.is_completed
                          ? 'bg-gray-500/20 text-gray-500 line-through'
                          : deadlineIsOverdue
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      <span className="mr-1">{typeInfo.icon}</span>
                      {deadline.title}
                    </div>
                  );
                })}
                {dayDeadlines.length > 3 && (
                  <div className="text-xs text-gray-500 pl-2">
                    +{dayDeadlines.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Week Calendar View Component
function WeekCalendarView({
  days,
  selectedDate,
  getDeadlinesForDate,
  getTypeInfo,
  onDateClick,
  onAddDeadline,
  onSelectDeadline,
  canEdit
}: {
  days: Date[];
  selectedDate: Date | null;
  getDeadlinesForDate: (date: Date) => Deadline[];
  getTypeInfo: (type: string) => { icon: string; color: string };
  onDateClick: (date: Date) => void;
  onAddDeadline: (date: Date) => void;
  onSelectDeadline: (d: Deadline) => void;
  canEdit: boolean;
}) {
  return (
    <div className="grid grid-cols-7 gap-3">
      {days.map((day, idx) => {
        const dayDeadlines = getDeadlinesForDate(day);
        const isSelected = selectedDate && isSameDay(day, selectedDate);
        const today = isToday(day);

        return (
          <div
            key={idx}
            onClick={() => onDateClick(day)}
            className={`min-h-[300px] rounded-xl border transition cursor-pointer ${
              isSelected
                ? 'border-cyan-500/50 bg-cyan-500/5'
                : 'border-white/10 bg-[#1a1d24] hover:border-white/20'
            }`}
          >
            {/* Day header */}
            <div className={`p-3 border-b border-white/10 text-center ${today ? 'bg-gradient-to-r from-cyan-500/20 to-violet-600/20' : ''}`}>
              <div className="text-xs text-gray-500 uppercase">{format(day, 'EEE')}</div>
              <div
                className={`text-2xl font-bold ${
                  today ? 'text-cyan-400' : 'text-white'
                }`}
              >
                {format(day, 'd')}
              </div>
            </div>

            {/* Deadlines */}
            <div className="p-2 space-y-2">
              {dayDeadlines.map((deadline) => {
                const typeInfo = getTypeInfo(deadline.deadline_type);
                const deadlineIsOverdue = !deadline.is_completed && isBefore(new Date(deadline.due_date), new Date());

                return (
                  <div
                    key={deadline.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDeadline(deadline);
                    }}
                    className={`p-2 rounded-lg text-xs cursor-pointer transition ${
                      deadline.is_completed
                        ? 'bg-gray-500/10 text-gray-500'
                        : deadlineIsOverdue
                          ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                          : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{typeInfo.icon}</span>
                      <span className={`font-medium truncate ${deadline.is_completed ? 'line-through' : ''}`}>
                        {deadline.title}
                      </span>
                    </div>
                    {deadline.description && (
                      <p className="text-gray-500 truncate mt-1 text-[10px]">{deadline.description}</p>
                    )}
                  </div>
                );
              })}

              {dayDeadlines.length === 0 && (
                <div className="text-center py-4 text-gray-600 text-xs">No deadlines</div>
              )}

              {canEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddDeadline(day);
                  }}
                  className="w-full p-2 rounded-lg border border-dashed border-white/20 text-gray-500 hover:text-white hover:border-cyan-500/50 hover:bg-cyan-500/10 transition text-xs flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// List View Component
function ListView({
  overdueDeadlines,
  upcomingDeadlines,
  completedDeadlines,
  showCompleted,
  canEdit,
  onEdit,
  onDelete,
  onComplete,
  onSelect,
  getTypeInfo,
  isSoon,
  setShowModal
}: {
  overdueDeadlines: Deadline[];
  upcomingDeadlines: Deadline[];
  completedDeadlines: Deadline[];
  showCompleted: boolean;
  canEdit: boolean;
  onEdit: (d: Deadline) => void;
  onDelete: (id: number) => void;
  onComplete: (id: number) => void;
  onSelect: (d: Deadline) => void;
  getTypeInfo: (type: string) => { icon: string; color: string };
  isSoon: (date: string) => boolean;
  setShowModal: (show: boolean) => void;
}) {
  if (overdueDeadlines.length === 0 && upcomingDeadlines.length === 0 && (!showCompleted || completedDeadlines.length === 0)) {
    return (
      <div className="text-center py-12 bg-[#1a1d24] rounded-xl border border-white/10">
        <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-500">No deadlines found</p>
        {canEdit && (
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-cyan-400 hover:text-cyan-300"
          >
            Add your first deadline
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overdue */}
      {overdueDeadlines.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-red-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Overdue ({overdueDeadlines.length})
          </h2>
          <div className="space-y-2">
            {overdueDeadlines.map((deadline) => (
              <DeadlineCard
                key={deadline.id}
                deadline={deadline}
                onEdit={onEdit}
                onDelete={onDelete}
                onComplete={onComplete}
                onSelect={onSelect}
                getTypeInfo={getTypeInfo}
                status="overdue"
                canEdit={canEdit}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcomingDeadlines.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">
            Upcoming ({upcomingDeadlines.length})
          </h2>
          <div className="space-y-2">
            {upcomingDeadlines.map((deadline) => (
              <DeadlineCard
                key={deadline.id}
                deadline={deadline}
                onEdit={onEdit}
                onDelete={onDelete}
                onComplete={onComplete}
                onSelect={onSelect}
                getTypeInfo={getTypeInfo}
                status={isSoon(deadline.due_date) ? 'soon' : 'normal'}
                canEdit={canEdit}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {showCompleted && completedDeadlines.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-500 mb-3">
            Completed ({completedDeadlines.length})
          </h2>
          <div className="space-y-2">
            {completedDeadlines.map((deadline) => (
              <DeadlineCard
                key={deadline.id}
                deadline={deadline}
                onEdit={onEdit}
                onDelete={onDelete}
                onComplete={onComplete}
                onSelect={onSelect}
                getTypeInfo={getTypeInfo}
                status="completed"
                canEdit={canEdit}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Deadline Card Component
function DeadlineCard({
  deadline,
  onEdit,
  onDelete,
  onComplete,
  onSelect,
  getTypeInfo,
  status,
  canEdit
}: {
  deadline: Deadline;
  onEdit: (d: Deadline) => void;
  onDelete: (id: number) => void;
  onComplete: (id: number) => void;
  onSelect: (d: Deadline) => void;
  getTypeInfo: (type: string) => { icon: string; color: string };
  status: 'overdue' | 'soon' | 'normal' | 'completed';
  canEdit: boolean;
}) {
  const typeInfo = getTypeInfo(deadline.deadline_type);

  const borderColor = {
    overdue: 'border-red-500/30',
    soon: 'border-amber-500/30',
    normal: 'border-white/10',
    completed: 'border-white/5'
  }[status];

  const bgColor = {
    overdue: 'bg-red-500/5',
    soon: 'bg-amber-500/5',
    normal: 'bg-[#1a1d24]',
    completed: 'bg-[#1a1d24]/50'
  }[status];

  return (
    <div className={`p-4 rounded-xl border ${borderColor} ${bgColor} ${status === 'completed' ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {!deadline.is_completed && (
            <button
              onClick={() => canEdit && onComplete(deadline.id)}
              disabled={!canEdit}
              className={`w-6 h-6 rounded-full border-2 transition flex items-center justify-center group ${
                canEdit
                  ? 'border-gray-600 hover:border-green-500 hover:bg-green-500/20 cursor-pointer'
                  : 'border-gray-700 cursor-not-allowed opacity-50'
              }`}
            >
              <Check className={`w-3 h-3 text-transparent ${canEdit ? 'group-hover:text-green-500' : ''}`} />
            </button>
          )}
          {deadline.is_completed && (
            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-3 h-3 text-green-500" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">{typeInfo.icon}</span>
              <span className={`font-medium ${status === 'completed' ? 'text-gray-500 line-through' : 'text-white'}`}>
                {deadline.title}
              </span>
              {deadline.is_recurring && (
                <RefreshCw className="w-3 h-3 text-gray-500" />
              )}
            </div>
            {deadline.description && (
              <p className="text-sm text-gray-500 mt-1">{deadline.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className={`text-sm font-medium ${
              status === 'overdue' ? 'text-red-400' :
              status === 'soon' ? 'text-amber-400' :
              status === 'completed' ? 'text-gray-500' :
              'text-gray-300'
            }`}>
              {format(new Date(deadline.due_date), 'MMM d, yyyy')}
            </div>
            <div className="text-xs text-gray-500 capitalize">{deadline.deadline_type}</div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => onSelect(deadline)}
              className="p-2 rounded-lg text-gray-500 hover:text-cyan-400 hover:bg-white/10 transition"
              title="View details & comments"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
            {canEdit && (
              <>
                <button
                  onClick={() => onEdit(deadline)}
                  className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(deadline.id)}
                  className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-white/10 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Add/Edit Modal Component
function DeadlineModal({
  editingDeadline,
  formData,
  setFormData,
  onSubmit,
  onClose,
  businesses
}: {
  editingDeadline: Deadline | null;
  formData: {
    title: string;
    description: string;
    deadline_type: string;
    due_date: string;
    reminder_days: number;
    is_recurring: boolean;
    recurrence_months: number;
    business_id: number | null;
  };
  setFormData: React.Dispatch<React.SetStateAction<typeof formData>>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  businesses: { id: number; name: string; emoji: string; is_archived?: boolean }[];
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            {editingDeadline ? 'Edit Deadline' : 'Add Deadline'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Annual Report Filing"
              className="w-full px-3 py-2 rounded-lg bg-[#12141a] border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type</label>
              <select
                value={formData.deadline_type}
                onChange={(e) => setFormData({ ...formData, deadline_type: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#12141a] border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
              >
                {deadlineTypes.slice(1).map((type) => (
                  <option key={type.value} value={type.value} className="bg-[#1a1d24] text-white">{type.icon} {type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Due Date *</label>
              <input
                type="date"
                required
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#12141a] border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-[#12141a] border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Remind me (days before)</label>
            <input
              type="number"
              min="1"
              value={formData.reminder_days}
              onChange={(e) => setFormData({ ...formData, reminder_days: parseInt(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg bg-[#12141a] border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          {businesses.length > 0 && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                <Building2 className="w-3.5 h-3.5 inline mr-1" />
                Business
              </label>
              <select
                value={formData.business_id || ''}
                onChange={(e) => setFormData({ ...formData, business_id: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-3 py-2 rounded-lg bg-[#12141a] border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
              >
                <option value="" className="bg-[#1a1d24] text-white">No business (org-level)</option>
                {businesses.filter(b => !b.is_archived).map((b) => (
                  <option key={b.id} value={b.id} className="bg-[#1a1d24] text-white">{b.emoji} {b.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_recurring}
                onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                className="rounded bg-[#12141a] border-white/20 text-cyan-500 focus:ring-cyan-500/50"
              />
              <span className="text-sm text-gray-400">Recurring</span>
            </label>
            {formData.is_recurring && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Every</span>
                <input
                  type="number"
                  min="1"
                  value={formData.recurrence_months}
                  onChange={(e) => setFormData({ ...formData, recurrence_months: parseInt(e.target.value) })}
                  className="w-16 px-2 py-1 rounded-lg bg-[#12141a] border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 text-sm"
                />
                <span className="text-sm text-gray-400">months</span>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
            >
              {editingDeadline ? 'Save' : 'Add Deadline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Detail Modal with Comments
function DeadlineDetailModal({
  deadline,
  getTypeInfo,
  canEdit,
  onEdit,
  onClose
}: {
  deadline: Deadline;
  getTypeInfo: (type: string) => { icon: string; color: string };
  canEdit: boolean;
  onEdit: (d: Deadline) => void;
  onClose: () => void;
}) {
  const typeInfo = getTypeInfo(deadline.deadline_type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1d24] rounded-2xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{typeInfo.icon}</span>
            <div>
              <h2 className="text-lg font-bold text-white">{deadline.title}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>{format(new Date(deadline.due_date), 'MMMM d, yyyy')}</span>
                <span className="capitalize px-2 py-0.5 bg-white/10 rounded text-xs">
                  {deadline.deadline_type}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {deadline.description && (
            <div className="bg-[#12141a] rounded-lg p-3 border border-white/10">
              <h3 className="text-sm font-medium text-gray-400 mb-1">Description</h3>
              <p className="text-white">{deadline.description}</p>
            </div>
          )}

          {deadline.is_recurring && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <RefreshCw className="w-4 h-4" />
              <span>Recurring every {deadline.recurrence_months} month(s)</span>
            </div>
          )}

          {/* Comments Section */}
          <CommentsSection
            entityType="deadline"
            entityId={deadline.id}
            maxHeight="300px"
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex justify-end gap-2">
          {canEdit && (
            <button
              onClick={() => {
                onEdit(deadline);
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
