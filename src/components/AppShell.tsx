import { useEffect, useRef, useState, createContext, useContext, useMemo } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Moon,
  Package2,
  ReceiptText,
  RefreshCcw,
  Search,
  Settings,
  ShoppingCart,
  Sun,
  Users,
  Warehouse,
  ShoppingBag,
  RotateCcw,
  Link2,
  User,
  UserPlus,
  CheckCircle2,
  ChevronDown,
  X,
  Sparkles
} from 'lucide-react';
import { api } from '../lib/api';
import { WorkspaceContext, useToast } from '../context';
import type { UserSummary, Workspace } from '../lib/types';
import { setGlobalNumberSystem } from '../lib/utils';
import { DashboardPage } from '../pages/DashboardPage';
import { AiAnalyticsPage } from '../pages/AiAnalyticsPage';
import { ProcurementPage } from '../pages/ProcurementPage';
import { SalesPage } from '../pages/SalesPage';
import { ExpensesPage } from '../pages/ExpensesPage';
import { InventoryPage } from '../pages/InventoryPage';
import { CatalogPage } from '../pages/CatalogPage';
import { PeoplePage } from '../pages/PeoplePage';
import { ReportsPage } from '../pages/ReportsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { SuperAdminPage } from '../pages/SuperAdminPage';
import { LocationsPage } from '../pages/LocationsPage';
import { StockTransferPage } from '../pages/StockTransferPage';
import { ProductionRunsPage } from '../pages/ProductionRunsPage';
import { ProductionShiftLogPage } from '../pages/ProductionShiftLogPage';
import { ReturnRequestsPage } from '../pages/ReturnRequestsPage';
import { ProfilePage } from '../pages/ProfilePage';
import { UsersPage } from '../pages/UsersPage';
import { OnboardingWizard } from '../pages/OnboardingWizard';

import { PortalOrdersPage } from '../pages/portal/PortalOrdersPage';
import { PortalPaymentsPage } from '../pages/portal/PortalPaymentsPage';
import { PortalReturnsPage } from '../pages/portal/PortalReturnsPage';
import { PortalConnectionsPage } from '../pages/portal/PortalConnectionsPage';
import { PortalProfilePage } from '../pages/portal/PortalProfilePage';

import { ReadOnlyBanner } from './ui/ReadOnlyBanner';

export type GlobalUser = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  company_name?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  business_type?: string;
  email_verified: boolean;
  created_at?: string;
};

export type WorkspaceConnection = {
  membership_id: string;
  company_id: string;
  entity_id: string;
  portal_type: 'vendor' | 'customer';
  membership_status: string;
  company_name: string;
  company_code: string;
  logo_url?: string;
  currency?: string;
  support_email?: string;
  support_phone?: string;
  company_status: string;
  requested_at?: string;
  joined_at?: string;
};

interface PortalContextType {
  user: GlobalUser | null;
  activeConnections: WorkspaceConnection[];
  pendingRequests: WorkspaceConnection[];
  activeWorkspace: WorkspaceConnection | null;
  setActiveWorkspace: (ws: WorkspaceConnection) => void;
  loading: boolean;
  refreshData: () => Promise<void>;
  logout: () => void;
}

const PortalContext = createContext<PortalContextType | undefined>(undefined);

export function usePortal() {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('usePortal must be used within an AppShell');
  }
  return context;
}

function RoleGuard({
  module,
  userRoles,
  userPermissions,
  allowedRoles,
  children
}: {
  module?: string;
  userRoles: string[];
  userPermissions?: any[];
  allowedRoles: string[];
  children: React.ReactNode;
}) {
  if (userRoles.includes('owner') || userRoles.includes('admin')) {
    return <>{children}</>;
  }

  // If live permissions from backend exist, check can_view for this module
  if (module && userPermissions && Array.isArray(userPermissions) && userPermissions.length > 0) {
    const perm = userPermissions.find((p: any) => p.module === module);
    if (perm !== undefined) {
      if (perm.can_view === 1 || perm.can_view === true) {
        return <>{children}</>;
      }
      return <Navigate to="/" replace />;
    }
  }

  if (!module && userRoles.some((r) => allowedRoles.includes(r))) {
    return <>{children}</>;
  }

  return <Navigate to="/" replace />;
}

