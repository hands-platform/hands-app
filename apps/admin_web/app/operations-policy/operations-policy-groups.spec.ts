import type { AdminOperationalPolicySetting } from '../../lib/admin-api';
import {
  OPERATIONS_POLICY_GROUPS,
  buildOperationsPolicyGroups,
  isOperationsPolicyDeviation,
  normalizeOperationsPolicyLifecycle,
  operationsPolicyCounts,
} from './operations-policy-groups';

describe('operations policy groups', () => {
  it('maps all 28 live policy keys exactly once', () => {
    const keys = OPERATIONS_POLICY_GROUPS.flatMap((group) => group.keys);

    expect(keys).toHaveLength(28);
    expect(new Set(keys)).toHaveLength(28);
    expect(OPERATIONS_POLICY_GROUPS.map((group) => group.keys.length)).toEqual([7, 5, 7, 3, 5, 1]);
  });

  it('separates current deviations from policies changed before', () => {
    const alignedChanged = policy({ key: OPERATIONS_POLICY_GROUPS[0].keys[0], updatedAt: '2026-08-11T00:00:00Z' });
    const deviation = policy({ key: OPERATIONS_POLICY_GROUPS[0].keys[1], value: 12 });

    expect(isOperationsPolicyDeviation(alignedChanged)).toBe(false);
    expect(operationsPolicyCounts([alignedChanged, deviation])).toEqual({
      changedCount: 1,
      deviationCount: 1,
      enforcedCount: 2,
      lifecycleCounts: { deprecated: 0, live: 2, locked: 0, planned: 0, unknown: 0 },
      provenanceCounts: { automatedSmoke: 0, legacyUnknown: 0, operator: 0, unattributed: 1 },
      totalCount: 2,
    });
  });

  it('fails closed when lifecycle metadata is missing instead of inferring live from enforced', () => {
    const missingLifecycle = policy({ lifecycle: undefined });

    expect(operationsPolicyCounts([missingLifecycle])).toMatchObject({
      enforcedCount: 0,
      lifecycleCounts: { live: 0, unknown: 1 },
    });
  });

  it('filters by operator group, status, label, and description', () => {
    const settings = [
      policy({ key: OPERATIONS_POLICY_GROUPS[2].keys[0], label: 'Response window', value: 12 }),
      policy({
        description: 'Radius around service address',
        key: OPERATIONS_POLICY_GROUPS[2].keys[1],
        label: 'Marketplace radius',
      }),
    ];

    expect(buildOperationsPolicyGroups(settings, { group: 'matching-availability' })[0].rows).toHaveLength(2);
    expect(buildOperationsPolicyGroups(settings, { query: 'service address' })[0].rows[0].label).toBe('Marketplace radius');
    expect(buildOperationsPolicyGroups(settings, { status: 'needs-review' })[0].rows[0].label).toBe('Response window');
  });

  it('filters by explicit lifecycle and normalizes unsupported values to all', () => {
    const settings = [
      policy({ key: OPERATIONS_POLICY_GROUPS[2].keys[0], lifecycle: 'live' }),
      policy({ key: OPERATIONS_POLICY_GROUPS[2].keys[1], lifecycle: 'locked' }),
    ];

    expect(buildOperationsPolicyGroups(settings, { lifecycle: 'locked' })[0].rows).toHaveLength(1);
    expect(buildOperationsPolicyGroups(settings, { lifecycle: 'locked' })[0].rows[0].lifecycle).toBe('locked');
    expect(normalizeOperationsPolicyLifecycle('unsafe')).toBe('all');
  });
});

function policy(overrides: Partial<AdminOperationalPolicySetting>): AdminOperationalPolicySetting {
  return {
    category: 'Matching',
    description: 'Policy description',
    enforced: true,
    lifecycle: 'live',
    key: 'policy.key',
    label: 'Policy label',
    recommendedValue: 10,
    value: 10,
    ...overrides,
  };
}
