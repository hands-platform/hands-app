import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  AdminReviewRecordsSection,
  partnerEvaluationRecordRowKey,
  reviewRecordRowKey,
  reviewRecordsForBooking,
  reviewRecordsForCustomer,
  reviewRecordsForPartner,
} from './admin-review-records-section';
import type { AdminPartnerCustomerReview, AdminReview } from '../lib/admin-api';

const customerReview: AdminReview = {
  id: 'review_1',
  bookingId: 'booking_1',
  rating: 4,
  comment: 'Great service.',
  status: 'PUBLISHED',
  createdAt: '2026-06-13T03:02:00.000Z',
  customerProfileId: 'customer_1',
  providerProfileId: 'partner_1',
  customerProfile: {
    id: 'customer_1',
    user: {
      fullName: 'Demo Customer',
      phone: '+84810000001',
    },
  },
  providerProfile: {
    id: 'partner_1',
    displayName: 'Smoke Partner',
    user: {
      phone: '+84810000002',
    },
  },
  booking: {
    id: 'booking_1',
    openedAt: '2026-06-13T03:00:00.000Z',
    services: [{ service: { name: 'Aroma', durationMin: 60 } }],
  },
};

const partnerEvaluation: AdminPartnerCustomerReview = {
  id: 'evaluation_1',
  bookingId: 'booking_1',
  comment: 'Customer was ready at the service address.',
  status: 'INTERNAL',
  createdAt: '2026-06-13T04:02:00.000Z',
  customerProfileId: 'customer_1',
  providerProfileId: 'partner_1',
  customerProfile: {
    id: 'customer_1',
    user: {
      fullName: 'Demo Customer',
      phone: '+84810000001',
    },
  },
  providerProfile: {
    id: 'partner_1',
    displayName: 'Smoke Partner',
    user: {
      phone: '+84810000002',
    },
  },
  booking: {
    id: 'booking_1',
    openedAt: '2026-06-13T03:00:00.000Z',
    services: [{ service: { name: 'Aroma', durationMin: 60 } }],
  },
};

function customerReviewAt(index: number): AdminReview {
  return {
    ...customerReview,
    booking: {
      ...customerReview.booking,
      id: `booking_${index}`,
    },
    bookingId: `booking_${index}`,
    createdAt: `2026-06-13T03:${String(index).padStart(2, '0')}:00.000Z`,
    id: `review_${index}`,
  };
}

function partnerEvaluationAt(index: number): AdminPartnerCustomerReview {
  return {
    ...partnerEvaluation,
    booking: {
      ...partnerEvaluation.booking,
      id: `booking_${index}`,
    },
    bookingId: `booking_${index}`,
    createdAt: `2026-06-13T04:${String(index).padStart(2, '0')}:00.000Z`,
    id: `evaluation_${index}`,
  };
}

