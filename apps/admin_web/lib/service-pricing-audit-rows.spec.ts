import type { AdminAuditLog } from './admin-api';
import { humanizeAuditAction, servicePricingAuditRows } from './service-pricing-audit-rows';

describe('service pricing audit rows', () => {
  it('filters pricing audit actions, sorts newest first, and builds display labels', () => {
    const rows = servicePricingAuditRows([
      auditLogFixture({
        action: 'customer.updated',
        createdAt: '2026-06-09T10:00:00.000Z',
        id: 'ignored',
      }),
      auditLogFixture({
        action: 'service.updated',
        actor: { fullName: 'Ops Lead', phone: '+8401' },
        createdAt: '2026-06-09T11:00:00.000Z',
        id: 'service-log',
        metadata: {
          after: { basePrice: 450000, name: 'Fallback service' },
          changedFields: ['basePrice', 42],
          service: { durationMin: 90, name: 'Foot Massage' },
        },
        target: 'service:1234567890abcdef',
      }),
      auditLogFixture({
        action: 'service_payout_rule.created',
        actor: { phone: '+8402' },
        createdAt: '2026-06-09T12:00:00.000Z',
        id: 'rule-log',
        metadata: {
          after: { currency: 'VND', customerPrice: 500000, providerPayoutAmount: 350000 },
          before: { providerPayoutAmount: 300000 },
        },
        target: 'service_payout_rule:abcdef1234567890',
      }),
    ]);

    expect(rows).toEqual([
      {
        action: 'service_payout_rule.created',
        actorName: '+8402',
        changedFields: ['created'],
        createdAt: '2026-06-09T12:00:00.000Z',
        id: 'rule-log',
        payoutLabel: 'Partner 350.000 VND',
        priceLabel: 'Customer 500.000 VND',
        serviceLabel: 'service_payout_rule:abcdef12',
        target: 'service_payout_rule:abcdef1234567890',
        targetShort: 'service_payout_rule:abcdef12',
      },
      {
        action: 'service.updated',
        actorName: 'Ops Lead',
        changedFields: ['basePrice'],
        createdAt: '2026-06-09T11:00:00.000Z',
        id: 'service-log',
        payoutLabel: 'No Partner payout snapshot',
        priceLabel: 'Base 450.000 VND',
        serviceLabel: 'Foot Massage / 90 min',
        target: 'service:1234567890abcdef',
        targetShort: 'service:12345678',
      },
    ]);
  });

  it('limits service pricing audit rows to the latest eight matching records', () => {
    const logs = Array.from({ length: 10 }, (_, index) =>
      auditLogFixture({
        action: 'service.updated',
        createdAt: `2026-06-09T${String(index).padStart(2, '0')}:00:00.000Z`,
        id: `log-${index}`,
      }),
    );

    expect(servicePricingAuditRows(logs).map((row) => row.id)).toEqual([
      'log-9',
      'log-8',
      'log-7',
      'log-6',
      'log-5',
      'log-4',
      'log-3',
      'log-2',
    ]);
  });

  it('humanizes dotted audit action names', () => {
    expect(humanizeAuditAction('service_payout_rule.created')).toBe('Service payout rule / Created');
  });
});

function auditLogFixture({
  action,
  actor,
  createdAt,
  id,
  metadata,
  target = 'service:target-id',
}: {
  readonly action: string;
  readonly actor?: AdminAuditLog['actor'];
  readonly createdAt: string;
  readonly id: string;
  readonly metadata?: unknown;
  readonly target?: string;
}): AdminAuditLog {
  return {
    action,
    actor,
    createdAt,
    id,
    metadata,
    target,
  };
}
