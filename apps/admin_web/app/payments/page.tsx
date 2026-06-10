import { AdminPayment, AdminPaymentCallbackAttempt, adminGet } from '../../lib/admin-api';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { formatDateTime, formatMoney as money, shortId } from '../../lib/admin-format';
import {
  AdminDateRange,
  dateRangeLabel,
  isInDateRange,
  normalizeDateRange,
  readSearchParam,
} from '../../lib/date-range';
import { capturePayment, refundPayment, releasePayment, settleCashDebt, syncPayment } from './actions';
import {
  type PaymentConfirmationAction,
  buildPaymentActionConfirmation,
  paymentActionConfirmHref,
  readPaymentConfirmationAction,
} from './payment-action-confirmation';
import {
  PaymentFilterBoardSection,
  type PaymentFilterLink,
  type PaymentRangeLink,
} from './payment-filter-board-section';
import {
  PaymentCallbackAttemptLedgerSection,
  type PaymentCallbackAttemptLedgerRow,
} from './payment-callback-attempt-ledger-section';
import {
  PaymentOperationsTableSection,
  type PaymentOperationsTableRow,
} from './payment-operations-table-section';

type PaymentsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PaymentsPage({ searchParams }: { searchParams?: PaymentsPageSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const filters = buildPaymentFilters(params);
  const allPayments = sortPayments(await adminGet<AdminPayment[]>('/admin/payments', []));
  const callbackAttempts = sortPaymentCallbackAttempts(
    await adminGet<AdminPaymentCallbackAttempt[]>('/admin/payment-callback-attempts', []),
  );
  const payments = filterPayments(allPayments, filters);
  const visibleCallbackAttempts = filterPaymentCallbackAttempts(callbackAttempts, filters);
  const callbackAttemptRows = buildPaymentCallbackAttemptLedgerRows(visibleCallbackAttempts);
  const paymentRows = buildPaymentOperationsTableRows(payments);
  const activeFilter = paymentFilterLinks().find((item) => item.review === filters.review);
  const confirmation = buildPaymentActionConfirmation(
    allPayments,
    readPaymentConfirmationAction(readSearchParam(params.confirm)),
    readSearchParam(params.paymentId),
  );

  return (
    <AdminPageTemplate
      description="Payment operations for holds, captures, cash collection, refunds, and gateway callback evidence."
      metrics={[
        {
          label: 'Authorized',
          value: payments.filter((payment) => payment.status === 'AUTHORIZED').length,
          helper: 'Holds waiting for completion or release.',
        },
        {
          label: 'Pending cash',
          value: payments.filter((payment) => payment.method === 'CASH' && payment.status === 'PENDING').length,
          helper: 'Cash bookings waiting for collection confirmation.',
        },
        {
          label: 'Cash debt',
          value: payments.filter(paymentCashDebtNeedsSettlement).length,
          helper: 'Cash fee debt that still needs wallet settlement.',
        },
        {
          label: 'Captured',
          value: payments.filter((payment) => payment.status === 'CAPTURED').length,
          helper: 'Captured payment records in the current view.',
        },
        {
          label: 'Refunded',
          value: payments.filter((payment) => payment.status === 'REFUNDED').length,
          helper: 'Payments moved into the refund path.',
        },
        {
          label: 'Needs action',
          value: payments.filter((payment) => paymentOpsState(payment) !== 'settled').length,
          helper: 'Rows still needing operator attention.',
        },
        {
          label: 'Linked refunds',
          value: payments.reduce((total, payment) => total + (payment.refunds?.length ?? 0), 0),
          helper: 'Refund records attached to visible payments.',
        },
        {
          label: 'Callback review',
          value: visibleCallbackAttempts.filter(paymentCallbackAttemptNeedsReview).length,
          helper: 'Callbacks without verified gateway evidence.',
        },
        {
          label: 'Callback verified',
          value: visibleCallbackAttempts.filter(paymentCallbackAttemptVerified).length,
          helper: 'Accepted callbacks with gateway evidence.',
        },
      ]}
      title="Payments"
    >
      {confirmation ? (
        <ConfirmDialog
          action={paymentConfirmationAction(confirmation.action)}
          cancelHref={confirmation.cancelHref}
          confirmLabel={confirmation.confirmLabel}
          description={confirmation.description}
          disabled={confirmation.disabled}
          hiddenInputs={[{ name: 'paymentId', value: confirmation.paymentId }]}
          id={`payment-${confirmation.action}-${confirmation.paymentId}`}
          title={confirmation.title}
          tone={confirmation.tone}
        />
      ) : null}

      <PaymentFilterBoardSection
        activeFilterDescription={
          activeFilter?.review ? paymentFilterDescription(activeFilter.review) : null
        }
        activeFilterLabel={activeFilter?.review ? activeFilter.label : null}
        activeRange={filters.range}
        filteredCount={payments.length}
        rangeLabel={dateRangeLabel(filters.range)}
        rangeLinks={paymentRangeLinks(filters.review)}
        review={filters.review}
        reviewLinks={paymentFilterLinks().map((item) => ({
          ...item,
          href: withPaymentRange(item.href, filters.range),
        }))}
        totalCount={allPayments.length}
      />
      <PaymentCallbackAttemptLedgerSection rows={callbackAttemptRows} />
      <PaymentOperationsTableSection emptyMessage={emptyPaymentMessage(filters.review)} rows={paymentRows} />
    </AdminPageTemplate>
  );
}

function sortPayments(payments: AdminPayment[]) {
  return [...payments].sort((left, right) => {
    const leftPriority = paymentPriority(left);
    const rightPriority = paymentPriority(right);
    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }

    return (right.id || '').localeCompare(left.id || '');
  });
}

