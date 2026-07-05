import type { AdminPayment } from '../../lib/admin-api';
import { AdminFormControlButton, AdminFormInput } from '../../components/admin-form-controls';
import { AdminInlineForm } from '../../components/admin-inline-action-form';
import { AdminDisclosure } from '../../components/admin-surface';
import { AdminSignal, StatusBadge } from '../../components/status-badge';
import { formatDateTime, formatMoney as money, shortId } from '../../lib/admin-format';
import { capturePayment, refundPayment, releasePayment, settleCashDebt, syncPayment } from './actions';
import type { PaymentConfirmationAction } from './payment-action-confirmation';
import { paymentActionConfirmHref } from './payment-action-confirmation';
import { paymentActionExecutionMap } from './payment-action-execution-map';
import type { PaymentOperationsTableRow } from './payment-operations-table-section';
import {
  paymentCallbackMeta,
  paymentCallbackNeedsReview,
  paymentCashDebtNeedsSettlement,
  paymentOpsHint,
  paymentRecordDateLabel,
  paymentStateLabel,
  paymentStatusIsTerminal,
} from './payment-page-rules';

export function buildPaymentOperationsTableRows(payments: readonly AdminPayment[]): PaymentOperationsTableRow[] {
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

export function paymentConfirmationAction(action: PaymentConfirmationAction) {
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

function paymentActionMenuItems(payment: AdminPayment) {
  const terminalPayment = paymentStatusIsTerminal(payment.status);
  return [
    {
      description: 'Open payment detail, callback timeline, and linked booking evidence.',
      href: `/payments/${payment.id}`,
      kind: 'link' as const,
      label: 'Open detail',
      tone: 'info' as const,
    },
    {
      description: payment.providerRef ? 'Confirm gateway sync before running it.' : 'Gateway reference is missing.',
      disabled: !payment.providerRef,
      href: paymentActionConfirmHref(payment.id, 'sync'),
      kind: 'link' as const,
      label: 'Sync',
      tone: 'info' as const,
    },
    {
      description: terminalPayment ? 'Terminal payments cannot be captured again.' : 'Review before capturing funds.',
      disabled: terminalPayment,
      href: paymentActionConfirmHref(payment.id, 'capture'),
      kind: 'link' as const,
      label: 'Capture',
      tone: 'warning' as const,
    },
    {
      description: terminalPayment ? 'Terminal payments cannot be released again.' : 'Review before releasing the hold.',
      disabled: terminalPayment,
      href: paymentActionConfirmHref(payment.id, 'release'),
      kind: 'link' as const,
      label: 'Release',
      tone: 'warning' as const,
    },
    {
      description:
        payment.status === 'REFUNDED' || payment.status === 'RELEASED'
          ? 'This payment cannot enter a new refund action.'
          : 'Review evidence before starting a refund.',
      disabled: payment.status === 'REFUNDED' || payment.status === 'RELEASED',
      href: paymentActionConfirmHref(payment.id, 'refund'),
      kind: 'link' as const,
      label: 'Refund',
      tone: 'danger' as const,
    },
  ];
}

function paymentOpsSignal(payment: AdminPayment) {
  if (paymentCallbackNeedsReview(payment)) {
    return <AdminSignal tone="warn">Callback check</AdminSignal>;
  }
  if (paymentCashDebtNeedsSettlement(payment)) {
    return <AdminSignal tone="warn">Cash fee debt</AdminSignal>;
  }
  if (payment.status === 'AUTHORIZED') {
    return <AdminSignal tone="warn">Capture after service</AdminSignal>;
  }
  if (payment.method === 'CASH' && payment.status === 'PENDING') {
    return <AdminSignal tone="info">Cash collection</AdminSignal>;
  }
  if (payment.status === 'REFUNDED') {
    return <AdminSignal tone="warn">Refund in motion</AdminSignal>;
  }
  if (payment.status === 'CAPTURED' || payment.status === 'RELEASED') {
    return <AdminSignal tone="ok">Settled</AdminSignal>;
  }
  return <AdminSignal tone="info">Monitor payment</AdminSignal>;
}

function PaymentCallbackEvidence({ payment }: { readonly payment: AdminPayment }) {
  const callback = paymentCallbackMeta(payment);
  if (!callback.receivedAt) {
    return (
      <div className="ops-task-note admin-mt-8">
        <StatusBadge tone="neutral">No callback</StatusBadge>
        <p className="muted admin-mt-6">
          No gateway callback has been stored yet.
        </p>
      </div>
    );
  }

  const callbackLabel = callback.verified ? 'Verified callback' : 'Review callback';

  return (
    <div className="ops-task-note admin-mt-8">
      <StatusBadge tone={callback.verified ? 'success' : 'warning'}>{callbackLabel}</StatusBadge>
      <div className="setup-stage-list admin-mt-8">
        <div className="setup-stage-item">
          <StatusBadge tone="info">Received</StatusBadge>
          <div>
            <strong>{formatDateTime(callback.receivedAt)}</strong>
            <p className="muted">Verification mode: {callback.mode ?? 'unknown'}</p>
          </div>
        </div>
        <div className="setup-stage-item">
          <StatusBadge tone="neutral">Gateway</StatusBadge>
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
        <AdminDisclosure className="admin-mt-8">
          <summary>Callback payload keys</summary>
          <p className="muted">{callback.rawKeys.join(', ')}</p>
        </AdminDisclosure>
      ) : null}
    </div>
  );
}

function CashDebtSettlementForm({ payment }: { readonly payment: AdminPayment }) {
  const earning = payment.booking?.earning;
  if (!earning) {
    return null;
  }

  const debtAmount = Math.abs(earning.netAmount);
  const settlementRef = `HANDS-CASH-${shortId(payment.bookingId).toUpperCase()}`;
  return (
    <AdminInlineForm action={settleCashDebt} className="admin-mt-8">
      <input name="earningId" type="hidden" value={earning.id} />
      <input name="settlementMethod" type="hidden" value="PARTNER_DEPOSIT" />
      <AdminFormInput
        defaultValue={settlementRef}
        label="Cash debt settlement reference"
        name="settlementRef"
        placeholder={settlementRef}
      />
      <AdminFormInput
        defaultValue={`Partner deposited ${money(debtAmount, earning.currency)} with ${settlementRef}`}
        label="Cash debt settlement notes"
        name="settlementNotes"
        placeholder={`Partner deposited ${money(debtAmount, earning.currency)}`}
      />
      <AdminFormControlButton className="button-primary" type="submit">
        Settle cash debt
      </AdminFormControlButton>
    </AdminInlineForm>
  );
}
