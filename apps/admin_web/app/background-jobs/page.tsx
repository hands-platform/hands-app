import {
  AdminBoundedTableFooter,
  AdminDataTable,
  AdminTableFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormControlStack,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminInlineForm } from '../../components/admin-inline-action-form';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminDisclosure, AdminErrorState, AdminNoticeCard } from '../../components/admin-surface';
import { AdminTableSection } from '../../components/admin-table-panel';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge, type StatusBadgeTone } from '../../components/status-badge';
import {
  adminGet,
  type AdminBackgroundJobHealth,
  type AdminBackgroundJobQueueStatus,
  type AdminBackgroundJobReference,
  type AdminBackgroundJobReviewStatus,
} from '../../lib/admin-api';
import { adminWorkflowStatusLabel } from '../../lib/admin-copy';
import {
  acknowledgeBackgroundJobFailure,
  resolveBackgroundJobFailure,
} from './actions';
import { backgroundJobAuditActorLabel } from './background-job-audit-actor';
import { backgroundJobWorkflow } from './background-job-workflows';

const unavailableHealth: AdminBackgroundJobHealth = {
  availability: {
    failureReviews: 'UNAVAILABLE',
    healthEvents: 'UNAVAILABLE',
    queues: 'UNAVAILABLE',
    recurringIncidents: 'UNAVAILABLE',
  },
  failedJobs: [],
  generatedAt: new Date(0).toISOString(),
  ok: false,
  queues: [],
  failurePage: {
    complete: true,
    hasNextPage: false,
    hasPreviousPage: false,
    page: 1,
    pageSize: 10,
    scannedCount: 0,
    totalCount: 0,
    unavailableQueueNames: [],
  },
  healthEvents: [],
  healthEventPage: {
    hasNextPage: false,
    hasPreviousPage: false,
    page: 1,
    pageSize: 10,
    totalCount: 0,
  },
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
};

type BackgroundJobsPageProps = {
  readonly searchParams?: Promise<{
    readonly notice?: string | string[];
    readonly eventPage?: string | string[];
    readonly eventStatus?: string | string[];
    readonly incidentPage?: string | string[];
    readonly incidentStatus?: string | string[];
    readonly jobId?: string | string[];
    readonly page?: string | string[];
    readonly pageSize?: string | string[];
    readonly queue?: string | string[];
    readonly range?: string | string[];
    readonly review?: string | string[];
  }>;
};

