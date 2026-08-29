import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  NotificationDeliveryIncidentResolutionCode,
  NotificationDeliveryIncidentState,
  Prisma,
  Role,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  adminNotificationDataScopeSql,
  adminNotificationDataScopeValueSql,
  normalizeAdminNotificationDataScope,
} from './admin-notification-production-data';

const INCIDENT_MEMBER_LIMIT = 500;
const INCIDENT_EVIDENCE_WORK_MEM = '32MB';
const INCIDENT_SYNC_WORK_MEM = '128MB';
export const NOTIFICATION_DELIVERY_INCIDENT_SYNC_GROUP_LIMIT = 10;

export type NotificationDeliveryIncidentSyncOptions = {
  readonly groupLimit?: number;
  readonly includeSynthetic?: boolean;
};

export type NotificationDeliveryIncidentSyncResult = {
  created: number;
  discovered: number;
  failed: number;
  lockedSkipped: number;
  raceSkipped: number;
  unchanged: number;
  updated: number;
};

export type OpenNotificationDeliveryIncidentInput = {
  readonly dataScope: string;
  readonly failureCode: string;
  readonly provider: string;
  readonly reason: string;
};

export type AssignNotificationDeliveryIncidentInput = {
  readonly assigneeAdminId: string;
  readonly expectedRevision: number;
  readonly reason: string;
};

export type ResolveNotificationDeliveryIncidentInput = {
  readonly expectedRevision: number;
  readonly reason: string;
  readonly resolutionCode: NotificationDeliveryIncidentResolutionCode;
};

export type ReopenNotificationDeliveryIncidentInput = {
  readonly expectedRevision: number;
  readonly reason: string;
};

export type NotificationDeliveryIncidentListOptions = {
  readonly dataScope?: string;
  readonly ownerAdminId?: string;
  readonly skip?: string;
  readonly sourceKey?: string;
  readonly state?: string;
  readonly take?: string;
};

type IncidentFailureEvidenceRow = {
  readonly attemptedAt: Date;
  readonly deliveryId: string;
  readonly firstObservedAt: Date;
  readonly lastObservedAt: Date;
  readonly notificationId: string;
  readonly totalCount: bigint | number;
};

type IncidentSyncEvidenceRow = IncidentFailureEvidenceRow & {
  readonly dataScope: string;
  readonly failureCode: string;
  readonly latestIncidentId: string | null;
  readonly latestIncidentRevision: number | null;
  readonly latestIncidentState: NotificationDeliveryIncidentState | null;
  readonly latestResolvedAt: Date | null;
  readonly provider: string;
};

type IncidentSyncGroup = Omit<IncidentSyncEvidenceRow, 'attemptedAt' | 'deliveryId' | 'notificationId'> & {
  readonly members: Array<Pick<IncidentSyncEvidenceRow, 'attemptedAt' | 'deliveryId' | 'notificationId'>>;
};

const incidentInclude = {
  ownerAdmin: { select: { email: true, fullName: true, id: true } },
  resolvedByAdmin: { select: { email: true, fullName: true, id: true } },
  _count: { select: { members: true } },
} satisfies Prisma.NotificationDeliveryIncidentInclude;

