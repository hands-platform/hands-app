import { Eye, Star } from 'lucide-react';

import { AdminDataTable, AdminTablePaginationFooter, AdminTableScroll } from './admin-data-table';
import { AdminInlineFallback } from './admin-inline-fallback';
import { AdminSectionHeader } from './admin-page-template';
import { AdminPersonCell, adminPersonInitials } from './admin-person-cell';
import { AdminSurfaceBlock } from './admin-surface';
import { AdminTablePanel } from './admin-table-panel';
import { AdminTextLink } from './admin-text-link';
import { DateTimeText } from './date-time-text';
import { StatusBadge, type StatusBadgeTone } from './status-badge';
import {
  adminAvatarStatusFromSignals,
  type AdminAvatarPushDeviceSignal,
  type AdminAvatarSessionSignal,
  type AdminAvatarStatus,
} from '../lib/admin-avatar-status';
import type { AdminPartnerCustomerReview, AdminReview } from '../lib/admin-api';
import { shortId } from '../lib/admin-format';

const CUSTOMER_REVIEW_HEADERS = ['Request Time', 'Partner', 'Customer', 'Review', 'Visibility'] as const;
const PARTNER_EVALUATION_HEADERS = [
  'Submitted',
  'Partner',
  'Customer',
  'Partner note',
  'Note state',
] as const;
const CUSTOMER_REVIEW_HEADERS_WITHOUT_CUSTOMER = ['Request Time', 'Partner', 'Review', 'Visibility'] as const;
const PARTNER_EVALUATION_HEADERS_WITHOUT_CUSTOMER = [
  'Submitted',
  'Partner',
  'Partner note',
  'Note state',
] as const;
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
  readonly hideCustomerColumn?: boolean;
  readonly id: string;
  readonly partnerEvaluations: readonly AdminPartnerCustomerReview[];
  readonly searchParams?: SearchParamRecord;
  readonly separatePanels?: boolean;
  readonly title?: string;
};

export function AdminReviewRecordsSection({
  basePath,
  customerReviews,
  description = 'Customer-written reviews and Partner-written customer notes connected to this record.',
  hideCustomerColumn = false,
  id,
  partnerEvaluations,
  searchParams = {},
  separatePanels = false,
  title = 'Review records',
}: AdminReviewRecordsSectionProps) {
  const customerRows = [...customerReviews].sort(
    (left, right) => reviewRecordMs(right) - reviewRecordMs(left),
  );
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
  const customerBlock = (
    <CustomerReviewRecordsBlock
      basePath={basePath}
      hideCustomerColumn={hideCustomerColumn}
      id={id}
      pagination={customerPagination}
      rows={customerRows}
      searchParams={searchParams}
      standalone={separatePanels}
    />
  );
  const partnerBlock = (
    <PartnerEvaluationRecordsBlock
      basePath={basePath}
      hideCustomerColumn={hideCustomerColumn}
      id={id}
      pagination={partnerPagination}
      rows={partnerRows}
      searchParams={searchParams}
      standalone={separatePanels}
    />
  );

  if (separatePanels) {
    return (
      <div className="admin-review-records-grid admin-review-records-panel-stack" id={id}>
        {customerBlock}
        {partnerBlock}
      </div>
    );
  }

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
        {customerBlock}
        {partnerBlock}
      </div>
    </AdminTablePanel>
  );
}

