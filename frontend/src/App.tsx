import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import PublicLayout from './components/PublicLayout'
import ProtectedRoute from './components/ProtectedRoute'
import GlobalErrorToast from './components/GlobalErrorToast'
import ScrollToTop from './components/ScrollToTop'

// Loading spinner for lazy loaded pages
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#0a0d14]">
    <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
  </div>
)

// Public pages (lazy loaded)
const Home = lazy(() => import('./pages/public/Home'))
const Features = lazy(() => import('./pages/public/Features'))
const Pricing = lazy(() => import('./pages/public/Pricing'))
const About = lazy(() => import('./pages/public/About'))
const Signup = lazy(() => import('./pages/public/Signup'))
const Privacy = lazy(() => import('./pages/public/Privacy'))
const Terms = lazy(() => import('./pages/public/Terms'))
const Security = lazy(() => import('./pages/public/Security'))
const Contact = lazy(() => import('./pages/public/Contact'))
const FacebookDataDeletion = lazy(() => import('./pages/FacebookDataDeletion'))

// Auth pages
const Login = lazy(() => import('./pages/Login'))
const LinkAccount = lazy(() => import('./pages/LinkAccount'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))

// Protected pages (lazy loaded)
const DailyBrief = lazy(() => import('./pages/DailyBrief'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const GettingStarted = lazy(() => import('./pages/GettingStarted'))
const Documents = lazy(() => import('./pages/Documents'))
const Meetings = lazy(() => import('./pages/Meetings'))
const Contacts = lazy(() => import('./pages/Contacts'))
const Deadlines = lazy(() => import('./pages/Deadlines'))
const Library = lazy(() => import('./pages/Library'))
const Users = lazy(() => import('./pages/Users'))
const Tasks = lazy(() => import('./pages/Tasks'))
const SocialHub = lazy(() => import('./pages/SocialHub'))
const AnalyticsPage = lazy(() => import('./pages/Insights'))
const Offerings = lazy(() => import('./pages/Offerings'))
const Finance = lazy(() => import('./pages/Finance'))
const FinancialDashboard = lazy(() => import('./pages/FinancialDashboard'))
const RevenueDashboard = lazy(() => import('./pages/RevenueDashboard'))
const CapTable = lazy(() => import('./pages/CapTable'))
const InvestorUpdates = lazy(() => import('./pages/InvestorUpdates'))
const DataRoom = lazy(() => import('./pages/DataRoom'))
const Budget = lazy(() => import('./pages/Budget'))
const Invoices = lazy(() => import('./pages/Invoices'))
const Team = lazy(() => import('./pages/Team'))
const Vault = lazy(() => import('./pages/Vault'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const Businesses = lazy(() => import('./pages/Businesses'))
const Marketplaces = lazy(() => import('./pages/Marketplaces'))
const Integrations = lazy(() => import('./pages/Integrations'))
const Settings = lazy(() => import('./pages/Settings'))
const ActivityFeed = lazy(() => import('./pages/ActivityFeed'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const GuestAccessManager = lazy(() => import('./pages/GuestAccessManager'))

function App() {
  return (
    <>
    <ScrollToTop />
    <GlobalErrorToast />
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/features" element={<Features />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/about" element={<About />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/security" element={<Security />} />
          <Route path="/contact" element={<Contact />} />
        </Route>

        {/* Standalone public pages */}
        <Route path="/facebook-oauth-data-deletion" element={<FacebookDataDeletion />} />

        {/* Auth pages (separate from public layout for cleaner UX) */}
        <Route path="/login" element={<Login />} />
        <Route path="/link-account" element={<LinkAccount />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

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
          <Route path="deadlines" element={<Deadlines />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="users" element={<Users />} />

          {/* New merged pages */}
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
        </Route>

        {/* Redirect old routes to new structure */}
        <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/documents" element={<Navigate to="/app/documents" replace />} />
        <Route path="/contacts" element={<Navigate to="/app/contacts" replace />} />
        <Route path="/deadlines" element={<Navigate to="/app/deadlines" replace />} />
        <Route path="/library" element={<Navigate to="/app/library" replace />} />
        <Route path="/tasks" element={<Navigate to="/app/tasks" replace />} />
        <Route path="/users" element={<Navigate to="/app/users" replace />} />
        <Route path="/getting-started" element={<Navigate to="/app/getting-started" replace />} />

        {/* Redirect old pages to new merged pages */}
        <Route path="/app/marketing" element={<Navigate to="/app/social-hub" replace />} />
        <Route path="/app/branding" element={<Navigate to="/app/social-hub" replace />} />
        <Route path="/app/website" element={<Navigate to="/app/social-hub" replace />} />
        <Route path="/app/metrics" element={<Navigate to="/app/analytics" replace />} />
        <Route path="/app/insights" element={<Navigate to="/app/analytics" replace />} />
        <Route path="/app/products-offered" element={<Navigate to="/app/offerings" replace />} />
        <Route path="/app/products-used" element={<Navigate to="/app/offerings" replace />} />
        <Route path="/app/services" element={<Navigate to="/app/offerings" replace />} />
        <Route path="/app/web-links" element={<Navigate to="/app/offerings" replace />} />
        <Route path="/app/banking" element={<Navigate to="/app/finance" replace />} />
        <Route path="/app/vault" element={<Navigate to="/app/finance" replace />} />
      </Routes>
    </Suspense>
    </>
  )
}

export default App
