import { Shield, Lock, Eye, Database, UserCheck, Globe, Mail } from 'lucide-react';

export default function Privacy() {
  const lastUpdated = 'January 2026';

  const sections = [
    {
      icon: Database,
      title: 'Information We Collect',
      content: [
        {
          subtitle: 'Account Information',
          text: 'When you create an account, we collect your name, email address, and password. If you sign up using Google or GitHub, we receive basic profile information from those services.',
        },
        {
          subtitle: 'Business Data',
          text: 'You may choose to store business information such as contacts, documents, deadlines, tasks, and financial data. This information is stored securely and encrypted.',
        },
        {
          subtitle: 'Usage Data',
          text: 'We automatically collect information about how you interact with our service, including pages visited, features used, and time spent in the application.',
        },
      ],
    },
    {
      icon: Lock,
      title: 'How We Protect Your Data',
      content: [
        {
          subtitle: 'Encryption',
          text: 'All sensitive data is encrypted at rest using AES-256-GCM encryption. Data in transit is protected using TLS 1.3. Your vault credentials use Argon2id key derivation.',
        },
        {
          subtitle: 'Access Controls',
          text: 'We implement strict access controls and authentication mechanisms. JWT tokens expire after 15 minutes, and refresh tokens are rotated regularly.',
        },
        {
          subtitle: 'Infrastructure Security',
          text: 'Our servers are hosted on secure cloud infrastructure with regular security updates, firewalls, and intrusion detection systems.',
        },
      ],
    },
    {
      icon: Eye,
      title: 'How We Use Your Information',
      content: [
        {
          subtitle: 'Service Delivery',
          text: 'We use your information to provide, maintain, and improve our services, including personalized features and customer support.',
        },
        {
          subtitle: 'Communication',
          text: 'We may send you service-related emails such as account verification, security alerts, and important updates about our services.',
        },
        {
          subtitle: 'Analytics',
          text: 'We analyze usage patterns to improve our product, fix bugs, and develop new features. This data is aggregated and anonymized.',
        },
      ],
    },
    {
      icon: UserCheck,
      title: 'Your Rights',
      content: [
        {
          subtitle: 'Access & Export',
          text: 'You can access and export your data at any time through your account settings. We provide your data in standard, machine-readable formats.',
        },
        {
          subtitle: 'Correction & Deletion',
          text: 'You can update your information at any time. You may also request deletion of your account and all associated data.',
        },
        {
          subtitle: 'Opt-Out',
          text: 'You can opt out of non-essential communications at any time. Some service-related communications are required for account security.',
        },
      ],
    },
    {
      icon: Globe,
      title: 'Data Sharing',
      content: [
        {
          subtitle: 'Third-Party Services',
          text: 'We may share data with service providers who help us operate our platform (hosting, email delivery, analytics). These providers are bound by strict data protection agreements.',
        },
        {
          subtitle: 'Legal Requirements',
          text: 'We may disclose information if required by law, court order, or government request, or to protect our rights and safety.',
        },
        {
          subtitle: 'Business Transfers',
          text: 'If we are involved in a merger or acquisition, your information may be transferred as part of that transaction. We will notify you of any such change.',
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0d14]">
      {/* Hero */}
      <div className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-6">
            <Shield className="w-4 h-4" />
            Your Privacy Matters
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Privacy Policy
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            We're committed to protecting your privacy and being transparent about how we handle your data.
          </p>
          <p className="mt-4 text-sm text-gray-500">
            Last updated: {lastUpdated}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {/* Introduction */}
        <div className="mb-12 p-6 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-gray-300 leading-relaxed">
            Made4Founders ("we", "our", or "us") operates the Made4Founders platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service. Please read this privacy policy carefully. By using Made4Founders, you agree to the collection and use of information in accordance with this policy.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-12">
          {sections.map((section, index) => (
            <div key={index}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
                  <section.icon className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">{section.title}</h2>
              </div>
              <div className="space-y-6 pl-13">
                {section.content.map((item, itemIndex) => (
                  <div key={itemIndex} className="border-l-2 border-white/10 pl-6">
                    <h3 className="text-lg font-semibold text-white mb-2">{item.subtitle}</h3>
                    <p className="text-gray-400 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Cookies Section */}
        <div className="mt-12 p-6 rounded-2xl bg-white/5 border border-white/10">
          <h2 className="text-xl font-bold text-white mb-4">Cookies & Tracking</h2>
          <p className="text-gray-400 leading-relaxed mb-4">
            We use essential cookies to maintain your session and remember your preferences. We do not use third-party tracking cookies or sell your data to advertisers. Analytics data is collected anonymously to improve our service.
          </p>
          <p className="text-gray-400 leading-relaxed">
            You can configure your browser to refuse cookies, but this may limit some features of our service.
          </p>
        </div>

        {/* Children's Privacy */}
        <div className="mt-8 p-6 rounded-2xl bg-white/5 border border-white/10">
          <h2 className="text-xl font-bold text-white mb-4">Children's Privacy</h2>
          <p className="text-gray-400 leading-relaxed">
            Made4Founders is not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal information, please contact us.
          </p>
        </div>

        {/* Contact */}
        <div className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 text-center">
          <Mail className="w-10 h-10 text-cyan-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Questions About Privacy?</h2>
          <p className="text-gray-400 mb-4">
            If you have any questions about this Privacy Policy, please contact us.
          </p>
          <a
            href="mailto:privacy@made4founders.com"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:from-cyan-400 hover:to-blue-500 transition-all"
          >
            <Mail className="w-4 h-4" />
            privacy@made4founders.com
          </a>
        </div>
      </div>
    </div>
  );
}
