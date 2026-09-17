import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from './lib/api';
import { Providers } from './context';
import type { UserSummary, Workspace } from './lib/types';
import { setGlobalNumberSystem } from './lib/utils';
import { AppShell } from './components/AppShell';
import { AuthPage, AcceptInvitePage } from './pages/AuthPage';
import { SuperAdminShell } from './components/SuperAdminShell';


// Main app routes that require regular user authentication
function MainAppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const [auth, setAuth] = useState<{
    isAuthenticated: boolean;
    user: UserSummary | null;
    workspace: Workspace | null;
  }>({
    isAuthenticated: false,
    user: null,
    workspace: null
  });
  const [booting, setBooting] = useState(true);

  const isPortalPath =
    location.pathname.startsWith('/portal') ||
    location.pathname.startsWith('/vendor-portal') ||
    location.pathname.startsWith('/customer-portal');
  const isSuperAdminPath =
    location.pathname.startsWith('/platform-admin') ||
    location.pathname.startsWith('/super-admin') ||
    location.pathname.startsWith('/superadmin');

  const isAcceptInvitePath =
    location.pathname === '/accept-invite' ||
    location.pathname === '/portal/accept-invite' ||
    location.pathname === '/vendor-portal/accept-invite' ||
    location.pathname === '/customer-portal/accept-invite';

  useEffect(() => {
    // Skip ERP /auth/me check when on portal, superadmin, public invite paths, or when on /login
    if (isPortalPath || isSuperAdminPath || isAcceptInvitePath || location.pathname === '/login') {
      setBooting(false);
      return;
    }
    const token = localStorage.getItem('erp_token');
    if (!token) {
      setBooting(false);
      return;
    }
    api.get('/auth/me')
      .then((res) => {
        if (res.data.workspace?.number_system) {
          setGlobalNumberSystem(res.data.workspace.number_system);
        }
        const u = res.data.user;
        if (u && res.data.permissions && !u.permissions) {
          u.permissions = res.data.permissions;
        }
        setAuth({
          isAuthenticated: true,
          user: u,
          workspace: res.data.workspace
        });
      })
      .catch(() => {
        setAuth({ isAuthenticated: false, user: null, workspace: null });
      })
      .finally(() => {
        setBooting(false);
      });
  }, [isPortalPath, isSuperAdminPath, isAcceptInvitePath, location.pathname]);

  useEffect(() => {
    if (isPortalPath || isSuperAdminPath || isAcceptInvitePath || location.pathname === '/login') return;
    if (!localStorage.getItem('erp_token')) return;

    const revalidateSession = () => {
      api.get('/auth/me')
        .then((res) => {
          if (res.data?.user) {
            const u = res.data.user;
            if (res.data.permissions && !u.permissions) {
              u.permissions = res.data.permissions;
            }
            setAuth((prev) => ({
              ...prev,
              isAuthenticated: true,
              user: u,
              workspace: res.data.workspace || prev.workspace
            }));
          }
        })
        .catch(() => {});
    };

    window.addEventListener('focus', revalidateSession);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') revalidateSession();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', revalidateSession);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isPortalPath, isSuperAdminPath, isAcceptInvitePath]);

  const handleAuth = (_token: string, user: UserSummary, workspace: Workspace) => {
    // Save the token to localStorage so the api interceptor can use it for Bearer auth
    if (_token) {
      localStorage.setItem('erp_token', _token);
    }
    if (workspace?.number_system) {
      setGlobalNumberSystem(workspace.number_system);
    }
    setAuth({ isAuthenticated: true, user, workspace: workspace || null });
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore network errors
    }
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_user');
    localStorage.removeItem('erp_workspace');
    setAuth({ isAuthenticated: false, user: null, workspace: null });
    navigate('/login', { replace: true });
  };

  const loadWorkspace = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data.workspace?.number_system) {
        setGlobalNumberSystem(res.data.workspace.number_system);
      }
      const u = res.data.user;
      if (u && res.data.permissions && !u.permissions) {
        u.permissions = res.data.permissions;
      }
      setAuth((current) => ({
        ...current,
        isAuthenticated: true,
        user: u,
        workspace: res.data.workspace
      }));
    } catch (e) {
      console.error('Failed to reload session', e);
    }
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm animate-pulse space-y-3">
          <div className="h-4 bg-slate-200 rounded w-1/3" />
          <div className="h-4 bg-slate-100 rounded w-2/3" />
          <div className="h-10 bg-slate-100 rounded-lg mt-4" />
        </div>
      </div>
    );
  }

  // Public routes that don't need auth (Accept invite for ERP and Partner Portals)
  if (isAcceptInvitePath) {
    return <AcceptInvitePage onAuth={handleAuth} />;
  }
  if (location.pathname === '/portal/register' || location.pathname === '/portal/verify-email') {
    return <Navigate to="/login?portal=partner" replace />;
  }

  // Direct alias redirects for /vendor-portal and /customer-portal
  if (location.pathname === '/vendor-portal' || location.pathname === '/customer-portal') {
    const hasPortalToken = !!localStorage.getItem('erp_portal_token');
    const company = new URLSearchParams(location.search).get('company');
    if (hasPortalToken) {
      if (company) localStorage.setItem('erp_portal_active_company_id', company);
      return <Navigate to="/portal/orders" replace />;
    }
    return <Navigate to={`/login?portal=partner${company ? `&company=${company}` : ''}`} replace />;
  }

  // Portal paths — own auth via localStorage token, AppShell handles the rest
  if (isPortalPath) {
    return (
      <AppShell
        user={{ id: 'portal', workspace_id: '', email: '', role: 'vendor' }}
        workspace={null}
        onLogout={logout}
        reloadWorkspace={loadWorkspace}
      />
    );
  }

  // ERP login page — show if not authenticated or explicitly on /login
  if (!auth.isAuthenticated || location.pathname === '/login') {
    return <AuthPage onAuth={handleAuth} />;
  }

  // ERP Workspace — authenticated user
  return (
    <AppShell
      user={auth.user || { id: 'me', workspace_id: auth.workspace?.id || '', email: '', role: 'accounts' }}
      workspace={auth.workspace}
      onLogout={logout}
      reloadWorkspace={loadWorkspace}
    />
  );
}

// Root router - platform-admin is completely separate
export default function Root() {
  return (
    <BrowserRouter>
      <Providers>
        <Routes>
          <Route path="/platform-admin/*" element={<SuperAdminShell />}/>
          <Route path="/platform-admin" element={<SuperAdminShell />}/>
          <Route path="/super-admin/*" element={<Navigate to="/platform-admin" replace />} />
          <Route path="/super-admin" element={<Navigate to="/platform-admin" replace />} />
          <Route path="/superadmin/*" element={<Navigate to="/platform-admin" replace />} />
          <Route path="/superadmin" element={<Navigate to="/platform-admin" replace />} />
          <Route path="/*" element={<MainAppRoutes />} />
        </Routes>
      </Providers>
    </BrowserRouter>
  );
}