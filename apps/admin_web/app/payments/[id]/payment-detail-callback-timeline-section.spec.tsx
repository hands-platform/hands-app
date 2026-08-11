import { readFileSync } from 'node:fs';

import { PaymentDetailCallbackTimelineSection } from './payment-detail-callback-timeline-section';

describe('PaymentDetailCallbackTimelineSection', () => {
  it('uses shared Vuexy status badge atoms for callback labels', () => {
    const source = readFileSync('app/payments/[id]/payment-detail-callback-timeline-section.tsx', 'utf8');

    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('PillClassBadge');
  });

  it('uses the shared date time atom for received callback timestamps', () => {
    const source = readFileSync('app/payments/[id]/payment-detail-callback-timeline-section.tsx', 'utf8');
    const pageSource = readFileSync('app/payments/[id]/page.tsx', 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('readonly createdAtLabel: string;');
    expect(source).not.toContain('<td>{row.createdAtLabel}</td>');
    expect(pageSource).not.toContain('createdAtLabel: formatDate(attempt.createdAt)');
  });

  it('uses the shared money atom for callback gateway amounts', () => {
    const source = readFileSync('app/payments/[id]/payment-detail-callback-timeline-section.tsx', 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('readonly amountLabel: string;');
    expect(source).not.toContain('Amount: {row.amountLabel}');
  });

  it('renders callback rows with gateway and payload evidence', () => {
    const section = PaymentDetailCallbackTimelineSection({
      reviewCount: 1,
      rows: [
        {
          amount: 1000000,
          createdAt: '2026-06-09T03:00:00.000Z',
          currency: 'VND',
          errorCodeLabel: 'SIG_MISMATCH',
          errorMessage: 'Signature did not match.',
          id: 'attempt-1',
          outcome: 'CONFLICT',
          payloadDetails: <details>4 key(s)</details>,
          pillClass: 'pill-danger',
          providerRef: 'gateway-ref-1',
          providerStatus: '99',
          signatureLabel: 'not verified',
          verificationMode: 'hmac',
        },
      ],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Gateway callback attempt timeline');
    expect(rendered).toContain('1 review');
    expect(rendered).toContain('gateway-ref-1');
    expect(rendered).toContain('SIG_MISMATCH');
    expect(rendered).toContain('4 key(s)');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
        'table vuexy-data-table vuexy-booking-table admin-data-table',
      ]),
    );
  });

  it('renders empty state when no callbacks exist', () => {
    const section = PaymentDetailCallbackTimelineSection({ reviewCount: 0, rows: [] });

    expect(textContent(section)).toContain('No gateway callback attempts have been captured for this payment yet.');
    expect(textContent(section)).toContain('No callback attempts recorded');
    expect(textContent(section)).not.toContain('Trace ready');
  });

  it('does not duplicate the base pill class for detail callback badges', () => {
    const section = PaymentDetailCallbackTimelineSection({
      reviewCount: 1,
      rows: [
        {
          amount: 1000000,
          createdAt: '2026-06-09T03:00:00.000Z',
          currency: 'VND',
          errorCodeLabel: 'SIG_MISMATCH',
          errorMessage: 'Signature did not match.',
          id: 'attempt-1',
          outcome: 'CONFLICT',
          payloadDetails: <details>4 key(s)</details>,
          pillClass: 'pill pill-danger',
          providerRef: 'gateway-ref-1',
          providerStatus: '99',
          signatureLabel: 'not verified',
          verificationMode: 'hmac',
        },
      ],
    });

    expect(classNamesIn(section)).toContain('pill pill-danger');
    expect(classNamesIn(section)).not.toContain('pill pill pill-danger');
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
