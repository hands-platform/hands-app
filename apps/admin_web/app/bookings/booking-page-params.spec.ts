import {
  buildBookingListHref,
  readBookingDateRangeFilter,
  readBookingEvidenceFilter,
  readBookingGateFilter,
  readBookingView,
} from './booking-page-params';

describe('booking page search params', () => {
  it('normalizes booking views and legacy marketplace aliases', () => {
    expect(readBookingView('active')).toBe('active');
    expect(readBookingView('marketplace')).toBe('marketplace');
    expect(readBookingView('backup')).toBe('marketplace');
    expect(readBookingView('matching-delays')).toBe('matching-delays');
    expect(readBookingView('data-anomaly')).toBe('data-anomaly');
    expect(readBookingView('preferred-rejected')).toBe('preferred-rejected');
    expect(readBookingView('pre-match-cancelled')).toBe('pre-match-cancelled');
    expect(readBookingView(['chat-repair', 'all'])).toBe('chat-repair');
  });

  it('falls back to status-driven archived views before the live operations default', () => {
    expect(readBookingView('unknown', 'EXPIRED')).toBe('expired');
    expect(readBookingView(undefined, 'NO_SHOW')).toBe('no-show');
    expect(readBookingView('unknown', 'COMPLETED')).toBe('attention');
    expect(readBookingView(undefined)).toBe('attention');
    expect(readBookingView('')).toBe('attention');
    expect(readBookingView('not-a-real-view')).toBe('attention');
    expect(readBookingView(['post-match-cancellations', 'manual-decision'])).toBe(
      'post-match-cancellations',
    );
  });

  it('validates date ranges with a route-selected fallback and first array value', () => {
    expect(readBookingDateRangeFilter(undefined)).toBe('today');
    expect(readBookingDateRangeFilter('', '30d')).toBe('30d');
    expect(readBookingDateRangeFilter('not-a-range', '30d')).toBe('30d');
    expect(readBookingDateRangeFilter(['7d', 'today'], '30d')).toBe('7d');
    expect(readBookingDateRangeFilter(['not-a-range', '7d'], '30d')).toBe('30d');

    for (const dateRange of ['all', 'today', 'yesterday', '7d', '30d', 'custom'] as const) {
      expect(readBookingDateRangeFilter(dateRange, '30d')).toBe(dateRange);
    }
  });

  it('normalizes evidence and gate filters with safe defaults', () => {
    expect(readBookingEvidenceFilter('money')).toBe('money');
    expect(readBookingEvidenceFilter(['alerts', 'chat'])).toBe('alerts');
    expect(readBookingEvidenceFilter('unknown')).toBe('all');

    expect(readBookingGateFilter('service-area')).toBe('service-area');
    expect(readBookingGateFilter(['first-pick-distance', 'unknown'])).toBe('first-pick-distance');
    expect(readBookingGateFilter('payment')).toBe('all');
  });

  it('builds the bounded unresolved-usage target without unsupported parameters', () => {
    expect(buildBookingListHref({
      dateFrom: '2026-07-13',
      dateRange: 'custom',
      dateTo: '2026-07-19',
      sort: 'oldest',
      view: 'usage-unresolved',
    })).toBe(
      '/bookings?dateFrom=2026-07-13&dateRange=custom&dateTo=2026-07-19&sort=oldest&view=usage-unresolved',
    );
    expect(readBookingView('usage-unresolved')).toBe('usage-unresolved');
  });
});
