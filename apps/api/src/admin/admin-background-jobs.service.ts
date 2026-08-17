import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AdminOperatorPermissionCategory,
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Role,
} from '@prisma/client';
import type { Job, JobsOptions, Queue } from 'bullmq';
import { registerOrRetryBullJob } from '../common/bullmq-job-registration';
import { BOOKING_TIMEOUT_QUEUE_NAME } from '../matching/booking-timeout.queue';
import {
  ADMIN_PUSH_CAMPAIGN_QUEUE_NAME,
  adminPushCampaignJob,
} from '../notifications/admin-push-campaign.queue';
import {
  NOTIFICATION_DELIVERY_CLAIM_STALE_MS,
  NOTIFICATION_DELIVERY_UNKNOWN_CODE,
  NOTIFICATION_SEND_QUEUE_NAME,
  notificationSendJob,
} from '../notifications/notification-send.queue';
import { notificationDeliveryFailureCode } from '../notifications/notification-delivery-failure';
import { notificationDataWithDeliveryContract } from '../notifications/notification-data-scope';
import { toJson } from '../notifications/notification-push-payload';
import { notificationRetryFailureClass } from '../notifications/notification-retry-decision';
import {
  isRoleNeutralNotificationType,
  notificationTargetRole,
  pushDeviceMatchesTargetRole,
} from '../notifications/notification-target-role';
import {
  PAYMENT_BOOKING_RECOVERY_QUEUE_NAME,
  paymentBookingRecoveryJob,
} from '../payments/payment-booking-recovery.queue';
import {
  PAYMENT_REFUND_STATUS_QUEUE_NAME,
  paymentRefundStatusJob,
} from '../payments/payment-refund-status.queue';
import {
  PAYMENT_STATUS_CHECK_QUEUE_NAME,
  paymentStatusCheckJob,
} from '../payments/payment-status.queue';
import { PrismaService } from '../prisma/prisma.service';
import {
  TAX_POLICY_ACTIVATION_QUEUE_NAME,
  TAX_POLICY_ACTIVATION_SWEEP_SCHEDULER_ID,
} from '../provider-onboarding/tax-policy-activation.queue';
import {
  BACKGROUND_JOB_FAILURE_MONITOR_SCHEDULER_ID,
  BANK_STATEMENT_ESCALATION_QUEUE_NAME,
  BANK_STATEMENT_ESCALATION_INTERVAL_MS,
  BANK_STATEMENT_ESCALATION_SCHEDULER_ID,
} from './bank-statement-escalation.queue';
import type {
  BackgroundJobHealthQueryDto,
  BackgroundJobIncidentDetailQueryDto,
} from './admin-system.dto';

type BackgroundQueueDefinition = {
  expectedSchedulerIds?: string[];
  label: string;
  queue: Queue;
  staleAfterMs: number;
};

type BackgroundQueueStatus = 'ATTENTION' | 'HEALTHY' | 'RUNNING' | 'STALE';
type BackgroundFailureReviewStatus = 'ACKNOWLEDGED' | 'NEW' | 'RESOLVED' | 'UNTRACKED';

const FAILED_JOB_LIMIT_PER_QUEUE = 5;
const FAILED_JOB_LIST_DEFAULT_PAGE_SIZE = 10;
const FAILED_JOB_LIST_MAX_SCAN_PER_QUEUE = 500;
const IMMEDIATE_QUEUE_STALE_AFTER_MS = 2 * 60_000;
const BACKGROUND_JOB_FAILURE_ALERT_ACTION = 'admin.background_jobs.failure_alerted';
const BACKGROUND_JOB_FAILURE_REGISTERED_ACTION = 'admin.background_jobs.failure_registered';
const BACKGROUND_JOB_FAILURE_ACKNOWLEDGED_ACTION = 'admin.background_jobs.failure_acknowledged';
const BACKGROUND_JOB_FAILURE_RESOLVED_ACTION = 'admin.background_jobs.failure_resolved';
const BACKGROUND_JOB_QUEUE_STALE_ALERT_ACTION = 'admin.background_jobs.queue_stale_alerted';
const BACKGROUND_JOB_QUEUE_STALE_RECOVERED_ACTION = 'admin.background_jobs.queue_stale_recovered';
const BACKGROUND_JOB_RECURRING_INCIDENT_OPENED_ACTION = 'admin.background_jobs.recurring_incident_opened';
const BACKGROUND_JOB_RECURRING_INCIDENT_RECOVERED_ACTION = 'admin.background_jobs.recurring_incident_recovered';
const SYSTEM_MONITOR_AUDIT_FIELDS = {
  actorId: null,
  actorKey: 'background-job-monitor',
  actorLabelSnapshot: 'HANDS background monitor',
  actorType: 'SYSTEM' as const,
  area: 'SYSTEM' as const,
  source: 'system_monitor',
} as const;
const BACKGROUND_JOB_FAILURE_REVIEW_ACTIONS = [
  BACKGROUND_JOB_FAILURE_ALERT_ACTION,
  BACKGROUND_JOB_FAILURE_REGISTERED_ACTION,
  BACKGROUND_JOB_FAILURE_ACKNOWLEDGED_ACTION,
  BACKGROUND_JOB_FAILURE_RESOLVED_ACTION,
] as const;
const BACKGROUND_JOB_FAILURE_ALERT_BATCH_SIZE = 25;
const BACKGROUND_JOB_RECURRING_INCIDENT_SCAN_LIMIT = 100;
const BACKGROUND_JOB_RECURRING_INCIDENT_FILTER_SCAN_LIMIT = 500;
const BACKGROUND_JOB_RECURRING_INCIDENT_SUMMARY_SCAN_LIMIT = 1_000;
const MISSING_DURABLE_JOB_SCAN_LIMIT = 100;
const MISSING_NOTIFICATION_JOB_MIN_AGE_MS = 30_000;

type DurableJobFlow =
  | 'bookingRecovery'
  | 'campaign'
  | 'notification'
  | 'paymentStatus'
  | 'refundStatus';

@Injectable()
export class AdminBackgroundJobsService {
  private readonly durableScanCursors: Partial<Record<DurableJobFlow, string>> = {};

  constructor(
    @InjectQueue(BANK_STATEMENT_ESCALATION_QUEUE_NAME)
    private readonly bankStatementEscalationQueue: Queue,
    @InjectQueue(BOOKING_TIMEOUT_QUEUE_NAME)
    private readonly bookingTimeoutQueue: Queue,
    @InjectQueue(NOTIFICATION_SEND_QUEUE_NAME)
    private readonly notificationSendQueue: Queue,
    @InjectQueue(PAYMENT_STATUS_CHECK_QUEUE_NAME)
    private readonly paymentStatusQueue: Queue,
    private readonly prisma: PrismaService,
    @Optional()
    @InjectQueue(PAYMENT_REFUND_STATUS_QUEUE_NAME)
    private readonly paymentRefundStatusQueue?: Queue,
    @Optional()
    @InjectQueue(ADMIN_PUSH_CAMPAIGN_QUEUE_NAME)
    private readonly adminPushCampaignQueue?: Queue,
    @Optional()
    @InjectQueue(PAYMENT_BOOKING_RECOVERY_QUEUE_NAME)
    private readonly paymentBookingRecoveryQueue?: Queue,
    @Optional()
    @InjectQueue(TAX_POLICY_ACTIVATION_QUEUE_NAME)
    private readonly taxPolicyActivationQueue?: Queue,
  ) {}

  async health(input: BackgroundJobHealthQueryDto = {}) {
    const generatedAt = new Date();
    const definitions = this.queueDefinitions();
    const queues = await Promise.all(
      definitions.map((definition) => backgroundQueueSnapshot(definition, generatedAt)),
    );
    const failedJobs = queues
      .flatMap((queue) => queue.failedJobs)
      .sort((left, right) => dateTimeMs(right.failedAt) - dateTimeMs(left.failedAt));
    const reviewedFailedJobs = await this.withFailureReviewState(failedJobs);
    const reviewedQueues = queues.map((queue) => ({
      ...queue,
      status: backgroundQueueStatus({
        active: queue.counts.active,
        expectedSchedulerPresent: queue.expectedSchedulerPresent,
        failed: queueHasUnresolvedFailure(queue, reviewedFailedJobs) ? 1 : 0,
        stale: queue.openJobLagMs > queue.staleAfterMs,
        workers: queue.workers,
      }),
    }));
    const [failurePage, healthEventPage, recurringIncidentPage, recurringIncidentSummary] = await Promise.all([
      this.failurePage(definitions, reviewedQueues, input, generatedAt),
      this.queueHealthEventPage(input, generatedAt),
      this.recurringIncidentPage(input, generatedAt),
      this.recurringIncidentSummary(input, generatedAt),
    ]);

    return {
      failedJobs: failurePage.items,
      failurePage: failurePage.page,
      generatedAt,
      healthEvents: healthEventPage.items,
      healthEventPage: healthEventPage.page,
      ok: reviewedQueues.every((queue) => !['ATTENTION', 'STALE'].includes(queue.status)),
      queues: reviewedQueues.map((queue) => ({
        counts: queue.counts,
        expectedSchedulerId: queue.expectedSchedulerId,
        expectedSchedulerPresent: queue.expectedSchedulerPresent,
        label: queue.label,
        lastCompletedAt: queue.lastCompletedAt,
        lastFailedAt: queue.lastFailedAt,
        name: queue.name,
        nextScheduledAt: queue.nextScheduledAt,
        oldestOpenJobAt: queue.oldestOpenJobAt,
        oldestOpenJobState: queue.oldestOpenJobState,
        openJobLagMs: queue.openJobLagMs,
        schedulerCount: queue.schedulerCount,
        staleAfterMs: queue.staleAfterMs,
        status: queue.status,
        workers: queue.workers,
      })),
      recurringIncidents: recurringIncidentPage.items,
      recurringIncidentPage: recurringIncidentPage.page,
      recurringIncidentSummary,
    };
  }

