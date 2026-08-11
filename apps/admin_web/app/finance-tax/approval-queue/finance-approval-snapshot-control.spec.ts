import { readFileSync } from 'node:fs';

import {
  FINANCE_APPROVAL_SNAPSHOT_STALE_MS,
  financeApprovalSnapshotIsStale,
} from './finance-approval-snapshot-control';

describe('FinanceApprovalSnapshotControl', () => {
  it('marks the snapshot stale at the five-minute boundary', () => {
    const generatedAt = '2026-08-08T06:00:00.000Z';
    const generatedAtMs = Date.parse(generatedAt);

    expect(financeApprovalSnapshotIsStale(
      generatedAt,
      generatedAtMs + FINANCE_APPROVAL_SNAPSHOT_STALE_MS - 1,
    )).toBe(false);
    expect(financeApprovalSnapshotIsStale(
      generatedAt,
      generatedAtMs + FINANCE_APPROVAL_SNAPSHOT_STALE_MS,
    )).toBe(true);
    expect(financeApprovalSnapshotIsStale('', generatedAtMs)).toBe(true);
  });

  it('uses an explicit reload instead of claiming automatic polling', () => {
    const source = readFileSync(new URL('./finance-approval-snapshot-control.tsx', import.meta.url), 'utf8');

    expect(source).toContain('window.location.reload()');
    expect(source).not.toContain('setInterval');
    expect(source).not.toContain('Refreshes every');
  });

  it('returns focus to the exact approval row after a confirmation route closes', () => {
    const source = readFileSync(new URL('./finance-approval-snapshot-control.tsx', import.meta.url), 'utf8');

    expect(source).toContain("targetId.startsWith('approval-')");
    expect(source).toContain('target.focus({ preventScroll: true })');
    expect(source).toContain("target.scrollIntoView({ block: 'center' })");
  });

  it('keeps route loading copy inside the Finance Approval Queue context', () => {
    const source = readFileSync(new URL('./loading.tsx', import.meta.url), 'utf8');

    expect(source).toContain('Finance Approval Queue');
    expect(source).toContain('Loading Finance approvals');
    expect(source).not.toContain('Shift Command');
  });
});
