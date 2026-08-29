import { ConflictException } from '@nestjs/common';
import {
  NotificationDeliveryIncidentResolutionCode,
  NotificationDeliveryIncidentState,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import {
  assignNotificationDeliveryIncident,
  notificationDeliveryIncidentAllGroupEvidenceSql,
  notificationDeliveryIncidentFailureEvidenceSql,
  notificationDeliveryIncidentSourceKey,
  openNotificationDeliveryIncident,
  reopenNotificationDeliveryIncident,
  resolveNotificationDeliveryIncident,
  syncNotificationDeliveryIncidents,
} from './admin-notification-delivery-incident';

describe('notification delivery incident lifecycle', () => {
  it('opens one persistent occurrence with bounded evidence and an audit event', async () => {
    const prisma = prismaFixture({ latest: null });
    const result = await openNotificationDeliveryIncident(prisma as never, 'admin-1', {
      dataScope: 'production',
      provider: 'fcm',
      failureCode: 'UNREGISTERED',
      reason: 'Platform owner starts investigation.',
    });

    expect(result.state).toBe(NotificationDeliveryIncidentState.OPEN);
    expect(prisma.notificationDeliveryIncident.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        occurrence: 1,
        provider: 'FCM',
        sourceKey: 'delivery-failure:v1:production:FCM:UNREGISTERED',
      }),
    }));
    expect(prisma.notificationDeliveryIncidentMember.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ deliveryId: 'delivery-1', notificationId: 'notification-1' })],
      skipDuplicates: true,
    });
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'notification_delivery_incident.opened',
        actorId: 'admin-1',
        target: 'notification_delivery_incident:incident-1',
      }),
    });
  });

  it('verifies an existing open occurrence instead of creating a duplicate', async () => {
    const latest = incident({ revision: 4 });
    const prisma = prismaFixture({ latest });
    prisma.notificationDeliveryIncident.update.mockResolvedValue(incident({ revision: 5 }));

    await openNotificationDeliveryIncident(prisma as never, 'admin-1', {
      dataScope: 'production', provider: 'FCM', failureCode: 'UNREGISTERED',
      reason: 'Platform owner verifies current evidence.',
    });

    expect(prisma.notificationDeliveryIncident.create).not.toHaveBeenCalled();
    expect(prisma.notificationDeliveryIncident.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'incident-1' },
      data: expect.objectContaining({ revision: { increment: 1 } }),
    }));
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'notification_delivery_incident.verified' }),
    });
  });

  it('does not create a new occurrence without a failure after the prior resolution', async () => {
    const prisma = prismaFixture({
      latest: incident({
        state: NotificationDeliveryIncidentState.RESOLVED,
        resolvedAt: new Date('2026-08-28T00:00:00.000Z'),
        resolutionCode: NotificationDeliveryIncidentResolutionCode.PROVIDER_RECOVERED,
      }),
    });

    await expect(openNotificationDeliveryIncident(prisma as never, 'admin-1', {
      dataScope: 'production', provider: 'FCM', failureCode: 'UNREGISTERED',
      reason: 'Platform owner checks for a new occurrence.',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a new occurrence only from evidence observed after resolution', async () => {
    const prisma = prismaFixture({
      latest: incident({
        state: NotificationDeliveryIncidentState.RESOLVED,
        resolvedAt: new Date('2026-08-27T08:30:00.000Z'),
        resolutionCode: NotificationDeliveryIncidentResolutionCode.PROVIDER_RECOVERED,
      }),
    });
    prisma.$queryRaw.mockReset()
      .mockResolvedValueOnce([failureEvidence('2026-08-27T08:00:00.000Z')])
      .mockResolvedValueOnce([failureEvidence('2026-08-27T09:15:00.000Z')]);

    await openNotificationDeliveryIncident(prisma as never, 'admin-1', {
      dataScope: 'production', provider: 'FCM', failureCode: 'UNREGISTERED',
      reason: 'A new provider failure requires another occurrence.',
    });

    expect(prisma.notificationDeliveryIncident.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        firstObservedAt: new Date('2026-08-27T09:15:00.000Z'),
        lastObservedAt: new Date('2026-08-27T09:15:00.000Z'),
        occurrence: 2,
      }),
    }));
  });

  it('assigns with optimistic revision and rejects stale updates', async () => {
    const prisma = prismaFixture({ latest: null });
    prisma.notificationDeliveryIncident.findUnique.mockResolvedValue(incident());
    prisma.user.findUnique.mockResolvedValue({ roles: ['ADMIN'] });
    prisma.notificationDeliveryIncident.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.notificationDeliveryIncident.findUniqueOrThrow.mockResolvedValue(
      incident({ ownerAdminId: 'admin-2', revision: 2, state: NotificationDeliveryIncidentState.INVESTIGATING }),
    );
    await assignNotificationDeliveryIncident(prisma as never, 'admin-1', 'incident-1', {
      assigneeAdminId: 'admin-2', expectedRevision: 1,
      reason: 'Assign to the on-call Platform operator.',
    });
    expect(prisma.notificationDeliveryIncident.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'incident-1', revision: 1 }),
    }));

    prisma.notificationDeliveryIncident.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(assignNotificationDeliveryIncident(prisma as never, 'admin-1', 'incident-1', {
      assigneeAdminId: 'admin-2', expectedRevision: 1,
      reason: 'Assign to the on-call Platform operator.',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('resolves and explicitly reopens while preserving separate audit actions', async () => {
    const prisma = prismaFixture({ latest: null });
    prisma.notificationDeliveryIncident.findUnique
      .mockResolvedValueOnce(incident())
      .mockResolvedValueOnce(incident({
        revision: 2,
        state: NotificationDeliveryIncidentState.RESOLVED,
        resolvedAt: new Date('2026-08-27T10:00:00.000Z'),
        resolutionCode: NotificationDeliveryIncidentResolutionCode.CONFIGURATION_FIXED,
      }));
    prisma.notificationDeliveryIncident.updateMany.mockResolvedValue({ count: 1 });
    prisma.notificationDeliveryIncident.findUniqueOrThrow
      .mockResolvedValueOnce(incident({
        revision: 2,
        state: NotificationDeliveryIncidentState.RESOLVED,
        resolvedAt: new Date('2026-08-27T10:00:00.000Z'),
        resolutionCode: NotificationDeliveryIncidentResolutionCode.CONFIGURATION_FIXED,
      }))
      .mockResolvedValueOnce(incident({
        ownerAdminId: 'admin-1', revision: 3, state: NotificationDeliveryIncidentState.INVESTIGATING,
      }));

    await resolveNotificationDeliveryIncident(prisma as never, 'admin-1', 'incident-1', {
      expectedRevision: 1,
      reason: 'FCM configuration was corrected and verified.',
      resolutionCode: NotificationDeliveryIncidentResolutionCode.CONFIGURATION_FIXED,
    });
    await reopenNotificationDeliveryIncident(prisma as never, 'admin-1', 'incident-1', {
      expectedRevision: 2,
      reason: 'New evidence requires another investigation.',
    });

    expect(prisma.adminAuditLog.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ action: 'notification_delivery_incident.resolved' }),
    });
    expect(prisma.adminAuditLog.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ action: 'notification_delivery_incident.reopened' }),
    });
  });

  it('uses encoded versioned source keys so delimiter values cannot collide', () => {
    expect(notificationDeliveryIncidentSourceKey({
      dataScope: 'unknown', provider: 'FCM:EDGE', failureCode: 'A/B C',
    })).toBe('delivery-failure:v1:unknown:FCM%3AEDGE:A%2FB%20C');
  });

  it('exports the exact bounded evidence SQL for read-only planner verification', () => {
    const query = notificationDeliveryIncidentFailureEvidenceSql({
      dataScope: 'synthetic', provider: 'FCM_HTTP_V1', failureCode: 'PERF_INVALID_ARGUMENT',
    }, new Date('2026-01-02T00:00:00.000Z'));

    expect(query.text).toContain('DISTINCT ON (delivery."notificationId", delivery."pushDeviceId")');
    expect(query.text).toContain('matching AS MATERIALIZED');
    expect(query.text).toContain('COUNT(*)::bigint AS "totalCount"');
    expect(query.text).toContain('CROSS JOIN LATERAL');
    expect(query.text).toContain('delivery."attemptedAt" >');
    expect(query.values).toContain(500);
  });

  it('builds one bounded all-group base scan with in-query member pages', () => {
    const query = notificationDeliveryIncidentAllGroupEvidenceSql();

    expect(query.text.match(/FROM "NotificationDelivery" delivery/g)).toHaveLength(1);
    expect(query.text).toContain('classified AS MATERIALIZED');
    expect(query.text).toContain('eligible AS MATERIALIZED');
    expect(query.text).toContain('group_summary AS');
    expect(query.text).toContain('CROSS JOIN LATERAL');
    expect(query.text).toContain('ORDER BY eligible."attemptedAt" DESC');
    expect(query.text).toContain('latest_incident.state <> \'RESOLVED\'');
    expect(query.values).toContain(10);
    expect(query.values).toContain(500);
  });

  it('discovers all groups once and creates bounded system-audited occurrences', async () => {
    const prisma = syncPrismaFixture();

    const result = await syncNotificationDeliveryIncidents(
      prisma as never,
      { groupLimit: 10 },
      new Date('2026-08-27T10:00:00.000Z'),
    );

    expect(result).toEqual({
      created: 2,
      discovered: 2,
      failed: 0,
      lockedSkipped: 0,
      raceSkipped: 0,
      unchanged: 0,
      updated: 0,
    });
    const discoveryCalls = prisma.$queryRaw.mock.calls.filter(([query]) =>
      query.text.includes('classified AS MATERIALIZED'));
    expect(discoveryCalls).toHaveLength(1);
    expect(prisma.notificationDeliveryIncident.create).toHaveBeenCalledTimes(2);
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'notification_delivery_incident.auto_opened',
        actorId: null,
        actorType: 'SYSTEM',
        source: 'notification_delivery_incident_auto_sync',
      }),
    });
  });

  it('does not write or audit when an open occurrence already has the same evidence', async () => {
    const latest = incident({
      provider: 'FCM_HTTP_V1',
      sourceKey: 'delivery-failure:v1:production:FCM_HTTP_V1:UNREGISTERED',
    });
    const prisma = syncPrismaFixture({
      existingDeliveryIds: ['delivery-fcm'],
      latest,
      rows: [syncEvidence({
        deliveryId: 'delivery-fcm',
        latestIncidentId: latest.id,
        latestIncidentRevision: latest.revision,
        latestIncidentState: latest.state,
        notificationId: 'notification-fcm',
      })],
    });

    const result = await syncNotificationDeliveryIncidents(prisma as never);

    expect(result.unchanged).toBe(1);
    expect(prisma.notificationDeliveryIncident.update).not.toHaveBeenCalled();
    expect(prisma.notificationDeliveryIncidentMember.createMany).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('skips a discovery snapshot that raced with an operator lifecycle change', async () => {
    const prisma = syncPrismaFixture({ latest: incident() });

    const result = await syncNotificationDeliveryIncidents(prisma as never);

    expect(result.raceSkipped).toBe(2);
    expect(prisma.notificationDeliveryIncident.create).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
  });
});

