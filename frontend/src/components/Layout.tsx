import { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import {
  FileText,
  Users,
  Calendar,
  ClipboardCheck,
  Building2,
  LogOut,
  Package,
  UserCog,
  CheckSquare,
  BarChart3,
  TrendingUp,
  Landmark,
  Megaphone,
  ChevronDown,
  Rocket,
  Shield,
  BookOpen,
  Store,
  Settings,
  LayoutDashboard,
  ListTodo,
  Video,
  Plug,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Tutorial from './Tutorial';

interface NavItem {
  to: string;
  icon: typeof Rocket;
  label: string;
}

interface NavSection {
  id: string;
  label: string;
  icon: typeof Rocket;
  items: NavItem[];
  color: {
    bg: string;
    text: string;
    activeBg: string;
    border: string;
    hoverText: string;
  };
}

const navSections: NavSection[] = [
  {
    id: 'command',
    label: 'Command',
    icon: Rocket,
    color: {
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-400',
      activeBg: 'bg-cyan-500/20',
      border: 'border-cyan-500/30',
      hoverText: 'hover:text-cyan-400',
    },
    items: [
      { to: '/app', icon: LayoutDashboard, label: 'Home' },
      { to: '/app/getting-started', icon: ClipboardCheck, label: 'To-Do' },
      { to: '/app/daily-brief', icon: ListTodo, label: 'Today' },
      { to: '/app/tasks', icon: Calendar, label: 'Calendar' },
      { to: '/app/integrations', icon: Plug, label: 'Integrations' },
      { to: '/app/vault', icon: Shield, label: 'Vault' },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    icon: Building2,
    color: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-400',
      activeBg: 'bg-blue-500/20',
      border: 'border-blue-500/30',
      hoverText: 'hover:text-blue-400',
    },
    items: [
      { to: '/app/businesses', icon: Building2, label: 'Companies' },
      { to: '/app/library', icon: BookOpen, label: 'Library' },
      { to: '/app/documents', icon: FileText, label: 'Documents' },
      { to: '/app/meetings', icon: Video, label: 'Meetings' },
      { to: '/app/contacts', icon: Users, label: 'Contacts' },
      { to: '/app/deadlines', icon: Calendar, label: 'Deadlines' },
    ],
  },
  {
    id: 'growth',
    label: 'Growth',
    icon: TrendingUp,
    color: {
      bg: 'bg-purple-500/10',
      text: 'text-purple-400',
      activeBg: 'bg-purple-500/20',
      border: 'border-purple-500/30',
      hoverText: 'hover:text-purple-400',
    },
    items: [
      { to: '/app/social-hub', icon: Megaphone, label: 'Marketing' },
      { to: '/app/insights', icon: BarChart3, label: 'Analytics' },
      { to: '/app/marketplaces', icon: Store, label: 'Markets' },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    icon: Package,
    color: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      activeBg: 'bg-emerald-500/20',
      border: 'border-emerald-500/30',
      hoverText: 'hover:text-emerald-400',
    },
    items: [
      { to: '/app/offerings', icon: Package, label: 'Catalog' },
      { to: '/app/finance', icon: Landmark, label: 'Finance' },
    ],
  },
];

export default function Layout() {
  const { user, logout, refreshUser } = useAuth();
  const location = useLocation();
  const [showTutorial, setShowTutorial] = useState(() => {
    // Show tutorial if user hasn't completed onboarding
    return false; // Will be set by useEffect after user loads
  });

  // Show tutorial when user loads and hasn't completed onboarding
  useEffect(() => {
    if (user && !user.has_completed_onboarding) {
      setShowTutorial(true);
    }
  }, [user]);

  const handleTutorialComplete = () => {
    setShowTutorial(false);
    refreshUser(); // Refresh user data to update has_completed_onboarding
  };

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
        <div className="p-4 border-b border-white/10">
          <Link to="/app" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src="/logo.webp" alt="Made4Founders" className="h-14 w-auto" width={42} height={52} />
            <span className="text-lg font-bold text-white">Made4Founders</span>
          </Link>
        </div>

        {/* Navigation - with bottom padding for fixed footer */}
        <nav className="flex-1 p-3 overflow-y-auto pb-28 space-y-1">
          {navSections.map((section) => {
            const isExpanded = expandedSections[section.id];
            const isActive = isSectionActive(section);

            return (
              <div key={section.id} className="mb-2">
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left border ${
                    isActive
                      ? `${section.color.bg} ${section.color.border}`
                      : 'hover:bg-white/5 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isActive ? section.color.activeBg : section.color.bg}`}>
                      <section.icon className={`w-3.5 h-3.5 ${section.color.text}`} />
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-wide ${section.color.text}`}>{section.label}</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${section.color.text} ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                  />
                </button>

                {/* Section Items */}
                {isExpanded && (
                  <div className="mt-1.5 ml-3 space-y-0.5 border-l-2 border-white/5 pl-3">
                    {section.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/app'}
                        className={({ isActive: itemActive }) =>
                          `flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-sm ${
                            itemActive
                              ? `${section.color.activeBg} ${section.color.text} font-medium`
                              : `text-gray-400 hover:bg-white/5 ${section.color.hoverText}`
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
                <span>Team</span>
              </NavLink>
            </div>
          )}
        </nav>

        {/* Fixed Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-[#1a1d24] border-t border-white/10 space-y-2">
          {user && (
            <>
              <div className="text-xs text-gray-400 truncate text-center px-2">{user.email}</div>
              <NavLink
                to="/app/settings"
                className={({ isActive }) =>
                  `w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition text-sm font-medium ${
                    isActive
                      ? 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10'
                      : 'border-white/10 text-gray-400 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <Settings className="w-4 h-4" />
                Settings
              </NavLink>
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

      {/* Onboarding Tutorial */}
      {showTutorial && <Tutorial onComplete={handleTutorialComplete} />}
    </div>
  );
}
