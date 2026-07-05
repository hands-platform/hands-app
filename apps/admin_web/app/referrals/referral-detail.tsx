import Link from 'next/link';
import type { ReactNode } from 'react';

import { ActionMenuDropdownForm, ActionMenuDropdownSurface } from '../../components/action-menu';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFormControlButton, AdminFormInput } from '../../components/admin-form-controls';
import { AdminPageTemplate, type AdminPageMetric } from '../../components/admin-page-template';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { AdminBasicTimeline, AdminDisclosure, type AdminBasicTimelineItem } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, type StatusBadgeTone } from '../../components/status-badge';
import {
  type AdminCustomerReferralParent,
  type AdminPartnerReferralParent,
  type AdminReferralReward,
  type AdminReferralUserSummary,
} from '../../lib/admin-api';
import {
  isReferralRewardBlocked,
  isReferralRewardClosed,
  isReferralRewardCredited,
  referralRewardCreditState,
  referralRewardDecisionLabel,
} from '../../lib/referral-reward-credit-state';
import { referralShareUrl, type ReferralAudienceSlug } from '../../lib/referral-links';
import {
  approveReferralRewardCashout,
  creditReferralReward,
  holdReferralReward,
  markReferralRewardCashoutPaid,
  requireReferralRewardTaxReview,
  reverseReferralReward,
} from './actions';
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

type ReferralAttribution =
  | AdminCustomerReferralParent['referrals'][number]
  | AdminPartnerReferralParent['referrals'][number];

type ReferralRewardActionForm = {
  readonly action: (formData: FormData) => Promise<void> | void;
  readonly label: string;
};

type ReferralRewardEvidenceItem = {
  readonly id: string;
  readonly node: ReactNode;
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
      value: <MoneyText amount={numberOrZero(props.row.totals.availableRewardAmount)} fallback="0 VND" />,
      helper: 'Reward candidates ready for credit, not necessarily wallet-ledgered.',
    },
    {
      label: 'Credited rewards',
      value: <MoneyText amount={numberOrZero(props.row.totals.rewardedRewardAmount)} fallback="0 VND" />,
      helper: 'Rewards already posted to wallet ledger entries.',
    },
    {
      label: 'Pending / held',
      value: (
        <>
          <MoneyText amount={numberOrZero(props.row.totals.pendingRewardAmount)} fallback="0 VND" />
          {' / '}
          <MoneyText amount={numberOrZero(props.row.totals.heldRewardAmount)} fallback="0 VND" />
        </>
      ),
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
                {props.row.referralCode.active ? 'Active' : 'Paused'} ·{' '}
                <DateTimeText value={props.row.referralCode.createdAt} />
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
            <strong>
              <MoneyText amount={numberOrZero(props.row.totals.totalRewardAmount)} fallback="0 VND" />
            </strong>
            <small className="muted">{numberOrZero(props.row.totals.rewardCount)} reward record(s)</small>
          </div>
        </div>
      </AdminFilterPanel>

      <ReferralOperationsBoard
        referralCount={props.row.referrals.length}
        rewardCount={rewardRows.length}
        summary={reviewSummary}
      />

      <ReferralRewardDecisionTimeline referrals={props.row.referrals} summary={reviewSummary} />

      <AdminTablePanel
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
                    <span className="muted">
                      <DateTimeText value={referral.createdAt} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </AdminDataTable>
        </AdminTableScroll>
      </AdminTablePanel>

      <AdminTablePanel
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
                  <strong>
                    <MoneyText amount={reward.amount} currency={reward.currency} fallback="0 VND" />
                  </strong>
                  {reward.availableAt ? (
                    <p className="muted">
                      Available <DateTimeText value={reward.availableAt} />
                    </p>
                  ) : null}
                  <ReferralRewardCalculationSnapshot reward={reward} />
                </td>
                <td>
                  <StatusBadge tone={rewardStatusTone(reward.status)}>{reward.status}</StatusBadge>
                </td>
                <td>
                  <ReferralQualifyingBookingCell bookingId={reward.qualifyingBookingId} />
                </td>
                <td>
                  <ReferralCreditStateCell reward={reward} />
                </td>
                <td>
                  <span className="muted">
                    <DateTimeText value={reward.createdAt} />
                  </span>
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
      </AdminTablePanel>
    </AdminPageTemplate>
  );
}

