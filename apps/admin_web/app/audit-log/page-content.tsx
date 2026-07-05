import { Filter, X } from 'lucide-react';
import type { AdminAuditLog } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { AdminPageTemplate, AdminSectionHeader } from '../../components/admin-page-template';
import { AdminSection } from '../../components/admin-surface';
import { AdminTablePaginationFooter, AdminTableScroll } from '../../components/admin-data-table';
import { AdminTableSection } from '../../components/admin-table-panel';
import { StatusBadge, type StatusBadgeTone } from '../../components/status-badge';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormActionRow,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { marketplaceDisplayText as operationalDisplayText } from '../../lib/admin-copy';
import {
  formatDistanceMeters,
  formatMoney as money,
  formatRelativeTime,
} from '../../lib/admin-format';
import { bookingCreateGateReasonLabel } from '../../lib/booking-create-gate-reasons';
import { bookingMatchAuditHighlights } from '../../lib/booking-match-audit';
import { dateRangeLabel, normalizeDateRange, readSearchParam } from '../../lib/date-range';
import {
  AuditLogCommandBoardSection,
  type AuditCommandBoardItem,
  type AuditCommandLogPreview,
} from './audit-log-command-board-section';
import { AuditLogTableSection, type AuditLogTableRow } from './audit-log-table-section';
import {
  notificationFailureCodeLabel,
  notificationFailureRecoveryActionLabel,
} from '../notifications/notification-failure-copy';

type AuditLogFilters = {
  q: string;
  bucket: string;
  priority: string;
  range: ReturnType<typeof normalizeDateRange>;
};
type AuditLogSummaryResponse = {
  dispatch?: number;
  financeCloseout?: number;
  generatedAt: string;
  needsReview?: number;
  notifications?: number;
  payments?: number;
  recentHour?: number;
  servicePricing?: number;
  totalCount: number;
};
type AuditLogPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const AUDIT_LOG_PAGE_SIZE = 20;
const STALE_PUSH_DEVICE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export default async function AuditLogPage({ searchParams }: { searchParams?: AuditLogPageSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const filters = buildAuditFilters(params);
  const activePage = readAuditLogPage(params.page);
  const [serverLogs, serverSummary] = await Promise.all([
    adminGet<AdminAuditLog[]>(buildAuditLogApiHref(params), []),
    adminGet<AuditLogSummaryResponse | null>(buildAuditLogSummaryApiHref(params), null),
  ]);
  const logs = sortLogs(serverLogs);
  const summary = buildSummary(logs, serverSummary);
  const totalEvents = serverSummary?.totalCount ?? logs.length;
  const totalPages = Math.max(1, Math.ceil(totalEvents / AUDIT_LOG_PAGE_SIZE));
  const visibleFrom = totalEvents === 0 || logs.length === 0 ? 0 : (activePage - 1) * AUDIT_LOG_PAGE_SIZE + 1;
  const visibleTo =
    totalEvents === 0 || logs.length === 0
      ? 0
      : Math.min(totalEvents, (activePage - 1) * AUDIT_LOG_PAGE_SIZE + logs.length);
  const commandBoard = buildAuditCommandBoard(logs, filters.range);
  const auditLogRows = buildAuditLogTableRows(logs);

  return (
    <AdminPageTemplate
      description="Operational history for bookings, payments, refunds, Partner review, alerts, and policy changes."
      metrics={[
        { label: 'Total events', value: totalEvents, helper: 'Server-counted events after the active filters.' },
        {
          label: 'Dispatch actions',
          value: summary.dispatch,
          helper: 'Booking, matching, and Partner events.',
        },
        { label: 'Payment actions', value: summary.payments, helper: 'Payment and refund audit records.' },
        {
          label: 'Finance closeout',
          value: summary.financeCloseout,
          helper: 'Money movement and closeout records.',
        },
        {
          label: 'Service pricing',
          value: summary.servicePricing,
          helper: 'Service, payout, tax, and pricing edits.',
        },
        {
          label: 'Notification actions',
          value: summary.notifications,
          helper: 'Notification send and retry events.',
        },
        { label: 'Needs review', value: summary.needsReview, helper: 'High-priority events for operators.' },
        { label: 'Recent hour', value: summary.recentHour, helper: 'Events created within the last hour.' },
      ]}
      title="Audit Log"
    >
      <div className="audit-log-page">
        <AuditLogCommandBoardSection items={commandBoard} />

        <AdminSection
          className="admin-mb-16"
          title="Audit filters"
        >
          <AdminFormGrid action="/audit-log">
            <AdminFormInput
              className="admin-directory-filter-search"
              defaultValue={filters.q}
              label="Search"
              labelVisibility="visible"
              name="q"
              placeholder="Action, target, actor, metadata"
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.range}
              label="Date range"
              labelVisibility="visible"
              name="range"
              options={[
                { label: 'All dates', value: 'all' },
                { label: 'Today', value: 'today' },
                { label: 'Last 7 days', value: '7d' },
                { label: 'Last 30 days', value: '30d' },
              ]}
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.bucket}
              label="Bucket"
              labelVisibility="visible"
              name="bucket"
              options={[
                { label: 'All', value: '' },
                { label: 'Dispatch', value: 'Dispatch' },
                { label: 'Operations/Policy', value: 'Operations/Policy' },
                { label: 'Payment', value: 'Payment' },
                { label: 'Finance/Closeout', value: 'Finance/Closeout' },
                { label: 'Service/Pricing', value: 'Service/Pricing' },
                { label: 'Notification', value: 'Notification' },
                { label: 'Partner', value: 'Partner' },
                { label: 'Tax', value: 'Tax' },
                { label: 'System', value: 'System' },
              ]}
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.priority}
              label="Priority"
              labelVisibility="visible"
              name="priority"
              options={[
                { label: 'All', value: '' },
                { label: 'Review this first', value: '4' },
                { label: 'Check before close', value: '3' },
                { label: 'Trace related flow', value: '2' },
                { label: 'Reference event', value: '1' },
              ]}
            />
            <AdminFormActionRow className="actions full-span">
              <AdminFormControlButton className="button-primary" type="submit">
                <Filter aria-hidden="true" size={16} />
                Apply filters
              </AdminFormControlButton>
              <AdminFormControlLink className="button-secondary" href="/audit-log">
                <X aria-hidden="true" size={16} />
                Clear filters
              </AdminFormControlLink>
              <span className="muted">
                Showing {logs.length} of {totalEvents} events / {dateRangeLabel(filters.range)}
              </span>
            </AdminFormActionRow>
          </AdminFormGrid>
        </AdminSection>

        <AdminTableSection
          bodyClassName="admin-table-section-body"
          status={
            <div className="participant-list">
              <StatusBadge tone="success">Newest first</StatusBadge>
              <StatusBadge tone="info">Action grouped</StatusBadge>
              <StatusBadge tone="warning">Metadata preview</StatusBadge>
            </div>
          }
          title="Audit records"
        >
          <AdminSectionHeader
            description="Recent operational trail for bookings, payments, refunds, Partner review, and alerts."
            title="Operational trail"
          />

          <AdminTableScroll>
            <AuditLogTableSection emptyMessage="No audit logs loaded." rows={auditLogRows} />
          </AdminTableScroll>
          <AdminTablePaginationFooter
            activePage={activePage}
            ariaLabel="Audit log pagination"
            from={visibleFrom}
            hrefForPage={(page) => buildAuditLogPageHref(filters, page)}
            paginationClassName="admin-mt-16"
            to={visibleTo}
            totalPages={totalPages}
            totalRows={totalEvents}
          />
        </AdminTableSection>
      </div>
    </AdminPageTemplate>
  );
}