export async function listNotificationDeliveryIncidents(
  prisma: PrismaService,
  options: NotificationDeliveryIncidentListOptions = {},
) {
  const take = boundedInteger(options.take, 20, 1, 50, 'Incident take');
  const skip = boundedInteger(options.skip, 0, 0, 10_000, 'Incident skip');
  const state = normalizeIncidentState(options.state);
  const dataScope = options.dataScope
    ? normalizeAdminNotificationDataScope(options.dataScope)
    : undefined;
  const ownerAdminId = normalizedText(options.ownerAdminId, 128, 'Incident owner');
  const sourceKey = normalizedText(options.sourceKey, 500, 'Incident source key');
  const where: Prisma.NotificationDeliveryIncidentWhereInput = {
    ...(state ? { state } : {}),
    ...(dataScope ? { dataScope } : {}),
    ...(ownerAdminId ? { ownerAdminId } : {}),
    ...(sourceKey ? { sourceKey } : {}),
  };
  const [items, totalCount] = await Promise.all([
    prisma.notificationDeliveryIncident.findMany({
      where,
      include: incidentInclude,
      orderBy: [{ state: 'asc' }, { lastObservedAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
    }),
    prisma.notificationDeliveryIncident.count({ where }),
  ]);
  return { items, skip, take, totalCount };
}

export async function notificationDeliveryIncidentDetail(prisma: PrismaService, incidentId: string) {
  const id = requiredText(incidentId, 128, 'Incident id');
  const incident = await prisma.notificationDeliveryIncident.findUnique({
    where: { id },
    include: {
      ...incidentInclude,
      members: {
        orderBy: [{ observedAt: 'desc' }, { id: 'desc' }],
        take: 50,
        select: {
          id: true,
          notificationId: true,
          deliveryId: true,
          observedAt: true,
        },
      },
    },
  });
  if (!incident) throw new NotFoundException('Notification delivery incident not found');
  const audit = await prisma.adminAuditLog.findMany({
    where: { target: `notification_delivery_incident:${id}` },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 50,
    select: {
      action: true,
      actorId: true,
      createdAt: true,
      id: true,
      metadata: true,
      outcome: true,
    },
  });
  return { incident, audit, memberLimit: INCIDENT_MEMBER_LIMIT };
}

export async function openNotificationDeliveryIncident(
  prisma: PrismaService,
  actorId: string,
  input: OpenNotificationDeliveryIncidentInput,
) {
  const actor = requiredText(actorId, 128, 'Actor id');
  const dataScope = normalizeAdminNotificationDataScope(input.dataScope);
  const provider = requiredText(input.provider, 80, 'Incident provider').toUpperCase();
  const failureCode = requiredText(input.failureCode, 160, 'Incident failure code');
  const reason = requiredReason(input.reason);
  const sourceKey = notificationDeliveryIncidentSourceKey({ dataScope, failureCode, provider });
  const evidence = await incidentFailureEvidenceSnapshot(prisma, { dataScope, failureCode, provider });
  if (evidence.length === 0) {
    throw new ConflictException('No current failed delivery evidence matches this incident source');
  }

  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(`SET LOCAL work_mem = '${INCIDENT_EVIDENCE_WORK_MEM}'`);
    await transaction.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${sourceKey}))`);
    const latest = await transaction.notificationDeliveryIncident.findFirst({
      where: { sourceKey },
      orderBy: { occurrence: 'desc' },
      include: incidentInclude,
    });
    const now = new Date();
    const occurrenceEvidence = latest?.state === NotificationDeliveryIncidentState.RESOLVED
      ? await incidentFailureEvidence(transaction, { dataScope, failureCode, provider }, latest.resolvedAt ?? undefined)
      : evidence;
    if (latest?.state === NotificationDeliveryIncidentState.RESOLVED) {
      if (!latest.resolvedAt || occurrenceEvidence.length === 0) {
        throw new ConflictException('No new failed delivery was observed after this incident was resolved');
      }
    }
    const firstObservedAt = occurrenceEvidence[0]!.firstObservedAt;
    const lastObservedAt = occurrenceEvidence[0]!.lastObservedAt;

    const incident = latest && latest.state !== NotificationDeliveryIncidentState.RESOLVED
      ? await transaction.notificationDeliveryIncident.update({
          where: { id: latest.id },
          data: {
            firstObservedAt: firstObservedAt < latest.firstObservedAt ? firstObservedAt : latest.firstObservedAt,
            lastObservedAt: lastObservedAt > latest.lastObservedAt ? lastObservedAt : latest.lastObservedAt,
            lastVerifiedAt: now,
            revision: { increment: 1 },
          },
          include: incidentInclude,
        })
      : await transaction.notificationDeliveryIncident.create({
          data: {
            dataScope,
            failureCode,
            firstObservedAt,
            lastObservedAt,
            lastVerifiedAt: now,
            occurrence: (latest?.occurrence ?? 0) + 1,
            provider,
            sourceKey,
          },
          include: incidentInclude,
        });
    await transaction.notificationDeliveryIncidentMember.createMany({
      data: occurrenceEvidence.slice(0, INCIDENT_MEMBER_LIMIT).map((row) => ({
        incidentId: incident.id,
        notificationId: row.notificationId,
        deliveryId: row.deliveryId,
        observedAt: row.attemptedAt,
      })),
      skipDuplicates: true,
    });
    await createIncidentAudit(transaction, {
      action: latest && latest.state !== NotificationDeliveryIncidentState.RESOLVED
        ? 'notification_delivery_incident.verified'
        : 'notification_delivery_incident.opened',
      actorId: actor,
      after: incidentSnapshot(incident),
      before: latest ? incidentSnapshot(latest) : null,
      incidentId: incident.id,
      reason,
      metadata: {
        evidenceCount: Number(occurrenceEvidence[0]!.totalCount),
        memberLimit: INCIDENT_MEMBER_LIMIT,
        sourceKey,
      },
    });
    return incident;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
}

export async function syncNotificationDeliveryIncidents(
  prisma: PrismaService,
  options: NotificationDeliveryIncidentSyncOptions = {},
  now = new Date(),
): Promise<NotificationDeliveryIncidentSyncResult> {
  const groups = await notificationDeliveryIncidentSyncGroups(prisma, options);
  const result: NotificationDeliveryIncidentSyncResult = {
    created: 0,
    discovered: groups.length,
    failed: 0,
    lockedSkipped: 0,
    raceSkipped: 0,
    unchanged: 0,
    updated: 0,
  };

  for (const group of groups) {
    try {
      const outcome = await syncNotificationDeliveryIncidentGroup(prisma, group, now);
      if (outcome === 'created') result.created += 1;
      else if (outcome === 'updated') result.updated += 1;
      else if (outcome === 'locked-skipped') result.lockedSkipped += 1;
      else if (outcome === 'race-skipped') result.raceSkipped += 1;
      else result.unchanged += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}

export async function notificationDeliveryIncidentSyncGroups(
  prisma: PrismaService,
  options: NotificationDeliveryIncidentSyncOptions = {},
) {
  const rows = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`);
    await transaction.$executeRawUnsafe(`SET LOCAL work_mem = '${INCIDENT_SYNC_WORK_MEM}'`);
    await transaction.$executeRaw(Prisma.sql`SET LOCAL statement_timeout = '30s'`);
    return transaction.$queryRaw<IncidentSyncEvidenceRow[]>(
      notificationDeliveryIncidentAllGroupEvidenceSql(options),
    );
  }, { timeout: 35_000 });

  const groups = new Map<string, IncidentSyncGroup>();
  for (const row of rows) {
    const sourceKey = notificationDeliveryIncidentSourceKey(row);
    const existing = groups.get(sourceKey);
    const member = {
      attemptedAt: row.attemptedAt,
      deliveryId: row.deliveryId,
      notificationId: row.notificationId,
    };
    if (existing) {
      existing.members.push(member);
      continue;
    }
    groups.set(sourceKey, {
      dataScope: row.dataScope,
      failureCode: row.failureCode,
      firstObservedAt: row.firstObservedAt,
      lastObservedAt: row.lastObservedAt,
      latestIncidentId: row.latestIncidentId,
      latestIncidentRevision: row.latestIncidentRevision,
      latestIncidentState: row.latestIncidentState,
      latestResolvedAt: row.latestResolvedAt,
      members: [member],
      provider: row.provider,
      totalCount: row.totalCount,
    });
  }
  return [...groups.values()];
}

