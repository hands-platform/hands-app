import { Download, Filter, RefreshCw, RotateCcw } from 'lucide-react';

import {
  AdminFormActionRow,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDateTime,
  AdminFormGrid,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminErrorState, AdminNoticeCard, AdminSection } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import {
  adminGetResult,
  type AdminAuditEventDetail,
  type AdminAuditWorkspaceResponse,
} from '../../lib/admin-api';
import { DateTimeText } from '../../components/date-time-text';
import { AuditEvidenceDrawer } from './audit-evidence-drawer';
import { AUDIT_LOG_FILTER_QUERY_KEYS } from './audit-log-query';
import { AuditLogTableSection } from './audit-log-table-section';

type AuditLogPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const EMPTY_WORKSPACE: AdminAuditWorkspaceResponse = {
  actionableIncidents: [],
  items: [],
  totalCount: 0,
  facets: { actorTypes: [], areas: [], outcomes: [], severities: [] },
  summary: { failed: 0, reviewRequired: 0, unacknowledged: 0, unknownClassification: 0 },
  cursor: { next: null },
  generatedAt: '',
  timezone: 'Asia/Ho_Chi_Minh',
  sourceStatus: 'UNAVAILABLE',
  source: { dataLagSeconds: null, lastRecordedAt: null, state: 'EMPTY' },
  savedViews: [],
  take: 50,
  window: { range: 'today', label: 'Today (Vietnam)', from: null, to: null },
};

