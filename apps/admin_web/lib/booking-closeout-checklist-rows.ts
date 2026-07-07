export type BookingChecklistClassName = 'ops-task-done' | 'ops-task-warning' | 'ops-task-blocked';
export type BookingChecklistPillClass =
  | 'pill-success'
  | 'pill-warn'
  | 'pill-danger'
  | 'pill-info'
  | 'pill-neutral';

export type BookingCloseoutChecklistItem = {
  title: string;
  status: string;
  detail: string;
  detailDateTimeFallback?: string | null;
  detailDateTimePrefix?: string;
  detailDateTimeSuffix?: string;
  detailDateTimeValue?: string | null;
  operatorRule: string;
  href: string;
  className: BookingChecklistClassName;
  pillClass: BookingChecklistPillClass;
};

export type BookingCloseoutChecklistRowsInput = {
  bookingId: string;
  bookingStatus: string;
  addressReady: boolean;
  addressLabel: string;
  finalPartnerId?: string | null;
  finalPartnerLabel?: string | null;
  customerChoiceCandidates: number;
  chatNeeded: boolean;
  chatReady: boolean;
  chatRoomShortId?: string | null;
  chatMessageCount: number;
  latestMessageAtLabel?: string | null;
  latestMessageAtValue?: string | null;
  cashDebt: boolean;
  paymentStatus?: string | null;
  paymentMethod: string;
  customerPriceLabel: string;
  partnerPayoutLabel: string;
  walletLedgerLabel: string;
  terminal: boolean;
  refundLedgerCount: number;
  refundEvidence: string;
  alertCount: number;
  failedAlertCount: number;
  closeoutStatus: string;
  closeoutTone: string;
  closeoutHelper: string;
  closeoutOpenItemLabels: string[];
  taxRows: number;
  operatorTrailCount: number;
  latestLocationLabel?: string | null;
  latestLocationAtLabel?: string | null;
  latestLocationAtValue?: string | null;
  notificationCount: number;
};

