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

// Auth page
const Login = lazy(() => import('./pages/Login'))

// Protected pages (lazy loaded)
const DailyBrief = lazy(() => import('./pages/DailyBrief'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const GettingStarted = lazy(() => import('./pages/GettingStarted'))
const Documents = lazy(() => import('./pages/Documents'))
const Contacts = lazy(() => import('./pages/Contacts'))
const Deadlines = lazy(() => import('./pages/Deadlines'))
const Library = lazy(() => import('./pages/Library'))
const Users = lazy(() => import('./pages/Users'))
const Tasks = lazy(() => import('./pages/Tasks'))
const SocialHub = lazy(() => import('./pages/SocialHub'))
const Insights = lazy(() => import('./pages/Insights'))
const Offerings = lazy(() => import('./pages/Offerings'))
const Finance = lazy(() => import('./pages/Finance'))
const Vault = lazy(() => import('./pages/Vault'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const Businesses = lazy(() => import('./pages/Businesses'))
const Marketplaces = lazy(() => import('./pages/Marketplaces'))
const Settings = lazy(() => import('./pages/Settings'))

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

        {/* Login page (separate from public layout for cleaner UX) */}
        <Route path="/login" element={<Login />} />

        {/* Protected app routes */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DailyBrief />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="getting-started" element={<GettingStarted />} />
          <Route path="library" element={<Library />} />
          <Route path="documents" element={<Documents />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="deadlines" element={<Deadlines />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="users" element={<Users />} />

          {/* New merged pages */}
          <Route path="social-hub" element={<SocialHub />} />
          <Route path="insights" element={<Insights />} />
          <Route path="offerings" element={<Offerings />} />
          <Route path="finance" element={<Finance />} />
          <Route path="vault" element={<Vault />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="businesses" element={<Businesses />} />
          <Route path="marketplaces" element={<Marketplaces />} />
          <Route path="settings" element={<Settings />} />
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
        <Route path="/app/metrics" element={<Navigate to="/app/insights" replace />} />
        <Route path="/app/analytics" element={<Navigate to="/app/insights" replace />} />
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
