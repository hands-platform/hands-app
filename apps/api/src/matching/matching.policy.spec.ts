import { ConfigService } from '@nestjs/config';

import {
  BACKUP_OPEN_AFTER_FIRST_PICK_DELAY,
  BACKUP_OPEN_IMMEDIATE,
  DEFAULT_BOOKING_CURRENT_LOCATION_FRESHNESS_MINUTES,
  DEFAULT_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES,
  DEFAULT_BACKUP_PROVIDER_RADIUS_METERS,
  DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES,
  MATCHING_BACKUP_OPEN_MODE_KEY,
  MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT_KEY,
  MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY,
  MATCHING_MARKETPLACE_OPEN_MODE_KEY,
  MATCHING_MARKETPLACE_PARTNER_INVITATION_LIMIT_KEY,
  MATCHING_MARKETPLACE_PARTNER_LOCATION_MAX_AGE_MINUTES_KEY,
  MATCHING_MARKETPLACE_PARTNER_RADIUS_METERS_KEY,
  MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY,
  MATCH_SOURCE_CUSTOMER_SELECTED_PARTNER,
  MATCH_SOURCE_FIRST_PICK_ACCEPTED_FIRST,
  NOTIFICATION_PARTNER_ALERT_CHANNEL_KEY,
  OPERATIONAL_POLICY_DEFINITIONS,
  PARTNER_ALERT_FCM_FOR_ALL_BOOKINGS,
  PARTNER_ALERT_IN_APP_WITH_PUSH_LATER,
  PARTNER_ALERT_LEGACY_ONESIGNAL_FOR_ALL_BOOKINGS,
  PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
  WALLET_BLOCK_MARKETPLACE_PARTICIPATION,
  WALLET_NEGATIVE_BALANCE_GATE_KEY,
  haversineMeters,
  isFcmPartnerAlertChannel,
  resolveMatchingPolicy,
  resolveMatchingPolicyFromPayload,
  roundTo100Meters,
} from './matching.policy';

