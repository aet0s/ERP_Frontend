import React from 'react';
import { Boxes, CheckCircle2, ShieldCheck, Lock, Activity, Database, Building2, Globe } from 'lucide-react';

export function PortalAuthLayout({
  activePortal = 'workspace',
  onPortalChange,
  title,
  subtitle,
  children
}: {
  activePortal?: 'workspace' | 'partner';
  onPortalChange?: (portal: 'workspace' | 'partner') => void;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-full bg-slate-50 flex flex-col lg:flex-row relative overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
      {/* Background Decorative Grid */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'radial-gradient(#0f172a 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/10 blur-[100px] rounded-full" />
      </div>

      {/* Left Column — Enterprise Branding & Trust Architecture (Desktop) */}
      <div className="hidden lg:flex flex-col justify-between w-[390px] xl:w-[430px] shrink-0 p-6 xl:p-8 relative z-10 border-r border-slate-200/90 bg-white/70 backdrop-blur-xl h-full overflow-hidden">
        <div className="space-y-5 xl:space-y-6">
          {/* Logo & Platform Tag */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 grid place-items-center text-white shadow-md shadow-blue-500/25 shrink-0">
              <Boxes size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-slate-900 font-extrabold text-lg tracking-tight">ERP Studio</span>
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-full">
                  Enterprise
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500">Operations & Inventory Management</span>
            </div>
          </div>

          {/* Hero Value Statement */}
          <div className="space-y-1.5">
            <h1 className="text-xl xl:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
              Unified Operations & Supply Chain Intelligence
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Purpose-built manufacturing governance, real-time stock ledger, batch traceability, and audited partner workflows.
            </p>
          </div>

          {/* Core Enterprise Capabilities */}
          <div className="space-y-2.5 border-t border-slate-200/80 pt-4">
            <div className="flex items-start gap-2.5 text-xs text-slate-700 font-medium">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>Multi-facility stock ledger (Raw, WIP, Finished Goods)</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-slate-700 font-medium">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>Automated Bill of Materials (BOM) & yield tracking</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-slate-700 font-medium">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>Secure external partner portal for orders & invoices</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-slate-700 font-medium">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>Role-based access control (RBAC) & audit trails</span>
            </div>
          </div>

          {/* Security & Compliance Badges */}
          <div className="border-t border-slate-200/80 pt-4">
            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 block mb-2">
              Enterprise Architecture
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-xl border border-slate-200 bg-white/80 shadow-2xs">
                <div className="flex items-center gap-1 text-blue-600 mb-0.5">
                  <ShieldCheck size={13} />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">SOC 2 Type II</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-900 leading-none">Audited Security</p>
              </div>

              <div className="p-2 rounded-xl border border-slate-200 bg-white/80 shadow-2xs">
                <div className="flex items-center gap-1 text-blue-600 mb-0.5">
                  <Lock size={13} />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">256-Bit TLS</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-900 leading-none">End-to-End Encrypted</p>
              </div>

              <div className="p-2 rounded-xl border border-slate-200 bg-white/80 shadow-2xs">
                <div className="flex items-center gap-1 text-blue-600 mb-0.5">
                  <Activity size={13} />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">99.99% SLA</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-900 leading-none">High Availability</p>
              </div>

              <div className="p-2 rounded-xl border border-slate-200 bg-white/80 shadow-2xs">
                <div className="flex items-center gap-1 text-blue-600 mb-0.5">
                  <Database size={13} />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Tenant Vault</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-900 leading-none">Data Isolation</p>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Footer */}
        <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Systems Operational
          </span>
          <span>© 2026 ERP Studio Inc.</span>
        </div>
      </div>

      {/* Right Column — User Login Experience (Anchored Top to Prevent Button Movement) */}
      <div className="flex-1 flex flex-col items-center justify-start pt-6 sm:pt-8 lg:pt-10 pb-6 px-4 relative z-10 h-full overflow-y-auto lg:overflow-hidden">
        {/* Mobile / Tablet Header (Visible only on < lg) */}
        <div className="lg:hidden flex flex-col items-center mb-4 text-center shrink-0">
          <div className="w-10 h-10 rounded-xl bg-blue-600 grid place-items-center text-white shadow-md shadow-blue-500/25 mb-2">
            <Boxes size={22} />
          </div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-slate-900 font-extrabold text-lg tracking-tight">ERP Studio</span>
            <span className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-full">
              Enterprise
            </span>
          </div>
          <p className="text-[11px] text-slate-500">Manufacturing & Operations Control System</p>
        </div>

        {/* Stable Form Container with Consistent Dimensions */}
        <div className="w-full max-w-[450px] shrink-0">
          <div className="w-full bg-white border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-200/40 p-5 sm:p-7 min-h-[470px] flex flex-col justify-between">
            <div>
              {/* Unified Portal Selector — Anchored at the exact same pixel position */}
              {onPortalChange && (
                <div className="mb-4 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onPortalChange('workspace')}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      activePortal === 'workspace'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200/70 font-bold'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    <Building2 size={14} className={activePortal === 'workspace' ? 'text-blue-600' : 'text-slate-400'} />
                    <span>Workspace Login</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onPortalChange('partner')}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      activePortal === 'partner'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200/70 font-bold'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    <Globe size={14} className={activePortal === 'partner' ? 'text-blue-600' : 'text-slate-400'} />
                    <span>Partner Portal</span>
                  </button>
                </div>
              )}

              {/* Form Title & Subtitle — Stable height */}
              <div className="mb-4 min-h-[48px]">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{subtitle}</p>
              </div>

              {/* Child Form Component */}
              {children}
            </div>
          </div>

          {/* Formal Trust & Security Footnote */}
          <div className="mt-3 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5 shrink-0">
            <Lock size={11} className="text-slate-400 shrink-0" />
            <span>Encrypted with enterprise-grade 256-bit TLS · SOC-2 compliant</span>
          </div>
        </div>
      </div>
    </div>
  );
}
