import { bookingMatchingPolicySnapshot } from './booking-matching-policy-snapshot';

describe('bookingMatchingPolicySnapshot', () => {
  it('returns null when booking metadata has no matching policy snapshot', () => {
    expect(bookingMatchingPolicySnapshot({ metadata: null })).toBeNull();
    expect(bookingMatchingPolicySnapshot({ metadata: { bookingGate: {} } })).toBeNull();
  });

  it('reads current marketplace policy snapshot keys first', () => {
    expect(
      bookingMatchingPolicySnapshot({
        metadata: {
          matchingPolicy: {
            providerResponseWindowMinutes: '12',
            marketplaceRadiusMeters: '15000',
            marketplaceLocationMaxAgeMinutes: 25,
            marketplaceInvitationLimit: 40,
            marketplaceOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
            preferredAcceptMode: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
            travelBufferMinutes: '30',
          },
        },
      }),
    ).toEqual({
      providerResponseWindowMinutes: 12,
      backupProviderRadiusMeters: 15000,
      backupProviderLocationMaxAgeMinutes: 25,
      backupProviderInvitationLimit: 40,
      preferredAcceptMode: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
      backupOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
      travelBufferMinutes: 30,
    });
  });

  it('falls back to legacy backup policy snapshot keys', () => {
    expect(
      bookingMatchingPolicySnapshot({
        metadata: {
          matchingPolicy: {
            backupProviderRadiusMeters: 10000,
            backupProviderLocationMaxAgeMinutes: '30',
            backupProviderInvitationLimit: '50',
            backupOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
          },
        },
      }),
    ).toMatchObject({
      backupProviderRadiusMeters: 10000,
      backupProviderLocationMaxAgeMinutes: 30,
      backupProviderInvitationLimit: 50,
      backupOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
    });
  });
});