export default async function BackgroundJobsPage({ searchParams }: BackgroundJobsPageProps) {
  const params = searchParams ? await searchParams : {};
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const filters = backgroundJobFilters(params);
  const query = new URLSearchParams({
    eventPage: String(filters.eventPage),
    eventStatus: filters.eventStatus,
    incidentPage: String(filters.incidentPage),
    incidentStatus: filters.incidentStatus,
    page: String(filters.page),
    pageSize: String(filters.pageSize),
    queue: filters.queue,
    range: filters.range,
    review: filters.review,
  });
  appendBackgroundJobId(query, filters.jobId);
  const returnTo = backgroundJobPageHref(filters, filters.page);
  const health = await adminGet<AdminBackgroundJobHealth>(
    `/admin/system/background-jobs?${query.toString()}`,
    unavailableHealth,
  );
  const failurePage = health.failurePage ?? unavailableHealth.failurePage;
  const healthEvents = health.healthEvents ?? [];
  const healthEventPage = health.healthEventPage ?? unavailableHealth.healthEventPage;
  const recurringIncidents = health.recurringIncidents ?? [];
  const recurringIncidentPage = health.recurringIncidentPage ?? unavailableHealth.recurringIncidentPage;
  const recurringIncidentSummary = health.recurringIncidentSummary ?? unavailableHealth.recurringIncidentSummary;
  const available = health.queues.length > 0;
  const healthAvailability = health.availability ?? {
    failureReviews: 'AVAILABLE' as const,
    healthEvents: 'AVAILABLE' as const,
    queues: available ? 'AVAILABLE' as const : 'UNAVAILABLE' as const,
    recurringIncidents: 'AVAILABLE' as const,
  };
  const failedCount = health.failedJobs.length;
  const visibleOpenFailureCount = health.failedJobs.filter(
    (job) => job.review?.status !== 'RESOLVED',
  ).length;
  const failureEvidencePartial = healthAvailability.failureReviews !== 'AVAILABLE' ||
    (failurePage.unavailableQueueNames?.length ?? 0) > 0;
  const pendingCount = health.queues.reduce(
    (total, queue) => total + queue.counts.waiting + queue.counts.active + queue.counts.delayed,
    0,
  );
  const healthyCount = health.queues.filter(
    (queue) => (queue.availability ?? 'AVAILABLE') === 'AVAILABLE' &&
      (queue.failureReviewCoverage ?? 'COMPLETE') === 'COMPLETE' &&
      queue.status !== 'ATTENTION' && queue.status !== 'STALE',
  ).length;

  return (
    <AdminPageTemplate
      actions={
        <AdminFormControlLink className="button-outline" href={returnTo}>
          Refresh status
        </AdminFormControlLink>
      }
      description="Developer/System queue health, recurring schedules, and audited failure review."
      metrics={[
        {
          helper: 'Queues with a worker and required scheduler available.',
          kind: health.ok ? 'live' : 'risk',
          label: 'Healthy queues',
          scope: 'Live',
          value: `${healthyCount} / ${health.queues.length}`,
        },
        {
          helper: recurringIncidentSummary.complete
            ? 'Recurring scheduler incidents still awaiting a successful run.'
            : 'Bounded summary; additional older incidents may exist.',
          href: '/background-jobs?incidentStatus=OPEN&review=OPEN&range=ALL',
          kind: recurringIncidentSummary.openCount > 0 ? 'risk' : 'live',
          label: 'Open incidents',
          scope: 'Needs action',
          value: recurringIncidentSummary.openCount,
        },
        {
          helper: 'Waiting, active, and delayed jobs across the current queues.',
          kind: 'action',
          label: 'Open jobs',
          scope: 'Current queue',
          value: pendingCount,
        },
        {
          helper: 'Retained failures returned by the current server filters.',
          kind: visibleOpenFailureCount > 0 ? 'risk' : 'record',
          label: 'Failures shown',
          scope: 'Current page',
          value: failedCount,
        },
      ]}
      title="Background Jobs"
    >
      {backgroundJobNotice(notice)}
      {!available ? (
        <AdminErrorState
          message="Queue health could not be loaded. Confirm API and Redis availability, then refresh this page."
          title="Background job health unavailable"
        />
      ) : (
        <>
          {healthAvailability.queues !== 'AVAILABLE' ? (
            <AdminNoticeCard tone="warning">
              <strong>
                {healthAvailability.queues === 'UNAVAILABLE'
                  ? 'Queue data unavailable'
                  : `Partial data — ${health.queues.filter((queue) => queue.availability === 'UNAVAILABLE').length} queue unavailable`}
              </strong>
              <p>Available queue rows and database audit evidence remain visible. Unavailable reads are not counted as healthy or empty.</p>
            </AdminNoticeCard>
          ) : null}
          <AdminFilterPanel
            className="admin-mb-16"
            description="Filter retained BullMQ failures on the server. Queue reads are bounded and never expose job payloads or stack traces."
            resultLabel={backgroundJobResultLabel(health.failedJobs.length, failurePage.totalCount)}
            resultTone={visibleOpenFailureCount > 0 ? 'warning' : 'success'}
            title="Failure filters"
          >
            <AdminFormGrid action="/background-jobs" method="get">
              <AdminFormSelect
                defaultValue={filters.queue}
                label="Queue"
                labelVisibility="visible"
                name="queue"
                options={BACKGROUND_JOB_QUEUE_OPTIONS}
              />
              <AdminFormSelect
                defaultValue={filters.review}
                label="Review status"
                labelVisibility="visible"
                name="review"
                options={BACKGROUND_JOB_REVIEW_OPTIONS}
              />
              <AdminFormSelect
                defaultValue={filters.range}
                label="Failure period"
                labelVisibility="visible"
                name="range"
                options={BACKGROUND_JOB_RANGE_OPTIONS}
              />
              <AdminFormSelect
                defaultValue={filters.eventStatus}
                label="Health events"
                labelVisibility="visible"
                name="eventStatus"
                options={BACKGROUND_JOB_HEALTH_EVENT_OPTIONS}
              />
              <AdminFormSelect
                defaultValue={filters.incidentStatus}
                label="Recurring incidents"
                labelVisibility="visible"
                name="incidentStatus"
                options={BACKGROUND_JOB_INCIDENT_OPTIONS}
              />
              <AdminFormInput
                defaultValue={filters.jobId}
                label="Job ID"
                maxLength={300}
                name="jobId"
                placeholder="Exact retained job ID"
              />
              <AdminFormSelect
                defaultValue={String(filters.pageSize)}
                label="Rows per page"
                labelVisibility="visible"
                name="pageSize"
                options={[
                  { label: '5 rows', value: '5' },
                  { label: '10 rows', value: '10' },
                  { label: '20 rows', value: '20' },
                ]}
              />
              <AdminFormControlButton className="button-primary" type="submit">
                Apply filters
              </AdminFormControlButton>
              <AdminFormControlLink className="button-secondary" href="/background-jobs">
                Clear filters
              </AdminFormControlLink>
            </AdminFormGrid>
          </AdminFilterPanel>

          <AdminTableSection
            className="admin-mb-16"
            description={
              <>
                Snapshot generated <DateTimeText value={health.generatedAt} />. Job payloads and connection details are not exposed.
              </>
            }
            status={
              <StatusBadge tone={backgroundJobOverallTone(health, healthAvailability)}>
                {backgroundJobOverallLabel(health, healthAvailability)}
              </StatusBadge>
            }
            title="Queue health"
          >
            <AdminTableScroll>
              <AdminDataTable
                className="background-job-queue-table"
                emptyMessage="No monitored queues were returned."
                headers={[
                  'State',
                  'Queue',
                  'Waiting',
                  'Active',
                  'Failed',
                  'SLA / delay',
                  'Action',
                ]}
                rowCount={health.queues.length}
              >
                {health.queues.map((queue) => (
                  <tr key={queue.name}>
                    <td>
                      <StatusBadge tone={backgroundQueueState(queue).tone}>
                        {backgroundQueueState(queue).label}
                      </StatusBadge>
                    </td>
                    <td>
                      <strong>{queue.label}</strong>
                    </td>
                    <td>{(queue.availability ?? 'AVAILABLE') === 'AVAILABLE' ? queue.counts.waiting : 'Unavailable'}</td>
                    <td>{(queue.availability ?? 'AVAILABLE') === 'AVAILABLE' ? queue.counts.active : 'Unavailable'}</td>
                    <td>{backgroundQueueFailureEvidence(queue)}</td>
                    <td>
                      {(queue.availability ?? 'AVAILABLE') === 'AVAILABLE' ? (
                        <>
                          {backgroundQueueTiming(queue)}
                          <span className="muted">SLA {formatQueueDuration(queue.staleAfterMs)}</span>
                        </>
                      ) : 'Unavailable'}
                    </td>
                    <td>{backgroundJobWorkflowLink(queue.name)}</td>
                  </tr>
                ))}
              </AdminDataTable>
            </AdminTableScroll>
            <AdminBoundedTableFooter rowCount={health.queues.length} />
            <AdminDisclosure>
              <summary>Technical evidence</summary>
              <AdminTableScroll>
                <AdminDataTable
                  className="background-job-technical-table"
                  emptyMessage="No queue technical evidence was returned."
                  headers={['Queue ID', 'Workers', 'Delayed', 'Last run', 'Next scheduled', 'Scheduler']}
                  rowCount={health.queues.length}
                >
                  {health.queues.map((queue) => (
                    <tr key={queue.name}>
                      <td>{queue.name}</td>
                      <td>{(queue.availability ?? 'AVAILABLE') === 'AVAILABLE' ? queue.workers : 'Unavailable'}</td>
                      <td>{(queue.availability ?? 'AVAILABLE') === 'AVAILABLE' ? queue.counts.delayed : 'Unavailable'}</td>
                      <td>
                        <DateTimeText
                          fallback={queue.lastFailedAt ? 'Last run failed' : 'No retained run'}
                          value={queue.lastCompletedAt ?? queue.lastFailedAt}
                        />
                      </td>
                      <td>
                        <DateTimeText
                          fallback={queue.expectedSchedulerId ? 'Scheduler missing' : 'On demand'}
                          value={queue.nextScheduledAt}
                        />
                      </td>
                      <td>{queue.expectedSchedulerId ?? 'On demand'} · {queue.schedulerCount}</td>
                    </tr>
                  ))}
                </AdminDataTable>
              </AdminTableScroll>
            </AdminDisclosure>
          </AdminTableSection>

          <AdminTableSection
            className="admin-mb-16"
            description={healthAvailability.recurringIncidents === 'AVAILABLE'
              ? 'One row represents one recurring scheduler failure episode, from the first alert through successful recovery.'
              : 'Recurring incident audit evidence is unavailable. Queue snapshots above remain available.'}
            status={
              <StatusBadge tone={healthAvailability.recurringIncidents !== 'AVAILABLE'
                ? 'warning'
                : recurringIncidents.some((incident) => incident.status === 'OPEN') ? 'danger' : 'neutral'}>
                {healthAvailability.recurringIncidents === 'AVAILABLE'
                  ? `${recurringIncidentPage.totalCount ?? `${recurringIncidents.length}+`} incidents`
                  : 'Unavailable'}
              </StatusBadge>
            }
            title="Recurring job incidents"
          >
            <AdminTableScroll>
              <AdminDataTable
                className="background-job-recurring-incident-table"
                emptyMessage={healthAvailability.recurringIncidents === 'AVAILABLE'
                  ? 'No recurring scheduler incidents match the current queue and period filters.'
                  : 'Recurring incident audit evidence is unavailable.'}
                headers={[
                  'Status',
                  'Scheduler',
                  'Queue',
                  'Opened',
                  'First failure',
                  'Recovered',
                  'Resolved failures',
                  'Audit actor',
                  'Action',
                ]}
                rowCount={recurringIncidents.length}
              >
                {recurringIncidents.map((incident) => (
                  <tr key={incident.id}>
                    <td>
                      <StatusBadge tone={incident.status === 'OPEN' ? 'danger' : 'success'}>
                        {adminWorkflowStatusLabel(incident.status)}
                      </StatusBadge>
                    </td>
                    <td>
                      <strong>{incident.jobName}</strong>
                      {incident.firstFailureJobId ? (
                        <span className="muted">{incident.firstFailureJobId}</span>
                      ) : null}
                    </td>
                    <td>{backgroundJobQueueLabel(incident.queueName)}</td>
                    <td><DateTimeText value={incident.openedAt} /></td>
                    <td><DateTimeText fallback="Not retained" value={incident.firstFailureAt} /></td>
                    <td>
                      <DateTimeText
                        fallback={incident.status === 'OPEN' ? 'Awaiting successful run' : 'Not retained'}
                        value={incident.recoveredAt}
                      />
                    </td>
                    <td>{incident.resolvedFailureCount}</td>
                    <td>{backgroundJobAuditActorLabel(incident)}</td>
                    <td>
                      <AdminFormControlLink
                        className="button-secondary"
                        href={`/background-jobs/incidents/${encodeURIComponent(incident.id)}`}
                      >
                        Open incident
                      </AdminFormControlLink>
                    </td>
                  </tr>
                ))}
              </AdminDataTable>
            </AdminTableScroll>
            <AdminTableFooter>
              <span>{backgroundJobIncidentPageSummary(recurringIncidents.length, recurringIncidentPage)}</span>
              <AdminFormControlStack aria-label="Recurring incident pages">
                {recurringIncidentPage.hasPreviousPage ? (
                  <AdminFormControlLink
                    className="button-secondary"
                    href={backgroundJobIncidentPageHref(filters, recurringIncidentPage.page - 1)}
                  >
                    Previous
                  </AdminFormControlLink>
                ) : null}
                <span className="muted">Page {recurringIncidentPage.page}</span>
                {recurringIncidentPage.hasNextPage ? (
                  <AdminFormControlLink
                    className="button-secondary"
                    href={backgroundJobIncidentPageHref(filters, recurringIncidentPage.page + 1)}
                  >
                    Next
                  </AdminFormControlLink>
                ) : null}
              </AdminFormControlStack>
            </AdminTableFooter>
          </AdminTableSection>

          <AdminTableSection
            description={failureEvidencePartial
              ? 'Retained failure evidence is partial. Unavailable queue scans or review audit reads are not reported as zero.'
              : 'Server-filtered retained failures. Resolve the source issue before retrying from the owning workflow.'}
            status={
              <StatusBadge tone={failureEvidencePartial ? 'warning' : visibleOpenFailureCount > 0 ? 'danger' : 'success'}>
                {failureEvidencePartial ? 'Partial evidence' : `${health.failedJobs.length} retained`}
              </StatusBadge>
            }
            title="Failed job records"
          >
            <AdminTableScroll>
              <AdminDataTable
                className="background-job-failure-table"
                emptyMessage={failureEvidencePartial
                  ? 'Retained failure evidence is unavailable for part of the selected scope.'
                  : 'No retained background job failures need Developer/System review.'}
                headers={['Queue', 'Job', 'Attempts', 'Failed at', 'Failure', 'Review', 'Action']}
                rowCount={health.failedJobs.length}
              >
                {health.failedJobs.map((job, index) => {
                  const review = job.review ?? {
                    actor: null,
                    reason: null,
                    status: 'UNTRACKED' as const,
                    updatedAt: null,
                  };

                  return (
                    <tr key={`${job.queueName}-${job.id ?? job.name}-${index}`}>
                      <td>{job.queueName}</td>
                      <td>
                        <strong>{job.name}</strong>
                      </td>
                      <td>
                        <AdminDisclosure className="background-job-attempt-disclosure">
                          <summary>
                            <strong>
                              {job.execution.attemptsMade} / {job.execution.maxAttempts}
                            </strong>
                            <span className="muted">Timing</span>
                          </summary>
                          <div className="background-job-attempt-timing">
                            <span>Queued</span>
                            <DateTimeText fallback="Not retained" value={job.execution.queuedAt} />
                            <span>Last attempt started</span>
                            <DateTimeText fallback="Not retained" value={job.execution.lastStartedAt} />
                            <span>Final failure</span>
                            <DateTimeText fallback="Not retained" value={job.execution.failedAt} />
                            <span>Job ID</span>
                            <span>{job.id ?? 'Not retained'}</span>
                            <span>Reference</span>
                            <span>{job.reference ? `${job.reference.kind}: ${job.reference.id}` : 'Not retained'}</span>
                          </div>
                          <p className="muted background-job-attempt-note">
                            BullMQ does not retain a timestamp for every retry. Only retained queue timing is shown.
                          </p>
                        </AdminDisclosure>
                      </td>
                      <td>
                        <DateTimeText fallback="Not retained" value={job.failedAt} />
                      </td>
                      <td>{job.failure}</td>
                      <td>
                        <StatusBadge tone={healthAvailability.failureReviews === 'AVAILABLE'
                          ? reviewStatusTone(review.status)
                          : 'warning'}>
                          {healthAvailability.failureReviews === 'AVAILABLE' ? review.status : 'UNAVAILABLE'}
                        </StatusBadge>
                        {healthAvailability.failureReviews === 'AVAILABLE' && review.actor ? (
                          <span className="muted">
                            {review.actor.fullName || review.actor.email || review.actor.id}
                            {' / '}
                            <DateTimeText value={review.updatedAt} />
                          </span>
                        ) : null}
                        {review.reason ? <span className="muted">{review.reason}</span> : null}
                      </td>
                      <td>
                        {healthAvailability.failureReviews === 'AVAILABLE'
                          ? backgroundJobReviewAction(
                              job.queueName,
                              job.id,
                              review.status,
                              job.reference,
                              returnTo,
                            )
                          : <span className="muted">Review audit unavailable</span>}
                      </td>
                    </tr>
                  );
                })}
              </AdminDataTable>
            </AdminTableScroll>
            <AdminTableFooter>
              <span>{backgroundJobPageSummary(health.failedJobs.length, failurePage)}</span>
              <AdminFormControlStack aria-label="Failed job pages">
                {failurePage.hasPreviousPage ? (
                  <AdminFormControlLink
                    className="button-secondary"
                    href={backgroundJobPageHref(filters, failurePage.page - 1)}
                  >
                    Previous
                  </AdminFormControlLink>
                ) : null}
                <span className="muted">Page {failurePage.page}</span>
                {failurePage.hasNextPage ? (
                  <AdminFormControlLink
                    className="button-secondary"
                    href={backgroundJobPageHref(filters, failurePage.page + 1)}
                  >
                    Next
                  </AdminFormControlLink>
                ) : null}
              </AdminFormControlStack>
            </AdminTableFooter>
          </AdminTableSection>

          <AdminTableSection
            description={healthAvailability.healthEvents === 'AVAILABLE'
              ? 'Audited stale alerts and recoveries. This history is read from the server in bounded pages.'
              : 'Queue health audit history is unavailable. Live queue snapshots above remain available.'}
            status={
              <StatusBadge tone={healthAvailability.healthEvents !== 'AVAILABLE'
                ? 'warning'
                : healthEvents.some((event) => event.event === 'ALERTED') ? 'warning' : 'neutral'}>
                {healthAvailability.healthEvents === 'AVAILABLE' ? `${healthEventPage.totalCount} events` : 'Unavailable'}
              </StatusBadge>
            }
            title="Queue health events"
          >
            <AdminTableScroll>
              <AdminDataTable
                className="background-job-health-event-table"
                emptyMessage={healthAvailability.healthEvents === 'AVAILABLE'
                  ? 'No queue SLA alerts or recoveries match the current filters.'
                  : 'Queue health audit history is unavailable.'}
                headers={['Event', 'Queue', 'Recorded at', 'Detected at', 'Observed lag', 'SLA', 'Audit actor']}
                rowCount={healthEvents.length}
              >
                {healthEvents.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <StatusBadge tone={event.event === 'ALERTED' ? 'warning' : 'success'}>
                        {event.event}
                      </StatusBadge>
                    </td>
                    <td>
                      <strong>{backgroundJobQueueLabel(event.queueName)}</strong>
                      <span className="muted">{event.queueName}</span>
                    </td>
                    <td><DateTimeText value={event.recordedAt} /></td>
                    <td><DateTimeText fallback="Not retained" value={event.detectedAt} /></td>
                    <td>
                      {event.openJobLagMs === null
                        ? <span className="muted">Not retained</span>
                        : formatQueueDuration(event.openJobLagMs)}
                    </td>
                    <td>
                      {event.staleAfterMs === null
                        ? <span className="muted">Not retained</span>
                        : formatQueueDuration(event.staleAfterMs)}
                    </td>
                    <td>{backgroundJobAuditActorLabel(event)}</td>
                  </tr>
                ))}
              </AdminDataTable>
            </AdminTableScroll>
            <AdminTableFooter>
              <span>{backgroundJobEventPageSummary(healthEvents.length, healthEventPage)}</span>
              <AdminFormControlStack aria-label="Queue health event pages">
                {healthEventPage.hasPreviousPage ? (
                  <AdminFormControlLink
                    className="button-secondary"
                    href={backgroundJobEventPageHref(filters, healthEventPage.page - 1)}
                  >
                    Previous
                  </AdminFormControlLink>
                ) : null}
                <span className="muted">Page {healthEventPage.page}</span>
                {healthEventPage.hasNextPage ? (
                  <AdminFormControlLink
                    className="button-secondary"
                    href={backgroundJobEventPageHref(filters, healthEventPage.page + 1)}
                  >
                    Next
                  </AdminFormControlLink>
                ) : null}
              </AdminFormControlStack>
            </AdminTableFooter>
          </AdminTableSection>
        </>
      )}
    </AdminPageTemplate>
  );
}

