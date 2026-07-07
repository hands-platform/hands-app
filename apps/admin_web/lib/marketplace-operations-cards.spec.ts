import {
  buildMarketplaceOperationsCardCounts,
  buildMarketplaceOperationsCards,
} from './marketplace-operations-cards';

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
      ['Alert delivery missing', '4', 'pill-warn', '/bookings?view=marketplace'],
      ['Selected Partners', '1', 'pill-success', '/bookings?view=marketplace'],
      ['Cash fee debt', '6', 'pill-warn', '/bookings?view=cash-debt'],
    ]);
    expect(cards.map((card) => `${card.title} ${card.detail}`).join(' ')).not.toMatch(/trace/i);
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
      ['Alert delivery missing', 'pill-success'],
      ['Selected Partners', 'pill-neutral'],
      ['Cash fee debt', 'pill-neutral'],
    ]);
  });

  it('counts marketplace operation signals from booking and ledger facts', () => {
    const counts = buildMarketplaceOperationsCardCounts({
      bookings: [
        {
          alertTraceBatchCount: 0,
          hasCustomerSelectablePartner: true,
          hasWalletDebt: false,
          marketplaceParticipantCount: 2,
          selectedPartnerPresent: false,
          status: 'OPEN_MATCHING',
        },
        {
          alertTraceBatchCount: 1,
          hasCustomerSelectablePartner: false,
          hasWalletDebt: true,
          marketplaceParticipantCount: 0,
          selectedPartnerPresent: false,
          status: 'OPEN_MATCHING',
        },
        {
          alertTraceBatchCount: 0,
          hasCustomerSelectablePartner: false,
          hasWalletDebt: false,
          marketplaceParticipantCount: 0,
          selectedPartnerPresent: true,
          status: 'MATCHED',
        },
      ],
      ledgerRows: [
        { choiceLabel: 'Selected by customer' },
        { choiceLabel: 'Customer-selectable' },
      ],
    });

    expect(counts).toEqual({
      alertTraceMissingCount: 1,
      customerChoiceWaitingCount: 1,
      noMarketplaceSupplyCount: 1,
      openBookingsCount: 2,
      selectedRowsCount: 1,
      walletDebtBookingsCount: 1,
    });
  });
});