async function syncNotificationDeliveryIncidentGroup(
  prisma: PrismaService,
  group: IncidentSyncGroup,
  now: Date,
) {
  const sourceKey = notificationDeliveryIncidentSourceKey(group);
  return prisma.$transaction(async (transaction) => {
    const [lock] = await transaction.$queryRaw<Array<{ locked: boolean }>>(
      Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtext(${sourceKey})) AS locked`,
    );
    if (!lock?.locked) return 'locked-skipped' as const;

    const latest = await transaction.notificationDeliveryIncident.findFirst({
      where: { sourceKey },
      orderBy: { occurrence: 'desc' },
      include: incidentInclude,
    });
    if (!incidentMatchesSyncDiscovery(latest, group)) return 'race-skipped' as const;

    const existingMembers = latest && latest.state !== NotificationDeliveryIncidentState.RESOLVED
      ? await transaction.notificationDeliveryIncidentMember.findMany({
          where: { incidentId: latest.id },
          select: { deliveryId: true },
          take: INCIDENT_MEMBER_LIMIT,
        })
      : [];
    const existingDeliveryIds = new Set(existingMembers.map((member) => member.deliveryId));
    const remainingMemberCapacity = INCIDENT_MEMBER_LIMIT - existingDeliveryIds.size;
    const newMembers = group.members
      .filter((member) => !existingDeliveryIds.has(member.deliveryId))
      .slice(0, Math.max(0, remainingMemberCapacity));
    const firstObservedAt = latest && latest.state !== NotificationDeliveryIncidentState.RESOLVED
      && latest.firstObservedAt < group.firstObservedAt
      ? latest.firstObservedAt
      : group.firstObservedAt;
    const lastObservedAt = latest && latest.state !== NotificationDeliveryIncidentState.RESOLVED
      && latest.lastObservedAt > group.lastObservedAt
      ? latest.lastObservedAt
      : group.lastObservedAt;
    const occurrenceChanged = !latest
      || latest.state === NotificationDeliveryIncidentState.RESOLVED
      || latest.firstObservedAt.getTime() !== firstObservedAt.getTime()
      || latest.lastObservedAt.getTime() !== lastObservedAt.getTime()
      || newMembers.length > 0;
    if (!occurrenceChanged) return 'unchanged' as const;

    const incident = latest && latest.state !== NotificationDeliveryIncidentState.RESOLVED
      ? await transaction.notificationDeliveryIncident.update({
          where: { id: latest.id },
          data: {
            firstObservedAt,
            lastObservedAt,
            lastVerifiedAt: now,
            revision: { increment: 1 },
          },
          include: incidentInclude,
        })
      : await transaction.notificationDeliveryIncident.create({
          data: {
            dataScope: group.dataScope,
            failureCode: group.failureCode,
            firstObservedAt,
            lastObservedAt,
            lastVerifiedAt: now,
            occurrence: (latest?.occurrence ?? 0) + 1,
            provider: group.provider,
            sourceKey,
          },
          include: incidentInclude,
        });
    const members = latest && latest.state !== NotificationDeliveryIncidentState.RESOLVED
      ? newMembers
      : group.members.slice(0, INCIDENT_MEMBER_LIMIT);
    if (members.length > 0) {
      await transaction.notificationDeliveryIncidentMember.createMany({
        data: members.map((member) => ({
          deliveryId: member.deliveryId,
          incidentId: incident.id,
          notificationId: member.notificationId,
          observedAt: member.attemptedAt,
        })),
        skipDuplicates: true,
      });
    }
    await createIncidentAudit(transaction, {
      action: latest && latest.state !== NotificationDeliveryIncidentState.RESOLVED
        ? 'notification_delivery_incident.auto_verified'
        : 'notification_delivery_incident.auto_opened',
      actorId: null,
      actorType: 'SYSTEM',
      after: incidentSnapshot(incident),
      before: latest ? incidentSnapshot(latest) : null,
      incidentId: incident.id,
      reason: 'Automatic set-based delivery failure sync.',
      source: 'notification_delivery_incident_auto_sync',
      metadata: {
        evidenceCount: Number(group.totalCount),
        memberLimit: INCIDENT_MEMBER_LIMIT,
        persistedMemberCount: members.length,
        sourceKey,
      },
    });
    return latest && latest.state !== NotificationDeliveryIncidentState.RESOLVED
      ? 'updated' as const
      : 'created' as const;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });
}

export async function assignNotificationDeliveryIncident(
  prisma: PrismaService,
  actorId: string,
  incidentId: string,
  input: AssignNotificationDeliveryIncidentInput,
) {
  const id = requiredText(incidentId, 128, 'Incident id');
  const actor = requiredText(actorId, 128, 'Actor id');
  const assigneeAdminId = requiredText(input.assigneeAdminId, 128, 'Incident assignee');
  const reason = requiredReason(input.reason);
  const expectedRevision = positiveRevision(input.expectedRevision);
  return prisma.$transaction(async (transaction) => {
    const [before, assignee] = await Promise.all([
      transaction.notificationDeliveryIncident.findUnique({ where: { id }, include: incidentInclude }),
      transaction.user.findUnique({ where: { id: assigneeAdminId }, select: { roles: true } }),
    ]);
    if (!before) throw new NotFoundException('Notification delivery incident not found');
    if (!assignee?.roles.includes(Role.ADMIN)) throw new BadRequestException('Incident assignee must be an Admin operator');
    if (before.state === NotificationDeliveryIncidentState.RESOLVED) {
      throw new ConflictException('Resolved incidents must be reopened before assignment');
    }
    const result = await transaction.notificationDeliveryIncident.updateMany({
      where: { id, revision: expectedRevision, state: { not: NotificationDeliveryIncidentState.RESOLVED } },
      data: {
        ownerAdminId: assigneeAdminId,
        state: NotificationDeliveryIncidentState.INVESTIGATING,
        lastVerifiedAt: new Date(),
        revision: { increment: 1 },
      },
    });
    if (result.count !== 1) throw new ConflictException('Notification delivery incident changed; refresh before assigning');
    const after = await transaction.notificationDeliveryIncident.findUniqueOrThrow({ where: { id }, include: incidentInclude });
    await createIncidentAudit(transaction, {
      action: 'notification_delivery_incident.assigned', actorId: actor,
      after: incidentSnapshot(after), before: incidentSnapshot(before), incidentId: id, reason,
      metadata: { assigneeAdminId },
    });
    return after;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function resolveNotificationDeliveryIncident(
  prisma: PrismaService,
  actorId: string,
  incidentId: string,
  input: ResolveNotificationDeliveryIncidentInput,
) {
  const id = requiredText(incidentId, 128, 'Incident id');
  const actor = requiredText(actorId, 128, 'Actor id');
  const reason = requiredReason(input.reason);
  const expectedRevision = positiveRevision(input.expectedRevision);
  if (!Object.values(NotificationDeliveryIncidentResolutionCode).includes(input.resolutionCode)) {
    throw new BadRequestException('Notification delivery incident resolution code is invalid');
  }
  return prisma.$transaction(async (transaction) => {
    const before = await transaction.notificationDeliveryIncident.findUnique({ where: { id }, include: incidentInclude });
    if (!before) throw new NotFoundException('Notification delivery incident not found');
    if (before.state === NotificationDeliveryIncidentState.RESOLVED) {
      throw new ConflictException('Notification delivery incident is already resolved');
    }
    const now = new Date();
    const result = await transaction.notificationDeliveryIncident.updateMany({
      where: { id, revision: expectedRevision, state: { not: NotificationDeliveryIncidentState.RESOLVED } },
      data: {
        state: NotificationDeliveryIncidentState.RESOLVED,
        resolutionCode: input.resolutionCode,
        resolutionNote: reason,
        resolvedAt: now,
        resolvedByAdminId: actor,
        lastVerifiedAt: now,
        revision: { increment: 1 },
      },
    });
    if (result.count !== 1) throw new ConflictException('Notification delivery incident changed; refresh before resolving');
    const after = await transaction.notificationDeliveryIncident.findUniqueOrThrow({ where: { id }, include: incidentInclude });
    await createIncidentAudit(transaction, {
      action: 'notification_delivery_incident.resolved', actorId: actor,
      after: incidentSnapshot(after), before: incidentSnapshot(before), incidentId: id, reason,
      metadata: { resolutionCode: input.resolutionCode },
    });
    return after;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function reopenNotificationDeliveryIncident(
  prisma: PrismaService,
  actorId: string,
  incidentId: string,
  input: ReopenNotificationDeliveryIncidentInput,
) {
  const id = requiredText(incidentId, 128, 'Incident id');
  const actor = requiredText(actorId, 128, 'Actor id');
  const reason = requiredReason(input.reason);
  const expectedRevision = positiveRevision(input.expectedRevision);
  return prisma.$transaction(async (transaction) => {
    const before = await transaction.notificationDeliveryIncident.findUnique({ where: { id }, include: incidentInclude });
    if (!before) throw new NotFoundException('Notification delivery incident not found');
    if (before.state !== NotificationDeliveryIncidentState.RESOLVED) {
      throw new ConflictException('Only resolved incidents can be reopened');
    }
    const result = await transaction.notificationDeliveryIncident.updateMany({
      where: { id, revision: expectedRevision, state: NotificationDeliveryIncidentState.RESOLVED },
      data: {
        state: NotificationDeliveryIncidentState.INVESTIGATING,
        ownerAdminId: actor,
        resolutionCode: null,
        resolutionNote: null,
        resolvedAt: null,
        resolvedByAdminId: null,
        lastVerifiedAt: new Date(),
        revision: { increment: 1 },
      },
    });
    if (result.count !== 1) throw new ConflictException('Notification delivery incident changed; refresh before reopening');
    const after = await transaction.notificationDeliveryIncident.findUniqueOrThrow({ where: { id }, include: incidentInclude });
    await createIncidentAudit(transaction, {
      action: 'notification_delivery_incident.reopened', actorId: actor,
      after: incidentSnapshot(after), before: incidentSnapshot(before), incidentId: id, reason,
      metadata: {},
    });
    return after;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export function notificationDeliveryIncidentSourceKey(input: {
  readonly dataScope: string;
  readonly failureCode: string;
  readonly provider: string;
}) {
  const value = `delivery-failure:v1:${input.dataScope}:${encodeURIComponent(input.provider)}:${encodeURIComponent(input.failureCode)}`;
  if (value.length > 500) throw new BadRequestException('Notification delivery incident source key is too long');
  return value;
}

async function incidentFailureEvidence(
  prisma: Pick<Prisma.TransactionClient, '$queryRaw'>,
  input: { readonly dataScope: string; readonly failureCode: string; readonly provider: string },
  observedAfter?: Date,
) {
  return prisma.$queryRaw<IncidentFailureEvidenceRow[]>(
    notificationDeliveryIncidentFailureEvidenceSql(input, observedAfter),
  );
}

async function incidentFailureEvidenceSnapshot(
  prisma: PrismaService,
  input: { readonly dataScope: string; readonly failureCode: string; readonly provider: string },
) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`);
    await transaction.$executeRawUnsafe(`SET LOCAL work_mem = '${INCIDENT_EVIDENCE_WORK_MEM}'`);
    await transaction.$executeRaw(Prisma.sql`SET LOCAL statement_timeout = '30s'`);
    return incidentFailureEvidence(transaction, input);
  }, { timeout: 35_000 });
}

