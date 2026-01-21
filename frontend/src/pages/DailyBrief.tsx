import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { playLevelUpSound, playXPSound } from '../lib/sounds';
import {
  AlertTriangle,
  Calendar,
  Clock,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  ChevronDown,
  ClipboardList,
  Mail,
  Phone,
  FileText,
  RefreshCw,
  Sparkles,
  User,
  ArrowRight,
  X,
  ExternalLink,
  MoreHorizontal,
  Filter,
  SortAsc,
  Zap,
  Target,
  Award,
} from 'lucide-react';
import {
  getDailyBrief,
  completeDeadlineAction,
  completeTaskFromBrief,
  recordContactTouch,
  getChecklistBulk,
} from '../lib/api';
import type { DailyBrief as DailyBriefType, DailyBriefItem, ChecklistProgress } from '../lib/api';

// Key required checklist items to show when daily brief is empty
const KEY_REQUIRED_ITEMS = [
  { id: 'choose-structure', title: 'Choose Business Structure', urgency: 'critical' as const },
  { id: 'articles-incorporation', title: 'File Articles of Incorporation', urgency: 'critical' as const },
  { id: 'ein', title: 'Get EIN', urgency: 'critical' as const },
  { id: 'registered-agent', title: 'Appoint Registered Agent', urgency: 'high' as const },
  { id: 'boi-report', title: 'File BOI Report (FinCEN)', urgency: 'high' as const },
  { id: 'business-bank', title: 'Open Business Bank Account', urgency: 'high' as const },
  { id: 'nm-crs', title: 'NM CRS Registration', urgency: 'high' as const },
  { id: 'bylaws', title: 'Bylaws / Operating Agreement', urgency: 'medium' as const },
  { id: 'accounting-system', title: 'Set Up Accounting', urgency: 'medium' as const },
  { id: 'domain-name', title: 'Register Domain', urgency: 'medium' as const },
  { id: 'business-email', title: 'Set Up Professional Email', urgency: 'medium' as const },
  { id: 'website', title: 'Build Company Website', urgency: 'medium' as const },
  { id: 'mfa-enforcement', title: 'Enforce MFA on All Accounts', urgency: 'medium' as const },
];

const getUrgencyStyle = (urgency: 'critical' | 'high' | 'medium') => {
  switch (urgency) {
    case 'critical':
      return 'bg-red-500/20 text-red-300 border-red-500/30';
    case 'high':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case 'medium':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  }
};

const getChecklistUrgencyLabel = (urgency: 'critical' | 'high' | 'medium') => {
  switch (urgency) {
    case 'critical': return 'Do First';
    case 'high': return 'Important';
    case 'medium': return 'Soon';
  }
};

