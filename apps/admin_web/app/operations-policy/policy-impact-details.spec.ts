import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';
import { policyImpactDetails } from './policy-impact-details';

describe('operations policy impact details', () => {
  it('maps current marketplace keys to the operator impact copy used by legacy saved policy rows', () => {
    const details = policyImpactDetails(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters);

    expect(details.area).toBe('Partner supply');
    expect(details.title).toBe('Controls who can see and participate in marketplace requests');
    expect(details.saveChecks.map((check) => check.href)).toEqual([
      '/operations-policy#matching-stage-impact',
      '/partners?review=marketplace-ready',
    ]);
  });

  it('keeps negative wallet impact copy focused on marketplace participation and cash settlement', () => {
    const details = policyImpactDetails(OPERATIONAL_POLICY_KEYS.walletNegativeGate);

    expect(details.area).toBe('Wallet controls');
    expect(details.detail).toContain('Marketplace requests remain visible');
    expect(details.detail).toContain('participation and downstream booking gates stay blocked');
    expect(details.saveChecks.map((check) => check.href)).toEqual([
      '/partners?review=cash-debt',
      '/cash-settlements',
    ]);
  });

  it('returns a safe operations fallback for future policy keys', () => {
    const details = policyImpactDetails('future.policy.key');

    expect(details.area).toBe('Operations');
    expect(details.saveChecks.map((check) => check.href)).toEqual(['/audit-log', '/']);
  });
});