function sortPaymentCallbackAttempts(attempts: AdminPaymentCallbackAttempt[]) {
  return [...attempts].sort((left, right) => {
    const leftDate = Date.parse(left.createdAt || '');
    const rightDate = Date.parse(right.createdAt || '');
    return (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
  });
}

function buildPaymentCallbackAttemptLedgerRows(
  attempts: readonly AdminPaymentCallbackAttempt[],
): PaymentCallbackAttemptLedgerRow[] {
  return attempts.map((attempt) => ({
    amountLabel:
      attempt.callbackAmount !== null && attempt.callbackAmount !== undefined
        ? money(attempt.callbackAmount)
        : 'unknown',
    bookingHref: attempt.payment?.bookingId ? `/bookings/${attempt.payment.bookingId}` : null,
    createdAtLabel: formatDateTime(attempt.createdAt),
    errorMessage: attempt.errorMessage ?? null,
    gatewayTransactionId: attempt.gatewayTransactionId ?? 'No gateway transaction id',
    id: attempt.id,
    method: attempt.method,
    outcome: attempt.outcome,
    paymentIdLabel: attempt.paymentId ? shortId(attempt.paymentId) : null,
    paymentStatus: attempt.payment?.status ?? null,
    pillClass: paymentCallbackAttemptPill(attempt),
    providerRef: attempt.providerRef ?? 'NONE',
    providerStatus: attempt.providerStatus ?? 'No status code',
    signatureLabel: attempt.signatureVerified === true ? 'Verified' : 'Not verified',
    verificationMode: attempt.verificationMode ?? 'unknown',
  }));
}

function buildPaymentOperationsTableRows(payments: readonly AdminPayment[]): PaymentOperationsTableRow[] {
  return payments.map((payment) => {
    const firstRefundId = payment.refunds?.at(0)?.id ?? null;
    const cashDebtLabel = paymentCashDebtNeedsSettlement(payment)
      ? `Cash fee debt ${money(Math.abs(payment.booking?.earning?.netAmount ?? 0), payment.currency)}`
      : null;

    return {
      actionLabel: `Payment actions for ${shortId(payment.id)}`,
      actions: paymentActionMenuItems(payment),
      amountLabel: `${payment.amount} ${payment.currency}`,
      bookingHref: `/bookings/${payment.bookingId}`,
      bookingIdLabel: shortId(payment.bookingId),
      bookingStatus: payment.booking?.status ?? 'UNKNOWN',
      callbackEvidence: <PaymentCallbackEvidence payment={payment} />,
      cashDebtLabel,
      cashDebtSettlementForm:
        paymentCashDebtNeedsSettlement(payment) && payment.booking?.earning?.id ? (
          <CashDebtSettlementForm payment={payment} />
        ) : null,
      customerPhone: payment.booking?.customerProfile?.user?.phone ?? 'No customer phone',
      earningHref: payment.booking?.earning?.id ? `/earnings#earning-${payment.booking.earning.id}` : null,
      executionRows: paymentActionExecutionMap(payment),
      id: payment.id,
      method: payment.method,
      opsHint: paymentOpsHint(payment),
      opsSignal: paymentOpsSignal(payment),
      providerRef: payment.providerRef ?? 'NONE',
      recordDateLabel: paymentRecordDateLabel(payment),
      refundHref: firstRefundId ? `/refunds#refund-${firstRefundId}` : null,
      stateLabel: paymentStateLabel(payment),
      status: payment.status,
    };
  });
}

function buildPaymentFilters(params: Record<string, string | string[] | undefined>) {
  return {
    review: readSearchParam(params.review),
    range: normalizeDateRange(readSearchParam(params.range)),
  };
}

function filterPayments(payments: AdminPayment[], filters: ReturnType<typeof buildPaymentFilters>) {
  return payments.filter(
    (payment) =>
      isInDateRange(paymentRecordDate(payment), filters.range) &&
      (!filters.review || paymentMatchesReview(payment, filters.review)),
  );
}

function filterPaymentCallbackAttempts(
  attempts: AdminPaymentCallbackAttempt[],
  filters: ReturnType<typeof buildPaymentFilters>,
) {
  return attempts.filter(
    (attempt) =>
      isInDateRange(attempt.createdAt, filters.range) &&
      (!filters.review ||
        (filters.review === 'callback-review'
          ? paymentCallbackAttemptNeedsReview(attempt)
          : filters.review === 'callback-verified'
            ? paymentCallbackAttemptVerified(attempt)
            : true)),
  );
}

function paymentMatchesReview(payment: AdminPayment, review: string) {
  if (review === 'capture') {
    return payment.status === 'AUTHORIZED' && payment.booking?.status === 'COMPLETED';
  }
  if (review === 'missing-ref') {
    return payment.status === 'AUTHORIZED' && !payment.providerRef;
  }
  if (review === 'authorized') {
    return payment.status === 'AUTHORIZED';
  }
  if (review === 'cash') {
    return payment.method === 'CASH' && payment.status === 'PENDING';
  }
  if (review === 'cash-debt') {
    return paymentCashDebtNeedsSettlement(payment);
  }
  if (review === 'needs-action') {
    return paymentOpsState(payment) !== 'settled';
  }
  if (review === 'callback-review') {
    return (payment.callbackAttempts?.some(paymentCallbackAttemptNeedsReview) ?? false) || paymentCallbackNeedsReview(payment);
  }
  if (review === 'callback-verified') {
    return (payment.callbackAttempts?.some(paymentCallbackAttemptVerified) ?? false) || paymentCallbackVerified(payment);
  }
  if (review === 'refunded') {
    return payment.status === 'REFUNDED';
  }
  return true;
}

function paymentFilterLinks(): PaymentFilterLink[] {
  return [
    { label: 'All payments', href: '/payments', review: '' },
    { label: 'Capture review', href: '/payments?review=capture', review: 'capture' },
    { label: 'Missing refs', href: '/payments?review=missing-ref', review: 'missing-ref' },
    { label: 'Authorized holds', href: '/payments?review=authorized', review: 'authorized' },
    { label: 'Cash collection', href: '/payments?review=cash', review: 'cash' },
    { label: 'Cash fee debt', href: '/payments?review=cash-debt', review: 'cash-debt' },
    { label: 'Needs action', href: '/payments?review=needs-action', review: 'needs-action' },
    { label: 'Callback review', href: '/payments?review=callback-review', review: 'callback-review' },
    { label: 'Callback verified', href: '/payments?review=callback-verified', review: 'callback-verified' },
    { label: 'Refunded', href: '/payments?review=refunded', review: 'refunded' },
  ];
}

function paymentRangeLinks(review: string): PaymentRangeLink[] {
  return [
    { label: 'All dates', href: withPaymentReview('/payments', review), range: 'all' as const },
    { label: 'Today', href: withPaymentReview('/payments?range=today', review), range: 'today' as const },
    { label: 'Last 7 days', href: withPaymentReview('/payments?range=7d', review), range: '7d' as const },
    { label: 'Last 30 days', href: withPaymentReview('/payments?range=30d', review), range: '30d' as const },
  ];
}

function withPaymentRange(href: string, range: AdminDateRange) {
  if (range === 'all') {
    return href;
  }
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}range=${range}`;
}

function withPaymentReview(href: string, review: string) {
  if (!review) {
    return href;
  }
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}review=${review}`;
}

