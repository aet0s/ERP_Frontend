import { useEffect, useState } from 'react';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context';
import { Button } from './Button';

export function ReadOnlyBanner() {
  const toast = useToast();
  const [billing, setBilling] = useState<any>(null);

  useEffect(() => {
    let active = true;
    if (window.location.pathname.startsWith('/portal')) return;
    api.get('/api/billing').then((res) => {
      if (active && res.data) setBilling(res.data);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (window.location.pathname.startsWith('/portal') || !billing || !billing.is_read_only) return null;

  const handleUpgrade = async () => {
    try {
      const res = await api.post('/api/billing/checkout', { plan: 'pro' });
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Unable to launch checkout', 'error');
    }
  };

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-amber-800 dark:text-amber-300 flex flex-wrap items-center justify-between gap-3 text-xs font-medium">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber-600 shrink-0" />
        <span>
          <strong>Workspace Read-Only Mode:</strong> Your trial or subscription has expired. Creating/updating records is currently paused. Existing data remains safe and readable.
        </span>
      </div>
      <Button
        className="bg-amber-600 hover:bg-amber-700 text-white text-xs py-1 px-3"
        icon={<CreditCard size={14} />}
        onClick={handleUpgrade}
      >
        Upgrade Plan Now
      </Button>
    </div>
  );
}
