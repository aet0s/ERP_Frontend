import axios from 'axios';

const resolveBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'erp.solarman.in') {
      return 'https://erpmgmt.solarman.in';
    }
  }
  return import.meta.env.DEV ? 'http://localhost:4000' : '';
};

export const api = axios.create({
  baseURL: resolveBaseUrl(),
  withCredentials: true
});

axios.defaults.withCredentials = true;

// Request interceptor to attach JWT Authorization Bearer header
const attachAuthHeaders = (config: any) => {
  const url = config.url || '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

  // Platform admin requests
  const isPlatformAdminReq =
    url.startsWith('/platform-admin') ||
    url.startsWith('/super-admin') ||
    url.startsWith('/superadmin') ||
    url.startsWith('/admin') ||
    pathname.startsWith('/platform-admin') ||
    pathname.startsWith('/super-admin') ||
    pathname.startsWith('/superadmin');

  //Party invitation management routes (e.g. /api/vendors/:id/portal-invite, /api/customers/:id/portal-invite)
  // are internal ERP tenant actions that require the ERP user's token (erp_token), NOT the partner portal token.
  const isPartyInviteRoute = url.includes('/portal-invite');

  // Partner Portal requests: only when actively using partner portal endpoints or pages
  const isPortalReq =
    !isPartyInviteRoute &&
    !isPlatformAdminReq &&
    (
      url.startsWith('/portal/') ||
      url.startsWith('/vendor-portal/') ||
      url.startsWith('/customer-portal/') ||
      url === '/portal/login' ||
      url === '/portal/check-invite' ||
      ((pathname.startsWith('/portal') ||
        pathname.startsWith('/vendor-portal') ||
        pathname.startsWith('/customer-portal')) &&
        !url.startsWith('/api/'))
    );

  if (isPlatformAdminReq) {
    const platformToken = localStorage.getItem('erp_platform_token');
    if (platformToken) {
      if (!config.headers) config.headers = {};
      if (!config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${platformToken}`;
      }
      if (!config.headers['x-platform-token']) {
        config.headers['x-platform-token'] = platformToken;
      }
    }
  } else if (isPortalReq) {
    const portalToken = localStorage.getItem('erp_portal_token');
    if (portalToken) {
      if (!config.headers) config.headers = {};
      if (!config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${portalToken}`;
      }
    }
  } else {
    const token = localStorage.getItem('erp_token');
    if (token) {
      if (!config.headers) config.headers = {};
      if (!config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  }
  return config;
};

api.interceptors.request.use(attachAuthHeaders);
axios.interceptors.request.use(attachAuthHeaders);

let isRefreshing = false;
let failedQueue: { resolve: (val?: unknown) => void; reject: (err?: unknown) => void }[] = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve();
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isPlatformAdminPath =
      window.location.pathname.startsWith('/platform-admin') ||
      window.location.pathname.startsWith('/super-admin') ||
      window.location.pathname.startsWith('/superadmin');

    if (error.response?.status === 403 && (error.response?.data?.locked || ['paused', 'suspended', 'cancelled', 'deleted'].includes(error.response?.data?.status))) {
      // If workspace is locked by superadmin, reject and force logout of tenant session
      if (!isPlatformAdminPath && !window.location.pathname.startsWith('/portal')) {
        localStorage.removeItem('erp_token');
        localStorage.removeItem('erp_user');
        localStorage.removeItem('erp_workspace');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      const url = originalRequest?.url || '';
      if (
        url.includes('/auth/login') ||
        url.includes('/auth/register') ||
        url.includes('/auth/refresh') ||
        url.includes('/invite-info') ||
        url.includes('/accept-invite') ||
        url.includes('/portal-invite') ||
        url.includes('/portal/') ||
        url.includes('/vendor-portal/') ||
        url.includes('/customer-portal/') ||
        url.includes('/platform-admin/') ||
        url.includes('/admin/')
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest)).catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');
        isRefreshing = false;
        processQueue(null);
        return api(originalRequest);
      } catch (refreshErr) {
        isRefreshing = false;
        processQueue(refreshErr);
        localStorage.removeItem('erp_token');
        localStorage.removeItem('erp_user');
        localStorage.removeItem('erp_workspace');
        const isPublicNoRedirect =
          window.location.pathname.startsWith('/portal') ||
          window.location.pathname.startsWith('/vendor-portal') ||
          window.location.pathname.startsWith('/customer-portal') ||
          window.location.pathname.startsWith('/accept-invite') ||
          isPlatformAdminPath;

        if (!isPublicNoRedirect && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);


