import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../context';
import { usePortal } from '../../components/AppShell';
import {
  RotateCcw, Search, Download, Plus, AlertCircle, RefreshCw, X,
  MessageCircle, Send, Lock, Info,
  CheckCircle2, XCircle, Package, Calendar
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Select } from '../../components/ui/Select';
import { Pagination } from '../../components/ui/Pagination';
import { formatDate } from '../../lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface PortalMessage {
  id: string;
  return_request_id: string;
  sender_type: 'erp_user' | 'vendor' | 'customer' | 'system';
  sender_id: string;
  sender_name: string;
  message: string;
  is_system: number | boolean;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) +
      ' · ' + d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return iso;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat Bubble
// ─────────────────────────────────────────────────────────────────────────────
function ChatBubble({ msg, portalType }: { msg: PortalMessage; portalType: 'vendor' | 'customer' }) {
  const isSystem = Boolean(msg.is_system);
  // "Me" = same portal type as current user
  const isMe = msg.sender_type === portalType;
  const isErp = msg.sender_type === 'erp_user';

  if (isSystem) {
    return (
      <div className="flex justify-center py-1.5 px-3 my-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-100/80 border border-slate-200 rounded-full px-3 py-1 max-w-[90%] text-center">
          <Info size={11} className="text-slate-400 shrink-0" />
          <span>{msg.message}</span>
        </span>
      </div>
    );
  }

  if (isMe) {
    // Portal user's own messages: right side, teal/blue
    return (
      <div className="flex flex-col items-end gap-0.5 px-3 my-1.5">
        <div className="max-w-[82%] bg-blue-600 text-white rounded-2xl rounded-br-sm px-3.5 py-2 shadow-sm">
          <p className="text-sm leading-snug whitespace-pre-wrap break-words">{msg.message}</p>
        </div>
        <div className="flex items-center gap-1.5 pr-1">
          <span className="text-[10px] text-slate-400">{msg.sender_name}</span>
          <span className="text-[10px] text-slate-300">·</span>
          <span className="text-[10px] text-slate-400">{formatTime(msg.created_at)}</span>
        </div>
      </div>
    );
  }

  if (isErp) {
    // ERP staff messages: left side, slate
    return (
      <div className="flex flex-col items-start gap-0.5 px-3 my-1.5">
        <div className="max-w-[82%] bg-slate-100 border border-slate-200 text-slate-900 rounded-2xl rounded-bl-sm px-3.5 py-2 shadow-sm">
          <p className="text-sm leading-snug whitespace-pre-wrap break-words">{msg.message}</p>
        </div>
        <div className="flex items-center gap-1.5 pl-1">
          <span className="text-[10px] text-slate-400">{msg.sender_name} (ERP)</span>
          <span className="text-[10px] text-slate-300">·</span>
          <span className="text-[10px] text-slate-400">{formatTime(msg.created_at)}</span>
        </div>
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Portal Return Detail Drawer
// ─────────────────────────────────────────────────────────────────────────────
function PortalReturnDetailDrawer({
  returnReq,
  portalType,
  companyId,
  onClose,
  onDecision,
}: {
  returnReq: any;
  portalType: 'vendor' | 'customer';
  companyId: string;
  onClose: () => void;
  onDecision: (id: string, type: 'accept' | 'reject', notes: string) => Promise<void>;
}) {
  const toast = useToast();
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [decisionModal, setDecisionModal] = useState<'accept' | 'reject' | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [deciding, setDeciding] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const typingTimerRef = useRef<number | null>(null);

  const isOpen = returnReq?.status === 'Pending';
  const isVendor = portalType === 'vendor';
  const canDecide = isVendor && isOpen &&
    ['purchase_return', 'purchase_cancellation'].includes(returnReq?.request_type);

  const fetchMessages = async (silent = false) => {
    if (!silent) setLoadingMsgs(true);
    try {
      const res = await api.get(`/portal/returns/${returnReq.id}/messages`, {
        params: { company_id: companyId }
      });
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch {
      // silent
    } finally {
      if (!silent) setLoadingMsgs(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: number | null = null;

    const loadHistoryAndConnect = async () => {
      await fetchMessages();
      if (cancelled || !isOpen) return;

      const token = localStorage.getItem('erp_portal_token');
      if (!token) return;

      const apiBase = api.defaults.baseURL || window.location.origin;
      const socketUrl = new URL(apiBase, window.location.origin);
      socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      socketUrl.pathname = `/ws/return-requests/${returnReq.id}`;
      socketUrl.searchParams.set('token', token);
      socketUrl.searchParams.set('company_id', companyId);

      const connect = () => {
        if (cancelled) return;
        const socket = new WebSocket(socketUrl.toString());
        socketRef.current = socket;
        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload?.type === 'typing') {
              setRemoteTyping(payload.sender === 'erp_user' && Boolean(payload.isTyping));
              return;
            }
            const incoming = payload?.type === 'message' ? payload.message : null;
            if (!incoming || cancelled) return;

            setMessages((current) => {
              if (current.some((message) => message.id === incoming.id)) return current;
              return [...current, incoming];
            });
          } catch {
            // Ignore malformed websocket events.
          }
        };
        socket.onclose = () => {
          if (!cancelled) reconnectTimer = window.setTimeout(connect, 1500);
        };
        socket.onerror = () => socket.close();
      };

      connect();
    };

    loadHistoryAndConnect();
    return () => {
      cancelled = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socketRef.current?.close();
      socketRef.current = null;
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    };
  }, [returnReq.id, isOpen, companyId]);

  useEffect(() => {
    if (loadingMsgs) return;
    const frame = requestAnimationFrame(() => {
      const container = messageListRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, loadingMsgs]);

  const handleInputChange = (value: string) => {
    setInputText(value);
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'typing', isTyping: value.length > 0 }));
    }
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    if (value.length > 0) {
      typingTimerRef.current = window.setTimeout(() => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'typing', isTyping: false }));
        }
      }, 1000);
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const response = await api.post(`/portal/returns/${returnReq.id}/messages`, {
        company_id: companyId,
        message: text
      });
      setInputText('');
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'typing', isTyping: false }));
      }
      setMessages((current) => current.some((item) => item.id === response.data?.id)
        ? current
        : [...current, response.data]);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to send message', 'error');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDecision = async () => {
    if (!decisionModal) return;
    if (decisionModal === 'reject' && decisionNotes.trim().length < 3) {
      toast('Please provide a rejection reason of at least 3 characters', 'error');
      return;
    }
    setDeciding(true);
    try {
      await onDecision(returnReq.id, decisionModal, decisionNotes.trim());
      setDecisionModal(null);
      setDecisionNotes('');
    } finally {
      setDeciding(false);
    }
  };

  const isResolved = returnReq.status === 'Approved' || returnReq.status === 'Rejected';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <RotateCcw size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Return Request Details</h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {returnReq.request_number || returnReq.id?.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={returnReq.status || 'Pending'} />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <Calendar size={11} /> Request Date
              </span>
              <span className="font-bold text-slate-900 block mt-0.5">
                {returnReq.created_at ? formatDate(returnReq.created_at) : '—'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <Package size={11} /> Type
              </span>
              <span className="font-bold text-slate-900 block mt-0.5 capitalize">
                {returnReq.request_type?.replace(/_/g, ' ') || 'Return'}
              </span>
            </div>
          </div>

          {/* Reason */}
          <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl">
            <span className="text-[10px] text-amber-700 uppercase font-bold block mb-1">Reason for Return</span>
            <p className="text-sm text-amber-950 font-medium whitespace-pre-wrap">{returnReq.reason}</p>
          </div>

          {/* Items */}
          {(() => {
            let items: any[] = [];
            try {
              items = typeof returnReq.items === 'string' ? JSON.parse(returnReq.items) : (returnReq.items || []);
            } catch { items = []; }
            if (!Array.isArray(items) || items.length === 0) return null;
            return (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-2">Items Involved</span>
                <div className="space-y-1.5">
                  {items.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">
                        {item.item_description || item.name || item.item_name || 'Item'}
                      </span>
                      <span className="text-slate-500">Qty: {item.quantity || 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Resolution notes if resolved */}
          {isResolved && returnReq.resolution_notes && (
            <div className={`p-3.5 rounded-xl border text-xs ${
              returnReq.status === 'Approved'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}>
              <div className="flex items-center gap-1.5 font-bold mb-1">
                {returnReq.status === 'Approved'
                  ? <CheckCircle2 size={14} className="text-emerald-600" />
                  : <XCircle size={14} className="text-red-600" />
                }
                {returnReq.status === 'Approved' ? 'Approved' : 'Rejected'}
              </div>
              <p>{returnReq.resolution_notes}</p>
            </div>
          )}

          {/* Vendor decision buttons */}
          {canDecide && (
            <div className="flex gap-2">
              <button
                onClick={() => { setDecisionModal('accept'); setDecisionNotes(''); }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-sm hover:bg-emerald-100 transition cursor-pointer"
              >
                ✓ Accept Return
              </button>
              <button
                onClick={() => { setDecisionModal('reject'); setDecisionNotes(''); }}
                className="flex-1 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold text-sm hover:bg-red-100 transition cursor-pointer"
              >
                ✕ Reject Return
              </button>
            </div>
          )}

          {/* ─── CHAT THREAD ─── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MessageCircle size={14} className="text-blue-600" />
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Chat with ERP Team
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {isOpen ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
                    <Lock size={9} />
                    Closed
                  </span>
                )}
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              {/* Messages */}
              <div ref={messageListRef} className="bg-slate-50/40 min-h-[200px] max-h-[300px] overflow-y-auto py-2">
                {loadingMsgs ? (
                  <div className="flex flex-col gap-2 p-4">
                    <div className="h-6 bg-slate-100 rounded-full w-3/4 animate-pulse mx-auto" />
                    <div className="h-10 bg-blue-50 rounded-2xl w-2/3 animate-pulse self-end" />
                    <div className="h-10 bg-slate-100 rounded-2xl w-2/3 animate-pulse" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                    <MessageCircle size={26} className="text-slate-300 mb-2" />
                    <p className="text-xs text-slate-400">No messages yet.</p>
                    {isOpen && (
                      <p className="text-xs text-slate-400 mt-0.5">Start the conversation with the ERP team.</p>
                    )}
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <ChatBubble key={msg.id} msg={msg} portalType={portalType} />
                    ))}
                    <div ref={bottomRef} />
                  </>
                )}
              </div>

              {/* Input */}
              {isOpen ? (
                <div className="border-t border-slate-200 bg-white p-3">
                  <div className="flex gap-2 items-end">
                    <textarea
                      ref={inputRef}
                      value={inputText}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onBlur={() => {
                        if (socketRef.current?.readyState === WebSocket.OPEN) {
                          socketRef.current.send(JSON.stringify({ type: 'typing', isTyping: false }));
                        }
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="Message ERP team… (Enter to send)"
                      rows={2}
                      className="flex-1 resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!inputText.trim() || sending}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0 cursor-pointer"
                    >
                      {sending
                        ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        : <Send size={16} />
                      }
                    </button>
                  </div>
                  {remoteTyping && (
                    <p className="text-[11px] text-slate-400 mt-1.5 pl-0.5">ERP team is typing...</p>
                  )}
                </div>
              ) : (
                <div className="border-t border-slate-200 bg-slate-50 px-4 py-2.5 flex items-center gap-2 text-xs text-slate-500">
                  <Lock size={12} className="shrink-0" />
                  Chat closed — request has been {returnReq.status?.toLowerCase() || 'resolved'}.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Decision Modal */}
      {decisionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {decisionModal === 'accept' ? '✓ Accept Return Request' : '✕ Reject Return Request'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                {returnReq.request_number || returnReq.id?.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <textarea
              autoFocus
              required={decisionModal === 'reject'}
              rows={3}
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              placeholder={
                decisionModal === 'reject'
                  ? 'State the reason for rejecting this return (required)…'
                  : 'Optional acceptance notes or collection instructions…'
              }
              className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDecisionModal(null)} disabled={deciding}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDecision}
                disabled={deciding || (decisionModal === 'reject' && decisionNotes.trim().length < 3)}
                className={decisionModal === 'reject' ? '!bg-red-600 hover:!bg-red-700' : ''}
              >
                {deciding ? 'Saving…' : decisionModal === 'accept' ? 'Accept Return' : 'Reject Return'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export function PortalReturnsPage() {
  const toast = useToast();
  const { activeWorkspace, loading: portalLoading } = usePortal();

  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // Detail drawer
  const [selectedReturn, setSelectedReturn] = useState<any | null>(null);

  // Create modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    invoice_id: '',
    reason: 'Damaged in Transit',
    item_description: '',
    quantity: 1,
    notes: ''
  });

  const fetchReturns = async () => {
    if (!activeWorkspace) {
      setReturns([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const params: any = { company_id: activeWorkspace.company_id };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const res = await api.get('/portal/returns', { params });
      if (res.data?.ok) setReturns(res.data.returns || []);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to fetch returns', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReturns(); }, [activeWorkspace?.company_id, statusFilter]);

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    try {
      setSubmitting(true);
      const res = await api.post('/portal/returns', { company_id: activeWorkspace.company_id, ...formData });
      if (res.data?.ok) {
        toast('Return request submitted successfully!', 'success');
        setIsModalOpen(false);
        setFormData({ invoice_id: '', reason: 'Damaged in Transit', item_description: '', quantity: 1, notes: '' });
        await fetchReturns();
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to submit return request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecision = async (id: string, type: 'accept' | 'reject', notes: string) => {
    if (!activeWorkspace) return;
    try {
      await api.post(`/portal/returns/${id}/${type}`, {
        company_id: activeWorkspace.company_id,
        ...(type === 'accept' ? { notes } : { reason: notes })
      });
      toast(`Return request ${type === 'accept' ? 'accepted' : 'rejected'} successfully`, 'success');
      // Refresh the list and update the drawer state
      await fetchReturns();
      // Update selected return status optimistically
      setSelectedReturn((prev: any) => prev ? { ...prev, status: type === 'accept' ? 'Approved' : 'Rejected' } : null);
    } catch (err: any) {
      toast(err.response?.data?.error || `Failed to ${type} return request`, 'error');
    }
  };

  const exportReturnsCSV = () => {
    if (returns.length === 0) { toast('No returns to export', 'info'); return; }
    const headers = ['Return ID', 'Request #', 'Reason', 'Status', 'Date', 'Resolution Notes'];
    const rows = returns.map((r) => [
      r.id, r.request_number || '—',
      `"${(r.reason || '').replace(/"/g, '""')}"`,
      r.status || 'Pending',
      r.created_at ? formatDate(r.created_at) : '',
      `"${(r.resolution_notes || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `returns_${activeWorkspace?.company_code || 'portal'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast('Exported returns CSV successfully', 'success');
  };

  if (!activeWorkspace) {
    if (portalLoading) return <div className="max-w-4xl mx-auto py-12 text-center text-xs text-slate-400">Loading workspace details...</div>;
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Active Workspace Connected</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
          To create and inspect RMA return requests, connect to a business workspace using their Company Connect Code.
        </p>
      </div>
    );
  }

  const statusOptions = [
    { value: 'all', label: 'All Return Statuses' },
    { value: 'Pending', label: 'Pending Review' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Rejected', label: 'Rejected' }
  ];
  const isVendorPortal = activeWorkspace.portal_type === 'vendor';

  const reasonOptions = [
    { value: 'Damaged in Transit', label: 'Damaged in Transit' },
    { value: 'Defective / Quality Discrepancy', label: 'Defective / Quality Discrepancy' },
    { value: 'Incorrect Item Shipped', label: 'Incorrect Item Shipped' },
    { value: 'Excess / Short Quantity', label: 'Excess / Short Quantity' },
    { value: 'Other Discrepancy', label: 'Other Discrepancy' }
  ];

  const paginatedReturns = returns.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
            <RotateCcw size={20} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Return Requests & Disputes</h1>
            <p className="text-xs text-slate-500">
              Dispute and return tracking with {activeWorkspace.company_name} ({activeWorkspace.company_code})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<Download size={14} />} onClick={exportReturnsCSV} className="text-xs font-bold">
            Export CSV
          </Button>
          <Button icon={<Plus size={14} />} onClick={() => setIsModalOpen(true)} className="text-xs font-bold">
            Initiate Return
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search return #, reason…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchReturns()}
            className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
          />
        </div>
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="w-52">
            <Select value={statusFilter} onChange={(val) => { setStatusFilter(val); setCurrentPage(1); }} options={statusOptions} />
          </div>
          <Button variant="secondary" icon={<RefreshCw size={14} />} onClick={fetchReturns} className="text-xs font-bold">Refresh</Button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 animate-pulse">Loading return requests...</div>
        ) : returns.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <RotateCcw size={24} />
            </div>
            <p className="text-sm font-bold text-slate-700 mb-1">No return requests found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
              There are no active or past returns registered with {activeWorkspace.company_name}.
            </p>
            <Button className="text-xs font-semibold" icon={<Plus size={14} />} onClick={() => setIsModalOpen(true)}>
              Create First Return Request
            </Button>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Request #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Resolution</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {paginatedReturns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-slate-50/60 transition cursor-pointer" onClick={() => setSelectedReturn(ret)}>
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                        {ret.request_number || ret.id?.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap font-mono">
                        {ret.created_at ? formatDate(ret.created_at) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 font-semibold max-w-[180px] truncate" title={ret.reason}>
                        {ret.reason}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <StatusBadge status={ret.status || 'Pending'} />
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-[11px] max-w-[140px] truncate">
                        {ret.resolution_notes || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedReturn(ret)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition cursor-pointer ml-auto"
                          title="View Details & Chat"
                        >
                          <MessageCircle size={12} />
                          Chat & Details
                          {ret.status === 'Pending' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalItems={returns.length}
              pageSize={pageSize}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        )}
      </div>

      {/* Detail Drawer with Chat */}
      {selectedReturn && (
        <PortalReturnDetailDrawer
          returnReq={selectedReturn}
          portalType={isVendorPortal ? 'vendor' : 'customer'}
          companyId={activeWorkspace.company_id}
          onClose={() => setSelectedReturn(null)}
          onDecision={handleDecision}
        />
      )}

      {/* Initiate Return Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Initiate Return Request</h3>
                  <p className="text-xs text-slate-500">For {activeWorkspace.company_name}</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateReturn} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Reason for Return</label>
                <Select value={formData.reason} onChange={(val) => setFormData({ ...formData, reason: val })} options={reasonOptions} />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Item Description / Part Number</label>
                <input
                  type="text" required
                  placeholder="e.g. M12 Stainless Bolts, Batch #9921"
                  value={formData.item_description}
                  onChange={(e) => setFormData({ ...formData, item_description: e.target.value })}
                  className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Quantity to Return</label>
                <input
                  type="number" required min={1}
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value, 10) || 1 })}
                  className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">Additional Details / Notes</label>
                <textarea
                  rows={3}
                  placeholder="Explain the defect, invoice number, or delivery date..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting} className="text-xs font-bold">
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
