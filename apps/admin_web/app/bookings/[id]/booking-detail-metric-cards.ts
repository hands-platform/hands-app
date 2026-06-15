import type { AdminBookingDetail } from '../../../lib/admin-api';
import type { AttentionLevel } from '../../../lib/admin-attention-flags';
import { bookingPartnerHint } from '../../../lib/booking-partner-decision-copy';
import { bookingPaymentHint } from '../../../lib/booking-payment-hint';
import { bookingCashDebtNeedsSettlement } from './booking-cash-wallet-gate';
import {
  bookingDetailProviderLocationMetricHelper,
  bookingDetailProviderLocationMetricValue,
} from './booking-provider-location-metric';
import { bookingStatusHint } from './booking-status-location';

export type BookingDetailMetricCardsInput = {
  booking: AdminBookingDetail;
  closureSummary: {
    status: string;
    detail: string;
  };
  messageCount: number;
  attentionSummary: AttentionLevel;
};

export function bookingDetailMetricCards({
  booking,
  closureSummary,
  messageCount,
  attentionSummary,
}: BookingDetailMetricCardsInput) {
  return [
    { label: 'Status', value: booking.status, helper: bookingStatusHint(booking.status) },
    { label: 'Closure', value: closureSummary.status, helper: closureSummary.detail },
    {
      label: 'Payment',
      value: booking.payment?.status ?? 'NONE',
      helper: bookingPaymentHint(booking, {
        cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
      }),
    },
    {
      label: 'Partners',
      value: `${booking.participants?.length ?? 0} participant row(s)`,
      helper: bookingPartnerHint(booking),
    },
    {
      label: 'Chat',
      value: booking.chatRoom ? 'Ready' : 'Not ready',
      helper: `${messageCount} message(s)`,
    },
    {
      label: 'Location',
      value: bookingDetailProviderLocationMetricValue(booking),
      helper: bookingDetailProviderLocationMetricHelper(booking),
    },
    {
      label: 'Attention checks',
      value: attentionSummary.label,
      helper: attentionSummary.helper,
    },
  ];
}
