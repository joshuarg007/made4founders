import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Sparkles,
  Calendar,
  CheckSquare,
  FileText,
  Users,
  Clock,
  Target,
  Zap,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Activity,
  BarChart3,
  RefreshCw,
  ChevronRight,
  Rocket,
  Crown,
  HelpCircle,
  X,
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

// Sage business advice - attributed quotes, random on each load
const BUSINESS_TIPS = [
  // Paul Graham (10)
  { quote: "Make something people want.", author: "Paul Graham" },
  { quote: "It's hard to do a really good job on anything you don't think about in the shower.", author: "Paul Graham" },
  { quote: "The way to get startup ideas is not to try to think of startup ideas. It's to look for problems, preferably problems you have yourself.", author: "Paul Graham" },
  { quote: "Live in the future, then build what's missing.", author: "Paul Graham" },
  { quote: "You can't trust opinions. You have to measure.", author: "Paul Graham" },
  { quote: "The most dangerous thing is to give someone's idea a fair hearing.", author: "Paul Graham" },
  { quote: "Be relentlessly resourceful.", author: "Paul Graham" },
  { quote: "Startups don't win by attacking. They win by transcending.", author: "Paul Graham" },
  { quote: "The best way to get a good idea is to get a lot of ideas.", author: "Paul Graham" },
  { quote: "Do things that don't scale.", author: "Paul Graham" },

  // Peter Thiel (10)
  { quote: "Competition is for losers. If you want to create and capture lasting value, build a monopoly.", author: "Peter Thiel" },
  { quote: "The most contrarian thing of all is not to oppose the crowd but to think for yourself.", author: "Peter Thiel" },
  { quote: "Brilliant thinking is rare, but courage is in even shorter supply than genius.", author: "Peter Thiel" },
  { quote: "The best entrepreneurs know this: every great business is built around a secret that's hidden from the outside.", author: "Peter Thiel" },
  { quote: "What important truth do very few people agree with you on?", author: "Peter Thiel" },
  { quote: "A startup is the largest endeavor over which you can have definite mastery.", author: "Peter Thiel" },
  { quote: "The next Bill Gates will not build an operating system. The next Larry Page will not make a search engine.", author: "Peter Thiel" },
  { quote: "Customers won't care about any particular technology unless it solves a particular problem in a superior way.", author: "Peter Thiel" },
  { quote: "If your goal is to never make a mistake in your life, you shouldn't look for secrets.", author: "Peter Thiel" },
  { quote: "The perfect target market for a startup is a small group of particular people concentrated together and served by few or no competitors.", author: "Peter Thiel" },

  // Elon Musk (10)
  { quote: "When something is important enough, you do it even if the odds are not in your favor.", author: "Elon Musk" },
  { quote: "I think it's very important to have a feedback loop, where you're constantly thinking about what you've done and how you could be doing it better.", author: "Elon Musk" },
  { quote: "Failure is an option here. If things are not failing, you are not innovating enough.", author: "Elon Musk" },
  { quote: "It's OK to have your eggs in one basket as long as you control what happens to that basket.", author: "Elon Musk" },
  { quote: "People work better when they know what the goal is and why.", author: "Elon Musk" },
  { quote: "Persistence is very important. You should not give up unless you are forced to give up.", author: "Elon Musk" },
  { quote: "If you're trying to create a company, it's like baking a cake. You have to have all the ingredients in the right proportion.", author: "Elon Musk" },
  { quote: "Really pay attention to negative feedback and solicit it, particularly from friends.", author: "Elon Musk" },
  { quote: "Don't confuse schooling with education. I didn't go to Harvard, but people who work for me did.", author: "Elon Musk" },
  { quote: "Work like hell. Put in 80 to 100 hour weeks. This improves the odds of success.", author: "Elon Musk" },

  // Warren Buffett (10)
  { quote: "Price is what you pay. Value is what you get.", author: "Warren Buffett" },
  { quote: "It takes 20 years to build a reputation and five minutes to ruin it.", author: "Warren Buffett" },
  { quote: "Risk comes from not knowing what you're doing.", author: "Warren Buffett" },
  { quote: "The most important investment you can make is in yourself.", author: "Warren Buffett" },
  { quote: "Only when the tide goes out do you discover who's been swimming naked.", author: "Warren Buffett" },
  { quote: "Someone's sitting in the shade today because someone planted a tree a long time ago.", author: "Warren Buffett" },
  { quote: "Be fearful when others are greedy and greedy when others are fearful.", author: "Warren Buffett" },
  { quote: "The difference between successful people and really successful people is that really successful people say no to almost everything.", author: "Warren Buffett" },
  { quote: "Chains of habit are too light to be felt until they are too heavy to be broken.", author: "Warren Buffett" },
  { quote: "You only have to do a very few things right in your life so long as you don't do too many things wrong.", author: "Warren Buffett" },

  // Naval Ravikant (10)
  { quote: "Seek wealth, not money or status. Wealth is having assets that earn while you sleep.", author: "Naval Ravikant" },
  { quote: "Play iterated games. All the returns in life come from compound interest in long-term games.", author: "Naval Ravikant" },
  { quote: "Escape competition through authenticity. No one can compete with you on being you.", author: "Naval Ravikant" },
  { quote: "Learn to sell. Learn to build. If you can do both, you will be unstoppable.", author: "Naval Ravikant" },
  { quote: "Code and media are permissionless leverage. They're the leverage behind the newly rich.", author: "Naval Ravikant" },
  { quote: "Specific knowledge is found by pursuing your genuine curiosity rather than whatever is hot right now.", author: "Naval Ravikant" },
  { quote: "Reading is faster than listening. Doing is faster than watching.", author: "Naval Ravikant" },
  { quote: "You're not going to get rich renting out your time. You must own equity to gain financial freedom.", author: "Naval Ravikant" },
  { quote: "Arm yourself with specific knowledge, accountability, and leverage.", author: "Naval Ravikant" },
  { quote: "The best jobs are neither combative nor competitive. They're creative.", author: "Naval Ravikant" },

  // Marc Andreessen (10)
  { quote: "In the startup world, you're either growing or you're dying.", author: "Marc Andreessen" },
  { quote: "Software is eating the world.", author: "Marc Andreessen" },
  { quote: "The #1 company-making decision is who is on the team.", author: "Marc Andreessen" },
  { quote: "Product/market fit means being in a good market with a product that can satisfy that market.", author: "Marc Andreessen" },
  { quote: "There are only two priorities: product market fit, and everything else.", author: "Marc Andreessen" },
  { quote: "The market doesn't care how hard you work.", author: "Marc Andreessen" },
  { quote: "In a great market, the market pulls product out of the startup.", author: "Marc Andreessen" },
  { quote: "Founders who are truly passionate about their idea will build a great company. They can't help it.", author: "Marc Andreessen" },
  { quote: "The most important thing for a startup is to build something that at least some people really want.", author: "Marc Andreessen" },
  { quote: "Give me a giant market—always. I can figure out everything else.", author: "Marc Andreessen" },

  // Reid Hoffman (8)
  { quote: "If you are not embarrassed by the first version of your product, you've launched too late.", author: "Reid Hoffman" },
  { quote: "No matter how brilliant your mind or strategy, if you're playing a solo game, you'll always lose out to a team.", author: "Reid Hoffman" },
  { quote: "An entrepreneur is someone who jumps off a cliff and builds a plane on the way down.", author: "Reid Hoffman" },
  { quote: "Your network is your net worth.", author: "Reid Hoffman" },
  { quote: "The fastest way to change yourself is to hang out with people who are already the way you want to be.", author: "Reid Hoffman" },
  { quote: "All humans are entrepreneurs because the will to survive means taking nothing for granted.", author: "Reid Hoffman" },
  { quote: "The key to a great startup idea is solving a real problem.", author: "Reid Hoffman" },
  { quote: "In order to scale, you have to do things that don't scale first.", author: "Reid Hoffman" },

  // Sam Altman (8)
  { quote: "Great execution towards a terrible idea will get you nowhere.", author: "Sam Altman" },
  { quote: "It's better to have a small number of users love your product than a large number who kind of like it.", author: "Sam Altman" },
  { quote: "Long-term thinking is a competitive advantage because almost no one does it.", author: "Sam Altman" },
  { quote: "Move fast. Speed is one of your main advantages over large competitors.", author: "Sam Altman" },
  { quote: "Ideas that seem crazy are the best ones. You want something that sounds crazy but is right.", author: "Sam Altman" },
  { quote: "Startups are a very counterintuitive business.", author: "Sam Altman" },
  { quote: "The most successful founders I know care deeply about what they're building.", author: "Sam Altman" },
  { quote: "Super successful companies usually have a product so good it grows by word of mouth.", author: "Sam Altman" },

  // Jim Rohn (12)
  { quote: "You are the average of the five people you spend the most time with.", author: "Jim Rohn" },
  { quote: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { quote: "Don't wish it were easier. Wish you were better.", author: "Jim Rohn" },
  { quote: "If you don't design your own life plan, chances are you'll fall into someone else's plan.", author: "Jim Rohn" },
  { quote: "Formal education will make you a living; self-education will make you a fortune.", author: "Jim Rohn" },
  { quote: "Success is nothing more than a few simple disciplines, practiced every day.", author: "Jim Rohn" },
  { quote: "Either you run the day or the day runs you.", author: "Jim Rohn" },
  { quote: "Learn how to be happy with what you have while you pursue all that you want.", author: "Jim Rohn" },
  { quote: "The challenge of leadership is to be strong, but not rude; be kind, but not weak.", author: "Jim Rohn" },
  { quote: "Time is more valuable than money. You can get more money, but you cannot get more time.", author: "Jim Rohn" },
  { quote: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
  { quote: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Rohn" },

  // Sun Tzu (12)
  { quote: "Victorious warriors win first and then go to war, while defeated warriors go to war first and then seek to win.", author: "Sun Tzu" },
  { quote: "In the midst of chaos, there is also opportunity.", author: "Sun Tzu" },
  { quote: "The supreme art of war is to subdue the enemy without fighting.", author: "Sun Tzu" },
  { quote: "Know yourself and you will win all battles.", author: "Sun Tzu" },
  { quote: "Appear weak when you are strong, and strong when you are weak.", author: "Sun Tzu" },
  { quote: "Let your plans be dark and impenetrable as night, and when you move, fall like a thunderbolt.", author: "Sun Tzu" },
  { quote: "Opportunities multiply as they are seized.", author: "Sun Tzu" },
  { quote: "Strategy without tactics is the slowest route to victory. Tactics without strategy is the noise before defeat.", author: "Sun Tzu" },
  { quote: "The greatest victory is that which requires no battle.", author: "Sun Tzu" },
  { quote: "If you know the enemy and know yourself, you need not fear the result of a hundred battles.", author: "Sun Tzu" },
  { quote: "Treat your men as you would your own beloved sons. And they will follow you into the deepest valley.", author: "Sun Tzu" },
  { quote: "He will win who knows when to fight and when not to fight.", author: "Sun Tzu" },

  // Machiavelli (10)
  { quote: "It is better to be feared than loved, if you cannot be both.", author: "Niccolò Machiavelli" },
  { quote: "The first method for estimating the intelligence of a ruler is to look at the men he has around him.", author: "Niccolò Machiavelli" },
  { quote: "Never was anything great achieved without danger.", author: "Niccolò Machiavelli" },
  { quote: "Where the willingness is great, the difficulties cannot be great.", author: "Niccolò Machiavelli" },
  { quote: "Men judge generally more by the eye than by the hand, for everyone can see and few can feel.", author: "Niccolò Machiavelli" },
  { quote: "Everyone sees what you appear to be, few experience what you really are.", author: "Niccolò Machiavelli" },
  { quote: "There is no other way to guard yourself against flattery than by making men understand that telling you the truth will not offend you.", author: "Niccolò Machiavelli" },
  { quote: "The wise man does at once what the fool does finally.", author: "Niccolò Machiavelli" },
  { quote: "It is not titles that honor men, but men that honor titles.", author: "Niccolò Machiavelli" },
  { quote: "Benefits should be conferred gradually; and in that way they will taste better.", author: "Niccolò Machiavelli" },

  // Napoleon (12)
  { quote: "Never interrupt your enemy when he is making a mistake.", author: "Napoleon Bonaparte" },
  { quote: "The battlefield is a scene of constant chaos. The winner will be the one who controls that chaos.", author: "Napoleon Bonaparte" },
  { quote: "Victory belongs to the most persevering.", author: "Napoleon Bonaparte" },
  { quote: "Impossible is a word only to be found in the dictionary of fools.", author: "Napoleon Bonaparte" },
  { quote: "A leader is a dealer in hope.", author: "Napoleon Bonaparte" },
  { quote: "Take time to deliberate, but when the time for action has arrived, stop thinking and go in.", author: "Napoleon Bonaparte" },
  { quote: "The strong man is the one who is able to intercept at will the communication between the senses and the mind.", author: "Napoleon Bonaparte" },
  { quote: "Courage isn't having the strength to go on - it is going on when you don't have strength.", author: "Napoleon Bonaparte" },
  { quote: "In politics, stupidity is not a handicap.", author: "Napoleon Bonaparte" },
  { quote: "The people to fear are not those who disagree with you, but those who disagree with you and are too cowardly to let you know.", author: "Napoleon Bonaparte" },
  { quote: "Death is nothing, but to live defeated and inglorious is to die daily.", author: "Napoleon Bonaparte" },
  { quote: "Ability is nothing without opportunity.", author: "Napoleon Bonaparte" },
];

// Business Tip component - random quote on each page load
function BusinessTip() {
  // useMemo ensures the same quote is shown during the session, but changes on reload
  const tip = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * BUSINESS_TIPS.length);
    return BUSINESS_TIPS[randomIndex];
  }, []);

  return (
    <div className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-cyan-500/5 via-violet-500/5 to-pink-500/5 border border-white/5">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-5 h-5 text-cyan-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-300 italic">"{tip.quote}"</p>
        <p className="text-xs text-cyan-400 mt-1">— {tip.author}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { currentBusiness, refreshBusinesses } = useBusiness();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [quests, setQuests] = useState<BusinessQuest[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showHealthHelp, setShowHealthHelp] = useState(false);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [statsData, briefData, questsData, metricsData, tasksData] = await Promise.all([
        getDashboardStats(),
        getDailyBrief(),
        currentBusiness ? getBusinessQuests(currentBusiness.id).catch(() => []) : Promise.resolve([]),
        getMetrics().catch(() => []),
        getTasks().catch(() => []),
      ]);

      setStats(statsData);
      setBrief(briefData);
      setQuests(questsData);
      setMetrics(metricsData);
      setTasks(tasksData);
      if (isRefresh) refreshBusinesses();
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
    return metricTypes
      .map(type => metrics.find(m => m.metric_type?.toLowerCase() === type))
      .filter((m): m is Metric => m !== undefined)
      .slice(0, 4);
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
                <button
                  onClick={() => setShowHealthHelp(true)}
                  className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                  title="How is this calculated?"
                >
                  <span className="text-xs text-gray-400 font-medium">?</span>
                </button>
              </div>
              <Link to="/app/analytics" className="text-xs text-gray-500 hover:text-white transition">
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

            {/* Health Help Modal */}
            {showHealthHelp && (
              <div className="absolute inset-0 bg-[#12141a]/95 backdrop-blur-sm rounded-2xl p-5 z-10 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-cyan-400" />
                    How Health Score Works
                  </h4>
                  <button
                    onClick={() => setShowHealthHelp(false)}
                    className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    <div className="font-medium text-cyan-400 mb-1">Compliance</div>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Tracks legal deadlines, regulatory filings, and document expirations. Missing deadlines or expired docs lower this score.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="font-medium text-emerald-400 mb-1">Financial</div>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Based on tracked metrics (MRR, ARR, revenue) and their trends. Add metrics and keep them updated to improve this score.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                    <div className="font-medium text-violet-400 mb-1">Operations</div>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Measures task completion rates and overdue items. Complete tasks on time and maintain organized workflows.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="font-medium text-amber-400 mb-1">Growth</div>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Evaluates quest completion, XP gains, and engagement streaks. Stay active and complete quests to boost this score.
                    </p>
                  </div>
                  <p className="text-gray-500 text-xs pt-2 border-t border-white/10">
                    Overall score = weighted average of all four categories.
                  </p>
                </div>
              </div>
            )}
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
                <Link to="/app/analytics" className="text-xs text-gray-500 hover:text-white transition">
                  All metrics →
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {keyMetrics.map((metric) => (
                  <div key={metric.id} className="p-3 rounded-xl bg-white/5">
                    <div className="text-xs text-gray-400 uppercase mb-1">{metric.name || metric.metric_type}</div>
                    <div className="text-xl font-bold text-white">
                      {metric.unit === '$' || metric.unit === 'USD' ? '$' : ''}
                      {metric.value}
                      {metric.unit === '%' ? '%' : ''}
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

      {/* Bottom Tip - Sage Business Advice */}
      <BusinessTip />
    </div>
  );
}
