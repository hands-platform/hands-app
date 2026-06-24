import Link from 'next/link';

import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminPageTemplate, type AdminPageMetric } from '../../components/admin-page-template';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { StatusBadge } from '../../components/status-badge';
import {
  type AdminCustomerReferralParent,
  type AdminPartnerReferralParent,
  type AdminReferralPolicy,
  type AdminReferralUserSummary,
} from '../../lib/admin-api';
import { formatDateTime, formatMoney } from '../../lib/admin-format';
import { readSearchParam } from '../../lib/date-range';
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

type ReferralDashboardProps =
  | {
      readonly audience: 'customer';
      readonly filters?: ReferralDashboardFilters;
      readonly policy: AdminReferralPolicy;
      readonly rows: readonly AdminCustomerReferralParent[];
      readonly totalCount?: number;
    }
  | {
      readonly audience: 'partner';
      readonly filters?: ReferralDashboardFilters;
      readonly policy: AdminReferralPolicy;
      readonly rows: readonly AdminPartnerReferralParent[];
      readonly totalCount?: number;
    };

type ReferralPolicyPanelProps = {
  readonly label: string;
  readonly policy: AdminReferralPolicy;
};

export function ReferralDashboard(props: ReferralDashboardProps) {
  const title = props.audience === 'customer' ? 'Customer Referrals' : 'Partner Referrals';
  const filters = props.filters ?? defaultReferralDashboardFilters;
  const totalCount = props.totalCount ?? props.rows.length;
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
      value: formatMoney(availableRewards, props.policy.currency, '0 VND'),
      helper: 'Reward candidates ready for credit. Wallet credit is separate.',
    },
    {
      label: 'Credited rewards',
      value: formatMoney(creditedRewards, props.policy.currency, '0 VND'),
      helper: 'Rewards already posted to customer or Partner wallets.',
    },
    {
      label: 'Pending / held',
      value: `${formatMoney(pendingRewards, props.policy.currency, '0 VND')} / ${formatMoney(
        heldRewards,
        props.policy.currency,
        '0 VND',
      )}`,
      helper: 'Amounts that still need policy, fraud, or booking completion checks.',
    },
  ];

  return (
    <AdminPageTemplate
      title={title}
      description={description}
      metrics={metrics}
      actions={
        <Link className="text-link" href="/operations-policy">
          Open operations policy
        </Link>
      }
    >
      <ReferralPolicyPanel label={title} policy={props.policy} />
      <ReferralLinkReadinessPanel audience={props.audience} />
      <ReferralListFilterPanel
        audience={props.audience}
        filteredCount={props.rows.length}
        filters={filters}
        totalCount={totalCount}
      />
      {props.audience === 'customer' ? (
        <CustomerReferralParentTable rows={props.rows} />
      ) : (
        <PartnerReferralParentTable rows={props.rows} />
      )}
    </AdminPageTemplate>
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
      <div className="service-trace-summary">
        <div>
          <span>Audience</span>
          <strong>{audienceLabel}</strong>
          <small className="muted">
            {audienceLabel} referral links route visitors to the correct store before attribution starts.
          </small>
        </div>
        <div>
          <span>Public route</span>
          <strong>/r/{audience}/:code</strong>
          <small className="muted">Android and iOS visitors must land on the matching app download page.</small>
        </div>
        <div>
          <span>Setup status</span>
          <ReferralStoreSetupStatus audience={audience} />
        </div>
      </div>
    </AdminFilterPanel>
  );
}

function ReferralListFilterPanel({
  audience,
  filteredCount,
  filters,
  totalCount,
}: {
  readonly audience: ReferralAudienceSlug;
  readonly filteredCount: number;
  readonly filters: ReferralDashboardFilters;
  readonly totalCount: number;
}) {
  const activeFilters = referralActiveFilterLabels(filters);

  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-customer-filter-card"
      resultLabel={`${filteredCount} of ${totalCount}`}
      resultTone={activeFilters.length > 0 ? 'warning' : 'info'}
      title="Referral list filters"
      footer={
        activeFilters.length > 0 ? (
          <div className="vuexy-customer-filter-footer">
            {activeFilters.map((filter) => (
              <span className="pill pill-warn" key={filter}>
                {filter}
              </span>
            ))}
          </div>
        ) : null
      }
    >
      <div className="booking-date-filter-bar admin-mb-14" aria-label="Referral reward operation queue">
        <div className="booking-date-filter-buttons referral-reward-filter-buttons" role="group" aria-label="Referral reward state">
          {referralRewardQuickFilterOptions.map((option) => (
            <a
              key={option.reward}
              aria-pressed={filters.reward === option.reward}
              className={filters.reward === option.reward ? 'is-active' : undefined}
              href={buildReferralListHref(audience, filters, { reward: option.reward })}
              role="button"
              title={option.description}
            >
              {option.label}
            </a>
          ))}
        </div>
      </div>
      <form action={referralListPath(audience)} className="vuexy-customer-form">
        <div className="vuexy-customer-filter-grid">
          <div className="vuexy-customer-filter-group is-primary" aria-label="Referral list filters">
            <AdminFormSearch
              className="vuexy-customer-search"
              defaultValue={filters.q}
              label="Search referrals"
              name="q"
              placeholder="Search parent, code, referred account"
            />
            <AdminFormSelect
              className="vuexy-customer-select"
              defaultValue={filters.status}
              label="Referral status"
              name="status"
              options={referralStatusFilterOptions}
            />
            <AdminFormSelect
              className="vuexy-customer-select"
              defaultValue={filters.reward}
              label="Reward state"
              name="reward"
              options={referralRewardFilterOptions}
            />
          </div>
          <div className="vuexy-customer-filter-actions" aria-label="Referral filter actions">
            <AdminFormControlLink className="vuexy-customer-button is-ghost" href={referralListPath(audience)}>
              Clear
            </AdminFormControlLink>
            <AdminFormControlButton className="vuexy-customer-button">Apply</AdminFormControlButton>
          </div>
        </div>
      </form>
    </AdminFilterPanel>
  );
}

