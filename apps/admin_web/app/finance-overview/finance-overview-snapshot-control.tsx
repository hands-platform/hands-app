'use client';

import { RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { AdminFormControlButton } from '../../components/admin-form-controls';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge } from '../../components/status-badge';

export const FINANCE_OVERVIEW_STALE_MS = 5 * 60_000;

export function financeOverviewSnapshotIsStale(generatedAt: string, nowMs = Date.now()) {
  const generatedAtMs = Date.parse(generatedAt);
  return !Number.isFinite(generatedAtMs) || nowMs - generatedAtMs >= FINANCE_OVERVIEW_STALE_MS;
}

export function FinanceOverviewSnapshotControl({
  generatedAt,
  scopeLabel,
}: {
  readonly generatedAt: string;
  readonly scopeLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [freshnessNowMs, setFreshnessNowMs] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState('');
  const previousGeneratedAt = useRef(generatedAt);
  const isStale = financeOverviewSnapshotIsStale(generatedAt, freshnessNowMs);

  useEffect(() => {
    const generatedAtMs = Date.parse(generatedAt);
    if (!Number.isFinite(generatedAtMs)) return;

    const remainingMs = FINANCE_OVERVIEW_STALE_MS - (Date.now() - generatedAtMs);
    const timeoutId = window.setTimeout(() => setFreshnessNowMs(Date.now()), Math.max(0, remainingMs));
    return () => window.clearTimeout(timeoutId);
  }, [generatedAt]);

  useEffect(() => {
    if (previousGeneratedAt.current !== generatedAt) {
      previousGeneratedAt.current = generatedAt;
      setAnnouncement('Finance snapshot refreshed.');
    }
  }, [generatedAt]);

  return (
    <div aria-label="Finance snapshot status" className="finance-overview-snapshot-control" role="group">
      <StatusBadge tone={isStale ? 'warning' : 'info'}>{scopeLabel}</StatusBadge>
      <span className="finance-overview-generated-at">
        Generated <DateTimeText value={generatedAt} />
      </span>
      <span className={`finance-overview-freshness${isStale ? ' is-stale' : ''}`}>
        {isStale ? 'Snapshot is over 5 minutes old' : 'Snapshot is current'}
      </span>
      <AdminFormControlButton
        aria-label="Refresh Finance Overview"
        className="button-secondary finance-overview-refresh-button"
        disabled={isPending}
        onClick={() => {
          setAnnouncement('Refreshing Finance snapshot.');
          startTransition(() => router.refresh());
        }}
        type="button"
      >
        <RefreshCw
          aria-hidden="true"
          className={isPending ? 'finance-overview-refresh-icon is-spinning' : 'finance-overview-refresh-icon'}
          size={16}
        />
        {isPending ? 'Refreshing' : 'Refresh now'}
      </AdminFormControlButton>
      <span aria-live="polite" className="sr-only" role="status">
        {announcement}
      </span>
    </div>
  );
}
