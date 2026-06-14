import { bookingRecordFinanceRows } from './booking-record-finance-rows';

describe('booking record finance rows', () => {
  it('builds the booking record finance rows from finance trace labels', () => {
    const rows = bookingRecordFinanceRows({
      pricingSource: 'Service payout matrix',
      serviceOption: 'Massage / 60 min / qty 1',
      customerPrice: '500.000 VND',
      adminMinimum: '400.000 VND',
      payoutRuleStatus: '500.000 VND active',
      payoutRuleLine: '500.000 VND customer -> 350.000 VND Partner',
      providerPayout: '350.000 VND',
      platformFee: '150.000 VND logged',
      feeCosts: '10.000 VND VAT / 5.000 VND other',
      netHandsFee: '135.000 VND',
      withholding: '20.000 VND',
      companyFeeAfterTax: '115.000 VND',
      walletLedger: '320.000 VND / 1 entry',
      providerNet: '320.000 VND / AVAILABLE',
    });

    expect(rows).toHaveLength(14);
    expect(rows[0]).toEqual({ label: 'Pricing source', value: 'Service payout matrix' });
    expect(rows.at(-1)).toEqual({ label: 'Partner net', value: '320.000 VND / AVAILABLE' });
  });
});
