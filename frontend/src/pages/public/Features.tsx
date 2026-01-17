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

// Feature images
import checklistIcon from '../../assets/checklist-icon.webp';
import vaultIcon from '../../assets/vault-icon.webp';
import analyticsIcon from '../../assets/analytics-icon.webp';
import dashboardIcon from '../../assets/dashboard-icon.webp';
import documentsIcon from '../../assets/documents-icon.webp';
import marketingIcon from '../../assets/marketing-icon.webp';

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
        title: 'Brand Asset Manager',
        description: 'Store your logos, colors, fonts, and brand guidelines. Export brand kits for designers.',
      },
      {
        icon: Mail,
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
        title: 'Team Management',
        description: 'Invite team members with role-based access. Admin, editor, and viewer roles available.',
      },
      {
        icon: FileText,
        title: 'Document Templates',
        description: 'Ready-to-use templates for NDAs, operating agreements, board resolutions, and more.',
      },
    ],
  },
];

const integrations = [
  { name: 'Mailchimp', category: 'Email' },
  { name: 'Twitter/X', category: 'Social' },
  { name: 'LinkedIn', category: 'Social' },
  { name: 'Facebook', category: 'Social' },
  { name: 'Instagram', category: 'Social' },
  { name: 'Google Calendar', category: 'Calendar' },
  { name: 'Apple Calendar', category: 'Calendar' },
];

export default function Features() {
  return (
    <div className="py-20 px-4 sm:px-6 lg:px-8">
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

            <div className="grid md:grid-cols-2 gap-8">
              {category.features.map((feature) => (
                <div
                  key={feature.title}
                  className="group p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all hover:bg-white/[0.07]"
                >
                  {feature.image ? (
                    <div className="mb-6 -mx-2 -mt-2">
                      <img
                        src={feature.image}
                        alt={feature.title}
                        className="w-full h-40 object-cover rounded-xl opacity-90 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center mb-6">
                      <feature.icon className="w-6 h-6 text-cyan-400" />
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    {feature.image && (
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center">
                        <feature.icon className="w-4 h-4 text-cyan-400" />
                      </div>
                    )}
                    <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                  </div>
                  <p className="text-gray-400 leading-relaxed">{feature.description}</p>
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
                className="px-6 py-3 rounded-xl bg-white/5 border border-white/10"
              >
                <span className="text-white font-medium">{integration.name}</span>
                <span className="text-gray-500 text-sm ml-2">({integration.category})</span>
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
              <div className="w-48 h-48 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center">
                <Lock className="w-20 h-20 text-cyan-400" />
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-gray-400 mb-8">
            Start your 14-day free trial today. No credit card required.
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