function paymentRecordDate(payment: AdminPayment) {
  return payment.booking?.createdAt ?? null;
}

function paymentRecordDateLabel(payment: AdminPayment) {
  const value = paymentRecordDate(payment);
  return value ? `Record date ${formatDateTime(value)}` : 'No payment record date';
}

function paymentFilterDescription(review: string) {
  if (review === 'capture') {
    return 'authorized payments tied to completed services, ready for capture review.';
  }
  if (review === 'missing-ref') {
    return 'authorized payments that do not yet have a gateway reference.';
  }
  if (review === 'authorized') {
    return 'active authorization holds that still need service or payment resolution.';
  }
  if (review === 'cash') {
    return 'cash bookings waiting for collection confirmation.';
  }
  if (review === 'cash-debt') {
    return 'completed cash bookings where the partner still owes HANDS fee or tax wallet debt.';
  }
  if (review === 'needs-action') {
    return 'payments that are not settled, released, or refunded yet.';
  }
  if (review === 'callback-review') {
    return 'MoMo or VNPay callbacks that were received without a verified gateway signature.';
  }
  if (review === 'callback-verified') {
    return 'MoMo or VNPay callbacks already accepted with gateway signature evidence.';
  }
  if (review === 'refunded') {
    return 'payments already moved into the refund path.';
  }
  return 'all payment records.';
}

