import type { Metadata } from 'next';

import type { AdminPayment, AdminPaymentSummary } from '../../lib/admin-api';
import { adminGetResult } from '../../lib/admin-api';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminErrorState, AdminNoticeCard } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { ConfirmDialog } from '../../components/confirm-dialog';
import {
  buildPaymentActionConfirmation,
  paymentReturnTo,
  readPaymentConfirmationAction,
} from './payment-action-confirmation';
import { PaymentActionConfirmationSummary } from './payment-action-confirmation-summary';
import { PaymentFilterBoardSection } from './payment-filter-board-section';
import { PaymentOperationsTableSection } from './payment-operations-table-section';
import { emptyPaymentMessage, paymentFilterDescription } from './payment-page-links';
import {
  buildPaymentFilters,
  buildPaymentOperationsApiHref,
  buildPaymentPageHref,
  buildPaymentPageModel,
  buildPaymentResetHref,
  buildPaymentServerPagination,
  buildPaymentSummaryApiHref,
} from './payment-page-model';
import { buildPaymentOperationsTableRows, paymentConfirmationAction } from './payment-page-presenters';

type PaymentsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: { absolute: 'Payments | HANDS Admin' },
};

const EMPTY_PAYMENT_SUMMARY: AdminPaymentSummary = {
  activeCashCollection: 0,
  authorized: 0,
  callbackReview: 0,
  callbackVerified: 0,
  captureReady: 0,
  captured: 0,
  cashDebt: 0,
  evidenceConflicts: 0,
  generatedAt: '',
  linkedRefunds: 0,
  needsAction: 0,
  pendingCash: 0,
  refunded: 0,
  releaseRecommended: 0,
  staleMismatch: 0,
  totalCount: 0,
};

