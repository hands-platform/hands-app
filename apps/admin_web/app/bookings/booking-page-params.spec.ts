import {
  buildBookingListHref,
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
