import type {
  AdminPushCampaign,
  AdminPushCampaignPreview,
  AdminPushCampaignSummary,
} from '../../../lib/admin-api';
import { adminGet, adminPost } from '../../../lib/admin-api';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../../components/admin-data-table';
import { AdminFilterSummary } from '../../../components/admin-filter-summary';
import { AdminTablePanel } from '../../../components/admin-table-panel';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
  AdminFormShell,
  AdminFormStaticValue,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { AdminPageTemplate, AdminSectionHeader } from '../../../components/admin-page-template';
import { AdminSegmentedControl } from '../../../components/admin-segmented-control';
import { AdminCard, AdminNoticeCard, AdminSection } from '../../../components/admin-surface';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge } from '../../../components/status-badge';
import { shortId } from '../../../lib/admin-format';
import { sendPushCampaign } from './actions';
import {
  buildPushCampaignApiHref,
  buildPushCampaignListHref,
  buildPushCampaignPageHref,
  buildPushCampaignSummaryApiHref,
  normalizePushCampaignPage,
  normalizePushCampaignDateRange,
  pushCampaignDateRangeLabel,
  pushCampaignDateRangeLinks,
  shouldRequestPushCampaignPreview,
} from './push-send-page-model';

type PushSendPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const TARGET_ROLE_OPTIONS = [
  { label: 'Customers', value: 'CUSTOMER' },
  { label: 'Partners', value: 'PROVIDER' },
] as const;

const CUSTOMER_SEGMENT_OPTIONS = [
  { label: 'All customers with push devices', value: 'all' },
  { label: 'Completed booking in last 7 days', value: 'customer_completed_last_7_days' },
  { label: 'Completed before, inactive 30 days', value: 'customer_completed_inactive_30_days' },
  { label: 'Never booked', value: 'customer_never_booked' },
  { label: 'Active in last 3 days, no booking', value: 'customer_active_last_3_days_no_booking' },
  { label: 'Referral parent customers', value: 'customer_referral_parents' },
] as const;

const PARTNER_SEGMENT_OPTIONS = [
  { label: 'All Partners in Vietnam', value: 'all' },
  { label: 'Partners with completed bookings', value: 'provider_completed_booking' },
  { label: 'Referral parent Partners', value: 'provider_referral_parents' },
  { label: 'Partners inactive for 7 days', value: 'provider_inactive_last_7_days' },
] as const;

const CUSTOMER_DESTINATION_OPTIONS = [
  { label: 'Home / Notification center', value: 'notificationCenter' },
  { label: 'Bookings', value: 'booking' },
  { label: 'Chat', value: 'chat' },
  { label: 'Partners', value: 'providerProfile' },
  { label: 'Profile', value: 'profile' },
] as const;

const PARTNER_DESTINATION_OPTIONS = [
  { label: 'Requests', value: 'booking' },
  { label: 'Jobs', value: 'jobs' },
  { label: 'Earnings', value: 'earnings' },
  { label: 'Chat', value: 'chat' },
  { label: 'Profile', value: 'profile' },
] as const;

const LOCALE_OPTIONS = [
  { label: 'Default language', value: '' },
  { label: 'English', value: 'en' },
  { label: 'Vietnamese', value: 'vi' },
  { label: 'Korean', value: 'ko' },
  { label: 'Japanese', value: 'ja' },
  { label: 'Chinese', value: 'zh' },
] as const;

const CAMPAIGN_HEADERS = ['Sent', 'Target / Filter', 'App page', 'Title', 'Recipients', 'Status'];

