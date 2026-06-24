import { renderToStaticMarkup } from 'react-dom/server';

import {
  AdminReviewRecordsSection,
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
    expect(markup).toContain('Great service.');
    expect(markup).toContain('Customer was ready at the service address.');
    expect(markup).toContain('href="/bookings/booking_1"');
    expect(markup).toContain('href="/customers/customer_1"');
    expect(markup).toContain('href="/partners/partner_1"');
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
    expect(markup).not.toContain('Visibility');
    expect(markup).not.toContain('Publish');
    expect(markup).not.toContain('Hold');
    expect(markup).not.toContain('Hide');
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
});
