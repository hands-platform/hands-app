import {
  bookingMonitorDetailHrefSuffix,
  bookingMonitorSummaryView,
} from './booking-monitor-operation-links';

describe('booking monitor operation links', () => {
  it.each([
    ['Needs action', 'attention'],
    ['Live bookings', 'active'],
    ['Matching now', 'matching'],
    ['Service in progress', 'in-service'],
    ['Blocked today', 'blocked-create'],
    ['Payment checks', 'payment'],
    ['Cash debt', 'cash-debt'],
    ['Closeout checks', 'closeout'],
    ['Data anomaly', 'data-anomaly'],
    ['Pricing checks', 'pricing'],
    ['Refund review', 'refund-review'],
    ['Expired', 'expired'],
    ['Needs admin review', 'manual-decision'],
    ['No-show', 'no-show'],
  ] as const)('maps %s to its exact queue', (label, view) => {
    expect(bookingMonitorSummaryView(label)).toBe(view);
  });

  it.each(['Auto-approved', 'Fee held', 'Fee restored'])(
    'does not link %s to a broader queue',
    (label) => {
      expect(bookingMonitorSummaryView(label)).toBeNull();
    },
  );

  it('targets the operator decision section for live queues', () => {
    expect(bookingMonitorDetailHrefSuffix('/bookings', 'attention')).toBe(
      '#booking-command-decision-strip',
    );
  });

  it('targets the matching action section for each completed and cancellation queue', () => {
    expect(bookingMonitorDetailHrefSuffix('/bookings/completed', 'payment')).toBe(
      '?overview=activity#booking-finance-system-detail',
    );
    expect(bookingMonitorDetailHrefSuffix('/bookings/completed', 'closeout')).toBe(
      '#booking-outcome-review',
    );
    expect(bookingMonitorDetailHrefSuffix('/bookings/completed', 'expired')).toBe(
      '#booking-unified-detail',
    );
    expect(
      bookingMonitorDetailHrefSuffix(
        '/bookings/post-match-cancellations',
        'manual-decision',
        'CANCELLED',
      ),
    ).toBe('#booking-post-match-cancellation-decision');
    expect(
      bookingMonitorDetailHrefSuffix(
        '/bookings/post-match-cancellations',
        'post-match-cancellations',
        'NO_SHOW',
      ),
    ).toBe('#booking-outcome-review');
  });
});
