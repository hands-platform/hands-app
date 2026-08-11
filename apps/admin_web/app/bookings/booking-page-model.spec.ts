import type { AdminAuditLog } from '../../lib/admin-api';
import { buildBookingsPageModel } from './booking-page-model';

describe('buildBookingsPageModel', () => {
  it('normalizes initial monitor params and keeps only booking create rejections', () => {
    const model = buildBookingsPageModel({
      auditLogs: [
        auditLogFixture({ action: 'booking.create.rejected', id: 'rejected-1' }),
        auditLogFixture({ action: 'booking.created', id: 'created-1' }),
      ],
      params: {
        evidence: 'alerts',
        gate: 'service-area',
        view: 'backup',
      },
      policySettings: [],
    });

    expect(model.bookingCreateRejections.map((log) => log.id)).toEqual(['rejected-1']);
    expect(model.initialEvidenceFilter).toBe('alerts');
    expect(model.initialGateFilter).toBe('service-area');
    expect(model.initialView).toBe('marketplace');
  });

  it('falls back to the live operations monitor when params are missing', () => {
    const model = buildBookingsPageModel({
      auditLogs: [],
      params: undefined,
      policySettings: [],
    });

    expect(model.bookingCreateRejections).toEqual([]);
    expect(model.initialEvidenceFilter).toBe('all');
    expect(model.initialGateFilter).toBe('all');
    expect(model.initialView).toBe('attention');
    expect(model.liveOperationsPolicy).toBeTruthy();
  });
});

function auditLogFixture(input: { readonly action: string; readonly id: string }): AdminAuditLog {
  return {
    action: input.action,
    createdAt: '2026-06-01T10:00:00.000Z',
    id: input.id,
    target: 'booking:test',
  };
}
