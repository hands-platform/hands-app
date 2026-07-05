import Link from 'next/link';
import { Eye, Star } from 'lucide-react';

import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from './admin-data-table';
import { AdminSectionHeader } from './admin-page-template';
import { AdminPersonCell, adminPersonInitials } from './admin-person-cell';
import { AdminTablePanel } from './admin-table-panel';
import { DateTimeText } from './date-time-text';
import { StatusBadge } from './status-badge';
import {
  adminAvatarStatusFromSignals,
  type AdminAvatarPushDeviceSignal,
  type AdminAvatarSessionSignal,
  type AdminAvatarStatus,
} from '../lib/admin-avatar-status';
import type { AdminPartnerCustomerReview, AdminReview } from '../lib/admin-api';
import { shortId } from '../lib/admin-format';

const CUSTOMER_REVIEW_HEADERS = ['Request Time', 'Partner', 'Customer', 'Review', 'Visibility'] as const;
const PARTNER_EVALUATION_HEADERS = ['Request Time', 'Partner', 'Customer', 'Customer evaluation'] as const;
const REVIEW_RECORDS_DETAIL_PAGE_SIZE = 5;

type SearchParamRecord = Record<string, string | string[] | undefined>;

type ReviewAvatarUserSignal = {
  readonly appSessions?: readonly AdminAvatarSessionSignal[];
  readonly pushDevices?: readonly AdminAvatarPushDeviceSignal[];
};

type ReviewAvatarProviderSignal = {
  readonly devices?: readonly AdminAvatarPushDeviceSignal[];
  readonly sessions?: readonly AdminAvatarSessionSignal[];
  readonly status?: string | null;
  readonly user?: ReviewAvatarUserSignal;
};

type AdminReviewRecordsSectionProps = {
  readonly basePath?: string;
  readonly customerReviews: readonly AdminReview[];
  readonly description?: string;
  readonly id: string;
  readonly partnerEvaluations: readonly AdminPartnerCustomerReview[];
  readonly searchParams?: SearchParamRecord;
  readonly title?: string;
};

