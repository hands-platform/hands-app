import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import {
  FINANCE_OVERVIEW_STALE_MS,
  FinanceOverviewSnapshotControl,
  financeOverviewSnapshotIsStale,
} from './finance-overview-snapshot-control';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe('FinanceOverviewSnapshotControl', () => {
  it('marks the snapshot stale at exactly five minutes', () => {
    const generatedAt = '2026-08-08T00:00:00.000Z';
    const generatedAtMs = Date.parse(generatedAt);

    expect(financeOverviewSnapshotIsStale(generatedAt, generatedAtMs + FINANCE_OVERVIEW_STALE_MS - 1)).toBe(false);
    expect(financeOverviewSnapshotIsStale(generatedAt, generatedAtMs + FINANCE_OVERVIEW_STALE_MS)).toBe(true);
    expect(financeOverviewSnapshotIsStale('not-a-date', generatedAtMs)).toBe(true);
  });

  it('renders freshness, manual refresh, pending, and accessible announcement contracts', () => {
    const source = readFileSync(new URL('./finance-overview-snapshot-control.tsx', import.meta.url), 'utf8');
    const markup = renderToStaticMarkup(
      <FinanceOverviewSnapshotControl
        generatedAt={new Date(Date.now() - FINANCE_OVERVIEW_STALE_MS).toISOString()}
        scopeLabel="all-open"
      />,
    );

    expect(markup).toContain('Snapshot is over 5 minutes old');
    expect(markup).toContain('Refresh now');
    expect(markup).toContain('aria-label="Refresh Finance Overview"');
    expect(source).toContain(
      'window.setTimeout(() => setFreshnessNowMs(Date.now()), Math.max(0, remainingMs))',
    );
    expect(source).toContain('disabled={isPending}');
    expect(source).toContain('router.refresh()');
    expect(source).toContain('aria-live="polite"');
  });
});