function ReferralPolicyPanel({ label, policy }: ReferralPolicyPanelProps) {
  const percentLabel =
    policy.rewardMode === 'COMMISSION_PERCENT' && policy.commissionPercentBps !== null
      ? `${(Number(policy.commissionPercentBps ?? 0) / 100).toFixed(2)}%`
      : 'Not set';
  const fixedAmountLabel =
    policy.rewardMode === 'FIXED_AMOUNT'
      ? formatMoney(policy.fixedRewardAmount, policy.currency)
      : 'Not applicable';

  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16"
      description={`${label} policy can be edited here. Policy changes are audited and should stay tied to an operator reason.`}
      resultLabel={policy.enabled ? 'Enabled' : 'Disabled'}
      resultTone={policy.enabled ? 'success' : 'neutral'}
      title="Referral policy"
    >
      <div className="service-trace-summary">
        <div>
          <span>Reward mode</span>
          <strong>{policy.rewardMode === 'COMMISSION_PERCENT' ? 'Commission %' : 'Fixed amount'}</strong>
          <small className="muted">{policy.source === 'stored-policy' ? 'Stored policy' : 'Default disabled'}</small>
        </div>
        <div>
          <span>Customer percent</span>
          <strong>{percentLabel}</strong>
          <small className="muted">Applied only after a qualifying completed booking.</small>
        </div>
        <div>
          <span>Fixed reward</span>
          <strong>{fixedAmountLabel}</strong>
          <small className="muted">Used for Partner referral rewards.</small>
        </div>
        <div>
          <span>Hold period</span>
          <strong>{policy.holdPeriodDays} day(s)</strong>
          <small className="muted">Wallet credit can stay pending until this window passes.</small>
        </div>
        <div>
          <span>Per-user cap</span>
          <strong>{formatMoney(policy.totalRewardCapAmount, policy.currency)}</strong>
          <small className="muted">Maximum total referral rewards per parent account.</small>
        </div>
        <div>
          <span>Max rewarded referrals</span>
          <strong>{policy.maxRewardedReferrals ?? 'Not set'}</strong>
          <small className="muted">Manual policy limit for rewardable referred accounts.</small>
        </div>
      </div>
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
  const commissionPercentValue =
    policy.commissionPercentBps !== null && policy.commissionPercentBps !== undefined
      ? Number(policy.commissionPercentBps) / 100
      : '';

  return (
    <form action={updateReferralPolicy} className="form-grid compact-form admin-mt-16">
      <input name="audience" type="hidden" value={audience} />
      <label>
        <span>Policy status</span>
        <select defaultValue={policy.enabled ? 'on' : 'off'} name="enabledState">
          <option value="on">Enabled</option>
          <option value="off">Disabled</option>
        </select>
      </label>
      {policy.audience === 'CUSTOMER' ? (
        <label>
          <span>Reward percent</span>
          <input
            defaultValue={commissionPercentValue}
            min="0"
            name="commissionPercent"
            placeholder="5"
            step="0.01"
            type="number"
          />
        </label>
      ) : (
        <label>
          <span>Fixed reward amount</span>
          <input
            defaultValue={policy.fixedRewardAmount ?? ''}
            min="0"
            name="fixedRewardAmount"
            placeholder="100000"
            step="1000"
            type="number"
          />
        </label>
      )}
      <label>
        <span>Total reward cap</span>
        <input
          defaultValue={policy.totalRewardCapAmount ?? ''}
          min="0"
          name="totalRewardCapAmount"
          placeholder="Optional"
          step="1000"
          type="number"
        />
      </label>
      <label>
        <span>Max rewarded referrals</span>
        <input
          defaultValue={policy.maxRewardedReferrals ?? ''}
          min="0"
          name="maxRewardedReferrals"
          placeholder="Optional"
          type="number"
        />
      </label>
      <label>
        <span>Max rewards per referred</span>
        <input
          defaultValue={policy.maxRewardsPerReferred ?? ''}
          min="0"
          name="maxRewardsPerReferred"
          placeholder="1"
          type="number"
        />
      </label>
      <label>
        <span>Hold period days</span>
        <input defaultValue={policy.holdPeriodDays} min="0" name="holdPeriodDays" type="number" />
      </label>
      <label>
        <span>Currency</span>
        <input defaultValue={policy.currency} maxLength={8} name="currency" />
      </label>
      <label className="full-span">
        <span>Policy notes</span>
        <textarea
          defaultValue={policy.notes ?? ''}
          name="notes"
          placeholder={`${label} policy note for operators`}
          rows={3}
        />
      </label>
      <label className="full-span">
        <span>Update reason</span>
        <input
          name="reason"
          placeholder="Why this referral policy is being changed"
        />
      </label>
      <div className="actions full-span">
        <button className="button button-primary" type="submit">
          Save referral policy
        </button>
      </div>
    </form>
  );
}

