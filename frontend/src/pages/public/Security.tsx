import { Shield, Lock, Key, Server, Eye, AlertTriangle, CheckCircle, Mail, FileCheck } from 'lucide-react';
import SEO, { pageSEO } from '../../components/SEO';

export default function Security() {
  const securityFeatures = [
    {
      icon: Lock,
      title: 'AES-256-GCM Encryption',
      description: 'All sensitive data is encrypted at rest using military-grade AES-256-GCM encryption. Your credentials and business identifiers are protected with state-of-the-art cryptographic standards.',
      color: 'cyan',
    },
    {
      icon: Key,
      title: 'Argon2id Key Derivation',
      description: 'Vault master passwords are processed using Argon2id, the winner of the Password Hashing Competition. This makes brute-force attacks computationally infeasible.',
      color: 'blue',
    },
    {
      icon: Shield,
      title: 'JWT Authentication',
      description: 'We use HS512 signed JSON Web Tokens with short expiration times (15 minutes). Refresh tokens are rotated regularly to prevent session hijacking.',
      color: 'purple',
    },
    {
      icon: Server,
      title: 'TLS 1.3 Transport Security',
      description: 'All data in transit is protected using TLS 1.3 encryption. We enforce HTTPS across our entire platform with HSTS headers.',
      color: 'green',
    },
    {
      icon: Eye,
      title: 'Security Headers',
      description: 'We implement comprehensive security headers including Content Security Policy (CSP), X-Frame-Options, X-Content-Type-Options, and Referrer-Policy.',
      color: 'orange',
    },
    {
      icon: AlertTriangle,
      title: 'Rate Limiting',
      description: 'Authentication endpoints are protected with strict rate limiting (5 requests/minute) to prevent brute-force attacks. General API endpoints have reasonable limits to ensure service availability.',
      color: 'red',
    },
  ];

  const practices = [
    {
      title: 'Regular Security Audits',
      description: 'We conduct regular security assessments and penetration testing to identify and address potential vulnerabilities.',
    },
    {
      title: 'Secure Development',
      description: 'Our development team follows secure coding practices and conducts code reviews for all changes.',
    },
    {
      title: 'Dependency Monitoring',
      description: 'We continuously monitor our dependencies for known vulnerabilities and apply patches promptly.',
    },
    {
      title: 'Incident Response',
      description: 'We have a documented incident response plan to quickly address and communicate any security incidents.',
    },
    {
      title: 'Access Logging',
      description: 'All sensitive operations are logged for audit purposes, helping us detect and investigate suspicious activity.',
    },
    {
      title: 'Data Backup',
      description: 'Your data is regularly backed up with encrypted backups stored in secure, geographically distributed locations.',
    },
  ];

  const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
    cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400' },
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' },
    green: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' },
    orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
  };

  return (
    <div className="min-h-screen bg-[#0a0d14]">
      <SEO {...pageSEO.security} />
      {/* Hero */}
      <div className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-green-500/5 to-transparent" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium mb-6">
            <Shield className="w-4 h-4" />
            Enterprise-Grade Security
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Security at Made4Founders
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Your data security is our top priority. We employ industry-leading security measures to protect your business information.
          </p>
        </div>
      </div>

      {/* Security Features */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">Security Features</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            We've built Made4Founders from the ground up with security in mind. Here's how we protect your data.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {securityFeatures.map((feature, index) => {
            const colors = colorClasses[feature.color];
            return (
              <div
                key={index}
                className={`p-6 rounded-2xl ${colors.bg} border ${colors.border} hover:scale-[1.02] transition-transform`}
              >
                <div className={`w-12 h-12 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center mb-4`}>
                  <feature.icon className={`w-6 h-6 ${colors.text}`} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>

        {/* Security Practices */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Our Security Practices</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Beyond technical measures, we follow rigorous security practices to ensure your data stays safe.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {practices.map((practice, index) => (
              <div
                key={index}
                className="flex gap-4 p-6 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">{practice.title}</h3>
                  <p className="text-gray-400 text-sm">{practice.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance */}
        <div className="mb-20 p-8 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <FileCheck className="w-6 h-6 text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Compliance & Standards</h2>
          </div>
          <p className="text-gray-400 leading-relaxed mb-6">
            We design our systems with compliance in mind. While we are a growing startup, we strive to meet or exceed industry standards for data protection:
          </p>
          <ul className="grid md:grid-cols-2 gap-4">
            {[
              'OWASP Top 10 security guidelines',
              'GDPR data protection principles',
              'SOC 2 Type II controls (in progress)',
              'PCI DSS guidelines for payment data',
              'CCPA compliance for California residents',
              'Regular third-party security assessments',
            ].map((item, index) => (
              <li key={index} className="flex items-center gap-3 text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Responsible Disclosure */}
        <div className="mb-12 p-8 rounded-2xl bg-orange-500/10 border border-orange-500/20">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Responsible Disclosure</h2>
          </div>
          <p className="text-gray-300 leading-relaxed mb-4">
            We value the security research community. If you discover a security vulnerability, please report it responsibly:
          </p>
          <ul className="space-y-2 text-gray-400 mb-6">
            <li>• Email us at <span className="text-orange-400">security@made4founders.com</span></li>
            <li>• Include detailed steps to reproduce the vulnerability</li>
            <li>• Allow us reasonable time to address the issue before public disclosure</li>
            <li>• Do not access or modify other users' data</li>
          </ul>
          <p className="text-gray-400 text-sm">
            We commit to acknowledging your report within 48 hours and keeping you informed of our progress.
          </p>
        </div>

        {/* Contact */}
        <div className="p-8 rounded-2xl bg-gradient-to-br from-green-500/10 to-cyan-600/10 border border-green-500/20 text-center">
          <Mail className="w-10 h-10 text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Security Questions?</h2>
          <p className="text-gray-400 mb-4">
            Have questions about our security practices? We're happy to discuss.
          </p>
          <a
            href="mailto:security@made4founders.com"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-green-500 to-cyan-600 text-white font-medium hover:from-green-400 hover:to-cyan-500 transition-all"
          >
            <Mail className="w-4 h-4" />
            security@made4founders.com
          </a>
        </div>
      </div>
    </div>
  );
}
