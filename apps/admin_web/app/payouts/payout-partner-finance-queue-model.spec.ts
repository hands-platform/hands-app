import type { AdminPayoutBatch } from '../../lib/admin-api';

import { buildPayoutPartnerFinanceQueueRows } from './payout-partner-finance-queue-model';

describe('buildPayoutPartnerFinanceQueueRows', () => {
  it('surfaces partner bank correction, payout hold, negative wallet, and transfer ref issues first', () => {
    const rows = buildPayoutPartnerFinanceQueueRows([
      payoutBatch({
        id: 'batch-1',
        providerProfile: {
          displayName: 'Blocked Partner',
          bankAccounts: [
            {
              id: 'bank-1',
              bankName: 'VCB',
              accountHolderName: 'Blocked Partner',
              status: 'REJECTED',
              isPrimary: true,
              rejectionReason: 'Bank proof does not match.',
            },
          ],
          sanctions: [
            {
              id: 'hold-1',
              providerProfileId: 'provider-1',
              type: 'PAYOUT_HOLD',
              status: 'ACTIVE',
              reason: 'Open customer safety report.',
              startsAt: '2026-06-20T00:00:00.000Z',
            },
          ],
          walletLedgerEntries: [
            {
              id: 'wallet-1',
              type: 'CASH_BOOKING_PLATFORM_FEE_DEDUCTED',
              sourceKey: 'cash-booking-fee:booking-1',
              amount: -120_000,
              currency: 'VND',
            },
          ],
        },
        transferRef: null,
      }),
    ]);

    expect(rows.map((row) => row.id)).toEqual([
      'batch-1-bank-correction',
      'batch-1-payout-hold',
      'batch-1-wallet-negative',
      'batch-1-transfer-ref',
    ]);
    expect(rows[0]).toMatchObject({
      actionLabel: 'Open partner bank correction',
      amount: 750_000,
      currency: 'VND',
      partnerLabel: 'Blocked Partner',
      title: 'Partner correction pending',
      tone: 'danger',
    });
    expect(rows[0].detail).toContain('Bank proof does not match.');
    expect(rows[2]).toMatchObject({
      actionLabel: 'Open cash settlements',
      evidenceLabel: 'Recent wallet movement -120.000 VND',
    });
  });

  it('uses bank review needed language when corrected bank details are waiting for admin review', () => {
    const rows = buildPayoutPartnerFinanceQueueRows([
      payoutBatch({
        id: 'batch-review',
        providerProfile: {
          displayName: 'Review Partner',
          bankAccounts: [
            {
              id: 'bank-review',
              bankName: 'Techcombank',
              accountHolderName: 'Review Partner',
              status: 'PENDING_REVIEW',
              isPrimary: true,
            },
          ],
          sanctions: [],
          walletLedgerEntries: [],
        },
      }),
    ]);

    expect(rows[0]).toMatchObject({
      actionLabel: 'Review bank details',
      evidenceLabel: 'Techcombank / Review Partner',
      id: 'batch-review-bank-review',
      title: 'Bank review needed',
      tone: 'warning',
    });
    expect(rows[0].detail).toContain('Corrected bank details are waiting for admin review.');
  });

  it('shows withdrawal-ready rows when bank details are approved and no finance blocker is visible', () => {
    const rows = buildPayoutPartnerFinanceQueueRows([
      payoutBatch({
        id: 'batch-2',
        providerProfile: {
          displayName: 'Ready Partner',
          bankAccounts: [
            {
              id: 'bank-2',
              bankName: 'BIDV',
              accountHolderName: 'Ready Partner',
              status: 'APPROVED',
              isPrimary: true,
            },
          ],
          sanctions: [],
          walletLedgerEntries: [],
        },
        transferRef: 'BIDV-20260629-001',
      }),
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'batch-2-withdrawal-ready',
        actionLabel: 'Review manual payout',
        amount: 750_000,
        currency: 'VND',
        evidenceLabel: 'Approved bank details',
        title: 'Ready for manual payout',
        tone: 'success',
      }),
    ]);
  });
});

function payoutBatch(overrides: Partial<AdminPayoutBatch>): AdminPayoutBatch {
  return {
    id: 'batch',
    providerProfileId: 'provider-1',
    totalNetAmount: 750_000,
    currency: 'VND',
    status: 'DRAFT',
    transferRef: 'REF-001',
    createdAt: '2026-06-29T04:00:00.000Z',
    earnings: [
      {
        id: 'earning-1',
        providerProfileId: 'provider-1',
        bookingId: 'booking-1',
        grossAmount: 900_000,
        platformFee: 120_000,
        withholdingAmount: 30_000,
        netAmount: 750_000,
        currency: 'VND',
        status: 'AVAILABLE',
      },
    ],
    ...overrides,
  };
}