function ReferralRewardDecisionTimeline({
  referrals,
  summary,
}: {
  readonly referrals: readonly ReferralAttribution[];
  readonly summary: ReferralRewardReviewSummary;
}) {
  const qualifiedCount = referrals.filter((referral) => referralStatusBucket(referral.status) === 'qualified').length;
  const reviewCount = referrals.filter((referral) => referral.fraudReviewStatus !== 'CLEAR').length;

  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16"
      resultLabel={`${summary.ready.count + summary.held.count + summary.pending.count} open reward(s)`}
      resultTone={summary.held.count > 0 || reviewCount > 0 ? 'warning' : summary.ready.count > 0 ? 'success' : 'info'}
      title="Reward decision timeline"
    >
      <AdminBasicTimeline
        className="referral-reward-decision-timeline"
        compactMeta
        items={referralRewardDecisionTimelineItems({ qualifiedCount, referrals, reviewCount, summary })}
      />
    </AdminFilterPanel>
  );
}

function referralRewardDecisionTimelineItems({
  qualifiedCount,
  referrals,
  reviewCount,
  summary,
}: {
  readonly qualifiedCount: number;
  readonly referrals: readonly ReferralAttribution[];
  readonly reviewCount: number;
  readonly summary: ReferralRewardReviewSummary;
}): readonly AdminBasicTimelineItem[] {
  return [
    {
      detail: 'Referral link attribution has been recorded for this parent account.',
      id: 'attribution-captured',
      meta: [
        { label: 'Attributions', value: `${referrals.length}` },
        { label: 'Reward records', value: `${rewardTotalCount(summary)}` },
      ],
      title: 'Attribution captured',
      tone: 'primary',
      value: `${referrals.length} referred account(s)`,
    },
    {
      detail: 'Only qualified and clear attributions should move toward wallet credit.',
      id: 'qualification-fraud-check',
      meta: [
        { label: 'Qualified', value: `${qualifiedCount}` },
        { label: 'Needs review', value: `${reviewCount}` },
      ],
      title: 'Qualification and fraud check',
      tone: reviewCount > 0 ? 'warning' : 'success',
      value: `${qualifiedCount} qualified · ${reviewCount} review`,
    },
    {
      detail: (
        <>
          <MoneyText amount={summary.ready.amount} fallback="0 VND" /> ready ·{' '}
          <MoneyText amount={summary.held.amount} fallback="0 VND" /> held ·{' '}
          <MoneyText amount={summary.pending.amount} fallback="0 VND" /> pending
        </>
      ),
      id: 'reward-queue',
      meta: [
        { label: 'Ready', value: `${summary.ready.count}` },
        { label: 'Held', value: `${summary.held.count}` },
        { label: 'Pending', value: `${summary.pending.count}` },
      ],
      title: 'Reward queue',
      tone: summary.held.count > 0 ? 'warning' : summary.ready.count > 0 ? 'success' : 'info',
      value: `${summary.ready.count} ready · ${summary.held.count} held · ${summary.pending.count} pending`,
    },
    {
      detail: 'Use row actions for wallet credit, hold, or reversal.',
      id: 'wallet-decision',
      meta: [
        { label: 'Ledger posted', value: `${summary.credited.count}` },
        { label: 'Closed', value: `${summary.closed.count}` },
      ],
      title: 'Wallet decision',
      tone: summary.credited.count > 0 ? 'success' : summary.closed.count > 0 ? 'info' : 'primary',
      value: referralRewardNextOperatorAction(summary),
    },
  ];
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
        {rewardCount} reward(s) / <MoneyText amount={totalAmount} fallback="0 VND" />
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
      <small className="muted">
        <MoneyText amount={summary.amount} fallback="0 VND" />
      </small>
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
  const canApproveCashout = reward.status === 'CASHOUT_REQUESTED';
  const canMarkCashoutPaid = reward.status === 'CASHOUT_APPROVED';
  const canRequireTaxReview = reward.status === 'CASHOUT_REQUESTED' || reward.status === 'CASHOUT_APPROVED';

  if (reward.walletLedgerReference && !canApproveCashout && !canMarkCashoutPaid && !canRequireTaxReview) {
    return <span className="muted">Ledger posted</span>;
  }

  const canHold = reward.status === 'PENDING' || reward.status === 'AVAILABLE';
  const canCredit = reward.status === 'AVAILABLE';
  const canReverse = reward.status === 'PENDING' || reward.status === 'AVAILABLE' || reward.status === 'HELD';
  if (!canHold && !canCredit && !canReverse && !canApproveCashout && !canMarkCashoutPaid && !canRequireTaxReview) {
    return <span className="muted">No action</span>;
  }

  const actions = referralRewardActionItems({
    canApproveCashout,
    canCredit,
    canHold,
    canMarkCashoutPaid,
    canRequireTaxReview,
    canReverse,
  });
  const hiddenInputs = referralRewardHiddenInputs({
    audience,
    parentId,
    rewardId: reward.id,
  });

  return (
    <ActionMenuDropdownSurface
      className="referral-reward-action-dropdown"
      label={`Referral reward actions for ${reward.id}`}
      menuClassName="action-menu-panel referral-reward-action-panel"
      title="Reward actions"
    >
      <ActionMenuDropdownForm action={actions[0]?.action} className="referral-reward-action-form">
        {hiddenInputs.map((input) => (
          <input key={input.name} name={input.name} type="hidden" value={String(input.value)} />
        ))}
        <div className="referral-reward-action-reason">
          <span>Reason</span>
          <AdminFormInput
            className="referral-reward-action-reason-input"
            label="Reward decision reason"
            name="reason"
            placeholder="Operator decision reason"
          />
        </div>
        {canMarkCashoutPaid ? (
          <>
            <div className="referral-reward-action-reason">
              <span>Approving admin</span>
              <AdminFormInput
                className="referral-reward-action-reason-input"
                label="Approving admin id"
                name="approvalAdminId"
                placeholder="Different admin user id"
                required
              />
            </div>
            <div className="referral-reward-action-reason">
              <span>Transfer reference</span>
              <AdminFormInput
                className="referral-reward-action-reason-input"
                label="Transfer reference"
                name="transferRef"
                placeholder="Bank transfer reference"
                required
              />
            </div>
          </>
        ) : null}
        <div className="referral-reward-action-button-list">
          {actions.map((item) => (
            <AdminFormControlButton
              className="button-secondary admin-action-item admin-action-button"
              formAction={item.action}
              key={item.label}
              role="menuitem"
              type="submit"
            >
              <span>{item.label}</span>
            </AdminFormControlButton>
          ))}
        </div>
      </ActionMenuDropdownForm>
    </ActionMenuDropdownSurface>
  );
}

