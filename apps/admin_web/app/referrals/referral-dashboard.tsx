import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
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
import { updateReferralPolicy } from './actions';

type ReferralDashboardProps =
  | {
      readonly audience: 'customer';
      readonly policy: AdminReferralPolicy;
      readonly rows: readonly AdminCustomerReferralParent[];
    }
  | {
      readonly audience: 'partner';
      readonly policy: AdminReferralPolicy;
      readonly rows: readonly AdminPartnerReferralParent[];
    };

type ReferralPolicyPanelProps = {
  readonly label: string;
  readonly policy: AdminReferralPolicy;
};

export function ReferralDashboard(props: ReferralDashboardProps) {
  const title = props.audience === 'customer' ? 'Customer Referrals' : 'Partner Referrals';
  const description =
    props.audience === 'customer'
      ? 'Parent customer accounts with at least one referred customer. Rewards remain controlled by admin policy.'
      : 'Parent Partner accounts with at least one referred Partner. Rewards are fixed-amount Partner wallet incentives.';
  const totalReferrals = props.rows.reduce((total, row) => total + row.totals.referralCount, 0);
  const availableRewards = props.rows.reduce((total, row) => total + row.totals.availableRewardAmount, 0);
  const pendingRewards = props.rows.reduce((total, row) => total + row.totals.pendingRewardAmount, 0);
  const heldRewards = props.rows.reduce((total, row) => total + row.totals.heldRewardAmount, 0);
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
      label: 'Available rewards',
      value: formatMoney(availableRewards, props.policy.currency, '0 VND'),
      helper: 'Reward amount currently available for wallet credit.',
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
      {props.audience === 'customer' ? (
        <CustomerReferralParentTable rows={props.rows} />
      ) : (
        <PartnerReferralParentTable rows={props.rows} />
      )}
    </AdminPageTemplate>
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
      description={`${label} policy is read-only here. Future edits should stay behind an admin approval flow.`}
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
      <ReferralPolicyForm label={label} policy={policy} />
    </AdminFilterPanel>
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
          headers={['Parent Customer', 'Referral Code', 'Referrals', 'Rewards', 'Latest Referral']}
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
                  href={`/customers/${row.referrer.id}`}
                  label={userLabel(row.referrer.user, 'Unknown customer')}
                  linkClassName="vuexy-booking-person-link"
                />
              </td>
              <td>
                <ReferralCodeCell code={row.referralCode} />
              </td>
              <td>
                <ReferralTotalsCell referralCount={row.totals.referralCount} rewardCount={row.totals.rewardCount} />
              </td>
              <td>
                <ReferralRewardCell
                  availableAmount={row.totals.availableRewardAmount}
                  pendingAmount={row.totals.pendingRewardAmount}
                />
              </td>
              <td>
                <LatestCustomerReferralCell row={row} />
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
          headers={['Parent Partner', 'Referral Code', 'Referrals', 'Rewards', 'Latest Referral']}
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
                  href={`/partners/${row.referrer.id}`}
                  label={row.referrer.displayName ?? userLabel(row.referrer.user, 'Unknown Partner')}
                  linkClassName="vuexy-booking-person-link"
                />
              </td>
              <td>
                <ReferralCodeCell code={row.referralCode} />
              </td>
              <td>
                <ReferralTotalsCell referralCount={row.totals.referralCount} rewardCount={row.totals.rewardCount} />
              </td>
              <td>
                <ReferralRewardCell
                  availableAmount={row.totals.availableRewardAmount}
                  pendingAmount={row.totals.pendingRewardAmount}
                />
              </td>
              <td>
                <LatestPartnerReferralCell row={row} />
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
  pendingAmount,
}: {
  readonly availableAmount: number;
  readonly pendingAmount: number;
}) {
  return (
    <div>
      <strong>{formatMoney(availableAmount, 'VND', '0 VND')}</strong>
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
