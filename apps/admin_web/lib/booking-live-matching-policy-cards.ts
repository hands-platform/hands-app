import {
  formatPolicyDistance,
  humanizePolicyValue,
  type AdminLiveOperationsPolicy,
} from './operations-policy';

export type BookingLiveMatchingPolicyCard = {
  readonly helper: string;
  readonly label: string;
  readonly value: string;
};

export function buildBookingLiveMatchingPolicyCards(
  policy: AdminLiveOperationsPolicy,
): readonly BookingLiveMatchingPolicyCard[] {
  return [
    {
      label: 'First-pick window',
      value: `${policy.providerResponseWindowMinutes}m`,
      helper: 'First-pick partner response timer before operators watch marketplace alternatives.',
    },
    {
      label: 'Travel buffer',
      value: `${policy.travelBufferMinutes}m`,
      helper: 'Partner availability uses this buffer after a completed service before normal matching.',
    },
    {
      label: 'Marketplace radius',
      value: formatPolicyDistance(policy.marketplaceRadiusMeters),
      helper: 'Partners inside the booking-address radius can participate when other gates pass.',
    },
    {
      label: 'Location freshness',
      value: `${policy.marketplaceLocationFreshnessMinutes}m`,
      helper: 'Partner last location must be fresh enough for marketplace participation.',
    },
    {
      label: 'Invitation cap',
      value: `${policy.marketplaceInvitationLimit}`,
      helper: 'Maximum nearby partners exposed to a marketplace request.',
    },
    {
      label: 'Wallet gate',
      value: humanizePolicyValue(policy.walletNegativeGate),
      helper:
        'Negative Partner wallet blocks final acceptance, service start, and payout release; customers never carry this debt.',
    },
  ];
}
