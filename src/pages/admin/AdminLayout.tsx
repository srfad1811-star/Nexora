import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bell,
  Boxes,
  CreditCard,
  FileText,
  FolderTree,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Package,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  Star,
  Store,
  Sun,
  Tag,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { AdminProvider, useAdmin } from '../../context/AdminContext';

function AdminShell() {
  const { user, staffMember, staffRole, isStaff, authReady, signInWithGoogle, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useStore();
  const { orders, tickets, returns } = useAdmin();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F9] dark:bg-[#0D0E12] text-sm text-zinc-500">
        Verifying session...
      </div>
    );
  }

  if (!user || !isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F9] dark:bg-[#0D0E12] p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-[#6D5BD0]/10 text-[#6D5BD0] flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-xl font-bold">Nexora Admin Console</h1>
            <p className="text-sm text-zinc-500">
              {user
                ? `Signed in as ${user.email}, which does not currently hold active staff permissions.`
                : 'Sign in with an authorized administrator or staff Google account to access store operations.'}
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            {!user ? (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="w-full py-2.5 px-4 rounded-lg bg-[#6D5BD0] text-white text-sm font-medium hover:bg-[#5B49BF]"
              >
                Sign In with Google
              </button>
            ) : (
              <button
                type="button"
                onClick={logout}
                className="w-full py-2.5 px-4 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-medium"
              >
                Switch Account
              </button>
            )}
            <Link to="/" className="text-xs text-zinc-500 hover:underline pt-1">
              Return to Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const openTicketsCount = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;
  const pendingOrdersCount = orders.filter((o) => o.status === 'pending').length;
  const pendingReturnsCount = returns.filter((r) => r.status === 'requested').length;
  const alertTotal = openTicketsCount + pendingOrdersCount + pendingReturnsCount;

  const navGroups = [
    {
      label: 'Operations',
      items: [
        { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/admin/products', label: 'Products', icon: Package },
        { to: '/admin/categories', label: 'Category', icon: FolderTree },
        { to: '/admin/brands', label: 'Brands', icon: Layers },
        { to: '/admin/orders', label: 'Orders', icon: ShoppingCart, badge: pendingOrdersCount },
        { to: '/admin/customers', label: 'Customers', icon: Users },
        { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
      ],
    },
    {
      label: 'Growth & Care',
      items: [
        { to: '/admin/coupons', label: 'Coupons', icon: Tag },
        { to: '/admin/reviews', label: 'Reviews', icon: Star },
        { to: '/admin/returns', label: 'Returns', icon: RotateCcw, badge: pendingReturnsCount },
        { to: '/admin/support', label: 'Messages', icon: MessageSquare, badge: openTicketsCount },
        { to: '/admin/cms', label: 'CMS Content', icon: FileText },
      ],
    },
    {
      label: 'Finance & System',
      items: [
        { to: '/admin/payments', label: 'Payments', icon: CreditCard },
        { to: '/admin/shipping', label: 'Shipping', icon: Truck },
        { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
        { to: '/admin/staff', label: 'Staff & Roles', icon: Shield },
        { to: '/admin/activity-logs', label: 'Activity Logs', icon: Activity },
        { to: '/admin/settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearch.trim()) return;
    navigate(`/admin/products?q=${encodeURIComponent(globalSearch.trim())}`);
  };

  return (
    <div className="min-h-screen flex bg-[#F7F7F9] dark:bg-[#0D0E12] text-zinc-900 dark:text-zinc-100">
      {/* Sidebar — Deep Obsidian matching attached UI aesthetic */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0C0C0E] text-zinc-300 flex flex-col border-r border-zinc-800/70 transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-zinc-800/70 shrink-0">
          <Link to="/admin" className="flex items-center gap-2.5 text-white font-display font-bold text-lg tracking-tight">
            <span className="w-7 h-7 rounded-lg bg-[#6D5BD0] flex items-center justify-center text-xs font-bold">
              N
            </span>
            <span>Nexora</span>
          </Link>
          <button type="button" onClick={() => setSidebarOpen(false)} className="lg:hidden text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="px-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
                {group.label}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3.5 py-2.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-[#6D5BD0] text-white shadow-sm'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`
                    }
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-[#6D5BD0] text-white font-mono tabular-nums">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-zinc-800/70 space-y-1 shrink-0">
          <Link
            to="/"
            className="flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5"
          >
            <Store className="w-4 h-4" />
            <span>View Storefront</span>
          </Link>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-red-400 hover:bg-white/5"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 bg-white dark:bg-[#14161D] border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <form onSubmit={handleGlobalSearch} className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search anything..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#6D5BD0]"
              />
            </form>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <Link
              to="/admin/orders"
              className="relative p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Pending alerts"
            >
              <Bell className="w-4 h-4" />
              {alertTotal > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 text-[10px] font-mono bg-red-500 text-white rounded-full flex items-center justify-center">
                  {alertTotal}
                </span>
              )}
            </Link>

            <div className="flex items-center gap-2.5 pl-2 border-l border-zinc-200 dark:border-zinc-800">
              <div className="w-8 h-8 rounded-full bg-[#6D5BD0] text-white flex items-center justify-center text-xs font-bold shrink-0">
                {(staffMember?.name || user.displayName || 'A')[0].toUpperCase()}
              </div>
              <div className="hidden sm:block leading-tight">
                <p className="text-xs font-semibold">{staffMember?.name || user.displayName || 'Admin'}</p>
                <p className="text-[11px] text-zinc-500 capitalize">{staffRole?.replace('_', ' ') || 'admin'}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AdminLayout() {
  return (
    <AdminProvider>
      <AdminShell />
    </AdminProvider>
  );
}
