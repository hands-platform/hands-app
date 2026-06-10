import { PayoutBatchTable } from './payout-batch-table';

describe('PayoutBatchTable', () => {
  it('renders payout batch rows with finance actions and row anchors', () => {
    const table = PayoutBatchTable({
      rows: [
        {
          actionExecutionItems: [
            {
              action: 'Mark paid',
              operatorRule: 'Require transfer reference first.',
              pillClass: 'pill-warn',
              reason: 'Transfer reference missing.',
              status: 'Blocked',
            },
          ],
          actionMenuItems: [
            {
              description: 'Review before marking this payout paid.',
              href: '/payouts?confirm=paid&payoutBatchId=batch-123456',
              kind: 'link',
              label: 'Paid',
              tone: 'warning',
            },
          ],
          blockingActionSummary: 'Save transfer reference before paid.',
          blockingReasons: [
            {
              detail: 'Transfer reference is required.',
              label: 'Transfer ref',
              pillClass: 'pill-warn',
            },
          ],
          checklist: [
            {
              detail: 'Transfer reference exists.',
              label: 'Transfer ref',
              ok: false,
            },
          ],
          earningCount: 2,
          earningsHint: '2/2 linked to this batch',
          id: 'batch-123456',
          notes: 'Manual transfer',
          paidAtLabel: '-',
          paidAtRelativeLabel: 'Awaiting settlement',
          partnerChecksHref: '/partners/partner-1',
          partnerLabel: 'Partner One',
          partnerPhone: '+84900000000',
          payoutHold: true,
          paidBlockedByReleaseCheck: true,
          phase: 'Finance review',
          readinessSummary: 'Check transfer ref before advancing.',
          serviceEvidencePills: [
            {
              key: 'service-1',
              label: 'Foot Massage',
              value: '700.000 VND',
            },
          ],
          shortId: 'batch-123',
          statusLabel: 'Draft',
          totalAmountLabel: '900.000 VND',
          transferRef: '',
          taxLogCount: 1,
          updatedLabel: 'Updated just now',
          withholdingAmountLabel: '50.000 VND',
          opsHint: 'Review before processing.',
          opsSignal: 'Review',
          opsSignalClassName: 'signal signal-warn',
        },
      ],
      updateTransferRefAction: async () => undefined,
    });

    const resolvedTable = resolveElement(table);
    const rendered = textContent(resolvedTable);

    expect(readRecord(resolvedTable)?.type).toBe('table');
    expect(rendered).toContain('Partner One');
    expect(rendered).toContain('Payout action execution map');
    expect(rendered).toContain('Resolve blockers before paid');
    expect(rendered).toContain('Foot Massage');
    expect(rendered).toContain('700.000 VND');
    expect(hrefsIn(table)).toContain('/payouts?confirm=paid&payoutBatchId=batch-123456');
    expect(hrefsIn(table)).toContain('/partners/partner-1');
  });

  it('renders the empty state when there are no payout batches', () => {
    const table = PayoutBatchTable({
      rows: [],
      updateTransferRefAction: async () => undefined,
    });

    expect(textContent(table)).toContain('No payout batches loaded.');
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