function emptyPaymentMessage(review: string) {
  if (!review) {
    return 'No payments loaded.';
  }
  return `No payments currently match this queue. ${paymentFilterDescription(review)}`;
}

function paymentActionMenuItems(payment: AdminPayment) {
  const terminalPayment = paymentStatusIsTerminal(payment.status);
  return [
    {
      kind: 'link' as const,
      href: `/payments/${payment.id}`,
      label: 'Open detail',
      tone: 'info' as const,
    },
    {
      kind: 'link' as const,
      href: paymentActionConfirmHref(payment.id, 'sync'),
      label: 'Sync',
      disabled: !payment.providerRef,
      description: payment.providerRef ? 'Confirm gateway sync before running it.' : 'Gateway reference is missing.',
      tone: 'info' as const,
    },
    {
      kind: 'link' as const,
      href: paymentActionConfirmHref(payment.id, 'capture'),
      label: 'Capture',
      disabled: terminalPayment,
      description: terminalPayment ? 'Terminal payments cannot be captured again.' : 'Review before capturing funds.',
      tone: 'warning' as const,
    },
    {
      kind: 'link' as const,
      href: paymentActionConfirmHref(payment.id, 'release'),
      label: 'Release',
      disabled: terminalPayment,
      description: terminalPayment ? 'Terminal payments cannot be released again.' : 'Review before releasing the hold.',
      tone: 'warning' as const,
    },
    {
      kind: 'link' as const,
      href: paymentActionConfirmHref(payment.id, 'refund'),
      label: 'Refund',
      disabled: payment.status === 'REFUNDED' || payment.status === 'RELEASED',
      description:
        payment.status === 'REFUNDED' || payment.status === 'RELEASED'
          ? 'This payment cannot enter a new refund action.'
          : 'Review evidence before starting a refund.',
      tone: 'danger' as const,
    },
  ];
}

