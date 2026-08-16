import type { ReactNode } from 'react';

import { ActionMenuDropdownForm, ActionMenuDropdownSurface } from '../../components/action-menu';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import {
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormInput,
} from '../../components/admin-form-controls';
import { AdminInlineFallback } from '../../components/admin-inline-fallback';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { AdminPageTemplate, type AdminPageMetric } from '../../components/admin-page-template';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { AdminBasicTimeline, AdminDisclosure, AdminSection, type AdminBasicTimelineItem } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { AdminTraceSummary } from '../../components/admin-overview-card';
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
import { referralShareUrl, referralStoreSetupState, type ReferralAudienceSlug } from '../../lib/referral-links';
import {
  approveReferralRewardCashout,
  creditReferralReward,
  holdReferralReward,
  markReferralRewardCashoutPaid,
  releaseHeldReferralReward,
  requireReferralRewardTaxReview,
  reverseReferralReward,
} from './actions';
import { ReferralStoreSetupStatus } from './referral-store-setup-status';

type ReferralParentDetailPageProps =
  | {
      readonly audience: 'customer';
      readonly canViewDeveloperSetup?: boolean;
      readonly actionNotice?: ReferralDetailNotice;
      readonly actionReason?: string;
      readonly highlightRewardId?: string;
      readonly row: AdminCustomerReferralParent;
    }
  | {
      readonly audience: 'partner';
      readonly canViewDeveloperSetup?: boolean;
      readonly actionNotice?: ReferralDetailNotice;
      readonly actionReason?: string;
      readonly highlightRewardId?: string;
      readonly row: AdminPartnerReferralParent;
    };

