import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow, differenceInDays, isToday, isTomorrow, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Calendar,
  CheckSquare,
  FileText,
  Users,
  Clock,
  Target,
  Zap,
  Shield,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Flame,
  Trophy,
  Star,
  Activity,
  BarChart3,
  RefreshCw,
  ChevronRight,
  Rocket,
  Gift,
  Crown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import {
  getDashboardStats,
  getDailyBrief,
  getBusinessQuests,
  getMetrics,
  getTasks,
  type DashboardStats,
  type DailyBrief,
  type BusinessQuest,
  type Metric,
  type Task,
} from '../lib/api';

// Level titles based on level
const getLevelTitle = (level: number): string => {
  if (level >= 50) return 'Legendary Founder';
  if (level >= 40) return 'Serial Entrepreneur';
  if (level >= 30) return 'Industry Leader';
  if (level >= 25) return 'Venture Builder';
  if (level >= 20) return 'Growth Expert';
  if (level >= 15) return 'Scaling Pro';
  if (level >= 10) return 'Rising Star';
  if (level >= 7) return 'Go-Getter';
  if (level >= 5) return 'Hustler';
  if (level >= 3) return 'Builder';
  return 'New Founder';
};

// XP needed for next level
const getXPForLevel = (level: number): number => {
  return Math.floor(100 * Math.pow(1.5, level - 1));
};

