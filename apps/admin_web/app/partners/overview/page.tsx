import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Ban,
  ChevronRight,
  ClipboardCheck,
  Clock,
  MapPinned,
  RadioTower,
  Star,
  UserCheck,
  Users,
  UserX,
  WalletCards,
} from 'lucide-react';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
} from '../../../components/admin-form-controls';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../../components/admin-filter-summary';
import {
  AdminMiniMetricStrip,
  AdminOverviewCommandCard,
  AdminOverviewCommandGrid,
  AdminOverviewGrid,
} from '../../../components/admin-overview-card';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminSegmentedControl } from '../../../components/admin-segmented-control';
import {
  AdminCard,
  AdminDisclosure,
  AdminErrorState,
  AdminKpiCard,
  AdminSection,
} from '../../../components/admin-surface';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge, StatusBadgeFromPillClass } from '../../../components/status-badge';
import { formatWholeNumber as formatNumber } from '../../../lib/admin-format';
import {
  AdminPartnerOverview,
  AdminPartnerOverviewAppActivityRow,
  AdminPartnerOverviewAreaRow,
  AdminPartnerOverviewAvailableBlockedReason,
  AdminPartnerOverviewCustomerDiscoveryBlocker,
  AdminPartnerOverviewFunnelStep,
  AdminPartnerOverviewKpi,
  AdminPartnerOverviewNegativeWalletPartner,
  AdminPartnerOverviewOperatingStatusCard,
  AdminPartnerOverviewRiskPartner,
  AdminPartnerOverviewSelectionIssueCount,
  AdminPartnerOverviewSelectionFrictionRow,
  AdminPartnerOverviewServiceRow,
  adminGet,
} from '../../../lib/admin-api';
import {
  normalizePartnerOverviewRange,
  partnerOverviewActiveFilters,
  partnerOverviewDirectoryLink,
  partnerOverviewFreshness,
  partnerOverviewHref,
  partnerOverviewRangeOptions,
  partnerOverviewWithDefaults,
} from './partner-overview-model';
import { partnerProviderStatusFilterLabel } from '../partner-filters';

export const dynamic = 'force-dynamic';

type PartnerOverviewPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PartnerOverviewPage({
  searchParams,
}: {
  searchParams?: PartnerOverviewPageSearchParams;
}) {
  const params = await searchParams;
  const range = normalizePartnerOverviewRange(firstParam(params?.range));
  const filters = {
    city: firstParam(params?.city) ?? null,
    onlineStatus: firstParam(params?.onlineStatus) ?? null,
    riskStatus: firstParam(params?.riskStatus) ?? null,
    walletStatus: firstParam(params?.walletStatus) ?? null,
    selectionIssue: firstParam(params?.selectionIssue) ?? null,
    selectionSort: firstParam(params?.selectionSort) ?? null,
    serviceId: firstParam(params?.serviceId) ?? null,
    verificationStatus: firstParam(params?.verificationStatus) ?? null,
  };
  const apiParams = new URLSearchParams({
    range,
    includeActionRows: 'false',
    previewLimit: '5',
  });
  for (const [key, value] of Object.entries(filters)) {
    if (value) apiParams.set(key, value);
  }
  const rawOverview = await adminGet<AdminPartnerOverview | null>(
    `/admin/partners/overview?${apiParams.toString()}`,
    null,
  );
  const overview = rawOverview ? partnerOverviewWithDefaults(rawOverview, range) : null;
  const serviceOptions = partnerOverviewServiceOptions(overview, filters.serviceId);
  const activeFilters = partnerOverviewActiveFilters(range, filters).map((filter) =>
    filter.key === 'serviceId'
      ? {
          ...filter,
          value: serviceOptions.find((option) => option.value === filter.value)?.label ?? filter.value,
        }
      : filter,
  );
  const freshness = overview
    ? partnerOverviewFreshness(overview.generatedAt, overview.refreshSeconds)
    : null;

  return (
    <AdminPageTemplate
      contentClassName="partner-overview-page"
      description="Current Partner supply, action queues, period performance, and operational risk in Vietnam time."
      title="Partner Operations"
    >
      <AdminFilterPanel
        actions={
          <>
            <StatusBadge tone="success">Vietnam time</StatusBadge>
            {overview ? (
              <StatusBadge tone={freshness?.stale ? 'warning' : 'info'}>
                {freshness?.stale ? 'Data stale' : 'Current operations'} · as of{' '}
                <DateTimeText value={overview.generatedAt} />
              </StatusBadge>
            ) : (
              <StatusBadge tone="danger">Source unavailable</StatusBadge>
            )}
            {overview?.queryScope.walletBalanceScopeTruncated ? (
              <StatusBadge tone="warning">
                Risk analysis: latest {overview.queryScope.providerScanLimit}
              </StatusBadge>
            ) : null}
            <AdminFormControlLink href={partnerOverviewHref(range, filters)}>Refresh now</AdminFormControlLink>
          </>
        }
        className="partner-overview-filter-panel"
        description="Filters apply to current operations and the selected performance period."
        resultLabel={overview?.rangeLabel ?? 'Unavailable'}
        title="Partner filters"
      >
        <AdminFormGrid action="/partners/overview" className="partner-overview-filter-grid">
          <input type="hidden" name="range" value={range} />
          {filters.selectionIssue ? (
            <input type="hidden" name="selectionIssue" value={filters.selectionIssue} />
          ) : null}
          {filters.selectionSort ? (
            <input type="hidden" name="selectionSort" value={filters.selectionSort} />
          ) : null}
          <AdminFormInput
            defaultValue={filters.city ?? ''}
            label="City / area"
            labelVisibility="visible"
            name="city"
            placeholder="hcm, hanoi, cau giay"
          />
          <AdminFormSelect
            defaultValue={filters.serviceId ?? ''}
            label="Service"
            labelVisibility="visible"
            name="serviceId"
            options={serviceOptions}
          />
          <AdminFormSelect
            defaultValue={filters.verificationStatus ?? ''}
            label="Verification"
            labelVisibility="visible"
            name="verificationStatus"
            options={verificationStatusOptions}
          />
          <AdminFormSelect
            defaultValue={filters.onlineStatus ?? ''}
            label="Online status"
            labelVisibility="visible"
            name="onlineStatus"
            options={onlineStatusOptions}
          />
          <AdminFormSelect
            defaultValue={filters.walletStatus ?? ''}
            label="Wallet"
            labelVisibility="visible"
            name="walletStatus"
            options={walletStatusOptions}
          />
          <AdminFormSelect
            defaultValue={filters.riskStatus ?? ''}
            label="Risk"
            labelVisibility="visible"
            name="riskStatus"
            options={riskStatusOptions}
          />
          <AdminFormControlButton className="button-primary" type="submit">
            Apply filters
          </AdminFormControlButton>
        </AdminFormGrid>
        {activeFilters.length > 0 ? (
          <AdminFilterSummary
            ariaLabel="Active partner overview filters"
            className="partner-overview-active-filters"
            labels={[]}
          >
            <span>Active filters</span>
            {activeFilters.map((filter) => (
              <a
                aria-label={`Remove ${filter.label} filter ${filter.value}`}
                key={filter.key}
                href={filter.removeHref}
              >
                <strong>{filter.label}</strong>
                {filter.value}
                <span aria-hidden="true">×</span>
              </a>
            ))}
            <a className="is-reset" href={partnerOverviewHref(range)}>
              Clear all
            </a>
          </AdminFilterSummary>
        ) : null}
      </AdminFilterPanel>

      {!overview ? (
        <AdminErrorState
          action={<AdminTextLink href={partnerOverviewHref(range, filters)}>Retry Partner Overview</AdminTextLink>}
          message="The Partner Overview API did not return a report. No zero values are shown until the source becomes available."
          title="Partner data unavailable"
        />
      ) : (
        <>
          <PartnerPriorityBoard filters={filters} overview={overview} range={range} />

          <OperatingStatusBoard
            availableBlockedReasons={overview.operatingStatus.availableBlockedReasons}
            cards={overview.operatingStatus.cards}
            customerDiscovery={overview.operatingStatus.customerDiscovery}
            filters={filters}
            locationFreshnessMinutes={overview.operatingStatus.locationFreshnessMinutes}
            range={range}
          />

          <PartnerPeriodPerformance filters={filters} overview={overview} range={range} />

          <div className="partner-overview-supply-grid" aria-label="Supply status">
            <SupplyAreaCard rows={overview.supplyHealth.areas.slice(0, 5)} rangeLabel={overview.rangeLabel} />
            <SupplyServiceCard rows={overview.supplyHealth.services.slice(0, 5)} rangeLabel={overview.rangeLabel} />
          </div>

          <AdminSection
            bodyClassName="partner-overview-funnel-steps"
            className="partner-overview-section-card"
            description="Current registered accounts, approved Partners, and Partners able to accept a booking now."
            status={
              <StatusBadge tone="info">
                Current · as of <DateTimeText value={overview.generatedAt} />
              </StatusBadge>
            }
            title="Current readiness snapshot"
          >
            {overview.funnel.steps.map((step, index) => (
              <PartnerFunnelStep
                baseCount={overview.funnel.steps[0]?.count ?? null}
                key={step.key}
                previousCount={index > 0 ? (overview.funnel.steps[index - 1]?.count ?? null) : null}
                step={step}
              />
            ))}
          </AdminSection>

          {overview.appActivity.kpis.length > 0 ? (
            <PartnerAppActivitySection
              inactivePartners={overview.appActivity.inactivePartners}
              kpis={overview.appActivity.kpis}
              mostActive={overview.appActivity.mostActive}
              rangeLabel={overview.rangeLabel}
            />
          ) : null}

          <div className="partner-overview-quality-grid" aria-label="Partner quality and finance">
            <QualityRiskCard
              kpis={overview.bookingQuality.kpis}
              riskPartnerCount={overview.bookingQuality.riskPartnerCount}
              rows={overview.bookingQuality.riskPartners}
            />
            <WalletRiskCard
              kpis={overview.financeWalletRisk.kpis}
              policyNote={overview.financeWalletRisk.policyNote}
              rows={overview.financeWalletRisk.negativeWalletPartners}
            />
          </div>

          <SelectionFrictionCard
            filters={filters}
            issueCounts={overview.selectionFriction.issueCounts}
            range={range}
            rows={overview.selectionFriction.rows}
          />

          <DetailedActionQueues filters={filters} lists={overview.actionLists} range={range} />
        </>
      )}
    </AdminPageTemplate>
  );
}

const summaryIcons = [
  Users,
  BadgeCheck,
  ClipboardCheck,
  RadioTower,
  MapPinned,
  UserCheck,
  Activity,
  AlertTriangle,
];
const partnerOperatingStatusIcons: Record<string, typeof Users> = {
  'available-blocked': AlertTriangle,
  'available-soon': Clock,
  busy: Activity,
  'busy-now': Activity,
  'inactive-7d': UserX,
  offline: Ban,
  'ready-now': UserCheck,
};