type ReferralDetailNotice = {
  readonly message: string;
  readonly tone: 'danger' | 'success' | 'warning';
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
  readonly disabled?: boolean;
  readonly formNoValidate?: boolean;
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
  const parentLabel = isPartner
    ? props.row.referrer.displayName ?? userLabel(props.row.referrer.user, 'Unknown Partner')
    : userLabel(props.row.referrer.user, 'Unknown customer');
  const title = isPartner ? `Partner referral · ${parentLabel}` : `Customer referral · ${parentLabel}`;
  const profileHref = isPartner ? `/partners/${props.row.referrer.id}` : `/customers/${props.row.referrer.id}`;
  const rewardRows = referralRewardRows(props);
  const reviewSummary = referralRewardReviewSummary(rewardRows);
  const shareSetupReady = referralStoreSetupReady(props.audience);
  const focusedReward = rewardRows.find(({ reward }) => reward.id === props.highlightRewardId)?.reward ?? rewardRows[0]?.reward;
  const metrics: AdminPageMetric[] = [
    {
      label: 'Current decision',
      scope: null,
      value: focusedReward ? rewardStatusLabel(focusedReward.status) : 'No reward',
      helper: focusedReward ? referralRewardDecisionSummary(focusedReward) ?? 'Awaiting operator review.' : 'No reward decision is available.',
    },
    {
      label: 'Reward amount',
      scope: null,
      value: <MoneyText amount={focusedReward?.amount ?? 0} currency={focusedReward?.currency} fallback="0 VND" />,
      helper: focusedReward ? `${formatCount(rewardRows.length, 'reward')} for this parent account.` : 'No wallet liability recorded.',
    },
    {
      label: 'Evidence readiness',
      scope: null,
      value: focusedReward ? referralRewardEvidenceStatus(focusedReward) : 'Unavailable',
      helper: focusedReward ? referralRewardEvidenceSummary(focusedReward) : 'No reward evidence is available.',
    },
    {
      label: 'Next operator action',
      scope: null,
      value: referralRewardNextOperatorAction(reviewSummary),
      helper: focusedReward?.evidence?.blocker ? 'Resolve the evidence blocker before release or wallet credit.' : 'Use the reward row action after reviewing evidence.',
    },
  ];

  return (
    <AdminPageTemplate
      actions={
        <>
          <AdminTextLink href={isPartner ? '/referrals/partners' : '/referrals/customers'}>
            Back to referrals
          </AdminTextLink>
          <AdminTextLink href={profileHref}>
            Open profile
          </AdminTextLink>
        </>
      }
      description="Single referral parent account. This page does not list unrelated customers or Partners."
      metrics={metrics}
      title={title}
    >
      {props.actionNotice ? (
        <AdminInlineNotice className="admin-mt-16" role="status" tone={props.actionNotice.tone}>
          {props.actionNotice.message}
        </AdminInlineNotice>
      ) : null}
      <AdminSection
        className="referral-parent-account-panel admin-mt-16"
        statusLabel={formatCount(props.row.totals.referralCount, 'referral')}
        statusTone="info"
        title="Parent account"
      >
        <AdminTraceSummary
          inferScope={false}
          metrics={[
            {
              key: 'parent',
              label: 'Parent',
              value: parentLabel,
              detail: props.row.referrer.user?.phone ?? 'No phone on file',
              action: <AdminTextLink href={profileHref}>Open customer profile</AdminTextLink>,
            },
            {
              key: 'referral-code',
              label: 'Referral code',
              value: props.row.referralCode?.code ?? 'No code',
              detail: props.row.referralCode ? (
                <>
                  {props.row.referralCode.active ? 'Active' : 'Paused'} ·{' '}
                  <DateTimeText value={props.row.referralCode.createdAt} />
                </>
              ) : null,
            },
            {
              key: 'share-link',
              label: 'Share link',
              value: props.row.referralCode ? (shareSetupReady ? 'Available' : 'Setup blocked') : 'Not ready',
              detail: 'Public link routes to the correct app store.',
              action: props.row.referralCode ? (
                <>
                  {shareSetupReady ? (
                    <AdminTextLink href={referralShareUrl(props.audience, props.row.referralCode.code)}>
                      Open referral link
                    </AdminTextLink>
                  ) : null}
                  <ReferralStoreSetupStatus
                    audience={props.audience}
                    canViewDeveloperSetup={props.canViewDeveloperSetup ?? false}
                  />
                </>
              ) : null,
            },
            {
              key: 'total-rewards',
              label: 'Total rewards',
              value: <MoneyText amount={numberOrZero(props.row.totals.totalRewardAmount)} fallback="0 VND" />,
              detail: `${numberOrZero(props.row.totals.rewardCount)} reward record(s)`,
            },
          ]}
        />
      </AdminSection>

      <ReferralRewardDecisionTimeline referrals={props.row.referrals} summary={reviewSummary} />

      <AdminTablePanel
        resultLabel={formatCount(props.row.referrals.length, 'attribution')}
        resultTone="info"
        title="Referral attributions"
      >
        <AdminTableScroll ariaLabel="Referral attribution records">
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
                    <AdminFilterChipGroup>
                      <StatusBadge tone={referralStatusTone(referral.status)}>{referralStatusLabel(referral.status)}</StatusBadge>
                      <StatusBadge tone={referral.fraudReviewStatus === 'CLEAR' ? 'success' : 'warning'}>
                        {fraudReviewStatusLabel(referral.fraudReviewStatus)}
                      </StatusBadge>
                    </AdminFilterChipGroup>
                  </td>
                  <td>
                    <strong>{referral.installSource ?? 'Unknown'}</strong>
                    {referral.platform ? (
                      <p className="muted">{referral.platform}</p>
                    ) : (
                      <AdminInlineFallback className="admin-mt-6">No platform captured</AdminInlineFallback>
                    )}
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
        resultLabel={formatCount(rewardRows.length, 'reward')}
        resultTone="info"
        title="Reward ledger"
      >
        <AdminTableScroll ariaLabel="Referral reward ledger" className="referral-reward-ledger-scroll">
          <AdminDataTable
            className="vuexy-booking-table referral-reward-ledger-table"
            emptyMessage="No referral reward records for this parent."
            headers={['Referred', 'Evidence', 'Reward', 'Wallet / decision', 'Action']}
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
                    helper={referredPhone ?? 'Customer account'}
                    href={referredHref}
                    label={referredLabel}
                    linkClassName="vuexy-booking-person-link"
                  />
                </td>
                <td className="referral-reward-ledger-evidence-cell">
                  <ReferralQualifyingBookingCell bookingId={reward.qualifyingBookingId} />
                  <span className={reward.evidence?.ready || isReferralRewardCredited(reward) ? 'muted' : 'text-danger'}>
                    {referralRewardEvidenceSummary(reward)}
                  </span>
                  <AdminDisclosure className="referral-reward-technical-details">
                    <summary>Technical details</summary>
                    <span className="muted">Attribution {shortId(attributionId)}</span>
                    <span className="muted">Reward {shortId(reward.id)}</span>
                    {reward.walletLedgerReference ? <span className="muted">Ledger {shortId(reward.walletLedgerReference)}</span> : null}
                  </AdminDisclosure>
                </td>
                <td className="referral-reward-ledger-value-cell">
                  <strong><MoneyText amount={reward.amount} currency={reward.currency} fallback="0 VND" /></strong>
                  <StatusBadge tone={rewardStatusTone(reward.status)}>{rewardStatusLabel(reward.status)}</StatusBadge>
                  <ReferralRewardCalculationSnapshot reward={reward} />
                </td>
                <td className="referral-reward-ledger-decision-cell">
                  <ReferralCreditStateCell reward={reward} />
                </td>
                <td className="referral-reward-ledger-action-cell">
                  <ReferralRewardActions
                    actionReason={props.highlightRewardId === reward.id ? props.actionReason : undefined}
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
    <AdminSection
      className="referral-reward-decision-timeline-panel admin-mt-16"
      statusLabel={formatCount(summary.ready.count + summary.held.count + summary.pending.count, 'open reward')}
      statusTone={summary.held.count > 0 || reviewCount > 0 ? 'warning' : summary.ready.count > 0 ? 'success' : 'info'}
      title="Reward decision timeline"
    >
      <AdminBasicTimeline
        className="referral-reward-decision-timeline"
        compactMeta
        items={referralRewardDecisionTimelineItems({ qualifiedCount, referrals, reviewCount, summary })}
      />
    </AdminSection>
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
      title: 'Qualification and integrity check',
      tone: reviewCount > 0 ? 'warning' : 'success',
      value: `${qualifiedCount} qualified · ${reviewCount} review`,
    },
    {
      detail: (
        <>
          <MoneyText amount={summary.ready.amount} fallback="0 VND" /> ready ·{' '}
          <MoneyText amount={summary.held.amount} fallback="0 VND" /> on hold ·{' '}
          <MoneyText amount={summary.pending.amount} fallback="0 VND" /> pending
        </>
      ),
      id: 'reward-queue',
      meta: [
        { label: 'Ready', value: `${summary.ready.count}` },
        { label: 'On hold', value: `${summary.held.count}` },
        { label: 'Pending', value: `${summary.pending.count}` },
      ],
      title: 'Reward queue',
      tone: summary.held.count > 0 ? 'warning' : summary.ready.count > 0 ? 'success' : 'info',
      value: `${summary.ready.count} ready · ${summary.held.count} on hold · ${summary.pending.count} pending`,
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
    return <AdminInlineFallback>No reward yet</AdminInlineFallback>;
  }

  return (
    <AdminFilterChipGroup>
      {summary.ready.count > 0 ? <StatusBadge tone="success">Ready {summary.ready.count}</StatusBadge> : null}
      {summary.pending.count > 0 ? <StatusBadge tone="warning">Pending {summary.pending.count}</StatusBadge> : null}
      {summary.held.count > 0 ? <StatusBadge tone="warning">On hold {summary.held.count}</StatusBadge> : null}
      {summary.credited.count > 0 ? <StatusBadge tone="success">Credited {summary.credited.count}</StatusBadge> : null}
      {summary.closed.count > 0 ? <StatusBadge tone="neutral">Closed {summary.closed.count}</StatusBadge> : null}
      <p className="muted">
        {formatCount(rewardCount, 'reward')} / <MoneyText amount={totalAmount} fallback="0 VND" />
      </p>
    </AdminFilterChipGroup>
  );
}

