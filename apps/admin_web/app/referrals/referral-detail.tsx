import Link from 'next/link';

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
  readonly referredLabel: string;
  readonly reward: AdminReferralReward;
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
  const metrics: AdminPageMetric[] = [
    {
      label: 'Referral sign-ups',
      value: props.row.totals.referralCount,
      helper: 'Only attributions for this parent account.',
    },
    {
      label: 'Reward records',
      value: props.row.totals.rewardCount,
      helper: 'Pending, available, held, reversed, or cancelled rewards.',
    },
    {
      label: 'Available rewards',
      value: formatMoney(props.row.totals.availableRewardAmount, 'VND', '0 VND'),
      helper: 'Reward candidates ready for credit, not necessarily wallet-ledgered.',
    },
    {
      label: 'Pending / held',
      value: `${formatMoney(props.row.totals.pendingRewardAmount, 'VND', '0 VND')} / ${formatMoney(
        props.row.totals.heldRewardAmount,
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
              <Link className="text-link" href={referralShareUrl(props.audience, props.row.referralCode.code)}>
                Open referral link
              </Link>
            ) : (
              <strong>Not ready</strong>
            )}
            <small className="muted">Public link routes to the correct app store.</small>
          </div>
          <div>
            <span>Total rewards</span>
            <strong>{formatMoney(props.row.totals.totalRewardAmount, 'VND', '0 VND')}</strong>
            <small className="muted">{props.row.totals.rewardCount} reward record(s)</small>
          </div>
        </div>
      </AdminFilterPanel>

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
                    <strong>{referral.rewards.length}</strong>
                    <p className="muted">reward record(s)</p>
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
            headers={['Referred', 'Reward', 'Status', 'Booking', 'Credit State', 'Created']}
            rowCount={rewardRows.length}
          >
            {rewardRows.map(({ attributionId, referredLabel, reward }) => (
              <tr key={`${attributionId}:${reward.id}`}>
                <td>
                  <strong>{referredLabel}</strong>
                  <p className="muted">{attributionId}</p>
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
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </AdminFilterPanel>
    </AdminPageTemplate>
  );
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
        referredLabel,
        reward,
      }));
    });
  }

  return props.row.referrals.flatMap((referral) => {
    const referredLabel =
      referral.referredPartner?.displayName ?? userLabel(referral.referredPartner?.user, 'Unknown Partner');

    return referral.rewards.map((reward) => ({
      attributionId: referral.id,
      referredLabel,
      reward,
    }));
  });
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
