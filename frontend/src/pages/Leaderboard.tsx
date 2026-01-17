import { useState, useEffect, useCallback, useRef } from 'react';
import { useBusiness } from '../context/BusinessContext';
import confetti from 'canvas-confetti';
import { playVictorySound, playAchievementSound, playNotificationSound, playQuestCompleteSound } from '../lib/sounds';
import {
  Trophy,
  Medal,
  Crown,
  Flame,
  Star,
  Lock,
  Gift,
  Zap,
  Award,
  Target,
  CheckCircle2,
  Sparkles,
  Swords,
  Plus,
  Copy,
  Clock,
  Users,
  TrendingUp,
  X,
  Share2,
  Shield,
} from 'lucide-react';
import {
  getLeaderboard,
  getBusinessAchievements,
  claimAchievementReward,
  getChallenges,
  createChallenge,
  joinChallengeByCode,
  acceptChallenge,
  declineChallenge,
  cancelChallenge,
} from '../lib/api';
import type {
  BusinessAchievement,
  LeaderboardResponse,
  Challenge,
  ChallengeListResponse,
  ChallengeCreate,
} from '../lib/api';

// Rarity colors and styles
const rarityStyles: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  common: { bg: 'bg-gray-500/20', border: 'border-gray-500/30', text: 'text-gray-400', glow: '' },
  uncommon: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400', glow: '' },
  rare: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', glow: 'shadow-blue-500/20' },
  epic: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', glow: 'shadow-purple-500/30' },
  legendary: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400', glow: 'shadow-yellow-500/40' },
};

// Category icons
const categoryIcons: Record<string, typeof Trophy> = {
  tasks: CheckCircle2,
  streaks: Flame,
  documents: Target,
  checklist: Award,
  contacts: Star,
  quests: Sparkles,
  milestones: Crown,
  metrics: Zap,
};

// Challenge type display info
const challengeTypeInfo: Record<string, { name: string; icon: typeof Trophy; color: string }> = {
  task_sprint: { name: 'Task Sprint', icon: CheckCircle2, color: 'text-green-400' },
  xp_race: { name: 'XP Race', icon: Zap, color: 'text-cyan-400' },
  streak_showdown: { name: 'Streak Showdown', icon: Flame, color: 'text-orange-400' },
  quest_champion: { name: 'Quest Champion', icon: Sparkles, color: 'text-purple-400' },
  checklist_blitz: { name: 'Checklist Blitz', icon: Award, color: 'text-blue-400' },
  document_dash: { name: 'Document Dash', icon: Target, color: 'text-pink-400' },
  contact_collector: { name: 'Contact Collector', icon: Users, color: 'text-amber-400' },
};

const durationLabels: Record<string, string> = {
  '3_days': '3 Days',
  '1_week': '1 Week',
  '2_weeks': '2 Weeks',
  '1_month': '1 Month',
};

