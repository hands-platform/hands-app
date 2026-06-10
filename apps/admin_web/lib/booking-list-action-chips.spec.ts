import { bookingListActionChipsFromFacts } from './booking-list-action-chips';

function input(
  overrides: Partial<Parameters<typeof bookingListActionChipsFromFacts>[0]> = {},
): Parameters<typeof bookingListActionChipsFromFacts>[0] {
  return {
    cashDebtNeedsOps: false,
    chatNeedsRepair: false,
    chatState: {
      detail: 'Chat opens after the customer locks a final partner.',
      label: 'Chat pending',
      tone: 'pill-neutral',
    },
    closeoutNeedsOps: false,
    locationDetail: 'Partner location clear',
    locationNeedsOps: false,
    paymentDetail: 'CARD / AUTHORIZED / ₫100',
    paymentNeedsOps: false,
    pricingDetail: 'Service price ready',
    pricingNeedsOps: false,
    pricingTone: 'pill-info',
    ...overrides,
  };
}

describe('bookingListActionChipsFromFacts', () => {
  it('builds calm action chips when no operations checks are active', () => {
    const chips = bookingListActionChipsFromFacts(input());

    expect(chips.map((chip) => [chip.label, chip.tone, chip.href])).toEqual([
      ['Chat pending', 'pill-neutral', '/bookings?view=chat'],
      ['Location clear', 'pill-success', '/bookings?view=location'],
      ['Payment clear', 'pill-success', '/bookings?view=payment'],
      ['Cash clear', 'pill-success', '/bookings?view=cash-debt'],
      ['Closeout clear', 'pill-success', '/bookings?view=closeout'],
      ['Pricing clear', 'pill-success', '/bookings?view=pricing'],
    ]);
  });

  it('builds repair and check chips for active operations signals', () => {
    const chips = bookingListActionChipsFromFacts(
      input({
        cashDebtNeedsOps: true,
        chatNeedsRepair: true,
        closeoutNeedsOps: true,
        locationNeedsOps: true,
        paymentNeedsOps: true,
        pricingNeedsOps: true,
        pricingTone: 'pill-warn',
      }),
    );

    expect(chips.map((chip) => [chip.label, chip.tone, chip.href])).toEqual([
      ['Chat repair', 'pill-danger', '/bookings?view=chat-repair'],
      ['Location check', 'pill-warn', '/bookings?view=location'],
      ['Payment check', 'pill-warn', '/bookings?view=payment'],
      ['Cash debt', 'pill-danger', '/bookings?view=cash-debt'],
      ['Closeout check', 'pill-warn', '/bookings?view=closeout'],
      ['Pricing check', 'pill-warn', '/bookings?view=pricing'],
    ]);
  });
});