const verificationStatusOptions = [
  { label: 'All', value: '' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Draft', value: 'DRAFT' },
];

const onlineStatusOptions = [
  { label: 'All', value: '' },
  { label: 'Online', value: 'online' },
  { label: 'Available', value: 'available' },
  { label: 'Busy', value: 'busy' },
  { label: 'Offline', value: 'offline' },
];

const walletStatusOptions = [
  { label: 'All', value: '' },
  { label: 'Negative', value: 'negative' },
  { label: 'Positive', value: 'positive' },
  { label: 'Zero', value: 'zero' },
];

const riskStatusOptions = [
  { label: 'All', value: '' },
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
];

const selectionIssueOptions = [
  { label: 'All', value: '' },
  { label: 'Availability', value: 'availability' },
  { label: 'Profile', value: 'profile' },
  { label: 'Price', value: 'price' },
  { label: 'Response', value: 'response' },
  { label: 'Service', value: 'service' },
];

const selectionSortOptions = [
  { label: 'Profile views', value: 'views' },
  { label: 'Favorites', value: 'favorites' },
  { label: 'Response time', value: 'response' },
  { label: 'Highest price', value: 'price' },
  { label: 'Availability risk', value: 'availability' },
];

function partnerOverviewServiceOptions(
  overview: AdminPartnerOverview | null,
  selectedServiceId: string | null,
) {
  const options = (overview?.filterOptions.services ?? []).map((service) => ({
    label: `${service.name} · ${service.durationMin} min`,
    value: service.id,
  }));

  if (selectedServiceId && !options.some((option) => option.value === selectedServiceId)) {
    options.unshift({ label: 'Unavailable service', value: selectedServiceId });
  }

  return [{ label: 'All services', value: '' }, ...options];
}

function PartnerKpiCard({
  icon: Icon,
  kpi,
  rangeLabel,
}: {
  readonly icon: typeof Users;
  readonly kpi: AdminPartnerOverviewKpi;
  readonly rangeLabel: string;
}) {
  const tone = kpi.value === null ? 'neutral' : kpi.value > 0 ? 'primary' : 'neutral';
  const meta = partnerOverviewKpiMeta(kpi, rangeLabel);
  const comparisonLabel =
    kpi.deltaPercent === null
      ? kpi.detail
      : `${kpi.detail} · ${kpi.deltaPercent >= 0 ? '+' : ''}${kpi.deltaPercent}% vs previous`;

  return (
    <AdminKpiCard
      className={`partner-overview-kpi-card is-${tone}`}
      helper={comparisonLabel}
      icon={Icon}
      kind={meta.kind}
      label={kpi.label}
      scope={meta.scope}
      value={formatKpiValue(kpi)}
    />
  );
}

function PartnerPeriodPerformance({
  filters,
  overview,
  range,
}: {
  readonly filters: AdminPartnerOverview['filters'];
  readonly overview: AdminPartnerOverview;
  readonly range: AdminPartnerOverview['range'];
}) {
  const preferredKeys = [
    'averageResponseTime',
    'averageRating',
    'completionRate',
    'nonCompletedBookingRate',
  ];
  const availableKpis = [...overview.summaryKpis, ...overview.bookingQuality.kpis];
  const kpis = preferredKeys
    .map((key) => availableKpis.find((kpi) => kpi.key === key))
    .filter((kpi): kpi is AdminPartnerOverviewKpi => Boolean(kpi));

  if (kpis.length === 0) return null;

  return (
    <AdminSection
      actions={
        <AdminSegmentedControl
          activeValue={range}
          ariaLabel="Partner performance range"
          className="partner-overview-range-buttons"
          options={partnerOverviewRangeOptions.map((option) => ({
            href: partnerOverviewHref(option.value, filters),
            label: option.label,
            value: option.value,
          }))}
        />
      }
      bodyClassName="partner-overview-performance-body"
      className="partner-overview-section-card"
      description="Booking outcomes recorded in the selected Vietnam-time period."
      statusLabel={overview.rangeLabel}
      title="Performance · selected period"
    >
      <AdminOverviewCommandGrid ariaLabel="Partner period performance">
        {kpis.map((kpi, index) => (
          <PartnerKpiCard
            key={kpi.key}
            icon={summaryIcons[index % summaryIcons.length]}
            kpi={kpi}
            rangeLabel={overview.rangeLabel}
          />
        ))}
      </AdminOverviewCommandGrid>
    </AdminSection>
  );
}

function partnerOverviewKpiMeta(kpi: AdminPartnerOverviewKpi, rangeLabel: string) {
  const normalized = `${kpi.key} ${kpi.label}`.toLowerCase();

  if (normalized.includes('ready') || normalized.includes('eligible') || normalized.includes('online')) {
    return { kind: 'live', scope: 'Live' } as const;
  }

  if (
    normalized.includes('risk') ||
    normalized.includes('inactive') ||
    normalized.includes('wallet') ||
    normalized.includes('quality')
  ) {
    return { kind: 'risk', scope: rangeLabel } as const;
  }

  if (
    normalized.includes('approval') ||
    normalized.includes('verification') ||
    normalized.includes('pending')
  ) {
    return { kind: 'action', scope: 'Pending' } as const;
  }

  return { kind: 'period', scope: rangeLabel } as const;
}

function OperatingStatusBoard({
  availableBlockedReasons,
  cards,
  customerDiscovery,
  filters,
  locationFreshnessMinutes,
  range,
}: {
  readonly availableBlockedReasons: readonly AdminPartnerOverviewAvailableBlockedReason[];
  readonly cards: readonly AdminPartnerOverviewOperatingStatusCard[];
  readonly customerDiscovery: {
    readonly visibleNow: number;
    readonly visibleHref: string;
    readonly blockers: readonly AdminPartnerOverviewCustomerDiscoveryBlocker[];
  };
  readonly filters: AdminPartnerOverview['filters'];
  readonly locationFreshnessMinutes: number;
  readonly range: AdminPartnerOverview['range'];
}) {
  const customerDiscoveryLink = partnerOverviewDirectoryLink(customerDiscovery.visibleHref, range, filters);

  return (
    <AdminSection
      bodyClassName="partner-overview-operating-grid"
      className="partner-overview-section-card partner-overview-operating-board"
      description="Current online, bookable, blocked, and customer-visible Partner supply."
      statusLabel={`Location <= ${locationFreshnessMinutes}m`}
      title="Current supply"
    >
      {cards.length > 0 ? (
        cards.map((card) => {
          const Icon = partnerOperatingStatusIcons[card.key] ?? RadioTower;
          const meta = partnerOperatingStatusMeta(card);
          const directoryLink = partnerOverviewDirectoryLink(card.href, range, filters);

          return (
            <AdminOverviewCommandCard
              ariaLabel={`${card.label}, ${formatNumber(card.count)} Partners. ${directoryLink.exact ? 'Open exact filtered Partners list' : 'Open full queue; bounded Risk filter is not applied'}`}
              baseClassName="partner-overview-command-card partner-overview-operating-card"
              className={`is-${card.tone}`}
              detail={card.detail}
              href={directoryLink.href}
              icon={<Icon size={18} aria-hidden="true" />}
              iconClassName="partner-overview-command-icon"
              key={card.key}
              kind={meta.kind}
              label={card.label}
              scope={meta.scope}
              value={formatNumber(card.count)}
            >
              <em>
                {directoryLink.exact ? 'Open exact list' : 'Open full queue'}
                <ChevronRight size={14} aria-hidden="true" />
              </em>
            </AdminOverviewCommandCard>
          );
        })
      ) : (
        <AdminEmptyState framed message="No operating status data is available yet." title={null} />
      )}
      <div
        className="partner-overview-blocker-strip partner-overview-discovery-strip"
        aria-label="Customer App Partner visibility"
      >
        <AdminTextLink
          className="partner-overview-blocker-heading partner-overview-discovery-heading"
          href={customerDiscoveryLink.href}
        >
          <span>
            <strong>Visible in customer app: {formatNumber(customerDiscovery.visibleNow)}</strong>
            <small>Approved public profiles with active services · blocker counts can overlap</small>
          </span>
          <ChevronRight size={14} aria-hidden="true" />
        </AdminTextLink>
        {customerDiscovery.blockers.map((blocker) => {
          const directoryLink = partnerOverviewDirectoryLink(blocker.href, range, filters);
          return (
            <AdminTextLink
              className={`partner-overview-blocker-link is-${blocker.tone}`}
              href={directoryLink.href}
              key={blocker.key}
            >
              <span>
                <strong>{blocker.label}</strong>
                <small>{blocker.detail}</small>
              </span>
              <b>{formatNumber(blocker.count)}</b>
              <ChevronRight size={14} aria-hidden="true" />
            </AdminTextLink>
          );
        })}
      </div>
      {availableBlockedReasons.length > 0 ? (
        <div className="partner-overview-blocker-strip" aria-label="Available Partner blocking signals">
          <div className="partner-overview-blocker-heading">
            <strong>Blocking signals</strong>
            <small>Signals can overlap</small>
          </div>
          {availableBlockedReasons.map((reason) => {
            const directoryLink = partnerOverviewDirectoryLink(reason.href, range, filters);
            return (
              <AdminTextLink
                className={`partner-overview-blocker-link is-${reason.tone}`}
                href={directoryLink.href}
                key={reason.key}
              >
                <span>
                  <strong>{reason.label}</strong>
                  <small>{reason.detail}</small>
                </span>
                <b>{formatNumber(reason.count)}</b>
                <ChevronRight size={14} aria-hidden="true" />
              </AdminTextLink>
            );
          })}
        </div>
      ) : null}
    </AdminSection>
  );
}

type PartnerPriorityCardConfig = {
  readonly action: string;
  readonly detail: string;
  readonly href: string;
  readonly icon: typeof Users;
  readonly key: string;
  readonly label: string;
  readonly tone: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral';
  readonly value: string;
  readonly exact: boolean;
};

function PartnerPriorityBoard({
  filters,
  overview,
  range,
}: {
  readonly filters: AdminPartnerOverview['filters'];
  readonly overview: AdminPartnerOverview;
  readonly range: AdminPartnerOverview['range'];
}) {
  const availableBlockedCard = overview.operatingStatus.cards.find(
    (card) => card.key === 'available-blocked',
  );
  const pendingVerificationList = overview.actionLists.find(
    (list) => list.key === 'pending-verification',
  );
  const walletRiskList = overview.actionLists.find((list) => list.key === 'negative-wallet');
  const availableBlockedLink = partnerOverviewDirectoryLink(
    availableBlockedCard?.href ?? '/partners?review=available-blocked',
    range,
    filters,
  );
  const pendingVerificationLink = partnerOverviewDirectoryLink(
    pendingVerificationList?.viewAllHref ?? '/partners?review=approval-incomplete',
    range,
    filters,
  );
  const walletLink = partnerOverviewDirectoryLink(
    walletRiskList?.viewAllHref ?? '/partners?review=unsettled',
    range,
    filters,
  );
  const qualityRiskCount = overview.bookingQuality.riskPartnerCount;
  const qualityLink = partnerOverviewDirectoryLink('/partners?review=quality-all', range, filters);
  const cards = ([
    {
      action: 'Review blockers',
      detail: availableBlockedCard?.detail ?? 'Online available Partners blocked at final acceptance.',
      href: availableBlockedLink.href,
      icon: AlertTriangle,
      key: 'available-blocked',
      label: 'Online but not bookable',
      tone: 'warning',
      value: formatPriorityCount(availableBlockedCard?.count ?? 0, 'partner'),
      exact: availableBlockedLink.exact,
    },
    {
      action: 'Review verification',
      detail: 'Partner verification or KYC evidence still needs an operator decision.',
      href: pendingVerificationLink.href,
      icon: BadgeCheck,
      key: 'pending-verification',
      label: 'Pending verification',
      tone: 'warning',
      value: formatPriorityCount(pendingVerificationList?.totalCount ?? 0, 'partner'),
      exact: pendingVerificationLink.exact,
    },
    {
      action: 'Review wallet',
      detail:
        overview.financeWalletRisk.policyNote || 'Negative Partner wallet exposure from canonical VND balances.',
      href: walletLink.href,
      icon: WalletCards,
      key: 'wallet-risk',
      label: 'Wallet risk',
      tone: 'danger',
      value: formatPriorityCount(walletRiskList?.totalCount ?? 0, 'partner'),
      exact: walletLink.exact,
    },
    {
      action: 'Review quality',
      detail: 'Non-completed bookings, no-show, low-review, and service-quality follow-up queue.',
      href: qualityLink.href,
      icon: Star,
      key: 'quality-risk',
      label: 'Quality risk',
      tone: 'danger',
      value: formatPriorityCount(qualityRiskCount, 'partner'),
      exact: qualityLink.exact,
    },
  ] satisfies readonly PartnerPriorityCardConfig[]).filter((card) => {
    if (card.key === 'available-blocked') return (availableBlockedCard?.count ?? 0) > 0;
    if (card.key === 'pending-verification') return (pendingVerificationList?.totalCount ?? 0) > 0;
    if (card.key === 'wallet-risk') return (walletRiskList?.totalCount ?? 0) > 0;
    return qualityRiskCount > 0;
  });

  return (
    <AdminSection
      bodyClassName="partner-overview-priority-grid"
      className="partner-overview-section-card partner-overview-priority-board"
      description="Only queues with current work are shown."
      statusLabel={cards.length > 0 ? `${formatPriorityCount(cards.length, 'active queue')}` : 'No action'}
      title="Action required"
    >
      {cards.length > 0 ? cards.map((card) => {
        const Icon = card.icon;
        const meta = partnerPriorityCardMeta(card);

        return (
          <AdminOverviewCommandCard
            ariaLabel={`${card.label}, ${card.value}. ${card.exact ? card.action : 'Open full queue; bounded Risk filter is not applied'}`}
            baseClassName="partner-overview-command-card"
            className={`partner-overview-priority-card is-${card.tone}`}
            detail={card.detail}
            href={card.href}
            icon={<Icon size={20} aria-hidden="true" />}
            iconClassName="partner-overview-command-icon"
            key={card.key}
            kind={meta.kind}
            label={card.label}
            scope={meta.scope}
            value={card.value}
          >
            <em>
              {card.exact ? card.action : 'Open full queue'}
              <ChevronRight size={14} aria-hidden="true" />
            </em>
          </AdminOverviewCommandCard>
        );
      }) : <AdminEmptyState framed message="No Partner action queues require follow-up." title={null} />}
    </AdminSection>
  );
}

function SupplyAreaCard({
  rangeLabel,
  rows,
}: {
  readonly rangeLabel: string;
  readonly rows: readonly AdminPartnerOverviewAreaRow[];
}) {
  return (
    <AdminSection
      className="partner-overview-table-card"
      description={`Current supply with demand outcomes for ${rangeLabel}.`}
      title="Area supply status"
    >
      <AdminTableScroll ariaLabel="Area supply table" className="partner-overview-table-wrap">
        <AdminDataTable
          className="partner-overview-table partner-overview-area-table"
          emptyMessage="No area supply rows for this range."
          headers={[
            'Area',
            'Status',
            'Partners',
            'Online available',
            'Fresh location',
            'Bookable now',
            'Open demand',
            'Non-completed',
            'Non-completed share',
            'Response',
          ]}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.areaCode}>
              <td>{row.area}</td>
              <td>
                <StatusBadgeFromPillClass pillClass={riskPillClass(row.riskLevel)}>
                  {row.status}
                </StatusBadgeFromPillClass>
              </td>
              <td>{formatNumber(row.totalPartners)}</td>
              <td>{formatNumber(row.onlinePartners)}</td>
              <td>{formatNumber(row.locationFreshPartners)}</td>
              <td>{formatNumber(row.eligiblePartners)}</td>
              <td>{formatNumber(row.openRequests)}</td>
              <td>{formatNumber(row.nonCompletedOutcomes)}</td>
              <td>{row.nonCompletedShare === null ? 'No outcomes' : `${row.nonCompletedShare}%`}</td>
              <td>
                <StatusBadge tone="info">{formatDurationSeconds(row.averageResponseSeconds)}</StatusBadge>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminSection>
  );
}

