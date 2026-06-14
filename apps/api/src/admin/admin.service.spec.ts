import { BookingMatchSource, BookingStatus, ParticipantStatus } from '@prisma/client';
import { AdminService } from './admin.service';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
}

function createAdminService(prisma: unknown, deps: { notifications?: unknown } = {}) {
  return new AdminService(
    prisma as never,
    {} as never,
    (deps.notifications ?? {}) as never,
    {} as never,
    {} as never,
  );
}

describe('AdminService query orchestration', () => {
  it('adds server-computed matching evidence to booking list rows', async () => {
    const prisma = {
      booking: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'booking-1',
            status: BookingStatus.OPEN_MATCHING,
            preferredProviderId: 'first-pick-partner',
            selectedProviderId: null,
            matchedAt: null,
            matchSource: null,
            chatRoom: null,
            participants: [
              {
                providerProfileId: 'first-pick-partner',
                status: ParticipantStatus.JOINED,
              },
              {
                providerProfileId: 'marketplace-partner',
                status: ParticipantStatus.JOINED,
              },
              {
                providerProfileId: 'declined-partner',
                status: ParticipantStatus.REJECTED,
              },
            ],
          },
        ]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listBookings()).resolves.toEqual([
      expect.objectContaining({
        matchingEvidence: {
          chatReady: false,
          finalSelection: 'CUSTOMER_SELECTION_AVAILABLE',
          firstPickStatus: 'JOINED',
          marketplaceParticipantCount: 1,
          matchedAt: null,
          matchSource: null,
          selectableParticipantCount: 1,
          stage: 'OPEN_MARKETPLACE_ACTIVE',
        },
      }),
    ]);
  });

  it('adds server-computed matching evidence to booking detail rows', async () => {
    const prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.MATCHED,
          preferredProviderId: 'first-pick-partner',
          selectedProviderId: 'first-pick-partner',
          matchedAt: new Date('2026-06-10T10:00:00.000Z'),
          matchSource: BookingMatchSource.FIRST_PICK_ACCEPTED_FIRST,
          chatRoom: { id: 'chat-1' },
          participants: [
            {
              providerProfileId: 'first-pick-partner',
              status: ParticipantStatus.SELECTED,
            },
          ],
          createdAt: new Date('2026-06-10T09:00:00.000Z'),
        }),
      },
      adminAuditLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.getBookingDetail('booking-1')).resolves.toEqual(
      expect.objectContaining({
        auditLogs: [],
        matchingEvidence: expect.objectContaining({
          chatReady: true,
          finalSelection: 'FIRST_PICK_ACCEPTED',
          firstPickStatus: 'SELECTED',
          marketplaceParticipantCount: 0,
          matchedAt: new Date('2026-06-10T10:00:00.000Z'),
          matchSource: 'FIRST_PICK_ACCEPTED_FIRST',
          selectableParticipantCount: 0,
          stage: 'MATCHED',
        }),
      }),
    );
  });

  it('maps every booking status to an Admin matching evidence stage', async () => {
    const rows = [
      [BookingStatus.CREATED, 'CREATED'],
      [BookingStatus.OPEN_MATCHING, 'OPEN_MARKETPLACE_ACTIVE'],
      [BookingStatus.MATCHED, 'MATCHED'],
      [BookingStatus.PROVIDER_ON_THE_WAY, 'SERVICE_ACTIVE'],
      [BookingStatus.ARRIVED, 'SERVICE_ACTIVE'],
      [BookingStatus.IN_SERVICE, 'SERVICE_ACTIVE'],
      [BookingStatus.COMPLETED, 'CLOSED'],
      [BookingStatus.CANCELLED, 'CLOSED'],
      [BookingStatus.NO_SHOW, 'CLOSED'],
      [BookingStatus.EXPIRED, 'CLOSED'],
      [BookingStatus.REFUNDED, 'CLOSED'],
    ] as const;
    const prisma = {
      booking: {
        findMany: jest.fn().mockResolvedValue(
          rows.map(([status]) => ({
            id: `booking-${status}`,
            status,
            preferredProviderId: null,
            selectedProviderId: null,
            matchedAt: null,
            matchSource: null,
            chatRoom: null,
            participants: [],
          })),
        ),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.listBookings()).resolves.toEqual(
      rows.map(([status, stage]) =>
        expect.objectContaining({
          id: `booking-${status}`,
          matchingEvidence: expect.objectContaining({ stage }),
        }),
      ),
    );
  });

  it('includes persisted matching decision fields in booking list queries', async () => {
    const prisma = {
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await service.listBookings();

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          matchedAt: true,
          matchSource: true,
        }),
      }),
    );
  });

  it('includes persisted matching decision fields in booking detail queries', async () => {
    const prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.getBookingDetail('booking-1')).rejects.toThrow('Booking not found');

    expect(prisma.booking.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          matchedAt: true,
          matchSource: true,
        }),
      }),
    );
  });

  it('includes persisted matching decision fields in partner overview booking queries', async () => {
    const prisma = {
      providerProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'provider-1' }),
      },
    };
    const service = createAdminService(prisma);

    await service.getProviderOverview('provider-1');

    expect(prisma.providerProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          preferredBookings: expect.objectContaining({
            select: expect.objectContaining({
              matchedAt: true,
              matchSource: true,
            }),
          }),
          selectedBookings: expect.objectContaining({
            select: expect.objectContaining({
              matchedAt: true,
              matchSource: true,
            }),
          }),
        }),
      }),
    );
  });

  it('starts partner audit log lookup while shared device lookup is still pending', async () => {
    const sharedDevices = deferred<unknown[]>();
    const providerProfile = {
      id: 'provider-1',
      devices: [{ deviceId: 'device-a' }],
      sessions: [{ deviceId: 'device-b' }],
    };
    const prisma = {
      providerProfile: {
        findUnique: jest.fn().mockResolvedValue(providerProfile),
      },
      providerDevice: {
        findMany: jest.fn().mockReturnValue(sharedDevices.promise),
      },
      adminAuditLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    const detailPromise = service.getProviderDetail('provider-1');
    await Promise.resolve();
    await Promise.resolve();

    const auditStartedBeforeSharedDeviceResolved = prisma.adminAuditLog.findMany.mock.calls.length > 0;
    sharedDevices.resolve([]);
    await detailPromise;

    expect(auditStartedBeforeSharedDeviceResolved).toBe(true);
  });

  it('starts payment audit log lookup while callback attempt lookup is still pending', async () => {
    const callbackAttempts = deferred<unknown[]>();
    const payment = {
      id: 'payment-1',
      bookingId: 'booking-1',
      providerRef: 'momo-ref-1',
    };
    const prisma = {
      payment: {
        findUnique: jest.fn().mockResolvedValue(payment),
      },
      paymentCallbackAttempt: {
        findMany: jest.fn().mockReturnValue(callbackAttempts.promise),
      },
      adminAuditLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    const detailPromise = service.getPaymentDetail('payment-1');
    await Promise.resolve();
    await Promise.resolve();

    const auditStartedBeforeCallbackResolved = prisma.adminAuditLog.findMany.mock.calls.length > 0;
    callbackAttempts.resolve([]);
    await detailPromise;

    expect(auditStartedBeforeCallbackResolved).toBe(true);
  });

  it('audits notification retry requests after enqueueing the retry job', async () => {
    const prisma = {
      adminAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const notifications = {
      retry: jest.fn().mockResolvedValue({
        latestDelivery: {
          attemptedAt: '2026-06-13T10:23:00.000Z',
          failureCode: 'messaging/mismatched-credential',
          id: 'delivery-1',
          provider: 'FCM',
          pushDeviceEnabled: true,
          pushDeviceId: 'push-device-1',
          pushDeviceLastSeenAt: '2026-06-13T10:22:00.000Z',
          pushDevicePlatform: 'android',
          status: 'FAILED',
        },
        ok: true,
        notificationId: 'notification-1',
        retryJob: {
          attempts: 3,
          backoffMs: 5000,
          jobName: 'notification-send',
          queueName: 'notification-retry',
          queuedJobId: 'queued-retry-job-1',
        },
      }),
    };
    const service = createAdminService(prisma, { notifications });

    await expect(service.retryNotification('admin-1', 'notification-1')).resolves.toEqual({
      latestDelivery: {
        attemptedAt: '2026-06-13T10:23:00.000Z',
        failureCode: 'messaging/mismatched-credential',
        id: 'delivery-1',
        provider: 'FCM',
        pushDeviceEnabled: true,
        pushDeviceId: 'push-device-1',
        pushDeviceLastSeenAt: '2026-06-13T10:22:00.000Z',
        pushDevicePlatform: 'android',
        status: 'FAILED',
      },
      ok: true,
      notificationId: 'notification-1',
      retryJob: {
        attempts: 3,
        backoffMs: 5000,
        jobName: 'notification-send',
        queueName: 'notification-retry',
        queuedJobId: 'queued-retry-job-1',
      },
    });

    expect(notifications.retry).toHaveBeenCalledWith('notification-1');
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'notification.retry',
        target: 'notification:notification-1',
        metadata: {
          latestDelivery: {
            attemptedAt: '2026-06-13T10:23:00.000Z',
            failureCode: 'messaging/mismatched-credential',
            id: 'delivery-1',
            provider: 'FCM',
            pushDeviceEnabled: true,
            pushDeviceId: 'push-device-1',
            pushDeviceLastSeenAt: '2026-06-13T10:22:00.000Z',
            pushDevicePlatform: 'android',
            status: 'FAILED',
          },
          notificationId: 'notification-1',
          operatorAction: 'Fix the latest delivery failure before retrying.',
          retryJob: {
            attempts: 3,
            backoffMs: 5000,
            jobName: 'notification-send',
            queueName: 'notification-retry',
            queuedJobId: 'queued-retry-job-1',
          },
          retryAlreadyDelivered: false,
          retryRisk: 'FAILED_DELIVERY_RETRY',
        },
      },
    });
  });

  it('lists notification delivery evidence without exposing raw push tokens', async () => {
    const prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = createAdminService(prisma);

    await service.listNotifications();

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: expect.objectContaining({
          deliveries: expect.objectContaining({
            orderBy: { attemptedAt: 'desc' },
            select: expect.objectContaining({
              provider: true,
              pushDevice: {
                select: expect.objectContaining({
                  enabled: true,
                  id: true,
                  lastSeenAt: true,
                  platform: true,
                  role: true,
                }),
              },
              response: true,
              status: true,
            }),
          }),
          user: {
            select: expect.objectContaining({
              pushDevices: expect.objectContaining({
                orderBy: { updatedAt: 'desc' },
                take: 3,
                select: expect.objectContaining({
                  enabled: true,
                  id: true,
                  lastSeenAt: true,
                  platform: true,
                  role: true,
                  updatedAt: true,
                }),
              }),
              providerProfile: { select: { id: true, displayName: true, status: true } },
            }),
          },
        }),
      }),
    );
    const select = prisma.notification.findMany.mock.calls[0]?.[0]?.select;
    expect(JSON.stringify(select)).not.toContain('token');
  });

  it('audits push device enablement without recording raw push tokens', async () => {
    const prisma = {
      pushDevice: {
        update: jest.fn().mockResolvedValue({
          id: 'push-device-1',
          platform: 'ios',
          token: 'raw-fcm-token',
          userId: 'user-1',
        }),
      },
      adminAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const service = createAdminService(prisma);

    await expect(service.enablePushDevice('admin-1', 'push-device-1')).resolves.toEqual({
      ok: true,
      pushDeviceId: 'push-device-1',
    });

    expect(prisma.pushDevice.update).toHaveBeenCalledWith({
      where: { id: 'push-device-1' },
      data: { enabled: true },
    });
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'push_device.enable',
        target: 'push_device:push-device-1',
        metadata: {
          pushDeviceId: 'push-device-1',
          userId: 'user-1',
          platform: 'ios',
        },
      },
    });
    expect(JSON.stringify(prisma.adminAuditLog.create.mock.calls)).not.toContain('raw-fcm-token');
  });
});
