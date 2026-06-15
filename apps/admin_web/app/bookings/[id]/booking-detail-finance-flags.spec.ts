import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingDetailFinanceFlags } from './booking-detail-finance-flags';
import type { bookingFinanceTrace } from './booking-finance-trace';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-detail-finance-flags',
    participants: [],
    services: [],
    status: 'OPEN_MATCHING',
    ...input,
  } as AdminBookingDetail;
}

function financeTrace(input: Partial<ReturnType<typeof bookingFinanceTrace>> = {}) {
  return {
    currency: 'VND',
    customerPriceAmount: 500000,
    paymentMethod: 'CARD',
    payoutRuleMissing: false,
    providerPayoutAmount: 380000,
    walletTotalAmount: 0,
    ...input,
  } as unknown as ReturnType<typeof bookingFinanceTrace>;
}

describe('bookingDetailFinanceFlags', () => {
  it('maps payment and booked service amount differences', () => {
    const flags = bookingDetailFinanceFlags(
      booking({
        payment: {
          amount: 450000,
          currency: 'VND',
          method: 'CARD',
          status: 'AUTHORIZED',
        } as AdminBookingDetail['payment'],
        services: [
          {
            price: 500000,
          },
        ] as AdminBookingDetail['services'],
        status: 'MATCHED',
      }),
      financeTrace(),
    );

    expect(flags).toEqual([
      expect.objectContaining({
        detail: 'Payment is 450.000 VND but booked service is 500.000 VND.',
        severity: 'medium',
        title: 'Payment amount differs from booked service',
      }),
    ]);
  });

  it('flags completed bookings without earning records', () => {
    const flags = bookingDetailFinanceFlags(
      booking({
        payment: {
          amount: 500000,
          currency: 'VND',
          method: 'CARD',
          status: 'CAPTURED',
        } as AdminBookingDetail['payment'],
        services: [
          {
            price: 500000,
          },
        ] as AdminBookingDetail['services'],
        status: 'COMPLETED',
      }),
      financeTrace(),
    );

    expect(flags).toEqual([
      expect.objectContaining({
        severity: 'high',
        title: 'Completed booking has no earning',
      }),
    ]);
  });

  it('uses final Partner label and cash debt amount for active cash settlement blocks', () => {
    const flags = bookingDetailFinanceFlags(
      booking({
        earning: {
          currency: 'VND',
          netAmount: -120000,
          status: 'PENDING',
        } as unknown as AdminBookingDetail['earning'],
        payment: {
          amount: 500000,
          currency: 'VND',
          method: 'CASH',
          status: 'CAPTURED',
        } as AdminBookingDetail['payment'],
        selectedProvider: {
          id: 'partner-selected',
          displayName: 'Linh Partner',
        } as AdminBookingDetail['selectedProvider'],
        services: [
          {
            price: 500000,
          },
        ] as AdminBookingDetail['services'],
        status: 'COMPLETED',
      }),
      financeTrace({
        paymentMethod: 'CASH',
        walletTotalAmount: -120000,
      }),
    );

    expect(flags).toEqual([
      expect.objectContaining({
        detail:
          'Linh Partner owes 120.000 VND before marketplace alerts, participation, or payout release can continue.',
        severity: 'high',
        title: 'Cash wallet debt blocks Partner',
      }),
    ]);
  });

  it('keeps payout rule and impossible payout checks from finance trace facts', () => {
    const flags = bookingDetailFinanceFlags(
      booking({
        payment: {
          amount: 500000,
          currency: 'VND',
          method: 'CARD',
          status: 'AUTHORIZED',
        } as AdminBookingDetail['payment'],
        services: [
          {
            price: 500000,
          },
        ] as AdminBookingDetail['services'],
        status: 'MATCHED',
      }),
      financeTrace({
        payoutRuleMissing: true,
        providerPayoutAmount: 600000,
      }),
    );

    expect(flags.map((flag) => flag.title)).toEqual([
      'Payout rule missing',
      'Partner payout exceeds customer price',
    ]);
  });
});