export function notificationDeliveryIncidentFailureEvidenceSql(
  input: { readonly dataScope: string; readonly failureCode: string; readonly provider: string },
  observedAfter?: Date,
) {
  const observedAfterCondition = observedAfter
    ? Prisma.sql`AND delivery."attemptedAt" > ${observedAfter}`
    : Prisma.empty;
  return Prisma.sql`
    WITH latest_delivery_id AS (
      SELECT DISTINCT ON (delivery."notificationId", delivery."pushDeviceId")
        delivery.id,
        delivery."notificationId"
      FROM "NotificationDelivery" delivery
      ORDER BY delivery."notificationId", delivery."pushDeviceId", delivery."attemptedAt" DESC, delivery.id DESC
    ), matching AS MATERIALIZED (
      SELECT
        notification.id AS "notificationId",
        delivery.id AS "deliveryId",
        delivery."attemptedAt"
      FROM latest_delivery_id
      INNER JOIN "NotificationDelivery" delivery ON delivery.id = latest_delivery_id.id
      INNER JOIN "Notification" notification ON notification.id = delivery."notificationId"
      WHERE delivery.status = 'FAILED'
        AND delivery.provider::text = ${input.provider}
        AND COALESCE(
          NULLIF(delivery.response->>'failureCode', ''),
          NULLIF(delivery.response->'body'->'error'->>'status', ''),
          'UNCLASSIFIED_FAILURE'
        ) = ${input.failureCode}
        AND ${adminNotificationDataScopeSql(input.dataScope)}
        ${observedAfterCondition}
    ), summary AS (
      SELECT
        MIN(matching."attemptedAt") AS "firstObservedAt",
        MAX(matching."attemptedAt") AS "lastObservedAt",
        COUNT(*)::bigint AS "totalCount"
      FROM matching
    )
    SELECT
      page."notificationId",
      page."deliveryId",
      page."attemptedAt",
      summary."firstObservedAt",
      summary."lastObservedAt",
      summary."totalCount"
    FROM summary
    CROSS JOIN LATERAL (
      SELECT matching."notificationId", matching."deliveryId", matching."attemptedAt"
      FROM matching
      ORDER BY matching."attemptedAt" DESC, matching."deliveryId" DESC
      LIMIT ${INCIDENT_MEMBER_LIMIT}
    ) page
  `;
}

