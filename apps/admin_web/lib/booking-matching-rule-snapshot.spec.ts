import {
  buildBookingMatchingRuleSnapshot,
  matchingPolicySummaryLabel,
  type BookingMatchingPolicySnapshot,
} from './booking-matching-rule-snapshot';

const savedPolicy: BookingMatchingPolicySnapshot = {
  backupOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
  backupProviderInvitationLimit: 8,
  backupProviderLocationMaxAgeMinutes: 12,
  backupProviderRadiusMeters: 6_500,
  preferredAcceptMode: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
  providerResponseWindowMinutes: 7,
  travelBufferMinutes: 20,
};

describe('matchingPolicySummaryLabel', () => {
  it('describes saved marketplace policy without changing booking authority copy', () => {
    expect(matchingPolicySummaryLabel(savedPolicy)).toBe(
      'Saved policy: 7m / 6.5km / 12m fresh / 8 invite cap / marketplace immediate / first-pick accept matches / customer fallback',
    );
  });

  it('uses the live policy default label when no saved snapshot exists', () => {
    expect(matchingPolicySummaryLabel(null)).toBe('Matching policy: live policy default');
  });

  it('labels legacy delayed marketplace snapshots as normalized immediate behavior', () => {
    expect(
      matchingPolicySummaryLabel({
        ...savedPolicy,
        backupOpenMode: 'AFTER_FIRST_PICK_DELAY',
      }),
    ).toContain('marketplace immediate (legacy normalized)');
  });
});

describe('buildBookingMatchingRuleSnapshot', () => {
  it('builds open matching rule labels from booking facts', () => {
    const snapshot = buildBookingMatchingRuleSnapshot({
      hasChatRoom: false,
      isTerminalStatus: false,
      marketplaceCount: 2,
      openMatchingWindowLabel: '4m left',
      policy: null,
      selectableCount: 1,
      selectedPartnerLabel: null,
      status: 'OPEN_MATCHING',
      totalNotified: 5,
    });

    expect(snapshot).toEqual({
      sourceLabel: 'Default MVP rule',
      sourceTone: 'pill-warn',
      windowLabel: 'First-pick window: 10m / 4m left',
      radiusLabel: 'Marketplace radius: 10 km from booking address',
      supplyLabel: 'Marketplace supply: 2 participants / 1 selectable / 5 notified',
      customerChoiceLabel:
        'Customer final choice: waiting, 1 selectable Partner(s); no automatic assignment',
      operatorAction:
        'Customer fallback selection is needed because first-pick did not validly win; do not auto-assign.',
    });
  });

  it('keeps matched bookings focused on chat handoff state', () => {
    const snapshot = buildBookingMatchingRuleSnapshot({
      hasChatRoom: false,
      isTerminalStatus: false,
      marketplaceCount: 0,
      openMatchingWindowLabel: 'window pending',
      policy: savedPolicy,
      selectableCount: 0,
      selectedPartnerLabel: 'Partner Linh',
      status: 'MATCHED',
      totalNotified: 0,
    });

    expect(snapshot.windowLabel).toBe('First-pick window: 7m / final Partner selected');
    expect(snapshot.customerChoiceLabel).toBe(
      'Customer final choice: Partner Linh; no automatic assignment',
    );
    expect(snapshot.operatorAction).toBe(
      'Final Partner exists. Repair or create chat before service movement continues.',
    );
  });
});