export default async function AuditLogPage({ searchParams }: { searchParams?: AuditLogPageSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const filters = auditFilters(params);
  const pageHref = auditPageHref(params);
  const [workspaceResult, selectedEventResult] = await Promise.all([
    adminGetResult<AdminAuditWorkspaceResponse>(
      auditWorkspaceApiHref(filters),
      EMPTY_WORKSPACE,
    ),
    filters.event
      ? adminGetResult<AdminAuditEventDetail | null>(
        `/admin/audit-logs/events/${encodeURIComponent(filters.event)}${filters.bucket ? `?bucket=${encodeURIComponent(filters.bucket)}` : ''}`,
        null,
      )
      : Promise.resolve(null),
  ]);
  const workspace = workspaceResult.data;
  const permissionDenied = workspaceResult.status === 401 || workspaceResult.status === 403;
  const refreshedHref = auditHrefFromFilters({ ...filters, cursor: '', event: '' });
  const clearRefinementsHref = filters.bucket
    ? auditHrefFromFilters(auditFilters({ bucket: filters.bucket, range: 'all', sort: 'newest' }))
    : `/audit-log?view=${encodeURIComponent(filters.view)}`;
  const notificationContextId = filters.bucket === 'Notification' ? filters.q : '';

  return (
    <AdminPageTemplate
      actions={
        <div className="audit-page-actions">
          <AdminFormControlLink className="button-secondary" href={auditExportHref(filters, 'csv')}>
            <Download aria-hidden="true" size={16} />
            Export CSV
          </AdminFormControlLink>
          <AdminFormControlLink className="button-secondary" href={auditExportHref(filters, 'json')}>
            <Download aria-hidden="true" size={16} />
            Export JSON
          </AdminFormControlLink>
          <AdminFormControlLink className="button-secondary" href={refreshedHref}>
            <RefreshCw aria-hidden="true" size={16} />
            Refresh now
          </AdminFormControlLink>
        </div>
      }
      description="Investigate immutable operator, security, money, booking, and system evidence. Times use Vietnam time."
      title="Audit Log"
    >
      <div className="audit-workspace">
        {filters.bucket ? <AuditScopeContext bucket={filters.bucket} /> : null}
        {!workspaceResult.ok ? (
          <AdminErrorState
            action={<AdminFormControlLink className="button-secondary" href={pageHref}>Retry audit data</AdminFormControlLink>}
            message={permissionDenied
              ? `Your current Admin access cannot read audit evidence.${workspaceResult.requestId ? ` Reference ${workspaceResult.requestId}.` : ''}`
              : `Audit data could not be loaded. This is not an empty result.${workspaceResult.requestId ? ` Reference ${workspaceResult.requestId}.` : ''}`}
            title={permissionDenied ? 'Audit access denied' : 'Audit data unavailable'}
          />
        ) : (
          <>
            <AuditTrustStrip workspace={workspace} />
            <AuditSavedViews filters={filters} workspace={workspace} />
            {(workspace.actionableIncidents ?? []).length > 0 ? (
              <AdminSection
                className="audit-incidents-section"
                description="Open recurring system incidents are projected from their latest lifecycle event. Raw occurrences remain in the event table."
                status={<StatusBadge tone="warning">{workspace.actionableIncidents.length} open</StatusBadge>}
                title="Action required incidents"
              >
                <div className="audit-incident-list">
                  {(workspace.actionableIncidents ?? []).map((incident) => (
                    <div className="audit-incident-row" key={incident.id}>
                      <div>
                        <strong>{incident.label}</strong>
                        <span>Opened {formatVietnamTime(incident.openedAt)} · {incident.source}</span>
                        <code>{incident.target}</code>
                      </div>
                      <AdminFormControlLink className="button-secondary" href={incident.href}>
                        Review incident
                      </AdminFormControlLink>
                    </div>
                  ))}
                </div>
              </AdminSection>
            ) : null}

            <AdminFilterPanel
              bodyClassName="audit-filter-panel-body"
              description="Search normalized event, object, actor, correlation, and request fields. Raw payload text is not searched."
              resultLabel={`${workspace.totalCount.toLocaleString('en-US')} events`}
              title="Find evidence"
            >
              <AdminFormGrid action="/audit-log" className="audit-filter-grid">
                <AdminFormSearch
                  className="audit-filter-search"
                  defaultValue={filters.q}
                  label="Search"
                  labelVisibility="visible"
                  name="q"
                  placeholder="Event, object, actor or ID"
                />
                <AdminFormSelect
                  defaultValue={filters.area}
                  label="Area"
                  labelVisibility="visible"
                  name="area"
                  options={facetOptions('All areas', workspace.facets.areas)}
                />
                <AdminFormSelect
                  defaultValue={filters.outcome}
                  label="Outcome"
                  labelVisibility="visible"
                  name="outcome"
                  options={facetOptions('All outcomes', workspace.facets.outcomes)}
                />
                <AdminFormSelect
                  defaultValue={filters.actorType}
                  label="Actor type"
                  labelVisibility="visible"
                  name="actorType"
                  options={facetOptions('All actors', workspace.facets.actorTypes)}
                />
                <AdminFormSelect
                  defaultValue={filters.range}
                  label="Date & time"
                  labelVisibility="visible"
                  name="range"
                  options={[
                    { label: 'Today · Vietnam', value: 'today' },
                    { label: 'Yesterday · Vietnam', value: 'yesterday' },
                    { label: 'Last 7 days · Vietnam', value: '7d' },
                    { label: 'Last 30 days · Vietnam', value: '30d' },
                    { label: 'Custom date & time · Vietnam', value: 'custom' },
                    { label: 'All dates', value: 'all' },
                  ]}
                />

                <details className="audit-more-filters full-span">
                  <summary>More filters</summary>
                  <div className="audit-more-filter-grid">
                    <AdminFormSelect
                      defaultValue={filters.severity}
                      label="Severity"
                      labelVisibility="visible"
                      name="severity"
                      options={facetOptions('All severities', workspace.facets.severities)}
                    />
                    <AdminFormSearch defaultValue={filters.objectType} label="Object type" name="objectType" placeholder="booking" />
                    <AdminFormSearch defaultValue={filters.eventId} label="Event ID" name="eventId" placeholder="Exact event ID" />
                    <AdminFormSearch defaultValue={filters.correlationId} label="Correlation ID" name="correlationId" placeholder="Exact correlation ID" />
                    <AdminFormSearch defaultValue={filters.requestId} label="Request ID" name="requestId" placeholder="Exact request ID" />
                    <AdminFormDateTime
                      defaultValue={filters.from}
                      label="From · Vietnam time"
                      labelVisibility="visible"
                      name="from"
                    />
                    <AdminFormDateTime
                      defaultValue={filters.to}
                      label="To · Vietnam time (exclusive)"
                      labelVisibility="visible"
                      name="to"
                    />
                    <AdminFormSelect
                      defaultValue={filters.sort}
                      label="Sort"
                      labelVisibility="visible"
                      name="sort"
                      options={[
                        { label: 'Newest first', value: 'newest' },
                        { label: 'Oldest first', value: 'oldest' },
                      ]}
                    />
                  </div>
                </details>

                <input name="view" type="hidden" value={filters.view} />
                {filters.bucket ? <input name="bucket" type="hidden" value={filters.bucket} /> : null}
                {filters.targetPrefix ? <input name="targetPrefix" type="hidden" value={filters.targetPrefix} /> : null}
                <AdminFormActionRow className="actions full-span audit-filter-actions">
                  <AdminFormControlButton className="button-primary" type="submit">
                    <Filter aria-hidden="true" size={16} />
                    Apply filters
                  </AdminFormControlButton>
                  <AdminFormControlLink className="button-secondary" href={clearRefinementsHref}>
                    <RotateCcw aria-hidden="true" size={16} />
                    {filters.bucket ? 'Clear refinements' : 'Clear all'}
                  </AdminFormControlLink>
                </AdminFormActionRow>
              </AdminFormGrid>
              <AdminFilterSummary ariaLabel="Active audit filters" labels={activeFilterLabels(filters)} tone="info" />
            </AdminFilterPanel>

            <AdminSection
              bodyClassName="audit-results-body"
              className="audit-results-section"
              description={`${workspace.window.label} · snapshot generated at ${formatVietnamTime(workspace.generatedAt)}`}
              status={<StatusBadge tone="neutral">Server ordered · {filters.sort === 'oldest' ? 'oldest first' : 'newest first'}</StatusBadge>}
              title="Investigation results"
            >
              {notificationContextId && workspace.totalCount === 0 ? (
                <AdminNoticeCard tone="info">
                  <strong>No audit events have been recorded for this notification.</strong>
                  <p>Delivery evidence may still be available on the notification record.</p>
                  <AdminFormControlLink
                    className="button-secondary"
                    href={`/notifications?mode=records&range=all&q=${encodeURIComponent(notificationContextId)}`}
                  >
                    Back to Notification Delivery
                  </AdminFormControlLink>
                </AdminNoticeCard>
              ) : (
                <AuditLogTableSection
                  evidenceHref={(eventId) => auditEvidenceHref(filters, eventId)}
                  items={workspace.items}
                />
              )}
              <div className="audit-cursor-footer">
                <span>
                  Showing {workspace.items.length.toLocaleString('en-US')} of {workspace.totalCount.toLocaleString('en-US')} events in this snapshot
                </span>
                <div>
                  {filters.cursor ? (
                    <AdminFormControlLink className="button-secondary" href={auditHrefFromFilters({ ...filters, cursor: workspace.cursor.previous ?? '', event: '' })}>
                      Previous page
                    </AdminFormControlLink>
                  ) : null}
                  {filters.cursor ? (
                    <AdminFormControlLink className="button-plain" href={auditHrefFromFilters({ ...filters, cursor: '', event: '' })}>
                      First page
                    </AdminFormControlLink>
                  ) : null}
                  {workspace.cursor.next ? (
                    <AdminFormControlLink
                      className="button-secondary"
                      href={auditHrefFromFilters({ ...filters, cursor: workspace.cursor.next, event: '' })}
                    >
                      Next page
                    </AdminFormControlLink>
                  ) : null}
                </div>
              </div>
            </AdminSection>

            {selectedEventResult && !selectedEventResult.ok ? (
              <AdminNoticeCard tone="danger">
                <strong>Evidence details could not be loaded.</strong>
                <p>Close this drawer state and retry the event from the investigation table.</p>
              </AdminNoticeCard>
            ) : null}
            {selectedEventResult?.ok && selectedEventResult.data ? (
              <AuditEvidenceDrawer
                event={selectedEventResult.data.event}
                returnFocusHref={auditEvidenceHref(filters, selectedEventResult.data.event.id)}
                returnHref={auditHrefFromFilters({ ...filters, event: '' })}
                scopeBucket={filters.bucket || undefined}
              />
            ) : null}
          </>
        )}
      </div>
    </AdminPageTemplate>
  );
}

type AuditFilters = {
  actorType: string;
  area: string;
  bucket: string;
  correlationId: string;
  cursor: string;
  event: string;
  eventId: string;
  from: string;
  objectType: string;
  outcome: string;
  q: string;
  range: string;
  requestId: string;
  severity: string;
  sort: string;
  targetPrefix: string;
  to: string;
  view: string;
};

function auditFilters(params: Record<string, string | string[] | undefined>): AuditFilters {
  const from = singleParam(params.from);
  const to = singleParam(params.to);
  const requestedRange = supportedValue(
    singleParam(params.range),
    ['today', 'yesterday', '7d', '30d', 'custom', 'all'],
    'today',
  );
  return {
    actorType: singleParam(params.actorType),
    area: singleParam(params.area),
    bucket: safeContextBucket(singleParam(params.bucket)),
    correlationId: singleParam(params.correlationId),
    cursor: singleParam(params.cursor),
    event: singleParam(params.event),
    eventId: singleParam(params.eventId),
    from,
    objectType: singleParam(params.objectType),
    outcome: singleParam(params.outcome),
    q: singleParam(params.q),
    range: requestedRange === 'custom' && !from && !to ? 'today' : requestedRange,
    requestId: singleParam(params.requestId),
    severity: singleParam(params.severity),
    sort: supportedValue(singleParam(params.sort), ['newest', 'oldest'], 'newest'),
    targetPrefix: singleParam(params.targetPrefix),
    to,
    view: supportedValue(
      singleParam(params.view).toUpperCase(),
      ['REVIEW_REQUIRED', 'OPERATOR_CHANGES', 'MONEY_POLICY', 'SECURITY_ACCESS', 'SYSTEM_INCIDENTS', 'ALL', 'LEGACY_TELEMETRY'],
      'ALL',
    ),
  };
}

function auditWorkspaceApiHref(filters: AuditFilters) {
  const params = auditFilterParams(filters);
  params.set('take', '50');
  if (filters.cursor) params.set('cursor', filters.cursor);
  return `/admin/audit-logs/page?${params.toString()}`;
}

function auditHrefFromFilters(filters: AuditFilters) {
  const params = auditFilterParams(filters);
  if (filters.cursor) params.set('cursor', filters.cursor);
  if (filters.event) params.set('event', filters.event);
  const query = params.toString();
  return query ? `/audit-log?${query}` : '/audit-log';
}

function auditFilterParams(filters: AuditFilters) {
  const params = new URLSearchParams();
  params.set('view', filters.view);
  params.set('range', filters.range);
  params.set('sort', filters.sort);
  for (const key of AUDIT_LOG_FILTER_QUERY_KEYS) {
    if (filters[key]) params.set(key, filters[key]);
  }
  return params;
}

function auditEvidenceHref(filters: AuditFilters, eventId: string) {
  return auditHrefFromFilters({ ...filters, event: eventId });
}

function auditExportHref(filters: AuditFilters, format: 'csv' | 'json') {
  const params = auditFilterParams(filters);
  params.set('format', format);
  return `/api/admin/audit-log/export?${params.toString()}`;
}

function auditPageHref(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const item = Array.isArray(value) ? value[0] : value;
    if (item) query.set(key, item);
  }
  return query.size ? `/audit-log?${query.toString()}` : '/audit-log';
}