export function buildAuditLogTableRows(logs: readonly AdminAuditLog[]): AuditLogTableRow[] {
  return logs.map((log) => ({
    actionLabel: humanizeAction(log.action),
    actorLabel: operationalDisplayText(log.actor?.fullName ?? log.actor?.phone ?? 'System'),
    bucketClassName: signalClass(log.action),
    bucketLabel: actionBucketLabel(log.action),
    createdAt: log.createdAt,
    id: log.id,
    metadataHighlights: metadataHighlights(log),
    metadataPreview: metadataPreviewForLog(log),
    opsDetail: opsDetail(log.action),
    opsHint: opsHint(log.action, log.target),
    priorityLabel: reviewPriorityLabel(log.action),
    relatedBoardHref: relatedBoardHref(log),
    relatedBoardLabel: relatedBoardLabel(log),
    relativeTimeLabel: auditRelativeTime(log.createdAt),
    shortTargetLabel: shortTarget(log.target),
    targetLabel: operationalDisplayText(log.target),
  }));
}

function sortLogs(logs: AdminAuditLog[]) {
  return [...logs].sort((left, right) => {
    const priorityDiff = auditPriority(right.action) - auditPriority(left.action);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);
    return rightTime - leftTime;
  });
}

function buildSummary(logs: AdminAuditLog[], serverSummary?: AuditLogSummaryResponse | null) {
  const now = Date.now();
  const fallback = {
    total: logs.length,
    dispatch: logs.filter((log) => isDispatchAction(log.action)).length,
    payments: logs.filter((log) => isPaymentAction(log.action)).length,
    financeCloseout: logs.filter((log) => isFinanceCloseoutAction(log.action)).length,
    servicePricing: logs.filter((log) => isServicePricingAction(log.action)).length,
    notifications: logs.filter((log) => isNotificationAction(log.action)).length,
    needsReview: logs.filter((log) => auditPriority(log.action) >= 3).length,
    recentHour: logs.filter((log) => now - Date.parse(log.createdAt) <= 60 * 60 * 1000).length,
  };

  return {
    ...fallback,
    dispatch: serverSummary?.dispatch ?? fallback.dispatch,
    financeCloseout: serverSummary?.financeCloseout ?? fallback.financeCloseout,
    needsReview: serverSummary?.needsReview ?? fallback.needsReview,
    notifications: serverSummary?.notifications ?? fallback.notifications,
    payments: serverSummary?.payments ?? fallback.payments,
    recentHour: serverSummary?.recentHour ?? fallback.recentHour,
    servicePricing: serverSummary?.servicePricing ?? fallback.servicePricing,
  };
}

