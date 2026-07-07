import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingCashDebtNeedsSettlement } from './booking-cash-wallet-gate';
import type { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { providerName } from './booking-formatters';
import type { ConnectedRecordLink } from './booking-closeout-sections';

export type BookingDetailConnectedRecordLinksInput = {
  booking: AdminBookingDetail;
  finalPartnerSummary: ReturnType<typeof bookingFinalPartnerSummary>;
  messageCount: number;
  notificationCount: number;
  paymentEvidence: {
    paymentQueueValue: string;
    paymentMethodAmountLabel: string;
    paymentQueueHref: string;
    paymentTone: string;
    refundCountLabel: string;
    refundEvidence: string;
    refundHref: string;
    refundTone: string;
  };
  financeTrace: {
    walletLedger: string;
  };
};

export function bookingDetailConnectedRecordLinks({
  booking,
  finalPartnerSummary,
  messageCount,
  notificationCount,
  paymentEvidence,
  financeTrace,
}: BookingDetailConnectedRecordLinksInput): ConnectedRecordLink[] {
  const cashDebtNeedsSettlement = bookingCashDebtNeedsSettlement(booking);
  const refundQueueDetail =
    paymentEvidence.refundCountLabel === '0 refund row(s)' ? 'Queue empty.' : paymentEvidence.refundEvidence;

  return [
    {
      label: 'Customer record',
      value: booking.customerProfile?.id ? 'Linked' : 'Profile missing',
      detail: booking.customerProfile?.user?.phone ?? 'Open the in-page customer evidence block.',
      href: booking.customerProfile?.id ? `/customers/${booking.customerProfile.id}` : '#customer',
      tone: booking.customerProfile?.id ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Preferred Partner',
      value: booking.preferredProvider?.id ? providerName(booking.preferredProvider) : 'Not selected',
      detail: 'First-pick Partner record and booking gate state.',
      href: booking.preferredProvider?.id ? `/partners/${booking.preferredProvider.id}` : '#handoff',
      tone: booking.preferredProvider?.id ? 'pill-info' : 'pill-neutral',
    },
    {
      label: 'Final Partner',
      value: finalPartnerSummary.selected ? finalPartnerSummary.label : 'Customer choice pending',
      detail: 'Final selected Partner, location, payout, and service records.',
      href: finalPartnerSummary.href,
      tone: finalPartnerSummary.selected ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Chat record',
      value: booking.chatRoom ? `${messageCount} message(s)` : 'No room',
      detail: 'Retained chat record for completion, cancellation, and no-show context.',
      href: booking.chatRoom ? `/chat-archive?q=${encodeURIComponent(booking.id)}` : '#chat',
      tone: booking.chatRoom ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Notifications',
      value: `${notificationCount} alert(s)`,
      detail: 'Partner alerts, customer updates, and delivery status.',
      href: `/notifications?booking=${encodeURIComponent(booking.id)}`,
      tone: notificationCount ? 'pill-info' : 'pill-neutral',
    },
    {
      label: 'Payment queue',
      value: paymentEvidence.paymentQueueValue,
      detail: paymentEvidence.paymentMethodAmountLabel,
      href: paymentEvidence.paymentQueueHref,
      tone: paymentEvidence.paymentTone,
    },
    {
      label: 'Refund queue',
      value: paymentEvidence.refundCountLabel,
      detail: refundQueueDetail,
      href: paymentEvidence.refundHref,
      tone: paymentEvidence.refundTone,
    },
    {
      label: 'Cash settlement',
      value: cashDebtNeedsSettlement ? 'Settlement needed' : 'Clear',
      detail: financeTrace.walletLedger,
      href: cashDebtNeedsSettlement ? '/cash-settlements' : '#finance',
      tone: cashDebtNeedsSettlement ? 'pill-danger' : 'pill-success',
    },
  ];
}
