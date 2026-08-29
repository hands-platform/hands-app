import { emptyBookingMessage } from './booking-empty-message';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

describe('booking empty messages', () => {
  it('returns queue-specific empty-state copy', () => {
    expect(emptyBookingMessage('active')).toBe(
      'No active bookings match this queue. Dispatch is clear right now.',
    );
    expect(emptyBookingMessage('blocked-create')).toBe(
      'Blocked booking create attempts are listed above. No booking row exists because payment and matching did not start.',
    );
    expect(emptyBookingMessage('customer-choice')).toBe(
      'No customer is waiting to choose from participating Partners.',
    );
    expect(emptyBookingMessage('attention')).toBe(
      'No bookings need action right now. Matching delays, expired requests, and missing chat handoffs are clear.',
    );
  });

  it('uses the loading fallback for the all view', () => {
    expect(emptyBookingMessage('all')).toBe('No booking records are available yet.');
    expect(
      emptyBookingMessage('all', {
        age: 'all',
        dateRangeFilter: 'all',
        searchQuery: 'customer-123',
      }),
    ).toBe('No records match “customer-123” in All dates. Clear the search or change the period.');
    expect(
      emptyBookingMessage('all', {
        age: 'all',
        dateRangeFilter: '30d',
        searchQuery: 'customer-123',
      }),
    ).toBe(
      'No records match “customer-123” in Last 30 days. Clear the search or change the period.',
    );
  });

  it('scopes live zero-result copy to the selected queue and active filters', () => {
    expect(
      emptyBookingMessage('attention', {
        age: 'all',
        dateRangeFilter: 'all',
        hasActiveFilters: true,
        queueLabel: 'Needs action',
        searchQuery: 'audit-no-match',
      }),
    ).toBe(
      'No bookings match “audit-no-match” in Needs action. Reset filters or change the queue.',
    );
    expect(
      emptyBookingMessage('active', {
        age: 'all',
        dateRangeFilter: 'all',
        hasActiveFilters: true,
        queueLabel: 'Live now',
        searchQuery: 'missing-booking',
      }),
    ).toBe(
      'No bookings match “missing-booking” in Live now. Reset filters or change the queue.',
    );
    expect(
      emptyBookingMessage('matching', {
        age: 'under-1h',
        dateRangeFilter: 'all',
        hasActiveFilters: true,
        queueLabel: 'Matching now',
      }),
    ).toBe(
      'No bookings match the current filters in Matching now. Reset filters or change the queue.',
    );
    expect(
      emptyBookingMessage('attention', {
        age: 'all',
        hasActiveFilters: false,
        queueLabel: 'Needs action',
        searchQuery: '',
      }),
    ).toBe(
      'No bookings need action right now. Matching delays, expired requests, and missing chat handoffs are clear.',
    );
  });

  it('keeps filtered search text safe when React renders the empty state', () => {
    const message = emptyBookingMessage('attention', {
      age: 'all',
      dateRangeFilter: 'all',
      hasActiveFilters: true,
      queueLabel: 'Needs action',
      searchQuery: '<img src=x onerror=alert(1)>',
    });

    expect(renderToStaticMarkup(createElement('p', null, message))).toContain(
      '&lt;img src=x onerror=alert(1)&gt;',
    );
  });

  it.each([
    ['payment', 'No payment exceptions were found today.'],
    ['cash-debt', 'No cash commission cases were found today.'],
    ['refund-review', 'No refund mismatch cases were found today.'],
    ['closeout', 'No closeout records were found today.'],
    ['pricing', 'No pricing exceptions were found today.'],
    ['expired', 'No expired records were closed today.'],
    ['all', 'No terminal records were closed today.'],
  ] as const)('describes the empty completed %s queue in its default period', (view, expected) => {
    expect(
      emptyBookingMessage(view, {
        age: 'all',
        completedWorkspace: true,
        dateRangeFilter: 'today',
      }),
    ).toBe(expected);
  });

  it('mentions completed periods and only names waiting time when an age filter is active', () => {
    expect(
      emptyBookingMessage('cash-debt', {
        age: 'all',
        completedWorkspace: true,
        dateRangeFilter: '30d',
      }),
    ).toBe('No cash commission cases were found in the last 30 days.');
    expect(
      emptyBookingMessage('expired', {
        age: 'over-24h',
        completedWorkspace: true,
        dateRangeFilter: '30d',
      }),
    ).toBe('No expired records match the selected waiting-time filter in the last 30 days.');
    expect(
      emptyBookingMessage('pricing', {
        age: 'all',
        completedWorkspace: true,
        dateRangeFilter: 'custom',
      }),
    ).toBe('No pricing exceptions were found in the selected custom period.');
  });

  it('keeps completed search empty copy query-specific', () => {
    expect(
      emptyBookingMessage('refund-review', {
        age: 'all',
        completedWorkspace: true,
        dateRangeFilter: '30d',
        searchQuery: 'refund-123',
      }),
    ).toBe('No records match “refund-123” in Last 30 days. Clear the search or change the period.');
  });
});