function SupplyServiceCard({
  rangeLabel,
  rows,
}: {
  readonly rangeLabel: string;
  readonly rows: readonly AdminPartnerOverviewServiceRow[];
}) {
  return (
    <AdminSection
      className="partner-overview-table-card"
      description={`Current service supply with booking outcomes for ${rangeLabel}.`}
      title="Service supply status"
    >
      <AdminTableScroll ariaLabel="Service supply table" className="partner-overview-table-wrap">
        <AdminDataTable
          className="partner-overview-table partner-overview-service-table"
          emptyMessage="No service supply rows for this range."
          headers={[
            'Service',
            'Offering',
            'Online available',
            'Bookable now',
            'Open demand',
            'Completed',
            'Completed share',
            'Lifetime Partner rating',
            'Status',
          ]}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.serviceId}>
              <td>{row.serviceName}</td>
              <td>{formatNumber(row.partnersOffering)}</td>
              <td>{formatNumber(row.onlinePartners)}</td>
              <td>{formatNumber(row.eligiblePartners)}</td>
              <td>{formatNumber(row.openRequests)}</td>
              <td>{formatNumber(row.completedBookings)}</td>
              <td>{row.completionRate === null ? 'No events' : `${row.completionRate}%`}</td>
              <td>{row.avgRating === null ? '-' : row.avgRating.toFixed(2)}</td>
              <td>
                <StatusBadgeFromPillClass pillClass={riskPillClass(row.riskLevel)}>
                  {row.status}
                </StatusBadgeFromPillClass>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminSection>
  );
}

