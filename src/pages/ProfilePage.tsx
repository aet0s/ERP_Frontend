import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import {
  User, Mail, Phone, Lock, Save, Camera, Shield, CheckCircle2,
  Calendar, Clock, Building2, Key, Eye, EyeOff
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast, useWorkspace } from '../context';
import type { UserSummary } from '../lib/types';
import { PageTitle } from '../components/ui/PageTitle';
import { Button } from '../components/ui/Button';

export function ProfilePage({ user }: { user: UserSummary }) {
  const toast = useToast();
  const { workspace, reloadWorkspace } = useWorkspace();

  const [form, setForm] = useState({
    name: user.name || '',
    email: user.email || '',
    phone: (user as any).phone || '',
    avatar_url: (user as any).avatar_url || '',
    bio: (user as any).bio || '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const [saving, setSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      name: user.name || '',
      email: user.email || '',
      phone: (user as any).phone || '',
      avatar_url: (user as any).avatar_url || '',
      bio: (user as any).bio || ''
    }));
  }, [user]);

  const handleAvatarFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast('Profile image size should be under 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, avatar_url: reader.result as string }));
      toast('Photo selected! Click "Save Changes" to apply.', 'info');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast('Full name is required', 'error');
      return;
    }

    if (form.new_password) {
      if (!form.current_password) {
        toast('Please enter your current password to set a new password', 'error');
        return;
      }
      if (form.new_password.length < 6) {
        toast('New password must be at least 6 characters', 'error');
        return;
      }
      if (form.new_password !== form.confirm_password) {
        toast('New passwords do not match', 'error');
        return;
      }
    }

    try {
      setSaving(true);
      const payload: any = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        avatar_url: form.avatar_url,
        bio: form.bio.trim()
      };

      if (form.new_password) {
        payload.current_password = form.current_password;
        payload.new_password = form.new_password;
      }

      const res = await api.put('/auth/profile', payload);
      if (res.data?.ok) {
        toast('Profile updated successfully!', 'success');
        setForm((prev) => ({
          ...prev,
          current_password: '',
          new_password: '',
          confirm_password: ''
        }));
        await reloadWorkspace();
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const userRoles = Array.isArray(user.roles) && user.roles.length > 0
    ? user.roles
    : (typeof (user as any).roles === 'string' ? String((user as any).roles).split(',').map((s: string) => s.trim()).filter(Boolean) : [user.role || 'staff']);

  const roleLabelMap: Record<string, string> = {
    owner: 'Workspace Owner',
    admin: 'Administrator',
    manager: 'Operations Manager',
    accounts: 'Accounts Manager',
    production_manager: 'Production Manager',
    sales_manager: 'Sales Manager',
    staff: 'Staff Member',
    vendor: 'Vendor / Supplier',
    customer: 'Customer / Buyer'
  };

  const inputCls = "w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 transition";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageTitle
        icon={<User />}
        title="My Profile & Account"
        subtitle="Manage your personal information, contact credentials, profile picture, and account security."
      />

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Profile Header Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar & Upload */}
            <div className="relative group shrink-0">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-3xl font-black shadow-md border-2 border-white ring-4 ring-slate-100">
                {form.avatar_url ? (
                  <img src={form.avatar_url} alt={form.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{(form.name || user.email || 'U')[0].toUpperCase()}</span>
                )}
              </div>

              <label
                htmlFor="avatar-upload"
                className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-105 active:scale-95"
                title="Upload Profile Picture"
              >
                <Camera size={14} />
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                />
              </label>

              {form.avatar_url && (
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, avatar_url: '' }))}
                  className="block text-[10px] text-rose-600 hover:underline mt-2 text-center w-full font-semibold cursor-pointer"
                >
                  Remove Photo
                </button>
              )}
            </div>

            {/* Profile Overview */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{form.name || 'Your Name'}</h1>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{user.email}</p>
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1.5">
                  {userRoles.map((r: string) => (
                    <span
                      key={r}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200"
                    >
                      {roleLabelMap[r] || r.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-2 text-xs text-slate-500 border-t border-slate-100">
                <span className="flex items-center gap-1.5">
                  <Building2 size={14} className="text-slate-400" />
                  <strong>Workspace:</strong> {workspace?.name || 'ERP Studio'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-400" />
                  <strong>Member Since:</strong> {(user as any).created_at ? new Date((user as any).created_at).toLocaleDateString() : 'Active'}
                </span>
                {(user as any).last_login_at && (
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} className="text-slate-400" />
                    <strong>Last Login:</strong> {new Date((user as any).last_login_at).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2-Column Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info Column (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Details Card */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-100">
                <User size={16} className="text-blue-600" /> Personal Information
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      className={`${inputCls} pl-9`}
                      placeholder="e.g. Hardick Patel"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      className={`${inputCls} pl-9`}
                      placeholder="+91 98765 43210"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    className={`${inputCls} pl-9 bg-slate-50 cursor-not-allowed text-slate-500`}
                    value={form.email}
                    disabled
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Email address is managed by your workspace administrator for secure authentication.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Designation / Bio
                </label>
                <textarea
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 transition"
                  rows={3}
                  placeholder="e.g. Accounts & Financial Controller responsible for invoicing, procurement review, and ledgers."
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Custom Profile Image URL (Optional)
                </label>
                <input
                  type="url"
                  className={inputCls}
                  placeholder="https://example.com/avatar.jpg"
                  value={form.avatar_url}
                  onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  You can upload an image file using the camera icon above or paste an image URL directly here.
                </p>
              </div>
            </div>

            {/* Change Password Card */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-100">
                <Lock size={16} className="text-blue-600" /> Security & Password
              </h2>

              <p className="text-xs text-slate-500">
                Leave these fields blank if you do not wish to change your login password.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <Key size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    className={`${inputCls} pl-9 pr-10`}
                    placeholder="Enter your current password"
                    value={form.current_password}
                    onChange={(e) => setForm({ ...form, current_password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      className={`${inputCls} pl-9 pr-10`}
                      placeholder="Minimum 6 characters"
                      value={form.new_password}
                      onChange={(e) => setForm({ ...form, new_password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      className={`${inputCls} pl-9`}
                      placeholder="Re-enter new password"
                      value={form.confirm_password}
                      onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Role Capabilities & Access Matrix (1 col) */}
          <div className="space-y-6">
            {/* Roles & Permissions Card */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-100">
                <Shield size={16} className="text-blue-600" /> Assigned Roles & Rights
              </h2>

              <p className="text-xs text-slate-500">
                Your account inherits permissions granted across your assigned workspace roles:
              </p>

              <div className="space-y-2">
                {userRoles.map((r: string) => (
                  <div
                    key={r}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between"
                  >
                    <div>
                      <strong className="block text-xs font-bold text-slate-900">
                        {roleLabelMap[r] || r.replace('_', ' ')}
                      </strong>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                        role: {r}
                      </span>
                    </div>
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  </div>
                ))}
              </div>

              {/* Accessible Modules List */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Active Module Permissions
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {(user.permissions || []).filter((p: any) => p.can_view === 1 || p.can_view === true).map((p: any) => (
                    <div
                      key={p.module}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 text-xs border border-slate-200/60"
                    >
                      <span className="capitalize font-semibold text-slate-800">
                        {p.module.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Active Access
                      </span>
                    </div>
                  ))}
                  {(!user.permissions || user.permissions.length === 0) && (
                    <p className="text-xs text-slate-400 italic">
                      Standard module access derived from assigned roles.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Save Button Card */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
              <Button
                type="submit"
                className="w-full py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                disabled={saving}
              >
                <Save size={15} />
                {saving ? 'Saving Profile...' : 'Save Changes'}
              </Button>
              <p className="text-[11px] text-slate-400 text-center">
                Updates will apply across your current workspace session immediately.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
