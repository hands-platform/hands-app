import { buildBookingMatchingEscalationRows } from './booking-matching-escalation-rows';

type TestBooking = {
  readonly id: string;
};

function input(
  id: string,
  overrides: Partial<Parameters<typeof buildBookingMatchingEscalationRows<TestBooking>>[0][number]> = {},
): Parameters<typeof buildBookingMatchingEscalationRows<TestBooking>>[0][number] {
  return {
    booking: { id },
    hasChatRoom: false,
    hasPreferredPartner: false,
    marketplaceCount: 0,
    needsOps: true,
    preferredAwaitingDecision: false,
    responseWindowExpired: false,
    selectableCount: 0,
    selectionLabel: 'No first-pick Partner',
    selectionPathLabel: 'No customer-selectable Partner',
    sortTimestamp: 100,
    status: 'OPEN_MATCHING',
    windowLabel: '5m left',
    ...overrides,
  };
}

describe('buildBookingMatchingEscalationRows', () => {
  it('builds the highest-signal matching escalation rows from booking facts', () => {
    const rows = buildBookingMatchingEscalationRows([
      input('expired', { responseWindowExpired: true, sortTimestamp: 10 }),
      input('choice', { marketplaceCount: 2, selectableCount: 1, selectionPathLabel: 'Marketplace fallback' }),
      input('first-pick', {
        hasPreferredPartner: true,
        preferredAwaitingDecision: true,
        windowLabel: '8m left',
      }),
      input('marketplace-ready', {
        hasPreferredPartner: true,
        marketplaceCount: 3,
        preferredAwaitingDecision: true,
        selectionPathLabel: 'First-pick plus marketplace',
      }),
      input('chat', {
        selectionLabel: 'Partner A',
        sortTimestamp: 999,
        status: 'MATCHED',
      }),
    ]);

    expect(rows.map((row) => [row.booking.id, row.title, row.tone])).toEqual([
      ['chat', 'Matched booking missing chat', 'danger'],
      ['expired', 'Response window expired', 'danger'],
      ['choice', 'Customer fallback Partner selection needed', 'warn'],
      ['first-pick', 'First-pick pending with no marketplace option', 'warn'],
      ['marketplace-ready', 'First-pick pending with marketplace ready', 'info'],
    ]);
    expect(rows[1].tags).toEqual(['OPEN_MATCHING', '5m left', '0 marketplace', '0 selectable']);
    expect(rows[2].tags).toContain('Marketplace fallback');
  });

  it('filters rows that do not need matching operations', () => {
    const rows = buildBookingMatchingEscalationRows([
      input('clear', { needsOps: false }),
      input('supply-gap', { sortTimestamp: 200 }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      booking: { id: 'supply-gap' },
      title: 'Open request has no Partner supply',
      tone: 'warn',
    });
  });
});
