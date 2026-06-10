import { buildMarketplaceOperationsCards } from './marketplace-operations-cards';

describe('marketplace operations cards', () => {
  it('builds marketplace operations cards from visible booking counts', () => {
    const cards = buildMarketplaceOperationsCards({
      alertTraceMissingCount: 4,
      customerChoiceWaitingCount: 2,
      noMarketplaceSupplyCount: 3,
      openBookingsCount: 5,
      selectedRowsCount: 1,
      walletDebtBookingsCount: 6,
    });

    expect(cards.map((card) => [card.title, card.value, card.tone, card.href])).toEqual([
      ['Open marketplace', '5', 'pill-warn', '/bookings?view=marketplace'],
      ['Customer choice', '2', 'pill-info', '/bookings?view=customer-choice'],
      ['No participant supply', '3', 'pill-warn', '/bookings?view=marketplace'],
      ['Alert trace missing', '4', 'pill-warn', '/bookings?view=marketplace'],
      ['Selected partners', '1', 'pill-success', '/bookings?view=marketplace'],
      ['Cash fee debt', '6', 'pill-warn', '/bookings?view=cash-debt'],
    ]);
  });

  it('uses calm tones when marketplace counts are clear', () => {
    const cards = buildMarketplaceOperationsCards({
      alertTraceMissingCount: 0,
      customerChoiceWaitingCount: 0,
      noMarketplaceSupplyCount: 0,
      openBookingsCount: 0,
      selectedRowsCount: 0,
      walletDebtBookingsCount: 0,
    });

    expect(cards.map((card) => [card.title, card.tone])).toEqual([
      ['Open marketplace', 'pill-success'],
      ['Customer choice', 'pill-neutral'],
      ['No participant supply', 'pill-success'],
      ['Alert trace missing', 'pill-success'],
      ['Selected partners', 'pill-neutral'],
      ['Cash fee debt', 'pill-neutral'],
    ]);
  });
});