export default function DailyBrief() {
  const { user } = useAuth();
  const { currentBusiness } = useBusiness();
  const [brief, setBrief] = useState<DailyBriefType | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<number | null>(null);
  const [checklistProgress, setChecklistProgress] = useState<Record<string, ChecklistProgress>>({});
  const [levelUpCelebration, setLevelUpCelebration] = useState<{ level: number } | null>(null);
  const previousLevelRef = useRef<number | null>(null);

  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overdue: true,
    today: true,
    this_week: true,
    heads_up: false,
    contacts: true,
  });

  // Filter state
  const [filterType, setFilterType] = useState<'all' | 'deadline' | 'task' | 'document'>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [completedItems, setCompletedItems] = useState<string[]>([]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Detect level up
  useEffect(() => {
    if (!currentBusiness) return;

    const currentLevel = currentBusiness.level;
    const previousLevel = previousLevelRef.current;

    if (previousLevel !== null && currentLevel > previousLevel) {
      setLevelUpCelebration({ level: currentLevel });
      playLevelUpSound();

      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }
        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: Math.random(), y: Math.random() - 0.2 },
          colors: ['#ffd700', '#ffb700', '#ff8c00', '#00ff88', '#00d4ff', '#a855f7'],
        });
      }, 250);

      setTimeout(() => setLevelUpCelebration(null), 4000);
    }

    previousLevelRef.current = currentLevel;
  }, [currentBusiness?.level]);

  const loadBrief = async () => {
    setLoading(true);
    try {
      const [briefData, checklistData] = await Promise.all([
        getDailyBrief(),
        getChecklistBulk()
      ]);
      setBrief(briefData);
      setChecklistProgress(checklistData.items || {});
    } catch (err) {
      console.error('Failed to load daily brief:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBrief();
  }, []);

  const handleCompleteDeadline = async (id: number, title: string) => {
    setCompleting(id);
    try {
      await completeDeadlineAction(id);
      setCompletedItems(prev => [...prev, `deadline-${id}`]);

      // Mini celebration
      confetti({
        particleCount: 30,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10b981', '#06b6d4', '#8b5cf6'],
      });

      setTimeout(() => loadBrief(), 500);
    } catch (err) {
      console.error('Failed to complete deadline:', err);
    } finally {
      setCompleting(null);
    }
  };

  const handleCompleteTask = async (id: number) => {
    setCompleting(id);
    try {
      await completeTaskFromBrief(id);
      playXPSound();
      setCompletedItems(prev => [...prev, `task-${id}`]);

      confetti({
        particleCount: 30,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10b981', '#06b6d4', '#8b5cf6'],
      });

      setTimeout(() => loadBrief(), 500);
    } catch (err) {
      console.error('Failed to complete task:', err);
    } finally {
      setCompleting(null);
    }
  };

  const handleContactTouch = async (id: number) => {
    try {
      await recordContactTouch(id);
      await loadBrief();
    } catch (err) {
      console.error('Failed to record contact:', err);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatDueDate = (item: DailyBriefItem) => {
    const date = item.due_date || item.expiration_date;
    if (!date) return '';
    return format(new Date(date), 'EEE, MMM d');
  };

  const getUrgencyLabel = (days: number | undefined) => {
    if (days === undefined) return '';
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `${days} days`;
  };

  const filterItems = (items: DailyBriefItem[]) => {
    if (filterType === 'all') return items;
    return items.filter(item => item.type === filterType);
  };

  const ActionItem = ({ item, onComplete }: { item: DailyBriefItem; onComplete?: () => void }) => {
    const isDeadline = item.type === 'deadline';
    const isDocument = item.type === 'document';
    const isTask = item.type === 'task';
    const isCompleted = completedItems.includes(`${item.type}-${item.id}`);

    const getPriorityColor = (priority?: string) => {
      switch (priority) {
        case 'urgent': return 'text-red-400 bg-red-500/20';
        case 'high': return 'text-orange-400 bg-orange-500/20';
        case 'medium': return 'text-yellow-400 bg-yellow-500/20';
        default: return 'text-gray-400 bg-gray-500/20';
      }
    };

    const getTypeIcon = () => {
      if (isDeadline) return <Calendar className="w-5 h-5" />;
      if (isDocument) return <FileText className="w-5 h-5" />;
      if (isTask) return <CheckSquare className="w-5 h-5" />;
      return <User className="w-5 h-5" />;
    };

    const getTypeColor = () => {
      if (isDeadline) return 'bg-violet-500/20 text-violet-400';
      if (isDocument) return 'bg-amber-500/20 text-amber-400';
      if (isTask) return 'bg-emerald-500/20 text-emerald-400';
      return 'bg-cyan-500/20 text-cyan-400';
    };

    const content = (
      <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border transition-all duration-300 group gap-3 ${
        isCompleted
          ? 'bg-emerald-500/10 border-emerald-500/30 scale-[0.98] opacity-60'
          : 'bg-[#1a1d24] border-white/10 hover:border-white/20 hover:bg-[#1e2128]'
      }`}>
        <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${getTypeColor()}`}>
            {isCompleted ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : getTypeIcon()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className={`font-medium truncate ${isCompleted ? 'text-gray-400 line-through' : 'text-white'}`}>
                {item.title || item.name}
              </h4>
              {isTask && item.priority && item.priority !== 'medium' && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize flex-shrink-0 ${getPriorityColor(item.priority)}`}>
                  {item.priority}
                </span>
              )}
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide flex-shrink-0 ${getTypeColor()}`}>
                {item.type}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500 mt-1">
              {item.deadline_type && <span className="capitalize">{item.deadline_type}</span>}
              {item.category && <span className="capitalize">{item.category}</span>}
              {isTask && item.status && <span className="capitalize">{item.status.replace('_', ' ')}</span>}
              {isTask && item.assigned_to && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span>@{item.assigned_to}</span>
                </>
              )}
              {(item.due_date || item.expiration_date) && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span>{formatDueDate(item)}</span>
                </>
              )}
              {item.company && <span>at {item.company}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 ml-13 sm:ml-0">
          {item.days_until !== undefined && !isCompleted && (
            <span className={`text-xs sm:text-sm font-medium whitespace-nowrap px-2 py-1 rounded-lg ${
              item.days_until < 0 ? 'text-red-400 bg-red-500/10' :
              item.days_until === 0 ? 'text-amber-400 bg-amber-500/10' :
              item.days_until <= 3 ? 'text-yellow-400 bg-yellow-500/10' :
              'text-gray-500 bg-white/5'
            }`}>
              {getUrgencyLabel(item.days_until)}
            </span>
          )}
          {(isDeadline || isTask) && onComplete && !isCompleted && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onComplete(); }}
              disabled={completing === item.id}
              className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 active:scale-95 transition-all font-medium text-sm disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
            >
              {completing === item.id ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {completing === item.id ? 'Done!' : 'Complete'}
            </button>
          )}
          {isCompleted && (
            <span className="text-sm text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              Done
            </span>
          )}
          {!isDeadline && !isTask && !isCompleted && (
            <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 group-hover:translate-x-1 transition-all flex-shrink-0" />
          )}
        </div>
      </div>
    );

    if (isTask && !isCompleted) {
      return <Link to="/app/tasks" className="block">{content}</Link>;
    }

    return content;
  };

  const ContactCard = ({ item }: { item: DailyBriefItem }) => (
    <div className="p-4 rounded-xl bg-[#1a1d24] border border-white/10 hover:border-cyan-500/30 transition group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center text-white font-semibold">
            {item.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h4 className="font-medium text-white">{item.name}</h4>
            {item.title && <p className="text-sm text-gray-400">{item.title}</p>}
            <p className="text-xs text-gray-500 capitalize">
              {item.contact_type?.replace('_', ' ')}{item.company ? ` at ${item.company}` : ''}
            </p>
          </div>
        </div>
        {item.days_since_contact !== null && (
          <span className={`text-xs px-2 py-1 rounded-lg ${
            item.days_since_contact && item.days_since_contact > 30
              ? 'text-red-400 bg-red-500/10'
              : 'text-amber-400/80 bg-amber-500/10'
          }`}>
            {item.days_since_contact ? `${item.days_since_contact}d ago` : 'Never'}
          </span>
        )}
      </div>
      {item.responsibilities && (
        <p className="text-xs text-cyan-400/80 mb-3 line-clamp-2">
          {item.responsibilities}
        </p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {item.email && (
          <a
            href={`mailto:${item.email}`}
            onClick={() => handleContactTouch(item.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition text-sm group/btn"
          >
            <Mail className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
            Email
          </a>
        )}
        {item.phone && (
          <a
            href={`tel:${item.phone}`}
            onClick={() => handleContactTouch(item.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition text-sm group/btn"
          >
            <Phone className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
            Call
          </a>
        )}
        <button
          onClick={() => handleContactTouch(item.id)}
          className="ml-auto px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 active:scale-95 transition-all text-sm font-medium"
        >
          Mark Contacted
        </button>
      </div>
    </div>
  );

  const SectionHeader = ({
    icon: Icon,
    title,
    count,
    color,
    section,
    expanded
  }: {
    icon: typeof AlertTriangle;
    title: string;
    count: number;
    color: string;
    section: string;
    expanded: boolean;
  }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between mb-4 group"
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 text-${color}-400`} />
        <h2 className={`text-lg font-semibold text-${color === 'gray' ? 'gray-400' : 'white'}`}>{title}</h2>
        <span className={`px-2.5 py-0.5 rounded-full bg-${color}-500/20 text-${color}-400 text-sm font-medium`}>
          {count}
        </span>
      </div>
      <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`} />
    </button>
  );

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Loading your brief...</p>
        </div>
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Failed to load brief</div>
      </div>
    );
  }

  const hasOverdue = brief.overdue.length > 0;
  const hasToday = brief.today.length > 0;
  const hasThisWeek = brief.this_week.length > 0;
  const hasHeadsUp = brief.heads_up.length > 0;
  const hasContacts = brief.contacts_attention.length > 0;
  const hasNothing = !hasOverdue && !hasToday && !hasThisWeek && !hasHeadsUp && !hasContacts;

  const totalItems = brief.overdue.length + brief.today.length + brief.this_week.length;
  const completedCount = completedItems.length;

  const incompleteChecklist = KEY_REQUIRED_ITEMS.filter(
    item => !checklistProgress[item.id]?.is_completed
  );
  const hasIncompleteChecklist = incompleteChecklist.length > 0;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">
            {getGreeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-gray-400 mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filter */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
            {(['all', 'deadline', 'task'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  filterType === type
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {type === 'all' ? 'All' : type === 'deadline' ? 'Deadlines' : 'Tasks'}
              </button>
            ))}
          </div>
          <button
            onClick={loadBrief}
            className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {totalItems > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-cyan-400" />
              <span className="text-sm font-medium text-white">Today's Progress</span>
            </div>
            <span className="text-sm text-gray-400">
              {completedCount} of {totalItems} items
            </span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${totalItems > 0 ? (completedCount / totalItems) * 100 : 0}%` }}
            />
          </div>
          {completedCount > 0 && completedCount === totalItems && (
            <div className="flex items-center gap-2 mt-2 text-emerald-400 text-sm">
              <Award className="w-4 h-4" />
              <span>All done! Great work today!</span>
            </div>
          )}
        </div>
      )}

      {/* Level Up Celebration Modal */}
      {levelUpCelebration && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 blur-3xl opacity-40 animate-pulse" />
            <div className="relative bg-gradient-to-b from-[#1a1d24] to-[#0f1115] rounded-2xl border border-purple-500/50 w-full max-w-sm overflow-hidden shadow-2xl shadow-purple-500/20">
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-4 left-8 w-2 h-2 bg-yellow-400 rounded-full animate-ping" />
                <div className="absolute top-12 right-12 w-1.5 h-1.5 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '0.3s' }} />
                <div className="absolute bottom-16 left-16 w-1 h-1 bg-cyan-400 rounded-full animate-ping" style={{ animationDelay: '0.6s' }} />
                <div className="absolute bottom-8 right-8 w-2 h-2 bg-pink-400 rounded-full animate-ping" style={{ animationDelay: '0.9s' }} />
              </div>
              <div className="relative p-8 text-center">
                <div className="relative inline-block mb-4">
                  <div className="absolute inset-0 bg-purple-400 rounded-full blur-xl opacity-50 animate-pulse" />
                  <div className="relative w-24 h-24 mx-auto bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/50">
                    <div className="text-center">
                      <div className="text-3xl font-black text-white">{levelUpCelebration.level}</div>
                      <div className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Level</div>
                    </div>
                  </div>
                </div>
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 mb-2">
                  LEVEL UP!
                </h2>
                <p className="text-gray-400 mb-6">You've reached a new milestone!</p>
                <button
                  onClick={() => setLevelUpCelebration(null)}
                  className="w-full px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-purple-500/25 transform hover:scale-105 active:scale-95"
                >
                  Awesome!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Tip */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-white/10">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <p className="text-sm text-gray-300">
          <span className="text-cyan-400 font-medium">Tip:</span>{' '}
          {(() => {
            const tips = [
              "Focus on one priority today. Multitasking is a myth.",
              "Document decisions, not just actions. Future you will thank you.",
              "Reach out to one contact you haven't spoken to in a while.",
              "Review your runway monthly. Cash is king.",
              "Block 2 hours for deep work. No Slack, no email.",
              "The best founders ship fast and iterate. Done beats perfect.",
              "Check your compliance checklist—small oversights become big problems.",
            ];
            const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
            return tips[dayOfYear % tips.length];
          })()}
        </p>
      </div>

      {/* All Clear State */}
      {hasNothing && (
        hasIncompleteChecklist ? (
          <div className="rounded-2xl bg-gradient-to-br from-violet-500/10 to-cyan-500/10 border border-violet-500/20 p-6">
            <div className="flex items-center gap-3 mb-4">
              <ClipboardList className="w-6 h-6 text-violet-400" />
              <div>
                <h2 className="text-xl font-bold text-white">No urgent deadlines</h2>
                <p className="text-gray-400 text-sm">But there's still work to do on your business setup</p>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              {incompleteChecklist.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      item.urgency === 'critical' ? 'bg-red-400' :
                      item.urgency === 'high' ? 'bg-amber-400' : 'bg-blue-400'
                    }`} />
                    <span className="text-white text-sm">{item.title}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium border shrink-0 ${getUrgencyStyle(item.urgency)}`}>
                    {getChecklistUrgencyLabel(item.urgency)}
                  </span>
                </div>
              ))}
              {incompleteChecklist.length > 5 && (
                <p className="text-sm text-gray-500 pl-5">
                  +{incompleteChecklist.length - 5} more items
                </p>
              )}
            </div>
            <Link
              to="/app/getting-started"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 active:scale-95 transition-all text-sm font-medium"
            >
              Continue Setup
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="text-center py-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">You're all caught up!</h2>
            <p className="text-gray-400 mb-6">No urgent items. Focus on building.</p>
            <Link
              to="/app"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-medium hover:from-emerald-400 hover:to-cyan-400 active:scale-95 transition-all"
            >
              Back to Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )
      )}

      {/* OVERDUE - Red alert */}
      {hasOverdue && (
        <section className="space-y-3">
          <SectionHeader
            icon={AlertTriangle}
            title="Overdue"
            count={filterItems(brief.overdue).length}
            color="red"
            section="overdue"
            expanded={expandedSections.overdue}
          />
          {expandedSections.overdue && (
            <div className="space-y-3 animate-fadeIn">
              {filterItems(brief.overdue).map((item) => (
                <ActionItem
                  key={`${item.type}-${item.id}`}
                  item={item}
                  onComplete={
                    item.type === 'deadline' ? () => handleCompleteDeadline(item.id, item.title || '') :
                    item.type === 'task' ? () => handleCompleteTask(item.id) :
                    undefined
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* TODAY */}
      {hasToday && (
        <section className="space-y-3">
          <SectionHeader
            icon={Clock}
            title="Today"
            count={filterItems(brief.today).length}
            color="amber"
            section="today"
            expanded={expandedSections.today}
          />
          {expandedSections.today && (
            <div className="space-y-3 animate-fadeIn">
              {filterItems(brief.today).map((item) => (
                <ActionItem
                  key={`${item.type}-${item.id}`}
                  item={item}
                  onComplete={
                    item.type === 'deadline' ? () => handleCompleteDeadline(item.id, item.title || '') :
                    item.type === 'task' ? () => handleCompleteTask(item.id) :
                    undefined
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* THIS WEEK */}
      {hasThisWeek && (
        <section className="space-y-3">
          <SectionHeader
            icon={Calendar}
            title="This Week"
            count={filterItems(brief.this_week).length}
            color="violet"
            section="this_week"
            expanded={expandedSections.this_week}
          />
          {expandedSections.this_week && (
            <div className="space-y-3 animate-fadeIn">
              {filterItems(brief.this_week).map((item) => (
                <ActionItem
                  key={`${item.type}-${item.id}`}
                  item={item}
                  onComplete={
                    item.type === 'deadline' ? () => handleCompleteDeadline(item.id, item.title || '') :
                    item.type === 'task' ? () => handleCompleteTask(item.id) :
                    undefined
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* HEADS UP */}
      {hasHeadsUp && (
        <section className="space-y-3">
          <SectionHeader
            icon={CheckCircle2}
            title="Heads Up (Next 30 Days)"
            count={filterItems(brief.heads_up).length}
            color="gray"
            section="heads_up"
            expanded={expandedSections.heads_up}
          />
          {expandedSections.heads_up && (
            <div className="space-y-3 animate-fadeIn">
              {filterItems(brief.heads_up).slice(0, 10).map((item) => (
                <ActionItem
                  key={`${item.type}-${item.id}`}
                  item={item}
                  onComplete={
                    item.type === 'deadline' ? () => handleCompleteDeadline(item.id, item.title || '') :
                    item.type === 'task' ? () => handleCompleteTask(item.id) :
                    undefined
                  }
                />
              ))}
              {filterItems(brief.heads_up).length > 10 && (
                <p className="text-sm text-gray-500 text-center py-2">
                  +{filterItems(brief.heads_up).length - 10} more items
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* CONTACTS NEEDING ATTENTION */}
      {hasContacts && (
        <section className="space-y-3">
          <SectionHeader
            icon={User}
            title="Reconnect"
            count={brief.contacts_attention.length}
            color="cyan"
            section="contacts"
            expanded={expandedSections.contacts}
          />
          {expandedSections.contacts && (
            <div className="grid md:grid-cols-2 gap-3 animate-fadeIn">
              {brief.contacts_attention.map((item) => (
                <ContactCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Quick Links */}
      <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/5">
        <Link to="/app" className="text-sm text-gray-500 hover:text-cyan-400 transition flex items-center gap-1">
          <ArrowRight className="w-4 h-4 rotate-180" />
          Dashboard
        </Link>
        <Link to="/app/tasks" className="text-sm text-gray-500 hover:text-cyan-400 transition">
          All Tasks
        </Link>
        <Link to="/app/deadlines" className="text-sm text-gray-500 hover:text-cyan-400 transition">
          All Deadlines
        </Link>
        <Link to="/app/contacts" className="text-sm text-gray-500 hover:text-cyan-400 transition">
          All Contacts
        </Link>
      </div>
    </div>
  );
}
