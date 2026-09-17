import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { Check, Users, Plus, Trash2, Send, Copy, ShieldCheck, RefreshCw, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useToast, useWorkspace } from '../context';
import { usePermissions } from '../hooks/usePermissions';
import { formatCurrency, formatDate, csvDownload, generateUUID } from '../lib/utils';
import type { AnyRow, TableColumn } from '../lib/types';
import { DataTable } from '../components/DataTable';
import { PartyDetailDrawer } from '../components/PartyDetailDrawer';
import { ExportColumnModal, type ExportColumnOption } from '../components/ExportColumnModal';
import { PageTitle } from '../components/ui/PageTitle';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { usePersistentTab } from '../hooks/usePersistentTab';

interface ContactPerson {
  local_id: string;
  name: string;
  phone: string;
  email: string;
  role: string;
}

// Validation helpers
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
const isValidPhone = (phone: string) => {
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
};
const isValidGstin = (gstin: string) => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(String(gstin).trim());
const isValidPan = (pan: string) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(String(pan).trim());
const isValidIfsc = (ifsc: string) => /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(String(ifsc).trim());
const isValidPincode = (pincode: string) => /^[1-9][0-9]{5}$/.test(String(pincode).trim());
const isValidPartyCode = (code: string) => /^[A-Za-z0-9_-]{3,25}$/.test(String(code).trim());

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

