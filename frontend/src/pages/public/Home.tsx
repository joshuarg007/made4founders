import { Link } from 'react-router-dom';
import {
  Shield,
  BarChart3,
  FileText,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Building2,
  Lock,
  Globe,
} from 'lucide-react';
import SEO, { pageSEO } from '../../components/SEO';

// Marketing images
import heroImage from '../../assets/hero-section-holographic.webp';
import dashboardIcon from '../../assets/dashboard-icon.webp';
import checklistIcon from '../../assets/checklist-icon.webp';
import vaultIcon from '../../assets/vault-icon.webp';
import analyticsIcon from '../../assets/analytics-icon.webp';
import marketingIcon from '../../assets/marketing-icon.webp';
import documentsIcon from '../../assets/documents-icon.webp';
import trustSection from '../../assets/about-trust-section.webp';

const features = [
  {
    icon: Building2,
    image: dashboardIcon,
    title: 'Founder Dashboard',
    description: 'One dashboard to track compliance, deadlines, documents, and metrics.',
  },
  {
    icon: CheckCircle,
    image: checklistIcon,
    title: 'Smart Checklist',
    description: '98 compliance items across 11 categories. Never miss a filing deadline.',
  },
  {
    icon: Lock,
    image: vaultIcon,
    title: 'Encrypted Vault',
    description: 'Bank-level AES-256 encryption for your sensitive credentials.',
  },
  {
    icon: BarChart3,
    image: analyticsIcon,
    title: 'Metrics Dashboard',
    description: 'Track MRR, ARR, runway, CAC, LTV, and custom KPIs over time.',
  },
  {
    icon: Globe,
    image: marketingIcon,
    title: 'Marketing Suite',
    description: 'Create branded emails and social posts. Connect Mailchimp, Twitter, LinkedIn.',
  },
  {
    icon: FileText,
    image: documentsIcon,
    title: 'Document Templates',
    description: 'NDAs, operating agreements, board resolutions ready to customize.',
  },
];

const stats = [
  { value: '10,000+', label: 'Startups Organized' },
  { value: '98', label: 'Compliance Items' },
  { value: '99.9%', label: 'Uptime' },
  { value: '256-bit', label: 'Encryption' },
];

const testimonials = [
  {
    quote: "Made4Founders replaced 5 different tools for us. Everything is finally in one place.",
    author: "Sarah Chen",
    role: "Founder & CEO",
    company: "TechVenture Inc",
  },
  {
    quote: "The compliance checklist alone saved me from a $10,000 penalty. Worth every penny.",
    author: "Marcus Johnson",
    role: "Co-founder",
    company: "DataFlow Labs",
  },
  {
    quote: "My investor updates take 5 minutes now instead of 2 hours. Game changer.",
    author: "Emily Rodriguez",
    role: "CEO",
    company: "GreenPath Solutions",
  },
];

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      <SEO {...pageSEO.home} />
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-4 sm:px-6 lg:px-8">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
          <div className="absolute top-20 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        </div>

        <div className="relative max-w-7xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-gray-300">14-day free trial. Cancel anytime.</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white leading-tight mb-6">
            Built by Founders
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 text-transparent bg-clip-text">
              For Founders
            </span>
          </h1>

          {/* Subheadline */}
          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-gray-400 mb-10">
            Bank-grade security. Tools that grow revenue. Gamification that makes work fun.
            Everything you need to run your startup — built by people who've been there.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              to="/signup"
              className="group w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 flex items-center justify-center gap-2"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/features"
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold text-gray-300 hover:text-white border border-white/20 rounded-xl hover:border-white/40 hover:bg-white/5 transition-all text-center"
            >
              See Features
            </Link>
          </div>

          {/* Social proof */}
          <div className="mt-12 sm:mt-16 flex flex-col sm:flex-row flex-wrap justify-center items-center gap-4 sm:gap-8 text-sm text-gray-400">
            <span>Trusted by founders at</span>
            <div className="flex items-center gap-4 sm:gap-8 opacity-60">
              <span className="font-semibold text-gray-400">YC</span>
              <span className="font-semibold text-gray-400">Techstars</span>
              <span className="font-semibold text-gray-400 hidden xs:inline">500 Startups</span>
              <span className="font-semibold text-gray-400 hidden sm:inline">Sequoia</span>
            </div>
          </div>

          {/* Hero Image */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d14] via-transparent to-transparent z-10" />
            <img
              src={heroImage}
              alt="Made4Founders Dashboard - Comprehensive startup management platform"
              className="w-full max-w-4xl mx-auto rounded-2xl shadow-2xl shadow-cyan-500/10 border border-white/10"
              width={900}
              height={600}
              fetchPriority="high"
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 sm:py-16 border-y border-white/5 bg-[#0c0f16]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything You Need to Run Your Startup
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Built by founders, for founders. We've condensed years of startup ops experience into one platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group p-8 rounded-2xl bg-gradient-to-b from-white/5 to-transparent border border-white/5 hover:border-white/10 transition-all"
              >
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 flex items-center justify-center mb-6 group-hover:from-cyan-500/20 group-hover:to-blue-600/20 transition-colors overflow-hidden">
                  <img src={feature.image} alt={feature.title} className="w-14 h-14 object-contain" loading="lazy" width={56} height={56} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0c0f16]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Founders Love Made4Founders
            </h2>
            <p className="text-lg text-gray-400">
              Join thousands of founders who've simplified their operations.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.author}
                className="p-8 rounded-2xl bg-white/5 border border-white/5"
              >
                <p className="text-lg text-gray-300 mb-6">"{testimonial.quote}"</p>
                <div>
                  <div className="font-semibold text-white">{testimonial.author}</div>
                  <div className="text-sm text-gray-400">
                    {testimonial.role}, {testimonial.company}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
                Bank-Level Security
              </h2>
              <p className="text-lg text-gray-400 mb-8">
                Your data is encrypted with AES-256-GCM, the same encryption used by banks and governments.
                We never see your credentials or sensitive information.
              </p>
              <ul className="space-y-4">
                {[
                  'AES-256-GCM encryption at rest',
                  'TLS 1.3 encryption in transit',
                  'SOC 2 Type II compliant infrastructure',
                  'GDPR and CCPA compliant',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-gray-300">
                    <Shield className="w-5 h-5 text-green-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1">
              <div className="rounded-2xl overflow-hidden border border-white/10">
                <img
                  src={trustSection}
                  alt="Bank-level security - AES-256 encryption protects your data"
                  className="w-full h-auto"
                  width={900}
                  height={600}
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to Take Control?
          </h2>
          <p className="text-lg text-gray-400 mb-10">
            Start your 14-day free trial. No charge until day 15.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40"
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
