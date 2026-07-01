import { PaymentCallbackAttemptLedgerSection } from './payment-callback-attempt-ledger-section';

describe('PaymentCallbackAttemptLedgerSection', () => {
  it('renders callback attempt rows with gateway evidence', () => {
    const section = PaymentCallbackAttemptLedgerSection({
      rows: [
        {
          amountLabel: '1.000.000 VND',
          bookingHref: '/bookings/booking-1',
          createdAtLabel: '2026-06-09 10:00',
          errorMessage: null,
          gatewayTransactionId: 'gw-1',
          id: 'attempt-1',
          method: 'MOMO',
          outcome: 'ACCEPTED',
          paymentIdLabel: 'pay-1',
          paymentStatus: 'CAPTURED',
          pillClass: 'pill-success',
          providerRef: 'provider-1',
          providerStatus: '00',
          signatureLabel: 'Verified',
          verificationMode: 'hmac',
        },
      ],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Payment callback attempt ledger');
    expect(rendered).toContain('ACCEPTED');
    expect(rendered).toContain('provider-1');
    expect(rendered).toContain('Verified');
    expect(hrefsIn(section)).toContain('/bookings/booking-1');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group',
        'table vuexy-data-table vuexy-booking-table',
      ]),
    );
  });

  it('renders empty state when no callback attempt rows exist', () => {
    const section = PaymentCallbackAttemptLedgerSection({ rows: [] });

    expect(textContent(section)).toContain('No callback attempts match this queue.');
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