export function bookingCloseoutChecklistRows(
  input: BookingCloseoutChecklistRowsInput,
): BookingCloseoutChecklistItem[] {
  const closeoutPillClass = toChecklistPillClass(input.closeoutTone);

  return [
    {
      title: 'Confirmed service address',
      status: input.addressReady ? 'Ready' : 'Repair needed',
      detail: input.addressReady
        ? `${input.addressLabel} is locked for Partner distance and evidence review.`
        : 'A confirmed service address is required before distance matching and closeout review are reliable.',
      operatorRule:
        'Use the booking address, not the customer current location, for 10km Partner participation.',
      href: '#address-radius-contract',
      className: input.addressReady ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: input.addressReady ? 'pill-success' : 'pill-danger',
    },
    {
      title: 'Customer final Partner choice',
      status: input.finalPartnerId
        ? 'Selected'
        : input.customerChoiceCandidates
          ? 'Choice pending'
          : 'Waiting',
      detail: input.finalPartnerId
        ? `${input.finalPartnerLabel ?? 'Selected Partner'} is linked as the selected Partner for this booking.`
        : `${input.customerChoiceCandidates} participating/accepted Partner(s) are available for the customer decision step.`,
      operatorRule: 'No automatic Partner assignment; customer selection is the final matching authority.',
      href: input.finalPartnerId ? `/partners/${input.finalPartnerId}` : '#participants',
      className: input.finalPartnerId
        ? 'ops-task-done'
        : input.customerChoiceCandidates
          ? 'ops-task-warning'
          : 'ops-task-blocked',
      pillClass: input.finalPartnerId
        ? 'pill-success'
        : input.customerChoiceCandidates
          ? 'pill-warn'
          : 'pill-info',
    },
    {
      title: 'Chat record',
      status: input.chatReady ? 'Archived' : input.chatNeeded ? 'Repair needed' : 'Locked',
      detail: input.chatReady
        ? `Room ${input.chatRoomShortId ?? 'missing'} keeps ${input.chatMessageCount} message(s); latest`
        : input.chatNeeded
          ? 'Matched or active booking has no retained chat room attached.'
          : 'Chat opens after the customer selects the final Partner.',
      detailDateTimeFallback: input.chatReady ? input.latestMessageAtLabel ?? 'not sent yet' : null,
      detailDateTimeSuffix: input.chatReady ? '.' : undefined,
      detailDateTimeValue: input.chatReady ? input.latestMessageAtValue ?? null : null,
      operatorRule: 'Mobile chat may hide after completion, but admin must retain the transcript.',
      href: input.chatReady
        ? `/chat-archive?q=${encodeURIComponent(input.bookingId)}`
        : input.chatNeeded
          ? '/chat-archive?status=missing-room'
          : '#chat',
      className: input.chatReady
        ? 'ops-task-done'
        : input.chatNeeded
          ? 'ops-task-blocked'
          : 'ops-task-warning',
      pillClass: input.chatReady ? 'pill-success' : input.chatNeeded ? 'pill-danger' : 'pill-info',
    },
    {
      title: 'Money and wallet gate',
      status: input.cashDebt ? 'Settlement needed' : input.paymentStatus ?? 'No payment',
      detail: input.cashDebt
        ? `${input.walletLedgerLabel}. Partner can view marketplace requests, but final acceptance and service start are held until settled or offset.`
        : `${input.paymentMethod} payment / customer ${input.customerPriceLabel} / Partner ${input.partnerPayoutLabel}.`,
      operatorRule:
        'Cash fee debt must be resolved before final acceptance, service start, or payout batch release.',
      href: input.cashDebt ? '/cash-settlements' : '#finance',
      className: input.cashDebt ? 'ops-task-blocked' : input.paymentStatus ? 'ops-task-done' : 'ops-task-warning',
      pillClass: input.cashDebt ? 'pill-danger' : input.paymentStatus ? 'pill-success' : 'pill-warn',
    },
    {
      title: 'Manual outcome evidence',
      status: input.terminal
        ? 'Terminal review'
        : input.refundLedgerCount
          ? 'Refund evidence'
          : 'Open',
      detail: input.refundLedgerCount
        ? `${input.refundLedgerCount} refund row(s). ${input.refundEvidence}`
        : input.terminal
          ? `${input.bookingStatus} booking needs retained chat, location, payment, and operator trail before closeout.`
          : `Open booking with ${input.chatMessageCount} chat message(s), ${input.alertCount} alert(s), and ${input.failedAlertCount} failed alert(s).`,
      operatorRule: 'Cancellation, no-show, refund, and release decisions are admin evidence decisions.',
      href: input.refundLedgerCount ? '/refunds?review=open' : '#manual-decision-readiness',
      className: input.refundLedgerCount || input.terminal ? 'ops-task-warning' : 'ops-task-done',
      pillClass: input.refundLedgerCount || input.terminal ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Finance closeout',
      status: input.closeoutStatus,
      detail: input.closeoutOpenItemLabels.length
        ? `Open items: ${input.closeoutOpenItemLabels.join(', ')}. Tax rows ${input.taxRows}.`
        : `${input.closeoutHelper} Tax rows ${input.taxRows}; operator trail ${input.operatorTrailCount}.`,
      operatorRule: 'Use this before weekly, monthly, or admin-selected settlement batch processing.',
      href: '#booking-closeout-readiness',
      className:
        closeoutPillClass === 'pill-danger'
          ? 'ops-task-blocked'
          : closeoutPillClass === 'pill-warn'
            ? 'ops-task-warning'
            : 'ops-task-done',
      pillClass: closeoutPillClass,
    },
    {
      title: 'Location and alert trail',
      status: input.latestLocationLabel ? 'Movement saved' : input.notificationCount ? 'Alerts saved' : 'Sparse',
      detail: input.latestLocationLabel
        ? input.latestLocationLabel
        : `${input.notificationCount} alert row(s), ${input.failedAlertCount} failed delivery row(s).`,
      detailDateTimeFallback: input.latestLocationLabel ? input.latestLocationAtLabel ?? 'No timestamp' : null,
      detailDateTimePrefix: input.latestLocationLabel ? ' / ' : undefined,
      detailDateTimeSuffix: input.latestLocationLabel ? '.' : undefined,
      detailDateTimeValue: input.latestLocationLabel ? input.latestLocationAtValue ?? null : null,
      operatorRule: 'Use saved pins and alert delivery only as factual operations history.',
      href: input.latestLocationLabel
        ? '#location'
        : `/notifications?booking=${encodeURIComponent(input.bookingId)}`,
      className: input.latestLocationLabel || input.notificationCount ? 'ops-task-done' : 'ops-task-warning',
      pillClass: input.latestLocationLabel || input.notificationCount ? 'pill-info' : 'pill-neutral',
    },
  ];
}

export function toChecklistPillClass(value: string): BookingChecklistPillClass {
  if (
    value === 'pill-success' ||
    value === 'pill-warn' ||
    value === 'pill-danger' ||
    value === 'pill-info' ||
    value === 'pill-neutral'
  ) {
    return value;
  }

  return 'pill-neutral';
}
