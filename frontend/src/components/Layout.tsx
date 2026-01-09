import { Outlet, NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Link2,
  FileText,
  Users,
  Calendar,
  ClipboardCheck,
  Building2,
  Globe,
  LogOut,
  Sparkles,
  Shield,
  Package,
  Wrench,
  Bookmark,
  UserCog,
  CheckSquare,
  BarChart3,
  Landmark,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/library', icon: Building2, label: 'Business Library' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/metrics', icon: BarChart3, label: 'Metrics' },
  { to: '/getting-started', icon: ClipboardCheck, label: 'Getting Started' },
  { to: '/website', icon: Globe, label: 'Web Presence' },
  { to: '/products-offered', icon: Package, label: 'Products Offered' },
  { to: '/services', icon: Link2, label: 'Services Offered' },
  { to: '/products-used', icon: Wrench, label: 'Tools Used' },
  { to: '/web-links', icon: Bookmark, label: 'Web Links' },
  { to: '/documents', icon: FileText, label: 'Documents' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/deadlines', icon: Calendar, label: 'Deadlines' },
  { to: '/vault', icon: Shield, label: 'Credential Vault' },
  { to: '/banking', icon: Landmark, label: 'Banking' },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-[#0f1117]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1a1d24] border-r border-white/10 flex flex-col relative">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="AxionDeep" className="h-10 w-auto" />
            <div>
              <h1 className="text-lg font-bold text-white">FounderOS</h1>
              <p className="text-xs text-gray-500">Command Center</p>
            </div>
          </Link>
        </div>

        {/* Navigation - with bottom padding for fixed footer */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto pb-32">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}

          {/* Admin-only: User Management */}
          {user?.role === 'admin' && (
            <NavLink
              to="/users"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <UserCog className="w-5 h-5" />
              <span className="font-medium">Users</span>
            </NavLink>
          )}
        </nav>

        {/* Fixed Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#1a1d24] border-t border-white/10 space-y-2">
          {user && (
            <>
              <div className="text-xs text-gray-400 truncate text-center">{user.email}</div>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500 hover:text-red-300 transition font-medium"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </>
          )}
          <div className="text-xs text-gray-500 text-center">
            FounderOS v1.0
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative">
        <Outlet />

        {/* Floating Daily Brief Button */}
        <Link
          to="/"
          className="fixed bottom-6 right-6 z-40 group"
          title="Daily Brief"
        >
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-violet-600 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />

            {/* Button */}
            <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg backdrop-blur-sm border border-white/20 group-hover:scale-110 transition-transform">
              <Sparkles className="w-6 h-6 text-white" />
            </div>

            {/* Tooltip */}
            <div className="absolute right-0 top-full mt-2 px-3 py-1.5 bg-[#1a1d24] rounded-lg text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 shadow-xl">
              Daily Brief
            </div>
          </div>
        </Link>
      </main>
    </div>
  );
}