function referralRewardActionItems({
  canApproveCashout,
  canCredit,
  canHold,
  canMarkCashoutPaid,
  canRequireTaxReview,
  canReverse,
}: {
  readonly canApproveCashout: boolean;
  readonly canCredit: boolean;
  readonly canHold: boolean;
  readonly canMarkCashoutPaid: boolean;
  readonly canRequireTaxReview: boolean;
  readonly canReverse: boolean;
}): ReferralRewardActionForm[] {
  const actions: ReferralRewardActionForm[] = [];

  if (canApproveCashout) {
    actions.push({
      action: approveReferralRewardCashout,
      label: 'Approve cashout',
    });
  }

  if (canMarkCashoutPaid) {
    actions.push({
      action: markReferralRewardCashoutPaid,
      label: 'Mark paid',
    });
  }

  if (canRequireTaxReview) {
    actions.push({
      action: requireReferralRewardTaxReview,
      label: 'Require tax review',
    });
  }

  if (canCredit) {
    actions.push({
      action: creditReferralReward,
      label: 'Credit to wallet',
    });
  }

  if (canHold) {
    actions.push({
      action: holdReferralReward,
      label: 'Hold for review',
    });
  }

  if (canReverse) {
    actions.push({
      action: reverseReferralReward,
      label: 'Reverse reward',
    });
  }

  return actions;
}

