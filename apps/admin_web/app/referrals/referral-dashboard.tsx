import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminDirectoryFilterForm } from '../../components/admin-directory-filter-form';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminInlineFallback } from '../../components/admin-inline-fallback';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { AdminPageTemplate, type AdminPageMetric } from '../../components/admin-page-template';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminSection } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';
import {
  type AdminCustomerReferralParent,
  type AdminCustomerReferralRewardQueueRow,
  type AdminPartnerReferralParent,
  type AdminReferralPolicy,
  type AdminReferralUserSummary,
} from '../../lib/admin-api';
import { isInDateRange, readSearchParam } from '../../lib/date-range';
import { isReferralRewardCredited, referralRewardDecisionLabel } from '../../lib/referral-reward-credit-state';
import { referralShareUrl, referralStoreSetupState, type ReferralAudienceSlug } from '../../lib/referral-links';
import { referralParentDetailHref } from './referral-detail';
import { ReferralPolicyForm } from './referral-policy-form';
import { ReferralStoreSetupStatus } from './referral-store-setup-status';

export type ReferralDashboardStatusFilter = 'all' | 'qualified' | 'pending' | 'blocked';
export type ReferralDashboardRewardFilter = 'all' | 'attention' | 'available' | 'credited' | 'pending' | 'held';
export type ReferralDashboardFraudFilter = 'all' | 'clear' | 'flagged' | 'held';
export type ReferralDashboardRangeFilter = 'all' | 'today' | '7d' | '30d';

export type ReferralDashboardFilters = {
  readonly fraud: ReferralDashboardFraudFilter;
  readonly q: string;
  readonly range: ReferralDashboardRangeFilter;
  readonly reward: ReferralDashboardRewardFilter;
  readonly status: ReferralDashboardStatusFilter;
};

export type ReferralRewardQueueSummary = {
  readonly amount: number;
  readonly count: number;
  readonly reward: ReferralDashboardRewardFilter;
};

const referralListPageSize = 10;

type ReferralPaginationModel<T> = {
  readonly currentPage: number;
  readonly endItem: number;
  readonly rows: readonly T[];
  readonly startItem: number;
  readonly totalCount: number;
  readonly totalPages: number;
};

type ReferralDashboardProps =
  | {
      readonly audience: 'customer';
      readonly filters?: ReferralDashboardFilters;
      readonly fixtureRows?: readonly AdminCustomerReferralRewardQueueRow[];
      readonly currentPage?: number;
      readonly canEditPolicy?: boolean;
      readonly canManageRewards?: boolean;
      readonly canViewDeveloperSetup?: boolean;
      readonly pageSize?: number;
      readonly partialReadError?: string;
      readonly policy: AdminReferralPolicy;
      readonly policyNotice?: ReferralDashboardNotice;
      readonly policyMode?: boolean;
      readonly readError?: string;
      readonly rewardRows?: readonly AdminCustomerReferralRewardQueueRow[];
      readonly rewardQueueSummaries?: readonly ReferralRewardQueueSummary[];
      readonly referralCount?: number;
      readonly rows: readonly AdminCustomerReferralParent[];
      readonly parentRecordsHref?: string;
      readonly parentRecordsLoaded?: boolean;
      readonly serverPagination?: boolean;
      readonly totalCount?: number;
    }
  | {
      readonly audience: 'partner';
      readonly filters?: ReferralDashboardFilters;
      readonly currentPage?: number;
      readonly canEditPolicy?: boolean;
      readonly canManageRewards?: boolean;
      readonly canViewDeveloperSetup?: boolean;
      readonly pageSize?: number;
      readonly partialReadError?: string;
      readonly policy: AdminReferralPolicy;
      readonly policyNotice?: ReferralDashboardNotice;
      readonly policyMode?: boolean;
      readonly readError?: string;
      readonly rewardQueueSummaries?: readonly ReferralRewardQueueSummary[];
      readonly referralCount?: number;
      readonly rows: readonly AdminPartnerReferralParent[];
      readonly serverPagination?: boolean;
      readonly totalCount?: number;
    };

type ReferralDashboardNotice = {
  readonly message: string;
  readonly tone: 'danger' | 'success' | 'warning';
};

type ReferralPolicyPanelProps = {
  readonly canEditPolicy?: boolean;
  readonly label: string;
  readonly openExposure?: { readonly amount: number; readonly count: number };
  readonly policy: AdminReferralPolicy;
};

type ReferralEmptyStateProps = {
  readonly activeFilters?: readonly string[];
  readonly audienceLabel: string;
  readonly clearHref?: string;
  readonly totalCount?: number;
};