export function AdminReviewRecordsSection({
  basePath,
  customerReviews,
  description = 'Customer-written reviews and Partner-written customer evaluations connected to this record.',
  id,
  partnerEvaluations,
  searchParams = {},
  title = 'Review records',
}: AdminReviewRecordsSectionProps) {
  const customerRows = [...customerReviews].sort((left, right) => reviewRecordMs(right) - reviewRecordMs(left));
  const partnerRows = [...partnerEvaluations].sort(
    (left, right) => partnerEvaluationRecordMs(right) - partnerEvaluationRecordMs(left),
  );
  const customerPagination = paginateReviewRecordRows(
    customerRows,
    readReviewRecordPage(searchParams, 'customerReviewPage'),
  );
  const partnerPagination = paginateReviewRecordRows(
    partnerRows,
    readReviewRecordPage(searchParams, 'partnerEvaluationPage'),
  );
  const totalRecords = customerRows.length + partnerRows.length;

  return (
    <AdminTablePanel
      className="vuexy-review-card"
      description={description}
      id={id}
      resultLabel={`${totalRecords} record(s)`}
      resultTone={totalRecords > 0 ? 'info' : 'neutral'}
      title={title}
    >
      <div className="admin-review-records-grid">
        <section aria-labelledby={`${id}-customer-reviews-title`} className="admin-review-records-block">
          <AdminSectionHeader
            className="admin-review-records-heading"
            description="Customer-facing review content. Moderation stays on the Reviews page."
            status={<StatusBadge tone="neutral">{customerRows.length} review(s)</StatusBadge>}
            title="Customer reviews"
            titleId={`${id}-customer-reviews-title`}
          />
          <AdminTableScroll>
            <AdminDataTable
              className="vuexy-booking-table vuexy-review-table"
              emptyMessage="No customer review connected to this record."
              headers={CUSTOMER_REVIEW_HEADERS}
              rowCount={customerPagination.rows.length}
            >
              {customerPagination.rows.map((review, index) => (
                <tr key={reviewRecordRowKey(review, reviewRecordAbsoluteIndex(customerPagination.from, index))}>
                  <td>{reviewRequestCell(review)}</td>
                  <td>{reviewPartnerCell(review)}</td>
                  <td>{reviewCustomerCell(review)}</td>
                  <td className="vuexy-review-copy-cell">
                    <div aria-label={`${review.rating} out of 5`} className="vuexy-review-stars">
                      {Array.from({ length: 5 }, (_, index) => (
                        <Star
                          aria-hidden="true"
                          className={index < review.rating ? 'is-filled' : undefined}
                          key={`${review.id}-star-${index}`}
                          size={18}
                        />
                      ))}
                    </div>
                    <p>{review.comment?.trim() || 'No written review'}</p>
                    <span>{reviewServiceLabel(review.booking?.services)}</span>
                  </td>
                  <td className="vuexy-review-visibility-cell">{reviewVisibilityCell(review)}</td>
                </tr>
              ))}
            </AdminDataTable>
          </AdminTableScroll>
          <ReviewRecordsPaginationFooter
            activePage={customerPagination.page}
            ariaLabel="Customer review record pages"
            basePath={basePath}
            pageKey="customerReviewPage"
            searchParams={searchParams}
            totalPages={customerPagination.totalPages}
            totalRows={customerPagination.totalRows}
            visibleFrom={customerPagination.from}
            visibleTo={customerPagination.to}
          />
        </section>

        <section aria-labelledby={`${id}-partner-evaluations-title`} className="admin-review-records-block">
          <AdminSectionHeader
            className="admin-review-records-heading"
            description="Read-only internal records. These do not publish to the customer app."
            status={<StatusBadge tone="neutral">{partnerRows.length} evaluation(s)</StatusBadge>}
            title="Partner evaluations"
            titleId={`${id}-partner-evaluations-title`}
          />
          <AdminTableScroll>
            <AdminDataTable
              className="vuexy-booking-table vuexy-review-table vuexy-partner-evaluation-table"
              emptyMessage="No Partner evaluation connected to this record."
              headers={PARTNER_EVALUATION_HEADERS}
              rowCount={partnerPagination.rows.length}
            >
              {partnerPagination.rows.map((review, index) => (
                <tr
                  key={partnerEvaluationRecordRowKey(
                    review,
                    reviewRecordAbsoluteIndex(partnerPagination.from, index),
                  )}
                >
                  <td>{partnerEvaluationRequestCell(review)}</td>
                  <td>{partnerEvaluationPartnerCell(review)}</td>
                  <td>{partnerEvaluationCustomerCell(review)}</td>
                  <td className="vuexy-review-copy-cell">
                    <p>{review.comment?.trim() || 'No written evaluation'}</p>
                    <span>{reviewServiceLabel(review.booking?.services)}</span>
                  </td>
                </tr>
              ))}
            </AdminDataTable>
          </AdminTableScroll>
          <ReviewRecordsPaginationFooter
            activePage={partnerPagination.page}
            ariaLabel="Partner customer evaluation record pages"
            basePath={basePath}
            pageKey="partnerEvaluationPage"
            searchParams={searchParams}
            totalPages={partnerPagination.totalPages}
            totalRows={partnerPagination.totalRows}
            visibleFrom={partnerPagination.from}
            visibleTo={partnerPagination.to}
          />
        </section>
      </div>
    </AdminTablePanel>
  );
}

export function reviewRecordsForBooking(
  customerReviews: readonly AdminReview[],
  partnerEvaluations: readonly AdminPartnerCustomerReview[],
  bookingId: string,
) {
  return {
    customerReviews: customerReviews.filter((review) => reviewRecordBookingId(review) === bookingId),
    partnerEvaluations: partnerEvaluations.filter((review) => partnerEvaluationBookingId(review) === bookingId),
  };
}

export function reviewRecordsForCustomer(
  customerReviews: readonly AdminReview[],
  partnerEvaluations: readonly AdminPartnerCustomerReview[],
  customerProfileId: string,
) {
  return {
    customerReviews: customerReviews.filter((review) => reviewRecordCustomerId(review) === customerProfileId),
    partnerEvaluations: partnerEvaluations.filter((review) => partnerEvaluationCustomerId(review) === customerProfileId),
  };
}