function referralRewardHiddenInputs({
  audience,
  parentId,
  rewardId,
}: {
  readonly audience: ReferralAudienceSlug;
  readonly parentId: string;
  readonly rewardId: string;
}) {
  return [
    { name: 'rewardId', value: rewardId },
    { name: 'audience', value: audience },
    { name: 'parentId', value: parentId },
  ] as const;
}

function ReferralCreditStateCell({ reward }: { readonly reward: AdminReferralReward }) {
  const creditState = referralRewardCreditState(reward);
  const decisionSummary = referralRewardDecisionSummary(reward);
  const evidenceItems = referralRewardDecisionEvidence(reward);

  return (
    <div className="participant-list">
      <StatusBadge tone={creditState.tone}>{creditState.label}</StatusBadge>
      <p className="muted">{creditState.helper}</p>
      {decisionSummary ? <p className="muted">{decisionSummary}</p> : null}
      <AdminDisclosure className="referral-reward-evidence-details">
        <summary>Decision evidence</summary>
        <div className="participant-list referral-reward-decision-evidence">
          {evidenceItems.map((item) => (
            <span className="muted" key={item.id}>
              {item.node}
            </span>
          ))}
        </div>
      </AdminDisclosure>
    </div>
  );
}

function ReferralRewardCalculationSnapshot({ reward }: { readonly reward: AdminReferralReward }) {
  const snapshot = reward.calculationSnapshot;
  const grossFee = snapshotNumber(snapshot, 'platformFeeGross');
  const vatRateBps = snapshotNumber(snapshot, 'platformFeeVatRateBps');
  const netFee = snapshotNumber(snapshot, 'platformFeeNetRevenue');
  const rewardRateBps = snapshotNumber(snapshot, 'rewardRateSnapshotBps');
  const snapshotReward = snapshotNumber(snapshot, 'rewardAmountSnapshot');

  if (
    grossFee === null &&
    vatRateBps === null &&
    netFee === null &&
    rewardRateBps === null &&
    snapshotReward === null
  ) {
    return null;
  }

  return (
    <div className="referral-reward-calculation-snapshot">
      <span className="muted">Calculation snapshot</span>
      <p className="muted">
        {grossFee !== null ? (
          <>
            Gross fee <MoneyText amount={grossFee} currency={reward.currency} fallback="0 VND" />
          </>
        ) : null}
        {vatRateBps !== null ? ` · VAT ${formatBpsPercent(vatRateBps)}` : null}
      </p>
      <p className="muted">
        {netFee !== null ? (
          <>
            Net fee <MoneyText amount={netFee} currency={reward.currency} fallback="0 VND" />
          </>
        ) : null}
        {rewardRateBps !== null ? ` · Rate ${formatBpsPercent(rewardRateBps)}` : null}
      </p>
      {snapshotReward !== null ? (
        <p className="muted">
          Snapshot reward <MoneyText amount={snapshotReward} currency={reward.currency} fallback="0 VND" />
        </p>
      ) : null}
    </div>
  );
}

function referralRewardDecisionSummary(reward: AdminReferralReward) {
  if (reward.latestDecision) {
    const decisionLabel = referralRewardDecisionLabel(reward.latestDecision.action);
    const actorLabel = userLabel(reward.latestDecision.actor, 'Unknown admin');

    return `Latest decision ${decisionLabel} by ${actorLabel}`;
  }

  if (reward.walletLedgerReference) {
    return `Ledger ${reward.walletLedgerReference}`;
  }

  if (reward.availableAt) {
    return (
      <>
        Available <DateTimeText value={reward.availableAt} />
      </>
    );
  }

  return null;
}