function AuditTrustStrip({ workspace }: { readonly workspace: AdminAuditWorkspaceResponse }) {
  const metrics = [
    { label: 'Review-level events', value: workspace.summary.reviewRequired, tone: workspace.summary.reviewRequired ? 'warning' : 'neutral' },
    { label: 'Failed', value: workspace.summary.failed, tone: workspace.summary.failed ? 'danger' : 'neutral' },
    { label: 'Unacknowledged', value: workspace.summary.unacknowledged, tone: workspace.summary.unacknowledged ? 'warning' : 'neutral' },
    { label: 'Data lag', value: formatLag(workspace.source.dataLagSeconds), tone: workspace.sourceStatus === 'LIVE' ? 'info' : 'danger' },
  ] as const;

  return (
    <section aria-label="Audit evidence trust status" className="audit-trust-strip">
      <div className="audit-trust-source">
        <span className={workspace.sourceStatus === 'LIVE' ? 'audit-source-dot is-live' : 'audit-source-dot'} />
        <div>
          <strong>{workspace.sourceStatus === 'LIVE' ? 'Audit source available' : 'Audit source degraded'}</strong>
          <span>Generated <DateTimeText value={workspace.generatedAt} /> · Asia/Ho_Chi_Minh</span>
        </div>
      </div>
      {metrics.map((metric) => (
        <div className="audit-trust-metric" key={metric.label}>
          <span>{metric.label}</span>
          <strong>{typeof metric.value === 'number' ? metric.value.toLocaleString('en-US') : metric.value}</strong>
          <StatusBadge tone={metric.tone}>{metric.label === 'Data lag' ? 'Freshness' : 'Current filters'}</StatusBadge>
        </div>
      ))}
    </section>
  );
}