function ReferralRewardActions({
  actionReason,
  audience,
  parentId,
  reward,
}: {
  readonly actionReason?: string;
  readonly audience: ReferralAudienceSlug;
  readonly parentId: string;
  readonly reward: AdminReferralReward;
}) {
  const canApproveCashout = reward.status === 'CASHOUT_REQUESTED';
  const canMarkCashoutPaid = reward.status === 'CASHOUT_APPROVED';
  const canRequireTaxReview = reward.status === 'CASHOUT_REQUESTED' || reward.status === 'CASHOUT_APPROVED';
  const evidenceBlocked = reward.evidence?.ready !== true;
  const fixtureBlocked = reward.isFixture === true;

  const hasWalletLedger = Boolean(reward.walletLedgerReference);
  const canHold = !hasWalletLedger && (reward.status === 'PENDING' || reward.status === 'AVAILABLE');
  const canCredit = !hasWalletLedger && reward.status === 'AVAILABLE';
  const canReleaseHold = !hasWalletLedger && reward.status === 'HELD';
  const canReverse =
    (hasWalletLedger && reward.status === 'CREDITED') ||
    (!hasWalletLedger &&
      (reward.status === 'PENDING' || reward.status === 'AVAILABLE' || reward.status === 'HELD'));
  if (!canHold && !canCredit && !canReleaseHold && !canReverse && !canApproveCashout && !canMarkCashoutPaid && !canRequireTaxReview) {
    return <AdminInlineFallback>No action</AdminInlineFallback>;
  }

  const actions = referralRewardActionItems({
    canApproveCashout,
    canCredit,
    canHold,
    canMarkCashoutPaid,
    canReleaseHold,
    canRequireTaxReview,
    canReverse,
    evidenceBlocked,
    fixtureBlocked,
  });
  const hiddenInputs = referralRewardHiddenInputs({
    audience,
    expectedStatus: reward.status,
    expectedUpdatedAt: reward.updatedAt,
    parentId,
    rewardId: reward.id,
  });

  return (
    <ActionMenuDropdownSurface
      className="referral-reward-action-dropdown"
      label={`Referral reward actions - ${rewardStatusLabel(reward.status)} - ${reward.amount} ${reward.currency ?? 'VND'}`}
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
            defaultValue={actionReason}
            label="Reward decision reason"
            maxLength={500}
            minLength={12}
            name="reason"
            placeholder="12-500 characters describing the evidence and decision"
            required
          />
        </div>
        <div className="referral-reward-action-evidence" aria-label="Reward decision evidence">
          <strong>Decision evidence</strong>
          <span>Current state: {rewardStatusLabel(reward.status)}</span>
          <span>Amount: <MoneyText amount={reward.amount} currency={reward.currency} fallback="0 VND" /></span>
          <span>{reward.qualifyingBookingId ? `Booking: ${reward.qualifyingBookingId}` : 'Booking evidence unavailable'}</span>
          <span>{referralRewardActionImpact(reward)}</span>
        </div>
        {fixtureBlocked ? (
          <AdminInlineNotice role="alert" tone="danger">
            TEST FIXTURE · wallet actions disabled. Test fixture rewards cannot change wallet or reward state.
          </AdminInlineNotice>
        ) : evidenceBlocked ? (
          <AdminInlineNotice role="alert" tone="warning">
            Blocked: {reward.evidence?.blocker?.message ?? 'Required reward evidence is unavailable.'}
          </AdminInlineNotice>
        ) : null}
        <AdminFormCheckbox
          label="Confirm reward decision"
          name="confirmation"
          required
          value="confirmed"
        >
          I reviewed the current state, booking evidence, reason, and wallet impact.
        </AdminFormCheckbox>
        {canMarkCashoutPaid ? (
          <>
            <AdminInlineNotice tone="info">
              The signed-in Finance operator is recorded as the paid closeout approver. The API blocks the operator
              who approved the cashout request from closing the same reward as paid.
            </AdminInlineNotice>
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
              disabled={item.disabled}
              formAction={item.action}
              formNoValidate={item.formNoValidate}
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

function referralRewardEvidenceStatus(reward: AdminReferralReward) {
  if (isReferralRewardCredited(reward)) return 'Posted';
  if (reward.evidence?.ready) return 'Ready';
  if (reward.evidence) return 'Blocked';
  return 'Unavailable';
}

function referralRewardEvidenceSummary(reward: AdminReferralReward) {
  if (isReferralRewardCredited(reward)) return 'Wallet ledger posted. Evidence is retained for audit and reversal.';
  if (reward.evidence?.ready) return 'Required booking, settlement, policy, and wallet evidence is ready.';
  if (reward.evidence?.blocker) return `Blocked: ${reward.evidence.blocker.message}`;
  return 'Server evidence preflight is unavailable. Refresh before any reward decision.';
}

function referralRewardActionItems({
  canApproveCashout,
  canCredit,
  canHold,
  canMarkCashoutPaid,
  canReleaseHold,
  canRequireTaxReview,
  canReverse,
  evidenceBlocked,
  fixtureBlocked,
}: {
  readonly canApproveCashout: boolean;
  readonly canCredit: boolean;
  readonly canHold: boolean;
  readonly canMarkCashoutPaid: boolean;
  readonly canReleaseHold: boolean;
  readonly canRequireTaxReview: boolean;
  readonly canReverse: boolean;
  readonly evidenceBlocked: boolean;
  readonly fixtureBlocked: boolean;
}): ReferralRewardActionForm[] {
  const actions: ReferralRewardActionForm[] = [];

  if (canApproveCashout) {
    actions.push({
      action: approveReferralRewardCashout,
      disabled: fixtureBlocked,
      label: 'Approve cashout',
    });
  }

  if (canMarkCashoutPaid) {
    actions.push({
      action: markReferralRewardCashoutPaid,
      disabled: fixtureBlocked,
      label: 'Mark paid',
    });
  }

  if (canRequireTaxReview) {
    actions.push({
      action: requireReferralRewardTaxReview,
      disabled: fixtureBlocked,
      formNoValidate: canMarkCashoutPaid,
      label: 'Require tax review',
    });
  }

  if (canCredit) {
    actions.push({
      action: creditReferralReward,
      disabled: fixtureBlocked || evidenceBlocked,
      label: 'Credit to wallet',
    });
  }

  if (canReleaseHold) {
    actions.push({
      action: releaseHeldReferralReward,
      disabled: fixtureBlocked || evidenceBlocked,
      label: 'Release hold',
    });
  }

  if (canHold) {
    actions.push({
      action: holdReferralReward,
      disabled: fixtureBlocked,
      label: 'Hold for review',
    });
  }

  if (canReverse) {
    actions.push({
      action: reverseReferralReward,
      disabled: fixtureBlocked,
      label: 'Reverse reward',
    });
  }

  return actions;
}

function referralRewardHiddenInputs({
  audience,
  expectedStatus,
  expectedUpdatedAt,
  parentId,
  rewardId,
}: {
  readonly audience: ReferralAudienceSlug;
  readonly expectedStatus: string;
  readonly expectedUpdatedAt: string;
  readonly parentId: string;
  readonly rewardId: string;
}) {
  return [
    { name: 'rewardId', value: rewardId },
    { name: 'audience', value: audience },
    { name: 'parentId', value: parentId },
    { name: 'expectedStatus', value: expectedStatus },
    { name: 'expectedUpdatedAt', value: expectedUpdatedAt },
  ] as const;
}

function referralRewardActionImpact(reward: AdminReferralReward) {
  if (reward.status === 'AVAILABLE') return 'Credit posts wallet liability; hold or reverse does not post a wallet credit.';
  if (reward.status === 'HELD') return 'Release returns the reward to AVAILABLE; reverse closes it without wallet credit.';
  if (reward.status === 'CREDITED') return 'Reverse creates compensating wallet ledger evidence; it does not delete history.';
  if (reward.status.startsWith('CASHOUT_')) return 'Cashout actions change payout state and require finance evidence.';
  return 'This state change does not post wallet value unless a later credit succeeds.';
}

function referralStoreSetupReady(audience: ReferralAudienceSlug) {
  const setup = referralStoreSetupState(audience);
  return setup.publicBase && setup.android && setup.ios;
}

function ReferralCreditStateCell({ reward }: { readonly reward: AdminReferralReward }) {
  const creditState = referralRewardCreditState(reward);
  const decisionSummary = referralRewardDecisionSummary(reward);
  const evidenceItems = referralRewardDecisionEvidence(reward);

  return (
    <AdminFilterChipGroup>
      <StatusBadge tone={creditState.tone}>{creditState.label}</StatusBadge>
      <p className="muted">{creditState.helper}</p>
      {decisionSummary ? <p className="muted">{decisionSummary}</p> : null}
      <AdminDisclosure className="referral-reward-evidence-details">
        <summary>Decision evidence</summary>
        <AdminFilterChipGroup className="referral-reward-decision-evidence">
          {evidenceItems.map((item) => (
            <span className="muted" key={item.id}>
              {item.node}
            </span>
          ))}
        </AdminFilterChipGroup>
      </AdminDisclosure>
    </AdminFilterChipGroup>
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
        Eligible since <DateTimeText value={reward.availableAt} />
      </>
    );
  }

  return null;
}

function referralRewardDecisionEvidence(reward: AdminReferralReward) {
  const evidenceItems: ReferralRewardEvidenceItem[] = [
    {
      id: 'wallet-ledger',
      node: reward.walletLedgerReference ? `Wallet credit ${reward.walletLedgerReference}` : 'No wallet credit yet',
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
          Eligible since <DateTimeText value={reward.availableAt} />
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
    return <AdminInlineFallback>No qualifying booking linked</AdminInlineFallback>;
  }

  return (
    <AdminTextLink href={`/bookings/${bookingId}`}>
      {bookingId}
    </AdminTextLink>
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

function shortId(value: string) {
  return value.length <= 14 ? value : `${value.slice(0, 8)}…${value.slice(-4)}`;
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
  if (summary.held.count > 0) return 'Review rewards on hold before release or reversal.';
  if (summary.pending.count > 0) return 'Wait for booking, hold-period, and integrity checks.';
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

function rewardStatusLabel(status: string) {
  const labels: Record<string, string> = {
    AVAILABLE: 'Ready to credit',
    CANCELLED: 'Cancelled',
    CASHOUT_APPROVED: 'Cashout approved',
    CASHOUT_REQUESTED: 'Cashout requested',
    CREDITED: 'Credited',
    HELD: 'On hold',
    LOCKED: 'Processing',
    OFFSET: 'Offset',
    PAID: 'Paid',
    PENDING: 'Pending checks',
    REVERSED: 'Reversed',
    REWARDED: 'Rewarded',
    TAX_REVIEW_REQUIRED: 'Tax review required',
    USED_FOR_SERVICE: 'Used for service',
  };
  return labels[status] ?? status.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
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
