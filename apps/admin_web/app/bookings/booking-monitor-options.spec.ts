import {
  bookingMonitorPagePathForView,
  bookingEvidenceFilterOptions,
  bookingViewOptions,
  completedBookingViewOptions,
  postMatchCancellationBookingViewOptions,
  realtimeBookingViewOptions,
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
      'post-match-cancellations',
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

  it('splits booking view options by route workspace', () => {
    expect(realtimeBookingViewOptions.map((option) => option.view)).toEqual([
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
      'location',
      'chat',
      'chat-repair',
      'all',
    ]);
    expect(completedBookingViewOptions.map((option) => option.view)).toEqual([
      'payment',
      'cash-debt',
      'closeout',
      'pricing',
      'refund-review',
      'expired',
    ]);
    expect(postMatchCancellationBookingViewOptions.map((option) => option.view)).toEqual([
      'manual-decision',
      'chat-evidence',
      'evidence-missing',
      'post-match-cancellations',
      'no-show',
    ]);
  });

  it('routes completed and post-match cancellation views to dedicated pages', () => {
    expect(bookingMonitorPagePathForView('active')).toBe('/bookings');
    expect(bookingMonitorPagePathForView('closeout')).toBe('/bookings/completed');
    expect(bookingMonitorPagePathForView('refund-review')).toBe('/bookings/completed');
    expect(bookingMonitorPagePathForView('post-match-cancellations')).toBe(
      '/bookings/post-match-cancellations',
    );
    expect(bookingMonitorPagePathForView('no-show')).toBe('/bookings/post-match-cancellations');
  });

  it('keeps blocked-create operator hint support-facing instead of debug-facing', () => {
    const blockedCreate = bookingViewOptions.find((option) => option.view === 'blocked-create');

    expect(blockedCreate?.operatorHint).toContain('Review optional GPS evidence');
    expect(blockedCreate?.operatorHint).not.toContain('debug');
  });

  it('keeps address view copy operator-facing instead of snapshot-facing', () => {
    const addressView = bookingViewOptions.find((option) => option.view === 'address');
    const evidenceAddressFilter = bookingEvidenceFilterOptions.find((option) => option.value === 'address');

    expect(evidenceAddressFilter?.label).toBe('Address check');
    expect(addressView?.description).toContain('confirmed customer service address');
    expect(addressView?.operatorHint).toContain('A confirmed service address protects');
    expect(addressView?.description).not.toContain('snapshot');
    expect(addressView?.operatorHint).not.toContain('snapshot');
  });

  it('uses retained chat wording in evidence filters instead of archive wording', () => {
    const evidenceChatFilter = bookingEvidenceFilterOptions.find((option) => option.value === 'chat');

    expect(evidenceChatFilter?.label).toBe('Chat record check');
    expect(evidenceChatFilter?.label).not.toContain('archive');
  });
});
