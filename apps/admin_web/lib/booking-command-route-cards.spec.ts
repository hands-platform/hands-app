import {
  buildBookingCommandSummaryCards,
  buildBookingOperatorRouteCards,
} from './booking-command-route-cards';

describe('booking command route cards', () => {
  it('builds command summary cards with clear-state fallbacks when no top action exists', () => {
    const cards = buildBookingCommandSummaryCards({
      activeView: {
        label: 'Stage 2 marketplace',
        operatorHint: 'Watch marketplace participation.',
        view: 'marketplace',
      },
      blockedCreateCount: 2,
      blockedCreateDetail: 'Two rejected booking create attempts need review.',
      lanes: {},
      topAction: undefined,
      visibleBookingCount: 3,
    });

    expect(cards).toHaveLength(7);
    expect(cards[0]).toMatchObject({
      label: 'Current lane',
      value: 'Stage 2 marketplace',
      detail: '3 visible booking(s). Watch marketplace participation.',
      owner: 'Shift lead',
      href: '/bookings?view=marketplace',
    });
    expect(cards[1]).toMatchObject({
      label: 'Top operator action',
      value: 'Clear',
      action: 'Monitor',
      href: '/bookings?view=active',
    });
    expect(cards[6]).toMatchObject({
      label: 'Blocked create attempts',
      value: '2',
      detail: 'Two rejected booking create attempts need review.',
      owner: 'Product ops',
    });
  });

  it('builds route cards from booking view counts and the current top action', () => {
    const cards = buildBookingOperatorRouteCards({
      blockedCreateCount: 1,
      blockedCreateDetail: 'One rejected create attempt needs product review.',
      bookingViewCounts: new Map([
        ['first-pick', 4],
        ['marketplace', 5],
        ['customer-choice', 2],
        ['chat-repair', 1],
        ['cash-debt', 3],
        ['closeout', 6],
      ]),
      topAction: {
        actionLabel: 'Same-shift',
        href: '/bookings/booking-1',
        operatorAction: 'Call the customer and keep Partner handoff visible.',
        owner: 'Support',
        priority: 'P0',
      },
    });

    expect(cards.map((card) => [card.label, card.value])).toEqual([
      ['Handle first', 'P0'],
      ['First-pick wait', '4'],
      ['Marketplace pool', '5'],
      ['Customer choice', '2'],
      ['Chat repair', '1'],
      ['Cash debt gate', '3'],
      ['Closeout', '6'],
      ['Create rejections', '1'],
    ]);
    expect(cards[0]).toMatchObject({
      action: 'Same-shift',
      detail: 'Call the customer and keep Partner handoff visible.',
      href: '/bookings/booking-1',
      owner: 'Support',
    });
    expect(cards[7]).toMatchObject({
      action: 'Inspect blocked booking create audit records.',
      href: '/bookings?view=blocked-create',
    });
  });
});
