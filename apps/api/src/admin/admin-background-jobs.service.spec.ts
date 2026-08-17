import type { Job, Queue } from 'bullmq';
import { PaymentStatus, Role } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { AdminBackgroundJobsService } from './admin-background-jobs.service';
import {
  BACKGROUND_JOB_FAILURE_MONITOR_SCHEDULER_ID,
  BANK_STATEMENT_ESCALATION_SCHEDULER_ID,
} from './bank-statement-escalation.queue';

describe('AdminBackgroundJobsService', () => {
  it('returns bounded queue health without exposing job payloads or raw connection secrets', async () => {
    const now = Date.now();
    const bankQueue = queueFixture('bank-statement-escalation', {
      completed: [jobFixture({ finishedOn: now - 10_000, id: 'bank-complete-1' })],
      schedulers: backgroundMonitorSchedulers(now),
    });
    const notificationQueue = queueFixture('notification-retry', {
      counts: { failed: 1 },
      failed: [jobFixture({
        attemptsMade: 3,
        data: {
          notificationId: 'notification-123',
          recipientPhone: '+84000000000',
          secretPayload: 'must-not-leak',
        },
        failedOn: now - 5_000,
        failedReason: 'Redis redis://user:password@localhost:6379 failed\ninternal stack',
        id: 'notification-failed-1',
        maxAttempts: 5,
        name: 'notification-send',
        processedOn: now - 6_000,
        timestamp: now - 30_000,
      })],
    });
    const service = new AdminBackgroundJobsService(
      bankQueue,
      queueFixture('booking-timeouts'),
      notificationQueue,
      queueFixture('payment-status-check'),
      prismaFixture().prisma,
    );

    const result = await service.health();

    expect(result.ok).toBe(false);
    expect(result.queues).toHaveLength(4);
    expect(result.queues[0]).toMatchObject({
      expectedSchedulerPresent: true,
      name: 'bank-statement-escalation',
      schedulerCount: 2,
      status: 'HEALTHY',
      workers: 1,
    });
    expect(result.failedJobs).toEqual([
      expect.objectContaining({
        attemptsMade: 3,
        execution: {
          attemptsMade: 3,
          failedAt: new Date(now - 5_000).toISOString(),
          lastStartedAt: new Date(now - 6_000).toISOString(),
          maxAttempts: 5,
          queuedAt: new Date(now - 30_000).toISOString(),
        },
        failure: 'Redis [REDACTED_CONNECTION_URL] failed',
        id: 'notification-failed-1',
        queueName: 'notification-retry',
        reference: { id: 'notification-123', kind: 'NOTIFICATION' },
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain('password');
    expect(JSON.stringify(result)).not.toContain('internal stack');
    expect(JSON.stringify(result)).not.toContain('recipientPhone');
    expect(JSON.stringify(result)).not.toContain('+84000000000');
    expect(JSON.stringify(result)).not.toContain('stacktrace');
    expect(JSON.stringify(result)).not.toContain('opts');
  });

  it('keeps the first meaningful failure line when BullMQ retains leading blank lines', async () => {
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation', {
        counts: { failed: 1 },
        failed: [jobFixture({
          failedReason: [
            '',
            'Invalid `prisma.$queryRaw()` invocation:',
            '',
            'Raw query failed because token=private-value and redis://user:password@localhost:6379 was unavailable',
            'internal stack frame',
          ].join('\n'),
          id: 'leading-blank-failure-1',
        })],
      }),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check'),
      prismaFixture().prisma,
    );

    const result = await service.health();

    expect(result.failedJobs[0]?.failure).toBe(
      'Raw query failed because token=[REDACTED] and [REDACTED_CONNECTION_URL] was unavailable',
    );
    expect(JSON.stringify(result)).not.toContain('private-value');
    expect(JSON.stringify(result)).not.toContain('internal stack frame');
  });

  it('returns recurring scheduler incidents as paginated opened-to-recovered episodes', async () => {
    const incidentTarget =
      'background_job_recurring_incident:bank-statement-escalation:background-job-failure-monitor';
    const openedAt = new Date('2026-07-14T04:00:00.000+07:00');
    const recoveredAt = new Date('2026-07-14T04:05:00.000+07:00');
    const fixture = prismaFixture({
      recurringIncidentLogs: [{
        action: 'admin.background_jobs.recurring_incident_opened',
        actorId: 'master-1',
        createdAt: openedAt,
        id: 'incident-open-1',
        metadata: {
          firstFailureAt: '2026-07-13T21:00:00.000Z',
          firstFailureJobId: 'repeat:monitor:1',
          jobName: 'background-job-failure-monitor',
          queueName: 'bank-statement-escalation',
        },
        target: incidentTarget,
      }, {
        action: 'admin.background_jobs.recurring_incident_recovered',
        actorId: 'master-1',
        createdAt: recoveredAt,
        id: 'incident-recovered-1',
        metadata: {
          jobName: 'background-job-failure-monitor',
          openedAuditId: 'incident-open-1',
          queueName: 'bank-statement-escalation',
          resolvedFailureCount: 2,
        },
        target: incidentTarget,
      }],
    });
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check'),
      fixture.prisma,
    );

    const result = await service.health({
      incidentPage: 1,
      pageSize: 5,
      queue: 'bank-statement-escalation',
      range: 'ALL',
    });

    expect(result.recurringIncidentPage).toEqual({
      complete: true,
      hasNextPage: false,
      hasPreviousPage: false,
      page: 1,
      pageSize: 5,
      scannedCount: 1,
      totalCount: 1,
    });
    expect(result.recurringIncidents).toEqual([expect.objectContaining({
      firstFailureJobId: 'repeat:monitor:1',
      id: 'incident-open-1',
      jobName: 'background-job-failure-monitor',
      openedAt: openedAt.toISOString(),
      queueName: 'bank-statement-escalation',
      recoveredAt: recoveredAt.toISOString(),
      resolvedFailureCount: 2,
      status: 'RECOVERED',
    })]);
  });

  it('filters recurring incidents by lifecycle status with a bounded scan', async () => {
    const openTarget = 'background_job_recurring_incident:bank-statement-escalation:open-monitor';
    const recoveredTarget = 'background_job_recurring_incident:bank-statement-escalation:recovered-monitor';
    const openedAt = new Date('2026-07-14T04:00:00.000+07:00');
    const fixture = prismaFixture({
      recurringIncidentLogs: [{
        action: 'admin.background_jobs.recurring_incident_opened',
        actorId: 'master-1',
        createdAt: new Date(openedAt.getTime() + 60_000),
        id: 'incident-open-current',
        metadata: { jobName: 'open-monitor' },
        target: openTarget,
      }, {
        action: 'admin.background_jobs.recurring_incident_opened',
        actorId: 'master-1',
        createdAt: openedAt,
        id: 'incident-open-recovered',
        metadata: { jobName: 'recovered-monitor' },
        target: recoveredTarget,
      }, {
        action: 'admin.background_jobs.recurring_incident_recovered',
        actorId: 'master-1',
        createdAt: new Date(openedAt.getTime() + 120_000),
        id: 'incident-recovered',
        metadata: { openedAuditId: 'incident-open-recovered' },
        target: recoveredTarget,
      }],
    });
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check'),
      fixture.prisma,
    );

    const result = await service.health({ incidentStatus: 'OPEN', pageSize: 5 });

    expect(result.recurringIncidents).toEqual([expect.objectContaining({
      id: 'incident-open-current',
      status: 'OPEN',
    })]);
    expect(result.recurringIncidentPage).toMatchObject({
      complete: true,
      scannedCount: 2,
      totalCount: 1,
    });
    expect(result.recurringIncidentSummary).toEqual({
      complete: true,
      openCount: 1,
      recoveredCount: 1,
      scannedCount: 3,
    });
  });

  it('returns bounded related failure records for one recurring incident episode', async () => {
    const incidentTarget =
      'background_job_recurring_incident:bank-statement-escalation:background-job-failure-monitor';
    const opened = {
      actor: { email: 'master@hands.vn', fullName: 'Master Admin', id: 'master-1' },
      createdAt: new Date('2026-07-14T04:00:00.000+07:00'),
      id: 'incident-open-1',
      metadata: {
        firstFailureAt: '2026-07-13T21:00:00.000Z',
        firstFailureJobId: 'repeat:monitor:1',
        jobName: 'background-job-failure-monitor',
        queueName: 'bank-statement-escalation',
      },
      target: incidentTarget,
    };
    const recovered = {
      ...opened,
      createdAt: new Date('2026-07-14T04:05:00.000+07:00'),
      id: 'incident-recovered-1',
      metadata: {
        jobName: 'background-job-failure-monitor',
        openedAuditId: opened.id,
        queueName: 'bank-statement-escalation',
        resolvedFailureCount: 1,
      },
    };
    const origin = {
      action: 'admin.background_jobs.failure_alerted',
      actor: opened.actor,
      createdAt: new Date('2026-07-14T04:00:01.000+07:00'),
      id: 'failure-origin-1',
      metadata: { incidentTarget, jobId: 'repeat:monitor:1' },
      target: 'background_job_failure:bank-statement-escalation:repeat:monitor:1',
    };
    const review = {
      action: 'admin.background_jobs.failure_resolved',
      actor: opened.actor,
      createdAt: new Date('2026-07-14T04:05:00.000+07:00'),
      metadata: { reason: 'Recurring scheduler recovered.' },
      target: origin.target,
    };
    const adminAuditLog = {
      count: vi.fn().mockResolvedValue(1),
      findFirst: vi.fn()
        .mockResolvedValueOnce(opened)
        .mockResolvedValueOnce(recovered)
        .mockResolvedValueOnce(null),
      findMany: vi.fn()
        .mockResolvedValueOnce([origin])
        .mockResolvedValueOnce([origin, review]),
    };
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check'),
      { adminAuditLog } as unknown as PrismaService,
    );

    const result = await service.recurringIncidentDetail('incident-open-1', { page: 1, pageSize: 5 });

    expect(result.incident).toMatchObject({
      id: 'incident-open-1',
      status: 'RECOVERED',
    });
    expect(result.page).toEqual({
      hasNextPage: false,
      hasPreviousPage: false,
      page: 1,
      pageSize: 5,
      totalCount: 1,
    });
    expect(result.failures).toEqual([{
      actor: opened.actor,
      firstSeenAt: origin.createdAt.toISOString(),
      jobId: 'repeat:monitor:1',
      reason: 'Recurring scheduler recovered.',
      status: 'RESOLVED',
      updatedAt: review.createdAt.toISOString(),
    }]);
    expect(adminAuditLog.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      skip: 0,
      take: 5,
      where: expect.objectContaining({
        metadata: { equals: incidentTarget, path: ['incidentTarget'] },
      }),
    }));
  });

  it('marks a queue as attention when its worker or expected scheduler is missing', async () => {
    const bankQueue = queueFixture('bank-statement-escalation', {
      schedulers: [],
      workers: 0,
    });
    const service = new AdminBackgroundJobsService(
      bankQueue,
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check'),
      prismaFixture().prisma,
    );

    const result = await service.health();

    expect(result.queues[0]).toMatchObject({
      expectedSchedulerPresent: false,
      status: 'ATTENTION',
      workers: 0,
    });
  });

  it('includes tax policy activation in background queue health when configured', async () => {
    const taxQueue = queueFixture('tax-policy-activation');
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check'),
      prismaFixture().prisma,
      undefined,
      undefined,
      undefined,
      taxQueue,
    );

    const result = await service.health();

    expect(result.queues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          expectedSchedulerId: 'tax-policy-activation-sweep-every-minute',
          expectedSchedulerPresent: false,
          label: 'Tax policy activation',
          name: 'tax-policy-activation',
          status: 'ATTENTION',
        }),
      ]),
    );
  });

  it('marks an immediate queue stale when its oldest waiting job exceeds the SLA', async () => {
    const queuedAt = Date.now() - 5 * 60_000;
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry', {
        counts: { waiting: 1 },
        waiting: [jobFixture({ id: 'waiting-notification-1', timestamp: queuedAt })],
      }),
      queueFixture('payment-status-check'),
      prismaFixture().prisma,
    );

    const result = await service.health();
    const queue = result.queues.find((item) => item.name === 'notification-retry');

    expect(result.ok).toBe(false);
    expect(queue).toMatchObject({
      oldestOpenJobAt: new Date(queuedAt).toISOString(),
      oldestOpenJobState: 'WAITING',
      staleAfterMs: 120_000,
      status: 'STALE',
    });
    expect(queue?.openJobLagMs).toBeGreaterThanOrEqual(5 * 60_000);
  });

  it('does not mark a deliberately delayed booking timeout stale before its due time', async () => {
    const queuedAt = Date.now();
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts', {
        counts: { delayed: 1 },
        delayed: [jobFixture({ delay: 10 * 60_000, id: 'future-timeout-1', timestamp: queuedAt })],
      }),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check'),
      prismaFixture().prisma,
    );

    const result = await service.health();

    expect(result.queues.find((item) => item.name === 'booking-timeouts')).toMatchObject({
      oldestOpenJobAt: new Date(queuedAt + 10 * 60_000).toISOString(),
      oldestOpenJobState: 'DELAYED',
      openJobLagMs: 0,
      status: 'HEALTHY',
    });
  });

  it('returns only allowlisted record references for booking and payment failures', async () => {
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts', {
        failed: [jobFixture({
          data: { bookingId: 'booking-123', customerPhone: '+84111111111' },
          id: 'booking-timeout-booking-123',
        })],
      }),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check', {
        failed: [jobFixture({
          data: { cardToken: 'private-token', paymentId: 'payment-123' },
          id: 'payment-job-1',
        })],
      }),
      prismaFixture().prisma,
    );

    const result = await service.health();

    expect(result.failedJobs).toEqual(expect.arrayContaining([
      expect.objectContaining({ reference: { id: 'booking-123', kind: 'BOOKING' } }),
      expect.objectContaining({ reference: { id: 'payment-123', kind: 'PAYMENT' } }),
    ]));
    expect(JSON.stringify(result)).not.toContain('customerPhone');
    expect(JSON.stringify(result)).not.toContain('cardToken');
    expect(JSON.stringify(result)).not.toContain('private-token');
  });

  it('filters retained failures on the server and returns bounded pages', async () => {
    const now = Date.now();
    const failed = Array.from({ length: 10 }, (_, index) => jobFixture({
      failedOn: index === 9 ? now - 31 * 24 * 60 * 60_000 : now - index * 60_000,
      id: `notification-failure-${index + 1}`,
      name: 'notification-send',
    }));
    const resolvedTarget = 'background_job_failure:notification-retry:notification-failure-1';
    const fixture = prismaFixture({
      reviewLogs: [{
        action: 'admin.background_jobs.failure_resolved',
        createdAt: new Date(now - 30_000),
        metadata: { reason: 'Provider recovered' },
        target: resolvedTarget,
      }],
    });
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry', { counts: { failed: 10 }, failed }),
      queueFixture('payment-status-check'),
      fixture.prisma,
    );

    const firstPage = await service.health({
      page: 1,
      pageSize: 5,
      queue: 'notification-retry',
      range: '7D',
      review: 'OPEN',
    });
    const secondPage = await service.health({
      page: 2,
      pageSize: 5,
      queue: 'notification-retry',
      range: '7D',
      review: 'OPEN',
    });

    expect(firstPage.failedJobs).toHaveLength(5);
    expect(firstPage.failedJobs).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'notification-failure-1' }),
      expect.objectContaining({ id: 'notification-failure-10' }),
    ]));
    expect(firstPage.failurePage).toEqual({
      complete: true,
      hasNextPage: true,
      hasPreviousPage: false,
      page: 1,
      pageSize: 5,
      scannedCount: 10,
      totalCount: 8,
    });
    expect(secondPage.failedJobs).toHaveLength(3);
    expect(secondPage.failurePage).toMatchObject({
      hasNextPage: false,
      hasPreviousPage: true,
      page: 2,
    });
  });

  it('finds one retained failure by exact job id within the bounded queue scan', async () => {
    const exactId = 'repeat:background-job-failure-monitor:1783980324023';
    const bankQueue = queueFixture('bank-statement-escalation', {
      counts: { failed: 3 },
      failed: [
        jobFixture({ id: 'other-failure-1' }),
        jobFixture({ id: exactId }),
        jobFixture({ id: 'other-failure-2' }),
      ],
    });
    const service = new AdminBackgroundJobsService(
      bankQueue,
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check'),
      prismaFixture().prisma,
    );

    const result = await service.health({
      jobId: exactId,
      pageSize: 5,
      queue: 'bank-statement-escalation',
      range: 'ALL',
      review: 'ALL',
    });

    expect(result.failedJobs).toEqual([
      expect.objectContaining({ id: exactId, queueName: 'bank-statement-escalation' }),
    ]);
    expect(result.failurePage).toMatchObject({
      complete: true,
      hasNextPage: false,
      scannedCount: 3,
      totalCount: 1,
    });
    expect(bankQueue.getJobs).toHaveBeenCalledWith('failed', 0, expect.any(Number), false);
    expect(vi.mocked(bankQueue.getJobs).mock.calls[0]?.[2]).toBeLessThanOrEqual(499);
  });

  it('returns queue SLA alerts and recoveries in server-paginated audit pages', async () => {
    const queueHealthLogs = Array.from({ length: 12 }, (_, index) => ({
      action: index % 2 === 0
        ? 'admin.background_jobs.queue_stale_alerted'
        : 'admin.background_jobs.queue_stale_recovered',
      actor: { email: 'master@hands.vn', fullName: 'Master Admin', id: 'master-1' },
      createdAt: new Date(Date.parse('2026-07-14T04:00:00.000Z') - index * 60_000),
      id: `health-event-${index + 1}`,
      metadata: {
        detectedAt: new Date(Date.parse('2026-07-14T04:00:00.000Z') - index * 60_000).toISOString(),
        openJobLagMs: index % 2 === 0 ? 300_000 : 0,
        queueName: 'notification-retry',
        staleAfterMs: 120_000,
      },
      target: 'background_job_queue_health:notification-retry',
    }));
    const fixture = prismaFixture({ queueHealthLogs });
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check'),
      fixture.prisma,
    );

    const result = await service.health({
      eventPage: 2,
      eventStatus: 'ALL',
      pageSize: 5,
      queue: 'notification-retry',
      range: 'ALL',
    });

    expect(result.healthEvents).toHaveLength(5);
    expect(result.healthEvents[0]).toMatchObject({
      actor: { fullName: 'Master Admin' },
      event: 'RECOVERED',
      id: 'health-event-6',
      openJobLagMs: 0,
      queueName: 'notification-retry',
      staleAfterMs: 120_000,
    });
    expect(result.healthEventPage).toEqual({
      hasNextPage: true,
      hasPreviousPage: true,
      page: 2,
      pageSize: 5,
      totalCount: 12,
    });
    expect(fixture.prisma.adminAuditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 5,
      take: 5,
      where: expect.objectContaining({
        target: 'background_job_queue_health:notification-retry',
      }),
    }));
  });

  it('keeps resolved failures as retained evidence without leaving the queue in attention', async () => {
    const failedJob = jobFixture({
      failedOn: Date.parse('2026-07-14T03:00:00.000Z'),
      id: 'resolved-failure-1',
    });
    const target = 'background_job_failure:payment-status-check:resolved-failure-1';
    const fixture = prismaFixture({
      reviewLogs: [
        {
          action: 'admin.background_jobs.failure_alerted',
          createdAt: new Date('2026-07-14T03:01:00.000Z'),
          target,
        },
        {
          action: 'admin.background_jobs.failure_resolved',
          createdAt: new Date('2026-07-14T03:02:00.000Z'),
          metadata: { reason: 'Gateway recovered' },
          target,
        },
      ],
    });
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation', {
        schedulers: backgroundMonitorSchedulers(),
      }),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check', { counts: { failed: 1 }, failed: [failedJob] }),
      fixture.prisma,
    );

    const result = await service.health();

    expect(result.ok).toBe(true);
    expect(result.queues.find((queue) => queue.name === 'payment-status-check')).toMatchObject({
      counts: { failed: 1 },
      status: 'HEALTHY',
    });
    expect(result.failedJobs[0]).toMatchObject({
      review: { reason: 'Gateway recovered', status: 'RESOLVED' },
    });
  });

  it('notifies every Master once for each recent failed job and records the dedupe audit', async () => {
    const now = new Date('2026-07-14T04:00:00.000+07:00');
    const failedJob = jobFixture({
      attemptsMade: 3,
      failedOn: now.getTime() - 60_000,
      failedReason: 'Database connection failed',
      id: 'payment-failure-1',
      name: 'payment-status-check',
    });
    const fixture = prismaFixture({ recipients: ['master-1', 'master-2'] });
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check', { failed: [failedJob] }),
      fixture.prisma,
    );

    await expect(service.syncFailureNotifications(now)).resolves.toEqual({
      alertedCount: 1,
      missingRecipientCount: 0,
      recoveredIncidentCount: 0,
      scannedCount: 1,
      skippedCount: 0,
    });
    expect(fixture.tx.notification.create).toHaveBeenCalledTimes(2);
    expect(fixture.tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        data: expect.objectContaining({
          destination: '/background-jobs',
          jobId: 'payment-failure-1',
          queueName: 'payment-status-check',
        }),
        type: 'admin.system.background_job.failed',
      }),
      select: { id: true },
    });
    expect(fixture.tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'admin.background_jobs.failure_alerted',
        actorId: null,
        actorKey: 'background-job-monitor',
        actorLabelSnapshot: 'HANDS background monitor',
        actorType: 'SYSTEM',
        target: 'background_job_failure:payment-status-check:payment-failure-1',
      }),
    });
  });

  it('skips duplicate failures without aging retained failures out of the scan', async () => {
    const now = new Date('2026-07-14T04:00:00.000+07:00');
    const fixture = prismaFixture({ existingAudit: true });
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts', {
        failed: [jobFixture({ failedOn: now.getTime() - 60_000, id: 'duplicate-1' })],
      }),
      queueFixture('notification-retry', {
        failed: [jobFixture({ failedOn: now.getTime() - 20 * 60_000, id: 'stale-1' })],
      }),
      queueFixture('payment-status-check'),
      fixture.prisma,
    );

    await expect(service.syncFailureNotifications(now)).resolves.toEqual({
      alertedCount: 0,
      missingRecipientCount: 0,
      recoveredIncidentCount: 0,
      scannedCount: 2,
      skippedCount: 2,
    });
    expect(fixture.tx.notification.create).not.toHaveBeenCalled();
    expect(fixture.tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('alerts an untracked retained failure after the monitor was unavailable for more than 15 minutes', async () => {
    const now = new Date('2026-07-14T04:30:00.000+07:00');
    const fixture = prismaFixture();
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry', {
        failed: [jobFixture({ failedOn: now.getTime() - 20 * 60_000, id: 'older-failure-1' })],
      }),
      queueFixture('payment-status-check'),
      fixture.prisma,
    );

    await expect(service.syncFailureNotifications(now)).resolves.toMatchObject({
      alertedCount: 1,
      scannedCount: 1,
    });
    expect(fixture.tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        target: 'background_job_failure:notification-retry:older-failure-1',
      }),
    });
  });

  it('opens one incident and sends one alert for the first recurring job failure', async () => {
    const now = new Date('2026-07-14T04:00:00.000+07:00');
    const failedJob = jobFixture({
      failedOn: now.getTime() - 60_000,
      id: 'repeat:background-job-failure-monitor:1',
      name: 'background-job-failure-monitor',
    });
    const fixture = prismaFixture();
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation', { failed: [failedJob] }),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check'),
      fixture.prisma,
    );

    await expect(service.syncFailureNotifications(now)).resolves.toEqual({
      alertedCount: 1,
      missingRecipientCount: 0,
      recoveredIncidentCount: 0,
      scannedCount: 1,
      skippedCount: 0,
    });
    expect(fixture.tx.notification.create).toHaveBeenCalledTimes(1);
    expect(fixture.tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        data: expect.objectContaining({
          destination: '/background-jobs/incidents/audit-1',
          incidentId: 'audit-1',
          incidentOpenedAt: now.toISOString(),
          incidentStatus: 'OPEN',
          jobId: 'repeat:background-job-failure-monitor:1',
        }),
      }),
      select: { id: true },
    });
    expect(fixture.tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'admin.background_jobs.recurring_incident_opened',
        target: 'background_job_recurring_incident:bank-statement-escalation:background-job-failure-monitor',
      }),
      select: { id: true },
    });
    expect(fixture.tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'admin.background_jobs.failure_alerted',
        metadata: expect.objectContaining({ incidentAuditId: 'audit-1' }),
      }),
    });
  });

  it('registers repeated scheduler failures without sending another incident alert', async () => {
    const now = new Date('2026-07-14T04:05:00.000+07:00');
    const incidentTarget =
      'background_job_recurring_incident:bank-statement-escalation:background-job-failure-monitor';
    const openedIncident = {
      action: 'admin.background_jobs.recurring_incident_opened',
      actorId: 'master-1',
      createdAt: new Date('2026-07-14T04:00:00.000+07:00'),
      id: 'incident-open-1',
      metadata: { jobName: 'background-job-failure-monitor' },
      target: incidentTarget,
    };
    const failedJob = jobFixture({
      failedOn: now.getTime() - 30_000,
      id: 'repeat:background-job-failure-monitor:2',
      name: 'background-job-failure-monitor',
    });
    const fixture = prismaFixture({
      latestRecurringIncidents: { [incidentTarget]: openedIncident },
      recurringIncidentLogs: [openedIncident],
    });
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation', { failed: [failedJob] }),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check'),
      fixture.prisma,
    );

    await expect(service.syncFailureNotifications(now)).resolves.toEqual({
      alertedCount: 0,
      missingRecipientCount: 0,
      recoveredIncidentCount: 0,
      scannedCount: 1,
      skippedCount: 1,
    });
    expect(fixture.tx.notification.create).not.toHaveBeenCalled();
    expect(fixture.tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'admin.background_jobs.failure_registered',
        outcome: 'RECORDED',
        severity: 'INFO',
        target: 'background_job_failure:bank-statement-escalation:repeat:background-job-failure-monitor:2',
      }),
    });
  });

  it('recovers a recurring incident after the same scheduler completes successfully', async () => {
    const now = new Date('2026-07-14T04:06:00.000+07:00');
    const incidentTarget =
      'background_job_recurring_incident:bank-statement-escalation:background-job-failure-monitor';
    const openedIncident = {
      action: 'admin.background_jobs.recurring_incident_opened',
      actorId: 'master-1',
      createdAt: new Date('2026-07-14T04:00:00.000+07:00'),
      id: 'incident-open-1',
      metadata: { jobName: 'background-job-failure-monitor' },
      target: incidentTarget,
    };
    const failedJob = jobFixture({
      failedOn: new Date('2026-07-14T04:01:00.000+07:00').getTime(),
      id: 'repeat:background-job-failure-monitor:2',
      name: 'background-job-failure-monitor',
    });
    const completedJob = jobFixture({
      finishedOn: new Date('2026-07-14T04:05:00.000+07:00').getTime(),
      id: 'repeat:background-job-failure-monitor:3',
      name: 'background-job-failure-monitor',
    });
    const fixture = prismaFixture({
      latestRecurringIncidents: { [incidentTarget]: openedIncident },
      recurringIncidentLogs: [openedIncident],
    });
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation', {
        completed: [completedJob],
        failed: [failedJob],
      }),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check'),
      fixture.prisma,
    );

    await expect(service.syncFailureNotifications(now)).resolves.toEqual({
      alertedCount: 0,
      missingRecipientCount: 0,
      recoveredIncidentCount: 1,
      scannedCount: 1,
      skippedCount: 1,
    });
    expect(fixture.tx.notification.create).not.toHaveBeenCalled();
    expect(fixture.tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'admin.background_jobs.failure_resolved',
        target: 'background_job_failure:bank-statement-escalation:repeat:background-job-failure-monitor:2',
      }),
    });
    expect(fixture.tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'admin.background_jobs.recurring_incident_recovered',
        target: incidentTarget,
      }),
    });
    expect(fixture.tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('opens a new incident when a recurring scheduler fails again after recovery', async () => {
    const now = new Date('2026-07-14T04:10:00.000+07:00');
    const incidentTarget =
      'background_job_recurring_incident:bank-statement-escalation:background-job-failure-monitor';
    const recoveredIncident = {
      action: 'admin.background_jobs.recurring_incident_recovered',
      actorId: 'master-1',
      createdAt: new Date('2026-07-14T04:06:00.000+07:00'),
      id: 'incident-recovered-1',
      metadata: { jobName: 'background-job-failure-monitor' },
      target: incidentTarget,
    };
    const fixture = prismaFixture({
      latestRecurringIncidents: { [incidentTarget]: recoveredIncident },
      recurringIncidentLogs: [recoveredIncident],
    });
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation', {
        failed: [jobFixture({
          failedOn: now.getTime() - 30_000,
          id: 'repeat:background-job-failure-monitor:4',
          name: 'background-job-failure-monitor',
        })],
      }),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check'),
      fixture.prisma,
    );

    await expect(service.syncFailureNotifications(now)).resolves.toMatchObject({
      alertedCount: 1,
      recoveredIncidentCount: 0,
      skippedCount: 0,
    });
    expect(fixture.tx.notification.create).toHaveBeenCalledTimes(1);
    expect(fixture.tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'admin.background_jobs.recurring_incident_opened',
        target: incidentTarget,
      }),
      select: { id: true },
    });
  });

  it('alerts every Master once when a queue first exceeds its processing SLA', async () => {
    const now = new Date('2026-07-14T05:00:00.000+07:00');
    const fixture = prismaFixture({ recipients: ['master-1', 'master-2'] });
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry', {
        counts: { waiting: 1 },
        waiting: [jobFixture({
          id: 'stale-notification-1',
          timestamp: now.getTime() - 5 * 60_000,
        })],
      }),
      queueFixture('payment-status-check'),
      fixture.prisma,
    );

    await expect(service.syncQueueHealthAlerts(now)).resolves.toEqual({
      alertedCount: 1,
      missingRecipientCount: 0,
      recoveredCount: 0,
      scannedCount: 4,
      skippedCount: 3,
    });
    expect(fixture.tx.notification.create).toHaveBeenCalledTimes(2);
    expect(fixture.tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        data: expect.objectContaining({
          deliveryIntent: 'IN_APP_ONLY',
          destination: '/background-jobs?queue=notification-retry&review=OPEN&range=ALL',
          queueName: 'notification-retry',
          source: 'background_job_queue_health_monitor',
        }),
        type: 'admin.system.background_job.queue_stale',
      }),
      select: { id: true },
    });
    expect(fixture.tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'admin.background_jobs.queue_stale_alerted',
        actorId: null,
        actorType: 'SYSTEM',
        target: 'background_job_queue_health:notification-retry',
      }),
    });
    const lockQuery = fixture.tx.$queryRaw.mock.calls[0]?.[0] as { sql?: string; text?: string };
    expect(lockQuery.sql ?? lockQuery.text).toContain('::text');
  });

  it('alerts when a required scheduler and queue worker are missing without waiting for job lag', async () => {
    const now = new Date('2026-07-14T05:00:00.000+07:00');
    const fixture = prismaFixture();
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation', { schedulers: [], workers: 0 }),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check'),
      fixture.prisma,
    );

    await expect(service.syncQueueHealthAlerts(now)).resolves.toMatchObject({ alertedCount: 1 });
    expect(fixture.tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          healthReasons: ['NO_WORKERS', 'SCHEDULER_MISSING'],
        }),
        target: 'background_job_queue_health:bank-statement-escalation',
      }),
    });
  });

  it('deduplicates a stale episode and records recovery without another notification', async () => {
    const now = new Date('2026-07-14T05:10:00.000+07:00');
    const target = 'background_job_queue_health:notification-retry';
    const staleAudit = {
      action: 'admin.background_jobs.queue_stale_alerted',
      actorId: 'master-1',
      id: 'stale-audit-1',
    };
    const duplicateFixture = prismaFixture({ latestQueueHealthAudits: { [target]: staleAudit } });
    const duplicateService = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry', {
        active: [jobFixture({
          id: 'stale-notification-1',
          processedOn: now.getTime() - 5 * 60_000,
        })],
        counts: { active: 1 },
      }),
      queueFixture('payment-status-check'),
      duplicateFixture.prisma,
    );

    await expect(duplicateService.syncQueueHealthAlerts(now)).resolves.toMatchObject({
      alertedCount: 0,
      recoveredCount: 0,
      skippedCount: 4,
    });
    expect(duplicateFixture.tx.notification.create).not.toHaveBeenCalled();
    expect(duplicateFixture.tx.adminAuditLog.create).not.toHaveBeenCalled();

    const recoveryFixture = prismaFixture({ latestQueueHealthAudits: { [target]: staleAudit } });
    const recoveryService = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check'),
      recoveryFixture.prisma,
    );

    await expect(recoveryService.syncQueueHealthAlerts(now)).resolves.toMatchObject({
      alertedCount: 0,
      recoveredCount: 1,
      skippedCount: 3,
    });
    expect(recoveryFixture.tx.notification.create).not.toHaveBeenCalled();
    expect(recoveryFixture.tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'admin.background_jobs.queue_stale_recovered',
        actorId: null,
        actorType: 'SYSTEM',
        target,
      }),
    });
  });

  it('acknowledges an alerted failed job without retrying it and marks the operator notification read', async () => {
    const fixture = prismaFixture({
      reviewLogs: [{
        action: 'admin.background_jobs.failure_alerted',
        createdAt: new Date('2026-07-14T04:00:00.000+07:00'),
        metadata: { notificationIds: ['notification-1'] },
      }],
    });
    const paymentQueue = queueFixture('payment-status-check');
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      paymentQueue,
      fixture.prisma,
    );

    await expect(service.acknowledgeFailure(
      'internal-admin',
      'payment-status-check',
      'payment-failure-1',
      'master@hands.vn',
    )).resolves.toMatchObject({ ok: true, status: 'ACKNOWLEDGED' });
    expect(paymentQueue.getJob).toHaveBeenCalledWith('payment-failure-1');
    expect(fixture.tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'admin.background_jobs.failure_acknowledged',
        actorId: 'master-1',
        target: 'background_job_failure:payment-status-check:payment-failure-1',
      }),
      select: { id: true, createdAt: true },
    });
    expect(fixture.tx.notification.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['notification-1'] }, userId: 'master-1' },
      data: { readAt: expect.any(Date) },
    });
  });

  it('captures and acknowledges an untracked retained failure without waiting for the monitor', async () => {
    const fixture = prismaFixture();
    const paymentQueue = queueFixture('payment-status-check');
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      paymentQueue,
      fixture.prisma,
    );

    await expect(service.acknowledgeFailure(
      'internal-admin',
      'payment-status-check',
      'untracked-failure-1',
      'master@hands.vn',
    )).resolves.toMatchObject({ ok: true, status: 'ACKNOWLEDGED' });
    expect(fixture.tx.adminAuditLog.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        action: 'admin.background_jobs.failure_registered',
        actorId: 'master-1',
        target: 'background_job_failure:payment-status-check:untracked-failure-1',
      }),
      select: { action: true, createdAt: true, metadata: true },
    });
    expect(fixture.tx.adminAuditLog.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        action: 'admin.background_jobs.failure_acknowledged',
        actorId: 'master-1',
      }),
      select: { id: true, createdAt: true },
    });
    expect(fixture.tx.notification.updateMany).not.toHaveBeenCalled();
  });

  it('maps the configured Admin Web Master identity only to an authenticated Master actor', async () => {
    const previousEmail = process.env.ADMIN_WEB_LOGIN_EMAIL;
    process.env.ADMIN_WEB_LOGIN_EMAIL = 'env-master@hands.vn';
    try {
      const fixture = prismaFixture();
      fixture.tx.user.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'internal-admin',
          roles: ['ADMIN', 'MASTER_ADMIN'],
          adminOperatorPermission: null,
        });
      const service = new AdminBackgroundJobsService(
        queueFixture('bank-statement-escalation'),
        queueFixture('booking-timeouts'),
        queueFixture('notification-retry'),
        queueFixture('payment-status-check'),
        fixture.prisma,
      );

      await expect(service.acknowledgeFailure(
        'internal-admin',
        'payment-status-check',
        'env-master-failure-1',
        'env-master@hands.vn',
      )).resolves.toMatchObject({ ok: true, status: 'ACKNOWLEDGED' });
      expect(fixture.tx.user.findFirst).toHaveBeenCalledTimes(2);
      expect(fixture.tx.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'admin.background_jobs.failure_acknowledged',
          actorId: 'internal-admin',
        }),
        select: { id: true, createdAt: true },
      });
    } finally {
      if (previousEmail === undefined) delete process.env.ADMIN_WEB_LOGIN_EMAIL;
      else process.env.ADMIN_WEB_LOGIN_EMAIL = previousEmail;
    }
  });

  it('requires Developer Health access and a meaningful note before resolving a failure', async () => {
    const fixture = prismaFixture({
      reviewLogs: [{
        action: 'admin.background_jobs.failure_acknowledged',
        createdAt: new Date('2026-07-14T04:00:00.000+07:00'),
      }],
    });
    fixture.tx.user.findFirst.mockResolvedValue({
      id: 'operator-1',
      roles: ['ADMIN'],
      adminOperatorPermission: { categories: [] },
    });
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check'),
      fixture.prisma,
    );

    expect(() => service.resolveFailure(
      'internal-admin',
      'payment-status-check',
      'payment-failure-1',
      'x',
      'operator@hands.vn',
    )).toThrow('Resolution note must be at least 3 characters');
    await expect(service.resolveFailure(
      'internal-admin',
      'payment-status-check',
      'payment-failure-1',
      'Provider credentials corrected',
      'operator@hands.vn',
    )).rejects.toThrow('Developer/System health access is required');
    expect(fixture.tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('requires acknowledgment before a Master can resolve a new failure', async () => {
    const fixture = prismaFixture({
      reviewLogs: [{
        action: 'admin.background_jobs.failure_alerted',
        createdAt: new Date('2026-07-14T04:00:00.000+07:00'),
      }],
    });
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check'),
      fixture.prisma,
    );

    await expect(service.resolveFailure(
      'internal-admin',
      'payment-status-check',
      'payment-failure-1',
      'Provider credentials corrected',
      'master@hands.vn',
    )).rejects.toThrow('must be acknowledged before resolution');
    expect(fixture.tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('re-registers bounded durable work with stable queue helpers', async () => {
    const notificationQueue = queueFixture('notification-retry');
    const paymentQueue = queueFixture('payment-status-check', { jobState: null });
    const refundQueue = queueFixture('payment-refund-status', { jobState: null });
    const campaignQueue = queueFixture('admin-push-campaign');
    const bookingRecoveryQueue = queueFixture('payment-booking-recovery', { jobState: null });
    const prisma = {
      payment: { findMany: vi.fn().mockResolvedValue([{ id: 'payment-1' }]) },
      refund: { findMany: vi.fn().mockResolvedValue([{ id: 'refund-1' }]) },
      booking: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'booking-1', payment: { id: 'payment-ready-1' } },
        ]),
      },
      notification: { findMany: vi.fn().mockResolvedValue([recoverableNotification('notification-1')]) },
      notificationDelivery: {
        findMany: vi.fn().mockResolvedValue([{ id: 'delivery-stale-1' }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      adminPushCampaign: { findMany: vi.fn().mockResolvedValue([{ id: 'campaign-1' }]) },
    } as unknown as PrismaService;
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      notificationQueue,
      paymentQueue,
      prisma,
      refundQueue,
      campaignQueue,
      bookingRecoveryQueue,
    );

    await expect(service.syncMissingDurableJobs(
      new Date('2026-08-17T12:00:00.000+07:00'),
    )).resolves.toMatchObject({
      byFlow: {
        bookingRecovery: { failedCount: 0, registeredCount: 1 },
        campaign: { failedCount: 0, registeredCount: 1 },
        notification: { failedCount: 0, registeredCount: 1 },
        paymentStatus: { failedCount: 0, registeredCount: 1 },
        refundStatus: { failedCount: 0, registeredCount: 1 },
      },
      closedUncertainDeliveryCount: 1,
      failedCount: 0,
      registeredCount: 5,
      scannedCount: 5,
    });
    expect(paymentQueue.add).toHaveBeenCalledWith(
      'payment-status-check',
      { paymentId: 'payment-1' },
      expect.objectContaining({ jobId: 'payment-status-check-payment-1' }),
    );
    expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          {
            rawMeta: { path: ['authorizationState'], equals: 'READY' },
            status: PaymentStatus.PENDING,
          },
        ]),
      }),
    }));
    expect(refundQueue.add).toHaveBeenCalledWith(
      'payment-refund-status',
      { refundId: 'refund-1' },
      expect.objectContaining({ jobId: 'payment-refund-status-refund-1' }),
    );
    expect(prisma.refund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: {
            in: ['APPROVAL_PROCESSING', 'PROVIDER_PROCESSING', 'GATEWAY_CONFIRMED'],
          },
        },
      }),
    );
    expect(bookingRecoveryQueue.add).toHaveBeenCalledWith(
      'payment-booking-recovery',
      { bookingId: 'booking-1', paymentId: 'payment-ready-1' },
      expect.objectContaining({ jobId: 'payment-booking-recovery-booking-1' }),
    );
    expect(prisma.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        payment: {
          is: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                rawMeta: { path: ['authorizationState'], equals: 'PENDING' },
              }),
            ]),
          }),
        },
      }),
    }));
    expect(notificationQueue.add).toHaveBeenCalledWith(
      'notification-send',
      { notificationId: 'notification-1' },
      expect.objectContaining({ deduplication: expect.objectContaining({ id: 'notification-1' }) }),
    );
    expect(campaignQueue.add).toHaveBeenCalledWith(
      'admin-push-campaign-send',
      { campaignId: 'campaign-1' },
      expect.objectContaining({ deduplication: expect.objectContaining({ id: 'campaign-1' }) }),
    );
    expect(prisma.adminPushCampaign.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: { in: ['QUEUED', 'PROCESSING', 'FAILED'] },
      }),
    }));
    expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 100,
      where: expect.objectContaining({
        createdAt: { lte: new Date('2026-08-17T04:59:30.000Z') },
        OR: [
          { deliveries: { none: {} } },
          { deliveries: { some: { status: 'FAILED' } } },
        ],
        user: { pushDevices: { some: { enabled: true } } },
      }),
    }));
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: { in: ['delivery-stale-1'] },
        status: 'PROCESSING',
      }),
      data: expect.objectContaining({
        status: 'FAILED',
        response: expect.objectContaining({ failureCode: 'DELIVERY_OUTCOME_UNKNOWN' }),
      }),
    });
  });

  it('replays a source-keyed post-commit notification and records immutable recovery evidence', async () => {
    const failure = {
      id: 'audit-failure-1',
      objectId: 'booking-1',
      target: 'booking:booking-1',
      metadata: {
        effect: 'service-start-notifications',
        notificationRecoveries: [
          {
            body: 'Service started.',
            sourceKey: 'booking:booking-1:service-started:user-1',
            targetRole: Role.CUSTOMER,
            title: 'Service started',
            type: 'booking.service_started',
            userId: 'user-1',
          },
          {
            body: 'The service has started.',
            sourceKey: 'booking:booking-1:service-started:provider-1',
            targetRole: Role.PROVIDER,
            title: 'Service started',
            type: 'booking.service_started',
            userId: 'provider-1',
          },
        ],
      },
    };
    const prisma = {
      adminAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-recovery-1' }),
        findMany: vi.fn()
          .mockResolvedValueOnce([failure])
          .mockResolvedValueOnce([]),
      },
    } as unknown as PrismaService;
    const notifications = {
      create: vi.fn()
        .mockResolvedValueOnce({ id: 'notification-1' })
        .mockResolvedValueOnce({ id: 'notification-2' }),
    };
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check'),
      prisma,
      undefined,
      undefined,
      undefined,
      undefined,
      notifications as never,
    );

    await expect(service.syncPostCommitNotificationRecoveries()).resolves.toEqual({
      existingCount: 0,
      failedCount: 0,
      recoveredCount: 1,
      scannedCount: 1,
      skippedCount: 0,
    });
    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(notifications.create).toHaveBeenNthCalledWith(1, failure.metadata.notificationRecoveries[0]);
    expect(notifications.create).toHaveBeenNthCalledWith(2, failure.metadata.notificationRecoveries[1]);
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'booking.post_commit_effect.recovered',
        metadata: expect.objectContaining({
          failureAuditId: 'audit-failure-1',
          notificationIds: ['notification-1', 'notification-2'],
        }),
        outcome: 'SUCCEEDED',
      }),
    });
  });

  it('rejects malformed post-commit recovery payloads before notification delivery', async () => {
    const prisma = {
      adminAuditLog: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{
            id: 'audit-failure-1',
            objectId: 'booking-1',
            target: 'booking:booking-1',
            metadata: {
              notificationRecovery: {
                body: 'Service started.',
                sourceKey: 'x'.repeat(201),
                title: 'Service started',
                type: 'booking.service_started',
                userId: 'user-1',
              },
            },
          }])
          .mockResolvedValueOnce([]),
      },
    } as unknown as PrismaService;
    const notifications = { create: vi.fn() };
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      queueFixture('payment-status-check'),
      prisma,
      undefined,
      undefined,
      undefined,
      undefined,
      notifications as never,
    );

    await expect(service.syncPostCommitNotificationRecoveries()).resolves.toMatchObject({
      recoveredCount: 0,
      skippedCount: 1,
    });
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('continues durable notification recovery past the first 100 rows without aging rows out', async () => {
    const notificationQueue = queueFixture('notification-retry');
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      recoverableNotification(`notification-${String(index + 1).padStart(3, '0')}`),
    );
    const prisma = {
      payment: { findMany: vi.fn().mockResolvedValue([]) },
      notification: {
        findMany: vi.fn()
          .mockResolvedValueOnce(firstPage)
          .mockResolvedValueOnce([recoverableNotification('notification-101')]),
      },
      notificationDelivery: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      notificationQueue,
      queueFixture('payment-status-check'),
      prisma,
    );
    const now = new Date('2026-08-17T12:00:00.000+07:00');

    await expect(service.syncMissingDurableJobs(now)).resolves.toMatchObject({
      registeredCount: 100,
      scannedCount: 100,
    });
    await expect(service.syncMissingDurableJobs(now)).resolves.toMatchObject({
      registeredCount: 1,
      scannedCount: 1,
    });

    const secondQuery = vi.mocked(prisma.notification.findMany).mock.calls[1]?.[0];
    expect(secondQuery).toEqual(expect.objectContaining({
      cursor: { id: 'notification-100' },
      skip: 1,
      where: expect.objectContaining({
        createdAt: { lte: new Date('2026-08-17T04:59:30.000Z') },
      }),
    }));
    expect(notificationQueue.add).toHaveBeenCalledTimes(101);
  });

  it('recovers transient notification deliveries without retrying unknown or wrong-role paths', async () => {
    const notificationQueue = queueFixture('notification-retry');
    const prisma = {
      payment: { findMany: vi.fn().mockResolvedValue([]) },
      notification: {
        findMany: vi.fn().mockResolvedValue([
          recoverableNotification('notification-transient', {
            deliveries: [{
              pushDeviceId: 'device-1',
              response: { failureCode: 'messaging/internal-error' },
              status: 'FAILED',
            }],
          }),
          recoverableNotification('notification-unknown', {
            deliveries: [{
              pushDeviceId: 'device-1',
              response: { failureCode: 'DELIVERY_OUTCOME_UNKNOWN' },
              status: 'FAILED',
            }],
          }),
          recoverableNotification('notification-wrong-role', {
            user: { pushDevices: [{ id: 'device-1', role: Role.CUSTOMER }] },
          }),
        ]),
      },
      notificationDelivery: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      notificationQueue,
      queueFixture('payment-status-check'),
      prisma,
    );

    await expect(service.syncMissingDurableJobs()).resolves.toMatchObject({
      byFlow: { notification: { registeredCount: 1 } },
      scannedCount: 3,
    });
    expect(notificationQueue.add).toHaveBeenCalledTimes(1);
    expect(notificationQueue.add).toHaveBeenCalledWith(
      'notification-send',
      { notificationId: 'notification-transient' },
      expect.any(Object),
    );
  });

  it('retries retained failed durable jobs and reports the recovery truthfully', async () => {
    const paymentQueue = queueFixture('payment-status-check', { jobState: 'failed' });
    const prisma = {
      payment: { findMany: vi.fn().mockResolvedValue([{ id: 'payment-1' }]) },
      notification: { findMany: vi.fn().mockResolvedValue([]) },
      notificationDelivery: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      paymentQueue,
      prisma,
    );

    await expect(service.syncMissingDurableJobs()).resolves.toMatchObject({
      byFlow: { paymentStatus: { retriedCount: 1 } },
      registeredCount: 0,
      retriedCount: 1,
    });
    expect(paymentQueue.add).not.toHaveBeenCalled();
  });

  it('removes a retained failed job after recording its resolution', async () => {
    const fixture = prismaFixture({
      reviewLogs: [
        {
          action: 'admin.background_jobs.failure_alerted',
          createdAt: new Date('2026-07-14T04:00:00.000+07:00'),
          metadata: {},
        },
        {
          action: 'admin.background_jobs.failure_acknowledged',
          createdAt: new Date('2026-07-14T04:05:00.000+07:00'),
          metadata: {},
        },
      ],
    });
    const paymentQueue = queueFixture('payment-status-check');
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      paymentQueue,
      fixture.prisma,
    );

    await expect(service.resolveFailure(
      'internal-admin',
      'payment-status-check',
      'payment-failure-1',
      'Provider credentials corrected',
      'master@hands.vn',
    )).resolves.toMatchObject({ ok: true, status: 'RESOLVED' });
    const job = await paymentQueue.getJob('payment-failure-1');
    expect(job?.remove).toHaveBeenCalledOnce();
  });

  it('fails the monitor when a durable job cannot be registered', async () => {
    const paymentQueue = queueFixture('payment-status-check', { jobState: null });
    vi.mocked(paymentQueue.add).mockRejectedValueOnce(new Error('Redis unavailable'));
    const prisma = {
      payment: { findMany: vi.fn().mockResolvedValue([{ id: 'payment-1' }]) },
      notification: { findMany: vi.fn().mockResolvedValue([]) },
      notificationDelivery: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const service = new AdminBackgroundJobsService(
      queueFixture('bank-statement-escalation'),
      queueFixture('booking-timeouts'),
      queueFixture('notification-retry'),
      paymentQueue,
      prisma,
    );

    await expect(service.syncMissingDurableJobs()).rejects.toThrow(
      'Failed to register 1 durable background job(s)',
    );
  });
});

