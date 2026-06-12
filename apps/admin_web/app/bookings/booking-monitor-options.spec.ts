import {
  bookingEvidenceFilterOptions,
  bookingViewOptions,
} from './booking-monitor-options';
import type { BookingEvidenceFilter, BookingPageView } from './booking-page-params';

describe('booking monitor options', () => {
  it('lists every booking view once in navigation order', () => {
    const expectedViews = [
      'active',
      'attention',
      'matching',
      'first-pick',
      'marketplace',
      'customer-choice',
      'handoff-repair',
      'no-supply',
      'blocked-create',
      'address',
      'manual-decision',
      'payment',
      'cash-debt',
      'closeout',
      'pricing',
      'location',
      'chat',
      'chat-repair',
      'chat-evidence',
      'evidence-missing',
      'refund-review',
      'expired',
      'no-show',
      'all',
    ] satisfies readonly BookingPageView[];

    const optionViews = bookingViewOptions.map((option) => option.view);

    expect(optionViews).toEqual(expectedViews);
    expect(new Set(optionViews).size).toBe(optionViews.length);
  });

  it('lists every evidence filter once', () => {
    const expectedFilters = [
      'all',
      'address',
      'partner',
      'chat',
      'money',
      'location',
      'alerts',
      'closeout',
    ] satisfies readonly BookingEvidenceFilter[];

    const optionFilters = bookingEvidenceFilterOptions.map((option) => option.value);

    expect(optionFilters).toEqual(expectedFilters);
    expect(new Set(optionFilters).size).toBe(optionFilters.length);
  });
});
