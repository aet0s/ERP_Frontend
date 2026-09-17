import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import {
  Check,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  Shield,
  KeyRound,
  AlertCircle
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { UserSummary, Workspace } from '../lib/types';
import { PortalAuthLayout } from '../components/ui/PortalAuthLayout';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col w-full">
      <label className="text-xs font-semibold text-slate-700 block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const F = Field;

export function AuthPage({
  onAuth
}: {
  onAuth: (token: string, user: UserSummary, workspace: Workspace) => void;
}) {
  const [searchParams] = useSearchParams();
  const initialPortal = searchParams.get('portal') === 'partner' ? 'partner' : 'workspace';

  const [portal, setPortal] = useState<'workspace' | 'partner'>(initialPortal);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Workspace Form State — Clean for Live Production
  const [form, setForm] = useState({
    workspace_name: '',
    business_type: '',
    currency: 'INR',
    owner_name: '',
    owner_email: '',
    owner_password: '',
    owner_confirm_password: '',
    email: '',
    password: ''
  });

  // Partner Form State — Clean for Live Production
  const [partnerForm, setPartnerForm] = useState({
    email: '',
    password: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);
  const [showOwnerConfirmPassword, setShowOwnerConfirmPassword] = useState(false);
  const [showPartnerPassword, setShowPartnerPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setError('');
  }, [portal, mode]);

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const pf = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setPartnerForm(prev => ({ ...prev, [key]: e.target.value }));

  // Password Security Checks for Workspace Registration
  const ownerPassword = form.owner_password || '';
  const ownerConfirmPassword = form.owner_confirm_password || '';
  const passwordsMatch = ownerPassword.length > 0 && ownerPassword === ownerConfirmPassword;

  const passwordChecks = {
    minLength: ownerPassword.length >= 8,
    hasUpper: /[A-Z]/.test(ownerPassword),
    hasLower: /[a-z]/.test(ownerPassword),
    hasNumber: /[0-9]/.test(ownerPassword),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(ownerPassword),
    noSpaces: ownerPassword.length > 0 && !/\s/.test(ownerPassword)
  };

  const isPasswordValid =
    passwordChecks.minLength &&
    passwordChecks.hasUpper &&
    passwordChecks.hasLower &&
    passwordChecks.hasNumber &&
    passwordChecks.hasSpecial &&
    passwordChecks.noSpaces;

  const passedChecksCount = [
    passwordChecks.minLength,
    passwordChecks.hasUpper,
    passwordChecks.hasLower,
    passwordChecks.hasNumber,
    passwordChecks.hasSpecial,
    passwordChecks.noSpaces
  ].filter(Boolean).length;

  const handleWorkspaceSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (mode === 'register') {
      if (!isPasswordValid) {
        if (!passwordChecks.minLength) {
          setError('Password must be at least 8 characters long.');
        } else if (!passwordChecks.hasUpper) {
          setError('Password must contain at least one uppercase letter (A-Z).');
        } else if (!passwordChecks.hasLower) {
          setError('Password must contain at least one lowercase letter (a-z).');
        } else if (!passwordChecks.hasNumber) {
          setError('Password must contain at least one number (0-9).');
        } else if (!passwordChecks.hasSpecial) {
          setError('Password must contain at least one special character (like @, #, $, or _).');
        } else if (!passwordChecks.noSpaces) {
          setError('Password cannot contain spaces.');
        } else {
          setError('Password must satisfy all security requirements.');
        }
        return;
      }

      if (form.owner_password !== form.owner_confirm_password) {
        setError('Passwords do not match. Please verify your confirm password.');
        return;
      }
    }

    setLoading(true);
    try {
      const payload = mode === 'register'
        ? {
          company_name: form.workspace_name.trim(),
          workspace_name: form.workspace_name.trim(),
          name: form.workspace_name.trim(),
          business_type: form.business_type,
          currency: form.currency,
          owner_name: form.owner_name.trim(),
          owner_email: form.owner_email.trim().toLowerCase(),
          owner_password: form.owner_password,
          owner_confirm_password: form.owner_confirm_password,
          email: form.owner_email.trim().toLowerCase(),
          password: form.owner_password
        }
        : { email: form.email.trim().toLowerCase(), password: form.password };
      const res = await api.post(`/auth/${mode}`, payload);
      onAuth(res.data.token || '', res.data.user, res.data.workspace);
      navigate(mode === 'register' ? '/onboarding' : '/');
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.errors?.[0]?.msg ||
        err.response?.data?.message ||
        'Authentication failed. Please verify your credentials and try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePartnerSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/portal/login', {
        email: partnerForm.email.trim().toLowerCase(),
        password: partnerForm.password
      });

      if (res.data?.ok) {
        if (res.data.token) {
          localStorage.setItem('erp_portal_token', res.data.token);
        }
        if (res.data.user) {
          localStorage.setItem('erp_portal_user', JSON.stringify(res.data.user));
        }
        if (res.data.active_connections?.length > 0) {
          localStorage.setItem('erp_portal_active_company_id', res.data.active_connections[0].company_id);
        }
        navigate('/portal/orders');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Partner authentication failed. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full h-10 bg-white border border-slate-300 rounded-xl px-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-500/10 transition-all";
  const regInputCls = "w-full h-9 bg-white border border-slate-300 rounded-lg px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-500/10 transition-all";

  return (
    <PortalAuthLayout
      activePortal={portal}
      onPortalChange={(p) => {
        setPortal(p);
        setMode('login');
        setError('');
      }}
      title={
        portal === 'workspace'
          ? (mode === 'login' ? 'Sign In to Workspace' : 'Create Organization Workspace')
          : 'Partner Portal Access'
      }
      subtitle={
        portal === 'workspace'
          ? (mode === 'login' ? 'Enter your authorized corporate credentials to access your ERP console.' : 'Deploy a secure multi-facility manufacturing workspace for your enterprise.')
          : 'Access client purchase orders, dispatch status, invoices, and payment statements.'
      }
    >
      {/* Sub-mode switcher (Sign In vs Register Workspace) */}
      {portal === 'workspace' && (
        <div className="h-9 flex p-0.5 bg-slate-100 rounded-xl mb-3.5 shrink-0 border border-slate-200/80">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 h-8 flex items-center justify-center text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${mode === 'login' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 h-8 flex items-center justify-center text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${mode === 'register' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            Register Workspace
          </button>
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-rose-800 text-xs animate-in fade-in duration-150">
          <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
          <span className="font-medium leading-relaxed">{error}</span>
        </div>
      )}

      {/* WORKSPACE LOGIN & REGISTER FORM */}
      {portal === 'workspace' && (
        <form onSubmit={handleWorkspaceSubmit} className="space-y-3">
          {mode === 'register' ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Field label="Workspace Name">
                  <input
                    className={regInputCls}
                    required
                    placeholder="Acme Mfg. Industries"
                    value={form.workspace_name}
                    onChange={f('workspace_name')}
                  />
                </Field>
                <Field label="Industry Sector">
                  <input
                    className={regInputCls}
                    placeholder="Textile / Auto / Chemical"
                    value={form.business_type}
                    onChange={f('business_type')}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Field label="Base Currency">
                  <select className={regInputCls} value={form.currency} onChange={f('currency')}>
                    <option value="INR">INR (₹) - Indian Rupee</option>
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="EUR">EUR (€) - Euro</option>
                    <option value="GBP">GBP (£) - British Pound</option>
                    <option value="AED">AED (د.إ) - UAE Dirham</option>
                    <option value="SGD">SGD ($) - Singapore Dollar</option>
                  </select>
                </Field>
                <Field label="Owner Full Name">
                  <input
                    className={regInputCls}
                    required
                    placeholder="Rajiv Sharma"
                    value={form.owner_name}
                    onChange={f('owner_name')}
                  />
                </Field>
              </div>

              <Field label="Owner Corporate Email">
                <div className="relative">
                  <Mail size={15} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    className={`${regInputCls} pl-9`}
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={form.owner_email}
                    onChange={f('owner_email')}
                  />
                </div>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Field label="Create Password">
                  <div className="relative">
                    <Lock size={15} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      className={`${regInputCls} pl-9 pr-9 ${
                        ownerPassword.length > 0
                          ? isPasswordValid
                            ? '!border-emerald-500 !ring-1 !ring-emerald-500/20'
                            : '!border-amber-400 !ring-1 !ring-amber-400/20'
                          : ''
                      }`}
                      type={showOwnerPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      placeholder="Create password"
                      value={form.owner_password}
                      onChange={f('owner_password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowOwnerPassword(!showOwnerPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      title={showOwnerPassword ? "Hide password" : "Show password"}
                    >
                      {showOwnerPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </Field>

                <Field label="Confirm Password">
                  <div className="relative">
                    <Lock size={15} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      className={`${regInputCls} pl-9 pr-9 ${
                        ownerConfirmPassword.length > 0
                          ? passwordsMatch
                            ? '!border-emerald-500 !ring-1 !ring-emerald-500/20'
                            : '!border-rose-400 !ring-1 !ring-rose-400/20'
                          : ''
                      }`}
                      type={showOwnerConfirmPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      placeholder="Confirm password"
                      value={form.owner_confirm_password}
                      onChange={f('owner_confirm_password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowOwnerConfirmPassword(!showOwnerConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      title={showOwnerConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showOwnerConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </Field>
              </div>

              {/* Password Match Status Pill */}
              {ownerConfirmPassword.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all duration-150 animate-fadeIn"
                  style={{
                    backgroundColor: passwordsMatch ? '#f0fdf4' : '#fef2f2',
                    borderColor: passwordsMatch ? '#bbf7d0' : '#fecaca',
                    color: passwordsMatch ? '#15803d' : '#b91c1c'
                  }}
                >
                  {passwordsMatch ? (
                    <>
                      <Check size={13} className="text-emerald-600 shrink-0 font-bold" />
                      <span>Passwords match perfectly</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={13} className="text-rose-500 shrink-0" />
                      <span>Passwords do not match</span>
                    </>
                  )}
                </div>
              )}

              {/* Password Strength & Security Checklist */}
              {ownerPassword.length > 0 && (
                <div className="mt-2 p-3 bg-slate-50/90 border border-slate-200/90 rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-600">Password Security Check</span>
                    <span className={`font-bold ${
                      isPasswordValid ? 'text-emerald-600' :
                      passedChecksCount >= 4 ? 'text-blue-600' :
                      passedChecksCount >= 2 ? 'text-amber-600' : 'text-rose-500'
                    }`}>
                      {isPasswordValid ? 'Strong (All checks met)' :
                       passedChecksCount >= 4 ? 'Moderate' :
                       passedChecksCount >= 2 ? 'Weak' : 'Very Weak'}
                    </span>
                  </div>

                  {/* 6-step Progress Bar */}
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex gap-1">
                    {[1, 2, 3, 4, 5, 6].map((step) => (
                      <div
                        key={step}
                        className={`h-full flex-1 rounded-full transition-all duration-200 ${
                          passedChecksCount >= step
                            ? isPasswordValid
                              ? 'bg-emerald-500'
                              : passedChecksCount >= 4
                              ? 'bg-blue-500'
                              : 'bg-amber-400'
                            : 'bg-transparent'
                        }`}
                      />
                    ))}
                  </div>

                  {/* 6 Security Checks */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 pt-1">
                    <div className={`flex items-center gap-1.5 text-[11px] ${passwordChecks.minLength ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                        passwordChecks.minLength ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
                      }`}>✓</span>
                      <span>At least 8 characters</span>
                    </div>
                    <div className={`flex items-center gap-1.5 text-[11px] ${passwordChecks.hasUpper ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                        passwordChecks.hasUpper ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
                      }`}>✓</span>
                      <span>One uppercase letter (A-Z)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 text-[11px] ${passwordChecks.hasLower ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                        passwordChecks.hasLower ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
                      }`}>✓</span>
                      <span>One lowercase letter (a-z)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 text-[11px] ${passwordChecks.hasNumber ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                        passwordChecks.hasNumber ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
                      }`}>✓</span>
                      <span>One number (0-9)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 text-[11px] ${passwordChecks.hasSpecial ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                        passwordChecks.hasSpecial ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
                      }`}>✓</span>
                      <span>One special char (@, #, $, _)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 text-[11px] ${
                      passwordChecks.noSpaces ? 'text-emerald-700 font-medium' : /\s/.test(ownerPassword) ? 'text-rose-600 font-bold' : 'text-slate-500'
                    }`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                        passwordChecks.noSpaces ? 'bg-emerald-100 text-emerald-700' : /\s/.test(ownerPassword) ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-400'
                      }`}>
                        {/\s/.test(ownerPassword) ? '✕' : '✓'}
                      </span>
                      <span>{/\s/.test(ownerPassword) ? 'Contains spaces (not allowed)' : 'No spaces allowed'}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <Field label="Work Email Address">
                <div className="relative">
                  <Mail size={15} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    className={`${inputCls} pl-10`}
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="name@company.com"
                    value={form.email}
                    onChange={f('email')}
                  />
                </div>
              </Field>

              <Field label="Password">
                <div className="relative">
                  <Lock size={15} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    className={`${inputCls} pl-10 pr-10`}
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={form.password}
                    onChange={f('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </Field>

              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Remember this device</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="font-semibold text-blue-600 hover:text-blue-700 transition cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>{mode === 'login' ? 'Authenticating…' : 'Configuring Workspace…'}</span>
              </>
            ) : (
              <>
                <span>{mode === 'login' ? 'Sign In to Workspace' : 'Create Organization Workspace'}</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>
      )}

      {/* PARTNER LOGIN FORM (INVITATION ONLY) */}
      {portal === 'partner' && (
        <form onSubmit={handlePartnerSubmit} className="space-y-3">
          <Field label="Partner Account Email">
            <div className="relative">
              <Mail size={15} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                className={`${inputCls} pl-10`}
                type="email"
                required
                placeholder="partner@vendor-corp.com"
                value={partnerForm.email}
                onChange={pf('email')}
              />
            </div>
          </Field>

          <Field label="Password">
            <div className="relative">
              <Lock size={15} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                className={`${inputCls} pl-10 pr-10`}
                type={showPartnerPassword ? "text" : "password"}
                required
                placeholder="••••••••••••"
                value={partnerForm.password}
                onChange={pf('password')}
              />
              <button
                type="button"
                onClick={() => setShowPartnerPassword(!showPartnerPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                title={showPartnerPassword ? "Hide password" : "Show password"}
              >
                {showPartnerPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>

          <div className="flex items-center justify-between text-xs pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span>Remember this device</span>
            </label>
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="font-semibold text-blue-600 hover:text-blue-700 transition cursor-pointer"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Authenticating Partner…</span>
              </>
            ) : (
              <>
                <span>Sign In to Partner Portal</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>

          {/* Invitation Notice */}
          <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 space-y-0.5 mt-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-[11px]">
              <Shield size={13} className="text-blue-600 shrink-0" />
              <span>Invitation-Only Access</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Partner Portal accounts are restricted to verified vendor suppliers and registered customers. If you do not have active credentials, please contact your client organization's procurement manager.
            </p>
          </div>
        </form>
      )}

      {/* Forgot Password Security Modal */}
      {showForgotModal && (
        <Modal
          title="Account Recovery & Security"
          onClose={() => setShowForgotModal(false)}
          size="sm"
        >
          <div className="space-y-4 text-xs text-slate-600">
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-2.5">
              <KeyRound size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-900 font-semibold mb-1">Corporate Security Policy</strong>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  To safeguard organizational manufacturing data and audit compliance, self-service password resets are restricted.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-800">To reset your account password:</h4>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 text-[11px]">
                <li>Contact your organization's <strong>Workspace Administrator</strong> or IT Helpdesk.</li>
                <li>Administrators can reset member credentials directly from the <strong>Users & Team</strong> console.</li>
                <li>Partner portal users should contact their client company's procurement representative.</li>
              </ul>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button
                variant="primary"
                onClick={() => setShowForgotModal(false)}
                className="text-xs font-semibold px-4"
              >
                Understood
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PortalAuthLayout>
  );
}

export function AcceptInvitePage({
  onAuth
}: {
  onAuth?: (token: string, user: UserSummary, workspace: Workspace) => void;
} = {}) {
  const [form, setForm] = useState({ name: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteInfo, setInviteInfo] = useState<any | null>(null);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get('token');
  const companyId = searchParams.get('company');
  const typeParam = searchParams.get('type');

  const invitePassword = form.password || '';
  const inviteConfirm = form.confirm || '';
  const passwordsMatch = invitePassword.length > 0 && invitePassword === inviteConfirm;

  const passwordChecks = {
    minLength: invitePassword.length >= 8,
    hasUpper: /[A-Z]/.test(invitePassword),
    hasLower: /[a-z]/.test(invitePassword),
    hasNumber: /[0-9]/.test(invitePassword),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(invitePassword),
    noSpaces: invitePassword.length > 0 && !/\s/.test(invitePassword)
  };

  const isPasswordValid =
    passwordChecks.minLength &&
    passwordChecks.hasUpper &&
    passwordChecks.hasLower &&
    passwordChecks.hasNumber &&
    passwordChecks.hasSpecial &&
    passwordChecks.noSpaces;

  const passedChecksCount = [
    passwordChecks.minLength,
    passwordChecks.hasUpper,
    passwordChecks.hasLower,
    passwordChecks.hasNumber,
    passwordChecks.hasSpecial,
    passwordChecks.noSpaces
  ].filter(Boolean).length;

  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }
    api.get(`/portal/auth/invite-info?token=${token}`)
      .then((res) => {
        if (res.data?.ok) {
          setInviteInfo(res.data);
          if (res.data.name) {
            setForm(prev => ({ ...prev, name: res.data.name }));
          }
        }
      })
      .catch(() => {
        // Fallback or internal employee invite
      })
      .finally(() => setChecking(false));
  }, [token]);

  const isWorkspaceMember = inviteInfo?.portal_type === 'workspace_member' || window.location.pathname === '/accept-invite';
  const isPortal = !isWorkspaceMember && (!!inviteInfo || window.location.pathname.includes('portal') || !!companyId);
  const portalTitle = (inviteInfo?.portal_type || typeParam) === 'customer' ? 'Customer & Buyer Portal' : 'Vendor & Supplier Portal';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Missing or invalid invitation token.');
      return;
    }
    if (!isPasswordValid) {
      if (!passwordChecks.minLength) {
        setError('Password must be at least 8 characters long.');
      } else if (!passwordChecks.hasUpper) {
        setError('Password must contain at least one uppercase letter (A-Z).');
      } else if (!passwordChecks.hasLower) {
        setError('Password must contain at least one lowercase letter (a-z).');
      } else if (!passwordChecks.hasNumber) {
        setError('Password must contain at least one number (0-9).');
      } else if (!passwordChecks.hasSpecial) {
        setError('Password must contain at least one special character (like @, #, $, or _).');
      } else if (!passwordChecks.noSpaces) {
        setError('Password cannot contain spaces.');
      } else {
        setError('Password must satisfy all security requirements.');
      }
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match. Please verify your confirm password.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      if (isWorkspaceMember) {
        // Internal ERP Workspace Staff Invite Acceptance
        const res = await api.post('/api/users/accept-invite', {
          token,
          name: form.name.trim() || inviteInfo?.email?.split('@')[0] || 'Team Member',
          password: form.password
        });
        if (res.data?.token) {
          localStorage.setItem('erp_token', res.data.token);
        }
        if (res.data?.user) {
          localStorage.setItem('erp_user', JSON.stringify(res.data.user));
        }
        if (res.data?.workspace) {
          localStorage.setItem('erp_workspace', JSON.stringify(res.data.workspace));
        }
        if (onAuth && res.data?.user) {
          onAuth(res.data.token || '', res.data.user, res.data.workspace);
        }
        navigate('/', { replace: true });
        return;
      } else if (isPortal) {
        // Partner Portal Invite Acceptance
        const res = await api.post('/portal/auth/accept-invite', {
          token,
          company_id: companyId || inviteInfo?.company_id,
          password: form.password
        });
        if (res.data?.ok) {
          if (res.data.token) localStorage.setItem('erp_portal_token', res.data.token);
          if (res.data.user) localStorage.setItem('erp_portal_user', JSON.stringify(res.data.user));
          if (res.data.company_id || res.data.active_company?.id) {
            localStorage.setItem('erp_portal_active_company_id', res.data.company_id || res.data.active_company?.id);
          }
          navigate('/portal/orders', { replace: true });
          return;
        }
      } else {
        // Fallback staff accept
        const res = await api.post('/api/users/accept-invite', {
          token,
          name: form.name.trim() || 'Team Member',
          password: form.password
        });
        if (res.data?.token) {
          localStorage.setItem('erp_token', res.data.token);
        }
        if (res.data?.user) {
          localStorage.setItem('erp_user', JSON.stringify(res.data.user));
        }
        if (res.data?.workspace) {
          localStorage.setItem('erp_workspace', JSON.stringify(res.data.workspace));
        }
        if (onAuth && res.data?.user) {
          onAuth(res.data.token || '', res.data.user, res.data.workspace);
        }
        navigate('/', { replace: true });
        return;
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to accept invitation. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full h-9 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition";

  return (
    <PortalAuthLayout
      title={
        isWorkspaceMember
          ? `Join ${inviteInfo?.company_name || 'Workspace'}`
          : isPortal
            ? inviteInfo?.has_password
              ? "Reset & Activate Partner Account"
              : "Activate Partner Account"
            : "Accept Workspace Invitation"
      }
      subtitle={
        isWorkspaceMember
          ? `Set up your name and password to join ${inviteInfo?.company_name || 'the workspace'} as ${inviteInfo?.role?.replace('_', ' ') || 'member'}.`
          : isPortal
            ? inviteInfo?.has_password
              ? `Set a new password to access ${inviteInfo?.company_name || 'your partner workspace'}.`
              : `Set up your password to connect with ${inviteInfo?.company_name || 'your partner workspace'}.`
            : "Set your password to join the workspace console."
      }
    >
      {checking ? (
        <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
          Verifying invitation link...
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {error && <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">{error}</div>}

          {inviteInfo && (
            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                <span>{isWorkspaceMember ? '🏢 Team Member Invitation' : portalTitle}</span>
                {inviteInfo.company_code && (
                  <span className="font-mono text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                    {inviteInfo.company_code}
                  </span>
                )}
              </div>
              <div className="text-slate-700">
                <span>Workspace: </span>
                <strong className="text-slate-900">{inviteInfo.company_name}</strong>
              </div>
              <div className="text-slate-600">
                <span>Account Email: </span>
                <strong className="text-slate-800 font-mono">{inviteInfo.email}</strong>
              </div>
              {inviteInfo.role && (
                <div className="text-slate-600">
                  <span>Assigned Role: </span>
                  <span className="font-bold uppercase tracking-wider text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded">
                    {inviteInfo.role.replace('_', ' ')}
                  </span>
                </div>
              )}
            </div>
          )}

          {isWorkspaceMember && (
            <F label="Your Full Name">
              <input
                className={inputCls}
                type="text"
                placeholder="e.g. Alex Sharma"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </F>
          )}

          <F label="Set Account Password">
            <div className="relative">
              <Lock size={15} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                className={`${inputCls} pl-10 pr-10`}
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                placeholder="Create a strong password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </F>

          <F label="Confirm Password">
            <div className="relative">
              <Lock size={15} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                className={`${inputCls} pl-10 pr-10`}
                type={showConfirm ? 'text' : 'password'}
                required
                autoComplete="new-password"
                placeholder="Re-enter your password"
                value={form.confirm}
                onChange={(e) => setForm((p) => ({ ...p, confirm: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </F>

          {/* Confirm match badge */}
          {inviteConfirm.length > 0 && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all duration-150 animate-fadeIn"
              style={{
                backgroundColor: passwordsMatch ? '#f0fdf4' : '#fef2f2',
                borderColor: passwordsMatch ? '#bbf7d0' : '#fecaca',
                color: passwordsMatch ? '#15803d' : '#b91c1c'
              }}
            >
              {passwordsMatch ? (
                <>
                  <Check size={13} className="text-emerald-600 shrink-0 font-bold" />
                  <span>Passwords match perfectly</span>
                </>
              ) : (
                <>
                  <AlertCircle size={13} className="text-rose-500 shrink-0" />
                  <span>Passwords do not match</span>
                </>
              )}
            </div>
          )}

          {/* Password Strength & Security Checklist */}
          {invitePassword.length > 0 && (
            <div className="mt-2 p-3 bg-slate-50/90 border border-slate-200/90 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-600">Password Security Check</span>
                <span
                  className={`font-bold ${
                    isPasswordValid
                      ? 'text-emerald-600'
                      : passedChecksCount >= 4
                      ? 'text-blue-600'
                      : passedChecksCount >= 2
                      ? 'text-amber-600'
                      : 'text-rose-500'
                  }`}
                >
                  {isPasswordValid
                    ? 'Strong (All checks met)'
                    : passedChecksCount >= 4
                    ? 'Moderate'
                    : passedChecksCount >= 2
                    ? 'Weak'
                    : 'Very Weak'}
                </span>
              </div>

              {/* 6-step Progress Bar */}
              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex gap-1">
                {[1, 2, 3, 4, 5, 6].map((step) => (
                  <div
                    key={step}
                    className={`h-full flex-1 rounded-full transition-all duration-200 ${
                      passedChecksCount >= step
                        ? isPasswordValid
                          ? 'bg-emerald-500'
                          : passedChecksCount >= 4
                          ? 'bg-blue-500'
                          : 'bg-amber-400'
                        : 'bg-transparent'
                    }`}
                  />
                ))}
              </div>

              {/* 6 Security Checks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 pt-1">
                <div className={`flex items-center gap-1.5 text-[11px] ${passwordChecks.minLength ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                    passwordChecks.minLength ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
                  }`}>✓</span>
                  <span>At least 8 characters</span>
                </div>
                <div className={`flex items-center gap-1.5 text-[11px] ${passwordChecks.hasUpper ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                    passwordChecks.hasUpper ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
                  }`}>✓</span>
                  <span>One uppercase letter (A-Z)</span>
                </div>
                <div className={`flex items-center gap-1.5 text-[11px] ${passwordChecks.hasLower ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                    passwordChecks.hasLower ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
                  }`}>✓</span>
                  <span>One lowercase letter (a-z)</span>
                </div>
                <div className={`flex items-center gap-1.5 text-[11px] ${passwordChecks.hasNumber ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                    passwordChecks.hasNumber ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
                  }`}>✓</span>
                  <span>One number (0-9)</span>
                </div>
                <div className={`flex items-center gap-1.5 text-[11px] ${passwordChecks.hasSpecial ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                    passwordChecks.hasSpecial ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
                  }`}>✓</span>
                  <span>One special char (@, #, $, _)</span>
                </div>
                <div className={`flex items-center gap-1.5 text-[11px] ${
                  passwordChecks.noSpaces ? 'text-emerald-700 font-medium' : /\s/.test(invitePassword) ? 'text-rose-600 font-bold' : 'text-slate-500'
                }`}>
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                    passwordChecks.noSpaces ? 'bg-emerald-100 text-emerald-700' : /\s/.test(invitePassword) ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-400'
                  }`}>
                    {/\s/.test(invitePassword) ? '✕' : '✓'}
                  </span>
                  <span>{/\s/.test(invitePassword) ? 'Contains spaces (not allowed)' : 'No spaces allowed'}</span>
                </div>
              </div>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg mt-2 transition cursor-pointer"
          >
            {loading
              ? 'Activating Account...'
              : isPortal
                ? inviteInfo?.has_password
                  ? 'Set Password & Enter Portal'
                  : 'Activate Partner Account'
                : 'Activate Account & Join'}
          </button>
        </form>
      )}
    </PortalAuthLayout>
  );
}
