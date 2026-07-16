import {
  readBookingEvidenceFilter,
  readBookingGateFilter,
  readBookingView,
} from './booking-page-params';

describe('booking page search params', () => {
  it('normalizes booking views and legacy marketplace aliases', () => {
    expect(readBookingView('marketplace')).toBe('marketplace');
    expect(readBookingView('backup')).toBe('marketplace');
    expect(readBookingView(['chat-repair', 'all'])).toBe('chat-repair');
  });

  it('falls back to status-driven archived views before the live operations default', () => {
    expect(readBookingView('unknown', 'EXPIRED')).toBe('expired');
    expect(readBookingView(undefined, 'NO_SHOW')).toBe('no-show');
    expect(readBookingView('unknown', 'COMPLETED')).toBe('active');
    expect(readBookingView(undefined)).toBe('active');
  });

  it('normalizes evidence and gate filters with safe defaults', () => {
    expect(readBookingEvidenceFilter('money')).toBe('money');
    expect(readBookingEvidenceFilter(['alerts', 'chat'])).toBe('alerts');
    expect(readBookingEvidenceFilter('unknown')).toBe('all');

    expect(readBookingGateFilter('service-area')).toBe('service-area');
    expect(readBookingGateFilter(['first-pick-distance', 'unknown'])).toBe('first-pick-distance');
    expect(readBookingGateFilter('payment')).toBe('all');
  });
});
