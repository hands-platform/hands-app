import { PartnerTaxLineKind, TaxRuleScope } from '@prisma/client';

import { calculatePartnerTaxWithholding } from './tax-policy-withholding';

const baseRule = {
  fixedAmount: 0,
  maxGrossAmount: null,
  minGrossAmount: null,
  rateBps: 500,
  serviceType: null,
  taxKind: PartnerTaxLineKind.PARTNER_WITHHOLDING_COMBINED,
};

describe('tax policy withholding calculation', () => {
  it('uses service, inclusive amount band, then fallback priority', () => {
    const rules = [
      { ...baseRule, id: 'fallback', scope: TaxRuleScope.DEFAULT },
      { ...baseRule, id: 'band', scope: TaxRuleScope.AMOUNT_BAND, minGrossAmount: 500_000, maxGrossAmount: 700_000, rateBps: 600 },
      { ...baseRule, id: 'service', scope: TaxRuleScope.SERVICE_TYPE, serviceType: 'leg_massage', rateBps: 700 },
    ];

    expect(calculatePartnerTaxWithholding(rules, { grossAmount: 500_000, serviceTypes: ['leg_massage'] }))
      .toMatchObject({ amount: 35_000, combined: { rule: { id: 'service' } } });
    expect(calculatePartnerTaxWithholding(rules, { grossAmount: 500_000, serviceTypes: ['other'] }))
      .toMatchObject({ amount: 30_000, combined: { rule: { id: 'band' } } });
    expect(calculatePartnerTaxWithholding(rules, { grossAmount: 499_999, serviceTypes: ['other'] }))
      .toMatchObject({ amount: 25_000, combined: { rule: { id: 'fallback' } } });
  });

  it('uses split VAT and PIT lines instead of a combined rule', () => {
    const rules = [
      { ...baseRule, id: 'combined', scope: TaxRuleScope.DEFAULT },
      { ...baseRule, id: 'vat', scope: TaxRuleScope.DEFAULT, taxKind: PartnerTaxLineKind.PARTNER_VAT, rateBps: 300 },
      { ...baseRule, id: 'pit', scope: TaxRuleScope.DEFAULT, taxKind: PartnerTaxLineKind.PARTNER_PIT, rateBps: 200 },
    ];

    expect(calculatePartnerTaxWithholding(rules, { grossAmount: 1_000_000, serviceTypes: ['leg_massage'] }))
      .toMatchObject({ amount: 50_000, combined: null, vat: { amount: 30_000 }, pit: { amount: 20_000 } });
  });
});
