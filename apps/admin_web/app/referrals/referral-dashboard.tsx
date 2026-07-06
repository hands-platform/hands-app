import Link from 'next/link';

import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminDirectoryFilterForm } from '../../components/admin-directory-filter-form';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormGridFields,
  AdminFormInput,
  AdminFormSearch,
  AdminFormSelect,
  AdminFormShell,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminInlineFallback } from '../../components/admin-inline-fallback';
import { AdminPageTemplate, type AdminPageMetric } from '../../components/admin-page-template';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminDisclosure } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';
import {
  type AdminCustomerReferralParent,
  type AdminPartnerReferralParent,
  type AdminReferralPolicy,
  type AdminReferralReward,
  type AdminReferralUserSummary,
} from '../../lib/admin-api';
import { readSearchParam } from '../../lib/date-range';
import { isReferralRewardCredited, referralRewardDecisionLabel } from '../../lib/referral-reward-credit-state';
import { referralShareUrl, type ReferralAudienceSlug } from '../../lib/referral-links';
import { releaseAvailableReferralRewards, updateReferralPolicy } from './actions';
import { referralParentDetailHref } from './referral-detail';
import { ReferralStoreSetupStatus } from './referral-store-setup-status';

export type ReferralDashboardStatusFilter = 'all' | 'qualified' | 'pending' | 'blocked';
export type ReferralDashboardRewardFilter = 'all' | 'available' | 'credited' | 'pending' | 'held';

export type ReferralDashboardFilters = {
  readonly q: string;
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
      readonly currentPage?: number;
      readonly pageSize?: number;
      readonly policy: AdminReferralPolicy;
      readonly rewardQueueSummaries?: readonly ReferralRewardQueueSummary[];
      readonly rows: readonly AdminCustomerReferralParent[];
      readonly serverPagination?: boolean;
      readonly totalCount?: number;
    }
  | {
      readonly audience: 'partner';
      readonly filters?: ReferralDashboardFilters;
      readonly currentPage?: number;
      readonly pageSize?: number;
      readonly policy: AdminReferralPolicy;
      readonly rewardQueueSummaries?: readonly ReferralRewardQueueSummary[];
      readonly rows: readonly AdminPartnerReferralParent[];
      readonly serverPagination?: boolean;
      readonly totalCount?: number;
    };

type ReferralPolicyPanelProps = {
  readonly label: string;
  readonly policy: AdminReferralPolicy;
};

type ReferralEmptyStateProps = {
  readonly activeFilters?: readonly string[];
  readonly audienceLabel: string;
  readonly clearHref?: string;
  readonly totalCount?: number;
};

