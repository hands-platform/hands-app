import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { BookingNeedsActionSection, bookingNeedsActionItems } from './booking-needs-action-section';

vi.mock('next/link', () => ({
  default: ({ children, prefetch, ...props }: ComponentProps<'a'> & { prefetch?: boolean }) => {
    void prefetch;
    return <a {...props}>{children}</a>;
  },
}));

describe('bookingNeedsActionItems', () => {
  it.each([
    {
      expectedKeys: ['matching-expiry'],
      flags: {
        matchingExpiryCanSubmit: true,
        noShowCanSubmit: false,
        postMatchDecisionCanResolve: false,
      },
      status: 'OPEN_MATCHING',
    },
    {
      expectedKeys: [],
      flags: {
        matchingExpiryCanSubmit: false,
        noShowCanSubmit: false,
        postMatchDecisionCanResolve: false,
      },
      status: 'MATCHED',
    },
    {
      expectedKeys: ['no-show'],
      flags: {
        matchingExpiryCanSubmit: false,
        noShowCanSubmit: true,
        postMatchDecisionCanResolve: false,
      },
      status: 'ARRIVED',
    },
    {
      expectedKeys: [],
      flags: {
        matchingExpiryCanSubmit: false,
        noShowCanSubmit: false,
        postMatchDecisionCanResolve: false,
      },
      status: 'IN_SERVICE',
    },
    {
      expectedKeys: ['post-match-cancellation'],
      flags: {
        matchingExpiryCanSubmit: false,
        noShowCanSubmit: false,
        postMatchDecisionCanResolve: true,
      },
      status: 'CANCELLED',
    },
  ])('keeps $status state actions explicit', ({ expectedKeys, flags, status }) => {
    const items = bookingNeedsActionItems({
      bookingStatus: status,
      chatRepairCanSubmit: false,
      closeoutCanSubmit: false,
      matchingExpiryCanSubmit: flags.matchingExpiryCanSubmit,
      noShowCanSubmit: flags.noShowCanSubmit,
      openTasks: [],
      postMatchDecisionCanResolve: flags.postMatchDecisionCanResolve,
    });

    expect(items.map((item) => item.key)).toEqual(expectedKeys);
  });

  it.each([
    { closeoutCanSubmit: false, expectedKeys: [], status: 'COMPLETED' },
    { closeoutCanSubmit: true, expectedKeys: ['completed-closeout'], status: 'COMPLETED' },
    { closeoutCanSubmit: false, expectedKeys: [], status: 'EXPIRED' },
    { closeoutCanSubmit: false, expectedKeys: [], status: 'REFUNDED' },
    { closeoutCanSubmit: false, expectedKeys: [], status: 'NO_SHOW' },
  ])(
    'keeps terminal $status state free of unrelated transition actions',
    ({ closeoutCanSubmit, expectedKeys, status }) => {
      const items = bookingNeedsActionItems({
        bookingStatus: status,
        chatRepairCanSubmit: false,
        closeoutCanSubmit,
        matchingExpiryCanSubmit: false,
        noShowCanSubmit: false,
        openTasks: [],
        postMatchDecisionCanResolve: false,
      });

      expect(items.map((item) => item.key)).toEqual(expectedKeys);
    },
  );

  it('returns only actions that can be handled now', () => {
    const items = bookingNeedsActionItems({
      bookingStatus: 'COMPLETED',
      chatRepairCanSubmit: false,
      closeoutCanSubmit: true,
      matchingExpiryCanSubmit: false,
      noShowCanSubmit: false,
      openTasks: [
        { helper: 'Already finished.', label: 'Customer updated', status: 'DONE' },
        { helper: 'Routine checkpoint.', label: 'Customer contacted', status: 'PENDING' },
        { helper: 'Partner contact is still missing.', label: 'Contact Partner', status: 'BLOCKED' },
      ],
      postMatchDecisionCanResolve: false,
    });

    expect(items.map((item) => item.key)).toEqual(['completed-closeout', 'ops-task-2-Contact Partner']);
    expect(items[1]).toMatchObject({ label: 'Contact Partner is blocked', tone: 'danger' });
  });

  it('uses action-first copy for due matching and arrival review', () => {
    const items = bookingNeedsActionItems({
      bookingStatus: 'ARRIVED',
      chatRepairCanSubmit: false,
      closeoutCanSubmit: false,
      matchingExpiryCanSubmit: true,
      noShowCanSubmit: true,
      openTasks: [],
      postMatchDecisionCanResolve: false,
    });

    expect(items.map((item) => item.label)).toEqual([
      'Close expired matching',
      'Confirm arrival or no-show',
    ]);
  });

  it('keeps the decision evidence and recommendation together in the first strip', () => {
    const markup = renderToStaticMarkup(
      <BookingNeedsActionSection
        assignee="Unassigned"
        bookingStatus="IN_SERVICE"
        contactDetail="Partner: Lan / +84922222222"
        contactValue="Customer: Minh / +84911111111"
        items={[]}
        lastUpdatedAt="2026-08-05T07:00:00.000Z"
        locationDetail="Partner location: recent"
        locationValue="1 Nguyen Hue, District 1"
        paymentDetail="500,000 VND"
        paymentValue="WALLET / AUTHORIZED"
        recommendedAction="Review customer contact"
        recommendedHref="#booking-structured-ops-status"
        recommendedReason="Customer contact is the next open checkpoint."
        sla="Not defined"
      />,
    );

    expect(markup).toContain('Decision strip');
    expect(markup).toContain('In Service');
    expect(markup).toContain('SLA');
    expect(markup).toContain('Unassigned');
    expect(markup).toContain('Customer: Minh');
    expect(markup).toContain('1 Nguyen Hue');
    expect(markup).toContain('WALLET / AUTHORIZED');
    expect(markup).toContain('Review customer contact');
    expect(markup).toContain('Customer contact is the next open checkpoint.');
  });
});
