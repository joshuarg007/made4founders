import { useState } from 'react';
import { Mail, MessageSquare, Building2, Send, CheckCircle, AlertCircle } from 'lucide-react';
import SEO from '../../components/SEO';
import { validators, validationMessages } from '../../lib/validation';

// Site2CRM Integration
const SITE2CRM_API = "https://api.site2crm.io/api/public/leads";
const SITE2CRM_ORG_KEY = "org_jUITQNG0ZcPF_KJ0vplRQV8rwWk0pvR9";

interface FormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  subject: string;
  message: string;
}

export default function Contact() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    company: '',
    subject: 'general',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const validateEmail = (value: string): boolean => {
    if (!value || !validators.email(value)) {
      setEmailError(validationMessages.email);
      return false;
    }
    setEmailError(null);
    return true;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (e.target.name === 'email' && emailError) {
      validateEmail(e.target.value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (!validateEmail(formData.email)) {
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name || null,
          email: formData.email,
          phone: formData.phone || null,
          company: formData.company || null,
          subject: formData.subject,
          message: formData.message || null,
          source: 'contact_page',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          throw new Error(data.detail?.message || 'Too many requests. Please try again later.');
        }
        throw new Error(data.detail?.message || 'Failed to submit');
      }

      // Also push to Site2CRM for lead tracking
      try {
        await fetch(SITE2CRM_API, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Org-Key": SITE2CRM_ORG_KEY },
          body: JSON.stringify({
            name: formData.name || "(not provided)",
            email: formData.email,
            phone: formData.phone || undefined,
            company: formData.company || undefined,
            notes: `[${formData.subject}] ${formData.message || "(no message)"}`,
            source: "made4founders.com",
          }),
        });
      } catch {
        // Silent - don't fail the form if Site2CRM is down
      }

      setStatus({ type: 'success', message: "Thanks for reaching out! We'll get back to you within 24 hours." });
      setFormData({ name: '', email: '', phone: '', company: '', subject: 'general', message: '' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setStatus({ type: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-20 px-4 sm:px-6 lg:px-8">
      <SEO
        title="Contact Us - Made4Founders"
        description="Get in touch with the Made4Founders team. We're here to help with questions about our platform, enterprise inquiries, or partnership opportunities."
      />
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Get in Touch
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Have questions about Made4Founders? Looking for enterprise solutions?
            We'd love to hear from you.
          </p>
        </div>

        {/* Contact Options */}
        <div className="grid sm:grid-cols-3 gap-4 mb-12">
          <div className="p-6 rounded-xl bg-white/5 border border-white/10 text-center">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-white font-semibold mb-1">Email Us</h3>
            <a href="mailto:hello@made4founders.com" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm">
              hello@made4founders.com
            </a>
          </div>
          <div className="p-6 rounded-xl bg-white/5 border border-white/10 text-center">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-white font-semibold mb-1">Live Chat</h3>
            <p className="text-gray-400 text-sm">Available Mon-Fri 9am-6pm EST</p>
          </div>
          <div className="p-6 rounded-xl bg-white/5 border border-white/10 text-center">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-white font-semibold mb-1">Enterprise</h3>
            <a href="mailto:enterprise@made4founders.com" className="text-gray-400 hover:text-purple-400 transition-colors text-sm">
              enterprise@made4founders.com
            </a>
          </div>
        </div>

        {/* Contact Form */}
        {status?.type === 'success' ? (
          <div className="p-8 sm:p-12 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Message Sent!</h2>
              <p className="text-gray-400 mb-8">{status.message}</p>
              <button
                onClick={() => setStatus(null)}
                className="px-6 py-3 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
              >
                Send Another Message
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 sm:p-12 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10">
            <h2 className="text-2xl font-bold text-white mb-2">Send us a message</h2>
            <p className="text-gray-400 mb-8">Fill out the form below and we'll get back to you shortly.</p>

            {status?.type === 'error' && (
              <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {status.message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email <span className="text-cyan-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      onBlur={(e) => e.target.value && validateEmail(e.target.value)}
                      required
                      placeholder="you@company.com"
                      className={`w-full px-4 py-3 rounded-lg bg-white/5 border text-white placeholder-gray-500 focus:ring-2 focus:border-transparent transition-all ${
                        emailError
                          ? 'border-red-500/50 focus:ring-red-500'
                          : 'border-white/10 focus:ring-cyan-500'
                      }`}
                    />
                    {emailError && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                    )}
                  </div>
                  {emailError && (
                    <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {emailError}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Your name"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+1 (555) 123-4567"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="company" className="block text-sm font-medium text-gray-300 mb-2">
                    Company
                  </label>
                  <input
                    type="text"
                    id="company"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    placeholder="Your company name"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-300 mb-2">
                  Subject
                </label>
                <select
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                >
                  <option value="general" className="bg-gray-900">General Inquiry</option>
                  <option value="support" className="bg-gray-900">Support</option>
                  <option value="enterprise" className="bg-gray-900">Enterprise Sales</option>
                  <option value="partnership" className="bg-gray-900">Partnership</option>
                  <option value="feedback" className="bg-gray-900">Feedback</option>
                </select>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={5}
                  placeholder="How can we help you?"
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-8 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Message
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
