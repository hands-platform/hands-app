import { formatDateTime, formatMoney } from './admin-format';

export type BookingRefundLedgerRow = {
  id: string;
  amount: number;
  status: string;
  createdAt?: string | null;
  reason?: string | null;
  payment?: { currency?: string | null } | null;
};

type PaymentRefundRow = Omit<BookingRefundLedgerRow, 'payment'> & {
  payment?: BookingRefundLedgerRow['payment'];
};

export type BookingRefundLedgerInput = {
  refunds?: BookingRefundLedgerRow[] | null;
  payment?: {
    status?: string | null;
    currency?: string | null;
    refunds?: PaymentRefundRow[] | null;
  } | null;
};

export function bookingRefundRows(booking: BookingRefundLedgerInput): BookingRefundLedgerRow[] {
  if (booking.refunds?.length) {
    return booking.refunds;
  }

  return (booking.payment?.refunds ?? []).map((refund) => ({
    ...refund,
    payment: { currency: booking.payment?.currency ?? 'VND' },
  }));
}

export function bookingRefundLedgerEvidence(booking: BookingRefundLedgerInput) {
  const rows = bookingRefundRows(booking);
  if (!rows.length) {
    return booking.payment?.status === 'REFUNDED'
      ? 'Payment is marked refunded but no refund row is loaded.'
      : 'No refund action recorded.';
  }

  const latest = [...rows].sort((left, right) => safeTime(right.createdAt) - safeTime(left.createdAt))[0];
  const currency = latest.payment?.currency ?? booking.payment?.currency ?? 'VND';
  const reason = latest.reason ? ` / ${latest.reason}` : '';
  return `${latest.status} / ${formatMoney(latest.amount, currency)} / ${formatDateTime(
    latest.createdAt,
    'Not set',
  )}${reason}`;
}

function safeTime(value?: string | null) {
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
