import { bookingServicePricingSnapshotRows } from './booking-service-pricing-snapshot-rows';

const baseInput = {
  serviceOption: 'Massage / 60 min / qty 1',
  customerPrice: '500.000 VND',
  adminMinimum: '400.000 VND',
  payoutRuleStatus: '500.000 VND active',
  payoutRuleLine: '500.000 VND customer -> 350.000 VND Partner',
  earningStatus: 'AVAILABLE',
  providerPayout: '350.000 VND',
  providerNet: '320.000 VND / AVAILABLE',
  platformFee: '150.000 VND logged',
  feeCosts: '10.000 VND VAT / 5.000 VND other',
  netHandsFee: '135.000 VND',
  withholding: '20.000 VND',
  companyFeeAfterTax: '115.000 VND',
  walletLedger: '320.000 VND / 1 entry',
  paymentMethod: 'MOMO',
};

describe('booking service pricing snapshot rows', () => {
  it('builds the service pricing and payout evidence rows', () => {
    expect(bookingServicePricingSnapshotRows(baseInput).map((row) => row.label)).toEqual([
      'Service option',
      'Customer price',
      'Payout rule',
      'Partner payout',
      'HANDS fee',
      'Tax and withholding',
      'Wallet impact',
    ]);
  });

  it('uses cash-specific wallet helper copy for cash bookings', () => {
    const cashRow = bookingServicePricingSnapshotRows({ ...baseInput, paymentMethod: 'CASH' }).at(-1);
    const nonCashRow = bookingServicePricingSnapshotRows(baseInput).at(-1);

    expect(cashRow?.helper).toBe('Cash bookings can create Partner fee debt until settled.');
    expect(nonCashRow?.helper).toBe('Non-cash bookings should create a payout credit after completion.');
  });

  it('labels a rule-derived amount as projected when no earning exists', () => {
    const payoutRow = bookingServicePricingSnapshotRows({ ...baseInput, earningStatus: null })[3];

    expect(payoutRow).toMatchObject({ label: 'Projected payout', value: '350.000 VND' });
  });
});
