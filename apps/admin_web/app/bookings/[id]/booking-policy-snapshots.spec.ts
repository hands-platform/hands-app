import type { AdminBookingDetail } from '../../../lib/admin-api';
import { readBookingMatchingPolicySnapshot } from './booking-policy-snapshots';

function booking(metadata: unknown): AdminBookingDetail {
  return {
    id: 'booking-policy-snapshot',
    status: 'OPEN_MATCHING',
    metadata,
  } as AdminBookingDetail;
}

describe('booking policy snapshots', () => {
  it('prefers current marketplace policy fields while keeping legacy readout fields populated', () => {
    const snapshot = readBookingMatchingPolicySnapshot(
      booking({
        matchingPolicy: {
          providerResponseWindowMinutes: 10,
          marketplaceRadiusMeters: 5000,
          marketplaceLocationMaxAgeMinutes: 20,
          marketplaceInvitationLimit: 25,
          marketplaceOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
          backupProviderRadiusMeters: 10000,
          backupProviderLocationMaxAgeMinutes: 30,
          backupProviderInvitationLimit: 50,
          backupOpenMode: 'AFTER_FIRST_PICK_DELAY',
        },
      }),
    );

    expect(snapshot).toMatchObject({
      backupProviderRadiusMeters: 5000,
      backupProviderLocationMaxAgeMinutes: 20,
      backupProviderInvitationLimit: 25,
      backupOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
    });
  });

  it('falls back to legacy backup fields for older booking records', () => {
    const snapshot = readBookingMatchingPolicySnapshot(
      booking({
        matchingPolicy: {
          backupProviderRadiusMeters: 9000,
          backupProviderLocationMaxAgeMinutes: 45,
          backupProviderInvitationLimit: 12,
          backupOpenMode: 'AFTER_FIRST_PICK_DELAY',
        },
      }),
    );

    expect(snapshot).toMatchObject({
      backupProviderRadiusMeters: 9000,
      backupProviderLocationMaxAgeMinutes: 45,
      backupProviderInvitationLimit: 12,
      backupOpenMode: 'AFTER_FIRST_PICK_DELAY',
    });
  });
});
