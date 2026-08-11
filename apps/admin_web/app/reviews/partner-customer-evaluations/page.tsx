import { redirect } from 'next/navigation';

import type { AdminPartnerCustomerReview, AdminPartnerCustomerReviewSummary } from '../../../lib/admin-api';
import { adminGetResult } from '../../../lib/admin-api';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminErrorState, AdminNoticeCard } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { StatusBadge } from '../../../components/status-badge';
import { shortId } from '../../../lib/admin-format';
import { readSearchParam } from '../../../lib/date-range';
import { moderatePartnerCustomerNote } from './actions';
import {
  buildPartnerNoteModerationConfirmation,
  readPartnerNoteModerationStatus,
  safePartnerNoteReturnTo,
} from '../partner-customer-note-action-confirmation';
import {
  buildPartnerCustomerReviewDataHrefs,
  buildPartnerCustomerEvaluationFilters,
  buildPartnerCustomerEvaluationListHref,
  buildPartnerCustomerReviewTableRows,
  buildServerReviewPagination,
  partnerCustomerReviewFilteredTotal,
  partnerCustomerReviewStatusLabel,
  reviewDateRangeError,
} from '../review-page-model';
import { PartnerCustomerEvaluationsSection } from '../partner-customer-evaluations-section';

type PartnerCustomerEvaluationsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const emptySummary: AdminPartnerCustomerReviewSummary = {
  needsReview: 0,
  restricted: 0,
  retained: 0,
  totalCount: 0,
};