export function notificationDeliveryIncidentAllGroupEvidenceSql(
  options: NotificationDeliveryIncidentSyncOptions = {},
) {
  const groupLimit = syncGroupLimit(options.groupLimit);
  const dataScopeCondition = options.includeSynthetic
    ? Prisma.sql`TRUE`
    : Prisma.sql`NOT (${adminNotificationDataScopeSql('synthetic')})`;
  return Prisma.sql`
    WITH latest_delivery_id AS (
      SELECT DISTINCT ON (delivery."notificationId", delivery."pushDeviceId")
        delivery.id,
        delivery."notificationId"
      FROM "NotificationDelivery" delivery
      ORDER BY delivery."notificationId", delivery."pushDeviceId", delivery."attemptedAt" DESC, delivery.id DESC
    ), latest_incident AS (
      SELECT DISTINCT ON (incident."dataScope", incident.provider, incident."failureCode")
        incident.id,
        incident."dataScope",
        incident.provider,
        incident."failureCode",
        incident.state::text AS state,
        incident.revision,
        incident."resolvedAt"
      FROM "NotificationDeliveryIncident" incident
      WHERE incident."sourceKind" = 'DELIVERY_FAILURE'
      ORDER BY
        incident."dataScope",
        incident.provider,
        incident."failureCode",
        incident.occurrence DESC,
        incident.id DESC
    ), classified AS MATERIALIZED (
      SELECT
        notification.id AS "notificationId",
        delivery.id AS "deliveryId",
        delivery."attemptedAt",
        ${adminNotificationDataScopeValueSql()} AS "dataScope",
        delivery.provider::text AS provider,
        COALESCE(
          NULLIF(delivery.response->>'failureCode', ''),
          NULLIF(delivery.response->'body'->'error'->>'status', ''),
          'UNCLASSIFIED_FAILURE'
        ) AS "failureCode"
      FROM latest_delivery_id
      INNER JOIN "NotificationDelivery" delivery ON delivery.id = latest_delivery_id.id
      INNER JOIN "Notification" notification ON notification.id = delivery."notificationId"
      WHERE delivery.status = 'FAILED'
        AND ${dataScopeCondition}
    ), eligible AS MATERIALIZED (
      SELECT classified.*
      FROM classified
      LEFT JOIN latest_incident
        ON latest_incident."dataScope" = classified."dataScope"
        AND latest_incident.provider = classified.provider
        AND latest_incident."failureCode" = classified."failureCode"
      WHERE latest_incident.id IS NULL
        OR latest_incident.state <> 'RESOLVED'
        OR classified."attemptedAt" > latest_incident."resolvedAt"
    ), group_summary AS (
      SELECT
        eligible."dataScope",
        eligible.provider,
        eligible."failureCode",
        MIN(eligible."attemptedAt") AS "firstObservedAt",
        MAX(eligible."attemptedAt") AS "lastObservedAt",
        COUNT(*)::bigint AS "totalCount"
      FROM eligible
      GROUP BY eligible."dataScope", eligible.provider, eligible."failureCode"
    ), selected_groups AS (
      SELECT
        group_summary.*,
        latest_incident.id AS "latestIncidentId",
        latest_incident.revision AS "latestIncidentRevision",
        latest_incident.state AS "latestIncidentState",
        latest_incident."resolvedAt" AS "latestResolvedAt"
      FROM group_summary
      LEFT JOIN latest_incident
        ON latest_incident."dataScope" = group_summary."dataScope"
        AND latest_incident.provider = group_summary.provider
        AND latest_incident."failureCode" = group_summary."failureCode"
      ORDER BY
        group_summary."lastObservedAt" DESC,
        group_summary."dataScope",
        group_summary.provider,
        group_summary."failureCode"
      LIMIT ${groupLimit}
    )
    SELECT
      page."notificationId",
      page."deliveryId",
      page."attemptedAt",
      selected_groups."dataScope",
      selected_groups.provider,
      selected_groups."failureCode",
      selected_groups."firstObservedAt",
      selected_groups."lastObservedAt",
      selected_groups."totalCount",
      selected_groups."latestIncidentId",
      selected_groups."latestIncidentRevision",
      selected_groups."latestIncidentState",
      selected_groups."latestResolvedAt"
    FROM selected_groups
    CROSS JOIN LATERAL (
      SELECT eligible."notificationId", eligible."deliveryId", eligible."attemptedAt"
      FROM eligible
      WHERE eligible."dataScope" = selected_groups."dataScope"
        AND eligible.provider = selected_groups.provider
        AND eligible."failureCode" = selected_groups."failureCode"
      ORDER BY eligible."attemptedAt" DESC, eligible."deliveryId" DESC
      LIMIT ${INCIDENT_MEMBER_LIMIT}
    ) page
    ORDER BY
      selected_groups."lastObservedAt" DESC,
      selected_groups."dataScope",
      selected_groups.provider,
      selected_groups."failureCode",
      page."attemptedAt" DESC,
      page."deliveryId" DESC
  `;
}

