import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../context';
import { usePortal } from '../../components/AppShell';
import {
  ShoppingBag, Search, Download, CheckCircle2, Truck,
  AlertCircle, ChevronRight, X, Eye, RefreshCw,
  CreditCard, Package, Info, Clock, Check,
  PackageCheck, RotateCcw, Plus, Trash2, Copy,
  ReceiptText, Percent, Phone, MapPin
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { DatePicker } from '../../components/ui/DatePicker';
import { Select } from '../../components/ui/Select';
import { Pagination } from '../../components/ui/Pagination';
import { formatDate, formatCurrency, formatNumber } from '../../lib/utils';

export function PortalOrdersPage() {
  const toast = useToast();
  const { user, activeWorkspace, loading: portalLoading } = usePortal();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Selected order for detail drawer
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Dispatch modal for vendor
  const [dispatchModalOrder, setDispatchModalOrder] = useState<any | null>(null);
  const [dispatchForm, setDispatchForm] = useState({
    transporter_name: 'BlueDart Logistics',
    tracking_ref: '',
    vehicle_number: '',
    vendor_contact: '',
    vendor_address: '',
    dispatch_date: new Date().toISOString().slice(0, 10),
    notes: ''
  });

  // Decline / Cancellation Reason Modal for vendor
  const [declineModalOrder, setDeclineModalOrder] = useState<any | null>(null);
  const [declineCategory, setDeclineCategory] = useState('Out of Stock / Insufficient Raw Materials');
  const [declineReasonText, setDeclineReasonText] = useState('');

  // Customer Place Order State
  const [showPlaceOrderModal, setShowPlaceOrderModal] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [newOrderItems, setNewOrderItems] = useState<any[]>([]);
  const [newOrderNotes, setNewOrderNotes] = useState('');
  const [newOrderAddress, setNewOrderAddress] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Customer Receive Goods Modal State
  const [receiveModalOrder, setReceiveModalOrder] = useState<any | null>(null);
  const [submittingReceive, setSubmittingReceive] = useState(false);

  // Customer Return Order Modal State
  const [returnModalOrder, setReturnModalOrder] = useState<any | null>(null);
  const [returnCategory, setReturnCategory] = useState('Quality / Defect');
  const [returnReasonText, setReturnReasonText] = useState('');
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const fetchCatalog = async () => {
    if (!activeWorkspace?.company_id) return;
    try {
      setLoadingCatalog(true);
      const res = await api.get('/portal/products', {
        params: { company_id: activeWorkspace.company_id }
      });
      if (res.data?.ok) {
        setCatalogProducts(res.data.products || []);
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to load catalog products', 'error');
    } finally {
      setLoadingCatalog(false);
    }
  };

  const handlePlaceOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.company_id) return;
    const validItems = newOrderItems.filter((it) => it.product_id && Number(it.quantity) > 0);
    if (validItems.length === 0) {
      toast('Please add at least one product with quantity greater than 0', 'error');
      return;
    }

    try {
      setSubmittingOrder(true);
      const payload = {
        company_id: activeWorkspace.company_id,
        notes: newOrderNotes.trim(),
        delivery_address: newOrderAddress.trim(),
        items: validItems.map((it) => ({
          finished_good_id: it.product_id,
          packaging_config_id: it.packaging_option_id || null,
          quantity: Number(it.quantity),
          rate_per_unit: Number(it.rate),
          tax_rate: Number(it.tax_rate ?? 18)
        }))
      };

      const res = await api.post('/portal/orders', payload);
      if (res.data?.ok) {
        toast(res.data.message || 'Sales order placed successfully!', 'success');
        setShowPlaceOrderModal(false);
        setNewOrderItems([]);
        setNewOrderNotes('');
        setNewOrderAddress('');
        await fetchOrders();
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to place sales order', 'error');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleReceiveGoodsConfirm = async () => {
    if (!receiveModalOrder) return;
    try {
      setSubmittingReceive(true);
      await handleAction(receiveModalOrder.id, 'receive_goods');
      setReceiveModalOrder(null);
    } finally {
      setSubmittingReceive(false);
    }
  };

  const openReturnModal = (ord: any) => {
    setReturnModalOrder(ord);
    setReturnCategory('Quality / Defect');
    setReturnReasonText('');
    const items = (ord.items || []).map((it: any) => ({
      item_id: it.id || it.item_id,
      item_name: it.item_name,
      max_quantity: Number(it.quantity || 1),
      quantity: Number(it.quantity || 1),
      return_selected: true,
      notes: ''
    }));
    setReturnItems(items);
  };

  const handleCustomerReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnModalOrder) return;
    const trimmedReason = returnReasonText.trim();
    if (!trimmedReason) {
      toast('Please specify a return reason', 'error');
      return;
    }
    const finalReason = `${returnCategory}: ${trimmedReason}`;
    const selectedReturnItems = returnItems.filter((it) => it.return_selected && Number(it.quantity) > 0);

    try {
      setSubmittingReturn(true);
      await handleAction(returnModalOrder.id, 'request_return', {
        reason: finalReason,
        return_type: 'sales_return',
        items: selectedReturnItems
      });
      setReturnModalOrder(null);
      setReturnItems([]);
      setReturnReasonText('');
    } finally {
      setSubmittingReturn(false);
    }
  };

  const handleDeclineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declineModalOrder) return;
    const trimmed = declineReasonText.trim();
    if (!trimmed) {
      toast('Please enter a cancellation reason', 'error');
      return;
    }
    const finalReason = declineCategory === 'Other'
      ? trimmed
      : `${declineCategory}: ${trimmed}`;

    await handleAction(declineModalOrder.id, 'reject', { reason: finalReason });
    setDeclineModalOrder(null);
    setDeclineReasonText('');
  };

  const fetchOrders = async () => {
    if (!activeWorkspace) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params: any = {
        company_id: activeWorkspace.company_id,
        page: currentPage,
        limit: pageSize
      };
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      if (paymentStatusFilter && paymentStatusFilter !== 'all') params.payment_status = paymentStatusFilter;
      if (search.trim()) params.search = search.trim();
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await api.get('/portal/orders', { params });

      if (res.data?.ok) {
        setOrders(res.data.orders || []);
        setTotalItems(res.data.meta?.total || (res.data.orders || []).length);
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to fetch orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [activeWorkspace?.company_id, currentPage, statusFilter, paymentStatusFilter, startDate, endDate]);

  const handleAction = async (orderId: string, action: string, extraData?: any) => {
    try {
      setActionLoading(`${orderId}-${action}`);
      const res = await api.post(`/portal/orders/${orderId}/action`, {
        company_id: activeWorkspace?.company_id,
        action,
        ...extraData
      });
      if (res.data?.ok) {
        toast(res.data.message || `Order updated: ${action}`, 'success');
        setDispatchModalOrder(null);
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder((prev: any) => ({ ...prev, status: res.data.status || prev.status }));
        }
        await fetchOrders();
      }
    } catch (err: any) {
      toast(err.response?.data?.error || `Failed to ${action} order`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const openDispatchModal = (ord: any) => {
    // Auto-fill vendor contact and address from order or authenticated portal user profile
    const defaultContact = ord.vendor_contact || user?.phone || '';
    const userAddrParts = [user?.address, user?.city, user?.state, user?.pincode].filter(Boolean).join(', ');
    const defaultAddress = ord.vendor_address || userAddrParts || user?.address || '';

    setDispatchModalOrder(ord);
    setDispatchForm({
      transporter_name: 'BlueDart Express',
      tracking_ref: ord.dispatch_tracking_ref || '',
      vehicle_number: '',
      vendor_contact: defaultContact,
      vendor_address: defaultAddress,
      dispatch_date: new Date().toISOString().slice(0, 10),
      notes: ''
    });
  };

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchModalOrder) return;
    await handleAction(dispatchModalOrder.id, 'dispatch', {
      transporter_name: dispatchForm.transporter_name,
      dispatch_tracking_ref: dispatchForm.tracking_ref || dispatchForm.transporter_name,
      vehicle_number: dispatchForm.vehicle_number,
      dispatch_date: dispatchForm.dispatch_date,
      vendor_contact: dispatchForm.vendor_contact,
      vendor_address: dispatchForm.vendor_address,
      vendor_notes: dispatchForm.notes
    });
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPaymentStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  // Real CSV Export with installment & item data
  const exportOrdersCSV = () => {
    if (orders.length === 0) {
      toast('No orders to export', 'info');
      return;
    }

    const headers = [
      'Order Number',
      'Date',
      'Portal Type',
      'Total Gross',
      'Amount Paid',
      'Amount Due',
      'Payment Status',
      'Order Status',
      'Items Summary',
      'Installment Payments Count',
      'Dispatch Tracking Ref',
      'Notes'
    ];

    const rows = orders.map((o) => {
      const itemsStr = (o.items || [])
        .map((it: any) => `${it.item_name} (x${it.quantity} ${it.unit || 'pcs'} @ ${it.rate_per_unit || 0})`)
        .join('; ');
      const isPaid = Number(o.amount_due || 0) <= 0;
      const isPartial = Number(o.amount_paid || 0) > 0 && Number(o.amount_due || 0) > 0;
      const payStatus = isPaid ? 'Paid' : isPartial ? 'Partial Installments' : 'Unpaid';

      return [
        o.order_number,
        o.date ? new Date(o.date).toISOString().slice(0, 10) : '',
        o.portal_type || activeWorkspace?.portal_type || '',
        o.total_amount || 0,
        o.amount_paid || 0,
        o.amount_due || 0,
        payStatus,
        o.status,
        `"${itemsStr.replace(/"/g, '""')}"`,
        (o.payments || []).length,
        `"${(o.dispatch_tracking_ref || '').replace(/"/g, '""')}"`,
        `"${(o.vendor_notes || o.customer_notes || o.notes || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `orders_${activeWorkspace?.company_code || 'portal'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast('Exported orders CSV successfully', 'success');
  };

  if (!activeWorkspace) {
    if (portalLoading) {
      return (
        <div className="max-w-4xl mx-auto py-12 text-center text-xs text-slate-400">
          Loading workspace details...
        </div>
      );
    }
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Active Workspace Connected</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
          To view and manage purchase or sales orders, connect to a business workspace using their Company Connect Code.
        </p>
      </div>
    );
  }

  const isVendor = activeWorkspace.portal_type === 'vendor';
  const totalGrossValue = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const totalPaidValue = orders.reduce((sum, o) => sum + Number(o.amount_paid || 0), 0);
  const isUnconfirmed = (status: string) =>
    ['Pending Vendor Confirmation', 'Sent to Vendor', 'pending', 'Draft', 'Pending Approval', 'Ordered'].includes(status);
  const isConfirmed = (status: string) =>
    ['Confirmed by Vendor', 'Vendor Confirmed', 'Partially Dispatched'].includes(status);
  const isDispatched = (status: string) =>
    ['Dispatched by Vendor', 'Dispatched', 'dispatched'].includes(status);
  const isReceived = (status: string) =>
    ['Received', 'Goods Received', 'goods received', 'Delivered', 'delivered'].includes(status);

  const pendingActionCount = orders.filter((o) => isUnconfirmed(o.status)).length;

  // Options for custom Selects
  const vendorStatusOptions = [
    { value: 'all', label: 'All Order Statuses' },
    { value: 'Sent to Vendor', label: 'Sent to Vendor' },
    { value: 'Pending Vendor Confirmation', label: 'Pending Confirmation' },
    { value: 'Confirmed by Vendor', label: 'Confirmed by Vendor' },
    { value: 'Dispatched by Vendor', label: 'Dispatched by Vendor' },
    { value: 'Partially Dispatched', label: 'Partially Dispatched' },
    { value: 'Received', label: 'Goods Received by Buyer' },
    { value: 'Rejected by Vendor', label: 'Rejected by Vendor' }
  ];

  const customerStatusOptions = [
    { value: 'all', label: 'All Order Statuses' },
    { value: 'pending', label: 'Pending Approval' },
    { value: 'Confirmed by Customer', label: 'Confirmed by Customer' },
    { value: 'in_production', label: 'In Production' },
    { value: 'Dispatched', label: 'Dispatched' },
    { value: 'Goods Received', label: 'Goods Received' },
    { value: 'Return Requested', label: 'Return Requested' },
    { value: 'Return Rejected', label: 'Return Rejected' },
    { value: 'Returned', label: 'Returned' }
  ];

  const paymentStatusOptions = [
    { value: 'all', label: 'All Payment Statuses' },
    { value: 'paid', label: 'Paid in Full' },
    { value: 'partial', label: 'Partial Installments' },
    { value: 'unpaid', label: 'Unpaid / Pending' }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0 font-bold">
            <ShoppingBag size={20} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {isVendor ? 'Purchase Orders & Dispatches' : 'Sales Orders & Invoices'}
            </h1>
            <p className="text-xs text-slate-500">
              Real-time orders, installment tracking, and fulfillment with {activeWorkspace.company_name} ({activeWorkspace.company_code})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isVendor && (
            <Button
              variant="primary"
              icon={<Plus size={14} />}
              onClick={() => {
                setShowPlaceOrderModal(true);
                fetchCatalog();
                if (newOrderItems.length === 0) {
                  setNewOrderItems([
                    { product_id: '', packaging_option_id: '', quantity: 1, rate: 0, tax_rate: 18, name: '', stock: 0 }
                  ]);
                }
              }}
              className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
            >
              Place New Order
            </Button>
          )}
          <Button
            variant="secondary"
            icon={<Download size={14} />}
            onClick={exportOrdersCSV}
            className="text-xs font-bold"
          >
            Export CSV
          </Button>
          <Button
            variant="secondary"
            icon={<RefreshCw size={14} />}
            onClick={fetchOrders}
            className="text-xs font-bold"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Total Orders
          </span>
          <p className="text-2xl font-black text-slate-900 tabular-nums">
            {totalItems}
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Action Required / Pending
          </span>
          <p className="text-2xl font-black text-amber-600 tabular-nums">
            {pendingActionCount}
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Total Gross Value
          </span>
          <p className="text-2xl font-black text-slate-900 tabular-nums">
            {formatCurrency(totalGrossValue, activeWorkspace.currency)}
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Total Amount Paid
          </span>
          <p className="text-2xl font-black text-emerald-600 tabular-nums">
            {formatCurrency(totalPaidValue, activeWorkspace.currency)}
          </p>
        </div>
      </div>

      {/* Rich Filters Bar: Search, Global Select Dropdowns, and Global DatePickers */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full lg:w-72">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search order #, items, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
          />
        </div>

        {/* Global Selects & Custom Calendar DatePickers */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Order Status Select */}
          <div className="w-48">
            <Select
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setCurrentPage(1);
              }}
              options={isVendor ? vendorStatusOptions : customerStatusOptions}
              placeholder="Status"
            />
          </div>

          {/* Payment Status Select */}
          <div className="w-44">
            <Select
              value={paymentStatusFilter}
              onChange={(val) => {
                setPaymentStatusFilter(val);
                setCurrentPage(1);
              }}
              options={paymentStatusOptions}
              placeholder="Payment Status"
            />
          </div>

          {/* Date Range Picker (dd-mm-yyyy) */}
          <div className="w-36">
            <DatePicker
              value={startDate}
              onChange={(val) => {
                setStartDate(val);
                setCurrentPage(1);
              }}
              placeholder="From Date"
            />
          </div>

          <div className="w-36">
            <DatePicker
              value={endDate}
              onChange={(val) => {
                setEndDate(val);
                setCurrentPage(1);
              }}
              placeholder="To Date"
            />
          </div>

          {(search || statusFilter !== 'all' || paymentStatusFilter !== 'all' || startDate || endDate) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              Clear
            </button>
          )}

          <Button
            variant="secondary"
            onClick={() => {
              setCurrentPage(1);
              fetchOrders();
            }}
            className="text-xs font-bold"
          >
            Apply
          </Button>
        </div>
      </div>

      {/* Orders Data Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
            Loading {activeWorkspace.company_name} orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <ShoppingBag size={24} />
            </div>
            <p className="text-sm font-bold text-slate-700 mb-1">No orders found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              There are no orders matching your selected filters in {activeWorkspace.company_name}.
            </p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Order # / Ref</th>
                    <th className="py-3 px-4">Date (dd-mm-yyyy)</th>
                    <th className="py-3 px-4">Items Summary</th>
                    <th className="py-3 px-4 text-right">Gross Amount</th>
                    <th className="py-3 px-4 text-right">Payment Status</th>
                    <th className="py-3 px-4 text-center">Order Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {orders.map((ord) => {
                    const items = ord.items || [];
                    const installments = ord.payments || [];
                    const rowSubtotal = Number(ord.subtotal) > 0 ? Number(ord.subtotal) : 0;
                    const rowDiscount = Number(ord.discount_amount) > 0 ? Number(ord.discount_amount) : 0;
                    const rowTax = Number(ord.tax_amount || ord.total_tax) > 0 ? Number(ord.tax_amount || ord.total_tax) : 0;
                    const rowRoundOff = Number(ord.round_off_amount || 0);
                    const rowGross = (rowSubtotal > 0 || rowTax > 0 || rowDiscount > 0)
                      ? Math.max(0, rowSubtotal - rowDiscount + rowTax + rowRoundOff)
                      : Number(ord.total_amount || 0);
                    const rowPaid = Number(ord.amount_paid || 0);
                    const rowDue = Math.max(0, rowGross - rowPaid);
                    const isFullyPaid = rowDue <= 0 && rowPaid > 0;
                    const isPartialPaid = rowPaid > 0 && rowDue > 0;

                    return (
                      <tr key={ord.id} className="hover:bg-slate-50/60 transition">
                        {/* Order Number */}
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(ord)}
                            className="font-bold text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1 group font-mono cursor-pointer"
                          >
                            <span>{ord.order_number || ord.id.slice(0, 8)}</span>
                            <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition" />
                          </button>
                          {ord.dispatch_tracking_ref && (
                            <div className="mt-1 flex items-center gap-1">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-mono border border-blue-200">
                                <Truck size={10} /> {ord.dispatch_tracking_ref}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(ord.dispatch_tracking_ref);
                                  toast('Tracking reference copied!', 'success');
                                }}
                                title="Copy tracking ref"
                                className="text-slate-400 hover:text-blue-600 p-0.5 rounded cursor-pointer"
                              >
                                <Copy size={10} />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Date (Formatted via global DD-MM-YYYY) */}
                        <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap font-mono">
                          {ord.date ? formatDate(ord.date) : '—'}
                        </td>

                        {/* Items */}
                        <td className="py-3.5 px-4 max-w-xs">
                          {items.length > 0 ? (
                            <div className="truncate text-slate-700 font-medium">
                              {items.map((it: any) => `${it.item_name}${it.package_name ? ` [${it.package_name}]` : ''} (x${formatNumber(it.quantity, 0)} ${it.unit || it.package_name || ''})`).join(', ')}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                          <span className="text-[10px] text-slate-400 block">{items.length} line item(s)</span>
                        </td>

                        {/* Gross Amount */}
                        <td className="py-3.5 px-4 text-right tabular-nums whitespace-nowrap">
                          <span className="font-bold text-slate-900 block">
                            {formatCurrency(rowGross, activeWorkspace.currency)}
                          </span>
                          {Number(ord.discount_amount) > 0 && (
                            <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 inline-flex items-center gap-0.5 mt-0.5">
                              <Percent size={9} />
                              {Number(ord.discount_percent) > 0 ? `${Number(ord.discount_percent)}% ` : ''}
                              (-{formatCurrency(ord.discount_amount, activeWorkspace.currency)})
                            </span>
                          )}
                        </td>

                        {/* Payment Settlement & Installments */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {isFullyPaid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              <CheckCircle2 size={11} /> Fully Paid
                            </span>
                          ) : isPartialPaid ? (
                            <div>
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                                <Clock size={11} /> Partial ({installments.length} inst.)
                              </span>
                              <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                                Paid: {formatCurrency(ord.amount_paid, activeWorkspace.currency)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              Unpaid
                            </span>
                          )}
                        </td>

                        {/* Order Status */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <StatusBadge status={ord.status} />
                        </td>

                        {/* Workflow Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                          {/* Vendor Actions */}
                          {isVendor && isUnconfirmed(ord.status) && (
                            <>
                              <button
                                type="button"
                                disabled={actionLoading === `${ord.id}-accept`}
                                onClick={() => handleAction(ord.id, 'accept')}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition shadow-2xs cursor-pointer inline-flex items-center gap-1"
                              >
                                <Check size={12} /> Accept PO
                              </button>
                              <button
                                type="button"
                                disabled={actionLoading === `${ord.id}-reject`}
                                onClick={() => {
                                  setDeclineModalOrder(ord);
                                  setDeclineCategory('Out of Stock / Insufficient Raw Materials');
                                  setDeclineReasonText('');
                                }}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold rounded-lg border border-rose-200 transition cursor-pointer"
                              >
                                Decline
                              </button>
                            </>
                          )}

                          {isVendor && isConfirmed(ord.status) && (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openDispatchModal(ord)}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition shadow-2xs flex items-center gap-1 inline-flex cursor-pointer"
                              >
                                <Truck size={12} /> Dispatch Shipment
                              </button>
                              <button
                                type="button"
                                disabled={actionLoading === `${ord.id}-reject`}
                                onClick={() => {
                                  setDeclineModalOrder(ord);
                                  setDeclineCategory('Out of Stock / Insufficient Raw Materials');
                                  setDeclineReasonText('');
                                }}
                                className="px-2 py-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-[11px] font-medium rounded-lg transition cursor-pointer"
                                title="Cancel this order"
                              >
                                Cancel
                              </button>
                            </div>
                          )}

                          {isVendor && isDispatched(ord.status) && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                              <Truck size={12} /> In Transit {ord.dispatch_tracking_ref ? `(${ord.dispatch_tracking_ref})` : ''}
                            </span>
                          )}

                          {isVendor && isReceived(ord.status) && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                              <CheckCircle2 size={12} /> Received by Buyer
                            </span>
                          )}

                          {isVendor && (ord.status === 'Rejected by Vendor' || ord.status === 'Declined') && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                              <X size={12} /> Cancelled
                            </span>
                          )}

                          {/* Customer Actions */}
                          {!isVendor && ord.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                disabled={actionLoading === `${ord.id}-confirm_order`}
                                onClick={() => handleAction(ord.id, 'confirm_order')}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition shadow-2xs cursor-pointer"
                              >
                                Confirm Order
                              </button>
                              <button
                                type="button"
                                disabled={actionLoading === `${ord.id}-decline_order`}
                                onClick={() => handleAction(ord.id, 'decline_order')}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold rounded-lg border border-rose-200 transition cursor-pointer"
                              >
                                Decline
                              </button>
                            </>
                          )}

                          {!isVendor && isDispatched(ord.status) && (
                            <button
                              type="button"
                              disabled={actionLoading === `${ord.id}-receive_goods`}
                              onClick={() => setReceiveModalOrder(ord)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition shadow-2xs flex items-center gap-1 inline-flex cursor-pointer"
                            >
                              <PackageCheck size={12} /> Receive Goods
                            </button>
                          )}

                          {!isVendor && isReceived(ord.status) && (
                            <div className="inline-flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                                <CheckCircle2 size={11} /> Received
                              </span>
                              <button
                                type="button"
                                onClick={() => openReturnModal(ord)}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-bold rounded-lg border border-amber-200 transition flex items-center gap-1 inline-flex cursor-pointer"
                                title="Request return for this order"
                              >
                                <RotateCcw size={11} /> Return
                              </button>
                            </div>
                          )}

                          {!isVendor && (ord.status === 'Return Requested' || ord.status === 'return_requested') && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                              <RotateCcw size={11} /> Return Requested
                            </span>
                          )}

                          {!isVendor && ord.status === 'Return Rejected' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-lg border border-red-200" title="Your return request was reviewed and rejected.">
                              <RotateCcw size={11} /> Return Rejected
                            </span>
                          )}

                          {!isVendor && ord.status === 'Returned' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                              <RotateCcw size={11} /> Returned
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedOrder(ord)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title="View full order breakdown, GST and payment details"
                          >
                            <Eye size={13} /> View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Server-Side Pagination */}
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        )}
      </div>

      {/* Order Detail Drawer & Payment Installments Breakdown */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  {isVendor ? 'Purchase Order Details' : 'Sales Order / Invoice Details'}
                </span>
                <h3 className="text-xl font-black text-slate-900 font-mono">
                  {selectedOrder.order_number || selectedOrder.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="py-4 space-y-5 flex-1">
              {/* Order Status Badge & Quick Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Fulfillment Status</span>
                  <div className="mt-0.5">
                    <StatusBadge status={selectedOrder.status} />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Order / Bill Date</span>
                  <span className="text-xs font-mono font-bold text-slate-800 mt-0.5 block">
                    {selectedOrder.date ? formatDate(selectedOrder.date) : '—'}
                  </span>
                </div>
                {selectedOrder.location_name ? (
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Delivery Location</span>
                    <span className="text-xs font-semibold text-slate-800 mt-0.5 block truncate" title={`${selectedOrder.location_name}${selectedOrder.location_address ? ` (${selectedOrder.location_address})` : ''}`}>
                      {selectedOrder.location_name}
                    </span>
                  </div>
                ) : (
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Order Reference</span>
                    <span className="text-xs font-mono font-semibold text-slate-800 mt-0.5 block truncate">
                      {selectedOrder.order_number || selectedOrder.id}
                    </span>
                  </div>
                )}
              </div>

              {/* Bill Reference & Remarks Card if present */}
              {(selectedOrder.notes || selectedOrder.vendor_notes) && (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/90 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-slate-500">
                    <Info size={13} className="text-blue-500" />
                    <span>Bill Details & Reference Remarks</span>
                  </div>
                  {selectedOrder.notes && (
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Client Invoice / Bill Notes:</span>
                      <p className="text-slate-800 font-medium whitespace-pre-wrap mt-0.5">{selectedOrder.notes}</p>
                    </div>
                  )}
                  {selectedOrder.vendor_notes && (
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Vendor Dispatch Instructions:</span>
                      <p className="text-slate-700 font-medium whitespace-pre-wrap mt-0.5">{selectedOrder.vendor_notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Goods Received Status Banner */}
              {selectedOrder.received_date && (
                <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-2xl text-xs flex items-center justify-between text-emerald-900 shadow-2xs">
                  <span className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600" /> Goods Received into Stock
                  </span>
                  <span className="font-mono text-[11px] font-bold">
                    {formatDate(selectedOrder.received_date)}
                  </span>
                </div>
              )}

              {/* Financial & GST Breakdown Snapshot */}
              {(() => {
                const orderSubtotal = Number(selectedOrder.subtotal) > 0
                  ? Number(selectedOrder.subtotal)
                  : (selectedOrder.items || []).reduce((sum: number, it: any) => sum + (Number(it.taxable_value) || (Number(it.quantity) * Number(it.rate_per_unit)) || 0), 0);

                const orderDiscount = Number(selectedOrder.discount_amount) > 0
                  ? Number(selectedOrder.discount_amount)
                  : 0;

                const orderDiscountPercent = Number(selectedOrder.discount_percent) > 0
                  ? Number(selectedOrder.discount_percent)
                  : (orderSubtotal > 0 && orderDiscount > 0 ? Number(((orderDiscount / orderSubtotal) * 100).toFixed(2)) : 0);

                const orderTax = Number(selectedOrder.total_tax || selectedOrder.tax_amount) > 0
                  ? Number(selectedOrder.total_tax || selectedOrder.tax_amount)
                  : (selectedOrder.items || []).reduce((sum: number, it: any) => sum + (Number(it.tax_amount) || (Number(it.cgst_amount || 0) + Number(it.sgst_amount || 0) + Number(it.igst_amount || 0)) || 0), 0);

                const orderCgst = Number(selectedOrder.cgst_amount || 0);
                const orderSgst = Number(selectedOrder.sgst_amount || 0);
                const orderIgst = Number(selectedOrder.igst_amount || 0);
                const orderRoundOff = Number(selectedOrder.round_off_amount || 0);
                const calculatedGross = Math.max(0, orderSubtotal - orderDiscount + orderTax + orderRoundOff);
                const orderTotal = (orderSubtotal > 0 || orderTax > 0 || orderDiscount > 0)
                  ? calculatedGross
                  : Number(selectedOrder.total_amount || 0);
                const orderPaid = Number(selectedOrder.amount_paid || 0);
                const orderDue = Math.max(0, orderTotal - orderPaid);

                return (
                  <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/90 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <ReceiptText size={14} className="text-blue-600" />
                        Order Financials & GST Breakdown
                      </span>
                      <span className="text-[10px] font-mono font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {activeWorkspace.currency || 'INR'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600">
                      {/* Subtotal (Taxable Value) */}
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Subtotal (Taxable Amount):</span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(orderSubtotal, activeWorkspace.currency)}
                        </span>
                      </div>

                      {/* Discount (if applicable) */}
                      {orderDiscount > 0 && (
                        <div className="flex justify-between items-center text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200/80 font-medium">
                          <span className="flex items-center gap-1.5 font-semibold">
                            <Percent size={12} className="text-emerald-600" />
                            <span>Discount Applied:</span>
                            {orderDiscountPercent > 0 && (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-300">
                                {orderDiscountPercent}%
                              </span>
                            )}
                          </span>
                          <span className="font-mono font-bold tabular-nums">
                            - {formatCurrency(orderDiscount, activeWorkspace.currency)}
                          </span>
                        </div>
                      )}

                      {/* GST / Tax Summary */}
                      <div className="pt-1.5 border-t border-slate-200/60 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-slate-700">Total GST / Tax Paid:</span>
                          <span className="font-mono font-bold text-blue-700 tabular-nums">
                            + {formatCurrency(orderTax, activeWorkspace.currency)}
                          </span>
                        </div>

                        {/* CGST / SGST split if available */}
                        {(orderCgst > 0 || orderSgst > 0) && (
                          <div className="pl-3 space-y-0.5 text-[11px] text-slate-500 font-mono">
                            {orderCgst > 0 && (
                              <div className="flex justify-between">
                                <span>• Central GST (CGST):</span>
                                <span>{formatCurrency(orderCgst, activeWorkspace.currency)}</span>
                              </div>
                            )}
                            {orderSgst > 0 && (
                              <div className="flex justify-between">
                                <span>• State GST (SGST):</span>
                                <span>{formatCurrency(orderSgst, activeWorkspace.currency)}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* IGST split if available */}
                        {orderIgst > 0 && (
                          <div className="pl-3 text-[11px] text-slate-500 font-mono flex justify-between">
                            <span>• Integrated GST (IGST):</span>
                            <span>{formatCurrency(orderIgst, activeWorkspace.currency)}</span>
                          </div>
                        )}
                      </div>

                      {/* Round-off adjustment if any */}
                      {Math.abs(orderRoundOff) > 0.001 && (
                        <div className="flex justify-between items-center text-[11px] text-slate-500 font-mono">
                          <span>Round Off Adjustment:</span>
                          <span>{formatCurrency(orderRoundOff, activeWorkspace.currency)}</span>
                        </div>
                      )}

                      {/* Total Order Gross */}
                      <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                        <span className="text-sm font-black text-slate-900">Total Order Value:</span>
                        <span className="text-base font-black text-slate-900 font-mono tabular-nums">
                          {formatCurrency(orderTotal, activeWorkspace.currency)}
                        </span>
                      </div>
                    </div>

                    {/* Amount Paid vs Balance Due Badges */}
                    <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-200">
                      <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200/80">
                        <span className="text-[10px] text-emerald-800 uppercase font-bold block">Total Amount Paid</span>
                        <span className="font-black text-emerald-700 tabular-nums text-sm font-mono block mt-0.5">
                          {formatCurrency(orderPaid, activeWorkspace.currency)}
                        </span>
                      </div>
                      <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200/80">
                        <span className="text-[10px] text-amber-800 uppercase font-bold block">Balance Due</span>
                        <span className="font-black text-amber-700 tabular-nums text-sm font-mono block mt-0.5">
                          {formatCurrency(orderDue, activeWorkspace.currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Dispatch Logistics Information */}
              {selectedOrder.dispatch_tracking_ref && (
                <div className="p-4 bg-blue-50/70 border border-blue-200/90 rounded-2xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                      <Truck size={14} /> Logistics & Dispatch Tracking
                    </span>
                    {selectedOrder.dispatch_date && (
                      <span className="text-[11px] font-mono font-semibold text-blue-700">
                        Date: {formatDate(selectedOrder.dispatch_date)}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Docket / Tracking Reference:</span>
                    <p className="font-mono font-bold text-blue-950 text-sm mt-0.5">{selectedOrder.dispatch_tracking_ref}</p>
                  </div>

                  {/* Vendor Dispatch Contact & Pickup Location */}
                  {(selectedOrder.vendor_contact || selectedOrder.vendor_address) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-blue-200/60 text-[11px]">
                      {selectedOrder.vendor_contact && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block flex items-center gap-1">
                            <Phone size={10} className="text-blue-600" /> Vendor Contact
                          </span>
                          <span className="font-semibold text-slate-800 mt-0.5 block">{selectedOrder.vendor_contact}</span>
                        </div>
                      )}
                      {selectedOrder.vendor_address && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block flex items-center gap-1">
                            <MapPin size={10} className="text-blue-600" /> Dispatch Pickup Address
                          </span>
                          <span className="font-semibold text-slate-800 mt-0.5 block">{selectedOrder.vendor_address}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* PAYMENT INSTALLMENTS LEDGER (Client Owner Payments to Vendor) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard size={14} className="text-emerald-600" />
                    Payment History & Installments ({(selectedOrder.payments || []).length})
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">Disbursed by workspace</span>
                </div>

                {(selectedOrder.payments || []).length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
                    <p className="font-semibold">No payment installments recorded yet.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Payments recorded by the client workspace owner will automatically appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {(selectedOrder.payments || []).map((pay: any, idx: number) => (
                      <div
                        key={pay.id || idx}
                        className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-800">
                              {pay.date ? formatDate(pay.date) : '—'}
                            </span>
                            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                              Installment #{idx + 1}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate max-w-xs">
                            {pay.notes || 'Settlement disbursed'}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="font-black text-emerald-600 tabular-nums text-sm">
                            + {formatCurrency(pay.amount, activeWorkspace.currency)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Line Items List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Package size={14} className="text-blue-600" />
                    Line Items & Itemized Taxes ({(selectedOrder.items || []).length})
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">HSN, Rates, Discounts & GST</span>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {(selectedOrder.items || []).map((it: any, idx: number) => {
                    const lineTaxable = Number(it.taxable_value) > 0
                      ? Number(it.taxable_value)
                      : (Number(it.quantity || 0) * Number(it.rate_per_unit || 0));

                    const lineDiscountPercent = Number(it.discount_percent || 0);
                    const lineTaxRate = Number(it.tax_rate) > 0
                      ? Number(it.tax_rate)
                      : (Number(it.cgst_rate || 0) + Number(it.sgst_rate || 0) + Number(it.igst_rate || 0));

                    const lineTaxAmount = Number(it.tax_amount) > 0
                      ? Number(it.tax_amount)
                      : (Number(it.cgst_amount || 0) + Number(it.sgst_amount || 0) + Number(it.igst_amount || 0) || (lineTaxRate > 0 ? (lineTaxable * lineTaxRate) / 100 : 0));

                    const lineTotal = Number(it.line_total) > 0
                      ? Number(it.line_total)
                      : (lineTaxable + lineTaxAmount);

                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl border border-slate-200/90 bg-white hover:border-slate-300 transition text-xs shadow-2xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-slate-900 text-sm">{it.item_name}</p>
                              {it.hsn_code && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  HSN: {it.hsn_code}
                                </span>
                              )}
                              {it.package_name && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                                  📦 {it.package_name} {Number(it.units_per_package) > 1 ? `(${formatNumber(it.units_per_package, 0)} ${it.base_unit || 'units'})` : ''}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1 font-mono">
                              Quantity: <strong className="text-slate-800">{formatNumber(it.quantity, 0)}</strong> {it.unit || it.package_name || 'pcs'} × {formatCurrency(it.rate_per_unit || 0, activeWorkspace.currency)}
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="font-black text-slate-900 tabular-nums text-sm font-mono block">
                              {formatCurrency(lineTotal, activeWorkspace.currency)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">Line Total</span>
                          </div>
                        </div>

                        {/* Tax & Discount Details per item */}
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] bg-slate-50/70 p-2 rounded-xl">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-slate-600">
                              Taxable: <strong className="text-slate-800 font-mono">{formatCurrency(lineTaxable, activeWorkspace.currency)}</strong>
                            </span>

                            {lineDiscountPercent > 0 && (
                              <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5">
                                <Percent size={10} /> {lineDiscountPercent}% Disc
                              </span>
                            )}
                          </div>

                          <div className="text-right">
                            {lineTaxRate > 0 ? (
                              <span className="text-blue-700 font-mono font-medium">
                                GST ({lineTaxRate}%): <strong>+{formatCurrency(lineTaxAmount, activeWorkspace.currency)}</strong>
                                {(Number(it.cgst_amount) > 0 || Number(it.sgst_amount) > 0) && (
                                  <span className="text-slate-400 text-[10px] block font-mono">
                                    (C: {formatCurrency(it.cgst_amount || lineTaxAmount / 2, activeWorkspace.currency)} | S: {formatCurrency(it.sgst_amount || lineTaxAmount / 2, activeWorkspace.currency)})
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono text-[10px]">No GST</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              {(selectedOrder.vendor_notes || selectedOrder.customer_notes || selectedOrder.notes) && (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Info size={12} /> Notes & Instructions
                  </span>
                  <p>{selectedOrder.vendor_notes || selectedOrder.customer_notes || selectedOrder.notes}</p>
                </div>
              )}
            </div>

            {/* Drawer Bottom Actions */}
            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-2">
              {isVendor && isUnconfirmed(selectedOrder.status) && (
                <>
                  <Button
                    onClick={() => handleAction(selectedOrder.id, 'accept')}
                    icon={<Check size={14} />}
                    className="flex-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Accept PO
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setDeclineModalOrder(selectedOrder);
                      setDeclineCategory('Out of Stock / Insufficient Raw Materials');
                      setDeclineReasonText('');
                    }}
                    className="text-xs font-bold text-rose-600 hover:bg-rose-50"
                  >
                    Decline Order
                  </Button>
                </>
              )}

              {isVendor && isConfirmed(selectedOrder.status) && (
                <>
                  <Button
                    onClick={() => {
                      const target = selectedOrder;
                      setSelectedOrder(null);
                      openDispatchModal(target);
                    }}
                    icon={<Truck size={14} />}
                    className="flex-1 text-xs font-bold"
                  >
                    Dispatch Shipment
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setDeclineModalOrder(selectedOrder);
                      setDeclineCategory('Out of Stock / Insufficient Raw Materials');
                      setDeclineReasonText('');
                    }}
                    className="text-xs font-bold text-rose-600 hover:bg-rose-50"
                  >
                    Cancel Order
                  </Button>
                </>
              )}

              {/* Customer Actions in Drawer */}
              {!isVendor && selectedOrder.status === 'pending' && (
                <>
                  <Button
                    onClick={() => handleAction(selectedOrder.id, 'confirm_order')}
                    icon={<Check size={14} />}
                    className="flex-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Confirm Order
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleAction(selectedOrder.id, 'decline_order')}
                    className="text-xs font-bold text-rose-600 hover:bg-rose-50"
                  >
                    Decline
                  </Button>
                </>
              )}

              {!isVendor && isDispatched(selectedOrder.status) && (
                <Button
                  onClick={() => {
                    const target = selectedOrder;
                    setSelectedOrder(null);
                    setReceiveModalOrder(target);
                  }}
                  icon={<PackageCheck size={14} />}
                  className="flex-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Receive Goods
                </Button>
              )}

              {!isVendor && isReceived(selectedOrder.status) && (
                <Button
                  onClick={() => {
                    const target = selectedOrder;
                    setSelectedOrder(null);
                    openReturnModal(target);
                  }}
                  icon={<RotateCcw size={14} />}
                  className="flex-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Request Return
                </Button>
              )}

              <Button variant="secondary" className="px-4 text-xs font-bold" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Prominent Dispatch Shipment Modal (Vendor) */}
      {dispatchModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Truck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Dispatch Purchase Order Shipment</h3>
                  <p className="text-xs text-slate-500 font-mono">Order #{dispatchModalOrder.order_number}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDispatchModalOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDispatchSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Logistics / Transporter Carrier
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BlueDart, VRL Logistics, DTDC"
                    value={dispatchForm.transporter_name}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, transporter_name: e.target.value })}
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Tracking / Docket Reference #
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BLUEDART-8829103"
                    value={dispatchForm.tracking_ref}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, tracking_ref: e.target.value })}
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Dispatch Date (dd-mm-yyyy)
                  </label>
                  <DatePicker
                    value={dispatchForm.dispatch_date}
                    onChange={(dateStr) => setDispatchForm({ ...dispatchForm, dispatch_date: dateStr })}
                    placeholder="Dispatch Date"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Vehicle Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MH12-AB-9921"
                    value={dispatchForm.vehicle_number}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, vehicle_number: e.target.value })}
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition"
                  />
                </div>
              </div>

              {/* Vendor Origin Contact & Dispatch Pickup Address (Auto-filled) */}
              <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <MapPin size={13} className="text-blue-600" />
                    Vendor Dispatch Origin & Contact
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                    <CheckCircle2 size={10} /> Auto-filled from Profile
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1">
                      <Phone size={11} className="text-blue-600" />
                      <span>Vendor Contact #</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +91 9876543210"
                      value={dispatchForm.vendor_contact}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, vendor_contact: e.target.value })}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1">
                      <MapPin size={11} className="text-blue-600" />
                      <span>Vendor Dispatch / Pickup Address</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Factory / Warehouse Pickup Address"
                      value={dispatchForm.vendor_address}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, vendor_address: e.target.value })}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Dispatch Notes & Driver Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Driver contact info, expected ETA, packaging notes..."
                  value={dispatchForm.notes}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, notes: e.target.value })}
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="secondary" onClick={() => setDispatchModalOrder(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading === `${dispatchModalOrder.id}-dispatch`}
                  icon={<Truck size={14} />}
                  className="text-xs font-bold"
                >
                  {actionLoading === `${dispatchModalOrder.id}-dispatch` ? 'Submitting...' : 'Confirm & Dispatch Shipment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Decline / Cancellation Reason Modal */}
      {declineModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                  <AlertCircle size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Decline / Cancel Order
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {declineModalOrder.order_number || declineModalOrder.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeclineModalOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleDeclineSubmit} className="p-5 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-800 leading-relaxed">
                <strong>Cancellation Notice:</strong> Declining this order will notify the workspace buyer immediately and update the procurement status. Please specify the reason below.
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Reason Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={declineCategory}
                  onChange={(e) => setDeclineCategory(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition"
                  required
                >
                  <option value="Out of Stock / Insufficient Raw Materials">Out of Stock / Insufficient Raw Materials</option>
                  <option value="Delivery Timeline / Schedule Unachievable">Delivery Timeline / Schedule Unachievable</option>
                  <option value="Pricing, Tax or Commercial Terms Discrepancy">Pricing, Tax or Commercial Terms Discrepancy</option>
                  <option value="Production Capacity Full / Machine Downtime">Production Capacity Full / Machine Downtime</option>
                  <option value="Item Technical Specifications Cannot Be Met">Item Technical Specifications Cannot Be Met</option>
                  <option value="Other">Other Reason (Specify below)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Reason Details & Notes <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Please describe why this order cannot be fulfilled..."
                  value={declineReasonText}
                  onChange={(e) => setDeclineReasonText(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="secondary" onClick={() => setDeclineModalOrder(null)}>
                  Keep Order
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading === `${declineModalOrder.id}-reject` || !declineReasonText.trim()}
                  className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm ring-2 ring-rose-500/20"
                >
                  {actionLoading === `${declineModalOrder.id}-reject` ? 'Declining...' : 'Confirm Decline / Cancel'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Receive Goods Modal */}
      {receiveModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                  <PackageCheck size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Confirm Goods Receipt
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Order #{receiveModalOrder.order_number || receiveModalOrder.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReceiveModalOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-2xl text-xs text-emerald-800 leading-relaxed space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                  <CheckCircle2 size={14} /> Physical Delivery Confirmation
                </div>
                <p>
                  Confirming receipt will mark this order as <strong>Goods Received</strong> in the workspace.
                  Please verify that all package seals are intact and items match your expectations.
                </p>
              </div>

              {receiveModalOrder.dispatch_tracking_ref && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Carrier Tracking</span>
                  <p className="font-mono font-bold text-slate-800 mt-0.5">
                    🚚 {receiveModalOrder.dispatch_tracking_ref}
                  </p>
                </div>
              )}

              {/* Items summary */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Items to Confirm ({(receiveModalOrder.items || []).length})
                </span>
                <div className="max-h-40 overflow-y-auto space-y-1.5 divide-y divide-slate-100">
                  {(receiveModalOrder.items || []).map((it: any, idx: number) => (
                    <div key={idx} className="pt-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">{it.item_name}</span>
                      <span className="font-mono text-slate-500">Qty: {it.quantity} {it.unit || 'pcs'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="secondary" onClick={() => setReceiveModalOrder(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={submittingReceive}
                  onClick={handleReceiveGoodsConfirm}
                  icon={<PackageCheck size={14} />}
                  className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  {submittingReceive ? 'Confirming...' : 'Yes, Confirm Receipt'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Return Order Modal */}
      {returnModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Request Order Return
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Order #{returnModalOrder.order_number || returnModalOrder.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReturnModalOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCustomerReturnSubmit} className="p-5 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl text-xs text-amber-800 leading-relaxed">
                <strong>Return Policy Notice:</strong> Submitting a return request will notify the workspace administrators.
                Once approved, a credit note will be issued and inventory will be returned.
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Reason Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={returnCategory}
                  onChange={(e) => setReturnCategory(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-500 transition"
                  required
                >
                  <option value="Quality / Defect">Quality / Manufacturing Defect</option>
                  <option value="Damaged in Transit">Damaged in Transit / Broken Packaging</option>
                  <option value="Wrong Item Shipped">Incorrect Item / Specification Mismatch</option>
                  <option value="Excess Quantity">Excess Quantity Delivered</option>
                  <option value="Late Delivery">Delivery Delayed / No Longer Required</option>
                  <option value="Other">Other Reason</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Return Explanation & Details <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Describe the issue, batch numbers, or defect details..."
                  value={returnReasonText}
                  onChange={(e) => setReturnReasonText(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              {/* Items returning */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  Select Line Items to Return
                </label>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {returnItems.map((it, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 transition ${
                        it.return_selected ? 'bg-amber-50/40 border-amber-300' : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={it.return_selected}
                          onChange={(e) => {
                            const updated = [...returnItems];
                            updated[idx].return_selected = e.target.checked;
                            setReturnItems(updated);
                          }}
                          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                        <div>
                          <p className="font-bold text-slate-900">{it.item_name}</p>
                          <p className="text-[11px] text-slate-400">Max ordered: {it.max_quantity}</p>
                        </div>
                      </div>

                      {it.return_selected && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500 font-bold uppercase">Return Qty:</span>
                          <input
                            type="number"
                            min="1"
                            max={it.max_quantity}
                            value={it.quantity}
                            onChange={(e) => {
                              const val = Math.min(it.max_quantity, Math.max(1, Number(e.target.value) || 1));
                              const updated = [...returnItems];
                              updated[idx].quantity = val;
                              setReturnItems(updated);
                            }}
                            className="w-16 h-8 text-center bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="secondary" onClick={() => setReturnModalOrder(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingReturn || !returnReasonText.trim()}
                  icon={<RotateCcw size={14} />}
                  className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                >
                  {submittingReturn ? 'Submitting...' : 'Submit Return Request'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Place New Sales Order Modal */}
      {showPlaceOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 my-8">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-blue-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Place New Order with {activeWorkspace.company_name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Choose from available products catalog and submit order directly
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPlaceOrderModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePlaceOrderSubmit} className="p-6 space-y-5">
              {loadingCatalog ? (
                <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
                  Loading product catalog...
                </div>
              ) : catalogProducts.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200">
                  <Package size={24} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-xs font-bold text-slate-700">No finished goods found in catalog</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    This workspace currently has no active products available for order.
                  </p>
                </div>
              ) : (
                <>
                  {/* Order Items */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        Order Line Items
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setNewOrderItems([
                            ...newOrderItems,
                            { product_id: '', packaging_option_id: '', quantity: 1, rate: 0, tax_rate: 18, name: '', stock: 0 }
                          ]);
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={13} /> Add Product
                      </button>
                    </div>

                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {newOrderItems.map((row, idx) => {
                        const selectedProduct = catalogProducts.find((p) => p.id === row.product_id);
                        const packagingOptions = selectedProduct?.packaging_configs || [];

                        return (
                          <div
                            key={idx}
                            className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2.5"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                              {/* Product Select */}
                              <div className="sm:col-span-6">
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                  Product
                                </label>
                                <select
                                  required
                                  value={row.product_id}
                                  onChange={(e) => {
                                    const pid = e.target.value;
                                    const prod = catalogProducts.find((p) => p.id === pid);
                                    const updated = [...newOrderItems];
                                    const pkgs = prod?.packaging_configs || [];
                                    const defaultPkg = pkgs.find((p: any) => p.is_default) || pkgs[pkgs.length - 1] || pkgs[0];
                                    const initialRate = defaultPkg?.selling_price
                                      ? Number(defaultPkg.selling_price)
                                      : defaultPkg?.units_per_package
                                        ? Number(prod?.default_price || 0) * Number(defaultPkg.units_per_package)
                                        : Number(prod?.default_price || 0);

                                    updated[idx] = {
                                      ...updated[idx],
                                      product_id: pid,
                                      name: prod?.name || '',
                                      packaging_option_id: defaultPkg?.id || '',
                                      rate: initialRate,
                                      tax_rate: prod?.tax_rate != null ? Number(prod.tax_rate) : 18,
                                      stock: Number(prod?.total_stock || 0)
                                    };
                                    setNewOrderItems(updated);
                                  }}
                                  className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                                >
                                  <option value="">Select a product...</option>
                                  {catalogProducts.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} ({p.sku || p.unit || 'unit'}) — In Stock: {p.total_stock || 0}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Packaging Option */}
                              <div className="sm:col-span-3">
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                  Packaging
                                </label>
                                <select
                                  value={row.packaging_option_id || ''}
                                  disabled={packagingOptions.length === 0}
                                  onChange={(e) => {
                                    const pkgId = e.target.value;
                                    const pkg = packagingOptions.find((p: any) => p.id === pkgId);
                                    const updated = [...newOrderItems];
                                    updated[idx].packaging_option_id = pkgId;
                                    if (pkg) {
                                      updated[idx].rate = Number(pkg.selling_price || 0) || (Number(selectedProduct?.default_price || 0) * (Number(pkg.units_per_package) || 1));
                                    } else {
                                      updated[idx].rate = Number(selectedProduct?.default_price || 0);
                                    }
                                    setNewOrderItems(updated);
                                  }}
                                  className="w-full h-9 px-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                  {packagingOptions.length === 0 ? (
                                    <option value="">Base Unit ({selectedProduct?.unit || 'Units'})</option>
                                  ) : (
                                    <>
                                      {packagingOptions.map((pkg: any) => (
                                        <option key={pkg.id} value={pkg.id}>
                                          {pkg.package_name} ({pkg.units_per_package} {selectedProduct?.unit || pkg.package_unit}) — {formatCurrency(pkg.selling_price || (Number(selectedProduct?.default_price || 0) * Number(pkg.units_per_package)), activeWorkspace.currency)}
                                        </option>
                                      ))}
                                      <option value="">Loose / Base ({selectedProduct?.unit || 'Units'}) — {formatCurrency(selectedProduct?.default_price || 0, activeWorkspace.currency)}</option>
                                    </>
                                  )}
                                </select>
                              </div>

                              {/* Quantity */}
                              <div className="sm:col-span-2">
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                  Qty
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  required
                                  value={row.quantity}
                                  onChange={(e) => {
                                    const updated = [...newOrderItems];
                                    updated[idx].quantity = Math.max(1, Number(e.target.value) || 1);
                                    setNewOrderItems(updated);
                                  }}
                                  className="w-full h-9 px-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 text-center focus:outline-none focus:border-blue-600"
                                />
                              </div>

                              {/* Remove Line */}
                              <div className="sm:col-span-1 flex items-end justify-center pt-5">
                                <button
                                  type="button"
                                  disabled={newOrderItems.length === 1}
                                  onClick={() => {
                                    const updated = newOrderItems.filter((_, i) => i !== idx);
                                    setNewOrderItems(updated);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 cursor-pointer"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>

                            {/* Line pricing display */}
                            {row.product_id && (
                              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 font-mono">
                                <span>Rate: {formatCurrency(row.rate, activeWorkspace.currency)} / unit</span>
                                <span className="font-bold text-slate-800">
                                  Line Total: {formatCurrency(row.rate * row.quantity, activeWorkspace.currency)}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Delivery Address & Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Shipping / Delivery Address
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Warehouse, site address or delivery location..."
                        value={newOrderAddress}
                        onChange={(e) => setNewOrderAddress(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Notes / PO Instructions
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Special delivery instructions, contact person, etc..."
                        value={newOrderNotes}
                        onChange={(e) => setNewOrderNotes(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  {/* Totals Summary */}
                  {(() => {
                    const subtotal = newOrderItems.reduce(
                      (sum, it) => sum + (Number(it.rate || 0) * Number(it.quantity || 0)),
                      0
                    );
                    const estimatedTax = subtotal * 0.18;
                    const grandTotal = subtotal + estimatedTax;

                    return (
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Subtotal ({newOrderItems.filter((i) => i.product_id).length} items):</span>
                          <span className="font-mono font-bold">{formatCurrency(subtotal, activeWorkspace.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Estimated Tax (GST ~18%):</span>
                          <span className="font-mono font-bold">{formatCurrency(estimatedTax, activeWorkspace.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-900 font-bold pt-2 border-t border-slate-200 text-sm">
                          <span>Estimated Grand Total:</span>
                          <span className="font-mono font-black text-blue-600">
                            {formatCurrency(grandTotal, activeWorkspace.currency)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <Button type="button" variant="secondary" onClick={() => setShowPlaceOrderModal(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={submittingOrder || newOrderItems.every((it) => !it.product_id || it.quantity <= 0)}
                      icon={<ShoppingBag size={14} />}
                      className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                    >
                      {submittingOrder ? 'Submitting Order...' : 'Confirm & Place Order'}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
