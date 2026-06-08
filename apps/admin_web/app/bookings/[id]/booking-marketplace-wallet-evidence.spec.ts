import { bookingMarketplaceWalletEvidence } from './booking-marketplace-wallet-evidence';

function baseInput(overrides = {}) {
  return {
    booking: {
      id: 'booking-1',
      status: 'OPEN_MATCHING',
      participants: [],
      selectedProvider: null,
      chatRoom: null,
    },
    marketplaceSupply: {
      radiusMeters: 10_000,
      eligibleCount: 2,
      rows: [],
    },
    financeTrace: {
      platformFee: '120.000 VND',
      paymentMethod: 'CASH',
      walletLedger: 'No debt',
      providerPayout: '380.000 VND',
      withholding: '20.000 VND',
      netHandsFee: '100.000 VND',
    },
    notificationTrace: {
      backupBatches: [],
      rows: [],
    },
    walletDebt: false,
    ...overrides,
  } as never;
}

describe('booking marketplace wallet evidence', () => {
  it('does not repeat settlement block copy when the wallet gate is clear', () => {
    const evidence = bookingMarketplaceWalletEvidence(baseInput());
    const walletRow = evidence.rows.find((row) => row.lane === 'Wallet participation gate');

    expect(walletRow).toMatchObject({
      status: 'Clear',
      tone: 'pill-success',
    });
    expect(walletRow?.operatorUse).toBe(
      'No active cash-fee wallet debt from this booking is currently gating marketplace participation.',
    );
    expect(walletRow?.operatorUse).not.toContain('Unpaid HANDS fees must be settled');
  });

  it('keeps settlement instructions when cash-fee debt blocks marketplace participation', () => {
    const evidence = bookingMarketplaceWalletEvidence(
      baseInput({
        walletDebt: true,
        financeTrace: {
          platformFee: '120.000 VND',
          paymentMethod: 'CASH',
          walletLedger: '-120.000 VND debt',
          providerPayout: '380.000 VND',
          withholding: '20.000 VND',
          netHandsFee: '100.000 VND',
        },
      }),
    );
    const walletRow = evidence.rows.find((row) => row.lane === 'Wallet participation gate');

    expect(walletRow).toMatchObject({
      status: 'Settlement needed',
      tone: 'pill-danger',
    });
    expect(walletRow?.operatorUse).toContain('marketplace bookings');
    expect(walletRow?.operatorUse).toContain('marketplace alerts');
  });
});