async function createIncidentAudit(
  transaction: Prisma.TransactionClient,
  input: {
    readonly action: string;
    readonly actorId: string | null;
    readonly actorType?: 'HUMAN' | 'SYSTEM';
    readonly after: Prisma.InputJsonObject;
    readonly before: Prisma.InputJsonObject | null;
    readonly incidentId: string;
    readonly metadata: Prisma.InputJsonObject;
    readonly reason: string;
    readonly source?: string;
  },
) {
  await transaction.adminAuditLog.create({
    data: {
      actorId: input.actorId,
      actorType: input.actorType ?? 'HUMAN',
      action: input.action,
      target: `notification_delivery_incident:${input.incidentId}`,
      objectType: 'NotificationDeliveryIncident',
      objectId: input.incidentId,
      area: 'SYSTEM',
      severity: 'NOTICE',
      outcome: 'SUCCEEDED',
      source: input.source ?? 'admin_notification_delivery_incident',
      tags: ['notification', 'delivery', 'incident'],
      metadata: {
        reason: input.reason,
        before: input.before,
        after: input.after,
        ...input.metadata,
      },
    },
  });
}

function incidentSnapshot(incident: {
  readonly failureCode: string;
  readonly id: string;
  readonly occurrence: number;
  readonly ownerAdminId: string | null;
  readonly provider: string;
  readonly resolutionCode: NotificationDeliveryIncidentResolutionCode | null;
  readonly revision: number;
  readonly sourceKey: string;
  readonly state: NotificationDeliveryIncidentState;
}): Prisma.InputJsonObject {
  return {
    failureCode: incident.failureCode,
    id: incident.id,
    occurrence: incident.occurrence,
    ownerAdminId: incident.ownerAdminId,
    provider: incident.provider,
    resolutionCode: incident.resolutionCode,
    revision: incident.revision,
    sourceKey: incident.sourceKey,
    state: incident.state,
  };
}

