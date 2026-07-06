import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PaymentCallbackAttemptLedgerSection } from './payment-callback-attempt-ledger-section';

describe('PaymentCallbackAttemptLedgerSection', () => {
  it('renders callback attempt rows with gateway evidence', () => {
    const section = PaymentCallbackAttemptLedgerSection({
      rows: [
        {
          amount: 1000000,
          bookingHref: '/bookings/booking-1',
          createdAt: '2026-06-09T03:00:00.000Z',
          currency: 'VND',
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
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
        'table vuexy-data-table vuexy-booking-table admin-data-table',
      ]),
    );
  });

  it('renders empty state when no callback attempt rows exist', () => {
    const section = PaymentCallbackAttemptLedgerSection({ rows: [] });

    expect(textContent(section)).toContain('No callback attempts match this queue.');
  });

  it('does not duplicate the base pill class for callback outcome badges', () => {
    const section = PaymentCallbackAttemptLedgerSection({
      rows: [
        {
          amount: 1000000,
          bookingHref: '/bookings/booking-1',
          createdAt: '2026-06-09T03:00:00.000Z',
          currency: 'VND',
          errorMessage: null,
          gatewayTransactionId: 'gw-1',
          id: 'attempt-1',
          method: 'MOMO',
          outcome: 'ACCEPTED',
          paymentIdLabel: 'pay-1',
          paymentStatus: 'CAPTURED',
          pillClass: 'pill pill-success',
          providerRef: 'provider-1',
          providerStatus: '00',
          signatureLabel: 'Verified',
          verificationMode: 'hmac',
        },
      ],
    });

    expect(classNamesIn(section)).toContain('pill pill-success');
    expect(classNamesIn(section)).not.toContain('pill pill pill-success');
  });

  it('uses shared badge atoms for callback evidence labels', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/payments/payment-callback-attempt-ledger-section.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('AdminStageItem');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('className="setup-stage-item"');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className="pill pill-info">Signature</span>');
    expect(source).not.toContain('<span className="pill pill-neutral">Gateway</span>');
  });

  it('uses the shared DateTimeText atom for callback received timestamps', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/payments/payment-callback-attempt-ledger-section.tsx'),
      'utf8',
    );
    const modelSource = readFileSync(join(process.cwd(), 'app/payments/payment-page-model.ts'), 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('readonly createdAtLabel: string;');
    expect(source).not.toContain('<td>{row.createdAtLabel}</td>');
    expect(modelSource).not.toContain('createdAtLabel: formatDateTime(attempt.createdAt)');
  });

  it('uses the shared money atom for callback gateway amounts', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/payments/payment-callback-attempt-ledger-section.tsx'),
      'utf8',
    );

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('readonly amountLabel: string;');
    expect(source).not.toContain('Amount: {row.amountLabel}');
  });

  it('uses shared inline fallback atoms for callback absence labels', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/payments/payment-callback-attempt-ledger-section.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminInlineFallback');
    expect(source).not.toContain("<div className=\"muted\">{row.errorMessage ?? 'No processing error recorded.'}</div>");
    expect(source).not.toContain('<div className="muted">Gateway reference did not match a saved payment.</div>');
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