function paymentConfirmationAction(action: PaymentConfirmationAction) {
  switch (action) {
    case 'capture':
      return capturePayment;
    case 'refund':
      return refundPayment;
    case 'release':
      return releasePayment;
    case 'sync':
      return syncPayment;
  }
}

function paymentStatusIsTerminal(status: string) {
  return status === 'CAPTURED' || status === 'REFUNDED' || status === 'RELEASED';
}

function paymentPriority(payment: AdminPayment) {
  if (paymentCallbackNeedsReview(payment)) {
    return 7;
  }
  if (paymentCashDebtNeedsSettlement(payment)) {
    return 6;
  }
  if (payment.status === 'AUTHORIZED') {
    return 5;
  }
  if (payment.method === 'CASH' && payment.status === 'PENDING') {
    return 4;
  }
  if (payment.status === 'REFUNDED') {
    return 2;
  }
  if (payment.status === 'CAPTURED' || payment.status === 'RELEASED') {
    return 1;
  }
  return 3;
}

function paymentOpsState(payment: AdminPayment) {
  if (paymentCallbackNeedsReview(payment)) {
    return 'callback-review';
  }
  if (paymentCashDebtNeedsSettlement(payment)) {
    return 'cash-debt';
  }
  if (payment.status === 'CAPTURED' || payment.status === 'RELEASED' || payment.status === 'REFUNDED') {
    return 'settled';
  }
  if (payment.status === 'AUTHORIZED') {
    return 'capture';
  }
  if (payment.method === 'CASH' && payment.status === 'PENDING') {
    return 'collect-cash';
  }
  return 'monitor';
}

function paymentStateLabel(payment: AdminPayment) {
  if (paymentCashDebtNeedsSettlement(payment)) {
    return 'Cash collected, partner wallet debt is still unsettled.';
  }
  if (payment.status === 'AUTHORIZED') {
    return 'Hold placed, waiting for service completion.';
  }
  if (payment.method === 'CASH' && payment.status === 'PENDING') {
    return 'Collect cash when the service starts or completes.';
  }
  if (payment.status === 'CAPTURED') {
    return 'Funds captured successfully.';
  }
  if (payment.status === 'RELEASED') {
    return 'Hold released without capture.';
  }
  if (payment.status === 'REFUNDED') {
    return 'Refund path already started.';
  }
  return 'Monitor payment progression.';
}

function paymentOpsSignal(payment: AdminPayment) {
  if (paymentCallbackNeedsReview(payment)) {
    return <span className="signal signal-warn">Callback check</span>;
  }
  if (paymentCashDebtNeedsSettlement(payment)) {
    return <span className="signal signal-warn">Cash fee debt</span>;
  }
  if (payment.status === 'AUTHORIZED') {
    return <span className="signal signal-warn">Capture after service</span>;
  }
  if (payment.method === 'CASH' && payment.status === 'PENDING') {
    return <span className="signal signal-info">Cash collection</span>;
  }
  if (payment.status === 'REFUNDED') {
    return <span className="signal signal-warn">Refund in motion</span>;
  }
  if (payment.status === 'CAPTURED' || payment.status === 'RELEASED') {
    return <span className="signal signal-ok">Settled</span>;
  }
  return <span className="signal signal-info">Monitor payment</span>;
}

