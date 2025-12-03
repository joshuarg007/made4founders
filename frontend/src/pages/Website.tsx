import { Link } from 'react-router-dom';
import {
  Globe,
  Mail,
  Monitor,
  Share2,
  MapPin,
  ExternalLink,
  CheckCircle2,
  Circle,
  ArrowRight,
  ClipboardCheck
} from 'lucide-react';

const webPresenceItems = [
  {
    id: 'domain',
    title: 'Domain Name',
    description: 'Your business address on the internet',
    icon: Globe,
    color: 'cyan',
    resources: [
      { label: 'Namecheap', url: 'https://www.namecheap.com/' },
      { label: 'Cloudflare', url: 'https://www.cloudflare.com/products/registrar/' },
      { label: 'Google Domains', url: 'https://domains.google/' }
    ]
  },
  {
    id: 'email',
    title: 'Professional Email',
    description: 'you@yourcompany.com for credibility',
    icon: Mail,
    color: 'violet',
    resources: [
      { label: 'Google Workspace', url: 'https://workspace.google.com/' },
      { label: 'Microsoft 365', url: 'https://www.microsoft.com/en-us/microsoft-365/business' },
      { label: 'Zoho Mail', url: 'https://www.zoho.com/mail/' }
    ]
  },
  {
    id: 'website',
    title: 'Website',
    description: 'Your digital storefront and brand hub',
    icon: Monitor,
    color: 'pink',
    resources: [
      { label: 'Webflow', url: 'https://webflow.com/' },
      { label: 'Framer', url: 'https://www.framer.com/' },
      { label: 'Squarespace', url: 'https://www.squarespace.com/' },
      { label: 'Carrd', url: 'https://carrd.co/' }
    ]
  },
  {
    id: 'social',
    title: 'Social Media',
    description: 'Connect with your audience',
    icon: Share2,
    color: 'blue',
    resources: [
      { label: 'LinkedIn Pages', url: 'https://www.linkedin.com/company/setup/new/' },
      { label: 'Twitter/X', url: 'https://twitter.com/' },
      { label: 'Namechk', url: 'https://namechk.com/' }
    ]
  },
  {
    id: 'google',
    title: 'Google Business',
    description: 'Local search visibility',
    icon: MapPin,
    color: 'emerald',
    resources: [
      { label: 'Google Business Profile', url: 'https://www.google.com/business/' }
    ]
  }
];

const quickLinks = [
  { label: 'Domain Search', url: 'https://www.namecheap.com/domains/', desc: 'Find available domains' },
  { label: 'SSL Checker', url: 'https://www.sslshopper.com/ssl-checker.html', desc: 'Verify SSL certificate' },
  { label: 'PageSpeed', url: 'https://pagespeed.web.dev/', desc: 'Test website speed' },
  { label: 'DNS Checker', url: 'https://dnschecker.org/', desc: 'Check DNS propagation' },
  { label: 'DMARC Check', url: 'https://mxtoolbox.com/dmarc.aspx', desc: 'Email deliverability' },
  { label: 'Accessibility', url: 'https://wave.webaim.org/', desc: 'Test accessibility' }
];

export default function Website() {
  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Web Presence</h1>
        <p className="text-gray-400 mt-1">Establish and manage your online presence</p>
      </div>

      {/* Link to Getting Started */}
      <Link
        to="/getting-started"
        className="block bg-gradient-to-r from-pink-500/10 to-violet-500/10 border border-pink-500/20 rounded-xl p-4 hover:border-pink-500/40 transition group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-6 h-6 text-pink-400" />
            <div>
              <h3 className="font-semibold text-white">Web Presence Checklist</h3>
              <p className="text-sm text-gray-400">Track your progress in Getting Started</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-white group-hover:translate-x-1 transition" />
        </div>
      </Link>

      {/* Web Presence Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {webPresenceItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="bg-[#1a1d24] rounded-xl border border-white/10 p-5 hover:border-white/20 transition"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg bg-${item.color}-500/20 flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 text-${item.color}-400`} />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{item.title}</h3>
                  <p className="text-sm text-gray-400">{item.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.resources.map((resource, i) => (
                  <a
                    key={i}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-xs text-cyan-400 hover:bg-white/10 transition"
                  >
                    {resource.label}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Best Practices */}
      <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Web Presence Best Practices</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-cyan-400">Domain & Email</h3>
            <ul className="space-y-2">
              {[
                'Register .com first, protect key variations',
                'Enable auto-renewal to avoid losing domain',
                'Use domain privacy protection',
                'Set up SPF, DKIM, DMARC for email'
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-pink-400">Website & Social</h3>
            <ul className="space-y-2">
              {[
                'Mobile-first design is essential',
                'Add SSL certificate (HTTPS)',
                'Use consistent branding across platforms',
                'Claim handles even if not active yet'
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Quick Tools */}
      <div className="bg-[#1a1d24] rounded-xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Tools</h2>
        <div className="grid md:grid-cols-3 gap-3">
          {quickLinks.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition group"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-white font-medium">{link.label}</span>
                <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-gray-300" />
              </div>
              <p className="text-xs text-gray-500 mt-1">{link.desc}</p>
            </a>
          ))}
        </div>
      </div>

      {/* Info Note */}
      <div className="text-center text-xs text-gray-500 py-4">
        <p>Track your web presence setup progress in the <Link to="/getting-started" className="text-cyan-400 hover:underline">Getting Started</Link> checklist.</p>
      </div>
    </div>
  );
}
