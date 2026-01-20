import { Link } from 'react-router-dom';
import {
  CheckCircle,
  Shield,
  BarChart3,
  FileText,
  Calendar,
  Users,
  Globe,
  Zap,
  Lock,
  Mail,
  Share2,
  ArrowRight,
  Building2,
  CreditCard,
  ListChecks,
  Palette,
} from 'lucide-react';
import SEO, { pageSEO } from '../../components/SEO';
import {
  SiMailchimp,
  SiX,
  SiLinkedin,
  SiFacebook,
  SiInstagram,
  SiGooglecalendar,
  SiApple,
  SiQuickbooks,
  SiXero,
  SiZoho,
} from 'react-icons/si';
import { FreshBooksIcon } from '../../components/BrandIcons';

// Feature images
import checklistIcon from '../../assets/checklist-icon.webp';
import deadlineIcon from '../../assets/deadline-icon.webp';
import documentsIcon from '../../assets/documents-icon.webp';
import contactsIcon from '../../assets/contacts-icon.webp';
import vaultIcon from '../../assets/vault-icon.webp';
import bankingIcon from '../../assets/banking-icon.webp';
import analyticsIcon from '../../assets/analytics-icon.webp';
import identifiersIcon from '../../assets/identifiers-icon.webp';
import brandingIcon from '../../assets/branding-icon.webp';
import emailIcon from '../../assets/email-icon.webp';
import marketingIcon from '../../assets/marketing-icon.webp';
import webpresenceIcon from '../../assets/webpresence-icon.webp';
import tasksIcon from '../../assets/tasks-icon.webp';
import dashboardIcon from '../../assets/dashboard-icon.webp';
import teamIcon from '../../assets/team-icon.webp';
import templatesIcon from '../../assets/templates-icon.webp';
import securityIcon from '../../assets/security-icon.webp';

const featureCategories = [
  {
    title: 'Operations',
    description: 'Everything you need to run your business day-to-day.',
    features: [
      {
        icon: ListChecks,
        image: checklistIcon,
        title: 'Smart Compliance Checklist',
        description: '98 items across 11 categories including entity formation, federal requirements, government contracting, state & local, corporate governance, banking, and more. Never miss a deadline.',
      },
      {
        icon: Calendar,
        image: deadlineIcon,
        title: 'Deadline Tracker',
        description: 'Track all your important dates with smart reminders. Integrates with your calendar via iCal feed.',
      },
      {
        icon: FileText,
        image: documentsIcon,
        title: 'Document Management',
        description: 'Secure document storage with categories, tags, and expiration tracking. Download-only access with path traversal protection.',
      },
      {
        icon: Users,
        image: contactsIcon,
        title: 'Contact Manager',
        description: 'Keep track of lawyers, accountants, investors, vendors, and advisors. Track when you last contacted them.',
      },
    ],
  },
  {
    title: 'Finance & Security',
    description: 'Bank-level security for your sensitive business data.',
    features: [
      {
        icon: Lock,
        image: vaultIcon,
        title: 'Encrypted Credential Vault',
        description: 'AES-256-GCM encryption with Argon2id key derivation. Your master password never leaves your device.',
      },
      {
        icon: CreditCard,
        image: bankingIcon,
        title: 'Banking Dashboard',
        description: 'Track all your bank accounts, payment processors, and financial services in one place.',
      },
      {
        icon: BarChart3,
        image: analyticsIcon,
        title: 'Business Metrics',
        description: 'Track MRR, ARR, runway, burn rate, CAC, LTV, churn, NPS, and custom KPIs over time with trend analysis.',
      },
      {
        icon: Building2,
        image: identifiersIcon,
        title: 'Business Identifiers',
        description: 'Securely store your EIN, DUNS, state IDs, and other business identifiers with encryption.',
      },
    ],
  },
  {
    title: 'Marketing & Branding',
    description: 'Create and manage your brand presence.',
    features: [
      {
        icon: Palette,
        image: brandingIcon,
        title: 'Brand Asset Manager',
        description: 'Store your logos, colors, fonts, and brand guidelines. Export brand kits for designers.',
      },
      {
        icon: Mail,
        image: emailIcon,
        title: 'Email Marketing',
        description: 'Create beautiful email templates. Connect Mailchimp for campaigns with full analytics.',
      },
      {
        icon: Share2,
        image: marketingIcon,
        title: 'Social Media Publishing',
        description: 'Create posts optimized for each platform. Connect Twitter, LinkedIn, Facebook, and Instagram.',
      },
      {
        icon: Globe,
        image: webpresenceIcon,
        title: 'Web Presence Tracker',
        description: 'Track your domains, SSL certificates, social profiles, and business listings.',
      },
    ],
  },
  {
    title: 'Productivity',
    description: 'Tools to keep you and your team organized.',
    features: [
      {
        icon: CheckCircle,
        image: tasksIcon,
        title: 'Task Management',
        description: 'Kanban boards with time tracking, comments, and deadline integration. Assign tasks to team members.',
      },
      {
        icon: Zap,
        image: dashboardIcon,
        title: 'Daily Brief',
        description: 'Start each day with a personalized dashboard showing overdue items, tasks, and priorities.',
      },
      {
        icon: Users,
        image: teamIcon,
        title: 'Team Management',
        description: 'Invite team members with role-based access. Admin, editor, and viewer roles available.',
      },
      {
        icon: FileText,
        image: templatesIcon,
        title: 'Document Templates',
        description: 'Ready-to-use templates for NDAs, operating agreements, board resolutions, and more.',
      },
    ],
  },
];

