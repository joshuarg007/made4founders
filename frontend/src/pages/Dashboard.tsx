import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Flame,
  Target,
  Rocket,
  Shield,
  Zap,
  Crown,
  Star,
  TrendingUp,
  CheckCircle2,
  FileText,
  Users,
  Calendar,
  Award,
  Sparkles,
} from 'lucide-react';
import { getDashboardStats, getBusinessInfo, getDeadlines, getContacts, getDocuments, type DashboardStats, type BusinessInfo, type Deadline } from '../lib/api';
import { differenceInDays, differenceInMonths, differenceInYears } from 'date-fns';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: typeof Trophy;
  color: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [completedDeadlines, setCompletedDeadlines] = useState(0);
  const [totalContacts, setTotalContacts] = useState(0);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getDashboardStats(),
      getBusinessInfo(),
      getDeadlines(undefined, true),
      getContacts(),
      getDocuments(),
    ]).then(([statsData, businessData, deadlinesData, contactsData, docsData]) => {
      setStats(statsData);
      setBusinessInfo(businessData);
      setCompletedDeadlines(deadlinesData.filter((d: Deadline) => d.is_completed).length);
      setTotalContacts(contactsData.length);
      setTotalDocuments(docsData.length);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Calculate days since founding
  const getDaysSinceFounding = () => {
    if (!businessInfo?.formation_date) return null;
    const foundingDate = new Date(businessInfo.formation_date);
    return differenceInDays(new Date(), foundingDate);
  };

  const getCompanyAge = () => {
    if (!businessInfo?.formation_date) return null;
    const foundingDate = new Date(businessInfo.formation_date);
    const years = differenceInYears(new Date(), foundingDate);
    const months = differenceInMonths(new Date(), foundingDate) % 12;

    if (years > 0) {
      return `${years} year${years > 1 ? 's' : ''}, ${months} month${months !== 1 ? 's' : ''}`;
    }
    return `${months} month${months !== 1 ? 's' : ''}`;
  };

  // Calculate founder score (0-100)
  const getFounderScore = () => {
    let score = 0;
    const maxScore = 100;

    // Business info completeness (25 points)
    if (businessInfo) {
      if (businessInfo.legal_name) score += 5;
      if (businessInfo.entity_type) score += 5;
      if (businessInfo.formation_state) score += 5;
      if (businessInfo.formation_date) score += 5;
      if (businessInfo.industry) score += 5;
    }

    // Documents (25 points)
    if (totalDocuments >= 1) score += 5;
    if (totalDocuments >= 5) score += 10;
    if (totalDocuments >= 10) score += 10;

    // Contacts (25 points)
    if (totalContacts >= 1) score += 5;
    if (totalContacts >= 5) score += 10;
    if (totalContacts >= 10) score += 10;

    // Deadlines completed (25 points)
    if (completedDeadlines >= 1) score += 5;
    if (completedDeadlines >= 5) score += 10;
    if (completedDeadlines >= 10) score += 10;

    return Math.min(score, maxScore);
  };

  // Generate achievements
  const getAchievements = (): Achievement[] => {
    const daysSinceFounding = getDaysSinceFounding();

    return [
      {
        id: 'first-steps',
        title: 'First Steps',
        description: 'Set up your company profile',
        icon: Rocket,
        color: 'cyan',
        unlocked: !!(businessInfo?.legal_name || businessInfo?.dba_name),
      },
      {
        id: 'legally-formed',
        title: 'Legally Formed',
        description: 'Registered your business entity',
        icon: Shield,
        color: 'emerald',
        unlocked: !!(businessInfo?.entity_type && businessInfo?.formation_state),
      },
      {
        id: 'document-master',
        title: 'Document Master',
        description: 'Uploaded 10+ documents',
        icon: FileText,
        color: 'violet',
        unlocked: totalDocuments >= 10,
      },
      {
        id: 'network-builder',
        title: 'Network Builder',
        description: 'Added 10+ contacts',
        icon: Users,
        color: 'pink',
        unlocked: totalContacts >= 10,
      },
      {
        id: 'deadline-crusher',
        title: 'Deadline Crusher',
        description: 'Completed 10+ deadlines',
        icon: Target,
        color: 'amber',
        unlocked: completedDeadlines >= 10,
      },
      {
        id: 'survivor',
        title: 'Survivor',
        description: 'Company running for 30+ days',
        icon: Flame,
        color: 'orange',
        unlocked: daysSinceFounding !== null && daysSinceFounding >= 30,
      },
      {
        id: 'veteran',
        title: 'Veteran',
        description: 'Company running for 1+ year',
        icon: Crown,
        color: 'yellow',
        unlocked: daysSinceFounding !== null && daysSinceFounding >= 365,
      },
      {
        id: 'perfect-score',
        title: 'Perfect Score',
        description: 'Achieved 100% Founder Score',
        icon: Trophy,
        color: 'gradient',
        unlocked: getFounderScore() === 100,
      },
    ];
  };

  const daysSinceFounding = getDaysSinceFounding();
  const companyAge = getCompanyAge();
  const founderScore = getFounderScore();
  const achievements = getAchievements();
  const unlockedCount = achievements.filter(a => a.unlocked).length;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-gray-400">Loading your stats...</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="text-center py-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 mb-6">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-sm text-cyan-400 font-medium">Founder Stats</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
          {businessInfo?.legal_name || businessInfo?.dba_name || 'Your Company'}
        </h1>

        {businessInfo?.entity_type && (
          <p className="text-gray-400 text-lg">
            {businessInfo.entity_type} · {businessInfo.formation_state || 'United States'}
          </p>
        )}
      </div>

      {/* Big Numbers */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Days Since Founding */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20 p-8 text-center">
          <div className="absolute top-4 right-4">
            <Rocket className="w-8 h-8 text-cyan-500/30" />
          </div>
          <div className="text-6xl font-bold text-white mb-2">
            {daysSinceFounding !== null ? daysSinceFounding.toLocaleString() : '—'}
          </div>
          <div className="text-cyan-400 font-medium">Days Building</div>
          {companyAge && (
            <div className="text-gray-500 text-sm mt-1">{companyAge}</div>
          )}
          {!businessInfo?.formation_date && (
            <Link to="/library" className="text-xs text-cyan-400/60 hover:text-cyan-400 mt-2 inline-block">
              Set formation date →
            </Link>
          )}
        </div>

        {/* Founder Score */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 to-violet-500/5 border border-violet-500/20 p-8 text-center">
          <div className="absolute top-4 right-4">
            <Zap className="w-8 h-8 text-violet-500/30" />
          </div>
          <div className="text-6xl font-bold text-white mb-2">{founderScore}</div>
          <div className="text-violet-400 font-medium">Founder Score</div>
          <div className="mt-3 w-full bg-white/10 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-1000"
              style={{ width: `${founderScore}%` }}
            />
          </div>
        </div>

        {/* Achievements */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 p-8 text-center">
          <div className="absolute top-4 right-4">
            <Trophy className="w-8 h-8 text-amber-500/30" />
          </div>
          <div className="text-6xl font-bold text-white mb-2">
            {unlockedCount}/{achievements.length}
          </div>
          <div className="text-amber-400 font-medium">Achievements</div>
          <div className="text-gray-500 text-sm mt-1">
            {achievements.length - unlockedCount} to unlock
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/documents" className="group p-6 rounded-xl bg-[#1a1d24] border border-white/10 hover:border-violet-500/50 transition">
          <div className="flex items-center justify-between mb-3">
            <FileText className="w-5 h-5 text-violet-400" />
            <TrendingUp className="w-4 h-4 text-gray-600 group-hover:text-violet-400 transition" />
          </div>
          <div className="text-3xl font-bold text-white">{totalDocuments}</div>
          <div className="text-sm text-gray-400">Documents</div>
        </Link>

        <Link to="/contacts" className="group p-6 rounded-xl bg-[#1a1d24] border border-white/10 hover:border-emerald-500/50 transition">
          <div className="flex items-center justify-between mb-3">
            <Users className="w-5 h-5 text-emerald-400" />
            <TrendingUp className="w-4 h-4 text-gray-600 group-hover:text-emerald-400 transition" />
          </div>
          <div className="text-3xl font-bold text-white">{totalContacts}</div>
          <div className="text-sm text-gray-400">Contacts</div>
        </Link>

        <Link to="/deadlines" className="group p-6 rounded-xl bg-[#1a1d24] border border-white/10 hover:border-cyan-500/50 transition">
          <div className="flex items-center justify-between mb-3">
            <CheckCircle2 className="w-5 h-5 text-cyan-400" />
            <TrendingUp className="w-4 h-4 text-gray-600 group-hover:text-cyan-400 transition" />
          </div>
          <div className="text-3xl font-bold text-white">{completedDeadlines}</div>
          <div className="text-sm text-gray-400">Completed</div>
        </Link>

        <Link to="/deadlines" className="group p-6 rounded-xl bg-[#1a1d24] border border-white/10 hover:border-amber-500/50 transition">
          <div className="flex items-center justify-between mb-3">
            <Calendar className="w-5 h-5 text-amber-400" />
            {stats && stats.upcoming_deadlines > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">
                Active
              </span>
            )}
          </div>
          <div className="text-3xl font-bold text-white">{stats?.upcoming_deadlines || 0}</div>
          <div className="text-sm text-gray-400">Upcoming</div>
        </Link>
      </div>

      {/* Achievements Section */}
      <div className="rounded-2xl bg-[#1a1d24] border border-white/10 p-8">
        <div className="flex items-center gap-3 mb-6">
          <Award className="w-6 h-6 text-amber-400" />
          <h2 className="text-xl font-bold text-white">Achievements</h2>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          {achievements.map((achievement) => (
            <div
              key={achievement.id}
              className={`relative p-4 rounded-xl border transition ${
                achievement.unlocked
                  ? `bg-${achievement.color === 'gradient' ? 'gradient-to-br from-cyan-500/10 to-violet-500/10' : `${achievement.color}-500/10`} border-${achievement.color === 'gradient' ? 'cyan' : achievement.color}-500/30`
                  : 'bg-white/5 border-white/10 opacity-50'
              }`}
            >
              {achievement.unlocked && (
                <div className="absolute -top-2 -right-2">
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                </div>
              )}
              <achievement.icon className={`w-8 h-8 mb-3 ${
                achievement.unlocked
                  ? achievement.color === 'gradient'
                    ? 'text-cyan-400'
                    : `text-${achievement.color}-400`
                  : 'text-gray-600'
              }`} />
              <h3 className={`font-semibold mb-1 ${achievement.unlocked ? 'text-white' : 'text-gray-500'}`}>
                {achievement.title}
              </h3>
              <p className="text-xs text-gray-500">{achievement.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Founder Score Breakdown */}
      <div className="rounded-2xl bg-[#1a1d24] border border-white/10 p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-violet-400" />
            <h2 className="text-xl font-bold text-white">Score Breakdown</h2>
          </div>
          <div className="text-2xl font-bold text-violet-400">{founderScore}/100</div>
        </div>

        <div className="space-y-4">
          {[
            { label: 'Business Profile', current: businessInfo?.legal_name ? 25 : (businessInfo?.entity_type ? 15 : 0), max: 25, color: 'cyan' },
            { label: 'Documents', current: Math.min(25, totalDocuments >= 10 ? 25 : totalDocuments >= 5 ? 15 : totalDocuments >= 1 ? 5 : 0), max: 25, color: 'violet' },
            { label: 'Network', current: Math.min(25, totalContacts >= 10 ? 25 : totalContacts >= 5 ? 15 : totalContacts >= 1 ? 5 : 0), max: 25, color: 'emerald' },
            { label: 'Deadlines', current: Math.min(25, completedDeadlines >= 10 ? 25 : completedDeadlines >= 5 ? 15 : completedDeadlines >= 1 ? 5 : 0), max: 25, color: 'amber' },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">{item.label}</span>
                <span className={`text-${item.color}-400 font-medium`}>{item.current}/{item.max}</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div
                  className={`h-2 rounded-full bg-${item.color}-500 transition-all duration-500`}
                  style={{ width: `${(item.current / item.max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Motivational Footer */}
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">
          {founderScore >= 80
            ? "You're killing it! Keep building. 🚀"
            : founderScore >= 50
            ? "Good progress! Keep the momentum going. 💪"
            : "Every founder starts somewhere. Let's go! 🌱"
          }
        </p>
      </div>
    </div>
  );
}
