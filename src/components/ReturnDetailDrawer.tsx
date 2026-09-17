import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Building2,
  User,
  FileText,
  Package,
  AlertCircle,
  Copy,
  Check,
  ReceiptText,
  Clock,
  MessageCircle,
  Send,
  Phone,
  Mail,
  MapPin,
  Lock,
  Info
} from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, formatDate, formatNumber } from '../lib/utils';
import { useWorkspace, useToast } from '../context';
import { Drawer } from './ui/Modal';
import { StatusBadge } from './ui/StatusBadge';
import { Button } from './ui/Button';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ReturnMessage {
  id: string;
  return_request_id: string;
  sender_type: 'erp_user' | 'vendor' | 'customer' | 'system';
  sender_id: string;
  sender_name: string;
  message: string;
  is_system: number | boolean;
  created_at: string;
}

interface ReturnDetailDrawerProps {
  requestId: string;
  onClose: () => void;
  onApprove?: (request: any) => void;
  onReject?: (request: any) => void;
  onRefresh?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(isoString: string) {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) +
      ' · ' + d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return isoString;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat bubble component
// ─────────────────────────────────────────────────────────────────────────────
function ChatBubble({ msg, isVendorReturn }: { msg: ReturnMessage; isVendorReturn: boolean }) {
  const isSystem = Boolean(msg.is_system);
  const isErp = msg.sender_type === 'erp_user';
  const isParty = msg.sender_type === 'vendor' || msg.sender_type === 'customer';

  if (isSystem) {
    return (
      <div className="flex items-start gap-2 py-1.5 px-3 my-1">
        <div className="flex-1 text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
            <Info size={11} className="text-slate-400 shrink-0" />
            <span>{msg.message}</span>
          </span>
        </div>
      </div>
    );
  }

  if (isErp) {
    // ERP messages on the right
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

  if (isParty) {
    // Vendor / Customer messages on the left
    const color = isVendorReturn
      ? 'bg-amber-50 border border-amber-200 text-amber-950'
      : 'bg-emerald-50 border border-emerald-200 text-emerald-950';
    const icon = isVendorReturn
      ? <Building2 size={14} className="text-amber-600 shrink-0 mt-0.5" />
      : <User size={14} className="text-emerald-600 shrink-0 mt-0.5" />;

    return (
      <div className="flex flex-col items-start gap-0.5 px-3 my-1.5">
        <div className={`max-w-[82%] ${color} rounded-2xl rounded-bl-sm px-3.5 py-2 shadow-sm flex gap-2`}>
          {icon}
          <p className="text-sm leading-snug whitespace-pre-wrap break-words">{msg.message}</p>
        </div>
        <div className="flex items-center gap-1.5 pl-1">
          <span className="text-[10px] text-slate-400">{msg.sender_name}</span>
          <span className="text-[10px] text-slate-300">·</span>
          <span className="text-[10px] text-slate-400">{formatTime(msg.created_at)}</span>
        </div>
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact Info Card (shown when chat is closed / resolved)
// ─────────────────────────────────────────────────────────────────────────────
function ContactInfoCard({ detail, isVendorReturn }: { detail: any; isVendorReturn: boolean }) {
  const name = isVendorReturn ? detail.vendor_name : detail.customer_name;
  const email = isVendorReturn ? detail.vendor_email : detail.customer_email;
  const phone = isVendorReturn ? detail.vendor_phone : detail.customer_phone;
  const address = isVendorReturn ? detail.vendor_address : detail.customer_address;
  const gstin = isVendorReturn ? detail.vendor_gstin : detail.customer_gstin;

  const isApproved = detail.status === 'Approved';

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${
      isApproved
        ? 'bg-emerald-50 border-emerald-200'
        : 'bg-red-50 border-red-200'
    }`}>
      <div className="flex items-center gap-2">
        {isApproved
          ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          : <XCircle size={16} className="text-red-600 shrink-0" />
        }
        <span className={`text-sm font-bold ${isApproved ? 'text-emerald-900' : 'text-red-900'}`}>
          {isApproved ? 'Request Approved — Contact Information' : 'Request Rejected — Contact Information'}
        </span>
      </div>
      <p className={`text-xs ${isApproved ? 'text-emerald-800' : 'text-red-800'}`}>
        {isApproved
          ? `The return has been approved. Below is the ${isVendorReturn ? 'vendor' : 'customer'}'s contact information for further coordination.`
          : `The return was rejected. Below is the ${isVendorReturn ? 'vendor' : 'customer'}'s contact information for reference.`
        }
      </p>

      <div className="bg-white/80 rounded-xl border border-slate-200 p-3 space-y-2">
        <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
          {isVendorReturn ? <Building2 size={14} className="text-amber-600" /> : <User size={14} className="text-emerald-600" />}
          {name || 'N/A'}
        </div>
        {email && (
          <a href={`mailto:${email}`} className="flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-900 transition">
            <Mail size={12} /> {email}
          </a>
        )}
        {phone && (
          <a href={`tel:${phone}`} className="flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-900 transition">
            <Phone size={12} /> {phone}
          </a>
        )}
        {gstin && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <FileText size={12} className="text-slate-400" />
            <span className="font-mono font-medium">{gstin}</span>
          </div>
        )}
        {address && (
          <div className="flex items-start gap-1.5 text-xs text-slate-500">
            <MapPin size={12} className="shrink-0 mt-0.5 text-slate-400" />
            <span>{address}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat Panel
// ─────────────────────────────────────────────────────────────────────────────
function ChatPanel({ requestId, detail, isVendorReturn }: {
  requestId: string;
  detail: any;
  isVendorReturn: boolean;
}) {
  const toast = useToast();
  const { workspace } = useWorkspace();
  const [messages, setMessages] = useState<ReturnMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const isOpen = detail?.status === 'Pending';

  const fetchMessages = async (silent = false) => {
    if (!silent) setLoadingMsgs(true);
    try {
      const res = await api.get(`/api/return-requests/${requestId}/messages`);
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch {
      // silent fail for poll cycles
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

      const token = localStorage.getItem('erp_token');
      if (!token) return;

      const apiBase = api.defaults.baseURL || window.location.origin;
      const socketUrl = new URL(apiBase, window.location.origin);
      socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      socketUrl.pathname = `/ws/return-requests/${requestId}`;
      socketUrl.searchParams.set('token', token);
      if (workspace?.id) socketUrl.searchParams.set('company_id', workspace.id);

      const connect = () => {
        if (cancelled) return;
        const socket = new WebSocket(socketUrl.toString());
        socketRef.current = socket;
        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload?.type === 'typing') {
              setRemoteTyping(payload.sender !== 'erp_user' && Boolean(payload.isTyping));
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
  }, [requestId, isOpen, workspace?.id]);

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
      const response = await api.post(`/api/return-requests/${requestId}/messages`, { message: text });
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

  const partyLabel = isVendorReturn ? 'Vendor' : 'Customer';
  const partyName = isVendorReturn ? detail?.vendor_name : detail?.customer_name;

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white">
      {/* Chat header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-100 ${
        isOpen ? 'bg-blue-50' : 'bg-slate-50'
      }`}>
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className={isOpen ? 'text-blue-600' : 'text-slate-400'} />
          <div>
            <span className="text-sm font-bold text-slate-900">
              Conversation with {partyLabel}
            </span>
            {partyName && (
              <span className="text-xs text-slate-500 ml-1.5">— {partyName}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isOpen ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-full px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
              <Lock size={10} />
              Closed
            </span>
          )}
        </div>
      </div>

      {/* Message list */}
      <div ref={messageListRef} className="flex-1 overflow-y-auto min-h-[220px] max-h-[340px] py-2 bg-slate-50/40">
        {loadingMsgs ? (
          <div className="flex flex-col gap-2 p-4">
            <div className="h-8 bg-slate-100 rounded-full w-3/4 animate-pulse mx-auto" />
            <div className="h-12 bg-blue-50 rounded-2xl w-2/3 animate-pulse self-end" />
            <div className="h-12 bg-amber-50 rounded-2xl w-2/3 animate-pulse" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center px-4">
            <MessageCircle size={28} className="text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">No messages yet.</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {isOpen ? `Start the conversation with the ${partyLabel}.` : 'This request was resolved without any chat messages.'}
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatBubble key={msg.id} msg={msg} isVendorReturn={isVendorReturn} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input area — only when Pending */}
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
              placeholder={`Message ${partyLabel}… (Enter to send, Shift+Enter for new line)`}
              rows={2}
              className="flex-1 resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || sending}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0 cursor-pointer"
              title="Send message (Enter)"
            >
              {sending
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Send size={16} />
              }
            </button>
          </div>
          {remoteTyping && (
            <p className="text-[11px] text-slate-400 mt-1.5 pl-0.5">Vendor is typing...</p>
          )}
          <p className="text-[10px] text-slate-400 mt-1.5 pl-0.5">
            Messages are visible to both ERP staff and the {partyLabel.toLowerCase()} via their portal.
          </p>
        </div>
      ) : (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex items-center gap-2 text-xs text-slate-500">
          <Lock size={12} className="shrink-0" />
          Chat is closed — this request has been {detail?.status?.toLowerCase() || 'resolved'}.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Drawer Export
// ─────────────────────────────────────────────────────────────────────────────

export function ReturnDetailDrawer({
  requestId,
  onClose,
  onApprove,
  onReject,
  onRefresh
}: ReturnDetailDrawerProps) {
  const { workspace } = useWorkspace();
  const toast = useToast();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchDetail = () => {
    setLoading(true);
    api.get(`/api/return-requests/${requestId}`)
      .then((res) => {
        setDetail(res.data);
        if (onRefresh) onRefresh();
      })
      .catch((err) => {
        console.error('fetch return request detail error', err);
        toast('Failed to load return request details', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (requestId) {
      fetchDetail();
    }
  }, [requestId]);

  const currency = workspace?.currency || 'INR';

  const copyNumber = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast('Copied to clipboard', 'info');
  };

  const isVendorReturn = detail?.return_direction === 'vendor' ||
    ['purchase_return', 'purchase_cancellation'].includes(detail?.request_type) ||
    Boolean(detail?.vendor_id);

  const items = Array.isArray(detail?.items) ? detail.items : [];
  const totalItemsValue = items.reduce((acc: number, item: any) => {
    const qty = Number(item.quantity || 0);
    const rate = Number(item.rate_per_unit || item.unit_price || item.rate || 0);
    const lineTotal = Number(item.total_price || item.line_total || (qty * rate));
    return acc + lineTotal;
  }, 0);

  const isResolved = detail?.status === 'Approved' || detail?.status === 'Rejected';

  return (
    <Drawer title="Return & Cancellation Details" onClose={onClose}>
      {loading ? (
        <div className="space-y-4 p-4">
          <div className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-44 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-60 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
      ) : detail ? (
        <div className="space-y-5 pb-8">
          {/* Header Card */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3 shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isVendorReturn
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {isVendorReturn ? <Building2 size={12} /> : <User size={12} />}
                    {isVendorReturn ? 'Return to Vendor (Purchase)' : 'Return by Customer (Sales)'}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">
                    {detail.request_type ? detail.request_type.replace('_', ' ').toUpperCase() : 'RETURN'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white font-mono tracking-tight">
                    {detail.request_number}
                  </h3>
                  <button
                    onClick={() => copyNumber(detail.request_number)}
                    className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
                    title="Copy Request Number"
                  >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <StatusBadge status={detail.status} />
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Clock size={11} /> {formatDate(detail.created_at)}
                </span>
              </div>
            </div>

            {/* Quick Actions for Pending */}
            {detail.status === 'Pending' && !isVendorReturn && (onReject || onApprove) && (
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                {onReject && (
                  <Button
                    variant="danger"
                    icon={<XCircle size={14} />}
                    onClick={() => onReject(detail)}
                  >
                    Reject Request
                  </Button>
                )}
                {onApprove && (
                  <Button
                    variant="primary"
                    icon={<CheckCircle2 size={14} />}
                    onClick={() => onApprove(detail)}
                  >
                    Approve & Process
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Reference Order & Party Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Reference Document Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={13} className="text-blue-600" /> Linked Order
                </span>
                {detail.reference_status && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {detail.reference_status}
                  </span>
                )}
              </div>
              <div>
                <span className="text-xs text-slate-500 block">
                  {detail.reference_type === 'procurement' ? 'Purchase Order #' : 'Sales Invoice #'}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-bold text-slate-900 font-mono">
                    {detail.reference_number || detail.reference_id || 'N/A'}
                  </span>
                  {detail.reference_number && (
                    <button
                      onClick={() => copyNumber(detail.reference_number)}
                      className="text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <Copy size={12} />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/80">
                <div>
                  <span className="text-slate-400 text-[11px] block">Order Date</span>
                  <span className="font-semibold text-slate-700">{formatDate(detail.reference_date || detail.created_at)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Total Order Value</span>
                  <span className="font-semibold text-slate-900">
                    {detail.reference_total_amount ? formatCurrency(detail.reference_total_amount, currency) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Party Profile Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                {isVendorReturn ? <Building2 size={13} className="text-amber-600" /> : <User size={13} className="text-emerald-600" />}
                {isVendorReturn ? 'Vendor Profile' : 'Customer Profile'}
              </span>
              <div>
                <span className="text-xs text-slate-500 block">Party Name</span>
                <span className="text-sm font-bold text-slate-900 block truncate">
                  {detail.vendor_name || detail.customer_name || 'Direct / Internal'}
                </span>
              </div>
              <div className="space-y-1 text-xs pt-2 border-t border-slate-200/80 text-slate-600">
                {(detail.vendor_email || detail.customer_email) && (
                  <div className="truncate">
                    <span className="text-slate-400 text-[11px]">Email: </span>
                    {detail.vendor_email || detail.customer_email}
                  </div>
                )}
                {(detail.vendor_phone || detail.customer_phone) && (
                  <div>
                    <span className="text-slate-400 text-[11px]">Phone: </span>
                    {detail.vendor_phone || detail.customer_phone}
                  </div>
                )}
                {(detail.vendor_gstin || detail.customer_gstin) && (
                  <div>
                    <span className="text-slate-400 text-[11px]">GSTIN: </span>
                    <span className="font-mono font-medium text-slate-800">{detail.vendor_gstin || detail.customer_gstin}</span>
                  </div>
                )}
                {(detail.vendor_address || detail.customer_address) && (
                  <div className="truncate text-slate-500 text-[11px]" title={detail.vendor_address || detail.customer_address}>
                    {detail.vendor_address || detail.customer_address}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reason & Channel Card */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle size={14} className="text-orange-500" /> Reason for Return / Cancellation
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                Source: {detail.requested_by_type || 'Portal'}
              </span>
            </div>
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-sm text-amber-950">
              <p className="font-medium whitespace-pre-wrap">{detail.reason || 'No specific reason description provided.'}</p>
            </div>
          </div>

          {/* Returned Items Breakdown Table */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Package size={14} className="text-blue-600" /> Returned Items ({items.length})
              </span>
              {totalItemsValue > 0 && (
                <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                  Est. Value: {formatCurrency(totalItemsValue, currency)}
                </span>
              )}
            </div>

            {items.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Full order cancellation / return (Entire document returned)
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-2.5">Item Description</th>
                      <th className="p-2.5 text-center">Return Qty</th>
                      <th className="p-2.5 text-right">Unit Rate</th>
                      <th className="p-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {items.map((item: any, idx: number) => {
                      const qty = Number(item.quantity || 0);
                      const rate = Number(item.rate_per_unit || item.unit_price || item.rate || 0);
                      const lineTotal = Number(item.total_price || item.line_total || (qty * rate));
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2.5">
                            <div className="font-semibold text-slate-900">{item.name || item.item_name || 'Product'}</div>
                            {item.package_name && (
                              <div className="text-[11px] text-blue-600 flex items-center gap-1 mt-0.5">
                                <Package size={10} />
                                {item.package_name} {item.units_per_package ? `(${item.units_per_package} units/pack)` : ''}
                              </div>
                            )}
                            {item.batch_number && (
                              <div className="text-[10px] text-slate-500">
                                Batch: <span className="font-mono font-medium">{item.batch_number}</span>
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="font-bold text-slate-900">{formatNumber(qty)}</span>
                            <span className="text-[11px] text-slate-500 ml-1">{item.unit || 'units'}</span>
                          </td>
                          <td className="p-2.5 text-right font-medium text-slate-600">
                            {rate > 0 ? formatCurrency(rate, currency) : '-'}
                          </td>
                          <td className="p-2.5 text-right font-bold text-slate-900">
                            {lineTotal > 0 ? formatCurrency(lineTotal, currency) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {totalItemsValue > 0 && (
                    <tfoot className="bg-slate-50/80 border-t border-slate-200 font-bold">
                      <tr>
                        <td colSpan={3} className="p-2.5 text-right text-slate-600 uppercase text-[11px]">
                          Total Return Amount:
                        </td>
                        <td className="p-2.5 text-right text-slate-900">
                          {formatCurrency(totalItemsValue, currency)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>

          {/* ─── CHAT THREAD ─────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MessageCircle size={14} className="text-blue-600" />
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Chat Thread — ERP ↔ {isVendorReturn ? 'Vendor' : 'Customer'}
              </span>
              {detail.status === 'Pending' && (
                <span className="ml-auto text-[10px] text-slate-400 italic">Auto-refreshes every 4 sec</span>
              )}
            </div>
            <ChatPanel
              requestId={requestId}
              detail={detail}
              isVendorReturn={isVendorReturn}
            />
          </div>

          {/* Contact Info Card — shown once resolved */}
          {isResolved && (
            <ContactInfoCard detail={detail} isVendorReturn={isVendorReturn} />
          )}

          {/* Review, Resolution & Accounting Outcome Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <ReceiptText size={14} className="text-indigo-600" /> Resolution & Accounting Outcome
            </span>

            {detail.status === 'Approved' ? (
              <div className="space-y-2.5">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <strong className="text-emerald-900 block font-semibold">
                      Return Request Approved & Executed
                    </strong>
                    <p className="text-emerald-800">
                      Inventory has been restored/deducted in the inventory ledger, and accounting documents were automatically generated.
                    </p>
                  </div>
                </div>

                {/* Outcome Document Chip */}
                {(detail.outcome_document_number || detail.outcome_document_type) && (
                  <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                        Generated Document
                      </span>
                      <strong className="text-sm font-mono text-indigo-700 font-bold">
                        {detail.outcome_document_number || `${detail.outcome_document_type.replace('_', ' ').toUpperCase()}`}
                      </strong>
                    </div>
                    {detail.outcome_amount && (
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                          Document Value
                        </span>
                        <strong className="text-sm text-slate-900 font-bold">
                          {formatCurrency(detail.outcome_amount, currency)}
                        </strong>
                      </div>
                    )}
                  </div>
                )}

                {/* Audit details */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200 text-slate-600">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Approved By</span>
                    <span className="font-medium text-slate-800">{detail.reviewed_by_name || 'System Admin'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Review Date</span>
                    <span className="font-medium text-slate-800">{formatDate(detail.updated_at || detail.reviewed_at)}</span>
                  </div>
                </div>

                {detail.review_notes && (
                  <div className="text-xs p-2.5 bg-white border border-slate-200 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Approval Notes:</span>
                    <span className="text-slate-700">{detail.review_notes}</span>
                  </div>
                )}
              </div>
            ) : detail.status === 'Rejected' ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
                <div className="flex items-start gap-2.5 text-xs">
                  <XCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-red-900 block font-semibold">Return Request Rejected</strong>
                    <p className="text-red-800 mt-0.5">
                      {detail.review_notes || 'This request was reviewed and rejected by workspace management.'}
                    </p>
                  </div>
                </div>
                <div className="text-[11px] text-red-700 pt-1 border-t border-red-200/60">
                  Reviewed by: <strong>{detail.reviewed_by_name || 'Management'}</strong> on {formatDate(detail.updated_at)}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <Clock size={15} className="text-amber-600 shrink-0" />
                  <strong>Awaiting Management Review & Approval</strong>
                </div>
                <p className="mt-1 text-slate-600">
                  Approving this request will automatically reverse stock in the inventory ledger and generate a {isVendorReturn ? 'Debit Note' : 'Credit Note'}.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-slate-500">Record not found</div>
      )}
    </Drawer>
  );
}
