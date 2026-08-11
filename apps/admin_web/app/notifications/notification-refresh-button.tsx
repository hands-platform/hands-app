'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { AdminFormControlButton } from '../../components/admin-form-controls';
import { StatusBadge } from '../../components/status-badge';

export function NotificationRefreshButton({ generatedLabel }: { readonly generatedLabel: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  return (
    <div className="notification-refresh-control">
      <StatusBadge tone="neutral">Generated {generatedLabel}</StatusBadge>
      <AdminFormControlButton
        className="button-secondary notification-refresh-button"
        disabled={pending}
        onClick={() => startTransition(() => {
          router.refresh();
          setRefreshedAt(new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(new Date()));
        })}
        type="button"
      >
        <RefreshCw aria-hidden="true" size={16} />
        {pending ? 'Refreshing' : 'Refresh now'}
      </AdminFormControlButton>
      <span aria-live="polite" className="muted notification-refresh-status" role="status">
        {refreshedAt ? `Refreshed ${refreshedAt}` : ''}
      </span>
    </div>
  );
}
