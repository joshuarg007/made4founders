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
  BarChart3,
  TrendingUp,
  Landmark,
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
  Menu,
  X,
  DollarSign,
  CreditCard,
  PieChart,
  Mail,
  FolderLock,
  Calculator,
  Receipt,
  UsersRound,
  Network,
  Palmtree,
  ClipboardList,
  Activity,
  Bell,
  Globe,
  Palette,
  Search,
  Share2,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AssistantProvider } from '../context/AssistantContext';
import Tutorial from './Tutorial';
import SupportWidget from './SupportWidget';
import { AssistantWidget } from './AIAssistant';
import NotificationBell from './NotificationBell';
import { usePageTracking } from '../hooks/useAnalytics';

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
      { to: '/app/getting-started', icon: ClipboardCheck, label: 'Checklist' },
      { to: '/app/daily-brief', icon: ListTodo, label: 'Today' },
      { to: '/app/tasks', icon: Calendar, label: 'Calendar' },
      { to: '/app/activity', icon: Activity, label: 'Activity' },
      { to: '/app/notifications', icon: Bell, label: 'Notifications' },
      { to: '/app/integrations', icon: Plug, label: 'Integrations' },
      { to: '/app/vault', icon: Shield, label: 'Credential Vault' },
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
      { to: '/app/web-presence', icon: Globe, label: 'Web Presence' },
      { to: '/app/branding', icon: Palette, label: 'Brand Identity' },
      { to: '/app/seo', icon: Search, label: 'SEO' },
      { to: '/app/social-hub', icon: Share2, label: 'Social Hub' },
      { to: '/app/analytics', icon: BarChart3, label: 'Analytics' },
      { to: '/app/marketplaces', icon: Store, label: 'Markets' },
      { to: '/app/market-intelligence', icon: TrendingUp, label: 'Intelligence' },
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
      { to: '/app/financial-dashboard', icon: DollarSign, label: 'Cash & Runway' },
      { to: '/app/revenue', icon: CreditCard, label: 'Revenue (MRR)' },
      { to: '/app/cap-table', icon: PieChart, label: 'Cap Table' },
      { to: '/app/investor-updates', icon: Mail, label: 'Investor Updates' },
      { to: '/app/data-room', icon: FolderLock, label: 'Data Room' },
      { to: '/app/guests', icon: UserPlus, label: 'Guest Access' },
      { to: '/app/budget', icon: Calculator, label: 'Budget' },
      { to: '/app/invoices', icon: Receipt, label: 'Invoices' },
      { to: '/app/finance', icon: Landmark, label: 'Accounts' },
    ],
  },
  {
    id: 'team',
    label: 'Team',
    icon: UsersRound,
    color: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      activeBg: 'bg-amber-500/20',
      border: 'border-amber-500/30',
      hoverText: 'hover:text-amber-400',
    },
    items: [
      { to: '/app/team', icon: UsersRound, label: 'Directory' },
      { to: '/app/team?tab=org-chart', icon: Network, label: 'Org Chart' },
      { to: '/app/team?tab=pto', icon: Palmtree, label: 'PTO' },
      { to: '/app/team?tab=onboarding', icon: ClipboardList, label: 'Onboarding' },
    ],
  },
];

function LayoutContent() {
  const { user, logout, refreshUser } = useAuth();
  const location = useLocation();

  // Track page views
  usePageTracking();

  const [showTutorial, setShowTutorial] = useState(() => {
    // Show tutorial if user hasn't completed onboarding
    return false; // Will be set by useEffect after user loads
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-50 md:hidden bg-[#1a1d24] border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <Link to="/app">
          <img src="/made4founders-logo-horizontal.png" alt="Made4Founders" className="h-8 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-[#1a1d24]/5 text-white hover:bg-[#1a1d24]/10 transition"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - responsive */}
      <aside className={`
        fixed md:relative z-50 md:z-auto
        w-72 md:w-64 h-full
        bg-[#1a1d24] border-r border-white/10
        flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-4 border-b border-white/10">
          <Link to="/app" className="hover:opacity-80 transition-opacity" onClick={() => setMobileMenuOpen(false)}>
            <img src="/made4founders-logo-horizontal.png" alt="Made4Founders" className="h-14 w-auto" />
          </Link>
        </div>

        {/* Navigation - with bottom padding for fixed footer */}
        <nav className="flex-1 p-3 overflow-y-auto pb-48 space-y-1">
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
                      : 'hover:bg-[#1a1d24]/5 border-transparent'
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
                    {section.items.map((item) => {
                      // Custom isActive check that includes query params
                      const currentPath = location.pathname + location.search;
                      const itemPath = item.to;
                      // For items without query params, check exact match or if it's the base path without any tab
                      const isItemActive = itemPath.includes('?')
                        ? currentPath === itemPath
                        : currentPath === itemPath || (location.pathname === itemPath && !location.search);

                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.to === '/app'}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-sm ${
                            isItemActive
                              ? `${section.color.activeBg} ${section.color.text} font-medium`
                              : `text-gray-400 hover:bg-[#1a1d24]/5 ${section.color.hoverText}`
                          }`}
                        >
                          <item.icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </NavLink>
                      );
                    })}
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
                      ? 'bg-[#1a1d24]/10 text-white'
                      : 'text-gray-400 hover:bg-[#1a1d24]/5 hover:text-white'
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
              <div className="hidden md:flex items-center justify-center gap-2 pb-1">
                <NotificationBell />
              </div>
              <div className="text-xs text-gray-400 truncate text-center px-2">{user.email}</div>
              <NavLink
                to="/app/settings"
                className={({ isActive }) =>
                  `w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition text-sm font-medium ${
                    isActive
                      ? 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10'
                      : 'border-white/10 text-gray-400 hover:bg-[#1a1d24]/5 hover:text-white'
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
          <div className="flex flex-col items-center gap-2">
            <div className="text-[10px] text-gray-500 text-center space-y-1">
              <div>Made4Founders v1.0</div>
              <a
                href="https://www.axiondeep.com"
                target="_blank"
                rel="noopener"
                className="text-gray-600 hover:text-gray-400 transition"
              >
                Built by Axion Deep Labs
              </a>
            </div>
            <img src="/qr-code.png" alt="Scan to visit Axion Deep" className="w-16 h-16 rounded mt-2" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative pt-14 md:pt-0 bg-[#0f1117]">
        <Outlet />
      </main>

      {/* Onboarding Tutorial */}
      {showTutorial && <Tutorial onComplete={handleTutorialComplete} />}

      {/* Support Widget */}
      <SupportWidget userEmail={user?.email || undefined} userName={user?.name || undefined} />

      {/* AI Assistant Widget */}
      <AssistantWidget />
    </div>
  );
}

// Wrap Layout with AssistantProvider
export default function LayoutWithAssistant() {
  return (
    <AssistantProvider>
      <LayoutContent />
    </AssistantProvider>
  );
}
