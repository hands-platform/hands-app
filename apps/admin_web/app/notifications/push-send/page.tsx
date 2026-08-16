import Link from 'next/link';

import type { AdminPushCampaign, AdminPushCampaignSummary } from '../../../lib/admin-api';
import { adminGetResult } from '../../../lib/admin-api';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../../components/admin-data-table';
import { AdminTablePanel } from '../../../components/admin-table-panel';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminSegmentedControl } from '../../../components/admin-segmented-control';
import { AdminDisclosure } from '../../../components/admin-surface';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge } from '../../../components/status-badge';
import { shortId } from '../../../lib/admin-format';
import { PushCampaignComposer } from './push-campaign-composer';
import { pushSendBrowserFixture } from './push-send-browser-fixtures';
import {
  buildPushCampaignApiHref,
  buildPushCampaignListHref,
  buildPushCampaignPageHref,
  buildPushCampaignSummaryApiHref,
  normalizePushCampaignDateRange,
  normalizePushCampaignPage,
  pushCampaignDateRangeLabel,
  pushCampaignDateRangeLinks,
  pushCampaignStatusView,
} from './push-send-page-model';

type PushSendPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const CAMPAIGN_HEADERS = [
  'Campaign',
  'Audience',
  'Message / destination',
  'Delivery evidence',
  'Status / evidence',
];

export default async function PushSendPage({ searchParams }: { searchParams?: PushSendPageSearchParams }) {
  const params = (await searchParams) ?? {};
  const campaignRange = normalizePushCampaignDateRange(readParam(params.campaignRange));
  const campaignPage = normalizePushCampaignPage(readParam(params.campaignPage));
  const browserFixture = pushSendBrowserFixture(readParam(params.fixture));
  const [campaignResult, summaryResult] = browserFixture
    ? [
        { data: [...browserFixture.campaigns], ok: true, status: 200 },
        { data: browserFixture.summary, ok: true, status: 200 },
      ]
    : await Promise.all([
        adminGetResult<AdminPushCampaign[]>(buildPushCampaignApiHref(params), []),
        adminGetResult<AdminPushCampaignSummary | null>(buildPushCampaignSummaryApiHref(params), null),
      ]);
  const campaigns = campaignResult.data;
  const summary = summaryResult.data;
  const totalCampaigns = summary?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCampaigns / 20));
  const visibleFrom = campaigns.length ? (campaignPage - 1) * 20 + 1 : 0;
  const visibleTo = campaigns.length ? visibleFrom + campaigns.length - 1 : 0;

  return (
    <AdminPageTemplate
      contentClassName="notification-push-send-page"
      description="Server-verified manual campaigns. Preview, confirm, queue, then inspect Partner delivery evidence."
      title="Push Send"
    >
      <PushRiskStrip summary={summary} summaryOk={summaryResult.ok} />
      {browserFixture?.pageError ? (
        <div className="notification-push-permission-denied" role="alert">{browserFixture.pageError}</div>
      ) : (
        <PushCampaignComposer fixture={browserFixture?.composer} />
      )}

      <AdminTablePanel
        className="notification-push-history"
        description="Actual campaign lifecycle and device outcomes. Queued does not mean delivered."
        id="push-campaign-history"
        resultLabel={campaignResult.ok && summaryResult.ok ? `${campaigns.length} shown · ${totalCampaigns} total` : 'Source unavailable'}
        resultTone={campaignResult.ok && summaryResult.ok ? 'info' : 'danger'}
        title={`Campaign history · ${pushCampaignDateRangeLabel(campaignRange)}`}
      >
        <AdminSegmentedControl
          activeValue={campaignRange}
          ariaLabel="Push campaign history range"
          className="notification-push-campaign-range-row"
          options={pushCampaignDateRangeLinks.map((item) => ({
            href: buildPushCampaignListHref(item.range),
            label: item.label,
            value: item.range,
          }))}
        />
        {!campaignResult.ok ? (
          <div className="notification-push-history-error" role="alert">
            Campaign history could not be loaded. Do not infer zero campaigns from this state.
          </div>
        ) : (
          <AdminTableScroll ariaLabel="Push campaign evidence table">
            <AdminDataTable
              className="notification-push-history-table"
              emptyMessage="No campaigns in this history range."
              headers={CAMPAIGN_HEADERS}
              rowCount={campaigns.length}
            >
              {campaigns.map((campaign) => <CampaignRow campaign={campaign} key={campaign.id} />)}
            </AdminDataTable>
          </AdminTableScroll>
        )}
        <AdminTablePaginationFooter
          activePage={campaignPage}
          ariaLabel="Push campaign pagination"
          from={visibleFrom}
          hrefForPage={(page) => buildPushCampaignPageHref(page, params)}
          pageLinkClassName="vuexy-booking-page-link"
          to={visibleTo}
          totalPages={totalPages}
          totalRows={totalCampaigns}
        />
      </AdminTablePanel>
    </AdminPageTemplate>
  );
}