function CustomerReviewRecordsBlock({
  basePath,
  hideCustomerColumn,
  id,
  pagination,
  rows,
  searchParams,
  standalone,
}: {
  readonly basePath?: string;
  readonly hideCustomerColumn: boolean;
  readonly id: string;
  readonly pagination: ReturnType<typeof paginateReviewRecordRows<AdminReview>>;
  readonly rows: readonly AdminReview[];
  readonly searchParams: SearchParamRecord;
  readonly standalone: boolean;
}) {
  const content = (
    <>
      {!standalone ? (
        <AdminSectionHeader
          className="admin-review-records-heading"
          description="Customer-facing review content. Moderation stays on the Reviews page."
          status={<StatusBadge tone="neutral">{rows.length} review(s)</StatusBadge>}
          title="Customer reviews"
          titleId={`${id}-customer-reviews-title`}
        />
      ) : null}
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table vuexy-review-table"
          emptyMessage="No customer review connected to this record."
          headers={hideCustomerColumn ? CUSTOMER_REVIEW_HEADERS_WITHOUT_CUSTOMER : CUSTOMER_REVIEW_HEADERS}
          rowCount={pagination.rows.length}
        >
          {pagination.rows.map((review, index) => (
            <tr key={reviewRecordRowKey(review, reviewRecordAbsoluteIndex(pagination.from, index))}>
              <td>{reviewRequestCell(review)}</td>
              <td>{reviewPartnerCell(review)}</td>
              {!hideCustomerColumn ? <td>{reviewCustomerCell(review)}</td> : null}
              <td className="vuexy-review-copy-cell">
                <div aria-label={`${review.rating} out of 5`} className="vuexy-review-stars">
                  {Array.from({ length: 5 }, (_, starIndex) => (
                    <Star
                      aria-hidden="true"
                      className={starIndex < review.rating ? 'is-filled' : undefined}
                      key={`${review.id}-star-${starIndex}`}
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
        activePage={pagination.page}
        ariaLabel="Customer review record pages"
        basePath={basePath}
        pageKey="customerReviewPage"
        searchParams={searchParams}
        totalPages={pagination.totalPages}
        totalRows={pagination.totalRows}
        visibleFrom={pagination.from}
        visibleTo={pagination.to}
      />
    </>
  );

  return standalone ? (
    <AdminTablePanel
      className="vuexy-review-card"
      description="Customer-facing review content. Moderation stays on the Reviews page."
      id={`${id}-customer-reviews`}
      resultLabel={`${rows.length} review(s)`}
      resultTone={rows.length > 0 ? 'info' : 'neutral'}
      title="Customer reviews"
    >
      {content}
    </AdminTablePanel>
  ) : (
    <AdminSurfaceBlock ariaLabelledBy={`${id}-customer-reviews-title`} className="admin-review-records-block">
      {content}
    </AdminSurfaceBlock>
  );
}

function PartnerEvaluationRecordsBlock({
  basePath,
  hideCustomerColumn,
  id,
  pagination,
  rows,
  searchParams,
  standalone,
}: {
  readonly basePath?: string;
  readonly hideCustomerColumn: boolean;
  readonly id: string;
  readonly pagination: ReturnType<typeof paginateReviewRecordRows<AdminPartnerCustomerReview>>;
  readonly rows: readonly AdminPartnerCustomerReview[];
  readonly searchParams: SearchParamRecord;
  readonly standalone: boolean;
}) {
  const content = (
    <>
      {!standalone ? (
        <AdminSectionHeader
          className="admin-review-records-heading"
          description="Read-only internal records. These do not publish to the customer app."
          status={<StatusBadge tone="neutral">{naturalRecordCount(rows.length, 'note')}</StatusBadge>}
          title="Partner notes"
          titleId={`${id}-partner-evaluations-title`}
        />
      ) : null}
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table vuexy-review-table vuexy-partner-evaluation-table"
          emptyMessage="No Partner note connected to this record."
          headers={
            hideCustomerColumn ? PARTNER_EVALUATION_HEADERS_WITHOUT_CUSTOMER : PARTNER_EVALUATION_HEADERS
          }
          rowCount={pagination.rows.length}
        >
          {pagination.rows.map((review, index) => (
            <tr
              key={partnerEvaluationRecordRowKey(review, reviewRecordAbsoluteIndex(pagination.from, index))}
            >
              <td>{partnerEvaluationRequestCell(review)}</td>
              <td>{partnerEvaluationPartnerCell(review)}</td>
              {!hideCustomerColumn ? <td>{partnerEvaluationCustomerCell(review)}</td> : null}
              <td className="vuexy-review-copy-cell">
                <p>{review.comment?.trim() || 'No written note'}</p>
                <span>{reviewServiceLabel(review.booking?.services)}</span>
              </td>
              <td className="vuexy-review-visibility-cell">{partnerNoteStateCell(review)}</td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <ReviewRecordsPaginationFooter
        activePage={pagination.page}
        ariaLabel="Partner note record pages"
        basePath={basePath}
        pageKey="partnerEvaluationPage"
        searchParams={searchParams}
        totalPages={pagination.totalPages}
        totalRows={pagination.totalRows}
        visibleFrom={pagination.from}
        visibleTo={pagination.to}
      />
    </>
  );

  return standalone ? (
    <AdminTablePanel
      className="vuexy-review-card"
      description="Read-only internal records. These do not publish to the customer app."
      id={`${id}-partner-evaluations`}
      resultLabel={naturalRecordCount(rows.length, 'note')}
      resultTone={rows.length > 0 ? 'info' : 'neutral'}
      title="Partner notes"
    >
      {content}
    </AdminTablePanel>
  ) : (
    <AdminSurfaceBlock
      ariaLabelledBy={`${id}-partner-evaluations-title`}
      className="admin-review-records-block"
    >
      {content}
    </AdminSurfaceBlock>
  );
}

export function reviewRecordsForBooking(
  customerReviews: readonly AdminReview[],
  partnerEvaluations: readonly AdminPartnerCustomerReview[],
  bookingId: string,
) {
  return {
    customerReviews: customerReviews.filter((review) => reviewRecordBookingId(review) === bookingId),
    partnerEvaluations: partnerEvaluations.filter(
      (review) => partnerEvaluationBookingId(review) === bookingId,
    ),
  };
}

export function reviewRecordsForCustomer(
  customerReviews: readonly AdminReview[],
  partnerEvaluations: readonly AdminPartnerCustomerReview[],
  customerProfileId: string,
) {
  return {
    customerReviews: customerReviews.filter((review) => reviewRecordCustomerId(review) === customerProfileId),
    partnerEvaluations: partnerEvaluations.filter(
      (review) => partnerEvaluationCustomerId(review) === customerProfileId,
    ),
  };
}

export function reviewRecordsForPartner(
  customerReviews: readonly AdminReview[],
  partnerEvaluations: readonly AdminPartnerCustomerReview[],
  providerProfileId: string,
) {
  return {
    customerReviews: customerReviews.filter((review) => reviewRecordPartnerId(review) === providerProfileId),
    partnerEvaluations: partnerEvaluations.filter(
      (review) => partnerEvaluationPartnerId(review) === providerProfileId,
    ),
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
          <AdminTextLink href={`/bookings/${bookingId}`} title="Open booking detail">
            <Eye aria-hidden="true" size={14} />
            {shortId(bookingId)}
          </AdminTextLink>
        ) : (
          <AdminInlineFallback>No booking link</AdminInlineFallback>
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
          <AdminTextLink href={`/bookings/${bookingId}`} title="Open booking detail">
            <Eye aria-hidden="true" size={14} />
            {shortId(bookingId)}
          </AdminTextLink>
        ) : (
          <AdminInlineFallback>No booking link</AdminInlineFallback>
        )}
      </div>
      <div className="muted">
        <DateTimeText fallback="No request time" value={partnerEvaluationRequestTimeValue(review)} />
      </div>
      <div className="muted vuexy-review-submitted-line">
        Note submitted <DateTimeText fallback="No logged date" value={review.createdAt} />
      </div>
    </>
  );
}

function reviewVisibilityCell(review: AdminReview) {
  return (
    <>
      <StatusBadge tone={reviewStatusTone(review.status)}>{reviewStatusLabel(review.status)}</StatusBadge>
      <small>{reviewAppVisibilityLabel(review.status)}</small>
      <small>{review.createdByAdminId ? 'Admin entered' : 'Customer submitted'}</small>
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
      hrefForPage={
        basePath ? (page) => buildReviewRecordPageHref(basePath, searchParams, pageKey, page) : undefined
      }
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
  const label =
    review.providerProfile?.displayName ?? review.providerProfile?.user?.fullName ?? 'Unknown Partner';

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
  const label = review.providerProfile?.displayName ?? 'Unknown Partner';

  return partnerId ? <AdminTextLink href={`/partners/${partnerId}`}>{label}</AdminTextLink> : label;
}

function reviewCustomerCell(review: AdminReview) {
  const customerId = reviewRecordCustomerId(review);
  const label =
    review.customerProfile?.user?.fullName ?? review.customerProfile?.user?.phone ?? 'Unknown customer';

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
  const label = review.customerProfile?.user?.fullName ?? 'Unknown customer';

  return customerId ? <AdminTextLink href={`/customers/${customerId}`}>{label}</AdminTextLink> : label;
}

function reviewCustomerAvatarStatus(review: AdminReview): AdminAvatarStatus {
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

function reviewStatusTone(status?: string | null): StatusBadgeTone {
  if (status === 'PUBLISHED') {
    return 'success';
  }
  if (status === 'REPORTED') {
    return 'danger';
  }
  if (status === 'HIDDEN') {
    return 'warning';
  }
  return 'neutral';
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
  return Date.parse(review.createdAt ?? '') || 0;
}

function partnerNoteStateCell(review: AdminPartnerCustomerReview) {
  const status = review.status ?? 'PUBLISHED';
  const reason = review.reportReason?.trim() || review.latestModeration?.reason?.trim();

  return (
    <>
      <StatusBadge tone={partnerNoteStateTone(status)}>{partnerNoteStateLabel(status)}</StatusBadge>
      {reason ? <small>Reason: {reason}</small> : null}
      {status === 'HIDDEN' ? <small>Restricted from normal admin workflows.</small> : null}
      {review.latestModeration?.createdAt ? (
        <small>
          Reviewed <DateTimeText value={review.latestModeration.createdAt} />
          {review.latestModeration.actor?.fullName || review.latestModeration.actor?.email
            ? ` · ${review.latestModeration.actor.fullName ?? review.latestModeration.actor.email}`
            : null}
        </small>
      ) : (
        <small>Not manually reviewed</small>
      )}
      <AdminTextLink
        href={`/reviews/partner-customer-evaluations?q=${encodeURIComponent(review.id)}#partner-note-${review.id}`}
      >
        Open note record
      </AdminTextLink>
    </>
  );
}

function partnerNoteStateLabel(status: string) {
  if (status === 'REPORTED') return 'Needs review';
  if (status === 'HIDDEN') return 'Restricted';
  if (status === 'PUBLISHED') return 'Retained';
  return 'Unknown';
}

function partnerNoteStateTone(status: string): StatusBadgeTone {
  if (status === 'REPORTED') return 'warning';
  if (status === 'HIDDEN') return 'danger';
  if (status === 'PUBLISHED') return 'neutral';
  return 'neutral';
}

function naturalRecordCount(value: number, noun: string) {
  return `${value} ${value === 1 ? noun : `${noun}s`}`;
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
