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
  User,
  ArrowRight,
  Target,
  Award,
  Flame,
  Coffee,
  Sun,
  Moon,
  Sunset,
  Star,
  Heart,
  Zap,
  TrendingUp,
  PartyPopper,
} from 'lucide-react';
import {
  getDailyBrief,
  completeDeadlineAction,
  completeTaskFromBrief,
  recordContactTouch,
  getChecklistBulk,
} from '../lib/api';
import type { DailyBrief as DailyBriefType, DailyBriefItem, ChecklistProgress } from '../lib/api';

// Motivational messages based on progress
const getMotivationalMessage = (completed: number, total: number) => {
  if (total === 0) return "Your slate is clean! Time to plan ahead.";
  const percent = (completed / total) * 100;
  if (percent === 100) return "You crushed it today! Take a well-deserved break.";
  if (percent >= 75) return "Almost there! You're on fire today!";
  if (percent >= 50) return "Halfway done! Keep that momentum going!";
  if (percent >= 25) return "Great start! You've got this!";
  return "Let's make today count!";
};

// Fun greetings based on time of day
const getGreetingWithEmoji = (hour: number, name?: string) => {
  const firstName = name?.split(' ')[0] || 'Founder';

  if (hour < 6) {
    return { text: `Burning the midnight oil, ${firstName}?`, icon: Moon, emoji: '🌙' };
  } else if (hour < 9) {
    return { text: `Rise and shine, ${firstName}!`, icon: Coffee, emoji: '☀️' };
  } else if (hour < 12) {
    return { text: `Good morning, ${firstName}!`, icon: Sun, emoji: '🌤️' };
  } else if (hour < 14) {
    return { text: `Hope you had a great lunch, ${firstName}!`, icon: Sun, emoji: '🍽️' };
  } else if (hour < 17) {
    return { text: `Keep up the great work, ${firstName}!`, icon: Sunset, emoji: '💪' };
  } else if (hour < 20) {
    return { text: `Finishing strong, ${firstName}!`, icon: Sunset, emoji: '🌅' };
  } else {
    return { text: `Evening hustle, ${firstName}!`, icon: Moon, emoji: '🌙' };
  }
};

// Daily founder tips with more variety
const DAILY_TIPS = [
  { tip: "Focus on one priority today. Multitasking is a myth.", icon: Target },
  { tip: "Document decisions, not just actions. Future you will thank you.", icon: FileText },
  { tip: "Reach out to one contact you haven't spoken to in a while.", icon: Heart },
  { tip: "Review your runway monthly. Cash is king.", icon: TrendingUp },
  { tip: "Block 2 hours for deep work. No Slack, no email.", icon: Zap },
  { tip: "The best founders ship fast and iterate. Done beats perfect.", icon: Star },
  { tip: "Check your compliance checklist—small oversights become big problems.", icon: ClipboardList },
  { tip: "Celebrate small wins. Progress compounds over time.", icon: PartyPopper },
  { tip: "Take a 10-minute walk. Your best ideas come when you step away.", icon: Coffee },
  { tip: "Talk to a customer today. Their feedback is gold.", icon: User },
];

// Key required checklist items
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
];