export function reviewRecordsForPartner(
  customerReviews: readonly AdminReview[],
  partnerEvaluations: readonly AdminPartnerCustomerReview[],
  providerProfileId: string,
) {
  return {
    customerReviews: customerReviews.filter((review) => reviewRecordPartnerId(review) === providerProfileId),
    partnerEvaluations: partnerEvaluations.filter((review) => partnerEvaluationPartnerId(review) === providerProfileId),
  };
}

export function reviewRecordRowKey(review: AdminReview, index: number) {
  return [
    'customer-review',
    review.id,
    reviewRecordBookingId(review) ?? 'no-booking',
    reviewRecordCustomerId(review) ?? 'no-customer',
    reviewRecordPartnerId(review) ?? 'no-partner',
    review.createdAt ?? 'no-created-at',
    index,
  ].join(':');
}

export function partnerEvaluationRecordRowKey(review: AdminPartnerCustomerReview, index: number) {
  return [
    'partner-evaluation',
    review.id,
    partnerEvaluationBookingId(review) ?? 'no-booking',
    partnerEvaluationCustomerId(review) ?? 'no-customer',
    partnerEvaluationPartnerId(review) ?? 'no-partner',
    review.createdAt ?? 'no-created-at',
    index,
  ].join(':');
}

function reviewRequestCell(review: AdminReview) {
  const bookingId = reviewRecordBookingId(review);
  return (
    <>
      <div className="vuexy-booking-id-line">
        {bookingId ? (
          <Link className="text-link" href={`/bookings/${bookingId}`} title="Open booking detail">
            <Eye aria-hidden="true" size={14} />
            {shortId(bookingId)}
          </Link>
        ) : (
          <span className="muted">No booking link</span>
        )}
      </div>
      <div className="muted">
        <DateTimeText fallback="No request time" value={reviewRequestTimeValue(review)} />
      </div>
      <div className="muted vuexy-review-submitted-line">
        Review submitted <DateTimeText fallback="No reviewed date" value={review.createdAt} />
      </div>
    </>
  );
}

function partnerEvaluationRequestCell(review: AdminPartnerCustomerReview) {
  const bookingId = partnerEvaluationBookingId(review);
  return (
    <>
      <div className="vuexy-booking-id-line">
        {bookingId ? (
          <Link className="text-link" href={`/bookings/${bookingId}`} title="Open booking detail">
            <Eye aria-hidden="true" size={14} />
            {shortId(bookingId)}
          </Link>
        ) : (
          <span className="muted">No booking link</span>
        )}
      </div>
      <div className="muted">
        <DateTimeText fallback="No request time" value={partnerEvaluationRequestTimeValue(review)} />
      </div>
      <div className="muted vuexy-review-submitted-line">
        Evaluation submitted <DateTimeText fallback="No logged date" value={review.createdAt} />
      </div>
    </>
  );
}

function reviewVisibilityCell(review: AdminReview) {
  return (
    <>
      <span className={reviewStatusClassName(review.status)}>{reviewStatusLabel(review.status)}</span>
      <small>{reviewAppVisibilityLabel(review.status)}</small>
    </>
  );
}

function ReviewRecordsPaginationFooter({
  activePage,
  ariaLabel,
  basePath,
  pageKey,
  searchParams,
  totalPages,
  totalRows,
  visibleFrom,
  visibleTo,
}: {
  readonly activePage: number;
  readonly ariaLabel: string;
  readonly basePath?: string;
  readonly pageKey: string;
  readonly searchParams: SearchParamRecord;
  readonly totalPages: number;
  readonly totalRows: number;
  readonly visibleFrom: number;
  readonly visibleTo: number;
}) {
  return (
    <AdminTablePaginationFooter
      activePage={activePage}
      ariaLabel={ariaLabel}
      className="vuexy-review-footer"
      from={visibleFrom}
      hrefForPage={basePath ? (page) => buildReviewRecordPageHref(basePath, searchParams, pageKey, page) : undefined}
      pageLinkClassName="vuexy-review-page-link"
      paginationClassName="vuexy-review-pagination"
      to={visibleTo}
      totalPages={totalPages}
      totalRows={totalRows}
    />
  );
}