function PartnerFunnelStep({
  baseCount,
  previousCount,
  step,
}: {
  readonly baseCount: number | null;
  readonly previousCount: number | null;
  readonly step: AdminPartnerOverviewFunnelStep;
}) {
  const shareOfRegistered =
    step.count !== null && baseCount !== null && baseCount > 0
      ? Math.round((step.count / baseCount) * 100)
      : null;
  const shareOfPrevious =
    step.count !== null && previousCount !== null && previousCount > 0
      ? Math.round((step.count / previousCount) * 100)
      : null;

  return (
    <AdminCard
      className={`partner-overview-funnel-step ${step.dataStatus === 'available' ? 'is-primary' : 'is-neutral'}`}
    >
      <div className="partner-overview-funnel-step-header">
        <span>{step.label}</span>
        <strong>{step.count === null ? 'No events in this period' : formatNumber(step.count)}</strong>
      </div>
      <small>
        {step.dataStatus === 'available'
          ? previousCount === null
            ? 'Current registered Partner accounts'
            : `${shareOfPrevious ?? 0}% of previous stage · ${shareOfRegistered ?? 0}% of registered`
          : 'Current snapshot unavailable'}
      </small>
    </AdminCard>
  );
}

function QualityRiskCard({
  kpis,
  riskPartnerCount,
  rows,
}: {
  readonly kpis: readonly AdminPartnerOverviewKpi[];
  readonly riskPartnerCount: number;
  readonly rows: readonly AdminPartnerOverviewRiskPartner[];
}) {
  if (riskPartnerCount === 0) {
    return (
      <AdminSection
        className="partner-overview-table-card partner-overview-compact-empty"
        description="No non-completed, no-show, or low-review Partner signal is open in this scope."
        statusLabel="No current quality risk"
        statusTone="success"
        title="Booking quality risk"
      />
    );
  }

  return (
    <AdminSection
      bodyClassName="partner-overview-risk-card-body"
      className="partner-overview-table-card"
      description="Non-completed bookings, no-show reports, and low-review signals only."
      statusLabel={`Showing ${formatNumber(rows.length)} of ${formatNumber(riskPartnerCount)}`}
      title="Booking quality risk"
    >
      <MiniKpiStrip ariaLabel="Booking quality metrics" kpis={kpis} />
      <PartnerRiskTable rows={rows} />
    </AdminSection>
  );
}