export default function Leaderboard() {
  const { currentBusiness, refreshBusinesses } = useBusiness();
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'achievements' | 'challenges'>('challenges');

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  // Achievements state
  const [achievements, setAchievements] = useState<BusinessAchievement[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [celebration, setCelebration] = useState<{ xp: number; message: string } | null>(null);

  // Challenges state
  const [challenges, setChallenges] = useState<ChallengeListResponse | null>(null);
  const [challengesLoading, setChallengesLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinWager, setJoinWager] = useState(0);
  const [joiningChallenge, setJoiningChallenge] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Create challenge form
  const [newChallenge, setNewChallenge] = useState<ChallengeCreate>({
    name: '',
    challenge_type: 'task_sprint',
    duration: '1_week',
    xp_wager: 0,
    handicap_enabled: true,
    is_public: false,
  });
  const [creatingChallenge, setCreatingChallenge] = useState(false);

  // Victory celebration state
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [victoryChallenge, setVictoryChallenge] = useState<Challenge | null>(null);
  const celebratedWinsRef = useRef<Set<number>>(new Set());

  // Confetti functions
  const fireConfetti = useCallback(() => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

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
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#ffd700', '#ffb700', '#ff8c00', '#00ff88', '#00d4ff'],
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#ffd700', '#ffb700', '#ff8c00', '#00ff88', '#00d4ff'],
      });
    }, 250);
  }, []);

  const fireVictoryConfetti = useCallback(() => {
    // Cannon burst from sides
    const count = 200;
    const defaults = { origin: { y: 0.7 }, zIndex: 9999 };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    // Left side
    fire(0.25, { spread: 26, startVelocity: 55, origin: { x: 0, y: 0.6 }, colors: ['#ffd700', '#ffb700'] });
    fire(0.2, { spread: 60, origin: { x: 0.1, y: 0.6 }, colors: ['#00ff88', '#00d4ff'] });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, origin: { x: 0, y: 0.7 } });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2, origin: { x: 0.1, y: 0.5 } });
    fire(0.1, { spread: 120, startVelocity: 45, origin: { x: 0.05, y: 0.6 } });

    // Right side
    fire(0.25, { spread: 26, startVelocity: 55, origin: { x: 1, y: 0.6 }, colors: ['#ffd700', '#ffb700'] });
    fire(0.2, { spread: 60, origin: { x: 0.9, y: 0.6 }, colors: ['#00ff88', '#00d4ff'] });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, origin: { x: 1, y: 0.7 } });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2, origin: { x: 0.9, y: 0.5 } });
    fire(0.1, { spread: 120, startVelocity: 45, origin: { x: 0.95, y: 0.6 } });

    // Stars from center
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ffd700'],
        shapes: ['star'],
        zIndex: 9999,
      });
    }, 300);
  }, []);

  // Load leaderboard
  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        setLeaderboardLoading(true);
        const data = await getLeaderboard(50);
        setLeaderboard(data);
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
      } finally {
        setLeaderboardLoading(false);
      }
    };
    loadLeaderboard();
  }, []);

  // Load achievements when business changes
  useEffect(() => {
    const loadAchievements = async () => {
      if (!currentBusiness) {
        setAchievements([]);
        setAchievementsLoading(false);
        return;
      }
      try {
        setAchievementsLoading(true);
        const data = await getBusinessAchievements(currentBusiness.id);
        setAchievements(data);
      } catch (err) {
        console.error('Failed to load achievements:', err);
      } finally {
        setAchievementsLoading(false);
      }
    };
    loadAchievements();
  }, [currentBusiness?.id]);

  // Load challenges
  useEffect(() => {
    loadChallenges();
  }, [currentBusiness?.id]);

  const loadChallenges = async () => {
    try {
      setChallengesLoading(true);
      const data = await getChallenges();
      setChallenges(data);
    } catch (err) {
      console.error('Failed to load challenges:', err);
    } finally {
      setChallengesLoading(false);
    }
  };

  // Check for new wins and celebrate
  useEffect(() => {
    if (!challenges?.completed || !currentBusiness) return;

    const newWins = challenges.completed.filter(
      c => c.winner_id === currentBusiness.id && !celebratedWinsRef.current.has(c.id)
    );

    if (newWins.length > 0) {
      // Celebrate the most recent win
      const recentWin = newWins[0];
      celebratedWinsRef.current.add(recentWin.id);
      setVictoryChallenge(recentWin);
      setShowVictoryModal(true);
      fireVictoryConfetti();
      playVictorySound(); // Play victory fanfare

      // Mark all new wins as celebrated
      newWins.forEach(w => celebratedWinsRef.current.add(w.id));
    }
  }, [challenges?.completed, currentBusiness?.id, fireVictoryConfetti]);

  const handleClaimAchievement = async (achievementId: number) => {
    if (!currentBusiness) return;
    setClaimingId(achievementId);
    try {
      const result = await claimAchievementReward(currentBusiness.id, achievementId);
      setCelebration({ xp: result.xp_awarded, message: result.message });
      fireConfetti(); // Celebrate achievement claim
      playAchievementSound(); // Play achievement sound
      const data = await getBusinessAchievements(currentBusiness.id);
      setAchievements(data);
      await refreshBusinesses();
      setTimeout(() => setCelebration(null), 3000);
    } catch (err) {
      console.error('Failed to claim achievement:', err);
    } finally {
      setClaimingId(null);
    }
  };

  const handleCreateChallenge = async () => {
    if (!newChallenge.name.trim()) return;
    setCreatingChallenge(true);
    try {
      await createChallenge(newChallenge);
      setShowCreateModal(false);
      setNewChallenge({
        name: '',
        challenge_type: 'task_sprint',
        duration: '1_week',
        xp_wager: 0,
        handicap_enabled: true,
        is_public: false,
      });
      await loadChallenges();
      await refreshBusinesses();
      playQuestCompleteSound(); // Challenge created successfully
    } catch (err) {
      console.error('Failed to create challenge:', err);
    } finally {
      setCreatingChallenge(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) return;
    setJoiningChallenge(true);
    try {
      await joinChallengeByCode(joinCode, joinWager);
      setShowJoinModal(false);
      setJoinCode('');
      setJoinWager(0);
      await loadChallenges();
      await refreshBusinesses();
      setCelebration({ xp: 0, message: 'Challenge joined! Game on!' });
      playNotificationSound(); // Challenge joined sound
      setTimeout(() => setCelebration(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to join challenge');
    } finally {
      setJoiningChallenge(false);
    }
  };

  const handleAcceptChallenge = async (challengeId: number) => {
    try {
      await acceptChallenge(challengeId, 0);
      await loadChallenges();
      await refreshBusinesses();
      playNotificationSound(); // Challenge accepted sound
    } catch (err) {
      console.error('Failed to accept challenge:', err);
    }
  };

  const handleDeclineChallenge = async (challengeId: number) => {
    try {
      await declineChallenge(challengeId);
      await loadChallenges();
    } catch (err) {
      console.error('Failed to decline challenge:', err);
    }
  };

  const handleCancelChallenge = async (challengeId: number) => {
    if (!confirm('Cancel this challenge? XP will be refunded.')) return;
    try {
      await cancelChallenge(challengeId);
      await loadChallenges();
      await refreshBusinesses();
    } catch (err) {
      console.error('Failed to cancel challenge:', err);
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-300" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="text-gray-400 font-mono text-lg">#{rank}</span>;
  };

  // Separate unlocked and locked achievements
  const unlockedAchievements = achievements.filter(a => a.is_unlocked);
  const lockedAchievements = achievements.filter(a => !a.is_unlocked);

  // Count pending invitations
  const invitationCount = challenges?.invitations.length || 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Celebration Toast */}
      {celebration && (
        <div className="fixed top-4 right-4 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3">
            <Gift className="w-6 h-6" />
            <div>
              {celebration.xp > 0 && <div className="font-bold">+{celebration.xp} XP</div>}
              <div className="text-sm opacity-90">{celebration.message}</div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Compete & Achieve</h1>
            <p className="text-gray-400 text-sm">Challenge friends, climb the ranks, earn glory</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('challenges')}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            activeTab === 'challenges'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
          }`}
        >
          <Swords className="w-4 h-4" />
          Challenges
          {invitationCount > 0 && (
            <span className="ml-1 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
              {invitationCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            activeTab === 'leaderboard'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
          }`}
        >
          <Trophy className="w-4 h-4" />
          Leaderboard
        </button>
        <button
          onClick={() => setActiveTab('achievements')}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            activeTab === 'achievements'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
          }`}
        >
          <Award className="w-4 h-4" />
          Achievements
          {unlockedAchievements.filter(a => !a.xp_claimed).length > 0 && (
            <span className="ml-1 bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">
              {unlockedAchievements.filter(a => !a.xp_claimed).length}
            </span>
          )}
        </button>
      </div>

      {/* Challenges Tab */}
      {activeTab === 'challenges' && (
        <div className="space-y-6">
          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white rounded-lg font-medium flex items-center gap-2 transition-all shadow-lg hover:shadow-red-500/25"
            >
              <Plus className="w-4 h-4" />
              Create Challenge
            </button>
            <button
              onClick={() => setShowJoinModal(true)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium flex items-center gap-2 transition-all"
            >
              <Share2 className="w-4 h-4" />
              Join with Code
            </button>
          </div>

          {challengesLoading ? (
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-12 text-center text-gray-400">
              <div className="animate-spin w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full mx-auto mb-4" />
              Loading challenges...
            </div>
          ) : (
            <>
              {/* Invitations */}
              {challenges?.invitations && challenges.invitations.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Gift className="w-5 h-5 text-red-400 animate-pulse" />
                    Challenge Invitations
                  </h2>
                  <div className="space-y-3">
                    {challenges.invitations.map((challenge) => (
                      <ChallengeCard
                        key={challenge.id}
                        challenge={challenge}
                        currentBusinessId={currentBusiness?.id}
                        onAccept={() => handleAcceptChallenge(challenge.id)}
                        onDecline={() => handleDeclineChallenge(challenge.id)}
                        isInvitation
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Active Challenges */}
              {challenges?.active && challenges.active.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-400" />
                    Active Challenges
                  </h2>
                  <div className="space-y-3">
                    {challenges.active.map((challenge) => (
                      <ChallengeCard
                        key={challenge.id}
                        challenge={challenge}
                        currentBusinessId={currentBusiness?.id}
                        onCopyCode={copyInviteCode}
                        copiedCode={copiedCode}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Challenges */}
              {challenges?.pending && challenges.pending.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-400" />
                    Waiting for Opponent
                  </h2>
                  <div className="space-y-3">
                    {challenges.pending.map((challenge) => (
                      <ChallengeCard
                        key={challenge.id}
                        challenge={challenge}
                        currentBusinessId={currentBusiness?.id}
                        onCancel={() => handleCancelChallenge(challenge.id)}
                        onCopyCode={copyInviteCode}
                        copiedCode={copiedCode}
                        isPending
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Challenges */}
              {challenges?.completed && challenges.completed.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    Recent Results
                  </h2>
                  <div className="space-y-3">
                    {challenges.completed.slice(0, 5).map((challenge) => (
                      <ChallengeCard
                        key={challenge.id}
                        challenge={challenge}
                        currentBusinessId={currentBusiness?.id}
                        isCompleted
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!challenges?.active.length && !challenges?.pending.length && !challenges?.invitations.length && (
                <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-12 text-center">
                  <Swords className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 mb-2">No active challenges</p>
                  <p className="text-gray-500 text-sm">Create a challenge and invite a friend to compete!</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div className="bg-[#1a1d24] rounded-xl border border-white/10 overflow-hidden">
          {leaderboardLoading ? (
            <div className="p-12 text-center text-gray-400">
              <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
              Loading leaderboard...
            </div>
          ) : !leaderboard || leaderboard.entries.length === 0 ? (
            <div className="p-12 text-center">
              <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No businesses on the leaderboard yet</p>
              <p className="text-gray-500 text-sm mt-2">Complete tasks and quests to earn XP!</p>
            </div>
          ) : (
            <>
              {leaderboard.user_rank && currentBusiness && (
                <div className="p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-cyan-400 font-bold">Your Rank</span>
                      <span className="text-2xl font-bold text-white">#{leaderboard.user_rank}</span>
                      <span className="text-gray-400">of {leaderboard.total_count}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Zap className="w-4 h-4 text-cyan-400" />
                        <span className="text-white font-medium">{currentBusiness.xp.toLocaleString()} XP</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-amber-400" />
                        <span className="text-white font-medium">Level {currentBusiness.level}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="divide-y divide-white/5">
                {leaderboard.entries.map((entry) => (
                  <div
                    key={entry.business_id}
                    className={`p-4 flex items-center gap-4 transition-colors ${
                      currentBusiness?.id === entry.business_id
                        ? 'bg-cyan-500/10'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="w-12 flex justify-center">{getRankDisplay(entry.rank)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {entry.business_emoji && <span className="text-lg">{entry.business_emoji}</span>}
                        <span className="font-medium text-white truncate">{entry.business_name}</span>
                        {currentBusiness?.id === entry.business_id && (
                          <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">You</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 truncate">{entry.organization_name}</div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="text-white font-bold">{entry.level}</div>
                        <div className="text-gray-500 text-xs">Level</div>
                      </div>
                      <div className="text-center">
                        <div className="text-cyan-400 font-bold">{entry.xp.toLocaleString()}</div>
                        <div className="text-gray-500 text-xs">XP</div>
                      </div>
                      <div className="text-center">
                        <div className="text-orange-400 font-bold flex items-center gap-1">
                          <Flame className="w-4 h-4" />
                          {entry.current_streak}
                        </div>
                        <div className="text-gray-500 text-xs">Streak</div>
                      </div>
                      <div className="text-center">
                        <div className="text-purple-400 font-bold flex items-center gap-1">
                          <Award className="w-4 h-4" />
                          {entry.achievements_count}
                        </div>
                        <div className="text-gray-500 text-xs">Badges</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Achievements Tab */}
      {activeTab === 'achievements' && (
        <div className="space-y-6">
          {!currentBusiness ? (
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-12 text-center">
              <Award className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Select a business to view achievements</p>
            </div>
          ) : achievementsLoading ? (
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-12 text-center text-gray-400">
              <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
              Loading achievements...
            </div>
          ) : achievements.length === 0 ? (
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-12 text-center">
              <Award className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No achievements available</p>
              <p className="text-gray-500 text-sm mt-2">
                {currentBusiness.gamification_enabled
                  ? 'Complete actions to unlock achievements!'
                  : 'Enable gamification in Business Settings.'}
              </p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">{unlockedAchievements.length}</div>
                      <div className="text-sm text-gray-400">Unlocked</div>
                    </div>
                  </div>
                </div>
                <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Gift className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">
                        {unlockedAchievements.filter(a => !a.xp_claimed).length}
                      </div>
                      <div className="text-sm text-gray-400">To Claim</div>
                    </div>
                  </div>
                </div>
                <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-500/20 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">{lockedAchievements.length}</div>
                      <div className="text-sm text-gray-400">Locked</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Unlocked Achievements */}
              {unlockedAchievements.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    Unlocked Achievements
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      ...unlockedAchievements.filter(a => !a.xp_claimed),
                      ...unlockedAchievements.filter(a => a.xp_claimed),
                    ].map((ba) => {
                      const style = rarityStyles[ba.achievement.rarity] || rarityStyles.common;
                      const CategoryIcon = categoryIcons[ba.achievement.category] || Award;
                      return (
                        <div
                          key={ba.id}
                          className={`rounded-xl border p-4 ${style.bg} ${style.border} ${
                            ba.achievement.rarity === 'legendary' || ba.achievement.rarity === 'epic'
                              ? `shadow-lg ${style.glow}`
                              : ''
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${style.bg}`}>
                              {ba.achievement.icon || <CategoryIcon className={`w-6 h-6 ${style.text}`} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-white truncate">{ba.achievement.name}</h3>
                                <span className={`text-xs px-2 py-0.5 rounded capitalize ${style.bg} ${style.text}`}>
                                  {ba.achievement.rarity}
                                </span>
                              </div>
                              <p className="text-sm text-gray-400 mt-1">{ba.achievement.description}</p>
                              <div className="flex items-center gap-4 mt-3">
                                <span className="text-sm text-purple-400">+{ba.xp_reward} XP</span>
                                {ba.xp_claimed ? (
                                  <span className="text-sm text-green-400 flex items-center gap-1">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Claimed
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleClaimAchievement(ba.id)}
                                    disabled={claimingId === ba.id}
                                    className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                                  >
                                    {claimingId === ba.id ? (
                                      <>
                                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                        Claiming...
                                      </>
                                    ) : (
                                      <>
                                        <Gift className="w-4 h-4" />
                                        Claim
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Locked Achievements */}
              {lockedAchievements.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-gray-400" />
                    Locked Achievements
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {lockedAchievements.map((ba) => {
                      const style = rarityStyles[ba.achievement.rarity] || rarityStyles.common;
                      const CategoryIcon = categoryIcons[ba.achievement.category] || Award;
                      const progress = Math.min(100, (ba.current_count / ba.target_count) * 100);
                      return (
                        <div
                          key={ba.id}
                          className="bg-[#1a1d24] rounded-xl border border-white/10 p-4 opacity-75 hover:opacity-100 transition-opacity"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-xl opacity-50">
                              {ba.achievement.icon || <CategoryIcon className="w-5 h-5 text-gray-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-gray-300 truncate text-sm">{ba.achievement.name}</h3>
                                <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${style.bg} ${style.text}`}>
                                  {ba.achievement.rarity}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ba.achievement.description}</p>
                              <div className="mt-3">
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-gray-500">{ba.current_count} / {ba.target_count}</span>
                                  <span className="text-purple-400">+{ba.xp_reward} XP</span>
                                </div>
                                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Create Challenge Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-md">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Swords className="w-5 h-5 text-red-400" />
                Create Challenge
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Challenge Name</label>
                <input
                  type="text"
                  value={newChallenge.name}
                  onChange={(e) => setNewChallenge({ ...newChallenge, name: e.target.value })}
                  placeholder="e.g., Weekend Warrior Showdown"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Challenge Type</label>
                <select
                  value={newChallenge.challenge_type}
                  onChange={(e) => setNewChallenge({ ...newChallenge, challenge_type: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-red-500/50"
                >
                  {Object.entries(challengeTypeInfo).map(([key, info]) => (
                    <option key={key} value={key}>{info.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Duration</label>
                <select
                  value={newChallenge.duration}
                  onChange={(e) => setNewChallenge({ ...newChallenge, duration: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-red-500/50"
                >
                  {Object.entries(durationLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  XP Wager (optional) - You have {currentBusiness?.xp.toLocaleString()} XP
                </label>
                <input
                  type="number"
                  min="0"
                  max={currentBusiness?.xp || 0}
                  value={newChallenge.xp_wager}
                  onChange={(e) => setNewChallenge({ ...newChallenge, xp_wager: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-red-500/50"
                />
                <p className="text-xs text-gray-500 mt-1">Winner takes all wagered XP + bonus</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newChallenge.handicap_enabled}
                    onChange={(e) => setNewChallenge({ ...newChallenge, handicap_enabled: e.target.checked })}
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-red-500 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-300 flex items-center gap-1">
                    <Shield className="w-4 h-4 text-green-400" />
                    Enable Handicap
                  </span>
                </label>
              </div>
              <p className="text-xs text-gray-500">Lower level players get a score boost for fairness</p>
            </div>
            <div className="p-4 border-t border-white/10 flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChallenge}
                disabled={!newChallenge.name.trim() || creatingChallenge}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingChallenge ? 'Creating...' : 'Create Challenge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Challenge Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-md">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-cyan-400" />
                Join Challenge
              </h2>
              <button onClick={() => setShowJoinModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Invite Code</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter 8-character code"
                  maxLength={8}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 font-mono text-lg tracking-widest text-center"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Your XP Wager (optional) - You have {currentBusiness?.xp.toLocaleString()} XP
                </label>
                <input
                  type="number"
                  min="0"
                  max={currentBusiness?.xp || 0}
                  value={joinWager}
                  onChange={(e) => setJoinWager(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>
            <div className="p-4 border-t border-white/10 flex gap-3">
              <button
                onClick={() => setShowJoinModal(false)}
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleJoinByCode}
                disabled={joinCode.length !== 8 || joiningChallenge}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {joiningChallenge ? 'Joining...' : 'Join Challenge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory Celebration Modal */}
      {showVictoryModal && victoryChallenge && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="relative">
            {/* Glow effect behind modal */}
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 blur-3xl opacity-30 animate-pulse" />

            <div className="relative bg-gradient-to-b from-[#1a1d24] to-[#0f1115] rounded-2xl border border-yellow-500/50 w-full max-w-md overflow-hidden shadow-2xl shadow-yellow-500/20">
              {/* Animated background */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-20 -left-20 w-40 h-40 bg-yellow-500/20 rounded-full blur-3xl animate-float" />
                <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl animate-float-delayed" />
              </div>

              <div className="relative p-8 text-center">
                {/* Trophy icon with animation */}
                <div className="relative inline-block mb-4">
                  <div className="absolute inset-0 bg-yellow-400 rounded-full blur-xl opacity-50 animate-ping-slow" />
                  <div className="relative w-24 h-24 mx-auto bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/50 animate-bounce-slow">
                    <Trophy className="w-12 h-12 text-white drop-shadow-lg" />
                  </div>
                </div>

                {/* Victory text */}
                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 mb-2 animate-shimmer">
                  VICTORY!
                </h2>
                <p className="text-gray-400 mb-4">You conquered the challenge!</p>

                {/* Challenge name */}
                <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/10">
                  <p className="text-white font-semibold text-lg">{victoryChallenge.name}</p>
                  <p className="text-gray-500 text-sm">{challengeTypeInfo[victoryChallenge.challenge_type]?.name}</p>
                </div>

                {/* XP won display */}
                {victoryChallenge.participants.find(p => p.business_id === currentBusiness?.id)?.xp_won ? (
                  <div className="mb-6">
                    <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl border border-green-500/30">
                      <Zap className="w-6 h-6 text-green-400 animate-pulse" />
                      <span className="text-2xl font-bold text-green-400">
                        +{victoryChallenge.participants.find(p => p.business_id === currentBusiness?.id)?.xp_won} XP
                      </span>
                    </div>
                  </div>
                ) : null}

                {/* Close button */}
                <button
                  onClick={() => {
                    setShowVictoryModal(false);
                    setVictoryChallenge(null);
                  }}
                  className="w-full px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-yellow-500/25 transform hover:scale-105"
                >
                  Claim Your Glory
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom CSS animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-5deg); }
        }
        @keyframes ping-slow {
          0% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(1); opacity: 0.5; }
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes victory-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.3), 0 0 40px rgba(34, 197, 94, 0.2); }
          50% { box-shadow: 0 0 30px rgba(34, 197, 94, 0.5), 0 0 60px rgba(34, 197, 94, 0.3); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 7s ease-in-out infinite 1s; }
        .animate-ping-slow { animation: ping-slow 2s ease-in-out infinite; }
        .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
        .animate-shimmer {
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
        }
        .animate-victory-glow { animation: victory-glow 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

// Challenge Card Component
function ChallengeCard({
  challenge,
  currentBusinessId,
  onAccept,
  onDecline,
  onCancel,
  onCopyCode,
  copiedCode,
  isInvitation,
  isPending,
  isCompleted,
}: {
  challenge: Challenge;
  currentBusinessId?: number;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
  onCopyCode?: (code: string) => void;
  copiedCode?: string | null;
  isInvitation?: boolean;
  isPending?: boolean;
  isCompleted?: boolean;
}) {
  const typeInfo = challengeTypeInfo[challenge.challenge_type] || { name: challenge.challenge_type, icon: Target, color: 'text-gray-400' };
  const TypeIcon = typeInfo.icon;

  const you = challenge.participants.find(p => p.business_id === currentBusinessId);
  const opponent = challenge.participants.find(p => p.business_id !== currentBusinessId);

  const isWinner = isCompleted && challenge.winner_id === currentBusinessId;
  const isLoser = isCompleted && challenge.winner_id && challenge.winner_id !== currentBusinessId;

  return (
    <div className={`relative rounded-xl border overflow-hidden transition-all duration-300 ${
      isWinner ? 'border-green-500/50 bg-gradient-to-r from-green-500/10 via-emerald-500/5 to-green-500/10 animate-victory-glow' :
      isLoser ? 'border-red-500/30 bg-red-500/5' :
      isInvitation ? 'border-red-500/50 animate-pulse bg-[#1a1d24]' :
      'border-white/10 bg-[#1a1d24]'
    }`}>
      {/* Victory sparkle overlay */}
      {isWinner && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-2 left-4 w-2 h-2 bg-yellow-400 rounded-full animate-ping opacity-75" />
          <div className="absolute top-4 right-8 w-1.5 h-1.5 bg-green-400 rounded-full animate-ping opacity-75 animation-delay-500" />
          <div className="absolute bottom-3 left-12 w-1 h-1 bg-yellow-300 rounded-full animate-ping opacity-75 animation-delay-1000" />
        </div>
      )}

      <div className="p-4 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
              isWinner ? 'bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg shadow-yellow-500/30' :
              'bg-white/5'
            } ${typeInfo.color}`}>
              {isWinner ? (
                <Trophy className="w-5 h-5 text-white" />
              ) : (
                <TypeIcon className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-white">{challenge.name}</h3>
              <p className="text-xs text-gray-500">{typeInfo.name} · {durationLabels[challenge.duration]}</p>
            </div>
          </div>
          <div className="text-right">
            {isCompleted ? (
              <div className={`text-sm font-bold flex items-center gap-1 ${
                isWinner ? 'text-green-400' : isLoser ? 'text-red-400' : 'text-gray-400'
              }`}>
                {isWinner && <Crown className="w-4 h-4 text-yellow-400 animate-bounce" />}
                <span className={isWinner ? 'animate-pulse' : ''}>
                  {isWinner ? 'VICTORY!' : isLoser ? 'DEFEAT' : 'DRAW'}
                </span>
              </div>
            ) : challenge.time_remaining ? (
              <div className="flex items-center gap-1 text-orange-400">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">{challenge.time_remaining}</span>
              </div>
            ) : null}
            {challenge.xp_wager > 0 && (
              <div className="text-xs text-purple-400 flex items-center gap-1 justify-end mt-1">
                <Zap className="w-3 h-3" />
                {challenge.xp_wager} XP wagered
              </div>
            )}
          </div>
        </div>

        {/* Progress bars for active challenges */}
        {challenge.status === 'active' && you && opponent && (
          <div className="space-y-2 mb-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-cyan-400 font-medium">
                  {you.business_emoji} You {you.handicap_percent > 0 && `(+${you.handicap_percent}%)`}
                </span>
                <span className="text-white">{you.adjusted_progress}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (you.adjusted_progress / Math.max(opponent.adjusted_progress, you.adjusted_progress, 1)) * 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-red-400 font-medium">
                  {opponent.business_emoji} {opponent.business_name} {opponent.handicap_percent > 0 && `(+${opponent.handicap_percent}%)`}
                </span>
                <span className="text-white">{opponent.adjusted_progress}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (opponent.adjusted_progress / Math.max(opponent.adjusted_progress, you.adjusted_progress, 1)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Completed results */}
        {isCompleted && you && (
          <div className={`flex items-center gap-4 text-sm mb-3 ${isWinner ? 'py-2 px-3 bg-green-500/10 rounded-lg border border-green-500/20' : ''}`}>
            {you.xp_won > 0 && (
              <span className="text-green-400 flex items-center gap-1 font-semibold">
                <TrendingUp className={`w-4 h-4 ${isWinner ? 'animate-bounce' : ''}`} />
                +{you.xp_won} XP won
                {isWinner && <Sparkles className="w-4 h-4 text-yellow-400" />}
              </span>
            )}
            {you.xp_lost > 0 && (
              <span className="text-red-400 flex items-center gap-1">
                -{you.xp_lost} XP lost
              </span>
            )}
          </div>
        )}

        {/* Invite code for pending */}
        {isPending && onCopyCode && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-400">Share code:</span>
            <button
              onClick={() => onCopyCode(challenge.invite_code)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <span className="font-mono text-cyan-400 tracking-widest">{challenge.invite_code}</span>
              {copiedCode === challenge.invite_code ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {isInvitation && onAccept && onDecline && (
            <>
              <button
                onClick={onAccept}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg font-medium transition-all"
              >
                Accept Challenge
              </button>
              <button
                onClick={onDecline}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors"
              >
                Decline
              </button>
            </>
          )}
          {isPending && onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors"
            >
              Cancel Challenge
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