export function ReferralDashboard(props: ReferralDashboardProps) {
  const title = props.audience === 'customer' ? 'Customer Referrals' : 'Partner Referrals';
  const filters = props.filters ?? defaultReferralDashboardFilters;
  const rewardQueueSummaries = props.rewardQueueSummaries ?? buildReferralRewardQueueSummaries(props.rows);
  const totalCount = props.totalCount ?? props.rows.length;
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
    props.audience === 'customer'
      ? 'Parent customer accounts with at least one referred customer. Rewards remain controlled by admin policy.'
      : 'Parent Partner accounts with at least one referred Partner. Rewards are fixed-amount Partner wallet incentives.';
  const totalReferrals = props.rows.reduce((total, row) => total + numberOrZero(row.totals.referralCount), 0);
  const availableRewards = props.rows.reduce(
    (total, row) => total + numberOrZero(row.totals.availableRewardAmount),
    0,
  );
  const creditedRewards = props.rows.reduce(
    (total, row) => total + numberOrZero(row.totals.rewardedRewardAmount),
    0,
  );
  const pendingRewards = props.rows.reduce((total, row) => total + numberOrZero(row.totals.pendingRewardAmount), 0);
  const heldRewards = props.rows.reduce((total, row) => total + numberOrZero(row.totals.heldRewardAmount), 0);
  const metrics: AdminPageMetric[] = [
    {
      label: 'Parent accounts',
      value: props.rows.length,
      helper: 'Only accounts with referral activity are listed.',
    },
    {
      label: 'Referral sign-ups',
      value: totalReferrals,
      helper: 'Registered or qualified referral attributions.',
    },
    {
      label: 'Ready reward candidates',
      value: <MoneyText amount={availableRewards} currency={props.policy.currency} fallback="0 VND" />,
      helper: 'Reward candidates ready for credit. Wallet credit is separate.',
    },
    {
      label: 'Credited rewards',
      value: <MoneyText amount={creditedRewards} currency={props.policy.currency} fallback="0 VND" />,
      helper: 'Rewards already posted to customer or Partner wallets.',
    },
    {
      label: 'Pending / held',
      value: (
        <>
          <MoneyText amount={pendingRewards} currency={props.policy.currency} fallback="0 VND" />
          {' / '}
          <MoneyText amount={heldRewards} currency={props.policy.currency} fallback="0 VND" />
        </>
      ),
      helper: 'Amounts that still need policy, fraud, or booking completion checks.',
    },
  ];

  return (
    <AdminPageTemplate
      title={title}
      description={description}
      metrics={metrics}
      actions={
        <AdminTextLink href="/operations-policy">
          Open operations policy
        </AdminTextLink>
      }
    >
      <ReferralPolicyPanel label={title} policy={props.policy} />
      <ReferralAccountingGuardrailsPanel />
      <ReferralLinkReadinessPanel audience={props.audience} />
      <ReferralListFilterPanel
        audience={props.audience}
        filteredCount={props.rows.length}
        filters={filters}
        rewardQueueSummaries={rewardQueueSummaries}
        totalCount={totalCount}
      />
      {props.audience === 'customer' ? (
        <CustomerReferralParentTable
          audience={props.audience}
          emptyState={tableEmptyState}
          filteredCount={props.rows.length}
          filters={filters}
          pagination={pagination}
          rows={pagination.rows}
        />
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
    </AdminPageTemplate>
  );
}

function ReferralAccountingGuardrailsPanel() {
  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16"
      resultLabel="Accounting"
      resultTone="info"
      title="Referral accounting guardrails"
    >
      <AdminTraceSummary
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
    </AdminFilterPanel>
  );
}

function ReferralLinkReadinessPanel({ audience }: { readonly audience: ReferralAudienceSlug }) {
  const audienceLabel = referralAudienceLabel(audience);

  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16"
      resultLabel="Store setup"
      resultTone="info"
      title="Referral link readiness"
    >
      <AdminTraceSummary
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
            action: <ReferralStoreSetupStatus audience={audience} />,
          },
        ]}
      />
    </AdminFilterPanel>
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
      className="booking-monitor-filter-panel admin-mt-16 vuexy-customer-filter-card"
      resultLabel={`${filteredCount} of ${totalCount}`}
      resultTone={activeFilters.length > 0 ? 'warning' : 'info'}
      title="Referral list filters"
      footer={
        activeFilters.length > 0 ? (
          <div className="vuexy-customer-filter-footer admin-directory-filter-footer">
            {activeFilters.map((filter) => (
              <StatusBadge key={filter} tone="warning">
                {filter}
              </StatusBadge>
            ))}
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
      <AdminDirectoryFilterForm action={referralListPath(audience)} className="vuexy-customer-form">
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
              label="Referral status"
              name="status"
              options={referralStatusFilterOptions}
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.reward}
              label="Reward state"
              name="reward"
              options={referralRewardFilterOptions}
            />
          </div>
          <div className="vuexy-customer-filter-actions admin-directory-filter-actions" aria-label="Referral filter actions">
            <AdminFormControlLink className="admin-directory-filter-button is-ghost" href={referralListPath(audience)}>
              Clear
            </AdminFormControlLink>
            <AdminFormControlButton className="admin-directory-filter-button">Apply</AdminFormControlButton>
          </div>
        </div>
      </AdminDirectoryFilterForm>
    </AdminFilterPanel>
  );
}