function queueFixture(
  name: string,
  input: {
    active?: Job[];
    completed?: Job[];
    counts?: Partial<Record<'active' | 'delayed' | 'failed' | 'paused' | 'waiting', number>>;
    delayed?: Job[];
    failed?: Job[];
    schedulers?: Array<{ key: string; name: string; next: number }>;
    waiting?: Job[];
    workers?: number;
    jobState?: string | null;
  } = {},
) {
  return {
    add: vi.fn().mockResolvedValue({}),
    getJobCounts: vi.fn().mockResolvedValue({
      active: input.counts?.active ?? 0,
      delayed: input.counts?.delayed ?? 0,
      failed: input.counts?.failed ?? 0,
      paused: input.counts?.paused ?? 0,
      waiting: input.counts?.waiting ?? 0,
    }),
    getJobSchedulers: vi.fn().mockResolvedValue(
      input.schedulers ?? (name === 'bank-statement-escalation' ? backgroundMonitorSchedulers() : []),
    ),
    getJobs: vi.fn((type: string, start = 0, end = -1) => {
      const jobs = {
        active: input.active ?? [],
        completed: input.completed ?? [],
        delayed: input.delayed ?? [],
        failed: input.failed ?? [],
        waiting: input.waiting ?? [],
      }[type] ?? [];
      return Promise.resolve(jobs.slice(start, end + 1));
    }),
    getJob: vi.fn().mockResolvedValue(input.jobState === null ? null : {
      getState: vi.fn().mockResolvedValue(input.jobState ?? 'failed'),
      remove: vi.fn().mockResolvedValue(undefined),
      retry: vi.fn().mockResolvedValue(undefined),
    }),
    getWorkersCount: vi.fn().mockResolvedValue(input.workers ?? 1),
    name,
  } as unknown as Queue;
}

