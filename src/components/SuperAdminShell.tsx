import { useState, useEffect } from 'react';
import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import {
  Server, Users, Lock, Activity, Database, Activity as ActivityIcon,
  Settings2, Shield, Menu, X, LogOut
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../context';
import { Button } from '../components/ui/Button';
import { SuperAdminWorkspaces } from '../pages/SuperAdminWorkspaces';
import { SuperAdminUsers } from '../pages/SuperAdminUsers';
import { SuperAdminPermissions } from '../pages/SuperAdminPermissions';
import { SuperAdminAudit } from '../pages/SuperAdminAudit';
import { SuperAdminBackups } from '../pages/SuperAdminBackups';
import { SuperAdminHealth } from '../pages/SuperAdminHealth';
import { SuperAdminSettings } from '../pages/SuperAdminSettings';
import { SuperAdminPortalPermissions } from '../pages/SuperAdminPortalPermissions';

type PlatformAdmin = { id: string; name: string; email: string };

const SIDE_NAV = [
  { to: '/platform-admin', label: 'Workspaces', icon: <Server size={18} /> },
  { to: '/platform-admin/users', label: 'Users', icon: <Users size={18} /> },
  { to: '/platform-admin/permissions', label: 'Workspace Matrix', icon: <Lock size={18} /> },
  { to: '/platform-admin/portal-permissions', label: 'Portal Permissions', icon: <Shield size={18} /> },
  { to: '/platform-admin/audit', label: 'Audit Log', icon: <Activity size={18} /> },
  { to: '/platform-admin/backups', label: 'Backups', icon: <Database size={18} /> },
  { to: '/platform-admin/health', label: 'System Health', icon: <ActivityIcon size={18} /> },
  { to: '/platform-admin/settings', label: 'Settings', icon: <Settings2 size={18} /> },
];

export function SuperAdminShell() {
  const toast = useToast();
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const checkSession = async () => {
    try {
      const res = await api.get('/platform-admin/auth/me');
      if (res.data?.admin) {
        setAdmin(res.data.admin);
      }
    } catch (err) {
      setAdmin(null);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await api.post('/platform-admin/auth/login', {
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword
      });
      if (res.data?.token) {
        localStorage.setItem('erp_platform_token', res.data.token);
      }
      toast('Platform Super Admin authenticated successfully', 'success');
      setAdmin(res.data.admin);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Invalid platform admin credentials', 'error');
    } finally { setLoading(false); }
  };

  const handleLogout = async () => {
    try {
      await api.post('/platform-admin/auth/logout', {});
    } catch (e) {
      // Ignore network errors
    }
    localStorage.removeItem('erp_platform_token');
    setAdmin(null);
  };

  useEffect(() => { checkSession(); }, []);

  const inputCls = "w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all";

  if (!admin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-6">
          <div className="text-center space-y-1.5">
            <div className="inline-flex p-3 bg-slate-900 text-white rounded-2xl mb-1 shadow-md">
              <Shield size={26} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Platform Super Admin</h2>
            <p className="text-xs text-slate-500">Authorized personnel only · Operations & Tenant Infrastructure</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Admin Email</label>
              <input
                name="email"
                className={inputCls}
                type="email"
                required
                autoComplete="username"
                placeholder="admin@platform.io"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Security Key / Password</label>
              <div className="relative">
                <input
                  name="password"
                  className={`${inputCls} pr-10`}
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer text-xs font-medium"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 justify-center bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl mt-2 cursor-pointer shadow-md"
            >
              {loading ? 'Authenticating…' : 'Sign In as Platform Admin'}
            </Button>
          </form>

          <div className="text-center pt-2 border-t border-slate-100">
            <a href="/login" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              ← Return to Standard User Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans flex flex-col">
      <header className="shrink-0 bg-white/90 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shadow-2xs z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition cursor-pointer shrink-0 shadow-2xs"
            onClick={() => setSidebarOpen((prev) => !prev)}
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-md font-bold text-lg">
              <Shield size={20} />
            </div>
            <div>
              <strong className="block text-sm font-bold text-slate-900 leading-tight">Platform Super Admin</strong>
              <span className="text-[11px] font-semibold text-slate-400 capitalize">Platform Wide</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shadow-xs">
              {(admin.name || admin.email || 'A')[0].toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <span className="block text-xs font-bold text-slate-900 leading-tight">{admin.name || 'Super Admin'}</span>
              <span className="block text-[10px] font-semibold text-slate-400 capitalize">Platform Admin</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        <aside
          className={`transition-all duration-300 ease-in-out shrink-0 z-20 h-full p-3 pr-0 overflow-hidden flex flex-col ${
            sidebarOpen
              ? 'w-72 opacity-100'
              : 'w-0 opacity-0 p-0 overflow-hidden pointer-events-none'
          }`}
        >
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs h-full flex flex-col min-h-0 overflow-hidden">
            <nav className="flex-1 overflow-y-auto space-y-1 py-1 pr-1 min-h-0 custom-sidebar-scroll">
              {SIDE_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/platform-admin'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="shrink-0 pt-2 border-t border-slate-100 mt-auto">
              <button
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors w-full cursor-pointer"
                type="button"
                onClick={handleLogout}
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 sm:p-6 min-w-0 h-full overflow-y-auto">
          <Routes>
            <Route path="" element={<SuperAdminWorkspaces />} />
            <Route path="users" element={<SuperAdminUsers />} />
            <Route path="permissions" element={<SuperAdminPermissions />} />
            <Route path="portal-permissions" element={<SuperAdminPortalPermissions />} />
            <Route path="audit" element={<SuperAdminAudit />} />
            <Route path="backups" element={<SuperAdminBackups />} />
            <Route path="health" element={<SuperAdminHealth />} />
            <Route path="settings" element={<SuperAdminSettings />} />
            <Route path="*" element={<Navigate to="/platform-admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}