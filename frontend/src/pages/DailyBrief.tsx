import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { playLevelUpSound, playQuestCompleteSound, playXPSound } from '../lib/sounds';
import {
  AlertTriangle,
  Calendar,
  Clock,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Mail,
  Phone,
  FileText,
  RefreshCw,
  Sparkles,
  User,
  ArrowRight,
  Trophy,
  Flame,
  Gift,
  Star,
  Zap,
} from 'lucide-react';
import {
  getDailyBrief,
  completeDeadlineAction,
  completeTaskFromBrief,
  recordContactTouch,
  getChecklistBulk,
  getBusinessQuests,
  claimQuestReward,
} from '../lib/api';
import type { DailyBrief as DailyBriefType, DailyBriefItem, ChecklistProgress, BusinessQuest } from '../lib/api';

// Key required checklist items to show when daily brief is empty
// Urgency: 'critical' = must do first, 'high' = important, 'medium' = should do soon
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
  const { currentBusiness, refreshBusinesses } = useBusiness();
  const [brief, setBrief] = useState<DailyBriefType | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<number | null>(null);
  const [checklistProgress, setChecklistProgress] = useState<Record<string, ChecklistProgress>>({});
  const [quests, setQuests] = useState<BusinessQuest[]>([]);
  const [claimingQuest, setClaimingQuest] = useState<number | null>(null);
  const [questCelebration, setQuestCelebration] = useState<{ xp: number; message: string } | null>(null);
  const [levelUpCelebration, setLevelUpCelebration] = useState<{ level: number } | null>(null);
  const previousLevelRef = useRef<number | null>(null);

  // Detect level up
  useEffect(() => {
    if (!currentBusiness) return;

    const currentLevel = currentBusiness.level;
    const previousLevel = previousLevelRef.current;

    // Only trigger if we had a previous level and it increased
    if (previousLevel !== null && currentLevel > previousLevel) {
      // Level up!
      setLevelUpCelebration({ level: currentLevel });
      playLevelUpSound();

      // Fire celebratory confetti
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

      // Hide celebration after 4 seconds
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

  const loadQuests = async () => {
    if (!currentBusiness) return;
    try {
      const questsData = await getBusinessQuests(currentBusiness.id);
      setQuests(questsData);
    } catch (err) {
      console.error('Failed to load quests:', err);
    }
  };

  useEffect(() => {
    loadBrief();
  }, []);

  useEffect(() => {
    loadQuests();
  }, [currentBusiness?.id]);

  const handleClaimQuest = async (questId: number) => {
    if (!currentBusiness) return;
    setClaimingQuest(questId);
    try {
      const result = await claimQuestReward(currentBusiness.id, questId);
      setQuestCelebration({ xp: result.xp_awarded, message: result.message });
      playQuestCompleteSound(); // Play quest complete sound
      await loadQuests();
      await refreshBusinesses();
      // Auto-hide celebration after 3 seconds
      setTimeout(() => setQuestCelebration(null), 3000);
    } catch (err) {
      console.error('Failed to claim quest:', err);
    } finally {
      setClaimingQuest(null);
    }
  };

  const handleCompleteDeadline = async (id: number) => {
    setCompleting(id);
    try {
      await completeDeadlineAction(id);
      await loadBrief();
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
      playXPSound(); // Play XP gain sound
      await loadBrief();
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

  const ActionItem = ({ item, onComplete }: { item: DailyBriefItem; onComplete?: () => void }) => {
    const isDeadline = item.type === 'deadline';
    const isDocument = item.type === 'document';
    const isTask = item.type === 'task';

    const getPriorityColor = (priority?: string) => {
      switch (priority) {
        case 'urgent': return 'text-red-400 bg-red-500/20';
        case 'high': return 'text-orange-400 bg-orange-500/20';
        case 'medium': return 'text-yellow-400 bg-yellow-500/20';
        default: return 'text-gray-400 bg-gray-500/20';
      }
    };

    const content = (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-[#1a1d24] border border-white/10 hover:border-white/20 transition group gap-3">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isDeadline ? 'bg-violet-500/20 text-violet-400' :
            isDocument ? 'bg-amber-500/20 text-amber-400' :
            isTask ? 'bg-emerald-500/20 text-emerald-400' :
            'bg-cyan-500/20 text-cyan-400'
          }`}>
            {isDeadline ? <Calendar className="w-5 h-5" /> :
             isDocument ? <FileText className="w-5 h-5" /> :
             isTask ? <CheckSquare className="w-5 h-5" /> :
             <User className="w-5 h-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-medium text-white truncate">{item.title || item.name}</h4>
              {isTask && item.priority && item.priority !== 'medium' && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize flex-shrink-0 ${getPriorityColor(item.priority)}`}>
                  {item.priority}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
              {item.deadline_type && (
                <span className="capitalize">{item.deadline_type}</span>
              )}
              {item.category && (
                <span className="capitalize">{item.category}</span>
              )}
              {isTask && item.status && (
                <span className="capitalize">{item.status.replace('_', ' ')}</span>
              )}
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
              {item.company && (
                <span>at {item.company}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 ml-13 sm:ml-0">
          {item.days_until !== undefined && (
            <span className={`text-xs sm:text-sm font-medium whitespace-nowrap ${
              item.days_until < 0 ? 'text-red-400' :
              item.days_until === 0 ? 'text-amber-400' :
              item.days_until <= 3 ? 'text-yellow-400' :
              'text-gray-500'
            }`}>
              {getUrgencyLabel(item.days_until)}
            </span>
          )}
          {(isDeadline || isTask) && onComplete && (
            <button
              onClick={(e) => { e.preventDefault(); onComplete(); }}
              disabled={completing === item.id}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition font-medium text-xs sm:text-sm disabled:opacity-50 whitespace-nowrap"
            >
              {completing === item.id ? 'Completing...' : 'Done'}
            </button>
          )}
          {!isDeadline && !isTask && (
            <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition flex-shrink-0" />
          )}
          {isTask && (
            <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition flex-shrink-0" />
          )}
        </div>
      </div>
    );

    // Wrap task items in a Link to the tasks page
    if (isTask) {
      return <Link to="/tasks" className="block">{content}</Link>;
    }

    return content;
  };

  const ContactCard = ({ item }: { item: DailyBriefItem }) => (
    <div className="p-4 rounded-xl bg-[#1a1d24] border border-white/10 hover:border-white/20 transition">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium text-white">{item.name}</h4>
          {item.title && (
            <p className="text-sm text-gray-400">{item.title}</p>
          )}
          <p className="text-xs text-gray-500 capitalize">
            {item.contact_type?.replace('_', ' ')}{item.company ? ` at ${item.company}` : ''}
          </p>
        </div>
        {item.days_since_contact !== null && (
          <span className="text-xs text-amber-400/80">
            {item.days_since_contact ? `${item.days_since_contact}d ago` : 'Never contacted'}
          </span>
        )}
      </div>
      {item.responsibilities && (
        <p className="text-xs text-cyan-400/80 mb-3">
          {item.responsibilities}
        </p>
      )}
      <div className="flex items-center gap-2">
        {item.email && (
          <a
            href={`mailto:${item.email}`}
            onClick={() => handleContactTouch(item.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition text-sm"
          >
            <Mail className="w-4 h-4" />
            Email
          </a>
        )}
        {item.phone && (
          <a
            href={`tel:${item.phone}`}
            onClick={() => handleContactTouch(item.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition text-sm"
          >
            <Phone className="w-4 h-4" />
            Call
          </a>
        )}
        <button
          onClick={() => handleContactTouch(item.id)}
          className="ml-auto px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition text-sm"
        >
          Mark Contacted
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading your brief...</div>
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

  // Get incomplete required checklist items
  const incompleteChecklist = KEY_REQUIRED_ITEMS.filter(
    item => !checklistProgress[item.id]?.is_completed
  );
  const hasIncompleteChecklist = incompleteChecklist.length > 0;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            {getGreeting()}{user?.name ? `, ${user.name}` : ''}.
          </h1>
          <p className="text-gray-400 mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <button
          onClick={loadBrief}
          className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Quest Celebration Toast */}
      {questCelebration && (
        <div className="fixed top-4 right-4 z-50 animate-bounce">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-2xl">
            <Star className="w-6 h-6" />
            <div>
              <p className="font-bold">+{questCelebration.xp} XP</p>
              <p className="text-sm opacity-90">{questCelebration.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Level Up Celebration Modal */}
      {levelUpCelebration && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 blur-3xl opacity-40 animate-pulse" />

            <div className="relative bg-gradient-to-b from-[#1a1d24] to-[#0f1115] rounded-2xl border border-purple-500/50 w-full max-w-sm overflow-hidden shadow-2xl shadow-purple-500/20">
              {/* Animated sparkles */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-4 left-8 w-2 h-2 bg-yellow-400 rounded-full animate-ping" />
                <div className="absolute top-12 right-12 w-1.5 h-1.5 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '0.3s' }} />
                <div className="absolute bottom-16 left-16 w-1 h-1 bg-cyan-400 rounded-full animate-ping" style={{ animationDelay: '0.6s' }} />
                <div className="absolute bottom-8 right-8 w-2 h-2 bg-pink-400 rounded-full animate-ping" style={{ animationDelay: '0.9s' }} />
              </div>

              <div className="relative p-8 text-center">
                {/* Level badge with glow */}
                <div className="relative inline-block mb-4">
                  <div className="absolute inset-0 bg-purple-400 rounded-full blur-xl opacity-50 animate-pulse" />
                  <div className="relative w-24 h-24 mx-auto bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/50">
                    <div className="text-center">
                      <div className="text-3xl font-black text-white">{levelUpCelebration.level}</div>
                      <div className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Level</div>
                    </div>
                  </div>
                </div>

                {/* Level up text */}
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 mb-2">
                  LEVEL UP!
                </h2>
                <p className="text-gray-400 mb-6">You've reached a new milestone!</p>

                {/* Close button */}
                <button
                  onClick={() => setLevelUpCelebration(null)}
                  className="w-full px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-purple-500/25 transform hover:scale-105"
                >
                  Awesome!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Quests Section */}
      {currentBusiness && quests.length > 0 && (
        <section className="rounded-2xl bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Daily Quests</h2>
                <p className="text-sm text-gray-400">Complete quests to earn bonus XP</p>
              </div>
            </div>
            {currentBusiness && (
              <div className="flex items-center gap-2 text-sm">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-orange-400 font-medium">{currentBusiness.current_streak} day streak</span>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quests.map((bq) => {
              const progress = Math.min(100, (bq.current_count / bq.target_count) * 100);
              const isComplete = bq.is_completed;
              const isClaimed = bq.is_claimed;

              const getDifficultyColor = (difficulty: string) => {
                switch (difficulty) {
                  case 'easy': return 'text-emerald-400 bg-emerald-500/20';
                  case 'medium': return 'text-amber-400 bg-amber-500/20';
                  case 'hard': return 'text-red-400 bg-red-500/20';
                  default: return 'text-gray-400 bg-gray-500/20';
                }
              };

              const getQuestTypeColor = (type: string) => {
                switch (type) {
                  case 'daily': return 'border-cyan-500/30 bg-cyan-500/10';
                  case 'weekly': return 'border-violet-500/30 bg-violet-500/10';
                  case 'achievement': return 'border-amber-500/30 bg-amber-500/10';
                  default: return 'border-white/10 bg-white/5';
                }
              };

              return (
                <div
                  key={bq.id}
                  className={`relative p-4 rounded-xl border transition ${
                    isClaimed
                      ? 'border-white/5 bg-white/5 opacity-60'
                      : isComplete
                      ? 'border-emerald-500/30 bg-emerald-500/10'
                      : getQuestTypeColor(bq.quest.quest_type)
                  }`}
                >
                  {/* Quest Type Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${getDifficultyColor(bq.quest.difficulty)}`}>
                      {bq.quest.quest_type}
                    </span>
                    <span className="text-xs text-amber-400 font-medium">+{bq.xp_reward} XP</span>
                  </div>

                  {/* Quest Icon & Name */}
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl">{bq.quest.icon || '🎯'}</span>
                    <div>
                      <h3 className="font-medium text-white">{bq.quest.name}</h3>
                      <p className="text-xs text-gray-400">{bq.quest.description}</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-400">Progress</span>
                      <span className={isComplete ? 'text-emerald-400' : 'text-gray-400'}>
                        {bq.current_count}/{bq.target_count}
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isComplete
                            ? 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                            : 'bg-gradient-to-r from-amber-500 to-orange-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Claim Button */}
                  {isComplete && !isClaimed ? (
                    <button
                      onClick={() => handleClaimQuest(bq.id)}
                      disabled={claimingQuest === bq.id}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium text-sm hover:from-amber-600 hover:to-orange-600 transition disabled:opacity-50"
                    >
                      {claimingQuest === bq.id ? (
                        'Claiming...'
                      ) : (
                        <>
                          <Gift className="w-4 h-4" />
                          Claim Reward
                        </>
                      )}
                    </button>
                  ) : isClaimed ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                      <CheckCircle2 className="w-4 h-4" />
                      Claimed
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                      <Zap className="w-4 h-4" />
                      In Progress
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* All Clear State - Show incomplete checklist items or truly all caught up */}
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
                <div key={item.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
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
              to="/getting-started"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition text-sm font-medium"
            >
              Continue Setup
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="text-center py-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
            <Sparkles className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">You're all caught up!</h2>
            <p className="text-gray-400">No urgent items. Focus on building.</p>
          </div>
        )
      )}

      {/* OVERDUE - Red alert */}
      {hasOverdue && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-semibold text-red-400">Overdue</h2>
            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-sm">
              {brief.overdue.length}
            </span>
          </div>
          <div className="space-y-3">
            {brief.overdue.map((item) => (
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
        </section>
      )}

      {/* TODAY */}
      {hasToday && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Today</h2>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-sm">
              {brief.today.length}
            </span>
          </div>
          <div className="space-y-3">
            {brief.today.map((item) => (
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
        </section>
      )}

      {/* THIS WEEK */}
      {hasThisWeek && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-semibold text-white">This Week</h2>
            <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 text-sm">
              {brief.this_week.length}
            </span>
          </div>
          <div className="space-y-3">
            {brief.this_week.map((item) => (
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
        </section>
      )}

      {/* HEADS UP */}
      {hasHeadsUp && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-400">Heads Up</h2>
            <span className="px-2 py-0.5 rounded-full bg-white/5 text-gray-500 text-sm">
              {brief.heads_up.length}
            </span>
          </div>
          <div className="space-y-3">
            {brief.heads_up.slice(0, 5).map((item) => (
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
            {brief.heads_up.length > 5 && (
              <p className="text-sm text-gray-500 text-center py-2">
                +{brief.heads_up.length - 5} more items in the next 30 days
              </p>
            )}
          </div>
        </section>
      )}

      {/* CONTACTS NEEDING ATTENTION */}
      {hasContacts && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">Reconnect</h2>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-sm">
              {brief.contacts_attention.length}
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {brief.contacts_attention.map((item) => (
              <ContactCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