function PushRiskStrip({ summary, summaryOk }: { summary: AdminPushCampaignSummary | null; summaryOk: boolean }) {
  const items = summary ? [
    { label: 'Needs attention', value: summary.needsAttention, tone: summary.needsAttention ? 'danger' : 'neutral' },
    { label: 'Queued / processing', value: summary.queuedOrProcessing, tone: summary.queuedOrProcessing ? 'info' : 'neutral' },
    { label: 'Users in range', value: summary.totalRecipients, tone: 'neutral' },
    { label: 'Device attempts', value: summary.eligibleDevices, tone: 'neutral' },
    { label: 'Delivered', value: summary.deliveredDevices, tone: 'success' },
    { label: 'Last completed', value: summary.lastCompletedAt ? <DateTimeText value={summary.lastCompletedAt} /> : 'None', tone: 'neutral' },
  ] as const : [];
  return (
    <section aria-label="Push campaign risk summary" className="notification-push-risk-strip">
      {!summaryOk || !summary ? (
        <div className="notification-push-risk-unavailable" role="alert">Campaign summary unavailable. History remains independent.</div>
      ) : items.map((item) => (
        <div data-tone={item.tone} key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>
      ))}
    </section>
  );
}

function CampaignRow({ campaign }: { campaign: AdminPushCampaign }) {
  const status = pushCampaignStatusView(campaign.status);
  return (
    <tr>
      <td>
        <strong>{shortId(campaign.id)}</strong>
        <span className="muted"><DateTimeText value={campaign.queuedAt ?? campaign.createdAt} /></span>
        <small className="muted">Actor recorded in campaign audit</small>
      </td>
      <td>
        <strong>{campaign.targetRole === 'PROVIDER' ? 'Partners' : 'Customers'} · {localeLabel(campaign.locale)}</strong>
        <span className="muted">{campaign.targetSegment}</span>
        <small className="muted">{campaign.recipientCount} users · {campaign.eligibleDeviceCount} devices</small>
      </td>
      <td className="notification-push-copy-cell">
        <strong>{campaign.title}</strong>
        <span>{campaign.body}</span>
        <small className="muted">Opens {destinationLabel(campaign.appDestination)}</small>
      </td>
      <td>
        <strong>{campaign.deliveredDeviceCount} delivered</strong>
        <span className="muted">{campaign.failedDeviceCount} failed · {campaign.pendingDeviceCount} pending</span>
        <small className="muted">{campaign.skippedDeviceCount} skipped · {campaign.notificationCount} notifications</small>
      </td>
      <td>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        <AdminDisclosure ariaLabel={`Evidence for campaign ${shortId(campaign.id)}`} className="notification-push-history-evidence">
          <summary>View evidence</summary>
          <dl>
            <div><dt>Reason</dt><dd>{campaign.operatorReason || 'Not recorded'}</dd></div>
            <div><dt>Confirmed</dt><dd><DateTimeText fallback="Not confirmed" value={campaign.confirmedAt} /></dd></div>
            <div><dt>Processing</dt><dd><DateTimeText fallback="Not started" value={campaign.processingAt} /></dd></div>
            <div><dt>Completed</dt><dd><DateTimeText fallback="Not terminal" value={campaign.completedAt ?? campaign.failedAt} /></dd></div>
            <div><dt>Excluded</dt><dd>{campaign.excludedUserCount} users · {campaign.excludedDeviceCount} devices</dd></div>
          </dl>
          <div className="notification-push-evidence-links">
            <Link href={`/notifications?mode=records&campaignId=${encodeURIComponent(campaign.id)}`} prefetch={false}>Campaign delivery records</Link>
            <Link href={`/audit-log?q=${encodeURIComponent(campaign.id)}`} prefetch={false}>Campaign audit</Link>
          </div>
          <AdminDisclosure ariaLabel="Technical campaign details">
            <summary>Technical details</summary>
            <p>Campaign {shortId(campaign.id)} · Queue job {campaign.queueJobId ? shortId(campaign.queueJobId) : 'not recorded'}</p>
          </AdminDisclosure>
        </AdminDisclosure>
      </td>
    </tr>
  );
}

function destinationLabel(value: string) {
  const labels: Record<string, string> = {
    booking: 'Bookings',
    earnings: 'Earnings',
    jobs: 'Jobs',
    notificationCenter: 'Notification center',
    profile: 'Profile',
  };
  return labels[value] ?? value;
}

function localeLabel(value?: string | null) {
  const labels: Record<string, string> = { en: 'EN', ja: 'JA', ko: 'KO', vi: 'VI', zh: 'ZH' };
  return value ? labels[value] ?? value.toUpperCase() : 'Unknown locale';
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}