function AuditScopeContext({ bucket }: { readonly bucket: string }) {
  return (
    <section aria-label="Fixed audit investigation scope" className="audit-scope-context">
      <div>
        <StatusBadge tone="info">Fixed scope</StatusBadge>
        <strong>Scope: {formatAuditBucket(bucket)}</strong>
        <span>Summary, facets, pagination, refresh, and exports use this same evidence boundary.</span>
      </div>
      <AdminFormControlLink className="button-secondary" href="/audit-log">
        Exit policy scope
      </AdminFormControlLink>
    </section>
  );
}

function AuditSavedViews({ filters, workspace }: { readonly filters: AuditFilters; readonly workspace: AdminAuditWorkspaceResponse }) {
  return (
    <nav aria-label="Saved audit views" className="audit-saved-views">
      {workspace.savedViews.map((view) => {
        const href = auditHrefFromFilters({ ...filters, cursor: '', event: '', view: view.key });
        const active = filters.view === view.key;
        return (
          <AdminFormControlLink
            aria-current={active ? 'page' : undefined}
            className={active ? 'audit-saved-view is-active' : 'audit-saved-view'}
            href={href}
            key={view.key}
          >
            <span>{view.label}</span>
            <strong>{view.count.toLocaleString('en-US')}</strong>
          </AdminFormControlLink>
        );
      })}
    </nav>
  );
}

