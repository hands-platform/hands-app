import { RefundsTableSection, type RefundTableRow } from './refunds-table-section';

describe('RefundsTableSection', () => {
  it('renders refund rows with links and action execution evidence', () => {
    const section = RefundsTableSection({
      emptyMessage: 'No refunds loaded.',
      rows: [buildRow()],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('ref-1');
    expect(rendered).toContain('Customer refund requested');
    expect(rendered).toContain('Refund action execution map');
    expect(rendered).toContain('Match payment ledger');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/bookings/booking-1', '/payments#payment-payment-1']));
  });

  it('renders empty state when no refunds exist', () => {
    const section = RefundsTableSection({
      emptyMessage: 'No refunds currently match this queue.',
      rows: [],
    });

    expect(textContent(section)).toContain('No refunds currently match this queue.');
  });
});

function buildRow(): RefundTableRow {
  return {
    amountLabel: '250000 VND',
    bookingHref: '/bookings/booking-1',
    bookingIdLabel: 'bookin',
    bookingStatus: 'REFUNDED',
    customerLabel: 'Customer One',
    executionRows: [
      {
        action: 'Match payment ledger',
        operatorRule: 'Do not close the refund case until payment ledger state and refund status match.',
        pillClass: 'pill-danger',
        reason: 'Refund status is REQUESTED, but payment status is CAPTURED.',
        status: 'Update needed',
      },
    ],
    id: 'refund-1',
    opsHint: 'Confirm the payment reversal path and notify the guest once the refund is complete.',
    opsSignal: <span>Customer refund requested</span>,
    partnerLabel: 'Partner One',
    paymentHref: '/payments#payment-payment-1',
    paymentLabel: 'CARD / CAPTURED',
    shortId: 'ref-1',
    status: 'REQUESTED',
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
