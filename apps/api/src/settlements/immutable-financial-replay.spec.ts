import {
  immutableFinancialReplayMatches,
  PROVIDER_WALLET_LEDGER_REPLAY_FIELDS,
} from './immutable-financial-replay';

describe('immutable financial replay', () => {
  const expected = {
    providerProfileId: 'partner-1',
    bookingId: 'booking-1',
    earningId: 'earning-1',
    payoutBatchId: 'payout-1',
    type: 'PAYOUT_PAID',
    amount: -400_000,
    currency: 'VND',
    reference: 'BANK-001',
    notes: 'Partner payout paid.',
    metadata: { payoutBatchId: 'payout-1' },
  };

  it('accepts an exact replay while ignoring generated row fields', () => {
    expect(
      immutableFinancialReplayMatches(
        { id: 'ledger-1', createdAt: new Date(), ...expected },
        expected,
        PROVIDER_WALLET_LEDGER_REPLAY_FIELDS,
      ),
    ).toBe(true);
  });

  it.each([
    ['providerProfileId', 'partner-2'],
    ['amount', -399_999],
    ['reference', 'BANK-002'],
    ['metadata', { payoutBatchId: 'payout-2' }],
  ])('rejects a replay with different %s evidence', (field, value) => {
    expect(
      immutableFinancialReplayMatches(
        { ...expected, [field]: value },
        expected,
        PROVIDER_WALLET_LEDGER_REPLAY_FIELDS,
      ),
    ).toBe(false);
  });
});