export function ReferralDashboard(props: ReferralDashboardProps) {
  const audienceTitle = props.audience === 'customer' ? 'Customer Referrals' : 'Partner Referrals';
  const title = props.policyMode ? `${audienceTitle} Policy` : audienceTitle;
  const filters = props.filters ?? defaultReferralDashboardFilters;
  const rewardQueueSummaries = props.rewardQueueSummaries ?? buildReferralRewardQueueSummaries(props.rows);
  const rewardSummaryByQueue = new Map<ReferralDashboardRewardFilter, ReferralRewardQueueSummary>(
    rewardQueueSummaries.map((summary) => [summary.reward, summary]),
  );
  const totalCount = props.totalCount ?? props.rows.length;
  const parentRecordsLoaded = props.audience === 'customer'
    ? (props.parentRecordsLoaded ?? props.rows.length > 0)
    : false;
  const rewardRows = props.audience === 'customer' ? props.rewardRows ?? [] : [];
  const selectedRewardSummary = rewardSummaryByQueue.get(filters.reward);
  const rewardTotalCount = selectedRewardSummary?.count ?? rewardRows.length;
  const rewardPagination = paginateReferralServerRows(
    rewardRows,
    props.currentPage ?? 1,
    rewardTotalCount,
    props.pageSize ?? referralListPageSize,
  );
  const pagination = props.serverPagination
    ? paginateReferralServerRows(props.rows, props.currentPage ?? 1, totalCount, props.pageSize ?? referralListPageSize)
    : paginateReferralRows(props.rows, props.currentPage ?? 1, props.pageSize ?? referralListPageSize);
  const tableEmptyState: ReferralEmptyStateProps = {
    activeFilters: referralActiveFilterLabels(filters),
    audienceLabel: referralAudienceLabel(props.audience),
    clearHref: referralListPath(props.audience),
    totalCount,
  };
  const description =
    props.policyMode
      ? `Restricted Settings for ${audienceTitle}. Changes require SYSTEM_POLICY access, confirmation, and an audit reason.`
      : props.audience === 'customer'
      ? 'Review customer referral rewards, integrity holds, and parent account activity.'
      : 'Review Partner referral rewards, integrity holds, and parent account activity.';
  const availableSummary = rewardSummaryByQueue.get('available') ?? { amount: 0, count: 0, reward: 'available' };
  const creditedSummary = rewardSummaryByQueue.get('credited') ?? { amount: 0, count: 0, reward: 'credited' };
  const pendingSummary = rewardSummaryByQueue.get('pending') ?? { amount: 0, count: 0, reward: 'pending' };
  const heldSummary = rewardSummaryByQueue.get('held') ?? { amount: 0, count: 0, reward: 'held' };
  const metrics: AdminPageMetric[] = [
    {
      kind: 'action',
      label: 'Ready to credit',
      scope: 'Needs action',
      value: <MoneyText amount={availableSummary.amount} currency={props.policy.currency} fallback="0 VND" />,
      helper: `${formatCount(availableSummary.count, 'reward candidate')} ready for a decision.`,
    },
    {
      kind: 'risk',
      label: 'On hold for review',
      scope: 'Risk',
      value: <MoneyText amount={heldSummary.amount} currency={props.policy.currency} fallback="0 VND" />,
      helper: `${formatCount(heldSummary.count, 'reward')} blocked for integrity or policy review.`,
    },
    {
      kind: 'action',
      label: 'Pending release',
      scope: 'Pending',
      value: <MoneyText amount={pendingSummary.amount} currency={props.policy.currency} fallback="0 VND" />,
      helper: `${formatCount(pendingSummary.count, 'reward')} waiting for booking or hold-period checks.`,
    },
    {
      kind: 'record',
      label: 'Credited rewards',
      scope: 'All records',
      value: <MoneyText amount={creditedSummary.amount} currency={props.policy.currency} fallback="0 VND" />,
      helper: `${formatCount(creditedSummary.count, 'reward')} already posted to wallets.`,
    },
  ];

  return (
    <AdminPageTemplate
      title={title}
      description={description}
      metrics={props.policyMode || props.readError ? undefined : metrics}
      actions={
        props.policyMode ? (
          <AdminFormControlLink className="button-secondary" href={referralListPath(props.audience)}>
            Back to referral operations
          </AdminFormControlLink>
        ) : (
          <>
            {props.canEditPolicy ? (
              <AdminFormControlLink className="button-outline" href={referralPolicySettingsHref(props.audience)}>
                Open policy settings
              </AdminFormControlLink>
            ) : null}
          </>
        )
      }
    >
      {props.readError ? (
        <AdminSection className="admin-mt-16" statusLabel="Unavailable" statusTone="danger" title="Referral data unavailable">
          <AdminInlineNotice role="alert" tone="danger">
            {props.readError}
          </AdminInlineNotice>
          <AdminTextLink className="admin-mt-8" href={props.policyMode ? referralPolicySettingsHref(props.audience) : referralListPath(props.audience)}>
            Retry
          </AdminTextLink>
        </AdminSection>
      ) : props.policyMode ? (
        <>
          {props.policyNotice ? (
            <AdminInlineNotice className="admin-mt-16" role="status" tone={props.policyNotice.tone}>
              {props.policyNotice.message}
            </AdminInlineNotice>
          ) : null}
          <ReferralPolicyPanel
            canEditPolicy={props.canEditPolicy}
            label={audienceTitle}
            openExposure={rewardOpenExposure(rewardQueueSummaries)}
            policy={props.policy}
          />
        </>
      ) : (
        <>
          {props.partialReadError ? (
            <AdminInlineNotice className="admin-mt-16" role="alert" tone="warning">
              {props.partialReadError}
            </AdminInlineNotice>
          ) : null}
          <ReferralListFilterPanel
            audience={props.audience}
            filteredCount={props.audience === 'customer' ? rewardRows.length : props.rows.length}
            filters={filters}
            rewardQueueSummaries={rewardQueueSummaries}
            totalCount={totalCount}
          />
          {props.audience === 'customer' ? (
            <>
              <CustomerReferralRewardQueueTable
                filters={filters}
                pagination={rewardPagination}
                rows={rewardPagination.rows}
              />
              <details className="referral-parent-records-disclosure admin-mt-16" open={parentRecordsLoaded || undefined} id="parent-records">
                <summary>All parent records · {formatCount(totalCount, 'parent account')}</summary>
                {parentRecordsLoaded ? (
                  <CustomerReferralParentTable
                    audience={props.audience}
                    emptyState={tableEmptyState}
                    filteredCount={props.rows.length}
                    filters={{ ...filters, reward: 'all' }}
                    pagination={pagination}
                    rows={pagination.rows}
                  />
                ) : (
                  <div className="referral-parent-records-load">
                    <p className="muted">Parent accounts are loaded only when needed, so reward queue decisions stay fast.</p>
                    <AdminTextLink href={props.parentRecordsHref ?? referralListPath('customer')}>Load parent accounts</AdminTextLink>
                  </div>
                )}
              </details>
              {props.canViewDeveloperSetup ? (
                props.fixtureRows && props.fixtureRows.length > 0 ? (
                  <section className="admin-mt-16 referral-fixture-diagnostics" aria-label="Developer referral fixture diagnostics">
                    <AdminInlineNotice role="alert" tone="danger">
                      TEST FIXTURE · wallet actions disabled. These records are excluded from operational counts and amounts.
                    </AdminInlineNotice>
                    <CustomerReferralRewardQueueTable
                      filters={{ ...filters, reward: 'all' }}
                      pagination={paginateReferralServerRows(props.fixtureRows, 1, props.fixtureRows.length, 50)}
                      rows={props.fixtureRows}
                    />
                  </section>
                ) : (
                  <AdminTextLink className="admin-mt-16" href="/referrals/customers?fixtures=include">
                    Inspect test fixtures
                  </AdminTextLink>
                )
              ) : null}
            </>
          ) : (
            <PartnerReferralParentTable
              audience={props.audience}
              emptyState={tableEmptyState}
              filteredCount={props.rows.length}
              filters={filters}
              pagination={pagination}
              rows={pagination.rows}
            />
          )}
          <ReferralAccountingGuardrailsPanel />
          <ReferralLinkReadinessPanel
            audience={props.audience}
            canViewDeveloperSetup={props.canViewDeveloperSetup ?? false}
          />
        </>
      )}
    </AdminPageTemplate>
  );
}

function ReferralAccountingGuardrailsPanel() {
  return (
    <AdminSection
      className="referral-accounting-guardrails-panel admin-mt-16"
      statusLabel="Accounting"
      statusTone="info"
      title="Referral accounting guardrails"
    >
      <AdminTraceSummary
        inferScope={false}
        metrics={[
          {
            key: 'expense-treatment',
            label: 'Expense treatment',
            value: 'Acquisition cost',
            detail: 'Referral rewards are company marketing/acquisition expenses, not reductions of platform fee revenue.',
          },
          {
            key: 'wallet-offsets',
            label: 'Wallet offsets',
            value: 'No revenue netting',
            detail: 'Wallet offsets settle payable and receivable balances. They must not reduce revenue.',
          },
          {
            key: 'customer-cashout',
            label: 'Customer cashout',
            value: 'Approval required',
            detail: 'Customer referral cashout requires admin approval and tax review.',
          },
          {
            key: 'tax-policy',
            label: 'Tax policy',
            value: 'Accounting owned',
            detail: 'Tax policies are configurable and must be confirmed by accounting before production use.',
          },
        ]}
      />
    </AdminSection>
  );
}

function ReferralLinkReadinessPanel({
  audience,
  canViewDeveloperSetup,
}: {
  readonly audience: ReferralAudienceSlug;
  readonly canViewDeveloperSetup: boolean;
}) {
  const audienceLabel = referralAudienceLabel(audience);
  const setupReady = referralStoreSetupReady(audience);

  return (
    <AdminSection
      className="referral-link-readiness-panel admin-mt-16"
      id="referral-link-readiness"
      statusLabel={setupReady ? 'Ready' : 'Setup blocked'}
      statusTone={setupReady ? 'success' : 'warning'}
      title="Referral link readiness"
    >
      <AdminTraceSummary
        inferScope={false}
        metrics={[
          {
            key: 'audience',
            label: 'Audience',
            value: audienceLabel,
            detail: `${audienceLabel} referral links route visitors to the correct store before attribution starts.`,
          },
          {
            key: 'public-route',
            label: 'Public route',
            value: `/r/${audience}/:code`,
            detail: 'Android and iOS visitors must land on the matching app download page.',
          },
          {
            key: 'setup-status',
            label: 'Setup status',
            value: 'Environment check',
            action: <ReferralStoreSetupStatus audience={audience} canViewDeveloperSetup={canViewDeveloperSetup} />,
          },
        ]}
      />
    </AdminSection>
  );
}

