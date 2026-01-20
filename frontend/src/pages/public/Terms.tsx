import { FileText, CheckCircle, AlertTriangle, Scale, CreditCard, XCircle, RefreshCw, Mail } from 'lucide-react';
import SEO, { pageSEO } from '../../components/SEO';

export default function Terms() {
  const lastUpdated = 'January 2026';

  const sections = [
    {
      icon: CheckCircle,
      title: 'Acceptance of Terms',
      content: `By accessing or using Made4Founders, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this service.

These Terms apply to all visitors, users, and others who access or use the Service. By using the Service, you agree to be bound by these Terms.`,
    },
    {
      icon: FileText,
      title: 'Description of Service',
      content: `Made4Founders is a business management platform designed for startup founders. Our service includes:

• Business information management and organization
• Document storage and management
• Task and deadline tracking
• Contact management
• Secure credential vault
• Business analytics and insights
• Social media management tools

We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time, with reasonable notice when possible.`,
    },
    {
      icon: Scale,
      title: 'User Responsibilities',
      content: `As a user of Made4Founders, you agree to:

• Provide accurate and complete information when creating your account
• Maintain the security of your account credentials
• Not share your account with others or allow unauthorized access
• Use the Service only for lawful purposes
• Not attempt to gain unauthorized access to any part of the Service
• Not interfere with or disrupt the Service or servers
• Not upload malicious code, viruses, or harmful content
• Comply with all applicable laws and regulations

You are responsible for all activities that occur under your account.`,
    },
    {
      icon: CreditCard,
      title: 'Subscription & Billing',
      content: `Made4Founders offers various subscription plans:

• Free trials may be available for new users
• Paid subscriptions are billed in advance on a monthly or annual basis
• You authorize us to charge your payment method for all fees incurred
• Prices are subject to change with 30 days notice
• Refunds are handled on a case-by-case basis

If payment fails, we may suspend your access until payment is received. You can cancel your subscription at any time, but no refunds will be provided for partial billing periods.`,
    },
    {
      icon: AlertTriangle,
      title: 'Intellectual Property',
      content: `The Service and its original content, features, and functionality are owned by Made4Founders and are protected by international copyright, trademark, and other intellectual property laws.

Your Content: You retain all rights to the content you upload to Made4Founders. By uploading content, you grant us a limited license to store, process, and display that content as necessary to provide the Service.

Our Content: You may not copy, modify, distribute, sell, or lease any part of our Service or included software without our written permission.`,
    },
    {
      icon: XCircle,
      title: 'Limitation of Liability',
      content: `To the maximum extent permitted by law, Made4Founders shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to:

• Loss of profits, data, or business opportunities
• Service interruptions or data breaches
• Errors or inaccuracies in content
• Unauthorized access to your account
• Any third-party conduct on the Service

Our total liability shall not exceed the amount you paid us in the twelve months preceding the claim. Some jurisdictions do not allow these limitations, so they may not apply to you.`,
    },
    {
      icon: RefreshCw,
      title: 'Termination',
      content: `We may terminate or suspend your account immediately, without prior notice or liability, for any reason, including:

• Breach of these Terms
• Fraudulent or illegal activity
• Non-payment of fees
• Extended period of inactivity
• At your request

Upon termination, your right to use the Service will immediately cease. You may export your data before termination. We may retain certain information as required by law or for legitimate business purposes.`,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0d14]">
      <SEO {...pageSEO.terms} />
      {/* Hero */}
      <div className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
            <FileText className="w-4 h-4" />
            Legal Agreement
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Terms of Service
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Please read these terms carefully before using Made4Founders.
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
            These Terms of Service ("Terms") govern your access to and use of Made4Founders' website, products, and services ("Service"). Please read these Terms carefully before using the Service. By accessing or using the Service, you agree to be bound by these Terms and our Privacy Policy.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-12">
          {sections.map((section, index) => (
            <div key={index}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-500/30 flex items-center justify-center">
                  <section.icon className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">{section.title}</h2>
              </div>
              <div className="pl-13 text-gray-400 leading-relaxed whitespace-pre-line">
                {section.content}
              </div>
            </div>
          ))}
        </div>

        {/* Governing Law */}
        <div className="mt-12 p-6 rounded-2xl bg-white/5 border border-white/10">
          <h2 className="text-xl font-bold text-white mb-4">Governing Law</h2>
          <p className="text-gray-400 leading-relaxed">
            These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law provisions. Any disputes arising from these Terms will be resolved in the courts of the United States.
          </p>
        </div>

        {/* Changes to Terms */}
        <div className="mt-8 p-6 rounded-2xl bg-white/5 border border-white/10">
          <h2 className="text-xl font-bold text-white mb-4">Changes to Terms</h2>
          <p className="text-gray-400 leading-relaxed">
            We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion. By continuing to access or use our Service after revisions become effective, you agree to be bound by the revised terms.
          </p>
        </div>

        {/* Contact */}
        <div className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-600/10 border border-blue-500/20 text-center">
          <Mail className="w-10 h-10 text-blue-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Questions About These Terms?</h2>
          <p className="text-gray-400 mb-4">
            If you have any questions about these Terms of Service, please contact us.
          </p>
          <a
            href="mailto:legal@made4founders.com"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:from-blue-400 hover:to-purple-500 transition-all"
          >
            <Mail className="w-4 h-4" />
            legal@made4founders.com
          </a>
        </div>
      </div>
    </div>
  );
}
