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
          earningCount: 0,
          earningsHint: 'No earning linked to this batch',
          id: 'batch-1',
          notes: 'No transfer notes',
          opsHint: 'Ready for finance review.',
          opsSignal: 'Ready',
          opsSignalClassName: 'signal signal-ok',
          paidAtLabel: '-',
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
          totalAmountLabel: '900.000 VND',
          transferRef: '',
          updatedLabel: 'Updated just now',
          withholdingAmountLabel: '0 VND',
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

    expect(section.type).toBe('div');
    expect(rendered).toContain('Partner settlement batches ordered');
    expect(rendered).toContain('Newest active first');
    expect(rendered).toContain('Partner One');
    expect(rendered).toMatch(/Showing\s+11\s+to\s+20\s+of\s+25\s+entries/);
    expect(hrefsIn(section)).toContain('/earnings');
    expect(hrefsIn(section)).toContain('/payouts?page=3');
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
