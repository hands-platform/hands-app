'use client';

import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

import { AdminFormControlButton } from '../../../components/admin-form-controls';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge } from '../../../components/status-badge';

export const FINANCE_APPROVAL_SNAPSHOT_STALE_MS = 5 * 60_000;

export function financeApprovalSnapshotIsStale(generatedAt: string, nowMs = Date.now()) {
  const generatedAtMs = Date.parse(generatedAt);
  return !Number.isFinite(generatedAtMs) || nowMs - generatedAtMs >= FINANCE_APPROVAL_SNAPSHOT_STALE_MS;
}

export function FinanceApprovalSnapshotControl({ generatedAt }: { readonly generatedAt: string }) {
  const [isPending, setIsPending] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState('');
  const isStale = financeApprovalSnapshotIsStale(generatedAt, nowMs);

  useEffect(() => {
    const generatedAtMs = Date.parse(generatedAt);
    if (!Number.isFinite(generatedAtMs)) return;
    const remainingMs = FINANCE_APPROVAL_SNAPSHOT_STALE_MS - (Date.now() - generatedAtMs);
    const timeoutId = window.setTimeout(() => setNowMs(Date.now()), Math.max(0, remainingMs));
    return () => window.clearTimeout(timeoutId);
  }, [generatedAt]);

  useEffect(() => {
    const targetId = decodeURIComponent(window.location.hash.slice(1));
    if (!targetId.startsWith('approval-')) return;
    const target = document.getElementById(targetId);
    if (!target) return;
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <div aria-label="Approval queue snapshot" className="finance-approval-snapshot-control" role="group">
      <StatusBadge tone={isStale ? 'warning' : 'info'}>
        {isStale ? 'Snapshot stale' : 'Snapshot current'}
      </StatusBadge>
      <span>
        Snapshot updated <DateTimeText value={generatedAt} />
      </span>
      <AdminFormControlButton
        aria-label="Refresh Finance Approval Queue"
        className="button-secondary"
        disabled={isPending}
        onClick={() => {
          setAnnouncement('Refreshing Finance Approval Queue.');
          setIsPending(true);
          window.location.reload();
        }}
        type="button"
      >
        <RefreshCw aria-hidden="true" className={isPending ? 'is-spinning' : undefined} size={16} />
        {isPending ? 'Refreshing' : 'Refresh now'}
      </AdminFormControlButton>
      <span aria-live="polite" className="sr-only" role="status">
        {announcement}
      </span>
    </div>
  );
}