function ReferralPolicyPanel({ label, policy }: ReferralPolicyPanelProps) {
  const percentLabel =
    policy.rewardMode === 'COMMISSION_PERCENT' && policy.commissionPercentBps !== null
      ? `${(Number(policy.commissionPercentBps ?? 0) / 100).toFixed(2)}%`
      : 'Not set';
  const platformFeeVatLabel = formatBpsPercent(policy.platformFeeVatRateBps);

  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16"
      description={`${label} policy can be edited here. Policy changes are audited and should stay tied to an operator reason.`}
      resultLabel={policy.enabled ? 'Enabled' : 'Disabled'}
      resultTone={policy.enabled ? 'success' : 'neutral'}
      title="Referral policy"
    >
      <AdminTraceSummary
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
          {
            key: 'fixed-reward',
            label: 'Fixed reward',
            value:
              policy.rewardMode === 'FIXED_AMOUNT' ? (
                <MoneyText amount={policy.fixedRewardAmount} currency={policy.currency} />
              ) : (
                'Not applicable'
              ),
            detail: 'Used for Partner referral rewards.',
          },
          {
            key: 'hold-period',
            label: 'Hold period',
            value: `${policy.holdPeriodDays} day(s)`,
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
            key: 'max-rewarded-referrals',
            label: 'Max rewarded referrals',
            value: policy.maxRewardedReferrals ?? 'Not set',
            detail: 'Manual policy limit for rewardable referred accounts.',
          },
        ]}
      />
      <ReferralPolicyActions />
      <ReferralPolicyForm label={label} policy={policy} />
    </AdminFilterPanel>
  );
}

function ReferralPolicyActions() {
  return (
    <div className="admin-mt-16">
      <ActionMenu
        actions={[
          {
            action: releaseAvailableReferralRewards,
            description:
              'Moves hold-window-cleared rewards to AVAILABLE. Wallet posting still happens from each reward detail action.',
            kind: 'submit',
            label: 'Stage ready reward candidates',
            tone: 'warning',
          },
        ]}
        label="Referral policy actions"
        title="Policy actions"
      />
      <p className="muted admin-mt-8">
        Moves hold-window-cleared rewards to AVAILABLE. Wallet posting still happens from each reward detail action.
      </p>
    </div>
  );
}