export default async function PushSendPage({ searchParams }: { searchParams?: PushSendPageSearchParams }) {
  const params = (await searchParams) ?? {};
  const targetRole = normalizeTargetRole(readSearchParam(params.targetRole));
  const segmentOptions = targetRole === 'PROVIDER' ? PARTNER_SEGMENT_OPTIONS : CUSTOMER_SEGMENT_OPTIONS;
  const destinationOptions =
    targetRole === 'PROVIDER' ? PARTNER_DESTINATION_OPTIONS : CUSTOMER_DESTINATION_OPTIONS;
  const targetSegment = normalizeTargetOption(readSearchParam(params.targetSegment), segmentOptions, 'all');
  const appDestination = normalizeTargetOption(
    readSearchParam(params.appDestination),
    destinationOptions,
    destinationOptions[0].value,
  );
  const targetUserId = readSearchParam(params.targetUserId);
  const locale = targetRole === 'PROVIDER' ? 'vi' : readSearchParam(params.locale);
  const title = readSearchParam(params.title);
  const body = readSearchParam(params.body);
  const campaignRange = normalizePushCampaignDateRange(readSearchParam(params.campaignRange));
  const campaignPage = normalizePushCampaignPage(readSearchParam(params.campaignPage));
  const campaignRangeLabel = pushCampaignDateRangeLabel(campaignRange);
  const canPreview = shouldRequestPushCampaignPreview(params);
  const [campaigns, campaignSummary, preview] = await Promise.all([
    adminGet<AdminPushCampaign[]>(buildPushCampaignApiHref(params), []),
    adminGet<AdminPushCampaignSummary | null>(buildPushCampaignSummaryApiHref(params), null),
    canPreview
      ? adminPost<AdminPushCampaignPreview | null>(
          '/admin/notifications/push-campaigns/preview',
          {
            targetRole,
            targetSegment,
            appDestination,
            targetUserId: targetUserId || undefined,
            locale: locale || undefined,
            title,
            body,
          },
          null,
        )
      : Promise.resolve(null),
  ]);
  const totalCampaigns = campaignSummary?.totalCount ?? campaigns.length;
  const totalRecipients =
    campaignSummary?.totalRecipients ?? campaigns.reduce((sum, campaign) => sum + campaign.recipientCount, 0);
  const totalNotifications =
    campaignSummary?.totalNotifications ??
    campaigns.reduce((sum, campaign) => sum + campaign.notificationCount, 0);
  const campaignPageSize = 20;
  const campaignTotalPages = Math.max(1, Math.ceil(totalCampaigns / campaignPageSize));
  const visibleFrom = totalCampaigns === 0 || campaigns.length === 0 ? 0 : (campaignPage - 1) * campaignPageSize + 1;
  const visibleTo =
    totalCampaigns === 0 || campaigns.length === 0
      ? 0
      : Math.min(totalCampaigns, (campaignPage - 1) * campaignPageSize + campaigns.length);
  const notice = pushCampaignNotice(readSearchParam(params.notice), readSearchParam(params.campaignId));

  return (
    <AdminPageTemplate
      actions={
        <>
          <AdminFormControlLink href="/notifications">Delivery board</AdminFormControlLink>
          <AdminFormControlLink href="/notifications/templates">Templates</AdminFormControlLink>
        </>
      }
      contentClassName="stack notification-push-send-page"
      description="Manual push workspace with recipient preview before creating persistent in-app notifications and FCM deliveries."
      metrics={[
        {
          helper: 'Manual push campaigns in this period.',
          kind: campaignRange === 'all' ? 'record' : 'period',
          label: 'Campaigns',
          scope: campaignRangeLabel,
          value: totalCampaigns,
        },
        {
          helper: campaigns[0] ? (
            <>
              Most recent manual push record. <DateTimeText value={campaigns[0].sentAt ?? campaigns[0].createdAt} />
            </>
          ) : (
            'Most recent manual push record.'
          ),
          kind: 'record',
          label: 'Last send',
          scope: 'Delivery history',
          value: campaigns[0] ? shortId(campaigns[0].id) : '-',
        },
        {
          helper: (
            <>
              Recipient total across campaigns in this period. {totalNotifications} notifications.
            </>
          ),
          kind: campaignRange === 'all' ? 'record' : 'period',
          label: 'Recipients',
          scope: campaignRangeLabel,
          value: totalRecipients,
        },
      ]}
      title="Push Send"
    >
      {notice ? (
        <AdminNoticeCard
          tone={notice.tone === 'success' ? 'success' : 'danger'}
        >
          <AdminSectionHeader
            actions={<StatusBadge tone={notice.tone}>{notice.badge}</StatusBadge>}
            description={notice.detail}
            title={notice.title}
          />
        </AdminNoticeCard>
      ) : null}

      <AdminSection
        description="Preview recipients first, then send. Direct user sends require an exact user id."
        statusLabel={preview ? `${preview.willSendCount} ready` : 'Preview required'}
        statusTone={preview ? (preview.willSendCount ? 'success' : 'warning') : 'info'}
        title="Create push campaign"
      >
        <AdminFormGrid className="notification-push-preview-form" method="get">
          <input name="preview" type="hidden" value="1" />
          <AdminFormSelect
            defaultValue={targetRole}
            label="Target role"
            name="targetRole"
            options={TARGET_ROLE_OPTIONS}
          />
          <AdminFormSelect
            defaultValue={targetSegment}
            label="Audience filter"
            name="targetSegment"
            options={segmentOptions}
          />
          <AdminFormSelect
            defaultValue={appDestination}
            label="Open page"
            name="appDestination"
            options={destinationOptions}
          />
          {targetRole === 'PROVIDER' ? (
            <AdminFormStaticValue
              hiddenName="locale"
              hiddenValue="vi"
              label="Language"
              labelVisibility="visible"
              value="Vietnamese"
            />
          ) : (
            <AdminFormSelect defaultValue={locale} label="Language" name="locale" options={LOCALE_OPTIONS} />
          )}
          <AdminFormInput
            defaultValue={targetUserId}
            label="Specific user id"
            name="targetUserId"
            placeholder="Optional user id"
          />
          <AdminFormInput
            defaultValue={title}
            label="Push title"
            maxLength={120}
            name="title"
            placeholder="Push title"
            required
          />
          <AdminFormTextarea
            defaultValue={body}
            label="Push body"
            maxLength={500}
            name="body"
            placeholder="Push body"
            required
            rows={3}
          />
          <AdminFormControlButton>Preview recipients</AdminFormControlButton>
        </AdminFormGrid>
        <AdminFilterSummary
          ariaLabel="Active push send filters"
          labels={pushSendActiveFilterLabels({
            appDestination,
            campaignRangeLabel,
            locale,
            targetRole,
            targetSegment,
            targetUserId,
          })}
          tone="info"
        />

        {preview ? (
          <AdminCard className="notification-push-preview-card">
            <div className="notification-push-preview-summary">
              <div>
                <span className="muted">Audience filter</span>
                <strong>{pushSegmentLabel(preview.targetSegment ?? targetSegment, targetRole)}</strong>
              </div>
              <div>
                <span className="muted">Opens page</span>
                <strong>{pushDestinationLabel(preview.appDestination ?? appDestination, targetRole)}</strong>
              </div>
              <div>
                <span className="muted">Recipient count</span>
                <strong>{preview.recipientCount}</strong>
              </div>
              <div>
                <span className="muted">Will send</span>
                <strong>{preview.willSendCount}</strong>
              </div>
              <div>
                <span className="muted">Limit</span>
                <strong>{preview.sendLimit}</strong>
              </div>
              {preview.capped ? (
                <StatusBadge tone="warning">Capped</StatusBadge>
              ) : (
                <StatusBadge tone="success">Ready</StatusBadge>
              )}
            </div>

            <div className="notification-push-recipient-sample">
              {preview.sampleRecipients.map((recipient) => (
                <div className="notification-push-recipient" key={recipient.id}>
                  <strong>
                    {recipient.fullName || recipient.providerProfile?.displayName || recipient.phone}
                  </strong>
                  <span className="muted">{recipient.phone}</span>
                  {recipient.pushDevices?.[0]?.platform ? (
                    <span className="muted">{recipient.pushDevices[0].platform}</span>
                  ) : (
                    <AdminInlineFallback>No device</AdminInlineFallback>
                  )}
                </div>
              ))}
            </div>

            <AdminFormShell action={sendPushCampaign} className="notification-push-send-confirm-form">
              <input name="targetRole" type="hidden" value={targetRole} />
              <input name="targetSegment" type="hidden" value={targetSegment} />
              <input name="appDestination" type="hidden" value={appDestination} />
              <input name="targetUserId" type="hidden" value={targetUserId} />
              <input name="locale" type="hidden" value={locale} />
              <input name="title" type="hidden" value={title} />
              <input name="body" type="hidden" value={body} />
              <AdminFormControlButton disabled={preview.willSendCount === 0}>
                Send push
              </AdminFormControlButton>
            </AdminFormShell>
          </AdminCard>
        ) : null}
      </AdminSection>

      <AdminTablePanel
        resultLabel={`${campaigns.length} loaded of ${totalCampaigns} total`}
        title={`Recent push campaigns / ${campaignRangeLabel}`}
      >
        <AdminSegmentedControl
          activeValue={campaignRange}
          ariaLabel="Push campaign date range"
          className="notification-push-campaign-range-row"
          options={pushCampaignDateRangeLinks.map((item) => ({
            href: buildPushCampaignListHref(item.range, params),
            label: item.label,
            value: item.range,
          }))}
        />
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage="No manual push campaigns yet."
            headers={CAMPAIGN_HEADERS}
            rowCount={campaigns.length}
          >
            {campaigns.map((campaign) => (
              <tr key={campaign.id}>
                <td>
                  <strong>{shortId(campaign.id)}</strong>
                  <span className="muted">
                    <DateTimeText value={campaign.sentAt ?? campaign.createdAt} />
                  </span>
                </td>
                <td>
                  <StatusBadge tone={campaign.targetRole === 'PROVIDER' ? 'info' : 'warning'}>
                    {campaign.targetRole === 'PROVIDER' ? 'Partners' : 'Customers'}
                  </StatusBadge>
                  <span className="muted">
                    Filter:{' '}
                    {pushSegmentLabel(readCampaignTargetSegment(campaign.metadata), campaign.targetRole)}
                  </span>
                </td>
                <td>
                  <strong>
                    {pushDestinationLabel(readCampaignAppDestination(campaign.metadata), campaign.targetRole)}
                  </strong>
                  <span className="muted">Tap destination</span>
                </td>
                <td>
                  <strong>{campaign.title}</strong>
                  <span className="muted">{campaign.body}</span>
                </td>
                <td>
                  <strong>{campaign.recipientCount}</strong>
                  <span className="muted">{campaign.notificationCount} notifications</span>
                </td>
                <td>
                  <StatusBadge tone={campaign.status === 'SENT' ? 'success' : 'neutral'}>
                    {campaign.status}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
        <AdminTablePaginationFooter
          activePage={campaignPage}
          ariaLabel="Push campaign pagination"
          from={visibleFrom}
          hrefForPage={(page) => buildPushCampaignPageHref(page, params)}
          pageLinkClassName="vuexy-booking-page-link"
          to={visibleTo}
          totalPages={campaignTotalPages}
          totalRows={totalCampaigns}
        />
      </AdminTablePanel>
    </AdminPageTemplate>
  );
}

function pushCampaignNotice(notice: string, campaignId: string) {
  if (notice === 'sent') {
    return {
      badge: 'Sent',
      detail: campaignId
        ? `Campaign ${shortId(campaignId)} was queued for delivery.`
        : 'Push campaign was queued.',
      title: 'Push campaign sent',
      tone: 'success' as const,
    };
  }
  if (notice === 'failed') {
    return {
      badge: 'Blocked',
      detail: 'No push was sent. Check the target, active push devices, and required copy.',
      title: 'Push campaign failed',
      tone: 'danger' as const,
    };
  }
  return null;
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function pushSendActiveFilterLabels({
  appDestination,
  campaignRangeLabel,
  locale,
  targetRole,
  targetSegment,
  targetUserId,
}: {
  readonly appDestination: string;
  readonly campaignRangeLabel: string;
  readonly locale: string;
  readonly targetRole: string;
  readonly targetSegment: string;
  readonly targetUserId: string;
}) {
  const labels = [
    `Target: ${targetRole === 'PROVIDER' ? 'Partners' : 'Customers'}`,
    `Audience: ${pushSegmentLabel(targetSegment, targetRole)}`,
    `Open page: ${pushDestinationLabel(appDestination, targetRole)}`,
    `Language: ${pushLocaleLabel(locale, targetRole)}`,
    `Campaign rows: ${campaignRangeLabel}`,
  ];

  if (targetUserId) {
    labels.push(`Specific user: ${targetUserId}`);
  }

  return labels;
}

function normalizeTargetRole(value: string) {
  return value === 'PROVIDER' ? 'PROVIDER' : 'CUSTOMER';
}

function normalizeTargetOption(
  value: string,
  options: ReadonlyArray<{ readonly label: string; readonly value: string }>,
  fallback: string,
) {
  return options.some((option) => option.value === value) ? value : fallback;
}

function readCampaignTargetSegment(metadata: unknown) {
  if (metadata && typeof metadata === 'object' && 'targetSegment' in metadata) {
    const value = (metadata as { targetSegment?: unknown }).targetSegment;
    return typeof value === 'string' ? value : 'all';
  }
  return 'all';
}

function readCampaignAppDestination(metadata: unknown) {
  if (metadata && typeof metadata === 'object' && 'appDestination' in metadata) {
    const value = (metadata as { appDestination?: unknown }).appDestination;
    return typeof value === 'string' ? value : 'notificationCenter';
  }
  return 'notificationCenter';
}

function pushSegmentLabel(value: string, targetRole?: string) {
  const options =
    targetRole === 'PROVIDER'
      ? PARTNER_SEGMENT_OPTIONS
      : targetRole === 'CUSTOMER'
        ? CUSTOMER_SEGMENT_OPTIONS
        : [...CUSTOMER_SEGMENT_OPTIONS, ...PARTNER_SEGMENT_OPTIONS];
  return options.find((option) => option.value === value)?.label ?? 'All active push recipients';
}

function pushDestinationLabel(value: string, targetRole?: string) {
  const options =
    targetRole === 'PROVIDER'
      ? PARTNER_DESTINATION_OPTIONS
      : targetRole === 'CUSTOMER'
        ? CUSTOMER_DESTINATION_OPTIONS
        : [...CUSTOMER_DESTINATION_OPTIONS, ...PARTNER_DESTINATION_OPTIONS];
  return options.find((option) => option.value === value)?.label ?? 'Home / Notification center';
}

function pushLocaleLabel(value: string, targetRole?: string) {
  if (targetRole === 'PROVIDER') {
    return 'Vietnamese';
  }
  return LOCALE_OPTIONS.find((option) => option.value === value)?.label ?? 'Default language';
}
