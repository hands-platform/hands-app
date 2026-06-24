import Link from 'next/link';

import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminPageTemplate, type AdminPageMetric } from '../../components/admin-page-template';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { StatusBadge, type StatusBadgeTone } from '../../components/status-badge';
import {
  type AdminCustomerReferralParent,
  type AdminPartnerReferralParent,
  type AdminReferralReward,
  type AdminReferralUserSummary,
} from '../../lib/admin-api';
import { formatDateTime, formatMoney } from '../../lib/admin-format';
import { referralRewardCreditState } from '../../lib/referral-reward-credit-state';
import { referralShareUrl, type ReferralAudienceSlug } from '../../lib/referral-links';
import { creditReferralReward, holdReferralReward, reverseReferralReward } from './actions';
import { ReferralStoreSetupStatus } from './referral-store-setup-status';

type ReferralParentDetailPageProps =
  | {
      readonly audience: 'customer';
      readonly row: AdminCustomerReferralParent;
    }
  | {
      readonly audience: 'partner';
      readonly row: AdminPartnerReferralParent;
    };

type ReferralRewardRow = {
  readonly attributionId: string;
  readonly referredHref: string | null;
  readonly referredLabel: string;
  readonly referredPhone?: string | null;
  readonly reward: AdminReferralReward;
};

type ReferralRewardReviewBucket = {
  readonly amount: number;
  readonly count: number;
};

type ReferralRewardReviewSummary = {
  readonly closed: ReferralRewardReviewBucket;
  readonly credited: ReferralRewardReviewBucket;
  readonly held: ReferralRewardReviewBucket;
  readonly pending: ReferralRewardReviewBucket;
  readonly ready: ReferralRewardReviewBucket;
};

export function referralParentDetailHref(audience: ReferralAudienceSlug, id: string) {
  return `/referrals/${audience === 'partner' ? 'partners' : 'customers'}/${encodeURIComponent(id)}`;
}