function config(values: Record<string, string> = {}) {
  return {
    get: vi.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('matching policy', () => {
  it('keeps HANDS MVP defaults for first-pick and marketplace participation', () => {
    const policy = resolveMatchingPolicy(config());

    expect(policy.providerResponseWindowMinutes).toBe(DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES);
    expect(policy.backupProviderRadiusMeters).toBe(DEFAULT_BACKUP_PROVIDER_RADIUS_METERS);
    expect(policy.backupProviderLocationMaxAgeMinutes).toBe(
      DEFAULT_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES,
    );
    expect(policy.backupProviderLocationMaxAgeMinutes).toBe(90);
    expect(policy.preferredAcceptMode).toBe(PREFERRED_ACCEPT_CUSTOMER_CONFIRM);
    expect(policy.backupOpenMode).toBe(BACKUP_OPEN_IMMEDIATE);
    expect(policy.bookingDistanceGateEnabled).toBe(true);
    expect(policy.bookingServiceAreaRequired).toBe(true);
    expect(policy.bookingMaxCustomerCurrentToAddressKm).toBe(50);
    expect(policy.bookingCurrentLocationFreshnessMinutes).toBe(15);
    expect(DEFAULT_BOOKING_CURRENT_LOCATION_FRESHNESS_MINUTES).toBe(15);
  });

  it('freezes booking match source contract values for API and Admin audit consumers', () => {
    expect(MATCH_SOURCE_FIRST_PICK_ACCEPTED_FIRST).toBe('FIRST_PICK_ACCEPTED_FIRST');
    expect(MATCH_SOURCE_CUSTOMER_SELECTED_PARTNER).toBe('CUSTOMER_SELECTED_PARTNER');
  });

  it('defines negative wallet policy as final acceptance, service start, and payout blocking', () => {
    const definition = OPERATIONAL_POLICY_DEFINITIONS.find(
      (item) => item.key === WALLET_NEGATIVE_BALANCE_GATE_KEY,
    );

    expect(definition?.value).toBe(WALLET_BLOCK_MARKETPLACE_PARTICIPATION);
    expect(definition?.recommendedValue).toBe(WALLET_BLOCK_MARKETPLACE_PARTICIPATION);
    expect(definition?.options?.[0]?.value).toBe(WALLET_BLOCK_MARKETPLACE_PARTICIPATION);
    expect(definition?.label).toBe('Negative wallet final gate');
    expect(JSON.stringify(definition)).toContain('final acceptance');
    expect(JSON.stringify(definition)).toContain('service start');
    expect(JSON.stringify(definition)).toContain('payout release');
    expect(JSON.stringify(definition)).not.toContain('block partner marketplace alerts');
  });

  it('keeps operational policy copy factual instead of scoring people', () => {
    const serializedPolicyCopy = JSON.stringify(OPERATIONAL_POLICY_DEFINITIONS);

    expect(serializedPolicyCopy).not.toMatch(/\b(penalty|penalties|risk|score|rank)\b/i);
  });

  it('registers editable Start Shift queue SLAs with bounded minute values', () => {
    const definitions = OPERATIONAL_POLICY_DEFINITIONS.filter((definition) =>
      definition.key.startsWith('command.start_shift.'),
    );

    expect(definitions).toHaveLength(7);
    expect(definitions.every((definition) => definition.category === 'Command center')).toBe(true);
    expect(definitions.every((definition) => definition.unit === 'minutes')).toBe(true);
    expect(definitions.every((definition) => definition.enforced)).toBe(true);
  });

  it('labels partner alert routing with FCM-ready Admin copy', () => {
    const definition = OPERATIONAL_POLICY_DEFINITIONS.find(
      (item) => item.key === NOTIFICATION_PARTNER_ALERT_CHANNEL_KEY,
    );

    expect(definition?.label).toBe('Partner alert routing');
    expect(definition?.options?.[0]?.label).toBe('In-app now, FCM push later');
    expect(JSON.stringify(definition)).not.toContain('OS push');
  });

  it('treats only FCM and deprecated saved push values as FCM partner alert routes', () => {
    expect(isFcmPartnerAlertChannel(PARTNER_ALERT_FCM_FOR_ALL_BOOKINGS)).toBe(true);
    expect(isFcmPartnerAlertChannel(PARTNER_ALERT_LEGACY_ONESIGNAL_FOR_ALL_BOOKINGS)).toBe(true);
    expect(isFcmPartnerAlertChannel(PARTNER_ALERT_IN_APP_WITH_PUSH_LATER)).toBe(false);
    expect(isFcmPartnerAlertChannel('onesignal')).toBe(false);
    expect(isFcmPartnerAlertChannel(undefined)).toBe(false);
  });

  it('normalizes legacy delayed marketplace settings to immediate participation', () => {
    const policy = resolveMatchingPolicy(config(), {
      [MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY]: 15,
      [MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY]: 12000,
      [MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT_KEY]: 75,
      [MATCHING_BACKUP_OPEN_MODE_KEY]: BACKUP_OPEN_AFTER_FIRST_PICK_DELAY,
    });

    expect(policy.providerResponseWindowMinutes).toBe(15);
    expect(policy.backupProviderRadiusMeters).toBe(12000);
    expect(policy.backupProviderInvitationLimit).toBe(75);
    expect(policy.backupOpenMode).toBe(BACKUP_OPEN_IMMEDIATE);
  });

  it('prefers current marketplace policy keys while normalizing legacy delayed values', () => {
    const policy = resolveMatchingPolicy(config(), {
      [MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY]: 9000,
      [MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT_KEY]: 12,
      [MATCHING_BACKUP_OPEN_MODE_KEY]: BACKUP_OPEN_IMMEDIATE,
      [MATCHING_MARKETPLACE_PARTNER_RADIUS_METERS_KEY]: 13000,
      [MATCHING_MARKETPLACE_PARTNER_LOCATION_MAX_AGE_MINUTES_KEY]: 25,
      [MATCHING_MARKETPLACE_PARTNER_INVITATION_LIMIT_KEY]: 30,
      [MATCHING_MARKETPLACE_OPEN_MODE_KEY]: BACKUP_OPEN_AFTER_FIRST_PICK_DELAY,
    });

    expect(policy.backupProviderRadiusMeters).toBe(13000);
    expect(policy.backupProviderLocationMaxAgeMinutes).toBe(25);
    expect(policy.backupProviderInvitationLimit).toBe(30);
    expect(policy.backupOpenMode).toBe(BACKUP_OPEN_IMMEDIATE);
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

  it('hydrates matching policy from current marketplace payload keys', () => {
    const policy = resolveMatchingPolicyFromPayload({
      matchingPolicy: {
        providerResponseWindowMinutes: 12,
        marketplaceRadiusMeters: 5000,
        travelBufferMinutes: 30,
        marketplaceLocationMaxAgeMinutes: 20,
        marketplaceInvitationLimit: 25,
        bookingMaxCustomerCurrentToAddressKm: 20,
        bookingMaxPreferredProviderDistanceKm: 50,
        bookingCurrentLocationFreshnessMinutes: 10,
        bookingDistanceGateEnabled: true,
        bookingServiceAreaRequired: true,
        preferredAcceptMode: PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
        marketplaceOpenMode: BACKUP_OPEN_IMMEDIATE,
      },
    });

    expect(policy?.providerResponseWindowMinutes).toBe(12);
    expect(policy?.backupProviderRadiusMeters).toBe(5000);
    expect(policy?.backupProviderLocationMaxAgeMinutes).toBe(20);
    expect(policy?.backupProviderInvitationLimit).toBe(25);
    expect(policy?.backupOpenMode).toBe(BACKUP_OPEN_IMMEDIATE);
  });

  it('normalizes delayed marketplace payload snapshots to immediate participation', () => {
    const policy = resolveMatchingPolicyFromPayload({
      matchingPolicy: {
        providerResponseWindowMinutes: 12,
        marketplaceRadiusMeters: 5000,
        travelBufferMinutes: 30,
        marketplaceLocationMaxAgeMinutes: 20,
        marketplaceInvitationLimit: 25,
        bookingMaxCustomerCurrentToAddressKm: 20,
        bookingMaxPreferredProviderDistanceKm: 50,
        bookingCurrentLocationFreshnessMinutes: 10,
        bookingDistanceGateEnabled: true,
        bookingServiceAreaRequired: true,
        preferredAcceptMode: PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
        marketplaceOpenMode: BACKUP_OPEN_AFTER_FIRST_PICK_DELAY,
      },
    });

    expect(policy?.backupOpenMode).toBe(BACKUP_OPEN_IMMEDIATE);
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