const integrations = [
  { name: 'Mailchimp', category: 'Email', icon: SiMailchimp, color: '#FFE01B' },
  { name: 'X / Twitter', category: 'Social', icon: SiX, color: '#FFFFFF' },
  { name: 'LinkedIn', category: 'Social', icon: SiLinkedin, color: '#0A66C2' },
  { name: 'Facebook', category: 'Social', icon: SiFacebook, color: '#1877F2' },
  { name: 'Instagram', category: 'Social', icon: SiInstagram, color: '#E4405F' },
  { name: 'Google Calendar', category: 'Calendar', icon: SiGooglecalendar, color: '#4285F4' },
  { name: 'Apple Calendar', category: 'Calendar', icon: SiApple, color: '#FFFFFF' },
  { name: 'QuickBooks', category: 'Accounting', icon: SiQuickbooks, color: '#2CA01C' },
  { name: 'Xero', category: 'Accounting', icon: SiXero, color: '#13B5EA' },
  { name: 'FreshBooks', category: 'Accounting', icon: FreshBooksIcon, color: '#0075DD' },
  { name: 'Zoho Books', category: 'Accounting', icon: SiZoho, color: '#C8202B' },
];

export default function Features() {
  return (
    <div className="py-20 px-4 sm:px-6 lg:px-8">
      <SEO {...pageSEO.features} />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-20">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Everything You Need to
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 text-transparent bg-clip-text">
              Run Your Startup
            </span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Made4Founders combines compliance tracking, document management, marketing tools,
            and business metrics into one powerful platform.
          </p>
        </div>

        {/* Feature Categories */}
        {featureCategories.map((category) => (
          <section key={category.title} className="mb-24">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                {category.title}
              </h2>
              <p className="text-gray-400">{category.description}</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {category.features.map((feature) => (
                <div
                  key={feature.title}
                  className="group rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all hover:bg-white/[0.07] overflow-hidden"
                >
                  <div className="h-36 bg-gradient-to-br from-slate-800/50 to-slate-900/50 flex items-center justify-center p-3">
                    <img
                      src={feature.image}
                      alt={`${feature.title} - Made4Founders feature`}
                      loading="lazy"
                      decoding="async"
                      width={450}
                      height={320}
                      className="max-h-full max-w-full object-contain opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-base font-semibold text-white mb-2">{feature.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Integrations */}
        <section className="mb-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Integrations
            </h2>
            <p className="text-gray-400">Connect with your favorite tools</p>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            {integrations.map((integration) => (
              <div
                key={integration.name}
                className="group flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] hover:from-white/[0.12] hover:to-white/[0.05] transition-all cursor-default"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${integration.color}15` }}
                >
                  <integration.icon className="w-5 h-5" style={{ color: integration.color }} />
                </div>
                <span className="text-white font-medium">{integration.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Security */}
        <section className="mb-24 p-8 sm:p-12 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border border-white/10">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                Enterprise-Grade Security
              </h2>
              <p className="text-gray-400 mb-6">
                Your data security is our top priority. We use the same encryption
                standards trusted by banks and governments worldwide.
              </p>
              <ul className="space-y-3">
                {[
                  'AES-256-GCM encryption at rest',
                  'Argon2id key derivation',
                  'TLS 1.3 in transit',
                  'SOC 2 Type II infrastructure',
                  'GDPR compliant',
                  'Regular security audits',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-gray-300">
                    <Shield className="w-5 h-5 text-green-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-shrink-0">
              <img
                src={securityIcon}
                alt="Enterprise-grade security - Made4Founders"
                loading="lazy"
                className="w-72 h-auto"
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-gray-400 mb-8">
            Start your 14-day free trial today. No charge until day 15.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/25"
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5" />
          </Link>
        </section>
      </div>
    </div>
  );
}
