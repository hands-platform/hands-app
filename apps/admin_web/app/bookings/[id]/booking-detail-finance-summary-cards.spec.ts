import { bookingDetailFinanceSummaryCards } from './booking-detail-finance-summary-cards';
import type { bookingFinanceTrace } from './booking-finance-trace';

function financeTrace(input: Partial<ReturnType<typeof bookingFinanceTrace>> = {}) {
  return {
    currency: 'VND',
    paymentMethod: 'CASH',
    customerPriceAmount: 500000,
    serviceOption: 'Foot massage / 60 min / qty 1',
    providerPayoutAmount: 380000,
    earningStatus: 'PENDING',
    platformFeeAmount: 120000,
    netHandsFee: '90.000 VND',
    withholdingAmount: 30000,
    withholding: '30.000 VND on 380.000 VND',
    companyFeeAfterTaxAmount: 60000,
    walletTotalAmount: -120000,
    ...input,
  } as unknown as ReturnType<typeof bookingFinanceTrace>;
}

describe('bookingDetailFinanceSummaryCards', () => {
  it('formats finance summary amounts with booking detail money copy', () => {
    const cards = bookingDetailFinanceSummaryCards(financeTrace());

    expect(cards.map((card) => card.label)).toEqual([
      'Customer charge',
      'Partner payout',
      'HANDS fee',
      'Tax withheld',
      'Company net',
      'Wallet impact',
    ]);
    expect(cards[0]).toEqual(
      expect.objectContaining({
        helper: 'Foot massage / 60 min / qty 1',
        value: '500.000 VND',
      }),
    );
    expect(cards[5]).toEqual(
      expect.objectContaining({
        helper: 'Cash fee debt gates final acceptance, service start, and payout release.',
        value: '-120.000 VND',
      }),
    );
  });

  it('keeps projected payout copy when earning is missing', () => {
    const cards = bookingDetailFinanceSummaryCards(
      financeTrace({
        earningStatus: null,
        paymentMethod: 'CARD',
        walletTotalAmount: 0,
      }),
    );

    expect(cards[1]).toEqual(
      expect.objectContaining({
        helper: 'Projected from payout rule.',
        value: '380.000 VND',
      }),
    );
    expect(cards[5].helper).toBe('Non-cash booking should create payout credit after completion.');
  });
});