function incident(overrides: Record<string, unknown> = {}) {
  return {
    id: 'incident-1',
    sourceKind: 'DELIVERY_FAILURE',
    sourceKey: 'delivery-failure:v1:production:FCM:UNREGISTERED',
    occurrence: 1,
    dataScope: 'production',
    provider: 'FCM',
    failureCode: 'UNREGISTERED',
    state: NotificationDeliveryIncidentState.OPEN,
    ownerAdminId: null,
    resolutionCode: null,
    resolutionNote: null,
    firstObservedAt: new Date('2026-08-27T08:00:00.000Z'),
    lastObservedAt: new Date('2026-08-27T09:00:00.000Z'),
    lastVerifiedAt: new Date('2026-08-27T09:00:00.000Z'),
    resolvedAt: null,
    resolvedByAdminId: null,
    revision: 1,
    createdAt: new Date('2026-08-27T08:00:00.000Z'),
    updatedAt: new Date('2026-08-27T09:00:00.000Z'),
    ownerAdmin: null,
    resolvedByAdmin: null,
    _count: { members: 1 },
    ...overrides,
  };
}

function prismaFixture({ latest }: { latest: ReturnType<typeof incident> | null }) {
  const fixture = {
    $queryRaw: vi.fn().mockResolvedValueOnce([{
      notificationId: 'notification-1',
      deliveryId: 'delivery-1',
      attemptedAt: new Date('2026-08-27T09:00:00.000Z'),
      firstObservedAt: new Date('2026-08-27T08:00:00.000Z'),
      lastObservedAt: new Date('2026-08-27T09:00:00.000Z'),
      totalCount: 1n,
    }]).mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(1),
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    notificationDeliveryIncident: {
      findFirst: vi.fn().mockResolvedValue(latest),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn().mockResolvedValue(incident()),
      update: vi.fn().mockResolvedValue(incident({ revision: 2 })),
      updateMany: vi.fn(),
    },
    notificationDeliveryIncidentMember: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    user: { findUnique: vi.fn() },
  };
  return {
    ...fixture,
    $transaction: vi.fn(async (callback: (transaction: typeof fixture) => unknown) => callback(fixture)),
  };
}