function ReferralListFilterPanel({
  audience,
  filteredCount,
  filters,
  rewardQueueSummaries,
  totalCount,
}: {
  readonly audience: ReferralAudienceSlug;
  readonly filteredCount: number;
  readonly filters: ReferralDashboardFilters;
  readonly rewardQueueSummaries: readonly ReferralRewardQueueSummary[];
  readonly totalCount: number;
}) {
  const activeFilters = referralActiveFilterLabels(filters);
  const rewardSummaryByQueue = new Map<ReferralDashboardRewardFilter, ReferralRewardQueueSummary>(
    rewardQueueSummaries.map((summary) => [summary.reward, summary]),
  );

  return (
    <AdminFilterPanel
      className="vuexy-customer-filter-card referral-dashboard-filter-panel admin-mt-16"
      resultLabel={`${filteredCount} of ${totalCount}`}
      resultTone={activeFilters.length > 0 ? 'warning' : 'info'}
      title="Referral operations filters"
      footer={
        activeFilters.length > 0 ? (
          <div className="vuexy-customer-filter-footer admin-directory-filter-footer">
            <AdminFilterSummary
              ariaLabel="Active referral filters"
              className="vuexy-customer-active-filters"
              labels={activeFilters}
            />
          </div>
        ) : null
      }
    >
      <div className="booking-date-filter-bar admin-mb-14" aria-label="Referral reward operation queue">
        <AdminSegmentedControl
          activeValue={filters.reward}
          ariaLabel="Referral reward state"
          className="referral-reward-filter-buttons"
          options={referralRewardQuickFilterOptions.map((option) => ({
            href: buildReferralListHref(audience, filters, { reward: option.reward }),
            label: (
              <>
                <span>{option.label}</span>
                <span className="referral-reward-filter-meta">
                  <ReferralRewardQueueSummaryText summary={rewardSummaryByQueue.get(option.reward)} />
                </span>
              </>
            ),
            title: option.description,
            value: option.reward,
          }))}
        />
      </div>
      <AdminDirectoryFilterForm action={referralListPath(audience)} className="vuexy-customer-form referral-dashboard-filter-form">
        <input name="reward" type="hidden" value={filters.reward} />
        <div className="vuexy-customer-filter-grid admin-directory-filter-grid">
          <div className="vuexy-customer-filter-group admin-directory-filter-group is-primary" aria-label="Referral list filters">
            <AdminFormSearch
              className="admin-directory-filter-search"
              defaultValue={filters.q}
              label="Search referrals"
              name="q"
              placeholder="Search parent, code, referred account"
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.status}
              label="Attribution"
              name="status"
              options={referralStatusFilterOptions}
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.fraud ?? 'all'}
              label="Integrity review"
              name="fraud"
              options={referralFraudFilterOptions}
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.range ?? 'all'}
              label="Referral period"
              name="range"
              options={referralRangeFilterOptions}
            />
          </div>
          <div className="vuexy-customer-filter-actions admin-directory-filter-actions" aria-label="Referral filter actions">
            {activeFilters.length > 0 ? (
              <AdminFormControlLink className="admin-directory-filter-button is-ghost" href={referralListPath(audience)}>
                Clear
              </AdminFormControlLink>
            ) : null}
            <AdminFormControlButton className="admin-directory-filter-button">Apply</AdminFormControlButton>
          </div>
        </div>
      </AdminDirectoryFilterForm>
    </AdminFilterPanel>
  );
}

function ReferralPolicyPanel({
  canEditPolicy = true,
  label,
  openExposure = { amount: 0, count: 0 },
  policy,
}: ReferralPolicyPanelProps) {
  const percentLabel =
    policy.rewardMode === 'COMMISSION_PERCENT' && policy.commissionPercentBps !== null
      ? `${(Number(policy.commissionPercentBps ?? 0) / 100).toFixed(2)}%`
      : 'Not set';
  const platformFeeVatLabel = formatBpsPercent(policy.platformFeeVatRateBps);

  return (
    <AdminSection
      className="referral-policy-panel admin-mt-16"
      description={
        canEditPolicy
          ? `Review the current ${label} values before editing. One confirmed save writes the policy and audit event together.`
          : `${label} policy is shown read-only for this operator.`
      }
      statusLabel={policy.enabled ? 'Enabled' : 'Disabled'}
      statusTone={policy.enabled ? 'success' : 'neutral'}
      title="Referral policy"
    >
      {policy.notes?.toLowerCase().includes('smoke') ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="warning">
          Test policy marker detected. Review the fixture inventory and audit history before any approved restore.
        </AdminInlineNotice>
      ) : null}
      <AdminTraceSummary
        inferScope={false}
        metrics={[
          {
            key: 'reward-mode',
            label: 'Reward mode',
            value: policy.rewardMode === 'COMMISSION_PERCENT' ? 'Commission %' : 'Fixed amount',
            detail: policy.source === 'stored-policy' ? 'Stored policy' : 'Default disabled',
          },
          {
            key: 'customer-percent',
            label: 'Customer percent',
            value: percentLabel,
            detail: 'Applied only after a qualifying completed booking.',
          },
          ...(policy.rewardMode === 'FIXED_AMOUNT'
            ? [{
                key: 'fixed-reward',
                label: 'Fixed reward',
                value: <MoneyText amount={policy.fixedRewardAmount} currency={policy.currency} />,
                detail: 'Reward amount for each qualifying Partner referral.',
              }]
            : []),
          {
            key: 'hold-period',
            label: 'Hold period',
            value: formatCount(policy.holdPeriodDays, 'day'),
            detail: 'Wallet credit can stay pending until this window passes.',
          },
          {
            key: 'platform-fee-vat',
            label: 'Platform fee VAT',
            value: platformFeeVatLabel,
            detail: 'Removed from gross platform fee before customer referral reward calculation.',
          },
          {
            key: 'per-user-cap',
            label: 'Per-user cap',
            value: <MoneyText amount={policy.totalRewardCapAmount} currency={policy.currency} />,
            detail: 'Maximum total referral rewards per parent account.',
          },
          {
            key: 'per-reward-cap',
            label: 'Per-reward cap',
            value: policy.perRewardCapAmount === null || policy.perRewardCapAmount === undefined
              ? 'Not set'
              : <MoneyText amount={policy.perRewardCapAmount} currency={policy.currency} />,
            detail: 'Maximum liability created by one qualifying referral reward.',
          },
          {
            key: 'max-rewarded-referrals',
            label: 'Max rewarded referrals',
            value: policy.maxRewardedReferrals ?? 'Not set',
            detail: 'Manual policy limit for rewardable referred accounts.',
          },
        ]}
      />
      {canEditPolicy ? <ReferralPolicyForm openExposure={openExposure} policy={policy} /> : null}
    </AdminSection>
  );
}

function referralPolicySettingsHref(audience: ReferralAudienceSlug) {
  return `${referralListPath(audience)}?settings=policy`;
}