function WalletRiskCard({
  kpis,
  policyNote,
  rows,
}: {
  readonly kpis: readonly AdminPartnerOverviewKpi[];
  readonly policyNote: string;
  readonly rows: readonly AdminPartnerOverviewNegativeWalletPartner[];
}) {
  const periodKeys = new Set(['grossBookingAmount', 'platformFee', 'partnerPayoutCompleted']);
  const periodKpis = kpis.filter((kpi) => periodKeys.has(kpi.key));
  const currentKpis = kpis.filter((kpi) => !periodKeys.has(kpi.key));
  const negativeWalletPartnerCount =
    currentKpis.find((kpi) => kpi.key === 'partnersWithNegativeWallet')?.value ?? rows.length;

  return (
    <AdminSection
      actions={
        negativeWalletPartnerCount > 0 ? (
          <AdminTextLink href="/partners?review=unsettled">View all negative wallets</AdminTextLink>
        ) : null
      }
      bodyClassName="partner-overview-risk-card-body"
      className="partner-overview-table-card"
      description={policyNote || 'Ledger-backed Partner wallet exposure.'}
      statusLabel={
        negativeWalletPartnerCount > 0
          ? `Showing ${formatNumber(rows.length)} of ${formatNumber(negativeWalletPartnerCount)}`
          : 'No negative wallets'
      }
      statusTone={negativeWalletPartnerCount > 0 ? 'warning' : 'success'}
      title="Finance and wallet risk"
    >
      <div className="partner-overview-finance-metric-group">
        <strong>Period activity</strong>
        <MiniKpiStrip ariaLabel="Period finance metrics" kpis={periodKpis} />
      </div>
      <div className="partner-overview-finance-metric-group">
        <strong>Current exposure and payout readiness</strong>
        <MiniKpiStrip ariaLabel="Current wallet and payout metrics" kpis={currentKpis} />
      </div>
      <PartnerRiskTable rows={rows} showWallet />
    </AdminSection>
  );
}

function MiniKpiStrip({
  ariaLabel,
  kpis,
}: {
  readonly ariaLabel?: string;
  readonly kpis: readonly AdminPartnerOverviewKpi[];
}) {
  return (
    <AdminMiniMetricStrip
      ariaLabel={ariaLabel}
      className="partner-overview-mini-kpis"
      metrics={kpis.map((kpi) => ({
        key: kpi.key,
        label: kpi.label,
        value: formatKpiValue(kpi),
      }))}
    />
  );
}

function PartnerAppActivitySection({
  inactivePartners,
  kpis,
  mostActive,
  rangeLabel,
}: {
  readonly inactivePartners: readonly AdminPartnerOverviewAppActivityRow[];
  readonly kpis: readonly AdminPartnerOverviewKpi[];
  readonly mostActive: readonly AdminPartnerOverviewAppActivityRow[];
  readonly rangeLabel: string;
}) {
  const periodKeys = new Set(['appActivePartners', 'partnerAppOpens', 'partnerSessionStarts']);
  const periodKpis = kpis.filter((kpi) => periodKeys.has(kpi.key));
  const coverageKpis = kpis.filter((kpi) => !periodKeys.has(kpi.key));

  return (
    <>
      <AdminSection
        bodyClassName="partner-overview-risk-card-body"
        className="partner-overview-section-card"
        description="Actual Partner App opens and authenticated session starts in the selected period."
        statusLabel={rangeLabel}
        title="Partner app usage · period"
      >
        <MiniKpiStrip ariaLabel="Partner app usage metrics" kpis={periodKpis} />
      </AdminSection>
      <AdminSection
        actions={
          <>
            <AdminFormControlLink href="/partners?activity=app-inactive-7d">
              App telemetry inactive 7D+
            </AdminFormControlLink>
            <AdminFormControlLink href="/partners?activity=app-not-tracked">
              No app telemetry recorded
            </AdminFormControlLink>
          </>
        }
        bodyClassName="partner-overview-risk-card-body"
        className="partner-overview-section-card"
        description="Current approved Partner telemetry coverage and inactive or untracked accounts."
        statusLabel="Current"
        title="App telemetry coverage"
      >
        <MiniKpiStrip ariaLabel="Current Partner app telemetry coverage" kpis={coverageKpis} />
      </AdminSection>
      <AdminOverviewGrid
        ariaLabel="Partner app activity lists"
        className="partner-overview-quality-grid partner-overview-app-activity-grid"
        variant="insight"
      >
        <PartnerAppActivityTable
          emptyMessage="No Partner app activity was recorded in this range."
          rows={mostActive}
          title="Most active"
        />
        <PartnerAppActivityTable
          emptyMessage="No approved Partners are inactive or awaiting activity tracking."
          rows={inactivePartners}
          title="App telemetry inactive 7D+ / untracked"
        />
      </AdminOverviewGrid>
    </>
  );
}

function PartnerAppActivityTable({
  emptyMessage,
  rows,
  title,
}: {
  readonly emptyMessage: string;
  readonly rows: readonly AdminPartnerOverviewAppActivityRow[];
  readonly title: string;
}) {
  return (
    <AdminSection className="partner-overview-table-card" title={title}>
      <AdminTableScroll ariaLabel={`${title} Partner app telemetry table`} className="partner-overview-table-wrap">
        <AdminDataTable
          className="partner-overview-table"
          emptyMessage={emptyMessage}
          headers={['Partner', 'Last active', 'Usage', 'Status']}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.partnerId}>
              <td>
                <AdminTextLink href={row.href}>{row.partnerName}</AdminTextLink>
                <small>
                  {row.area} · {formatPartnerStatus(row.status)}
                </small>
              </td>
              <td>
                {row.lastActiveAt ? <DateTimeText value={row.lastActiveAt} /> : 'No app telemetry recorded'}
                {row.inactivityDays !== null ? (
                  <small>{formatNumber(row.inactivityDays)} day(s) ago</small>
                ) : null}
              </td>
              <td>
                {formatNumber(row.appOpenCount)} opens
                <small>{formatNumber(row.sessionStartCount)} sessions</small>
              </td>
              <td>
                <StatusBadge tone={partnerAppActivityTone(row.activityStatus)}>
                  {partnerAppActivityLabel(row.activityStatus)}
                </StatusBadge>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminSection>
  );
}