function failureEvidence(at: string) {
  const observedAt = new Date(at);
  return {
    notificationId: 'notification-1',
    deliveryId: `delivery-${at}`,
    attemptedAt: observedAt,
    firstObservedAt: observedAt,
    lastObservedAt: observedAt,
    totalCount: 1n,
  };
}

function syncPrismaFixture(options: {
  existingDeliveryIds?: string[];
  latest?: ReturnType<typeof incident> | null;
  rows?: ReturnType<typeof syncEvidence>[];
} = {}) {
  const rows = options.rows ?? [
    syncEvidence({
      deliveryId: 'delivery-fcm',
      failureCode: 'UNREGISTERED',
      notificationId: 'notification-fcm',
      provider: 'FCM_HTTP_V1',
    }),
    syncEvidence({
      deliveryId: 'delivery-apns',
      failureCode: 'BAD_DEVICE_TOKEN',
      notificationId: 'notification-apns',
      provider: 'APNS',
    }),
  ];
  const fixture = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn(async (query: { text: string }) =>
      query.text.includes('classified AS MATERIALIZED') ? rows : [{ locked: true }]),
    notificationDeliveryIncident: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => incident({
        ...data,
        id: `incident-${String(data.provider).toLowerCase()}`,
      })),
      findFirst: vi.fn().mockResolvedValue(options.latest ?? null),
      update: vi.fn(),
    },
    notificationDeliveryIncidentMember: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue(
        (options.existingDeliveryIds ?? []).map((deliveryId) => ({ deliveryId })),
      ),
    },
    adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-auto' }) },
  };
  return {
    ...fixture,
    $transaction: vi.fn(async (callback: (transaction: typeof fixture) => unknown) => callback(fixture)),
  };
}

function syncEvidence(overrides: Record<string, unknown>) {
  return {
    attemptedAt: new Date('2026-08-27T09:00:00.000Z'),
    dataScope: 'production',
    deliveryId: 'delivery-1',
    failureCode: 'UNREGISTERED',
    firstObservedAt: new Date('2026-08-27T08:00:00.000Z'),
    lastObservedAt: new Date('2026-08-27T09:00:00.000Z'),
    latestIncidentId: null,
    latestIncidentRevision: null,
    latestIncidentState: null,
    latestResolvedAt: null,
    notificationId: 'notification-1',
    provider: 'FCM_HTTP_V1',
    totalCount: 1n,
    ...overrides,
  };
}