function CustomerReferralRewardQueueTable({
  filters,
  pagination,
  rows,
}: {
  readonly filters: ReferralDashboardFilters;
  readonly pagination: ReferralPaginationModel<AdminCustomerReferralRewardQueueRow>;
  readonly rows: readonly AdminCustomerReferralRewardQueueRow[];
}) {
  const hasFilters = referralHasAdditionalFilters(filters);
  const copy = referralRewardQueueCopy[filters.reward];

  return (
    <AdminTablePanel
      className="referral-reward-queue-panel"
      description={copy.description}
      resultLabel={formatCount(pagination.totalCount, 'reward')}
      resultTone={pagination.totalCount > 0 ? 'warning' : 'info'}
      title={copy.title}
    >
      <AdminTableScroll ariaLabel="Customer referral reward queue">
        <AdminDataTable
          className="vuexy-customer-table referral-reward-queue-table"
          emptyMessage={
            <>
              <AdminEmptyState
                message={hasFilters ? 'No reward records match the current filters.' : copy.emptyMessage}
                title={hasFilters ? 'No matching reward records' : copy.emptyTitle}
              />
              {hasFilters ? (
                <AdminTextLink className="admin-mt-8" href={referralListPath('customer')}>
                  Clear referral filters
                </AdminTextLink>
              ) : null}
            </>
          }
          headers={['Relationship', 'Evidence', 'Reward', 'Decision', 'Action']}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="referral-reward-relationship-cell">
                {row.isFixture ? <StatusBadge tone="danger">TEST FIXTURE</StatusBadge> : null}
                <strong>{row.parent.label}</strong>
                <span className="muted">{row.parent.phone ?? shortId(row.parent.id)}</span>
                <span className="referral-relationship-arrow" aria-hidden="true">→</span>
                {row.referred.href ? <AdminTextLink href={row.referred.href}>{row.referred.label}</AdminTextLink> : <span>{row.referred.label}</span>}
                <span className="muted">{row.referred.phone ?? shortId(row.referred.id)}</span>
              </td>
              <td className="referral-reward-evidence-cell">
                {row.qualifyingBookingId ? (
                  <AdminTextLink href={`/bookings/${encodeURIComponent(row.qualifyingBookingId)}`}>
                    Booking {shortId(row.qualifyingBookingId)} linked
                  </AdminTextLink>
                ) : <strong className="text-danger">Booking evidence missing</strong>}
                <span>{referralStatusLabel(row.attribution.status)}</span>
                <span>{fraudReviewStatusLabel(row.attribution.fraudReviewStatus)}</span>
                {row.evidence?.blocker ? <span className="text-danger">Blocked: {row.evidence.blocker.message}</span> : null}
              </td>
              <td className="referral-reward-value-cell">
                <strong><MoneyText amount={row.amount} currency={row.currency} fallback="0 VND" /></strong>
                <StatusBadge tone={referralRewardStatusTone(row.status)}>{referralRewardStatusLabel(row.status)}</StatusBadge>
              </td>
              <td className="referral-reward-decision-cell">
                <strong>{row.latestDecision ? referralRewardDecisionLabel(row.latestDecision.action) : 'Awaiting decision'}</strong>
                <span className="muted">
                  {row.latestDecision ? <>By {row.latestDecision.actor?.fullName ?? row.latestDecision.actor?.email ?? 'admin'} · <DateTimeText value={row.latestDecision.createdAt} /></> : row.availableAt ? <>Eligible since <DateTimeText value={row.availableAt} /></> : <>Updated <DateTimeText value={row.updatedAt} /></>}
                </span>
              </td>
              <td className="referral-reward-action-cell">
                {row.isFixture ? (
                  <AdminInlineFallback>Inspection only</AdminInlineFallback>
                ) : row.detailHref ? (
                  <AdminTextLink href={`${row.detailHref}?rewardId=${encodeURIComponent(row.id)}`}>
                    Review
                  </AdminTextLink>
                ) : (
                  <AdminInlineFallback>Detail unavailable</AdminInlineFallback>
                )}
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      {pagination.totalPages > 1 ? (
        <AdminTablePaginationFooter
          activePage={pagination.currentPage}
          ariaLabel="Customer referral reward pagination"
          className="referral-pagination"
          from={pagination.startItem}
          hrefForPage={(page) => buildReferralListHref('customer', filters, {}, page)}
          paginationClassName="referral-pagination-buttons"
          summaryLabel={`Showing ${pagination.startItem}-${pagination.endItem} of ${pagination.totalCount}`}
          to={pagination.endItem}
          totalPages={pagination.totalPages}
          totalRows={pagination.totalCount}
        />
      ) : null}
    </AdminTablePanel>
  );
}

function CustomerReferralParentTable({
  audience,
  emptyState,
  filteredCount,
  filters,
  pagination,
  rows,
}: {
  readonly audience: ReferralAudienceSlug;
  readonly emptyState: ReferralEmptyStateProps;
  readonly filteredCount: number;
  readonly filters: ReferralDashboardFilters;
  readonly pagination: ReferralPaginationModel<AdminCustomerReferralParent>;
  readonly rows: readonly AdminCustomerReferralParent[];
}) {
  return (
    <AdminTablePanel
      className="vuexy-customer-table-card"
      description="Open a parent to review referred customers, qualifying bookings, and reward evidence."
      resultLabel={formatCount(filteredCount, 'parent account')}
      resultTone="info"
      title="Customer referral operations"
    >
      <AdminTableScroll ariaLabel="Customer referral parent records">
        <AdminDataTable
          className="vuexy-customer-table referral-parent-operations-table referral-customer-operations-table"
          emptyMessage={<ReferralEmptyState {...emptyState} />}
          headers={['Parent', 'Referral code', 'Referred', 'Needs action', 'Latest activity', 'Referral link']}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.referrer.id}>
              <td>
                <AdminPersonCell
                  avatarClassName="vuexy-booking-avatar"
                  className="vuexy-booking-person"
                  copyClassName="vuexy-booking-person-copy"
                  helper={row.referrer.user?.phone}
                  href={referralParentDetailHref('customer', row.referrer.id)}
                  label={userLabel(row.referrer.user, 'Unknown customer')}
                  linkClassName="vuexy-booking-person-link"
                />
              </td>
              <td>
                <ReferralCodeCell code={row.referralCode} />
              </td>
              <td>
                <ReferralTotalsCell
                  referralCount={numberOrZero(row.totals.referralCount)}
                  rewardCount={numberOrZero(row.totals.rewardCount)}
                />
              </td>
              <td>
                <ReferralRewardCell
                  availableAmount={numberOrZero(row.totals.availableRewardAmount)}
                  creditedAmount={numberOrZero(row.totals.rewardedRewardAmount)}
                  heldAmount={numberOrZero(row.totals.heldRewardAmount)}
                  pendingAmount={numberOrZero(row.totals.pendingRewardAmount)}
                />
              </td>
              <td>
                <LatestCustomerReferralCell row={row} />
              </td>
              <td>
                <ReferralPublicLinkCell
                  audience="customer"
                  referralCode={row.referralCode?.code}
                />
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <ReferralParentPagination audience={audience} filters={filters} pagination={pagination} />
    </AdminTablePanel>
  );
}

function PartnerReferralParentTable({
  audience,
  emptyState,
  filteredCount,
  filters,
  pagination,
  rows,
}: {
  readonly audience: ReferralAudienceSlug;
  readonly emptyState: ReferralEmptyStateProps;
  readonly filteredCount: number;
  readonly filters: ReferralDashboardFilters;
  readonly pagination: ReferralPaginationModel<AdminPartnerReferralParent>;
  readonly rows: readonly AdminPartnerReferralParent[];
}) {
  return (
    <AdminTablePanel
      description="Parent Partner accounts only. The full Partner directory stays in Partners."
      resultLabel={formatCount(filteredCount, 'parent account')}
      resultTone="info"
      title="Partner referral parents"
    >
      <AdminTableScroll ariaLabel="Partner referral parent records">
        <AdminDataTable
          className="vuexy-booking-table referral-parent-operations-table referral-partner-operations-table"
          emptyMessage={<ReferralEmptyState {...emptyState} />}
          headers={['Parent Partner', 'Referral Code', 'Referrals', 'Rewards', 'Latest Referral', 'Actions']}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.referrer.id}>
              <td>
                <AdminPersonCell
                  avatarClassName="vuexy-booking-avatar"
                  className="vuexy-booking-person"
                  copyClassName="vuexy-booking-person-copy"
                  helper={row.referrer.user?.phone}
                  href={referralParentDetailHref('partner', row.referrer.id)}
                  label={row.referrer.displayName ?? userLabel(row.referrer.user, 'Unknown Partner')}
                  linkClassName="vuexy-booking-person-link"
                />
              </td>
              <td>
                <ReferralCodeCell code={row.referralCode} />
              </td>
              <td>
                <ReferralTotalsCell
                  referralCount={numberOrZero(row.totals.referralCount)}
                  rewardCount={numberOrZero(row.totals.rewardCount)}
                />
              </td>
              <td>
                <ReferralRewardCell
                  availableAmount={numberOrZero(row.totals.availableRewardAmount)}
                  creditedAmount={numberOrZero(row.totals.rewardedRewardAmount)}
                  heldAmount={numberOrZero(row.totals.heldRewardAmount)}
                  pendingAmount={numberOrZero(row.totals.pendingRewardAmount)}
                />
              </td>
              <td>
                <LatestPartnerReferralCell row={row} />
              </td>
              <td>
                <ReferralParentActions
                  audience="partner"
                  parentId={row.referrer.id}
                  referralCode={row.referralCode?.code}
                />
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <ReferralParentPagination audience={audience} filters={filters} pagination={pagination} />
    </AdminTablePanel>
  );
}

