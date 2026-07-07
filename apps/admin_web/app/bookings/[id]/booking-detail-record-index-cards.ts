import type { AdminBookingDetail } from '../../../lib/admin-api';
import type { BookingRecordIndexCard } from './booking-activity-panel';
import { bookingCashDebtNeedsSettlement } from './booking-cash-wallet-gate';
import { shortId } from './booking-formatters';

export type BookingDetailRecordIndexCardsInput = {
  booking: AdminBookingDetail;
  participantCounts: {
    firstPick: number;
    marketplace: number;
    total: number;
  };
  messageCount: number;
  paymentEvidence: {
    paymentAmountLabel: string;
    paymentStatus: string;
  };
  financeTrace: {
    platformFee: string;
    providerPayout: string;
    payoutRuleStatus: string;
    serviceOption: string;
    walletLedger: string;
    withholding: string;
  };
  providerLocationMetric: {
    helper: string;
    value: string;
  };
  communicationMovementStatus: string;
  locationTrailCount: number;
  notificationCount: number;
  marketplaceAlertBatchCount: number;
  operatorNoteCount: number;
  activityRecordCount: number;
};

export function bookingDetailRecordIndexCards({
  booking,
  participantCounts,
  messageCount,
  paymentEvidence,
  financeTrace,
  providerLocationMetric,
  communicationMovementStatus,
  locationTrailCount,
  notificationCount,
  marketplaceAlertBatchCount,
  operatorNoteCount,
  activityRecordCount,
}: BookingDetailRecordIndexCardsInput): BookingRecordIndexCard[] {
  return [
    {
      href: '#customer',
      label: 'Customer',
      value: booking.customerProfile?.user?.phone ?? 'No phone',
      helper: booking.customerProfile?.user?.fullName ?? 'Customer profile',
    },
    {
      href: '#participants',
      label: 'Partners',
      value: `${participantCounts.total}`,
      helper: `${participantCounts.marketplace} marketplace / ${participantCounts.firstPick} first-pick row(s).`,
    },
    {
      href: '#chat',
      label: 'Chat archive',
      value: `${messageCount}`,
      helper: booking.chatRoom ? `Room ${shortId(booking.chatRoom.id)}` : 'No chat room yet',
    },
    {
      href: '#payment',
      label: 'Payment and wallet',
      value: paymentEvidence.paymentStatus,
      helper: paymentEvidence.paymentAmountLabel,
    },
    {
      href: '#finance',
      label: 'Finance evidence',
      value: financeTrace.providerPayout,
      helper: `${financeTrace.platformFee} HANDS fee`,
    },
    {
      href: booking.earning?.id ? `/earnings#earning-${booking.earning.id}` : '/earnings',
      label: 'Earnings ledger',
      value: booking.earning?.status ?? 'No earning row yet',
      helper: booking.earning?.id ? shortId(booking.earning.id) : 'Open finance ledger',
    },
    {
      href: '/cash-settlements',
      label: 'Cash settlement desk',
      value: bookingCashDebtNeedsSettlement(booking) ? 'Settlement needed' : 'Clear or non-cash',
      helper: booking.payment?.method === 'CASH' ? financeTrace.walletLedger : 'No cash wallet debt',
    },
    {
      href: '/tax-policy',
      label: 'Tax policy',
      value: financeTrace.withholding,
      helper: 'Versioned rules, no hardcoded rates.',
    },
    {
      href: '#service-pricing-snapshot',
      label: 'Service and pricing',
      value: financeTrace.payoutRuleStatus,
      helper: financeTrace.serviceOption,
    },
    {
      href: '#location',
      label: 'Location trail',
      value: providerLocationMetric.value,
      helper: providerLocationMetric.helper,
    },
    {
      href: '#communication-movement-handoff',
      label: 'Communication and movement',
      value: communicationMovementStatus,
      helper: `${messageCount} message(s), ${locationTrailCount} location row(s).`,
    },
    {
      href: '#alerts',
      label: 'Alerts',
      value: `${notificationCount}`,
      helper: `${marketplaceAlertBatchCount} marketplace alert batch(es).`,
    },
    {
      href: '#operator-notes',
      label: 'Operator notes',
      value: `${operatorNoteCount}`,
      helper: 'Internal handling notes retained on this booking.',
    },
    {
      href: '#booking-activity',
      label: 'Activity timeline',
      value: `${activityRecordCount}`,
      helper: 'Date-ordered operational history.',
    },
  ];
}