export function buildAuditCommandBoard(
  logs: AdminAuditLog[],
  range: AuditLogFilters['range'],
): AuditCommandBoardItem[] {
  const now = Date.now();
  const servicePolicyLogs = logs.filter(
    (log) => isServicePricingAction(log.action) || log.action.startsWith('tax_'),
  );
  const moneyLogs = logs.filter((log) => isPaymentAction(log.action) || isPayoutAction(log.action));
  const financeCloseoutLogs = logs.filter((log) => isFinanceCloseoutAction(log.action));
  const dispatchLogs = logs.filter(
    (log) => isDispatchAction(log.action) || log.action.startsWith('booking.'),
  );
  const notificationLogs = logs.filter((log) => isNotificationAction(log.action));
  const recentHighPriority = logs.filter(
    (log) => auditPriority(log.action) >= 3 && now - Date.parse(log.createdAt) <= 24 * 60 * 60 * 1000,
  );

  return [
    {
      title: 'Policy and pricing changes',
      detail:
        'Service price, payout, VAT, tax, and fee edits have downstream effects on bookings and wallet debt.',
      status: 'Policy',
      operatorAction: 'Review before/after metadata and confirm the change was intentional.',
      href: withAuditRange('/audit-log?bucket=Service%2FPricing', range),
      tone: servicePolicyLogs.length > 0 ? 'warn' : 'ok',
      logs: buildAuditCommandLogPreviews(servicePolicyLogs),
    },
    {
      title: 'Money movement trail',
      detail: 'Payment, refund, payout, and settlement events should line up with booking outcomes.',
      status: 'Money',
      operatorAction: 'Check ledger impact before closing payment or payout tasks.',
      href: withAuditRange('/audit-log?bucket=Payment', range),
      tone: moneyLogs.length > 0 ? 'warn' : 'ok',
      logs: buildAuditCommandLogPreviews(moneyLogs),
    },
    {
      title: 'Finance closeout trail',
      detail:
        'End-of-shift finance audit for booking closeout, cash debt settlement, payout batches, and payment state.',
      status: 'Closeout',
      operatorAction: 'Open Finance Closeout, then confirm every listed event has a matching ledger row.',
      href: withAuditRange('/audit-log?bucket=Finance%2FCloseout', range),
      tone: financeCloseoutLogs.length > 0 ? 'warn' : 'ok',
      logs: buildAuditCommandLogPreviews(financeCloseoutLogs),
    },
    {
      title: 'Dispatch and Partner actions',
      detail: 'Booking, matching, Partner status, and verification changes affect service delivery.',
      status: 'Dispatch',
      operatorAction: 'Trace handoff problems from Booking detail back to the acting operator.',
      href: withAuditRange('/audit-log?bucket=Dispatch', range),
      tone: dispatchLogs.length > 0 ? 'info' : 'ok',
      logs: buildAuditCommandLogPreviews(dispatchLogs),
    },
    {
      title: 'Notification delivery trail',
      detail: 'Send, retry, and device recovery actions should line up with notification delivery outcomes.',
      status: 'Alerts',
      operatorAction:
        'Open Notifications, then confirm failed, FCM sent, stale, and disabled-device rows were handled.',
      href: withAuditRange('/audit-log?bucket=Notification', range),
      tone: notificationLogs.length > 0 ? 'info' : 'ok',
      logs: buildAuditCommandLogPreviews(notificationLogs),
    },
    {
      title: 'Recent high-priority changes',
      detail: 'High-priority edits from the last 24 hours should be reviewed before shift handoff.',
      status: 'Last 24h',
      operatorAction: 'Use this lane for end-of-shift review and incident handoff.',
      href: withAuditRange('/audit-log?priority=4', range),
      tone: recentHighPriority.length > 0 ? 'warn' : 'ok',
      logs: buildAuditCommandLogPreviews(recentHighPriority),
    },
  ];
}

function buildAuditCommandLogPreviews(logs: readonly AdminAuditLog[]): AuditCommandLogPreview[] {
  return logs.map((log) => ({
    actionLabel: humanizeAction(log.action),
    id: log.id,
    relativeTimeLabel: auditRelativeTime(log.createdAt),
    shortTargetLabel: shortTarget(log.target),
  }));
}

export function buildAuditFilters(params: Record<string, string | string[] | undefined>): AuditLogFilters {
  const rangeParam = readSearchParam(params.range);
  return {
    q: readParam(params.q) || readParam(params.query),
    bucket: readParam(params.bucket),
    priority: readParam(params.priority),
    range: rangeParam ? normalizeDateRange(rangeParam) : 'today',
  };
}

export function buildAuditLogApiHref(params: Record<string, string | string[] | undefined>) {
  const filters = buildAuditFilters(params);
  const page = readAuditLogPage(params.page);
  return buildAuditLogAdminHref('/admin/audit-logs', filters, {
    skip: (page - 1) * AUDIT_LOG_PAGE_SIZE,
    take: AUDIT_LOG_PAGE_SIZE,
  });
}

export function buildAuditLogSummaryApiHref(params: Record<string, string | string[] | undefined>) {
  return buildAuditLogAdminHref('/admin/audit-logs/summary', buildAuditFilters(params));
}

function buildAuditLogAdminHref(
  pathname: string,
  filters: AuditLogFilters,
  paging?: { take: number; skip: number },
) {
  const query = new URLSearchParams();
  const dateWindow = auditLogDateWindow(filters.range);

  if (paging) {
    query.set('take', String(paging.take));
    if (paging.skip > 0) {
      query.set('skip', String(paging.skip));
    }
  }
  if (filters.q) {
    query.set('q', filters.q);
  }
  if (filters.bucket) {
    query.set('bucket', filters.bucket);
  }
  if (filters.priority) {
    query.set('priority', filters.priority);
  }
  if (dateWindow.from) {
    query.set('from', dateWindow.from);
  }
  if (dateWindow.to) {
    query.set('to', dateWindow.to);
  }

  const search = query.toString();
  return search ? `${pathname}?${search}` : pathname;
}