const BACKGROUND_JOB_QUEUE_OPTIONS = [
  { label: 'All queues', value: 'ALL' },
  { label: 'Admin push campaigns', value: 'admin-push-campaign' },
  { label: 'Bank statement escalation', value: 'bank-statement-escalation' },
  { label: 'Booking timeout', value: 'booking-timeouts' },
  { label: 'Notification delivery', value: 'notification-retry' },
  { label: 'Payment booking recovery', value: 'payment-booking-recovery' },
  { label: 'Payment provider refund status', value: 'payment-refund-status' },
  { label: 'Payment status check', value: 'payment-status-check' },
] as const;
const BACKGROUND_JOB_REVIEW_OPTIONS = [
  { label: 'All review states', value: 'ALL' },
  { label: 'Needs action', value: 'OPEN' },
  { label: 'New', value: 'NEW' },
  { label: 'Acknowledged', value: 'ACKNOWLEDGED' },
  { label: 'Resolved records', value: 'RESOLVED' },
  { label: 'Untracked', value: 'UNTRACKED' },
] as const;
const BACKGROUND_JOB_RANGE_OPTIONS = [
  { label: 'All retained time', value: 'ALL' },
  { label: 'Last 24 hours', value: '24H' },
  { label: 'Last 7 days', value: '7D' },
  { label: 'Last 30 days', value: '30D' },
] as const;
const BACKGROUND_JOB_HEALTH_EVENT_OPTIONS = [
  { label: 'All health events', value: 'ALL' },
  { label: 'Stale alerts', value: 'ALERTED' },
  { label: 'Recoveries', value: 'RECOVERED' },
] as const;
const BACKGROUND_JOB_INCIDENT_OPTIONS = [
  { label: 'All recurring incidents', value: 'ALL' },
  { label: 'Open incidents', value: 'OPEN' },
  { label: 'Recovered incidents', value: 'RECOVERED' },
] as const;

