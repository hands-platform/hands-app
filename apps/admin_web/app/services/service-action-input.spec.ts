import {
  hasInvalidBulkPayoutRules,
  isValidServicePayout,
  isValidServicePriceStep,
  parseBulkPayoutRules,
  parseServiceInteger,
} from './service-action-input';

describe('service action input helpers', () => {
  it('parses integer form values without accepting decimals or empty input', () => {
    expect(parseServiceInteger('100000')).toBe(100000);
    expect(parseServiceInteger(' 120000 ')).toBe(120000);
    expect(parseServiceInteger('120000.5')).toBeNull();
    expect(parseServiceInteger('')).toBeNull();
    expect(parseServiceInteger(null)).toBeNull();
  });

  it('validates service price steps', () => {
    expect(isValidServicePriceStep(300000, 100000)).toBe(true);
    expect(isValidServicePriceStep(350000, 100000)).toBe(false);
    expect(isValidServicePriceStep(300000, 50000)).toBe(false);
    expect(isValidServicePriceStep(0, 100000)).toBe(false);
  });

  it('validates provider payout against customer price', () => {
    expect(isValidServicePayout(null, 300000)).toBe(true);
    expect(isValidServicePayout(0, 300000)).toBe(true);
    expect(isValidServicePayout(250000, 300000)).toBe(true);
    expect(isValidServicePayout(350000, 300000)).toBe(false);
    expect(isValidServicePayout(-1, 300000)).toBe(false);
  });

  it('parses comma and tab separated payout ladders', () => {
    expect(parseBulkPayoutRules('300000,210000\r\n400000\t280000\n')).toEqual([
      { customerPrice: 300000, providerPayoutAmount: 210000 },
      { customerPrice: 400000, providerPayoutAmount: 280000 },
    ]);
  });

  it('flags invalid bulk payout ladders', () => {
    expect(hasInvalidBulkPayoutRules([])).toBe(true);
    expect(hasInvalidBulkPayoutRules([{ customerPrice: null, providerPayoutAmount: 100000 }])).toBe(true);
    expect(hasInvalidBulkPayoutRules([{ customerPrice: 300000, providerPayoutAmount: null }])).toBe(true);
    expect(hasInvalidBulkPayoutRules([{ customerPrice: 300000, providerPayoutAmount: 350000 }])).toBe(true);
    expect(hasInvalidBulkPayoutRules([{ customerPrice: 300000, providerPayoutAmount: 210000 }])).toBe(false);
  });
});
