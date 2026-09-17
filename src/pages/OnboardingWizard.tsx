import { useEffect, useState } from 'react';
import { Building2, Check, Plus, Trash2, Package2, Users, Landmark, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast, useWorkspace } from '../context';
import { PageTitle } from '../components/ui/PageTitle';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { getCurrencySymbol, generateUUID } from '../lib/utils';

// Helper validators
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
const isValidPhone = (phone: string) => {
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
};
const isValidGstin = (gstin: string) => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(String(gstin).trim());
const isValidPan = (pan: string) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(String(pan).trim());
const isValidIfsc = (ifsc: string) => /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(String(ifsc).trim());
const isValidPincode = (pincode: string) => /^[0-9]{6}$/.test(String(pincode).trim());

export function OnboardingWizard() {
  const { workspace, reloadWorkspace } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const draftKey = `erp_onboarding_draft_${workspace?.id || 'current'}`;

  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 1: Business Profile & GST Configuration
  const [business, setBusiness] = useState<Record<string, any>>({
    name: workspace?.name || '',
    business_type: workspace?.business_type || 'Manufacturing & Trading',
    currency: workspace?.currency || 'INR',
    phone: '',
    email: '',
    gstin: (workspace as any)?.gstin || '',
    state: (workspace as any)?.state || '',
    pan: (workspace as any)?.pan || '',
    address: '',
    city: '',
    pincode: '',
    invoice_prefix: 'INV-',
    bank_name: '',
    bank_account_name: '',
    bank_account_number: '',
    bank_ifsc: '',
    bank_branch: ''
  });

  // Step 2: Vendors & Customers Master
  const [parties, setParties] = useState<any[]>([
    {
      local_id: generateUUID(),
      kind: 'vendor',
      code: 'VEN-0001',
      name: '',
      email: '',
      gstin: '',
      street: '',
      city: '',
      state: '',
      pincode: '',
      pan: '',
      address: '',
      bank_account_name: '',
      bank_account_number: '',
      bank_ifsc: '',
      contacts: [
        { local_id: generateUUID(), name: '', phone: '', email: '', role: 'Primary Contact' }
      ]
    }
  ]);

  // Step 3: Purchasing Items Master
  const [materials, setMaterials] = useState<any[]>([
    { local_id: generateUUID(), code: 'RAW-001', name: '', item_type: 'Raw Material', unit: 'kg', hsn_code: '', tax_rate: '18', reorder_level: '100' }
  ]);

  // Step 4: Finished Goods Catalog
  const [goods, setGoods] = useState<any[]>([
    { local_id: generateUUID(), name: '', unit: 'kg', default_price: '500', hsn_code: '', tax_rate: '18', reorder_level: '50' }
  ]);

  // 1. Initial Load: Check localStorage draft first, then fetch server data
  useEffect(() => {
    let isMounted = true;

    // Load draft from localStorage if available
    try {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.step && typeof parsed.step === 'number') setStep(parsed.step);
        if (parsed.business && typeof parsed.business === 'object') {
          setBusiness((prev) => ({ ...prev, ...parsed.business }));
        }
        if (Array.isArray(parsed.parties) && parsed.parties.length > 0) {
          const sanitized = parsed.parties.map((p: any) => {
            let pContacts: any[] = [];
            if (Array.isArray(p.contacts)) {
              pContacts = p.contacts;
            } else if (typeof p.contacts === 'string' && p.contacts.trim()) {
              try {
                const parsedC = JSON.parse(p.contacts);
                if (Array.isArray(parsedC)) pContacts = parsedC;
              } catch {}
            }
            return {
              ...p,
              contacts: pContacts.length > 0 ? pContacts : (p.contacts || [{ local_id: generateUUID(), name: '', phone: '', email: '', role: 'Primary Contact' }])
            };
          });
          setParties(sanitized);
        }
        if (Array.isArray(parsed.materials) && parsed.materials.length > 0) {
          setMaterials(parsed.materials);
        }
        if (Array.isArray(parsed.goods) && parsed.goods.length > 0) {
          setGoods(parsed.goods);
        }
      }
    } catch (e) {
      console.warn('Could not read onboarding draft from localStorage', e);
    }

    // Fetch existing database state
    async function loadExistingData() {
      try {
        const [wsRes, itemsRes, goodsRes, vendorsRes, custRes] = await Promise.all([
          api.get('/api/workspace').catch(() => null),
          api.get('/api/items').catch(() => null),
          api.get('/api/finished-goods').catch(() => null),
          api.get('/api/vendors').catch(() => null),
          api.get('/api/customers').catch(() => null)
        ]);

        if (!isMounted) return;

        if (wsRes?.data) {
          const w = wsRes.data;
          setBusiness((prev) => ({
            ...prev,
            name: prev.name || w.name || '',
            business_type: prev.business_type || w.business_type || 'Manufacturing & Trading',
            currency: prev.currency || w.currency || 'INR',
            phone: prev.phone || w.support_phone || w.contact_phone || '',
            email: prev.email || w.support_email || w.contact_email || '',
            gstin: prev.gstin || w.gstin || '',
            state: prev.state || w.state || '',
            pan: prev.pan || w.pan || '',
            address: prev.address || w.address || '',
            city: prev.city || w.city || '',
            pincode: prev.pincode || w.pincode || '',
            bank_name: prev.bank_name || w.bank_name || '',
            bank_account_name: prev.bank_account_name || w.bank_account_name || '',
            bank_account_number: prev.bank_account_number || w.bank_account_number || '',
            bank_ifsc: prev.bank_ifsc || w.bank_ifsc || '',
            bank_branch: prev.bank_branch || w.bank_branch || '',
            invoice_prefix: prev.invoice_prefix || 'INV-'
          }));
        }

        if (itemsRes?.data && Array.isArray(itemsRes.data) && itemsRes.data.length > 0) {
          setMaterials((prev) => {
            if (prev.some((m) => m.name && m.name.trim() && !m.id)) return prev;
            return itemsRes.data.map((item: any) => ({
              local_id: generateUUID(),
              id: item.id,
              code: item.code || '',
              name: item.name || '',
              item_type: item.item_type || 'Raw Material',
              unit: item.unit || 'kg',
              hsn_code: item.hsn_code || '',
              tax_rate: String(item.tax_rate ?? 18),
              reorder_level: item.reorder_level != null ? String(item.reorder_level) : ''
            }));
          });
        }

        if (goodsRes?.data && Array.isArray(goodsRes.data) && goodsRes.data.length > 0) {
          setGoods((prev) => {
            if (prev.some((g) => g.name && g.name.trim() && !g.id)) return prev;
            return goodsRes.data.map((g: any) => ({
              local_id: generateUUID(),
              id: g.id,
              name: g.name || '',
              unit: g.unit || 'kg',
              default_price: g.default_price != null ? String(g.default_price) : '',
              hsn_code: g.hsn_code || '',
              tax_rate: String(g.tax_rate ?? 18),
              reorder_level: g.reorder_level != null ? String(g.reorder_level) : ''
            }));
          });
        }

        const loadedParties: any[] = [];
        if (vendorsRes?.data && Array.isArray(vendorsRes.data)) {
          for (const v of vendorsRes.data) {
            let vContacts: any[] = [];
            if (Array.isArray(v.contacts)) {
              vContacts = v.contacts;
            } else if (typeof v.contacts === 'string' && v.contacts.trim()) {
              try {
                const parsed = JSON.parse(v.contacts);
                if (Array.isArray(parsed)) vContacts = parsed;
              } catch {}
            }

            const rawContacts = vContacts.length > 0
              ? vContacts.map((c: any) => ({ local_id: c.local_id || generateUUID(), ...c }))
              : [{ local_id: generateUUID(), name: v.contact_person_name || v.contact || '', phone: v.phone || v.contact || '', email: v.email || '', role: 'Primary Contact' }];

            loadedParties.push({
              local_id: generateUUID(),
              id: v.id,
              kind: 'vendor',
              code: v.vendor_code || v.code || '',
              name: v.name || '',
              email: v.email || '',
              gstin: v.gstin || '',
              street: v.street || v.address_line1 || v.address || '',
              city: v.city || '',
              state: v.state || '',
              pincode: v.pincode || '',
              pan: v.pan || '',
              address: v.address || v.address_line1 || '',
              bank_account_name: v.bank_account_name || '',
              bank_account_number: v.bank_account_number || '',
              bank_ifsc: v.bank_ifsc || '',
              contacts: rawContacts
            });
          }
        }

        if (custRes?.data && Array.isArray(custRes.data)) {
          custRes.data.forEach((c: any) => {
            let cContacts: any[] = [];
            if (Array.isArray(c.contacts)) {
              cContacts = c.contacts;
            } else if (typeof c.contacts === 'string' && c.contacts.trim()) {
              try {
                const parsed = JSON.parse(c.contacts);
                if (Array.isArray(parsed)) cContacts = parsed;
              } catch {}
            }

            const rawContacts = cContacts.length > 0
              ? cContacts.map((ct: any) => ({ local_id: ct.local_id || generateUUID(), ...ct }))
              : [{ local_id: generateUUID(), name: c.contact_person_name || c.contact || '', phone: c.phone || c.contact || '', email: c.email || '', role: 'Primary Contact' }];

            loadedParties.push({
              local_id: generateUUID(),
              id: c.id,
              kind: 'customer',
              code: c.customer_code || c.code || '',
              name: c.name || '',
              email: c.email || '',
              gstin: c.gstin || '',
              street: c.street || c.billing_address || c.address || '',
              city: c.city || '',
              state: c.state || '',
              pincode: c.pincode || '',
              pan: c.pan || '',
              address: c.address || c.billing_address || '',
              contacts: rawContacts
            });
          });
        }

        if (loadedParties.length > 0) {
          setParties((prev) => {
            const hasDraftEdits = prev.some((p) => p.name && p.name.trim() && !p.id);
            if (hasDraftEdits) return prev;
            return loadedParties;
          });
        }
      } catch (err) {
        console.error('Failed to load existing business configuration', err);
      }
    }

    loadExistingData();
    return () => { isMounted = false; };
  }, [draftKey]);

  // 2. Draft Auto-Save: Persist to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        step,
        business,
        parties,
        materials,
        goods,
        updatedAt: Date.now()
      }));
    } catch (e) {
      // Ignore quota or privacy exceptions
    }
  }, [step, business, parties, materials, goods, draftKey]);

  const currencySymbol = getCurrencySymbol(business.currency || workspace?.currency);
  const totalSteps = 4;

  const selectCls = (hasError?: boolean) =>
    `w-full bg-white border ${hasError ? 'border-rose-400 focus:border-rose-600 focus:ring-rose-500/20' : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/20'} rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 transition cursor-pointer shadow-2xs`;

  const inputCls = (hasError?: boolean) =>
    `w-full bg-white border ${hasError ? 'border-rose-400 focus:border-rose-600 focus:ring-rose-500/20' : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/20'} rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition shadow-2xs`;

  const clearError = (key: string) => {
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const addRow = (setter: any, defaultObj: any) => {
    setter((items: any[]) => [...items, { local_id: generateUUID(), ...defaultObj }]);
  };

  const updateRowField = (setter: any, localId: string, field: string, value: any) => {
    clearError(`${localId}_${field}`);
    setter((items: any[]) =>
      items.map((i) => (i.local_id === localId ? { ...i, [field]: value } : i))
    );
  };

  const handlePartyKindChange = (localId: string, newKind: 'vendor' | 'customer') => {
    clearError(`${localId}_kind`);
    clearError(`${localId}_code`);
    setParties((prev) => {
      const targetPrefix = newKind === 'vendor' ? 'VEN-' : 'CUST-';

      // Find highest existing sequence number for this specific kind
      let maxNum = 0;
      prev.forEach((p) => {
        if (p.local_id !== localId && p.kind === newKind) {
          const match = String(p.code || '').match(/(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
        }
      });
      const nextNum = maxNum + 1;

      return prev.map((p) => {
        if (p.local_id !== localId) return p;

        // Automatically update code if it was empty or matches standard VEN-/CUST- prefix
        const isAutoGenerated = !p.code || p.code.startsWith('VEN-') || p.code.startsWith('CUST-');
        const updatedCode = isAutoGenerated
          ? `${targetPrefix}${String(nextNum).padStart(4, '0')}`
          : p.code;

        return {
          ...p,
          kind: newKind,
          code: updatedCode
        };
      });
    });
  };

  // Step 2 Guard: Remove Party Line
  const removePartyLine = (localId: string) => {
    if (parties.length <= 1) {
      toast('At least one vendor or customer is required.', 'error');
      return;
    }
    setParties((items) => items.filter((i) => i.local_id !== localId));
  };

  // Step 2 Contact Person Helpers
  const addPartyContact = (partyLocalId: string) => {
    setParties((prev) =>
      prev.map((p) => {
        if (p.local_id === partyLocalId) {
          const list = Array.isArray(p.contacts) ? p.contacts : [];
          return {
            ...p,
            contacts: [
              ...list,
              { local_id: generateUUID(), name: '', phone: '', email: '', role: 'Accounts / Billing' }
            ]
          };
        }
        return p;
      })
    );
  };

  // Step 2 Guard: Remove Contact Person
  const removePartyContact = (partyLocalId: string, contactLocalId: string) => {
    setParties((prev) =>
      prev.map((p) => {
        if (p.local_id === partyLocalId) {
          if ((p.contacts || []).length <= 1) {
            toast('At least one contact person is required.', 'error');
            return p;
          }
          return {
            ...p,
            contacts: (p.contacts || []).filter((c: any) => c.local_id !== contactLocalId)
          };
        }
        return p;
      })
    );
  };

  const updatePartyContact = (partyLocalId: string, contactLocalId: string, field: string, value: string) => {
    clearError(`${partyLocalId}_${contactLocalId}_${field}`);
    setParties((prev) =>
      prev.map((p) => {
        if (p.local_id === partyLocalId) {
          return {
            ...p,
            contacts: (p.contacts || []).map((c: any) =>
              c.local_id === contactLocalId ? { ...c, [field]: value } : c
            )
          };
        }
        return p;
      })
    );
  };

  // Step 3 Guard: Remove Material
  const removeMaterial = (localId: string) => {
    if (materials.length <= 1) {
      toast('At least one purchasing item is required.', 'error');
      return;
    }
    setMaterials((items) => items.filter((i) => i.local_id !== localId));
  };

  // Step 4 Guard: Remove Good
  const removeGood = (localId: string) => {
    if (goods.length <= 1) {
      toast('At least one finished good is required.', 'error');
      return;
    }
    setGoods((items) => items.filter((i) => i.local_id !== localId));
  };

  // ==========================================
  // VALIDATIONS FOR EACH STEP
  // ==========================================
  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!business.name || !business.name.trim()) {
      newErrors.name = 'Workspace / Company name is required';
    }
    if (!business.business_type || !business.business_type.trim()) {
      newErrors.business_type = 'Business type is required';
    }
    if (!business.phone || !business.phone.trim()) {
      newErrors.phone = 'Company phone number is required';
    } else if (!isValidPhone(business.phone)) {
      newErrors.phone = 'Enter a valid 10 to 15 digit phone number';
    }
    if (!business.email || !business.email.trim()) {
      newErrors.email = 'Official company email is required';
    } else if (!isValidEmail(business.email)) {
      newErrors.email = 'Enter a valid email address';
    }
    if (!business.gstin || !business.gstin.trim()) {
      newErrors.gstin = '15-character GSTIN is required';
    } else if (!isValidGstin(business.gstin)) {
      newErrors.gstin = 'Invalid GSTIN format (e.g. 07AAAAA0000A1Z5)';
    }
    if (!business.pan || !business.pan.trim()) {
      newErrors.pan = '10-character PAN is required';
    } else if (!isValidPan(business.pan)) {
      newErrors.pan = 'Invalid PAN format (e.g. ABCDE1234F)';
    }
    if (!business.invoice_prefix || !business.invoice_prefix.trim()) {
      newErrors.invoice_prefix = 'Invoice series prefix is required (e.g. INV-)';
    }

    // Registered Business Address (4 fields)
    if (!business.address || !business.address.trim()) {
      newErrors.address = 'Street / Building address is required';
    }
    if (!business.city || !business.city.trim()) {
      newErrors.city = 'City is required';
    }
    if (!business.state || !business.state.trim()) {
      newErrors.state = 'State is required';
    }
    if (!business.pincode || !business.pincode.trim()) {
      newErrors.pincode = 'PIN Code is required';
    } else if (!isValidPincode(business.pincode)) {
      newErrors.pincode = 'Enter a valid 6-digit PIN code';
    }

    // Bank Account Details
    if (!business.bank_name || !business.bank_name.trim()) {
      newErrors.bank_name = 'Bank name is required';
    }
    if (!business.bank_account_name || !business.bank_account_name.trim()) {
      newErrors.bank_account_name = 'Account holder name is required';
    }
    if (!business.bank_account_number || !business.bank_account_number.trim()) {
      newErrors.bank_account_number = 'Bank account number is required';
    } else if (!/^[0-9A-Za-z]{8,25}$/.test(business.bank_account_number.trim())) {
      newErrors.bank_account_number = 'Enter a valid account number';
    }
    if (!business.bank_ifsc || !business.bank_ifsc.trim()) {
      newErrors.bank_ifsc = 'IFSC code is required';
    } else if (!isValidIfsc(business.bank_ifsc)) {
      newErrors.bank_ifsc = 'Invalid 11-char IFSC code (e.g. SBIN0001234)';
    }
    if (!business.bank_branch || !business.bank_branch.trim()) {
      newErrors.bank_branch = 'Bank branch name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!parties || parties.length === 0) {
      newErrors._general = 'At least one vendor or customer is required';
      setErrors(newErrors);
      return false;
    }

    parties.forEach((p, idx) => {
      const pPrefix = p.local_id;
      if (!p.name || !p.name.trim()) {
        newErrors[`${pPrefix}_name`] = 'Legal party name is required';
      }
      if (!p.email || !p.email.trim()) {
        newErrors[`${pPrefix}_email`] = 'Email is required';
      } else if (!isValidEmail(p.email)) {
        newErrors[`${pPrefix}_email`] = 'Invalid email format';
      }
      if (!p.gstin || !p.gstin.trim()) {
        newErrors[`${pPrefix}_gstin`] = '15-char GSTIN is required';
      } else if (!isValidGstin(p.gstin)) {
        newErrors[`${pPrefix}_gstin`] = 'Invalid 15-char GSTIN format';
      }
      if (!p.pan || !p.pan.trim()) {
        newErrors[`${pPrefix}_pan`] = '10-char PAN is required';
      } else if (!isValidPan(p.pan)) {
        newErrors[`${pPrefix}_pan`] = 'Invalid 10-char PAN format (e.g. ABCDE1234F)';
      }
      if (!p.street || !p.street.trim()) {
        newErrors[`${pPrefix}_street`] = 'Street / Building address is required';
      }
      if (!p.city || !p.city.trim()) {
        newErrors[`${pPrefix}_city`] = 'City is required';
      }
      if (!p.state || !p.state.trim()) {
        newErrors[`${pPrefix}_state`] = 'State is required';
      }
      if (!p.pincode || !p.pincode.trim()) {
        newErrors[`${pPrefix}_pincode`] = 'PIN code is required';
      } else if (!isValidPincode(p.pincode)) {
        newErrors[`${pPrefix}_pincode`] = 'Enter a valid 6-digit PIN code';
      }

      // If vendor, bank details required
      if (p.kind === 'vendor') {
        if (!p.bank_account_name || !p.bank_account_name.trim()) {
          newErrors[`${pPrefix}_bank_account_name`] = 'Account holder name is required';
        }
        if (!p.bank_account_number || !p.bank_account_number.trim()) {
          newErrors[`${pPrefix}_bank_account_number`] = 'Account number is required';
        }
        if (!p.bank_ifsc || !p.bank_ifsc.trim()) {
          newErrors[`${pPrefix}_bank_ifsc`] = 'IFSC code is required';
        } else if (!isValidIfsc(p.bank_ifsc)) {
          newErrors[`${pPrefix}_bank_ifsc`] = 'Invalid 11-char IFSC';
        }
      }

      // Contact Persons
      const contacts = p.contacts || [];
      if (contacts.length === 0) {
        newErrors[`${pPrefix}_contacts`] = `Party #${idx + 1} requires at least one contact person`;
      } else {
        contacts.forEach((c: any) => {
          const cPrefix = `${pPrefix}_${c.local_id}`;
          if (!c.name || !c.name.trim()) {
            newErrors[`${cPrefix}_name`] = 'Contact name is required';
          }
          if (!c.phone || !c.phone.trim()) {
            newErrors[`${cPrefix}_phone`] = 'Phone number is required';
          } else if (!isValidPhone(c.phone)) {
            newErrors[`${cPrefix}_phone`] = 'Invalid phone number';
          }
          if (!c.email || !c.email.trim()) {
            newErrors[`${cPrefix}_email`] = 'Contact email is required';
          } else if (!isValidEmail(c.email)) {
            newErrors[`${cPrefix}_email`] = 'Invalid email';
          }
          if (!c.role || !c.role.trim()) {
            newErrors[`${cPrefix}_role`] = 'Role / designation is required';
          }
        });
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!materials || materials.length === 0) {
      newErrors._general = 'At least one purchasing item is required';
      setErrors(newErrors);
      return false;
    }

    materials.forEach((m) => {
      const prefix = m.local_id;
      if (!m.name || !m.name.trim()) {
        newErrors[`${prefix}_name`] = 'Item name is required';
      }
      if (!m.item_type || !m.item_type.trim()) {
        newErrors[`${prefix}_item_type`] = 'Category is required';
      }
      if (!m.unit || !m.unit.trim()) {
        newErrors[`${prefix}_unit`] = 'Unit of measure is required';
      }
      if (!m.hsn_code || !m.hsn_code.trim()) {
        newErrors[`${prefix}_hsn_code`] = 'HSN Code is required';
      }
      if (m.tax_rate === '' || m.tax_rate === undefined || isNaN(Number(m.tax_rate))) {
        newErrors[`${prefix}_tax_rate`] = 'Tax rate is required';
      }
      if (m.reorder_level === '' || m.reorder_level === undefined || isNaN(Number(m.reorder_level)) || Number(m.reorder_level) < 0) {
        newErrors[`${prefix}_reorder_level`] = 'Reorder level must be a valid number ≥ 0';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep4 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!goods || goods.length === 0) {
      newErrors._general = 'At least one finished good is required';
      setErrors(newErrors);
      return false;
    }

    goods.forEach((g) => {
      const prefix = g.local_id;
      if (!g.name || !g.name.trim()) {
        newErrors[`${prefix}_name`] = 'Product name is required';
      }
      if (!g.unit || !g.unit.trim()) {
        newErrors[`${prefix}_unit`] = 'Unit is required';
      }
      if (!g.hsn_code || !g.hsn_code.trim()) {
        newErrors[`${prefix}_hsn_code`] = 'HSN Code is required';
      }
      if (g.default_price === '' || g.default_price === undefined || isNaN(Number(g.default_price)) || Number(g.default_price) <= 0) {
        newErrors[`${prefix}_default_price`] = 'Selling price must be greater than 0';
      }
      if (g.reorder_level === '' || g.reorder_level === undefined || isNaN(Number(g.reorder_level)) || Number(g.reorder_level) < 0) {
        newErrors[`${prefix}_reorder_level`] = 'Reorder level must be a valid number ≥ 0';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ==========================================
  // INCREMENTAL BACKEND SAVE HANDLERS
  // ==========================================

  // Step 1 Save
  const saveStep1Data = async () => {
    const payload = {
      name: business.name.trim(),
      business_type: business.business_type.trim(),
      currency: business.currency.trim().toUpperCase(),
      phone: business.phone.trim(),
      email: business.email.trim(),
      gstin: business.gstin.trim().toUpperCase(),
      state: business.state.trim(),
      pan: business.pan.trim().toUpperCase(),
      address: business.address.trim(),
      city: business.city.trim(),
      pincode: business.pincode.trim(),
      bank_name: business.bank_name.trim(),
      bank_account_name: business.bank_account_name.trim(),
      bank_account_number: business.bank_account_number.trim(),
      bank_ifsc: business.bank_ifsc.trim().toUpperCase(),
      bank_branch: business.bank_branch.trim(),
      invoice_prefix: business.invoice_prefix.trim().toUpperCase(),
      onboarding_completed: false
    };

    await api.put('/api/workspace', payload);
  };

  // Step 2 Save
  const saveStep2Data = async () => {
    for (const party of parties) {
      const isVendor = party.kind === 'vendor';
      const baseEndpoint = isVendor ? '/api/vendors' : '/api/customers';
      const cleanContacts = (party.contacts || []).map((c: any) => ({
        name: c.name.trim(),
        phone: c.phone.trim(),
        email: c.email.trim(),
        role: c.role.trim()
      }));

      const primary = cleanContacts[0] || {};
      const payload: any = {
        name: party.name.trim(),
        email: party.email ? party.email.trim() : primary.email || null,
        phone: primary.phone || null,
        contact: primary.phone || primary.name || null,
        contact_person_name: primary.name || null,
        gstin: party.gstin.trim().toUpperCase(),
        street: (party.street || party.address || '').trim(),
        city: (party.city || '').trim(),
        state: party.state.trim(),
        pincode: (party.pincode || '').trim(),
        pan: party.pan && party.pan.trim() ? party.pan.trim().toUpperCase() : null,
        address: (party.street || party.address || '').trim(),
        contacts: cleanContacts
      };

      if (isVendor) {
        payload.vendor_code = party.code && party.code.trim() ? party.code.trim().toUpperCase() : undefined;
        payload.address_line1 = (party.street || party.address || '').trim();
        payload.bank_account_name = party.bank_account_name ? party.bank_account_name.trim() : null;
        payload.bank_account_number = party.bank_account_number ? party.bank_account_number.trim() : null;
        payload.bank_ifsc = party.bank_ifsc ? party.bank_ifsc.trim().toUpperCase() : null;
      } else {
        payload.customer_code = party.code && party.code.trim() ? party.code.trim().toUpperCase() : undefined;
        payload.billing_address = (party.street || party.address || '').trim();
      }

      let res;
      if (party.id) {
        res = await api.put(`${baseEndpoint}/${party.id}`, payload);
      } else {
        res = await api.post(baseEndpoint, payload);
      }
      if (res?.data?.id && !party.id) {
        party.id = res.data.id;
      }
    }
  };

  // Step 3 Save
  const saveStep3Data = async () => {
    for (const item of materials) {
      const payload: any = {
        name: item.name.trim(),
        item_type: item.item_type || 'Raw Material',
        unit: item.unit.trim(),
        hsn_code: item.hsn_code.trim(),
        tax_rate: Number(item.tax_rate) || 18,
        reorder_level: Number(item.reorder_level) || 0
      };
      if (item.code && item.code.trim()) {
        payload.code = item.code.trim().toUpperCase();
      }

      let res;
      if (item.id) {
        res = await api.put(`/api/items/${item.id}`, payload);
      } else {
        res = await api.post('/api/items', payload);
      }
      if (res?.data?.id && !item.id) {
        item.id = res.data.id;
      }
    }
  };

  // Step 4 Save & Finish
  const saveStep4AndFinish = async () => {
    for (const item of goods) {
      const payload = {
        name: item.name.trim(),
        unit: item.unit.trim(),
        hsn_code: item.hsn_code.trim(),
        tax_rate: item.tax_rate != null && item.tax_rate !== '' ? Number(item.tax_rate) : 18,
        default_price: Number(item.default_price) || 0,
        reorder_level: Number(item.reorder_level) || 0
      };

      let res;
      if (item.id) {
        res = await api.put(`/api/finished-goods/${item.id}`, payload);
      } else {
        res = await api.post('/api/finished-goods', payload);
      }
      if (res?.data?.id && !item.id) {
        item.id = res.data.id;
      }
    }

    // Finalize onboarding status on workspace
    await api.put('/api/workspace', {
      name: business.name.trim(),
      business_type: business.business_type.trim(),
      currency: business.currency.trim().toUpperCase(),
      phone: business.phone.trim(),
      email: business.email.trim(),
      gstin: business.gstin.trim().toUpperCase(),
      state: business.state.trim(),
      pan: business.pan.trim().toUpperCase(),
      address: business.address.trim(),
      city: business.city.trim(),
      pincode: business.pincode.trim(),
      bank_name: business.bank_name.trim(),
      bank_account_name: business.bank_account_name.trim(),
      bank_account_number: business.bank_account_number.trim(),
      bank_ifsc: business.bank_ifsc.trim().toUpperCase(),
      bank_branch: business.bank_branch.trim(),
      invoice_prefix: business.invoice_prefix.trim().toUpperCase(),
      onboarding_completed: true
    });
  };

  // Step Navigation with Immediate Persistence
  const handleNext = async () => {
    if (isSaving) return;

    if (step === 1) {
      if (!validateStep1()) {
        toast('Please resolve all validation errors on the business profile before proceeding.', 'error');
        return;
      }
      setIsSaving(true);
      try {
        await saveStep1Data();
        toast('Business profile saved successfully!', 'success');
        setStep(2);
      } catch (err: any) {
        toast(err.response?.data?.error || 'Failed to save business profile', 'error');
      } finally {
        setIsSaving(false);
      }
    } else if (step === 2) {
      if (!validateStep2()) {
        toast('Please fill all required vendor/customer and contact details correctly.', 'error');
        return;
      }
      setIsSaving(true);
      try {
        await saveStep2Data();
        toast('Vendors & Customers master saved successfully!', 'success');
        setStep(3);
      } catch (err: any) {
        toast(err.response?.data?.error || 'Failed to save party records', 'error');
      } finally {
        setIsSaving(false);
      }
    } else if (step === 3) {
      if (!validateStep3()) {
        toast('Please fill all required purchasing item fields correctly.', 'error');
        return;
      }
      setIsSaving(true);
      try {
        await saveStep3Data();
        toast('Purchasing items catalog saved successfully!', 'success');
        setStep(4);
      } catch (err: any) {
        toast(err.response?.data?.error || 'Failed to save purchasing items', 'error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleFinalSubmit = async () => {
    if (isSaving) return;

    if (!validateStep4()) {
      toast('Please fill all required finished good fields correctly.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await saveStep4AndFinish();

      // Clear the local draft upon complete successful onboarding
      try {
        localStorage.removeItem(draftKey);
      } catch (e) { }

      toast('Business configuration completed successfully!', 'success');
      await reloadWorkspace();
      navigate('/');
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to finalize business configuration', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header Progress Strip */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
          <span className="flex items-center gap-2 text-blue-700">
            <Building2 size={16} /> Step {step} of {totalSteps}: {
              step === 1 ? 'Company & GST Profile' :
                step === 2 ? 'Vendors & Customers Master' :
                  step === 3 ? 'Purchasing Items Catalog' : 'Finished Goods Catalog'
            }
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem('erp_skip_onboarding', 'true');
                navigate('/');
              }}
              className="text-xs normal-case text-slate-400 hover:text-slate-700 transition-colors font-medium cursor-pointer"
            >
              Skip to Dashboard &rarr;
            </button>
            <span>{Math.round((step / totalSteps) * 100)}% Complete</span>
          </div>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${(step / totalSteps) * 100}%` }} />
        </div>
      </div>

      {/* Global Validation Banner if general error */}
      {errors._general && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-sm font-medium">
          <AlertCircle size={16} /> {errors._general}
        </div>
      )}

      {/* STEP 1: Company Profile, Address & Bank Details */}
      {step === 1 ? (
        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
          <PageTitle
            icon={<Building2 />}
            title="Step 1: Company & GST Profile"
            subtitle="Configure owner company details, contact info, registered address, GST/PAN credentials, and company bank details."
          />

          {/* Basic Company Identity */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
              1. General Information & Tax Credentials
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Workspace / Company Name" error={errors.name} required>
                <input
                  className={inputCls(!!errors.name)}
                  placeholder="e.g. Acme Industries Private Limited"
                  value={business.name}
                  onChange={(e) => {
                    clearError('name');
                    setBusiness({ ...business, name: e.target.value });
                  }}
                />
              </Field>

              <Field label="Business Type" error={errors.business_type} required>
                <input
                  className={inputCls(!!errors.business_type)}
                  placeholder="e.g. Manufacturing & Trading"
                  value={business.business_type}
                  onChange={(e) => {
                    clearError('business_type');
                    setBusiness({ ...business, business_type: e.target.value });
                  }}
                />
              </Field>

              <Field label="Company Phone / Mobile" error={errors.phone} required>
                <input
                  className={inputCls(!!errors.phone)}
                  placeholder="+91 98765 43210"
                  value={business.phone}
                  onChange={(e) => {
                    clearError('phone');
                    setBusiness({ ...business, phone: e.target.value });
                  }}
                />
              </Field>

              <Field label="Official Email Address" error={errors.email} required>
                <input
                  className={inputCls(!!errors.email)}
                  type="email"
                  placeholder="info@acmeindustries.com"
                  value={business.email}
                  onChange={(e) => {
                    clearError('email');
                    setBusiness({ ...business, email: e.target.value });
                  }}
                />
              </Field>

              <Field label="Invoice Series Prefix" error={errors.invoice_prefix} required>
                <input
                  className={inputCls(!!errors.invoice_prefix)}
                  placeholder="INV-"
                  value={business.invoice_prefix}
                  onChange={(e) => {
                    clearError('invoice_prefix');
                    setBusiness({ ...business, invoice_prefix: e.target.value.toUpperCase() });
                  }}
                />
              </Field>

              <Field label="15-Char GSTIN Number" error={errors.gstin} required>
                <input
                  className={inputCls(!!errors.gstin)}
                  placeholder="07AAAAA0000A1Z5"
                  maxLength={15}
                  value={business.gstin}
                  onChange={(e) => {
                    clearError('gstin');
                    setBusiness({ ...business, gstin: e.target.value.toUpperCase() });
                  }}
                />
              </Field>

              <Field label="PAN Number" error={errors.pan} required>
                <input
                  className={inputCls(!!errors.pan)}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  value={business.pan}
                  onChange={(e) => {
                    clearError('pan');
                    setBusiness({ ...business, pan: e.target.value.toUpperCase() });
                  }}
                />
              </Field>
            </div>
          </div>

          {/* Registered Address */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
              2. Registered Business Address
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <Field label="Street / Building Address" error={errors.address} required>
                  <input
                    className={inputCls(!!errors.address)}
                    placeholder="Plot No. 42, Sector 18, Industrial Estate"
                    value={business.address}
                    onChange={(e) => {
                      clearError('address');
                      setBusiness({ ...business, address: e.target.value });
                    }}
                  />
                </Field>
              </div>

              <Field label="City" error={errors.city} required>
                <input
                  className={inputCls(!!errors.city)}
                  placeholder="e.g. New Delhi"
                  value={business.city}
                  onChange={(e) => {
                    clearError('city');
                    setBusiness({ ...business, city: e.target.value });
                  }}
                />
              </Field>

              <Field label="State" error={errors.state} required>
                <input
                  className={inputCls(!!errors.state)}
                  placeholder="e.g. Delhi, Maharashtra, Gujarat"
                  value={business.state}
                  onChange={(e) => {
                    clearError('state');
                    setBusiness({ ...business, state: e.target.value });
                  }}
                />
              </Field>

              <Field label="PIN Code" error={errors.pincode} required>
                <input
                  className={inputCls(!!errors.pincode)}
                  placeholder="110001"
                  maxLength={6}
                  value={business.pincode}
                  onChange={(e) => {
                    clearError('pincode');
                    setBusiness({ ...business, pincode: e.target.value });
                  }}
                />
              </Field>
            </div>
          </div>

          {/* Bank Account Details */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Landmark size={15} className="text-blue-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                3. Company Bank Account Details (Printed on Invoices)
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Bank Name" error={errors.bank_name} required>
                <input
                  className={inputCls(!!errors.bank_name)}
                  placeholder="e.g. HDFC Bank, State Bank of India"
                  value={business.bank_name}
                  onChange={(e) => {
                    clearError('bank_name');
                    setBusiness({ ...business, bank_name: e.target.value });
                  }}
                />
              </Field>

              <Field label="Account Holder / Beneficiary Name" error={errors.bank_account_name} required>
                <input
                  className={inputCls(!!errors.bank_account_name)}
                  placeholder="e.g. Acme Industries Pvt Ltd"
                  value={business.bank_account_name}
                  onChange={(e) => {
                    clearError('bank_account_name');
                    setBusiness({ ...business, bank_account_name: e.target.value });
                  }}
                />
              </Field>

              <Field label="Bank Account Number" error={errors.bank_account_number} required>
                <input
                  className={inputCls(!!errors.bank_account_number)}
                  placeholder="e.g. 50200012345678"
                  value={business.bank_account_number}
                  onChange={(e) => {
                    clearError('bank_account_number');
                    setBusiness({ ...business, bank_account_number: e.target.value });
                  }}
                />
              </Field>

              <Field label="IFSC Code" error={errors.bank_ifsc} required>
                <input
                  className={inputCls(!!errors.bank_ifsc)}
                  placeholder="e.g. HDFC0001234"
                  maxLength={11}
                  value={business.bank_ifsc}
                  onChange={(e) => {
                    clearError('bank_ifsc');
                    setBusiness({ ...business, bank_ifsc: e.target.value.toUpperCase() });
                  }}
                />
              </Field>

              <Field label="Branch Name / Location" error={errors.bank_branch} required>
                <input
                  className={inputCls(!!errors.bank_branch)}
                  placeholder="e.g. Connaught Place Branch"
                  value={business.bank_branch}
                  onChange={(e) => {
                    clearError('bank_branch');
                    setBusiness({ ...business, bank_branch: e.target.value });
                  }}
                />
              </Field>
            </div>
          </div>
        </section>
      ) : null}

      {/* STEP 2: Vendors & Customers Master */}
      {step === 2 ? (
        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-5">
          <PageTitle
            icon={<Users />}
            title="Step 2: Vendors & Customers Master"
            subtitle="Add suppliers and buyers with GSTIN, state, email, address, and dedicated contact persons."
          />

          <div className="space-y-6">
            {parties.map((p, idx) => (
              <div key={p.local_id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {p.kind === 'vendor' ? 'Vendor / Supplier' : 'Customer / Buyer'} #{idx + 1}
                  </span>
                  {/* Guarded Remove Party Line Button */}
                  {parties.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePartyLine(p.local_id)}
                      className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
                    >
                      <Trash2 size={14} /> Remove Party Line
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Field label="Party Type" required>
                    <select
                      className={selectCls()}
                      value={p.kind}
                      onChange={(e) => handlePartyKindChange(p.local_id, e.target.value as 'vendor' | 'customer')}
                    >
                      <option value="vendor">Vendor / Supplier</option>
                      <option value="customer">Customer / Buyer</option>
                    </select>
                  </Field>

                  <Field label={p.kind === 'vendor' ? 'Vendor Code' : 'Customer Code'} error={errors[`${p.local_id}_code`]}>
                    <input
                      className={inputCls(!!errors[`${p.local_id}_code`])}
                      placeholder={p.kind === 'vendor' ? 'VEN-0001 (or leave blank)' : 'CUST-0001 (or leave blank)'}
                      value={p.code}
                      onChange={(e) => updateRowField(setParties, p.local_id, 'code', e.target.value.toUpperCase())}
                    />
                  </Field>

                  <Field label="Legal Party Name" error={errors[`${p.local_id}_name`]} required>
                    <input
                      className={inputCls(!!errors[`${p.local_id}_name`])}
                      placeholder="e.g. Apex Traders"
                      value={p.name}
                      onChange={(e) => updateRowField(setParties, p.local_id, 'name', e.target.value)}
                    />
                  </Field>

                  <Field label="Official Email Address" error={errors[`${p.local_id}_email`]} required>
                    <input
                      className={inputCls(!!errors[`${p.local_id}_email`])}
                      type="email"
                      placeholder="info@party.com"
                      value={p.email}
                      onChange={(e) => updateRowField(setParties, p.local_id, 'email', e.target.value)}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="15-Char GSTIN" error={errors[`${p.local_id}_gstin`]} required>
                    <input
                      className={inputCls(!!errors[`${p.local_id}_gstin`])}
                      placeholder="07AAAAA0000A1Z5"
                      maxLength={15}
                      value={p.gstin}
                      onChange={(e) => updateRowField(setParties, p.local_id, 'gstin', e.target.value.toUpperCase())}
                    />
                  </Field>

                  <Field label="PAN Number" error={errors[`${p.local_id}_pan`]} required>
                    <input
                      className={inputCls(!!errors[`${p.local_id}_pan`])}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      value={p.pan || ''}
                      onChange={(e) => updateRowField(setParties, p.local_id, 'pan', e.target.value.toUpperCase())}
                    />
                  </Field>
                </div>

                {/* 4 Separate Address Fields */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <Field label="Street / Building Address" error={errors[`${p.local_id}_street`]} required>
                      <input
                        className={inputCls(!!errors[`${p.local_id}_street`])}
                        placeholder="Plot No., Building Name, Street..."
                        value={p.street ?? p.address ?? ''}
                        onChange={(e) => {
                          updateRowField(setParties, p.local_id, 'street', e.target.value);
                          updateRowField(setParties, p.local_id, 'address', e.target.value);
                        }}
                      />
                    </Field>
                  </div>

                  <Field label="City" error={errors[`${p.local_id}_city`]} required>
                    <input
                      className={inputCls(!!errors[`${p.local_id}_city`])}
                      placeholder="City / District"
                      value={p.city || ''}
                      onChange={(e) => updateRowField(setParties, p.local_id, 'city', e.target.value)}
                    />
                  </Field>

                  <Field label="State" error={errors[`${p.local_id}_state`]} required>
                    <input
                      className={inputCls(!!errors[`${p.local_id}_state`])}
                      placeholder="e.g. Delhi, Maharashtra"
                      value={p.state || ''}
                      onChange={(e) => updateRowField(setParties, p.local_id, 'state', e.target.value)}
                    />
                  </Field>

                  <Field label="PIN Code" error={errors[`${p.local_id}_pincode`]} required>
                    <input
                      className={inputCls(!!errors[`${p.local_id}_pincode`])}
                      placeholder="e.g. 110001"
                      maxLength={6}
                      value={p.pincode || ''}
                      onChange={(e) => updateRowField(setParties, p.local_id, 'pincode', e.target.value)}
                    />
                  </Field>
                </div>

                {/* Vendor Bank Details */}
                {p.kind === 'vendor' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-3 border border-slate-200 rounded-lg">
                    <Field label="Bank Account Name" error={errors[`${p.local_id}_bank_account_name`]} required>
                      <input
                        className={inputCls(!!errors[`${p.local_id}_bank_account_name`])}
                        placeholder="Account Holder Name"
                        value={p.bank_account_name || ''}
                        onChange={(e) => updateRowField(setParties, p.local_id, 'bank_account_name', e.target.value)}
                      />
                    </Field>
                    <Field label="Bank Account Number" error={errors[`${p.local_id}_bank_account_number`]} required>
                      <input
                        className={inputCls(!!errors[`${p.local_id}_bank_account_number`])}
                        placeholder="e.g. 918290123456"
                        value={p.bank_account_number || ''}
                        onChange={(e) => updateRowField(setParties, p.local_id, 'bank_account_number', e.target.value)}
                      />
                    </Field>
                    <Field label="Bank IFSC Code" error={errors[`${p.local_id}_bank_ifsc`]} required>
                      <input
                        className={inputCls(!!errors[`${p.local_id}_bank_ifsc`])}
                        placeholder="e.g. SBIN0001234"
                        maxLength={11}
                        value={p.bank_ifsc || ''}
                        onChange={(e) => updateRowField(setParties, p.local_id, 'bank_ifsc', e.target.value.toUpperCase())}
                      />
                    </Field>
                  </div>
                ) : null}

                {/* Multiple Contact Persons Sub-Section */}
                <div className="border-t border-slate-200/80 pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Contact Persons ({(p.contacts || []).length})
                    </label>
                    <button
                      type="button"
                      onClick={() => addPartyContact(p.local_id)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={14} /> Add Contact Person
                    </button>
                  </div>

                  {errors[`${p.local_id}_contacts`] && (
                    <span className="text-xs text-rose-500 font-medium">{errors[`${p.local_id}_contacts`]}</span>
                  )}

                  <div className="space-y-3">
                    {(p.contacts || []).map((c: any, cIdx: number) => {
                      const cPrefix = `${p.local_id}_${c.local_id}`;
                      return (
                        <div key={c.local_id} className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                            <Field label={`Contact #${cIdx + 1} Name`} error={errors[`${cPrefix}_name`]} required>
                              <input
                                className={inputCls(!!errors[`${cPrefix}_name`])}
                                placeholder="Contact Name"
                                value={c.name}
                                onChange={(e) => updatePartyContact(p.local_id, c.local_id, 'name', e.target.value)}
                              />
                            </Field>
                            <Field label="Phone / Mobile" error={errors[`${cPrefix}_phone`]} required>
                              <input
                                className={inputCls(!!errors[`${cPrefix}_phone`])}
                                placeholder="+91 98765 43210"
                                value={c.phone}
                                onChange={(e) => updatePartyContact(p.local_id, c.local_id, 'phone', e.target.value)}
                              />
                            </Field>
                            <Field label="Email" error={errors[`${cPrefix}_email`]} required>
                              <input
                                className={inputCls(!!errors[`${cPrefix}_email`])}
                                type="email"
                                placeholder="contact@party.com"
                                value={c.email}
                                onChange={(e) => updatePartyContact(p.local_id, c.local_id, 'email', e.target.value)}
                              />
                            </Field>
                            <Field label="Role / Designation" error={errors[`${cPrefix}_role`]} required>
                              <input
                                className={inputCls(!!errors[`${cPrefix}_role`])}
                                placeholder="e.g. Accounts / Operations"
                                value={c.role}
                                onChange={(e) => updatePartyContact(p.local_id, c.local_id, 'role', e.target.value)}
                              />
                            </Field>
                          </div>

                          {/* Guarded Remove Contact Button */}
                          {(p.contacts || []).length > 1 && (
                            <div className="flex justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => removePartyContact(p.local_id, c.local_id)}
                                className="text-red-500 hover:text-red-700 p-1 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 size={13} /> Remove Contact
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Button
              variant="secondary"
              icon={<Plus size={16} />}
              onClick={() => {
                let maxVendorNum = 0;
                parties.forEach((p) => {
                  if (p.kind === 'vendor') {
                    const match = String(p.code || '').match(/(\d+)$/);
                    if (match) {
                      const num = parseInt(match[1], 10);
                      if (!isNaN(num) && num > maxVendorNum) maxVendorNum = num;
                    }
                  }
                });
                addRow(setParties, {
                  kind: 'vendor',
                  code: `VEN-${String(maxVendorNum + 1).padStart(4, '0')}`,
                  name: '',
                  email: '',
                  gstin: '',
                  street: '',
                  city: '',
                  state: '',
                  pincode: '',
                  pan: '',
                  address: '',
                  bank_account_name: '',
                  bank_account_number: '',
                  bank_ifsc: '',
                  contacts: [{ local_id: generateUUID(), name: '', phone: '', email: '', role: 'Primary Contact' }]
                });
              }}
            >
              Add Vendor / Customer Line
            </Button>
          </div>
        </section>
      ) : null}

      {/* STEP 3: Purchasing Item Master */}
      {step === 3 ? (
        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-5">
          <PageTitle
            icon={<Package2 />}
            title="Step 3: Purchasing Items Master"
            subtitle="Set up raw materials, packaging, consumables, HSN codes, and default GST rates."
          />

          <div className="space-y-4">
            {materials.map((m) => (
              <div key={m.local_id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Field label="SKU / Item Code" error={errors[`${m.local_id}_code`]}>
                    <input
                      className={inputCls(!!errors[`${m.local_id}_code`])}
                      placeholder="e.g. SKU-1001 (or leave blank)"
                      value={m.code}
                      onChange={(e) => updateRowField(setMaterials, m.local_id, 'code', e.target.value.toUpperCase())}
                    />
                  </Field>
                  <Field label="Item Name" error={errors[`${m.local_id}_name`]} required>
                    <input
                      className={inputCls(!!errors[`${m.local_id}_name`])}
                      placeholder="e.g. Raw Seeds"
                      value={m.name}
                      onChange={(e) => updateRowField(setMaterials, m.local_id, 'name', e.target.value)}
                    />
                  </Field>
                  <Field label="Category" error={errors[`${m.local_id}_item_type`]} required>
                    <select
                      className={selectCls(!!errors[`${m.local_id}_item_type`])}
                      value={m.item_type}
                      onChange={(e) => updateRowField(setMaterials, m.local_id, 'item_type', e.target.value)}
                    >
                      <option value="Raw Material">Raw Material</option>
                      <option value="Consumable">Consumable</option>
                      <option value="Packaging Material">Packaging Material</option>
                      <option value="Other">Other</option>
                    </select>
                  </Field>
                  <Field label="Unit of Measure" error={errors[`${m.local_id}_unit`]} required>
                    <input
                      className={inputCls(!!errors[`${m.local_id}_unit`])}
                      placeholder="kg, pcs, liters"
                      value={m.unit}
                      onChange={(e) => updateRowField(setMaterials, m.local_id, 'unit', e.target.value)}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <Field label="HSN Code" error={errors[`${m.local_id}_hsn_code`]} required>
                    <input
                      className={inputCls(!!errors[`${m.local_id}_hsn_code`])}
                      placeholder="e.g. 1207"
                      value={m.hsn_code}
                      onChange={(e) => updateRowField(setMaterials, m.local_id, 'hsn_code', e.target.value)}
                    />
                  </Field>
                  <Field label="GST Rate (%)" error={errors[`${m.local_id}_tax_rate`]} required>
                    <select
                      className={selectCls(!!errors[`${m.local_id}_tax_rate`])}
                      value={m.tax_rate}
                      onChange={(e) => updateRowField(setMaterials, m.local_id, 'tax_rate', e.target.value)}
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </Field>
                  <Field label="Reorder Level" error={errors[`${m.local_id}_reorder_level`]} required>
                    <input
                      className={inputCls(!!errors[`${m.local_id}_reorder_level`])}
                      inputMode="decimal"
                      placeholder="100"
                      value={m.reorder_level}
                      onChange={(e) => updateRowField(setMaterials, m.local_id, 'reorder_level', e.target.value)}
                    />
                  </Field>
                  <div className="flex justify-end">
                    {materials.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMaterial(m.local_id)}
                        className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
                      >
                        <Trash2 size={15} /> Remove Item
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Button
              variant="secondary"
              icon={<Plus size={16} />}
              onClick={() =>
                addRow(setMaterials, {
                  code: `RAW-${String(materials.length + 1).padStart(3, '0')}`,
                  name: '',
                  item_type: 'Raw Material',
                  unit: 'kg',
                  hsn_code: '',
                  tax_rate: '18',
                  reorder_level: '100'
                })
              }
            >
              Add Purchasing Item Line
            </Button>
          </div>
        </section>
      ) : null}

      {/* STEP 4: Finished Goods Catalog */}
      {step === 4 ? (
        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-5">
          <PageTitle
            icon={<Package2 />}
            title="Step 4: Finished Goods Catalog"
            subtitle="Configure sellable finished products, selling price, and HSN Codes."
          />

          <div className="space-y-4">
            {goods.map((g) => (
              <div key={g.local_id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div className="md:col-span-2">
                    <Field label="Product Name" error={errors[`${g.local_id}_name`]} required>
                      <input
                        className={inputCls(!!errors[`${g.local_id}_name`])}
                        placeholder="e.g. Filtered Mustard Oil 1L"
                        value={g.name}
                        onChange={(e) => updateRowField(setGoods, g.local_id, 'name', e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Unit" error={errors[`${g.local_id}_unit`]} required>
                    <input
                      className={inputCls(!!errors[`${g.local_id}_unit`])}
                      placeholder="kg, tin, bottle"
                      value={g.unit}
                      onChange={(e) => updateRowField(setGoods, g.local_id, 'unit', e.target.value)}
                    />
                  </Field>
                  <Field label="HSN Code" error={errors[`${g.local_id}_hsn_code`]} required>
                    <input
                      className={inputCls(!!errors[`${g.local_id}_hsn_code`])}
                      placeholder="e.g. 1507"
                      value={g.hsn_code}
                      onChange={(e) => updateRowField(setGoods, g.local_id, 'hsn_code', e.target.value)}
                    />
                  </Field>
                  <Field label={`Default Selling Price (${currencySymbol})`} error={errors[`${g.local_id}_default_price`]} required>
                    <input
                      className={inputCls(!!errors[`${g.local_id}_default_price`])}
                      inputMode="decimal"
                      placeholder="500.00"
                      value={g.default_price}
                      onChange={(e) => updateRowField(setGoods, g.local_id, 'default_price', e.target.value)}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div className="md:col-span-2">
                    <Field label="Reorder Level" error={errors[`${g.local_id}_reorder_level`]} required>
                      <input
                        className={inputCls(!!errors[`${g.local_id}_reorder_level`])}
                        inputMode="decimal"
                        placeholder="50"
                        value={g.reorder_level}
                        onChange={(e) => updateRowField(setGoods, g.local_id, 'reorder_level', e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="md:col-span-3 flex justify-end pt-1">
                    {goods.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeGood(g.local_id)}
                        className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
                      >
                        <Trash2 size={15} /> Remove Product Line
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Button
              variant="secondary"
              icon={<Plus size={16} />}
              onClick={() =>
                addRow(setGoods, {
                  name: '',
                  unit: 'kg',
                  default_price: '500',
                  hsn_code: '',
                  tax_rate: '18',
                  reorder_level: '50'
                })
              }
            >
              Add Product Line
            </Button>
          </div>
        </section>
      ) : null}

      {/* Wizard Bottom Controls */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <Button
          variant="secondary"
          disabled={step === 1 || isSaving}
          onClick={() => {
            setErrors({});
            setStep((v) => Math.max(1, v - 1));
          }}
        >
          Back
        </Button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem('erp_skip_onboarding', 'true');
              navigate('/');
            }}
            className="text-xs text-slate-400 hover:text-slate-700 transition-colors font-medium px-2 py-1 mr-1 cursor-pointer"
          >
            Skip for now
          </button>
          {step < totalSteps ? (
            <Button onClick={handleNext} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" /> Saving Step...
                </>
              ) : (
                'Next Step'
              )}
            </Button>
          ) : (
            <Button icon={isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} onClick={handleFinalSubmit} disabled={isSaving}>
              {isSaving ? 'Finalizing Setup...' : 'Save & Complete Business Setup'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
