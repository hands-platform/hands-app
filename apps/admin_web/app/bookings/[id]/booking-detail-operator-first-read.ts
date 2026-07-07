import type { AdminBookingDetail } from '../../../lib/admin-api';
import { readAddressText, serviceAddressAreaLabel } from '../booking-address-readers';
import { bookingCashDebtNeedsSettlement } from './booking-cash-wallet-gate';
import type { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { shortId } from './booking-formatters';

export type BookingDetailOperatorFirstReadInput = {
  booking: AdminBookingDetail;
  addressLine: string;
  addressPin: string;
  matchingRuleStatus: string;
  customerWaitSignalStatus: string;
  eligibleMarketplaceCount: number;
  finalPartnerSummary: ReturnType<typeof bookingFinalPartnerSummary>;
  participantCounts: {
    marketplace: number;
    total: number;
  };
  messageCount: number;
  paymentEvidence: {
    paymentQueueValue: string;
    paymentMethodAmountLabel: string;
  };
  financeTrace: {
    walletLedger: string;
    platformFee: string;
  };
};

export function bookingDetailOperatorFirstRead({
  booking,
  addressLine,
  addressPin,
  matchingRuleStatus,
  customerWaitSignalStatus,
  eligibleMarketplaceCount,
  finalPartnerSummary,
  participantCounts,
  messageCount,
  paymentEvidence,
  financeTrace,
}: BookingDetailOperatorFirstReadInput) {
  return [
    {
      href: '#address-radius-contract',
      label: 'Service address',
      value: firstReadServiceAddressStateLabel(addressPin),
      detail: addressLine,
    },
    {
      href: '#matching-rule-snapshot',
      label: 'Matching state',
      value: matchingRuleStatus,
      detail: `${customerWaitSignalStatus} / ${eligibleMarketplaceCount} marketplace Partner(s) in policy.`,
    },
    {
      href: finalPartnerSummary.href,
      label: 'Customer choice',
      value: finalPartnerSummary.selected ? finalPartnerSummary.label : 'Pending',
      detail: finalPartnerSummary.selected
        ? 'Final Partner exists; confirm chat handoff before service coordination.'
        : 'Customer must choose the final Partner before matched chat opens.',
    },
    {
      href: '#participants',
      label: 'Marketplace participants',
      value: `${participantCounts.marketplace} marketplace row(s)`,
      detail: `${participantCounts.total} total participant row(s). Only actual Partner participation rows are retained for this booking.`,
    },
    {
      href: '#chat',
      label: 'Chat evidence',
      value: booking.chatRoom ? `${messageCount} messages` : 'Missing room',
      detail: booking.chatRoom
        ? `Room ${shortId(booking.chatRoom.id)} is retained for admin review.`
        : 'Matched bookings should create a retained chat room.',
    },
    {
      href: bookingCashDebtNeedsSettlement(booking) ? '/cash-settlements' : '#payment',
      label: 'Money path',
      value: paymentEvidence.paymentQueueValue,
      detail:
        booking.payment?.method === 'CASH'
          ? `${financeTrace.walletLedger} / ${financeTrace.platformFee} HANDS fee.`
          : `${paymentEvidence.paymentMethodAmountLabel}.`,
    },
  ];
}

function firstReadServiceAddressStateLabel(addressPin: string) {
  const address = readAddressText(addressPin);
  if (address) {
    return serviceAddressAreaLabel(address);
  }

  return addressPin === 'No pin' ? 'No service address location' : 'Service address record saved';
}
