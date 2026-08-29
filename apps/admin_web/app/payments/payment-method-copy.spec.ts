import { paymentProviderReferenceCopy } from './payment-method-copy';

describe('payment provider reference copy', () => {
  it.each([
    ['CUSTOMER_WALLET', null, 'Internal wallet ledger'],
    ['CASH', null, 'Not applicable to cash payment'],
    ['MANUAL', null, 'Not applicable to manual payment'],
    ['MOMO', null, 'No gateway reference'],
    ['MOMO', 'momo-reference-1', 'momo-reference-1'],
  ])('uses method-aware copy for %s', (method, providerRef, expected) => {
    expect(paymentProviderReferenceCopy(method, providerRef)).toBe(expected);
  });
});
