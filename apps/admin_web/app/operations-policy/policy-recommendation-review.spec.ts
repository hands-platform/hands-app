import type { AdminBooking, AdminOperationalPolicySetting } from '../../lib/admin-api';
import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';
import { buildPolicyRecommendationReview } from './policy-recommendation-review';

describe('policy recommendation review builder', () => {
  it('marks aligned recommended policies as clean', () => {
    const review = buildPolicyRecommendationReview(
      [
        setting(OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes, 10, {
          recommendedValue: 10,
          unit: 'minutes',
        }),
      ],
      [],
    );

    expect(review.warningCount).toBe(0);
    expect(review.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Compared policies', value: '1' }),
        expect.objectContaining({ label: 'Owner choices', value: '0' }),
        expect.objectContaining({ label: 'Live deviations', value: '0' }),
      ]),
    );
    expect(review.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          className: 'ops-task-done',
          detail: 'Current value matches the recommended baseline: 10 min.',
          pillClass: 'pill-success',
          status: 'Recommended',
        }),
      ]),
    );
  });

  it('summarizes live deviations and policy-specific operator posture', () => {
    const review = buildPolicyRecommendationReview(
      [
        setting(OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes, 5, {
          recommendedValue: 10,
          unit: 'minutes',
        }),
        setting(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters, 5000, {
          recommendedValue: 10000,
          unit: 'meters',
        }),
        setting(OPERATIONAL_POLICY_KEYS.preferredAcceptMode, 'AUTO_MATCH_ON_ACCEPT', {
          recommendedValue: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
        }),
        setting(OPERATIONAL_POLICY_KEYS.walletNegativeGate, 'LEGACY_ALLOW_WITH_DEBT', {
          recommendedValue: 'BLOCK_MARKETPLACE_PARTICIPATION',
        }),
        setting('decision.owner_note', 'DRAFT', {
          category: 'Decision',
          enforced: false,
          recommendedValue: 'APPROVED',
        }),
      ],
      [booking('OPEN_MATCHING'), booking('MATCHED'), booking('CLOSED')],
    );

    expect(review.warningCount).toBe(5);
    expect(review.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Compared policies', value: '5' }),
        expect.objectContaining({ label: 'Owner choices', value: '5' }),
        expect.objectContaining({ label: 'Live deviations', value: '4' }),
        expect.objectContaining({ label: 'Active bookings', value: '2' }),
      ]),
    );
    expect(review.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          className: 'ops-task-pending',
          status: 'Faster than baseline',
        }),
        expect.objectContaining({
          className: 'ops-task-blocked',
          status: 'Narrow supply',
        }),
        expect.objectContaining({
          status: 'Historical value ignored',
        }),
        expect.objectContaining({
          className: 'ops-task-blocked',
          status: 'Historical setting review',
        }),
        expect.objectContaining({
          className: 'ops-task-done',
          status: 'Planning choice',
        }),
      ]),
    );
  });

  it('describes location freshness as distance-sensitive marketplace matching readiness', () => {
    const review = buildPolicyRecommendationReview(
      [
        setting(OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes, 10, {
          recommendedValue: 30,
          unit: 'minutes',
        }),
      ],
      [booking('OPEN_MATCHING')],
    );

    expect(review.cards[0]).toMatchObject({
      detail: expect.stringContaining(
        'Only recently refreshed partner locations are eligible for distance-sensitive marketplace matching.',
      ),
    });
    expect(review.cards[0]?.detail).not.toContain('marketplace alerts and participation');
  });
});

function setting(
  key: string,
  value: string | number | boolean,
  overrides: Partial<AdminOperationalPolicySetting> = {},
): AdminOperationalPolicySetting {
  return {
    category: 'Matching',
    enforced: true,
    key,
    label: key,
    value,
    ...overrides,
  } as AdminOperationalPolicySetting;
}

function booking(status: string): AdminBooking {
  return {
    id: status,
    status,
  } as AdminBooking;
}