function reviewPartnerCell(review: AdminReview) {
  const partnerId = reviewRecordPartnerId(review);
  const label = review.providerProfile?.displayName ?? review.providerProfile?.user?.fullName ?? 'Unknown Partner';

  return (
    <AdminPersonCell
      avatarClassName="vuexy-booking-avatar is-partner"
      avatarStatus={reviewPartnerAvatarStatus(review)}
      className="vuexy-booking-person"
      copyClassName="vuexy-booking-person-copy"
      helper={review.providerProfile?.user?.phone ?? 'No phone on file'}
      href={partnerId ? `/partners/${partnerId}` : null}
      initials={adminPersonInitials(label)}
      label={label}
      linkClassName="vuexy-booking-person-link"
    />
  );
}

function partnerEvaluationPartnerCell(review: AdminPartnerCustomerReview) {
  const partnerId = partnerEvaluationPartnerId(review);
  const label = review.providerProfile?.displayName ?? review.providerProfile?.user?.fullName ?? 'Unknown Partner';

  return (
    <AdminPersonCell
      avatarClassName="vuexy-booking-avatar is-partner"
      avatarStatus={partnerEvaluationPartnerAvatarStatus(review)}
      className="vuexy-booking-person"
      copyClassName="vuexy-booking-person-copy"
      helper={review.providerProfile?.user?.phone ?? 'No phone on file'}
      href={partnerId ? `/partners/${partnerId}` : null}
      initials={adminPersonInitials(label)}
      label={label}
      linkClassName="vuexy-booking-person-link"
    />
  );
}

function reviewCustomerCell(review: AdminReview) {
  const customerId = reviewRecordCustomerId(review);
  const label = review.customerProfile?.user?.fullName ?? review.customerProfile?.user?.phone ?? 'Unknown customer';

  return (
    <AdminPersonCell
      avatarClassName="vuexy-booking-avatar"
      avatarStatus={reviewCustomerAvatarStatus(review)}
      className="vuexy-booking-person"
      copyClassName="vuexy-booking-person-copy"
      helper={review.customerProfile?.user?.phone ?? 'No phone on file'}
      href={customerId ? `/customers/${customerId}` : null}
      initials={adminPersonInitials(label)}
      label={label}
      linkClassName="vuexy-booking-person-link"
    />
  );
}

function partnerEvaluationCustomerCell(review: AdminPartnerCustomerReview) {
  const customerId = partnerEvaluationCustomerId(review);
  const label = review.customerProfile?.user?.fullName ?? review.customerProfile?.user?.phone ?? 'Unknown customer';

  return (
    <AdminPersonCell
      avatarClassName="vuexy-booking-avatar"
      avatarStatus={partnerEvaluationCustomerAvatarStatus(review)}
      className="vuexy-booking-person"
      copyClassName="vuexy-booking-person-copy"
      helper={review.customerProfile?.user?.phone ?? 'No phone on file'}
      href={customerId ? `/customers/${customerId}` : null}
      initials={adminPersonInitials(label)}
      label={label}
      linkClassName="vuexy-booking-person-link"
    />
  );
}

function reviewCustomerAvatarStatus(review: AdminReview): AdminAvatarStatus {
  const user = review.customerProfile?.user as ReviewAvatarUserSignal | undefined;

  return adminAvatarStatusFromSignals({
    devices: user?.pushDevices,
    sessions: user?.appSessions,
  });
}

function partnerEvaluationCustomerAvatarStatus(review: AdminPartnerCustomerReview): AdminAvatarStatus {
  const user = review.customerProfile?.user as ReviewAvatarUserSignal | undefined;

  return adminAvatarStatusFromSignals({
    devices: user?.pushDevices,
    sessions: user?.appSessions,
  });
}

function reviewPartnerAvatarStatus(review: AdminReview): AdminAvatarStatus {
  const provider = review.providerProfile as ReviewAvatarProviderSignal | undefined;

  return adminAvatarStatusFromSignals({
    devices: provider?.devices ?? provider?.user?.pushDevices,
    fallbackOnline: Boolean(provider?.status?.startsWith('ONLINE')),
    sessions: provider?.sessions ?? provider?.user?.appSessions,
  });
}

function partnerEvaluationPartnerAvatarStatus(review: AdminPartnerCustomerReview): AdminAvatarStatus {
  const provider = review.providerProfile as ReviewAvatarProviderSignal | undefined;

  return adminAvatarStatusFromSignals({
    devices: provider?.devices ?? provider?.user?.pushDevices,
    fallbackOnline: Boolean(provider?.status?.startsWith('ONLINE')),
    sessions: provider?.sessions ?? provider?.user?.appSessions,
  });
}

