import { lazy, Suspense, type ComponentType } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import PublicLayout from './components/PublicLayout'
import ProtectedRoute from './components/ProtectedRoute'
import GlobalErrorToast from './components/GlobalErrorToast'
import ScrollToTop from './components/ScrollToTop'
import ErrorBoundary from './components/ErrorBoundary'

// Loading spinner for lazy loaded pages
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#0a0d14]">
    <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
  </div>
)

// Retry wrapper for lazy loading - retries up to 3 times with delay
function lazyWithRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  retries = 3,
  interval = 500
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;
    for (let i = 0; i < retries; i++) {
      try {
        return await importFn();
      } catch (error) {
        lastError = error;
        console.warn(`Chunk load failed, retry ${i + 1}/${retries}...`);
        await new Promise(resolve => setTimeout(resolve, interval * (i + 1)));
      }
    }
    // If all retries failed and it's a chunk load error, reload the page
    // This handles stale chunks after deployments
    if (lastError instanceof Error && lastError.message.includes('Loading chunk')) {
      window.location.reload();
    }
    throw lastError;
  });
}

// Public pages (lazy loaded with retry)
const Home = lazyWithRetry(() => import('./pages/public/Home'))
const Features = lazyWithRetry(() => import('./pages/public/Features'))
const Pricing = lazyWithRetry(() => import('./pages/public/Pricing'))
const About = lazyWithRetry(() => import('./pages/public/About'))
const Signup = lazyWithRetry(() => import('./pages/public/Signup'))
const Privacy = lazyWithRetry(() => import('./pages/public/Privacy'))
const Terms = lazyWithRetry(() => import('./pages/public/Terms'))
const Security = lazyWithRetry(() => import('./pages/public/Security'))
const Contact = lazyWithRetry(() => import('./pages/public/Contact'))
const FacebookDataDeletion = lazyWithRetry(() => import('./pages/FacebookDataDeletion'))

// Auth pages
const Login = lazyWithRetry(() => import('./pages/Login'))
const LinkAccount = lazyWithRetry(() => import('./pages/LinkAccount'))
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'))
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'))
const VerifyEmail = lazyWithRetry(() => import('./pages/VerifyEmail'))
const MFASetup = lazyWithRetry(() => import('./pages/MFASetup'))
const MFAVerify = lazyWithRetry(() => import('./pages/MFAVerify'))

// Protected pages (lazy loaded with retry)
const DailyBrief = lazyWithRetry(() => import('./pages/DailyBrief'))
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'))
const GettingStarted = lazyWithRetry(() => import('./pages/GettingStarted'))
const Documents = lazyWithRetry(() => import('./pages/Documents'))
const Meetings = lazyWithRetry(() => import('./pages/Meetings'))
const Contacts = lazyWithRetry(() => import('./pages/Contacts'))
const Library = lazyWithRetry(() => import('./pages/Library'))
const Users = lazyWithRetry(() => import('./pages/Users'))
const Tasks = lazyWithRetry(() => import('./pages/Tasks'))
const SocialHub = lazyWithRetry(() => import('./pages/SocialHub'))
const AnalyticsPage = lazyWithRetry(() => import('./pages/Insights'))
const Offerings = lazyWithRetry(() => import('./pages/Offerings'))
const Finance = lazyWithRetry(() => import('./pages/Finance'))
const FinancialDashboard = lazyWithRetry(() => import('./pages/FinancialDashboard'))
const RevenueDashboard = lazyWithRetry(() => import('./pages/RevenueDashboard'))
const CapTable = lazyWithRetry(() => import('./pages/CapTable'))
const InvestorUpdates = lazyWithRetry(() => import('./pages/InvestorUpdates'))
const DataRoom = lazyWithRetry(() => import('./pages/DataRoom'))
const Budget = lazyWithRetry(() => import('./pages/Budget'))
const Invoices = lazyWithRetry(() => import('./pages/Invoices'))
const Team = lazyWithRetry(() => import('./pages/Team'))
const Vault = lazyWithRetry(() => import('./pages/Vault'))
const Leaderboard = lazyWithRetry(() => import('./pages/Leaderboard'))
const Businesses = lazyWithRetry(() => import('./pages/Businesses'))
const WebPresence = lazyWithRetry(() => import('./pages/Website'))
const SEOPage = lazyWithRetry(() => import('./pages/SEO'))
const Branding = lazyWithRetry(() => import('./pages/Branding'))
const Marketplaces = lazyWithRetry(() => import('./pages/Marketplaces'))
const Integrations = lazyWithRetry(() => import('./pages/Integrations'))
const Settings = lazyWithRetry(() => import('./pages/Settings'))
const ActivityFeed = lazyWithRetry(() => import('./pages/ActivityFeed'))
const NotificationsPage = lazyWithRetry(() => import('./pages/NotificationsPage'))
const GuestAccessManager = lazyWithRetry(() => import('./pages/GuestAccessManager'))
const MarketIntelligence = lazyWithRetry(() => import('./pages/MarketIntelligence'))

