import { PaymentDetailActionMapSection } from './payment-detail-action-map-section';

describe('PaymentDetailActionMapSection', () => {
  it('renders action rows, confirmation content, and menu actions', () => {
    const section = PaymentDetailActionMapSection({
      actionLabel: 'Payment detail actions for paymen',
      actions: [
        {
          href: '/payments/payment-1?confirm=sync&paymentId=payment-1',
          kind: 'link',
          label: 'Sync gateway',
          tone: 'info',
        },
      ],
      cashDebtSettlementForm: <form aria-label="Cash fee settlement form" />,
      confirmation: <div>Confirm capture before running it.</div>,
      hasBlockingReview: true,
      rows: [
        {
          action: 'Capture',
          operatorRule: 'Capture only after completed service evidence and payment ledger review.',
          pillClass: 'pill-warn',
          reason: 'Service is completed and authorization hold is active.',
          status: 'Review capture',
        },
      ],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Payment action execution map');
    expect(rendered).toContain('Review needed');
    expect(rendered).toContain('Confirm capture before running it.');
    expect(rendered).toContain('Capture only after completed service evidence');
    expect(hrefsIn(section)).toContain('/payments/payment-1?confirm=sync&paymentId=payment-1');
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
