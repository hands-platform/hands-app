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
import { AdminSection } from '../../../components/admin-surface';
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
  const generatedAt = formatDateTime(overview.generatedAt);
  const activeFilters = partnerOverviewActiveFilters(range, filters);

  return (
    <div className="usage-overview-page partner-overview-page">
      <section className="toolbar">
        <div>
          <h1>Partner Overview</h1>
          <p className="muted">
            Supply health, Partner readiness, booking quality, wallet risk, and action queues from stored
            operational records.
          </p>
        </div>
        <div className="actions">
          <span className="pill pill-success">Vietnam supply</span>
          <span className="pill pill-info">Generated {generatedAt}</span>
        </div>
      </section>

      <section className="card admin-filter-panel usage-overview-filter-panel partner-overview-filter-panel">
        <div className="admin-filter-panel-header">
          <div>
            <h2>Partner supply range</h2>
            <p className="muted">Default view stays focused on current supply and bounded operating windows.</p>
          </div>
          <span className="pill pill-info">{overview.rangeLabel}</span>
        </div>
        <div className="booking-date-filter-buttons usage-overview-range-buttons">
          {partnerOverviewRangeOptions.map((option) => (
            <a
              key={option.value}
              className={`booking-date-filter-button${option.value === range ? ' is-active' : ''}`}
              href={partnerOverviewHref(option.value, filters)}
            >
              {option.label}
            </a>
          ))}
        </div>
        <form className="partner-overview-filter-grid" action="/partners/overview">
          <input type="hidden" name="range" value={range} />
          {filters.selectionIssue ? <input type="hidden" name="selectionIssue" value={filters.selectionIssue} /> : null}
          {filters.selectionSort ? <input type="hidden" name="selectionSort" value={filters.selectionSort} /> : null}
          <label className="admin-form-control">
            <span>City / area</span>
            <input name="city" defaultValue={filters.city ?? ''} placeholder="hcm, hanoi, cau giay" />
          </label>
          <label className="admin-form-control">
            <span>Service</span>
            <input name="serviceId" defaultValue={filters.serviceId ?? ''} placeholder="service id" />
          </label>
          <label className="admin-form-control">
            <span>Verification</span>
            <select name="verificationStatus" defaultValue={filters.verificationStatus ?? ''}>
              <option value="">All</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="DRAFT">Draft</option>
            </select>
          </label>
          <label className="admin-form-control">
            <span>Online status</span>
            <select name="onlineStatus" defaultValue={filters.onlineStatus ?? ''}>
              <option value="">All</option>
              <option value="online">Online</option>
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="offline">Offline</option>
            </select>
          </label>
          <label className="admin-form-control">
            <span>Wallet</span>
            <select name="walletStatus" defaultValue={filters.walletStatus ?? ''}>
              <option value="">All</option>
              <option value="negative">Negative</option>
              <option value="positive">Positive</option>
              <option value="zero">Zero</option>
            </select>
          </label>
          <label className="admin-form-control">
            <span>Risk</span>
            <select name="riskStatus" defaultValue={filters.riskStatus ?? ''}>
              <option value="">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <button className="button button-primary" type="submit">
            Apply filters
          </button>
        </form>
        {activeFilters.length > 0 ? (
          <div className="partner-overview-active-filters" aria-label="Active partner overview filters">
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
          </div>
        ) : null}
      </section>

      {overview.summaryKpis.length > 0 ? (
        <section className="usage-overview-command-grid" aria-label="Partner supply summary">
          {overview.summaryKpis.map((kpi, index) => (
            <PartnerKpiCard key={kpi.key} icon={summaryIcons[index % summaryIcons.length]} kpi={kpi} />
          ))}
        </section>
      ) : null}

      <OperatingStatusBoard cards={overview.operatingStatus.cards} />

      <PartnerPriorityBoard filters={filters} overview={overview} range={range} />

      <section className="usage-overview-insight-grid partner-overview-supply-grid" aria-label="Supply health">
        <SupplyAreaCard rows={overview.supplyHealth.areas} rangeLabel={overview.rangeLabel} />
        <SupplyServiceCard rows={overview.supplyHealth.services} rangeLabel={overview.rangeLabel} />
      </section>

      <AdminSection
        bodyClassName="partner-overview-funnel-steps"
        className="usage-overview-funnel-card"
        description="From signup to approved supply, request activity, completed work, and payout readiness."
        statusLabel={overview.rangeLabel}
        title="Partner readiness funnel"
      >
        {overview.funnel.steps.map((step) => (
          <PartnerFunnelStep key={step.key} step={step} />
        ))}
      </AdminSection>

      {overview.activityRetention.cards.length > 0 ? (
        <section className="usage-overview-segment-grid" aria-label="Partner activity and retention">
          {overview.activityRetention.cards.map((kpi, index) => (
            <PartnerKpiCard key={kpi.key} icon={activityIcons[index % activityIcons.length]} kpi={kpi} />
          ))}
        </section>
      ) : null}

      <section className="usage-overview-insight-grid partner-overview-quality-grid" aria-label="Partner quality and finance">
        <QualityRiskCard kpis={overview.bookingQuality.kpis} rows={overview.bookingQuality.riskPartners} />
        <WalletRiskCard
          kpis={overview.financeWalletRisk.kpis}
          policyNote={overview.financeWalletRisk.policyNote}
          rows={overview.financeWalletRisk.negativeWalletPartners}
        />
      </section>

      <SelectionFrictionCard
        filters={filters}
        issueCounts={overview.selectionFriction.issueCounts}
        range={range}
        rows={overview.selectionFriction.rows}
      />

      <AdminSection
        bodyClassName="partner-overview-action-grid"
        className="usage-overview-funnel-card"
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
        <section className="usage-overview-segment-grid" aria-label="Partner segments">
          {overview.segments.map((segment) => (
            <PartnerSegmentCard key={segment.key} segment={segment} />
          ))}
        </section>
      ) : null}

      {overview.dataNotes.length > 0 ? (
        <section className="card admin-filter-panel">
          <div className="admin-filter-panel-header">
            <div>
              <h2>Data notes</h2>
              <p className="muted">Signals that need additional mobile event logging before they become exact.</p>
            </div>
          </div>
          <ul className="partner-overview-notes">
            {overview.dataNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

const summaryIcons = [Users, BadgeCheck, ClipboardCheck, RadioTower, MapPinned, UserCheck, Activity, AlertTriangle];
const activityIcons = [ShieldAlert, Activity, RadioTower, AlertTriangle, Star];

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
}: {
  readonly icon: typeof Users;
  readonly kpi: AdminPartnerOverviewKpi;
}) {
  const tone = kpi.value === null ? 'neutral' : kpi.value > 0 ? 'primary' : 'neutral';

  return (
    <article className={`usage-overview-command-card is-${tone}`}>
      <div className="usage-overview-command-icon">
        <Icon size={20} aria-hidden="true" />
      </div>
      <div>
        <span>{kpi.label}</span>
        <strong>{formatKpiValue(kpi)}</strong>
        <small>{kpi.detail}</small>
      </div>
    </article>
  );
}

function OperatingStatusBoard({ cards }: { readonly cards: readonly AdminPartnerOverviewOperatingStatusCard[] }) {
  return (
    <AdminSection
      bodyClassName="partner-overview-operating-grid"
      className="usage-overview-funnel-card partner-overview-operating-board"
      description="Separates ready supply from busy, soon-online, offline, and inactive Partners."
      statusLabel={`${cards.length} statuses`}
      title="Partner operating status"
    >
        {cards.length > 0 ? (
          cards.map((card) => (
            <a
              aria-label={`${card.label}, ${formatNumber(card.count)} Partners. Open filtered Partners list`}
              className={`partner-overview-operating-card is-${card.tone}`}
              href={card.href}
              key={card.key}
            >
              <span>{card.label}</span>
              <strong>{formatNumber(card.count)}</strong>
              <small>{card.detail}</small>
              <em>
                Open filtered list
                <ChevronRight size={14} aria-hidden="true" />
              </em>
            </a>
          ))
        ) : (
          <p className="muted">No operating status data is available yet.</p>
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
      className="usage-overview-funnel-card partner-overview-priority-board"
      description="The shortest route from supply signal to the next operator action."
      statusLabel={`${cards.length} actions`}
      title="Partner operations priority"
    >
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <a
              aria-label={`${card.label}, ${card.value}. ${card.action}`}
              className={`usage-overview-command-card partner-overview-priority-card is-${card.tone}`}
              href={card.href}
              key={card.key}
            >
              <span className="usage-overview-command-icon">
                <Icon size={20} aria-hidden="true" />
              </span>
              <div>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.detail}</small>
                <em>
                  {card.action}
                  <ChevronRight size={14} aria-hidden="true" />
                </em>
              </div>
            </a>
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
    <section className="card usage-overview-table-card">
      <TableHeader title="Area supply health" description={`Partner coverage and open demand by area · ${rangeLabel}`} />
      <div className="table-responsive">
        <table className="table usage-overview-table">
          <thead>
            <tr>
              <th>Area</th>
              <th>Partners</th>
              <th>Online</th>
              <th>Fresh location</th>
              <th>Eligible</th>
              <th>Open</th>
              <th>Failed</th>
              <th>Failure</th>
              <th>Response</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
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
                    <span className="pill pill-info">{formatDurationSeconds(row.averageResponseSeconds)}</span>
                  </td>
                  <td>
                    <span className={`pill ${riskPillClass(row.riskLevel)}`}>{row.status}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10}>No area supply rows for this range.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
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
    <section className="card usage-overview-table-card">
      <TableHeader title="Service supply health" description={`Supply by service duration and open work · ${rangeLabel}`} />
      <div className="table-responsive">
        <table className="table usage-overview-table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Offering</th>
              <th>Online</th>
              <th>Eligible</th>
              <th>Open</th>
              <th>Done</th>
              <th>Completion</th>
              <th>Avg rating</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
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
                    <span className={`pill ${riskPillClass(row.riskLevel)}`}>{row.status}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9}>No service supply rows for this range.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PartnerFunnelStep({ step }: { readonly step: AdminPartnerOverviewFunnelStep }) {
  return (
    <article className={`usage-overview-funnel-step ${step.dataStatus === 'available' ? 'is-primary' : 'is-neutral'}`}>
      <div className="usage-overview-funnel-step-header">
        <span>{step.label}</span>
        <strong>{step.count === null ? 'Needs event' : formatNumber(step.count)}</strong>
      </div>
      <div className="usage-overview-funnel-bar" aria-hidden="true">
        <i style={{ width: `${Math.max(4, step.conversionRate ?? 4)}%` }} />
      </div>
      <small>
        {step.dataStatus === 'available'
          ? `${step.conversionRate ?? 0}% from signup · ${step.dropoffRate ?? 0}% drop`
          : 'Add mobile event logging'}
      </small>
    </article>
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
    <section className="card usage-overview-table-card">
      <TableHeader title="Booking quality risk" description="Cancellation, no-show, low review, and rating risk." />
      <MiniKpiStrip kpis={kpis} />
      <PartnerRiskTable rows={rows} />
    </section>
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
    <section className="card usage-overview-table-card">
      <TableHeader title="Finance and wallet risk" description={policyNote || 'Ledger-backed Partner wallet exposure.'} />
      <MiniKpiStrip kpis={kpis} />
      <PartnerRiskTable rows={rows} showWallet />
    </section>
  );
}

function MiniKpiStrip({ kpis }: { readonly kpis: readonly AdminPartnerOverviewKpi[] }) {
  return (
    <div className="partner-overview-mini-kpis">
      {kpis.slice(0, 5).map((kpi) => (
        <div key={kpi.key}>
          <span>{kpi.label}</span>
          <strong>{formatKpiValue(kpi)}</strong>
        </div>
      ))}
    </div>
  );
}

function PartnerRiskTable({
  rows,
  showWallet = false,
}: {
  readonly rows: readonly AdminPartnerOverviewRiskPartner[];
  readonly showWallet?: boolean;
}) {
  return (
    <div className="table-responsive">
      <table className="table usage-overview-table">
        <thead>
          <tr>
            <th>Partner</th>
            <th>Area</th>
            <th>Rating</th>
            <th>Done</th>
            <th>Cancel</th>
            <th>No-show</th>
            {showWallet ? <th>Wallet</th> : null}
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <tr key={row.partnerId}>
                <td>
                  <a href={row.href}>{row.partnerName}</a>
                  <small>
                    {formatPartnerStatus(row.status)} · {row.mainReason}
                  </small>
                </td>
                <td>{row.area}</td>
                <td>{row.rating ? row.rating.toFixed(1) : '-'}</td>
                <td>{formatNumber(row.completedBookings)}</td>
                <td>{row.cancellationRate}%</td>
                <td>{formatNumber(row.noShowReports)}</td>
                {showWallet ? <td>{formatMoney(row.walletBalance)}</td> : null}
                <td>
                  <a
                    aria-label={`${row.recommendedAction} for ${row.partnerName}`}
                    className="button button-secondary partner-overview-risk-action"
                    href={row.href}
                  >
                    {row.recommendedAction}
                  </a>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={showWallet ? 8 : 7}>No risk rows in this range.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
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
    <section className="card usage-overview-table-card" aria-labelledby="partner-selection-friction-title">
      <TableHeader
        titleId="partner-selection-friction-title"
        title="Selection friction"
        description="Partners customers look at or favorite, but do not select or complete with."
      />
      <div className="partner-overview-selection-toolbar">
        <div>
          <strong>Selection issue</strong>
          <div className="booking-date-filter-buttons usage-overview-range-buttons">
            {selectionIssueOptions.map((option) => (
              <a
                key={option.value || 'all'}
                className={`booking-date-filter-button${option.value === activeIssue ? ' is-active' : ''}`}
                href={partnerOverviewHref(range, {
                  ...filters,
                  selectionIssue: option.value || null,
                })}
              >
                {option.label} ({issueCountMap.get(option.value || 'all') ?? 0})
              </a>
            ))}
          </div>
        </div>
        <form action="/partners/overview" className="partner-overview-selection-sort-form">
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
          <label className="admin-form-control">
            <span>Sort selection rows</span>
            <select name="selectionSort" defaultValue={activeSort}>
              {selectionSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button className="button button-secondary" type="submit">
            Apply
          </button>
        </form>
      </div>
      <div className="table-responsive">
        <table className="table usage-overview-table">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Area</th>
              <th>Views</th>
              <th>Favorites</th>
              <th>Price</th>
              <th>Response</th>
              <th>Availability</th>
              <th>Profile</th>
              <th>Done</th>
              <th>Selected</th>
              <th>Rating</th>
              <th>Reason</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.partnerId}>
                  <td>
                    <a href={row.href}>{row.partnerName}</a>
                    <small>{formatPartnerStatus(row.status)}</small>
                  </td>
                  <td>{row.area}</td>
                  <td>
                    {formatNumber(row.profileViews)} views
                    <small>{formatNumber(row.profileViewCustomers)} customers</small>
                  </td>
                  <td>{formatNumber(row.favoriteCount)} favorites</td>
                  <td>{formatPriceRange(row.minServicePrice, row.maxServicePrice)}</td>
                  <td>{formatDurationSeconds(row.averageResponseSeconds)}</td>
                  <td>
                    {row.availabilityStatus}
                    <small>Next {formatDateTime(row.nextAvailableAt)}</small>
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
                    <span className={`pill ${riskPillClass(row.riskLevel)}`}>{row.mainReason}</span>
                    <small>{row.readinessFlags.join(' · ')}</small>
                  </td>
                  <td>
                    <a
                      aria-label={`${row.recommendedAction} for ${row.partnerName}`}
                      className="button button-secondary partner-overview-risk-action"
                      href={row.href}
                    >
                      {row.recommendedAction}
                    </a>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={13}>No viewed or favorited Partners need selection follow-up in this range.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActionListCard({ list }: { readonly list: AdminPartnerOverviewActionList }) {
  return (
    <article className="partner-overview-action-card">
      <div className="partner-overview-action-card-header">
        <div>
          <h3>{list.title}</h3>
          <small>{formatNumber(list.totalCount)} Partners</small>
        </div>
        <a aria-label={`Open ${list.title}`} className="button button-secondary" href={list.viewAllHref}>
          Open
          <ChevronRight size={14} aria-hidden="true" />
        </a>
      </div>
      <div className="partner-overview-action-rows">
        {list.rows.length > 0 ? (
          list.rows.map((row) => <ActionRow key={`${list.key}-${row.partnerId}`} row={row} />)
        ) : (
          <p className="muted">No Partners need this action right now.</p>
        )}
      </div>
    </article>
  );
}

function ActionRow({ row }: { readonly row: AdminPartnerOverviewActionRow }) {
  const lastActivity = formatDateTime(row.lastActivityAt);
  const partnerStatus = formatPartnerStatus(row.status);

  return (
    <a
      aria-label={`${row.partnerName}, ${row.phone ?? 'no phone'}, ${row.area}, ${partnerStatus}, last activity ${lastActivity}, ${row.mainReason}, ${row.recommendedAction}`}
      className="partner-overview-action-row"
      href={row.href}
    >
      <span className="partner-overview-action-identity">
        <strong>{row.partnerName}</strong>
        <small>{[row.phone, row.area].filter(Boolean).join(' · ') || 'No contact area'}</small>
        <small>
          {partnerStatus} · Last activity {lastActivity}
        </small>
      </span>
      <span className="partner-overview-action-reason">
        <span className={`pill ${riskPillClass(row.riskLevel)}`}>{row.mainReason}</span>
        <small>{row.recommendedAction}</small>
      </span>
    </a>
  );
}

function PartnerSegmentCard({ segment }: { readonly segment: AdminPartnerOverviewSegment }) {
  const Icon = partnerSegmentIcons[segment.key] ?? Activity;

  return (
    <article className={`usage-overview-command-card is-${segment.tone}`}>
      <div className="usage-overview-command-icon">
        <Icon size={20} aria-hidden="true" />
      </div>
      <div>
        <span>{segment.label}</span>
        <strong>{formatNumber(segment.count)}</strong>
        <small>{segment.explanation}</small>
        <a href={segment.href}>{segment.recommendedAction}</a>
      </div>
    </article>
  );
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

function TableHeader({
  description,
  title,
  titleId,
}: {
  readonly description: string;
  readonly title: string;
  readonly titleId?: string;
}) {
  return (
    <div className="ops-section-header usage-overview-section-header">
      <div>
        <h2 id={titleId}>{title}</h2>
        <p className="muted">{description}</p>
      </div>
    </div>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatKpiValue(kpi: AdminPartnerOverviewKpi) {
  if (kpi.value === null) return 'Needs event';
  if (kpi.unit === 'money') return formatMoney(kpi.value);
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

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatPriorityCount(value: number, singular: string) {
  return `${formatNumber(value)} ${value === 1 ? singular : `${singular}s`}`;
}

function formatPlainVnd(value: number) {
  return `${formatNumber(value)} VND`;
}

function formatPriceRange(minValue: number | null, maxValue: number | null) {
  if (minValue === null && maxValue === null) return 'No price';
  if (minValue === null) return formatPlainVnd(maxValue ?? 0);
  if (maxValue === null || minValue === maxValue) return formatPlainVnd(minValue);
  return `${formatPlainVnd(minValue)} - ${formatPlainVnd(maxValue)}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'VND',
  }).format(value);
}

function formatDateTime(value?: string | null) {
  if (!value) return 'not yet';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'not yet';
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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