function buildAuditLogPageHref(filters: AuditLogFilters, page: number) {
  const query = new URLSearchParams();
  if (filters.q) {
    query.set('q', filters.q);
  }
  if (filters.range) {
    query.set('range', filters.range);
  }
  if (filters.bucket) {
    query.set('bucket', filters.bucket);
  }
  if (filters.priority) {
    query.set('priority', filters.priority);
  }
  if (page > 1) {
    query.set('page', String(page));
  }

  const search = query.toString();
  return search ? `/audit-log?${search}` : '/audit-log';
}

function auditLogDateWindow(range: AuditLogFilters['range']) {
  const now = new Date();
  if (range === 'today') {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (range === '7d') {
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    return { from: from.toISOString(), to: now.toISOString() };
  }
  if (range === '30d') {
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return { from: from.toISOString(), to: now.toISOString() };
  }
  return {};
}

function readAuditLogPage(value: string | string[] | undefined) {
  const page = Number.parseInt(readSearchParam(value), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function readParam(value: string | string[] | undefined) {
  return readSearchParam(value);
}

function withAuditRange(href: string, range: AuditLogFilters['range']) {
  if (range === 'all') {
    return href;
  }
  return `${href}${href.includes('?') ? '&' : '?'}range=${range}`;
}

function auditPriority(action: string) {
  if (action.startsWith('operational_policy.')) {
    return 4;
  }
  if (action.startsWith('service_payout_rule.')) {
    return 4;
  }
  if (action.startsWith('payout_batch.')) {
    return 3;
  }
  if (action === 'booking.completed.closeout') {
    return 4;
  }
  if (action.startsWith('service.')) {
    return 3;
  }
  if (action.endsWith('.refund') || action.includes('reject') || action.endsWith('.retry')) {
    return 4;
  }
  if (action.startsWith('payment.') || action.startsWith('refund.')) {
    return 3;
  }
  if (action.startsWith('booking.') || action.startsWith('notification.')) {
    return 2;
  }
  return 1;
}

function isDispatchAction(action: string) {
  return (
    action.startsWith('booking.') ||
    action.startsWith('provider.') ||
    action.startsWith('provider_') ||
    action.startsWith('provider-')
  );
}

function isPaymentAction(action: string) {
  return action.startsWith('payment.') || action.startsWith('refund.');
}

function isPayoutAction(action: string) {
  return action.startsWith('payout.') || action.startsWith('payout_batch.');
}

function isFinanceCloseoutAction(action: string) {
  return (
    isPaymentAction(action) ||
    isPayoutAction(action) ||
    action === 'booking.completed.closeout' ||
    action === 'booking.expire.manual' ||
    action === 'booking.no_show.mark' ||
    action.startsWith('earning.') ||
    action.startsWith('provider_wallet.') ||
    action.startsWith('wallet_ledger.')
  );
}

function isNotificationAction(action: string) {
  return action.startsWith('notification.') || isPushDeviceAction(action);
}

function isPushDeviceAction(action: string) {
  return action.startsWith('push_device.');
}

function isServicePricingAction(action: string) {
  return action.startsWith('service.') || action.startsWith('service_payout_rule.');
}

function actionBucketLabel(action: string) {
  if (isPayoutAction(action)) {
    return 'Finance/Closeout';
  }
  if (action.startsWith('operational_policy.')) {
    return 'Operations/Policy';
  }
  if (isServicePricingAction(action)) {
    return 'Service/Pricing';
  }
  if (action.startsWith('tax_')) {
    return 'Tax';
  }
  if (isProviderReviewAction(action)) {
    return 'Partner';
  }
  if (isDispatchAction(action)) {
    return 'Dispatch';
  }
  if (isPaymentAction(action)) {
    return 'Payment';
  }
  if (isNotificationAction(action)) {
    return 'Notification';
  }
  return 'System';
}

function isProviderReviewAction(action: string) {
  return (
    action.startsWith('provider_') ||
    action.startsWith('provider-') ||
    action.startsWith('provider-verification.')
  );
}

function signalClass(action: string) {
  if (action.startsWith('operational_policy.')) {
    return 'signal signal-warn';
  }
  if (isServicePricingAction(action)) {
    return 'signal signal-warn';
  }
  if (isDispatchAction(action)) {
    return 'signal signal-info';
  }
  if (isPaymentAction(action)) {
    return 'signal signal-warn';
  }
  if (isPayoutAction(action)) {
    return 'signal signal-warn';
  }
  if (isNotificationAction(action)) {
    return 'signal signal-ok';
  }
  return 'signal';
}

function humanizeAction(action: string) {
  if (action === 'booking.ops_note.add') {
    return 'Booking / Operator note added';
  }
  if (action === 'booking.ops_task.update') {
    return 'Booking / Ops status updated';
  }

  return action
    .split('.')
    .map((part) => part.replace(/[-_]/g, ' '))
    .map((part) => operationalDisplayText(part))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ');
}

function shortTarget(target: string) {
  if (!target) {
    return '-';
  }
  const [scope, id] = target.split(':');
  if (!id) {
    return operationalDisplayText(target);
  }
  return operationalDisplayText(`${scope}:${id.slice(0, 8)}`);
}

function metadataPreview(metadata: unknown) {
  if (!metadata) {
    return 'No metadata';
  }
  try {
    return operationalDisplayText(JSON.stringify(metadata, null, 2));
  } catch {
    return 'Metadata could not be rendered';
  }
}

function metadataPreviewForLog(log: AdminAuditLog) {
  if (log.action === 'notification.retry') {
    return notificationRetryMetadataPreview(log.metadata);
  }

  return metadataPreview(log.metadata);
}

function notificationRetryMetadataPreview(metadata: unknown) {
  const record = readMetadataObject(metadata);
  const latestDelivery = readRecord(record.latestDelivery);
  const retryJob = readRecord(record.retryJob);
  const failureCode = readString(latestDelivery.failureCode);
  const notificationId = readString(record.notificationId);
  const retryJobName = readString(retryJob.jobName);
  const parts = [
    notificationId ? `Notification ${notificationId.slice(0, 8)}` : null,
    notificationRetryRiskPreview(readString(record.retryRisk)),
    notificationDeliveryPreview(latestDelivery),
    notificationFailurePreview(failureCode),
    notificationFailureRecoveryActionLabel(failureCode),
    notificationPushDevicePreview(latestDelivery),
    latestDelivery.pushDeviceEnabled === true
      ? 'Device enabled'
      : latestDelivery.pushDeviceEnabled === false
        ? 'Device disabled'
        : null,
    retryJobName ? `Queued ${retryJobName}` : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(' / ') : metadataPreview(metadata);
}

function notificationDeliveryPreview(latestDelivery: Record<string, unknown>) {
  const provider = readString(latestDelivery.provider);
  const status = readString(latestDelivery.status);
  if (provider && status) {
    return `Latest ${provider} ${status}`;
  }
  return status ? `Latest ${status}` : null;
}

function notificationFailurePreview(failureCode: string | null) {
  return failureCode ? `Failure ${notificationFailureCodeLabel(failureCode)}` : null;
}

type MetadataHighlight = {
  label: string;
  tone: StatusBadgeTone;
};

function metadataHighlights(log: AdminAuditLog): MetadataHighlight[] {
  if (log.action === 'operational_policy.update') {
    return operationalPolicyHighlights(log);
  }

  if (log.action === 'booking.create.rejected') {
    return bookingGateRejectionHighlights(log);
  }

  if (log.action === 'notification.retry') {
    return notificationRetryHighlights(log);
  }

  const matchHighlights = bookingMatchAuditHighlights(log);
  if (matchHighlights.length > 0) {
    return matchHighlights;
  }

  if (!isServicePricingAction(log.action)) {
    return [];
  }

  const metadata = readMetadataObject(log.metadata);
  const highlights: MetadataHighlight[] = [];
  const service = firstRecord(metadata.service, metadata.after, metadata.before, metadata);
  const before = readRecord(metadata.before);
  const after = readRecord(metadata.after);
  const changedFields = readStringList(metadata.changedFields);

  const serviceLabel = serviceOptionLabel(service);
  if (serviceLabel) {
    highlights.push({ label: serviceLabel, tone: 'info' });
  }

  if (log.action === 'service.duration_set.create') {
    const durations = readNumberList(metadata.durationMins);
    if (durations.length > 0) {
      highlights.push({
        label: `Durations ${durations.map((duration) => `${duration}m`).join(', ')}`,
        tone: 'success',
      });
    }
  }

  const customerPrice = readNumber(after.customerPrice ?? after.basePrice ?? metadata.customerPrice);
  const previousCustomerPrice = readNumber(before.customerPrice ?? before.basePrice);
  const currency = readString(after.currency ?? before.currency) ?? 'VND';
  if (customerPrice !== null) {
    highlights.push({
      label:
        previousCustomerPrice !== null && previousCustomerPrice !== customerPrice
          ? `Customer ${money(previousCustomerPrice, currency)} -> ${money(customerPrice, currency)}`
          : `Customer ${money(customerPrice, currency)}`,
      tone: 'warning',
    });
  }

  const providerPayout = readNumber(after.providerPayoutAmount);
  const previousProviderPayout = readNumber(before.providerPayoutAmount);
  if (providerPayout !== null) {
    highlights.push({
      label:
        previousProviderPayout !== null && previousProviderPayout !== providerPayout
          ? `Partner ${money(previousProviderPayout, currency)} -> ${money(providerPayout, currency)}`
          : `Partner ${money(providerPayout, currency)}`,
      tone: 'success',
    });
  }

  const vatBps = readNumber(after.vatBps);
  const otherCost = readNumber(after.otherCostAmount);
  if (vatBps !== null || otherCost !== null) {
    highlights.push({
      label: `VAT ${formatBps(vatBps)} / other ${money(otherCost ?? 0, currency)}`,
      tone: 'info',
    });
  }

  const adjustedProviderPrices = readNumber(metadata.adjustedProviderPrices);
  if (adjustedProviderPrices !== null && adjustedProviderPrices > 0) {
    highlights.push({
      label: `${adjustedProviderPrices} Partner price(s) adjusted`,
      tone: 'warning',
    });
  }

  if (changedFields.length > 0) {
    highlights.push({
      label: `Changed ${changedFields.join(', ')}`,
      tone: 'info',
    });
  }

  return highlights.slice(0, 6);
}

function notificationRetryHighlights(log: AdminAuditLog): MetadataHighlight[] {
  const metadata = readMetadataObject(log.metadata);
  const latestDelivery = readRecord(metadata.latestDelivery);
  const retryJob = readRecord(metadata.retryJob);
  const highlights: MetadataHighlight[] = [];
  const provider = readString(latestDelivery.provider);
  const status = readString(latestDelivery.status);
  const failureCode = readString(latestDelivery.failureCode);
  const jobName = readString(retryJob.jobName);
  const fcmOutcome = notificationFcmOutcomeHighlight(provider, status);
  const retryRisk = notificationRetryRiskHighlight(readString(metadata.retryRisk));

  if (retryRisk) {
    highlights.push(retryRisk);
  }
  if (fcmOutcome) {
    highlights.push(fcmOutcome);
  }
  const tokenEvidence = notificationPushTokenEvidenceHighlight(latestDelivery);
  if (tokenEvidence) {
    highlights.push(tokenEvidence);
  }
  if (metadata.retryAlreadyDelivered === true) {
    highlights.push({ label: 'Already delivered before retry', tone: 'info' });
  }
  if (jobName) {
    highlights.push({ label: `Queued ${jobName}`, tone: 'info' });
  }
  if (provider && status) {
    highlights.push({
      label: `Latest ${provider} ${status}`,
      tone: notificationStatusHighlightTone(status),
    });
  }
  const pushDevice = notificationPushDevicePreview(latestDelivery);
  if (pushDevice) {
    highlights.push({ label: pushDevice, tone: 'info' });
  }
  if (failureCode) {
    highlights.push({
      label: notificationFailureCodeLabel(failureCode),
      tone: notificationFailureCodeTone(failureCode),
    });
    const recoveryActionLabel = notificationFailureRecoveryActionLabel(failureCode);
    if (recoveryActionLabel) {
      highlights.push({
        label: recoveryActionLabel,
        tone: 'warning',
      });
    }
  }
  if (latestDelivery.pushDeviceEnabled === true) {
    highlights.push({ label: 'Device enabled', tone: 'success' });
  }
  if (latestDelivery.pushDeviceEnabled === false) {
    highlights.push({ label: 'Device disabled', tone: 'warning' });
  }

  return highlights.slice(0, 8);
}

function notificationPushDevicePreview(latestDelivery: Record<string, unknown>) {
  const platform = readString(latestDelivery.pushDevicePlatform);
  const pushDeviceId = readString(latestDelivery.pushDeviceId);
  if (platform && pushDeviceId) {
    return `Device ${platform} ${pushDeviceId.slice(0, 8)}`;
  }
  if (platform) {
    return `Device ${platform}`;
  }
  return pushDeviceId ? `Device ${pushDeviceId.slice(0, 8)}` : null;
}

function notificationFcmOutcomeHighlight(
  provider: string | null,
  status: string | null,
): MetadataHighlight | null {
  if (provider !== 'FCM' || !status) {
    return null;
  }
  if (status === 'SENT') {
    return { label: 'FCM sent evidence', tone: 'success' };
  }
  if (status === 'FAILED') {
    return { label: 'FCM failure evidence', tone: 'warning' };
  }
  if (status === 'SKIPPED') {
    return { label: 'FCM skipped evidence', tone: 'info' };
  }
  return null;
}

function notificationStatusHighlightTone(status: string): StatusBadgeTone {
  if (status === 'SENT') {
    return 'success';
  }
  if (status === 'FAILED') {
    return 'warning';
  }
  return 'info';
}

function notificationFailureCodeTone(failureCode: string): StatusBadgeTone {
  if (
    failureCode === 'messaging/mismatched-credential' ||
    failureCode === 'PUSH_PROVIDER_NOT_CONFIGURED' ||
    failureCode === 'messaging/registration-token-not-registered' ||
    failureCode === 'messaging/invalid-registration-token'
  ) {
    return 'warning';
  }
  return 'info';
}

function notificationRetryRiskHighlight(risk: string | null): MetadataHighlight | null {
  if (risk === 'DUPLICATE_SEND_RISK') {
    return { label: 'Duplicate send risk', tone: 'warning' };
  }
  if (risk === 'DEVICE_DISABLED') {
    return { label: 'Device recovery needed', tone: 'warning' };
  }
  if (risk === 'FAILED_DELIVERY_RETRY') {
    return { label: 'Failed delivery retry', tone: 'warning' };
  }
  if (risk === 'STALE_PUSH_TOKEN') {
    return { label: 'Stale token retry', tone: 'warning' };
  }
  if (risk === 'NO_DELIVERY_EVIDENCE') {
    return { label: 'No delivery evidence', tone: 'info' };
  }
  if (risk === 'SKIPPED_DELIVERY_RETRY') {
    return { label: 'Skipped delivery retry', tone: 'info' };
  }
  return null;
}

function notificationRetryRiskPreview(risk: string | null) {
  return notificationRetryRiskHighlight(risk)?.label ?? null;
}

function notificationPushTokenEvidenceHighlight(
  latestDelivery: Record<string, unknown>,
): MetadataHighlight | null {
  if (latestDelivery.pushDeviceEnabled === false) {
    return null;
  }

  const lastSeenAt = Date.parse(readString(latestDelivery.pushDeviceLastSeenAt) ?? '');
  if (!Number.isFinite(lastSeenAt)) {
    return null;
  }

  if (hasStaleRetryAuditPushToken(latestDelivery)) {
    return { label: 'Stale token evidence', tone: 'warning' };
  }

  return { label: 'Token freshness evidence', tone: 'success' };
}

function bookingGateRejectionHighlights(log: AdminAuditLog): MetadataHighlight[] {
  const metadata = readMetadataObject(log.metadata);
  const highlights: MetadataHighlight[] = [{ label: 'Booking gate rejected', tone: 'warning' }];
  const reasonCode = readString(metadata.reasonCode);
  const customerDistance = readNumber(metadata.customerDistanceMeters);
  const customerLimit = readNumber(metadata.customerDistanceLimitMeters);
  const preferredDistance = readNumber(metadata.preferredProviderDistanceMeters);
  const preferredLimit = readNumber(metadata.preferredProviderDistanceLimitMeters);

  if (reasonCode) {
    highlights.push({ label: bookingCreateGateReasonLabel(reasonCode, 'audit'), tone: 'info' });
  }
  if (customerDistance !== null) {
    highlights.push({
      label: `Customer ${formatDistance(customerDistance)} / limit ${formatDistance(customerLimit ?? 0)}`,
      tone: 'info',
    });
  }
  if (preferredDistance !== null) {
    highlights.push({
      label: `Partner ${formatDistance(preferredDistance)} / limit ${formatDistance(preferredLimit ?? 0)}`,
      tone: 'info',
    });
  }

  return highlights.slice(0, 6);
}

function operationalPolicyHighlights(log: AdminAuditLog): MetadataHighlight[] {
  const metadata = readMetadataObject(log.metadata);
  const highlights: MetadataHighlight[] = [];
  const key = readString(metadata.key) ?? log.target.replace(/^operational_policy:/, '');
  const previousValue = metadata.previousValue;
  const value = metadata.value;
  const reason = readString(metadata.reason);
  const enforced = metadata.enforced === true;

  if (key) {
    highlights.push({ label: policyAuditKeyLabel(key), tone: 'info' });
  }
  highlights.push({
    label: enforced ? 'Live behavior' : 'Decision log',
    tone: enforced ? 'success' : 'warning',
  });
  if (previousValue !== undefined || value !== undefined) {
    highlights.push({
      label: `${compactAuditValue(previousValue)} -> ${compactAuditValue(value)}`,
      tone: 'warning',
    });
  }
  if (reason) {
    highlights.push({ label: `Reason: ${reason.slice(0, 72)}`, tone: 'success' });
  }

  return highlights.slice(0, 6);
}

function policyAuditKeyLabel(key: string) {
  return key
    .split('.')
    .map((part) => part.replace(/_/g, ' '))
    .map((part) => operationalDisplayText(part))
    .join(' / ');
}

function compactAuditValue(value: unknown) {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[complex value]';
    }
  }
  return String(value);
}

function relatedBoardHref(log: AdminAuditLog) {
  const targetId = log.target?.split(':')[1];
  const metadata = readMetadataObject(log.metadata);
  if (log.action === 'booking.create.rejected') {
    const customerProfileId =
      typeof metadata.customerProfileId === 'string'
        ? metadata.customerProfileId
        : log.target?.startsWith('customer:')
          ? targetId
          : null;
    return customerProfileId ? `/customers/${customerProfileId}` : '/customers';
  }
  if (log.action.startsWith('booking.')) {
    return targetId ? `/bookings/${targetId}` : '/bookings';
  }
  if (log.action.startsWith('payment.')) {
    return targetId ? `/payments#payment-${targetId}` : '/payments';
  }
  if (log.action.startsWith('refund.')) {
    return targetId ? `/refunds#refund-${targetId}` : '/refunds';
  }
  if (isPayoutAction(log.action)) {
    return targetId ? `/payouts#${targetId}` : '/payouts';
  }
  if (isFinanceCloseoutAction(log.action)) {
    return '/finance-closeout';
  }
  if (log.action.startsWith('notification.')) {
    return notificationBoardHref(metadata, targetId);
  }
  if (isPushDeviceAction(log.action)) {
    return '/notifications?review=disabled-device';
  }
  if (log.action.startsWith('operational_policy.')) {
    return '/operations-policy';
  }
  if (isServicePricingAction(log.action)) {
    return '/services';
  }
  if (isDispatchAction(log.action)) {
    const providerId =
      targetId && log.target?.startsWith('provider:')
        ? targetId
        : typeof metadata.providerProfileId === 'string'
          ? metadata.providerProfileId
          : null;
    return providerId ? `/partners/${providerId}` : '/partners';
  }
  if (log.action.startsWith('coupon.')) {
    return '/coupons';
  }
  if (log.action.startsWith('tax_') || log.action.startsWith('tax.')) {
    return '/tax-policy';
  }
  return '/audit-log';
}

function notificationBoardHref(metadata: Record<string, unknown>, targetId?: string) {
  const notificationId = readString(metadata.notificationId) ?? targetId;
  if (!notificationId) {
    return '/notifications';
  }

  const review = notificationAuditReview(metadata);
  const query = review ? `?review=${review}` : '';
  return `/notifications${query}#${encodeURIComponent(notificationId)}`;
}

function notificationAuditReview(metadata: Record<string, unknown>) {
  const latestDelivery = readRecord(metadata.latestDelivery);
  const provider = readString(latestDelivery.provider);
  const retryRisk = readString(metadata.retryRisk);
  const status = readString(latestDelivery.status);

  if (retryRisk === 'DEVICE_DISABLED') {
    return 'disabled-device';
  }
  if (retryRisk === 'STALE_PUSH_TOKEN' || hasStaleRetryAuditPushToken(latestDelivery)) {
    return 'stale-device';
  }
  if (status === 'FAILED') {
    return 'failed';
  }
  if (status === 'SKIPPED') {
    return 'skipped';
  }
  if (provider === 'FCM') {
    return 'fcm';
  }
  if (status === 'SENT') {
    return 'sent';
  }
  return '';
}

function hasStaleRetryAuditPushToken(latestDelivery: Record<string, unknown>) {
  if (latestDelivery.pushDeviceEnabled === false) {
    return false;
  }

  const attemptedAt = Date.parse(readString(latestDelivery.attemptedAt) ?? '');
  const lastSeenAt = Date.parse(readString(latestDelivery.pushDeviceLastSeenAt) ?? '');
  if (!Number.isFinite(attemptedAt) || !Number.isFinite(lastSeenAt)) {
    return false;
  }
  return attemptedAt - lastSeenAt >= STALE_PUSH_DEVICE_AGE_MS;
}

function relatedBoardLabel(log: AdminAuditLog) {
  const href = relatedBoardHref(log);
  if (href === '/audit-log') {
    return 'Audit';
  }
  if (href.startsWith('/partners/')) {
    return 'Partner detail';
  }
  if (href.startsWith('/bookings/')) {
    return 'Booking detail';
  }
  if (href.startsWith('/notifications')) {
    return 'Notification board';
  }
  return titleCaseBoardLabel(href.slice(1));
}

function titleCaseBoardLabel(value: string) {
  return value
    .replace(/[-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readMetadataObject(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function firstRecord(...values: unknown[]) {
  for (const value of values) {
    const record = readRecord(value);
    if (Object.keys(record).length > 0) {
      return record;
    }
  }
  return {};
}

function readRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readStringList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => readString(item)).filter((item): item is string => Boolean(item))
    : [];
}

function readNumberList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => readNumber(item)).filter((item): item is number => item !== null)
    : [];
}

function serviceOptionLabel(value: Record<string, unknown>) {
  const name = readString(value.name);
  const duration = readNumber(value.durationMin);
  if (!name) {
    return null;
  }
  return duration ? `${name} / ${duration} min` : name;
}

function formatBps(value: number | null) {
  if (value === null) {
    return '-';
  }
  return `${(value / 100).toFixed(2).replace(/\.00$/, '')}%`;
}

function formatDistance(value: number) {
  return formatDistanceMeters(value, '-');
}

function reviewPriorityLabel(action: string) {
  const priority = auditPriority(action);
  if (priority >= 4) {
    return 'Review this first';
  }
  if (priority >= 3) {
    return 'Check before close';
  }
  if (priority >= 2) {
    return 'Trace related flow';
  }
  return 'Reference event';
}

function auditRelativeTime(value: string) {
  return formatRelativeTime(value, { justNow: 'Updated just now' });
}

function opsHint(action: string, target: string) {
  if (action === 'booking.ops_note.add') {
    return 'Internal operator note was added to the booking handoff trail.';
  }
  if (action === 'booking.ops_task.update') {
    return 'Structured booking handling status was updated by an operator.';
  }
  if (action.startsWith('booking.')) {
    return 'Trace booking state changes and verify Customer/Partner handoff.';
  }
  if (action.startsWith('payment.')) {
    return 'Confirm the money state matches the booking state before closing the loop.';
  }
  if (isPayoutAction(action)) {
    return 'Confirm transfer references, withholding logs, and Partner payout readiness before release.';
  }
  if (isFinanceCloseoutAction(action)) {
    return 'Trace this row through Finance Closeout before ending the shift.';
  }
  if (action.startsWith('notification.')) {
    return 'Check retry or delivery health if the Customer or Partner missed an alert.';
  }
  if (isPushDeviceAction(action)) {
    return 'Check push token freshness and delivery health before re-enabling alerts.';
  }
  if (action.startsWith('operational_policy.')) {
    return 'Confirm the policy change matches the current owner decision and active booking controls.';
  }
  if (isServicePricingAction(action)) {
    return 'Review service price, Partner payout, VAT, costs, and before/after changes.';
  }
  if (action.startsWith('provider.')) {
    return 'Review Partner readiness, moderation, or queue movement.';
  }
  return `Audit trail for ${target || 'system'} activity.`;
}

function opsDetail(action: string) {
  if (action === 'booking.ops_note.add') {
    return 'Use the note to understand Customer/Partner contact history before taking the next action.';
  }
  if (action === 'booking.ops_task.update') {
    return 'Use the status to see which handoff checks are done, pending, or blocked.';
  }
  if (action.endsWith('.refund')) {
    return 'Refund actions should line up with booking cancellation or service failure notes.';
  }
  if (action.endsWith('.capture')) {
    return 'Capture should only happen once service completion is confirmed.';
  }
  if (isPayoutAction(action)) {
    return 'Payout updates should line up with earnings, tax logs, bank references, and active account controls.';
  }
  if (action === 'booking.completed.closeout') {
    return 'Completed closeout should leave payment, earning, tax, wallet, and chat archive records aligned.';
  }
  if (action === 'notification.retry') {
    return 'Retry events should line up with FCM delivery status, token freshness, and audit evidence.';
  }
  if (isPushDeviceAction(action)) {
    return 'Device recovery events should line up with a fresh token or operator-confirmed delivery recovery.';
  }
  if (action.endsWith('.retry')) {
    return 'Retry events are useful when a delivery or operation needed another pass.';
  }
  if (action.startsWith('operational_policy.')) {
    return 'Operational policy edits can change matching timers, marketplace Partner visibility, wallet gates, and alert routing.';
  }
  if (isServicePricingAction(action)) {
    return 'Price policy changes affect customer price, Partner payout, tax withholding, cash debt, and payout batches.';
  }
  if (action.endsWith('.approve') || action.endsWith('.reject')) {
    return 'Partner review actions should match verification evidence and moderation notes.';
  }
  return 'Use this row to confirm who acted, when they acted, and what object changed.';
}