export default async function PaymentsPage({ searchParams }: { readonly searchParams?: PaymentsPageSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const filters = buildPaymentFilters(params);
  const currentHref = buildPaymentPageHref(filters, filters.page);
  const confirmationAction = readPaymentConfirmationAction(readSingleParam(params.confirm));
  const confirmationPaymentId = readSingleParam(params.paymentId);
  const [paymentsResult, summaryResult, confirmationResult] = await Promise.all([
    adminGetResult<AdminPayment[]>(buildPaymentOperationsApiHref(filters), []),
    adminGetResult<AdminPaymentSummary>(buildPaymentSummaryApiHref(filters), EMPTY_PAYMENT_SUMMARY),
    confirmationAction && confirmationPaymentId
      ? adminGetResult<AdminPayment | null>(`/admin/payments/${encodeURIComponent(confirmationPaymentId)}`, null)
      : Promise.resolve({ data: null as AdminPayment | null, ok: true, status: 200 }),
  ]);
  const model = buildPaymentPageModel({
    params,
    paymentSummary: summaryResult.ok ? summaryResult.data : null,
    payments: paymentsResult.data,
  });
  const confirmationPayment = confirmationResult.data ??
    model.allPayments.find((payment) => payment.id === confirmationPaymentId) ?? null;
  const returnTo = paymentReturnTo(readSingleParam(params.returnTo) || currentHref);
  const confirmation = buildPaymentActionConfirmation(
    confirmationPayment ? [confirmationPayment] : [],
    confirmationAction,
    confirmationPaymentId,
    { returnTo },
  );
  const paymentRows = buildPaymentOperationsTableRows(model.payments, currentHref);
  const paymentPagination = buildPaymentServerPagination(
    paymentRows,
    model.filters,
    summaryResult.ok ? model.totalCount : paymentRows.length,
  );
  const notice = paymentNotice(params);

  return (
    <AdminPageTemplate
      contentClassName="payment-command-page"
      description="Decide capture, release, refund review, and evidence follow-up from server-owned payment policy."
      metrics={summaryResult.ok ? [
        {
          helper: 'Completed bookings with verified payment evidence.',
          kind: 'action',
          label: 'Capture ready',
          scope: 'Action required',
          value: model.metrics.captureReady,
        },
        {
          helper: 'Terminal non-capture bookings whose authorization should be released.',
          kind: 'action',
          label: 'Release recommended',
          scope: 'Action required',
          value: model.metrics.releaseRecommended,
        },
        {
          helper: 'Callback signature, amount, or outcome conflicts.',
          kind: 'risk',
          label: 'Evidence conflicts',
          scope: 'Investigate',
          value: model.metrics.evidenceConflicts,
        },
        {
          helper: 'Pending cash attached to an active booking.',
          kind: 'live',
          label: 'Active cash',
          scope: 'Current operations',
          value: model.metrics.activeCashCollection,
        },
      ] : undefined}
      title="Payments"
    >
      {notice ? (
        <AdminNoticeCard className="admin-mb-16" role={notice.tone === 'danger' ? 'alert' : 'status'} tone={notice.tone}>
          <strong>{notice.title}</strong>
          <span>{notice.message}</span>
        </AdminNoticeCard>
      ) : null}

      {!summaryResult.ok ? (
        <AdminErrorState
          action={<AdminTextLink href={currentHref}>Retry payment totals</AdminTextLink>}
          message="Payment decision totals could not be loaded. Records below are not presented as the full backlog."
          title="Payment totals unavailable"
        />
      ) : null}

      {confirmation ? (
        <ConfirmDialog
          action={paymentConfirmationAction(confirmation.action)}
          cancelHref={confirmation.cancelHref}
          confirmLabel={confirmation.confirmLabel}
          description={<PaymentActionConfirmationSummary confirmation={confirmation} />}
          disabled={confirmation.disabled}
          hiddenInputs={[
            { name: 'paymentId', value: confirmation.paymentId },
            { name: 'idempotencyKey', value: confirmation.idempotencyKey },
            { name: 'returnTo', value: confirmation.returnTo },
            { name: 'policyVersion', value: confirmation.policyVersion },
          ]}
          id={`payment-${confirmation.action}-${confirmation.paymentId}`}
          textInputs={confirmation.reasonRequired ? [{
            label: 'Operator reason',
            maxLength: 500,
            minLength: 12,
            name: 'reason',
            placeholder: 'Describe the booking and payment evidence reviewed',
            required: true,
          }] : undefined}
          title={confirmation.title}
          tone={confirmation.tone}
        />
      ) : confirmationAction ? (
        <AdminErrorState
          action={<AdminTextLink href={returnTo}>Return to payment queue</AdminTextLink>}
          message="The selected payment could not be loaded. No payment action was made."
          title="Payment confirmation unavailable"
        />
      ) : null}

      <PaymentFilterBoardSection
        age={model.filters.age}
        ageCounts={summaryResult.ok ? summaryResult.data.queueAgeCounts : undefined}
        ageHref={(age) => buildPaymentPageHref({ ...model.filters, age, page: 1 })}
        queueSla={summaryResult.ok ? summaryResult.data.queueSla : undefined}
        sla={model.filters.sla}
        slaHref={(sla) => buildPaymentPageHref({ ...model.filters, page: 1, sla })}
        activeFilterDescription={model.activeFilter?.review ? paymentFilterDescription(model.activeFilter.review) : null}
        activeFilterLabel={model.activeFilter?.label ?? null}
        activeRange={model.filters.range}
        bookingStatus={model.filters.bookingStatus}
        customerProfileId={model.filters.customerProfileId}
        evidence={model.filters.evidence}
        filteredCount={model.payments.length}
        pageSize={model.filters.pageSize}
        paymentMethod={model.filters.paymentMethod}
        paymentStatus={model.filters.paymentStatus}
        q={model.filters.q}
        rangeLabel={model.dateRangeLabel}
        resetHref={buildPaymentResetHref(model.filters)}
        review={model.filters.review}
        reviewLinks={model.reviewLinks}
        historyAliasCounts={summaryResult.ok ? {
          all: Object.values(summaryResult.data.queueCounts ?? {}).reduce((total, count) => total + (count ?? 0), 0),
          authorized: summaryResult.data.authorized,
          'callback-verified': summaryResult.data.callbackVerified,
        } : undefined}
        queueCounts={summaryResult.ok ? summaryResult.data.queueCounts : undefined}
        totalCount={summaryResult.ok ? model.totalCount : model.payments.length}
        sort={model.filters.sort}
        sortHref={(sort) => buildPaymentPageHref({ ...model.filters, page: 1, sort })}
      />

      {paymentsResult.ok ? (
        <PaymentOperationsTableSection
          emptyMessage={emptyPaymentMessage(model.filters.review)}
          pagination={paymentPagination}
        />
      ) : (
        <AdminErrorState
          action={<AdminTextLink href={currentHref}>Retry payment records</AdminTextLink>}
          message="Payment records could not be loaded. No action controls are rendered from fallback data."
          title="Payment records unavailable"
        />
      )}
    </AdminPageTemplate>
  );
}

function paymentNotice(params: Record<string, string | string[] | undefined>) {
  const state = readSingleParam(params.paymentNotice);
  if (state !== 'success' && state !== 'error') return null;
  const action = readSingleParam(params.paymentAction).replaceAll('-', ' ');
  const paymentId = readSingleParam(params.paymentId);
  const auditId = readSingleParam(params.auditId);
  const code = readSingleParam(params.paymentCode);
  const message = readSingleParam(params.paymentMessage);
  if (state === 'success') {
    return {
      message: `Payment ${paymentId || 'record'} completed ${action || 'the action'}.${auditId ? ` Audit receipt ${auditId}.` : ''}`,
      title: 'Payment action completed',
      tone: 'success' as const,
    };
  }
  return {
    message: message || `${action || 'Payment action'} was rejected after the server rechecked current evidence.${code ? ` ${code}.` : ''}`,
    title: 'Payment action not completed',
    tone: 'danger' as const,
  };
}

function readSingleParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