function PartyModal({
  config,
  onClose,
  onSaved
}: {
  config: { type: 'vendor' | 'customer'; row?: any; initialCode?: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isVendor = config.type === 'vendor';

  const codeUserEditedRef = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    code: config.row?.vendor_code || config.row?.customer_code || config.row?.code || config.initialCode || (isVendor ? 'VEN-0001' : 'CUST-0001'),
    name: config.row?.name || '',
    email: config.row?.email || '',
    phone: config.row?.phone || config.row?.contact || '',
    street: config.row?.street || config.row?.address_line1 || config.row?.billing_address || config.row?.address || '',
    city: config.row?.city || '',
    state: config.row?.state || '',
    pincode: config.row?.pincode || '',
    gstin: config.row?.gstin || '',
    pan: config.row?.pan || '',
    status: config.row?.status || 'Active',
    bank_account_name: config.row?.bank_account_name || '',
    bank_account_number: config.row?.bank_account_number || '',
    bank_ifsc: config.row?.bank_ifsc || ''
  });

  const clearError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    clearError(field);
  };

  const handleGstinChange = (value: string) => {
    const upper = value.toUpperCase();
    clearError('gstin');
    setForm((prev) => ({ ...prev, gstin: upper }));
  };

  const checkTaxUniqueness = async (gstinVal?: string, panVal?: string) => {
    const cleanG = gstinVal ? gstinVal.trim().toUpperCase() : '';
    const cleanP = panVal ? panVal.trim().toUpperCase() : '';
    if (!cleanG && !cleanP) return true;

    try {
      const res = await api.get('/api/parties/check-tax-unique', {
        params: {
          gstin: cleanG || undefined,
          pan: cleanP || undefined,
          exclude_id: config.row?.id || undefined
        }
      });
      if (res.data && res.data.available === false) {
        const errMsg = res.data.error || 'Tax ID is already registered in the ERP portal';
        if (cleanG && errMsg.includes('GSTIN')) {
          setErrors((prev) => ({ ...prev, gstin: errMsg }));
        }
        if (cleanP && errMsg.includes('PAN')) {
          setErrors((prev) => ({ ...prev, pan: errMsg }));
        }
        return false;
      }
      return true;
    } catch {
      return true;
    }
  };

  // Auto-fetch next sequential code from server if adding a new record
  useEffect(() => {
    if (!config.row?.id) {
      api.get(`/api/numbering-series/next/${config.type}`)
        .then((res) => {
          if (res.data?.next_code && !codeUserEditedRef.current) {
            setForm((prev) => ({
              ...prev,
              code: res.data.next_code
            }));
          }
        })
        .catch(() => {});
    }
  }, [config.type, config.row?.id]);

  const [contacts, setContacts] = useState<ContactPerson[]>(() => {
    let parsedContacts: any[] = [];
    if (Array.isArray(config.row?.contacts)) {
      parsedContacts = config.row.contacts;
    } else if (typeof config.row?.contacts === 'string' && config.row.contacts.trim()) {
      try {
        const parsed = JSON.parse(config.row.contacts);
        if (Array.isArray(parsed)) parsedContacts = parsed;
      } catch {}
    }
    if (parsedContacts.length > 0) {
      return parsedContacts.map((c: any) => ({
        local_id: c.local_id || generateUUID(),
        name: c.name || '',
        phone: c.phone || '',
        email: c.email || '',
        role: c.role || 'Primary Contact'
      }));
    }
    return [
      {
        local_id: generateUUID(),
        name: config.row?.contact_person_name || config.row?.contact || '',
        phone: config.row?.phone || config.row?.contact || '',
        email: config.row?.email || '',
        role: 'Primary Contact'
      }
    ];
  });

  const endpoint = isVendor ? '/api/vendors' : '/api/customers';

  const addContact = () => {
    setContacts((prev) => [
      ...prev,
      { local_id: generateUUID(), name: '', phone: '', email: '', role: 'Accounts / Billing' }
    ]);
  };

  const removeContact = (localId: string) => {
    setContacts((prev) => prev.filter((c) => c.local_id !== localId));
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (k.startsWith(`contact_${localId}`)) delete next[k];
      });
      return next;
    });
  };

  const updateContact = (localId: string, field: keyof ContactPerson, value: string) => {
    setContacts((prev) =>
      prev.map((c) => (c.local_id === localId ? { ...c, [field]: value } : c))
    );
    clearError(`contact_${localId}_${field}`);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    // 1. Code
    if (!form.code || !form.code.trim()) {
      newErrors.code = `${isVendor ? 'Vendor' : 'Customer'} code is required (e.g. ${isVendor ? 'VEN-0001' : 'CUST-0001'})`;
    } else if (!isValidPartyCode(form.code)) {
      newErrors.code = 'Code can only contain letters, numbers, hyphens, and underscores (3-25 characters)';
    }

    // 2. Business Name
    if (!form.name || !form.name.trim()) {
      newErrors.name = `${isVendor ? 'Vendor' : 'Customer'} business name is required`;
    } else if (form.name.trim().length < 2) {
      newErrors.name = 'Business name must be at least 2 characters';
    }

    // 3. Primary Phone
    if (!form.phone || !form.phone.trim()) {
      newErrors.phone = 'Primary phone / WhatsApp number is required';
    } else if (!isValidPhone(form.phone)) {
      newErrors.phone = 'Enter a valid 10-15 digit phone number (e.g. +91 9876543210)';
    }

    // 4. Primary Email
    if (!form.email || !form.email.trim()) {
      newErrors.email = 'Primary email address is required';
    } else if (!isValidEmail(form.email)) {
      newErrors.email = 'Enter a valid email address (e.g. contact@business.com)';
    }

    // 5. Street / Building Address
    if (!form.street || !form.street.trim()) {
      newErrors.street = 'Street / building address is required';
    } else if (form.street.trim().length < 3) {
      newErrors.street = 'Street address must be at least 3 characters';
    }

    // 6. City
    if (!form.city || !form.city.trim()) {
      newErrors.city = 'City is required';
    } else if (form.city.trim().length < 2) {
      newErrors.city = 'City must be at least 2 characters';
    }

    // 7. State
    if (!form.state || !form.state.trim()) {
      newErrors.state = 'State is required';
    }

    // 8. PIN Code
    if (!form.pincode || !form.pincode.trim()) {
      newErrors.pincode = 'PIN code is required';
    } else if (!isValidPincode(form.pincode)) {
      newErrors.pincode = 'Enter a valid 6-digit Indian PIN code (e.g. 110001)';
    }

    // 9. GSTIN (if provided)
    if (form.gstin && form.gstin.trim()) {
      if (!isValidGstin(form.gstin)) {
        newErrors.gstin = 'Invalid GSTIN format (15 characters, e.g. 22AAAAA0000A1Z5)';
      }
    }

    // 10. PAN (if provided)
    if (form.pan && form.pan.trim()) {
      if (!isValidPan(form.pan)) {
        newErrors.pan = 'Invalid PAN format (e.g. ABCDE1234F - 5 letters, 4 numbers, 1 letter)';
      }
    }

    // 11. Vendor Banking Details (for Vendors)
    if (isVendor) {
      const hasAnyBank = Boolean(
        form.bank_account_name.trim() ||
        form.bank_account_number.trim() ||
        form.bank_ifsc.trim()
      );
      if (hasAnyBank) {
        if (!form.bank_account_name.trim()) {
          newErrors.bank_account_name = 'Bank account holder name is required';
        } else if (form.bank_account_name.trim().length < 2) {
          newErrors.bank_account_name = 'Account holder name must be at least 2 characters';
        }
        if (!form.bank_account_number.trim()) {
          newErrors.bank_account_number = 'Bank account number is required';
        } else if (!/^\d{9,18}$/.test(form.bank_account_number.trim())) {
          newErrors.bank_account_number = 'Bank account number must be between 9 and 18 digits';
        }
        if (!form.bank_ifsc.trim()) {
          newErrors.bank_ifsc = 'Bank IFSC code is required';
        } else if (!isValidIfsc(form.bank_ifsc)) {
          newErrors.bank_ifsc = 'Invalid 11-character Indian IFSC code (e.g. SBIN0001234)';
        }
      }
    }

    // 12. Contact Persons
    contacts.forEach((c, idx) => {
      if (!c.name || !c.name.trim()) {
        newErrors[`contact_${c.local_id}_name`] = `Contact #${idx + 1} name is required`;
      }
      if (c.phone && c.phone.trim() && !isValidPhone(c.phone)) {
        newErrors[`contact_${c.local_id}_phone`] = 'Valid 10-15 digit phone required';
      }
      if (c.email && c.email.trim() && !isValidEmail(c.email)) {
        newErrors[`contact_${c.local_id}_email`] = 'Valid email address required';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) {
      toast('Please correct the highlighted validation errors', 'error');
      return;
    }

    setSubmitting(true);

    // Pre-flight check for GSTIN & PAN uniqueness across the ERP portal
    const isTaxUnique = await checkTaxUniqueness(form.gstin, form.pan);
    if (!isTaxUnique) {
      setSubmitting(false);
      toast('GSTIN or PAN is already registered in the ERP portal', 'error');
      return;
    }

    try {
      const payload: any = {
        name: form.name.trim(),
        email: form.email ? form.email.trim() : null,
        phone: form.phone ? form.phone.trim() : null,
        contact: form.phone ? form.phone.trim() : null,
        street: form.street ? form.street.trim() : null,
        address: form.street ? form.street.trim() : null,
        address_line1: form.street ? form.street.trim() : null,
        billing_address: form.street ? form.street.trim() : null,
        city: form.city ? form.city.trim() : null,
        state: form.state ? form.state.trim() : null,
        pincode: form.pincode ? form.pincode.trim() : null,
        gstin: form.gstin ? form.gstin.trim().toUpperCase() : null,
        pan: form.pan ? form.pan.trim().toUpperCase() : null,
        status: form.status || 'Active',
        contacts
      };

      if (isVendor) {
        payload.vendor_code = form.code && form.code.trim() ? form.code.trim().toUpperCase() : undefined;
        payload.bank_account_name = form.bank_account_name ? form.bank_account_name.trim() : null;
        payload.bank_account_number = form.bank_account_number ? form.bank_account_number.trim() : null;
        payload.bank_ifsc = form.bank_ifsc ? form.bank_ifsc.trim().toUpperCase() : null;
      } else {
        payload.customer_code = form.code && form.code.trim() ? form.code.trim().toUpperCase() : undefined;
      }

      if (config.row?.id) {
        await api.put(`${endpoint}/${config.row.id}`, payload);
        toast(`${isVendor ? 'Vendor' : 'Customer'} updated successfully`, 'success');
      } else {
        await api.post(endpoint, payload);
        toast(`${isVendor ? 'Vendor' : 'Customer'} created successfully`, 'success');
      }
      onSaved();
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Failed to save party record';
      if (errMsg.includes('GSTIN')) {
        setErrors((prev) => ({ ...prev, gstin: errMsg }));
      }
      if (errMsg.includes('PAN')) {
        setErrors((prev) => ({ ...prev, pan: errMsg }));
      }
      toast(errMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = (hasError?: boolean) =>
    `w-full bg-white border ${
      hasError
        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
        : 'border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20'
    } rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none transition`;

  const errorCount = Object.keys(errors).length;

  return (
    <Modal
      title={config.row ? `Edit ${isVendor ? 'Vendor' : 'Customer'}` : `Add New ${isVendor ? 'Vendor' : 'Customer'}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4 text-sm" noValidate>
        {errorCount > 0 && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="font-bold">Please correct the following before saving ({errorCount} error{errorCount > 1 ? 's' : ''}):</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] text-rose-700">
                {Object.values(errors).slice(0, 3).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {errorCount > 3 && (
                  <li>...and {errorCount - 3} more issue{errorCount - 3 > 1 ? 's' : ''}</li>
                )}
              </ul>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={`${isVendor ? 'Vendor' : 'Customer'} Code`} error={errors.code} required>
            <input
              className={`${inputCls(!!errors.code)} font-mono font-medium`}
              placeholder={isVendor ? 'e.g. VEN-0001' : 'e.g. CUST-0001'}
              value={form.code}
              onChange={(e) => {
                codeUserEditedRef.current = true;
                updateField('code', e.target.value.toUpperCase());
              }}
            />
            <p className="text-[11px] text-slate-400 mt-0.5">Auto-generated sequential code. You can edit if needed.</p>
          </Field>
          <Field label="Business Name" error={errors.name} required>
            <input
              className={inputCls(!!errors.name)}
              placeholder="Full Registered Business Name"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Primary Phone / WhatsApp" error={errors.phone} required>
            <input
              className={inputCls(!!errors.phone)}
              placeholder="+91 9876543210 (10-15 digits)"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
          </Field>
          <Field label="Primary Email Address" error={errors.email} required>
            <input
              className={inputCls(!!errors.email)}
              type="email"
              placeholder="contact@business.com"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
          </Field>
        </div>

        {/* 4 Separate Address Fields */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Address Details
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Field label="Street / Building Address" error={errors.street} required>
                <input
                  className={inputCls(!!errors.street)}
                  placeholder="Plot No., Building Name, Street / Road"
                  value={form.street}
                  onChange={(e) => updateField('street', e.target.value)}
                />
              </Field>
            </div>
            <Field label="City" error={errors.city} required>
              <input
                className={inputCls(!!errors.city)}
                placeholder="City / District"
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
              />
            </Field>
            <Field label="State" error={errors.state} required>
              <input
                className={inputCls(!!errors.state)}
                placeholder="State (e.g. Maharashtra)"
                list="indian-states-list"
                value={form.state}
                onChange={(e) => updateField('state', e.target.value)}
              />
              <datalist id="indian-states-list">
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st} />
                ))}
              </datalist>
            </Field>
            <Field label="PIN Code" error={errors.pincode} required>
              <input
                className={inputCls(!!errors.pincode)}
                placeholder="6-digit PIN Code (e.g. 110001)"
                maxLength={6}
                value={form.pincode}
                onChange={(e) => updateField('pincode', e.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <Field label={`${isVendor ? 'Vendor' : 'Customer'} Status`}>
              <Select
                value={form.status}
                onChange={(val) => updateField('status', val)}
                options={[
                  { value: 'Active', label: 'Active' },
                  { value: 'Inactive', label: 'Inactive' }
                ]}
              />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="GSTIN (Tax ID)" error={errors.gstin}>
            <input
              className={`${inputCls(!!errors.gstin)} font-mono`}
              placeholder="15-char GSTIN (e.g. 22AAAAA0000A1Z5)"
              maxLength={15}
              value={form.gstin}
              onChange={(e) => handleGstinChange(e.target.value)}
              onBlur={() => checkTaxUniqueness(form.gstin, '')}
            />
            <p className="text-[11px] text-slate-400 mt-0.5">Optional for unregistered parties. Must be unique across ERP.</p>
          </Field>
          <Field label="PAN Number" error={errors.pan}>
            <input
              className={`${inputCls(!!errors.pan)} font-mono`}
              placeholder="10-char PAN (e.g. ABCDE1234F)"
              maxLength={10}
              value={form.pan}
              onChange={(e) => updateField('pan', e.target.value.toUpperCase())}
              onBlur={() => checkTaxUniqueness('', form.pan)}
            />
            <p className="text-[11px] text-slate-400 mt-0.5">10-digit PAN (5 letters, 4 numbers, 1 letter). Must be unique across ERP.</p>
          </Field>
        </div>

        {/* Banking Details for Vendors */}
        {isVendor ? (
          <div className="border-t border-slate-200 pt-3 space-y-3">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Vendor Bank Details (For Payments)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Bank Account Name" error={errors.bank_account_name}>
                <input
                  className={inputCls(!!errors.bank_account_name)}
                  placeholder="Account Holder Name"
                  value={form.bank_account_name}
                  onChange={(e) => updateField('bank_account_name', e.target.value)}
                />
              </Field>
              <Field label="Bank Account Number" error={errors.bank_account_number}>
                <input
                  className={`${inputCls(!!errors.bank_account_number)} font-mono`}
                  placeholder="9-18 digits"
                  maxLength={18}
                  value={form.bank_account_number}
                  onChange={(e) => updateField('bank_account_number', e.target.value.replace(/\D/g, ''))}
                />
              </Field>
              <Field label="Bank IFSC / SWIFT Code" error={errors.bank_ifsc}>
                <input
                  className={`${inputCls(!!errors.bank_ifsc)} font-mono`}
                  placeholder="e.g. SBIN0001234"
                  maxLength={11}
                  value={form.bank_ifsc}
                  onChange={(e) => updateField('bank_ifsc', e.target.value.toUpperCase())}
                />
              </Field>
            </div>
          </div>
        ) : null}

        {/* Multiple Contact Persons Section */}
        <div className="border-t border-slate-200 pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Contact Persons ({contacts.length})
            </label>
            <button
              type="button"
              onClick={addContact}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} /> Add Contact Person
            </button>
          </div>

          <div className="space-y-3">
            {contacts.map((c, index) => (
              <div key={c.local_id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                  <Field label={`Contact #${index + 1} Name`} error={errors[`contact_${c.local_id}_name`]} required>
                    <input
                      className={inputCls(!!errors[`contact_${c.local_id}_name`])}
                      placeholder="Contact Name"
                      value={c.name}
                      onChange={(e) => updateContact(c.local_id, 'name', e.target.value)}
                    />
                  </Field>
                  <Field label="Phone" error={errors[`contact_${c.local_id}_phone`]}>
                    <input
                      className={inputCls(!!errors[`contact_${c.local_id}_phone`])}
                      placeholder="10-15 digits"
                      value={c.phone}
                      onChange={(e) => updateContact(c.local_id, 'phone', e.target.value)}
                    />
                  </Field>
                  <Field label="Email" error={errors[`contact_${c.local_id}_email`]}>
                    <input
                      className={inputCls(!!errors[`contact_${c.local_id}_email`])}
                      type="email"
                      placeholder="email@domain.com"
                      value={c.email}
                      onChange={(e) => updateContact(c.local_id, 'email', e.target.value)}
                    />
                  </Field>
                  <Field label="Role / Designation">
                    <input
                      className={inputCls(false)}
                      placeholder="e.g. Accounts / Dispatch"
                      value={c.role}
                      onChange={(e) => updateContact(c.local_id, 'role', e.target.value)}
                    />
                  </Field>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => removeContact(c.local_id)}
                    className="text-red-500 hover:text-red-700 p-1 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={13} /> Remove Contact
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <Button type="submit" disabled={submitting} icon={<Check size={16} />}>
            {submitting ? 'Saving...' : 'Save Record'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const VENDOR_EXPORT_COLUMNS: ExportColumnOption[] = [
  { key: 'vendor_code', label: 'Vendor Code', category: 'Identifiers' },
  { key: 'name', label: 'Vendor Name', category: 'Identifiers' },
  { key: 'contact_person_name', label: 'Contact Person', category: 'Contact' },
  { key: 'phone', label: 'Phone Number', category: 'Contact' },
  { key: 'email', label: 'Email Address', category: 'Contact' },
  { key: 'address_line1', label: 'Address Line 1', category: 'Address' },
  { key: 'address_line2', label: 'Address Line 2', category: 'Address' },
  { key: 'city', label: 'City', category: 'Address' },
  { key: 'state', label: 'State', category: 'Address' },
  { key: 'pincode', label: 'PIN Code', category: 'Address' },
  { key: 'gstin', label: 'GSTIN', category: 'Tax Details' },
  { key: 'pan', label: 'PAN Number', category: 'Tax Details' },
  { key: 'bank_account_name', label: 'Bank Account Holder', category: 'Banking' },
  { key: 'bank_account_number', label: 'Bank Account Number', category: 'Banking' },
  { key: 'bank_ifsc', label: 'Bank IFSC', category: 'Banking' },
  { key: 'total_business_value', label: 'Lifetime Value', category: 'Financials' },
  { key: 'outstanding_balance', label: 'Outstanding Balance', category: 'Financials' },
  { key: 'total_orders_count', label: 'Total Orders', category: 'Financials' },
  { key: 'status', label: 'Status', category: 'General' },
  { key: 'created_at', label: 'Created Date', category: 'General' }
];

const CUSTOMER_EXPORT_COLUMNS: ExportColumnOption[] = [
  { key: 'customer_code', label: 'Customer Code', category: 'Identifiers' },
  { key: 'name', label: 'Customer Name', category: 'Identifiers' },
  { key: 'contact_person_name', label: 'Contact Person', category: 'Contact' },
  { key: 'phone', label: 'Phone Number', category: 'Contact' },
  { key: 'email', label: 'Email Address', category: 'Contact' },
  { key: 'billing_address', label: 'Billing Address', category: 'Address' },
  { key: 'shipping_address', label: 'Shipping Address', category: 'Address' },
  { key: 'city', label: 'City', category: 'Address' },
  { key: 'state', label: 'State', category: 'Address' },
  { key: 'pincode', label: 'PIN Code', category: 'Address' },
  { key: 'gstin', label: 'GSTIN', category: 'Tax Details' },
  { key: 'pan', label: 'PAN Number', category: 'Tax Details' },
  { key: 'total_business_value', label: 'Lifetime Value', category: 'Financials' },
  { key: 'outstanding_balance', label: 'Outstanding Balance', category: 'Financials' },
  { key: 'total_orders_count', label: 'Total Invoices', category: 'Financials' },
  { key: 'status', label: 'Status', category: 'General' },
  { key: 'created_at', label: 'Created Date', category: 'General' }
];

export function PeoplePage() {
  const { workspace } = useWorkspace();
  const toast = useToast();
  const { canView, canCreate, canEdit, canDelete, canExport } = usePermissions('parties');
  const [tab, setTab] = usePersistentTab<'vendors' | 'customers' | 'payments'>('people_tab', 'vendors');
  const [refresh, setRefresh] = useState(0);
  const [modal, setModal] = useState<null | { type: 'vendor' | 'customer'; row?: any; initialCode?: string }>(null);
  const [detail, setDetail] = useState<null | { endpoint: string; title: string }>(null);

  // Advanced Filter States
  const [statusFilter, setStatusFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [gstinFilter, setGstinFilter] = useState('');
  const [outstandingFilter, setOutstandingFilter] = useState('');

  // Column Export Modal State
  const [exportModalData, setExportModalData] = useState<null | {
    total: number;
    getExportData: () => Promise<any[]>;
  }>(null);

  // Portal Invite States
  const [inviteTarget, setInviteTarget] = useState<null | { type: 'vendor' | 'customer'; row: any }>(null);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [createdInvite, setCreatedInvite] = useState<null | { link: string; email: string; name: string }>(null);

  const triggerPortalInvite = (type: 'vendor' | 'customer', row: any) => {
    setInviteTarget({ type, row });
    setInviteName(row.name || '');
    setInviteEmail(row.email || '');
    setCreatedInvite(null);
  };

  const handleSendInvite = async (e?: FormEvent, forceReinvite = false) => {
    if (e) e.preventDefault();
    if (!inviteTarget) return;
    try {
      const endpoint = inviteTarget.type === 'vendor' 
        ? `/api/vendors/${inviteTarget.row.id}/portal-invite`
        : `/api/customers/${inviteTarget.row.id}/portal-invite`;

      const res = await api.post(endpoint, {
        name: inviteName,
        email: inviteEmail,
        force_reinvite: forceReinvite
      });

      toast(res.data.message || 'Portal invitation generated successfully!', 'success');
      setCreatedInvite({
        link: res.data.invite_link,
        email: inviteEmail,
        name: inviteName,
        already_registered: res.data.already_registered,
        can_reinvite: res.data.can_reinvite,
        message: res.data.message
      } as any);
      setRefresh((r) => r + 1);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to generate portal invite', 'error');
    }
  };

  const partyColumns: TableColumn<AnyRow>[] = [
    { key: 'code', label: 'Code', sortable: true, render: (row) => <span className="font-mono text-xs font-semibold text-slate-700">{row.vendor_code || row.customer_code || row.code || '-'}</span> },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'contact', label: 'Contact', sortable: true, render: (row) => row.contact || row.phone || row.contact_person_name || '-' },
    { key: 'gstin', label: 'GSTIN', render: (row) => row.gstin ? <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">{row.gstin}</span> : <span className="text-slate-400 text-xs">Unregistered</span> },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => canEdit ? (
        <button
          type="button"
          onClick={async (e) => {
            e.stopPropagation();
            const newStatus = row.status === 'Inactive' ? 'Active' : 'Inactive';
            try {
              await api.put(`${endpoint}/${row.id}`, { status: newStatus });
              toast(`Marked ${row.name} as ${newStatus}`, 'success');
              setRefresh((r) => r + 1);
            } catch (err: any) {
              toast(err.response?.data?.error || 'Failed to update status', 'error');
            }
          }}
          title="Click to toggle Active / Inactive"
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
            row.status === 'Inactive'
              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
          }`}
        >
          {row.status || 'Active'}
        </button>
      ) : (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
          row.status === 'Inactive' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-800'
        }`}>
          {row.status || 'Active'}
        </span>
      )
    },
    { key: 'total_business_value', label: 'Lifetime Value', sortable: true, align: 'right', render: (row) => formatCurrency(row.total_business_value, workspace?.currency) },
    {
      key: 'outstanding_balance',
      label: 'Outstanding',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className={Number(row.outstanding_balance || 0) > 0 ? 'text-red-600 font-bold' : 'text-slate-600 font-medium'}>
          {formatCurrency(row.outstanding_balance, workspace?.currency)}
        </span>
      )
    },
    ...(canCreate || canEdit ? [{
      key: 'actions',
      label: 'Portal Action',
      render: (row: any) => {
        const isMember = row.portal_status === 'member' || row.connection_status === 'connected' || Number(row.portal_logged_in_count || 0) > 0;
        const isInvited = row.portal_status === 'invited' || row.connection_status === 'invited' || Number(row.portal_users_count || 0) > 0;

        if (isMember) {
          return (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
              <CheckCircle2 size={12} className="text-emerald-600" /> Member
            </span>
          );
        }

        if (isInvited) {
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerPortalInvite(tab === 'vendors' ? 'vendor' : 'customer', row);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 transition cursor-pointer"
              title="Invitation sent. Click to view or resend invite link"
            >
              <Clock size={11} className="text-amber-600" /> Invited
            </button>
          );
        }

        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerPortalInvite(tab === 'vendors' ? 'vendor' : 'customer', row);
            }}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition cursor-pointer"
          >
            <Send size={11} /> Invite to Portal
          </button>
        );
      }
    }] : [])
  ];

  const paymentColumns: TableColumn<AnyRow>[] = [
    { key: 'date', label: 'Date', sortable: true, render: (row) => formatDate(row.date) },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'party_name', label: 'Related Party', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, align: 'right', render: (row) => formatCurrency(row.amount, workspace?.currency) },
    { key: 'running_due_balance', label: 'Running Due', align: 'right', render: (row) => formatCurrency(row.running_due_balance, workspace?.currency) }
  ];

  const endpoint = tab === 'vendors' ? '/api/vendors' : tab === 'customers' ? '/api/customers' : '/api/payments';
  const inputCls = "w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-600 transition";

  if (!canView) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
        <p className="text-sm text-slate-500 mt-1">You do not have permission to view the Parties module. Contact your workspace administrator to request access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle icon={<Users />} title="Parties & Portal Onboarding" subtitle="Manage vendors, customers, payment history and portal invites." />
      
      {/* Tabs */}
      <div className="inline-flex p-1 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
        <button
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition cursor-pointer ${tab === 'vendors' ? 'bg-blue-50 text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          onClick={() => {
            setTab('vendors');
            setStatusFilter('');
            setStateFilter('');
            setGstinFilter('');
            setOutstandingFilter('');
          }}
        >
          Vendors / Suppliers
        </button>
        <button
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition cursor-pointer ${tab === 'customers' ? 'bg-blue-50 text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          onClick={() => {
            setTab('customers');
            setStatusFilter('');
            setStateFilter('');
            setGstinFilter('');
            setOutstandingFilter('');
          }}
        >
          Customers / Buyers
        </button>
        <button
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition cursor-pointer ${tab === 'payments' ? 'bg-blue-50 text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          onClick={() => setTab('payments')}
        >
          Payment History
        </button>
      </div>

      <DataTable
        endpoint={endpoint}
        columns={tab === 'payments' ? paymentColumns : partyColumns}
        refreshKey={refresh}
        showDateFilters={tab === 'payments'}
        filters={tab === 'payments' ? {} : {
          status: tab === 'vendors' ? (statusFilter || undefined) : undefined,
          state: stateFilter || undefined,
          has_gstin: gstinFilter || undefined,
          has_outstanding: outstandingFilter || undefined
        }}
        extraFilters={tab === 'payments' ? undefined : (
          <div className="flex flex-wrap items-center gap-2">
            {tab === 'vendors' && (
              <div className="w-36">
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: '', label: 'All Status' },
                    { value: 'Active', label: 'Active' },
                    { value: 'Inactive', label: 'Inactive' }
                  ]}
                />
              </div>
            )}
            <div className="w-36">
              <input
                type="text"
                placeholder="Filter by State..."
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 transition"
              />
            </div>
            <div className="w-40">
              <Select
                value={gstinFilter}
                onChange={setGstinFilter}
                options={[
                  { value: '', label: 'All GSTIN Status' },
                  { value: '1', label: 'Registered (GSTIN)' },
                  { value: '0', label: 'Unregistered' }
                ]}
              />
            </div>
            <div className="w-44">
              <Select
                value={outstandingFilter}
                onChange={setOutstandingFilter}
                options={[
                  { value: '', label: 'All Outstanding' },
                  { value: '1', label: 'Has Balance Due' },
                  { value: '0', label: 'Zero Balance / Paid' }
                ]}
              />
            </div>
            {(statusFilter || stateFilter || gstinFilter || outstandingFilter) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('');
                  setStateFilter('');
                  setGstinFilter('');
                  setOutstandingFilter('');
                }}
                className="text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-1 rounded-md hover:bg-red-50 transition cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        )}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        canExport={canExport}
        onCreate={tab === 'payments' || !canCreate ? undefined : async () => {
          const targetType = tab === 'vendors' ? 'vendor' : 'customer';
          try {
            const res = await api.get(`/api/numbering-series/next/${targetType}`);
            setModal({ type: targetType, initialCode: res.data?.next_code });
          } catch {
            setModal({ type: targetType });
          }
        }}
        onView={tab === 'payments' ? undefined : (row) => setDetail({ endpoint: `${endpoint}/${row.id}`, title: `${row.name} Details` })}
        onEdit={tab === 'payments' || !canEdit ? undefined : (row) => setModal({ type: tab === 'vendors' ? 'vendor' : 'customer', row })}
        onDelete={tab === 'payments' || !canDelete ? undefined : async (row) => { await api.delete(`${endpoint}/${row.id}`); toast('Record deleted'); }}
        onExport={tab === 'payments' || !canExport ? undefined : (ctx) => setExportModalData(ctx)}
        createLabel={tab === 'vendors' ? 'Add Vendor' : 'Add Customer'}
        emptyTitle={`No ${tab} yet`}
      />

      {/* Column-Selective Export Modal */}
      {exportModalData && (
        <ExportColumnModal
          title={`Export ${tab === 'vendors' ? 'Vendors' : 'Customers'} to CSV`}
          recordCount={exportModalData.total}
          availableColumns={tab === 'vendors' ? VENDOR_EXPORT_COLUMNS : CUSTOMER_EXPORT_COLUMNS}
          onClose={() => setExportModalData(null)}
          onConfirmExport={async (selectedKeys) => {
            const records = await exportModalData.getExportData();
            const allCols = tab === 'vendors' ? VENDOR_EXPORT_COLUMNS : CUSTOMER_EXPORT_COLUMNS;
            const exportCols: TableColumn<any>[] = allCols
              .filter((c) => selectedKeys.includes(c.key))
              .map((c) => ({
                key: c.key,
                label: c.label
              }));
            csvDownload(
              `${tab}_export_${new Date().toISOString().slice(0, 10)}.csv`,
              records,
              exportCols
            );
            toast(`Exported ${records.length} records with ${exportCols.length} columns!`, 'success');
          }}
        />
      )}

      {/* Invite Modal */}
      {inviteTarget ? (
        <Modal
          title={`Invite ${inviteTarget.row.name} to ${inviteTarget.type === 'vendor' ? 'Vendor Portal' : 'Customer Portal'}`}
          onClose={() => setInviteTarget(null)}
        >
          {createdInvite ? (
            <div className="space-y-4 text-sm text-slate-900">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <ShieldCheck size={22} />
                </div>
                <h4 className="font-bold text-slate-900 text-base">
                  {(createdInvite as any).already_registered ? 'Account Connected Immediately!' : 'Portal Invitation Ready!'}
                </h4>
                <p className="text-xs text-slate-600">
                  {(createdInvite as any).already_registered
                    ? `This contact already has an active account on the ERP platform. Your workspace has been linked immediately! They can log in directly with their existing password.`
                    : `Send this link to ${createdInvite.name} (${createdInvite.email}) via WhatsApp or email to let them set up their password.`}
                </p>
              </div>

              <Field label="Formatted WhatsApp / Email Message Preview">
                <textarea
                  readOnly
                  className={`${inputCls} h-24 bg-slate-50 font-mono text-xs text-slate-700`}
                  value={
                    (createdInvite as any).already_registered
                      ? `Hello ${createdInvite.name},\n\nYou have been connected to our ${inviteTarget.type === 'vendor' ? 'Supplier Portal' : 'Customer Portal'} on ${workspace?.name || 'our platform'}.\n\nYou can log in with your existing account here:\n${createdInvite.link}`
                      : `Hello ${createdInvite.name},\n\nYou have been invited to access our ${inviteTarget.type === 'vendor' ? 'Supplier Portal' : 'Customer Portal'} on ${workspace?.name || 'our platform'}.\n\nPlease set up your password here:\n${createdInvite.link}`
                  }
                />
              </Field>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                {(createdInvite as any).already_registered ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleSendInvite(undefined, true)}
                    icon={<RefreshCw size={14} />}
                  >
                    Reset Password & Get New Setup Link
                  </Button>
                ) : (
                  <div />
                )}
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(createdInvite.link);
                    toast('Invite link copied to clipboard!', 'success');
                  }}
                  icon={<Copy size={15} />}
                >
                  {(createdInvite as any).already_registered ? 'Copy Login Link' : 'Copy Invite Link (WhatsApp / Email)'}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={(e) => handleSendInvite(e, false)} className="space-y-4 text-sm">
              <Field label="Contact Person Name">
                <input
                  className={inputCls}
                  required
                  placeholder="Recipient Name"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </Field>
              <Field label="Email Address">
                <input
                  className={inputCls}
                  type="email"
                  required
                  placeholder="contact@business.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </Field>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="secondary" onClick={() => setInviteTarget(null)}>Cancel</Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleSendInvite(undefined, true)}
                    icon={<RefreshCw size={14} />}
                    title="Generate a fresh password setup link even if the vendor was previously connected"
                  >
                    Reset / New Setup Link
                  </Button>
                  <Button type="submit" icon={<Send size={15} />}>
                    Generate Portal Invite
                  </Button>
                </div>
              </div>
            </form>
          )}
        </Modal>
      ) : null}

      {modal ? <PartyModal config={modal} onClose={() => setModal(null)} onSaved={() => { setRefresh((value) => value + 1); setModal(null); }} /> : null}
      {detail ? (
        <PartyDetailDrawer
          endpoint={detail.endpoint}
          type={tab === 'vendors' ? 'vendor' : 'customer'}
          title={detail.title}
          onClose={() => setDetail(null)}
          onInvitePortal={(party) => {
            setDetail(null);
            triggerPortalInvite(tab === 'vendors' ? 'vendor' : 'customer', party);
          }}
        />
      ) : null}
    </div>
  );
}
