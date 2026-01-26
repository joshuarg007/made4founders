import { Link } from 'react-router-dom';
import { Trash2, Mail, Shield, ArrowLeft } from 'lucide-react';

export default function FacebookDataDeletion() {
  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0f1117]">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
            Back to Made4Founders
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500/20 to-red-500/10 flex items-center justify-center">
            <Trash2 className="w-7 h-7 text-red-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Facebook Data Deletion</h1>
            <p className="text-gray-400 mt-1">How to request deletion of your data</p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Overview */}
          <section className="p-6 rounded-2xl bg-[#13151a] border border-white/10">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              Your Privacy Matters
            </h2>
            <p className="text-gray-300 leading-relaxed">
              If you signed up for Made4Founders using Facebook Login, we store minimal data
              necessary to provide our services. This includes your name, email address, and
              Facebook user ID. We do not access your Facebook friends, posts, photos, or any
              other personal content.
            </p>
          </section>

          {/* What we store */}
          <section className="p-6 rounded-2xl bg-[#13151a] border border-white/10">
            <h2 className="text-xl font-semibold mb-4">Data We Store</h2>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
                <span><strong>Name:</strong> Your public Facebook name, used for your profile</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
                <span><strong>Email:</strong> Your Facebook email address, used for account identification and notifications</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
                <span><strong>Facebook User ID:</strong> A unique identifier to link your Facebook account to your Made4Founders account</span>
              </li>
            </ul>
          </section>

          {/* How to request deletion */}
          <section className="p-6 rounded-2xl bg-[#13151a] border border-white/10">
            <h2 className="text-xl font-semibold mb-4">How to Request Data Deletion</h2>
            <p className="text-gray-300 mb-6">
              To request deletion of all data associated with your Facebook login, please contact us
              using one of the methods below:
            </p>

            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[#0f1117] border border-white/5">
                <div className="flex items-center gap-3 mb-2">
                  <Mail className="w-5 h-5 text-cyan-400" />
                  <span className="font-medium">Email Us</span>
                </div>
                <p className="text-gray-400 text-sm mb-2">
                  Send an email to our support team with the subject "Facebook Data Deletion Request":
                </p>
                <a
                  href="mailto:support@made4founders.com?subject=Facebook%20Data%20Deletion%20Request"
                  className="text-cyan-400 hover:text-cyan-300 transition"
                >
                  support@made4founders.com
                </a>
              </div>
            </div>
          </section>

          {/* What happens next */}
          <section className="p-6 rounded-2xl bg-[#13151a] border border-white/10">
            <h2 className="text-xl font-semibold mb-4">What Happens Next</h2>
            <ol className="space-y-4 text-gray-300">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm font-medium flex-shrink-0">1</span>
                <span>We will verify your identity using the email associated with your account</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm font-medium flex-shrink-0">2</span>
                <span>Within 30 days, we will permanently delete all data associated with your Facebook login</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm font-medium flex-shrink-0">3</span>
                <span>You will receive a confirmation email once the deletion is complete</span>
              </li>
            </ol>
          </section>

          {/* Additional info */}
          <section className="p-6 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
            <h2 className="text-xl font-semibold mb-4 text-yellow-400">Important Note</h2>
            <p className="text-gray-300">
              Deleting your Facebook-connected data will remove your ability to log in with Facebook.
              If you have an active Made4Founders account, you may need to set up a password or
              alternative login method before requesting deletion. Any business data you created
              in Made4Founders (documents, contacts, etc.) will remain unless you also request
              full account deletion.
            </p>
          </section>

          {/* Links */}
          <div className="flex flex-wrap gap-4 pt-4">
            <Link
              to="/privacy"
              className="text-cyan-400 hover:text-cyan-300 transition text-sm"
            >
              Privacy Policy →
            </Link>
            <Link
              to="/terms"
              className="text-cyan-400 hover:text-cyan-300 transition text-sm"
            >
              Terms of Service →
            </Link>
            <Link
              to="/security"
              className="text-cyan-400 hover:text-cyan-300 transition text-sm"
            >
              Security →
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#0f1117] mt-16">
        <div className="max-w-4xl mx-auto px-6 py-8 text-center text-gray-500 text-sm">
          © {new Date().getFullYear()} Made4Founders. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