function App() {
  return (
    <>
    <ScrollToTop />
    <GlobalErrorToast />
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
        {/* Public routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/features" element={<Features />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/about" element={<About />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/security" element={<Security />} />
          <Route path="/contact" element={<Contact />} />
        </Route>

        {/* Standalone public pages */}
        <Route path="/facebook-oauth-data-deletion" element={<FacebookDataDeletion />} />

        {/* Auth pages (separate from public layout for cleaner UX) */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/link-account" element={<LinkAccount />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/setup-mfa" element={<MFASetup />} />
        <Route path="/mfa-verify" element={<MFAVerify />} />

        {/* Protected app routes */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="daily-brief" element={<DailyBrief />} />
          <Route path="getting-started" element={<GettingStarted />} />
          <Route path="library" element={<Library />} />
          <Route path="documents" element={<Documents />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="users" element={<Users />} />

          {/* Marketing */}
          <Route path="web-presence" element={<WebPresence />} />
          <Route path="branding" element={<Branding />} />
          <Route path="seo" element={<SEOPage />} />
          <Route path="social-hub" element={<SocialHub />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="offerings" element={<Offerings />} />
          <Route path="finance" element={<Finance />} />
          <Route path="financial-dashboard" element={<FinancialDashboard />} />
          <Route path="revenue" element={<RevenueDashboard />} />
          <Route path="cap-table" element={<CapTable />} />
          <Route path="investor-updates" element={<InvestorUpdates />} />
          <Route path="data-room" element={<DataRoom />} />
          <Route path="budget" element={<Budget />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="team" element={<Team />} />
          <Route path="vault" element={<Vault />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="businesses" element={<Businesses />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="marketplaces" element={<Marketplaces />} />
          <Route path="settings" element={<Settings />} />

          {/* Collaboration */}
          <Route path="activity" element={<ActivityFeed />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="guests" element={<GuestAccessManager />} />

          {/* Market Intelligence */}
          <Route path="market-intelligence" element={<MarketIntelligence />} />
        </Route>

        {/* Redirect old routes to new structure */}
        <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/documents" element={<Navigate to="/app/documents" replace />} />
        <Route path="/contacts" element={<Navigate to="/app/contacts" replace />} />
        <Route path="/deadlines" element={<Navigate to="/app/tasks" replace />} />
        <Route path="/library" element={<Navigate to="/app/library" replace />} />
        <Route path="/tasks" element={<Navigate to="/app/tasks" replace />} />
        <Route path="/users" element={<Navigate to="/app/users" replace />} />
        <Route path="/getting-started" element={<Navigate to="/app/getting-started" replace />} />

        {/* Redirect old pages to new merged pages */}
        <Route path="/app/marketing" element={<Navigate to="/app/social-hub" replace />} />
        <Route path="/app/website" element={<Navigate to="/app/web-presence" replace />} />
        <Route path="/app/metrics" element={<Navigate to="/app/analytics" replace />} />
        <Route path="/app/insights" element={<Navigate to="/app/analytics" replace />} />
        <Route path="/app/products-offered" element={<Navigate to="/app/offerings" replace />} />
        <Route path="/app/products-used" element={<Navigate to="/app/offerings" replace />} />
        <Route path="/app/services" element={<Navigate to="/app/offerings" replace />} />
        <Route path="/app/web-links" element={<Navigate to="/app/offerings" replace />} />
        <Route path="/app/banking" element={<Navigate to="/app/finance" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
    </>
  )
}

export default App