function incidentMatchesSyncDiscovery(
  latest: {
    readonly id: string;
    readonly resolvedAt: Date | null;
    readonly revision: number;
    readonly state: NotificationDeliveryIncidentState;
  } | null,
  group: IncidentSyncGroup,
) {
  if (!latest) return group.latestIncidentId === null;
  return latest.id === group.latestIncidentId
    && latest.revision === group.latestIncidentRevision
    && latest.state === group.latestIncidentState
    && (latest.resolvedAt?.getTime() ?? null) === (group.latestResolvedAt?.getTime() ?? null);
}

function syncGroupLimit(value: number | undefined) {
  const limit = value ?? NOTIFICATION_DELIVERY_INCIDENT_SYNC_GROUP_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new BadRequestException('Notification delivery incident sync group limit is invalid');
  }
  return limit;
}

function normalizeIncidentState(value: string | undefined) {
  const normalized = value?.trim().toUpperCase();
  if (!normalized || normalized === 'ALL') return undefined;
  if (!Object.values(NotificationDeliveryIncidentState).includes(normalized as NotificationDeliveryIncidentState)) {
    throw new BadRequestException('Notification delivery incident state is invalid');
  }
  return normalized as NotificationDeliveryIncidentState;
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number, label: string) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new BadRequestException(`${label} is invalid`);
  }
  return parsed;
}

function positiveRevision(value: number) {
  if (!Number.isInteger(value) || value < 1) throw new BadRequestException('Incident revision is invalid');
  return value;
}

function requiredReason(value: string) {
  const reason = requiredText(value, 500, 'Incident reason');
  if (reason.length < 12) throw new BadRequestException('Incident reason must be at least 12 characters');
  return reason;
}

function requiredText(value: string, maximum: number, label: string) {
  const normalized = normalizedText(value, maximum, label);
  if (!normalized) throw new BadRequestException(`${label} is required`);
  return normalized;
}

function normalizedText(value: string | undefined, maximum: number, label: string) {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (normalized.length > maximum || Array.from(normalized).some((character) => character.charCodeAt(0) < 32)) {
    throw new BadRequestException(`${label} is invalid`);
  }
  return normalized;
}
