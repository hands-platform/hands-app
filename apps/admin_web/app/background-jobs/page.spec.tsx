import { renderToStaticMarkup } from 'react-dom/server';
import { adminGet } from '../../lib/admin-api';
import BackgroundJobsPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');
  return { ...actual, adminGet: vi.fn() };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('BackgroundJobsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders bounded queue health and sanitized retained failures', async () => {
    mockedAdminGet.mockResolvedValue({
      failedJobs: [{
        attemptsMade: 3,
        execution: {
          attemptsMade: 3,
          failedAt: '2026-07-14T03:00:00.000Z',
          lastStartedAt: '2026-07-14T02:59:55.000Z',
          maxAttempts: 5,
          queuedAt: '2026-07-14T02:58:00.000Z',
        },
        failedAt: '2026-07-14T03:00:00.000Z',
        failure: 'Provider unavailable',
        id: 'failed-1',
        name: 'notification-send',
        queueName: 'notification-retry',
        reference: { id: 'notification-123', kind: 'NOTIFICATION' },
        review: {
          actor: null,
          reason: null,
          status: 'NEW',
          updatedAt: '2026-07-14T03:01:00.000Z',
        },
      }],
      failurePage: {
        complete: false,
        hasNextPage: true,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        scannedCount: 1,
        totalCount: null,
      },
      generatedAt: '2026-07-14T03:05:00.000Z',
      healthEvents: [{
        actor: { email: 'master@hands.vn', fullName: 'Master Admin', id: 'master-1' },
        detectedAt: '2026-07-14T02:55:00.000Z',
        event: 'ALERTED',
        id: 'health-event-1',
        oldestOpenJobAt: '2026-07-14T02:50:00.000Z',
        oldestOpenJobState: 'WAITING',
        openJobLagMs: 300_000,
        queueName: 'notification-retry',
        recordedAt: '2026-07-14T02:55:01.000Z',
        staleAfterMs: 120_000,
      }],
      healthEventPage: {
        hasNextPage: true,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalCount: 11,
      },
      ok: false,
      queues: [{
        counts: { active: 0, delayed: 2, failed: 1, paused: 0, waiting: 0 },
        expectedSchedulerId: null,
        expectedSchedulerPresent: true,
        label: 'Notification delivery',
        lastCompletedAt: null,
        lastFailedAt: '2026-07-14T03:00:00.000Z',
        name: 'notification-retry',
        nextScheduledAt: null,
        oldestOpenJobAt: '2026-07-14T02:55:00.000Z',
        oldestOpenJobState: 'WAITING',
        openJobLagMs: 300_000,
        schedulerCount: 0,
        staleAfterMs: 120_000,
        status: 'STALE',
        workers: 1,
      }],
      recurringIncidents: [{
        actor: { email: 'master@hands.vn', fullName: 'Master Admin', id: 'master-1' },
        firstFailureAt: '2026-07-14T02:56:00.000Z',
        firstFailureJobId: 'repeat:notification-delivery:1',
        id: 'incident-open-1',
        jobName: 'notification-delivery-sweep',
        openedAt: '2026-07-14T02:56:01.000Z',
        queueName: 'notification-retry',
        recoveredAt: '2026-07-14T03:04:00.000Z',
        resolvedFailureCount: 3,
        status: 'RECOVERED',
      }],
      recurringIncidentPage: {
        complete: true,
        hasNextPage: true,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        scannedCount: 10,
        totalCount: 12,
      },
      recurringIncidentSummary: {
        complete: true,
        openCount: 2,
        recoveredCount: 10,
        scannedCount: 22,
      },
    });

    const markup = renderToStaticMarkup(await BackgroundJobsPage({}));

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/system/background-jobs?eventPage=1&eventStatus=ALL&incidentPage=1&incidentStatus=ALL&page=1&pageSize=10&queue=ALL&range=ALL&review=OPEN',
      expect.any(Object),
    );
    expect(markup).toContain('Background Jobs');
    expect(markup).toContain('Notification delivery');
    expect(markup).toContain('STALE');
    expect(markup).toContain('<th scope="col">State</th><th scope="col">Queue</th><th scope="col">Waiting</th><th scope="col">Active</th><th scope="col">Failed</th><th scope="col">SLA / delay</th><th scope="col">Action</th>');
    expect(markup).toContain('Technical evidence');
    expect(markup).toContain('<th scope="col">Queue ID</th><th scope="col">Workers</th><th scope="col">Delayed</th>');
    expect(markup).toContain('5m overdue');
    expect(markup).toContain('2m');
    expect(markup).toContain('Provider unavailable');
    expect(markup).toContain('Failed job records');
    expect(markup).toContain('Queue health events');
    expect(markup).toContain('Recurring job incidents');
    expect(markup).toContain('Recurring incidents');
    expect(markup).toContain('Open incidents');
    expect(markup).toContain('Needs action');
    expect(markup).toContain('incidentStatus=OPEN');
    expect(markup).toContain('notification-delivery-sweep');
    expect(markup).toContain('12 incidents');
    expect(markup).toContain('3</td>');
    expect(markup).toContain('incidentPage=2');
    expect(markup).toContain('11 events');
    expect(markup).toContain('ALERTED');
    expect(markup).toContain('Master Admin');
    expect(markup).toContain('eventPage=2&amp;eventStatus=ALL');
    expect(markup).toContain('Failure filters');
    expect(markup).toContain('Review status');
    expect(markup).toContain('NEW');
    expect(markup).toContain('Acknowledge');
    expect(markup).toContain('/audit-log?bucket=Notification&amp;q=notification-123&amp;range=all');
    expect(markup).toContain('Open record');
    expect(markup).toContain('NOTIFICATION: notification-123');
    expect(markup).toContain('3 / 5');
    expect(markup).toContain('Last attempt started');
    expect(markup).toContain('BullMQ does not retain a timestamp for every retry');
    expect(markup).toContain('additional retained failures may exist');
    expect(markup).toContain('page=2&amp;pageSize=10&amp;queue=ALL&amp;range=ALL&amp;review=OPEN');
    expect(markup).toContain('Next');
    expect(markup).not.toContain('Retry');
    expect(markup).not.toContain('secretPayload');
    expect(markup.indexOf('<h2>Queue health</h2>')).toBeLessThan(
      markup.indexOf('<h2>Recurring job incidents</h2>'),
    );
    expect(markup.indexOf('<h2>Recurring job incidents</h2>')).toBeLessThan(
      markup.indexOf('<h2>Failed job records</h2>'),
    );
    expect(markup.indexOf('<h2>Failed job records</h2>')).toBeLessThan(
      markup.indexOf('<h2>Queue health events</h2>'),
    );
  });

  it('offers a manual capture action for an untracked retained failure', async () => {
    mockedAdminGet.mockResolvedValue({
      ...structuredClone({
        failedJobs: [],
        failurePage: {
          complete: true,
          hasNextPage: false,
          hasPreviousPage: false,
          page: 1,
          pageSize: 10,
          scannedCount: 0,
          totalCount: 0,
        },
        generatedAt: '2026-07-14T03:05:00.000Z',
        healthEvents: [],
        healthEventPage: {
          hasNextPage: false,
          hasPreviousPage: false,
          page: 1,
          pageSize: 10,
          totalCount: 0,
        },
        ok: true,
        queues: [],
      }),
      failedJobs: [{
        attemptsMade: 3,
        execution: {
          attemptsMade: 3,
          failedAt: '2026-07-14T03:00:00.000Z',
          lastStartedAt: '2026-07-14T02:59:55.000Z',
          maxAttempts: 3,
          queuedAt: '2026-07-14T02:58:00.000Z',
        },
        failedAt: '2026-07-14T03:00:00.000Z',
        failure: 'Monitor failed before alert registration',
        id: 'untracked-1',
        name: 'background-job-failure-monitor',
        queueName: 'bank-statement-escalation',
        reference: null,
        review: {
          actor: null,
          reason: null,
          status: 'UNTRACKED',
          updatedAt: null,
        },
      }],
      queues: [{
        counts: { active: 0, delayed: 0, failed: 1, paused: 0, waiting: 0 },
        expectedSchedulerId: 'scheduler-1',
        expectedSchedulerPresent: true,
        label: 'Bank statement escalation',
        lastCompletedAt: null,
        lastFailedAt: '2026-07-14T03:00:00.000Z',
        name: 'bank-statement-escalation',
        nextScheduledAt: null,
        oldestOpenJobAt: null,
        oldestOpenJobState: null,
        openJobLagMs: 0,
        schedulerCount: 1,
        staleAfterMs: 600_000,
        status: 'ATTENTION',
        workers: 1,
      }],
    });

    const markup = renderToStaticMarkup(await BackgroundJobsPage({}));

    expect(markup).toContain('UNTRACKED');
    expect(markup).toContain('Capture &amp; acknowledge');
    expect(markup).not.toContain('Monitor pending');
  });

  it('shows a required resolution note after a failure is acknowledged', async () => {
    mockedAdminGet.mockResolvedValue({
      failedJobs: [{
        attemptsMade: 1,
        execution: {
          attemptsMade: 1,
          failedAt: '2026-07-14T03:00:00.000Z',
          lastStartedAt: null,
          maxAttempts: 1,
          queuedAt: null,
        },
        failedAt: '2026-07-14T03:00:00.000Z',
        failure: 'Gateway timeout',
        id: 'failed-2',
        name: 'payment-status-check',
        queueName: 'payment-status-check',
        reference: { id: 'payment-123', kind: 'PAYMENT' },
        review: {
          actor: { email: 'master@hands.vn', fullName: 'Master Admin', id: 'master-1' },
          reason: null,
          status: 'ACKNOWLEDGED',
          updatedAt: '2026-07-14T03:02:00.000Z',
        },
      }],
      failurePage: {
        complete: true,
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        scannedCount: 1,
        totalCount: 1,
      },
      generatedAt: '2026-07-14T03:05:00.000Z',
      healthEvents: [],
      healthEventPage: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalCount: 0,
      },
      ok: false,
      queues: [{
        counts: { active: 0, delayed: 0, failed: 1, paused: 0, waiting: 0 },
        expectedSchedulerId: null,
        expectedSchedulerPresent: true,
        label: 'Payment status check',
        lastCompletedAt: null,
        lastFailedAt: '2026-07-14T03:00:00.000Z',
        name: 'payment-status-check',
        nextScheduledAt: null,
        schedulerCount: 0,
        status: 'ATTENTION',
        workers: 1,
      }],
    });

    const markup = renderToStaticMarkup(await BackgroundJobsPage({}));

    expect(markup).toContain('ACKNOWLEDGED');
    expect(markup).toContain('Master Admin');
    expect(markup).toContain('Resolution note');
    expect(markup).toContain('Resolve');
    expect(markup).toContain('minLength="3"');
    expect(markup).toContain('Not retained');
  });

  it('renders a success notice without implying that the queue job was retried', async () => {
    mockedAdminGet.mockResolvedValue({
      failedJobs: [],
      failurePage: {
        complete: true,
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        scannedCount: 0,
        totalCount: 0,
      },
      generatedAt: '2026-07-14T03:05:00.000Z',
      healthEvents: [],
      healthEventPage: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalCount: 0,
      },
      ok: true,
      queues: [{
        counts: { active: 0, delayed: 0, failed: 0, paused: 0, waiting: 0 },
        expectedSchedulerId: null,
        expectedSchedulerPresent: true,
        label: 'Payment status check',
        lastCompletedAt: null,
        lastFailedAt: null,
        name: 'payment-status-check',
        nextScheduledAt: null,
        schedulerCount: 0,
        status: 'HEALTHY',
        workers: 1,
      }],
    });

    const markup = renderToStaticMarkup(await BackgroundJobsPage({
      searchParams: Promise.resolve({ notice: 'acknowledged' }),
    }));

    expect(markup).toContain('Failure acknowledged');
    expect(markup).toContain('was not retried or changed');
  });

  it('keeps an exact retained job id on the API request and pagination links', async () => {
    const jobId = 'repeat:background-job-failure-monitor:1783980324023';
    mockedAdminGet.mockResolvedValue({
      failedJobs: [],
      failurePage: {
        complete: false,
        hasNextPage: true,
        hasPreviousPage: false,
        page: 1,
        pageSize: 5,
        scannedCount: 500,
        totalCount: null,
      },
      generatedAt: '2026-07-14T03:05:00.000Z',
      healthEvents: [],
      healthEventPage: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 5,
        totalCount: 0,
      },
      ok: true,
      queues: [{
        counts: { active: 0, delayed: 0, failed: 501, paused: 0, waiting: 0 },
        expectedSchedulerId: null,
        expectedSchedulerPresent: true,
        label: 'Bank statement escalation',
        lastCompletedAt: null,
        lastFailedAt: '2026-07-14T03:00:00.000Z',
        name: 'bank-statement-escalation',
        nextScheduledAt: null,
        schedulerCount: 0,
        status: 'ATTENTION',
        workers: 1,
      }],
    });

    const markup = renderToStaticMarkup(await BackgroundJobsPage({
      searchParams: Promise.resolve({
        jobId,
        pageSize: '5',
        queue: 'bank-statement-escalation',
        range: 'ALL',
        review: 'ALL',
      }),
    }));

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/system/background-jobs?eventPage=1&eventStatus=ALL&incidentPage=1&incidentStatus=ALL&page=1&pageSize=5&queue=bank-statement-escalation&range=ALL&review=ALL&jobId=repeat%3Abackground-job-failure-monitor%3A1783980324023',
      expect.any(Object),
    );
    expect(markup).toContain('Job ID');
    expect(markup).toContain(`value="${jobId}"`);
    expect(markup).toContain('page=2&amp;pageSize=5&amp;queue=bank-statement-escalation');
    expect(markup).toContain('jobId=repeat%3Abackground-job-failure-monitor%3A1783980324023');
    expect(markup).toContain(
      'jobId=repeat%3Abackground-job-failure-monitor%3A1783980324023">Refresh status',
    );
  });

  it('renders nullable system audit actors without attributing them to a human operator', async () => {
    mockedAdminGet.mockResolvedValue({
      failedJobs: [],
      failurePage: {
        complete: true,
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        scannedCount: 0,
        totalCount: 0,
      },
      generatedAt: '2026-07-14T03:05:00.000Z',
      healthEvents: [{
        actor: null,
        actorKey: 'background-job-monitor',
        actorLabelSnapshot: 'HANDS background monitor',
        actorType: 'SYSTEM',
        detectedAt: '2026-07-14T02:55:00.000Z',
        event: 'ALERTED',
        id: 'health-event-system',
        oldestOpenJobAt: null,
        oldestOpenJobState: null,
        openJobLagMs: 300_000,
        queueName: 'notification-retry',
        recordedAt: '2026-07-14T02:55:01.000Z',
        staleAfterMs: 120_000,
      }],
      healthEventPage: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalCount: 1,
      },
      ok: false,
      queues: [{
        counts: { active: 0, delayed: 0, failed: 0, paused: 0, waiting: 0 },
        expectedSchedulerId: null,
        expectedSchedulerPresent: true,
        label: 'Notification delivery',
        lastCompletedAt: null,
        lastFailedAt: null,
        name: 'notification-retry',
        nextScheduledAt: null,
        oldestOpenJobAt: null,
        oldestOpenJobState: null,
        openJobLagMs: 0,
        schedulerCount: 0,
        staleAfterMs: 120_000,
        status: 'HEALTHY',
        workers: 1,
      }],
      recurringIncidents: [{
        actor: null,
        actorKey: null,
        actorLabelSnapshot: null,
        actorType: 'SYSTEM',
        firstFailureAt: null,
        firstFailureJobId: null,
        id: 'incident-system',
        jobName: 'background-job-failure-monitor',
        openedAt: '2026-07-14T02:56:01.000Z',
        queueName: 'bank-statement-escalation',
        recoveredAt: null,
        resolvedFailureCount: 0,
        status: 'OPEN',
      }],
      recurringIncidentPage: {
        complete: true,
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        scannedCount: 1,
        totalCount: 1,
      },
      recurringIncidentSummary: {
        complete: true,
        openCount: 1,
        recoveredCount: 0,
        scannedCount: 1,
      },
    });

    const markup = renderToStaticMarkup(await BackgroundJobsPage({}));

    expect(markup).toContain('HANDS background monitor');
    expect(markup).toContain('HANDS system');
    expect(markup).not.toContain('Master Admin');
  });

  it('renders partial queue availability and incomplete review coverage without a healthy claim', async () => {
    mockedAdminGet.mockResolvedValue({
      availability: {
        failureReviews: 'AVAILABLE',
        healthEvents: 'UNAVAILABLE',
        queues: 'PARTIAL',
        recurringIncidents: 'UNAVAILABLE',
      },
      failedJobs: [],
      failurePage: {
        complete: false,
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        scannedCount: 0,
        totalCount: null,
        unavailableQueueNames: ['booking-timeouts'],
      },
      generatedAt: '2026-07-14T03:05:00.000Z',
      healthEvents: [],
      healthEventPage: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        totalCount: 0,
      },
      ok: false,
      queues: [{
        availability: 'AVAILABLE',
        counts: { active: 0, delayed: 0, failed: 6, paused: 0, waiting: 0 },
        expectedSchedulerId: null,
        expectedSchedulerPresent: true,
        failureReviewCoverage: 'INCOMPLETE',
        label: 'Payment status check',
        lastCompletedAt: null,
        lastFailedAt: null,
        name: 'payment-status-check',
        nextScheduledAt: null,
        oldestOpenJobAt: null,
        oldestOpenJobState: null,
        openJobLagMs: 0,
        schedulerCount: 0,
        staleAfterMs: 120_000,
        status: 'HEALTHY',
        unresolvedFailureCount: 0,
        workers: 1,
      }, {
        availability: 'UNAVAILABLE',
        counts: { active: 0, delayed: 0, failed: 0, paused: 0, waiting: 0 },
        expectedSchedulerId: null,
        expectedSchedulerPresent: false,
        failureReviewCoverage: 'UNAVAILABLE',
        label: 'Booking timeout',
        lastCompletedAt: null,
        lastFailedAt: null,
        name: 'booking-timeouts',
        nextScheduledAt: null,
        oldestOpenJobAt: null,
        oldestOpenJobState: null,
        openJobLagMs: 0,
        schedulerCount: 0,
        staleAfterMs: 120_000,
        status: 'ATTENTION',
        unresolvedFailureCount: 0,
        workers: 0,
      }],
      recurringIncidents: [],
      recurringIncidentPage: {
        complete: true,
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 10,
        scannedCount: 0,
        totalCount: 0,
      },
      recurringIncidentSummary: {
        complete: true,
        openCount: 0,
        recoveredCount: 0,
        scannedCount: 0,
      },
    });

    const markup = renderToStaticMarkup(await BackgroundJobsPage({}));

    expect(markup).toContain('Partial data — 1 queue unavailable');
    expect(markup).toContain('PARTIAL');
    expect(markup).toContain('UNAVAILABLE');
    expect(markup).toContain('6 retained');
    expect(markup).toContain('Review coverage incomplete · 0 visible unresolved');
    expect(markup).toContain('Queue health audit history is unavailable');
    expect(markup).toContain('Recurring incident audit evidence is unavailable');
    expect(markup).not.toContain('Background job health unavailable');
  });

  it('shows an explicit error state when queue health is unavailable', async () => {
    mockedAdminGet.mockImplementation(async (_path, fallback) => fallback);

    const markup = renderToStaticMarkup(await BackgroundJobsPage({}));

    expect(markup).toContain('Background job health unavailable');
    expect(markup).toContain('Confirm API and Redis availability');
  });
});