function backgroundMonitorSchedulers(now: number | Date = Date.now()) {
  const next = (now instanceof Date ? now.getTime() : now) + 60_000;
  return [
    {
      key: BANK_STATEMENT_ESCALATION_SCHEDULER_ID,
      name: 'bank-statement-escalation-sweep',
      next,
    },
    {
      key: BACKGROUND_JOB_FAILURE_MONITOR_SCHEDULER_ID,
      name: 'background-job-failure-monitor',
      next,
    },
  ];
}

type RecoverableNotificationFixture = {
  data: { deliveryIntent: string; targetRole: Role };
  deliveries: Array<{ pushDeviceId: string; response: unknown; status: string }>;
  id: string;
  type: string;
  user: { pushDevices: Array<{ id: string; role: Role }> };
};

function recoverableNotification(
  id: string,
  overrides: Partial<RecoverableNotificationFixture> = {},
) {
  return { ...recoverableNotificationBase(id), ...overrides };
}

function recoverableNotificationBase(id: string): RecoverableNotificationFixture {
  return {
    data: { deliveryIntent: 'PUSH_AND_IN_APP', targetRole: Role.PROVIDER },
    deliveries: [],
    id,
    type: 'booking.requested',
    user: { pushDevices: [{ id: 'device-1', role: Role.PROVIDER }] },
  };
}

