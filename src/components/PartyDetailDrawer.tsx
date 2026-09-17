import { useEffect, useState } from 'react';
import { Phone, Mail, MapPin, Landmark, ShieldCheck, CheckCircle2, Clock, Send } from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { useWorkspace } from '../context';
import { usePermissions } from '../hooks/usePermissions';
import { Drawer } from './ui/Modal';

interface PartyDetailDrawerProps {
  endpoint: string;
  type: 'vendor' | 'customer';
  title: string;
  onClose: () => void;
  onInvitePortal?: (row: any) => void;
}

export function PartyDetailDrawer({
  endpoint,
  type,
  title,
  onClose,
  onInvitePortal
}: PartyDetailDrawerProps) {
  const { workspace } = useWorkspace();
  const { canEdit } = usePermissions('parties');
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'transactions'>('overview');

  const isVendor = type === 'vendor';

  useEffect(() => {
    setLoading(true);
    api.get(endpoint)
      .then((res) => {
        const data = res.data;
        if (data && typeof data.contacts === 'string') {
          try {
            data.contacts = JSON.parse(data.contacts);
          } catch {
            data.contacts = [];
          }
        }
        setDetail(data);
      })
      .catch((err) => console.error('Error fetching party details:', err))
      .finally(() => setLoading(false));
  }, [endpoint]);

  return (
    <Drawer title={title} onClose={onClose}>
      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-28 bg-slate-200 rounded-2xl" />
          <div className="h-20 bg-slate-100 rounded-xl" />
          <div className="h-44 bg-slate-100 rounded-xl" />
        </div>
      ) : detail ? (
        <div className="space-y-5">
          {/* Header Card */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3 shadow-md">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30 uppercase tracking-wider">
                    {isVendor ? 'Vendor / Supplier' : 'Customer / Buyer'}
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-300">
                    {detail.vendor_code || detail.customer_code || detail.code || '-'}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  {detail.name}
                </h3>
              </div>
              {canEdit ? (
                <button
                  type="button"
                  onClick={async () => {
                    const newStatus = detail.status === 'Inactive' ? 'Active' : 'Inactive';
                    try {
                      await api.put(endpoint, { status: newStatus });
                      setDetail({ ...detail, status: newStatus });
                    } catch (err: any) {
                      console.error('Failed to update status', err);
                    }
                  }}
                  title="Click to toggle Active / Inactive"
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                    detail.status === 'Inactive'
                      ? 'bg-red-500/20 text-red-300 border border-red-400/40 hover:bg-red-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/30'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${detail.status === 'Inactive' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                  {detail.status || 'Active'}
                </button>
              ) : (
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                    detail.status === 'Inactive'
                      ? 'bg-red-500/20 text-red-300 border border-red-400/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${detail.status === 'Inactive' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                  {detail.status || 'Active'}
                </span>
              )}
            </div>

            {/* Financial Metrics Strip */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800">
              <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Lifetime Value ({workspace?.currency || 'INR'})
                </span>
                <span className="text-sm font-extrabold text-white">
                  {formatCurrency(detail.total_business_value || 0, workspace?.currency)}
                </span>
              </div>
              <div className={`p-2.5 rounded-xl border ${
                Number(detail.outstanding_balance || 0) > 0 
                  ? 'bg-red-950/40 border-red-800/50 text-red-200' 
                  : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200'
              }`}>
                <span className="text-[10px] uppercase font-bold block opacity-80">
                  Outstanding Balance
                </span>
                <span className="text-sm font-extrabold">
                  {formatCurrency(detail.outstanding_balance || 0, workspace?.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200 gap-4 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-2 transition cursor-pointer ${
                activeTab === 'overview'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Overview & Details
            </button>
            <button
              onClick={() => setActiveTab('contacts')}
              className={`pb-2 transition cursor-pointer flex items-center gap-1 ${
                activeTab === 'contacts'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Contact Persons ({Array.isArray(detail.contacts) ? detail.contacts.length : 1})
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`pb-2 transition cursor-pointer flex items-center gap-1 ${
                activeTab === 'transactions'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Recent Transactions
            </button>
          </div>

          {/* TAB 1: OVERVIEW & DETAILS */}
          {activeTab === 'overview' && (
            <div className="space-y-4 text-xs">
              {/* Tax & Legal Identifiers */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Tax & Legal Identifiers
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[11px]">GSTIN:</span>
                    {detail.gstin ? (
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block mt-0.5">
                        {detail.gstin}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium italic">Unregistered</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">PAN Number:</span>
                    {detail.pan ? (
                      <span className="font-mono font-bold text-slate-800 inline-block mt-0.5">
                        {detail.pan}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Not provided</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <MapPin size={12} /> Registered Address
                </span>
                <p className="text-slate-800 font-medium leading-relaxed">
                  {detail.address_line1 || detail.address || detail.billing_address || 'No street address provided'}
                  {detail.address_line2 ? `, ${detail.address_line2}` : ''}
                </p>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">City:</span>
                    <strong className="text-slate-700">{detail.city || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">State:</span>
                    <strong className="text-slate-700">{detail.state || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">PIN Code:</span>
                    <strong className="text-slate-700 font-mono">{detail.pincode || '-'}</strong>
                  </div>
                </div>
              </div>

              {/* Primary Contact Details */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Phone size={12} /> Primary Contact
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Contact Person:</span>
                    <strong className="text-slate-800">{detail.contact_person_name || detail.contact || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Phone / WhatsApp:</span>
                    <strong className="text-slate-800 font-mono">{detail.phone || detail.contact || '-'}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[11px]">Email Address:</span>
                    <strong className="text-slate-800">{detail.email || '-'}</strong>
                  </div>
                </div>
              </div>

              {/* Bank Details (For Vendors) */}
              {isVendor && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Landmark size={12} /> Bank Account Details
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Account Holder:</span>
                      <strong className="text-slate-800">{detail.bank_account_name || 'Not provided'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Account Number:</span>
                      <strong className="text-slate-800 font-mono">{detail.bank_account_number || 'Not provided'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">IFSC Code:</span>
                      <strong className="text-slate-800 font-mono">{detail.bank_ifsc || 'Not provided'}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Portal Connection Status Card */}
              {(() => {
                const isMember = detail.portal_status === 'member' || detail.connection_status === 'connected' || Number(detail.portal_logged_in_count || 0) > 0 || Boolean(detail.portal_user_id);
                const isInvited = detail.portal_status === 'invited' || detail.connection_status === 'invited' || Number(detail.portal_users_count || 0) > 0;

                return (
                  <div className={`p-3.5 border rounded-xl flex items-center justify-between gap-3 ${
                    isMember ? 'bg-emerald-50/60 border-emerald-200' : isInvited ? 'bg-amber-50/60 border-amber-200' : 'bg-blue-50/60 border-blue-200/80'
                  }`}>
                    <div className="space-y-0.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                        isMember ? 'text-emerald-800' : isInvited ? 'text-amber-800' : 'text-blue-800'
                      }`}>
                        <ShieldCheck size={12} /> Portal Connection
                      </span>
                      <p className={`text-[11px] font-medium ${
                        isMember ? 'text-emerald-900' : isInvited ? 'text-amber-900' : 'text-blue-900'
                      }`}>
                        {isMember
                          ? 'Connected to Vendor / Customer Portal'
                          : isInvited
                          ? 'Invitation sent — awaiting first partner login'
                          : 'Not yet connected to online portal'}
                      </p>
                    </div>

                    {isMember ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 rounded-lg border border-emerald-300 shadow-2xs">
                        <CheckCircle2 size={13} className="text-emerald-700" /> Member
                      </span>
                    ) : onInvitePortal ? (
                      <button
                        type="button"
                        onClick={() => onInvitePortal(detail)}
                        className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1.5 ${
                          isInvited
                            ? 'text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300'
                            : 'text-white bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        {isInvited ? <Clock size={12} /> : <Send size={12} />}
                        {isInvited ? 'Invited (Resend)' : 'Invite to Portal'}
                      </button>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 2: CONTACT PERSONS */}
          {activeTab === 'contacts' && (
            <div className="space-y-3">
              {Array.isArray(detail.contacts) && detail.contacts.length > 0 ? (
                detail.contacts.map((c: any, idx: number) => (
                  <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900">{c.name || `Contact #${idx + 1}`}</h4>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                        {c.role || 'Contact'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                      <div className="flex items-center gap-1">
                        <Phone size={12} className="text-slate-400" />
                        <span className="font-mono">{c.phone || '-'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Mail size={12} className="text-slate-400" />
                        <span className="truncate">{c.email || '-'}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900">{detail.contact_person_name || detail.contact || detail.name}</h4>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">Primary Contact</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                    <div className="flex items-center gap-1">
                      <Phone size={12} className="text-slate-400" />
                      <span className="font-mono">{detail.phone || detail.contact || '-'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Mail size={12} className="text-slate-400" />
                      <span className="truncate">{detail.email || '-'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RECENT TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              {isVendor ? (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Recent Purchase Orders / Procurements
                  </h4>
                  {detail.recent_procurements && detail.recent_procurements.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                      {detail.recent_procurements.map((p: any) => (
                        <div key={p.id} className="p-3 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-mono font-bold text-blue-700 block">{p.procurement_number || 'Procurement'}</span>
                            <span className="text-slate-400 text-[11px]">{formatDate(p.date || p.procurement_date)}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-900 block">{formatCurrency(p.total_amount, workspace?.currency)}</span>
                            {Number(p.amount_due) > 0 ? (
                              <span className="text-[10px] font-bold text-red-600">Due: {formatCurrency(p.amount_due, workspace?.currency)}</span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-600">Paid in Full</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl text-center">
                      No procurement orders recorded yet for this vendor.
                    </p>
                  )}

                  {/* Price History items */}
                  {detail.price_history_items && detail.price_history_items.length > 0 && (
                    <div className="pt-3 space-y-2">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Material Price History ({detail.price_history_items.length})
                      </h4>
                      <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white text-xs">
                        {detail.price_history_items.map((item: any, idx: number) => (
                          <div key={idx} className="p-2.5 flex items-center justify-between">
                            <div>
                              <strong className="text-slate-800 block">{item.item_name}</strong>
                              <span className="text-slate-400 font-mono text-[10px]">{item.item_code}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-slate-900 block">
                                {formatCurrency(item.last_purchase_price, workspace?.currency)} / {item.unit}
                              </span>
                              <span className="text-slate-400 text-[10px]">{formatDate(item.last_purchase_date)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Recent Invoices / Sales Orders
                  </h4>
                  {detail.recent_sales && detail.recent_sales.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                      {detail.recent_sales.map((s: any) => (
                        <div key={s.id} className="p-3 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-mono font-bold text-blue-700 block">{s.invoice_number || 'Sale Order'}</span>
                            <span className="text-slate-400 text-[11px]">{formatDate(s.date || s.invoice_date)}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-900 block">{formatCurrency(s.total_amount, workspace?.currency)}</span>
                            {Number(s.amount_due) > 0 ? (
                              <span className="text-[10px] font-bold text-red-600">Due: {formatCurrency(s.amount_due, workspace?.currency)}</span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-600">Paid in Full</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl text-center">
                      No sales invoices recorded yet for this customer.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-500 text-center py-8">Unable to load details.</p>
      )}
    </Drawer>
  );
}