  async recurringIncidentDetail(
    rawIncidentId: string,
    input: BackgroundJobIncidentDetailQueryDto = {},
  ) {
    const incidentId = normalizeBackgroundJobIdentifier(rawIncidentId, 'Incident id');
    const opened = await this.prisma.adminAuditLog.findFirst({
      where: { action: BACKGROUND_JOB_RECURRING_INCIDENT_OPENED_ACTION, id: incidentId },
      select: {
        actor: { select: { email: true, fullName: true, id: true } },
        createdAt: true,
        id: true,
        metadata: true,
        target: true,
      },
    });
    if (!opened) throw new NotFoundException('Recurring background job incident not found');

    const [recovered, previousRecovery] = await Promise.all([
      this.prisma.adminAuditLog.findFirst({
        where: {
          action: BACKGROUND_JOB_RECURRING_INCIDENT_RECOVERED_ACTION,
          metadata: { path: ['openedAuditId'], equals: opened.id },
          target: opened.target,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          actor: { select: { email: true, fullName: true, id: true } },
          createdAt: true,
          id: true,
          metadata: true,
          target: true,
        },
      }),
      this.prisma.adminAuditLog.findFirst({
        where: {
          action: BACKGROUND_JOB_RECURRING_INCIDENT_RECOVERED_ACTION,
          createdAt: { lt: opened.createdAt },
          target: opened.target,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { createdAt: true },
      }),
    ]);
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? FAILED_JOB_LIST_DEFAULT_PAGE_SIZE;
    const originWhere: Prisma.AdminAuditLogWhereInput = {
      action: { in: [BACKGROUND_JOB_FAILURE_ALERT_ACTION, BACKGROUND_JOB_FAILURE_REGISTERED_ACTION] },
      createdAt: {
        ...(previousRecovery ? { gt: previousRecovery.createdAt } : {}),
        ...(recovered ? { lte: recovered.createdAt } : {}),
      },
      metadata: { path: ['incidentTarget'], equals: opened.target },
    };
    const [totalCount, origins] = await Promise.all([
      this.prisma.adminAuditLog.count({ where: originWhere }),
      this.prisma.adminAuditLog.findMany({
        where: originWhere,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          action: true,
          actor: { select: { email: true, fullName: true, id: true } },
          createdAt: true,
          id: true,
          metadata: true,
          target: true,
        },
      }),
    ]);
    const targets = origins.map((origin) => origin.target);
    const reviews = targets.length === 0
      ? []
      : await this.prisma.adminAuditLog.findMany({
          where: {
            action: { in: [...BACKGROUND_JOB_FAILURE_REVIEW_ACTIONS] },
            target: { in: targets },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            action: true,
            actor: { select: { email: true, fullName: true, id: true } },
            createdAt: true,
            metadata: true,
            target: true,
          },
        });
    const latestReviewByTarget = new Map(reviews.map((review) => [review.target, review]));

    return {
      failures: origins.map((origin) => backgroundRecurringIncidentFailure(
        origin,
        latestReviewByTarget.get(origin.target),
      )),
      incident: backgroundRecurringIncidentEpisode(opened, recovered ?? undefined),
      page: {
        hasNextPage: page * pageSize < totalCount,
        hasPreviousPage: page > 1,
        page,
        pageSize,
        totalCount,
      },
    };
  }

