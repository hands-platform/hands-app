import type { AdminPayment, AdminPaymentCallbackAttempt } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { buildPaymentActionConfirmation, readPaymentConfirmationAction } from './payment-action-confirmation';
import { PaymentCallbackAttemptLedgerSection } from './payment-callback-attempt-ledger-section';
import { PaymentFilterBoardSection } from './payment-filter-board-section';
import { PaymentOperationsTableSection } from './payment-operations-table-section';
import { emptyPaymentMessage, paymentFilterDescription } from './payment-page-links';
import { buildPaymentPageModel } from './payment-page-model';
import { buildPaymentOperationsTableRows, paymentConfirmationAction } from './payment-page-presenters';

type PaymentsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PaymentsPage({ searchParams }: { readonly searchParams?: PaymentsPageSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const model = buildPaymentPageModel({
    callbackAttempts: await adminGet<AdminPaymentCallbackAttempt[]>('/admin/payment-callback-attempts', []),
    params,
    payments: await adminGet<AdminPayment[]>('/admin/payments', []),
  });
  const confirmation = buildPaymentActionConfirmation(
    model.allPayments,
    readPaymentConfirmationAction(readSingleParam(params.confirm)),
    readSingleParam(params.paymentId),
  );

  return (
    <AdminPageTemplate
      description="Payment operations for holds, captures, cash collection, refunds, and gateway callback evidence."
      metrics={[
        {
          helper: 'Holds waiting for completion or release.',
          label: 'Authorized',
          value: model.metrics.authorized,
        },
        {
          helper: 'Cash bookings waiting for collection confirmation.',
          label: 'Pending cash',
          value: model.metrics.pendingCash,
        },
        {
          helper: 'Cash fee debt that still needs wallet settlement.',
          label: 'Cash debt',
          value: model.metrics.cashDebt,
        },
        {
          helper: 'Captured payment records in the current view.',
          label: 'Captured',
          value: model.metrics.captured,
        },
        {
          helper: 'Payments moved into the refund path.',
          label: 'Refunded',
          value: model.metrics.refunded,
        },
        {
          helper: 'Rows still needing operator attention.',
          label: 'Needs action',
          value: model.metrics.needsAction,
        },
        {
          helper: 'Refund records attached to visible payments.',
          label: 'Linked refunds',
          value: model.metrics.linkedRefunds,
        },
        {
          helper: 'Callbacks without verified gateway evidence.',
          label: 'Callback review',
          value: model.metrics.callbackReview,
        },
        {
          helper: 'Accepted callbacks with gateway evidence.',
          label: 'Callback verified',
          value: model.metrics.callbackVerified,
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
          model.activeFilter?.review ? paymentFilterDescription(model.activeFilter.review) : null
        }
        activeFilterLabel={model.activeFilter?.review ? model.activeFilter.label : null}
        activeRange={model.filters.range}
        filteredCount={model.payments.length}
        rangeLabel={model.dateRangeLabel}
        rangeLinks={model.rangeLinks}
        review={model.filters.review}
        reviewLinks={model.reviewLinks}
        totalCount={model.allPayments.length}
      />
      <PaymentCallbackAttemptLedgerSection rows={model.callbackAttemptRows} />
      <PaymentOperationsTableSection
        emptyMessage={emptyPaymentMessage(model.filters.review)}
        rows={buildPaymentOperationsTableRows(model.payments)}
      />
    </AdminPageTemplate>
  );
}

function readSingleParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
