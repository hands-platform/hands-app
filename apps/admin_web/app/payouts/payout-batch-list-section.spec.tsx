import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PayoutBatchListSection } from './payout-batch-list-section';

describe('PayoutBatchListSection', () => {
  it('renders the payout batch list toolbar and table', () => {
    const section = PayoutBatchListSection({
      rows: [
        {
          actionExecutionItems: [],
          actionMenuItems: [],
          blockingActionSummary: 'No blocking reason is preventing the next finance action.',
          blockingReasons: [],
          checklist: [],
          currency: 'VND',
          earningCount: 0,
          earningsHint: 'No earning linked to this batch',
          id: 'batch-1',
          notes: 'No transfer notes',
          opsHint: 'Ready for finance review.',
          opsSignal: 'Ready',
          opsSignalClassName: 'signal signal-ok',
          paidAt: null,
          paidAtRelativeLabel: 'Awaiting settlement',
          paidBlockedByReleaseCheck: false,
          partnerChecksHref: '/partners/partner-1',
          partnerLabel: 'Partner One',
          partnerPhone: '+84900000000',
          payoutHold: false,
          phase: 'Finance review',
          readinessSummary: 'Ready for next action.',
          serviceEvidencePills: [],
          shortId: 'batch-1',
          statusLabel: 'Draft',
          taxLogCount: 0,
          totalAmount: 900000,
          transferRef: '',
          updatedLabel: 'Updated just now',
          withholdingAmount: 0,
        },
      ],
      pagination: {
        from: 11,
        page: 2,
        pageSize: 10,
        rows: [],
        to: 20,
        totalPages: 3,
        totalRows: 25,
      },
      paginationHrefForPage: (page) => `/payouts?page=${page}`,
      updateTransferRefAction: async () => undefined,
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Partner settlement batches ordered');
    expect(rendered).toContain('Newest active first');
    expect(rendered).toContain('Partner One');
    expect(rendered).toMatch(/Showing\s+11\s+to\s+20\s+of\s+25\s+entries/);
    expect(hrefsIn(section)).toContain('/earnings');
    expect(hrefsIn(section)).toContain('/payouts?page=3');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
        'table vuexy-data-table vuexy-booking-table',
      ]),
    );
  });

  it('uses shared badge atoms for payout batch toolbar shortcuts', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/payout-batch-list-section.tsx'), 'utf8');

    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeLink');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('<span className="pill pill-success">Newest active first</span>');
    expect(source).not.toContain('<span className="pill pill-info">Payout record</span>');
    expect(source).not.toContain('<span className="pill pill-warn">Reconciliation</span>');
    expect(source).not.toContain('<a className="pill" href="/earnings">');
  });

  it('reuses the shared Admin table pagination footer atom', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/payout-batch-list-section.tsx'), 'utf8');

    expect(source).toContain('AdminTablePaginationFooter');
    expect(source).not.toContain('AdminRoundedPagination');
    expect(source).not.toContain('Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries');
  });
});

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

function classNamesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