function referralRewardDecisionEvidence(reward: AdminReferralReward) {
  const evidenceItems: ReferralRewardEvidenceItem[] = [
    {
      id: 'wallet-ledger',
      node: reward.walletLedgerReference ? `Ledger ${reward.walletLedgerReference}` : 'No wallet ledger yet',
    },
  ];

  if (reward.qualifyingBookingId) {
    evidenceItems.push({
      id: 'qualifying-booking',
      node: `Booking ${reward.qualifyingBookingId}`,
    });
  }

  if (reward.availableAt) {
    evidenceItems.push({
      id: 'available-at',
      node: (
        <>
          Available <DateTimeText value={reward.availableAt} />
        </>
      ),
    });
  }

  if (reward.latestDecision) {
    const decisionLabel = referralRewardDecisionLabel(reward.latestDecision.action);
    const actorLabel = userLabel(reward.latestDecision.actor, 'Unknown admin');
    evidenceItems.push({
      id: 'latest-decision',
      node: `Latest decision ${decisionLabel} by ${actorLabel}`,
    });
    if (reward.latestDecision.reason) {
      evidenceItems.push({
        id: 'latest-decision-reason',
        node: `Reason ${reward.latestDecision.reason}`,
      });
    }
    evidenceItems.push({
      id: 'latest-decision-at',
      node: (
        <>
          Decision time <DateTimeText value={reward.latestDecision.createdAt} />
        </>
      ),
    });
  }

  if (!reward.walletLedgerReference && referralRewardRequiresOperatorReason(reward)) {
    evidenceItems.push({
      id: 'operator-reason-required',
      node: 'Operator reason required for next action',
    });
  }

  return evidenceItems;
}

function referralRewardRequiresOperatorReason(reward: AdminReferralReward) {
  return reward.status === 'AVAILABLE' || reward.status === 'HELD' || reward.status === 'PENDING';
}

function ReferralQualifyingBookingCell({ bookingId }: { readonly bookingId?: string | null }) {
  if (!bookingId) {
    return <span className="muted">No qualifying booking linked</span>;
  }

  return (
    <Link className="text-link" href={`/bookings/${bookingId}`}>
      {bookingId}
    </Link>
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
    if (isReferralRewardCredited(reward)) {
      addReferralRewardReviewAmount(mutableSummary.credited, reward.amount);
    } else if (reward.status === 'AVAILABLE') {
      addReferralRewardReviewAmount(mutableSummary.ready, reward.amount);
    } else if (isReferralRewardBlocked(reward.status)) {
      addReferralRewardReviewAmount(mutableSummary.held, reward.amount);
    } else if (isReferralRewardClosed(reward.status)) {
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

function rewardTotalCount(summary: ReferralRewardReviewSummary) {
  return summary.ready.count + summary.pending.count + summary.held.count + summary.credited.count + summary.closed.count;
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

function referralStatusBucket(status: string) {
  if (status === 'QUALIFIED' || status === 'REWARDED') return 'qualified';
  if (status === 'BLOCKED' || status === 'CANCELLED') return 'blocked';
  return 'pending';
}

function rewardStatusTone(status: string): StatusBadgeTone {
  if (status === 'AVAILABLE') return 'success';
  if (
    status === 'CREDITED' ||
    status === 'OFFSET' ||
    status === 'PAID' ||
    status === 'REWARDED' ||
    status === 'USED_FOR_SERVICE'
  ) {
    return 'success';
  }
  if (
    status === 'CASHOUT_APPROVED' ||
    status === 'CASHOUT_REQUESTED' ||
    status === 'HELD' ||
    status === 'LOCKED' ||
    status === 'PENDING' ||
    status === 'TAX_REVIEW_REQUIRED'
  ) {
    return 'warning';
  }
  if (status === 'REVERSED' || status === 'CANCELLED') return 'danger';
  return 'neutral';
}

function userLabel(user: AdminReferralUserSummary | null | undefined, fallback: string) {
  return user?.fullName ?? user?.phone ?? user?.email ?? fallback;
}

function numberOrZero(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function snapshotNumber(snapshot: Record<string, unknown> | null | undefined, key: string) {
  const value = snapshot?.[key];
  const numericValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;

  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatBpsPercent(value: number) {
  const percent = value / 100;

  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%`;
}
