import type { AdminPayment, AdminPaymentCallbackAttempt, AdminPaymentSummary, AdminUser } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import { buildFinanceApproverOptions } from '../finance-tax/finance-approver-options';
import { buildPaymentActionConfirmation, readPaymentConfirmationAction } from './payment-action-confirmation';
import { PaymentCallbackAttemptLedgerSection } from './payment-callback-attempt-ledger-section';
import { PaymentFilterBoardSection } from './payment-filter-board-section';
import { PaymentOperationsTableSection } from './payment-operations-table-section';
import { emptyPaymentMessage, paymentFilterDescription } from './payment-page-links';
import {
  buildPaymentCallbackAttemptsApiHref,
  buildPaymentFilters,
  buildPaymentOperationsApiHref,
  buildPaymentPageModel,
  buildPaymentServerPagination,
  buildPaymentSummaryApiHref,
} from './payment-page-model';
import { buildPaymentOperationsTableRows, paymentConfirmationAction } from './payment-page-presenters';

type PaymentsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PaymentsPage({ searchParams }: { readonly searchParams?: PaymentsPageSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const filters = buildPaymentFilters(params);
  const [callbackAttempts, payments, paymentSummary] = await Promise.all([
    adminGet<AdminPaymentCallbackAttempt[]>(buildPaymentCallbackAttemptsApiHref(filters), []),
    adminGet<AdminPayment[]>(buildPaymentOperationsApiHref(filters), []),
    adminGet<AdminPaymentSummary | null>(buildPaymentSummaryApiHref(filters), null),
  ]);
  const model = buildPaymentPageModel({
    callbackAttempts,
    params,
    paymentSummary,
    payments,
  });
  const confirmation = buildPaymentActionConfirmation(
    model.allPayments,
    readPaymentConfirmationAction(readSingleParam(params.confirm)),
    readSingleParam(params.paymentId),
  );
  const needsFinanceApproverDirectory = confirmation?.action === 'refund';
  const [currentOperatorAccess, financeApproverUsers] = needsFinanceApproverDirectory
    ? await Promise.all([
        getCurrentAdminOperatorAccess(),
        adminGet<AdminUser[]>('/admin/users?take=50&role=ADMIN&view=finance-approver-directory', []),
      ])
    : [null, []];
  const financeApproverOptions = buildFinanceApproverOptions(
    financeApproverUsers,
    currentOperatorAccess?.id ?? null,
  );
  const refundApprovalUnavailable = needsFinanceApproverDirectory && financeApproverOptions.length === 0;
  const paymentRows = buildPaymentOperationsTableRows(model.payments);
  const paymentPagination = buildPaymentServerPagination(paymentRows, model.filters, model.totalCount);
  const paymentRangeScope = model.dateRangeLabel;

  return (
    <AdminPageTemplate
      description="Payment operations for holds, captures, cash collection, refunds, and gateway callback evidence."
      metrics={[
        {
          helper: 'Holds waiting for completion or release.',
          kind: 'live',
          label: 'Authorized',
          scope: 'Live',
          value: model.metrics.authorized,
        },
        {
          helper: 'Cash bookings waiting for collection confirmation.',
          kind: 'action',
          label: 'Pending cash',
          scope: 'Pending',
          value: model.metrics.pendingCash,
        },
        {
          helper: 'Cash fee debt that still needs wallet settlement.',
          kind: 'risk',
          label: 'Cash debt',
          scope: 'Needs action',
          value: model.metrics.cashDebt,
        },
        {
          helper: 'Captured payment records in the selected range.',
          kind: 'period',
          label: 'Captured',
          scope: paymentRangeScope,
          value: model.metrics.captured,
        },
        {
          helper: 'Payments moved into the refund path.',
          kind: 'period',
          label: 'Refunded',
          scope: paymentRangeScope,
          value: model.metrics.refunded,
        },
        {
          helper: 'Rows still needing operator attention.',
          kind: 'action',
          label: 'Needs action',
          scope: 'Needs action',
          value: model.metrics.needsAction,
        },
        {
          helper: 'Refund records attached to visible payments.',
          kind: 'record',
          label: 'Linked refunds',
          scope: paymentRangeScope,
          value: model.metrics.linkedRefunds,
        },
        {
          helper: 'Callbacks without verified gateway evidence.',
          kind: 'risk',
          label: 'Callback review',
          scope: 'Needs action',
          value: model.metrics.callbackReview,
        },
        {
          helper: 'Accepted callbacks with gateway evidence.',
          kind: 'record',
          label: 'Callback verified',
          scope: 'Delivery records',
          value: model.metrics.callbackVerified,
        },
      ]}
      title="Payments"
    >
      {confirmation ? (
        <>
          {refundApprovalUnavailable ? (
            <AdminInlineNotice className="admin-mb-16" role="alert" tone="warning">
              No other Finance approver is available. Refund execution remains disabled until another operator has the FINANCE_APPROVER role.
            </AdminInlineNotice>
          ) : null}
          <ConfirmDialog
            action={paymentConfirmationAction(confirmation.action)}
            cancelHref={confirmation.cancelHref}
            confirmLabel={confirmation.confirmLabel}
            description={confirmation.description}
            disabled={confirmation.disabled || refundApprovalUnavailable}
            hiddenInputs={[{ name: 'paymentId', value: confirmation.paymentId }]}
            id={`payment-${confirmation.action}-${confirmation.paymentId}`}
            selectInputs={
              confirmation.action === 'refund'
                ? [
                    {
                      label: 'Separate Finance approver',
                      name: 'approvalAdminId',
                      options: [{ label: 'Select Finance approver', value: '' }, ...financeApproverOptions],
                      required: true,
                    },
                  ]
                : []
            }
            title={confirmation.title}
            tone={confirmation.tone}
          />
        </>
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
        totalCount={model.totalCount}
      />
      <PaymentCallbackAttemptLedgerSection rows={model.callbackAttemptRows} />
      <PaymentOperationsTableSection
        emptyMessage={emptyPaymentMessage(model.filters.review)}
        pagination={paymentPagination}
      />
    </AdminPageTemplate>
  );
}

function readSingleParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
