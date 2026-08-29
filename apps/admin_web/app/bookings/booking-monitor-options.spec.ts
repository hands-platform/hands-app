import {
  bookingMonitorPagePathForView,
  bookingEvidenceFilterOptions,
  bookingViewOptions,
  completedBookingViewOptions,
  postMatchCancellationBookingViewOptions,
  realtimeBookingViewOptions,
} from './booking-monitor-options';
import { bookingOperationsWorkspace } from './booking-monitor';
import type { BookingEvidenceFilter, BookingPageView } from './booking-page-params';

describe('booking monitor options', () => {
  it('lists every booking view once in navigation order', () => {
    const expectedViews = [
      'active',
      'attention',
      'data-anomaly',
      'matching',
      'in-service',
      'matching-delays',
      'first-pick',
      'marketplace',
      'customer-choice',
      'pre-match-cancelled',
      'preferred-rejected',
      'preferred-no-response',
      'usage-unresolved',
      'matched',
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
      'data-anomaly',
      'matching',
      'in-service',
      'matching-delays',
      'first-pick',
      'marketplace',
      'customer-choice',
      'pre-match-cancelled',
      'preferred-rejected',
      'preferred-no-response',
      'usage-unresolved',
      'matched',
      'handoff-repair',
      'no-supply',
      'blocked-create',
      'all',
    ]);
    expect(completedBookingViewOptions.map((option) => option.view)).toEqual([
      'payment',
      'cash-debt',
      'closeout',
      'pricing',
      'refund-review',
      'expired',
      'all',
    ]);
    expect(postMatchCancellationBookingViewOptions.map((option) => option.view)).toEqual([
      'manual-decision',
      'post-match-cancellations',
      'no-show',
    ]);
    expect(completedBookingViewOptions.map((option) => option.label)).toEqual([
      'All payment exceptions',
      'Cash commission',
      'Closeout records',
      'Pricing',
      'Refund mismatch',
      'Expired records',
      'Terminal records',
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

  it.each(completedBookingViewOptions)(
    'uses the existing $label description in the completed result panel',
    (option) => {
      expect(
        bookingOperationsWorkspace(
          option.view,
          option.label,
          option.description,
          '/bookings/completed',
          0,
        ),
      ).toMatchObject({
        description: option.description,
        title: option.label,
      });
    },
  );

  it('keeps blocked-create operator hint support-facing instead of debug-facing', () => {
    const blockedCreate = bookingViewOptions.find((option) => option.view === 'blocked-create');

    expect(blockedCreate?.operatorHint).toContain('Review optional GPS evidence');
    expect(blockedCreate?.operatorHint).not.toContain('debug');
  });

  it.each(['first-pick', 'marketplace', 'customer-choice', 'matched'] as const)(
    'uses the existing %s view description in the operations result panel',
    (view) => {
      const option = bookingViewOptions.find((candidate) => candidate.view === view);

      if (!option) throw new Error(`Missing booking view option: ${view}`);
      expect(
        bookingOperationsWorkspace(view, option.label, option.description, '/bookings', 0),
      ).toMatchObject({
        description: option.description,
        title: option.label,
      });
    },
  );

  it('does not describe Open matching as dispatch, arrival, or service work', () => {
    const option = bookingViewOptions.find((candidate) => candidate.view === 'marketplace');
    if (!option) throw new Error('Missing marketplace booking view option');
    const workspace = bookingOperationsWorkspace(
      option.view,
      option.label,
      option.description,
      '/bookings',
      0,
    );

    expect(workspace.description).toBe('Open matching bookings inside the original customer wait window.');
    expect(workspace.description).not.toMatch(/dispatch|arrival|service/i);
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
