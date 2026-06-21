import { bookingCashFeeSettlementPath } from './booking-cash-wallet-gate';

const financeTrace = {
  currency: 'VND',
  customerPrice: '450.000 VND',
  feeCosts: '0 VND costs',
  netHandsFee: '100.000 VND',
  paymentMethod: 'CASH',
  platformFee: '120.000 VND',
  providerPayout: '330.000 VND',
  walletLedger: '-120.000 VND',
  withholding: '20.000 VND',
};

function cashDebtBooking() {
  return {
    earning: {
      netAmount: -120000,
      status: 'PENDING',
      walletLedgerEntries: [],
    },
    id: 'booking-cash-debt',
    payment: {
      method: 'CASH',
    },
    platformFeeLogs: [],
    selectedProvider: {
      displayName: 'Linh Partner',
    },
    taxLogs: [],
    walletLedgerEntries: [],
  };
}

describe('bookingCashFeeSettlementPath', () => {
  it('describes negative cash wallet debt as a final acceptance and service start gate', () => {
    const path = bookingCashFeeSettlementPath(cashDebtBooking() as never, financeTrace as never);

    expect(path.cards.find((card) => card.label === 'Wallet debt')?.helper).toBe(
      'Final acceptance, service start, and payout release stay blocked until settlement evidence clears this.',
    );
    expect(path.rows.find((row) => row.lane === 'Partner wallet impact')?.nextStep).toBe(
      'Block final acceptance, service start, and payout release until deposit or approved offset is recorded.',
    );
  });

  it('keeps the clear state copy away from marketplace alert reopening language', () => {
    const path = bookingCashFeeSettlementPath(
      {
        ...cashDebtBooking(),
        earning: {
          netAmount: 120000,
          status: 'PAID',
          walletLedgerEntries: [{ id: 'wallet-1' }],
        },
        walletLedgerEntries: [{ id: 'wallet-1' }],
      } as never,
      { ...financeTrace, walletLedger: '120.000 VND cleared' } as never,
    );

    expect(path.rows.find((row) => row.lane === 'Unblock path')?.evidence).toBe(
      'Final acceptance, service start, and payout release are not blocked by this booking.',
    );
  });
});
