import { Link } from 'react-router-dom';
import { ArrowRight, Heart, Target, Shield, Zap } from 'lucide-react';

const values = [
  {
    icon: Target,
    title: 'Founder-First',
    description: "We build for founders, not enterprise IT departments. Every feature is designed to save you time and reduce complexity.",
  },
  {
    icon: Shield,
    title: 'Security Without Compromise',
    description: "Your business data is sacred. We use bank-level encryption and never compromise on security for convenience.",
  },
  {
    icon: Zap,
    title: 'Speed Over Perfection',
    description: "We ship fast and iterate based on founder feedback. Your needs drive our roadmap.",
  },
  {
    icon: Heart,
    title: 'Honest Pricing',
    description: "No hidden fees, no surprise charges. Simple pricing that grows with your business.",
  },
];

const timeline = [
  {
    year: '2023',
    title: 'The Problem',
    description: 'Our founding team was running multiple startups and drowning in spreadsheets, compliance deadlines, and scattered tools.',
  },
  {
    year: '2024',
    title: 'The Solution',
    description: 'We built Made4Founders to solve our own pain. One dashboard for everything a founder needs to manage.',
  },
  {
    year: '2025',
    title: 'Growing Fast',
    description: 'Now helping thousands of founders stay organized, compliant, and focused on building.',
  },
];

export default function About() {
  return (
    <div className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-20">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Built by Founders,
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 text-transparent bg-clip-text">
              For Founders
            </span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            We've been in your shoes. Running startups, juggling compliance, managing teams,
            and trying to find that one document you swore you saved somewhere.
          </p>
        </div>

        {/* Story */}
        <section className="mb-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-6">Our Story</h2>
              <div className="space-y-6 text-gray-400">
                <p>
                  Made4Founders started from frustration. We were running multiple startups and found
                  ourselves spending more time on admin work than building products.
                </p>
                <p>
                  Every founder we talked to had the same problem: compliance deadlines in one
                  spreadsheet, credentials in another, documents scattered across Google Drive,
                  Dropbox, and email attachments.
                </p>
                <p>
                  We looked for a solution but everything was either too enterprise (read: expensive
                  and complex) or too simple (missing critical features). So we built what we wished
                  existed.
                </p>
                <p>
                  <strong className="text-white">Made4Founders is the platform we always wanted.</strong>
                  {' '}Secure your business, grow your revenue, and actually enjoy the journey.
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 rounded-3xl blur-3xl" />
              <div className="relative p-8 rounded-2xl bg-white/5 border border-white/10">
                <h3 className="text-xl font-semibold text-white mb-6">Our Journey</h3>
                <div className="space-y-8">
                  {timeline.map((item, index) => (
                    <div key={item.year} className="relative pl-8">
                      <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">{index + 1}</span>
                      </div>
                      <div className="text-cyan-400 text-sm font-medium mb-1">{item.year}</div>
                      <div className="text-white font-semibold mb-1">{item.title}</div>
                      <div className="text-gray-400 text-sm">{item.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="mb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Our Values</h2>
            <p className="text-gray-400">The principles that guide everything we build.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {values.map((value) => (
              <div
                key={value.title}
                className="p-8 rounded-2xl bg-white/5 border border-white/10"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center mb-6">
                  <value.icon className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{value.title}</h3>
                <p className="text-gray-400">{value.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Mission */}
        <section className="mb-24 p-8 sm:p-12 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border border-white/10 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Our Mission</h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            To give every founder the tools and clarity they need to build great companies,
            without drowning in administrative complexity.
          </p>
        </section>

        {/* Team placeholder */}
        <section className="mb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">The Team</h2>
            <p className="text-gray-400">
              A small, focused team of founders, engineers, and designers
              obsessed with making startup operations simpler.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {['Founder & CEO', 'CTO', 'Head of Product'].map((role) => (
              <div key={role} className="text-center">
                <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center">
                  <span className="text-4xl text-cyan-400">?</span>
                </div>
                <div className="text-white font-semibold mb-1">Coming Soon</div>
                <div className="text-gray-500 text-sm">{role}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Join Us on This Journey
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            We're building Made4Founders in public and shipping new features every week.
            Start your free trial and help shape the future of startup operations.
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