function partnerAppActivityLabel(status: AdminPartnerOverviewAppActivityRow['activityStatus']) {
  if (status === 'inactive_7d') return 'App telemetry inactive 7D+';
  if (status === 'never_tracked') return 'No app telemetry recorded';
  return 'Telemetry active';
}

function partnerAppActivityTone(
  status: AdminPartnerOverviewAppActivityRow['activityStatus'],
): 'success' | 'warning' | 'danger' {
  if (status === 'inactive_7d') return 'danger';
  if (status === 'never_tracked') return 'warning';
  return 'success';
}

function PartnerRiskTable({
  rows,
  showWallet = false,
}: {
  readonly rows: readonly AdminPartnerOverviewRiskPartner[];
  readonly showWallet?: boolean;
}) {
  const headers = showWallet
    ? ['Partner', 'Area', 'Wallet', 'Reason', 'Action']
    : ['Partner', 'Area', 'Lifetime rating', 'Completed', 'Non-completed', 'No-show', 'Action'];

  return (
    <AdminTableScroll
      ariaLabel={showWallet ? 'Finance wallet risk table' : 'Booking quality risk table'}
      className="partner-overview-table-wrap"
    >
      <AdminDataTable
        className="partner-overview-table"
        emptyMessage="No risk rows in this range."
        headers={headers}
        rowCount={rows.length}
      >
        {rows.map((row) => (
          <tr key={row.partnerId}>
            <td>
              <AdminTextLink href={row.href}>{row.partnerName}</AdminTextLink>
              <small>
                {formatPartnerStatus(row.status)} · {row.mainReason}
              </small>
            </td>
            <td>{row.area}</td>
            {showWallet ? (
              <>
                <td><MoneyText amount={row.walletBalance} /></td>
                <td>{row.mainReason}</td>
              </>
            ) : (
              <>
                <td>{row.rating ? row.rating.toFixed(1) : '-'}</td>
                <td>{formatNumber(row.completedBookings)}</td>
                <td>{row.cancellationRate}%</td>
                <td>{formatNumber(row.noShowReports)}</td>
              </>
            )}
            <td>
              <AdminFormControlLink
                aria-label={`${row.recommendedAction} for ${row.partnerName}`}
                className="partner-overview-risk-action"
                href={row.href}
              >
                {row.recommendedAction}
              </AdminFormControlLink>
            </td>
          </tr>
        ))}
      </AdminDataTable>
    </AdminTableScroll>
  );
}

function SelectionFrictionCard({
  filters,
  issueCounts,
  range,
  rows,
}: {
  readonly filters: AdminPartnerOverview['filters'];
  readonly issueCounts: readonly AdminPartnerOverviewSelectionIssueCount[];
  readonly range: AdminPartnerOverview['range'];
  readonly rows: readonly AdminPartnerOverviewSelectionFrictionRow[];
}) {
  const activeIssue = filters.selectionIssue ?? '';
  const activeSort = filters.selectionSort ?? 'views';
  const issueCountMap = new Map(issueCounts.map((issue) => [issue.key, issue.count]));
  const totalIssueCount = issueCountMap.get('all') ?? rows.length;

  if (totalIssueCount === 0) {
    return (
      <AdminSection
        className="partner-overview-table-card partner-overview-compact-empty"
        description="No viewed or favorited Partner needs selection follow-up in this period."
        statusLabel="No selection friction"
        statusTone="success"
        title="Selection friction"
      />
    );
  }

  return (
    <AdminSection
      bodyClassName="partner-overview-selection-body"
      className="partner-overview-table-card"
      description="Partners customers look at or favorite, but do not select or complete with."
      title="Selection friction"
    >
      <div className="partner-overview-selection-toolbar">
        <div>
          <strong>Selection issue</strong>
          <AdminSegmentedControl
            activeValue={activeIssue}
            ariaLabel="Partner selection issue"
            className="partner-overview-range-buttons"
            options={selectionIssueOptions.map((option) => ({
              href: partnerOverviewHref(range, {
                ...filters,
                selectionIssue: option.value || null,
              }),
              label: `${option.label} (${issueCountMap.get(option.value || 'all') ?? 0})`,
              value: option.value,
            }))}
          />
        </div>
        <AdminFormGrid action="/partners/overview" className="partner-overview-selection-sort-form">
          <input type="hidden" name="range" value={range} />
          {filters.city ? <input type="hidden" name="city" value={filters.city} /> : null}
          {filters.onlineStatus ? (
            <input type="hidden" name="onlineStatus" value={filters.onlineStatus} />
          ) : null}
          {filters.riskStatus ? <input type="hidden" name="riskStatus" value={filters.riskStatus} /> : null}
          {filters.walletStatus ? (
            <input type="hidden" name="walletStatus" value={filters.walletStatus} />
          ) : null}
          {filters.selectionIssue ? (
            <input type="hidden" name="selectionIssue" value={filters.selectionIssue} />
          ) : null}
          {filters.serviceId ? <input type="hidden" name="serviceId" value={filters.serviceId} /> : null}
          {filters.verificationStatus ? (
            <input type="hidden" name="verificationStatus" value={filters.verificationStatus} />
          ) : null}
          <AdminFormSelect
            defaultValue={activeSort}
            label="Sort selection rows"
            labelVisibility="visible"
            name="selectionSort"
            options={selectionSortOptions}
          />
          <AdminFormControlButton className="button-secondary" type="submit">
            Apply
          </AdminFormControlButton>
        </AdminFormGrid>
      </div>
      <AdminTableScroll ariaLabel="Selection friction table" className="partner-overview-table-wrap">
        <AdminDataTable
          className="partner-overview-table partner-overview-selection-table"
          emptyMessage="No viewed or favorited Partners need selection follow-up in this range."
          headers={[
            'Partner',
            'Demand signal',
            'Bookable status and blockers',
            'Response',
            'Conversion',
            'Recommended action',
          ]}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.partnerId}>
              <td>
                <AdminTextLink href={row.href}>{row.partnerName}</AdminTextLink>
                <small>{row.area} · {formatPartnerStatus(row.status)}</small>
                <AdminDisclosure className="partner-overview-selection-details">
                  <summary>Profile and service details</summary>
                  <span>
                    <PartnerOverviewPriceRange maxValue={row.maxServicePrice} minValue={row.minServicePrice} />
                    {' · '}{formatNumber(row.galleryImageCount)} gallery
                    {' · '}{formatNumber(row.activeServiceCount)} services
                    {' · '}{row.rating ? `${row.rating.toFixed(1)} (${formatNumber(row.reviewCount)})` : 'No rating'}
                  </span>
                </AdminDisclosure>
              </td>
              <td>
                {formatNumber(row.profileViews)} views
                <small>{formatNumber(row.favoriteCount)} favorites · {formatNumber(row.profileViewCustomers)} customers</small>
              </td>
              <td>
                <StatusBadge tone={row.readinessFlags.includes('Not bookable') ? 'warning' : 'success'}>
                  {row.readinessFlags.includes('Not bookable') ? 'Not bookable' : row.availabilityStatus}
                </StatusBadge>
                <small>{row.readinessFlags.join(' · ')}</small>
              </td>
              <td>{formatDurationSeconds(row.averageResponseSeconds)}</td>
              <td>
                {row.selectionRate}% selected
                <small>{formatNumber(row.completedBookings)} completed · {row.mainReason}</small>
              </td>
              <td>
                <AdminFormControlLink
                  aria-label={`${row.recommendedAction} for ${row.partnerName}`}
                  className="partner-overview-risk-action"
                  href={row.href}
                >
                  {row.recommendedAction}
                </AdminFormControlLink>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminSection>
  );
}