type BackgroundJobFilters = {
  eventPage: number;
  eventStatus: typeof BACKGROUND_JOB_HEALTH_EVENT_OPTIONS[number]['value'];
  incidentPage: number;
  incidentStatus: typeof BACKGROUND_JOB_INCIDENT_OPTIONS[number]['value'];
  jobId: string;
  page: number;
  pageSize: 5 | 10 | 20;
  queue: typeof BACKGROUND_JOB_QUEUE_OPTIONS[number]['value'];
  range: typeof BACKGROUND_JOB_RANGE_OPTIONS[number]['value'];
  review: typeof BACKGROUND_JOB_REVIEW_OPTIONS[number]['value'];
};

function backgroundJobFilters(params: Awaited<NonNullable<BackgroundJobsPageProps['searchParams']>>): BackgroundJobFilters {
  const pageValue = Number(firstParam(params.page));
  const eventPageValue = Number(firstParam(params.eventPage));
  const incidentPageValue = Number(firstParam(params.incidentPage));
  const pageSizeValue = Number(firstParam(params.pageSize));
  return {
    eventPage: Number.isInteger(eventPageValue) && eventPageValue >= 1 && eventPageValue <= 25
      ? eventPageValue
      : 1,
    eventStatus: allowedValue(firstParam(params.eventStatus), BACKGROUND_JOB_HEALTH_EVENT_OPTIONS, 'ALL'),
    incidentPage: Number.isInteger(incidentPageValue) && incidentPageValue >= 1 && incidentPageValue <= 25
      ? incidentPageValue
      : 1,
    incidentStatus: allowedValue(firstParam(params.incidentStatus), BACKGROUND_JOB_INCIDENT_OPTIONS, 'ALL'),
    jobId: firstParam(params.jobId)?.trim().slice(0, 300) ?? '',
    page: Number.isInteger(pageValue) && pageValue >= 1 && pageValue <= 25 ? pageValue : 1,
    pageSize: pageSizeValue === 5 || pageSizeValue === 20 ? pageSizeValue : 10,
    queue: allowedValue(firstParam(params.queue), BACKGROUND_JOB_QUEUE_OPTIONS, 'ALL'),
    range: allowedValue(firstParam(params.range), BACKGROUND_JOB_RANGE_OPTIONS, 'ALL'),
    review: allowedValue(firstParam(params.review), BACKGROUND_JOB_REVIEW_OPTIONS, 'OPEN'),
  };
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function allowedValue<Options extends readonly { value: string }[]>(
  value: string | undefined,
  options: Options,
  fallback: Options[number]['value'],
) {
  return options.some((option) => option.value === value)
    ? value as Options[number]['value']
    : fallback;
}

function backgroundJobPageHref(filters: BackgroundJobFilters, page: number) {
  const query = new URLSearchParams({
    eventPage: String(filters.eventPage),
    eventStatus: filters.eventStatus,
    incidentPage: String(filters.incidentPage),
    incidentStatus: filters.incidentStatus,
    page: String(page),
    pageSize: String(filters.pageSize),
    queue: filters.queue,
    range: filters.range,
    review: filters.review,
  });
  appendBackgroundJobId(query, filters.jobId);
  return `/background-jobs?${query.toString()}`;
}

function backgroundJobEventPageHref(filters: BackgroundJobFilters, eventPage: number) {
  const query = new URLSearchParams({
    eventPage: String(eventPage),
    eventStatus: filters.eventStatus,
    incidentPage: String(filters.incidentPage),
    incidentStatus: filters.incidentStatus,
    page: String(filters.page),
    pageSize: String(filters.pageSize),
    queue: filters.queue,
    range: filters.range,
    review: filters.review,
  });
  appendBackgroundJobId(query, filters.jobId);
  return `/background-jobs?${query.toString()}`;
}

function backgroundJobIncidentPageHref(filters: BackgroundJobFilters, incidentPage: number) {
  const query = new URLSearchParams({
    eventPage: String(filters.eventPage),
    eventStatus: filters.eventStatus,
    incidentPage: String(incidentPage),
    incidentStatus: filters.incidentStatus,
    page: String(filters.page),
    pageSize: String(filters.pageSize),
    queue: filters.queue,
    range: filters.range,
    review: filters.review,
  });
  appendBackgroundJobId(query, filters.jobId);
  return `/background-jobs?${query.toString()}`;
}

function appendBackgroundJobId(query: URLSearchParams, jobId: string) {
  if (jobId) query.set('jobId', jobId);
}

function backgroundJobResultLabel(rowCount: number, totalCount: number | null) {
  return totalCount === null ? `${rowCount} loaded` : `${rowCount} of ${totalCount}`;
}

function backgroundJobPageSummary(
  rowCount: number,
  page: AdminBackgroundJobHealth['failurePage'],
) {
  if (rowCount === 0) return `Page ${page.page}: no matching failures`;
  const from = (page.page - 1) * page.pageSize + 1;
  const to = from + rowCount - 1;
  return page.totalCount === null
    ? `Showing ${from} to ${to}; additional retained failures may exist`
    : `Showing ${from} to ${to} of ${page.totalCount} failures`;
}

function backgroundJobEventPageSummary(
  rowCount: number,
  page: AdminBackgroundJobHealth['healthEventPage'],
) {
  if (rowCount === 0) return `Page ${page.page}: no matching health events`;
  const from = (page.page - 1) * page.pageSize + 1;
  const to = from + rowCount - 1;
  return `Showing ${from} to ${to} of ${page.totalCount} health events`;
}

function backgroundJobIncidentPageSummary(
  rowCount: number,
  page: AdminBackgroundJobHealth['recurringIncidentPage'],
) {
  if (rowCount === 0) return `Page ${page.page}: no matching recurring incidents`;
  const from = (page.page - 1) * page.pageSize + 1;
  const to = from + rowCount - 1;
  return page.totalCount === null
    ? `Showing ${from} to ${to}; additional recurring incidents may exist`
    : `Showing ${from} to ${to} of ${page.totalCount} recurring incidents`;
}

function backgroundJobQueueLabel(queueName: string) {
  return BACKGROUND_JOB_QUEUE_OPTIONS.find((option) => option.value === queueName)?.label ?? queueName;
}

function backgroundJobNotice(notice: string | undefined) {
  if (notice === 'acknowledged') {
    return (
      <AdminNoticeCard className="admin-mb-16" role="status" tone="success">
        Failure acknowledged. Its queue job was not retried or changed.
      </AdminNoticeCard>
    );
  }
  if (notice === 'resolved') {
    return (
      <AdminNoticeCard className="admin-mb-16" role="status" tone="success">
        Failure marked resolved. The resolution note is retained in the audit log.
      </AdminNoticeCard>
    );
  }
  if (notice === 'validation') {
    return (
      <AdminNoticeCard className="admin-mb-16" role="alert" tone="danger">
        Select a retained failure and enter a resolution note of at least three characters.
      </AdminNoticeCard>
    );
  }
  if (notice === 'failed') {
    return (
      <AdminNoticeCard className="admin-mb-16" role="alert" tone="danger">
        Failure review could not be saved. Refresh the queue state and try again.
      </AdminNoticeCard>
    );
  }
  return null;
}

function backgroundJobReviewAction(
  queueName: string,
  jobId: string | null,
  status: AdminBackgroundJobReviewStatus,
  reference: AdminBackgroundJobReference | null,
  returnTo: string,
) {
  return (
    <AdminFormControlStack>
      {backgroundJobReviewControl(queueName, jobId, status, returnTo)}
      {backgroundJobWorkflowLink(queueName, reference)}
    </AdminFormControlStack>
  );
}

function backgroundJobReviewControl(
  queueName: string,
  jobId: string | null,
  status: AdminBackgroundJobReviewStatus,
  returnTo: string,
) {
  if (!jobId) return <span className="muted">Job ID unavailable</span>;
  if (status === 'RESOLVED') return <span className="muted">Review complete</span>;
  if (status === 'UNTRACKED' || status === 'NEW') {
    return (
      <AdminInlineForm action={acknowledgeBackgroundJobFailure}>
        <input name="queueName" type="hidden" value={queueName} />
        <input name="jobId" type="hidden" value={jobId} />
        <input name="returnTo" type="hidden" value={returnTo} />
        <AdminFormControlButton className="button-secondary" type="submit">
          {status === 'UNTRACKED' ? 'Capture & acknowledge' : 'Acknowledge'}
        </AdminFormControlButton>
      </AdminInlineForm>
    );
  }
  return (
    <AdminInlineForm action={resolveBackgroundJobFailure}>
      <input name="queueName" type="hidden" value={queueName} />
      <input name="jobId" type="hidden" value={jobId} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <AdminFormInput
        label="Resolution note"
        maxLength={500}
        minLength={3}
        name="reason"
        placeholder="Resolution note"
        required
      />
      <AdminFormControlButton type="submit">Resolve</AdminFormControlButton>
    </AdminInlineForm>
  );
}

function backgroundJobWorkflowLink(
  queueName: string,
  reference?: AdminBackgroundJobReference | null,
) {
  const workflow = backgroundJobWorkflow(queueName, reference);
  if (!workflow) return <span className="muted">Workflow unavailable</span>;
  return (
    <AdminFormControlLink
      className="button-outline"
      href={workflow.href}
      title={workflow.label}
    >
      {workflow.actionLabel}
    </AdminFormControlLink>
  );
}

function backgroundJobOverallLabel(
  health: AdminBackgroundJobHealth,
  availability: NonNullable<AdminBackgroundJobHealth['availability']>,
) {
  if (availability.queues === 'UNAVAILABLE') return 'UNAVAILABLE';
  const incomplete = Object.values(availability).some((value) => value !== 'AVAILABLE') ||
    health.queues.some((queue) => (queue.failureReviewCoverage ?? 'COMPLETE') !== 'COMPLETE');
  if (incomplete) return 'PARTIAL';
  return health.ok ? 'HEALTHY' : 'ATTENTION';
}

function backgroundJobOverallTone(
  health: AdminBackgroundJobHealth,
  availability: NonNullable<AdminBackgroundJobHealth['availability']>,
): StatusBadgeTone {
  const label = backgroundJobOverallLabel(health, availability);
  if (label === 'HEALTHY') return 'success';
  if (label === 'PARTIAL') return 'warning';
  return 'danger';
}

function backgroundQueueState(queue: AdminBackgroundJobHealth['queues'][number]) {
  if ((queue.availability ?? 'AVAILABLE') === 'UNAVAILABLE') {
    return { label: 'UNAVAILABLE', tone: 'danger' as const };
  }
  if ((queue.failureReviewCoverage ?? 'COMPLETE') !== 'COMPLETE') {
    return { label: 'PARTIAL', tone: 'warning' as const };
  }
  return { label: queue.status, tone: queueStatusTone(queue.status) };
}

function backgroundQueueFailureEvidence(queue: AdminBackgroundJobHealth['queues'][number]) {
  if ((queue.availability ?? 'AVAILABLE') === 'UNAVAILABLE') return 'Unavailable';
  const coverage = queue.failureReviewCoverage ?? 'COMPLETE';
  const unresolved = queue.unresolvedFailureCount ?? queue.counts.failed;
  return (
    <span>
      <strong>{queue.counts.failed} retained</strong>
      <span className="muted">
        {coverage === 'COMPLETE'
          ? `${unresolved} unresolved`
          : coverage === 'INCOMPLETE'
            ? `Review coverage incomplete · ${unresolved} visible unresolved`
            : 'Review coverage unavailable'}
      </span>
    </span>
  );
}

function queueStatusTone(status: AdminBackgroundJobQueueStatus): StatusBadgeTone {
  if (status === 'ATTENTION') return 'danger';
  if (status === 'STALE') return 'warning';
  if (status === 'RUNNING') return 'info';
  return 'success';
}

function backgroundQueueTiming(queue: AdminBackgroundJobHealth['queues'][number]) {
  if (!queue.oldestOpenJobState || !queue.oldestOpenJobAt) {
    return <span className="muted">No open jobs</span>;
  }
  return (
    <span className="background-job-queue-timing">
      <strong>{queue.oldestOpenJobState}</strong>
      <span className="muted">
        {queue.openJobLagMs > queue.staleAfterMs
          ? `${formatQueueDuration(queue.openJobLagMs)} overdue`
          : queue.openJobLagMs > 0
            ? `${formatQueueDuration(queue.openJobLagMs)} elapsed`
            : 'On schedule'}
      </span>
      <DateTimeText value={queue.oldestOpenJobAt} />
    </span>
  );
}

function formatQueueDuration(value: number | undefined) {
  const milliseconds = Math.max(0, value ?? 0);
  if (milliseconds >= 60 * 60_000) return `${Math.round(milliseconds / (60 * 60_000))}h`;
  if (milliseconds >= 60_000) return `${Math.round(milliseconds / 60_000)}m`;
  return `${Math.max(1, Math.round(milliseconds / 1000))}s`;
}

function reviewStatusTone(status: AdminBackgroundJobReviewStatus): StatusBadgeTone {
  if (status === 'NEW') return 'danger';
  if (status === 'ACKNOWLEDGED') return 'warning';
  if (status === 'RESOLVED') return 'success';
  return 'neutral';
}
