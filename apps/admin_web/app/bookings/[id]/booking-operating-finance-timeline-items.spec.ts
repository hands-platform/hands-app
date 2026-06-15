import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingOperatingFinanceTimelineItems } from './booking-operating-finance-timeline-items';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-finance-timeline',
    status: 'COMPLETED',
    updatedAt: '2026-06-14T02:00:00.000Z',
    ...input,
  } as AdminBookingDetail;
}

describe('bookingOperatingFinanceTimelineItems', () => {
  it('builds payment and earning timeline items with the booking currency', () => {
    const items = bookingOperatingFinanceTimelineItems(
      booking({
        earning: {
          createdAt: '2026-06-14T03:00:00.000Z',
          currency: 'VND',
          id: 'earning-1',
          netAmount: 240000,
          platformFee: 60000,
          status: 'PAID',
        } as AdminBookingDetail['earning'],
        payment: {
          amount: 300000,
          currency: 'VND',
          id: 'payment-1',
          method: 'CARD',
          providerRef: 'gw_123',
          status: 'CAPTURED',
        } as AdminBookingDetail['payment'],
      }),
    );

    expect(items.map((item) => item.id)).toEqual(['payment-payment-1', 'earning-earning-1']);
    expect(items[0]).toMatchObject({
      detail: 'CARD / 300.000 VND / gw_123',
      status: 'CAPTURED',
      title: 'Payment CAPTURED',
      type: 'PAY',
    });
    expect(items[1]).toMatchObject({
      detail: '240.000 VND net / 60.000 VND platform fee.',
      status: 'PAID',
      title: 'Partner earning PAID',
      type: 'EARN',
    });
  });

  it('dedupes refund rows by id while preserving the payment refund payload', () => {
    const items = bookingOperatingFinanceTimelineItems(
      booking({
        payment: {
          amount: 300000,
          currency: 'VND',
          id: 'payment-1',
          method: 'CARD',
          refunds: [
            {
              amount: 300000,
              createdAt: '2026-06-14T04:00:00.000Z',
              id: 'refund-1',
              status: 'SUCCEEDED',
            },
          ],
          status: 'REFUNDED',
        } as AdminBookingDetail['payment'],
        refunds: [
          {
            amount: 100000,
            bookingId: 'booking-finance-timeline',
            createdAt: '2026-06-14T03:00:00.000Z',
            id: 'refund-1',
            paymentId: 'payment-1',
            reason: 'Customer request',
            status: 'PENDING',
          },
        ] as AdminBookingDetail['refunds'],
      }),
    );

    expect(items.filter((item) => item.type === 'REFUND')).toEqual([
      expect.objectContaining({
        detail: '300.000 VND / No reason note',
        id: 'refund-refund-1',
        status: 'SUCCEEDED',
      }),
    ]);
  });

  it('adds a cash debt item before ledger evidence when settlement blocks remain', () => {
    const items = bookingOperatingFinanceTimelineItems(
      booking({
        earning: {
          createdAt: '2026-06-14T03:00:00.000Z',
          currency: 'VND',
          id: 'earning-cash',
          netAmount: -150000,
          platformFee: 150000,
          status: 'PENDING',
          walletLedgerEntries: [
            {
              amount: -150000,
              createdAt: '2026-06-14T03:10:00.000Z',
              currency: 'VND',
              id: 'wallet-1',
              sourceKey: 'cash-fee',
              type: 'DEBIT',
            },
          ],
        } as AdminBookingDetail['earning'],
        payment: {
          amount: 300000,
          currency: 'VND',
          id: 'payment-cash',
          method: 'CASH',
          status: 'PENDING',
        } as AdminBookingDetail['payment'],
      }),
    );

    expect(items.map((item) => item.type)).toEqual(['PAY', 'EARN', 'CASH', 'WALLET']);
    expect(items.find((item) => item.type === 'CASH')).toMatchObject({
      id: 'cash-debt-earning-cash',
      status: 'Settlement needed',
    });
    expect(items.find((item) => item.type === 'WALLET')).toMatchObject({
      detail: '-150.000 VND / cash-fee',
      title: 'Wallet DEBIT',
    });
  });

  it('dedupes tax, fee, and wallet rows from booking and earning relations', () => {
    const items = bookingOperatingFinanceTimelineItems(
      booking({
        earning: {
          currency: 'VND',
          id: 'earning-1',
          netAmount: 240000,
          platformFee: 60000,
          platformFeeLogs: [
            {
              currency: 'VND',
              grossAmount: 300000,
              id: 'fee-1',
              platformFeeAmount: 60000,
            },
          ],
          status: 'PAID',
          taxLogs: [
            {
              currency: 'VND',
              grossAmount: 300000,
              id: 'tax-1',
              taxableAmount: 300000,
              withholdingAmount: 30000,
            },
          ],
          walletLedgerEntries: [
            {
              amount: 240000,
              currency: 'VND',
              id: 'wallet-1',
              notes: 'Paid out',
              sourceKey: 'payout',
              type: 'CREDIT',
            },
          ],
        } as AdminBookingDetail['earning'],
        platformFeeLogs: [
          {
            currency: 'VND',
            grossAmount: 200000,
            id: 'fee-1',
            platformFeeAmount: 40000,
          },
        ] as AdminBookingDetail['platformFeeLogs'],
        taxLogs: [
          {
            currency: 'VND',
            grossAmount: 200000,
            id: 'tax-1',
            taxableAmount: 200000,
            withholdingAmount: 20000,
          },
        ] as AdminBookingDetail['taxLogs'],
        walletLedgerEntries: [
          {
            amount: 100000,
            currency: 'VND',
            id: 'wallet-1',
            sourceKey: 'older',
            type: 'CREDIT',
          },
        ] as AdminBookingDetail['walletLedgerEntries'],
      }),
    );

    expect(items.filter((item) => item.type === 'TAX')).toEqual([
      expect.objectContaining({ detail: '30.000 VND withheld from 300.000 VND taxable amount.' }),
    ]);
    expect(items.filter((item) => item.type === 'FEE')).toEqual([
      expect.objectContaining({ detail: '60.000 VND company fee from 300.000 VND gross.' }),
    ]);
    expect(items.filter((item) => item.type === 'WALLET')).toEqual([
      expect.objectContaining({ detail: '240.000 VND / Paid out' }),
    ]);
  });
});