function partnerOperatingStatusMeta(card: AdminPartnerOverviewOperatingStatusCard) {
  if (card.count === 0) return { kind: 'record', scope: 'No action' } as const;

  if (card.key === 'ready-now' || card.key === 'busy' || card.key === 'busy-now' || card.key === 'available-soon') {
    return { kind: 'live', scope: 'Live' } as const;
  }

  if (
    card.key === 'available-blocked' ||
    card.key === 'inactive-7d' ||
    card.tone === 'danger'
  ) {
    return { kind: 'risk', scope: 'Needs action' } as const;
  }

  return { kind: 'record', scope: 'Current queue' } as const;
}

function DetailedActionQueues({
  filters,
  lists,
  range,
}: {
  readonly filters: AdminPartnerOverview['filters'];
  readonly lists: AdminPartnerOverview['actionLists'];
  readonly range: AdminPartnerOverview['range'];
}) {
  const activeLists = lists.filter((list) => list.totalCount > 0);
  const financeKeys = new Set(['negative-wallet', 'payout-blocked', 'tax-info-missing']);

  return (
    <AdminSection
      bodyClassName="partner-overview-action-table-body"
      className="partner-overview-section-card"
      description="Active Partner supply, quality, and Finance/Tax queues behind the priorities above."
      statusLabel={activeLists.length > 0 ? formatPriorityCount(activeLists.length, 'active queue') : 'No work'}
      statusTone={activeLists.length > 0 ? 'warning' : 'success'}
      title="Detailed action queues"
    >
      <AdminTableScroll ariaLabel="Detailed Partner action queues table" className="partner-overview-table-wrap">
        <AdminDataTable
          className="partner-overview-table partner-overview-action-table"
          emptyMessage="No Partner action queues require follow-up."
          headers={['Queue', 'Scope', 'Open Partners', 'Action']}
          rowCount={activeLists.length}
        >
          {activeLists.map((list) => {
            const finance = financeKeys.has(list.key);
            const directoryLink = partnerOverviewDirectoryLink(list.viewAllHref, range, filters);
            return (
              <tr key={list.key}>
                <td><strong>{list.title}</strong></td>
                <td><StatusBadge tone={finance ? 'warning' : 'info'}>{finance ? 'Finance / Tax' : 'Partner operations'}</StatusBadge></td>
                <td>{formatNumber(list.totalCount)}</td>
                <td>
                  <AdminTextLink
                    aria-label={`${directoryLink.exact ? 'Review' : 'Open full queue for'} ${list.title}`}
                    href={directoryLink.href}
                  >
                    {directoryLink.exact ? `Review ${formatNumber(list.totalCount)}` : 'Open full queue'}
                  </AdminTextLink>
                </td>
              </tr>
            );
          })}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminSection>
  );
}

function partnerPriorityCardMeta(card: PartnerPriorityCardConfig) {
  if (card.key === 'wallet-risk' || card.key === 'quality-risk' || card.tone === 'danger') {
    return card.tone === 'success'
      ? ({ kind: 'live', scope: 'Current queue' } as const)
      : ({ kind: 'risk', scope: 'Needs action' } as const);
  }

  if (card.tone === 'warning') {
    return { kind: 'action', scope: 'Pending' } as const;
  }

  return { kind: 'live', scope: 'Live' } as const;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatKpiValue(kpi: AdminPartnerOverviewKpi) {
  if (kpi.value === null) return 'No events in this period';
  if (kpi.unit === 'money') return <MoneyText amount={kpi.value} />;
  if (kpi.unit === 'percent') return `${kpi.value}%`;
  if (kpi.unit === 'seconds') return formatDurationSeconds(kpi.value);
  if (kpi.unit === 'rating') return kpi.value.toFixed(2);
  return formatNumber(kpi.value);
}

function formatDurationSeconds(value: number | null) {
  if (value === null || !Number.isFinite(value) || value <= 0) return 'No events in this period';
  const seconds = Math.round(value);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  if (remainingSeconds === 0) return `${minutes}m`;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatPriorityCount(value: number, singular: string) {
  return `${formatNumber(value)} ${value === 1 ? singular : `${singular}s`}`;
}

function PartnerOverviewPriceRange({
  maxValue,
  minValue,
}: {
  readonly maxValue: number | null;
  readonly minValue: number | null;
}) {
  if (minValue === null && maxValue === null) return <>No price</>;
  if (minValue === null) return <MoneyText amount={maxValue ?? 0} />;
  if (maxValue === null || minValue === maxValue) return <MoneyText amount={minValue} />;
  return (
    <>
      <MoneyText amount={minValue} />
      {' - '}
      <MoneyText amount={maxValue} />
    </>
  );
}

function formatPartnerStatus(status: string) {
  return partnerProviderStatusFilterLabel(status);
}

function riskPillClass(riskLevel: string) {
  if (riskLevel === 'critical') return 'pill-danger';
  if (riskLevel === 'high') return 'pill-warning';
  if (riskLevel === 'medium') return 'pill-info';
  return 'pill-success';
}
