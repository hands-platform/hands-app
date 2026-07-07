export type MarketplaceOperationsCardTone = 'pill-info' | 'pill-neutral' | 'pill-success' | 'pill-warn';

export type MarketplaceOperationsCard = {
  readonly detail: string;
  readonly href: string;
  readonly title: string;
  readonly tone: MarketplaceOperationsCardTone;
  readonly value: string;
};

type MarketplaceOperationsCardCounts = {
  readonly alertTraceMissingCount: number;
  readonly customerChoiceWaitingCount: number;
  readonly noMarketplaceSupplyCount: number;
  readonly openBookingsCount: number;
  readonly selectedRowsCount: number;
  readonly walletDebtBookingsCount: number;
};

export type MarketplaceOperationsBookingFact = {
  readonly alertTraceBatchCount: number;
  readonly hasCustomerSelectablePartner: boolean;
  readonly hasWalletDebt: boolean;
  readonly marketplaceParticipantCount: number;
  readonly selectedPartnerPresent: boolean;
  readonly status: string;
};

export type MarketplaceOperationsLedgerFact = {
  readonly choiceLabel: string;
};

type MarketplaceOperationsCardCountInput = {
  readonly bookings: readonly MarketplaceOperationsBookingFact[];
  readonly ledgerRows: readonly MarketplaceOperationsLedgerFact[];
};

export function buildMarketplaceOperationsCardCounts({
  bookings,
  ledgerRows,
}: MarketplaceOperationsCardCountInput): MarketplaceOperationsCardCounts {
  const openBookings = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');

  return {
    alertTraceMissingCount: openBookings.filter((booking) => booking.alertTraceBatchCount === 0).length,
    customerChoiceWaitingCount: openBookings.filter((booking) => booking.hasCustomerSelectablePartner)
      .length,
    noMarketplaceSupplyCount: openBookings.filter(
      (booking) => booking.marketplaceParticipantCount === 0 && !booking.selectedPartnerPresent,
    ).length,
    openBookingsCount: openBookings.length,
    selectedRowsCount: ledgerRows.filter((row) => row.choiceLabel === 'Selected by customer').length,
    walletDebtBookingsCount: bookings.filter((booking) => booking.hasWalletDebt).length,
  };
}

export function buildMarketplaceOperationsCards({
  alertTraceMissingCount,
  customerChoiceWaitingCount,
  noMarketplaceSupplyCount,
  openBookingsCount,
  selectedRowsCount,
  walletDebtBookingsCount,
}: MarketplaceOperationsCardCounts): MarketplaceOperationsCard[] {
  return [
    {
      title: 'Open marketplace',
      value: `${openBookingsCount}`,
      detail: 'Bookings still visible for Partner participation or customer choice.',
      tone: openBookingsCount > 0 ? 'pill-warn' : 'pill-success',
      href: '/bookings?view=marketplace',
    },
    {
      title: 'Customer choice',
      value: `${customerChoiceWaitingCount}`,
      detail: 'Participating or accepted Partners are visible and the customer has not selected a final Partner yet.',
      tone: customerChoiceWaitingCount > 0 ? 'pill-info' : 'pill-neutral',
      href: '/bookings?view=customer-choice',
    },
    {
      title: 'No participant supply',
      value: `${noMarketplaceSupplyCount}`,
      detail: 'Open requests with no marketplace participant in the ledger.',
      tone: noMarketplaceSupplyCount > 0 ? 'pill-warn' : 'pill-success',
      href: '/bookings?view=marketplace',
    },
    {
      title: 'Alert delivery missing',
      value: `${alertTraceMissingCount}`,
      detail: 'Open requests without recorded 10 km marketplace notification batches.',
      tone: alertTraceMissingCount > 0 ? 'pill-warn' : 'pill-success',
      href: '/bookings?view=marketplace',
    },
    {
      title: 'Selected Partners',
      value: `${selectedRowsCount}`,
      detail: 'Marketplace or first-pick Partners already chosen by customers.',
      tone: selectedRowsCount > 0 ? 'pill-success' : 'pill-neutral',
      href: '/bookings?view=marketplace',
    },
    {
      title: 'Cash fee debt',
      value: `${walletDebtBookingsCount}`,
      detail: 'Bookings with Partner wallet debt signals after cash fee closeout.',
      tone: walletDebtBookingsCount > 0 ? 'pill-warn' : 'pill-neutral',
      href: '/bookings?view=cash-debt',
    },
  ];
}