function CustomerReferralParentTable({ rows }: { readonly rows: readonly AdminCustomerReferralParent[] }) {
  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card"
      description="Parent customer accounts only. The full customer directory stays in Customer Management."
      resultLabel={`${rows.length} parent account(s)`}
      resultTone="info"
      title="Customer referral parents"
    >
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table"
          emptyMessage={<ReferralEmptyState audienceLabel="customer" />}
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
    </AdminFilterPanel>
  );
}

function PartnerReferralParentTable({ rows }: { readonly rows: readonly AdminPartnerReferralParent[] }) {
  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card"
      description="Parent Partner accounts only. The full Partner directory stays in Partners."
      resultLabel={`${rows.length} parent account(s)`}
      resultTone="info"
      title="Partner referral parents"
    >
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table"
          emptyMessage={<ReferralEmptyState audienceLabel="Partner" />}
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
    </AdminFilterPanel>
  );
}

function ReferralCodeCell({
  code,
}: {
  readonly code?: { readonly active: boolean; readonly code: string; readonly createdAt: string } | null;
}) {
  if (!code) {
    return <span className="muted">No code</span>;
  }

  return (
    <div>
      <strong>{code.code}</strong>
      <div className="participant-list admin-mt-8">
        <StatusBadge tone={code.active ? 'success' : 'neutral'}>{code.active ? 'Active' : 'Paused'}</StatusBadge>
        <small className="muted">{formatDateTime(code.createdAt)}</small>
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
  pendingAmount,
}: {
  readonly availableAmount: number;
  readonly creditedAmount: number;
  readonly pendingAmount: number;
}) {
  return (
    <div>
      <strong>{formatMoney(availableAmount, 'VND', '0 VND')}</strong>
      <p className="muted">Credited {formatMoney(creditedAmount, 'VND', '0 VND')}</p>
      <p className="muted">Pending {formatMoney(pendingAmount, 'VND', '0 VND')}</p>
    </div>
  );
}

function LatestCustomerReferralCell({ row }: { readonly row: AdminCustomerReferralParent }) {
  const referral = row.referrals[0];
  if (!referral) return <span className="muted">No referral activity</span>;

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
  if (!referral) return <span className="muted">No referral activity</span>;

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
        {formatDateTime(createdAt)}
      </small>
    </div>
  );
}

function ReferralEmptyState({ audienceLabel }: { readonly audienceLabel: string }) {
  return (
    <>
      <strong>No {audienceLabel} referral parents yet</strong>
      <p className="muted">Parents appear here only after at least one referral attribution is recorded.</p>
    </>
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

function numberOrZero(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
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

export function buildReferralListHref(
  audience: ReferralAudienceSlug,
  filters: ReferralDashboardFilters,
  overrides: Partial<ReferralDashboardFilters> = {},
) {
  const next: ReferralDashboardFilters = {
    ...filters,
    ...overrides,
  };
  const params = new URLSearchParams();

  if (next.q) params.set('q', next.q);
  if (next.status !== 'all') params.set('status', next.status);
  if (next.reward !== 'all') params.set('reward', next.reward);

  const query = params.toString();
  return query ? `${referralListPath(audience)}?${query}` : referralListPath(audience);
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

function referralListPath(audience: ReferralAudienceSlug) {
  return audience === 'partner' ? '/referrals/partners' : '/referrals/customers';
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
    return numberOrZero(row.totals.rewardedRewardCount) > 0 || referralHasRewardStatus(row, 'REWARDED');
  }
  if (reward === 'pending') {
    return numberOrZero(row.totals.pendingRewardCount) > 0 || referralHasRewardStatus(row, 'PENDING');
  }
  return numberOrZero(row.totals.heldRewardCount) > 0 || referralHasRewardStatus(row, 'HELD');
}

function referralHasRewardStatus(row: ReferralParentRow, status: 'AVAILABLE' | 'HELD' | 'PENDING' | 'REWARDED') {
  return row.referrals.some((referral) => referral.rewards.some((reward) => reward.status === status));
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
    perRewardCapAmount: null,
    policyId: null,
    rewardMode: audience === 'customer' ? 'COMMISSION_PERCENT' : 'FIXED_AMOUNT',
    source: 'default-disabled',
    totalRewardCapAmount: null,
  };
}