function facetOptions(label: string, values: Array<{ value: string; count: number }>) {
  return [
    { label, value: '' },
    ...values.map((item) => ({ label: `${titleCase(item.value)} (${item.count.toLocaleString('en-US')})`, value: item.value })),
  ];
}

function activeFilterLabels(filters: AuditFilters) {
  const labels = [
    filters.bucket ? `Scope: ${formatAuditBucket(filters.bucket)}` : null,
    filters.q ? `Search: ${filters.q}` : null,
    filters.area ? `Area: ${titleCase(filters.area)}` : null,
    filters.outcome ? `Outcome: ${titleCase(filters.outcome)}` : null,
    filters.actorType ? `Actor: ${titleCase(filters.actorType)}` : null,
    filters.severity ? `Severity: ${titleCase(filters.severity)}` : null,
    filters.objectType ? `Object: ${filters.objectType}` : null,
    filters.eventId ? `Event ID: ${filters.eventId}` : null,
    filters.correlationId ? `Correlation: ${filters.correlationId}` : null,
    filters.requestId ? `Request: ${filters.requestId}` : null,
    filters.from ? `From: ${filters.from} ICT` : null,
    filters.to ? `To: ${filters.to} ICT (exclusive)` : null,
    filters.targetPrefix ? `Target: ${filters.targetPrefix}` : null,
  ];
  return labels.filter((label): label is string => Boolean(label));
}

function formatAuditBucket(value: string) {
  return value.split('/').map((part) => part.trim()).filter(Boolean).join(' / ');
}

function singleParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

function safeContextBucket(value: string) {
  return value.length <= 80 && /^[A-Za-z0-9 /_.-]*$/.test(value) ? value : '';
}

function supportedValue(value: string, supported: readonly string[], fallback: string) {
  return supported.includes(value) ? value : fallback;
}

function formatLag(value: number | null) {
  if (value === null) return 'Unknown';
  if (value < 60) return `${value}s`;
  if (value < 3_600) return `${Math.floor(value / 60)}m`;
  return `${Math.floor(value / 3_600)}h`;
}

function formatVietnamTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/(^|_)([a-z])/g, (_, space: string, letter: string) => `${space ? ' ' : ''}${letter.toUpperCase()}`);
}

export {
  auditFilters as buildAuditFilters,
  auditExportHref as buildAuditExportHref,
  auditHrefFromFilters as buildAuditHref,
  auditWorkspaceApiHref as buildAuditWorkspaceApiHref,
};