export function AppShell({
  user,
  workspace,
  onLogout,
  reloadWorkspace
}: {
  user: UserSummary;
  workspace: Workspace | null;
  onLogout: () => void;
  reloadWorkspace: () => Promise<void>;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const isPartnerPortal = location.pathname.startsWith('/portal') || user.role === 'vendor' || user.role === 'customer';

  // Partner Portal State
  const [portalUser, setPortalUser] = useState<GlobalUser | null>(null);
  const [activeConnections, setActiveConnections] = useState<WorkspaceConnection[]>([]);
  const [pendingRequests, setPendingRequests] = useState<WorkspaceConnection[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<WorkspaceConnection | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // ERP Workspace State
  const [alerts, setAlerts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [showAlerts, setShowAlerts] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dark, setDark] = useState(
    localStorage.getItem('theme') === 'dark' || document.documentElement.classList.contains('dark')
  );

  const alertsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const userRoles: string[] = useMemo(() => {
    if (isPartnerPortal) {
      return [activeWorkspace?.portal_type || user.role || 'vendor'];
    }
    let roles: string[] = [];
    const rawRoles = user.roles || (user as any).roles;
    if (Array.isArray(rawRoles) && rawRoles.length > 0) {
      roles = rawRoles.map((r) => String(r).trim()).filter(Boolean);
    } else if (typeof rawRoles === 'string' && rawRoles.trim().length > 0) {
      const trimmed = rawRoles.trim();
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) roles = parsed.map((r: any) => String(r).trim()).filter(Boolean);
        } catch {
          roles = trimmed.split(',').map((r: string) => r.trim()).filter(Boolean);
        }
      } else {
        roles = trimmed.split(',').map((r: string) => r.trim()).filter(Boolean);
      }
    }
    if (roles.length === 0 && user.role) {
      roles = [user.role];
    }
    return roles.length > 0 ? roles : ['staff'];
  }, [user.role, user.roles, isPartnerPortal, activeWorkspace]);


  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
      document.documentElement.dataset.theme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.dataset.theme = 'light';
    }
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  // Fetch Portal Data when in Partner Portal
  const fetchPortalData = async () => {
    try {
      setPortalLoading(true);
      const res = await api.get('/portal/connections');
      if (res.data?.ok) {
        setPortalUser(res.data.user);
        const conns: WorkspaceConnection[] = res.data.active_connections || [];
        setActiveConnections(conns);
        setPendingRequests(res.data.pending_requests || []);

        const savedCompanyId = localStorage.getItem('erp_portal_active_company_id');
        const found = conns.find((c) => c.company_id === savedCompanyId) || conns[0] || null;
        setActiveWorkspaceState(found);
        if (found && !savedCompanyId) {
          localStorage.setItem('erp_portal_active_company_id', found.company_id);
        }
      }
    } catch (err: any) {
      setPortalUser(null);
      if (err.response?.status === 401 && isPartnerPortal) {
        navigate('/login?portal=partner');
      }
    } finally {
      setPortalLoading(false);
    }
  };

  useEffect(() => {
    if (isPartnerPortal) {
      fetchPortalData();
    }
  }, [isPartnerPortal]);

  // Load workspace data if missing (e.g. after ERP login which doesn't return workspace object)
  useEffect(() => {
    if (isPartnerPortal) return;
    if (!workspace) {
      reloadWorkspace();
    }
  }, []);

  useEffect(() => {
    if (isPartnerPortal) return;
    api.get('/api/inventory/alerts').then((res) => setAlerts(res.data)).catch(() => undefined);
  }, [isPartnerPortal]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
        setShowAlerts(false);
      }
    }
    if (showAlerts) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAlerts]);

  // Global Ctrl+K / Cmd+K listener to focus search bar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside listener to close search dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced API search
  useEffect(() => {
    if (isPartnerPortal || !search.trim()) {
      setResults([]);
      setSearchLoading(false);
      setSelectedIndex(-1);
      return;
    }
    setSearchLoading(true);
    setSearchOpen(true);
    const timeout = window.setTimeout(() => {
      api.get('/api/global-search', { params: { q: search.trim() } })
        .then((res) => {
          setResults(Array.isArray(res.data) ? res.data : []);
          setSelectedIndex(-1);
        })
        .catch(() => setResults([]))
        .finally(() => setSearchLoading(false));
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [search, isPartnerPortal]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setSearchOpen(false);
      searchInputRef.current?.blur();
      return;
    }
    if (!results.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = selectedIndex >= 0 && selectedIndex < results.length ? results[selectedIndex] : results[0];
      if (target) {
        handleSelectResult(target);
      }
    }
  };

  const handleSelectResult = (item: any) => {
    setSearchOpen(false);
    setSearch('');
    setResults([]);
    navigate(item.link);
  };

  const setActiveWorkspace = (ws: WorkspaceConnection) => {
    setActiveWorkspaceState(ws);
    localStorage.setItem('erp_portal_active_company_id', ws.company_id);
    setSwitcherOpen(false);
    toast(`Switched workspace context to ${ws.company_name}`, 'info');
  };

  const handlePartnerLogout = async () => {
    try {
      await api.post('/portal/auth/logout');
    } catch {}
    localStorage.removeItem('erp_portal_token');
    localStorage.removeItem('erp_portal_user');
    localStorage.removeItem('erp_portal_active_company_id');
    setPortalUser(null);
    setActiveConnections([]);
    setPendingRequests([]);
    setActiveWorkspaceState(null);
    toast('Logged out from Partner Portal', 'info');
    navigate('/login');
  };

  const isOwnerOrAdmin = userRoles.includes('owner') || userRoles.includes('admin');

  const canAccessModule = (moduleName: string): boolean => {
    if (moduleName === 'profile') return true;
    if (userRoles.includes('owner') || userRoles.includes('admin')) return true;
    if (moduleName === 'settings') return false;

    if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
      const perm = user.permissions.find((p: any) => p.module === moduleName);
      if (perm !== undefined) {
        return perm.can_view === 1 || perm.can_view === true;
      }
    }

    return false;
  };

  // Nav Items for ERP Workspace (Users and Invited Users accessible via Settings tabs or direct links)
  const erpNav = [
    { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} />, module: 'dashboard', roles: ['owner', 'admin', 'manager', 'accounts', 'production_manager', 'sales_manager', 'staff'] },
    { to: '/ai-analytics', label: 'AI Analytics', icon: <Sparkles size={18} className="text-emerald-500" />, module: 'ai_analytics', roles: ['owner', 'admin', 'manager', 'accounts', 'production_manager', 'sales_manager', 'staff'] },
    { to: '/people', label: 'Parties & People', icon: <Users size={18} />, module: 'parties', roles: ['owner', 'admin', 'manager', 'accounts', 'sales_manager'] },
    { to: '/users', label: 'Users & Team', icon: <UserPlus size={18} />, module: 'users', roles: ['owner', 'admin', 'manager'] },
    { to: '/catalog', label: 'Catalog & Items', icon: <Package2 size={18} />, module: 'catalog', roles: ['owner', 'admin', 'manager', 'accounts', 'production_manager', 'sales_manager'] },
    { to: '/procurement', label: 'Procurement', icon: <ReceiptText size={18} />, module: 'procurement', roles: ['owner', 'admin', 'manager', 'accounts', 'production_manager'] },
    { to: '/production', label: 'Production', icon: <Boxes size={18} />, module: 'production', roles: ['owner', 'admin', 'manager', 'production_manager', 'staff'] },
    { to: '/shift-logs', label: 'Shift Log', icon: <ClipboardList size={18} />, module: 'shift_log', roles: ['owner', 'admin', 'manager', 'production_manager', 'staff'] },
    { to: '/sales', label: 'Sales', icon: <ShoppingCart size={18} />, module: 'sales', roles: ['owner', 'admin', 'manager', 'accounts', 'sales_manager', 'staff'] },
    { to: '/expenses', label: 'Expenses', icon: <CircleDollarSign size={18} />, module: 'expenses', roles: ['owner', 'admin', 'manager', 'accounts'] },
    { to: '/inventory', label: 'Inventory', icon: <Warehouse size={18} />, module: 'inventory', roles: ['owner', 'admin', 'manager', 'accounts', 'production_manager', 'sales_manager', 'staff'] },
    { to: '/stock-transfers', label: 'Stock Transfers', icon: <ArrowLeftRight size={18} />, module: 'stock_transfers', roles: ['owner', 'admin', 'manager', 'production_manager'] },
    { to: '/locations', label: 'Locations', icon: <MapPin size={18} />, module: 'locations', roles: ['owner', 'admin', 'manager', 'accounts', 'production_manager'] },
    { to: '/return-requests', label: 'Returns & Cancellations', icon: <RefreshCcw size={18} />, module: 'returns', roles: ['owner', 'admin', 'manager', 'sales_manager'] },
    { to: '/reports', label: 'Reports', icon: <FileBarChart size={18} />, module: 'reports', roles: ['owner', 'admin', 'manager', 'accounts', 'sales_manager', 'production_manager'] },
    ...(isOwnerOrAdmin
      ? [{ to: '/settings', label: 'Settings', icon: <Settings size={18} />, module: 'settings', roles: ['owner', 'admin'] }]
      : [{ to: '/profile', label: 'Profile', icon: <User size={18} />, module: 'profile', roles: ['manager', 'accounts', 'production_manager', 'sales_manager', 'staff'] }]
    )
  ].filter((item) => canAccessModule(item.module));

  // Nav Items for Partner Portal
  const partnerNav = [
    { to: '/portal/orders', label: 'Orders & Dispatches', icon: <ShoppingBag size={18} /> },
    { to: '/portal/payments', label: 'Payments & Ledger', icon: <CircleDollarSign size={18} /> },
    { to: '/portal/returns', label: 'Returns & Disputes', icon: <RotateCcw size={18} /> },
    { to: '/portal/connections', label: 'Connections', icon: <Link2 size={18} />, badge: pendingRequests.length > 0 ? pendingRequests.length : undefined },
    { to: '/portal/profile', label: 'Business Profile', icon: <User size={18} /> }
  ];

  const currentNav = isPartnerPortal ? partnerNav : erpNav;

  const roleLabelMap: Record<string, string> = {
    owner: 'Owner / Admin',
    admin: 'Administrator',
    manager: 'Manager',
    accounts: 'Accounts Manager',
    production_manager: 'Production Manager',
    sales_manager: 'Sales Manager',
    staff: 'Staff Member',
    vendor: 'Vendor / Supplier',
    customer: 'Customer / Buyer'
  };

  useEffect(() => {
    const sys = workspace?.number_system || (activeWorkspace as any)?.number_system;
    if (sys) {
      setGlobalNumberSystem(sys);
    }
  }, [workspace?.number_system, (activeWorkspace as any)?.number_system]);

  const portalContextValue: PortalContextType = {
    user: portalUser,
    activeConnections,
    pendingRequests,
    activeWorkspace,
    setActiveWorkspace,
    loading: portalLoading,
    refreshData: fetchPortalData,
    logout: handlePartnerLogout
  };

  return (
    <PortalContext.Provider value={portalContextValue}>
      <WorkspaceContext.Provider value={{ workspace, user, reloadWorkspace }}>
        <div className="h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans flex flex-col">
          {/* Full-Width Independent Topbar Header */}
          <header className="shrink-0 bg-white/90 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shadow-2xs z-30">
            <div className="flex items-center gap-3">
              {/* Sidebar Toggle Button */}
              <button
                type="button"
                title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition cursor-pointer shrink-0 shadow-2xs"
                onClick={() => setSidebarOpen((prev) => !prev)}
              >
                <Menu size={18} />
              </button>

              {/* ERP Omnisearch Bar or Partner Workspace Switcher */}
              {!isPartnerPortal ? (
                <div className="relative w-64 sm:w-80 lg:w-[420px]" ref={searchRef}>
                  <div className="flex items-center gap-2 bg-slate-100/80 hover:bg-slate-100/95 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-2xs">
                    <Search size={15} className="text-slate-400 shrink-0 pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onFocus={() => { if (search.trim()) setSearchOpen(true); }}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="Search customers, vendors, products, runs..."
                      className="w-full bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      {search ? (
                        <button
                          type="button"
                          onClick={() => { setSearch(''); setResults([]); setSearchOpen(false); }}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      ) : (
                        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 rounded shadow-2xs">
                          Ctrl K
                        </kbd>
                      )}
                    </div>
                  </div>

                  {/* Floating Search Results Dropdown */}
                  {searchOpen && search.trim() && (
                    <div className="absolute left-0 top-full mt-2 w-[340px] sm:w-[480px] max-w-[90vw] bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 overflow-hidden max-h-96 flex flex-col animate-in fade-in">
                      <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span>Results for <strong className="text-slate-800">"{search}"</strong></span>
                        {searchLoading ? (
                          <span className="text-blue-600 font-semibold flex items-center gap-1">Searching...</span>
                        ) : (
                          <span>{results.length} found</span>
                        )}
                      </div>

                      <div className="overflow-y-auto p-1.5 space-y-0.5 divide-y divide-slate-50">
                        {searchLoading && results.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-400">Searching across records...</div>
                        ) : results.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-500">
                            <p className="font-semibold text-slate-700 mb-1">No matches found for "{search}"</p>
                            <p className="text-[11px] text-slate-400">Search by item name, customer, vendor, invoice #, PO #, or warehouse.</p>
                          </div>
                        ) : (
                          results.map((item, idx) => {
                            const isSelected = selectedIndex === idx;
                            return (
                              <button
                                key={`${item.category}-${item.id}-${idx}`}
                                type="button"
                                onClick={() => handleSelectResult(item)}
                                onMouseEnter={() => setSelectedIndex(idx)}
                                className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-50 text-blue-900 border border-blue-200/60'
                                    : 'hover:bg-slate-50 text-slate-800 border border-transparent'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                    item.category === 'product' ? 'bg-indigo-50 text-indigo-600' :
                                    item.category === 'customer' ? 'bg-blue-50 text-blue-600' :
                                    item.category === 'vendor' ? 'bg-purple-50 text-purple-600' :
                                    item.category === 'sale' ? 'bg-emerald-50 text-emerald-600' :
                                    item.category === 'procurement' ? 'bg-amber-50 text-amber-600' :
                                    item.category === 'production' ? 'bg-orange-50 text-orange-600' :
                                    item.category === 'shift_log' ? 'bg-cyan-50 text-cyan-600' :
                                    item.category === 'location' ? 'bg-teal-50 text-teal-600' :
                                    item.category === 'user' ? 'bg-rose-50 text-rose-600' :
                                    'bg-slate-100 text-slate-600'
                                  }`}>
                                    {item.category === 'product' && <Package2 size={14} />}
                                    {item.category === 'customer' && <Users size={14} />}
                                    {item.category === 'vendor' && <ShoppingBag size={14} />}
                                    {item.category === 'sale' && <ReceiptText size={14} />}
                                    {item.category === 'procurement' && <ShoppingCart size={14} />}
                                    {item.category === 'production' && <Boxes size={14} />}
                                    {item.category === 'shift_log' && <ClipboardList size={14} />}
                                    {item.category === 'location' && <Warehouse size={14} />}
                                    {item.category === 'user' && <User size={14} />}
                                    {item.category === 'page' && <LayoutDashboard size={14} />}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold truncate text-slate-900">{item.title}</p>
                                    <p className="text-[11px] text-slate-500 truncate">{item.subtitle}</p>
                                  </div>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 border ${
                                  item.category === 'product' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                  item.category === 'customer' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                  item.category === 'vendor' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                  item.category === 'sale' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  item.category === 'procurement' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  item.category === 'production' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                  item.category === 'shift_log' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' :
                                  item.category === 'location' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                                  item.category === 'user' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                  'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                  {item.badge || item.category}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>

                      {/* Dropdown footer with navigation hints */}
                      <div className="px-3.5 py-1.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Navigate <kbd className="px-1 py-0.2 bg-white border border-slate-200 rounded text-slate-500 font-semibold">↑</kbd> <kbd className="px-1 py-0.2 bg-white border border-slate-200 rounded text-slate-500 font-semibold">↓</kbd> • Open <kbd className="px-1 py-0.2 bg-white border border-slate-200 rounded text-slate-500 font-semibold">↵</kbd></span>
                        <span>ESC to close</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  {activeConnections.length > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setSwitcherOpen(!switcherOpen)}
                        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-100/80 hover:bg-white text-left transition cursor-pointer"
                      >
                        <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {(activeWorkspace?.company_name || 'E')[0]}
                        </div>
                        <div className="min-w-0 max-w-[180px] sm:max-w-xs">
                          <div className="flex items-center gap-1.5">
                            <strong className="text-xs font-bold text-slate-900 truncate">
                              {activeWorkspace?.company_name || 'Select Workspace'}
                            </strong>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                              activeWorkspace?.portal_type === 'vendor'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {activeWorkspace?.portal_type}
                            </span>
                          </div>
                        </div>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${switcherOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {switcherOpen && (
                        <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in space-y-1">
                          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                            <span>Connected Workspaces</span>
                            <span>{activeConnections.length}</span>
                          </div>
                          {activeConnections.map((ws) => (
                            <button
                              key={ws.company_id}
                              type="button"
                              onClick={() => setActiveWorkspace(ws)}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition cursor-pointer ${
                                activeWorkspace?.company_id === ws.company_id
                                  ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                                  : 'text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <div className="min-w-0 flex-1 pr-2">
                                <p className="truncate font-semibold text-slate-900">{ws.company_name}</p>
                                <p className="text-[10px] text-slate-400">{ws.company_code} • {ws.portal_type.toUpperCase()}</p>
                              </div>
                              {activeWorkspace?.company_id === ws.company_id && (
                                <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                              )}
                            </button>
                          ))}
                          <div className="pt-1.5 border-t border-slate-100">
                            <Link
                              to="/portal/connections"
                              onClick={() => setSwitcherOpen(false)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:bg-slate-50 p-2 rounded-xl transition"
                            >
                              <Link2 size={14} /> Connect Another Workspace
                            </Link>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                      No Active Connection
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Topbar Right Actions */}
            <div className="flex items-center gap-3">
              {/* Dark Mode Quick Toggle */}
              <button
                type="button"
                title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                onClick={() => setDark((prev) => !prev)}
              >
                {dark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-600" />}
              </button>

              {/* Alert Bell (ERP Internal Roles Only) */}
              {!isPartnerPortal && (
                <div className="relative" ref={alertsRef}>
                  <button
                    type="button"
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition cursor-pointer relative"
                    onClick={() => setShowAlerts(prev => !prev)}
                  >
                    <AlertTriangle size={18} />
                    {alerts.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {alerts.length}
                      </span>
                    )}
                  </button>

                  {showAlerts && (
                    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-slate-200/90 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in">
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-50/90 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={15} className="text-amber-500" />
                          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Multi-Location Alerts</h3>
                        </div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">{alerts.length}</span>
                      </div>
                      <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                        {alerts.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-500">
                            <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-1.5" />
                            All stock levels and branch facilities are healthy
                          </div>
                        ) : (
                          alerts.slice(0, 15).map((alert: any, index: number) => {
                            const isHigh = alert.severity === 'high' || alert.status === 'Out';
                            return (
                              <div key={index} className="p-3.5 hover:bg-slate-50/80 transition space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                      {alert.location_name && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider shrink-0">
                                          {alert.location_name}
                                        </span>
                                      )}
                                      <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase ${
                                        isHigh ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                      }`}>
                                        {alert.status === 'Out' ? 'Out of Stock' : alert.status === 'Low' ? 'Low Stock' : alert.severity || 'Warning'}
                                      </span>
                                    </div>
                                    <strong className="font-semibold text-slate-900 text-xs block leading-tight">
                                      {alert.name || alert.title}
                                    </strong>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                      {alert.status
                                        ? `Local Stock: ${alert.current_stock ?? 0} ${alert.unit || ''}`
                                        : alert.title}
                                    </p>
                                  </div>
                                </div>

                                {/* Intelligent Inter-Branch Transfer Recommendation */}
                                {alert.transfer_opportunity && (
                                  <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-200/80 flex items-center justify-between gap-2 text-[11px]">
                                    <div className="text-emerald-900 min-w-0 truncate">
                                      💡 <strong>{alert.transfer_opportunity.available_stock} {alert.unit}</strong> at {alert.transfer_opportunity.from_location_name}
                                    </div>
                                    <Link
                                      to={`/inventory/stock-transfers?from=${encodeURIComponent(alert.transfer_opportunity.from_location_id)}&to=${encodeURIComponent(alert.location_id || '')}&item=${encodeURIComponent(alert.entity_id || '')}`}
                                      onClick={() => setShowAlerts(false)}
                                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold tracking-wide transition shrink-0"
                                    >
                                      Transfer →
                                    </Link>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                      {alerts.length > 0 && (
                        <div className="p-2 bg-slate-50 border-t border-slate-100 text-center">
                          <Link
                            to="/dashboard"
                            onClick={() => setShowAlerts(false)}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 block py-1"
                          >
                            View All Risks on Dashboard →
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* User Profile Badge */}
              <Link
                to={isPartnerPortal ? '/portal/profile' : '/profile'}
                title="View Profile"
                className="flex items-center gap-2.5 pl-2 border-l border-slate-200 hover:opacity-85 transition cursor-pointer group"
              >
                {(!isPartnerPortal && (user as any).avatar_url) ? (
                  <img
                    src={(user as any).avatar_url}
                    alt={user.name || 'User'}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-xs group-hover:ring-2 group-hover:ring-blue-500/30 transition-all"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-xs group-hover:ring-2 group-hover:ring-blue-500/30 transition-all">
                    {isPartnerPortal
                      ? ((portalUser?.company_name || portalUser?.name || 'P')[0].toUpperCase())
                      : ((user.name || user.email || 'U')[0].toUpperCase())}
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <span className="block text-xs font-bold text-slate-900 leading-tight truncate max-w-[140px] group-hover:text-blue-600 transition-colors">
                    {isPartnerPortal ? (portalUser?.company_name || portalUser?.name || 'Partner') : (user.name || 'User')}
                  </span>
                  <span className="block text-[10px] font-semibold text-slate-400 capitalize">
                    {isPartnerPortal
                      ? (activeWorkspace ? `${activeWorkspace.portal_type} partner` : 'Partner Account')
                      : userRoles.map((r) => roleLabelMap[r] || r.replace('_', ' ')).join(' • ')}
                  </span>
                </div>
              </Link>
            </div>
          </header>

          {!isPartnerPortal && <ReadOnlyBanner />}

          {/* Content Body Layout */}
          <div className="flex flex-1 min-h-0 overflow-hidden relative">
            {/* Fixed Sidebar */}
            <aside
              className={`transition-all duration-300 ease-in-out shrink-0 z-20 h-full p-3 pr-0 overflow-hidden flex flex-col ${
                sidebarOpen
                  ? 'w-72 opacity-100'
                  : 'w-0 opacity-0 p-0 overflow-hidden pointer-events-none'
              }`}
            >
              <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs h-full flex flex-col min-h-0 overflow-hidden">
                {/* Brand Header */}
                <div className="shrink-0 flex items-center gap-3 px-1 py-1 pb-3 border-b border-slate-100">
                  {isPartnerPortal ? (
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0 font-bold text-lg">
                      {(activeWorkspace?.company_name || portalUser?.company_name || 'P')[0]}
                    </div>
                  ) : workspace?.logo_url ? (
                    <img src={workspace.logo_url} alt="Logo" className="w-10 h-10 rounded-xl object-contain border border-slate-200 p-0.5 shrink-0 bg-white" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0 font-bold text-lg">
                      {(workspace?.name || 'E')[0]}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <strong className="block text-sm font-bold text-slate-900 leading-tight break-words">
                      {isPartnerPortal ? (activeWorkspace?.company_name || 'Partner Portal') : (workspace?.name || 'ERP Studio')}
                    </strong>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] font-medium text-slate-500 capitalize">
                        {isPartnerPortal ? (activeWorkspace?.company_code || 'Universal') : (workspace?.plan || 'trial')}
                      </span>
                      <span className="text-slate-300">•</span>
                      <div className="flex flex-wrap items-center gap-1">
                        {isPartnerPortal ? (
                          <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 uppercase tracking-wide">
                            {activeWorkspace?.portal_type || 'partner'}
                          </span>
                        ) : (
                          userRoles.map((r) => (
                            <span
                              key={r}
                              className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 uppercase tracking-wide"
                            >
                              {roleLabelMap[r] || r.replace('_', ' ')}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Navigation List */}
                <nav className="flex-1 overflow-y-auto space-y-1 py-2 pr-1 min-h-0 custom-sidebar-scroll">
                  {currentNav.map((item: any) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/' || item.to === '/production' || item.to === '/shift-logs'}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`
                      }
                    >
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      {item.badge ? (
                        <span className="px-2 py-0.5 bg-amber-500 text-white font-bold text-[10px] rounded-full">
                          {item.badge}
                        </span>
                      ) : null}
                    </NavLink>
                  ))}
                </nav>

                {/* Logout Button Locked at Bottom */}
                <div className="shrink-0 pt-2 border-t border-slate-100 mt-auto">
                  <button
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors w-full cursor-pointer"
                    type="button"
                    onClick={isPartnerPortal ? handlePartnerLogout : onLogout}
                  >
                    <LogOut size={18} />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </aside>

            {/* Main Page Route Views */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 h-full overflow-y-auto bg-slate-50">
              <Routes>
                {/* ERP Internal Routes */}
                <Route path="/" element={
                  userRoles.includes('vendor') || userRoles.includes('customer')
                    ? <Navigate to="/portal/orders" replace />
                    : (workspace && !workspace.onboarding_completed_at && (userRoles.includes('owner') || userRoles.includes('admin')) && sessionStorage.getItem('erp_skip_onboarding') !== 'true')
                      ? <Navigate to="/onboarding" replace />
                      : <RoleGuard module="dashboard" userRoles={userRoles} userPermissions={user.permissions} allowedRoles={['owner', 'admin', 'manager', 'accounts', 'production_manager', 'sales_manager', 'staff']}><DashboardPage /></RoleGuard>
                } />
                <Route path="/dashboard" element={<Navigate to="/" replace />} />
                <Route path="/ai-analytics" element={
                  <RoleGuard module="ai_analytics" userRoles={userRoles} userPermissions={user.permissions} allowedRoles={['owner', 'admin', 'manager', 'accounts', 'production_manager', 'sales_manager', 'staff']}>
                    <AiAnalyticsPage />
                  </RoleGuard>
                } />
                <Route path="/procurement" element={<RoleGuard module="procurement" userRoles={userRoles} userPermissions={user.permissions} allowedRoles={['manager', 'accounts', 'production_manager']}><ProcurementPage /></RoleGuard>} />
                <Route path="/production" element={<RoleGuard module="production" userRoles={userRoles} userPermissions={user.permissions} allowedRoles={['manager', 'production_manager', 'staff']}><ProductionRunsPage /></RoleGuard>} />
                <Route path="/production/runs" element={<RoleGuard module="production" userRoles={userRoles} userPermissions={user.permissions} allowedRoles={['manager', 'production_manager', 'staff']}><ProductionRunsPage /></RoleGuard>} />
                <Route path="/shift-logs" element={<RoleGuard module="shift_log" userRoles={userRoles} userPermissions={user.permissions} allowedRoles={['owner', 'admin', 'manager', 'production_manager', 'staff']}><ProductionShiftLogPage /></RoleGuard>} />
                <Route path="/production/shift-log" element={<Navigate to="/shift-logs" replace />} />
                <Route path="/production/legacy" element={<Navigate to="/production" replace />} />
                <Route path="/sales" element={<RoleGuard module="sales" userRoles={userRoles} userPermissions={user.permissions} allowedRoles={['manager', 'accounts', 'sales_manager', 'staff']}><SalesPage /></RoleGuard>} />
                <Route path="/expenses" element={<RoleGuard module="expenses" userRoles={userRoles} userPermissions={user.permissions} allowedRoles={['manager', 'accounts']}><ExpensesPage /></RoleGuard>} />
                <Route path="/inventory" element={<RoleGuard module="inventory" userRoles={userRoles} userPermissions={user.permissions} allowedRoles={['manager', 'accounts', 'production_manager', 'sales_manager', 'staff']}><InventoryPage /></RoleGuard>} />
                <Route path="/stock-transfers" element={<RoleGuard module="stock_transfers" userRoles={userRoles} userPermissions={user.permissions} allowedRoles={['owner', 'admin', 'manager', 'production_manager', 'staff']}><StockTransferPage /></RoleGuard>} />
                <Route path="/locations" element={<RoleGuard module="locations" userRoles={userRoles} userPermissions={user.permissions} allowedRoles={['manager', 'accounts', 'production_manager']}><LocationsPage /></RoleGuard>} />
                <Route path="/return-requests" element={<RoleGuard module="returns" userRoles={userRoles} userPermissions={user.permissions} allowedRoles={['manager', 'sales_manager']}><ReturnRequestsPage /></RoleGuard>} />
                <Route path="/catalog" element={<RoleGuard module="catalog" userRoles={userRoles} userPermissions={user.permissions} allowedRoles={['manager', 'accounts', 'production_manager', 'sales_manager']}><CatalogPage user={user} /></RoleGuard>} />
                <Route path="/people" element={<RoleGuard module="parties" userRoles={userRoles} userPermissions={user.permissions} allowedRoles={['manager', 'accounts', 'sales_manager']}><PeoplePage /></RoleGuard>} />
                <Route path="/reports" element={<RoleGuard module="reports" userRoles={userRoles} userPermissions={user.permissions} allowedRoles={['manager', 'accounts', 'sales_manager', 'production_manager']}><ReportsPage /></RoleGuard>} />
                <Route path="/users" element={<RoleGuard module="users" userRoles={userRoles} userPermissions={user.permissions} allowedRoles={['owner', 'admin', 'manager']}><UsersPage user={user} /></RoleGuard>} />
                <Route path="/invited-users" element={<Navigate to="/users" replace />} />
                <Route path="/settings/users" element={<Navigate to="/users" replace />} />
                <Route path="/settings/invites" element={<Navigate to="/users" replace />} />
                <Route path="/settings" element={<RoleGuard module="settings" userRoles={userRoles} userPermissions={user.permissions} allowedRoles={['owner', 'admin']}><SettingsPage user={user} /></RoleGuard>} />
                <Route path="/profile" element={<ProfilePage user={user} />} />
                <Route path="/onboarding" element={<OnboardingWizard />} />
                {userRoles.includes('owner') || userRoles.includes('admin') ? <Route path="/super-admin" element={<SuperAdminPage />} /> : null}

                {/* Partner Portal Routes */}
                <Route path="/portal/orders" element={<PortalOrdersPage />} />
                <Route path="/portal/payments" element={<PortalPaymentsPage />} />
                <Route path="/portal/returns" element={<PortalReturnsPage />} />
                <Route path="/portal/connections" element={<PortalConnectionsPage />} />
                <Route path="/portal/profile" element={<PortalProfilePage />} />
                <Route path="/portal/login" element={<Navigate to="/portal/orders" replace />} />
                <Route path="/portal/home" element={<Navigate to="/portal/orders" replace />} />
                <Route path="/portal" element={<Navigate to="/portal/orders" replace />} />

                {/* Fallbacks */}
                <Route path="/vendor-orders" element={<Navigate to="/portal/orders" replace />} />
                <Route path="/vendor-returns" element={<Navigate to="/portal/returns" replace />} />
                <Route path="/customer-orders" element={<Navigate to="/portal/orders" replace />} />
                <Route path="/customer-returns" element={<Navigate to="/portal/returns" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </WorkspaceContext.Provider>
    </PortalContext.Provider>
  );
}
