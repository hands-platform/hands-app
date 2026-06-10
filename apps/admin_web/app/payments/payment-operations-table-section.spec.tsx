import { PaymentOperationsTableSection, type PaymentOperationsTableRow } from './payment-operations-table-section';

describe('PaymentOperationsTableSection', () => {
  it('renders payment rows with operation evidence and action links', () => {
    const section = PaymentOperationsTableSection({
      emptyMessage: 'No payments loaded.',
      rows: [buildRow()],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('payment-1');
    expect(rendered).toContain('AUTHORIZED');
    expect(rendered).toContain('Capture after service');
    expect(rendered).toContain('Payment action execution map');
    expect(rendered).toContain('Gateway callback evidence');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/bookings/booking-1', '/earnings#earning-1', '/refunds#refund-1']));
  });

  it('renders the empty state when there are no payment rows', () => {
    const section = PaymentOperationsTableSection({
      emptyMessage: 'No payments currently match this queue.',
      rows: [],
    });

    expect(textContent(section)).toContain('No payments currently match this queue.');
  });
});

function buildRow(): PaymentOperationsTableRow {
  return {
    actionLabel: 'Payment actions for paymen',
    actions: [
      {
        href: '/payments/payment-1',
        kind: 'link',
        label: 'Open detail',
        tone: 'info',
      },
    ],
    amountLabel: '100000 VND',
    bookingHref: '/bookings/booking-1',
    bookingIdLabel: 'bookin',
    bookingStatus: 'COMPLETED',
    callbackEvidence: <div>Gateway callback evidence</div>,
    cashDebtLabel: 'Cash fee debt 10.000 VND',
    cashDebtSettlementForm: <form aria-label="Cash debt settlement form" />,
    customerPhone: '+84900000000',
    earningHref: '/earnings#earning-1',
    executionRows: [
      {
        action: 'Capture',
        operatorRule: 'Capture only after completed service evidence and payment ledger review.',
        pillClass: 'pill-warn',
        reason: 'The service is completed and the authorization hold is still active.',
        status: 'Review capture',
      },
    ],
    id: 'payment-1',
    method: 'CARD',
    opsHint: 'Keep this on hold until the partner completes the service, then capture or refund.',
    opsSignal: <span>Capture after service</span>,
    providerRef: 'provider-ref-1',
    recordDateLabel: 'Record date 2026-06-09 10:00',
    refundHref: '/refunds#refund-1',
    stateLabel: 'Hold placed, waiting for service completion.',
    status: 'AUTHORIZED',
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