function ReferralPolicyForm({ label, policy }: ReferralPolicyPanelProps) {
  const audience = policy.audience === 'PARTNER' ? 'partner' : 'customer';
  const formLabel =
    policy.audience === 'PARTNER' ? 'Partner referral policy controls' : 'Customer referral policy controls';
  const commissionPercentValue =
    policy.commissionPercentBps !== null && policy.commissionPercentBps !== undefined
      ? Number(policy.commissionPercentBps) / 100
      : '';
  const platformFeeVatRateValue = Number(policy.platformFeeVatRateBps ?? 800) / 100;

  return (
    <AdminFormShell
      action={updateReferralPolicy}
      aria-label={formLabel}
      className="vuexy-customer-form referral-policy-form admin-mt-16"
    >
      <input name="audience" type="hidden" value={audience} />
      <AdminFormGridFields className="referral-policy-form-grid">
        <AdminFormSelect
          className="admin-form-control-fluid"
          defaultValue={policy.enabled ? 'on' : 'off'}
          label="Policy status"
          labelVisibility="visible"
          name="enabledState"
          options={[
            { label: 'Enabled', value: 'on' },
            { label: 'Disabled', value: 'off' },
          ]}
        />
        {policy.audience === 'CUSTOMER' ? (
          <AdminFormInput
            className="admin-form-control-fluid"
            defaultValue={commissionPercentValue}
            label="Reward percent"
            labelVisibility="visible"
            min="0"
            name="commissionPercent"
            placeholder="5"
            step="0.01"
            type="number"
          />
        ) : (
          <AdminFormInput
            className="admin-form-control-fluid"
            defaultValue={policy.fixedRewardAmount ?? ''}
            label="Fixed reward amount"
            labelVisibility="visible"
            min="0"
            name="fixedRewardAmount"
            placeholder="100000"
            step="1000"
            type="number"
          />
        )}
        <AdminFormInput
          className="admin-form-control-fluid"
          defaultValue={policy.totalRewardCapAmount ?? ''}
          label="Total reward cap"
          labelVisibility="visible"
          min="0"
          name="totalRewardCapAmount"
          placeholder="Optional"
          step="1000"
          type="number"
        />
        <AdminFormInput
          className="admin-form-control-fluid"
          defaultValue={policy.maxRewardedReferrals ?? ''}
          label="Max rewarded referrals"
          labelVisibility="visible"
          min="0"
          name="maxRewardedReferrals"
          placeholder="Optional"
          type="number"
        />
        <AdminFormInput
          className="admin-form-control-fluid"
          defaultValue={policy.maxRewardsPerReferred ?? ''}
          label="Max rewards per referred"
          labelVisibility="visible"
          min="0"
          name="maxRewardsPerReferred"
          placeholder="1"
          type="number"
        />
        <AdminFormInput
          className="admin-form-control-fluid"
          defaultValue={policy.holdPeriodDays}
          label="Hold period days"
          labelVisibility="visible"
          min="0"
          name="holdPeriodDays"
          type="number"
        />
        <AdminFormInput
          className="admin-form-control-fluid"
          defaultValue={platformFeeVatRateValue}
          label="Platform fee VAT"
          labelVisibility="visible"
          min="0"
          max="100"
          name="platformFeeVatRate"
          step="0.01"
          type="number"
        />
        <AdminFormInput
          className="admin-form-control-fluid"
          defaultValue={policy.currency}
          label="Currency"
          labelVisibility="visible"
          maxLength={8}
          name="currency"
        />
        <AdminFormTextarea
          className="admin-form-control-fluid admin-grid-span-2"
          defaultValue={policy.notes ?? ''}
          label="Policy notes"
          labelVisibility="visible"
          name="notes"
          placeholder={`${label} policy note for operators`}
          rows={3}
        />
        <AdminFormInput
          className="admin-form-control-fluid admin-grid-span-2"
          label="Update reason"
          labelVisibility="visible"
          name="reason"
          placeholder="Why this referral policy is being changed"
        />
      </AdminFormGridFields>
      <div className="vuexy-customer-filter-actions referral-policy-actions">
        <AdminFormControlButton className="referral-policy-save-button">
          Save referral policy
        </AdminFormControlButton>
      </div>
    </AdminFormShell>
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
      description="Parent customer accounts only. The full customer directory stays in Customer Management."
      resultLabel={`${filteredCount} parent account(s)`}
      resultTone="info"
      title="Customer referral parents"
    >
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table"
          emptyMessage={<ReferralEmptyState {...emptyState} />}
          headers={['Parent Customer', 'Referral Code', 'Referrals', 'Rewards', 'Latest Referral', 'Actions']}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.referrer.id}>
              <td>
                <AdminPersonCell
                  avatarClassName="vuexy-booking-avatar"
                  avatarStatus="offline"
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
                  latestDecision={latestReferralRewardDecision(row)}
                  pendingAmount={numberOrZero(row.totals.pendingRewardAmount)}
                />
              </td>
              <td>
                <LatestCustomerReferralCell row={row} />
              </td>
              <td>
                <ReferralParentActions
                  audience="customer"
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
      resultLabel={`${filteredCount} parent account(s)`}
      resultTone="info"
      title="Partner referral parents"
    >
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table"
          emptyMessage={<ReferralEmptyState {...emptyState} />}
          headers={['Parent Partner', 'Referral Code', 'Referrals', 'Rewards', 'Latest Referral', 'Actions']}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.referrer.id}>
              <td>
                <AdminPersonCell
                  avatarClassName="vuexy-booking-avatar"
                  avatarStatus="offline"
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
                  latestDecision={latestReferralRewardDecision(row)}
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
      <div className="participant-list admin-mt-8">
        <StatusBadge tone={code.active ? 'success' : 'neutral'}>{code.active ? 'Active' : 'Paused'}</StatusBadge>
        <small className="muted">
          <DateTimeText value={code.createdAt} />
        </small>
      </div>
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

