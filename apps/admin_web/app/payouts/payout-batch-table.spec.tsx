import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PayoutBatchTable, type PayoutBatchTableRow } from './payout-batch-table';

describe('PayoutBatchTable', () => {
  it('uses the shared Vuexy note panel for payout action execution maps', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/payout-batch-table.tsx'), 'utf8');

    expect(source).toContain('AdminNotePanel');
    expect(source).not.toContain('<div className="ops-task-note admin-mb-10">');
  });

  it('renders payout batch rows with finance actions and row anchors', () => {
    const table = PayoutBatchTable({
      rows: [
        buildPayoutBatchRow({
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
              amount: 700000,
              currency: 'VND',
              key: 'service-1',
              label: 'Foot Massage',
            },
          ],
          shortId: 'batch-123',
          statusLabel: 'Draft',
          totalAmount: 900000,
          transferRef: '',
          taxLogCount: 1,
          updatedLabel: 'Updated just now',
          withholdingAmount: 50000,
          opsHint: 'Review before processing.',
          opsSignal: 'Review',
          opsSignalClassName: 'signal signal-warn',
        }),
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
    expect(classNamesIn(table)).toEqual(
      expect.arrayContaining([
        'table vuexy-data-table vuexy-booking-table',
        'admin-form-input',
        'admin-form-control-button button button-primary',
      ]),
    );
  });

  it('renders settled payout rows with metadata save controls but no status action', () => {
    const table = PayoutBatchTable({
      rows: [
        buildPayoutBatchRow({
          actionExecutionItems: [
            {
              action: 'Mark paid',
              operatorRule: 'Already settled.',
              pillClass: 'pill-success',
              reason: 'The payout was already marked paid.',
              status: 'Complete',
            },
          ],
          actionMenuItems: [],
          blockingActionSummary: 'Historical transfer metadata can still be edited.',
          blockingReasons: [],
          checklist: [
            {
              detail: 'Bank transfer reference: BANK-PAID-1',
              label: 'Bank ref',
              ok: true,
            },
            {
              detail: 'Earnings moved to paid.',
              label: 'Earnings paid',
              ok: true,
            },
            {
              detail: 'Withholding tax logs were marked paid.',
              label: 'Tax paid',
              ok: true,
            },
            {
              detail: 'Paid timestamp is present.',
              label: 'Paid date',
              ok: true,
            },
          ],
          notes: 'Final settlement memo',
          paidAtLabel: 'Jun 11, 2026, 9:00 AM',
          paidAtRelativeLabel: 'Settled today',
          paidBlockedByReleaseCheck: false,
          payoutHold: false,
          phase: 'Settlement finished',
          readinessSummary: 'Settlement side effects are complete.',
          statusLabel: 'Paid',
          transferRef: 'BANK-PAID-1',
        }),
      ],
      updateTransferRefAction: async () => undefined,
    });

    const rendered = textContent(table);

    expect(rendered).toContain('Paid');
    expect(rendered).toContain('Settlement finished');
    expect(rendered).toContain('BANK-PAID-1');
    expect(rendered).toContain('Final settlement memo');
    expect(rendered).toContain('Earnings paid');
    expect(rendered).toContain('Tax paid');
    expect(rendered).toContain('Paid date');
    expect(rendered).toContain('No status action');
  });

  it('renders the empty state when there are no payout batches', () => {
    const table = PayoutBatchTable({
      rows: [],
      updateTransferRefAction: async () => undefined,
    });

    expect(textContent(table)).toContain('No payout batches loaded.');
  });

  it('does not duplicate the base pill class for blocking reason and action execution badges', () => {
    const table = PayoutBatchTable({
      rows: [
        buildPayoutBatchRow({
          actionExecutionItems: [
            {
              action: 'Mark paid',
              operatorRule: 'Require transfer reference first.',
              pillClass: 'pill pill-warn',
              reason: 'Transfer reference missing.',
              status: 'Blocked',
            },
          ],
          blockingReasons: [
            {
              detail: 'Transfer reference is required.',
              label: 'Transfer ref',
              pillClass: 'pill pill-danger',
            },
          ],
        }),
      ],
      updateTransferRefAction: async () => undefined,
    });

    const classNames = classNamesIn(table);

    expect(classNames).toContain('pill pill-warn');
    expect(classNames).toContain('pill pill-danger');
    expect(classNames).not.toContain('pill pill pill-warn');
    expect(classNames).not.toContain('pill pill pill-danger');
  });

  it('uses shared badge atoms for fixed payout table badges and links', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/payout-batch-table.tsx'), 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeLink');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className="pill pill-danger">Payout hold</span>');
    expect(source).not.toContain('<span className="pill pill-success">Clear</span>');
    expect(source).not.toContain('<span className="pill pill-info" key={`${row.id}-${item.key}`}>');
    expect(source).not.toContain("<span className={item.ok ? 'pill pill-success' : 'pill pill-warn'}");
    expect(source).not.toContain('<a className="pill pill-danger" href={row.partnerChecksHref}>');
    expect(source).not.toContain('<span className="pill pill-warn">Resolve blockers before paid</span>');
  });

  it('uses the shared money atom for payout batch amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/payout-batch-table.tsx'), 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('row.totalAmountLabel');
    expect(source).not.toContain('row.withholdingAmountLabel');
    expect(source).not.toContain('{item.label}: {item.value}');
  });

  it('allows action execution reasons to render shared money atoms', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/payout-batch-table.tsx'), 'utf8');

    expect(source).toContain('readonly reason: ReactNode');
  });
});

function buildPayoutBatchRow(overrides: Partial<PayoutBatchTableRow> = {}): PayoutBatchTableRow {
  return {
    actionExecutionItems: [],
    actionMenuItems: [],
    blockingActionSummary: 'No blockers.',
    blockingReasons: [],
    checklist: [],
    currency: 'VND',
    earningCount: 0,
    earningsHint: '0/0 linked to this batch',
    id: 'batch-123456',
    notes: '',
    paidAtLabel: '-',
    paidAtRelativeLabel: 'Awaiting settlement',
    partnerChecksHref: '/partners/partner-1',
    partnerLabel: 'Partner One',
    partnerPhone: '+84900000000',
    payoutHold: false,
    paidBlockedByReleaseCheck: false,
    phase: 'Finance review',
    readinessSummary: 'Ready for review.',
    serviceEvidencePills: [],
    shortId: 'batch-123',
    statusLabel: 'Draft',
    totalAmount: 0,
    transferRef: '',
    taxLogCount: 0,
    updatedLabel: 'Updated just now',
    withholdingAmount: 0,
    opsHint: 'Review before processing.',
    opsSignal: 'Review',
    opsSignalClassName: 'signal signal-warn',
    ...overrides,
  };
}

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