function paymentOpsHint(payment: AdminPayment) {
  if (paymentCallbackNeedsReview(payment)) {
    const meta = paymentCallbackMeta(payment);
    return `A ${payment.method} callback was received but signature evidence is not verified${
      meta.mode ? ` (${meta.mode})` : ''
    }. Compare gateway reference, amount, and callback status before manual money actions.`;
  }
  if (paymentCashDebtNeedsSettlement(payment)) {
    const debt = Math.abs(payment.booking?.earning?.netAmount ?? 0);
    return `Cash was collected by the partner. Settle ${money(
      debt,
      payment.currency,
    )} HANDS fee/tax debt from Earnings before final acceptance, service start, or payout release proceeds.`;
  }
  if (payment.status === 'AUTHORIZED') {
    return 'Keep this on hold until the partner completes the service, then capture or refund.';
  }
  if (payment.method === 'CASH' && payment.status === 'PENDING') {
    return 'Cash booking. Confirm partner arrival and mark the booking complete after payment is collected.';
  }
  if (payment.status === 'REFUNDED') {
    return 'Check the linked refund record and customer communication.';
  }
  if (payment.status === 'RELEASED') {
    return 'Booking did not convert. Confirm the customer sees the hold release.';
  }
  return 'No urgent action required.';
}

type PaymentActionExecutionRow = {
  action: string;
  status: string;
  reason: string;
  operatorRule: string;
  pillClass: string;
};

function paymentActionExecutionMap(payment: AdminPayment): PaymentActionExecutionRow[] {
  const bookingStatus = payment.booking?.status ?? 'UNKNOWN';
  const hasGatewayReference = Boolean(payment.providerRef);
  const terminalPayment = ['CAPTURED', 'REFUNDED', 'RELEASED'].includes(payment.status);
  const completedService = bookingStatus === 'COMPLETED';
  const closedWithoutCapture = ['CANCELLED', 'EXPIRED', 'NO_SHOW', 'REFUNDED'].includes(bookingStatus);
  const cashDebt = paymentCashDebtNeedsSettlement(payment);

  return [
    {
      action: 'Sync',
      status: hasGatewayReference ? 'Available' : 'No gateway ref',
      reason: hasGatewayReference
        ? `Gateway reference ${payment.providerRef} is saved on this payment.`
        : 'No gateway reference is saved yet.',
      operatorRule:
        'Use sync before manual money actions when a gateway reference exists. Sync should not decide service outcome.',
      pillClass: hasGatewayReference ? 'pill-success' : 'pill-neutral',
    },
    {
      action: 'Capture',
      status:
        payment.status === 'AUTHORIZED' && completedService
          ? 'Review capture'
          : terminalPayment
            ? 'Locked'
            : payment.status === 'AUTHORIZED'
              ? 'Wait for completion'
              : 'Not authorized',
      reason:
        payment.status === 'AUTHORIZED' && completedService
          ? 'The service is completed and the authorization hold is still active.'
          : terminalPayment
            ? `Payment is already ${payment.status}.`
            : payment.status === 'AUTHORIZED'
              ? `Booking is ${bookingStatus}; service completion evidence is not final yet.`
              : `Payment status is ${payment.status}.`,
      operatorRule: 'Capture only after completed service evidence and payment ledger review.',
      pillClass: payment.status === 'AUTHORIZED' && completedService ? 'pill-warn' : 'pill-neutral',
    },
    {
      action: 'Release',
      status:
        payment.status === 'AUTHORIZED' && closedWithoutCapture
          ? 'Review release'
          : terminalPayment
            ? 'Locked'
            : payment.status === 'AUTHORIZED'
              ? 'Hold active'
              : 'Not authorized',
      reason:
        payment.status === 'AUTHORIZED' && closedWithoutCapture
          ? `Booking is ${bookingStatus}; release can close the authorization without capture.`
          : terminalPayment
            ? `Payment is already ${payment.status}.`
            : payment.status === 'AUTHORIZED'
              ? 'The hold is still active; check booking evidence before release.'
              : `Payment status is ${payment.status}.`,
      operatorRule: 'Release only when the booking outcome should not capture customer funds.',
      pillClass: payment.status === 'AUTHORIZED' && closedWithoutCapture ? 'pill-warn' : 'pill-neutral',
    },
    {
      action: 'Refund',
      status:
        payment.status === 'CAPTURED'
          ? 'Evidence required'
          : payment.status === 'REFUNDED'
            ? 'Already refunded'
            : payment.status === 'RELEASED'
              ? 'Released'
              : 'Not captured',
      reason:
        payment.status === 'CAPTURED'
          ? 'Captured money can be refunded only after admin decision evidence is recorded.'
          : payment.status === 'REFUNDED'
            ? 'Refund path has already started.'
            : payment.status === 'RELEASED'
              ? 'The authorization was released, so no captured money remains here.'
              : 'There is no captured payment to refund from this row.',
      operatorRule: 'Refunds must preserve customer, partner, booking, payment, and chat evidence.',
      pillClass: payment.status === 'CAPTURED' ? 'pill-warn' : 'pill-neutral',
    },
    {
      action: 'Settle cash debt',
      status: cashDebt ? 'Evidence required' : payment.method === 'CASH' ? 'Clear' : 'Not cash',
      reason: cashDebt
        ? 'Cash was collected by the partner and the HANDS fee/tax debt is still open.'
        : payment.method === 'CASH'
          ? 'This cash payment has no open partner wallet debt on the linked earning.'
          : 'This payment is not a cash collection case.',
      operatorRule:
        'Settle with a deposit reference or approved admin offset before final acceptance, service start, or payout release.',
      pillClass: cashDebt ? 'pill-danger' : payment.method === 'CASH' ? 'pill-success' : 'pill-neutral',
    },
  ];
}