function ReferralTotalsCell({
  referralCount,
  rewardCount,
}: {
  readonly referralCount: number;
  readonly rewardCount: number;
}) {
  return (
    <div>
      <strong>{referralCount} referral(s)</strong>
      <p className="muted">{rewardCount} reward record(s)</p>
    </div>
  );
}

function ReferralRewardCell({
  availableAmount,
  creditedAmount,
  heldAmount,
  latestDecision,
  pendingAmount,
}: {
  readonly availableAmount: number;
  readonly creditedAmount: number;
  readonly heldAmount: number;
  readonly latestDecision?: AdminReferralReward['latestDecision'] | null;
  readonly pendingAmount: number;
}) {
  return (
    <div>
      <strong>
        <MoneyText amount={availableAmount} fallback="0 VND" />
      </strong>
      <p className="muted">
        Credited <MoneyText amount={creditedAmount} fallback="0 VND" />
      </p>
      <p className="muted">
        Pending <MoneyText amount={pendingAmount} fallback="0 VND" />
      </p>
      <p className="muted">
        Held <MoneyText amount={heldAmount} fallback="0 VND" />
      </p>
      {latestDecision ? (
        <>
          <p className="muted">
            Latest {referralRewardDecisionLabel(latestDecision.action)} by {userLabel(latestDecision.actor, 'Unknown admin')}
          </p>
          <AdminDisclosure className="referral-parent-reward-decision-details">
            <summary>Decision details</summary>
            <div className="participant-list referral-parent-reward-decision-evidence">
              {latestDecision.reason ? <span className="muted">{latestDecision.reason}</span> : null}
              <span className="muted">
                <DateTimeText value={latestDecision.createdAt} />
              </span>
            </div>
          </AdminDisclosure>
        </>
      ) : null}
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
        avatarStatus="offline"
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
        avatarStatus="offline"
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
    <div className="participant-list admin-mt-8">
      <StatusBadge tone={referralStatusTone(status)}>{status}</StatusBadge>
      <StatusBadge tone={fraudReviewStatus === 'CLEAR' ? 'success' : 'warning'}>{fraudReviewStatus}</StatusBadge>
      <small className="muted">
        {platform ? `${platform} · ` : ''}
        <DateTimeText value={createdAt} />
      </small>
    </div>
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
        <div className="participant-list admin-mt-8" aria-label="Active referral filters">
          {activeFilters.map((filter) => (
            <StatusBadge key={filter} tone="warning">
              {filter}
            </StatusBadge>
          ))}
        </div>
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

function latestReferralRewardDecision(row: ReferralParentRow) {
  return row.referrals
    .flatMap((referral) => referral.rewards)
    .map((reward) => reward.latestDecision)
    .filter((decision): decision is NonNullable<AdminReferralReward['latestDecision']> => Boolean(decision))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null;
}

function referralStatusTone(status: string) {
  if (status === 'REWARDED' || status === 'QUALIFIED') return 'success';
  if (status === 'BLOCKED' || status === 'CANCELLED') return 'danger';
  return 'info';
}

function userLabel(user: AdminReferralUserSummary | null | undefined, fallback: string) {
  return user?.fullName ?? user?.phone ?? user?.email ?? fallback;
}

function numberOrZero(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function formatBpsPercent(value: number | null | undefined) {
  const percent = Number(value ?? 0) / 100;

  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%`;
}

const defaultReferralDashboardFilters: ReferralDashboardFilters = {
  q: '',
  reward: 'all',
  status: 'all',
};

const referralStatusFilterOptions = [
  { label: 'All statuses', value: 'all' },
  { label: 'Qualified', value: 'qualified' },
  { label: 'Pending', value: 'pending' },
  { label: 'Blocked', value: 'blocked' },
] as const;

const referralRewardFilterOptions = [
  { label: 'All rewards', value: 'all' },
  { label: 'Ready rewards', value: 'available' },
  { label: 'Credited rewards', value: 'credited' },
  { label: 'Pending rewards', value: 'pending' },
  { label: 'Held rewards', value: 'held' },
] as const;

const referralRewardQuickFilterOptions: readonly {
  readonly description: string;
  readonly label: string;
  readonly reward: ReferralDashboardRewardFilter;
}[] = [
  {
    description: 'Show every referral parent with the current search and status filters.',
    label: 'All reward queues',
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
    description: 'Rewards held for operator fraud, policy, or support review.',
    label: 'Held review',
    reward: 'held',
  },
  {
    description: 'Rewards already posted to customer or Partner wallets.',
    label: 'Credited',
    reward: 'credited',
  },
];

type ReferralParentRow = AdminCustomerReferralParent | AdminPartnerReferralParent;

export function buildReferralDashboardFilters(
  params: Record<string, string | string[] | undefined>,
): ReferralDashboardFilters {
  return {
    q: readSearchParam(params.q),
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
  };
  const params = new URLSearchParams();

  if (next.q) params.set('q', next.q);
  if (next.status !== 'all') params.set('status', next.status);
  if (next.reward !== 'all') params.set('reward', next.reward);
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
      referralParentMatchesReward(row, filters.reward),
  );
}

export function buildReferralRewardQueueSummaries(
  rows: readonly ReferralParentRow[],
): readonly ReferralRewardQueueSummary[] {
  const allSummary = { amount: 0, count: 0, reward: 'all' as const };
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
  }

  return [allSummary, availableSummary, pendingSummary, heldSummary, creditedSummary];
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
  if (filters.reward !== 'all') params.set('reward', filters.reward);
}

function referralAudienceLabel(audience: ReferralAudienceSlug) {
  return audience === 'partner' ? 'Partner' : 'Customer';
}

function referralActiveFilterLabels(filters: ReferralDashboardFilters) {
  const labels: string[] = [];
  if (filters.q) labels.push(`Search: ${filters.q}`);
  if (filters.status !== 'all') labels.push(`Status: ${referralStatusFilterLabel(filters.status)}`);
  if (filters.reward !== 'all') labels.push(`Reward: ${referralRewardFilterLabel(filters.reward)}`);
  return labels;
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

function referralParentMatchesReward(row: ReferralParentRow, reward: ReferralDashboardRewardFilter) {
  if (reward === 'all') return true;
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
  return value === 'available' || value === 'credited' || value === 'pending' || value === 'held'
    ? value
    : 'all';
}

function referralStatusFilterLabel(status: ReferralDashboardStatusFilter) {
  if (status === 'qualified') return 'Qualified';
  if (status === 'pending') return 'Pending';
  if (status === 'blocked') return 'Blocked';
  return 'All statuses';
}

function referralRewardFilterLabel(reward: ReferralDashboardRewardFilter) {
  if (reward === 'available') return 'Ready rewards';
  if (reward === 'credited') return 'Credited rewards';
  if (reward === 'pending') return 'Pending rewards';
  if (reward === 'held') return 'Held rewards';
  return 'All rewards';
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
