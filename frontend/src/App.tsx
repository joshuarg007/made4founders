import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
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

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
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
      </Route>
    </Routes>
  )
}

export default App