function ReferralParentPagination({
  audience,
  filters,
  pagination,
}: {
  readonly audience: ReferralAudienceSlug;
  readonly filters: ReferralDashboardFilters;
  readonly pagination: ReferralPaginationModel<ReferralParentRow>;
}) {
  if (pagination.totalPages <= 1) {
    return null;
  }

  return (
    <AdminTablePaginationFooter
      activePage={pagination.currentPage}
      ariaLabel="Referral parent pagination"
      className="referral-pagination"
      from={pagination.startItem}
      hrefForPage={(page) => buildReferralListHref(audience, filters, {}, page)}
      paginationClassName="referral-pagination-buttons"
      summaryLabel={`Showing ${pagination.startItem}-${pagination.endItem} of ${pagination.totalCount}`}
      to={pagination.endItem}
      totalPages={pagination.totalPages}
      totalRows={pagination.totalCount}
      trailing={
        <span className="referral-pagination-page">
          Page {pagination.currentPage} of {pagination.totalPages}
        </span>
      }
    />
  );
}

function ReferralCodeCell({
  code,
}: {
  readonly code?: { readonly active: boolean; readonly code: string; readonly createdAt: string } | null;
}) {
  if (!code) {
    return <AdminInlineFallback>No code</AdminInlineFallback>;
  }

  return (
    <div>
      <strong>{code.code}</strong>
      <AdminFilterChipGroup className="admin-mt-8">
        <StatusBadge tone={code.active ? 'success' : 'neutral'}>{code.active ? 'Active' : 'Paused'}</StatusBadge>
        <small className="muted">
          <DateTimeText value={code.createdAt} />
        </small>
      </AdminFilterChipGroup>
    </div>
  );
}

function ReferralParentActions({
  audience,
  parentId,
  referralCode,
}: {
  readonly audience: ReferralAudienceSlug;
  readonly parentId: string;
  readonly referralCode?: string | null;
}) {
  const profileHref = audience === 'partner' ? `/partners/${parentId}` : `/customers/${parentId}`;
  const actions: ActionMenuItem[] = [
    {
      href: referralParentDetailHref(audience, parentId),
      kind: 'link',
      label: 'Open referral detail',
      tone: 'info',
    },
    {
      href: profileHref,
      kind: 'link',
      label: 'Open parent profile',
      tone: 'neutral',
    },
  ];

  if (referralCode) {
    actions.push({
      href: referralShareUrl(audience, referralCode),
      kind: 'link',
      label: 'Open referral link',
      tone: 'success',
    });
  }

  return (
    <ActionMenu
      actions={actions}
      className="referral-parent-action-dropdown"
      label={`Referral parent actions for ${parentId}`}
      title="Parent actions"
      variant="dropdown"
    />
  );
}

function ReferralPublicLinkCell({
  audience,
  referralCode,
}: {
  readonly audience: ReferralAudienceSlug;
  readonly referralCode?: string | null;
}) {
  if (!referralCode) {
    return <AdminInlineFallback>No link</AdminInlineFallback>;
  }

  if (!referralStoreSetupReady(audience)) {
    return <AdminInlineFallback>Setup blocked</AdminInlineFallback>;
  }

  return (
    <AdminTextLink className="referral-parent-public-link" href={referralShareUrl(audience, referralCode)}>
      Open referral link
    </AdminTextLink>
  );
}

function ReferralTotalsCell({
  referralCount,
  rewardCount,
}: {
  readonly referralCount: number;
  readonly rewardCount: number;
}) {
  return (
    <div>
      <strong>{formatCount(referralCount, 'referral')}</strong>
      <p className="muted">{rewardCount} reward record(s)</p>
    </div>
  );
}

function ReferralRewardCell({
  availableAmount,
  creditedAmount,
  heldAmount,
  pendingAmount,
}: {
  readonly availableAmount: number;
  readonly creditedAmount: number;
  readonly heldAmount: number;
  readonly pendingAmount: number;
}) {
  return (
    <div className="referral-parent-reward-summary">
      <strong>
        Ready <MoneyText amount={availableAmount} fallback="0 VND" />
      </strong>
      <AdminFilterChipGroup className="admin-mt-8">
        {heldAmount > 0 ? <StatusBadge tone="warning">On hold <MoneyText amount={heldAmount} fallback="0 VND" /></StatusBadge> : null}
        {pendingAmount > 0 ? <StatusBadge tone="info">Pending <MoneyText amount={pendingAmount} fallback="0 VND" /></StatusBadge> : null}
        {creditedAmount > 0 ? <StatusBadge tone="success">Credited <MoneyText amount={creditedAmount} fallback="0 VND" /></StatusBadge> : null}
        {availableAmount === 0 && heldAmount === 0 && pendingAmount === 0 ? (
          <StatusBadge tone="neutral">No open reward</StatusBadge>
        ) : null}
      </AdminFilterChipGroup>
    </div>
  );
}

function LatestCustomerReferralCell({ row }: { readonly row: AdminCustomerReferralParent }) {
  const referral = row.referrals[0];
  if (!referral) return <AdminInlineFallback>No referral activity</AdminInlineFallback>;

  return (
    <div>
      <AdminPersonCell
        avatarClassName="vuexy-booking-avatar"
        className="vuexy-booking-person"
        copyClassName="vuexy-booking-person-copy"
        helper={referral.referredCustomer?.user?.phone}
        href={referral.referredCustomer ? `/customers/${referral.referredCustomer.id}` : null}
        label={userLabel(referral.referredCustomer?.user, 'Unknown customer')}
        linkClassName="vuexy-booking-person-link"
      />
      <ReferralStatusLine
        createdAt={referral.createdAt}
        fraudReviewStatus={referral.fraudReviewStatus}
        platform={referral.platform}
        status={referral.status}
      />
    </div>
  );
}

function LatestPartnerReferralCell({ row }: { readonly row: AdminPartnerReferralParent }) {
  const referral = row.referrals[0];
  if (!referral) return <AdminInlineFallback>No referral activity</AdminInlineFallback>;

  return (
    <div>
      <AdminPersonCell
        avatarClassName="vuexy-booking-avatar"
        className="vuexy-booking-person"
        copyClassName="vuexy-booking-person-copy"
        helper={referral.referredPartner?.user?.phone}
        href={referral.referredPartner ? `/partners/${referral.referredPartner.id}` : null}
        label={referral.referredPartner?.displayName ?? userLabel(referral.referredPartner?.user, 'Unknown Partner')}
        linkClassName="vuexy-booking-person-link"
      />
      <ReferralStatusLine
        createdAt={referral.createdAt}
        fraudReviewStatus={referral.fraudReviewStatus}
        platform={referral.platform}
        status={referral.status}
      />
    </div>
  );
}

function ReferralStatusLine({
  createdAt,
  fraudReviewStatus,
  platform,
  status,
}: {
  readonly createdAt: string;
  readonly fraudReviewStatus: string;
  readonly platform?: string | null;
  readonly status: string;
}) {
  return (
    <AdminFilterChipGroup className="admin-mt-8">
      <StatusBadge tone={referralStatusTone(status)}>{referralStatusLabel(status)}</StatusBadge>
      <StatusBadge tone={fraudReviewStatus === 'CLEAR' ? 'success' : 'warning'}>
        {fraudReviewStatusLabel(fraudReviewStatus)}
      </StatusBadge>
      <small className="muted">
        {platform ? `${platform} · ` : ''}
        <DateTimeText value={createdAt} />
      </small>
    </AdminFilterChipGroup>
  );
}