export default async function PartnerCustomerEvaluationsPage({
  searchParams,
}: {
  searchParams?: PartnerCustomerEvaluationsPageSearchParams;
}) {
  const params = searchParams ? await searchParams : {};
  const filters = buildPartnerCustomerEvaluationFilters(params);
  const dateError = reviewDateRangeError(filters);
  const requestedDateRange = readSearchParam(params.dateRange);

  if (requestedDateRange === 'custom' && !filters.dateFrom && !filters.dateTo) {
    redirect(buildPartnerCustomerEvaluationListHref(filters, { dateRange: 'all', page: 1 }));
  }

  const dataHrefs = buildPartnerCustomerReviewDataHrefs(filters);
  const summaryResult = dateError
    ? { data: emptySummary, ok: true, status: 200 }
    : await adminGetResult<AdminPartnerCustomerReviewSummary>(dataHrefs.summaryHref, emptySummary);
  const filteredTotal = summaryResult.ok
    ? partnerCustomerReviewFilteredTotal(summaryResult.data, filters.review)
    : 0;

  if (!dateError && summaryResult.ok) {
    const totalPages = Math.max(1, Math.ceil(filteredTotal / filters.pageSize));
    const rawPage = readSearchParam(params.page);
    const requestedPage = Number(rawPage);
    if ((rawPage && (!Number.isInteger(requestedPage) || requestedPage < 1)) || filters.page > totalPages) {
      redirect(
        buildPartnerCustomerEvaluationListHref(filters, {
          page: Math.min(Math.max(filters.page, 1), totalPages),
        }),
      );
    }
  }

  const confirmRequested = readSearchParam(params.confirm) === 'moderate';
  const confirmNoteId = readSearchParam(params.noteId);
  const [listResult, confirmationResult] = await Promise.all([
    dateError || !summaryResult.ok
      ? Promise.resolve({ data: [] as AdminPartnerCustomerReview[], ok: true, status: 200 })
      : adminGetResult<AdminPartnerCustomerReview[]>(dataHrefs.listHref, []),
    !dateError && confirmRequested && confirmNoteId
      ? adminGetResult<AdminPartnerCustomerReview | null>(
          `/admin/partner-customer-reviews/${encodeURIComponent(confirmNoteId)}`,
          null,
        )
      : Promise.resolve({ data: null, ok: !confirmRequested, status: confirmRequested ? 400 : 200 }),
  ]);

  const pagination = buildServerReviewPagination(listResult.data, filters, filteredTotal);
  const rows = buildPartnerCustomerReviewTableRows(pagination.rows);
  const rowPagination = { ...pagination, rows };
  const confirmationStatus = readPartnerNoteModerationStatus(readSearchParam(params.targetStatus));
  const confirmation =
    confirmRequested && confirmationResult.ok
      ? buildPartnerNoteModerationConfirmation(
          confirmationResult.data,
          confirmationStatus,
          safePartnerNoteReturnTo(readSearchParam(params.returnTo)),
        )
      : null;
  const confirmationError =
    confirmRequested && !confirmation
      ? confirmationResult.status === 404
        ? 'The selected Partner note no longer exists. Refresh the list before taking action.'
        : 'The selected Partner note could not be loaded. No review-state change has been made.'
      : '';
  const notice = partnerNoteActionNotice(readSearchParam(params.notice));
  const retryHref = buildPartnerCustomerEvaluationListHref(filters, { page: filters.page });
  const returnTo = buildPartnerCustomerEvaluationListHref(filters, { page: filters.page });

  return (
    <AdminPageTemplate
      actions={<StatusBadge tone="info">Internal · Not customer-visible</StatusBadge>}
      contentClassName="reviews-page partner-notes-page"
      description="Internal notes Partners submit about customers after completed bookings. These notes are not customer-visible."
      title="Partner Notes About Customers"
    >
      {notice ? (
        <AdminNoticeCard
          className="admin-mb-16"
          role={notice.tone === 'danger' ? 'alert' : 'status'}
          tone={notice.tone}
        >
          {notice.message}
        </AdminNoticeCard>
      ) : null}

      {confirmationError ? (
        <AdminNoticeCard className="admin-mb-16" role="alert" tone="danger">
          <strong>Review confirmation unavailable</strong>
          <p>{confirmationError}</p>
          <AdminTextLink href={safePartnerNoteReturnTo(readSearchParam(params.returnTo))}>
            Return to Partner notes
          </AdminTextLink>
        </AdminNoticeCard>
      ) : null}

      {confirmation ? (
        <ConfirmDialog
          action={moderatePartnerCustomerNote}
          cancelHref={confirmation.cancelHref}
          confirmLabel={confirmation.confirmLabel}
          description={
            <div className="review-confirmation-summary">
              <dl>
                <div>
                  <dt>Partner note</dt>
                  <dd>{partnerNoteExcerpt(confirmation.note.comment)}</dd>
                </div>
                <div>
                  <dt>Customer</dt>
                  <dd>{confirmation.note.customerProfile?.user?.fullName ?? 'Unknown customer'}</dd>
                </div>
                <div>
                  <dt>Partner</dt>
                  <dd>{confirmation.note.providerProfile?.displayName ?? 'Unknown Partner'}</dd>
                </div>
                <div>
                  <dt>Booking</dt>
                  <dd>
                    {confirmation.note.booking?.id
                      ? shortId(confirmation.note.booking.id)
                      : 'No booking link'}
                  </dd>
                </div>
                <div>
                  <dt>Current state</dt>
                  <dd>{partnerCustomerReviewStatusLabel(confirmation.note.status ?? '')}</dd>
                </div>
                <div>
                  <dt>Next state</dt>
                  <dd>{confirmation.targetLabel}</dd>
                </div>
                <div>
                  <dt>Impact</dt>
                  <dd>{confirmation.impact}</dd>
                </div>
              </dl>
            </div>
          }
          hiddenInputs={confirmation.hiddenInputs}
          id={`partner-note-moderation-${confirmation.note.id}`}
          selectInputs={
            confirmation.reasonOptions
              ? [
                  {
                    label: 'Review-state reason',
                    name: 'reason',
                    options: confirmation.reasonOptions,
                    required: true,
                  },
                ]
              : []
          }
          title={confirmation.title}
          tone={confirmation.tone}
        />
      ) : null}

      {!summaryResult.ok ? (
        <AdminErrorState
          action={<AdminTextLink href={retryHref}>Retry Partner note summary</AdminTextLink>}
          message="The Partner note summary could not be loaded. No zero counts are shown until the source is available."
          title="Partner note summary unavailable"
        />
      ) : !listResult.ok ? (
        <AdminErrorState
          action={<AdminTextLink href={retryHref}>Retry Partner note list</AdminTextLink>}
          message="The Partner note list could not be loaded. The summary remains available, but no missing rows are shown as an empty result."
          title="Partner note list unavailable"
        />
      ) : (
        <PartnerCustomerEvaluationsSection
          dateError={dateError}
          filters={filters}
          pagination={rowPagination}
          returnTo={returnTo}
          rows={rows}
          summary={summaryResult.data}
        />
      )}
    </AdminPageTemplate>
  );
}

function partnerNoteExcerpt(value?: string | null) {
  const copy = value?.trim() || 'No written note';
  return copy.length > 180 ? `${copy.slice(0, 177)}...` : copy;
}

function partnerNoteActionNotice(value: string) {
  if (value === 'retained') return { message: 'Partner note retained.', tone: 'success' as const };
  if (value === 'needs-review') {
    return {
      message:
        "Partner note sent to Needs review and included in the customer's reported-review risk signal.",
      tone: 'success' as const,
    };
  }
  if (value === 'restricted') return { message: 'Partner note restricted.', tone: 'success' as const };
  if (value === 'failed') {
    return {
      message:
        'Partner note review-state change failed. Refresh and try again. The original note was not changed.',
      tone: 'danger' as const,
    };
  }
  return null;
}