  private async queueHealthEventPage(input: BackgroundJobHealthQueryDto, generatedAt: Date) {
    const page = input.eventPage ?? 1;
    const pageSize = input.pageSize ?? FAILED_JOB_LIST_DEFAULT_PAGE_SIZE;
    const range = input.range ?? 'ALL';
    const queueFilter = input.queue ?? 'ALL';
    const eventStatus = input.eventStatus ?? 'ALL';
    const action = eventStatus === 'ALERTED'
      ? BACKGROUND_JOB_QUEUE_STALE_ALERT_ACTION
      : eventStatus === 'RECOVERED'
        ? BACKGROUND_JOB_QUEUE_STALE_RECOVERED_ACTION
        : { in: [BACKGROUND_JOB_QUEUE_STALE_ALERT_ACTION, BACKGROUND_JOB_QUEUE_STALE_RECOVERED_ACTION] };
    const cutoffMs = backgroundFailureRangeCutoff(range, generatedAt);
    const where: Prisma.AdminAuditLogWhereInput = {
      action,
      ...(queueFilter === 'ALL'
        ? {}
        : { target: `background_job_queue_health:${queueFilter}` }),
      ...(cutoffMs === null ? {} : { createdAt: { gte: new Date(cutoffMs) } }),
    };
    const [totalCount, rows] = await Promise.all([
      this.prisma.adminAuditLog.count({ where }),
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          action: true,
          createdAt: true,
          id: true,
          metadata: true,
          target: true,
          actor: { select: { email: true, fullName: true, id: true } },
        },
      }),
    ]);

    return {
      items: rows.map((row) => backgroundQueueHealthEvent(row)),
      page: {
        hasNextPage: page * pageSize < totalCount,
        hasPreviousPage: page > 1,
        page,
        pageSize,
        totalCount,
      },
    };
  }

  private async recurringIncidentPage(input: BackgroundJobHealthQueryDto, generatedAt: Date) {
    const page = input.incidentPage ?? 1;
    const pageSize = input.pageSize ?? FAILED_JOB_LIST_DEFAULT_PAGE_SIZE;
    const range = input.range ?? 'ALL';
    const queueFilter = input.queue ?? 'ALL';
    const incidentStatus = input.incidentStatus ?? 'ALL';
    const cutoffMs = backgroundFailureRangeCutoff(range, generatedAt);
    const where: Prisma.AdminAuditLogWhereInput = {
      action: BACKGROUND_JOB_RECURRING_INCIDENT_OPENED_ACTION,
      target: {
        startsWith: queueFilter === 'ALL'
          ? 'background_job_recurring_incident:'
          : `background_job_recurring_incident:${queueFilter}:`,
      },
      ...(cutoffMs === null ? {} : { createdAt: { gte: new Date(cutoffMs) } }),
    };
    const totalOpenedCount = await this.prisma.adminAuditLog.count({ where });
    if (incidentStatus !== 'ALL') {
      const openedRows = await this.prisma.adminAuditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: BACKGROUND_JOB_RECURRING_INCIDENT_FILTER_SCAN_LIMIT,
        select: {
          actor: { select: { email: true, fullName: true, id: true } },
          createdAt: true,
          id: true,
          metadata: true,
          target: true,
        },
      });
      const recoveredRows = await this.recurringIncidentRecoveries(openedRows);
      const recoveredByOpenedAuditId = new Map(
        recoveredRows.map((row) => [jsonString(jsonObject(row.metadata).openedAuditId), row]),
      );
      const filtered = openedRows
        .map((opened) => backgroundRecurringIncidentEpisode(
          opened,
          recoveredByOpenedAuditId.get(opened.id),
        ))
        .filter((incident) => incident.status === incidentStatus);
      const offset = (page - 1) * pageSize;
      const complete = totalOpenedCount <= BACKGROUND_JOB_RECURRING_INCIDENT_FILTER_SCAN_LIMIT;
      return {
        items: filtered.slice(offset, offset + pageSize),
        page: {
          complete,
          hasNextPage: filtered.length > offset + pageSize || !complete,
          hasPreviousPage: page > 1,
          page,
          pageSize,
          scannedCount: openedRows.length,
          totalCount: complete ? filtered.length : null,
        },
      };
    }

    const openedRows = await this.prisma.adminAuditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        actor: { select: { email: true, fullName: true, id: true } },
        createdAt: true,
        id: true,
        metadata: true,
        target: true,
      },
    });
    const recoveredRows = await this.recurringIncidentRecoveries(openedRows);
    const recoveredByOpenedAuditId = new Map(
      recoveredRows.map((row) => [jsonString(jsonObject(row.metadata).openedAuditId), row]),
    );

    return {
      items: openedRows.map((opened) => backgroundRecurringIncidentEpisode(
        opened,
        recoveredByOpenedAuditId.get(opened.id),
      )),
      page: {
        complete: true,
        hasNextPage: page * pageSize < totalOpenedCount,
        hasPreviousPage: page > 1,
        page,
        pageSize,
        scannedCount: openedRows.length,
        totalCount: totalOpenedCount,
      },
    };
  }

  private recurringIncidentRecoveries(openedRows: BackgroundRecurringIncidentAuditRow[]) {
    return openedRows.length === 0
      ? Promise.resolve([])
      : this.prisma.adminAuditLog.findMany({
          where: {
            action: BACKGROUND_JOB_RECURRING_INCIDENT_RECOVERED_ACTION,
            OR: openedRows.map((opened) => ({
              metadata: { path: ['openedAuditId'], equals: opened.id },
              target: opened.target,
            })),
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            actor: { select: { email: true, fullName: true, id: true } },
            createdAt: true,
            id: true,
            metadata: true,
            target: true,
          },
        });
  }

  private async recurringIncidentSummary(input: BackgroundJobHealthQueryDto, generatedAt: Date) {
    const queueFilter = input.queue ?? 'ALL';
    const cutoffMs = backgroundFailureRangeCutoff(input.range ?? 'ALL', generatedAt);
    const rows = await this.prisma.adminAuditLog.findMany({
      where: {
        action: {
          in: [
            BACKGROUND_JOB_RECURRING_INCIDENT_OPENED_ACTION,
            BACKGROUND_JOB_RECURRING_INCIDENT_RECOVERED_ACTION,
          ],
        },
        target: {
          startsWith: queueFilter === 'ALL'
            ? 'background_job_recurring_incident:'
            : `background_job_recurring_incident:${queueFilter}:`,
        },
        ...(cutoffMs === null ? {} : { createdAt: { gte: new Date(cutoffMs) } }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: BACKGROUND_JOB_RECURRING_INCIDENT_SUMMARY_SCAN_LIMIT,
      select: { action: true, id: true, metadata: true },
    });
    const recoveredOpenedAuditIds = new Set(rows
      .filter((row) => row.action === BACKGROUND_JOB_RECURRING_INCIDENT_RECOVERED_ACTION)
      .map((row) => jsonString(jsonObject(row.metadata).openedAuditId))
      .filter((id): id is string => Boolean(id)));
    const openedRows = rows.filter(
      (row) => row.action === BACKGROUND_JOB_RECURRING_INCIDENT_OPENED_ACTION,
    );
    const recoveredCount = openedRows.filter((row) => recoveredOpenedAuditIds.has(row.id)).length;

    return {
      complete: rows.length < BACKGROUND_JOB_RECURRING_INCIDENT_SUMMARY_SCAN_LIMIT,
      openCount: openedRows.length - recoveredCount,
      recoveredCount,
      scannedCount: rows.length,
    };
  }

  private async failurePage(
    definitions: BackgroundQueueDefinition[],
    queues: Array<Awaited<ReturnType<typeof backgroundQueueSnapshot>> & { status: BackgroundQueueStatus }>,
    input: BackgroundJobHealthQueryDto,
    generatedAt: Date,
  ) {
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? FAILED_JOB_LIST_DEFAULT_PAGE_SIZE;
    const jobIdFilter = input.jobId?.trim() || null;
    const queueFilter = input.queue ?? 'ALL';
    const reviewFilter = input.review ?? 'ALL';
    const range = input.range ?? 'ALL';
    const selectedDefinitions = definitions.filter(
      (definition) => queueFilter === 'ALL' || definition.queue.name === queueFilter,
    );
    const requestedRows = page * pageSize;
    const scanLimit = jobIdFilter
      ? FAILED_JOB_LIST_MAX_SCAN_PER_QUEUE
      : Math.min(
          FAILED_JOB_LIST_MAX_SCAN_PER_QUEUE,
          Math.max(pageSize + 1, requestedRows * 4),
        );
    const jobsByQueue = await Promise.all(selectedDefinitions.map(async (definition) => ({
      jobs: await definition.queue.getJobs('failed', 0, scanLimit - 1, false),
      queueName: definition.queue.name,
    })));
    const reviewed = await this.withFailureReviewState(
      jobsByQueue
        .flatMap(({ jobs, queueName }) => jobs.map((job) => backgroundFailedJob(queueName, job)))
        .sort((left, right) => dateTimeMs(right.failedAt) - dateTimeMs(left.failedAt)),
    );
    const cutoffMs = backgroundFailureRangeCutoff(range, generatedAt);
    const filtered = reviewed.filter((failure) => (
      (!jobIdFilter || failure.id === jobIdFilter) &&
      backgroundFailureMatchesReview(failure.review.status, reviewFilter) &&
      (cutoffMs === null || dateTimeMs(failure.failedAt) >= cutoffMs)
    ));
    const offset = (page - 1) * pageSize;
    const complete = jobsByQueue.every(({ jobs, queueName }) => {
      const failedCount = queues.find((queue) => queue.name === queueName)?.counts.failed ?? jobs.length;
      if (jobs.length >= failedCount) return true;
      if (cutoffMs === null || jobs.length === 0) return false;
      return dateTimeMs(backgroundFailedJob(queueName, jobs[jobs.length - 1]).failedAt) < cutoffMs;
    });

    return {
      items: filtered.slice(offset, offset + pageSize),
      page: {
        complete,
        hasNextPage: filtered.length > offset + pageSize || !complete,
        hasPreviousPage: page > 1,
        page,
        pageSize,
        scannedCount: reviewed.length,
        totalCount: complete ? filtered.length : null,
      },
    };
  }

  async syncFailureNotifications(now = new Date()) {
    const definitions = this.queueDefinitions();
    const candidates = (
      await Promise.all(
        definitions.map(async (definition) => {
          const jobs = await definition.queue.getJobs(
            'failed',
            0,
            FAILED_JOB_LIST_MAX_SCAN_PER_QUEUE - 1,
            false,
          );
          return jobs.map((job) => ({
            ...backgroundFailedJob(definition.queue.name, job),
            label: definition.label,
          }));
        }),
      )
    )
      .flat()
      .filter((failure) => failure.id);
    const failures = (await this.withFailureReviewState(candidates))
      .filter((failure) => failure.review.status === 'UNTRACKED')
      .sort((left, right) => dateTimeMs(left.failedAt) - dateTimeMs(right.failedAt));

    const results: Array<'ALERTED' | 'MISSING_RECIPIENT' | 'SKIPPED'> = [];
    for (const failure of failures.slice(0, BACKGROUND_JOB_FAILURE_ALERT_BATCH_SIZE)) {
      results.push(await this.alertBackgroundJobFailure(failure, now));
    }
    const recoveredIncidentCount = await this.syncRecurringFailureIncidentRecoveries(now);

    return {
      alertedCount: results.filter((result) => result === 'ALERTED').length,
      missingRecipientCount: results.filter((result) => result === 'MISSING_RECIPIENT').length,
      recoveredIncidentCount,
      scannedCount: candidates.length,
      skippedCount: results.filter((result) => result === 'SKIPPED').length,
    };
  }

  async syncQueueHealthAlerts(now = new Date()) {
    const snapshots = await Promise.all(
      this.queueDefinitions().map((definition) => backgroundQueueSnapshot(definition, now)),
    );
    const results: Array<'ALERTED' | 'MISSING_RECIPIENT' | 'RECOVERED' | 'SKIPPED'> = [];
    for (const snapshot of snapshots) {
      results.push(await this.syncQueueHealthAlert(snapshot, now));
    }
    return {
      alertedCount: results.filter((result) => result === 'ALERTED').length,
      missingRecipientCount: results.filter((result) => result === 'MISSING_RECIPIENT').length,
      recoveredCount: results.filter((result) => result === 'RECOVERED').length,
      scannedCount: snapshots.length,
      skippedCount: results.filter((result) => result === 'SKIPPED').length,
    };
  }

  async syncMissingDurableJobs(now = new Date()) {
    const notificationWindow = {
      lte: new Date(now.getTime() - MISSING_NOTIFICATION_JOB_MIN_AGE_MS),
    };
    const staleDeliveryBefore = new Date(now.getTime() - NOTIFICATION_DELIVERY_CLAIM_STALE_MS);
    const [payments, refunds, bookings, notifications, campaigns, staleDeliveries] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          method: { in: [PaymentMethod.MOMO, PaymentMethod.VNPAY] },
          status: { in: [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED] },
          OR: [
            { rawMeta: { path: ['authorizationState'], equals: 'INITIALIZING' } },
            { rawMeta: { path: ['authorizationState'], equals: 'RETRY_PENDING' } },
          ],
        },
        orderBy: { id: 'asc' },
        ...durableScanCursor(this.durableScanCursors.paymentStatus),
        select: { id: true },
        take: MISSING_DURABLE_JOB_SCAN_LIMIT,
      }),
      this.paymentRefundStatusQueue
        ? this.prisma.refund.findMany({
            where: {
              status: { in: ['APPROVAL_PROCESSING', 'PROVIDER_PROCESSING', 'GATEWAY_CONFIRMED'] },
            },
            orderBy: { id: 'asc' },
            ...durableScanCursor(this.durableScanCursors.refundStatus),
            select: { id: true },
            take: MISSING_DURABLE_JOB_SCAN_LIMIT,
          })
        : Promise.resolve([]),
      this.paymentBookingRecoveryQueue
        ? this.prisma.booking.findMany({
            where: {
              status: BookingStatus.CREATED,
              payment: {
                is: {
                  rawMeta: { path: ['authorizationState'], equals: 'READY' },
                  status: { in: [PaymentStatus.AUTHORIZED, PaymentStatus.CAPTURED] },
                },
              },
            },
            orderBy: { id: 'asc' },
            ...durableScanCursor(this.durableScanCursors.bookingRecovery),
            select: { id: true, payment: { select: { id: true } } },
            take: MISSING_DURABLE_JOB_SCAN_LIMIT,
          })
        : Promise.resolve([]),
      this.prisma.notification.findMany({
        where: {
          createdAt: notificationWindow,
          OR: [
            { deliveries: { none: {} } },
            { deliveries: { some: { status: 'FAILED' } } },
          ],
          user: { pushDevices: { some: { enabled: true } } },
          AND: [{ OR: [
            { data: { path: ['deliveryIntent'], equals: 'PUSH' } },
            { data: { path: ['deliveryIntent'], equals: 'PUSH_AND_IN_APP' } },
          ] }],
        },
        orderBy: { id: 'asc' },
        ...durableScanCursor(this.durableScanCursors.notification),
        select: {
          data: true,
          deliveries: {
            orderBy: [{ attemptedAt: 'desc' }, { id: 'desc' }],
            select: { pushDeviceId: true, response: true, status: true },
          },
          id: true,
          type: true,
          user: {
            select: {
              pushDevices: {
                where: { enabled: true },
                select: { id: true, role: true },
              },
            },
          },
        },
        take: MISSING_DURABLE_JOB_SCAN_LIMIT,
      }),
      this.adminPushCampaignQueue
        ? this.prisma.adminPushCampaign.findMany({
            where: {
              status: { in: ['QUEUED', 'PROCESSING', 'FAILED'] },
              recipients: {
                some: { status: { in: ['SNAPSHOTTED', 'PROCESSING'] } },
              },
            },
            orderBy: { id: 'asc' },
            ...durableScanCursor(this.durableScanCursors.campaign),
            select: { id: true },
            take: MISSING_DURABLE_JOB_SCAN_LIMIT,
          })
        : Promise.resolve([]),
      this.prisma.notificationDelivery.findMany({
        where: { status: 'PROCESSING', attemptedAt: { lte: staleDeliveryBefore } },
        orderBy: { attemptedAt: 'asc' },
        select: { id: true },
        take: MISSING_DURABLE_JOB_SCAN_LIMIT,
      }),
    ]);

    this.durableScanCursors.paymentStatus = nextDurableScanCursor(payments);
    this.durableScanCursors.refundStatus = nextDurableScanCursor(refunds);
    this.durableScanCursors.bookingRecovery = nextDurableScanCursor(bookings);
    this.durableScanCursors.notification = nextDurableScanCursor(notifications);
    this.durableScanCursors.campaign = nextDurableScanCursor(campaigns);

    const closedUncertainDeliveryCount = staleDeliveries.length === 0
      ? 0
      : (await this.prisma.notificationDelivery.updateMany({
          where: {
            id: { in: staleDeliveries.map((delivery) => delivery.id) },
            status: 'PROCESSING',
            attemptedAt: { lte: staleDeliveryBefore },
          },
          data: {
            status: 'FAILED',
            response: toJson({
              failureCode: NOTIFICATION_DELIVERY_UNKNOWN_CODE,
              reason: 'The worker stopped after delivery started, so the provider outcome is unknown.',
              reconciledAt: now.toISOString(),
            }),
          },
        })).count;

    const registrations = [
      ...payments.map((payment) => {
        const job = paymentStatusCheckJob(payment.id);
        return this.registerMissingJob('paymentStatus', this.paymentStatusQueue, job);
      }),
      ...(this.paymentRefundStatusQueue
        ? refunds.map((refund) => {
            const job = paymentRefundStatusJob(refund.id);
            return this.registerMissingJob('refundStatus', this.paymentRefundStatusQueue!, job);
          })
        : []),
      ...(this.paymentBookingRecoveryQueue
        ? bookings.flatMap((booking) => {
            if (!booking.payment) return [];
            const job = paymentBookingRecoveryJob({
              bookingId: booking.id,
              paymentId: booking.payment.id,
            });
            return [this.registerMissingJob(
              'bookingRecovery',
              this.paymentBookingRecoveryQueue!,
              job,
            )];
          })
        : []),
      ...notifications.filter(notificationNeedsDurableJob).map((notification) => {
        const job = notificationSendJob(notification.id);
        return this.registerMissingJob('notification', this.notificationSendQueue, job);
      }),
      ...(this.adminPushCampaignQueue
        ? campaigns.map((campaign) => {
            const job = adminPushCampaignJob(campaign.id);
            return this.registerMissingJob('campaign', this.adminPushCampaignQueue!, job);
          })
        : []),
    ];
    const results = await Promise.all(registrations);
    const failedCount = results.filter((result) => result.status === 'FAILED').length;
    if (failedCount > 0) {
      throw new Error(`Failed to register ${failedCount} durable background job(s)`);
    }
    const byFlow = Object.fromEntries(
      ['paymentStatus', 'refundStatus', 'bookingRecovery', 'notification', 'campaign'].map((flow) => {
        const flowResults = results.filter((result) => result.flow === flow);
        return [flow, {
          existingCount: flowResults.filter((result) => result.status === 'EXISTING').length,
          failedCount: flowResults.filter((result) => result.status === 'FAILED').length,
          registeredCount: flowResults.filter((result) => result.status === 'REGISTERED').length,
          retriedCount: flowResults.filter((result) => result.status === 'RETRIED').length,
        }];
      }),
    );

    return {
      byFlow,
      closedUncertainDeliveryCount,
      existingCount: results.filter((result) => result.status === 'EXISTING').length,
      failedCount,
      registeredCount: results.filter((result) => result.status === 'REGISTERED').length,
      retriedCount: results.filter((result) => result.status === 'RETRIED').length,
      scannedCount: payments.length + refunds.length + bookings.length + notifications.length + campaigns.length,
    };
  }

  acknowledgeFailure(
    actorId: string,
    queueName: string,
    jobId: string,
    operatorIdentity?: string,
  ) {
    return this.recordFailureReview(
      actorId,
      queueName,
      jobId,
      BACKGROUND_JOB_FAILURE_ACKNOWLEDGED_ACTION,
      undefined,
      operatorIdentity,
    );
  }

  resolveFailure(
    actorId: string,
    queueName: string,
    jobId: string,
    reason: string,
    operatorIdentity?: string,
  ) {
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 3) {
      throw new BadRequestException('Resolution note must be at least 3 characters');
    }
    return this.recordFailureReview(
      actorId,
      queueName,
      jobId,
      BACKGROUND_JOB_FAILURE_RESOLVED_ACTION,
      normalizedReason,
      operatorIdentity,
    );
  }

  private queueDefinitions(): BackgroundQueueDefinition[] {
    return [
      {
        expectedSchedulerIds: [
          BANK_STATEMENT_ESCALATION_SCHEDULER_ID,
          BACKGROUND_JOB_FAILURE_MONITOR_SCHEDULER_ID,
        ],
        label: 'Bank statement escalation',
        queue: this.bankStatementEscalationQueue,
        staleAfterMs: 2 * BANK_STATEMENT_ESCALATION_INTERVAL_MS,
      },
      {
        label: 'Booking timeout',
        queue: this.bookingTimeoutQueue,
        staleAfterMs: IMMEDIATE_QUEUE_STALE_AFTER_MS,
      },
      {
        label: 'Notification delivery',
        queue: this.notificationSendQueue,
        staleAfterMs: IMMEDIATE_QUEUE_STALE_AFTER_MS,
      },
      {
        label: 'Payment status check',
        queue: this.paymentStatusQueue,
        staleAfterMs: IMMEDIATE_QUEUE_STALE_AFTER_MS,
      },
      ...(this.paymentRefundStatusQueue ? [{
        label: 'Provider refund status',
        queue: this.paymentRefundStatusQueue,
        staleAfterMs: IMMEDIATE_QUEUE_STALE_AFTER_MS,
      }] : []),
      ...(this.adminPushCampaignQueue ? [{
        label: 'Admin push campaigns',
        queue: this.adminPushCampaignQueue,
        staleAfterMs: IMMEDIATE_QUEUE_STALE_AFTER_MS,
      }] : []),
      ...(this.paymentBookingRecoveryQueue ? [{
        label: 'Payment booking recovery',
        queue: this.paymentBookingRecoveryQueue,
        staleAfterMs: IMMEDIATE_QUEUE_STALE_AFTER_MS,
      }] : []),
      ...(this.taxPolicyActivationQueue ? [{
        expectedSchedulerIds: [TAX_POLICY_ACTIVATION_SWEEP_SCHEDULER_ID],
        label: 'Tax policy activation',
        queue: this.taxPolicyActivationQueue,
        staleAfterMs: IMMEDIATE_QUEUE_STALE_AFTER_MS,
      }] : []),
    ];
  }

  private async registerMissingJob(
    flow: string,
    queue: Queue,
    job: { data: Record<string, unknown>; name: string; options: JobsOptions },
  ) {
    try {
      const result = await registerOrRetryBullJob(queue, job);
      return { flow, status: result.status };
    } catch {
      return { flow, status: 'FAILED' as const };
    }
  }

  private alertBackgroundJobFailure(
    failure: ReturnType<typeof backgroundFailedJob> & { label: string },
    triggeredAt: Date,
  ) {
    const target = `background_job_failure:${failure.queueName}:${failure.id}`;
    const incidentTarget = backgroundRecurringFailureIncidentTarget(failure);

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(backgroundJobAdvisoryLock(incidentTarget ?? target));

      const existing = await tx.adminAuditLog.findFirst({
        where: { action: { in: [...BACKGROUND_JOB_FAILURE_REVIEW_ACTIONS] }, target },
        select: { id: true },
      });
      if (existing) return 'SKIPPED' as const;

      if (incidentTarget) {
        const latestIncident = await tx.adminAuditLog.findFirst({
          where: {
            action: {
              in: [
                BACKGROUND_JOB_RECURRING_INCIDENT_OPENED_ACTION,
                BACKGROUND_JOB_RECURRING_INCIDENT_RECOVERED_ACTION,
              ],
            },
            target: incidentTarget,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { action: true, actorId: true, id: true },
        });
        if (latestIncident?.action === BACKGROUND_JOB_RECURRING_INCIDENT_OPENED_ACTION) {
          await tx.adminAuditLog.create({
            data: {
              ...SYSTEM_MONITOR_AUDIT_FIELDS,
              action: BACKGROUND_JOB_FAILURE_REGISTERED_ACTION,
              outcome: 'RECORDED',
              severity: 'INFO',
              target,
              metadata: {
                failedAt: failure.failedAt,
                incidentAuditId: latestIncident.id,
                incidentTarget,
                jobId: failure.id,
                jobName: failure.name,
                queueName: failure.queueName,
                source: 'background_job_recurring_incident',
              },
            },
          });
          return 'SKIPPED' as const;
        }
      }

      const recipients = await tx.user.findMany({
        where: { roles: { has: Role.MASTER_ADMIN } },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (recipients.length === 0) return 'MISSING_RECIPIENT' as const;

      const incident = incidentTarget
        ? await tx.adminAuditLog.create({
            data: {
              ...SYSTEM_MONITOR_AUDIT_FIELDS,
              action: BACKGROUND_JOB_RECURRING_INCIDENT_OPENED_ACTION,
              outcome: 'OPENED',
              severity: 'REVIEW',
              target: incidentTarget,
              metadata: {
                firstFailureAt: failure.failedAt,
                firstFailureJobId: failure.id,
                firstFailureTarget: target,
                jobName: failure.name,
                queueName: failure.queueName,
                recipientAdminIds: recipients.map((recipient) => recipient.id),
                source: 'system_monitor',
              },
            },
            select: { id: true },
          })
        : null;
      const notificationIds: string[] = [];
      for (const recipient of recipients) {
        const notification = await tx.notification.create({
          data: {
            userId: recipient.id,
            type: 'admin.system.background_job.failed',
            title: 'Background job needs attention',
            body: `${failure.label} has a failed job that needs review.`,
            data: toJson(notificationDataWithDeliveryContract({
              destination: incident
                ? `/background-jobs/incidents/${encodeURIComponent(incident.id)}`
                : '/background-jobs',
              ...(incident ? { incidentId: incident.id } : {}),
              ...(incident ? {
                incidentOpenedAt: triggeredAt.toISOString(),
                incidentStatus: 'OPEN',
              } : {}),
              jobId: failure.id,
              queueName: failure.queueName,
              source: 'background_job_failure_monitor',
            }, 'IN_APP_ONLY')),
          },
          select: { id: true },
        });
        notificationIds.push(notification.id);
      }

      await tx.adminAuditLog.create({
        data: {
          ...SYSTEM_MONITOR_AUDIT_FIELDS,
          action: BACKGROUND_JOB_FAILURE_ALERT_ACTION,
          outcome: 'OPENED',
          severity: 'REVIEW',
          target,
          metadata: {
            attemptsMade: failure.attemptsMade,
            failedAt: failure.failedAt,
            jobId: failure.id,
            jobName: failure.name,
            notificationIds,
            queueName: failure.queueName,
            reference: failure.reference,
            recipientAdminIds: recipients.map((recipient) => recipient.id),
            source: 'system_monitor',
            triggeredAt: triggeredAt.toISOString(),
            ...(incidentTarget ? {
              incidentAuditId: incident?.id,
              incidentTarget,
              jobName: failure.name,
            } : {}),
          },
        },
      });

      return 'ALERTED' as const;
    });
  }

  private async syncRecurringFailureIncidentRecoveries(now: Date) {
    let recoveredCount = 0;
    for (const definition of this.queueDefinitions()) {
      const incidentPrefix = `background_job_recurring_incident:${definition.queue.name}:`;
      const incidentLogs = await this.prisma.adminAuditLog.findMany({
        where: {
          action: {
            in: [
              BACKGROUND_JOB_RECURRING_INCIDENT_OPENED_ACTION,
              BACKGROUND_JOB_RECURRING_INCIDENT_RECOVERED_ACTION,
            ],
          },
          target: { startsWith: incidentPrefix },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: BACKGROUND_JOB_RECURRING_INCIDENT_SCAN_LIMIT,
        select: {
          action: true,
          actorId: true,
          createdAt: true,
          id: true,
          metadata: true,
          target: true,
        },
      });
      const latestByTarget = new Map<string, typeof incidentLogs[number]>();
      for (const log of incidentLogs) {
        if (!latestByTarget.has(log.target)) latestByTarget.set(log.target, log);
      }
      const openIncidents = [...latestByTarget.values()].filter(
        (log) => log.action === BACKGROUND_JOB_RECURRING_INCIDENT_OPENED_ACTION,
      );
      if (openIncidents.length === 0) continue;

      const [completedJobs, failedJobs] = await Promise.all([
        definition.queue.getJobs('completed', 0, BACKGROUND_JOB_RECURRING_INCIDENT_SCAN_LIMIT - 1, false),
        definition.queue.getJobs('failed', 0, BACKGROUND_JOB_RECURRING_INCIDENT_SCAN_LIMIT - 1, false),
      ]);
      for (const incident of openIncidents) {
        const metadata = jsonObject(incident.metadata);
        const jobName = jsonString(metadata.jobName);
        if (!jobName) continue;
        const completedJob = completedJobs.find((job) => (
          job.name === jobName && dateTimeMs(jobFinishedAt(job)) > incident.createdAt.getTime()
        ));
        const completedAt = jobFinishedAt(completedJob);
        if (!completedAt) continue;
        const failureTargets = failedJobs
          .filter((job) => (
            job.name === jobName && dateTimeMs(jobFinishedAt(job)) >= incident.createdAt.getTime()
          ))
          .map((job) => backgroundFailureTarget(definition.queue.name, job.id ? String(job.id) : null))
          .filter((target): target is string => Boolean(target));
        const recovered = await this.recoverRecurringFailureIncident({
          completedAt,
          failureTargets: [...new Set(failureTargets)],
          incidentTarget: incident.target,
          jobName,
          now,
          queueName: definition.queue.name,
        });
        if (recovered) recoveredCount += 1;
      }
    }
    return recoveredCount;
  }

  private recoverRecurringFailureIncident(input: {
    completedAt: string;
    failureTargets: string[];
    incidentTarget: string;
    jobName: string;
    now: Date;
    queueName: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(backgroundJobAdvisoryLock(input.incidentTarget));
      const latestIncident = await tx.adminAuditLog.findFirst({
        where: {
          action: {
            in: [
              BACKGROUND_JOB_RECURRING_INCIDENT_OPENED_ACTION,
              BACKGROUND_JOB_RECURRING_INCIDENT_RECOVERED_ACTION,
            ],
          },
          target: input.incidentTarget,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { action: true, actorId: true, id: true },
      });
      if (latestIncident?.action !== BACKGROUND_JOB_RECURRING_INCIDENT_OPENED_ACTION) return false;

      const reviewLogs = input.failureTargets.length > 0
        ? await tx.adminAuditLog.findMany({
            where: {
              action: { in: [...BACKGROUND_JOB_FAILURE_REVIEW_ACTIONS] },
              target: { in: input.failureTargets },
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: { action: true, target: true },
          })
        : [];
      const latestReviewByTarget = new Map(reviewLogs.map((log) => [log.target, log.action]));
      const reason = 'Recurring background job completed successfully after the failure incident.';
      for (const target of input.failureTargets) {
        if (backgroundFailureReviewStatus(latestReviewByTarget.get(target)) === 'RESOLVED') continue;
        await tx.adminAuditLog.create({
          data: {
            ...SYSTEM_MONITOR_AUDIT_FIELDS,
            action: BACKGROUND_JOB_FAILURE_RESOLVED_ACTION,
            outcome: 'RESOLVED',
            severity: 'NOTICE',
            target,
            metadata: {
              completedAt: input.completedAt,
              incidentTarget: input.incidentTarget,
              jobName: input.jobName,
              queueName: input.queueName,
              reason,
              source: 'background_job_recurring_incident_recovery',
            },
          },
        });
      }
      await tx.adminAuditLog.create({
        data: {
          ...SYSTEM_MONITOR_AUDIT_FIELDS,
          action: BACKGROUND_JOB_RECURRING_INCIDENT_RECOVERED_ACTION,
          outcome: 'RESOLVED',
          severity: 'NOTICE',
          target: input.incidentTarget,
          metadata: {
            completedAt: input.completedAt,
            jobName: input.jobName,
            openedAuditId: latestIncident.id,
            queueName: input.queueName,
            recoveredAt: input.now.toISOString(),
            resolvedFailureCount: input.failureTargets.length,
            source: 'system_monitor',
          },
        },
      });
      await tx.$executeRaw(Prisma.sql`
        UPDATE "Notification"
        SET "data" = jsonb_set(
          jsonb_set(
            COALESCE("data", '{}'::jsonb),
            '{incidentStatus}',
            to_jsonb(${'RECOVERED'}::text),
            true
          ),
          '{incidentRecoveredAt}',
          to_jsonb(${input.now.toISOString()}::text),
          true
        )
        WHERE "type" = 'admin.system.background_job.failed'
          AND "data"->>'incidentId' = ${latestIncident.id}
      `);
      return true;
    });
  }

  private syncQueueHealthAlert(
    queue: Awaited<ReturnType<typeof backgroundQueueSnapshot>>,
    detectedAt: Date,
  ) {
    const target = `background_job_queue_health:${queue.name}`;
    const healthReasons = backgroundQueueHealthReasons(queue);
    const needsAttention = healthReasons.length > 0;

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(backgroundJobAdvisoryLock(target));
      const latest = await tx.adminAuditLog.findFirst({
        where: {
          action: {
            in: [
              BACKGROUND_JOB_QUEUE_STALE_ALERT_ACTION,
              BACKGROUND_JOB_QUEUE_STALE_RECOVERED_ACTION,
            ],
          },
          target,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { action: true, actorId: true, id: true },
      });

      if (!needsAttention) {
        if (latest?.action !== BACKGROUND_JOB_QUEUE_STALE_ALERT_ACTION) return 'SKIPPED' as const;
        await tx.adminAuditLog.create({
          data: {
            ...SYSTEM_MONITOR_AUDIT_FIELDS,
            action: BACKGROUND_JOB_QUEUE_STALE_RECOVERED_ACTION,
            outcome: 'RESOLVED',
            severity: 'NOTICE',
            target,
            metadata: {
              detectedAt: detectedAt.toISOString(),
              openJobLagMs: queue.openJobLagMs,
              healthReasons,
              previousAlertAuditId: latest.id,
              queueName: queue.name,
              source: 'system_monitor',
              staleAfterMs: queue.staleAfterMs,
            },
          },
        });
        return 'RECOVERED' as const;
      }

      if (latest?.action === BACKGROUND_JOB_QUEUE_STALE_ALERT_ACTION) return 'SKIPPED' as const;
      const recipients = await tx.user.findMany({
        where: { roles: { has: Role.MASTER_ADMIN } },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (recipients.length === 0) return 'MISSING_RECIPIENT' as const;

      const notificationIds: string[] = [];
      for (const recipient of recipients) {
        const notification = await tx.notification.create({
          data: {
            userId: recipient.id,
            type: 'admin.system.background_job.queue_stale',
            title: 'Background queue needs attention',
            body: `${queue.label} requires review: ${healthReasons.join(', ')}.`,
            data: toJson(notificationDataWithDeliveryContract({
              destination: `/background-jobs?queue=${encodeURIComponent(queue.name)}&review=OPEN&range=ALL`,
              queueName: queue.name,
              source: 'background_job_queue_health_monitor',
            }, 'IN_APP_ONLY')),
          },
          select: { id: true },
        });
        notificationIds.push(notification.id);
      }
      await tx.adminAuditLog.create({
        data: {
          ...SYSTEM_MONITOR_AUDIT_FIELDS,
          action: BACKGROUND_JOB_QUEUE_STALE_ALERT_ACTION,
          outcome: 'OPENED',
          severity: 'REVIEW',
          target,
          metadata: {
            detectedAt: detectedAt.toISOString(),
            healthReasons,
            notificationIds,
            oldestOpenJobAt: queue.oldestOpenJobAt,
            oldestOpenJobState: queue.oldestOpenJobState,
            openJobLagMs: queue.openJobLagMs,
            queueName: queue.name,
            recipientAdminIds: recipients.map((recipient) => recipient.id),
            source: 'system_monitor',
            staleAfterMs: queue.staleAfterMs,
          },
        },
      });
      return 'ALERTED' as const;
    });
  }

  private async withFailureReviewState<T extends ReturnType<typeof backgroundFailedJob>>(
    failedJobs: T[],
  ) {
    const targets = failedJobs
      .map((failure) => backgroundFailureTarget(failure.queueName, failure.id))
      .filter((target): target is string => Boolean(target));
    const reviews = targets.length
      ? await this.prisma.adminAuditLog.findMany({
          where: {
            action: { in: [...BACKGROUND_JOB_FAILURE_REVIEW_ACTIONS] },
            target: { in: targets },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            action: true,
            target: true,
            createdAt: true,
            metadata: true,
            actor: { select: { id: true, email: true, fullName: true } },
          },
        })
      : [];
    const latestReviewByTarget = new Map(reviews.map((review) => [review.target, review]));

    return failedJobs.map((failure) => {
      const target = backgroundFailureTarget(failure.queueName, failure.id);
      const review = target ? latestReviewByTarget.get(target) : undefined;
      return {
        ...failure,
        review: {
          actor: review?.actor ?? null,
          reason: review ? jsonString(jsonObject(review.metadata).reason) : null,
          status: backgroundFailureReviewStatus(review?.action),
          updatedAt: review?.createdAt.toISOString() ?? null,
        },
      };
    });
  }

  private async recordFailureReview(
    actorId: string,
    rawQueueName: string,
    rawJobId: string,
    action:
      | typeof BACKGROUND_JOB_FAILURE_ACKNOWLEDGED_ACTION
      | typeof BACKGROUND_JOB_FAILURE_RESOLVED_ACTION,
    reason?: string,
    operatorIdentity?: string,
  ) {
    const queueName = normalizeBackgroundJobIdentifier(rawQueueName, 'Queue name');
    const jobId = normalizeBackgroundJobIdentifier(rawJobId, 'Job id');
    const definition = this.queueDefinitions().find((candidate) => candidate.queue.name === queueName);
    if (!definition) throw new NotFoundException('Monitored background queue not found');
    const job = await definition.queue.getJob(jobId);
    if (!job || await job.getState() !== 'failed') {
      throw new NotFoundException('Retained failed background job not found');
    }
    const target = backgroundFailureTarget(queueName, jobId);
    if (!target) throw new NotFoundException('Retained failed background job not found');

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(backgroundJobAdvisoryLock(target));
      const normalizedOperatorIdentity = operatorIdentity?.trim() || null;
      const operatorSelect = {
        id: true,
        roles: true,
        adminOperatorPermission: { select: { categories: true } },
      } as const;
      let operator = await tx.user.findFirst({
        where: {
          roles: { has: Role.ADMIN },
          OR: [
            { id: normalizedOperatorIdentity || actorId },
            { email: normalizedOperatorIdentity || actorId },
            { phone: normalizedOperatorIdentity || actorId },
          ],
        },
        select: operatorSelect,
      });
      if (!operator && normalizedOperatorIdentity && isConfiguredAdminWebMaster(normalizedOperatorIdentity)) {
        const authenticatedActor = await tx.user.findFirst({
          where: { id: actorId, roles: { has: Role.ADMIN } },
          select: operatorSelect,
        });
        operator = authenticatedActor?.roles.includes(Role.MASTER_ADMIN) ? authenticatedActor : null;
      }
      const categories = operator?.adminOperatorPermission?.categories ?? [];
      if (
        !operator ||
        (!operator.roles.includes(Role.MASTER_ADMIN) &&
          !categories.includes(AdminOperatorPermissionCategory.SYSTEM_SETUP))
      ) {
        throw new ForbiddenException('Developer/System health access is required');
      }

      const reviewLogs = await tx.adminAuditLog.findMany({
        where: {
          action: { in: [...BACKGROUND_JOB_FAILURE_REVIEW_ACTIONS] },
          target,
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { action: true, createdAt: true, metadata: true },
      });
      let origin = reviewLogs.find((log) => (
        log.action === BACKGROUND_JOB_FAILURE_ALERT_ACTION ||
        log.action === BACKGROUND_JOB_FAILURE_REGISTERED_ACTION
      ));
      if (!origin && action === BACKGROUND_JOB_FAILURE_ACKNOWLEDGED_ACTION) {
        origin = await tx.adminAuditLog.create({
          data: {
            actorId: operator.id,
            action: BACKGROUND_JOB_FAILURE_REGISTERED_ACTION,
            target,
            metadata: {
              failure: sanitizeFailureReason(job.failedReason),
              jobId,
              queueName,
              source: 'background_jobs_admin_manual_capture',
            },
          },
          select: { action: true, createdAt: true, metadata: true },
        });
        reviewLogs.push(origin);
      }
      if (!origin) throw new BadRequestException('Background job failure must be acknowledged before resolution');
      const latest = reviewLogs.at(-1);
      const latestStatus = backgroundFailureReviewStatus(latest?.action);
      if (latestStatus === 'RESOLVED' || (latestStatus === 'ACKNOWLEDGED' && action === BACKGROUND_JOB_FAILURE_ACKNOWLEDGED_ACTION)) {
        return {
          ok: true,
          status: latestStatus,
          updatedAt: latest?.createdAt ?? null,
        };
      }
      if (
        action === BACKGROUND_JOB_FAILURE_RESOLVED_ACTION &&
        latestStatus !== 'ACKNOWLEDGED'
      ) {
        throw new BadRequestException('Background job failure must be acknowledged before resolution');
      }

      const createdAt = new Date();
      const review = await tx.adminAuditLog.create({
        data: {
          actorId: operator.id,
          action,
          target,
          metadata: {
            jobId,
            operatorIdentity: operatorIdentity?.trim() || operator.id,
            queueName,
            ...(reason ? { reason } : {}),
            source: 'background_jobs_admin_review',
          },
          createdAt,
        },
        select: { id: true, createdAt: true },
      });
      const notificationIds = jsonStringArray(jsonObject(origin.metadata).notificationIds);
      if (notificationIds.length > 0) {
        await tx.notification.updateMany({
          where: { id: { in: notificationIds }, userId: operator.id },
          data: { readAt: createdAt },
        });
      }

      return {
        ok: true,
        status: backgroundFailureReviewStatus(action),
        updatedAt: review.createdAt,
      };
    });
    if (action === BACKGROUND_JOB_FAILURE_RESOLVED_ACTION) {
      try {
        if ((await job.getState()) === 'failed') {
          await job.remove();
        }
      } catch {
        throw new ServiceUnavailableException(
          'Background job resolution was recorded, but the retained failure could not be cleared',
        );
      }
    }
    return result;
  }
}

async function backgroundQueueSnapshot(definition: BackgroundQueueDefinition, now: Date) {
  const [
    counts,
    workers,
    schedulers,
    completedJobs,
    failedJobs,
    waitingJobs,
    activeJobs,
    delayedJobs,
  ] = await Promise.all([
    definition.queue.getJobCounts('active', 'delayed', 'failed', 'paused', 'waiting'),
    definition.queue.getWorkersCount(),
    definition.queue.getJobSchedulers(0, 9, true),
    definition.queue.getJobs('completed', 0, 0, false),
    definition.queue.getJobs('failed', 0, FAILED_JOB_LIMIT_PER_QUEUE - 1, false),
    definition.queue.getJobs('waiting', 0, 0, true),
    definition.queue.getJobs('active', 0, 0, true),
    definition.queue.getJobs('delayed', 0, 0, true),
  ]);
  const oldestOpenJob = backgroundQueueOpenJobLag(
    now,
    waitingJobs[0],
    activeJobs[0],
    delayedJobs[0],
  );
  const expectedSchedulerPresent = definition.expectedSchedulerIds?.length
    ? definition.expectedSchedulerIds.every((schedulerId) =>
        schedulers.some((scheduler) => scheduler.key === schedulerId),
      )
    : true;
  const status = backgroundQueueStatus({
    active: counts.active ?? 0,
    expectedSchedulerPresent,
    failed: counts.failed ?? 0,
    stale: oldestOpenJob !== null && oldestOpenJob.lagMs > definition.staleAfterMs,
    workers,
  });

  return {
    counts: {
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
      failed: counts.failed ?? 0,
      paused: counts.paused ?? 0,
      waiting: counts.waiting ?? 0,
    },
    expectedSchedulerId: definition.expectedSchedulerIds?.[0] ?? null,
    expectedSchedulerPresent,
    failedJobs: failedJobs.map((job) => backgroundFailedJob(definition.queue.name, job)),
    label: definition.label,
    lastCompletedAt: jobFinishedAt(completedJobs[0]),
    lastFailedAt: jobFinishedAt(failedJobs[0]),
    name: definition.queue.name,
    nextScheduledAt: unixMsToIso(firstScheduledAt(schedulers)),
    oldestOpenJobAt: oldestOpenJob?.referenceAt ?? null,
    oldestOpenJobState: oldestOpenJob?.state ?? null,
    openJobLagMs: oldestOpenJob?.lagMs ?? 0,
    schedulerCount: schedulers.length,
    staleAfterMs: definition.staleAfterMs,
    status,
    workers,
  };
}

function durableScanCursor(
  cursor: string | undefined,
): { cursor?: { id: string }; skip?: number } {
  return cursor ? { cursor: { id: cursor }, skip: 1 } : {};
}

function nextDurableScanCursor(rows: Array<{ id: string }>) {
  return rows.length === MISSING_DURABLE_JOB_SCAN_LIMIT ? rows.at(-1)?.id : undefined;
}

function backgroundQueueStatus(input: {
  active: number;
  expectedSchedulerPresent: boolean;
  failed: number;
  stale: boolean;
  workers: number;
}): BackgroundQueueStatus {
  if (input.failed > 0 || input.workers === 0 || !input.expectedSchedulerPresent) {
    return 'ATTENTION';
  }
  if (input.stale) return 'STALE';
  return input.active > 0 ? 'RUNNING' : 'HEALTHY';
}

function backgroundQueueHealthReasons(queue: {
  expectedSchedulerPresent: boolean;
  openJobLagMs: number;
  staleAfterMs: number;
  workers: number;
}) {
  return [
    ...(queue.openJobLagMs > queue.staleAfterMs ? ['PROCESSING_STALE'] : []),
    ...(queue.workers === 0 ? ['NO_WORKERS'] : []),
    ...(!queue.expectedSchedulerPresent ? ['SCHEDULER_MISSING'] : []),
  ];
}

function notificationNeedsDurableJob(notification: {
  data: unknown;
  deliveries: Array<{
    pushDeviceId: string | null;
    response: unknown;
    status: string;
  }>;
  type: string;
  user: { pushDevices: Array<{ id: string; role: Role | null }> };
}) {
  const targetRole = notificationTargetRole(notification);
  const roleNeutral = isRoleNeutralNotificationType(notification.type);
  const devices = notification.user.pushDevices.filter((device) =>
    roleNeutral || pushDeviceMatchesTargetRole(device, targetRole),
  );
  if (devices.length === 0) return false;

  const latestByDevice = new Map<string, (typeof notification.deliveries)[number]>();
  for (const delivery of notification.deliveries) {
    if (delivery.pushDeviceId && !latestByDevice.has(delivery.pushDeviceId)) {
      latestByDevice.set(delivery.pushDeviceId, delivery);
    }
  }
  return devices.some((device) => {
    const latest = latestByDevice.get(device.id);
    return !latest || (
      latest.status === 'FAILED' &&
      notificationRetryFailureClass(notificationDeliveryFailureCode(latest.response)) === 'transient'
    );
  });
}

function backgroundQueueOpenJobLag(
  now: Date,
  waitingJob: Job | undefined,
  activeJob: Job | undefined,
  delayedJob: Job | undefined,
) {
  const candidates = [
    backgroundQueueLagCandidate('WAITING', waitingJob?.timestamp),
    backgroundQueueLagCandidate('ACTIVE', activeJob?.processedOn ?? activeJob?.timestamp),
    backgroundQueueLagCandidate(
      'DELAYED',
      delayedJob ? delayedJob.timestamp + nonNegativeInteger(delayedJob.delay) : undefined,
    ),
  ].filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
  if (candidates.length === 0) return null;
  const nowMs = now.getTime();
  return candidates
    .map((candidate) => ({
      ...candidate,
      lagMs: Math.max(0, nowMs - candidate.referenceMs),
    }))
    .sort((left, right) => right.lagMs - left.lagMs || left.referenceMs - right.referenceMs)
    .map(({ referenceMs, ...candidate }) => ({
      ...candidate,
      referenceAt: unixMsToIso(referenceMs),
    }))[0];
}

function backgroundQueueLagCandidate(
  state: 'ACTIVE' | 'DELAYED' | 'WAITING',
  referenceMs: number | null | undefined,
) {
  return typeof referenceMs === 'number' && Number.isFinite(referenceMs)
    ? { referenceMs, state }
    : null;
}

function backgroundFailedJob(queueName: string, job: Job) {
  const attemptsMade = nonNegativeInteger(job.attemptsMade);
  return {
    attemptsMade,
    execution: {
      attemptsMade,
      failedAt: jobFinishedAt(job),
      lastStartedAt: unixMsToIso(job.processedOn),
      maxAttempts: Math.max(attemptsMade, positiveInteger(job.opts?.attempts, 1)),
      queuedAt: unixMsToIso(job.timestamp),
    },
    failedAt: jobFinishedAt(job),
    failure: sanitizeFailureReason(job.failedReason),
    id: job.id ? String(job.id) : null,
    name: job.name,
    queueName,
    reference: backgroundJobReference(queueName, job.data),
  };
}

function backgroundJobReference(queueName: string, value: unknown) {
  const data = unknownRecord(value);
  if (queueName === BOOKING_TIMEOUT_QUEUE_NAME) {
    return safeBackgroundJobReference('BOOKING', data.bookingId);
  }
  if (queueName === NOTIFICATION_SEND_QUEUE_NAME) {
    return safeBackgroundJobReference('NOTIFICATION', data.notificationId);
  }
  if (queueName === PAYMENT_STATUS_CHECK_QUEUE_NAME) {
    return safeBackgroundJobReference('PAYMENT', data.paymentId);
  }
  if (queueName === PAYMENT_REFUND_STATUS_QUEUE_NAME) {
    return safeBackgroundJobReference('REFUND', data.refundId);
  }
  return null;
}

function safeBackgroundJobReference(
  kind: 'BOOKING' | 'NOTIFICATION' | 'PAYMENT' | 'REFUND',
  value: unknown,
) {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(id) ? { id, kind } : null;
}

function unknownRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function jobFinishedAt(job: Job | undefined) {
  return unixMsToIso(job?.finishedOn ?? null);
}

function firstScheduledAt(schedulers: Awaited<ReturnType<Queue['getJobSchedulers']>>) {
  return schedulers
    .map((scheduler) => scheduler.next)
    .filter((value): value is number => typeof value === 'number')
    .sort((left, right) => left - right)[0] ?? null;
}

function unixMsToIso(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Date(value).toISOString()
    : null;
}

function nonNegativeInteger(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : fallback;
}

function positiveInteger(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function dateTimeMs(value: string | null) {
  return value ? new Date(value).getTime() : 0;
}

function sanitizeFailureReason(value: string | undefined) {
  const lines = value
    ?.split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean) ?? [];
  const firstLine = lines.find((line) => !/^Invalid `prisma\.[^`]+` invocation:?$/u.test(line))
    ?? lines[0]
    ?? 'No failure reason retained';
  return firstLine
    .replace(/(?:postgres(?:ql)?|redis):\/\/\S+/giu, '[REDACTED_CONNECTION_URL]')
    .replace(/bearer\s+\S+/giu, 'Bearer [REDACTED]')
    .replace(/\b(password|secret|token)=([^\s&]+)/giu, '$1=[REDACTED]')
    .slice(0, 300);
}

function backgroundFailureTarget(queueName: string, jobId: string | null) {
  return jobId ? `background_job_failure:${queueName}:${jobId}` : null;
}

function backgroundRecurringFailureIncidentTarget(
  failure: { id: string | null; name: string; queueName: string },
) {
  if (!failure.id?.startsWith('repeat:')) return null;
  return `background_job_recurring_incident:${failure.queueName}:${failure.name}`;
}

function backgroundFailureReviewStatus(action: string | undefined): BackgroundFailureReviewStatus {
  if (action === BACKGROUND_JOB_FAILURE_RESOLVED_ACTION) return 'RESOLVED';
  if (action === BACKGROUND_JOB_FAILURE_ACKNOWLEDGED_ACTION) return 'ACKNOWLEDGED';
  if (
    action === BACKGROUND_JOB_FAILURE_ALERT_ACTION ||
    action === BACKGROUND_JOB_FAILURE_REGISTERED_ACTION
  ) return 'NEW';
  return 'UNTRACKED';
}

function backgroundFailureMatchesReview(
  status: BackgroundFailureReviewStatus,
  filter: NonNullable<BackgroundJobHealthQueryDto['review']>,
) {
  if (filter === 'ALL') return true;
  if (filter === 'OPEN') return status !== 'RESOLVED';
  return status === filter;
}

function backgroundFailureRangeCutoff(
  range: NonNullable<BackgroundJobHealthQueryDto['range']>,
  now: Date,
) {
  const durationMs = {
    '24H': 24 * 60 * 60_000,
    '7D': 7 * 24 * 60 * 60_000,
    '30D': 30 * 24 * 60 * 60_000,
    ALL: null,
  }[range];
  return durationMs === null ? null : now.getTime() - durationMs;
}

function queueHasUnresolvedFailure(
  queue: Awaited<ReturnType<typeof backgroundQueueSnapshot>>,
  failures: Array<ReturnType<typeof backgroundFailedJob> & {
    review: { status: BackgroundFailureReviewStatus };
  }>,
) {
  const retainedFailures = failures.filter((failure) => failure.queueName === queue.name);
  return queue.counts.failed > retainedFailures.length ||
    retainedFailures.some((failure) => failure.review.status !== 'RESOLVED');
}

function normalizeBackgroundJobIdentifier(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 200) {
    throw new BadRequestException(`${label} is invalid`);
  }
  return normalized;
}

function backgroundJobAdvisoryLock(target: string) {
  return Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtext(${target}))::text AS "lockResult"
  `;
}

function isConfiguredAdminWebMaster(identity: string) {
  const configured = process.env.ADMIN_WEB_LOGIN_EMAIL?.trim().toLowerCase();
  return Boolean(configured && identity.trim().toLowerCase() === configured);
}

function jsonObject(value: Prisma.JsonValue | null | undefined): Record<string, Prisma.JsonValue> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Prisma.JsonValue>
    : {};
}

function jsonString(value: Prisma.JsonValue | undefined) {
  return typeof value === 'string' ? value : null;
}

function jsonStringArray(value: Prisma.JsonValue | undefined) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function jsonNonNegativeNumber(value: Prisma.JsonValue | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function backgroundQueueHealthEvent(row: {
  action: string;
  actor: { email: string | null; fullName: string | null; id: string } | null;
  createdAt: Date;
  id: string;
  metadata: Prisma.JsonValue | null;
  target: string;
}) {
  const metadata = jsonObject(row.metadata);
  const queueName = jsonString(metadata.queueName) ?? row.target.replace('background_job_queue_health:', '');
  return {
    actor: row.actor,
    detectedAt: jsonString(metadata.detectedAt),
    event: row.action === BACKGROUND_JOB_QUEUE_STALE_ALERT_ACTION ? 'ALERTED' as const : 'RECOVERED' as const,
    id: row.id,
    oldestOpenJobAt: jsonString(metadata.oldestOpenJobAt),
    oldestOpenJobState: jsonString(metadata.oldestOpenJobState),
    openJobLagMs: jsonNonNegativeNumber(metadata.openJobLagMs),
    queueName,
    recordedAt: row.createdAt.toISOString(),
    staleAfterMs: jsonNonNegativeNumber(metadata.staleAfterMs),
  };
}

type BackgroundRecurringIncidentAuditRow = {
  actor: { email: string | null; fullName: string | null; id: string } | null;
  createdAt: Date;
  id: string;
  metadata: Prisma.JsonValue | null;
  target: string;
};

function backgroundRecurringIncidentEpisode(
  opened: BackgroundRecurringIncidentAuditRow,
  recovered: BackgroundRecurringIncidentAuditRow | undefined,
) {
  const openedMetadata = jsonObject(opened.metadata);
  const recoveredMetadata = jsonObject(recovered?.metadata);
  const targetParts = opened.target.split(':');
  return {
    actor: opened.actor,
    firstFailureAt: jsonString(openedMetadata.firstFailureAt),
    firstFailureJobId: jsonString(openedMetadata.firstFailureJobId),
    id: opened.id,
    jobName: jsonString(openedMetadata.jobName) ?? targetParts.slice(2).join(':'),
    openedAt: opened.createdAt.toISOString(),
    queueName: jsonString(openedMetadata.queueName) ?? targetParts[1] ?? 'unknown',
    recoveredAt: recovered?.createdAt.toISOString() ?? null,
    resolvedFailureCount: jsonNonNegativeNumber(recoveredMetadata.resolvedFailureCount) ?? 0,
    status: recovered ? 'RECOVERED' as const : 'OPEN' as const,
  };
}

function backgroundRecurringIncidentFailure(
  origin: BackgroundRecurringIncidentAuditRow & { action: string },
  latestReview: {
    action: string;
    actor: { email: string | null; fullName: string | null; id: string } | null;
    createdAt: Date;
    metadata: Prisma.JsonValue | null;
    target: string;
  } | undefined,
) {
  const originMetadata = jsonObject(origin.metadata);
  const reviewMetadata = jsonObject(latestReview?.metadata);
  return {
    actor: latestReview?.actor ?? origin.actor,
    firstSeenAt: origin.createdAt.toISOString(),
    jobId: jsonString(originMetadata.jobId) ?? origin.target.split(':').slice(2).join(':'),
    reason: jsonString(reviewMetadata.reason),
    status: backgroundFailureReviewStatus(latestReview?.action ?? origin.action),
    updatedAt: latestReview?.createdAt.toISOString() ?? origin.createdAt.toISOString(),
  };
}
