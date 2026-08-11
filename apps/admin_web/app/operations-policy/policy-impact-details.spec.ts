import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';
import { policyImpactDetails } from './policy-impact-details';

describe('operations policy impact details', () => {
  it('maps current marketplace keys to the operator impact copy used by legacy saved policy rows', () => {
    const details = policyImpactDetails(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters);

    expect(details.area).toBe('Partner supply');
    expect(details.title).toBe('Controls who can see and participate in marketplace requests');
    expect(details.saveChecks.map((check) => check.href)).toEqual([
      '/operations-policy#matching-stage-impact',
      '/partners?review=ready-now',
    ]);
  });

  it('keeps negative wallet impact copy focused on final acceptance, service start, and cash settlement', () => {
    const details = policyImpactDetails(OPERATIONAL_POLICY_KEYS.walletNegativeGate);

    expect(details.area).toBe('Wallet controls');
    expect(details.detail).toContain('Marketplace requests remain visible');
    expect(details.detail).toContain('final acceptance, service start, and payout release');
    expect(details.saveChecks.map((check) => check.detail).join(' ')).toContain(
      'final acceptance, service start, or payout release',
    );
    expect(details.saveChecks.map((check) => check.detail).join(' ')).not.toContain(
      'marketplace alerts, participation',
    );
    expect(details.saveChecks.map((check) => check.href)).toEqual([
      '/partners?review=cash-debt',
      '/cash-settlements',
    ]);
  });

  it('describes first-pick priority with customer fallback instead of always-customer final choice', () => {
    const details = policyImpactDetails(OPERATIONAL_POLICY_KEYS.preferredAcceptMode);

    expect(details.title).toBe('Controls first-pick priority and customer fallback');
    expect(details.detail).toContain('first-pick Partner can match first');
    expect(details.detail).toContain('customer selects from participating Partners');
  });

  it('keeps marketplace open mode copy explicit about legacy delayed normalization', () => {
    const details = policyImpactDetails(OPERATIONAL_POLICY_KEYS.marketplaceOpenMode);

    expect(details.detail).toContain('Immediate mode keeps marketplace participation parallel');
    expect(details.detail).toContain('Legacy delayed values are normalized');
  });

  it('keeps service area impact copy scoped to Vietnam booking addresses', () => {
    const details = policyImpactDetails(OPERATIONAL_POLICY_KEYS.bookingServiceAreaRequired);

    expect(details.title).toContain('Vietnam service areas');
    expect(details.detail).toContain('confirmed Vietnam service addresses');
    expect(details.saveChecks[0]?.detail).toContain('target Vietnam province or district');
  });

  it('sends missing chat rooms to the booking repair queue', () => {
    const details = policyImpactDetails(OPERATIONAL_POLICY_KEYS.noShowEvidenceRequirement);
    const repairCheck = details.saveChecks.find((check) => check.label === 'Chat repair queue');

    expect(repairCheck).toMatchObject({ href: '/bookings?view=chat-repair' });
  });

  it('returns a safe operations fallback for future policy keys', () => {
    const details = policyImpactDetails('future.policy.key');

    expect(details.area).toBe('Operations');
    expect(details.saveChecks.map((check) => check.href)).toEqual(['/audit-log', '/']);
  });
});
