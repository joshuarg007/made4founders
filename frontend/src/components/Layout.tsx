import { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
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
  TrendingUp,
  Landmark,
  Palette,
  Megaphone,
  ChevronDown,
  Rocket,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
}

interface NavSection {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    id: 'command',
    label: 'Command Center',
    icon: Rocket,
    items: [
      { to: '/app', icon: Sparkles, label: 'Daily Brief' },
      { to: '/app/getting-started', icon: ClipboardCheck, label: 'Setup Checklist' },
      { to: '/app/tasks', icon: CheckSquare, label: 'Tasks & To-Dos' },
    ],
  },
  {
    id: 'business',
    label: 'Business Operations',
    icon: Building2,
    items: [
      { to: '/app/library', icon: Building2, label: 'Business Library' },
      { to: '/app/documents', icon: FileText, label: 'Documents' },
      { to: '/app/contacts', icon: Users, label: 'Contacts' },
      { to: '/app/deadlines', icon: Calendar, label: 'Deadlines' },
      { to: '/app/web-links', icon: Bookmark, label: 'Bookmarks' },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: TrendingUp,
    items: [
      { to: '/app/metrics', icon: BarChart3, label: 'Metrics' },
      { to: '/app/analytics', icon: TrendingUp, label: 'Analytics' },
    ],
  },
  {
    id: 'offerings',
    label: 'Products & Services',
    icon: Package,
    items: [
      { to: '/app/products-offered', icon: Package, label: 'Products Offered' },
      { to: '/app/services', icon: Link2, label: 'Services Offered' },
      { to: '/app/products-used', icon: Wrench, label: 'Tools & Software' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing & Brand',
    icon: Megaphone,
    items: [
      { to: '/app/marketing', icon: Megaphone, label: 'Marketing Hub' },
      { to: '/app/branding', icon: Palette, label: 'Brand Assets' },
      { to: '/app/website', icon: Globe, label: 'Web Presence' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance & Security',
    icon: Shield,
    items: [
      { to: '/app/banking', icon: Landmark, label: 'Banking' },
      { to: '/app/vault', icon: Shield, label: 'Credential Vault' },
    ],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Initialize expanded sections from localStorage or default all open
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('sidebar-sections');
    if (saved) {
      return JSON.parse(saved);
    }
    // Default: all sections expanded
    return navSections.reduce((acc, section) => ({ ...acc, [section.id]: true }), {});
  });

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem('sidebar-sections', JSON.stringify(expandedSections));
  }, [expandedSections]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // Check if any item in a section is active
  const isSectionActive = (section: NavSection) => {
    return section.items.some(item => {
      if (item.to === '/app') {
        return location.pathname === '/app';
      }
      return location.pathname.startsWith(item.to);
    });
  };

  return (
    <div className="flex h-screen bg-[#0f1117]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1a1d24] border-r border-white/10 flex flex-col relative">
        {/* Logo */}
        <div className="p-5 border-b border-white/10">
          <Link to="/app" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="Made4Founders" className="h-9 w-auto" />
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Made4Founders</h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Command Center</p>
            </div>
          </Link>
        </div>

        {/* Navigation - with bottom padding for fixed footer */}
        <nav className="flex-1 p-3 overflow-y-auto pb-28 space-y-1">
          {navSections.map((section) => {
            const isExpanded = expandedSections[section.id];
            const isActive = isSectionActive(section);

            return (
              <div key={section.id} className="mb-1">
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <section.icon className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide">{section.label}</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                  />
                </button>

                {/* Section Items */}
                {isExpanded && (
                  <div className="mt-1 ml-2 space-y-0.5">
                    {section.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/app'}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm ${
                            isActive
                              ? 'bg-white/10 text-white'
                              : 'text-gray-400 hover:bg-white/5 hover:text-white'
                          }`
                        }
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Admin-only: User Management */}
          {user?.role === 'admin' && (
            <div className="pt-2 border-t border-white/10 mt-2">
              <NavLink
                to="/app/users"
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <UserCog className="w-4 h-4" />
                <span>User Management</span>
              </NavLink>
            </div>
          )}
        </nav>

        {/* Fixed Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-[#1a1d24] border-t border-white/10 space-y-2">
          {user && (
            <>
              <div className="text-xs text-gray-400 truncate text-center px-2">{user.email}</div>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition text-sm font-medium"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </>
          )}
          <div className="text-[10px] text-gray-600 text-center">
            Made4Founders v1.0
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative">
        <Outlet />
      </main>
    </div>
  );
}
