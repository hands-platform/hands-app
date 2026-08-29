import { readFileSync } from 'node:fs';

import { formatDateTime } from '../../../lib/admin-format';
import { PaymentDetailActionMapSection } from './payment-detail-action-map-section';

describe('PaymentDetailActionMapSection', () => {
  it('renders the current decision, states, evidence, and policy verification first', () => {
    const section = PaymentDetailActionMapSection({
      actionLabel: 'Payment detail actions for payment-1',
      actions: [
        { href: '/payments/payment-1?confirm=capture', kind: 'link', label: 'Capture payment', tone: 'warning' },
      ],
      bookingStatus: 'COMPLETED',
      cashDebtSettlementForm: null,
      confirmation: <div>Confirm capture against current evidence.</div>,
      decisions: [decision()],
      evidence: {
        label: 'Verified callback',
        reason: 'Signature and amount match.',
        state: 'VERIFIED',
        verifiedAt: '2026-08-09T02:00:00.000Z',
      },
      evaluatedAt: '2026-08-09T03:00:00.000Z',
      paymentStatus: 'AUTHORIZED',
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Payment decision');
    expect(rendered).toContain('Next safe action Capture payment');
    expect(rendered).toContain('Current state AUTHORIZED Booking: COMPLETED');
    expect(rendered).toContain('Payment evidence Verified callback Signature and amount match.');
    expect(rendered).toContain('Policy check admin-payment-actions-v1');
    expect(rendered).toContain(`Evidence verified ${formatDateTime('2026-08-09T02:00:00.000Z')}`);
    expect(rendered).toContain(`Policy evaluated ${formatDateTime('2026-08-09T03:00:00.000Z')}`);
    expect(rendered).toContain('Confirm capture against current evidence.');
  });

  it('fails closed when the API returns no action decisions', () => {
    const section = PaymentDetailActionMapSection({
      actionLabel: 'Payment detail actions',
      actions: [],
      bookingStatus: 'CANCELLED',
      cashDebtSettlementForm: null,
      confirmation: null,
      decisions: [],
      evidence: undefined,
      evaluatedAt: null,
      paymentStatus: 'AUTHORIZED',
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('No executable action');
    expect(rendered).toContain('No action decision returned');
    expect(rendered).toContain('Do not execute a payment action');
    expect(rendered).toContain('Evidence verified Not recorded');
    expect(rendered).toContain('Policy evaluated Not recorded');
    expect(rendered).not.toContain('No urgent block');
  });

  it('uses shared panel, badge, detail, menu, and date components', () => {
    const source = readFileSync('app/payments/[id]/payment-detail-action-map-section.tsx', 'utf8');

    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('AdminDetails');
    expect(source).toContain('ActionMenu');
    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('Payment action execution map');
  });
});

function decision() {
  return {
    action: 'CAPTURE' as const,
    policyVersion: 'admin-payment-actions-v1',
    reason: 'Completed booking and verified callback support capture.',
    reasonCode: 'CAPTURE_AVAILABLE',
    recommended: true,
    requiredEvidence: ['verified callback'],
    state: 'AVAILABLE' as const,
    verifiedAt: '2026-08-09T02:00:00.000Z',
  };
}

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textContent).join(' ');
  return textContent(readRecord(readRecord(value)?.props)?.children);
}

function normalizedText(value: unknown) {
  return textContent(value).replace(/\s+/g, ' ').trim();
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
