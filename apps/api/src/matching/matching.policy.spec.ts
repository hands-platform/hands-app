import { ConfigService } from '@nestjs/config';

import {
  BACKUP_OPEN_AFTER_FIRST_PICK_DELAY,
  BACKUP_OPEN_IMMEDIATE,
  DEFAULT_BACKUP_PROVIDER_RADIUS_METERS,
  DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES,
  MATCHING_BACKUP_OPEN_MODE_KEY,
  MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT_KEY,
  MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY,
  MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY,
  OPERATIONAL_POLICY_DEFINITIONS,
  PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
  WALLET_BLOCK_MARKETPLACE_PARTICIPATION,
  WALLET_NEGATIVE_BALANCE_GATE_KEY,
  haversineMeters,
  resolveMatchingPolicy,
  resolveMatchingPolicyFromPayload,
  roundTo100Meters,
} from './matching.policy';

function config(values: Record<string, string> = {}) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('matching policy', () => {
  it('keeps HANDS MVP defaults for first-pick and marketplace participation', () => {
    const policy = resolveMatchingPolicy(config());

    expect(policy.providerResponseWindowMinutes).toBe(DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES);
    expect(policy.backupProviderRadiusMeters).toBe(DEFAULT_BACKUP_PROVIDER_RADIUS_METERS);
    expect(policy.preferredAcceptMode).toBe(PREFERRED_ACCEPT_CUSTOMER_CONFIRM);
    expect(policy.backupOpenMode).toBe(BACKUP_OPEN_IMMEDIATE);
    expect(policy.bookingDistanceGateEnabled).toBe(true);
    expect(policy.bookingServiceAreaRequired).toBe(true);
  });

  it('defines negative wallet policy as marketplace participation blocking', () => {
    const definition = OPERATIONAL_POLICY_DEFINITIONS.find(
      (item) => item.key === WALLET_NEGATIVE_BALANCE_GATE_KEY,
    );

    expect(definition?.value).toBe(WALLET_BLOCK_MARKETPLACE_PARTICIPATION);
    expect(definition?.recommendedValue).toBe(WALLET_BLOCK_MARKETPLACE_PARTICIPATION);
    expect(definition?.options?.[0]?.value).toBe(WALLET_BLOCK_MARKETPLACE_PARTICIPATION);
    expect(definition?.label).toBe('Negative wallet marketplace gate');
  });

  it('allows operations settings while keeping configured bounds', () => {
    const policy = resolveMatchingPolicy(config(), {
      [MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY]: 15,
      [MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY]: 12000,
      [MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT_KEY]: 75,
      [MATCHING_BACKUP_OPEN_MODE_KEY]: BACKUP_OPEN_AFTER_FIRST_PICK_DELAY,
    });

    expect(policy.providerResponseWindowMinutes).toBe(15);
    expect(policy.backupProviderRadiusMeters).toBe(12000);
    expect(policy.backupProviderInvitationLimit).toBe(75);
    expect(policy.backupOpenMode).toBe(BACKUP_OPEN_AFTER_FIRST_PICK_DELAY);
  });

  it('falls back when operations settings exceed policy bounds', () => {
    const policy = resolveMatchingPolicy(config(), {
      [MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY]: 2,
      [MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY]: 999999,
      [MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT_KEY]: 0,
    });

    expect(policy.providerResponseWindowMinutes).toBe(DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES);
    expect(policy.backupProviderRadiusMeters).toBe(DEFAULT_BACKUP_PROVIDER_RADIUS_METERS);
    expect(policy.backupProviderInvitationLimit).toBe(50);
  });

  it('rounds partner distance to 100 meters for customer-facing marketplace data', () => {
    const distance = haversineMeters(10.7769, 106.7009, 10.7814, 106.7051);

    expect(roundTo100Meters(distance)).toBe(700);
  });

  it('hydrates matching policy from persisted active matching payload snapshots', () => {
    const policy = resolveMatchingPolicyFromPayload({
      matchingPolicy: {
        preferredProviderResponseWindowMinutes: 12,
        backupProviderRadiusMeters: 10000,
        travelBufferMinutes: 30,
        backupProviderLocationMaxAgeMinutes: 30,
        backupProviderInvitationLimit: 50,
        bookingMaxCustomerCurrentToAddressKm: 20,
        bookingMaxPreferredProviderDistanceKm: 50,
        bookingCurrentLocationFreshnessMinutes: 10,
        bookingDistanceGateEnabled: false,
        bookingServiceAreaRequired: false,
        preferredAcceptMode: PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
        backupOpenMode: BACKUP_OPEN_IMMEDIATE,
      },
    });

    expect(policy?.providerResponseWindowMinutes).toBe(12);
    expect(policy?.backupProviderRadiusMeters).toBe(10000);
    expect(policy?.bookingDistanceGateEnabled).toBe(false);
    expect(policy?.bookingServiceAreaRequired).toBe(false);
    expect(policy?.preferredAcceptMode).toBe(PREFERRED_ACCEPT_CUSTOMER_CONFIRM);
  });

  it('ignores malformed active matching policy snapshots so live policy is used instead', () => {
    expect(resolveMatchingPolicyFromPayload(null)).toBeUndefined();
    expect(resolveMatchingPolicyFromPayload({ matchingPolicy: null })).toBeUndefined();
    expect(
      resolveMatchingPolicyFromPayload({
        matchingPolicy: {
          preferredProviderResponseWindowMinutes: null,
          backupProviderRadiusMeters: 10000,
          travelBufferMinutes: 30,
          backupProviderLocationMaxAgeMinutes: 30,
          backupProviderInvitationLimit: 50,
          preferredAcceptMode: PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
          backupOpenMode: BACKUP_OPEN_IMMEDIATE,
        },
      }),
    ).toBeUndefined();
  });
});
