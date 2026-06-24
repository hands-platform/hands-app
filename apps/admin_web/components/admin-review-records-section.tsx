import Link from 'next/link';
import { Star } from 'lucide-react';

import { AdminDataTable, AdminTableScroll } from './admin-data-table';
import { AdminFilterPanel } from './admin-filter-panel';
import { AdminPersonCell, adminPersonInitials } from './admin-person-cell';
import {
  adminAvatarStatusFromSignals,
  type AdminAvatarPushDeviceSignal,
  type AdminAvatarSessionSignal,
  type AdminAvatarStatus,
} from '../lib/admin-avatar-status';
import type { AdminPartnerCustomerReview, AdminReview } from '../lib/admin-api';
import { formatDateTime, shortId } from '../lib/admin-format';

const CUSTOMER_REVIEW_HEADERS = ['Booking', 'Request Time', 'Partner', 'Customer', 'Review'] as const;
const PARTNER_EVALUATION_HEADERS = ['Booking', 'Request Time', 'Partner', 'Customer', 'Evaluation'] as const;

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
  readonly customerReviews: readonly AdminReview[];
  readonly description?: string;
  readonly id: string;
  readonly partnerEvaluations: readonly AdminPartnerCustomerReview[];
  readonly title?: string;
};

export function AdminReviewRecordsSection({
  customerReviews,
  description = 'Customer-written reviews and Partner-written customer evaluations connected to this record.',
  id,
  partnerEvaluations,
  title = 'Review records',
}: AdminReviewRecordsSectionProps) {
  const customerRows = [...customerReviews].sort((left, right) => reviewRecordMs(right) - reviewRecordMs(left));
  const partnerRows = [...partnerEvaluations].sort(
    (left, right) => partnerEvaluationRecordMs(right) - partnerEvaluationRecordMs(left),
  );
  const totalRecords = customerRows.length + partnerRows.length;

  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-review-card"
      description={description}
      id={id}
      resultLabel={`${totalRecords} record(s)`}
      resultTone={totalRecords > 0 ? 'info' : 'neutral'}
      title={title}
    >
      <div className="admin-review-records-grid">
        <section aria-labelledby={`${id}-customer-reviews-title`} className="admin-review-records-block">
          <div className="ops-section-header admin-review-records-heading">
            <div>
              <h3 id={`${id}-customer-reviews-title`}>Customer reviews</h3>
              <p className="muted">Customer-facing review content. Moderation stays on the Reviews page.</p>
            </div>
            <span className="pill pill-neutral">{customerRows.length} review(s)</span>
          </div>
          <AdminTableScroll>
            <AdminDataTable
              className="vuexy-booking-table vuexy-review-table"
              emptyMessage="No customer review connected to this record."
              headers={CUSTOMER_REVIEW_HEADERS}
              rowCount={customerRows.length}
            >
              {customerRows.map((review) => (
                <tr key={review.id}>
                  <td>{reviewBookingLink(review)}</td>
                  <td>
                    <span className="muted">{reviewRequestTimeLabel(review)}</span>
                    <div className="muted">Reviewed {formatDateTime(review.createdAt, 'No reviewed date')}</div>
                  </td>
                  <td>{reviewPartnerCell(review)}</td>
                  <td>{reviewCustomerCell(review)}</td>
                  <td className="vuexy-review-copy-cell">
                    <div className="admin-review-rating-line" aria-label={`${review.rating} out of 5`}>
                      {Array.from({ length: 5 }, (_, index) => (
                        <Star
                          aria-hidden="true"
                          className={index < review.rating ? 'is-filled' : undefined}
                          key={`${review.id}-star-${index}`}
                          size={14}
                        />
                      ))}
                      <strong>{review.rating}/5</strong>
                      <span className={reviewStatusClassName(review.status)}>{reviewStatusLabel(review.status)}</span>
                    </div>
                    <p>{review.comment?.trim() || 'No written review'}</p>
                    <span>{reviewServiceLabel(review.booking?.services)}</span>
                  </td>
                </tr>
              ))}
            </AdminDataTable>
          </AdminTableScroll>
        </section>

        <section aria-labelledby={`${id}-partner-evaluations-title`} className="admin-review-records-block">
          <div className="ops-section-header admin-review-records-heading">
            <div>
              <h3 id={`${id}-partner-evaluations-title`}>Partner evaluations</h3>
              <p className="muted">Read-only internal records. These do not publish to the customer app.</p>
            </div>
            <span className="pill pill-neutral">{partnerRows.length} evaluation(s)</span>
          </div>
          <AdminTableScroll>
            <AdminDataTable
              className="vuexy-booking-table vuexy-review-table vuexy-partner-evaluation-table"
              emptyMessage="No Partner evaluation connected to this record."
              headers={PARTNER_EVALUATION_HEADERS}
              rowCount={partnerRows.length}
            >
              {partnerRows.map((review) => (
                <tr key={review.id}>
                  <td>{partnerEvaluationBookingLink(review)}</td>
                  <td>
                    <span className="muted">{partnerEvaluationRequestTimeLabel(review)}</span>
                    <div className="muted">Logged {formatDateTime(review.createdAt, 'No logged date')}</div>
                  </td>
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
        </section>
      </div>
    </AdminFilterPanel>
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

function reviewBookingLink(review: AdminReview) {
  const bookingId = reviewRecordBookingId(review);
  if (!bookingId) {
    return <span className="muted">No booking link</span>;
  }

  return (
    <Link className="text-link" href={`/bookings/${bookingId}`}>
      {shortId(bookingId)}
    </Link>
  );
}

function partnerEvaluationBookingLink(review: AdminPartnerCustomerReview) {
  const bookingId = partnerEvaluationBookingId(review);
  if (!bookingId) {
    return <span className="muted">No booking link</span>;
  }

  return (
    <Link className="text-link" href={`/bookings/${bookingId}`}>
      {shortId(bookingId)}
    </Link>
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

function reviewRequestTimeLabel(review: AdminReview) {
  return formatDateTime(review.booking?.openedAt ?? review.booking?.createdAt ?? review.createdAt, 'No request time');
}

function partnerEvaluationRequestTimeLabel(review: AdminPartnerCustomerReview) {
  return formatDateTime(review.booking?.openedAt ?? review.booking?.createdAt ?? review.createdAt, 'No request time');
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
