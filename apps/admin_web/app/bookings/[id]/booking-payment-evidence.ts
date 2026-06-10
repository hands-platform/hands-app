import type { BookingRefundLedgerRow } from '../../../lib/booking-refund-ledger';
import {
  bookingRefundLedgerEvidence,
  bookingRefundRows,
} from '../../../lib/booking-refund-ledger';
import { money } from './booking-formatters';

export type BookingPaymentEvidenceInput = {
  readonly payment?: {
    readonly id?: string | null;
    readonly status?: string | null;
    readonly method?: string | null;
    readonly amount?: number | null;
    readonly currency?: string | null;
    readonly refunds?: BookingRefundLedgerRow[] | null;
  } | null;
  readonly refunds?: BookingRefundLedgerRow[] | null;
};

export function bookingPaymentEvidence(booking: BookingPaymentEvidenceInput) {
  const refundRows = bookingRefundRows(booking);
  const paymentStatus = booking.payment?.status ?? 'NONE';
  const paymentMethod = booking.payment?.method ?? 'NONE';
  const readablePaymentMethod = booking.payment?.method ?? 'No method';
  const paymentAmountLabel = money(booking.payment?.amount, booking.payment?.currency ?? undefined);

  return {
    paymentId: booking.payment?.id ?? null,
    paymentStatus,
    paymentMethod,
    paymentAmountLabel,
    paymentMethodAmountLabel: `${paymentMethod} / ${paymentAmountLabel}`,
    readablePaymentMethodAmountLabel: `${readablePaymentMethod} / ${paymentAmountLabel}`,
    paymentMethodStatusLabel: `${paymentMethod} / ${paymentStatus}`,
    paymentQueueValue: booking.payment?.status ?? 'No payment',
    paymentQueueHref: booking.payment?.status === 'AUTHORIZED' ? '/payments?review=authorized' : '/payments',
    paymentTone: booking.payment ? 'pill-info' : 'pill-neutral',
    refundRows,
    refundCount: refundRows.length,
    refundCountLabel: `${refundRows.length} refund row(s)`,
    refundRecordStatus: refundRows.length ? `${refundRows.length} refund record(s)` : 'No refund record',
    refundEvidence: bookingRefundLedgerEvidence(booking),
    refundHref: refundRows.length ? '/refunds?review=open' : '#payment',
    refundTone: refundRows.length ? 'pill-warn' : 'pill-neutral',
  };
}