function paymentCashDebtNeedsSettlement(payment: AdminPayment) {
  const earning = payment.booking?.earning;
  return (
    payment.method === 'CASH' &&
    Boolean(earning) &&
    (earning?.netAmount ?? 0) < 0 &&
    earning?.status !== 'PAID'
  );
}

type PaymentCallbackMeta = {
  receivedAt: string | null;
  verified: boolean | null;
  mode: string | null;
  providerStatus: string | null;
  gatewayTransactionId: string | null;
  callbackAmount: number | null;
  rawKeys: string[];
};

function paymentCallbackMeta(payment: AdminPayment): PaymentCallbackMeta {
  const meta = paymentRawMeta(payment);
  const vnpAmount = numberFromUnknown(meta.vnp_Amount);

  return {
    receivedAt: stringFromUnknown(meta.callbackReceivedAt),
    verified: booleanFromUnknown(meta.callbackSignatureVerified),
    mode: stringFromUnknown(meta.callbackVerificationMode),
    providerStatus:
      stringFromUnknown(meta.status) ??
      stringFromUnknown(meta.resultCode) ??
      stringFromUnknown(meta.vnp_ResponseCode) ??
      stringFromUnknown(meta.message),
    gatewayTransactionId:
      stringFromUnknown(meta.transId) ??
      stringFromUnknown(meta.transactionId) ??
      stringFromUnknown(meta.vnp_TransactionNo) ??
      stringFromUnknown(meta.vnp_TxnRef),
    callbackAmount: numberFromUnknown(meta.amount) ?? (vnpAmount ? Math.round(vnpAmount / 100) : null),
    rawKeys: Object.keys(meta).sort(),
  };
}

function paymentRawMeta(payment: AdminPayment): Record<string, unknown> {
  if (!payment.rawMeta || typeof payment.rawMeta !== 'object' || Array.isArray(payment.rawMeta)) {
    return {};
  }
  return payment.rawMeta as Record<string, unknown>;
}

function paymentCallbackVerified(payment: AdminPayment) {
  return paymentCallbackMeta(payment).verified === true;
}

function paymentCallbackNeedsReview(payment: AdminPayment) {
  if (payment.method === 'CASH') {
    return false;
  }
  const callback = paymentCallbackMeta(payment);
  return Boolean(callback.receivedAt) && callback.verified !== true;
}

