import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../context';
import { usePortal } from '../../components/AppShell';
import {
  Building2, ShieldCheck, CheckCircle2, Save
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

export function PortalProfilePage() {
  const toast = useToast();
  const { user, activeWorkspace, refreshData } = usePortal();

  const [form, setForm] = useState({
    name: '',
    company_name: '',
    phone: '',
    gstin: '',
    pan: '',
    business_type: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      try {
        setLoadingProfile(true);
        const res = await api.get('/portal/profile', {
          params: { company_id: activeWorkspace?.company_id }
        });
        if (isMounted && res.data?.ok && res.data?.user) {
          const u = res.data.user;
          const defaultBusinessType = activeWorkspace?.portal_type === 'vendor'
            ? 'Vendor / Supplier'
            : (activeWorkspace?.portal_type === 'customer' ? 'Customer / Buyer' : '');

          setForm({
            name: u.name || '',
            company_name: u.company_name || '',
            phone: u.phone || '',
            gstin: u.gstin || '',
            pan: u.pan || '',
            business_type: u.business_type || defaultBusinessType,
            address: u.address || '',
            city: u.city || '',
            state: u.state || '',
            pincode: u.pincode || ''
          });
        }
      } catch (err) {
        // Fallback to user from context
        if (isMounted && user) {
          const defaultBusinessType = activeWorkspace?.portal_type === 'vendor'
            ? 'Vendor / Supplier'
            : (activeWorkspace?.portal_type === 'customer' ? 'Customer / Buyer' : '');

          setForm({
            name: user.name || '',
            company_name: user.company_name || '',
            phone: user.phone || '',
            gstin: user.gstin || '',
            pan: user.pan || '',
            business_type: user.business_type || defaultBusinessType,
            address: user.address || '',
            city: user.city || '',
            state: user.state || '',
            pincode: user.pincode || ''
          });
        }
      } finally {
        if (isMounted) setLoadingProfile(false);
      }
    };

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [activeWorkspace?.company_id, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await api.put('/portal/profile', {
        ...form,
        company_id: activeWorkspace?.company_id
      });
      if (res.data?.ok) {
        toast('Business profile updated successfully!', 'success');
        await refreshData();
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 transition";

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0 font-bold">
            <Building2 size={20} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Business Profile
            </h1>
            <p className="text-xs text-slate-500">
              Manage your master partner identity, GSTIN, and business credentials
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Identity Summary Card */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4 h-fit">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20">
              {user.company_name ? user.company_name.charAt(0).toUpperCase() : user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-sm text-slate-900 truncate">
                {user.company_name || user.name}
              </h3>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs text-slate-600">
            <div className="flex items-center justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400">Account Status</span>
              <span className="font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={12} /> Active
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400">GSTIN Registered</span>
              <span className="font-mono font-bold text-slate-800">
                {user.gstin || 'Not Provided'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400">PAN Registered</span>
              <span className="font-mono font-bold text-slate-800">
                {user.pan || form.pan || 'Not Provided'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400">Primary Contact</span>
              <span className="font-semibold text-slate-800">{user.name}</span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400">Member Since</span>
              <span className="text-slate-800">
                {user.created_at ? new Date(user.created_at).toLocaleDateString() : '2026'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl text-[11px] text-blue-900 space-y-1">
            <p className="font-bold flex items-center gap-1">
              <ShieldCheck size={14} className="text-blue-600" /> One Account, All Workspaces
            </p>
            <p className="text-blue-800/80 leading-relaxed">
              Updates to this profile automatically reflect when connecting with new enterprise buyers and suppliers.
            </p>
          </div>
        </div>

        {/* Right Side: Profile Editor Form */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-100 gap-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Building2 size={16} className="text-blue-600" /> Organization & Legal Details
              </h3>
              {activeWorkspace && (
                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100/80 w-fit">
                  {loadingProfile ? 'Syncing workspace data…' : `Prefilled from ${activeWorkspace.company_name} (${activeWorkspace.portal_type === 'vendor' ? 'Supplier' : 'Customer'} record)`}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Registered Business Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Industrial Supplies Pvt Ltd"
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  GSTIN / Tax ID Number
                </label>
                <input
                  type="text"
                  placeholder="15-character GSTIN (e.g. 27AAACA1234F1Z9)"
                  value={form.gstin}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                  className={`${inputCls} font-mono`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  PAN Number
                </label>
                <input
                  type="text"
                  placeholder="10-character PAN (e.g. ABCDE1234F)"
                  maxLength={10}
                  value={form.pan}
                  onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                  className={`${inputCls} font-mono`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Primary Contact Person Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Contact Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+91 (800) 000-0000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Industry / Business Specialization
                </label>
                <input
                  type="text"
                  placeholder="e.g. Raw Steel & Coil Manufacturing, CNC Machining, Circuit Assemblies"
                  value={form.business_type}
                  onChange={(e) => setForm({ ...form, business_type: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Registered Address
                </label>
                <input
                  type="text"
                  placeholder="Plot / Street / Industrial Area"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai, Pune, Delhi"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  State / Province
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maharashtra"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  PIN / Postal Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. 400001"
                  value={form.pincode}
                  onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                type="submit"
                disabled={saving}
                icon={<Save size={14} />}
                className="text-xs font-bold"
              >
                {saving ? 'Saving Changes...' : 'Save Profile Details'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