function jobFixture(input: {
  attemptsMade?: number;
  data?: Record<string, unknown>;
  delay?: number;
  failedOn?: number;
  failedReason?: string;
  finishedOn?: number;
  id: string;
  maxAttempts?: number;
  name?: string;
  processedOn?: number;
  timestamp?: number;
}) {
  return {
    attemptsMade: input.attemptsMade ?? 0,
    data: input.data ?? { secretPayload: 'must-not-leak' },
    delay: input.delay ?? 0,
    failedReason: input.failedReason,
    finishedOn: input.failedOn ?? input.finishedOn,
    id: input.id,
    name: input.name ?? 'job',
    opts: { attempts: input.maxAttempts },
    processedOn: input.processedOn,
    timestamp: input.timestamp,
  } as Job;
}

function prismaFixture(input: {
  existingAudit?: boolean;
  latestQueueHealthAudits?: Record<string, { action: string; actorId: string; id: string }>;
  latestRecurringIncidents?: Record<string, {
    action: string;
    actorId: string;
    createdAt: Date;
    id: string;
    metadata: Record<string, unknown>;
    target: string;
  }>;
  recipients?: string[];
  queueHealthLogs?: Array<{
    action: string;
    actor: { email: string | null; fullName: string | null; id: string };
    createdAt: Date;
    id: string;
    metadata: Record<string, unknown>;
    target: string;
  }>;
  recurringIncidentLogs?: Array<{
    action: string;
    actor?: { email: string | null; fullName: string | null; id: string };
    actorId: string;
    createdAt: Date;
    id: string;
    metadata: Record<string, unknown>;
    target: string;
  }>;
  reviewLogs?: Array<{
    action: string;
    actor?: { email?: string | null; fullName?: string | null; id: string };
    createdAt: Date;
    metadata?: Record<string, unknown>;
    target?: string;
  }>;
  } = {}) {
  let notificationSequence = 0;
  const reviewLogs = input.reviewLogs ?? [];
  const queueHealthLogs = input.queueHealthLogs ?? [];
  const recurringIncidentLogs = input.recurringIncidentLogs ?? [];
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
    adminAuditLog: {
      create: vi.fn().mockImplementation((args: { data: { action: string; metadata?: unknown } }) => Promise.resolve({
        action: args.data.action,
        createdAt: new Date('2026-07-14T04:01:00.000+07:00'),
        id: 'audit-1',
        metadata: args.data.metadata ?? null,
      })),
      findFirst: vi.fn().mockImplementation((args: { where?: { target?: string } }) => {
        if (args.where?.target?.startsWith('background_job_queue_health:')) {
          return Promise.resolve(input.latestQueueHealthAudits?.[args.where.target] ?? null);
        }
        if (args.where?.target?.startsWith('background_job_recurring_incident:')) {
          return Promise.resolve(input.latestRecurringIncidents?.[args.where.target] ?? null);
        }
        return Promise.resolve(input.existingAudit ? { id: 'audit-existing' } : null);
      }),
      findMany: vi.fn().mockResolvedValue(reviewLogs),
    },
    notification: {
      create: vi.fn().mockImplementation(() => {
        notificationSequence += 1;
        return Promise.resolve({ id: `notification-${notificationSequence}` });
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'master-1',
        roles: ['ADMIN', 'MASTER_ADMIN'],
        adminOperatorPermission: null,
      }),
      findMany: vi.fn().mockResolvedValue(
        (input.recipients ?? ['master-1']).map((id) => ({ id })),
      ),
    },
  };
  const prisma = {
    $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    adminAuditLog: {
      count: vi.fn().mockImplementation((args: AuditQueryArgs) => Promise.resolve(
        isRecurringIncidentAuditQuery(args)
          ? filterRecurringIncidentLogs(recurringIncidentLogs, args).length
          : filterQueueHealthLogs(queueHealthLogs, args).length,
      )),
      findMany: vi.fn().mockImplementation((args: AuditQueryArgs = {}) => {
        if (isQueueHealthAuditQuery(args)) {
          const filtered = filterQueueHealthLogs(queueHealthLogs, args);
          return Promise.resolve(filtered.slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? filtered.length)));
        }
        if (isRecurringIncidentAuditQuery(args)) {
          const filtered = filterRecurringIncidentLogs(recurringIncidentLogs, args)
            .map((row) => ({
              ...row,
              actor: row.actor ?? { email: 'master@hands.vn', fullName: 'Master Admin', id: row.actorId },
            }));
          return Promise.resolve(filtered.slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? filtered.length)));
        }
        return Promise.resolve(reviewLogs);
      }),
    },
  } as unknown as PrismaService;

  return { prisma, tx };
}