function ReferralEmptyState({
  activeFilters = [],
  audienceLabel,
  clearHref,
  totalCount = 0,
}: ReferralEmptyStateProps) {
  if (activeFilters.length > 0 && totalCount > 0) {
    return (
      <>
        <AdminEmptyState
          message={`${totalCount} parent account${totalCount === 1 ? ' exists' : 's exist'}, but none match the current filters.`}
          title={`No matching ${audienceLabel} referral parents`}
        />
        <AdminFilterSummary
          ariaLabel="Active referral filters"
          className="admin-mt-8"
          labels={activeFilters}
        />
        {clearHref ? (
          <AdminTextLink className="admin-mt-8" href={clearHref}>
            Clear referral filters
          </AdminTextLink>
        ) : null}
      </>
    );
  }

  return (
    <AdminEmptyState
      message="Parents appear here only after at least one referral attribution is recorded."
      title={`No ${audienceLabel} referral parents yet`}
    />
  );
}

function referralStatusTone(status: string) {
  if (status === 'REWARDED' || status === 'QUALIFIED') return 'success';
  if (status === 'BLOCKED' || status === 'CANCELLED') return 'danger';
  return 'info';
}

function userLabel(user: AdminReferralUserSummary | null | undefined, fallback: string) {
  return user?.fullName ?? user?.phone ?? user?.email ?? fallback;
}