export function ReferralParentDetailPage(props: ReferralParentDetailPageProps) {
  const isPartner = props.audience === 'partner';
  const title = isPartner ? 'Partner Referral Detail' : 'Customer Referral Detail';
  const parentLabel = isPartner
    ? props.row.referrer.displayName ?? userLabel(props.row.referrer.user, 'Unknown Partner')
    : userLabel(props.row.referrer.user, 'Unknown customer');
  const profileHref = isPartner ? `/partners/${props.row.referrer.id}` : `/customers/${props.row.referrer.id}`;
  const rewardRows = referralRewardRows(props);
  const reviewSummary = referralRewardReviewSummary(rewardRows);
  const metrics: AdminPageMetric[] = [
    {
      label: 'Referral sign-ups',
      value: numberOrZero(props.row.totals.referralCount),
      helper: 'Only attributions for this parent account.',
    },
    {
      label: 'Reward records',
      value: numberOrZero(props.row.totals.rewardCount),
      helper: 'Pending, available, held, reversed, or cancelled rewards.',
    },
    {
      label: 'Available rewards',
      value: formatMoney(numberOrZero(props.row.totals.availableRewardAmount), 'VND', '0 VND'),
      helper: 'Reward candidates ready for credit, not necessarily wallet-ledgered.',
    },
    {
      label: 'Credited rewards',
      value: formatMoney(numberOrZero(props.row.totals.rewardedRewardAmount), 'VND', '0 VND'),
      helper: 'Rewards already posted to wallet ledger entries.',
    },
    {
      label: 'Pending / held',
      value: `${formatMoney(numberOrZero(props.row.totals.pendingRewardAmount), 'VND', '0 VND')} / ${formatMoney(
        numberOrZero(props.row.totals.heldRewardAmount),
        'VND',
        '0 VND',
      )}`,
      helper: 'Amounts still blocked by policy, fraud, or completion checks.',
    },
  ];

  return (
    <AdminPageTemplate
      actions={
        <>
          <Link className="text-link" href={isPartner ? '/referrals/partners' : '/referrals/customers'}>
            Back to referrals
          </Link>
          <Link className="text-link" href={profileHref}>
            Open profile
          </Link>
        </>
      }
      description="Single referral parent account. This page does not list unrelated customers or Partners."
      metrics={metrics}
      title={title}
    >
      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16"
        resultLabel={`${props.row.totals.referralCount} referral(s)`}
        resultTone="info"
        title="Parent account"
      >
        <div className="service-trace-summary">
          <div>
            <span>Parent</span>
            <AdminPersonCell
              avatarClassName="vuexy-booking-avatar"
              avatarStatus="offline"
              className="vuexy-booking-person admin-mt-8"
              copyClassName="vuexy-booking-person-copy"
              helper={props.row.referrer.user?.phone}
              href={profileHref}
              label={parentLabel}
              linkClassName="vuexy-booking-person-link"
            />
          </div>
          <div>
            <span>Referral code</span>
            <strong>{props.row.referralCode?.code ?? 'No code'}</strong>
            {props.row.referralCode ? (
              <small className="muted">
                {props.row.referralCode.active ? 'Active' : 'Paused'} · {formatDateTime(props.row.referralCode.createdAt)}
              </small>
            ) : null}
          </div>
          <div>
            <span>Share link</span>
            {props.row.referralCode ? (
              <>
                <Link className="text-link" href={referralShareUrl(props.audience, props.row.referralCode.code)}>
                  Open referral link
                </Link>
                <ReferralStoreSetupStatus audience={props.audience} />
              </>
            ) : (
              <strong>Not ready</strong>
            )}
            <small className="muted">Public link routes to the correct app store.</small>
          </div>
          <div>
            <span>Total rewards</span>
            <strong>{formatMoney(numberOrZero(props.row.totals.totalRewardAmount), 'VND', '0 VND')}</strong>
            <small className="muted">{numberOrZero(props.row.totals.rewardCount)} reward record(s)</small>
          </div>
        </div>
      </AdminFilterPanel>

      <ReferralOperationsBoard
        referralCount={props.row.referrals.length}
        rewardCount={rewardRows.length}
        summary={reviewSummary}
      />

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card"
        resultLabel={`${props.row.referrals.length} attribution(s)`}
        resultTone="info"
        title="Referral attributions"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table"
            emptyMessage="No referral attribution records for this parent."
            headers={['Referred Account', 'Status', 'Source', 'Rewards', 'Created']}
            rowCount={props.row.referrals.length}
          >
            {props.row.referrals.map((referral) => {
              const referred = referredAccountCell(props.audience, referral);
              const rewardSummary = referralRewardReviewSummaryFromRewards(referral.rewards);

              return (
                <tr key={referral.id}>
                  <td>{referred}</td>
                  <td>
                    <div className="participant-list">
                      <StatusBadge tone={referralStatusTone(referral.status)}>{referral.status}</StatusBadge>
                      <StatusBadge tone={referral.fraudReviewStatus === 'CLEAR' ? 'success' : 'warning'}>
                        {referral.fraudReviewStatus}
                      </StatusBadge>
                    </div>
                  </td>
                  <td>
                    <strong>{referral.installSource ?? 'Unknown'}</strong>
                    <p className="muted">{referral.platform ?? 'No platform captured'}</p>
                  </td>
                  <td>
                    <ReferralAttributionRewardCell rewardCount={referral.rewards.length} summary={rewardSummary} />
                  </td>
                  <td>
                    <span className="muted">{formatDateTime(referral.createdAt)}</span>
                  </td>
                </tr>
              );
            })}
          </AdminDataTable>
        </AdminTableScroll>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card"
        resultLabel={`${rewardRows.length} reward(s)`}
        resultTone="info"
        title="Reward ledger"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table"
            emptyMessage="No referral reward records for this parent."
            headers={['Referred', 'Reward', 'Status', 'Booking', 'Credit State', 'Created', 'Actions']}
            rowCount={rewardRows.length}
          >
            {rewardRows.map(({ attributionId, referredHref, referredLabel, referredPhone, reward }) => (
              <tr key={`${attributionId}:${reward.id}`}>
                <td>
                  <AdminPersonCell
                    avatarClassName="vuexy-booking-avatar"
                    avatarStatus="offline"
                    className="vuexy-booking-person"
                    copyClassName="vuexy-booking-person-copy"
                    helper={referralRewardReferredHelper(referredPhone, attributionId)}
                    href={referredHref}
                    label={referredLabel}
                    linkClassName="vuexy-booking-person-link"
                  />
                </td>
                <td>
                  <strong>{formatMoney(reward.amount, reward.currency, '0 VND')}</strong>
                  {reward.availableAt ? <p className="muted">Available {formatDateTime(reward.availableAt)}</p> : null}
                </td>
                <td>
                  <StatusBadge tone={rewardStatusTone(reward.status)}>{reward.status}</StatusBadge>
                </td>
                <td>
                  {reward.qualifyingBookingId ? (
                    <Link className="text-link" href={`/bookings/${reward.qualifyingBookingId}`}>
                      {reward.qualifyingBookingId}
                    </Link>
                  ) : (
                    <span className="muted">No booking</span>
                  )}
                </td>
                <td>
                  <ReferralCreditStateCell reward={reward} />
                </td>
                <td>
                  <span className="muted">{formatDateTime(reward.createdAt)}</span>
                </td>
                <td>
                  <ReferralRewardActions
                    audience={props.audience}
                    parentId={props.row.referrer.id}
                    reward={reward}
                  />
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </AdminFilterPanel>
    </AdminPageTemplate>
  );
}

function ReferralAttributionRewardCell({
  rewardCount,
  summary,
}: {
  readonly rewardCount: number;
  readonly summary: ReferralRewardReviewSummary;
}) {
  const totalAmount =
    summary.ready.amount +
    summary.pending.amount +
    summary.held.amount +
    summary.credited.amount +
    summary.closed.amount;

  if (rewardCount === 0) {
    return <span className="muted">No reward yet</span>;
  }

  return (
    <div className="participant-list">
      {summary.ready.count > 0 ? <StatusBadge tone="success">Ready {summary.ready.count}</StatusBadge> : null}
      {summary.pending.count > 0 ? <StatusBadge tone="warning">Pending {summary.pending.count}</StatusBadge> : null}
      {summary.held.count > 0 ? <StatusBadge tone="warning">Held {summary.held.count}</StatusBadge> : null}
      {summary.credited.count > 0 ? <StatusBadge tone="success">Credited {summary.credited.count}</StatusBadge> : null}
      {summary.closed.count > 0 ? <StatusBadge tone="neutral">Closed {summary.closed.count}</StatusBadge> : null}
      <p className="muted">
        {rewardCount} reward(s) / {formatMoney(totalAmount, 'VND', '0 VND')}
      </p>
    </div>
  );
}

function ReferralOperationsBoard({
  referralCount,
  rewardCount,
  summary,
}: {
  readonly referralCount: number;
  readonly rewardCount: number;
  readonly summary: ReferralRewardReviewSummary;
}) {
  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16"
      resultLabel={`${summary.ready.count} ready / ${summary.held.count} held`}
      resultTone={summary.ready.count > 0 ? 'success' : summary.held.count > 0 ? 'warning' : 'info'}
      title="Referral operations board"
    >
      <div className="service-trace-summary">
        <div>
          <span>Referred accounts</span>
          <strong>{referralCount}</strong>
          <small className="muted">{rewardCount} reward record(s)</small>
        </div>
        <ReferralRewardReviewCard label="Ready to credit" summary={summary.ready} />
        <ReferralRewardReviewCard label="Pending checks" summary={summary.pending} />
        <ReferralRewardReviewCard label="Held for review" summary={summary.held} />
        <ReferralRewardReviewCard label="Ledger posted" summary={summary.credited} />
        <ReferralRewardReviewCard label="Closed rewards" summary={summary.closed} />
        <div>
          <span>Next operator action</span>
          <strong>{referralRewardNextOperatorAction(summary)}</strong>
          <small className="muted">Use the reward row action menu for the final wallet decision.</small>
        </div>
      </div>
    </AdminFilterPanel>
  );
}

function ReferralRewardReviewCard({
  label,
  summary,
}: {
  readonly label: string;
  readonly summary: ReferralRewardReviewBucket;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{summary.count} reward(s)</strong>
      <small className="muted">{formatMoney(summary.amount, 'VND', '0 VND')}</small>
    </div>
  );
}

function ReferralRewardActions({
  audience,
  parentId,
  reward,
}: {
  readonly audience: ReferralAudienceSlug;
  readonly parentId: string;
  readonly reward: AdminReferralReward;
}) {
  if (reward.walletLedgerReference) {
    return <span className="muted">Ledger posted</span>;
  }

  const canHold = reward.status === 'PENDING' || reward.status === 'AVAILABLE';
  const canCredit = reward.status === 'AVAILABLE';
  const canReverse = reward.status === 'PENDING' || reward.status === 'AVAILABLE' || reward.status === 'HELD';
  if (!canHold && !canCredit && !canReverse) {
    return <span className="muted">No action</span>;
  }

  const actions = referralRewardActionItems({
    audience,
    canCredit,
    canHold,
    canReverse,
    parentId,
    rewardId: reward.id,
  });

  return (
    <ActionMenu
      actions={actions}
      className="referral-reward-action-dropdown"
      label={`Referral reward actions for ${reward.id}`}
      title="Reward actions"
      variant="dropdown"
    />
  );
}

function referralRewardActionItems({
  audience,
  canCredit,
  canHold,
  canReverse,
  parentId,
  rewardId,
}: {
  readonly audience: ReferralAudienceSlug;
  readonly canCredit: boolean;
  readonly canHold: boolean;
  readonly canReverse: boolean;
  readonly parentId: string;
  readonly rewardId: string;
}): ActionMenuItem[] {
  const actions: ActionMenuItem[] = [];

  if (canCredit) {
    actions.push({
      action: creditReferralReward,
      hiddenInputs: referralRewardHiddenInputs({
        audience,
        parentId,
        reason: 'Credit ready referral reward to wallet after detail review.',
        rewardId,
      }),
      kind: 'submit',
      label: 'Credit to wallet',
      tone: 'success',
    });
  }

  if (canHold) {
    actions.push({
      action: holdReferralReward,
      hiddenInputs: referralRewardHiddenInputs({
        audience,
        parentId,
        reason: 'Hold referral reward for admin review from detail page.',
        rewardId,
      }),
      kind: 'submit',
      label: 'Hold for review',
      tone: 'warning',
    });
  }

  if (canReverse) {
    actions.push({
      action: reverseReferralReward,
      hiddenInputs: referralRewardHiddenInputs({
        audience,
        parentId,
        reason: 'Reverse referral reward from detail review.',
        rewardId,
      }),
      kind: 'submit',
      label: 'Reverse reward',
      tone: 'danger',
    });
  }

  return actions;
}

function referralRewardHiddenInputs({
  audience,
  parentId,
  reason,
  rewardId,
}: {
  readonly audience: ReferralAudienceSlug;
  readonly parentId: string;
  readonly reason: string;
  readonly rewardId: string;
}) {
  return [
    { name: 'rewardId', value: rewardId },
    { name: 'audience', value: audience },
    { name: 'parentId', value: parentId },
    { name: 'reason', value: reason },
  ] as const;
}

function ReferralCreditStateCell({ reward }: { readonly reward: AdminReferralReward }) {
  const creditState = referralRewardCreditState(reward);

  return (
    <div className="participant-list">
      <StatusBadge tone={creditState.tone}>{creditState.label}</StatusBadge>
      <p className="muted">{creditState.helper}</p>
    </div>
  );
}

function referralRewardRows(props: ReferralParentDetailPageProps): ReferralRewardRow[] {
  if (props.audience === 'customer') {
    return props.row.referrals.flatMap((referral) => {
      const referredLabel = userLabel(referral.referredCustomer?.user, 'Unknown customer');

      return referral.rewards.map((reward) => ({
        attributionId: referral.id,
        referredHref: referral.referredCustomer ? `/customers/${referral.referredCustomer.id}` : null,
        referredLabel,
        referredPhone: referral.referredCustomer?.user?.phone,
        reward,
      }));
    });
  }

  return props.row.referrals.flatMap((referral) => {
    const referredLabel =
      referral.referredPartner?.displayName ?? userLabel(referral.referredPartner?.user, 'Unknown Partner');

    return referral.rewards.map((reward) => ({
      attributionId: referral.id,
      referredHref: referral.referredPartner ? `/partners/${referral.referredPartner.id}` : null,
      referredLabel,
      referredPhone: referral.referredPartner?.user?.phone,
      reward,
    }));
  });
}

function referralRewardReferredHelper(phone: string | null | undefined, attributionId: string) {
  return [phone, `Attribution ${attributionId}`].filter(Boolean).join(' · ');
}

function referralRewardReviewSummary(rows: readonly ReferralRewardRow[]): ReferralRewardReviewSummary {
  return referralRewardReviewSummaryFromRewards(rows.map(({ reward }) => reward));
}

function referralRewardReviewSummaryFromRewards(rewards: readonly AdminReferralReward[]): ReferralRewardReviewSummary {
  const mutableSummary = {
    closed: mutableReferralRewardReviewBucket(),
    credited: mutableReferralRewardReviewBucket(),
    held: mutableReferralRewardReviewBucket(),
    pending: mutableReferralRewardReviewBucket(),
    ready: mutableReferralRewardReviewBucket(),
  };

  for (const reward of rewards) {
    if (reward.walletLedgerReference || reward.status === 'REWARDED') {
      addReferralRewardReviewAmount(mutableSummary.credited, reward.amount);
    } else if (reward.status === 'AVAILABLE') {
      addReferralRewardReviewAmount(mutableSummary.ready, reward.amount);
    } else if (reward.status === 'HELD') {
      addReferralRewardReviewAmount(mutableSummary.held, reward.amount);
    } else if (reward.status === 'REVERSED' || reward.status === 'CANCELLED') {
      addReferralRewardReviewAmount(mutableSummary.closed, reward.amount);
    } else {
      addReferralRewardReviewAmount(mutableSummary.pending, reward.amount);
    }
  }

  return mutableSummary;
}

function mutableReferralRewardReviewBucket() {
  return { amount: 0, count: 0 };
}

function addReferralRewardReviewAmount(bucket: { amount: number; count: number }, amount: number) {
  bucket.amount += numberOrZero(amount);
  bucket.count += 1;
}

function referralRewardNextOperatorAction(summary: ReferralRewardReviewSummary) {
  if (summary.ready.count > 0) return 'Credit ready rewards or hold suspicious rows.';
  if (summary.held.count > 0) return 'Review held rewards before release or reversal.';
  if (summary.pending.count > 0) return 'Wait for booking, hold-period, and fraud checks.';
  if (summary.closed.count > 0) return 'No wallet action needed for closed rewards.';
  return 'No referral reward action needed.';
}

function referredAccountCell(
  audience: ReferralAudienceSlug,
  referral:
    | AdminCustomerReferralParent['referrals'][number]
    | AdminPartnerReferralParent['referrals'][number],
) {
  if (audience === 'customer') {
    const customerReferral = referral as AdminCustomerReferralParent['referrals'][number];

    return (
      <AdminPersonCell
        avatarClassName="vuexy-booking-avatar"
        avatarStatus="offline"
        className="vuexy-booking-person"
        copyClassName="vuexy-booking-person-copy"
        helper={customerReferral.referredCustomer?.user?.phone}
        href={customerReferral.referredCustomer ? `/customers/${customerReferral.referredCustomer.id}` : null}
        label={userLabel(customerReferral.referredCustomer?.user, 'Unknown customer')}
        linkClassName="vuexy-booking-person-link"
      />
    );
  }

  const partnerReferral = referral as AdminPartnerReferralParent['referrals'][number];
  return (
    <AdminPersonCell
      avatarClassName="vuexy-booking-avatar"
      avatarStatus="offline"
      className="vuexy-booking-person"
      copyClassName="vuexy-booking-person-copy"
      helper={partnerReferral.referredPartner?.user?.phone}
      href={partnerReferral.referredPartner ? `/partners/${partnerReferral.referredPartner.id}` : null}
      label={partnerReferral.referredPartner?.displayName ?? userLabel(partnerReferral.referredPartner?.user, 'Unknown Partner')}
      linkClassName="vuexy-booking-person-link"
    />
  );
}

function referralStatusTone(status: string): StatusBadgeTone {
  if (status === 'REWARDED' || status === 'QUALIFIED') return 'success';
  if (status === 'BLOCKED' || status === 'CANCELLED') return 'danger';
  return 'info';
}

function rewardStatusTone(status: string): StatusBadgeTone {
  if (status === 'AVAILABLE') return 'success';
  if (status === 'HELD' || status === 'PENDING') return 'warning';
  if (status === 'REVERSED' || status === 'CANCELLED') return 'danger';
  return 'neutral';
}

function userLabel(user: AdminReferralUserSummary | null | undefined, fallback: string) {
  return user?.fullName ?? user?.phone ?? user?.email ?? fallback;
}

function numberOrZero(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}