describe('AdminReviewRecordsSection', () => {
  it('renders customer reviews and Partner evaluations together', () => {
    const markup = renderToStaticMarkup(
      <AdminReviewRecordsSection
        customerReviews={[customerReview]}
        id="test-review-records"
        partnerEvaluations={[partnerEvaluation]}
      />,
    );

    expect(markup).toContain('Customer reviews');
    expect(markup).toContain('Partner evaluations');
    expect(markup).toContain('Review submitted');
    expect(markup).toContain('Evaluation submitted');
    expect(markup).toContain('Great service.');
    expect(markup).toContain('Customer was ready at the service address.');
    expect(markup).toContain('href="/bookings/booking_1"');
    expect(markup).toContain('href="/customers/customer_1"');
    expect(markup).toContain('href="/partners/partner_1"');
    expect(markup).toContain(
      'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-review-card',
    );
  });

  it('keeps Partner evaluations read-only without moderation controls', () => {
    const markup = renderToStaticMarkup(
      <AdminReviewRecordsSection
        customerReviews={[]}
        id="test-partner-evaluations"
        partnerEvaluations={[partnerEvaluation]}
      />,
    );

    expect(markup).toContain('Read-only internal records');
    expect(markup).not.toContain('Actions');
    expect(markup).not.toContain('Publish');
    expect(markup).not.toContain('Hold');
    expect(markup).not.toContain('Hide');
  });

  it('paginates customer reviews and Partner evaluations independently', () => {
    const markup = renderToStaticMarkup(
      <AdminReviewRecordsSection
        basePath="/customers/customer_1"
        customerReviews={Array.from({ length: 6 }, (_, index) => customerReviewAt(index + 1))}
        id="test-review-record-pagination"
        partnerEvaluations={Array.from({ length: 6 }, (_, index) => partnerEvaluationAt(index + 1))}
        searchParams={{
          customerReviewPage: '2',
          partnerEvaluationPage: '2',
          section: 'full',
        }}
      />,
    );

    expect(markup).toContain('Showing 6 to 6 of 6 entries');
    expect(markup).toContain('customerReviewPage=2');
    expect(markup).toContain('partnerEvaluationPage=2');
  });

  it('builds unique row keys when upstream smoke data repeats record ids', () => {
    const duplicateCustomerReview = {
      ...customerReview,
      booking: {
        ...customerReview.booking,
        id: 'booking_2',
      },
      bookingId: 'booking_2',
      createdAt: '2026-06-13T03:03:00.000Z',
    };
    const duplicatePartnerEvaluation = {
      ...partnerEvaluation,
      booking: {
        ...partnerEvaluation.booking,
        id: 'booking_2',
      },
      bookingId: 'booking_2',
      createdAt: '2026-06-13T04:03:00.000Z',
    };

    expect(
      new Set([
        reviewRecordRowKey(customerReview, 0),
        reviewRecordRowKey(duplicateCustomerReview, 1),
      ]).size,
    ).toBe(2);
    expect(
      new Set([
        partnerEvaluationRecordRowKey(partnerEvaluation, 0),
        partnerEvaluationRecordRowKey(duplicatePartnerEvaluation, 1),
      ]).size,
    ).toBe(2);
  });

  it('filters review records for booking, customer, and Partner detail pages', () => {
    const otherCustomerReview = {
      ...customerReview,
      booking: {
        ...customerReview.booking,
        id: 'booking_2',
      },
      customerProfile: {
        ...customerReview.customerProfile,
        id: 'customer_2',
      },
      id: 'review_2',
      bookingId: 'booking_2',
      customerProfileId: 'customer_2',
      providerProfile: {
        ...customerReview.providerProfile,
        id: 'partner_2',
      },
      providerProfileId: 'partner_2',
    };
    const otherPartnerEvaluation = {
      ...partnerEvaluation,
      booking: {
        ...partnerEvaluation.booking,
        id: 'booking_2',
      },
      customerProfile: {
        ...partnerEvaluation.customerProfile,
        id: 'customer_2',
      },
      id: 'evaluation_2',
      bookingId: 'booking_2',
      customerProfileId: 'customer_2',
      providerProfile: {
        ...partnerEvaluation.providerProfile,
        id: 'partner_2',
      },
      providerProfileId: 'partner_2',
    };

    expect(reviewRecordsForBooking([customerReview, otherCustomerReview], [partnerEvaluation], 'booking_1')).toEqual({
      customerReviews: [customerReview],
      partnerEvaluations: [partnerEvaluation],
    });
    expect(reviewRecordsForCustomer([customerReview], [partnerEvaluation, otherPartnerEvaluation], 'customer_1')).toEqual({
      customerReviews: [customerReview],
      partnerEvaluations: [partnerEvaluation],
    });
    expect(reviewRecordsForPartner([customerReview], [partnerEvaluation, otherPartnerEvaluation], 'partner_1')).toEqual({
      customerReviews: [customerReview],
      partnerEvaluations: [partnerEvaluation],
    });
  });

  it('uses shared badge atoms for review and evaluation counters', () => {
    const source = readFileSync(join(process.cwd(), 'components/admin-review-records-section.tsx'), 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('AdminSectionHeader');
    expect(source).toContain('AdminTablePanel');
    expect(source).not.toContain(
      'className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-review-card"',
    );
    expect(source).not.toContain('<span className="pill pill-neutral">{customerRows.length} review(s)</span>');
    expect(source).not.toContain('<span className="pill pill-neutral">{partnerRows.length} evaluation(s)</span>');
    expect(source).not.toContain('<div className="ops-section-header admin-review-records-heading">');
  });

  it('uses the shared table pagination footer while preserving review classes', () => {
    const source = readFileSync(join(process.cwd(), 'components/admin-review-records-section.tsx'), 'utf8');

    expect(source).toContain('AdminTablePaginationFooter');
    expect(source).toContain('className="vuexy-review-footer"');
    expect(source).toContain('paginationClassName="vuexy-review-pagination"');
    expect(source).toContain('pageLinkClassName="vuexy-review-page-link"');
    expect(source).not.toContain('<AdminTableFooter');
    expect(source).not.toContain('Showing {visibleFrom} to {visibleTo} of {totalRows} entries');
  });

  it('uses the shared DateTimeText atom for visible review timestamps', () => {
    const source = readFileSync(join(process.cwd(), 'components/admin-review-records-section.tsx'), 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).not.toContain("Review submitted {formatDateTime(review.createdAt, 'No reviewed date')}");
    expect(source).not.toContain("Evaluation submitted {formatDateTime(review.createdAt, 'No logged date')}");
  });
});
