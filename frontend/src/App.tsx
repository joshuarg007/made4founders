import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import PublicLayout from './components/PublicLayout'
import ProtectedRoute from './components/ProtectedRoute'
import GlobalErrorToast from './components/GlobalErrorToast'
import ScrollToTop from './components/ScrollToTop'

// Public pages
import Home from './pages/public/Home'
import Features from './pages/public/Features'
import Pricing from './pages/public/Pricing'
import About from './pages/public/About'
import Signup from './pages/public/Signup'
import Privacy from './pages/public/Privacy'
import Terms from './pages/public/Terms'
import Security from './pages/public/Security'

// Protected pages
import DailyBrief from './pages/DailyBrief'
import Dashboard from './pages/Dashboard'
import GettingStarted from './pages/GettingStarted'
import Documents from './pages/Documents'
import Contacts from './pages/Contacts'
import Deadlines from './pages/Deadlines'
import Library from './pages/Library'
import Login from './pages/Login'
import Users from './pages/Users'
import Tasks from './pages/Tasks'

// New merged pages
import SocialHub from './pages/SocialHub'
import Insights from './pages/Insights'
import Offerings from './pages/Offerings'
import Finance from './pages/Finance'
import Vault from './pages/Vault'
import Leaderboard from './pages/Leaderboard'
import Businesses from './pages/Businesses'
import Marketplaces from './pages/Marketplaces'

function App() {
  return (
    <>
    <ScrollToTop />
    <GlobalErrorToast />
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
    </>
  )
}

export default App
