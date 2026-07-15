import { notFound } from 'next/navigation';

import {
  AdminDataTable,
  AdminTableFooter,
  AdminTableScroll,
} from '../../../../components/admin-data-table';
import {
  AdminFormControlLink,
  AdminFormControlStack,
} from '../../../../components/admin-form-controls';
import { AdminPageTemplate } from '../../../../components/admin-page-template';
import { AdminTableSection } from '../../../../components/admin-table-panel';
import { DateTimeText } from '../../../../components/date-time-text';
import { StatusBadge } from '../../../../components/status-badge';
import {
  adminGet,
  type AdminBackgroundJobIncidentDetail,
  type AdminBackgroundJobReviewStatus,
} from '../../../../lib/admin-api';

type BackgroundJobIncidentPageProps = {
  readonly params?: Promise<{ readonly id?: string }>;
  readonly searchParams?: Promise<{
    readonly page?: string | string[];
    readonly pageSize?: string | string[];
  }>;
};

export default async function BackgroundJobIncidentPage({
  params,
  searchParams,
}: BackgroundJobIncidentPageProps) {
  const incidentId = (await params)?.id;
  if (!incidentId) notFound();
  const queryParams = searchParams ? await searchParams : {};
  const page = boundedPage(firstParam(queryParams.page));
  const pageSize = boundedPageSize(firstParam(queryParams.pageSize));
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const detail = await adminGet<AdminBackgroundJobIncidentDetail | null>(
    `/admin/system/background-jobs/incidents/${encodeURIComponent(incidentId)}?${query.toString()}`,
    null,
  );
  if (!detail) notFound();
  const incident = detail.incident;

  return (
    <AdminPageTemplate
      actions={
        <AdminFormControlLink className="button-secondary" href="/background-jobs">
          Back to Background Jobs
        </AdminFormControlLink>
      }
      description="Read-only audit evidence for one recurring scheduler failure episode. No queue job is retried or changed here."
      metrics={[
        {
          helper: 'Current lifecycle state for this scheduler episode.',
          kind: incident.status === 'OPEN' ? 'risk' : 'record',
          label: 'Incident status',
          scope: 'Episode',
          value: incident.status,
        },
        {
          helper: 'Recurring scheduler that opened this incident.',
          kind: 'record',
          label: 'Scheduler',
          scope: 'Episode',
          value: incident.jobName,
        },
        {
          helper: 'Failure records associated with this episode.',
          kind: detail.page.totalCount > 0 ? 'risk' : 'record',
          label: 'Related failures',
          scope: 'Episode',
          value: detail.page.totalCount,
        },
        {
          helper: 'Failures automatically resolved when the scheduler recovered.',
          kind: 'record',
          label: 'Auto-resolved',
          scope: 'Episode',
          value: incident.resolvedFailureCount,
        },
      ]}
      title="Recurring Job Incident"
    >
      <AdminTableSection
        className="admin-mb-16"
        description="The episode boundary prevents failures from earlier or later scheduler incidents from being mixed into this record."
        status={
          <StatusBadge tone={incident.status === 'OPEN' ? 'danger' : 'success'}>
            {incident.status}
          </StatusBadge>
        }
        title="Incident overview"
      >
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage="Incident metadata is unavailable."
            headers={['Queue', 'Opened', 'First failure', 'Recovered', 'First failure job', 'Audit actor']}
            rowCount={1}
          >
            <tr>
              <td>{incident.queueName}</td>
              <td><DateTimeText value={incident.openedAt} /></td>
              <td><DateTimeText fallback="Not retained" value={incident.firstFailureAt} /></td>
              <td>
                <DateTimeText
                  fallback={incident.status === 'OPEN' ? 'Awaiting successful run' : 'Not retained'}
                  value={incident.recoveredAt}
                />
              </td>
              <td>{incident.firstFailureJobId ?? 'Not retained'}</td>
              <td>{incident.actor.fullName || incident.actor.email || incident.actor.id}</td>
            </tr>
          </AdminDataTable>
        </AdminTableScroll>
      </AdminTableSection>

      <AdminTableSection
        description="Server-paginated failure records associated with this episode. Job payloads and stack traces are not returned."
        status={<StatusBadge tone="neutral">{detail.page.totalCount} failures</StatusBadge>}
        title="Related failure records"
      >
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage="No related failure records were retained for this incident."
            headers={['Status', 'Job ID', 'First seen', 'Last review', 'Audit actor', 'Resolution note']}
            rowCount={detail.failures.length}
          >
            {detail.failures.map((failure) => (
              <tr key={failure.jobId}>
                <td>
                  <StatusBadge tone={reviewStatusTone(failure.status)}>{failure.status}</StatusBadge>
                </td>
                <td>{failure.jobId}</td>
                <td><DateTimeText value={failure.firstSeenAt} /></td>
                <td><DateTimeText value={failure.updatedAt} /></td>
                <td>{failure.actor.fullName || failure.actor.email || failure.actor.id}</td>
                <td>{failure.reason ?? 'No operator note'}</td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
        <AdminTableFooter>
          <span>{pageSummary(detail.failures.length, detail.page)}</span>
          <AdminFormControlStack aria-label="Related failure pages">
            {detail.page.hasPreviousPage ? (
              <AdminFormControlLink
                className="button-secondary"
                href={incidentPageHref(incidentId, detail.page.page - 1, detail.page.pageSize)}
              >
                Previous
              </AdminFormControlLink>
            ) : null}
            <span className="muted">Page {detail.page.page}</span>
            {detail.page.hasNextPage ? (
              <AdminFormControlLink
                className="button-secondary"
                href={incidentPageHref(incidentId, detail.page.page + 1, detail.page.pageSize)}
              >
                Next
              </AdminFormControlLink>
            ) : null}
          </AdminFormControlStack>
        </AdminTableFooter>
      </AdminTableSection>
    </AdminPageTemplate>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function boundedPage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 25 ? parsed : 1;
}

function boundedPageSize(value: string | undefined) {
  const parsed = Number(value);
  return parsed === 5 || parsed === 20 ? parsed : 10;
}

function incidentPageHref(incidentId: string, page: number, pageSize: number) {
  return `/background-jobs/incidents/${encodeURIComponent(incidentId)}?page=${page}&pageSize=${pageSize}`;
}

function pageSummary(
  rowCount: number,
  page: AdminBackgroundJobIncidentDetail['page'],
) {
  if (rowCount === 0) return `Page ${page.page}: no related failures`;
  const from = (page.page - 1) * page.pageSize + 1;
  const to = from + rowCount - 1;
  return `Showing ${from} to ${to} of ${page.totalCount} failures`;
}

function reviewStatusTone(status: AdminBackgroundJobReviewStatus) {
  if (status === 'RESOLVED') return 'success' as const;
  if (status === 'ACKNOWLEDGED') return 'warning' as const;
  if (status === 'NEW') return 'danger' as const;
  return 'neutral' as const;
}
