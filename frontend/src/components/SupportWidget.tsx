import { useState } from 'react';
import {
  HelpCircle,
  X,
  Send,
  Loader2,
  MessageCircle,
  Book,
  Mail,
  ExternalLink,
  CheckCircle,
} from 'lucide-react';

interface SupportWidgetProps {
  userEmail?: string;
  userName?: string;
}

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:8001'}/api`;

export default function SupportWidget({ userEmail, userName }: SupportWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'contact' | 'success'>('menu');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/support/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          email: userEmail,
          name: userName,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to send message');
      }

      setView('success');
      setSubject('');
      setMessage('');
    } catch (err) {
      setError('Failed to send message. Please try again or email support@made4founders.com directly.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setView('menu');
      setError(null);
    }, 300);
  };

  const faqs = [
    {
      q: 'How do I add team members?',
      a: 'Go to Settings > User Management (admin only) to invite team members.',
    },
    {
      q: 'How do I export my data?',
      a: 'Go to Settings > Data & Privacy and click "Export Data" to download all your data.',
    },
    {
      q: 'How do I set up two-factor authentication?',
      a: 'Go to Settings > Two-Factor Authentication and follow the setup instructions.',
    },
    {
      q: 'How do I cancel my subscription?',
      a: 'Go to Settings > Subscription and click "Manage Subscription" to access the billing portal.',
    },
  ];

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group"
        title="Help & Support"
      >
        <HelpCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Widget */}
          <div className="relative w-full max-w-md bg-[#1a1d24] rounded-2xl shadow-2xl border border-white/10 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-cyan-500/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Help & Support</h3>
                  <p className="text-xs text-gray-400">We're here to help!</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              {view === 'menu' && (
                <div className="space-y-4">
                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setView('contact')}
                      className="p-4 rounded-xl bg-[#0f1117] border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition text-left group"
                    >
                      <Mail className="w-6 h-6 text-cyan-400 mb-2 group-hover:scale-110 transition-transform" />
                      <div className="font-medium text-white text-sm">Contact Us</div>
                      <div className="text-xs text-gray-500">Send a message</div>
                    </button>
                    <a
                      href="https://made4founders.com/docs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-4 rounded-xl bg-[#0f1117] border border-white/10 hover:border-purple-500/30 hover:bg-purple-500/5 transition text-left group"
                    >
                      <Book className="w-6 h-6 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                      <div className="font-medium text-white text-sm">Documentation</div>
                      <div className="text-xs text-gray-500">Learn more</div>
                    </a>
                  </div>

                  {/* FAQs */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Frequently Asked</h4>
                    <div className="space-y-2">
                      {faqs.map((faq, i) => (
                        <details key={i} className="group">
                          <summary className="flex items-center justify-between p-3 rounded-lg bg-[#0f1117] border border-white/5 cursor-pointer hover:bg-white/5 transition list-none">
                            <span className="text-sm text-white pr-4">{faq.q}</span>
                            <span className="text-gray-500 group-open:rotate-180 transition-transform">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </span>
                          </summary>
                          <div className="mt-2 px-3 pb-3 text-sm text-gray-400">
                            {faq.a}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>

                  {/* Direct Email */}
                  <div className="pt-2 border-t border-white/10">
                    <a
                      href="mailto:support@made4founders.com"
                      className="flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-cyan-400 transition"
                    >
                      <Mail className="w-4 h-4" />
                      support@made4founders.com
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {view === 'contact' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setView('menu')}
                    className="text-sm text-gray-400 hover:text-white transition flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>

                  {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Subject</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="What can we help with?"
                      className="w-full px-4 py-3 bg-[#0f1117] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Message</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe your issue or question..."
                      rows={4}
                      className="w-full px-4 py-3 bg-[#0f1117] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 resize-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Send Message
                      </>
                    )}
                  </button>
                </form>
              )}

              {view === 'success' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-white mb-2">Message Sent!</h4>
                  <p className="text-gray-400 text-sm mb-6">
                    We'll get back to you within 24 hours.
                  </p>
                  <button
                    onClick={handleClose}
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
