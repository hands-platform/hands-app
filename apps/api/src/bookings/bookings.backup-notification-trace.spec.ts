import {
  appendBackupNotificationTrace,
  backupAlertPolicyMetadata,
  backupNotificationTrace,
} from './bookings.backup-notification-trace';

describe('booking backup notification trace', () => {
  it('keeps current marketplace metadata with legacy backup aliases', () => {
    expect(
      backupAlertPolicyMetadata({
        backupOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
        backupProviderInvitationLimit: 20,
        backupProviderRadiusMeters: 8000,
      }),
    ).toEqual({
      marketplaceRadiusMeters: 8000,
      marketplaceOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
      marketplaceInvitationLimit: 20,
      backupProviderRadiusMeters: 8000,
      backupOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
      backupProviderInvitationLimit: 20,
    });
  });

  it('builds trace counters from notified providers and websocket targets', () => {
    const alertPolicy = backupAlertPolicyMetadata({
      backupOpenMode: 'AFTER_FIRST_PICK_DELAY',
      backupProviderInvitationLimit: 10,
      backupProviderRadiusMeters: 12000,
    });

    expect(
      backupNotificationTrace({
        stage: 'first_pick_declined',
        alertPolicy,
        createdAt: new Date('2026-06-11T00:00:00.000Z'),
        notifiedProviders: [
          {
            distanceMeters: 500,
            notificationId: 'notification-1',
            providerProfileId: 'provider-1',
            userId: 'user-1',
          },
        ],
        websocketTargetCount: 3,
      }),
    ).toEqual({
      stage: 'first_pick_declined',
      createdAt: '2026-06-11T00:00:00.000Z',
      notifiedCount: 1,
      ...alertPolicy,
      websocketTargetCount: 3,
      providers: [
        {
          distanceMeters: 500,
          notificationId: 'notification-1',
          providerProfileId: 'provider-1',
          userId: 'user-1',
        },
      ],
    });
  });

  it('appends traces while keeping only the latest twelve metadata entries', () => {
    const oldTraces = Array.from({ length: 12 }, (_, index) => ({
      stage: `old-${index}`,
      notifiedCount: index,
    }));
    const trace = backupNotificationTrace({
      stage: 'initial_open',
      alertPolicy: backupAlertPolicyMetadata({
        backupOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
        backupProviderInvitationLimit: 5,
        backupProviderRadiusMeters: 6000,
      }),
      createdAt: new Date('2026-06-11T01:00:00.000Z'),
      notifiedProviders: [],
      websocketTargetCount: 0,
    });

    expect(
      appendBackupNotificationTrace({ existing: true, backupNotificationTraces: oldTraces }, trace),
    ).toEqual({
      existing: true,
      backupNotificationTraces: [...oldTraces.slice(1), trace],
    });
  });
});