function reviewStatusLabel(status?: string | null) {
  if (status === 'PUBLISHED') {
    return 'Published';
  }
  if (status === 'REPORTED') {
    return 'Reported';
  }
  if (status === 'HIDDEN') {
    return 'Held';
  }
  return status ?? 'Unknown';
}

function reviewStatusClassName(status?: string | null) {
  if (status === 'PUBLISHED') {
    return 'review-status-chip review-status-published';
  }
  if (status === 'REPORTED') {
    return 'review-status-chip review-status-reported';
  }
  return 'review-status-chip review-status-held';
}

function reviewAppVisibilityLabel(status?: string | null) {
  if (status === 'PUBLISHED') {
    return 'Visible in customer app';
  }
  if (status === 'REPORTED') {
    return 'Needs admin follow-up';
  }
  if (status === 'HIDDEN') {
    return 'Hidden from customer app';
  }
  return 'Visibility not mapped';
}

function reviewRequestTimeValue(review: AdminReview) {
  return review.booking?.openedAt ?? review.booking?.createdAt ?? review.createdAt;
}

function partnerEvaluationRequestTimeValue(review: AdminPartnerCustomerReview) {
  return review.booking?.openedAt ?? review.booking?.createdAt ?? review.createdAt;
}

function reviewRecordMs(review: AdminReview) {
  return Date.parse(review.booking?.openedAt ?? review.booking?.createdAt ?? review.createdAt ?? '') || 0;
}

function partnerEvaluationRecordMs(review: AdminPartnerCustomerReview) {
  return Date.parse(review.booking?.openedAt ?? review.booking?.createdAt ?? review.createdAt ?? '') || 0;
}

function reviewRecordBookingId(review: AdminReview) {
  return review.booking?.id ?? review.bookingId ?? null;
}

function partnerEvaluationBookingId(review: AdminPartnerCustomerReview) {
  return review.booking?.id ?? review.bookingId ?? null;
}

function reviewRecordCustomerId(review: AdminReview) {
  return review.customerProfile?.id ?? review.customerProfileId ?? null;
}

function partnerEvaluationCustomerId(review: AdminPartnerCustomerReview) {
  return review.customerProfile?.id ?? review.customerProfileId ?? null;
}

function reviewRecordPartnerId(review: AdminReview) {
  return review.providerProfile?.id ?? review.providerProfileId ?? null;
}

function partnerEvaluationPartnerId(review: AdminPartnerCustomerReview) {
  return review.providerProfile?.id ?? review.providerProfileId ?? null;
}

function reviewServiceLabel(services?: NonNullable<AdminReview['booking']>['services']) {
  const labels = (services ?? [])
    .map((item) => item.service?.name)
    .filter((value): value is string => Boolean(value));

  return labels.length > 0 ? labels.join(', ') : 'No service snapshot';
}

function readReviewRecordPage(params: SearchParamRecord, key: string) {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const page = Number(value ?? 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function paginateReviewRecordRows<T>(rows: readonly T[], requestedPage: number) {
  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / REVIEW_RECORDS_DETAIL_PAGE_SIZE));
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  const start = (page - 1) * REVIEW_RECORDS_DETAIL_PAGE_SIZE;
  const pageRows = rows.slice(start, start + REVIEW_RECORDS_DETAIL_PAGE_SIZE);
  const from = totalRows === 0 ? 0 : start + 1;
  const to = Math.min(totalRows, start + pageRows.length);

  return {
    from,
    page,
    rows: pageRows,
    to,
    totalPages,
    totalRows,
  };
}

function reviewRecordAbsoluteIndex(from: number, index: number) {
  return Math.max(0, from - 1) + index;
}

function buildReviewRecordPageHref(
  basePath: string,
  params: SearchParamRecord,
  pageKey: string,
  page: number,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === pageKey || value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry) search.append(key, entry);
      }
      continue;
    }
    if (value) {
      search.set(key, value);
    }
  }
  if (page > 1) {
    search.set(pageKey, String(page));
  }
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}