function paymentCallbackAttemptNeedsReview(attempt: AdminPaymentCallbackAttempt) {
  if (attempt.outcome === 'ACCEPTED' || attempt.outcome === 'REPLAY') {
    return attempt.signatureVerified !== true;
  }
  return true;
}

function paymentCallbackAttemptVerified(attempt: AdminPaymentCallbackAttempt) {
  return (attempt.outcome === 'ACCEPTED' || attempt.outcome === 'REPLAY') && attempt.signatureVerified === true;
}

function paymentCallbackAttemptPill(attempt: AdminPaymentCallbackAttempt) {
  if (attempt.outcome === 'ACCEPTED' && paymentCallbackAttemptVerified(attempt)) {
    return 'pill-success';
  }
  if (attempt.outcome === 'REPLAY' && paymentCallbackAttemptVerified(attempt)) {
    return 'pill-info';
  }
  if (attempt.outcome === 'CONFLICT') {
    return 'pill-danger';
  }
  return 'pill-warn';
}

function stringFromUnknown(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function booleanFromUnknown(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }
    if (value.toLowerCase() === 'false') {
      return false;
    }
  }
  return null;
}

function numberFromUnknown(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function PaymentCallbackEvidence({ payment }: { payment: AdminPayment }) {
  const callback = paymentCallbackMeta(payment);
  if (!callback.receivedAt) {
    return (
      <div className="ops-task-note" style={{ marginTop: 8 }}>
        <span className="pill pill-neutral">No callback</span>
        <p className="muted" style={{ marginTop: 6 }}>
          No gateway callback has been stored yet.
        </p>
      </div>
    );
  }

  const callbackPill = callback.verified ? 'pill-success' : 'pill-warn';
  const callbackLabel = callback.verified ? 'Verified callback' : 'Review callback';

  return (
    <div className="ops-task-note" style={{ marginTop: 8 }}>
      <span className={`pill ${callbackPill}`}>{callbackLabel}</span>
      <div className="setup-stage-list" style={{ marginTop: 8 }}>
        <div className="setup-stage-item">
          <span className="pill pill-info">Received</span>
          <div>
            <strong>{formatDateTime(callback.receivedAt)}</strong>
            <p className="muted">Verification mode: {callback.mode ?? 'unknown'}</p>
          </div>
        </div>
        <div className="setup-stage-item">
          <span className="pill pill-neutral">Gateway</span>
          <div>
            <strong>{callback.providerStatus ?? 'No status code'}</strong>
            <p className="muted">
              Transaction: {callback.gatewayTransactionId ?? 'none'} / Amount:{' '}
              {callback.callbackAmount !== null ? money(callback.callbackAmount, payment.currency) : 'unknown'}
            </p>
          </div>
        </div>
      </div>
      {callback.rawKeys.length ? (
        <details style={{ marginTop: 8 }}>
          <summary>Callback payload keys</summary>
          <p className="muted">{callback.rawKeys.join(', ')}</p>
        </details>
      ) : null}
    </div>
  );
}

function CashDebtSettlementForm({ payment }: { payment: AdminPayment }) {
  const earning = payment.booking?.earning;
  if (!earning) {
    return null;
  }

  const debtAmount = Math.abs(earning.netAmount);
  const settlementRef = `HANDS-CASH-${shortId(payment.bookingId).toUpperCase()}`;
  return (
    <form action={settleCashDebt} className="inline-form" style={{ marginTop: 8 }}>
      <input type="hidden" name="earningId" value={earning.id} />
      <input type="hidden" name="settlementMethod" value="PARTNER_DEPOSIT" />
      <input
        name="settlementRef"
        defaultValue={settlementRef}
        placeholder={settlementRef}
        aria-label="Cash debt settlement reference"
      />
      <input
        name="settlementNotes"
        defaultValue={`Partner deposited ${money(debtAmount, earning.currency)} with ${settlementRef}`}
        placeholder={`Partner deposited ${money(debtAmount, earning.currency)}`}
        aria-label="Cash debt settlement notes"
      />
      <button type="submit">Settle cash debt</button>
    </form>
  );
}
