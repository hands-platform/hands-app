import {
  adminAuditDefaultWhere,
  adminAuditAreaWhere,
  adminAuditActorTypeWhere,
  adminAuditEventReadModel,
  adminAuditOutcomeWhere,
  adminAuditSeverityWhere,
  adminAuditSavedViewWhere,
  classifyAdminAuditAction,
  classifyAdminAuditActorType,
} from './admin-audit-event-registry';

describe('admin audit event registry', () => {
  it.each([
    ['booking.completed', 'BOOKING', 'INFO', 'SUCCEEDED'],
    ['provider_bank_account.approved', 'MONEY', 'NOTICE', 'SUCCEEDED'],
    ['payment.failed', 'MONEY', 'REVIEW', 'FAILED'],
    ['referral_reward.credit', 'MONEY', 'NOTICE', 'SUCCEEDED'],
    ['admin_web.access_denied', 'SECURITY', 'REVIEW', 'DENIED'],
    ['admin.audit_export.failed', 'SECURITY', 'REVIEW', 'FAILED'],
    ['background_job.recurring_failure', 'SYSTEM', 'REVIEW', 'FAILED'],
    ['tax_policy.updated', 'POLICY', 'NOTICE', 'SUCCEEDED'],
  ])('assigns one canonical primary classification to %s', (action, area, severity, outcome) => {
    expect(classifyAdminAuditAction(action)).toEqual({ area, severity, outcome });
  });

  it('exposes unregistered event types as explicit unknown data quality', () => {
    expect(classifyAdminAuditAction('mystery.unmapped')).toEqual({
      area: 'UNKNOWN',
      outcome: 'RECORDED',
      severity: 'INFO',
    });
  });

  it('never attributes automatic background work to a human actor', () => {
    const event = adminAuditEventReadModel({
      action: 'background_job.recurring_failure',
      actor: { fullName: 'Master Admin', id: 'master-admin-1' },
      actorId: 'master-admin-1',
      createdAt: '2026-08-12T00:00:00.000Z',
      id: 'legacy-system-event',
      metadata: { source: 'background_job_recurring_incident' },
      target: 'background_job:notification-retry',
    });

    expect(event.actor).toMatchObject({
      attribution: 'LEGACY_INFERRED',
      id: null,
      key: 'background_job_recurring_incident',
      labelSnapshot: 'HANDS system',
      type: 'SYSTEM',
    });
    expect(classifyAdminAuditActorType(
      'background_job.recurring_failure',
      null,
      'background_job_recurring_incident',
      'master-admin-1',
    )).toBe('SYSTEM');
  });

  it('preserves stored actor snapshots and redacted payload bytes in the read model', () => {
    const payload = {
      before: { provider: 'legacy-provider-value' },
      changedFields: ['provider'],
      secret: '[REDACTED]',
    };
    const event = adminAuditEventReadModel({
      action: 'provider.update',
      actorId: 'operator-1',
      actorKey: 'admin:operator-1',
      actorLabelSnapshot: 'Original Operator Name',
      actorType: 'HUMAN',
      area: 'OPERATOR',
      createdAt: '2026-08-12T00:00:00.000Z',
      id: 'event-1',
      metadata: payload,
      objectId: 'provider-1',
      objectLabelSnapshot: 'Partner at event time',
      objectType: 'provider',
      outcome: 'SUCCEEDED',
      payloadHash: 'hash-1',
      schemaVersion: 2,
      severity: 'NOTICE',
      target: 'provider:provider-1',
    });

    expect(event.actor.labelSnapshot).toBe('Original Operator Name');
    expect(event.object.labelSnapshot).toBe('Partner at event time');
    expect(event.payload).toBe(payload);
    expect(JSON.stringify(event.payload)).toBe(JSON.stringify(payload));
    expect(event.integrity).toBe('HASHED');
  });

  it('treats stored schema v2 classification as canonical, including explicit unknown values', () => {
    const event = adminAuditEventReadModel({
      action: 'payment.failed',
      actorId: 'operator-1',
      actorType: 'UNKNOWN',
      area: 'UNKNOWN',
      createdAt: '2026-08-12T00:00:00.000Z',
      id: 'event-v2-unknown',
      outcome: 'UNKNOWN',
      schemaVersion: 2,
      severity: 'INFO',
      target: 'payment:payment-1',
    });

    expect(event).toMatchObject({
      actor: { type: 'UNKNOWN' },
      area: 'UNKNOWN',
      outcome: 'UNKNOWN',
      severity: 'INFO',
    });
  });

  it('uses stored schema v2 fields and action inference only for legacy filter predicates', () => {
    for (const where of [
      adminAuditAreaWhere('UNKNOWN'),
      adminAuditSeverityWhere('INFO'),
      adminAuditOutcomeWhere('UNKNOWN'),
      adminAuditActorTypeWhere('UNKNOWN'),
    ]) {
      expect(where).toMatchObject({
        OR: [
          { AND: [{ schemaVersion: { gte: 2 } }, expect.any(Object)] },
          { AND: [{ schemaVersion: { lt: 2 } }, expect.any(Object)] },
        ],
      });
    }
  });

  it('registers finance approver governance actions explicitly', () => {
    expect(classifyAdminAuditAction('admin_user.finance_approver.requested')).toEqual({
      area: 'SECURITY', outcome: 'OPENED', severity: 'NOTICE',
    });
    expect(classifyAdminAuditAction('admin_user.finance_approver.blocked')).toEqual({
      area: 'SECURITY', outcome: 'DENIED', severity: 'REVIEW',
    });
    expect(classifyAdminAuditAction('admin_user.finance_approver.grant')).toEqual({
      area: 'SECURITY', outcome: 'SUCCEEDED', severity: 'NOTICE',
    });
  });

  it('omits payload from list projections while retaining normalized summaries', () => {
    const event = adminAuditEventReadModel({
      action: 'booking.completed',
      actorId: 'operator-1',
      createdAt: '2026-08-12T00:00:00.000Z',
      id: 'event-1',
      metadata: { changedFields: ['status'], status: 'COMPLETED' },
      target: 'booking:booking-1',
    }, { includePayload: false });

    expect(event.payload).toBeNull();
    expect(event.changeSummary).toBe('Changed status');
  });

  it('excludes legacy page telemetry from all operational views', () => {
    expect(adminAuditDefaultWhere(null)).toEqual({ NOT: { action: 'admin_web.page_view' } });
    expect(adminAuditSavedViewWhere('ALL')).toEqual({ NOT: { action: 'admin_web.page_view' } });
    expect(adminAuditDefaultWhere('LEGACY_TELEMETRY')).toEqual({ action: 'admin_web.page_view' });
  });
});
