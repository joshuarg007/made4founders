import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  Calendar,
  Clock,
  CheckCircle2,
  ChevronRight,
  Mail,
  Phone,
  FileText,
  RefreshCw,
  Sparkles,
  User,
} from 'lucide-react';
import {
  getDailyBrief,
  completeDeadlineAction,
  recordContactTouch,
} from '../lib/api';
import type { DailyBrief as DailyBriefType, DailyBriefItem } from '../lib/api';

export default function DailyBrief() {
  const [brief, setBrief] = useState<DailyBriefType | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<number | null>(null);

  const loadBrief = async () => {
    setLoading(true);
    try {
      const data = await getDailyBrief();
      setBrief(data);
    } catch (err) {
      console.error('Failed to load daily brief:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBrief();
  }, []);

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

    return (
      <div className="flex items-center justify-between p-4 rounded-xl bg-[#1a1d24] border border-white/10 hover:border-white/20 transition group">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isDeadline ? 'bg-violet-500/20 text-violet-400' :
            isDocument ? 'bg-amber-500/20 text-amber-400' :
            'bg-cyan-500/20 text-cyan-400'
          }`}>
            {isDeadline ? <Calendar className="w-5 h-5" /> :
             isDocument ? <FileText className="w-5 h-5" /> :
             <User className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="font-medium text-white">{item.title || item.name}</h4>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {item.deadline_type && (
                <span className="capitalize">{item.deadline_type}</span>
              )}
              {item.category && (
                <span className="capitalize">{item.category}</span>
              )}
              {(item.due_date || item.expiration_date) && (
                <>
                  <span>•</span>
                  <span>{formatDueDate(item)}</span>
                </>
              )}
              {item.company && (
                <span>at {item.company}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {item.days_until !== undefined && (
            <span className={`text-sm font-medium ${
              item.days_until < 0 ? 'text-red-400' :
              item.days_until === 0 ? 'text-amber-400' :
              item.days_until <= 3 ? 'text-yellow-400' :
              'text-gray-500'
            }`}>
              {getUrgencyLabel(item.days_until)}
            </span>
          )}
          {isDeadline && onComplete && (
            <button
              onClick={onComplete}
              disabled={completing === item.id}
              className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition font-medium text-sm disabled:opacity-50"
            >
              {completing === item.id ? 'Completing...' : 'Done'}
            </button>
          )}
          {!isDeadline && (
            <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition" />
          )}
        </div>
      </div>
    );
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

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            {getGreeting()}{brief.company_name ? `, ${brief.company_name}` : ''}.
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

      {/* All Clear State */}
      {hasNothing && (
        <div className="text-center py-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
          <Sparkles className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">You're all caught up!</h2>
          <p className="text-gray-400">No urgent items. Focus on building.</p>
        </div>
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
                onComplete={item.type === 'deadline' ? () => handleCompleteDeadline(item.id) : undefined}
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
                onComplete={item.type === 'deadline' ? () => handleCompleteDeadline(item.id) : undefined}
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
                onComplete={item.type === 'deadline' ? () => handleCompleteDeadline(item.id) : undefined}
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
