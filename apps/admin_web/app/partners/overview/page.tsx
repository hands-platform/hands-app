import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Ban,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock,
  FileWarning,
  MapPinned,
  MousePointerClick,
  RadioTower,
  ShieldAlert,
  Star,
  TrendingUp,
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
  AdminCardGrid,
  AdminCardHeader,
  AdminKpiCard,
  AdminRowLink,
  AdminSection,
} from '../../../components/admin-surface';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge, StatusBadgeFromPillClass } from '../../../components/status-badge';
import {
  formatDateTime,
  formatWholeNumber as formatNumber,
} from '../../../lib/admin-format';
import {
  AdminPartnerOverview,
  AdminPartnerOverviewActionList,
  AdminPartnerOverviewActionRow,
  AdminPartnerOverviewAreaRow,
  AdminPartnerOverviewFunnelStep,
  AdminPartnerOverviewKpi,
  AdminPartnerOverviewNegativeWalletPartner,
  AdminPartnerOverviewOperatingStatusCard,
  AdminPartnerOverviewRiskPartner,
  AdminPartnerOverviewSelectionIssueCount,
  AdminPartnerOverviewSelectionFrictionRow,
  AdminPartnerOverviewSegment,
  AdminPartnerOverviewServiceRow,
  adminGet,
} from '../../../lib/admin-api';
import {
  emptyPartnerOverview,
  normalizePartnerOverviewRange,
  partnerOverviewActiveFilters,
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
  const apiParams = new URLSearchParams({ range });
  for (const [key, value] of Object.entries(filters)) {
    if (value) apiParams.set(key, value);
  }
  const rawOverview = await adminGet<AdminPartnerOverview>(
    `/admin/partners/overview?${apiParams.toString()}`,
    emptyPartnerOverview(range),
  );
  const overview = partnerOverviewWithDefaults(rawOverview, range);
  const activeFilters = partnerOverviewActiveFilters(range, filters);

  return (
    <AdminPageTemplate
      contentClassName="partner-overview-page"
      description="Supply status, Partner activation, booking quality, wallet risk, and action queues from stored operational records."
      title="Partner Overview"
    >

      <AdminFilterPanel
        actions={
          <>
            <StatusBadge tone="success">Vietnam supply</StatusBadge>
            <StatusBadge tone="info">
              Generated <DateTimeText value={overview.generatedAt} />
            </StatusBadge>
          </>
        }
        className="partner-overview-filter-panel"
        description="Default view stays focused on current supply and bounded operating windows."
        resultLabel={overview.rangeLabel}
        title="Partner supply range"
      >
        <AdminSegmentedControl
          activeValue={range}
          ariaLabel="Partner overview range"
          className="partner-overview-range-buttons"
          options={partnerOverviewRangeOptions.map((option) => ({
            href: partnerOverviewHref(option.value, filters),
            label: option.label,
            value: option.value,
          }))}
        />
        <AdminFormGrid action="/partners/overview" className="partner-overview-filter-grid">
          <input type="hidden" name="range" value={range} />
          {filters.selectionIssue ? <input type="hidden" name="selectionIssue" value={filters.selectionIssue} /> : null}
          {filters.selectionSort ? <input type="hidden" name="selectionSort" value={filters.selectionSort} /> : null}
          <AdminFormInput
            defaultValue={filters.city ?? ''}
            label="City / area"
            labelVisibility="visible"
            name="city"
            placeholder="hcm, hanoi, cau giay"
          />
          <AdminFormInput
            defaultValue={filters.serviceId ?? ''}
            label="Service"
            labelVisibility="visible"
            name="serviceId"
            placeholder="service id"
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
              <a aria-label={`Remove ${filter.label} filter ${filter.value}`} key={filter.key} href={filter.removeHref}>
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

      {overview.summaryKpis.length > 0 ? (
        <AdminOverviewCommandGrid ariaLabel="Partner supply summary">
          {overview.summaryKpis.map((kpi, index) => (
            <PartnerKpiCard
              key={kpi.key}
              icon={summaryIcons[index % summaryIcons.length]}
              kpi={kpi}
              rangeLabel={overview.rangeLabel}
            />
          ))}
        </AdminOverviewCommandGrid>
      ) : null}

      <OperatingStatusBoard cards={overview.operatingStatus.cards} />

      <PartnerPriorityBoard filters={filters} overview={overview} range={range} />

      <AdminOverviewGrid ariaLabel="Supply status" className="partner-overview-supply-grid" variant="insight">
        <SupplyAreaCard rows={overview.supplyHealth.areas} rangeLabel={overview.rangeLabel} />
        <SupplyServiceCard rows={overview.supplyHealth.services} rangeLabel={overview.rangeLabel} />
      </AdminOverviewGrid>

      <AdminSection
        bodyClassName="partner-overview-funnel-steps"
        className="partner-overview-section-card"
        description="From signup to approved supply, request activity, completed work, and payout profile completion."
        statusLabel={overview.rangeLabel}
        title="Partner activation funnel"
      >
        {overview.funnel.steps.map((step) => (
          <PartnerFunnelStep key={step.key} step={step} />
        ))}
      </AdminSection>

      {overview.activityRetention.cards.length > 0 ? (
        <AdminOverviewGrid ariaLabel="Partner activity and retention" variant="segment">
          {overview.activityRetention.cards.map((kpi, index) => (
            <PartnerKpiCard
              key={kpi.key}
              icon={activityIcons[index % activityIcons.length]}
              kpi={kpi}
              rangeLabel={overview.rangeLabel}
            />
          ))}
        </AdminOverviewGrid>
      ) : null}

      <AdminOverviewGrid ariaLabel="Partner quality and finance" className="partner-overview-quality-grid" variant="insight">
        <QualityRiskCard kpis={overview.bookingQuality.kpis} rows={overview.bookingQuality.riskPartners} />
        <WalletRiskCard
          kpis={overview.financeWalletRisk.kpis}
          policyNote={overview.financeWalletRisk.policyNote}
          rows={overview.financeWalletRisk.negativeWalletPartners}
        />
      </AdminOverviewGrid>

      <SelectionFrictionCard
        filters={filters}
        issueCounts={overview.selectionFriction.issueCounts}
        range={range}
        rows={overview.selectionFriction.rows}
      />

      <AdminSection
        bodyClassName="partner-overview-action-grid"
        className="partner-overview-section-card"
        description="Small, operator-first queues. Open full filtered lists from each section when needed."
        statusLabel={`${overview.actionLists.length} queues`}
        statusTone="warning"
        title="Risk and action queues"
      >
        {overview.actionLists.map((list) => (
          <ActionListCard key={list.key} list={list} />
        ))}
      </AdminSection>

      {overview.segments.length > 0 ? (
        <AdminOverviewGrid ariaLabel="Partner segments" variant="segment">
          {overview.segments.map((segment) => (
            <PartnerSegmentCard key={segment.key} rangeLabel={overview.rangeLabel} segment={segment} />
          ))}
        </AdminOverviewGrid>
      ) : null}

      {overview.dataNotes.length > 0 ? (
        <AdminSection
          className="partner-overview-notes-card"
          description="Signals that need additional mobile event logging before they become exact."
          title="Data notes"
        >
          <ul className="partner-overview-notes">
            {overview.dataNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </AdminSection>
      ) : null}
    </AdminPageTemplate>
  );
}

const summaryIcons = [Users, BadgeCheck, ClipboardCheck, RadioTower, MapPinned, UserCheck, Activity, AlertTriangle];
const activityIcons = [ShieldAlert, Activity, RadioTower, AlertTriangle, Star];
const partnerOperatingStatusIcons: Record<string, typeof Users> = {
  'available-soon': Clock,
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

  return (
    <AdminKpiCard
      className={`partner-overview-kpi-card is-${tone}`}
      helper={kpi.detail}
      icon={Icon}
      kind={meta.kind}
      label={kpi.label}
      scope={meta.scope}
      value={formatKpiValue(kpi)}
    />
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

  if (normalized.includes('approval') || normalized.includes('verification') || normalized.includes('pending')) {
    return { kind: 'action', scope: 'Pending' } as const;
  }

  return { kind: 'period', scope: rangeLabel } as const;
}

function OperatingStatusBoard({ cards }: { readonly cards: readonly AdminPartnerOverviewOperatingStatusCard[] }) {
  return (
    <AdminSection
      bodyClassName="partner-overview-operating-grid"
      className="partner-overview-section-card partner-overview-operating-board"
      description="Separates ready supply from busy, soon-online, offline, and inactive Partners."
      statusLabel={`${cards.length} statuses`}
      title="Partner operating status"
    >
      {cards.length > 0 ? (
        cards.map((card) => {
          const Icon = partnerOperatingStatusIcons[card.key] ?? RadioTower;
          const meta = partnerOperatingStatusMeta(card);

          return (
            <AdminOverviewCommandCard
              ariaLabel={`${card.label}, ${formatNumber(card.count)} Partners. Open filtered Partners list`}
              baseClassName="partner-overview-operating-card"
              className={`is-${card.tone}`}
              detail={card.detail}
              href={card.href}
              icon={<Icon size={18} aria-hidden="true" />}
              iconClassName="partner-overview-command-icon"
              key={card.key}
              kind={meta.kind}
              label={card.label}
              scope={meta.scope}
              value={formatNumber(card.count)}
            >
              <em>
                Open filtered list
                <ChevronRight size={14} aria-hidden="true" />
              </em>
            </AdminOverviewCommandCard>
          );
        })
      ) : (
        <AdminEmptyState framed message="No operating status data is available yet." title={null} />
      )}
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
  const readyCard = overview.operatingStatus.cards.find((card) => card.key === 'ready-now');
  const selectionIssueCount =
    overview.selectionFriction.issueCounts.find((issue) => issue.key === 'all')?.count ??
    overview.selectionFriction.rows.length;
  const walletRiskCount = overview.financeWalletRisk.negativeWalletPartners.length;
  const qualityRiskCount = overview.bookingQuality.riskPartners.length;
  const selectionHref = partnerOverviewHref(range, {
    ...filters,
    selectionIssue: filters.selectionIssue ?? 'availability',
    selectionSort: filters.selectionSort ?? 'response',
  });
  const cards: readonly PartnerPriorityCardConfig[] = [
    {
      action: 'Open ready list',
      detail: readyCard?.detail ?? 'Approved Partners who can accept bookings now.',
      href: readyCard?.href ?? '/partners?review=marketplace-ready&onlineStatus=available',
      icon: UserCheck,
      key: 'ready-supply',
      label: 'Ready supply',
      tone: (readyCard?.count ?? 0) > 0 ? 'success' : 'warning',
      value: formatPriorityCount(readyCard?.count ?? 0, 'partner'),
    },
    {
      action: 'Review friction',
      detail: 'Viewed or favorited Partners who are not converting into selected bookings.',
      href: selectionHref,
      icon: MousePointerClick,
      key: 'selection-drop-off',
      label: 'Selection drop-off',
      tone: selectionIssueCount > 0 ? 'warning' : 'success',
      value: formatPriorityCount(selectionIssueCount, 'issue'),
    },
    {
      action: 'Review wallet',
      detail: overview.financeWalletRisk.policyNote || 'Negative Partner wallet exposure from ledger balances.',
      href: '/partners?review=unsettled',
      icon: WalletCards,
      key: 'wallet-risk',
      label: 'Wallet risk',
      tone: walletRiskCount > 0 ? 'danger' : 'success',
      value: formatPriorityCount(walletRiskCount, 'partner'),
    },
    {
      action: 'Review quality',
      detail: 'Cancellation, no-show, low-review, and service-quality follow-up queue.',
      href: '/partners?review=reports',
      icon: Star,
      key: 'quality-risk',
      label: 'Quality risk',
      tone: qualityRiskCount > 0 ? 'danger' : 'success',
      value: formatPriorityCount(qualityRiskCount, 'partner'),
    },
  ];

  return (
    <AdminSection
      bodyClassName="partner-overview-priority-grid"
      className="partner-overview-section-card partner-overview-priority-board"
      description="The shortest route from supply signal to the next operator action."
      statusLabel={`${cards.length} actions`}
      title="Partner operations priority"
    >
        {cards.map((card) => {
          const Icon = card.icon;
          const meta = partnerPriorityCardMeta(card);

          return (
            <AdminOverviewCommandCard
              ariaLabel={`${card.label}, ${card.value}. ${card.action}`}
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
                {card.action}
                <ChevronRight size={14} aria-hidden="true" />
              </em>
            </AdminOverviewCommandCard>
          );
        })}
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
      description={`Partner coverage and open demand by area · ${rangeLabel}`}
      title="Area supply status"
    >
      <AdminTableScroll className="partner-overview-table-wrap">
        <AdminDataTable
          className="partner-overview-table"
          emptyMessage="No area supply rows for this range."
          headers={[
            'Area',
            'Partners',
            'Online',
            'Fresh location',
            'Eligible',
            'Open',
            'Failed',
            'Failure',
            'Response',
            'Status',
          ]}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.areaCode}>
              <td>{row.area}</td>
              <td>{formatNumber(row.totalPartners)}</td>
              <td>{formatNumber(row.onlinePartners)}</td>
              <td>{formatNumber(row.locationFreshPartners)}</td>
              <td>{formatNumber(row.eligiblePartners)}</td>
              <td>{formatNumber(row.openRequests)}</td>
              <td>{formatNumber(row.failedRequests)}</td>
              <td>{row.matchingFailureRate}%</td>
              <td>
                <StatusBadge tone="info">{formatDurationSeconds(row.averageResponseSeconds)}</StatusBadge>
              </td>
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
      description={`Supply by service duration and open work · ${rangeLabel}`}
      title="Service supply status"
    >
      <AdminTableScroll className="partner-overview-table-wrap">
        <AdminDataTable
          className="partner-overview-table"
          emptyMessage="No service supply rows for this range."
          headers={['Service', 'Offering', 'Online', 'Eligible', 'Open', 'Done', 'Completion', 'Avg rating', 'Status']}
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
              <td>{row.completionRate}%</td>
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

function PartnerFunnelStep({ step }: { readonly step: AdminPartnerOverviewFunnelStep }) {
  return (
    <AdminCard className={`partner-overview-funnel-step ${step.dataStatus === 'available' ? 'is-primary' : 'is-neutral'}`}>
      <div className="partner-overview-funnel-step-header">
        <span>{step.label}</span>
        <strong>{step.count === null ? 'Needs event' : formatNumber(step.count)}</strong>
      </div>
      <div className="partner-overview-funnel-bar" aria-hidden="true">
        <i style={{ width: `${Math.max(4, step.conversionRate ?? 4)}%` }} />
      </div>
      <small>
        {step.dataStatus === 'available'
          ? `${step.conversionRate ?? 0}% from signup · ${step.dropoffRate ?? 0}% drop`
          : 'Add mobile event logging'}
      </small>
    </AdminCard>
  );
}

function QualityRiskCard({
  kpis,
  rows,
}: {
  readonly kpis: readonly AdminPartnerOverviewKpi[];
  readonly rows: readonly AdminPartnerOverviewRiskPartner[];
}) {
  return (
    <AdminSection
      bodyClassName="partner-overview-risk-card-body"
      className="partner-overview-table-card"
      description="Cancellation, no-show, low review, and rating risk."
      title="Booking quality risk"
    >
      <MiniKpiStrip kpis={kpis} />
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
  return (
    <AdminSection
      bodyClassName="partner-overview-risk-card-body"
      className="partner-overview-table-card"
      description={policyNote || 'Ledger-backed Partner wallet exposure.'}
      title="Finance and wallet risk"
    >
      <MiniKpiStrip kpis={kpis} />
      <PartnerRiskTable rows={rows} showWallet />
    </AdminSection>
  );
}

function MiniKpiStrip({ kpis }: { readonly kpis: readonly AdminPartnerOverviewKpi[] }) {
  return (
    <AdminMiniMetricStrip
      className="partner-overview-mini-kpis"
      limit={5}
      metrics={kpis.map((kpi) => ({
        key: kpi.key,
        label: kpi.label,
        value: formatKpiValue(kpi),
      }))}
    />
  );
}

function PartnerRiskTable({
  rows,
  showWallet = false,
}: {
  readonly rows: readonly AdminPartnerOverviewRiskPartner[];
  readonly showWallet?: boolean;
}) {
  const headers = showWallet
    ? ['Partner', 'Area', 'Rating', 'Done', 'Cancel', 'No-show', 'Wallet', 'Action']
    : ['Partner', 'Area', 'Rating', 'Done', 'Cancel', 'No-show', 'Action'];

  return (
    <AdminTableScroll className="partner-overview-table-wrap">
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
            <td>{row.rating ? row.rating.toFixed(1) : '-'}</td>
            <td>{formatNumber(row.completedBookings)}</td>
            <td>{row.cancellationRate}%</td>
            <td>{formatNumber(row.noShowReports)}</td>
            {showWallet ? (
              <td>
                <MoneyText amount={row.walletBalance} />
              </td>
            ) : null}
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
          {filters.onlineStatus ? <input type="hidden" name="onlineStatus" value={filters.onlineStatus} /> : null}
          {filters.riskStatus ? <input type="hidden" name="riskStatus" value={filters.riskStatus} /> : null}
          {filters.walletStatus ? <input type="hidden" name="walletStatus" value={filters.walletStatus} /> : null}
          {filters.selectionIssue ? <input type="hidden" name="selectionIssue" value={filters.selectionIssue} /> : null}
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
      <AdminTableScroll className="partner-overview-table-wrap">
        <AdminDataTable
          className="partner-overview-table"
          emptyMessage="No viewed or favorited Partners need selection follow-up in this range."
          headers={[
            'Partner',
            'Area',
            'Views',
            'Favorites',
            'Price',
            'Response',
            'Availability',
            'Profile',
            'Done',
            'Selected',
            'Rating',
            'Reason',
            'Action',
          ]}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.partnerId}>
              <td>
                <AdminTextLink href={row.href}>{row.partnerName}</AdminTextLink>
                <small>{formatPartnerStatus(row.status)}</small>
              </td>
              <td>{row.area}</td>
              <td>
                {formatNumber(row.profileViews)} views
                <small>{formatNumber(row.profileViewCustomers)} customers</small>
              </td>
              <td>{formatNumber(row.favoriteCount)} favorites</td>
              <td>
                <PartnerOverviewPriceRange maxValue={row.maxServicePrice} minValue={row.minServicePrice} />
              </td>
              <td>{formatDurationSeconds(row.averageResponseSeconds)}</td>
              <td>
                {row.availabilityStatus}
                <small>
                  Next <DateTimeText value={row.nextAvailableAt} />
                </small>
              </td>
              <td>
                {row.hasProfileImage ? 'Profile image ready' : 'No profile image'}
                <small>
                  {formatNumber(row.galleryImageCount)} gallery · {formatNumber(row.activeServiceCount)} services
                </small>
              </td>
              <td>{formatNumber(row.completedBookings)}</td>
              <td>{row.selectionRate}% selected</td>
              <td>{row.rating ? `${row.rating.toFixed(1)} (${formatNumber(row.reviewCount)})` : '-'}</td>
              <td>
                <StatusBadgeFromPillClass pillClass={riskPillClass(row.riskLevel)}>
                  {row.mainReason}
                </StatusBadgeFromPillClass>
                <small>{row.readinessFlags.join(' · ')}</small>
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

function ActionListCard({ list }: { readonly list: AdminPartnerOverviewActionList }) {
  return (
    <AdminCard className="partner-overview-action-card">
      <AdminCardHeader
        actions={
          <AdminFormControlLink aria-label={`Open ${list.title}`} href={list.viewAllHref}>
            Open
            <ChevronRight size={14} aria-hidden="true" />
          </AdminFormControlLink>
        }
        description={`${formatNumber(list.totalCount)} Partners`}
        title={list.title}
      />
      <AdminCardGrid ariaLabel={`${list.title} action rows`} className="partner-overview-action-rows">
        {list.rows.length > 0 ? (
          list.rows.map((row) => <ActionRow key={`${list.key}-${row.partnerId}`} row={row} />)
        ) : (
          <AdminEmptyState framed message="No Partners need this action right now." title={null} />
        )}
      </AdminCardGrid>
    </AdminCard>
  );
}

function ActionRow({ row }: { readonly row: AdminPartnerOverviewActionRow }) {
  const lastActivity = formatDateTime(row.lastActivityAt);
  const partnerStatus = formatPartnerStatus(row.status);

  return (
    <AdminRowLink
      ariaLabel={`${row.partnerName}, ${row.phone ?? 'no phone'}, ${row.area}, ${partnerStatus}, last activity ${lastActivity}, ${row.mainReason}, ${row.recommendedAction}`}
      className="partner-overview-action-row"
      href={row.href}
    >
      <span className="partner-overview-action-identity">
        <strong>{row.partnerName}</strong>
        <small>{[row.phone, row.area].filter(Boolean).join(' · ') || 'No contact area'}</small>
        <small>
          {partnerStatus} · Last activity <DateTimeText value={row.lastActivityAt} />
        </small>
      </span>
      <span className="partner-overview-action-reason">
        <StatusBadgeFromPillClass pillClass={riskPillClass(row.riskLevel)}>
          {row.mainReason}
        </StatusBadgeFromPillClass>
        <small>{row.recommendedAction}</small>
      </span>
    </AdminRowLink>
  );
}

function PartnerSegmentCard({
  rangeLabel,
  segment,
}: {
  readonly rangeLabel: string;
  readonly segment: AdminPartnerOverviewSegment;
}) {
  const Icon = partnerSegmentIcons[segment.key] ?? Activity;
  const meta = partnerSegmentCardMeta(segment, rangeLabel);

  return (
    <AdminOverviewCommandCard
      baseClassName="partner-overview-command-card"
      className={`is-${segment.tone}`}
      detail={segment.explanation}
      icon={<Icon size={20} aria-hidden="true" />}
      iconClassName="partner-overview-command-icon"
      kind={meta.kind}
      label={segment.label}
      scope={meta.scope}
      value={formatNumber(segment.count)}
    >
      <AdminTextLink href={segment.href}>{segment.recommendedAction}</AdminTextLink>
    </AdminOverviewCommandCard>
  );
}

function partnerOperatingStatusMeta(card: AdminPartnerOverviewOperatingStatusCard) {
  if (card.key === 'ready-now' || card.key === 'busy-now' || card.key === 'available-soon') {
    return { kind: 'live', scope: 'Live' } as const;
  }

  if (card.key === 'inactive-7d' || card.key === 'offline' || card.tone === 'danger') {
    return { kind: 'risk', scope: 'Needs action' } as const;
  }

  return { kind: 'record', scope: 'Current queue' } as const;
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

function partnerSegmentCardMeta(segment: AdminPartnerOverviewSegment, rangeLabel: string) {
  const normalized = `${segment.key} ${segment.label}`.toLowerCase();

  if (
    normalized.includes('pending') ||
    normalized.includes('documents') ||
    normalized.includes('payout-blocked')
  ) {
    return { kind: 'action', scope: 'Pending' } as const;
  }

  if (
    normalized.includes('risk') ||
    normalized.includes('negative') ||
    normalized.includes('cancellation') ||
    normalized.includes('no-show') ||
    normalized.includes('low-rating') ||
    normalized.includes('blocked')
  ) {
    return { kind: 'risk', scope: 'Needs action' } as const;
  }

  return { kind: 'period', scope: rangeLabel } as const;
}

const partnerSegmentIcons: Record<string, typeof WalletCards> = {
  'approved-inactive': Clock,
  'churn-risk': UserX,
  'documents-missing': FileWarning,
  'first-job': ClipboardCheck,
  'high-activity': TrendingUp,
  'high-cancellation': Ban,
  'high-rating': Star,
  'low-rating': AlertTriangle,
  'negative-wallet': WalletCards,
  'new-pending': FileWarning,
  'no-show': ShieldAlert,
  overpriced: CircleDollarSign,
  payoutBlocked: WalletCards,
  'payout-blocked': WalletCards,
  pending: FileWarning,
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatKpiValue(kpi: AdminPartnerOverviewKpi) {
  if (kpi.value === null) return 'Needs event';
  if (kpi.unit === 'money') return <MoneyText amount={kpi.value} />;
  if (kpi.unit === 'percent') return `${kpi.value}%`;
  if (kpi.unit === 'seconds') return formatDurationSeconds(kpi.value);
  if (kpi.unit === 'rating') return kpi.value.toFixed(2);
  return formatNumber(kpi.value);
}

function formatDurationSeconds(value: number | null) {
  if (value === null || !Number.isFinite(value) || value <= 0) return 'Needs event';
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