type AuditQueryArgs = {
  orderBy?: unknown;
  select?: unknown;
  skip?: number;
  take?: number;
  where?: {
    action?: string | { in?: string[] };
    createdAt?: { gte?: Date };
    OR?: Array<{
      metadata?: { equals?: string; path?: string[] };
      target?: string;
    }>;
    target?: string | { in?: string[]; startsWith?: string };
  };
};

function isQueueHealthAuditQuery(args: AuditQueryArgs) {
  const action = args.where?.action;
  const actions = typeof action === 'string' ? [action] : action?.in ?? [];
  return actions.some((value) => value.includes('queue_stale_'));
}

function isRecurringIncidentAuditQuery(args: AuditQueryArgs) {
  const action = args.where?.action;
  const actions = typeof action === 'string' ? [action] : action?.in ?? [];
  return actions.some((value) => value.includes('recurring_incident_'));
}

function filterRecurringIncidentLogs(
  logs: NonNullable<Parameters<typeof prismaFixture>[0]>['recurringIncidentLogs'],
  args: AuditQueryArgs,
) {
  const action = args.where?.action;
  const actions = typeof action === 'string' ? [action] : action?.in ?? [];
  const target = args.where?.target;
  const exactTarget = typeof target === 'string' ? target : null;
  const prefix = typeof target === 'object' ? target.startsWith : undefined;
  const cutoff = args.where?.createdAt?.gte;
  const alternatives = args.where?.OR ?? [];
  return (logs ?? [])
    .filter((row) => actions.length === 0 || actions.includes(row.action))
    .filter((row) => exactTarget === null || row.target === exactTarget)
    .filter((row) => !prefix || row.target.startsWith(prefix))
    .filter((row) => !cutoff || row.createdAt >= cutoff)
    .filter((row) => alternatives.length === 0 || alternatives.some((alternative) => (
      (!alternative.target || alternative.target === row.target) &&
      (!alternative.metadata?.equals || row.metadata.openedAuditId === alternative.metadata.equals)
    )))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

function filterQueueHealthLogs(
  logs: NonNullable<Parameters<typeof prismaFixture>[0]>['queueHealthLogs'],
  args: AuditQueryArgs,
) {
  const action = args.where?.action;
  const actions = typeof action === 'string' ? [action] : action?.in ?? [];
  const target = typeof args.where?.target === 'string' ? args.where.target : null;
  const cutoff = args.where?.createdAt?.gte;
  return (logs ?? [])
    .filter((row) => actions.length === 0 || actions.includes(row.action))
    .filter((row) => target === null || row.target === target)
    .filter((row) => !cutoff || row.createdAt >= cutoff)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}
