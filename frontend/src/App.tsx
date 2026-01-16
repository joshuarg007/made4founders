import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import PublicLayout from './components/PublicLayout'
import ProtectedRoute from './components/ProtectedRoute'
import GlobalErrorToast from './components/GlobalErrorToast'

// Public pages
import Home from './pages/public/Home'
import Features from './pages/public/Features'
import Pricing from './pages/public/Pricing'
import About from './pages/public/About'
import Signup from './pages/public/Signup'

// Protected pages
import DailyBrief from './pages/DailyBrief'
import Dashboard from './pages/Dashboard'
import GettingStarted from './pages/GettingStarted'
import Services from './pages/Services'
import Documents from './pages/Documents'
import Contacts from './pages/Contacts'
import Deadlines from './pages/Deadlines'
import Library from './pages/Library'
import Website from './pages/Website'
import Vault from './pages/Vault'
import Login from './pages/Login'
import ProductsOffered from './pages/ProductsOffered'
import ProductsUsed from './pages/ProductsUsed'
import WebLinks from './pages/WebLinks'
import Users from './pages/Users'
import Tasks from './pages/Tasks'
import Metrics from './pages/Metrics'
import Analytics from './pages/Analytics'
import Banking from './pages/Banking'
import Branding from './pages/Branding'
import Marketing from './pages/Marketing'

function App() {
  return (
    <>
    <GlobalErrorToast />
    <Routes>
      {/* Public routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/features" element={<Features />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/about" element={<About />} />
        <Route path="/signup" element={<Signup />} />
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
        <Route path="website" element={<Website />} />
        <Route path="services" element={<Services />} />
        <Route path="documents" element={<Documents />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="deadlines" element={<Deadlines />} />
        <Route path="vault" element={<Vault />} />
        <Route path="products-offered" element={<ProductsOffered />} />
        <Route path="products-used" element={<ProductsUsed />} />
        <Route path="web-links" element={<WebLinks />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="metrics" element={<Metrics />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="banking" element={<Banking />} />
        <Route path="branding" element={<Branding />} />
        <Route path="marketing" element={<Marketing />} />
        <Route path="users" element={<Users />} />
      </Route>

      {/* Redirect old routes to new /app prefix */}
      <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/services" element={<Navigate to="/app/services" replace />} />
      <Route path="/documents" element={<Navigate to="/app/documents" replace />} />
      <Route path="/contacts" element={<Navigate to="/app/contacts" replace />} />
      <Route path="/deadlines" element={<Navigate to="/app/deadlines" replace />} />
      <Route path="/library" element={<Navigate to="/app/library" replace />} />
      <Route path="/website" element={<Navigate to="/app/website" replace />} />
      <Route path="/vault" element={<Navigate to="/app/vault" replace />} />
      <Route path="/products-offered" element={<Navigate to="/app/products-offered" replace />} />
      <Route path="/products-used" element={<Navigate to="/app/products-used" replace />} />
      <Route path="/web-links" element={<Navigate to="/app/web-links" replace />} />
      <Route path="/tasks" element={<Navigate to="/app/tasks" replace />} />
      <Route path="/metrics" element={<Navigate to="/app/metrics" replace />} />
      <Route path="/banking" element={<Navigate to="/app/banking" replace />} />
      <Route path="/users" element={<Navigate to="/app/users" replace />} />
      <Route path="/getting-started" element={<Navigate to="/app/getting-started" replace />} />
    </Routes>
    </>
  )
}

export default App
