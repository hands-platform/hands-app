import type {
  AdminCustomerDirectoryRow,
  AdminProvider,
  AdminPushCampaign,
  AdminPushCampaignPreview,
  AdminPushCampaignSummary,
} from '../../../lib/admin-api';
import { adminGet, adminGetResult, adminPost } from '../../../lib/admin-api';
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
import { AdminCard, AdminErrorState, AdminNoticeCard, AdminSection } from '../../../components/admin-surface';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge } from '../../../components/status-badge';
import { shortId } from '../../../lib/admin-format';
import { sendPushCampaign } from './actions';
import {
  buildPushCampaignApiHref,
  buildPushCampaignListHref,
  buildPushCampaignPageHref,
  buildPushCampaignSummaryApiHref,
  buildPushRecipientSearchApiHref,
  buildPushRecipientSelectionHref,
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

type PushRecipientCandidate = {
  readonly accountStatus: string;
  readonly displayName: string;
  readonly maskedPhone: string;
  readonly role: 'CUSTOMER' | 'PROVIDER';
  readonly userId: string;
};

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
  const requestedTargetUserId = readSearchParam(params.targetUserId);
  const recipientSearch = readSearchParam(params.recipientSearch).trim();
  const locale = targetRole === 'PROVIDER' ? 'vi' : readSearchParam(params.locale);
  const title = readSearchParam(params.title);
  const body = readSearchParam(params.body);
  const campaignRange = normalizePushCampaignDateRange(readSearchParam(params.campaignRange));
  const campaignPage = normalizePushCampaignPage(readSearchParam(params.campaignPage));
  const campaignRangeLabel = pushCampaignDateRangeLabel(campaignRange);
  const canPreview = shouldRequestPushCampaignPreview(params);
  const recipientSearchRequested = recipientSearch.length >= 2;
  let recipientSearchOk = true;
  let recipientCandidates: PushRecipientCandidate[] = [];
  if (recipientSearchRequested) {
    if (targetRole === 'PROVIDER') {
      const result = await adminGetResult<AdminProvider[]>(
        buildPushRecipientSearchApiHref(targetRole, recipientSearch),
        [],
      );
      recipientSearchOk = result.ok;
      recipientCandidates = result.data.flatMap((partner) => {
        const userId = partner.user?.id ?? partner.userId;
        if (!userId) return [];
        return [{
          accountStatus: formatAccountStatus(partner.status),
          displayName: partner.displayName || partner.user?.fullName || `Partner ${shortId(partner.id)}`,
          maskedPhone: maskRecipientPhone(partner.user?.phone),
          role: 'PROVIDER' as const,
          userId,
        }];
      });
    } else {
      const result = await adminGetResult<AdminCustomerDirectoryRow[]>(
        buildPushRecipientSearchApiHref(targetRole, recipientSearch),
        [],
      );
      recipientSearchOk = result.ok;
      recipientCandidates = result.data.flatMap((customer) => {
        const userId = customer.user?.id;
        if (!userId) return [];
        return [{
          accountStatus: 'Customer account',
          displayName: customer.user?.fullName || maskRecipientPhone(customer.user?.phone) || `Customer ${shortId(customer.id)}`,
          maskedPhone: maskRecipientPhone(customer.user?.phone),
          role: 'CUSTOMER' as const,
          userId,
        }];
      });
    }
  }
  const selectedRecipient = recipientCandidates.find((candidate) => candidate.userId === requestedTargetUserId) ?? null;
  const targetUserId = selectedRecipient?.userId ?? '';
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
      contentClassName="stack notification-push-send-page"
      description="Manual notification delivery with account selection and a required recipient preview before sending."
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
        description="Find an account by name or phone when targeting one person. The internal account id remains hidden."
        statusLabel={preview ? `${preview.willSendCount} ready` : 'Preview required'}
        statusTone={preview ? (preview.willSendCount ? 'success' : 'warning') : 'info'}
        title="Create push campaign"
      >
        <div className="notification-push-recipient-selector">
          <AdminFormGrid className="notification-push-recipient-search" method="get">
            <input name="targetSegment" type="hidden" value={targetSegment} />
            <input name="appDestination" type="hidden" value={appDestination} />
            <input name="locale" type="hidden" value={locale} />
            <input name="title" type="hidden" value={title} />
            <input name="body" type="hidden" value={body} />
            <input name="campaignRange" type="hidden" value={campaignRange} />
            <AdminFormSelect
              defaultValue={targetRole}
              label="Account role"
              labelVisibility="visible"
              name="targetRole"
              options={TARGET_ROLE_OPTIONS}
            />
            <AdminFormInput
              defaultValue={recipientSearch}
              label="Find account by name or phone"
              labelVisibility="visible"
              minLength={2}
              name="recipientSearch"
              placeholder="Name or phone number"
              type="search"
            />
            <AdminFormControlButton>Search accounts</AdminFormControlButton>
          </AdminFormGrid>

          {!recipientSearchRequested ? (
            <p className="notification-push-recipient-state" role="status">
              Enter at least 2 characters to search. Leave the account unselected to use the audience filter.
            </p>
          ) : !recipientSearchOk ? (
            <AdminErrorState
              action={
                <AdminFormControlLink
                  href={buildPushRecipientSelectionHref(params, { recipientSearch, targetRole })}
                >
                  Retry account search
                </AdminFormControlLink>
              }
              message="Customer or Partner accounts could not be searched. No account was selected."
              title="Account search unavailable"
            />
          ) : recipientCandidates.length === 0 ? (
            <p className="notification-push-recipient-state" role="status">
              No {targetRole === 'PROVIDER' ? 'Partner' : 'customer'} accounts match “{recipientSearch}”.
            </p>
          ) : (
            <div aria-label="Account search results" className="notification-push-recipient-results" role="list">
              {recipientCandidates.map((candidate) => (
                <div className="notification-push-recipient-result" key={candidate.userId} role="listitem">
                  <div>
                    <strong>{candidate.displayName}</strong>
                    <span>{candidate.maskedPhone || 'Phone unavailable'}</span>
                    <small>{candidate.accountStatus}</small>
                  </div>
                  <AdminFormControlLink
                    aria-current={candidate.userId === targetUserId ? 'true' : undefined}
                    href={buildPushRecipientSelectionHref(params, {
                      recipientSearch,
                      targetRole,
                      targetUserId: candidate.userId,
                    })}
                  >
                    {candidate.userId === targetUserId ? 'Selected' : 'Select account'}
                  </AdminFormControlLink>
                </div>
              ))}
            </div>
          )}

          {selectedRecipient ? (
            <div className="notification-push-selected-recipient" role="status">
              <div>
                <span>Selected account</span>
                <strong>{selectedRecipient.displayName}</strong>
                <small>{selectedRecipient.maskedPhone || 'Phone unavailable'} · {selectedRecipient.accountStatus}</small>
              </div>
              <AdminFormControlLink
                href={buildPushRecipientSelectionHref(params, {
                  recipientSearch: '',
                  targetRole,
                  targetUserId: null,
                })}
              >
                Clear account
              </AdminFormControlLink>
            </div>
          ) : null}
        </div>

        <AdminFormGrid className="notification-push-preview-form" method="get">
          <input name="preview" type="hidden" value="1" />
          <input name="targetRole" type="hidden" value={targetRole} />
          <input name="recipientSearch" type="hidden" value={recipientSearch} />
          <input name="targetUserId" type="hidden" value={targetUserId} />
          <AdminFormStaticValue
            label="Target role"
            labelVisibility="visible"
            value={targetRole === 'PROVIDER' ? 'Partners' : 'Customers'}
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
          <AdminFormStaticValue
            label="Specific account"
            labelVisibility="visible"
            value={selectedRecipient?.displayName ?? 'All accounts matching the audience filter'}
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
            targetAccountLabel: selectedRecipient?.displayName,
          })}
          tone="info"
        />

        {preview ? (
          <AdminCard className="notification-push-preview-card">
            <div className="notification-push-preview-summary">
              <div>
                <span className="muted">Target role</span>
                <strong>{targetRole === 'PROVIDER' ? 'Partners' : 'Customers'}</strong>
              </div>
              <div>
                <span className="muted">Audience filter</span>
                <strong>{pushSegmentLabel(preview.targetSegment ?? targetSegment, targetRole)}</strong>
              </div>
              <div>
                <span className="muted">Specific account</span>
                <strong>{selectedRecipient?.displayName ?? 'Audience filter'}</strong>
              </div>
              <div>
                <span className="muted">Opens page</span>
                <strong>{pushDestinationLabel(preview.appDestination ?? appDestination, targetRole)}</strong>
              </div>
              <div>
                <span className="muted">Language</span>
                <strong>{pushLocaleLabel(locale, targetRole)}</strong>
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
                <span className="muted">Excluded by send limit</span>
                <strong>{Math.max(0, preview.recipientCount - preview.willSendCount)}</strong>
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
                  <span className="muted">{maskRecipientPhone(recipient.phone)}</span>
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
  targetAccountLabel,
  targetRole,
  targetSegment,
}: {
  readonly appDestination: string;
  readonly campaignRangeLabel: string;
  readonly locale: string;
  readonly targetAccountLabel?: string;
  readonly targetRole: string;
  readonly targetSegment: string;
}) {
  const labels = [
    `Target: ${targetRole === 'PROVIDER' ? 'Partners' : 'Customers'}`,
    `Audience: ${pushSegmentLabel(targetSegment, targetRole)}`,
    `Open page: ${pushDestinationLabel(appDestination, targetRole)}`,
    `Language: ${pushLocaleLabel(locale, targetRole)}`,
    `Campaign rows: ${campaignRangeLabel}`,
  ];

  if (targetAccountLabel) {
    labels.push(`Specific account: ${targetAccountLabel}`);
  }

  return labels;
}

function maskRecipientPhone(value?: string | null) {
  if (!value) return '';
  const compact = value.replace(/\s+/g, '');
  if (compact.length <= 6) return `${compact.slice(0, 2)}**${compact.slice(-2)}`;
  return `${compact.slice(0, 3)}${'*'.repeat(Math.min(6, compact.length - 6))}${compact.slice(-3)}`;
}

function formatAccountStatus(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
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