const getUrgencyStyle = (urgency: 'critical' | 'high' | 'medium') => {
  switch (urgency) {
    case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/30';
    case 'high': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case 'medium': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
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
  const [showCompletionCelebration, setShowCompletionCelebration] = useState(false);
  const previousLevelRef = useRef<number | null>(null);

  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overdue: true,
    today: true,
    this_week: true,
    heads_up: false,
    contacts: true,
  });

  // Filter and completion state
  const [filterType, setFilterType] = useState<'all' | 'deadline' | 'task' | 'document'>('all');
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
        confetti({
          ...defaults,
          particleCount: 50 * (timeLeft / duration),
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

  // Celebration when completing items
  const triggerCompletionCelebration = () => {
    playXPSound();
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b'],
    });
    setShowCompletionCelebration(true);
    setTimeout(() => setShowCompletionCelebration(false), 2000);
  };

  const handleCompleteDeadline = async (id: number) => {
    setCompleting(id);
    try {
      await completeDeadlineAction(id);
      setCompletedItems(prev => [...prev, `deadline-${id}`]);
      triggerCompletionCelebration();
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
      setCompletedItems(prev => [...prev, `task-${id}`]);
      triggerCompletionCelebration();
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

  const getUrgencyLabel = (days: number | undefined) => {
    if (days === undefined) return '';
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `${days}d`;
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

    const getTypeIcon = () => {
      if (isDeadline) return <Calendar className="w-5 h-5" />;
      if (isDocument) return <FileText className="w-5 h-5" />;
      if (isTask) return <CheckSquare className="w-5 h-5" />;
      return <User className="w-5 h-5" />;
    };

    const getTypeColor = () => {
      if (isDeadline) return 'bg-violet-500/20 text-violet-400 border-violet-500/30';
      if (isDocument) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      if (isTask) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    };

    const content = (
      <div className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-300 group ${
        isCompleted
          ? 'bg-emerald-500/10 border-emerald-500/30 scale-[0.98]'
          : 'bg-[#1a1d24] border-white/10 hover:border-white/20 hover:bg-[#1e2128]'
      }`}>
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-110 border ${getTypeColor()}`}>
            {isCompleted ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : getTypeIcon()}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className={`font-medium truncate ${isCompleted ? 'text-gray-500 line-through' : 'text-white'}`}>
              {item.title || item.name}
            </h4>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
              <span className="capitalize">{item.type}</span>
              {item.category && <><span>•</span><span className="capitalize">{item.category}</span></>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4">
          {item.days_until !== undefined && !isCompleted && (
            <span className={`text-sm font-semibold px-3 py-1 rounded-lg ${
              item.days_until < 0 ? 'text-red-400 bg-red-500/15' :
              item.days_until === 0 ? 'text-amber-400 bg-amber-500/15' :
              item.days_until <= 3 ? 'text-yellow-400 bg-yellow-500/15' :
              'text-gray-400 bg-white/5'
            }`}>
              {getUrgencyLabel(item.days_until)}
            </span>
          )}
          {(isDeadline || isTask) && onComplete && !isCompleted && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onComplete(); }}
              disabled={completing === item.id}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-400 hover:from-emerald-500/30 hover:to-cyan-500/30 border border-emerald-500/30 active:scale-95 transition-all font-medium text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {completing === item.id ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Done
            </button>
          )}
          {isCompleted && (
            <span className="text-emerald-400 font-medium flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Complete!
            </span>
          )}
          {!isDeadline && !isTask && !isCompleted && (
            <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
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
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center text-white font-bold text-lg">
          {item.name?.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white truncate">{item.name}</h4>
          <p className="text-sm text-gray-400 truncate">
            {item.title}{item.company ? ` at ${item.company}` : ''}
          </p>
        </div>
        {item.days_since_contact !== null && (
          <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
            item.days_since_contact && item.days_since_contact > 30
              ? 'text-red-400 bg-red-500/15'
              : 'text-amber-400 bg-amber-500/15'
          }`}>
            {item.days_since_contact ? `${item.days_since_contact}d` : 'Never'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {item.email && (
          <a
            href={`mailto:${item.email}`}
            onClick={() => handleContactTouch(item.id)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition text-sm font-medium"
          >
            <Mail className="w-4 h-4" /> Email
          </a>
        )}
        {item.phone && (
          <a
            href={`tel:${item.phone}`}
            onClick={() => handleContactTouch(item.id)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition text-sm font-medium"
          >
            <Phone className="w-4 h-4" /> Call
          </a>
        )}
        <button
          onClick={() => handleContactTouch(item.id)}
          className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30 transition text-sm font-medium"
        >
          Contacted
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
    expanded,
    emoji
  }: {
    icon: typeof AlertTriangle;
    title: string;
    count: number;
    color: string;
    section: string;
    expanded: boolean;
    emoji?: string;
  }) => (
    <button
      onClick={() => toggleSection(section)}
      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
        expanded ? `bg-${color}-500/10 border border-${color}-500/20` : 'hover:bg-white/5'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg bg-${color}-500/20 flex items-center justify-center`}>
          <Icon className={`w-4 h-4 text-${color}-400`} />
        </div>
        <span className="font-semibold text-white">{title}</span>
        {emoji && <span className="text-lg">{emoji}</span>}
        <span className={`px-2 py-0.5 rounded-full bg-${color}-500/20 text-${color}-400 text-sm font-medium`}>
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
          <p className="text-gray-400">Getting your day ready...</p>
        </div>
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-4">😕</div>
          <p className="text-gray-400">Couldn't load your brief. Try refreshing!</p>
        </div>
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

  const hour = new Date().getHours();
  const greeting = getGreetingWithEmoji(hour, user?.name ?? undefined);
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const todaysTip = DAILY_TIPS[dayOfYear % DAILY_TIPS.length];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Completion Celebration Toast */}
      {showCompletionCelebration && (
        <div className="fixed top-4 right-4 z-50 animate-bounce">
          <div className="px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold shadow-lg shadow-emerald-500/25 flex items-center gap-2">
            <PartyPopper className="w-5 h-5" />
            Nice work! +10 XP
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">{greeting.emoji}</span>
            <h1 className="text-2xl lg:text-3xl font-bold text-white">
              {greeting.text}
            </h1>
          </div>
          <p className="text-gray-400 ml-12">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
          {currentBusiness?.current_streak && currentBusiness.current_streak > 1 && (
            <div className="flex items-center gap-2 ml-12 mt-2">
              <Flame className="w-5 h-5 text-orange-400" />
              <span className="text-orange-400 font-semibold">{currentBusiness.current_streak} day streak!</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
            {(['all', 'deadline', 'task'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  filterType === type
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-gray-400 hover:text-white border border-transparent'
                }`}
              >
                {type === 'all' ? 'All' : type === 'deadline' ? 'Deadlines' : 'Tasks'}
              </button>
            ))}
          </div>
          <button
            onClick={loadBrief}
            className="p-2.5 rounded-xl text-gray-500 hover:text-white hover:bg-white/10 border border-white/10 transition"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {totalItems > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#1a1d24] to-[#1f2229] border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Today's Progress</h3>
                <p className="text-sm text-gray-400">{getMotivationalMessage(completedCount, totalItems)}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">{completedCount}/{totalItems}</div>
              <div className="text-sm text-gray-500">completed</div>
            </div>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-violet-500 to-pink-500 rounded-full transition-all duration-700 ease-out relative"
              style={{ width: `${totalItems > 0 ? (completedCount / totalItems) * 100 : 0}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>
          {completedCount === totalItems && totalItems > 0 && (
            <div className="flex items-center justify-center gap-2 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Award className="w-5 h-5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">All done! You're a productivity machine!</span>
              <span className="text-xl">🎉</span>
            </div>
          )}
        </div>
      )}

      {/* Daily Tip */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0">
          <todaysTip.icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-amber-400 font-semibold text-sm">💡 Founder Tip</span>
          <p className="text-gray-300">{todaysTip.tip}</p>
        </div>
      </div>

      {/* Level Up Celebration Modal */}
      {levelUpCelebration && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 blur-3xl opacity-50 animate-pulse" />
            <div className="relative bg-gradient-to-b from-[#1a1d24] to-[#0f1115] rounded-3xl border border-purple-500/50 w-full max-w-sm overflow-hidden shadow-2xl">
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-ping"
                    style={{
                      top: `${20 + Math.random() * 60}%`,
                      left: `${10 + Math.random() * 80}%`,
                      animationDelay: `${i * 0.2}s`
                    }}
                  />
                ))}
              </div>
              <div className="relative p-8 text-center">
                <div className="text-5xl mb-4">🎉</div>
                <div className="relative inline-block mb-4">
                  <div className="absolute inset-0 bg-purple-400 rounded-full blur-xl opacity-50 animate-pulse" />
                  <div className="relative w-28 h-28 mx-auto bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/50">
                    <div className="text-center">
                      <div className="text-4xl font-black text-white">{levelUpCelebration.level}</div>
                      <div className="text-xs font-bold text-white/80 uppercase tracking-wider">Level</div>
                    </div>
                  </div>
                </div>
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 mb-2">
                  LEVEL UP!
                </h2>
                <p className="text-gray-400 mb-6">You're crushing it! Keep up the amazing work.</p>
                <button
                  onClick={() => setLevelUpCelebration(null)}
                  className="w-full px-6 py-4 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-purple-500/25 transform hover:scale-105 active:scale-95"
                >
                  Let's Go! 🚀
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Clear State */}
      {hasNothing && (
        hasIncompleteChecklist ? (
          <div className="rounded-2xl bg-gradient-to-br from-violet-500/10 to-cyan-500/10 border border-violet-500/20 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-3xl">✨</div>
              <div>
                <h2 className="text-xl font-bold text-white">No deadlines today!</h2>
                <p className="text-gray-400">Perfect time to tackle your setup checklist</p>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              {incompleteChecklist.slice(0, 5).map(item => (
                <Link
                  key={item.id}
                  to="/app/getting-started"
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-violet-500/30 hover:bg-white/10 transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      item.urgency === 'critical' ? 'bg-red-400' :
                      item.urgency === 'high' ? 'bg-amber-400' : 'bg-blue-400'
                    }`} />
                    <span className="text-white font-medium">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getUrgencyStyle(item.urgency)}`}>
                      {getChecklistUrgencyLabel(item.urgency)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
            <Link
              to="/app/getting-started"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-semibold hover:from-violet-400 hover:to-purple-400 active:scale-95 transition-all"
            >
              View Full Checklist
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="text-center py-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-2xl font-bold text-white mb-2">You're all caught up!</h2>
            <p className="text-gray-400 mb-6">No deadlines, no overdue tasks. Time to build something amazing!</p>
            <Link
              to="/app"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold hover:from-emerald-400 hover:to-cyan-400 active:scale-95 transition-all"
            >
              Back to Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )
      )}

      {/* OVERDUE */}
      {hasOverdue && (
        <section className="space-y-3">
          <SectionHeader
            icon={AlertTriangle}
            title="Overdue"
            count={filterItems(brief.overdue).length}
            color="red"
            section="overdue"
            expanded={expandedSections.overdue}
            emoji="⚠️"
          />
          {expandedSections.overdue && (
            <div className="space-y-2 pl-2">
              {filterItems(brief.overdue).map((item) => (
                <ActionItem
                  key={`${item.type}-${item.id}`}
                  item={item}
                  onComplete={
                    item.type === 'deadline' ? () => handleCompleteDeadline(item.id) :
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
            title="Due Today"
            count={filterItems(brief.today).length}
            color="amber"
            section="today"
            expanded={expandedSections.today}
            emoji="📅"
          />
          {expandedSections.today && (
            <div className="space-y-2 pl-2">
              {filterItems(brief.today).map((item) => (
                <ActionItem
                  key={`${item.type}-${item.id}`}
                  item={item}
                  onComplete={
                    item.type === 'deadline' ? () => handleCompleteDeadline(item.id) :
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
            emoji="📆"
          />
          {expandedSections.this_week && (
            <div className="space-y-2 pl-2">
              {filterItems(brief.this_week).map((item) => (
                <ActionItem
                  key={`${item.type}-${item.id}`}
                  item={item}
                  onComplete={
                    item.type === 'deadline' ? () => handleCompleteDeadline(item.id) :
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
            title="Coming Up"
            count={filterItems(brief.heads_up).length}
            color="gray"
            section="heads_up"
            expanded={expandedSections.heads_up}
            emoji="👀"
          />
          {expandedSections.heads_up && (
            <div className="space-y-2 pl-2">
              {filterItems(brief.heads_up).slice(0, 8).map((item) => (
                <ActionItem
                  key={`${item.type}-${item.id}`}
                  item={item}
                  onComplete={
                    item.type === 'deadline' ? () => handleCompleteDeadline(item.id) :
                    item.type === 'task' ? () => handleCompleteTask(item.id) :
                    undefined
                  }
                />
              ))}
              {filterItems(brief.heads_up).length > 8 && (
                <p className="text-sm text-gray-500 text-center py-2">
                  +{filterItems(brief.heads_up).length - 8} more items
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* CONTACTS */}
      {hasContacts && (
        <section className="space-y-3">
          <SectionHeader
            icon={User}
            title="Time to Reconnect"
            count={brief.contacts_attention.length}
            color="cyan"
            section="contacts"
            expanded={expandedSections.contacts}
            emoji="👋"
          />
          {expandedSections.contacts && (
            <div className="grid md:grid-cols-2 gap-3 pl-2">
              {brief.contacts_attention.map((item) => (
                <ContactCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Quick Links Footer */}
      <div className="flex items-center justify-center gap-6 pt-6 border-t border-white/5">
        <Link to="/app" className="text-sm text-gray-500 hover:text-cyan-400 transition flex items-center gap-1.5">
          <ArrowRight className="w-4 h-4 rotate-180" /> Dashboard
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