export default function Dashboard() {
  const { user } = useAuth();
  const { currentBusiness, refreshBusiness } = useBusiness();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [quests, setQuests] = useState<BusinessQuest[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [statsData, briefData, questsData, metricsData, tasksData] = await Promise.all([
        getDashboardStats(),
        getDailyBrief(),
        getBusinessQuests().catch(() => []),
        getMetrics().catch(() => []),
        getTasks().catch(() => []),
      ]);

      setStats(statsData);
      setBrief(briefData);
      setQuests(questsData);
      setMetrics(metricsData);
      setTasks(tasksData);
      if (isRefresh) refreshBusiness();
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Calculate XP progress
  const xpProgress = useMemo(() => {
    if (!currentBusiness) return { current: 0, needed: 100, percentage: 0 };
    const currentLevelXP = getXPForLevel(currentBusiness.level);
    const nextLevelXP = getXPForLevel(currentBusiness.level + 1);
    const xpInCurrentLevel = currentBusiness.xp - currentLevelXP;
    const xpNeededForNext = nextLevelXP - currentLevelXP;
    return {
      current: Math.max(0, xpInCurrentLevel),
      needed: xpNeededForNext,
      percentage: Math.min(100, Math.max(0, (xpInCurrentLevel / xpNeededForNext) * 100)),
    };
  }, [currentBusiness]);

  // Upcoming deadlines this week
  const upcomingThisWeek = useMemo(() => {
    if (!brief) return [];
    const allItems = [...(brief.today || []), ...(brief.this_week || [])];
    return allItems.slice(0, 5);
  }, [brief]);

  // Active tasks
  const activeTasks = useMemo(() => {
    return tasks.filter(t => t.status === 'in_progress' || t.status === 'todo').slice(0, 5);
  }, [tasks]);

  // Incomplete quests
  const activeQuests = useMemo(() => {
    return quests.filter(q => !q.is_completed).slice(0, 3);
  }, [quests]);

  // Key metrics with trends
  const keyMetrics = useMemo(() => {
    const metricTypes = ['mrr', 'arr', 'customers', 'revenue'];
    return metricTypes.map(type => {
      const metric = metrics.find(m => m.key?.toLowerCase() === type);
      return metric || null;
    }).filter(Boolean).slice(0, 4);
  }, [metrics]);

  // Health score color
  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getHealthBgColor = (score: number) => {
    if (score >= 80) return 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30';
    if (score >= 60) return 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30';
    if (score >= 40) return 'from-orange-500/20 to-orange-500/5 border-orange-500/30';
    return 'from-red-500/20 to-red-500/5 border-red-500/30';
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[80vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const urgentCount = (brief?.overdue?.length || 0) + (brief?.today?.length || 0);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">
            {getGreeting()}, {user?.name?.split(' ')[0] || 'Founder'}
          </h1>
          <p className="text-gray-400 mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Alert Banner */}
      {urgentCount > 0 && (
        <Link
          to="/app/daily-brief"
          className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 hover:border-red-500/50 transition group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="font-medium text-white">
                {urgentCount} item{urgentCount > 1 ? 's' : ''} need{urgentCount === 1 ? 's' : ''} attention
              </p>
              <p className="text-sm text-gray-400">
                {brief?.overdue?.length || 0} overdue, {brief?.today?.length || 0} due today
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
        </Link>
      )}

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Level & Health */}
        <div className="space-y-6">
          {/* Level Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-pink-500/10 border border-violet-500/30 p-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/20 to-transparent rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />

            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Crown className="w-5 h-5 text-violet-400" />
                    <span className="text-sm font-medium text-violet-400">Level {currentBusiness?.level || 1}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white">{getLevelTitle(currentBusiness?.level || 1)}</h3>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">{currentBusiness?.xp?.toLocaleString() || 0}</div>
                  <div className="text-xs text-gray-400">Total XP</div>
                </div>
              </div>

              {/* XP Progress Bar */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{xpProgress.current.toLocaleString()} XP</span>
                  <span>{xpProgress.needed.toLocaleString()} XP to Level {(currentBusiness?.level || 1) + 1}</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-1000 ease-out relative"
                    style={{ width: `${xpProgress.percentage}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                  </div>
                </div>
              </div>

              {/* Streak */}
              {currentBusiness?.current_streak && currentBusiness.current_streak > 0 && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10">
                  <Flame className="w-5 h-5 text-orange-400" />
                  <span className="text-sm text-gray-300">
                    <span className="font-bold text-orange-400">{currentBusiness.current_streak}</span> day streak
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Health Score Card */}
          <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${getHealthBgColor(currentBusiness?.health_score || 0)} border p-6`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-400">Business Health</span>
              </div>
              <Link to="/app/insights" className="text-xs text-gray-500 hover:text-white transition">
                Details →
              </Link>
            </div>

            <div className="flex items-end gap-4 mb-6">
              <div className={`text-5xl font-bold ${getHealthColor(currentBusiness?.health_score || 0)}`}>
                {currentBusiness?.health_score || 0}
              </div>
              <div className="text-gray-400 pb-1">/100</div>
            </div>

            {/* Health Breakdown */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Compliance', value: currentBusiness?.health_compliance || 0, color: 'cyan' },
                { label: 'Financial', value: currentBusiness?.health_financial || 0, color: 'emerald' },
                { label: 'Operations', value: currentBusiness?.health_operations || 0, color: 'violet' },
                { label: 'Growth', value: currentBusiness?.health_growth || 0, color: 'amber' },
              ].map(item => (
                <div key={item.label} className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">{item.label}</span>
                    <span className={`text-sm font-medium text-${item.color}-400`}>{item.value}</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-${item.color}-500 rounded-full transition-all duration-500`}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Quests */}
          {activeQuests.length > 0 && (
            <div className="rounded-2xl bg-[#1a1d24] border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-semibold text-white">Active Quests</h3>
                </div>
                <span className="text-xs text-gray-500">{activeQuests.length} in progress</span>
              </div>

              <div className="space-y-3">
                {activeQuests.map(quest => (
                  <div key={quest.id} className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">{quest.quest?.name || 'Quest'}</span>
                      <span className="text-xs text-cyan-400">+{quest.quest?.xp_reward || 0} XP</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full"
                          style={{ width: `${(quest.current_count / quest.target_count) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">
                        {quest.current_count}/{quest.target_count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Middle Column - Stats & Deadlines */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Link to="/app/tasks" className="group p-5 rounded-2xl bg-[#1a1d24] border border-white/10 hover:border-emerald-500/50 transition">
              <div className="flex items-center justify-between mb-3">
                <CheckSquare className="w-5 h-5 text-emerald-400" />
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
                  Active
                </span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {tasks.filter(t => t.status !== 'done').length}
              </div>
              <div className="text-sm text-gray-400">Open Tasks</div>
            </Link>

            <Link to="/app/deadlines" className="group p-5 rounded-2xl bg-[#1a1d24] border border-white/10 hover:border-amber-500/50 transition">
              <div className="flex items-center justify-between mb-3">
                <Calendar className="w-5 h-5 text-amber-400" />
                {stats && stats.overdue_deadlines > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
                    {stats.overdue_deadlines} overdue
                  </span>
                )}
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {stats?.upcoming_deadlines || 0}
              </div>
              <div className="text-sm text-gray-400">Upcoming</div>
            </Link>

            <Link to="/app/documents" className="group p-5 rounded-2xl bg-[#1a1d24] border border-white/10 hover:border-violet-500/50 transition">
              <div className="flex items-center justify-between mb-3">
                <FileText className="w-5 h-5 text-violet-400" />
                {stats && stats.expiring_documents > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">
                    {stats.expiring_documents} expiring
                  </span>
                )}
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {stats?.total_documents || 0}
              </div>
              <div className="text-sm text-gray-400">Documents</div>
            </Link>

            <Link to="/app/contacts" className="group p-5 rounded-2xl bg-[#1a1d24] border border-white/10 hover:border-cyan-500/50 transition">
              <div className="flex items-center justify-between mb-3">
                <Users className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {stats?.total_contacts || 0}
              </div>
              <div className="text-sm text-gray-400">Contacts</div>
            </Link>
          </div>

          {/* Upcoming Deadlines */}
          <div className="rounded-2xl bg-[#1a1d24] border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-white">Coming Up</h3>
              </div>
              <Link to="/app/daily-brief" className="text-xs text-gray-500 hover:text-white transition">
                View all →
              </Link>
            </div>

            {upcomingThisWeek.length > 0 ? (
              <div className="space-y-2">
                {upcomingThisWeek.map((item, idx) => (
                  <div
                    key={`${item.type}-${item.id}-${idx}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        item.days_until !== undefined && item.days_until < 0 ? 'bg-red-400' :
                        item.days_until === 0 ? 'bg-amber-400' :
                        item.days_until !== undefined && item.days_until <= 3 ? 'bg-yellow-400' :
                        'bg-gray-400'
                      }`} />
                      <span className="text-sm text-white truncate">{item.title || item.name}</span>
                    </div>
                    <span className={`text-xs flex-shrink-0 ml-2 ${
                      item.days_until !== undefined && item.days_until < 0 ? 'text-red-400' :
                      item.days_until === 0 ? 'text-amber-400' :
                      'text-gray-500'
                    }`}>
                      {item.days_until !== undefined && item.days_until < 0 ? `${Math.abs(item.days_until)}d overdue` :
                       item.days_until === 0 ? 'Today' :
                       item.days_until === 1 ? 'Tomorrow' :
                       `${item.days_until}d`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">All clear this week!</p>
              </div>
            )}
          </div>

          {/* Key Metrics */}
          {keyMetrics.length > 0 && (
            <div className="rounded-2xl bg-[#1a1d24] border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-semibold text-white">Key Metrics</h3>
                </div>
                <Link to="/app/insights" className="text-xs text-gray-500 hover:text-white transition">
                  All metrics →
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {keyMetrics.map((metric: Metric) => (
                  <div key={metric.id} className="p-3 rounded-xl bg-white/5">
                    <div className="text-xs text-gray-400 uppercase mb-1">{metric.key}</div>
                    <div className="text-xl font-bold text-white">
                      {metric.value_type === 'currency' ? '$' : ''}
                      {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
                      {metric.value_type === 'percentage' ? '%' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Tasks & Actions */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="rounded-2xl bg-gradient-to-br from-cyan-500/10 to-violet-500/10 border border-cyan-500/20 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-cyan-400" />
              <h3 className="font-semibold text-white">Quick Actions</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/app/tasks"
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-cyan-500/30 transition text-center group"
              >
                <CheckSquare className="w-6 h-6 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm text-gray-300">New Task</span>
              </Link>
              <Link
                to="/app/deadlines"
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-violet-500/30 transition text-center group"
              >
                <Calendar className="w-6 h-6 text-violet-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm text-gray-300">Add Deadline</span>
              </Link>
              <Link
                to="/app/documents"
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-emerald-500/30 transition text-center group"
              >
                <FileText className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm text-gray-300">Upload Doc</span>
              </Link>
              <Link
                to="/app/contacts"
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-amber-500/30 transition text-center group"
              >
                <Users className="w-6 h-6 text-amber-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm text-gray-300">Add Contact</span>
              </Link>
            </div>
          </div>

          {/* Active Tasks */}
          <div className="rounded-2xl bg-[#1a1d24] border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-white">My Tasks</h3>
              </div>
              <Link to="/app/tasks" className="text-xs text-gray-500 hover:text-white transition">
                View all →
              </Link>
            </div>

            {activeTasks.length > 0 ? (
              <div className="space-y-2">
                {activeTasks.map(task => (
                  <Link
                    key={task.id}
                    to="/app/tasks"
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition group"
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      task.status === 'in_progress'
                        ? 'border-cyan-400 bg-cyan-400/20'
                        : 'border-gray-500'
                    }`}>
                      {task.status === 'in_progress' && (
                        <div className="w-2 h-2 rounded-full bg-cyan-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{task.title}</p>
                      {task.due_date && (
                        <p className="text-xs text-gray-500">
                          Due {format(new Date(task.due_date), 'MMM d')}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white transition flex-shrink-0" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No active tasks</p>
                <Link to="/app/tasks" className="text-xs text-cyan-400 hover:underline mt-1 inline-block">
                  Create one →
                </Link>
              </div>
            )}
          </div>

          {/* Setup Progress - Show if not fully set up */}
          {currentBusiness && currentBusiness.health_score < 50 && (
            <Link
              to="/app/getting-started"
              className="block rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-6 hover:border-amber-500/40 transition group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Complete Your Setup</h3>
                  <p className="text-xs text-gray-400">Finish setting up your business</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex-1 mr-4">
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                      style={{ width: `${currentBusiness.health_score}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-medium text-amber-400">{currentBusiness.health_score}%</span>
              </div>
            </Link>
          )}

          {/* Vault Status */}
          <Link
            to="/app/vault"
            className="flex items-center justify-between p-5 rounded-2xl bg-[#1a1d24] border border-white/10 hover:border-emerald-500/30 transition group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-medium text-white">Credential Vault</h3>
                <p className="text-xs text-gray-400">AES-256 encrypted</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-white transition" />
          </Link>
        </div>
      </div>

      {/* Bottom Tip */}
      <div className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-cyan-500/5 via-violet-500/5 to-pink-500/5 border border-white/5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-cyan-400" />
        </div>
        <p className="text-sm text-gray-400">
          <span className="text-cyan-400 font-medium">Pro tip:</span>{' '}
          Complete daily quests to earn XP and level up faster. Each level unlocks new achievements!
        </p>
      </div>
    </div>
  );
}
