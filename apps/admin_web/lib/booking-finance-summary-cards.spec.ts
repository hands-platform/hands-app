import { bookingFinanceSummaryCards } from './booking-finance-summary-cards';

const money = (amount?: number | null, currency = 'VND') => `${amount ?? 0} ${currency}`;

describe('bookingFinanceSummaryCards', () => {
  it('builds the six finance summary cards', () => {
    const cards = bookingFinanceSummaryCards(
      {
        currency: 'VND',
        paymentMethod: 'MOMO',
        customerPriceAmount: 500000,
        serviceOption: 'Foot Massage / 60 min / qty 1',
        providerPayoutAmount: 380000,
        earningStatus: 'PENDING',
        platformFeeAmount: 120000,
        netHandsFee: '100000 VND',
        withholdingAmount: 20000,
        withholding: '20000 VND on 380000 VND',
        companyFeeAfterTaxAmount: 80000,
        walletTotalAmount: 380000,
      },
      { money },
    );

    expect(cards.map((card) => card.label)).toEqual([
      'Customer charge',
      'Partner payout',
      'HANDS fee',
      'Tax withheld',
      'Company net',
      'Wallet impact',
    ]);
    expect(cards[1].helper).toBe('Earning PENDING');
    expect(cards[5].helper).toBe('Non-cash booking should create payout credit after completion.');
  });

  it('shows projected payout helper when earning is missing', () => {
    const cards = bookingFinanceSummaryCards(
      {
        currency: 'VND',
        paymentMethod: 'MOMO',
        customerPriceAmount: 500000,
        serviceOption: 'Foot Massage / 60 min / qty 1',
        providerPayoutAmount: 380000,
        earningStatus: null,
        platformFeeAmount: 120000,
        netHandsFee: '100000 VND',
        withholdingAmount: 20000,
        withholding: 'Not created',
        companyFeeAfterTaxAmount: 80000,
        walletTotalAmount: 0,
      },
      { money },
    );

    expect(cards[1].helper).toBe('Projected from payout rule.');
  });

  it('shows cash settlement helper for negative and non-negative cash wallet impact', () => {
    const debtCards = bookingFinanceSummaryCards(
      {
        currency: 'VND',
        paymentMethod: 'CASH',
        customerPriceAmount: 500000,
        serviceOption: 'Foot Massage / 60 min / qty 1',
        providerPayoutAmount: 380000,
        earningStatus: 'PENDING',
        platformFeeAmount: 120000,
        netHandsFee: '100000 VND',
        withholdingAmount: 20000,
        withholding: '20000 VND on 380000 VND',
        companyFeeAfterTaxAmount: 80000,
        walletTotalAmount: -120000,
      },
      { money },
    );
    const settledCards = bookingFinanceSummaryCards(
      {
        ...debtCardsInput,
        walletTotalAmount: 0,
      },
      { money },
    );

    expect(debtCards[5].helper).toBe(
      'Cash fee debt gates marketplace participation and payout release.',
    );
    expect(settledCards[5].helper).toBe('Cash settlement ledger is not negative.');
  });
});

const debtCardsInput = {
  currency: 'VND',
  paymentMethod: 'CASH',
  customerPriceAmount: 500000,
  serviceOption: 'Foot Massage / 60 min / qty 1',
  providerPayoutAmount: 380000,
  earningStatus: 'PENDING',
  platformFeeAmount: 120000,
  netHandsFee: '100000 VND',
  withholdingAmount: 20000,
  withholding: '20000 VND on 380000 VND',
  companyFeeAfterTaxAmount: 80000,
};
