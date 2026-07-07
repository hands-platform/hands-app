import type { AdminBookingDetail } from '../../../lib/admin-api';
import { readAddressText, serviceAddressAreaLabel } from '../booking-address-readers';
import {
  bookingDetailProviderLocationMetricHelper,
  bookingDetailProviderLocationMetricValue,
} from './booking-provider-location-metric';

export type BookingDetailOperationsQuickRailInput = {
  booking: AdminBookingDetail;
  operatorPriorityStatus: string;
  matchingRuleStatus: string;
  evidenceLaneCount: number;
  connectedRecordCount: number;
  participantCounts: {
    marketplace: number;
    total: number;
  };
  messageCount: number;
  paymentEvidence: {
    paymentStatus: string;
    readablePaymentMethodAmountLabel: string;
  };
  financeTrace: {
    platformFee: string;
    withholding: string;
    netHandsFee: string;
  };
  addressLine: string;
  addressPin: string;
  operatorQueue: {
    status: string;
    commands: readonly unknown[];
  };
  activityRecordCount: number;
};

export function bookingDetailOperationsQuickRail({
  booking,
  operatorPriorityStatus,
  matchingRuleStatus,
  evidenceLaneCount,
  connectedRecordCount,
  participantCounts,
  messageCount,
  paymentEvidence,
  financeTrace,
  addressLine,
  addressPin,
  operatorQueue,
  activityRecordCount,
}: BookingDetailOperationsQuickRailInput) {
  return [
    {
      href: '#booking-priority-briefing',
      label: 'Priority',
      value: operatorPriorityStatus,
      detail: 'First-screen booking state for handoff, chat, location, payment, and closeout.',
    },
    {
      href: '#matching-rule-snapshot',
      label: 'Matching rules',
      value: matchingRuleStatus,
      detail: 'First-pick, booking-address marketplace radius, customer choice, and wallet gate.',
    },
    {
      href: '#booking-full-evidence-bundle',
      label: 'Evidence bundle',
      value: `${evidenceLaneCount} lanes`,
      detail: 'Customer, Partner, address, chat, payment, finance, location, alerts, and notes.',
    },
    {
      href: '#connected-operations-records',
      label: 'Linked records',
      value: `${connectedRecordCount} links`,
      detail: 'Open customer, Partner, chat archive, notifications, payment, refund, and settlement.',
    },
    {
      href: '#participants',
      label: 'Marketplace',
      value: `${participantCounts.marketplace} marketplace row(s)`,
      detail: `${participantCounts.total} total participant row(s). First-pick and marketplace rows are separated for operator review.`,
    },
    {
      href: '#chat',
      label: 'Chat',
      value: booking.chatRoom ? `${messageCount} messages` : 'Missing room',
      detail: 'Matched-booking transcript retained for admin even after mobile hides completed chats.',
    },
    {
      href: '#payment',
      label: 'Payment',
      value: paymentEvidence.paymentStatus,
      detail: paymentEvidence.readablePaymentMethodAmountLabel,
    },
    {
      href: '#finance',
      label: 'Fees and tax',
      value: financeTrace.platformFee,
      detail: `${financeTrace.withholding} withholding / ${financeTrace.netHandsFee} net HANDS fee.`,
    },
    {
      href: '#address-radius-contract',
      label: 'Address',
      value: quickRailAddressStateLabel(addressPin),
      detail: addressLine,
    },
    {
      href: '#location',
      label: 'Location',
      value: bookingDetailProviderLocationMetricValue(booking),
      detail: bookingDetailProviderLocationMetricHelper(booking),
    },
    {
      href: '#operator-command-queue',
      label: 'Operator queue',
      value: operatorQueue.status,
      detail: `${operatorQueue.commands.length} same-shift command(s).`,
    },
    {
      href: '#booking-activity',
      label: 'Activity',
      value: `${activityRecordCount}`,
      detail: 'Date-ordered booking, chat, payment, alert, location, and audit events.',
    },
  ];
}

function quickRailAddressStateLabel(addressPin: string) {
  const address = readAddressText(addressPin);
  if (address) {
    return serviceAddressAreaLabel(address);
  }

  return addressPin === 'No pin' ? 'No service address location' : 'Service address record saved';
}