function referralRewardStatusTone(status: string) {
  if (status === 'AVAILABLE') return 'warning';
  if (status === 'HELD' || status === 'REVERSED' || status === 'CANCELLED') return 'danger';
  if (status === 'CREDITED' || status === 'PAID') return 'success';
  return 'info';
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function referralStatusLabel(status: string) {
  const labels: Record<string, string> = {
    BLOCKED: 'Blocked',
    CANCELLED: 'Cancelled',
    PENDING: 'Pending checks',
    QUALIFIED: 'Qualified',
    REWARDED: 'Rewarded',
  };
  return labels[status] ?? status.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function fraudReviewStatusLabel(status: string) {
  const labels: Record<string, string> = {
    CLEAR: 'Integrity clear',
    HELD: 'Integrity hold',
    REVIEW: 'Integrity review',
  };
  return labels[status] ?? `Integrity ${status.replaceAll('_', ' ').toLowerCase()}`;
}

function referralRewardStatusLabel(status: string) {
  const labels: Record<string, string> = {
    AVAILABLE: 'Ready to credit',
    CANCELLED: 'Cancelled',
    CASHOUT_APPROVED: 'Cashout approved',
    CASHOUT_REQUESTED: 'Cashout requested',
    CREDITED: 'Credited',
    HELD: 'On hold',
    LOCKED: 'Processing',
    PAID: 'Paid',
    PENDING: 'Pending checks',
    REVERSED: 'Reversed',
    TAX_REVIEW_REQUIRED: 'Tax review required',
  };
  return labels[status] ?? status.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function referralStoreSetupReady(audience: ReferralAudienceSlug) {
  const setup = referralStoreSetupState(audience);
  return setup.publicBase && setup.android && setup.ios;
}

function shortId(value: string) {
  return value.length <= 10 ? value : `${value.slice(0, 8)}...`;
}

function numberOrZero(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function formatBpsPercent(value: number | null | undefined) {
  const percent = Number(value ?? 0) / 100;

  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%`;
}

const defaultReferralDashboardFilters: ReferralDashboardFilters = {
  fraud: 'all',
  q: '',
  range: 'all',
  reward: 'attention',
  status: 'all',
};

const referralStatusFilterOptions = [
  { label: 'All statuses', value: 'all' },
  { label: 'Qualified', value: 'qualified' },
  { label: 'Pending', value: 'pending' },
  { label: 'Blocked', value: 'blocked' },
] as const;

const referralFraudFilterOptions = [
  { label: 'All review states', value: 'all' },
  { label: 'Clear', value: 'clear' },
  { label: 'Flagged', value: 'flagged' },
  { label: 'On hold', value: 'held' },
] as const;

const referralRangeFilterOptions = [
  { label: 'All referral dates', value: 'all' },
  { label: 'Today (Vietnam)', value: 'today' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
] as const;

const referralRewardQuickFilterOptions: readonly {
  readonly description: string;
  readonly label: string;
  readonly reward: ReferralDashboardRewardFilter;
}[] = [
  {
    description: 'Rewards that are ready, pending, or on hold and still need an operational outcome.',
    label: 'Needs action',
    reward: 'attention',
  },
  {
    description: 'Show every referral parent with the current search and status filters.',
    label: 'All records',
    reward: 'all',
  },
  {
    description: 'Reward candidates ready for operator wallet credit or hold.',
    label: 'Ready to credit',
    reward: 'available',
  },
  {
    description: 'Rewards still waiting for booking, hold-period, or policy checks.',
    label: 'Pending checks',
    reward: 'pending',
  },
  {
    description: 'Rewards on hold for operator integrity, policy, or support review.',
    label: 'On-hold review',
    reward: 'held',
  },
  {
    description: 'Rewards already posted to customer or Partner wallets.',
    label: 'Credited',
    reward: 'credited',
  },
];

const referralRewardQueueCopy: Record<ReferralDashboardRewardFilter, {
  readonly description: string;
  readonly emptyMessage: string;
  readonly emptyTitle: string;
  readonly title: string;
}> = {
  attention: {
    description: 'Review rewards that still need a finance or integrity decision.',
    emptyMessage: 'No customer referral rewards currently need action.',
    emptyTitle: 'No reward work',
    title: 'Needs action',
  },
  available: {
    description: 'Review rewards that completed the required evidence checks before wallet credit.',
    emptyMessage: 'No rewards have completed the required evidence checks.',
    emptyTitle: 'Nothing ready to credit',
    title: 'Ready to credit',
  },
  held: {
    description: 'Review rewards currently held for integrity, policy, or support review.',
    emptyMessage: 'No rewards are currently held for review.',
    emptyTitle: 'No held rewards',
    title: 'On hold',
  },
  pending: {
    description: 'Review rewards waiting for the hold period or automated evidence checks.',
    emptyMessage: 'No rewards are waiting for the hold period or automated checks.',
    emptyTitle: 'No pending rewards',
    title: 'Pending checks',
  },
  credited: {
    description: 'Review referral rewards already posted to wallet liability.',
    emptyMessage: 'No customer referral rewards have been posted to wallet.',
    emptyTitle: 'No credited rewards',
    title: 'Credited history',
  },
  all: {
    description: 'Review all non-fixture customer referral reward records.',
    emptyMessage: 'No customer referral reward records are available.',
    emptyTitle: 'No reward records',
    title: 'All reward records',
  },
};

type ReferralParentRow = AdminCustomerReferralParent | AdminPartnerReferralParent;

export function buildReferralDashboardFilters(
  params: Record<string, string | string[] | undefined>,
): ReferralDashboardFilters {
  return {
    fraud: normalizeReferralFraudFilter(readSearchParam(params.fraud)),
    q: readSearchParam(params.q),
    range: normalizeReferralRangeFilter(readSearchParam(params.range)),
    reward: normalizeReferralRewardFilter(readSearchParam(params.reward)),
    status: normalizeReferralStatusFilter(readSearchParam(params.status)),
  };
}

export function buildReferralDashboardPage(params: Record<string, string | string[] | undefined>): number {
  const page = Number.parseInt(readSearchParam(params.page), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function buildReferralListHref(
  audience: ReferralAudienceSlug,
  filters: ReferralDashboardFilters,
  overrides: Partial<ReferralDashboardFilters> = {},
  page = 1,
) {
  const next: ReferralDashboardFilters = {
    ...filters,
    ...overrides,
    fraud: overrides.fraud ?? filters.fraud ?? 'all',
    range: overrides.range ?? filters.range ?? 'all',
  };
  const params = new URLSearchParams();

  if (next.q) params.set('q', next.q);
  if (next.status !== 'all') params.set('status', next.status);
  if (next.fraud !== 'all') params.set('fraud', next.fraud);
  if (next.range !== 'all') params.set('range', next.range);
  if (next.reward !== 'attention') params.set('reward', next.reward);
  if (page > 1) params.set('page', String(page));

  const query = params.toString();
  return query ? `${referralListPath(audience)}?${query}` : referralListPath(audience);
}

export function buildReferralParentApiHref(
  audience: ReferralAudienceSlug,
  filters: ReferralDashboardFilters,
  currentPage: number,
) {
  const params = new URLSearchParams();
  const page = Math.max(1, Math.trunc(currentPage));
  const skip = (page - 1) * referralListPageSize;
  params.set('take', String(referralListPageSize));
  if (skip > 0) {
    params.set('skip', String(skip));
  }
  appendReferralParentApiFilterParams(params, filters);

  return `/admin/referrals/${audience === 'partner' ? 'partners' : 'customers'}?${params.toString()}`;
}

export function buildReferralParentSummaryApiHref(
  audience: ReferralAudienceSlug,
  filters: ReferralDashboardFilters,
) {
  const params = new URLSearchParams();
  appendReferralParentApiFilterParams(params, filters);
  const query = params.toString();
  const baseHref = `/admin/referrals/${audience === 'partner' ? 'partners' : 'customers'}/summary`;
  return query ? `${baseHref}?${query}` : baseHref;
}

export function buildReferralRewardQueueApiHref(filters: ReferralDashboardFilters, currentPage: number) {
  const params = new URLSearchParams();
  const page = Math.max(1, Math.trunc(currentPage));
  const skip = (page - 1) * referralListPageSize;
  params.set('take', String(referralListPageSize));
  if (skip > 0) params.set('skip', String(skip));
  appendReferralParentApiFilterParams(params, filters);
  return `/admin/referrals/customers/rewards?${params.toString()}`;
}

export function buildReferralCustomerWorkspaceApiHref(filters: ReferralDashboardFilters, currentPage: number) {
  return buildReferralRewardQueueApiHref(filters, currentPage).replace('/rewards?', '/workspace?');
}

export function buildReferralParentRecordsHref(filters: ReferralDashboardFilters, currentPage: number) {
  const href = buildReferralListHref('customer', filters, {}, currentPage);
  return `${href}${href.includes('?') ? '&' : '?'}parents=open#parent-records`;
}

export function paginateReferralRows<T>(
  rows: readonly T[],
  currentPage: number,
  pageSize = referralListPageSize,
): ReferralPaginationModel<T> {
  const safePageSize = Math.max(1, Math.trunc(pageSize));
  const totalPages = Math.max(1, Math.ceil(rows.length / safePageSize));
  const page = Math.min(Math.max(1, Math.trunc(currentPage)), totalPages);
  const startIndex = rows.length > 0 ? (page - 1) * safePageSize : 0;
  const pageRows = rows.slice(startIndex, startIndex + safePageSize);
  const startItem = rows.length > 0 ? startIndex + 1 : 0;
  const endItem = rows.length > 0 ? startIndex + pageRows.length : 0;

  return {
    currentPage: page,
    endItem,
    rows: pageRows,
    startItem,
    totalCount: rows.length,
    totalPages,
  };
}

function paginateReferralServerRows<T>(
  rows: readonly T[],
  currentPage: number,
  totalCount: number,
  pageSize = referralListPageSize,
): ReferralPaginationModel<T> {
  const safePageSize = Math.max(1, Math.trunc(pageSize));
  const safeTotalCount = Math.max(0, Math.trunc(totalCount));
  const totalPages = Math.max(1, Math.ceil(safeTotalCount / safePageSize));
  const page = Math.min(Math.max(1, Math.trunc(currentPage)), totalPages);
  const startIndex = safeTotalCount > 0 && rows.length > 0 ? (page - 1) * safePageSize : 0;
  const startItem = rows.length > 0 ? startIndex + 1 : 0;
  const endItem = rows.length > 0 ? Math.min(startIndex + rows.length, safeTotalCount) : 0;

  return {
    currentPage: page,
    endItem,
    rows,
    startItem,
    totalCount: safeTotalCount,
    totalPages,
  };
}

export function filterReferralParentRows<T extends ReferralParentRow>(
  audience: ReferralAudienceSlug,
  rows: readonly T[],
  filters: ReferralDashboardFilters,
): T[] {
  return rows.filter(
    (row) =>
      referralParentMatchesSearch(audience, row, filters.q) &&
      referralParentMatchesStatus(row, filters.status) &&
      referralParentMatchesFraud(row, filters.fraud) &&
      referralParentMatchesRange(row, filters.range) &&
      referralParentMatchesReward(row, filters.reward),
  );
}

export function buildReferralRewardQueueSummaries(
  rows: readonly ReferralParentRow[],
): readonly ReferralRewardQueueSummary[] {
  const allSummary = { amount: 0, count: 0, reward: 'all' as const };
  const attentionSummary = { amount: 0, count: 0, reward: 'attention' as const };
  const availableSummary = { amount: 0, count: 0, reward: 'available' as const };
  const creditedSummary = { amount: 0, count: 0, reward: 'credited' as const };
  const pendingSummary = { amount: 0, count: 0, reward: 'pending' as const };
  const heldSummary = { amount: 0, count: 0, reward: 'held' as const };

  for (const row of rows) {
    const availableAmount = numberOrZero(row.totals.availableRewardAmount);
    const creditedAmount = numberOrZero(row.totals.rewardedRewardAmount);
    const pendingAmount = numberOrZero(row.totals.pendingRewardAmount);
    const heldAmount = numberOrZero(row.totals.heldRewardAmount);
    const availableCount = numberOrZero(row.totals.availableRewardCount);
    const creditedCount = numberOrZero(row.totals.rewardedRewardCount);
    const pendingCount = numberOrZero(row.totals.pendingRewardCount);
    const heldCount = numberOrZero(row.totals.heldRewardCount);

    availableSummary.amount += availableAmount;
    availableSummary.count += availableCount;
    creditedSummary.amount += creditedAmount;
    creditedSummary.count += creditedCount;
    pendingSummary.amount += pendingAmount;
    pendingSummary.count += pendingCount;
    heldSummary.amount += heldAmount;
    heldSummary.count += heldCount;
    allSummary.amount +=
      numberOrZero(row.totals.totalRewardAmount) || availableAmount + creditedAmount + pendingAmount + heldAmount;
    allSummary.count += numberOrZero(row.totals.rewardCount) || availableCount + creditedCount + pendingCount + heldCount;
    attentionSummary.amount += availableAmount + pendingAmount + heldAmount;
    attentionSummary.count += availableCount + pendingCount + heldCount;
  }

  return [attentionSummary, allSummary, availableSummary, pendingSummary, heldSummary, creditedSummary];
}

function rewardOpenExposure(summaries: readonly ReferralRewardQueueSummary[]) {
  return summaries.reduce(
    (total, summary) =>
      ['available', 'held', 'pending'].includes(summary.reward)
        ? { amount: total.amount + summary.amount, count: total.count + summary.count }
        : total,
    { amount: 0, count: 0 },
  );
}

function referralListPath(audience: ReferralAudienceSlug) {
  return audience === 'partner' ? '/referrals/partners' : '/referrals/customers';
}

function ReferralRewardQueueSummaryText({ summary }: { readonly summary: ReferralRewardQueueSummary | undefined }) {
  return (
    <>
      {summary?.count ?? 0} · <MoneyText amount={summary?.amount ?? 0} fallback="0 VND" />
    </>
  );
}

function appendReferralParentApiFilterParams(params: URLSearchParams, filters: ReferralDashboardFilters) {
  if (filters.q) params.set('q', filters.q);
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.fraud && filters.fraud !== 'all') params.set('fraud', filters.fraud);
  if (filters.range && filters.range !== 'all') params.set('range', filters.range);
  if (filters.reward !== 'all') params.set('reward', filters.reward);
}

function referralAudienceLabel(audience: ReferralAudienceSlug) {
  return audience === 'partner' ? 'Partner' : 'Customer';
}

function referralActiveFilterLabels(filters: ReferralDashboardFilters) {
  const labels: string[] = [];
  if (filters.q) labels.push(`Search: ${filters.q}`);
  if (filters.status !== 'all') labels.push(`Status: ${referralStatusFilterLabel(filters.status)}`);
  if (filters.fraud && filters.fraud !== 'all') {
    labels.push(`Integrity: ${referralFraudFilterLabel(filters.fraud)}`);
  }
  if (filters.range && filters.range !== 'all') labels.push(`Period: ${referralRangeFilterLabel(filters.range)}`);
  if (filters.reward !== 'attention') labels.push(`Reward: ${referralRewardFilterLabel(filters.reward)}`);
  return labels;
}

function referralHasAdditionalFilters(filters: ReferralDashboardFilters) {
  return Boolean(
    filters.q ||
      filters.status !== 'all' ||
      filters.fraud !== 'all' ||
      filters.range !== 'all',
  );
}

function referralParentMatchesSearch(audience: ReferralAudienceSlug, row: ReferralParentRow, q: string) {
  if (!q) return true;

  const needle = q.toLowerCase();
  return referralParentSearchText(audience, row).toLowerCase().includes(needle);
}

function referralParentSearchText(audience: ReferralAudienceSlug, row: ReferralParentRow) {
  const referrerUser = row.referrer.user;
  const chunks = [
    row.referrer.id,
    row.referralCode?.code,
    referrerUser?.fullName,
    referrerUser?.phone,
    referrerUser?.email,
  ];

  if (audience === 'partner') {
    const partnerRow = row as AdminPartnerReferralParent;
    chunks.push(partnerRow.referrer.displayName);
    for (const referral of partnerRow.referrals) {
      chunks.push(
        referral.id,
        referral.status,
        referral.fraudReviewStatus,
        referral.installSource,
        referral.platform,
        referral.referredPartner?.displayName,
        referral.referredPartner?.user?.fullName,
        referral.referredPartner?.user?.phone,
      );
    }
  } else {
    const customerRow = row as AdminCustomerReferralParent;
    for (const referral of customerRow.referrals) {
      chunks.push(
        referral.id,
        referral.status,
        referral.fraudReviewStatus,
        referral.installSource,
        referral.platform,
        referral.referredCustomer?.user?.fullName,
        referral.referredCustomer?.user?.phone,
      );
    }
  }

  return chunks.filter(Boolean).join(' ');
}

function referralParentMatchesStatus(row: ReferralParentRow, status: ReferralDashboardStatusFilter) {
  if (status === 'all') return true;
  return row.referrals.some((referral) => referralStatusBucket(referral.status) === status);
}

function referralParentMatchesFraud(row: ReferralParentRow, fraud: ReferralDashboardFraudFilter) {
  if (!fraud || fraud === 'all') return true;
  return row.referrals.some((referral) => referral.fraudReviewStatus.toLowerCase() === fraud);
}

function referralParentMatchesRange(row: ReferralParentRow, range: ReferralDashboardRangeFilter) {
  if (!range || range === 'all') return true;
  return row.referrals.some((referral) => isInDateRange(referral.createdAt, range));
}

function referralParentMatchesReward(row: ReferralParentRow, reward: ReferralDashboardRewardFilter) {
  if (reward === 'all') return true;
  if (reward === 'attention') {
    return (
      numberOrZero(row.totals.availableRewardCount) > 0 ||
      numberOrZero(row.totals.pendingRewardCount) > 0 ||
      numberOrZero(row.totals.heldRewardCount) > 0
    );
  }
  if (reward === 'available') {
    return numberOrZero(row.totals.availableRewardCount) > 0 || referralHasRewardStatus(row, 'AVAILABLE');
  }
  if (reward === 'credited') {
    return numberOrZero(row.totals.rewardedRewardCount) > 0 || referralHasCreditedReward(row);
  }
  if (reward === 'pending') {
    return numberOrZero(row.totals.pendingRewardCount) > 0 || referralHasRewardStatus(row, 'PENDING');
  }
  return numberOrZero(row.totals.heldRewardCount) > 0 || referralHasRewardStatus(row, 'HELD');
}

function referralHasRewardStatus(row: ReferralParentRow, status: 'AVAILABLE' | 'HELD' | 'PENDING' | 'REWARDED') {
  return row.referrals.some((referral) => referral.rewards.some((reward) => reward.status === status));
}

function referralHasCreditedReward(row: ReferralParentRow) {
  return row.referrals.some((referral) =>
    referral.rewards.some((reward) => isReferralRewardCredited(reward)),
  );
}

function referralStatusBucket(status: string): ReferralDashboardStatusFilter {
  if (status === 'QUALIFIED' || status === 'REWARDED') return 'qualified';
  if (status === 'BLOCKED' || status === 'CANCELLED') return 'blocked';
  return 'pending';
}

function normalizeReferralStatusFilter(value: string): ReferralDashboardStatusFilter {
  return value === 'qualified' || value === 'pending' || value === 'blocked' ? value : 'all';
}

function normalizeReferralRewardFilter(value: string): ReferralDashboardRewardFilter {
  return value === 'all' ||
    value === 'attention' ||
    value === 'available' ||
    value === 'credited' ||
    value === 'pending' ||
    value === 'held'
    ? value
    : 'attention';
}

function normalizeReferralFraudFilter(value: string): ReferralDashboardFraudFilter {
  return value === 'clear' || value === 'flagged' || value === 'held' ? value : 'all';
}

function normalizeReferralRangeFilter(value: string): ReferralDashboardRangeFilter {
  return value === 'today' || value === '7d' || value === '30d' ? value : 'all';
}

function referralStatusFilterLabel(status: ReferralDashboardStatusFilter) {
  if (status === 'qualified') return 'Qualified';
  if (status === 'pending') return 'Pending';
  if (status === 'blocked') return 'Blocked';
  return 'All statuses';
}

function referralRewardFilterLabel(reward: ReferralDashboardRewardFilter) {
  if (reward === 'attention') return 'Needs action';
  if (reward === 'available') return 'Ready rewards';
  if (reward === 'credited') return 'Credited rewards';
  if (reward === 'pending') return 'Pending rewards';
  if (reward === 'held') return 'Rewards on hold';
  return 'All rewards';
}

function referralFraudFilterLabel(fraud: ReferralDashboardFraudFilter) {
  if (fraud === 'clear') return 'Clear';
  if (fraud === 'flagged') return 'Flagged';
  if (fraud === 'held') return 'On hold';
  return 'All review states';
}

function referralRangeFilterLabel(range: ReferralDashboardRangeFilter) {
  if (range === 'today') return 'Today (Vietnam)';
  if (range === '7d') return 'Last 7 days';
  if (range === '30d') return 'Last 30 days';
  return 'All referral dates';
}

export function referralPolicyFallback(audience: 'customer' | 'partner'): AdminReferralPolicy {
  return {
    audience: audience === 'customer' ? 'CUSTOMER' : 'PARTNER',
    currency: 'VND',
    enabled: false,
    fixedRewardAmount: null,
    holdPeriodDays: 7,
    maxRewardedReferrals: null,
    maxRewardsPerReferred: null,
    platformFeeVatRateBps: 800,
    perRewardCapAmount: null,
    policyId: null,
    rewardMode: audience === 'customer' ? 'COMMISSION_PERCENT' : 'FIXED_AMOUNT',
    source: 'default-disabled',
    totalRewardCapAmount: null,
  };
}
